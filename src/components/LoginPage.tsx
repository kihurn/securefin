import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SecureFinLogo } from './SecureFinLogo';
import { ShieldAlert, KeyRound, Loader2, ArrowRight, Smartphone, RefreshCw, ChevronLeft } from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/audio';

interface LoginPageProps {
  onLoginSuccess: () => void;
  onBackToHome: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBackToHome }) => {
  const [email, setEmail] = useState('a.sterling@fintrust.global');
  const [password, setPassword] = useState('••••••••');
  const [step, setStep] = useState<'credentials' | '2fa'>('credentials');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(115); // 1m 55s
  const [errorMessage, setErrorMessage] = useState('');

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
