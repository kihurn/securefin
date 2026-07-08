import React from 'react';
import { Camera, Sliders } from 'lucide-react';
import { useFaceVerification } from '../FaceVerificationContext';
import { UserProfile } from '../types';

interface FaceVerificationSettingsRowProps {
  userProfile: UserProfile;
  playClickSound: () => void;
  setShowFaceEnrollModal: (show: boolean) => void;
}

export const FaceVerificationSettingsRow: React.FC<FaceVerificationSettingsRowProps> = ({
  userProfile,
  playClickSound,
  setShowFaceEnrollModal,
}) => {
  const { verificationMode, setVerificationMode } = useFaceVerification();
  
  const isEnrolled = !!(
    localStorage.getItem(`fintrust_face_baseline_${userProfile?.email?.toLowerCase().trim()}`) ||
    localStorage.getItem('fintrust_face_baseline_global')
  );

  return (
    <div className="flex flex-col p-4 bg-slate-50 border border-slate-100 rounded-xl gap-4 mt-2" id="face-enrollment-row-wrapper">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" id="face-enrollment-row-header">
        <div className="flex gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg h-fit shrink-0 border border-indigo-500/15">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
              Continuous Face Shield Signature
              {isEnrolled ? (
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                  ● ENROLLED
                </span>
              ) : (
                <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-2 py-0.5 rounded-full font-mono">
                  ● NOT ENROLLED
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
              {verificationMode === 'constant'
                ? "Securing active sessions with constant, real-time facial biometric sweeps (always-on sentinel mode)."
                : "Securing active sessions with standard continuous 20-second biometric verification sweeps."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            playClickSound();
            setShowFaceEnrollModal(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1.5 self-end sm:self-center shrink-0 border border-indigo-700 active:scale-95 cursor-pointer shadow-sm"
          id="btn-enroll-face-settings"
        >
          <Camera className="h-3.5 w-3.5 text-indigo-200" />
          Register / Retake Face
        </button>
      </div>

      {isEnrolled && (
        <div className="pt-3 border-t border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3" id="face-shield-frequency-selector">
          <div className="flex items-center gap-2">
            <Sliders className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide font-mono block">
                Biometric Sweep Interval Mode
              </span>
              <span className="text-[9px] text-slate-400 block">
                Adjust frequency to balance battery usage with strict real-time defenses.
              </span>
            </div>
          </div>

          <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-full sm:w-auto" id="frequency-mode-tabs">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setVerificationMode('interval');
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-[10px] font-bold tracking-tight transition cursor-pointer ${
                verificationMode === 'interval'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
              }`}
              id="frequency-btn-interval"
            >
              20s Interval Sweeps
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setVerificationMode('constant');
              }}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-[10px] font-bold tracking-tight transition cursor-pointer flex items-center justify-center gap-1 ${
                verificationMode === 'constant'
                  ? 'bg-indigo-600 text-white shadow-xs font-extrabold border border-indigo-700'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
              }`}
              id="frequency-btn-constant"
            >
              {verificationMode === 'constant' && <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse"></span>}
              Constant Verification
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
