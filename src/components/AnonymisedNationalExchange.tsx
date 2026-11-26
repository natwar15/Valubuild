import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  Eye,
  Lock,
  Globe2,
  Building2,
  RefreshCw,
  LogIn,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { formatGbp } from '../utils/valuationEngine';
import { PoolTable } from './MarketDataExplorer';
import type { PoolSummary } from '../shared/marketStats';
import { POOL_CONSENT_TEXT, POOL_CONSENT_VERSION } from '../shared/consent';

export interface PrivateReportItem {
  id: number;
  practiceName: string;
  practiceType: string;
  region: string;
  postcodeOutward: string;
  surgeriesCount: number;
  turnoverGbp: number;
  fmopGbp: number;
  fmopMarginPercent: number;
  ypMultiple: number;
  mv1GoodwillGbp: number;
  buyerReadinessScore: number;
  isAnonymisedShared: boolean;
  anonymisedCode: string;
  updatedAt: string;
}

interface AnonymisedNationalExchangeProps {
  refreshTrigger?: number;
}

export const AnonymisedNationalExchange: React.FC<AnonymisedNationalExchangeProps> = ({
  refreshTrigger = 0,
}) => {
  const { firebaseUser, requestSignIn } = useAuth();
  const [viewMode, setViewMode] = useState<'national' | 'mine'>('national');
  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [myReports, setMyReports] = useState<PrivateReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const poolRes = await apiFetch<{ summary: PoolSummary }>('/api/pool/summary');
      setPool(poolRes.summary);

      if (firebaseUser) {
        const myRes = await apiFetch<{ reports: PrivateReportItem[] }>('/api/reports');
        setMyReports(myRes.reports || []);
      } else {
        setMyReports([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load valuation exchange.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleToggleShare = async (report: PrivateReportItem) => {
    setTogglingId(report.id);
    setError(null);
    setFeedback(null);
    try {
      await apiFetch(`/api/reports/${report.id}/anonymise`, {
        method: 'PATCH',
        body: JSON.stringify({
          isAnonymisedShared: !report.isAnonymisedShared,
          consentVersion: POOL_CONSENT_VERSION,
        }),
      });
      setFeedback(
        !report.isAnonymisedShared
          ? `Report "${report.practiceName}" is now part of the anonymised pool. Its figures are only shown as a median across at least 10 owners.`
          : `Report "${report.practiceName}" removed from the national anonymised pool (private only).`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update sharing setting.');
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Anonymised, groups of 10+ owners only
              </span>
              <span className="text-xs font-mono text-[#6B6459]">
                {pool?.contributors ? `${pool.contributors}+ practices contributing` : 'Growing pool'}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              UK practice owner pool
            </h2>
            <p className="text-sm text-[#6B6459] mt-1 max-w-3xl">
              Benchmarks built from figures practice owners have chosen to share. Individual practices are never shown: figures appear only as medians for groups of at least 10 owners, by region or practice type.
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-[#FAF8F4] p-1 rounded-[6px] border self-start" style={{ borderColor: 'var(--color-border)' }}>
            <button
              type="button"
              onClick={() => setViewMode('national')}
              className={`px-3.5 py-2 text-xs font-bold rounded-[4px] flex items-center gap-1.5 transition-colors ${
                viewMode === 'national' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              Pooled benchmarks
            </button>
            <button
              type="button"
              onClick={() => setViewMode('mine')}
              className={`px-3.5 py-2 text-xs font-bold rounded-[4px] flex items-center gap-1.5 transition-colors ${
                viewMode === 'mine' ? 'bg-[#A6521C] text-white' : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              My Private Reports ({myReports.length})
            </button>
          </div>
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

        {/* VIEW A: POOLED BENCHMARKS (aggregates only) */}
        {viewMode === 'national' && (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={loadData}
                disabled={loading}
                className="text-xs font-semibold text-[#6B6459] hover:text-[#26231E] flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
            {pool && pool.contributors !== null ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <PoolTable title="Region" cells={pool.byRegion} />
                <PoolTable title="Type" cells={pool.byType} />
              </div>
            ) : (
              <div className="p-6 rounded-[6px] border bg-[#FAF8F4] text-sm text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                Not enough owners have shared yet to show figures without risking identifying a practice.
              </div>
            )}
            <p className="text-[11px] text-[#6B6459]">{POOL_CONSENT_TEXT}</p>
          </div>
        )}

        {/* VIEW B: USER'S OWN PRIVATE REPORTS */}
        {viewMode === 'mine' && (
          <div>
            {!firebaseUser ? (
              <div className="p-6 rounded-[6px] border bg-[#FAF8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--color-border)' }}>
                <div>
                  <p className="text-sm font-bold text-[#26231E]">
                    Sign in to manage your private practice reports &amp; anonymised sharing
                  </p>
                  <p className="text-xs text-[#6B6459] mt-1">
                    Only you can view your practice name and private dossier. Toggle anonymised sharing on or off per report at any time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => requestSignIn()}
                  className="btn-primary !py-2.5 !px-4 text-xs flex items-center gap-2 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in or create account
                </button>
              </div>
            ) : myReports.length === 0 ? (
              <div className="p-8 rounded-[6px] border bg-[#FAF8F4] text-center space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                <Building2 className="w-8 h-8 text-[#A6521C]/60 mx-auto" />
                <p className="text-sm font-bold text-[#26231E]">No saved practice reports yet</p>
                <p className="text-xs text-[#6B6459]">
                  Go to Practice Valuation Intake and click "Save Dossier to Account" to persist your report privately or contribute an anonymised copy to the UK pool.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myReports.map((r) => (
                  <div
                    key={r.id}
                    className="p-5 rounded-[6px] border bg-[#FAF8F4] flex flex-col md:flex-row md:items-center justify-between gap-4"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-base font-bold text-[#26231E]">{r.practiceName}</h4>
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-white border text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                          Anon Code: {r.anonymisedCode}
                        </span>
                      </div>
                      <p className="text-xs text-[#6B6459] mt-1">
                        {r.practiceType} · {r.region} ({r.postcodeOutward}) · {r.surgeriesCount} Surgeries · MV1:{' '}
                        <strong className="text-[#26231E]">{formatGbp(r.mv1GoodwillGbp)}</strong> ({r.ypMultiple} YP) · Score:{' '}
                        <strong className="text-[#A6521C]">{r.buyerReadinessScore}/100</strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={togglingId === r.id}
                      onClick={() => handleToggleShare(r)}
                      className={`px-3.5 py-2 rounded-[6px] text-xs font-bold border flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                        r.isAnonymisedShared
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-white border-[#E2DBD0] text-[#26231E] hover:bg-[#FAF5EE]'
                      }`}
                    >
                      {r.isAnonymisedShared ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          Shared Anonymously (Click to Make Private)
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          Private Only (Click to Share Anonymously)
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
