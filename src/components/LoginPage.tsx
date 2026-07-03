import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SecureFinLogo } from './SecureFinLogo';
import { ShieldAlert, KeyRound, Loader2, ArrowRight, Smartphone, RefreshCw, ChevronLeft } from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/audio';
import { auth } from '../lib/firebase.ts';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

interface LoginPageProps {
  onLoginSuccess: (userProfile?: any) => void;
  onBackToHome: () => void;
  onGoToRegister?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToHome, onGoToRegister }) => {
  const [email, setEmail] = useState('a.sterling@fintrust.global');
  const [password, setPassword] = useState('••••••••');
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(115); // 1m 55s
  const [errorMessage, setErrorMessage] = useState('');

  const handleGoogleSignIn = () => {
    playClickSound();
    setIsLoading(true);
    setErrorMessage('');

    const width = 550;
    const height = 650;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    const popup = window.open(
      '/auth-popup',
      'auth_popup',
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      setErrorMessage('Please allow popups to sign in with Google.');
      setIsLoading(false);
      playErrorSound();
      return;
    }

    const handleMessage = async (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'FIREBASE_AUTH_SUCCESS') {
        window.removeEventListener('message', handleMessage);
        const { googleIdToken, googleAccessToken } = event.data;

        try {
          const credential = GoogleAuthProvider.credential(googleIdToken, googleAccessToken);
          const result = await signInWithCredential(auth, credential);
          const user = result.user;
          const idToken = await user.getIdToken();

          // Call our secure backend to sync the user profile in Postgres
          const response = await fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            }
          });

          if (!response.ok) {
            throw new Error('Failed to synchronize sovereign identity node with the ledger.');
          }

          const userProfile = await response.json();
          playSuccessSound();
          onLoginSuccess(userProfile);
        } catch (error: any) {
          console.error('Google Auth Error:', error);
          setErrorMessage(error.message || 'Identity verification aborted or failed.');
          playErrorSound();
        } finally {
          setIsLoading(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
  };

  // 2FA Code expiration timer
  useEffect(() => {
    if (step !== '2fa') return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    if (!email || !password) {
      setErrorMessage('Please enter both email and password.');
      playErrorSound();
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    // Simulate quick authentication
    setTimeout(() => {
      setIsLoading(false);
      setStep('2fa');
    }, 1000);
  };

  const handle2FASubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    if (twoFactorCode.length < 6) {
      setErrorMessage('Verification code must be exactly 6 digits.');
      playErrorSound();
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    setTimeout(() => {
      setIsLoading(false);
      playSuccessSound();
      onLoginSuccess();
    }, 1200);
  };

  const handleResendCode = () => {
    playClickSound();
    setTimer(120);
    setErrorMessage('A new 6-digit validation code has been dispatched.');
    setTimeout(() => setErrorMessage(''), 3000);
  };

  const handleBackToCredentials = () => {
    playClickSound();
    setStep('credentials');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans" id="login-page-root">
      {/* Decorative subtle background mesh */}
      <div className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-15 pointer-events-none" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAyk-W_-zXrFU1utK8Ap0NKCvaSGAmHXWpAdJh0tm4_WpBmNiXTl5iFMToSaj0BVOgFSkdyoFmRriswYF9TS3_dcDulomMF4z9cAQdKjXr3kveNPvYByMrEvM9dkQuKZ_iNuviiJnEguvgpo2F3RV7GegZJP23a5H9grV-94zXMztJKjAbW7j3tUMJvFgdxBKHQk0QyuUSlphw6AgP4AnzRCOp392M1Ktx4q7atGIInI1oYbtyuEEjkVqrcB0ZVrKscVEOiUZVh3h9D')` }}></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-primary/25 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Floating Header */}
      <button
        onClick={onBackToHome}
        className="absolute top-6 left-6 text-slate-400 hover:text-white flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition bg-slate-800/55 backdrop-blur border border-slate-700/50 px-3.5 py-2 rounded-lg"
        id="login-btn-back-home"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Home
      </button>

      <div className="w-full max-w-md z-10" id="login-container">
        {/* Main login card container */}
        <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 relative" id="login-card">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-950 border border-slate-800 px-6 py-2.5 rounded-full shadow-lg" id="login-logo-badge">
            <SecureFinLogo size="sm" showText={true} light={true} />
          </div>

          <div className="mt-6 text-center space-y-2 mb-8" id="login-greeting">
            <h2 className="text-xl font-extrabold text-white tracking-tight" id="login-heading">
              {step === 'credentials' ? 'Secure Vault Gateway' : 'Two-Factor Authentication'}
            </h2>
            <p className="text-xs text-slate-400 leading-normal">
              {step === 'credentials' 
                ? 'Authorized access only. High-fidelity cryptographic monitoring enabled.' 
                : 'Enter the security token sent to your validated mobile hardware.'
              }
            </p>
          </div>

          {/* Animate credentials vs 2FA */}
          <AnimatePresence mode="wait">
            {step === 'credentials' ? (
              <motion.form
                key="credentials-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handleCredentialsSubmit}
                className="space-y-5"
                id="credentials-form"
              >
                {/* Form Inputs */}
                <div className="space-y-1.5" id="login-email-group">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Institutional Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition placeholder-slate-600 font-mono"
                    placeholder="name@organization.com"
                    id="login-email-input"
                  />
                </div>

                <div className="space-y-1.5" id="login-password-group">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Master Password
                    </label>
                    <span className="text-[10px] text-brand-primary-container hover:underline cursor-pointer font-semibold">
                      Forgot?
                    </span>
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary focus:border-transparent transition placeholder-slate-600 font-mono"
                    placeholder="Master password"
                    id="login-password-input"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-center gap-2" id="login-error-msg">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-brand-primary hover:bg-brand-primary-container text-white text-sm font-bold shadow-lg shadow-brand-primary/10 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  id="login-btn-continue"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                      Authenticating Credentials...
                    </>
                  ) : (
                    <>
                      Decrypt & Continue
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="relative flex py-2 items-center" id="login-or-divider">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">OR</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGoogleSignIn}
                  className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-white text-xs font-bold font-mono transition flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  id="login-btn-google"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Authorize Google Identity
                </button>

                {onGoToRegister && (
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onGoToRegister();
                      }}
                      className="text-xs text-brand-secondary hover:text-brand-primary transition font-semibold"
                      id="login-btn-go-to-register"
                    >
                      New to SecureFin? Create an Account
                    </button>
                  </div>
                )}
              </motion.form>
            ) : (
              <motion.form
                key="2fa-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onSubmit={handle2FASubmit}
                className="space-y-6"
                id="2fa-form"
              >
                {/* 2FA input */}
                <div className="space-y-3 text-center" id="2fa-input-group">
                  <div className="flex justify-center mb-1">
                    <div className="h-12 w-12 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20 animate-pulse">
                      <Smartphone className="h-6 w-6 text-brand-primary" />
                    </div>
                  </div>
                  
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block">
                    verification code dispatched to +41 ••• •• 94
                  </span>

                  {/* 6-Digit input styled beautifully */}
                  <div className="max-w-xs mx-auto relative">
                    <input
                      type="text"
                      maxLength={6}
                      pattern="\d{6}"
                      required
                      placeholder="948201"
                      value={twoFactorCode}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setTwoFactorCode(val);
                      }}
                      className="w-full tracking-[1.2em] text-center bg-slate-900 border border-slate-800 text-white rounded-xl py-3.5 text-xl font-bold font-mono focus:outline-none focus:ring-2 focus:ring-brand-primary placeholder:text-slate-700 placeholder:opacity-70"
                      id="login-2fa-input"
                    />
                  </div>
                  
                  <span className="text-xs text-slate-500 block">
                    Verify using code <span className="font-mono text-white font-bold">948201</span>
                  </span>
                </div>

                {errorMessage && (
                  <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${errorMessage.includes('dispatched') ? 'bg-slate-900/90 border border-slate-800 text-emerald-400' : 'bg-red-950/40 border border-red-900/50 text-red-400'}`} id="login-2fa-feedback">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Resend and timer info */}
                <div className="flex justify-between items-center text-xs font-mono" id="2fa-resend-group">
                  <span className="text-slate-500">
                    Expires in: <span className="text-brand-primary font-bold">{formatTimer(timer)}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    className="text-slate-400 hover:text-white flex items-center gap-1 font-semibold"
                    id="login-btn-resend"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Resend Code
                  </button>
                </div>

                {/* Submits */}
                <div className="flex gap-3 pt-2" id="login-2fa-actions">
                  <button
                    type="button"
                    onClick={handleBackToCredentials}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-800 active:scale-95"
                    id="login-btn-back-credentials"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-[2] py-3 bg-brand-primary hover:bg-brand-primary-container text-white text-xs font-bold rounded-xl transition shadow-lg shadow-brand-primary/15 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-50"
                    id="login-btn-verify-identity"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Validating Key...
                      </>
                    ) : (
                      <>
                        Verify Vault Identity
                      </>
                    )}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Audit Disclaimer */}
        <p className="mt-6 text-center text-[10px] text-slate-500 leading-normal" id="login-disclaimer">
          By logging in, you acknowledge that all queries, actions, and settlement transactions are recorded on the SecureFin immutable secure ledger.
        </p>
      </div>
    </div>
  );
};
