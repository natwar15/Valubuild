import React, { useEffect, useState, useCallback } from 'react';
import {
  Newspaper,
  Mail,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Send,
  LogIn,
  Bell,
  Eye,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';

interface MonthlyBriefingItem {
  id: number;
  monthKey: string;
  headline: string;
  summary: string;
  policyChangesJson: Array<{
    title: string;
    category: string;
    impactOnMultiples: string;
    affectedPracticeTypes: string[];
  }>;
  multipleAdjustmentsJson: Record<string, number>;
  sourcesJson: Array<{ title: string; uri: string }>;
  createdAt: string;
}

interface EmailDigestItem {
  id: number;
  recipientEmail: string;
  monthKey: string;
  subject: string;
  htmlBody: string;
  deliveryStatus: string;
  sentAt: string;
}

interface MonthlyUpdatesAndEmailProps {
  onValuationUpdated?: () => void;
}

export const MonthlyUpdatesAndEmail: React.FC<MonthlyUpdatesAndEmailProps> = ({
  onValuationUpdated,
}) => {
  const { firebaseUser, profile, signInWithGoogle, updatePreferences } = useAuth();
  const [briefings, setBriefings] = useState<MonthlyBriefingItem[]>([]);
  const [digests, setDigests] = useState<EmailDigestItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [updatingPref, setUpdatingPref] = useState(false);
  const [previewDigest, setPreviewDigest] = useState<EmailDigestItem | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const bRes = await apiFetch<{ briefings: MonthlyBriefingItem[] }>('/api/market-briefings');
      setBriefings(bRes.briefings || []);

      if (firebaseUser) {
        const dRes = await apiFetch<{ digests: EmailDigestItem[] }>('/api/email/digests');
        setDigests(dRes.digests || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load monthly updates.');
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunMonthlyScan = async () => {
    setScanning(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        briefing: MonthlyBriefingItem;
        updatedReport: unknown | null;
      }>('/api/ai/monthly-market-update', {
        method: 'POST',
      });
      setFeedback(
        res.updatedReport
          ? `Live UK dental policy & market scan completed (${res.briefing.monthKey}). Your saved practice valuation and monthly history snapshot were updated.`
          : `Live UK dental policy & market scan completed (${res.briefing.monthKey}). Sign in and save a practice report to apply policy deltas automatically.`
      );
      await loadData();
      onValuationUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run monthly market scan.');
    } finally {
      setScanning(false);
    }
  };

  const handleToggleEmailOptIn = async () => {
    if (!profile) return;
    setUpdatingPref(true);
    setError(null);
    try {
      await updatePreferences({ monthlyEmailOptIn: !profile.monthlyEmailOptIn });
      setFeedback(
        !profile.monthlyEmailOptIn
          ? `Monthly auto-updated valuation reports enabled for ${profile.email}.`
          : 'Monthly auto-updated valuation emails paused.'
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update email preference.');
    } finally {
      setUpdatingPref(false);
    }
  };

  const handleGenerateMonthlyEmail = async () => {
    if (!firebaseUser) return;
    setSendingEmail(true);
    setError(null);
    setFeedback(null);
    try {
      const res = await apiFetch<{
        digest: EmailDigestItem;
        deliveryStatus: string;
        deliveryMessage: string;
      }>('/api/email/send-monthly-digest', {
        method: 'POST',
      });
      setFeedback(res.deliveryMessage);
      setPreviewDigest(res.digest);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate monthly email report.');
    } finally {
      setSendingEmail(false);
    }
  };

  const latest = briefings[0] || null;

  return (
    <div className="space-y-8 text-left">
      {/* Live Monthly UK Dental News & Policy Scanner */}
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF5EE] text-[#A6521C] border border-[#D6BC9E]">
              Live UK Dental Policy &amp; Market Intelligence
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2 text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              Monthly NHS Policy, Payroll &amp; Corporate Multiple Updates
            </h2>
            <p className="text-sm text-[#6B6459] mt-1 max-w-3xl">
              Scans live UK dental market news, NHS GDS/UDA reforms, National Minimum Wage &amp; Employer NI changes, CQC guidance, and DSO deal multiples — automatically recalculating your practice valuation each month.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunMonthlyScan}
            disabled={scanning}
            className="btn-primary !py-2.5 !px-5 text-xs flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning Live UK Dental News...' : 'Run Monthly Market & Policy Update'}
          </button>
        </div>

        {feedback && (
          <div className="p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="p-3.5 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!latest ? (
          <div className="p-8 rounded-[6px] border bg-[#FAF8F4] text-center space-y-2" style={{ borderColor: 'var(--color-border)' }}>
            <Newspaper className="w-8 h-8 text-[#A6521C]/60 mx-auto" />
            <p className="text-sm font-bold text-[#26231E]">No monthly market briefing scanned yet</p>
            <p className="text-xs text-[#6B6459] max-w-md mx-auto">
              Click "Run Monthly Market &amp; Policy Update" above to pull live web-grounded UK dental news, NHS policy shifts, and corporate multiple adjustments.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-5 rounded-[6px] border bg-[#FAF5EE]" style={{ borderColor: '#D6BC9E' }}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-xs font-mono font-bold text-[#A6521C] uppercase">
                  Active Briefing · {latest.monthKey}
                </span>
                <span className="text-[11px] font-mono text-[#6B6459]">
                  Updated {new Date(latest.createdAt).toLocaleDateString('en-GB')}
                </span>
              </div>
              <h3 className="text-xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
                {latest.headline}
              </h3>
              <p className="text-sm text-[#4A443C] mt-2 leading-relaxed">{latest.summary}</p>

              {/* Multiple Adjustments by Practice Type */}
              {latest.multipleAdjustmentsJson && Object.keys(latest.multipleAdjustmentsJson).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-[#D6BC9E]">
                  {Object.entries(latest.multipleAdjustmentsJson).map(([type, delta]) => {
                    const num = Number(delta);
                    return (
                      <div key={type} className="bg-white p-3 rounded-[4px] border border-[#E2DBD0]">
                        <span className="text-[11px] font-bold text-[#6B6459] block">{type}</span>
                        <span
                          className={`text-base font-mono font-bold ${
                            num > 0 ? 'text-emerald-700' : num < 0 ? 'text-red-700' : 'text-[#26231E]'
                          }`}
                        >
                          {num > 0 ? `+${num.toFixed(2)}` : num.toFixed(2)} YP
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Policy Change Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(latest.policyChangesJson || []).map((item, idx) => (
                <div key={idx} className="p-4 rounded-[6px] border bg-[#FAF8F4] space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-[#26231E] text-white">
                      {item.category}
                    </span>
                    <span className="text-xs font-mono font-bold text-[#A6521C]">
                      {item.impactOnMultiples}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#26231E]">{item.title}</h4>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(item.affectedPracticeTypes || []).map((pt) => (
                      <span
                        key={pt}
                        className="text-[11px] px-2 py-0.5 rounded bg-white border text-[#6B6459]"
                        style={{ borderColor: 'var(--color-border)' }}
                      >
                        {pt}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Verified Web Sources */}
            {latest.sourcesJson && latest.sourcesJson.length > 0 && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B6459] block mb-2">
                  Verified Market &amp; Policy Sources
                </span>
                <div className="flex flex-wrap gap-2">
                  {latest.sourcesJson.map((src, i) => (
                    <a
                      key={i}
                      href={src.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-[4px] border bg-[#FAF8F4] hover:bg-[#FAF5EE] text-[#26231E] transition-colors"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <ExternalLink className="w-3 h-3 text-[#A6521C]" />
                      <span className="max-w-[260px] truncate">{src.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MONTHLY AUTO-UPDATED REPORT EMAIL SUBSCRIPTION & ARCHIVE */}
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
              Automated Principal Briefing
            </span>
            <h3 className="text-xl sm:text-2xl font-bold mt-2 text-[#26231E] flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
              <Mail className="w-5 h-5 text-[#A6521C]" />
              Monthly Auto-Updated Valuation Report Email
            </h3>
            <p className="text-xs sm:text-sm text-[#6B6459] mt-1">
              Receive an updated monthly email combining your latest MV1 goodwill valuation, Buyer-Readiness Score trend, UK dental policy changes, and top individualised pointers.
            </p>
          </div>

          {!firebaseUser ? (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="btn-primary !py-2.5 !px-4 text-xs flex items-center gap-2 whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              Sign In to Enable Monthly Email
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleToggleEmailOptIn}
                disabled={updatingPref}
                className={`px-4 py-2.5 rounded-[6px] text-xs font-bold border flex items-center gap-2 transition-colors ${
                  profile?.monthlyEmailOptIn
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-[#FAF8F4] border-[#E2DBD0] text-[#6B6459]'
                }`}
              >
                <Bell className="w-4 h-4" />
                {profile?.monthlyEmailOptIn ? 'Auto-Email: Active' : 'Auto-Email: Paused'}
              </button>

              <button
                type="button"
                onClick={handleGenerateMonthlyEmail}
                disabled={sendingEmail}
                className="btn-primary !py-2.5 !px-4 text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendingEmail ? 'Generating Report Email...' : 'Send / Preview Monthly Report Now'}
              </button>
            </div>
          )}
        </div>

        {firebaseUser && (
          <div className="space-y-4">
            <div className="p-4 rounded-[6px] border bg-[#FAF8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs" style={{ borderColor: 'var(--color-border)' }}>
              <span>
                Recipient Account: <strong>{profile?.email || firebaseUser.email}</strong>
              </span>
              <span className="text-[#6B6459]">
                {profile?.lastDigestSentAt
                  ? `Last generated: ${new Date(profile.lastDigestSentAt).toLocaleString('en-GB')}`
                  : 'No monthly digest dispatched yet'}
              </span>
            </div>

            {digests.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#6B6459] block">
                  Archived Monthly Email Reports ({digests.length})
                </span>
                <div className="divide-y border rounded-[6px]" style={{ borderColor: 'var(--color-border)' }}>
                  {digests.map((d) => (
                    <div key={d.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white hover:bg-[#FAF8F4]/70">
                      <div>
                        <p className="text-xs font-bold text-[#26231E]">{d.subject}</p>
                        <p className="text-[11px] text-[#6B6459] mt-0.5">
                          To: {d.recipientEmail} · {new Date(d.sentAt).toLocaleString('en-GB')} · Status:{' '}
                          <span className="font-mono font-semibold text-[#A6521C]">
                            {d.deliveryStatus === 'sent_smtp' ? 'Dispatched via SMTP' : 'Archived Preview'}
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPreviewDigest(d)}
                        className="btn-secondary !py-1.5 !px-3 text-xs flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Email
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sandboxed Email HTML Preview Modal */}
      {previewDigest && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[8px] border max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
            <div className="p-4 border-b flex items-center justify-between bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <span className="text-[11px] font-mono uppercase text-[#A6521C] font-bold">
                  Monthly Auto-Updated Valuation Email Preview
                </span>
                <h4 className="text-sm font-bold text-[#26231E]">{previewDigest.subject}</h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDigest(null)}
                className="p-1.5 rounded hover:bg-black/10 text-[#26231E]"
                aria-label="Close email preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <iframe
              title="Monthly Valuation Email Preview"
              srcDoc={previewDigest.htmlBody}
              sandbox=""
              className="w-full h-[600px] border-none bg-[#FAF8F4]"
            />
          </div>
        </div>
      )}
    </div>
  );
};
