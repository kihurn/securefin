import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldAlert, KeyRound, Loader2, RefreshCw, LogOut, CheckCircle2, UserCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { generateFaceDescriptor, compareFaces, ensureModelsLoaded, safeParseFaceDescriptor, calculateDistance, getConfidenceScore } from '../faceDetection';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/audio';
import { UserProfile } from '../types';

interface FaceLockOverlayProps {
  userProfile: UserProfile;
  onUnlock: () => void;
  onLogout: () => void;
}

export const FaceLockOverlay: React.FC<FaceLockOverlayProps> = ({
  userProfile,
  onUnlock,
  onLogout,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Biometric state
  const [isInitializingModels, setIsInitializingModels] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [biometricError, setBiometricError] = useState('');
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const isMountedRef = useRef(true);

  // 1. Initialize face-api and start camera on mount
  useEffect(() => {
    isMountedRef.current = true;
    startFaceScanningFlow();
    return () => {
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  const startFaceScanningFlow = async () => {
    setBiometricError('');
    try {
      setIsInitializingModels(true);
      await ensureModelsLoaded();
      setIsInitializingModels(false);
      
      await startCamera();
      
      // Auto-start continuous scanning loop for zero-click, secure unlocking
      setTimeout(() => {
        if (isMountedRef.current) {
          handleScanFaceAndUnlock(true);
        }
      }, 1000);
    } catch (err) {
      console.error('FaceLockOverlay models init error:', err);
      setIsInitializingModels(false);
      setBiometricError('Failed to initialize local biometric model tensors.');
    }
  };

  const startCamera = async () => {
    try {
      if (streamRef.current) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraPermission(true);
    } catch (err) {
      console.error('Failed to capture stream on lock screen:', err);
      setCameraPermission(false);
      setBiometricError('Webcam access was denied. Please allow camera permissions to unlock.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 2. Scan face and match with baseline key (continuous loop)
  const handleScanFaceAndUnlock = async (isAuto = false) => {
    if (!videoRef.current || (!isAuto && isScanning) || unlockSuccess) return;
    if (!isAuto) playClickSound();
    setIsScanning(true);
    setBiometricError('');

    try {
      // Fetch stored baseline first to make sure they actually have a baseline
      const emailKey = userProfile.email.toLowerCase().trim();
      const stored = localStorage.getItem(`fintrust_face_baseline_${emailKey}`) || localStorage.getItem('fintrust_face_baseline_global');
      
      if (!stored) {
        setIsScanning(false);
        setBiometricError('No biometric baseline signature exists on this machine. Please register face biometric in settings.');
        if (!isAuto) playErrorSound();
        return;
      }

      const baselineDescriptor = safeParseFaceDescriptor(stored);
      if (!baselineDescriptor) {
        setIsScanning(false);
        setBiometricError('Biometric template baseline is corrupted or malformed. Please enroll again in settings.');
        if (!isAuto) playErrorSound();
        return;
      }
      let matchFound = false;

      // Keep polling the face detector every 350ms until we find a match or component unmounts
      while (isMountedRef.current && !unlockSuccess) {
        if (!videoRef.current) break;

        let currentDescriptor: Float32Array | null = null;
        try {
          currentDescriptor = await generateFaceDescriptor(videoRef.current);
        } catch (scanErr) {
          console.warn('Continuous unlock scan attempt failed (will retry):', scanErr);
        }

        if (currentDescriptor) {
          const distance = calculateDistance(currentDescriptor, baselineDescriptor);
          const score = getConfidenceScore(distance);
          const match = distance <= 0.40; // matchThreshold
          if (match) {
            matchFound = true;
            break; // Valid matched face!
          } else {
            setBiometricError(`Face detected, but biometric signature mismatch (Confidence: ${score}%). Please align face clearly.`);
          }
        } else {
          setBiometricError('Scanning... Position your face clearly inside the scanner frame.');
        }

        // Wait a short duration between frame analyses to prevent thread locks
        await new Promise((resolve) => setTimeout(resolve, 350));
      }

      if (!isMountedRef.current) {
        return;
      }

      if (matchFound) {
        // Match Successful!
        setUnlockSuccess(true);
        setIsScanning(false);
        playSuccessSound();
        stopCamera();

        setTimeout(() => {
          onUnlock();
        }, 1000);
      } else {
        setIsScanning(false);
      }

    } catch (err: any) {
      console.error('Unlock error:', err);
      setIsScanning(false);
      setBiometricError(err?.message || 'An unexpected internal cryptographic processing error occurred.');
      playErrorSound();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto" id="face-lock-overlay-screen">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative space-y-6" id="lock-modal-card">
        
        {/* Lock Screen Header Banner */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-indigo-950/80 border border-indigo-500/30 rounded-full flex items-center justify-center animate-pulse" id="lock-header-pulse">
            <ShieldAlert className="h-6 w-6 text-indigo-400" />
          </div>
          <h2 className="text-lg font-extrabold text-white tracking-tight">
            Session Locked: No Face Detected
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
            Your continuous biometric shield has suspended active workspace capabilities. Please verify your face identity to resume, or log off.
          </p>
        </div>

        {/* Camera viewport frame */}
        <div className="flex flex-col items-center space-y-4" id="lock-face-verification-section">
          <div className="relative w-48 h-48 rounded-full border border-slate-700 bg-slate-950 flex items-center justify-center overflow-hidden shadow-inner group" id="lock-camera-viewport">
            {isInitializingModels && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 space-y-2 text-center z-10">
                <Loader2 className="h-6 w-6 text-indigo-400 animate-spin" />
                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wider">Syncing tensors...</span>
              </div>
            )}

            {cameraPermission === false && !isInitializingModels && (
              <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 text-center space-y-2 z-10">
                <ShieldAlert className="h-6 w-6 text-rose-500" />
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-snug">Webcam Blocked</span>
              </div>
            )}

            {unlockSuccess ? (
              <div className="absolute inset-0 bg-emerald-950/85 flex flex-col items-center justify-center text-center p-4 z-20">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 animate-bounce" />
                <span className="text-xs font-extrabold text-white mt-2">Identity Verified</span>
                <span className="text-[9px] font-mono text-emerald-300 uppercase tracking-widest block">Unlocking Workspace...</span>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-350 ${
                  cameraPermission && !isInitializingModels ? 'opacity-100' : 'opacity-0'
                }`}
                id="lock-video-feed"
              />
            )}

            {/* Scanning laser visual cue */}
            {isScanning && (
              <motion.div
                initial={{ top: '15%' }}
                animate={{ top: '85%' }}
                transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5, ease: 'easeInOut' }}
                className="absolute left-4 right-4 h-0.5 bg-brand-primary shadow-[0_0_8px_rgba(37,99,235,0.8)] z-10"
              />
            )}
          </div>

          {biometricError && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/40 rounded-xl text-[10px] text-rose-400 flex items-start gap-2 max-w-sm text-center font-medium leading-relaxed" id="lock-face-err">
              <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{biometricError}</span>
            </div>
          )}

          {/* Prompt Actions: Retry or Logout */}
          <div className="w-full space-y-2.5 pt-2">
            <button
              onClick={handleScanFaceAndUnlock}
              disabled={isScanning || isInitializingModels || unlockSuccess || cameraPermission === false}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-container disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-lg shadow-brand-primary/10 flex items-center justify-center gap-2 cursor-pointer"
              id="lock-btn-biometric-verify"
            >
              {isScanning ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Scanning facial descriptors...
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" />
                  Verify & Resume (Retry Scan)
                </>
              )}
            </button>

            <button
              onClick={() => {
                playClickSound();
                onLogout();
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-750 text-rose-400 hover:text-rose-300 text-xs font-bold rounded-xl transition border border-slate-700/50 flex items-center justify-center gap-2 cursor-pointer"
              id="lock-btn-log-off-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
              Secure Log Off
            </button>
          </div>

          {cameraPermission === false && (
            <button
              onClick={startCamera}
              className="text-[10px] font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5 cursor-pointer pt-1"
            >
              <RefreshCw className="h-3 w-3" />
              Re-request Camera Stream
            </button>
          )}
        </div>

        {/* Footer info tracker */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center text-[10px] text-slate-500 font-mono" id="lock-footer">
          <span>Active Identity Node: {userProfile.name}</span>
          <span className="text-slate-600">Continuous Biometric Shield</span>
        </div>

      </div>
    </div>
  );
};
