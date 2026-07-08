import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SecureFinLogo } from './SecureFinLogo';
import { ShieldCheck, KeyRound, Loader2, ArrowRight, ChevronLeft, ShieldAlert, Check, User, Mail, Briefcase, Building2 } from 'lucide-react';
import { playClickSound, playSuccessSound, playErrorSound } from '../utils/audio';
import { UserProfile } from '../types';
import { auth } from '../lib/firebase.ts';
import { signInWithCredential, GoogleAuthProvider, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { FaceRegistration } from './FaceRegistration';

interface RegisterPageProps {
  onRegisterSuccess: (profile: Partial<UserProfile>, token?: string) => void;
  onBackToHome: () => void;
  onGoToLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onRegisterSuccess,
  onBackToHome,
  onGoToLogin,
}) => {
  const [step, setStep] = useState<1 | 2 | 'google-setup' | 'biometrics'>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Step 1: Institutional Profile
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [organization, setOrganization] = useState('');

  // Step 2: Master Security Credentials
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Google specific state
  const [googleUser, setGoogleUser] = useState<{
    name: string;
    email: string;
    idToken: string;
    accessToken: string;
    photoURL?: string;
  } | null>(null);

  const handleGoogleRegister = async () => {
    playClickSound();
    setIsLoading(true);
    setErrorMessage('');
    localStorage.setItem('fintrust_registering_google', 'true');

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const idToken = await user.getIdToken();
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const googleAccessToken = credential?.accessToken || '';

      setGoogleUser({
        name: user.displayName || user.email?.split('@')[0] || '',
        email: user.email || '',
        idToken: idToken,
        accessToken: googleAccessToken || '',
        photoURL: user.photoURL || '',
      });

      // Pre-populate fields for Google verification sync step
      setJobTitle('Corporate Node Administrator');
      setOrganization('FinTrust Global Node');
      setTwoFactorEnabled(true);
      setTermsAccepted(false);
      setStep('google-setup');
    } catch (error: any) {
      console.error('Google registration error:', error);
      setErrorMessage(error.message || 'Google identity registration aborted or failed.');
      localStorage.removeItem('fintrust_registering_google');
      playErrorSound();
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength helper
  const getPasswordStrength = () => {
    if (!password) return { label: 'Empty', score: 0, color: 'bg-slate-800' };
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score === 1) return { label: 'Weak Cryptography', score, color: 'bg-rose-500' };
    if (score === 2) return { label: 'Moderate Security', score, color: 'bg-amber-500' };
    if (score === 3) return { label: 'Strong Shielding', score, color: 'bg-indigo-500' };
    return { label: 'Military-Grade Cryptography', score, color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength();

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    if (!name || !email || !jobTitle || !organization) {
      setErrorMessage('Please populate all corporate profile fields.');
      playErrorSound();
      return;
    }

    if (!email.includes('@')) {
      setErrorMessage('Please use a valid institutional email address.');
      playErrorSound();
      return;
    }

    setErrorMessage('');
    setStep(2);
  };

  const handleBackStep = () => {
    playClickSound();
    setStep(1);
    setErrorMessage('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    if (!password || !confirmPassword) {
      setErrorMessage('Please supply your Master Password.');
      playErrorSound();
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Cryptographic confirmation failed. Passwords do not match.');
      playErrorSound();
      return;
    }

    if (password.length < 8) {
      setErrorMessage('Security constraint: Password must be at least 8 characters long.');
      playErrorSound();
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Please review and accept the cryptographic immutable audit disclaimer.');
      playErrorSound();
      return;
    }

    setErrorMessage('');
    setStep('biometrics');
  };

  const handleGoogleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playClickSound();

    if (!jobTitle || !organization) {
      setErrorMessage('Please fill out Corporate Job Title and Organization Name.');
      playErrorSound();
      return;
    }

    if (!termsAccepted) {
      setErrorMessage('Please review and accept the cryptographic immutable audit disclaimer.');
      playErrorSound();
      return;
    }

    setErrorMessage('');
    setStep('biometrics');
  };

  const handleFinalRegistration = async (descriptor?: Float32Array) => {
    setIsLoading(true);
    setErrorMessage('');

    const faceDescriptorStr = descriptor ? JSON.stringify(Array.from(descriptor)) : null;

    try {
      if (googleUser) {
        // Handle Google sign up sync
        const response = await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${googleUser.idToken}`
          },
          body: JSON.stringify({
            name: googleUser.name,
            jobTitle: jobTitle || 'Corporate Node Administrator',
            organization: organization || 'FinTrust Global Node',
            twoFactorEnabled: twoFactorEnabled,
            avatarUrl: googleUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(googleUser.name)}`,
            faceDescriptor: faceDescriptorStr,
          })
        });

        if (!response.ok) {
          throw new Error('Failed to synchronize sovereign identity node with the database ledger.');
        }

        const profile = await response.json();
        setIsLoading(false);
        playSuccessSound();
        onRegisterSuccess(profile, googleUser.idToken);
      } else {
        // Handle custom email/password registration
        const response = await fetch('/api/auth/register-custom', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: email,
            password: password,
            name: name,
            jobTitle: jobTitle,
            organization: organization,
            twoFactorEnabled: twoFactorEnabled,
            faceDescriptor: faceDescriptorStr,
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to synchronize sovereign identity node with the database ledger.');
        }

        const { profile, token } = await response.json();
        setIsLoading(false);
        playSuccessSound();
        onRegisterSuccess(profile, token);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setIsLoading(false);
      setErrorMessage(error.message || 'Identity registration failed.');
      playErrorSound();
      if (googleUser) {
        setStep(1); // Back to initial step if google sync fails
      } else {
        setStep(2); // Fall back to step 2 on registration error
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden font-sans" id="register-page-root">
      {/* Decorative background mesh */}
      <div className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-15 pointer-events-none" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAyk-W_-zXrFU1utK8Ap0NKCvaSGAmHXWpAdJh0tm4_WpBmNiXTl5iFMToSaj0BVOgFSkdyoFmRriswYF9TS3_dcDulomMF4z9cAQdKjXr3kveNPvYByMrEvM9dkQuKZ_iNuviiJnEguvgpo2F3RV7GegZJP23a5H9grV-94zXMztJKjAbW7j3tUMJvFgdxBKHQk0QyuUSlphw6AgP4AnzRCOp392M1Ktx4q7atGIInI1oYbtyuEEjkVqrcB0ZVrKscVEOiUZVh3h9D')` }}></div>
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-primary/25 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* Floating Header Actions */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20">
        <button
          onClick={onBackToHome}
          className="text-slate-400 hover:text-white flex items-center gap-2 text-xs font-semibold uppercase tracking-wider transition bg-slate-800/55 backdrop-blur border border-slate-700/50 px-3.5 py-2 rounded-lg"
          id="register-btn-back-home"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Home
        </button>
        <button
          onClick={onGoToLogin}
          className="text-slate-300 hover:text-white text-xs font-bold tracking-tight transition bg-slate-800/40 border border-slate-700/30 hover:bg-slate-800/80 px-4 py-2 rounded-xl"
          id="register-btn-goto-login"
        >
          Have an account? Access Vault
        </button>
      </div>

      <div className="w-full max-w-lg z-10 mt-12" id="register-container">
        <div className="bg-slate-950/80 backdrop-blur-xl border border-slate-800 rounded-2xl shadow-2xl p-8 relative" id="register-card">
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-950 border border-slate-800 px-6 py-2.5 rounded-full shadow-lg" id="register-logo-badge">
            <SecureFinLogo size="sm" showText={true} light={true} />
          </div>

          <div className="mt-6 text-center space-y-2 mb-8" id="register-greeting">
            <h2 className="text-xl font-extrabold text-white tracking-tight" id="register-heading">
              Create Secured Registry Profile
            </h2>
            <p className="text-xs text-slate-400 leading-normal max-w-sm mx-auto">
              Initialize a sovereign institutional node and deploy master access key signatures to secure trust reserves.
            </p>
          </div>

          {/* Stepper indicator */}
          <div className="flex items-center justify-center gap-2 mb-8" id="register-stepper">
            <div className={`h-1.5 rounded-full transition-all duration-350 ${step === 1 || step === 2 || step === 'google-setup' || step === 'biometrics' ? 'w-10 bg-brand-primary' : 'w-4 bg-slate-800'}`}></div>
            <div className={`h-1.5 rounded-full transition-all duration-350 ${step === 2 || step === 'google-setup' || step === 'biometrics' ? 'w-10 bg-brand-primary' : 'w-4 bg-slate-800'}`}></div>
            <div className={`h-1.5 rounded-full transition-all duration-350 ${step === 'biometrics' ? 'w-10 bg-brand-primary' : 'w-4 bg-slate-800'}`}></div>
            <span className="text-[10px] font-mono text-slate-500 font-bold ml-2 uppercase">
              {step === 'google-setup' ? 'Step 2: Google Identity Details' : step === 'biometrics' ? 'Step 3: Biometrics Setup' : `Step ${step === 1 ? '1' : '2'} of 3`}
            </span>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form
                key="step-1-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                onSubmit={handleNextStep}
                className="space-y-5"
                id="register-form-step-1"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-500" /> Full Legal Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-medium"
                      placeholder="e.g. Alexander Sterling"
                      id="register-input-name"
                    />
                  </div>

                  {/* Corporate email */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Mail className="h-3 w-3 text-slate-500" /> Institutional Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-mono"
                      placeholder="name@organization.com"
                      id="register-input-email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Job title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-slate-500" /> Corporate Job Title
                    </label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-medium"
                      placeholder="e.g. Chief Executive Officer"
                      id="register-input-jobtitle"
                    />
                  </div>

                  {/* Organization */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-500" /> Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-medium"
                      placeholder="e.g. FinTrust Global Inc."
                      id="register-input-org"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-center gap-2" id="register-error-msg-1">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 rounded-xl bg-brand-primary hover:bg-brand-primary-container text-white text-sm font-bold shadow-lg shadow-brand-primary/10 transition flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  id="register-btn-next"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Securing Profile Node...
                    </>
                  ) : (
                    <>
                      Configure Cryptographic Key
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="relative flex py-2 items-center" id="register-or-divider">
                  <div className="flex-grow border-t border-slate-800"></div>
                  <span className="flex-shrink mx-4 text-[10px] text-slate-500 font-mono font-bold uppercase tracking-wider">OR</span>
                  <div className="flex-grow border-t border-slate-800"></div>
                </div>

                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGoogleRegister}
                  className="w-full py-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-white text-xs font-bold font-mono transition flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                  id="register-btn-google"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Register with Google Identity
                </button>
              </motion.form>
            ) : step === 'biometrics' ? (
              <motion.div
                key="step-biometrics"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-5 w-full relative"
                id="register-step-biometrics"
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl z-50 space-y-3">
                    <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                    <span className="text-xs font-mono text-slate-300 font-bold uppercase tracking-wider text-center">
                      Deploying Sovereign Node...
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest text-center">
                      Synchronizing ledger authority
                    </span>
                  </div>
                )}
                <FaceRegistration
                  userEmail={email || googleUser?.email || ''}
                  onCaptureComplete={(descriptor) => {
                    handleFinalRegistration(descriptor);
                  }}
                  onBack={() => {
                    if (googleUser) {
                      setStep('google-setup');
                    } else {
                      setStep(2);
                    }
                  }}
                />
              </motion.div>
            ) : step === 'google-setup' ? (
              <motion.form
                key="google-setup-form"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onSubmit={handleGoogleSetupSubmit}
                className="space-y-5"
                id="register-form-google-setup"
              >
                {/* Google user details confirmation banner */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-3" id="google-profile-banner">
                  {googleUser?.photoURL ? (
                    <img src={googleUser.photoURL} alt="Google Avatar" className="w-10 h-10 rounded-full border border-brand-primary" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-mono text-sm border border-slate-700">
                      {googleUser?.name?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                  <div className="truncate flex-1">
                    <h4 className="text-xs font-bold text-white font-mono truncate">{googleUser?.name}</h4>
                    <p className="text-[10px] text-slate-400 font-mono truncate">{googleUser?.email}</p>
                  </div>
                </div>

                {/* Profile Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Job title */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Briefcase className="h-3 w-3 text-slate-500" /> Corporate Job Title
                    </label>
                    <input
                      type="text"
                      required
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-medium"
                      placeholder="e.g. Chief Executive Officer"
                      id="google-input-jobtitle"
                    />
                  </div>

                  {/* Organization */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                      <Building2 className="h-3 w-3 text-slate-500" /> Organization Name
                    </label>
                    <input
                      type="text"
                      required
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-medium"
                      placeholder="e.g. FinTrust Global Inc."
                      id="google-input-org"
                    />
                  </div>
                </div>

                {/* Toggle Multi-Signature & 2FA */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3" id="google-settings-box">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Require Multi-Signature 2FA</h4>
                      <p className="text-[10px] text-slate-400 leading-snug">Require smart validation code dispatch on all transfer settlement actions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setTwoFactorEnabled(!twoFactorEnabled);
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${twoFactorEnabled ? 'bg-brand-primary' : 'bg-slate-700'}`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${twoFactorEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>

                {/* Terms Acceptance */}
                <div className="flex gap-2.5 items-start bg-slate-900/25 p-3 border border-slate-850 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setTermsAccepted(!termsAccepted);
                    }}
                    className={`h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition ${
                      termsAccepted ? 'bg-brand-primary border-transparent text-white' : 'border-slate-700 bg-slate-900'
                    }`}
                    id="google-terms-checkbox"
                  >
                    {termsAccepted && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>
                  <span className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    I acknowledge and agree that all transactions and core telemetry logged on SecureFin are recorded to an immutable cryptographic auditing ledger.
                  </span>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-center gap-2" id="google-error-msg">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Navigation actions */}
                <div className="flex gap-3 pt-2" id="google-navigation-group">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setGoogleUser(null);
                      setStep(1);
                      setErrorMessage('');
                    }}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-800 active:scale-95"
                    id="google-btn-back"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-brand-primary hover:bg-brand-primary-container text-white text-xs font-bold rounded-xl transition shadow-lg shadow-brand-primary/15 flex items-center justify-center gap-1.5 active:scale-95"
                    id="google-btn-submit"
                  >
                    Configure Biometrics Setup
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form
                key="step-2-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                onSubmit={handleSubmit}
                className="space-y-5"
                id="register-form-step-2"
              >
                {/* Password field */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-1">
                    <KeyRound className="h-3 w-3 text-slate-500" /> Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-mono"
                    placeholder="Create a strong master key"
                    id="register-input-password"
                  />

                  {/* Password strength visualizer */}
                  {password && (
                    <div className="pt-1.5 space-y-1" id="register-password-strength-panel">
                      <div className="flex justify-between items-center text-[10px] font-bold font-mono">
                        <span className="text-slate-500">Security Score:</span>
                        <span className={strength.score >= 3 ? 'text-emerald-400' : strength.score === 2 ? 'text-amber-400' : 'text-rose-400'}>
                          {strength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-850 rounded-full flex gap-1 overflow-hidden">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-full flex-1 transition-colors duration-350 ${
                              i <= strength.score ? strength.color : 'bg-slate-800'
                            }`}
                          ></div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                    Verify Master Password
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary transition placeholder-slate-600 font-mono"
                    placeholder="Verify master key alignment"
                    id="register-input-confirmpassword"
                  />
                </div>

                {/* Toggle Multi-Signature & 2FA */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 space-y-3" id="register-settings-box">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white">Require Multi-Signature 2FA</h4>
                      <p className="text-[10px] text-slate-400 leading-snug">Require smart validation code dispatch on all transfer settlement actions.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setTwoFactorEnabled(!twoFactorEnabled);
                      }}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${twoFactorEnabled ? 'bg-brand-primary' : 'bg-slate-700'}`}
                    >
                      <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${twoFactorEnabled ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </button>
                  </div>
                </div>

                {/* Terms Acceptance */}
                <div className="flex gap-2.5 items-start bg-slate-900/25 p-3 border border-slate-850 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setTermsAccepted(!termsAccepted);
                    }}
                    className={`h-4.5 w-4.5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition ${
                      termsAccepted ? 'bg-brand-primary border-transparent text-white' : 'border-slate-700 bg-slate-900'
                    }`}
                    id="register-terms-checkbox"
                  >
                    {termsAccepted && <Check className="h-3 w-3 stroke-[3]" />}
                  </button>
                  <span className="text-[10px] text-slate-400 leading-relaxed font-semibold">
                    I acknowledge and agree that all transactions and core telemetry logged on SecureFin are recorded to an immutable cryptographic auditing ledger.
                  </span>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-center gap-2" id="register-error-msg-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Navigation actions */}
                <div className="flex gap-3 pt-2" id="register-navigation-group">
                  <button
                    type="button"
                    onClick={handleBackStep}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition border border-slate-800 active:scale-95"
                    id="register-btn-back"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-[2] py-3 bg-brand-primary hover:bg-brand-primary-container text-white text-xs font-bold rounded-xl transition shadow-lg shadow-brand-primary/15 flex items-center justify-center gap-1.5 active:scale-95"
                    id="register-btn-submit"
                  >
                    Configure Biometrics Setup
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>

        {/* Footnote */}
        <p className="mt-6 text-center text-[10px] text-slate-500 leading-normal" id="register-disclaimer">
          SecureFin operates under Swiss Financial Secrecy Guidelines (FISA). Institutional keys remain sovereign.
        </p>
      </div>
    </div>
  );
};
