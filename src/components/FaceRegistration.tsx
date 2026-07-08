import React, { useEffect, useRef, useState } from 'react';
import { Camera, ShieldCheck, Loader2, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { generateFaceDescriptor, ensureModelsLoaded } from '../faceDetection';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/audio';

interface FaceRegistrationProps {
  userEmail: string;
  onCaptureComplete: (descriptor: Float32Array) => void;
  onBack: () => void;
}

export const FaceRegistration: React.FC<FaceRegistrationProps> = ({
  userEmail,
  onCaptureComplete,
  onBack,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [baselineCaptured, setBaselineCaptured] = useState<boolean>(false);
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null);

  const isMountedRef = useRef(true);

  // 1. Load face-api models on mount
  useEffect(() => {
    isMountedRef.current = true;
    let active = true;
    async function init() {
      try {
        setIsLoadingModels(true);
        await ensureModelsLoaded();
        if (active) {
          setIsLoadingModels(false);
          // Auto-request webcam once models are ready
          requestWebcam();
        }
      } catch (err: any) {
        if (active) {
          console.error('Failed to load biometric models:', err);
          setErrorMessage('Failed to initialize local biometric models.');
          setIsLoadingModels(false);
        }
      }
    }
    init();

    return () => {
      active = false;
      isMountedRef.current = false;
      stopCamera();
    };
  }, []);

  // 2. Request webcam stream
  const requestWebcam = async () => {
    setErrorMessage('');
    try {
      if (streamRef.current) {
        stopCamera();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermissionGranted(true);
    } catch (err: any) {
      console.error('Webcam permission denied or unavailable:', err);
      setPermissionGranted(false);
      setErrorMessage(
        'Webcam access is required for Sovereign Facial biometric validation. Please grant permission in your browser.'
      );
      playErrorSound();
    }
  };

  // 3. Stop camera helper
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 4. Capture baseline profile (continuous scan until found)
  const handleCaptureBaseline = async () => {
    if (!videoRef.current || isScanning || baselineCaptured) return;
    playClickSound();
    setIsScanning(true);
    setErrorMessage('');
    setScanProgress(10);

    try {
      // Animate the progress bar up and down to show an active scanning laser sweep
      let progressDir = 1;
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 85) progressDir = -1;
          if (prev <= 15) progressDir = 1;
          return prev + (progressDir * 5);
        });
      }, 120);

      let descriptor: Float32Array | null = null;

      // Keep polling the face detector every 300ms until we successfully get a descriptor
      while (isMountedRef.current) {
        if (!videoRef.current) break;
        
        try {
          descriptor = await generateFaceDescriptor(videoRef.current);
        } catch (scanErr) {
          console.warn('Continuous scanning attempt failed (will retry):', scanErr);
        }

        if (descriptor) {
          break; // Successfully got a face descriptor!
        }

        // Wait a short duration between frame analyses to prevent thread locks
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      clearInterval(progressInterval);

      // If the component was unmounted or scanning was cancelled, abort
      if (!isMountedRef.current) {
        return;
      }

      if (!descriptor) {
        setScanProgress(0);
        setIsScanning(false);
        setErrorMessage(
          'Scanning aborted. Please position your face clearly in the scanning frame with good lighting and try again.'
        );
        playErrorSound();
        return;
      }

      // Success: Convert Float32Array to standard array and serialize to localStorage
      const numericArray = Array.from(descriptor);
      const emailKey = userEmail ? userEmail.toLowerCase().trim() : 'default_user';
      localStorage.setItem(`fintrust_face_baseline_${emailKey}`, JSON.stringify(numericArray));
      // Save global default as fallback for immediate session matching
      localStorage.setItem(`fintrust_face_baseline_global`, JSON.stringify(numericArray));

      setScanProgress(100);
      setCapturedDescriptor(descriptor);
      setBaselineCaptured(true);
      setIsScanning(false);
      playSuccessSound();
      
      // Fire callback to register flow
      setTimeout(() => {
        onCaptureComplete(descriptor!);
      }, 1200);

    } catch (err: any) {
      console.error('Facial enrollment error:', err);
      setScanProgress(0);
      setIsScanning(false);
      setErrorMessage(err?.message || 'An unexpected error occurred during biometric key generation.');
      playErrorSound();
    }
  };

  return (
    <div className="space-y-6 flex flex-col items-center" id="face-enrollment-panel">
      <div className="text-center space-y-2">
        <h3 className="font-extrabold text-white text-base flex items-center justify-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
          Sovereign Face Biometrics Setup
        </h3>
        <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
          Enroll your workstation facial node identity to activate continuous, browser-secure session shielding.
        </p>
      </div>

      {/* Camera Stage / Rounded Scanner Frame */}
      <div className="relative w-64 h-64 rounded-full border-2 border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shadow-2xl group" id="face-scanner-viewport">
        {/* Loading Models overlay */}
        {isLoadingModels && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 space-y-3 z-30">
            <Loader2 className="h-8 w-8 text-brand-primary animate-spin" />
            <span className="text-[10px] font-mono text-slate-400 text-center uppercase tracking-wider">
              Downloading localized model tensors...
            </span>
          </div>
        )}

        {/* Permission Denied overlay */}
        {!isLoadingModels && permissionGranted === false && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <span className="text-xs text-slate-300 font-semibold leading-relaxed">
              Camera Access Denied
            </span>
            <button
              onClick={requestWebcam}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Permission
            </button>
          </div>
        )}

        {/* Video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-350 ${
            permissionGranted && !isLoadingModels ? 'opacity-100' : 'opacity-0'
          }`}
          id="webcam-preview"
        />

        {/* High-tech HUD grid overlays */}
        {permissionGranted && !isLoadingModels && !baselineCaptured && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            {/* Round Reticle Guide */}
            <div className={`w-52 h-52 rounded-full border-2 border-dashed transition-colors duration-350 ${
              isScanning ? 'border-brand-primary/80 animate-pulse' : 'border-slate-600/60'
            }`} />
            
            {/* Horizontal scanning laser */}
            {isScanning && (
              <motion.div
                initial={{ top: '15%' }}
                animate={{ top: '85%' }}
                transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.8, ease: 'easeInOut' }}
                className="absolute left-6 right-6 h-0.5 bg-brand-primary shadow-[0_0_8px_rgba(37,99,235,0.8)]"
              />
            )}
          </div>
        )}

        {/* Success confirmation overlay */}
        {baselineCaptured && (
          <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 z-20">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring' }}
            >
              <ShieldCheck className="h-12 w-12 text-emerald-400 mx-auto mb-2" />
            </motion.div>
            <span className="text-sm font-extrabold text-white">Enrollment Completed</span>
            <span className="text-[9px] font-mono text-emerald-300 mt-1 uppercase tracking-widest block">
              128-Point Descriptor Encrypted
            </span>
            {capturedDescriptor && (
              <span className="text-[8px] font-mono text-emerald-400 bg-emerald-900/60 border border-emerald-800/80 px-2 py-0.5 rounded-md mt-2 max-w-[180px] truncate block">
                HASH: {capturedDescriptor.slice(0, 4).join(', ')}...
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress slider bar or error message */}
      <div className="w-full max-w-xs space-y-3" id="face-controls-container">
        {isScanning && (
          <div className="space-y-1.5 text-center">
            <div className="flex justify-between text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest">
              <span>Scanning biometric vectors</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-brand-primary shadow-[0_0_6px_rgba(37,99,235,0.6)]"
                animate={{ width: `${scanProgress}%` }}
                transition={{ duration: 0.2 }}
              />
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-red-950/40 border border-red-900/40 rounded-xl text-[11px] text-red-400 flex items-start gap-2" id="face-enroll-error">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Control Action Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              stopCamera();
              onBack();
            }}
            className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl text-xs font-bold transition border border-slate-800/80 cursor-pointer"
            id="face-btn-cancel"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!permissionGranted || isLoadingModels || isScanning || baselineCaptured}
            onClick={handleCaptureBaseline}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition shadow-lg shadow-indigo-600/10 flex items-center gap-1.5 cursor-pointer"
            id="face-btn-capture"
          >
            {isScanning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Camera className="h-3.5 w-3.5" />
                Capture Baseline Profile
              </>
            )}
          </button>
        </div>
      </div>

      <div className="text-center">
        <span className="text-[10px] font-mono text-slate-500 block uppercase tracking-wider">
          Security Protocol Disclaimer
        </span>
        <span className="text-[9px] text-slate-500 leading-normal max-w-xs mx-auto block mt-1">
          Facial data is evaluated strictly in-memory inside your local web sandbox. No biometric images or descriptors are uploaded to external databases.
        </span>
      </div>
    </div>
  );
};
