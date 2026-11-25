import React, { useState } from 'react';
import { DentalIntakeData, BankStandardValuationResult } from '../types';
import { formatGbp } from '../utils/valuationEngine';
import { syncSnapshotToFirestore } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { PracticeValuationHistory } from './PracticeValuationHistory';
import { EbitdaScoreTrendSection } from './EbitdaScoreTrendSection';
import {
  Printer,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Building,
  Scale,
  Sliders,
  Share2,
  LineChart as LineChartIcon,
  ShieldCheck,
} from 'lucide-react';

interface ValuationDashboardProps {
  intakeData: DentalIntakeData;
  report: BankStandardValuationResult;
  onOpenCapture: (source: string) => void;
  activeReportId?: number | null;
  onReportSaved?: (reportId: number) => void;
  historyRefreshTrigger?: number;
}

export const ValuationDashboard: React.FC<ValuationDashboardProps> = ({
  intakeData,
  report,
  onOpenCapture,
  activeReportId = null,
  onReportSaved,
  historyRefreshTrigger = 0,
}) => {
  const { firebaseUser, profile, signInWithGoogle } = useAuth();
  const [activeTab, setActiveTab] = useState<'methodologies' | 'simulator' | 'bank_dossier' | 'fixes' | 'history'>('methodologies');
  
  // Interactive Simulator State
  const [simPlanAdd, setSimPlanAdd] = useState<number>(0);
  const [simChairHours, setSimChairHours] = useState<number>(intakeData.principalChairHoursPerWeek || 20);
  const [simUtilisation, setSimUtilisation] = useState<number>(intakeData.surgeryChairUtilisationPercent || 70);
  const [simEliminateClawback, setSimEliminateClawback] = useState<boolean>(true);
  const [shareAnonymised, setShareAnonymised] = useState<boolean>(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [localRefresh, setLocalRefresh] = useState<number>(0);

  // Compute Simulated Values
  const clawbackRecovered = (intakeData.clawbackAmount && simEliminateClawback) ? intakeData.clawbackAmount : 0;
  const planEbitdaBoost = Math.round(simPlanAdd * 0.45); // 45% margin on capitation plan shift
  const utilisationBoost = Math.round((Math.max(simUtilisation - intakeData.surgeryChairUtilisationPercent, 0) / 100) * (intakeData.turnover * 0.22));
  
  const simulatedFmop = report.fmop + clawbackRecovered + planEbitdaBoost + utilisationBoost;
  
  let simulatedYp = report.ypMultiplierAdopted;
  if (simPlanAdd >= 100000) simulatedYp += 0.6;
  else if (simPlanAdd >= 50000) simulatedYp += 0.3;

  if (simChairHours <= 10 && intakeData.principalChairHoursPerWeek > 15) {
    simulatedYp += 0.9; // Huge premium for autonomous associate-led clinic
  } else if (simChairHours < intakeData.principalChairHoursPerWeek) {
    simulatedYp += 0.4;
  }

  if (simEliminateClawback && intakeData.clawbackAmount > 0) {
    simulatedYp += 0.5;
  }

  if (simUtilisation >= 85 && intakeData.surgeryChairUtilisationPercent < 80) {
    simulatedYp += 0.3;
  }

  simulatedYp = parseFloat(Math.min(simulatedYp, 11.5).toFixed(2));
  const simulatedValuation = Math.round((simulatedFmop * simulatedYp) / 10000) * 10000;
  const simulatedGain = Math.max(simulatedValuation - report.mv1MarketValueGoodwill, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleSaveDossier = async () => {
    if (!firebaseUser) {
      try {
        await signInWithGoogle();
      } catch {
        return;
      }
    }

    setSaveStatus('saving');
    setSaveMessage(null);
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const res = await apiFetch<{ report: { id: number; anonymisedCode: string } }>('/api/reports', {
        method: 'POST',
        body: JSON.stringify({
          reportId: activeReportId ?? undefined,
          practiceName: intakeData.practiceName || 'Unnamed UK Dental Practice',
          practiceType: intakeData.practiceType,
          region: intakeData.region,
          postcodeOutward: intakeData.postcode || 'UK',
          surgeriesCount: intakeData.surgeriesCount,
          turnoverGbp: intakeData.turnover,
          fmopGbp: report.fmop,
          fmopMarginPercent: report.fmopMarginPercent,
          ypMultiple: report.ypMultiplierAdopted,
          mv1GoodwillGbp: report.mv1MarketValueGoodwill,
          buyerReadinessScore: report.buyerReadinessScore,
          isAnonymisedShared: shareAnonymised ?? profile?.anonymisedSharingDefault ?? true,
          intakeJson: intakeData,
          snapshotMonth: currentMonth,
          snapshotNote: `Dossier saved (${report.ypMultiplierAdopted} YP · ${report.buyerReadinessScore}/100)`,
        }),
      });

      if (firebaseUser) {
        await syncSnapshotToFirestore({
          uid: firebaseUser.uid,
          snapshotMonth: currentMonth,
          practiceLabel: intakeData.practiceName || 'Primary Dental Practice',
          buyerReadinessScore: report.buyerReadinessScore,
          mv1GoodwillGbp: report.mv1MarketValueGoodwill,
          ypMultiple: report.ypMultiplierAdopted,
        });
      }

      onReportSaved?.(res.report.id);
      setLocalRefresh((n) => n + 1);
      setSaveStatus('saved');
      setSaveMessage(
        shareAnonymised
          ? `Saved privately & shared anonymised copy (${res.report.anonymisedCode}) + monthly snapshot logged.`
          : 'Saved privately to your account + monthly snapshot logged.'
      );
      setTimeout(() => setSaveStatus('idle'), 5000);
    } catch (err) {
      setSaveStatus('error');
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save valuation dossier.');
    }
  };

  return (
    <div className="space-y-8 text-left">
      {/* 1. EXECUTIVE SUMMARY & BANK DOSSIER HEADER */}
      <div
        className="p-6 sm:p-8 rounded-[6px] border print:border-none"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: 'var(--color-border)',
          boxShadow: '0 4px 16px rgba(38,35,30,0.06)',
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 mb-6 border-b gap-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ backgroundColor: '#F3EFE9', color: 'var(--color-text-primary)' }}
              >
                RICS Red Book Valuation Standard (Profits Method)
              </span>
              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                UK Dental M&amp;A Panel 2026
              </span>
            </div>
            <h3
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              {intakeData.practiceName || 'Bridge House Dental Practice'}
            </h3>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Classification: <strong>{intakeData.practiceType}</strong> · <strong>{intakeData.surgeriesCount} Surgeries</strong> · {report.location} · Tenure: <strong>{intakeData.tenure}</strong>
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-[6px] border transition-colors hover:bg-black/5"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-background)',
                  color: 'var(--color-text-primary)',
                }}
              >
                <Printer className="w-4 h-4" />
                Print / Save PDF
              </button>
              <button
                onClick={handleSaveDossier}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2.5 rounded-[6px] border transition-colors bg-white hover:bg-gray-50"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Share2 className="w-3.5 h-3.5 text-[#A6521C]" />
                {saveStatus === 'saving'
                  ? 'Saving to Account...'
                  : saveStatus === 'saved'
                  ? 'Dossier & Snapshot Saved ✓'
                  : firebaseUser
                  ? 'Save Dossier to Account'
                  : 'Sign In & Save Dossier'}
              </button>
              <button
                onClick={() => onOpenCapture('Dashboard Valuation Header')}
                className="btn-primary text-xs sm:text-sm !py-2.5 !px-4"
              >
                Lock in Practice Exit Plan
              </button>
            </div>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-[#6B6459] cursor-pointer">
              <input
                type="checkbox"
                checked={shareAnonymised}
                onChange={(e) => setShareAnonymised(e.target.checked)}
                className="accent-[#A6521C]"
              />
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span>Include anonymised copy in UK National Pool (strips clinic name &amp; address)</span>
            </label>
          </div>
        </div>

        {saveMessage && (
          <div
            className={`mb-5 p-3 rounded-[6px] border text-xs flex items-center gap-2 ${
              saveStatus === 'error'
                ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800'
            }`}
          >
            {saveStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{saveMessage}</span>
          </div>
        )}

        {/* Executive Summary Grid (Mirroring Bank Report Page 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-[6px] bg-[#FAF8F4] border mb-6 text-xs" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-gray-500 uppercase font-bold block mb-0.5">Location &amp; Postcode</span>
            <span className="font-semibold text-gray-900 block">{intakeData.address || '29 Bondgate Green'}</span>
            <span className="text-gray-600">{intakeData.postcode || 'HG4 1QW'} ({intakeData.region})</span>
          </div>

          <div>
            <span className="text-gray-500 uppercase font-bold block mb-0.5">Floor Area &amp; Surgeries</span>
            <span className="font-semibold text-gray-900 block">{report.surgeries} Operational Surgeries</span>
            <span className="text-gray-600">{report.floorAreaSqFt} sq ft ({Math.round(report.floorAreaSqFt / 10.763)} sq m) NIA</span>
          </div>

          <div>
            <span className="text-gray-500 uppercase font-bold block mb-0.5">Compliance &amp; Imaging</span>
            <span className="font-semibold text-gray-900 block">{intakeData.hasDeconRoom ? 'HTM 01-05 Dedicated Decon' : 'Local Decon'}</span>
            <span className="text-gray-600">{intakeData.hasOpgCbctRoom ? '3D CBCT / OPG Digital Suite' : 'Intraoral Digital'}</span>
          </div>

          <div>
            <span className="text-gray-500 uppercase font-bold block mb-0.5">Readiness Score &amp; CQC</span>
            <span className="font-bold text-[#A6521C] text-sm block">{report.buyerReadinessScore} / 100</span>
            <span className="text-emerald-700 font-semibold">CQC Status: {intakeData.cqcStatus}</span>
          </div>
        </div>

        {/* Dashboard Sub-Tabs for Deep Analysis */}
        <div className="flex flex-wrap items-center gap-2 border-b pb-3 mb-6" style={{ borderColor: 'var(--color-border)' }}>
          <button
            onClick={() => setActiveTab('methodologies')}
            className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${
              activeTab === 'methodologies' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black bg-gray-100'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            1. Valuer Methodologies Comparison
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${
              activeTab === 'simulator' ? 'bg-[#A6521C] text-white' : 'text-[#A6521C] bg-[#FAF5EE] border border-[#D6BC9E]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            ★ What-If Valuation Simulator (+£ Gain)
          </button>
          <button
            onClick={() => setActiveTab('bank_dossier')}
            className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${
              activeTab === 'bank_dossier' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black bg-gray-100'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            3. RICS Red Book / Bank Standards (MV1, MV2, MV3)
          </button>
          <button
            onClick={() => setActiveTab('fixes')}
            className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${
              activeTab === 'fixes' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black bg-gray-100'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            4. Goodwill Booster Fix-It Plan
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-[4px] transition-colors flex items-center gap-1.5 ${
              activeTab === 'history' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black bg-gray-100'
            }`}
          >
            <LineChartIcon className="w-3.5 h-3.5" />
            5. Practice Valuation History
          </button>
        </div>

        {/* TAB 1: VALUATION METHODOLOGIES COMPARISON */}
        {activeTab === 'methodologies' && (
          <div className="space-y-6">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <h4 className="text-lg font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                  UK Dental Market Valuation Comparison by Buyer Profile
                </h4>
                <span className="text-xs font-mono text-gray-500">
                  How different acquirers evaluate {intakeData.practiceName || 'your practice'}
                </span>
              </div>
              <p className="text-xs text-gray-600 mb-6">
                Specialist dental brokers and valuation agents (Christie &amp; Co, Frank Taylor &amp; Associates, NASDAL) use distinct assessment models depending on whether the buyer is an institution, corporate aggregator, or an independent dentist.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Method 1: Corporate EBITDA Multiple */}
              <div
                className="p-5 rounded-[6px] border flex flex-col justify-between"
                style={{
                  backgroundColor: '#FAF5EE',
                  border: '2px solid var(--color-accent)',
                  boxShadow: 'var(--card-shadow-recommended)',
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#A6521C]">
                      METHOD A: CORPORATE DSO MULTIPLE
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#A6521C] text-white">
                      {report.methodologyComparison.corporateEbitda.ypMultiple} YP
                    </span>
                  </div>
                  <div
                    className="text-3xl font-bold my-2 text-gray-900"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {formatGbp(report.methodologyComparison.corporateEbitda.valuationGbp)}
                  </div>
                  <span className="text-xs font-mono font-medium block text-gray-600 mb-3">
                    Range: {formatGbp(report.methodologyComparison.corporateEbitda.valuationRange[0])} – {formatGbp(report.methodologyComparison.corporateEbitda.valuationRange[1])}
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed mb-4">
                    {report.methodologyComparison.corporateEbitda.basis}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#D6BC9E] text-xs">
                  <span className="font-semibold block text-[#A6521C] mb-1">Target Acquirers:</span>
                  <span className="text-gray-600">
                    {report.methodologyComparison.corporateEbitda.typicalBuyer}
                  </span>
                </div>
              </div>

              {/* Method 2: FTA / Christie & Co % of Turnover */}
              <div
                className="p-5 rounded-[6px] border flex flex-col justify-between bg-[#FAF8F4]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      METHOD B: % OF GROSS FEES
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                      {report.methodologyComparison.grossFeesTurnover.adoptedPercent}% Turnover
                    </span>
                  </div>
                  <div
                    className="text-3xl font-bold my-2 text-gray-900"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {formatGbp(report.methodologyComparison.grossFeesTurnover.valuationGbp)}
                  </div>
                  <span className="text-xs font-mono font-medium block text-gray-600 mb-3">
                    Range: {formatGbp(report.methodologyComparison.grossFeesTurnover.valuationRange[0])} – {formatGbp(report.methodologyComparison.grossFeesTurnover.valuationRange[1])}
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed mb-4">
                    {report.methodologyComparison.grossFeesTurnover.basis}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-200 text-xs">
                  <span className="font-semibold block text-gray-800 mb-1">Benchmark Authority:</span>
                  <span className="text-gray-600">
                    {report.methodologyComparison.grossFeesTurnover.typicalBuyer}
                  </span>
                </div>
              </div>

              {/* Method 3: Reconstituted Net Profit */}
              <div
                className="p-5 rounded-[6px] border flex flex-col justify-between bg-[#FAF8F4]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                      METHOD C: RECONSTITUTED PROFIT
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {report.methodologyComparison.reconstitutedNetProfit.multiple}x Profit
                    </span>
                  </div>
                  <div
                    className="text-3xl font-bold my-2 text-gray-900"
                    style={{ fontFamily: 'var(--font-heading)' }}
                  >
                    {formatGbp(report.methodologyComparison.reconstitutedNetProfit.valuationGbp)}
                  </div>
                  <span className="text-xs font-mono font-medium block text-gray-600 mb-3">
                    Cashflow: £{report.methodologyComparison.reconstitutedNetProfit.adjustedProfitGbp.toLocaleString()}/yr
                  </span>
                  <p className="text-xs text-gray-700 leading-relaxed mb-4">
                    {report.methodologyComparison.reconstitutedNetProfit.basis}
                  </p>
                </div>

                <div className="pt-3 border-t border-gray-200 text-xs">
                  <span className="font-semibold block text-gray-800 mb-1">Typical Deal Structure:</span>
                  <span className="text-gray-600">
                    {report.methodologyComparison.reconstitutedNetProfit.typicalBuyer}
                  </span>
                </div>
              </div>
            </div>

            {/* Valuation Summary Insights */}
            <div className="p-4 rounded-[6px] border bg-[#FAF5EE] text-xs leading-relaxed" style={{ borderColor: '#D6BC9E' }}>
              <span className="font-bold text-[#A6521C] block mb-1">Valuer's Strategic Synthesis:</span>
              <p className="text-gray-700">
                While traditional independent buyers assess this practice at{' '}
                <strong>{formatGbp(report.methodologyComparison.grossFeesTurnover.valuationGbp)}</strong> ({report.methodologyComparison.grossFeesTurnover.adoptedPercent}% of fees), corporate roll-up platforms (Portman Dentex, Bupa, Rodericks) determine value by capitalising EBITDA at{' '}
                <strong>{formatGbp(report.methodologyComparison.corporateEbitda.valuationGbp)}</strong>. The spread between these two numbers is where an owner can negotiate substantial equity upside by presenting structured diligence.
              </p>
            </div>
          </div>
        )}

        {/* TAB 2: INTERACTIVE WHAT-IF VALUATION SIMULATOR */}
        {activeTab === 'simulator' && (
          <div className="space-y-6">
            <div className="p-6 rounded-[6px] border bg-[#FAF5EE]" style={{ borderColor: '#D6BC9E' }}>
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-[#D6BC9E] gap-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#A6521C] block mb-1">
                    Interactive Goodwill &amp; Multiple Simulator
                  </span>
                  <h4 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                    Test How Operational Fixes Expand Your Enterprise Value
                  </h4>
                  <p className="text-xs text-gray-600 mt-1">
                    Adjust the sliders below to simulate converting patients to recurring capitation, reducing principal clinical reliance, and eliminating clawback.
                  </p>
                </div>

                {/* Simulated Output Badge */}
                <div className="p-4 rounded-[6px] bg-white border border-[#D6BC9E] text-right flex-shrink-0">
                  <span className="text-xs uppercase font-bold text-gray-500 block">Projected Value at Exit</span>
                  <div className="text-3xl font-bold text-[#A6521C]" style={{ fontFamily: 'var(--font-heading)' }}>
                    {formatGbp(simulatedValuation)}
                  </div>
                  <span className="text-xs font-bold text-emerald-700 block mt-0.5">
                    +{formatGbp(simulatedGain)} Enterprise Gain ({simulatedYp} YP)
                  </span>
                </div>
              </div>

              {/* Sliders Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Lever 1: Convert Fee-per-Item to Monthly Plan */}
                <div className="bg-white p-4 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase text-gray-800">
                      Convert Patients to Monthly Denplan / Practice Plan
                    </label>
                    <span className="text-sm font-bold text-[#A6521C]">+{formatGbp(simPlanAdd)}/yr</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Shift private fee-per-item patients onto direct-debit maintenance plans.
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="250000"
                    step="10000"
                    value={simPlanAdd}
                    onChange={(e) => setSimPlanAdd(Number(e.target.value))}
                    className="w-full accent-[#A6521C]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>£0</span>
                    <span>+£100k/yr</span>
                    <span>+£250k/yr (DSO Target)</span>
                  </div>
                </div>

                {/* Lever 2: Reduce Principal Chair Hours */}
                <div className="bg-white p-4 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase text-gray-800">
                      Target Principal Chairside Hours / Week
                    </label>
                    <span className="text-sm font-bold text-[#A6521C]">{simChairHours} hrs/wk</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Delegate routine dentistry to associates (Corporate sweet spot: &le;10 hrs/wk).
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="2"
                    value={simChairHours}
                    onChange={(e) => setSimChairHours(Number(e.target.value))}
                    className="w-full accent-[#A6521C]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>0 hrs (Fully Managed)</span>
                    <span>15 hrs (Balanced)</span>
                    <span>35+ hrs (Sole Operator)</span>
                  </div>
                </div>

                {/* Lever 3: Surgery Utilisation Expansion */}
                <div className="bg-white p-4 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold uppercase text-gray-800">
                      Expand Surgery Chair Utilisation
                    </label>
                    <span className="text-sm font-bold text-[#A6521C]">{simUtilisation}%</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mb-2">
                    Fill empty chairs across 5.5 operating days including hygienist sessions.
                  </p>
                  <input
                    type="range"
                    min="50"
                    max="95"
                    step="5"
                    value={simUtilisation}
                    onChange={(e) => setSimUtilisation(Number(e.target.value))}
                    className="w-full accent-[#A6521C]"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>50%</span>
                    <span>70% (Industry avg)</span>
                    <span>90%+ (Optimal)</span>
                  </div>
                </div>

                {/* Lever 4: Eliminate Clawback */}
                {intakeData.clawbackAmount > 0 && (
                  <div className="bg-white p-4 rounded-[6px] border flex flex-col justify-between" style={{ borderColor: 'var(--color-border)' }}>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold uppercase text-red-700">
                          Eliminate NHS Clawback via Dental Therapists
                        </label>
                        <span className="text-sm font-bold text-red-700">£{intakeData.clawbackAmount.toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-gray-500 mb-2">
                        Deploy therapist-led UDA delivery to eliminate annual clawback deductions.
                      </p>
                    </div>

                    <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={simEliminateClawback}
                        onChange={(e) => setSimEliminateClawback(e.target.checked)}
                        className="rounded accent-[#A6521C]"
                      />
                      <span>Eliminate clawback and restore full UDA contract value</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Simulation Result Comparison Bar */}
              <div className="mt-6 pt-4 border-t border-[#D6BC9E] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div>
                  <span className="text-gray-600 block">
                    Current Valuation: <strong>{formatGbp(report.mv1MarketValueGoodwill)}</strong> ({report.ypMultiplierAdopted} YP)
                  </span>
                  <span className="text-emerald-800 font-bold block mt-0.5">
                    Projected with Plan: <strong>{formatGbp(simulatedValuation)}</strong> ({simulatedYp} YP on £{simulatedFmop.toLocaleString()} FMOP)
                  </span>
                </div>

                <button
                  onClick={() => onOpenCapture('Simulator Pre-Sale Sprint')}
                  className="btn-primary !py-2 !px-4 text-xs font-bold"
                >
                  Implement This Action Plan &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FAIR MAINTAINABLE TRADING (FMT) ASSESSMENT & BANK STANDARDS */}
        {activeTab === 'bank_dossier' && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                  Fair Maintainable Trading Assessment (Profits Method)
                </h4>
                <span className="text-xs font-mono text-gray-500">
                  Adopted by Reasonably Efficient Operator (REO)
                </span>
              </div>

              <div className="border rounded-[6px] overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-left text-sm">
                  <thead className="bg-[#FAF8F4] border-b text-xs font-bold uppercase text-gray-600" style={{ borderColor: 'var(--color-border)' }}>
                    <tr>
                      <th className="py-2.5 px-4">Financial Element</th>
                      <th className="py-2.5 px-4 text-right">Amount (£ GBP)</th>
                      <th className="py-2.5 px-4 text-right">% of Income</th>
                      <th className="py-2.5 px-4">Valuer Assessment Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs sm:text-sm" style={{ borderColor: 'var(--color-border)' }}>
                    <tr>
                      <td className="py-2.5 px-4 font-semibold text-gray-900">Total Practice Gross Income</td>
                      <td className="py-2.5 px-4 text-right font-bold">{formatGbp(report.fmtIncome)}</td>
                      <td className="py-2.5 px-4 text-right">100.0%</td>
                      <td className="py-2.5 px-4 text-gray-600">Assessed gross fees across NHS contracts, private and plans</td>
                    </tr>
                    {intakeData.clawbackAmount > 0 && (
                      <tr className="bg-red-50/50">
                        <td className="py-2.5 px-4 text-red-700 font-medium">Less UDA Clawback Deduction</td>
                        <td className="py-2.5 px-4 text-right text-red-700 font-bold">-{formatGbp(intakeData.clawbackAmount)}</td>
                        <td className="py-2.5 px-4 text-right text-red-700">
                          -{((intakeData.clawbackAmount / report.fmtIncome) * 100).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-4 text-red-600 text-xs">Deduction due to contracted UDA under-delivery</td>
                      </tr>
                    )}
                    <tr>
                      <td className="py-2.5 px-4 text-gray-800">Cost of Sales (Labs, Materials &amp; Associates)</td>
                      <td className="py-2.5 px-4 text-right font-medium">-{formatGbp(report.fmtCostOfSales)}</td>
                      <td className="py-2.5 px-4 text-right">
                        {((report.fmtCostOfSales / report.fmtIncome) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">Materials (~15%) + Associate &amp; Therapist fees (~40%)</td>
                    </tr>
                    <tr className="bg-[#FAF8F4] font-semibold">
                      <td className="py-2.5 px-4 text-gray-900">Gross Profit</td>
                      <td className="py-2.5 px-4 text-right font-bold text-gray-900">{formatGbp(report.fmtGrossProfit)}</td>
                      <td className="py-2.5 px-4 text-right">
                        {((report.fmtGrossProfit / report.fmtIncome) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">Gross operational margin</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-4 text-gray-800">Administrative Expenses &amp; Staff Wages</td>
                      <td className="py-2.5 px-4 text-right font-medium">-{formatGbp(report.fmtAdminExpenses)}</td>
                      <td className="py-2.5 px-4 text-right">
                        {((report.fmtAdminExpenses / report.fmtIncome) * 100).toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-4 text-gray-600">Staff wages ({formatGbp(intakeData.staffWagesPa || 207000)}), rent, utilities, indemnity</td>
                    </tr>
                    <tr className="bg-[#FAF5EE] font-bold text-base border-t-2" style={{ borderColor: 'var(--color-accent)' }}>
                      <td className="py-3 px-4 text-[#A6521C]">Fair Maintainable Operating Profit (FMOP / EBITDA)</td>
                      <td className="py-3 px-4 text-right text-[#A6521C] text-lg font-bold">{formatGbp(report.fmop)}</td>
                      <td className="py-3 px-4 text-right text-[#A6521C]">{report.fmopMarginPercent}%</td>
                      <td className="py-3 px-4 text-xs font-normal text-gray-700">Adopted as baseline profit for capitalisation multiplier</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* THREE-TIER BANK VALUATION STANDARDS (MV1, MV2, MV3) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-base font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                  Bank Valuation Standards &amp; Yield Capitalisation
                </h4>
                <span className="text-xs font-mono text-gray-500">
                  In accordance with RICS Global Valuation Standards
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* MV1: Market Value */}
                <div
                  className="p-5 rounded-[6px] border flex flex-col justify-between"
                  style={{
                    backgroundColor: '#FAF5EE',
                    border: '2px solid var(--color-accent)',
                    boxShadow: 'var(--card-shadow-recommended)',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#A6521C]">
                        MV1: MARKET VALUE (GOODWILL)
                      </span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-[#A6521C] text-white">
                        {report.ypMultiplierAdopted} YP
                      </span>
                    </div>
                    <div
                      className="text-3xl font-bold my-2 text-gray-900"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {formatGbp(report.mv1MarketValueGoodwill)}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Market Value of the practice goodwill as a fully equipped operational entity on a fully managed basis assuming a 12-month marketing period.
                    </p>
                  </div>

                  <div className="pt-3 mt-4 border-t border-[#D6BC9E] text-xs">
                    <div className="flex justify-between font-mono font-semibold">
                      <span>FMOP (£{report.fmop.toLocaleString()}) × {report.ypMultiplierAdopted} YP</span>
                      <span className="text-[#A6521C]">Say {formatGbp(report.mv1MarketValueGoodwill)}</span>
                    </div>
                  </div>
                </div>

                {/* MV2: Special Assumption (6-Month Restricted Sale) */}
                <div
                  className="p-5 rounded-[6px] border flex flex-col justify-between bg-[#FAF8F4]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                        MV2: RESTRICTED SALE (6 MONTHS)
                      </span>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        -20% Deduction
                      </span>
                    </div>
                    <div
                      className="text-3xl font-bold my-2 text-gray-900"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      {formatGbp(report.mv2RestrictedMarketingValue)}
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Special assumption required by UK commercial lenders (Lloyds, NatWest) reflecting a forced 6-month marketing period to exchange of contracts.
                    </p>
                  </div>

                  <div className="pt-3 mt-4 border-t border-gray-200 text-xs">
                    <span className="text-gray-500">Liquidity security discount applied.</span>
                  </div>
                </div>

                {/* MV3: Special Assumption (Cessation / Closed) */}
                <div
                  className="p-5 rounded-[6px] border flex flex-col justify-between bg-[#FAF8F4]"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                        MV3: CLOSED PRACTICE (CESSATION)
                      </span>
                      <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-200 text-gray-700">
                        Break-up
                      </span>
                    </div>
                    <div
                      className="text-3xl font-bold my-2 text-gray-900"
                      style={{ fontFamily: 'var(--font-heading)' }}
                    >
                      £Nil
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">
                      Accounts of trade unavailable, business closed, registrations removed, and trading inventory depleted. No goodwill value survives.
                    </p>
                  </div>

                  <div className="pt-3 mt-4 border-t border-gray-200 text-xs">
                    <span className="text-gray-500">Only bricks &amp; mortar asset value remains.</span>
                  </div>
                </div>
              </div>
            </div>

            {/* PROPERTY TENURE & REINSTATEMENT COSTS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-5 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-gray-500 mb-1">
                  Market Rent (MR) Assessment
                </span>
                <div className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                  £{report.marketRentPa.toLocaleString()} per annum (£{report.marketRentPsf.toFixed(2)}/sq ft NIA)
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Based on headline market rent for commercial D1/E medical surgery premises on a 15-year FRI lease terms with 5-yearly reviews.
                </p>
              </div>

              <div>
                <span className="text-xs font-bold uppercase tracking-wider block text-gray-500 mb-1">
                  Informal Fire Insurance Reinstatement Cost
                </span>
                <div className="text-xl font-bold text-gray-900" style={{ fontFamily: 'var(--font-heading)' }}>
                  £{report.reinstatementCostEstimate.toLocaleString()}
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Estimated Day One replacement cost calculated from RICS BCIS construction cost indices for building rebuilding purposes.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: FIX-IT PLAN & SWOT */}
        {activeTab === 'fixes' && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4
                    className="text-lg font-bold"
                    style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
                  >
                    Valuation Enhancement Fix-It Plan (Ranked by Pound Impact)
                  </h4>
                  <p className="text-xs text-gray-600">
                    Strategic actions to move your practice from today's {report.ypMultiplierAdopted} YP multiplier to institutional corporate readiness ({report.ypMultiplierRangeHigh} YP).
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {report.topFixes.map((fix) => (
                  <div
                    key={fix.id}
                    className="p-5 rounded-[6px] border bg-[#FAF8F4] transition-all"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                      <div className="flex items-start gap-3">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 text-white"
                          style={{ backgroundColor: 'var(--color-accent)' }}
                        >
                          {fix.rank}
                        </span>
                        <div>
                          <h5 className="text-base font-bold text-gray-900">
                            {fix.title}
                          </h5>
                          <div className="flex items-center gap-3 text-[11px] font-mono text-gray-500 mt-0.5">
                            <span>Category: {fix.category}</span>
                            <span>•</span>
                            <span>Timeline: {fix.timelineMonths} months</span>
                          </div>
                        </div>
                      </div>

                      <div className="sm:text-right flex-shrink-0">
                        <span className="text-xs uppercase tracking-wide block font-semibold text-[#A6521C]">
                          Estimated Sale Price Impact:
                        </span>
                        <span
                          className="text-base sm:text-lg font-bold"
                          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)' }}
                        >
                          +{formatGbp(fix.estimatedPoundImpactMin)} – {formatGbp(fix.estimatedPoundImpactMax)}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed mt-2 pl-9 text-gray-800">
                      {fix.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* BANK-STANDARD SWOT ANALYSIS */}
            <div className="border-t pt-8" style={{ borderColor: 'var(--color-border)' }}>
              <h4
                className="text-base font-bold mb-4 uppercase tracking-wider text-xs text-gray-600"
              >
                Bank Report SWOT Analysis (Loan Security Risk Matrix)
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="p-4 rounded-[6px] border bg-white" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 block mb-2">
                    ✓ Strengths
                  </span>
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {report.swotAnalysis.strengths.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="p-4 rounded-[6px] border bg-white" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-800 block mb-2">
                    ⚠ Weaknesses
                  </span>
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {report.swotAnalysis.weaknesses.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Opportunities */}
                <div className="p-4 rounded-[6px] border bg-white" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-800 block mb-2">
                    ↗ Opportunities
                  </span>
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {report.swotAnalysis.opportunities.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Threats */}
                <div className="p-4 rounded-[6px] border bg-white" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-800 block mb-2">
                    ⚡ Threats
                  </span>
                  <ul className="space-y-1.5 text-xs text-gray-700">
                    {report.swotAnalysis.threats.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-red-600 font-bold">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PRACTICE VALUATION HISTORY (DEDICATED TAB VIEW) */}
        {activeTab === 'history' && (
          <PracticeValuationHistory
            intakeData={intakeData}
            report={report}
            activeReportId={activeReportId}
            refreshTrigger={historyRefreshTrigger + localRefresh}
          />
        )}
      </div>

      {/* 12-MONTH EBITDA & VALUATION SCORE TREND SECTION */}
      <EbitdaScoreTrendSection
        report={report}
        refreshTrigger={historyRefreshTrigger + localRefresh}
      />

      {/* ALWAYS-ACCESSIBLE PRACTICE VALUATION HISTORY SECTION BELOW DASHBOARD */}
      {activeTab !== 'history' && (
        <PracticeValuationHistory
          intakeData={intakeData}
          report={report}
          activeReportId={activeReportId}
          refreshTrigger={historyRefreshTrigger + localRefresh}
        />
      )}
    </div>
  );
};
