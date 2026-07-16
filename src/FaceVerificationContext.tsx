import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { generateFaceDescriptor, detectMultipleFaces, compareFaces, detectFacesFull, safeParseFaceDescriptor } from './faceDetection';
import { FaceLockOverlay } from './components/FaceLockOverlay';
import { UserProfile } from './types';
import { ShieldAlert, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface FaceVerificationContextType {
  isLocked: boolean;
  setIsLocked: (locked: boolean) => void;
  multipleFacesDetected: boolean;
  triggerImmediateScan: () => Promise<boolean>;
  verificationMode: 'interval' | 'constant';
  setVerificationMode: (mode: 'interval' | 'constant') => void;
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
  onTriggerEnroll?: () => void;
}

export const FaceVerificationProvider: React.FC<FaceVerificationProviderProps> = ({
  children,
  userProfile,
  onLogout,
  onTriggerEnroll,
}) => {
  const [isLocked, setIsLocked] = useState(false);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [showEnrollPrompt, setShowEnrollPrompt] = useState(true);
  
  // Keep track of verification frequency mode: interval or constant
  const [verificationMode, setVerificationModeState] = useState<'interval' | 'constant'>(() => {
    return (localStorage.getItem('fintrust_face_verification_mode') as 'interval' | 'constant') || 'interval';
  });

  const setVerificationMode = (mode: 'interval' | 'constant') => {
    localStorage.setItem('fintrust_face_verification_mode', mode);
    setVerificationModeState(mode);
  };

  // Hidden video ref for background scanning
  const hiddenVideoRef = useRef<HTMLVideoElement | null>(null);
  const hiddenStreamRef = useRef<MediaStream | null>(null);
  const persistentStreamActiveRef = useRef<boolean>(false);
  const checkIntervalRef = useRef<any>(null);
  const isScanningRef = useRef<boolean>(false);

  // Check if current user has a registered baseline face in local storage or database
  const checkBaselinePresence = () => {
    if (!userProfile?.email) {
      setHasBaseline(false);
      return false;
    }
    const emailKey = userProfile.email.toLowerCase().trim();
    
    // If the database faceDescriptor is missing/NULL, they are NOT enrolled.
    // Clear out local storage to maintain absolute consistency and prompt them.
    if (!userProfile.faceDescriptor) {
      localStorage.removeItem(`fintrust_face_baseline_${emailKey}`);
      localStorage.removeItem('fintrust_face_baseline_global');
      setHasBaseline(false);
      setShowEnrollPrompt(true);
      return false;
    }

    // Otherwise, synchronize database-level face baseline to local browser cache
    localStorage.setItem(`fintrust_face_baseline_${emailKey}`, userProfile.faceDescriptor);
    localStorage.setItem(`fintrust_face_baseline_global`, userProfile.faceDescriptor);

    setHasBaseline(true);
    setShowEnrollPrompt(false);
    return true;
  };

  useEffect(() => {
    checkBaselinePresence();
  }, [userProfile]);

  // Main Background Verification Routine
  const runBackgroundVerification = async (): Promise<boolean> => {
    if (!userProfile?.email || isLocked) return true;
    
    // Non-reentrant lock to prevent concurrent overlapping scans from running simultaneously
    if (isScanningRef.current) {
      console.log('[Continuous Shield] Scanning execution already in progress, skipping overlapping sweep.');
      return true;
    }
    isScanningRef.current = true;
    
    // Check baseline again
    const emailKey = userProfile.email.toLowerCase().trim();
    const stored = localStorage.getItem(`fintrust_face_baseline_${emailKey}`) || localStorage.getItem('fintrust_face_baseline_global');
    if (!stored) {
      console.log('No facial baseline registered. Continuous session check skipped.');
      isScanningRef.current = false;
      return true;
    }

    const baselineDescriptor = safeParseFaceDescriptor(stored);
    if (!baselineDescriptor) {
      console.error('[Continuous Shield] Stored baseline face descriptor is malformed.');
      isScanningRef.current = false;
      return true;
    }
    
    console.log('[Continuous Shield] Initiating background biometric sweep...');
    
    try {
      // 1. Request background video stream programmatically
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      hiddenStreamRef.current = stream;

      // 2. Attach stream to hidden video element
      if (!hiddenVideoRef.current) {
        console.warn('[Continuous Shield] hiddenVideoRef not pre-initialized in DOM. Constructing fallback.');
        const video = document.createElement('video');
        video.width = 320;
        video.height = 240;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.className = "absolute pointer-events-none opacity-0 invisible";
        document.body.appendChild(video);
        hiddenVideoRef.current = video;
      }

      hiddenVideoRef.current.srcObject = stream;
      
      // Explicitly call play to start loading/rendering frames in background
      try {
        await hiddenVideoRef.current.play();
      } catch (err) {
        console.warn('[Continuous Shield] hidden video play error:', err);
      }
      
      // 3. Warm up camera buffer for 2 seconds (crucial for auto-exposure/focus accuracy)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 4. Run unified single-pass face detection for Landmarks and Descriptor
      const result = await detectFacesFull(hiddenVideoRef.current);
      const currentDescriptor = result.descriptor;

      // Clean up webcam stream immediately after capture to release hardware lock (turns off recording LED)
      stream.getTracks().forEach((track) => track.stop());
      hiddenStreamRef.current = null;

      if (!currentDescriptor) {
        console.warn('[Continuous Shield] Background verification failed: No face detected in frame.');
        // Lock session as no authorized face was found
        setIsLocked(true);
        isScanningRef.current = false;
        return false;
      }

      // 5. Compare descriptors using Euclidean distance
      const match = compareFaces(currentDescriptor, baselineDescriptor);
      if (!match) {
        console.warn('[Continuous Shield] Background verification failed: Face descriptor mismatch.');
        setIsLocked(true);
        isScanningRef.current = false;
        return false;
      }

      console.log('[Continuous Shield] Active session validated successfully. Workspace secure.');
      isScanningRef.current = false;
      return true;

    } catch (error: any) {
      console.error('[Continuous Shield] Error running background camera verify:', error);
      // If permission is denied or camera is blocked, lock for safety
      setIsLocked(true);
      isScanningRef.current = false;
      return false;
    }
  };

  // Setup loop timer running every 20 seconds OR constant (looping) verification
  useEffect(() => {
    // If we're not logged in, or don't have a baseline, or are locked, do nothing and clean up
    if (!userProfile?.email || !hasBaseline || isLocked) {
      if (checkIntervalRef.current) {
        if (verificationMode === 'constant') {
          clearTimeout(checkIntervalRef.current);
        } else {
          clearInterval(checkIntervalRef.current);
        }
        checkIntervalRef.current = null;
      }
      if (hiddenStreamRef.current) {
        hiddenStreamRef.current.getTracks().forEach((track) => track.stop());
        hiddenStreamRef.current = null;
      }
      persistentStreamActiveRef.current = false;
      return;
    }

    let isSubscribed = true;

    if (verificationMode === 'constant') {
      console.log('[Continuous Shield] Constant Verification Mode Activated. Spawning active face sentinel...');
      
      // Clear any existing interval/timeout
      if (checkIntervalRef.current) {
        clearTimeout(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      // Loop function for constant scanning
      const runConstantLoop = async () => {
        if (!isSubscribed || isLocked || !userProfile?.email || !hasBaseline) {
          return;
        }

        const emailKey = userProfile.email.toLowerCase().trim();
        const stored = localStorage.getItem(`fintrust_face_baseline_${emailKey}`) || localStorage.getItem('fintrust_face_baseline_global');
        if (!stored) {
          return;
        }

        const baselineDescriptor = safeParseFaceDescriptor(stored);
        if (!baselineDescriptor) {
          return;
        }

        try {
          // Ensure stream is active
          if (!hiddenStreamRef.current || !persistentStreamActiveRef.current) {
            console.log('[Continuous Shield] Spawning persistent camera stream for constant mode...');
            const stream = await navigator.mediaDevices.getUserMedia({
              video: { width: 320, height: 240, facingMode: 'user' },
              audio: false,
            });
            if (!isSubscribed) {
              stream.getTracks().forEach((t) => t.stop());
              return;
            }
            hiddenStreamRef.current = stream;
            persistentStreamActiveRef.current = true;

            if (!hiddenVideoRef.current) {
              const video = document.createElement('video');
              video.width = 320;
              video.height = 240;
              video.autoplay = true;
              video.muted = true;
              video.playsInline = true;
              video.className = "absolute pointer-events-none opacity-0 invisible";
              document.body.appendChild(video);
              hiddenVideoRef.current = video;
            }
            hiddenVideoRef.current.srcObject = stream;
            try {
              await hiddenVideoRef.current.play();
            } catch (err) {
              console.warn('[Continuous Shield] Play failed on persistent stream:', err);
            }
            // First warmup delay
            await new Promise((resolve) => setTimeout(resolve, 1200));
          }

          if (!isSubscribed || isLocked) return;

          const result = await detectFacesFull(hiddenVideoRef.current!);
          const currentDescriptor = result.descriptor;

          if (!isSubscribed || isLocked) return;

          if (!currentDescriptor) {
            console.warn('[Continuous Shield] Constant check failed: No face detected.');
            setIsLocked(true);
            return;
          }

          const match = compareFaces(currentDescriptor, baselineDescriptor);
          if (!match) {
            console.warn('[Continuous Shield] Constant check failed: Biometric mismatch.');
            setIsLocked(true);
            return;
          }

          console.log('[Continuous Shield] Constant verification success. Secure workspace.');
          
          // Queue the next check in 2 seconds to avoid freezing the system/browser
          if (isSubscribed && !isLocked) {
            checkIntervalRef.current = setTimeout(runConstantLoop, 2000);
          }

        } catch (error: any) {
          console.error('[Continuous Shield] Error in constant loop:', error);
          if (isSubscribed && !isLocked) {
            setIsLocked(true);
          }
        }
      };

      // Start constant loop
      runConstantLoop();

    } else {
      // Interval Mode (20 seconds)
      console.log('[Continuous Shield] Interval Verification Mode Activated (20s sweeps).');
      
      if (hiddenStreamRef.current) {
        hiddenStreamRef.current.getTracks().forEach((track) => track.stop());
        hiddenStreamRef.current = null;
      }
      persistentStreamActiveRef.current = false;

      // Set up standard 20s interval
      checkIntervalRef.current = setInterval(() => {
        runBackgroundVerification();
      }, 20000);
    }

    return () => {
      isSubscribed = false;
      if (checkIntervalRef.current) {
        if (verificationMode === 'constant') {
          clearTimeout(checkIntervalRef.current);
        } else {
          clearInterval(checkIntervalRef.current);
        }
        checkIntervalRef.current = null;
      }
      if (hiddenStreamRef.current) {
        hiddenStreamRef.current.getTracks().forEach((track) => track.stop());
        hiddenStreamRef.current = null;
      }
      persistentStreamActiveRef.current = false;
    };
  }, [userProfile, hasBaseline, isLocked, verificationMode]);

  // Expose an on-demand trigger mechanism (e.g., when transitioning tabs or making big transactions)
  const triggerImmediateScan = async (): Promise<boolean> => {
    return await runBackgroundVerification();
  };

  return (
    <FaceVerificationContext.Provider value={{ 
      isLocked, 
      setIsLocked, 
      multipleFacesDetected: false, 
      triggerImmediateScan,
      verificationMode,
      setVerificationMode
    }}>
      {/* Primary Application Layout */}
      <div className="relative min-h-screen" id="session-wrapper">
        {/* Hidden video element for background scanning to ensure proper decoding and layout */}
        <video
          ref={hiddenVideoRef}
          width={320}
          height={240}
          autoPlay
          muted
          playsInline
          className="absolute pointer-events-none opacity-0 invisible"
          style={{ width: '320px', height: '240px', position: 'absolute', top: 0, left: 0 }}
        />
        {children}

        {/* Secure, Non-Bypassable Lock Modal Overlay */}
        <AnimatePresence>
          {isLocked && userProfile && (
            <FaceLockOverlay
              userProfile={userProfile}
              onUnlock={() => {
                setIsLocked(false);
                // Trigger check baseline in case they enrolled in the overlay
                checkBaselinePresence();
              }}
              onLogout={() => {
                setIsLocked(false);
                onLogout();
              }}
            />
          )}
        </AnimatePresence>

        {/* Biometric Enrollment Notification Banner (Floating Bottom Right) */}
        <AnimatePresence>
          {userProfile && !hasBaseline && showEnrollPrompt && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="fixed bottom-6 right-6 z-[90] max-w-sm w-full bg-slate-900/95 border border-amber-500/35 text-slate-100 rounded-2xl p-5 shadow-2xl backdrop-blur-md flex flex-col gap-4"
              id="floating-biometric-enroll-banner"
            >
              <div className="flex gap-3">
                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl shrink-0 self-start">
                  <ShieldAlert className="h-5 w-5 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold font-mono tracking-wider uppercase text-amber-400 flex items-center gap-1.5">
                    Biometric Shield Offline
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-semibold">
                    No registered facial baseline was detected in the secure database. Register your biometrics now to activate continuous workstation protection.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setShowEnrollPrompt(false)}
                  className="px-3 py-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onTriggerEnroll) {
                      onTriggerEnroll();
                    }
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition flex items-center gap-1.5 shadow-md shadow-indigo-600/15"
                >
                  Enroll Workstation
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FaceVerificationContext.Provider>
  );
};
