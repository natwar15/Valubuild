import React, { useState } from 'react';
import { X, Mail, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { friendlyAuthError, useAuth } from '../context/AuthContext';

type Mode = 'signup' | 'signin' | 'reset';

const border = { borderColor: 'var(--color-border)' };

/**
 * Create an account or sign in: Google in one click, or email + password.
 * We only ask for an email and a password; no practice details are needed to sign up.
 */
export const AuthModal: React.FC<{ onOpenPrivacy?: () => void }> = ({ onOpenPrivacy }) => {
  const { signInPrompt, closeSignIn, signInWithGoogle, signUpWithEmail, signInWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!signInPrompt.open) return null;

  const run = async (fn: () => Promise<void>, done?: string) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
      if (done) setInfo(done);
      else closeSignIn();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signup') {
      if (password.length < 8) return setError('Use a password of at least 8 characters.');
      return run(() => signUpWithEmail(email, password));
    }
    if (mode === 'signin') return run(() => signInWithEmail(email, password));
    return run(() => resetPassword(email), 'If an account exists for that email, a reset link is on its way.');
  };

  const title = mode === 'signup' ? 'Create your free account' : mode === 'signin' ? 'Sign in' : 'Reset your password';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className="w-full max-w-md bg-white rounded-[8px] border shadow-xl p-6 space-y-4 text-left" style={border}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="auth-title" className="text-xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              {title}
            </h2>
            <p className="text-xs text-[#6B6459] mt-1">
              {signInPrompt.reason || 'Save your valuations privately and track them over time.'}
            </p>
          </div>
          <button type="button" onClick={closeSignIn} aria-label="Close" className="p-1 text-[#6B6459] hover:text-[#26231E]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mode !== 'reset' && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(signInWithGoogle)}
              className="w-full py-2.5 rounded-[6px] border text-sm font-semibold text-[#26231E] hover:bg-[#FAF5EE] flex items-center justify-center gap-2"
              style={border}
            >
              <LogIn className="w-4 h-4 text-[#A6521C]" /> Continue with Google
            </button>
            <div className="flex items-center gap-3 text-[11px] text-[#6B6459]">
              <span className="flex-1 h-px bg-[#E2DBD0]" /> or with email <span className="flex-1 h-px bg-[#E2DBD0]" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-3">
          <label className="block text-xs">
            <span className="block font-semibold text-[#26231E] mb-1">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-[6px] border text-sm"
              style={border}
            />
          </label>
          {mode !== 'reset' && (
            <label className="block text-xs">
              <span className="block font-semibold text-[#26231E] mb-1">Password</span>
              <input
                type="password"
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-[6px] border text-sm"
                style={border}
              />
              {mode === 'signup' && <span className="block text-[11px] text-[#6B6459] mt-1">At least 8 characters.</span>}
            </label>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}
          {info && <p className="text-xs text-emerald-700">{info}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full !py-2.5 text-sm flex items-center justify-center gap-2">
            {mode === 'signup' ? <UserPlus className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
            {busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'signin' ? 'Sign in' : 'Send reset link'}
          </button>
        </form>

        <div className="text-xs text-[#6B6459] flex flex-wrap gap-x-3 gap-y-1">
          {mode !== 'signup' && (
            <button type="button" className="underline" onClick={() => setMode('signup')}>
              New here? Create an account
            </button>
          )}
          {mode !== 'signin' && (
            <button type="button" className="underline" onClick={() => setMode('signin')}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'signin' && (
            <button type="button" className="underline" onClick={() => setMode('reset')}>
              Forgot password?
            </button>
          )}
        </div>

        <p className="text-[11px] text-[#6B6459] flex gap-1.5 pt-2 border-t" style={border}>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
          <span>
            Your account is private. Nothing you enter is shared unless you choose to add it, anonymised, to the pooled
            benchmarks.{' '}
            {onOpenPrivacy && (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  closeSignIn();
                  onOpenPrivacy();
                }}
              >
                Privacy notice
              </button>
            )}
          </span>
        </p>
      </div>
    </div>
  );
};
