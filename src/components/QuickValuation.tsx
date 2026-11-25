import React, { useCallback, useEffect, useState } from 'react';
import { Calculator, CheckCircle2, Eye, Lock, RefreshCw, Save, ShieldCheck, Trash2, AlertCircle, MailCheck } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatGbp } from '../utils/valuationEngine';
import { POOL_CONSENT_TEXT, POOL_CONSENT_VERSION } from '../shared/consent';
import { regionForPostcode } from '../shared/marketStats';
import type { QuickValuationResult } from '../shared/marketStats';

const border = { borderColor: 'var(--color-border)' };

const ALIAS_A = ['Harbour', 'Meadow', 'Granite', 'Willow', 'Cedar', 'Beacon', 'Orchard', 'Linden', 'Juniper', 'Heather', 'Bramble', 'Rowan'];
const ALIAS_B = ['Dental', 'Smile', 'Molar', 'Canine', 'Enamel', 'Crown', 'Bridge', 'Incisor'];
export function randomAlias(): string {
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  return `${pick(ALIAS_A)} ${pick(ALIAS_B)} ${Math.floor(10 + Math.random() * 90)}`;
}

interface Form {
  postcode: string;
  feesGbp: string;
  nhsPct: string;
  privatePct: string;
  planPct: string;
  surgeries: string;
  tenure: 'Leasehold' | 'Freehold';
  principalDaysPerWeek: string;
  ownerEbitdaGbp: string;
  reportedValueKind: '' | 'valuation' | 'offer' | 'sale';
  reportedValueGbp: string;
  reportedValueYear: string;
}

const START: Form = {
  postcode: '',
  feesGbp: '',
  nhsPct: '40',
  privatePct: '40',
  planPct: '20',
  surgeries: '3',
  tenure: 'Leasehold',
  principalDaysPerWeek: '4',
  ownerEbitdaGbp: '',
  reportedValueKind: '',
  reportedValueGbp: '',
  reportedValueYear: String(new Date().getFullYear()),
};

interface Submission {
  id: number;
  alias: string;
  region: string;
  practiceType: string;
  surgeries: number;
  feesGbp: number;
  estimateLowGbp: number;
  estimateMidGbp: number;
  estimateHighGbp: number;
  shareConsent: boolean;
  createdAt: string;
}

const Field: React.FC<{ n?: number; label: string; hint?: string; children: React.ReactNode }> = ({ n, label, hint, children }) => (
  <label className="block text-xs">
    <span className="block font-semibold text-[#26231E] mb-1">
      {n !== undefined && <span className="text-[#A6521C] font-mono mr-1">{n}.</span>}
      {label}
    </span>
    {children}
    {hint && <span className="block text-[11px] text-[#6B6459] mt-1">{hint}</span>}
  </label>
);
const inputCls = 'w-full px-3 py-2 rounded-[6px] border text-sm bg-white';

export const QuickValuation: React.FC<{ onOpenPrivacy?: () => void; onOpenDetailed?: () => void }> = ({
  onOpenPrivacy,
  onOpenDetailed,
}) => {
  const { firebaseUser, requestSignIn, resendVerification, deleteAccount } = useAuth();
  const [form, setForm] = useState<Form>(START);
  const [result, setResult] = useState<QuickValuationResult | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alias, setAlias] = useState(randomAlias);
  const [share, setShare] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [mine, setMine] = useState<Submission[]>([]);
  const [verifySent, setVerifySent] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const region = regionForPostcode(form.postcode);
  const mixTotal = (Number(form.nhsPct) || 0) + (Number(form.privatePct) || 0) + (Number(form.planPct) || 0);

  const payload = () => ({
    postcode: form.postcode,
    feesGbp: Number(form.feesGbp),
    nhsPct: Number(form.nhsPct) || 0,
    privatePct: Number(form.privatePct) || 0,
    planPct: Number(form.planPct) || 0,
    surgeries: Number(form.surgeries),
    tenure: form.tenure,
    principalDaysPerWeek: Number(form.principalDaysPerWeek),
    ownerEbitdaGbp: form.ownerEbitdaGbp ? Number(form.ownerEbitdaGbp) : undefined,
  });

  const loadMine = useCallback(async () => {
    if (!firebaseUser) return setMine([]);
    try {
      const d = await apiFetch<{ submissions: Submission[] }>('/api/submissions');
      setMine(d.submissions);
    } catch {
      setMine([]);
    }
  }, [firebaseUser]);
  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const estimate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaveMsg(null);
    try {
      const d = await apiFetch<{ result: QuickValuationResult; isSample: boolean }>('/api/market/quick-estimate', {
        method: 'POST',
        body: JSON.stringify(payload()),
      });
      setResult(d.result);
      setIsSample(d.isSample);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to estimate.');
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!firebaseUser) {
      requestSignIn('Create a free account to save this valuation under your practice nickname.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/api/submissions', {
        method: 'POST',
        body: JSON.stringify({
          ...payload(),
          alias,
          shareConsent: share,
          consentVersion: share ? POOL_CONSENT_VERSION : undefined,
          reportedValueKind: form.reportedValueKind || undefined,
          reportedValueGbp: form.reportedValueGbp ? Number(form.reportedValueGbp) : undefined,
          reportedValueYear: form.reportedValueYear ? Number(form.reportedValueYear) : undefined,
        }),
      });
      setSaveMsg(
        share
          ? `Saved as “${alias}” and added to the anonymised pool. Thank you, this improves the benchmarks for everyone.`
          : `Saved privately as “${alias}”.`
      );
      setAlias(randomAlias());
      await loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setBusy(false);
    }
  };

  const toggleShare = async (s: Submission) => {
    setError(null);
    try {
      await apiFetch(`/api/submissions/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ shareConsent: !s.shareConsent, consentVersion: POOL_CONSENT_VERSION }),
      });
      await loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update.');
    }
  };

  const remove = async (s: Submission) => {
    if (!window.confirm(`Delete “${s.alias}”? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/submissions/${s.id}`, { method: 'DELETE' });
      await loadMine();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete.');
    }
  };

  const eraseAccount = async () => {
    if (!window.confirm('Delete your account and every valuation saved to it? This cannot be undone.')) return;
    try {
      await deleteAccount();
      setMine([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete your account.');
    }
  };

  const unverified = firebaseUser && !firebaseUser.emailVerified;

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={border}>
        <div className="pb-5 border-b" style={border}>
          <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF5EE] text-[#A6521C] border border-[#E9D5C3] inline-flex items-center gap-1 mb-2">
            <Calculator className="w-3.5 h-3.5" /> 6 questions, about 2 minutes
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
            What is my practice worth?
          </h2>
          <p className="text-sm text-[#6B6459] mt-1 max-w-3xl">
            A goodwill range from comparable practices on the market. No account needed to see the result. We never ask
            for your practice's name or full postcode.
          </p>
        </div>

        <form onSubmit={estimate} className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field n={1} label="First part of your postcode" hint={region ? `Region: ${region}` : 'For example LS1 or SW19. England, Scotland and Wales.'}>
            <input required value={form.postcode} onChange={set('postcode')} maxLength={8} placeholder="LS1" className={inputCls} style={border} />
          </Field>
          <Field n={2} label="Gross fees last year (£)" hint="Total income from NHS, private and plans.">
            <input required type="number" min={50000} step={1000} value={form.feesGbp} onChange={set('feesGbp')} placeholder="650000" className={inputCls} style={border} />
          </Field>
          <Field n={3} label="Income split (%)" hint={mixTotal === 100 ? 'NHS / private / plan' : `Adds up to ${mixTotal}%. It should be 100%.`}>
            <div className="grid grid-cols-3 gap-2">
              {(['nhsPct', 'privatePct', 'planPct'] as const).map((k, i) => (
                <div key={k}>
                  <input type="number" min={0} max={100} value={form[k]} onChange={set(k)} className={inputCls} style={border} aria-label={['NHS %', 'Private %', 'Plan %'][i]} />
                  <span className="block text-[10px] text-[#6B6459] mt-0.5">{['NHS', 'Private', 'Plan'][i]}</span>
                </div>
              ))}
            </div>
          </Field>
          <Field n={4} label="Number of surgeries">
            <input required type="number" min={1} max={30} value={form.surgeries} onChange={set('surgeries')} className={inputCls} style={border} />
          </Field>
          <Field n={5} label="Premises">
            <select value={form.tenure} onChange={set('tenure')} className={inputCls} style={border}>
              <option value="Leasehold">Leasehold (rented)</option>
              <option value="Freehold">Freehold (owned)</option>
            </select>
          </Field>
          <Field n={6} label="Days a week you work clinically in the practice">
            <input required type="number" min={0} max={7} step={0.5} value={form.principalDaysPerWeek} onChange={set('principalDaysPerWeek')} className={inputCls} style={border} />
          </Field>
          <details className="md:col-span-2 p-3 rounded-[6px] bg-[#FAF8F4] border" style={border}>
            <summary className="text-xs font-semibold text-[#26231E] cursor-pointer">Optional: add profit for a cross-check</summary>
            <div className="mt-3 max-w-sm">
              <Field label="Owner-operated EBITDA (£)" hint="Profit before interest, tax, depreciation and your own drawings.">
                <input type="number" min={0} step={1000} value={form.ownerEbitdaGbp} onChange={set('ownerEbitdaGbp')} className={inputCls} style={border} />
              </Field>
            </div>
          </details>
          <div className="md:col-span-2 flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy || mixTotal !== 100} className="btn-primary !py-2.5 !px-5 text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" /> {busy ? 'Working…' : 'Show my range'}
            </button>
            {onOpenDetailed && (
              <button type="button" onClick={onOpenDetailed} className="text-xs underline text-[#6B6459]">
                Prefer the detailed 35-field valuation?
              </button>
            )}
          </div>
        </form>

        {error && (
          <div className="p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-800 flex gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        {result && (
          <div className="p-5 rounded-[6px] border bg-[#FAF5EE] space-y-4" style={{ borderColor: '#E9D5C3' }}>
            {isSample && <p className="text-xs text-amber-800">This server is using sample data, so the figures are illustrative only.</p>}
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B6459]">Estimated goodwill</span>
              <div className="text-3xl sm:text-4xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
                {formatGbp(result.goodwillLowGbp)} to {formatGbp(result.goodwillHighGbp)}
              </div>
              <p className="text-sm text-[#26231E] mt-1">
                Middle of the range <strong>{formatGbp(result.goodwillMidGbp)}</strong>, about {Math.round(result.goodwillPctFees.median ?? 0)}% of fees.
              </p>
              <p className="text-xs text-[#6B6459] mt-1">
                Compared with {result.comparablesUsed} listings
                {result.pooledComparablesUsed > 0 ? ` and ${result.pooledComparablesUsed} owner-reported valuations` : ''} ({result.basis}). Treated
                as a {result.practiceType} practice from your income split.
              </p>
              {result.ebitdaCrossCheck && (
                <p className="text-xs text-[#26231E] mt-2">
                  Profit cross-check: comparable listings ask about {result.ebitdaCrossCheck.multiple}x owner EBITDA, which gives{' '}
                  <strong>{formatGbp(result.ebitdaCrossCheck.valueGbp)}</strong>.
                </p>
              )}
            </div>
            <ul className="text-xs text-[#6B6459] list-disc pl-5 space-y-1">
              {result.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>

            {/* Save under an alias + optional pooling */}
            <div className="pt-4 border-t space-y-3" style={{ borderColor: '#E9D5C3' }}>
              <h3 className="text-sm font-bold text-[#26231E]">Save it under a nickname</h3>
              <div className="flex flex-wrap items-end gap-2">
                <Field label="Practice nickname" hint="Shown only to you. Don't use your real practice name.">
                  <input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} className={inputCls} style={border} />
                </Field>
                <button type="button" onClick={() => setAlias(randomAlias())} className="mb-6 p-2 rounded-[6px] border bg-white text-[#6B6459]" style={border} aria-label="New nickname" title="New nickname">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <details className="p-3 rounded-[6px] bg-white border" style={border}>
                <summary className="text-xs font-semibold text-[#26231E] cursor-pointer">
                  Optional: had a professional valuation, an offer or a sale?
                </summary>
                <p className="text-[11px] text-[#6B6459] mt-2">
                  Real figures are the most useful thing you can share. They are only used in groups of 5 or more.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <select value={form.reportedValueKind} onChange={set('reportedValueKind')} className={inputCls} style={border} aria-label="Type of figure">
                    <option value="">None</option>
                    <option value="valuation">Professional valuation</option>
                    <option value="offer">Offer received</option>
                    <option value="sale">Agreed sale price</option>
                  </select>
                  <input type="number" min={0} step={1000} placeholder="Goodwill £" value={form.reportedValueGbp} onChange={set('reportedValueGbp')} className={inputCls} style={border} aria-label="Goodwill amount" />
                  <input type="number" min={2015} max={new Date().getFullYear()} placeholder="Year" value={form.reportedValueYear} onChange={set('reportedValueYear')} className={inputCls} style={border} aria-label="Year" />
                </div>
              </details>

              <label className="flex items-start gap-2 text-xs text-[#26231E] cursor-pointer">
                <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 accent-[#A6521C]" />
                <span>
                  {POOL_CONSENT_TEXT}{' '}
                  {onOpenPrivacy && (
                    <button type="button" onClick={onOpenPrivacy} className="underline text-[#A6521C]">
                      How we use it
                    </button>
                  )}
                </span>
              </label>

              {share && unverified && (
                <p className="text-[11px] text-amber-800 flex items-center gap-1.5">
                  <MailCheck className="w-3.5 h-3.5" /> Please verify your email first (check your inbox).
                  <button
                    type="button"
                    className="underline"
                    onClick={() => resendVerification().then(() => setVerifySent(true))}
                  >
                    {verifySent ? 'Sent' : 'Resend link'}
                  </button>
                </p>
              )}

              <button type="button" onClick={save} disabled={busy} className="btn-primary !py-2.5 !px-5 text-sm flex items-center gap-2">
                <Save className="w-4 h-4" /> {firebaseUser ? 'Save valuation' : 'Create free account to save'}
              </button>
              {saveMsg && (
                <p className="text-xs text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> {saveMsg}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {firebaseUser && (
        <div className="bg-white border rounded-[6px] p-6 space-y-3" style={border}>
          <h3 className="text-sm font-bold text-[#26231E]">My saved valuations</h3>
          {mine.length === 0 ? (
            <p className="text-xs text-[#6B6459]">Nothing saved yet.</p>
          ) : (
            <div className="space-y-2">
              {mine.map((s) => (
                <div key={s.id} className="p-3 rounded-[6px] border bg-[#FAF8F4] flex flex-col md:flex-row md:items-center justify-between gap-3" style={border}>
                  <div className="text-xs">
                    <span className="font-bold text-[#26231E] text-sm">{s.alias}</span>
                    <span className="text-[#6B6459]">
                      {' '}
                      · {s.practiceType} · {s.region} · {s.surgeries} surgeries · fees {formatGbp(s.feesGbp)} · {new Date(s.createdAt).toLocaleDateString('en-GB')}
                    </span>
                    <div className="text-[#26231E] mt-0.5">
                      Goodwill {formatGbp(s.estimateLowGbp)} to {formatGbp(s.estimateHighGbp)} (mid {formatGbp(s.estimateMidGbp)})
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleShare(s)}
                      className={`px-3 py-1.5 rounded-[6px] text-xs font-bold border flex items-center gap-1.5 ${
                        s.shareConsent ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-white text-[#26231E]'
                      }`}
                      style={s.shareConsent ? undefined : border}
                      title={s.shareConsent ? 'Click to stop sharing' : POOL_CONSENT_TEXT}
                    >
                      {s.shareConsent ? <Eye className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      {s.shareConsent ? 'In the pool (stop)' : 'Private (add to pool)'}
                    </button>
                    <button type="button" onClick={() => remove(s)} className="p-1.5 rounded-[6px] border bg-white text-red-700" style={border} aria-label={`Delete ${s.alias}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="pt-3 border-t flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#6B6459]" style={border}>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> You can stop sharing or delete anything at any time.
            </span>
            <button type="button" onClick={eraseAccount} className="underline text-red-700">
              Delete my account and all my data
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
