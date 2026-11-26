import React, { useEffect, useState, useCallback } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { Calendar, TrendingUp, Save, LogIn, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { syncSnapshotToFirestore } from '../firebase';
import { formatGbp } from '../utils/valuationEngine';
import { BankStandardValuationResult, DentalIntakeData } from '../types';

export interface ValuationSnapshotItem {
  id: number;
  reportId: number | null;
  practiceLabel: string;
  snapshotMonth: string; // YYYY-MM
  buyerReadinessScore: number;
  mv1GoodwillGbp: number;
  ypMultiple: number;
  fmopGbp: number;
  policyTriggerSummary: string;
  createdAt: string;
}

interface PracticeValuationHistoryProps {
  intakeData: DentalIntakeData;
  report: BankStandardValuationResult;
  activeReportId?: number | null;
  refreshTrigger?: number;
}

function getDefaultMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const PracticeValuationHistory: React.FC<PracticeValuationHistoryProps> = ({
  intakeData,
  report,
  activeReportId,
  refreshTrigger = 0,
}) => {
  const { firebaseUser, requestSignIn } = useAuth();
  const [snapshots, setSnapshots] = useState<ValuationSnapshotItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  const [metricView, setMetricView] = useState<'score' | 'mv1' | 'yp'>('score');
  const [snapshotMonth, setSnapshotMonth] = useState<string>(getDefaultMonthKey());
  const [noteInput, setNoteInput] = useState<string>('Monthly practice valuation review');

  const fetchSnapshots = useCallback(async () => {
    if (!firebaseUser) {
      setSnapshots([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ snapshots: ValuationSnapshotItem[] }>('/api/snapshots');
      setSnapshots(data.snapshots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load monthly snapshots.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots, refreshTrigger]);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSaving(true);
    setError(null);
    setStatusNote(null);

    try {
      const payload = {
        reportId: activeReportId ?? null,
        practiceLabel: intakeData.practiceName || 'Primary Dental Practice',
        snapshotMonth,
        buyerReadinessScore: report.buyerReadinessScore,
        mv1GoodwillGbp: report.mv1MarketValueGoodwill,
        ypMultiple: report.ypMultiplierAdopted,
        fmopGbp: report.fmop,
        policyTriggerSummary: noteInput.trim() || 'Monthly valuation snapshot',
      };

      await apiFetch<{ snapshot: ValuationSnapshotItem }>('/api/snapshots', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await syncSnapshotToFirestore({
        uid: firebaseUser.uid,
        snapshotMonth: payload.snapshotMonth,
        practiceLabel: payload.practiceLabel,
        buyerReadinessScore: payload.buyerReadinessScore,
        mv1GoodwillGbp: payload.mv1GoodwillGbp,
        ypMultiple: payload.ypMultiple,
      });

      setStatusNote(`Saved ${snapshotMonth} snapshot (${report.buyerReadinessScore}/100 · ${formatGbp(report.mv1MarketValueGoodwill)}).`);
      await fetchSnapshots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save monthly snapshot.');
    } finally {
      setSaving(false);
    }
  };

  const chartData = snapshots.map((s) => ({
    month: s.snapshotMonth,
    score: s.buyerReadinessScore,
    mv1Millions: Number((s.mv1GoodwillGbp / 1_000_000).toFixed(2)),
    mv1Gbp: s.mv1GoodwillGbp,
    yp: s.ypMultiple,
    note: s.policyTriggerSummary,
    practice: s.practiceLabel,
  }));

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null;
  const scoreChange = latest && previous ? latest.buyerReadinessScore - previous.buyerReadinessScore : null;
  const mv1Change = latest && previous ? latest.mv1GoodwillGbp - previous.mv1GoodwillGbp : null;

  return (
    <div
      className="p-6 rounded-[6px] border bg-white space-y-6 text-left"
      style={{ borderColor: 'var(--color-border)' }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF5EE] text-[#A6521C] border border-[#D6BC9E]">
              Practice Valuation History
            </span>
            <span className="text-xs font-mono text-[#6B6459]">
              Monthly Database Snapshots
            </span>
          </div>
          <h4 className="text-xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
            Practice Buyer-Readiness Score &amp; Valuation Trend Over Time
          </h4>
          <p className="text-xs text-[#6B6459] mt-0.5">
            Track how operational fixes, uploaded accounts, and monthly UK NHS/market policy updates move your score and goodwill value.
          </p>
        </div>

        {/* Metric Toggle */}
        <div className="flex items-center gap-1.5 bg-[#FAF8F4] p-1 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setMetricView('score')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
              metricView === 'score' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-[#26231E]'
            }`}
          >
            Score (0–100)
          </button>
          <button
            type="button"
            onClick={() => setMetricView('mv1')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
              metricView === 'mv1' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-[#26231E]'
            }`}
          >
            MV1 (£M)
          </button>
          <button
            type="button"
            onClick={() => setMetricView('yp')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-[4px] transition-colors ${
              metricView === 'yp' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-[#26231E]'
            }`}
          >
            YP Multiple
          </button>
        </div>
      </div>

      {/* Auth Gate */}
      {!firebaseUser ? (
        <div className="p-6 rounded-[6px] border bg-[#FAF8F4] flex flex-col sm:flex-row sm:items-center justify-between gap-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <p className="text-sm font-bold text-[#26231E]">
              Sign in to save &amp; track monthly valuation snapshots
            </p>
            <p className="text-xs text-[#6B6459] mt-1">
              Your practice scores and monthly valuation history are stored privately in your account database and synced across sessions.
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
      ) : (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-[11px] font-bold uppercase text-[#6B6459] block">
                Saved Monthly Snapshots
              </span>
              <div className="text-2xl font-bold text-[#26231E] mt-1" style={{ fontFamily: 'var(--font-heading)' }}>
                {snapshots.length}
              </div>
              <span className="text-xs text-[#6B6459]">
                {latest ? `Latest: ${latest.snapshotMonth}` : 'No snapshots saved yet'}
              </span>
            </div>

            <div className="p-4 rounded-[6px] border bg-[#FAF5EE]" style={{ borderColor: '#D6BC9E' }}>
              <span className="text-[11px] font-bold uppercase text-[#A6521C] block">
                Latest Tracked Score
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#A6521C]" style={{ fontFamily: 'var(--font-heading)' }}>
                  {latest ? `${latest.buyerReadinessScore} / 100` : `${report.buyerReadinessScore} / 100`}
                </span>
                {scoreChange !== null && (
                  <span
                    className={`text-xs font-mono font-bold ${
                      scoreChange >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {scoreChange >= 0 ? `+${scoreChange}` : scoreChange} pts MoM
                  </span>
                )}
              </div>
              <span className="text-xs text-[#6B6459]">Corporate Buyer-Readiness Index</span>
            </div>

            <div className="p-4 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-[11px] font-bold uppercase text-[#6B6459] block">
                Latest Tracked Goodwill (MV1)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
                  {latest ? formatGbp(latest.mv1GoodwillGbp) : formatGbp(report.mv1MarketValueGoodwill)}
                </span>
                {mv1Change !== null && (
                  <span
                    className={`text-xs font-mono font-bold ${
                      mv1Change >= 0 ? 'text-emerald-700' : 'text-red-700'
                    }`}
                  >
                    {mv1Change >= 0 ? `+${formatGbp(mv1Change)}` : formatGbp(mv1Change)}
                  </span>
                )}
              </div>
              <span className="text-xs text-[#6B6459]">
                {latest ? `${latest.ypMultiple} YP adopted` : `${report.ypMultiplierAdopted} YP current`}
              </span>
            </div>
          </div>

          {/* Line Chart */}
          <div className="p-4 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#26231E]">
                <TrendingUp className="w-4 h-4 text-[#A6521C]" />
                <span>
                  {metricView === 'score'
                    ? 'Buyer-Readiness Score Progression (0–100)'
                    : metricView === 'mv1'
                    ? 'MV1 Practice Goodwill Valuation Progression (£M)'
                    : 'Adopted EBITDA Multiplier Progression (YP)'}
                </span>
              </div>
              <button
                type="button"
                onClick={fetchSnapshots}
                disabled={loading}
                className="text-xs font-semibold text-[#6B6459] hover:text-[#26231E] flex items-center gap-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {chartData.length === 0 ? (
              <div className="h-[260px] flex flex-col items-center justify-center text-center px-4">
                <Calendar className="w-8 h-8 text-[#A6521C]/50 mb-2" />
                <p className="text-sm font-semibold text-[#26231E]">
                  No monthly snapshots recorded yet
                </p>
                <p className="text-xs text-[#6B6459] max-w-md mt-1">
                  Save your current practice valuation below for this month (or backfill earlier months) to plot your score and enterprise value trajectory.
                </p>
              </div>
            ) : (
              <div className="w-full h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 20, left: 4, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2DBD0" />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: '#6B6459' }}
                      stroke="#C9C1B4"
                    />
                    <YAxis
                      domain={
                        metricView === 'score'
                          ? [0, 100]
                          : metricView === 'yp'
                          ? [3, 12]
                          : ['auto', 'auto']
                      }
                      tick={{ fontSize: 12, fill: '#6B6459' }}
                      stroke="#C9C1B4"
                      tickFormatter={(v) =>
                        metricView === 'mv1' ? `£${v}M` : metricView === 'yp' ? `${v}x` : `${v}`
                      }
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #D6BC9E',
                        borderRadius: '6px',
                        fontSize: '12px',
                      }}
                      formatter={(value: unknown, _name: unknown, item: { payload?: { mv1Gbp?: number; yp?: number; score?: number; note?: string } }) => {
                        if (metricView === 'score') return [`${value} / 100`, 'Readiness Score'];
                        if (metricView === 'mv1') {
                          return [
                            item?.payload?.mv1Gbp ? formatGbp(item.payload.mv1Gbp) : `£${value}M`,
                            'MV1 Goodwill',
                          ];
                        }
                        return [`${value} YP`, 'EBITDA Multiple'];
                      }}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    {metricView === 'score' && (
                      <ReferenceLine
                        y={80}
                        stroke="#059669"
                        strokeDasharray="4 4"
                        label={{
                          value: 'Corporate Premium Target (80)',
                          position: 'insideTopRight',
                          fill: '#059669',
                          fontSize: 11,
                        }}
                      />
                    )}
                    <Line
                      type="monotone"
                      dataKey={
                        metricView === 'score'
                          ? 'score'
                          : metricView === 'mv1'
                          ? 'mv1Millions'
                          : 'yp'
                      }
                      stroke="#A6521C"
                      strokeWidth={3}
                      dot={{ r: 5, fill: '#A6521C', stroke: '#FFFFFF', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: '#26231E' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Save New Monthly Snapshot Form */}
          <form
            onSubmit={handleSaveSnapshot}
            className="p-4 rounded-[6px] border bg-[#FAF5EE] grid grid-cols-1 md:grid-cols-12 gap-3 items-end"
            style={{ borderColor: '#D6BC9E' }}
          >
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold uppercase text-[#6B6459] mb-1">
                Snapshot Month
              </label>
              <input
                type="month"
                value={snapshotMonth}
                onChange={(e) => setSnapshotMonth(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-[11px] font-bold uppercase text-[#6B6459] mb-1">
                Milestone / Policy Trigger Note
              </label>
              <input
                type="text"
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                maxLength={200}
                placeholder="e.g., Added 180 Denplan patients & updated associate covenants"
                className="w-full px-3 py-2 text-xs rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div className="md:col-span-3">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary w-full !py-2 !px-3 text-xs flex items-center justify-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Save Monthly Snapshot'}
              </button>
            </div>
          </form>

          {statusNote && (
            <div className="p-3 rounded-[4px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{statusNote}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-[4px] bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Monthly Snapshot Ledger Table */}
          {snapshots.length > 0 && (
            <div className="border rounded-[6px] overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b uppercase text-[11px] text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                  <tr>
                    <th className="py-2.5 px-3">Month</th>
                    <th className="py-2.5 px-3">Practice</th>
                    <th className="py-2.5 px-3 text-right">Score</th>
                    <th className="py-2.5 px-3 text-right">MV1 Goodwill</th>
                    <th className="py-2.5 px-3 text-right">YP</th>
                    <th className="py-2.5 px-3">Update Trigger / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {[...snapshots].reverse().map((snap) => (
                    <tr key={snap.id} className="hover:bg-[#FAF8F4]/70">
                      <td className="py-2.5 px-3 font-mono font-bold text-[#26231E]">
                        {snap.snapshotMonth}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#26231E]">{snap.practiceLabel}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-[#A6521C]">
                        {snap.buyerReadinessScore}/100
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-[#26231E]">
                        {formatGbp(snap.mv1GoodwillGbp)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[#6B6459]">
                        {snap.ypMultiple}x
                      </td>
                      <td className="py-2.5 px-3 text-[#6B6459]">{snap.policyTriggerSummary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
