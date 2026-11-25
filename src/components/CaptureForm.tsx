import React, { useState } from 'react';
import { submitLead } from '../firebase';
import { CheckCircle2, Loader2 } from 'lucide-react';

interface CaptureFormProps {
  source: string;
  tierName?: string;
  inline?: boolean;
  className?: string;
  onSuccess?: () => void;
}

export const CaptureForm: React.FC<CaptureFormProps> = ({
  source,
  tierName,
  inline = false,
  className = '',
  onSuccess,
}) => {
  const [email, setEmail] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Honeypot check: silently drop bots
    if (honeypot.trim() !== '') {
      setStatus('success');
      if (onSuccess) onSuccess();
      return;
    }

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setErrorMessage('');
    setStatus('loading');

    try {
      await submitLead({
        email: trimmed,
        source: tierName ? `${source} (${tierName})` : source,
        tier: tierName,
      });

      setStatus('success');
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMessage('Unable to register right now. Please try again.');
    }
  };

  if (status === 'success') {
    return (
      <div
        className="p-5 rounded-[6px] border text-left animate-fadeIn"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: 'var(--color-border)',
          maxWidth: '560px',
        }}
      >
        <div className="flex items-start gap-3">
          <CheckCircle2
            className="w-6 h-6 flex-shrink-0 mt-0.5"
            style={{ color: 'var(--color-accent)' }}
          />
          <div>
            <h4
              className="text-base font-bold mb-1.5"
              style={{
                fontFamily: 'var(--font-heading)',
                color: 'var(--color-text-primary)',
              }}
            >
              Founding-Owner Spot Confirmed
            </h4>
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-text-primary)' }}
            >
              You're on the founding-owner list. Within 48 hours we'll email you the 12-point buyer-readiness checklist so you can score your own shop against what PE deal teams audit — and you'll be first in line for your free valuation report when the dashboard opens.
            </p>
            {tierName && (
              <div
                className="mt-2 text-xs font-semibold px-2 py-1 inline-block rounded"
                style={{
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-accent)',
                  border: '1px solid var(--color-border)',
                }}
              >
                Selected plan reserved: {tierName}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      {/* Honeypot field (hidden from real users) */}
      <div className="hidden" aria-hidden="true" style={{ display: 'none' }}>
        <label htmlFor={`hp-${source}`}>Leave blank</label>
        <input
          id={`hp-${source}`}
          type="text"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div
        className={`flex ${
          inline ? 'flex-col sm:flex-row' : 'flex-col sm:flex-row'
        } gap-2.5 items-stretch`}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errorMessage) setErrorMessage('');
          }}
          placeholder="you@yourcompany.com"
          className="flex-1 px-4 py-3.5 text-base rounded-[6px] border outline-none transition-colors"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: errorMessage ? '#DC2626' : 'var(--color-border)',
            color: 'var(--color-text-primary)',
          }}
        />

        <button
          type="submit"
          disabled={status === 'loading'}
          className="btn-primary whitespace-nowrap disabled:opacity-75"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Securing spot...
            </>
          ) : (
            'Get my free valuation report'
          )}
        </button>
      </div>

      {errorMessage && (
        <p className="text-xs text-red-600 mt-2">{errorMessage}</p>
      )}

      <p
        className="text-xs mt-2.5"
        style={{ color: 'var(--color-text-muted)' }}
      >
        No spam, no sharing your email with buyers or brokers. Unsubscribe anytime.
      </p>
    </form>
  );
};
