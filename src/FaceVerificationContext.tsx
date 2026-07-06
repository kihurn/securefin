import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { generateFaceDescriptor, detectMultipleFaces, compareFaces } from './faceDetection';
import { FaceLockOverlay } from './components/FaceLockOverlay';
import { UserProfile } from './types';
import { ShieldAlert, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { playErrorSound } from './utils/audio';

interface FaceVerificationContextType {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  multipleFacesDetected: boolean;
  triggerImmediateScan: () => Promise<boolean>;
}

const FaceVerificationContext = createContext<FaceVerificationContextType | undefined>(undefined);

export const useFaceVerification = () => {
  const context = useContext(FaceVerificationContext);
  if (!context) {
    throw new Error('useFaceVerification must be used within a FaceVerificationProvider');
  }
  return context;
};

interface FaceVerificationProviderProps {
  children: React.ReactNode;
  userProfile: UserProfile | null;
  onLogout: () => void;
}

export const FaceVerificationProvider: React.FC<FaceVerificationProviderProps> = ({
  children,
  userProfile,
  onLogout,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [multipleFacesDetected, setMultipleFacesDetected] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [isPausedByMultiFace, setIsPausedByMultiFace] = useState(false);
  const [multiFaceCountdown, setMultiFaceCountdown] = useState(3);

  // Hidden video ref for background scanning
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenStreamRef = useRef<MediaStream | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current user has a registered baseline face in local storage
  const checkBaselinePresence = () => {
    if (!userProfile?.email) {
      setHasBaseline(false);
      return false;
    }
    const emailKey = userProfile.email.toLowerCase().trim();
    const stored = localStorage.getItem(`fintrust_face_baseline_${emailKey}`) || localStorage.getItem('fintrust_face_baseline_global');
    const present = !!stored;
    setHasBaseline(present);
    return present;
  };

  useEffect(() => {
    checkBaselinePresence();
  }, [userProfile]);

  // Helper: waits until a video element has real frame data (readyState >= HAVE_CURRENT_DATA)
  // Resolves on 'canplay' event or times out after 5s to prevent hanging.
  const waitForVideoReady = (video: HTMLVideoElement, timeoutMs = 5000): Promise<boolean> => {
    return new Promise((resolve) => {
      // Already has frame data — resolve immediately
      if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
        resolve(true);
        return;
      }
      const timer = setTimeout(() => {
        video.removeEventListener('canplay', onReady);
        console.warn('[Continuous Shield] Video ready timeout — readyState:', video.readyState);
        resolve(false);
      }, timeoutMs);
      const onReady = () => {
        clearTimeout(timer);
        resolve(true);
      };
      video.addEventListener('canplay', onReady, { once: true });
    });
  };

  // Main Background Verification Routine
  const runBackgroundVerification = async (): Promise<boolean> => {
    if (!userProfile?.email || isLocked || isPausedByMultiFace) return true;

    // Check baseline again
    const emailKey = userProfile.email.toLowerCase().trim();
    const stored = localStorage.getItem(`fintrust_face_baseline_${emailKey}`) || localStorage.getItem('fintrust_face_baseline_global');
    if (!stored) {
      console.log('No facial baseline registered. Continuous session check skipped.');
      return true;
    }

    const baselineDescriptor = new Float32Array(JSON.parse(stored));

    console.log('[Continuous Shield] Initiating background biometric sweep...');

    let activeStream: MediaStream | null = null;

    try {
      // 1. Request background video stream programmatically
      activeStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      hiddenStreamRef.current = activeStream;

      // 2. Use the persistent DOM-mounted video element (required for iOS Safari
      //    to decode frames — off-DOM video elements are silently ignored by WebKit)
      if (!hiddenVideoRef.current) {
        console.error('[Continuous Shield] Hidden video element not mounted in DOM. Aborting scan.');
        return true;
      }
      const video = hiddenVideoRef.current;

      video.srcObject = activeStream;

      // 3. Explicitly call play() to start frame decoding
      try {
        await video.play();
      } catch (playErr) {
        console.warn('[Continuous Shield] Playback start was interrupted or postponed:', playErr);
      }

      // 4. Wait until the video has actual decoded frame data (canplay event)
      //    This is the critical fix — replaces the unreliable 2s blind timeout.
      const isReady = await waitForVideoReady(video, 5000);
      if (!isReady) {
        console.warn('[Continuous Shield] Video stream did not become ready in time. Skipping scan.');
        return true; // Skip silently, don't lock — camera may just be slow to init
      }

      // 5. Small stabilization pause for auto-exposure/focus to settle
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 6. Run multiple face detection first for privacy check
      const isMultiFace = await detectMultipleFaces(video);
      setMultipleFacesDetected(isMultiFace);

      const multiFacePauseEnabled = localStorage.getItem(`fintrust_multi_face_pause_${emailKey}`) === 'true' || localStorage.getItem('fintrust_multi_face_pause_global') === 'true';

      if (isMultiFace && multiFacePauseEnabled) {
        console.warn('[Continuous Shield] Multi-face detected and auto-pause is enabled. Suspending workspace activity.');
        setIsPausedByMultiFace(true);
        playErrorSound();
        return false;
      }

      // 7. Generate active face descriptor from current frame
      const currentDescriptor = await generateFaceDescriptor(video);

      if (!currentDescriptor) {
        console.warn('[Continuous Shield] Background verification failed: No face detected in frame.');
        setIsLocked(true);
        return false;
      }

      // 8. Compare descriptors using Euclidean distance
      const match = compareFaces(currentDescriptor, baselineDescriptor);
      if (!match) {
        console.warn('[Continuous Shield] Background verification failed: Face descriptor mismatch.');
        setIsLocked(true);
        return false;
      }

      console.log('[Continuous Shield] Active session validated successfully. Workspace secure.');
      return true;

    } catch (error: any) {
      console.error('[Continuous Shield] Error running background camera verify:', error);
      setMultipleFacesDetected(false);
      setIsLocked(true);
      return false;
    } finally {
      // CRITICAL: Always release the webcam hardware lock in the finally block,
      // ensuring the camera recording light turns off even if an error occurs.
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (hiddenStreamRef.current) {
        hiddenStreamRef.current.getTracks().forEach((track) => track.stop());
        hiddenStreamRef.current = null;
      }
      if (hiddenVideoRef.current) {
        hiddenVideoRef.current.srcObject = null;
        // Do NOT null out hiddenVideoRef — it points to the DOM-mounted element
      }
    }
  };

  // Setup loop timer running every 30 seconds
  useEffect(() => {
    // Only set up the timer if the user is logged in AND has registered biometrics
    if (userProfile?.email && hasBaseline && !isLocked) {
      // Clear any existing interval
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }

      console.log('[Continuous Shield] Session monitoring initialized (10s interval active).');

      checkIntervalRef.current = setInterval(() => {
        runBackgroundVerification();
      }, 10000); // 10 seconds
    } else {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    }

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      // Make sure stream is stopped on unmount
      if (hiddenStreamRef.current) {
        hiddenStreamRef.current.getTracks().forEach((track) => track.stop());
        hiddenStreamRef.current = null;
      }
    };
  }, [userProfile, hasBaseline, isLocked]);

  // Expose an on-demand trigger mechanism (e.g., when transitioning tabs or making big transactions)
  const triggerImmediateScan = async (): Promise<boolean> => {
    return await runBackgroundVerification();
  };

  // Anti-Shoulder-Surfing Pause Timer logic
  useEffect(() => {
    let countdownInterval: NodeJS.Timeout | null = null;
    let autoResumeTimeout: NodeJS.Timeout | null = null;

    if (isPausedByMultiFace) {
      setMultiFaceCountdown(3);

      countdownInterval = setInterval(() => {
        setMultiFaceCountdown((prev) => {
          if (prev <= 1) {
            if (countdownInterval) clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      autoResumeTimeout = setTimeout(() => {
        setIsPausedByMultiFace(false);
        setMultipleFacesDetected(false);
      }, 3000);
    }

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      if (autoResumeTimeout) clearTimeout(autoResumeTimeout);
    };
  }, [isPausedByMultiFace]);

  return (
    <FaceVerificationContext.Provider value={{ isLocked, setIsLocked, multipleFacesDetected, triggerImmediateScan }}>
      {/* Primary Application Layout */}
      <div className="relative min-h-screen" id="session-wrapper">
        {children}

        {/*
          Persistent hidden video element — MUST be in the DOM for iOS Safari to decode
          video frames. Off-DOM video elements are silently ignored by WebKit/iOS.
          Kept invisible via absolute positioning off-screen.
        */}
        <video
          ref={hiddenVideoRef}
          muted
          playsInline
          autoPlay
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-9999px',
            left: '-9999px',
            width: '1px',
            height: '1px',
            opacity: 0,
            pointerEvents: 'none',
          }}
          id="biometric-hidden-scanner"
        />

        {/* Floating Privacy Warning Banner for Multiple Faces */}
        <AnimatePresence>
          {multipleFacesDetected && userProfile && !isLocked && !isPausedByMultiFace && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 16 }}
              exit={{ opacity: 0, y: -50 }}
              className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40 max-w-md w-full px-4"
              id="privacy-warning-container"
            >
              <div className="bg-rose-950/90 border border-rose-800 text-rose-200 backdrop-blur-md rounded-2xl p-4 flex items-start gap-3 shadow-2xl">
                <ShieldAlert className="h-5 w-5 text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold tracking-tight uppercase font-mono">
                    Privacy Warning: Multiple Faces Detected
                  </h4>
                  <p className="text-[10px] text-rose-300 leading-normal font-semibold">
                    We detected secondary face shapes in your workstation viewport. Shielding sensitive data fields. Move to a private area.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Anti-Shoulder-Surfing Multi-Face Auto-Pause Overlay */}
        <AnimatePresence>
          {isPausedByMultiFace && userProfile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[120] flex items-center justify-center p-4"
              id="multi-face-pause-screen"
            >
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-center space-y-6" id="multi-face-pause-card">
                <div className="mx-auto h-16 w-16 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-full flex items-center justify-center animate-pulse" id="multi-face-pause-icon">
                  <EyeOff className="h-8 w-8 text-rose-400" />
                </div>

                <div className="space-y-2">
                  <h2 className="text-xl font-extrabold text-white tracking-tight">
                    Workspace Paused: Secondary Face Detected
                  </h2>
                  <p className="text-xs text-rose-400 font-mono uppercase tracking-wider font-semibold">
                    Anti-Shoulder-Surfing Shield Active
                  </p>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed max-w-sm mx-auto" id="multi-face-explanation">
                  We noticed someone else looking at the screen too! To safeguard sensitive data and prevent unauthorized view-ins, active session access is suspended.
                </div>

                <div className="flex flex-col items-center justify-center space-y-2" id="multi-face-timer-container">
                  <div className="text-4xl font-extrabold text-indigo-400 font-mono tracking-tighter" id="multi-face-timer-count">
                    {multiFaceCountdown}s
                  </div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono font-bold">
                    Resuming secure session in...
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-800/60 text-[10px] text-slate-500 font-mono">
                  Workspace Security Suite Active
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Secure, Non-Bypassable Lock Modal Overlay */}
        <AnimatePresence>
          {isLocked && userProfile && (
            <FaceLockOverlay
              userProfile={userProfile}
              onUnlock={() => {
                setIsLocked(false);
                setMultipleFacesDetected(false);
                // Trigger check baseline in case they enrolled in the overlay
                checkBaselinePresence();
              }}
              onLogout={() => {
                setIsLocked(false);
                setMultipleFacesDetected(false);
                onLogout();
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </FaceVerificationContext.Provider>
  );
};
