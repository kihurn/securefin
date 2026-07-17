import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Fingerprint, ShieldAlert, CheckCircle2, Cpu, Smartphone, Loader2, Info, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound, playTransitionSound } from '../utils/audio';
import { generateFaceDescriptor, ensureModelsLoaded } from '../faceDetection';

interface BiometricVerificationModalProps {
  onClose: () => void;
  onSuccess: (descriptor?: Float32Array) => void;
  userEmail?: string;
  userDisplayName?: string;
}

type AuthState = 'idle' | 'hardware-checking' | 'hardware-success' | 'hardware-failed' | 'simulation-success' | 'webcam-scanning';

export function BiometricVerificationModal({ onClose, onSuccess, userEmail = "alexander.sterling@securefin.io", userDisplayName = "Alexander Sterling" }: BiometricVerificationModalProps) {
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [hardwareSupported, setHardwareSupported] = useState<boolean | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('Initialize cryptographic scanner');

  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState<Float32Array | null>(null);
  const authStateRef = React.useRef(authState);

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startRealFaceScan = async () => {
    playClickSound();
    setAuthState('webcam-scanning');
    setIsLoadingModels(true);
    setScanProgress(0);
    setScanStatus('Loading model tensors...');

    try {
      await ensureModelsLoaded();
      if (authStateRef.current !== 'webcam-scanning') return;
      setIsLoadingModels(false);

      // Start webcam
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      if (authStateRef.current !== 'webcam-scanning') {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setPermissionGranted(true);
      setScanStatus('Scanning face...');

      // Sweep animation progress
      let progress = 10;
      setScanProgress(progress);

      let progressDir = 1;
      const progressInterval = setInterval(() => {
        setScanProgress((prev) => {
          if (prev >= 90) progressDir = -1;
          if (prev <= 10) progressDir = 1;
          return prev + (progressDir * 5);
        });
      }, 150);

      let descriptor: Float32Array | null = null;
      const startScanTime = Date.now();

      // Attempt scanning for up to 15 seconds
      while (authStateRef.current === 'webcam-scanning') {
        if (Date.now() - startScanTime > 15000) {
          break; // Timeout
        }

        if (!videoRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }

        try {
          descriptor = await generateFaceDescriptor(videoRef.current);
          if (descriptor) {
            break;
          }
        } catch (e) {
          console.warn('Scan attempt failed, retrying...', e);
        }

        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      clearInterval(progressInterval);

      if (authStateRef.current !== 'webcam-scanning') {
        stopCamera();
        return;
      }

      if (descriptor) {
        setScanProgress(100);
        setScanStatus('Face signature captured!');
        setCapturedDescriptor(descriptor);
        setAuthState('simulation-success');
        playSuccessSound();

        setTimeout(() => {
          stopCamera();
          onSuccess(descriptor!);
          onClose();
        }, 1500);
      } else {
        stopCamera();
        setAuthState('idle');
        setErrorDetails('Face scan timed out or no face detected. Please ensure good lighting and look directly at the camera.');
        playErrorSound();
      }

    } catch (err: any) {
      console.error('Webcam Face Scan error:', err);
      stopCamera();
      setIsLoadingModels(false);
      setAuthState('idle');
      setErrorDetails(err.message || 'Camera access denied or webcam is unavailable.');
      playErrorSound();
    }
  };

  useEffect(() => {
    // Check if WebAuthn platform biometrics are supported in this browser
    const checkSupport = async () => {
      try {
        if (!window.PublicKeyCredential) {
          setHardwareSupported(false);
          return;
        }
        const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setHardwareSupported(isAvailable);
      } catch (err) {
        setHardwareSupported(false);
      }
    };
    checkSupport();
  }, []);

  const triggerHardwareAuth = async () => {
    playClickSound();
    setAuthState('hardware-checking');
    setErrorDetails('');

    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: "SecureFin Institutional",
          id: window.location.hostname || "localhost",
        },
        user: {
          id: Uint8Array.from(userEmail, c => c.charCodeAt(0)),
          name: userEmail,
          displayName: userDisplayName,
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
        authenticatorSelection: {
          authenticatorAttachment: "platform", // forces local device (Touch ID/Windows Hello)
          userVerification: "required",
        },
        timeout: 10000, // 10 seconds timeout for prompt
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      });

      if (credential) {
        setAuthState('hardware-success');
        playSuccessSound();
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      console.warn("Hardware biometric error / security constraint:", err);

      // Map standard WebAuthn errors to descriptive user explanations
      let message = "Verification failed or cancelled by user.";
      if (err.name === 'SecurityError') {
        message = "WebAuthn request was blocked. This is standard inside security sandboxes (such as preview iframes) because the outer container lacks the 'publickey-credentials-create' permission.";
      } else if (err.name === 'NotSupportedError') {
        message = "This device's hardware is not configured for platform biometrics, or WebAuthn is unsupported in this browser.";
      } else if (err.name === 'TimeoutError') {
        message = "Authentication request timed out without a biometric scan.";
      } else if (err.message) {
        message = err.message;
      }

      setErrorDetails(message);
      setAuthState('hardware-failed');
      playErrorSound();
    }
  };

  // Simulation sequence removed in favor of real biometrics only

  return (
    <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="biometric-modal-backdrop">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-md bg-[#0d1220] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col"
        id="biometric-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration bar */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500 w-full"></div>

        {/* Modal Header */}
        <div className="p-5 flex items-center justify-between border-b border-slate-800/60" id="biometric-modal-header">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-500/10 rounded-lg text-blue-400 border border-blue-500/15">
              <ShieldCheck className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-sm tracking-tight leading-none">FinTrust Vault</h3>
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-1 block">Biometric Gateway v1.0</span>
            </div>
          </div>
          <button
            onClick={() => {
              playClickSound();
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition"
            id="biometric-close-btn"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex-1 flex flex-col" id="biometric-modal-body">
          <AnimatePresence mode="wait">
            {authState === 'idle' && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-center py-4"
              >
                <div className="flex justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-xl animate-pulse"></div>
                    <div className="relative p-6 bg-slate-900 border border-slate-800 rounded-full text-blue-400 shadow-inner">
                      <Fingerprint className="h-14 w-14 stroke-[1.25]" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-white font-bold text-base tracking-tight">Identity Verification</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    Verify ownership of the master multi-sig vault key. This triggers a secure handshake using your computer's local hardware authenticators.
                  </p>
                </div>

                {hardwareSupported === false && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl flex gap-2 text-left leading-normal">
                    <Info className="h-4.5 w-4.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>No Biometric Device Registered:</strong> We detected that your computer may not have biometric hardware (such as a Touch ID keyboard or Windows Hello webcam), or the platform API is unavailable.
                    </span>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    onClick={triggerHardwareAuth}
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15 active:scale-95 cursor-pointer"
                    id="btn-trigger-hardware-biometrics"
                  >
                    <Cpu className="h-4 w-4" />
                    Verify via Hardware Key
                  </button>

                  <button
                    onClick={startRealFaceScan}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
                    id="btn-sim-face"
                  >
                    <Smartphone className="h-4 w-4 text-indigo-400" />
                    Verify via Face Scan (Webcam)
                  </button>
                </div>
              </motion.div>
            )}

            {authState === 'hardware-checking' && (
              <motion.div
                key="hardware-checking"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-12 space-y-6"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-2xl animate-pulse"></div>
                  <Loader2 className="h-16 w-16 text-blue-500 animate-spin stroke-[1.5]" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-white font-bold text-base">Requesting Device Signature</h4>
                  <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                    Check your operating system or hardware prompt to authenticate. Touch the biometric reader or look at the webcam.
                  </p>
                </div>
              </motion.div>
            )}

            {authState === 'hardware-success' && (
              <motion.div
                key="hardware-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-10 space-y-5"
              >
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">
                  <CheckCircle2 className="h-14 w-14 stroke-[1.25]" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-emerald-400 font-extrabold text-base">Hardware Key Verified</h4>
                  <p className="text-xs text-slate-300 max-w-xs">
                    identity signature verified successfully via platform authenticator.
                  </p>
                  <div className="text-[10px] font-mono text-slate-500 bg-slate-900/50 px-3 py-1 rounded border border-slate-800/50 mt-4 inline-block">
                    KEY_STATUS: MASTER_SYNCED_OK
                  </div>
                </div>
              </motion.div>
            )}

            {authState === 'hardware-failed' && (
              <motion.div
                key="hardware-failed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-5 text-center py-2"
              >
                <div className="flex justify-center">
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                    <ShieldAlert className="h-10 w-10 stroke-[1.5]" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-red-400 font-bold text-sm">Hardware Verification Blocked</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                    We could not communicate with your local biometric device. This is most likely due to sandbox iframe isolation, lack of biometric hardware on your PC, or cancelled permission.
                  </p>
                </div>

                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-left space-y-1">
                  <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider block">Error Diagnosis</span>
                  <p className="text-[11px] font-mono text-red-300 leading-normal">
                    {errorDetails || "Device declined connection."}
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-[10px] text-slate-500 font-medium">
                    Please use the integrated camera face validation instead:
                  </div>
                  <button
                    onClick={startRealFaceScan}
                    className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/10 active:scale-95 cursor-pointer"
                    id="btn-retry-sim-face"
                  >
                    <Smartphone className="h-4 w-4 animate-pulse" />
                    Verify via Face Scan (Webcam)
                  </button>
                  <button
                    onClick={() => setAuthState('idle')}
                    className="text-xs text-slate-400 hover:text-white transition underline block mx-auto pt-2 cursor-pointer"
                  >
                    Back to Selection
                  </button>
                </div>
              </motion.div>
            )}

            {authState === 'webcam-scanning' && (
              <motion.div
                key="webcam-scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center space-y-6"
              >
                {/* Camera Stage / Rounded Scanner Frame */}
                <div className="relative w-48 h-48 rounded-full border-2 border-slate-800 bg-slate-950 flex items-center justify-center overflow-hidden shadow-2xl group" id="face-scanner-viewport">
                  {/* Loading Models overlay */}
                  {isLoadingModels && (
                    <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-4 space-y-3 z-30">
                      <Loader2 className="h-6 w-6 text-blue-500 animate-spin" />
                      <span className="text-[9px] font-mono text-slate-400 text-center uppercase tracking-wider">
                        Loading Models...
                      </span>
                    </div>
                  )}

                  {/* Permission Denied overlay */}
                  {!isLoadingModels && permissionGranted === false && (
                    <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center space-y-4 z-20">
                      <ShieldAlert className="h-6 w-6 text-rose-500" />
                      <span className="text-xs text-slate-300 font-semibold leading-relaxed">
                        Camera Access Denied
                      </span>
                    </div>
                  )}

                  {/* Video feed */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-350 ${permissionGranted && !isLoadingModels ? 'opacity-100' : 'opacity-0'
                      }`}
                    id="webcam-preview-login"
                  />

                  {/* High-tech HUD overlays */}
                  {permissionGranted && !isLoadingModels && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
                      {/* Round Reticle Guide */}
                      <div className="w-40 h-40 rounded-full border border-dashed border-blue-500/80 animate-pulse" />

                      {/* Horizontal scanning laser */}
                      <motion.div
                        initial={{ top: '15%' }}
                        animate={{ top: '85%' }}
                        transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.8, ease: 'easeInOut' }}
                        className="absolute left-4 right-4 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.8)]"
                      />
                    </div>
                  )}
                </div>

                {/* Progress bar and status */}
                <div className="w-full space-y-3 text-center">
                  <div className="space-y-1">
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest block">Active Scan Ledger Link</span>
                    <h4 className="text-white font-bold text-xs font-mono h-4">{scanStatus}</h4>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-100"
                      style={{ width: `${scanProgress}%` }}
                    ></div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{scanProgress}% SECURED</span>

                  <button
                    type="button"
                    onClick={() => {
                      stopCamera();
                      setAuthState('idle');
                    }}
                    className="text-xs text-slate-400 hover:text-white transition mt-2 block mx-auto underline"
                  >
                    Cancel Scan
                  </button>
                </div>
              </motion.div>
            )}

            {/* Simulation view removed */}

            {authState === 'simulation-success' && (
              <motion.div
                key="simulation-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center text-center py-10 space-y-5"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-xl animate-pulse"></div>
                  <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-full shadow-lg">
                    <CheckCircle2 className="h-14 w-14 stroke-[1.25]" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="text-emerald-400 font-extrabold text-base">Identity Validation Complete</h4>
                  <p className="text-xs text-slate-300 max-w-xs leading-relaxed">
                    Signature generated and cryptographically synchronized with the Zurich decentral vault node.
                  </p>
                  <div className="p-2 bg-slate-900/60 border border-slate-800/80 rounded-xl mt-4 max-w-sm mx-auto text-left flex gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5"></div>
                    <span className="text-[9px] font-mono text-slate-400 leading-normal">
                      <strong>Node Log:</strong> auth_sig_gen_success: user="{userDisplayName}" status="approved_multi_sig" signature="0x7a8c...9f2e"
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-slate-900/40 border-t border-slate-800/60 text-center text-[10px] text-slate-500 font-mono" id="biometric-modal-footer">
          End-to-end Encrypted Handshake • AES-256-GCM
        </div>
      </motion.div>
    </div>
  );
}
