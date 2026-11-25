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

export interface AnonymisedReportItem {
  id: number;
  anonymisedCode: string;
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
  valuationDriversJson: Array<{
    factor: string;
    direction: 'positive' | 'negative' | 'neutral';
    impactSummary: string;
  }>;
  aiPointersJson: Array<{
    id: string;
    title: string;
    detail: string;
    estimatedImpactGbp: string;
  }>;
  isMine: boolean;
  updatedAt: string;
}

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
  const { firebaseUser, signInWithGoogle } = useAuth();
  const [viewMode, setViewMode] = useState<'national' | 'mine'>('national');
  const [nationalReports, setNationalReports] = useState<AnonymisedReportItem[]>([]);
  const [myReports, setMyReports] = useState<PrivateReportItem[]>([]);
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const natRes = await apiFetch<{ reports: AnonymisedReportItem[] }>('/api/anonymised-reports');
      setNationalReports(natRes.reports || []);

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
        body: JSON.stringify({ isAnonymisedShared: !report.isAnonymisedShared }),
      });
      setFeedback(
        !report.isAnonymisedShared
          ? `Report "${report.practiceName}" is now contributed to the UK Anonymised Pool under code ${report.anonymisedCode} (zero identifying details exposed).`
          : `Report "${report.practiceName}" removed from the national anonymised pool (private only).`
      );
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update sharing setting.');
    } finally {
      setTogglingId(null);
    }
  };

  const regions = ['All', ...Array.from(new Set(nationalReports.map((r) => r.region)))];
  const types = ['All', 'NHS Practice', 'Private Practice', 'Mixed Practice', 'Specialist Practice'];

  const filteredNational = nationalReports.filter((r) => {
    if (regionFilter !== 'All' && r.region !== regionFilter) return false;
    if (typeFilter !== 'All' && r.practiceType !== typeFilter) return false;
    return true;
  });

  const avgMultiple =
    filteredNational.length > 0
      ? (
          filteredNational.reduce((acc, r) => acc + r.ypMultiple, 0) / filteredNational.length
        ).toFixed(2)
      : '0.00';

  const avgScore =
    filteredNational.length > 0
      ? Math.round(
          filteredNational.reduce((acc, r) => acc + r.buyerReadinessScore, 0) /
            filteredNational.length
        )
      : 0;

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Zero-PII Anonymised Exchange
              </span>
              <span className="text-xs font-mono text-[#6B6459]">
                {nationalReports.length} UK Clinics Benchmarked
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              UK Dental Clinic Valuation Pool (Anonymised &amp; Private Views)
            </h2>
            <p className="text-sm text-[#6B6459] mt-1 max-w-3xl">
              Compare your saved practice reports side-by-side with anonymised valuations contributed by dental clinics across Great Britain. Practice names, street addresses, full postcodes, and owner emails are stripped at the database query layer.
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
              UK Anonymised Pool ({nationalReports.length})
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

        {/* VIEW A: UK ANONYMISED POOL */}
        {viewMode === 'national' && (
          <div className="space-y-5">
            {/* Filters & Pool Summary */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-[6px] bg-[#FAF8F4] border" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6B6459] mb-0.5">
                    UK Region
                  </label>
                  <select
                    value={regionFilter}
                    onChange={(e) => setRegionFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-[4px] border bg-white text-[#26231E]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {regions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-[#6B6459] mb-0.5">
                    Practice Type
                  </label>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs rounded-[4px] border bg-white text-[#26231E]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    {types.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-5 text-xs">
                <div>
                  <span className="text-[#6B6459] block text-[10px] uppercase font-bold">Pool Avg YP</span>
                  <span className="font-mono font-bold text-base text-[#A6521C]">{avgMultiple}x</span>
                </div>
                <div>
                  <span className="text-[#6B6459] block text-[10px] uppercase font-bold">Avg Score</span>
                  <span className="font-mono font-bold text-base text-[#26231E]">{avgScore}/100</span>
                </div>
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
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredNational.map((item) => (
                <div
                  key={item.id}
                  className={`p-5 rounded-[6px] border space-y-3 ${
                    item.isMine ? 'bg-[#FAF5EE] border-[#A6521C]' : 'bg-white border-[#E2DBD0]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#26231E] text-white">
                          {item.anonymisedCode}
                        </span>
                        <span className="text-xs font-semibold text-[#A6521C]">{item.practiceType}</span>
                        {item.isMine && (
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            Your Contribution
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B6459] mt-1">
                        {item.region} (Area: {item.postcodeOutward}) · {item.surgeriesCount} Surgeries
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-[#26231E] block" style={{ fontFamily: 'var(--font-heading)' }}>
                        {formatGbp(item.mv1GoodwillGbp)}
                      </span>
                      <span className="text-xs font-mono font-bold text-[#A6521C]">
                        {item.ypMultiple} YP · {item.buyerReadinessScore}/100
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs p-2.5 rounded bg-[#FAF8F4] border" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <span className="text-[10px] text-[#6B6459] uppercase block">Gross Fees</span>
                      <span className="font-semibold text-[#26231E]">{formatGbp(item.turnoverGbp)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B6459] uppercase block">FMOP / EBITDA</span>
                      <span className="font-semibold text-[#26231E]">{formatGbp(item.fmopGbp)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6B6459] uppercase block">EBITDA Margin</span>
                      <span className="font-semibold text-[#26231E]">{item.fmopMarginPercent}%</span>
                    </div>
                  </div>

                  {item.valuationDriversJson && item.valuationDriversJson.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-[#6B6459] block">
                        Key Valuation Drivers (Anonymised)
                      </span>
                      {item.valuationDriversJson.slice(0, 2).map((d, i) => (
                        <div key={i} className="text-xs flex items-center justify-between gap-2 text-[#26231E]">
                          <span className="truncate">• {d.factor}</span>
                          <span
                            className={`font-mono text-[11px] font-semibold whitespace-nowrap ${
                              d.direction === 'positive'
                                ? 'text-emerald-700'
                                : d.direction === 'negative'
                                ? 'text-red-700'
                                : 'text-[#6B6459]'
                            }`}
                          >
                            {d.impactSummary}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                  onClick={() => signInWithGoogle()}
                  className="btn-primary !py-2.5 !px-4 text-xs flex items-center gap-2 whitespace-nowrap"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In with Google
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
