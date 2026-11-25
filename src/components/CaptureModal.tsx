import React from 'react';
import { X } from 'lucide-react';
import { CaptureForm } from './CaptureForm';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  tierName?: string;
  source?: string;
}

export const CaptureModal: React.FC<CaptureModalProps> = ({
  isOpen,
  onClose,
  tierName,
  source = 'Modal',
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(38, 35, 30, 0.65)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative w-full max-w-lg rounded-[6px] p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 36px rgba(38, 35, 30, 0.20)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-[4px] transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-4">
          <span
            className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-[4px]"
            style={{
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-accent)',
              border: '1px solid var(--color-border)',
            }}
          >
            Founding-Owner Early Access
          </span>
          <h3
            className="text-2xl font-bold mt-2.5 mb-1.5"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text-primary)',
            }}
          >
            {tierName ? `Reserve ${tierName}` : 'Get Your Free Valuation Report'}
          </h3>
          <p
            className="text-sm leading-relaxed"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {tierName
              ? `You'll get our 12-point buyer-readiness checklist right away, and priority onboarding for the ${tierName} tier as soon as we open.`
              : 'Sign up now and you’ll get our 12-point buyer-readiness checklist right away, plus your full valuation report free when we open, before anyone pays a dollar.'}
          </p>
        </div>

        <CaptureForm
          source={source}
          tierName={tierName}
          onSuccess={() => {
            // Keep open so they read the success state
          }}
        />
      </div>
    </div>
  );
};
