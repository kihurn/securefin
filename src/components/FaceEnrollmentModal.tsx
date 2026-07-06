import React from 'react';
import { X } from 'lucide-react';
import { FaceRegistration } from './FaceRegistration';

interface FaceEnrollmentModalProps {
  onClose: () => void;
  userEmail: string;
  onSuccess: (descriptor: Float32Array) => void;
}

export const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({
  onClose,
  userEmail,
  onSuccess,
}) => {
  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-[100] flex items-center justify-center p-4 overflow-y-auto" id="face-enrollment-modal">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative" id="face-enrollment-modal-card">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          id="face-enrollment-modal-close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content Wrapper */}
        <div className="pt-2">
          <FaceRegistration
            userEmail={userEmail}
            onCaptureComplete={(descriptor) => {
              onSuccess(descriptor);
            }}
            onBack={onClose}
          />
        </div>
      </div>
    </div>
  );
};
