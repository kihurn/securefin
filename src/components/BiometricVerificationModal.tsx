import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Fingerprint, ShieldAlert, CheckCircle2, Cpu, Smartphone, Loader2, Info, ArrowRight, ShieldCheck, HelpCircle } from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound, playTransitionSound } from '../utils/audio';

interface BiometricVerificationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

type AuthState = 'idle' | 'hardware-checking' | 'hardware-success' | 'hardware-failed' | 'simulating' | 'simulation-success';

export function BiometricVerificationModal({ onClose, onSuccess }: BiometricVerificationModalProps) {
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [errorDetails, setErrorDetails] = useState<string>('');
  const [hardwareSupported, setHardwareSupported] = useState<boolean | null>(null);
  const [simType, setSimType] = useState<'touch' | 'face'>('touch');
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('Initialize cryptographic scanner');

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
          id: Uint8Array.from("sterling-cio-001", c => c.charCodeAt(0)),
          name: "alexander.sterling@securefin.io",
          displayName: "Alexander Sterling",
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

  // Run simulation sequence
  const startSimulation = (type: 'touch' | 'face') => {
    playClickSound();
    setSimType(type);
    setAuthState('simulating');
    setScanProgress(0);
    setScanStatus('Aligning biometric sensor matrices...');

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 4;
      setScanProgress(currentProgress);

      if (currentProgress < 25) {
        setScanStatus('Calibrating hardware focus elements...');
      } else if (currentProgress < 50) {
        setScanStatus('Scanning unique ridge vectors & minutiae...');
      } else if (currentProgress < 75) {
        setScanStatus('Hashing encrypted signature payload...');
      } else if (currentProgress < 95) {
        setScanStatus('Validating SHA-512 handshake on FinTrust node...');
      } else if (currentProgress >= 100) {
        clearInterval(interval);
        setScanStatus('Verification completed successfully!');
        setAuthState('simulation-success');
        playSuccessSound();
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }
    }, 80);
  };

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
              <h3 className="text-white font-extrabold text-sm tracking-tight leading-none">FinTrust Sovereign Vault</h3>
              <span className="text-[9px] font-mono font-bold text-slate-500 uppercase tracking-widest mt-1 block">Biometric Gateway v1.0</span>
            </div>
          </div>
          <button
            onClick={() => {
              playClickSound();
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
                  <h4 className="text-white font-bold text-base tracking-tight">Sovereign Identity Verification</h4>
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
                    className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/15"
                    id="btn-trigger-hardware-biometrics"
                  >
                    <Cpu className="h-4 w-4" />
                    Verify via Hardware Key
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-4 text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Or Simulate Authentication</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => startSimulation('touch')}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      id="btn-sim-touch"
                    >
                      <Fingerprint className="h-3.5 w-3.5 text-cyan-400" />
                      Touch ID Scan
                    </button>
                    <button
                      onClick={() => startSimulation('face')}
                      className="py-2.5 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5"
                      id="btn-sim-face"
                    >
                      <Smartphone className="h-3.5 w-3.5 text-indigo-400" />
                      Face ID Scan
                    </button>
                  </div>
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
                    Sovereign identity signature verified successfully via platform authenticator.
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

                <div className="space-y-2 pt-2">
                  <div className="text-[10px] text-slate-500 font-medium">
                    Try the high-fidelity interactive simulation instead:
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => startSimulation('touch')}
                      className="py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/10"
                      id="btn-retry-sim-touch"
                    >
                      <Fingerprint className="h-3.5 w-3.5" />
                      Simulate Touch ID
                    </button>
                    <button
                      onClick={() => startSimulation('face')}
                      className="py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/10"
                      id="btn-retry-sim-face"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      Simulate Face ID
                    </button>
                  </div>
                  <button
                    onClick={() => setAuthState('idle')}
                    className="text-xs text-slate-400 hover:text-white transition underline block mx-auto pt-2"
                  >
                    Back to Selection
                  </button>
                </div>
              </motion.div>
            )}

            {authState === 'simulating' && (
              <motion.div
                key="simulating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-6 space-y-6"
              >
                {/* Fingerprint / Face scanner with radar scanning bar */}
                <div className="relative">
                  {/* Scanner outer ring */}
                  <div className="absolute inset-0 bg-blue-500/10 rounded-full animate-ping duration-1000"></div>
                  
                  <div className="relative p-7 bg-slate-900 border border-blue-500/30 rounded-full text-blue-400 overflow-hidden w-28 h-28 flex items-center justify-center shadow-lg shadow-blue-500/10">
                    {simType === 'touch' ? (
                      <Fingerprint className="h-16 w-16 stroke-[1.25] text-blue-400 animate-pulse" />
                    ) : (
                      <Smartphone className="h-16 w-16 stroke-[1.25] text-blue-400 animate-pulse" />
                    )}

                    {/* Scanning line moving down */}
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-bounce w-full" style={{ animationDuration: '2s' }}></div>
                  </div>
                </div>

                {/* Progress reporting */}
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
                </div>
              </motion.div>
            )}

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
                      <strong>Node Log:</strong> auth_sig_gen_success: user="Alexander Sterling" status="approved_multi_sig" signature="0x7a8c...9f2e"
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
