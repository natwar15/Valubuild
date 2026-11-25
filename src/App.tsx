/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  CircleDollarSign,
  ClipboardCheck,
  ListOrdered,
  Calendar,
  FileText,
  TrendingUp,
  ChevronDown,
  Check,
  Calculator,
  Compass,
  BarChart2,
  FileSpreadsheet,
  Share2,
  Layers,
  ArrowRight,
  Stethoscope,
  Smile,
  Sparkles,
  Newspaper,
  Globe2,
  MapPin,
  LogIn,
  LogOut,
  UserCircle2,
} from 'lucide-react';
import { Logo } from './components/Logo';
import { HeroVisual } from './components/HeroVisual';
import { CaptureForm } from './components/CaptureForm';
import { CaptureModal } from './components/CaptureModal';
import { ShareKitModal } from './components/ShareKitModal';
import { IntakeWizard, SAMPLE_BANK_REPORT_PRESET } from './components/IntakeWizard';
import { ValuationDashboard } from './components/ValuationDashboard';
import { MarketIntelligence } from './components/MarketIntelligence';
import { RegionalBenchmark } from './components/RegionalBenchmark';
import { DocumentIntelligenceHub } from './components/DocumentIntelligenceHub';
import { MonthlyUpdatesAndEmail } from './components/MonthlyUpdatesAndEmail';
import { AnonymisedNationalExchange } from './components/AnonymisedNationalExchange';
import { UkDentalMap } from './components/UkDentalMap';
import { LiveVoiceAdvisor } from './components/LiveVoiceAdvisor';
import { useAuth } from './context/AuthContext';
import { calculateDentalValuation, formatGbp } from './utils/valuationEngine';
import { DentalIntakeData, UkRegion } from './types';

type ActiveView =
  | 'overview'
  | 'intake'
  | 'documents'
  | 'monthly-news'
  | 'national-pool'
  | 'uk-map'
  | 'market-comps'
  | 'benchmarks';

export default function App() {
  const { firebaseUser, profile, signInWithGoogle, logout } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [intakeData, setIntakeData] = useState<DentalIntakeData>(SAMPLE_BANK_REPORT_PRESET);
  const [valuationResult, setValuationResult] = useState(() => calculateDentalValuation(SAMPLE_BANK_REPORT_PRESET));
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [dataRefreshTick, setDataRefreshTick] = useState<number>(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | undefined>(undefined);
  const [modalSource, setModalSource] = useState<string>('Nav CTA');
  const [shareKitOpen, setShareKitOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const handleOpenCapture = (source: string, tier?: string) => {
    setSelectedTier(tier);
    setModalSource(source);
    setModalOpen(true);
  };

  const handleCalculate = (data: DentalIntakeData) => {
    setIntakeData(data);
    const result = calculateDentalValuation(data);
    setValuationResult(result);
    // Switch to view intake report
    setActiveView('intake');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-background)' }}>
      {/* UK Dental Market Status Strip */}
      <div
        className="w-full py-1.5 px-4 text-center text-xs font-semibold flex items-center justify-center gap-3 border-b"
        style={{
          backgroundColor: '#26231E',
          color: '#FAF8F4',
          borderColor: '#3D3830',
        }}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>UK Dental M&amp;A Radar: <strong>56 Corporate Groups &amp; PE DSOs Buying Now</strong></span>
        </span>
        <span className="hidden sm:inline opacity-40">|</span>
        <span className="hidden sm:inline">All Practice Valuations in <strong>GBP (£)</strong></span>
        <span className="hidden md:inline opacity-40">|</span>
        <button
          onClick={() => setActiveView('market-comps')}
          className="underline hover:text-amber-200 transition-colors"
        >
          View UK Dental Comps &rarr;
        </button>
      </div>

      {/* Main Navigation */}
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div
          className="mx-auto flex items-center justify-between px-4 sm:px-6 h-[72px]"
          style={{ maxWidth: 'var(--max-width)' }}
        >
          <button
            onClick={() => {
              setActiveView('overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2 cursor-pointer text-left bg-transparent border-none p-0"
            aria-label="Valubuild home"
          >
            <Logo size={28} />
          </button>

          {/* Interactive Navigation Tabs */}
          <nav className="hidden xl:flex items-center gap-1">
            <button
              onClick={() => setActiveView('overview')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors ${
                activeView === 'overview'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveView('intake')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'intake'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Valuation &amp; History
            </button>
            <button
              onClick={() => setActiveView('documents')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'documents'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Docs &amp; Questions
            </button>
            <button
              onClick={() => setActiveView('monthly-news')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'monthly-news'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Newspaper className="w-3.5 h-3.5" />
              Monthly News &amp; Email
            </button>
            <button
              onClick={() => setActiveView('national-pool')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'national-pool'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Globe2 className="w-3.5 h-3.5" />
              UK Pool
            </button>
            <button
              onClick={() => setActiveView('uk-map')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'uk-map'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              UK Map
            </button>
            <button
              onClick={() => setActiveView('market-comps')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'market-comps'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              Comps
            </button>
            <button
              onClick={() => setActiveView('benchmarks')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-[4px] transition-colors flex items-center gap-1 ${
                activeView === 'benchmarks'
                  ? 'bg-[#26231E] text-white'
                  : 'text-[#6B6459] hover:text-[#26231E]'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Benchmarks
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {firebaseUser ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-[4px] bg-[#FAF8F4] border text-[#26231E]" style={{ borderColor: 'var(--color-border)' }}>
                  <UserCircle2 className="w-3.5 h-3.5 text-[#A6521C]" />
                  <span className="max-w-[110px] truncate">{profile?.displayName || firebaseUser.displayName || 'Principal'}</span>
                </span>
                <button
                  onClick={() => logout()}
                  className="text-xs font-semibold px-2.5 py-2 rounded-[4px] border bg-white hover:bg-gray-50 text-[#6B6459] flex items-center gap-1"
                  style={{ borderColor: 'var(--color-border)' }}
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => signInWithGoogle()}
                className="text-xs font-semibold px-3 py-2 rounded-[4px] border bg-white hover:bg-[#FAF5EE] text-[#26231E] flex items-center gap-1.5"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <LogIn className="w-3.5 h-3.5 text-[#A6521C]" />
                <span>Principal Sign In</span>
              </button>
            )}
            <button
              onClick={() => setActiveView('intake')}
              className="btn-primary text-xs !py-2 !px-3.5"
            >
              Value Practice (£)
            </button>
          </div>
        </div>

        {/* Tablet/Mobile Scrollable Navigation Strip */}
        <div className="xl:hidden flex items-center gap-1.5 overflow-x-auto py-2 border-t px-3 bg-[#FAF8F4] text-xs font-semibold" style={{ borderColor: 'var(--color-border)' }}>
          {(
            [
              ['overview', 'Overview'],
              ['intake', 'Valuation & History'],
              ['documents', 'Docs & Questions'],
              ['monthly-news', 'News & Email'],
              ['national-pool', 'UK Pool'],
              ['uk-map', 'UK Map'],
              ['market-comps', 'Comps'],
              ['benchmarks', 'Benchmarks'],
            ] as Array<[ActiveView, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveView(id)}
              className={`py-1 px-2.5 rounded whitespace-nowrap ${
                activeView === id ? 'bg-[#26231E] text-white' : 'text-[#6B6459]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1">
        {/* VIEW 1: LIVE INTAKE, VALUATION DASHBOARD & PRACTICE VALUATION HISTORY */}
        {activeView === 'intake' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto space-y-10" style={{ maxWidth: 'var(--max-width)' }}>
              <IntakeWizard initialData={intakeData} onCalculate={handleCalculate} />

              <ValuationDashboard
                intakeData={intakeData}
                report={valuationResult}
                onOpenCapture={(src) => handleOpenCapture(src, 'Exit Dashboard')}
                activeReportId={activeReportId}
                onReportSaved={(id) => {
                  setActiveReportId(id);
                  setDataRefreshTick((n) => n + 1);
                }}
                historyRefreshTrigger={dataRefreshTick}
              />
            </div>
          </div>
        )}

        {/* VIEW 2: AI FINANCIAL DOCUMENTS & ADAPTIVE QUESTION DATASET */}
        {activeView === 'documents' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
              <DocumentIntelligenceHub
                intakeData={intakeData}
                report={valuationResult}
                activeReportId={activeReportId}
                onValuationUpdated={() => setDataRefreshTick((n) => n + 1)}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: MONTHLY UK DENTAL NEWS, POLICIES & EMAIL DIGEST */}
        {activeView === 'monthly-news' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
              <MonthlyUpdatesAndEmail
                onValuationUpdated={() => setDataRefreshTick((n) => n + 1)}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: ANONYMISED NATIONAL VALUATION POOL */}
        {activeView === 'national-pool' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
              <AnonymisedNationalExchange refreshTrigger={dataRefreshTick} />
            </div>
          </div>
        )}

        {/* VIEW 5: INTERACTIVE UK DENTAL CLINIC MAP & CATCHMENT INTELLIGENCE */}
        {activeView === 'uk-map' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
              <UkDentalMap defaultRegion={intakeData.region} />
            </div>
          </div>
        )}

        {/* VIEW 6: UK MARKET COMPS & CORPORATE TRACKER */}
        {activeView === 'market-comps' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
              <MarketIntelligence
                onSelectRegion={(reg) => {
                  setIntakeData({ ...intakeData, region: reg });
                  setActiveView('benchmarks');
                }}
              />
            </div>
          </div>
        )}

        {/* VIEW 7: LOCAL VS NATIONAL UK BENCHMARKS */}
        {activeView === 'benchmarks' && (
          <div className="px-4 sm:px-6 py-10">
            <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
              <RegionalBenchmark
                intakeData={intakeData}
                onSelectRegion={(reg) => setIntakeData({ ...intakeData, region: reg })}
              />
            </div>
          </div>
        )}

        {/* VIEW 4: OVERVIEW & LANDING PAGE */}
        {activeView === 'overview' && (
          <>
            {/* 1. HERO SECTION */}
            <section
              className="relative px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-background)',
                paddingTop: '56px',
                paddingBottom: '96px',
              }}
            >
              <div
                className="mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center"
                style={{ maxWidth: 'var(--max-width)' }}
              >
                {/* Copy Left */}
                <div className="lg:col-span-7 flex flex-col items-start text-left">
                  <div className="flex flex-wrap items-center gap-2 mb-4">
                    <span
                      className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-[4px]"
                      style={{
                        backgroundColor: '#F0EBE1',
                        color: 'var(--color-text-primary)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      UK Dental Clinic Exit Intelligence
                    </span>
                    <span
                      className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800"
                    >
                      All Data in GBP (£)
                    </span>
                  </div>

                  <h1
                    className="text-3xl sm:text-4xl lg:text-[44px] font-bold leading-[1.15] mb-5 tracking-tight"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    Know what your dental practice is worth — before corporates do.
                  </h1>

                  <p
                    className="text-base sm:text-[17px] leading-[1.6] mb-8 max-w-[60ch]"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    A live valuation and corporate-readiness score for UK dental practice principals planning to sell or take equity off the table in the next 2–5 years.
                  </p>

                  {/* Actions & Intake Trigger */}
                  <div className="flex flex-wrap items-center gap-3 w-full max-w-[560px] mb-6">
                    <button
                      onClick={() => setActiveView('intake')}
                      className="btn-primary flex items-center gap-2 text-sm sm:text-base"
                    >
                      <Calculator className="w-4 h-4" />
                      Open Live Practice Valuation Intake &rarr;
                    </button>
                    <button
                      onClick={() => setActiveView('market-comps')}
                      className="btn-secondary text-sm sm:text-base"
                    >
                      Explore 56 UK Dental Corporate Comps
                    </button>
                  </div>

                  {/* Email capture form */}
                  <div className="w-full max-w-[560px] mb-8">
                    <CaptureForm source="Hero Section" />
                  </div>

                  {/* Credibility line */}
                  <div
                    className="pt-5 mt-2 border-t w-full max-w-[560px]"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <p
                      className="text-[14px] leading-[1.5] italic"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Dental practices sold in 2026 across Great Britain at anywhere from 4x to 12x the same EBITDA. The spread is decided in diligence — long before the heads of terms.
                    </p>
                  </div>
                </div>

                {/* Hero Visual Right */}
                <div className="lg:col-span-5 flex justify-center w-full">
                  <HeroVisual />
                </div>
              </div>
            </section>

            {/* 2. PROBLEM SECTION */}
            <section
              id="problem"
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-surface)',
                paddingTop: 'var(--section-py)',
                paddingBottom: 'var(--section-py)',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
                <h2
                  className="text-2xl sm:text-3xl lg:text-[32px] font-bold leading-[1.2] mb-12 text-left"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  The corporate buyer already knows your practice multiple. Do you?
                </h2>

                {/* Pains as 2x2 grid with thin top borders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10 text-left">
                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <span
                      className="text-xs font-mono font-bold block mb-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      01 / UK CORPORATE CONSOLIDATION
                    </span>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      56 corporate dental groups (Portman Dentex, Bupa, Rodericks, Riverdale) are acquiring UK practices right now, and they publish exactly what earns the premium: Denplan/Practice Plan monthly direct debits, associate-led chairtime, and enforceable BDA covenants. Most independent principals never see the audit sheet.
                    </p>
                  </div>

                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <span
                      className="text-xs font-mono font-bold block mb-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      02 / THE £1.4M MULTIPLE SPREAD
                    </span>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      A £300K-EBITDA practice with strong private capitation plans and an associate bench sells for £2.8M–£3.6M. The same practice running 80% NHS with the principal personally billing half the fees sells for £1.4M–£1.7M. Same patient count. Over £1.4M difference.
                    </p>
                  </div>

                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <span
                      className="text-xs font-mono font-bold block mb-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      03 / THE 90-DAY ADVISOR TRAP
                    </span>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      The first honest valuation most principals get is a broker report 90 days before sale — when weaning patients off the principal's personal chair takes two years.
                    </p>
                  </div>

                  <div
                    className="pt-6"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <span
                      className="text-xs font-mono font-bold block mb-2"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      04 / CLINICAL FLIGHT RISK
                    </span>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      If you personally generate over 40% of practice fees and your associates work on informal unwritten agreements, the corporate deal team assumes goodwill flight risk and prices in a punitive 3–5 year earn-out retention.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. HOW IT WORKS SECTION */}
            <section
              id="how-it-works"
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-background)',
                paddingTop: 'var(--section-py)',
                paddingBottom: '64px',
              }}
            >
              <div className="mx-auto text-left" style={{ maxWidth: 'var(--max-width)' }}>
                <h2
                  className="text-2xl sm:text-3xl lg:text-[32px] font-bold leading-[1.2] mb-12"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Your number, your score, your fix list.
                </h2>

                {/* 3 numbered open columns */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10">
                  <div>
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center font-bold text-sm mb-4 border"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      1
                    </div>
                    <h3
                      className="text-[20px] font-semibold leading-[1.35] mb-2.5"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Step 1 — Enter your practice numbers.
                    </h3>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Paste your annual gross fees (£) and adjusted EBITDA, number of surgeries, and answer 10 questions on NHS/private mix, Denplan plans, and principal chairtime. Takes 15 minutes — no software hookups required.
                    </p>
                  </div>

                  <div>
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center font-bold text-sm mb-4 border"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      2
                    </div>
                    <h3
                      className="text-[20px] font-semibold leading-[1.35] mb-2.5"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Step 2 — Get your valuation and readiness score.
                    </h3>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      You get an EBITDA multiple range built from real UK dental corporate transaction comps, plus a 0–100 score across the 12 things DSO deal teams audit in due diligence.
                    </p>
                  </div>

                  <div>
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center font-bold text-sm mb-4 border"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        borderColor: 'var(--color-border)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      3
                    </div>
                    <h3
                      className="text-[20px] font-semibold leading-[1.35] mb-2.5"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Step 3 — Work the clinical fix list.
                    </h3>
                    <p
                      className="text-[17px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Every operational gap is ranked by pound (£) impact on your practice sale price. Re-score monthly and watch your enterprise value climb while you still have years to plan.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* DEMO MOMENT (WORKED EXAMPLE FOR DENTAL CLINIC) */}
            <section
              id="demo"
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-surface)',
                paddingTop: '64px',
                paddingBottom: 'var(--section-py)',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 text-left">
                  <p
                    className="text-[17px] font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Here's a real example of what the report looks like for a £1.45M mixed dental practice in the South East.
                  </p>
                  <button
                    onClick={() => {
                      setIntakeData(SAMPLE_BANK_REPORT_PRESET);
                      setActiveView('intake');
                    }}
                    className="btn-secondary !py-2 !px-4 text-xs font-bold"
                  >
                    Load into Practice Calculator &rarr;
                  </button>
                </div>

                {/* Two-panel before/after report cards */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 text-left">
                  {/* Left panel: What the principal entered */}
                  <div
                    className="lg:col-span-5 p-6 sm:p-7 rounded-[6px] border flex flex-col justify-between"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3.5 mb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <h3
                          className="text-[18px] font-bold"
                          style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          What the principal entered
                        </h3>
                        <span
                          className="text-xs font-mono font-medium px-2 py-0.5 rounded"
                          style={{ backgroundColor: '#ECE5D8', color: 'var(--color-text-primary)' }}
                        >
                          Practice Intake
                        </span>
                      </div>

                      <p className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-text-primary)' }}>
                        Home Counties mixed dental practice · 16 years established · 4 equipped surgeries
                      </p>

                      <div className="space-y-3.5 text-[15px]">
                        <div className="p-3 bg-white rounded-[4px] border" style={{ borderColor: 'var(--color-border)' }}>
                          <span className="text-xs uppercase tracking-wide block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Financial Baseline
                          </span>
                          <span className="font-semibold text-base" style={{ color: 'var(--color-text-primary)' }}>
                            Gross Fees: £1.45M · Adjusted EBITDA: £285K
                          </span>
                        </div>

                        <div className="p-3 bg-white rounded-[4px] border" style={{ borderColor: 'var(--color-border)' }}>
                          <span className="text-xs uppercase tracking-wide block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Revenue Stream Breakdown
                          </span>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            68% NHS GDS contract, 22% private fee-per-item, 10% monthly plan
                          </span>
                        </div>

                        <div className="p-3 bg-white rounded-[4px] border" style={{ borderColor: 'var(--color-border)' }}>
                          <span className="text-xs uppercase tracking-wide block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Principal Chair Dependency
                          </span>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            Principal personally generates &gt;45% of total practice fees
                          </span>
                        </div>

                        <div className="p-3 bg-white rounded-[4px] border" style={{ borderColor: 'var(--color-border)' }}>
                          <span className="text-xs uppercase tracking-wide block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Associate Governance
                          </span>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            Informal agreements with partial non-compete covenants
                          </span>
                        </div>

                        <div className="p-3 bg-white rounded-[4px] border" style={{ borderColor: 'var(--color-border)' }}>
                          <span className="text-xs uppercase tracking-wide block font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                            Surgery Utilisation
                          </span>
                          <span style={{ color: 'var(--color-text-primary)' }}>
                            Chair utilisation across Monday–Friday: about 65%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t text-xs text-left" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                      P&amp;L entered directly without PMS / software integrations.
                    </div>
                  </div>

                  {/* Right panel: What the report says */}
                  <div
                    className="lg:col-span-7 p-6 sm:p-8 rounded-[6px] border"
                    style={{
                      backgroundColor: '#FFFFFF',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div className="flex items-center justify-between pb-3.5 mb-5 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      <h3
                        className="text-[18px] font-bold"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        What the report says
                      </h3>
                      <span
                        className="text-xs font-mono font-medium px-2 py-0.5 rounded"
                        style={{ backgroundColor: '#FAF5EE', color: 'var(--color-accent)' }}
                      >
                        Valuation Report (£ GBP)
                      </span>
                    </div>

                    {/* Score Dial + Valuations */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mb-6 pb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
                      {/* Dial */}
                      <div className="sm:col-span-5 flex flex-col items-center justify-center p-3 rounded-[6px]" style={{ backgroundColor: 'var(--color-background)' }}>
                        <div className="relative w-24 h-24 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="38" fill="none" stroke="#E2DBD0" strokeWidth="8" />
                            <circle
                              cx="50"
                              cy="50"
                              r="38"
                              fill="none"
                              stroke="var(--color-accent)"
                              strokeWidth="8"
                              strokeDasharray="238.76"
                              strokeDashoffset={238.76 * (1 - 0.54)}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)' }}>
                              54
                            </span>
                            <span className="text-[10px] font-semibold text-gray-500">/ 100</span>
                          </div>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider mt-2" style={{ color: 'var(--color-text-primary)' }}>
                          BUYER-READINESS SCORE: 54 / 100
                        </span>
                      </div>

                      {/* Valuation Today vs Potential in GBP */}
                      <div className="sm:col-span-7 space-y-3">
                        <div className="p-3 rounded-[6px]" style={{ backgroundColor: 'var(--color-background)', border: '1px solid var(--color-border)' }}>
                          <span className="text-xs font-medium block uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
                            ESTIMATED PRACTICE VALUATION TODAY
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
                              £1.4M – £1.7M
                            </span>
                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--color-text-muted)' }}>
                              (4.8x–5.8x EBITDA)
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-[6px]" style={{ backgroundColor: '#FAF5EE', border: '1px solid #D6BC9E' }}>
                          <span className="text-xs font-semibold block uppercase tracking-wider" style={{ color: 'var(--color-accent)' }}>
                            POTENTIAL AT PREMIUM READINESS
                          </span>
                          <div className="flex items-baseline justify-between mt-1">
                            <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)' }}>
                              £2.5M – £3.1M
                            </span>
                            <span className="text-xs font-mono font-bold" style={{ color: 'var(--color-accent)' }}>
                              (8.5x–10.5x)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Top 3 Fixes */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--color-text-muted)' }}>
                        TOP 3 FIXES, RANKED BY POUND (£) IMPACT:
                      </h4>

                      <div className="space-y-4">
                        <div className="p-3.5 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                            <strong className="font-semibold">1. Transition clinical chairside hours to associates.</strong> Principal personally billing 45% of fees triggers punitive 3–5 year earn-out retentions. Recruit an associate and reduce chair time below 20%.{' '}
                            <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                              Est. impact: +£550K–£900K.
                            </span>
                          </p>
                        </div>

                        <div className="p-3.5 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                            <strong className="font-semibold">2. Convert private patients into monthly recurring plans.</strong> Corporates assign highest multiples to contracted Denplan/Practice Plan direct debits. Target 35%+ capitation.{' '}
                            <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                              Est. impact: +£350K–£650K.
                            </span>
                          </p>
                        </div>

                        <div className="p-3.5 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="text-[15px] leading-relaxed" style={{ color: 'var(--color-text-primary)' }}>
                            <strong className="font-semibold">3. Standardise associate contracts with BDA covenants.</strong> Informal agreements without 2–3 mile non-competes create goodwill flight risk during legal diligence.{' '}
                            <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                              Est. impact: +£200K–£350K in defended goodwill value.
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Email capture placement immediately after demo moment per spec */}
                <div
                  className="p-6 sm:p-8 rounded-[6px] border text-left"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    borderColor: 'var(--color-border)',
                  }}
                >
                  <div className="max-w-[720px] mb-4">
                    <span
                      className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-accent)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      Principal Early Access
                    </span>
                    <h3
                      className="text-xl sm:text-2xl font-bold mt-2 mb-1"
                      style={{
                        fontFamily: 'var(--font-heading)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      Get your own practice valuation report and fix list.
                    </h3>
                    <p className="text-sm sm:text-base" style={{ color: 'var(--color-text-muted)' }}>
                      You get our 12-point corporate buyer-readiness checklist by email now, and your full valuation report free when the dashboard opens, ahead of the paid list.
                    </p>
                  </div>

                  <div className="max-w-[560px]">
                    <CaptureForm source="Demo Moment" />
                  </div>
                </div>
              </div>
            </section>

            {/* 4. BENEFITS SECTION */}
            <section
              id="benefits"
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-background)',
                paddingTop: 'var(--section-py)',
                paddingBottom: 'var(--section-py)',
              }}
            >
              <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
                <h2
                  className="text-2xl sm:text-3xl lg:text-[32px] font-bold leading-[1.2] mb-12 text-left"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Built for UK dental practice principals planning their exit.
                </h2>

                {/* 6 bordered white cards, 3-column grid on desktop, 1-column on mobile */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Benefit 1 */}
                  <div
                    className="p-6 rounded-[6px] border text-left flex flex-col justify-start"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-5 border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <CircleDollarSign className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="text-[18px] font-semibold leading-[1.35] mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      See the multiple gap in pounds (£).
                    </h3>
                    <p
                      className="text-[15px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Not a grade — a pound range for your dental clinic today versus what it could command at premium corporate readiness.
                    </p>
                  </div>

                  {/* Benefit 2 */}
                  <div
                    className="p-6 rounded-[6px] border text-left flex flex-col justify-start"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-5 border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <ClipboardCheck className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="text-[18px] font-semibold leading-[1.35] mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Scored the way dental corporates score you.
                    </h3>
                    <p
                      className="text-[15px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      The 12 diligence checks mirror what Portman Dentex, Bupa, and Rodericks actually audit: capitation density, principal dependence, BDA covenants.
                    </p>
                  </div>

                  {/* Benefit 3 */}
                  <div
                    className="p-6 rounded-[6px] border text-left flex flex-col justify-start"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-5 border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <ListOrdered className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="text-[18px] font-semibold leading-[1.35] mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Fixes ranked by payoff.
                    </h3>
                    <p
                      className="text-[15px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Know whether shifting to Denplan, recruiting another associate, or expanding surgery utilisation moves your sale price more.
                    </p>
                  </div>

                  {/* Benefit 4 */}
                  <div
                    className="p-6 rounded-[6px] border text-left flex flex-col justify-start"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-5 border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <Calendar className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="text-[18px] font-semibold leading-[1.35] mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Years of runway, not 90 days.
                    </h3>
                    <p
                      className="text-[15px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Start while clinical handovers and contract transitions are still possible, not when a broker is already engaged.
                    </p>
                  </div>

                  {/* Benefit 5 */}
                  <div
                    className="p-6 rounded-[6px] border text-left flex flex-col justify-start"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-5 border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <FileText className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="text-[18px] font-semibold leading-[1.35] mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      A report your NASDAL accountant will respect.
                    </h3>
                    <p
                      className="text-[15px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Print it, share it, and walk into any dental broker or advisor meeting knowing your own EBITDA multiple first.
                    </p>
                  </div>

                  {/* Benefit 6 */}
                  <div
                    className="p-6 rounded-[6px] border text-left flex flex-col justify-start"
                    style={{
                      backgroundColor: 'var(--color-surface)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-[6px] flex items-center justify-center mb-5 border"
                      style={{
                        borderColor: 'var(--color-border)',
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      <TrendingUp className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <h3
                      className="text-[18px] font-semibold leading-[1.35] mb-2"
                      style={{ color: 'var(--color-text-primary)' }}
                    >
                      Track practice value monthly.
                    </h3>
                    <p
                      className="text-[15px] leading-[1.6]"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Re-score as surgeries expand and see practice equity climb line by line.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 5. PRICING SECTION IN GBP (£) */}
            <section
              id="pricing"
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-surface)',
                paddingTop: 'var(--section-py)',
                paddingBottom: 'var(--section-py)',
                borderTop: '1px solid var(--color-border)',
                borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
                <h2
                  className="text-2xl sm:text-3xl lg:text-[32px] font-bold leading-[1.2] mb-12 text-left"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Priced like an advisor retainer. Built for the long runway.
                </h2>

                {/* 3 bordered cards */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch text-left">
                  {/* Tier 1 — Readiness Starter */}
                  <div
                    className="p-6 sm:p-8 rounded-[6px] border flex flex-col justify-between"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div>
                      <h3
                        className="text-[20px] font-bold mb-2"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        Readiness Starter
                      </h3>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span
                          className="text-3xl font-bold"
                          style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          £199
                        </span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          / mo
                        </span>
                      </div>
                      <p className="text-sm mb-6 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Best for: practice principals 3–5 years out who want to know where their clinic stands.
                      </p>

                      <div className="pt-6 border-t space-y-3.5" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Quarterly practice valuation re-score</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Full corporate-readiness scorecard</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Top-3 fix list with pound (£) impact</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Email support from dental M&amp;A analysts</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <button
                        onClick={() => handleOpenCapture('Pricing Tier 1', 'Readiness Starter (£199/mo)')}
                        className="btn-secondary w-full"
                      >
                        Get my free valuation report
                      </button>
                    </div>
                  </div>

                  {/* Tier 2 — Exit Dashboard [Recommended] */}
                  <div
                    className="relative p-6 sm:p-8 rounded-[6px] flex flex-col justify-between"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '2px solid var(--color-accent)',
                      boxShadow: 'var(--card-shadow-recommended)',
                    }}
                  >
                    <div className="absolute -top-3 left-6">
                      <span
                        className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-[4px]"
                        style={{
                          backgroundColor: 'var(--color-accent)',
                          color: 'var(--color-text-on-accent)',
                        }}
                      >
                        Recommended
                      </span>
                    </div>

                    <div>
                      <h3
                        className="text-[20px] font-bold mb-2 mt-2"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        Exit Dashboard
                      </h3>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span
                          className="text-3xl font-bold"
                          style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          £499
                        </span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          / mo
                        </span>
                      </div>
                      <p className="text-sm mb-6 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Best for: principals planning to sell or take corporate equity within 2–3 years.
                      </p>

                      <div className="pt-6 border-t space-y-3.5" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-accent)' }} />
                          <span className="font-medium">Monthly valuation re-score and score tracking over time</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-accent)' }} />
                          <span>Full fix-it plan — every clinical gap ranked by pound impact</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-accent)' }} />
                          <span>Printable report for your NASDAL accountant or advisor</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-accent)' }} />
                          <span>Priority support with a response inside one business day</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <button
                        onClick={() => handleOpenCapture('Pricing Tier 2', 'Exit Dashboard (£499/mo)')}
                        className="btn-primary w-full"
                      >
                        Get my free valuation report
                      </button>
                    </div>
                  </div>

                  {/* Tier 3 — Pre-Sale Sprint */}
                  <div
                    className="p-6 sm:p-8 rounded-[6px] border flex flex-col justify-between"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                    }}
                  >
                    <div>
                      <h3
                        className="text-[20px] font-bold mb-2"
                        style={{
                          fontFamily: 'var(--font-heading)',
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        Pre-Sale Sprint
                      </h3>
                      <div className="flex items-baseline gap-1 mb-4">
                        <span
                          className="text-3xl font-bold"
                          style={{
                            fontFamily: 'var(--font-heading)',
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          £15,000
                        </span>
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                          one-time
                        </span>
                      </div>
                      <p className="text-sm mb-6 font-medium" style={{ color: 'var(--color-text-muted)' }}>
                        Best for: principals within 12 months of going to market with dental brokers.
                      </p>

                      <div className="pt-6 border-t space-y-3.5" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Everything in Exit Dashboard for 12 months</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Weekly one-on-one working sessions on your clinical and financial numbers</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Line-by-line review of associate contracts &amp; P&amp;L before any corporate sees them</span>
                        </div>
                        <div className="flex items-start gap-2.5 text-[15px]">
                          <Check className="w-4 h-4 flex-shrink-0 mt-1" style={{ color: 'var(--color-text-primary)' }} />
                          <span>Direct phone access through your due diligence and sale window</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      <button
                        onClick={() => handleOpenCapture('Pricing Tier 3', 'Pre-Sale Sprint (£15,000)')}
                        className="btn-secondary w-full"
                      >
                        Get my free valuation report
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. FAQ SECTION */}
            <section
              id="faq"
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-background)',
                paddingTop: 'var(--section-py)',
                paddingBottom: 'var(--section-py)',
              }}
            >
              <div className="mx-auto" style={{ maxWidth: '820px' }}>
                <h2
                  className="text-2xl sm:text-3xl lg:text-[32px] font-bold leading-[1.2] mb-10 text-left"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  Frequently asked questions
                </h2>

                <div className="divide-y text-left" style={{ borderColor: 'var(--color-border)' }}>
                  {/* Q1 */}
                  <div className="py-6">
                    <button
                      onClick={() => toggleFaq(0)}
                      className="w-full flex items-center justify-between gap-4 text-left group"
                    >
                      <span
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Is Valubuild available yet?
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          openFaqIndex === 0 ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </button>
                    {openFaqIndex === 0 && (
                      <p
                        className="mt-3 text-[17px] leading-[1.6]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Not yet — we're opening to a small group of founding practice principals first. Sign up now and you'll get our 12-point corporate buyer-readiness checklist right away, plus your full valuation report free when we open, before anyone pays a pound.
                      </p>
                    )}
                  </div>

                  {/* Q2 */}
                  <div className="py-6">
                    <button
                      onClick={() => toggleFaq(1)}
                      className="w-full flex items-center justify-between gap-4 text-left group"
                    >
                      <span
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        How can you value my dental clinic without seeing my books?
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          openFaqIndex === 1 ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </button>
                    {openFaqIndex === 1 && (
                      <p
                        className="mt-3 text-[17px] leading-[1.6]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        The report is built from your self-reported P&amp;L numbers and current UK dental M&amp;A comps — the same 4x–12x EBITDA multiple ranges corporate deal teams use. It's a strategic planning range, not an expensive formal appraisal, and it's the exact same math an acquirer runs before they send an exploratory letter.
                      </p>
                    )}
                  </div>

                  {/* Q3 */}
                  <div className="py-6">
                    <button
                      onClick={() => toggleFaq(2)}
                      className="w-full flex items-center justify-between gap-4 text-left group"
                    >
                      <span
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Who sees my practice financials and patient data?
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          openFaqIndex === 2 ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </button>
                    {openFaqIndex === 2 && (
                      <p
                        className="mt-3 text-[17px] leading-[1.6]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        You do. We do not access or store patient health records (no GDPR clinical data required). Your financial figures are never shared with corporate groups, dental brokers, or competitors. Nothing leaves your account unless you print the report yourself.
                      </p>
                    )}
                  </div>

                  {/* Q4 */}
                  <div className="py-6">
                    <button
                      onClick={() => toggleFaq(3)}
                      className="w-full flex items-center justify-between gap-4 text-left group"
                    >
                      <span
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Do I have to connect Software of Excellence (SOE) or R4?
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          openFaqIndex === 3 ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </button>
                    {openFaqIndex === 3 && (
                      <p
                        className="mt-3 text-[17px] leading-[1.6]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        No. You simply input high-level P&amp;L figures and answer 10 questions on surgeries, Denplan/NHS mix, and associate arrangements. Fifteen minutes, no IT integration, and zero system access required.
                      </p>
                    )}
                  </div>

                  {/* Q5 */}
                  <div className="py-6">
                    <button
                      onClick={() => toggleFaq(4)}
                      className="w-full flex items-center justify-between gap-4 text-left group"
                    >
                      <span
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        I'm not selling my practice for years. Why start now?
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          openFaqIndex === 4 ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </button>
                    {openFaqIndex === 4 && (
                      <p
                        className="mt-3 text-[17px] leading-[1.6]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Because the operational fixes that drive the multiple — converting patients to monthly Denplan direct debits, transitioning chairside hours to associates, and putting formal BDA agreements in place — take 18 to 24 months. Principals who wait until retirement age take whatever discount the corporate offers. Starting early is the whole point.
                      </p>
                    )}
                  </div>

                  {/* Q6 */}
                  <div className="py-6">
                    <button
                      onClick={() => toggleFaq(5)}
                      className="w-full flex items-center justify-between gap-4 text-left group"
                    >
                      <span
                        className="text-[18px] font-semibold leading-[1.35]"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Is £499 a month worth it for a dental practice?
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${
                          openFaqIndex === 5 ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'var(--color-text-muted)' }}
                      />
                    </button>
                    {openFaqIndex === 5 && (
                      <p
                        className="mt-3 text-[17px] leading-[1.6]"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        A single turn of EBITDA on a £350K-EBITDA dental clinic is £350,000. If following the fix list moves your practice multiple from 5.5x to 7.5x (or unlocks a cash sale instead of a 5-year earnout tie-in), the dashboard pays for itself hundreds of times over. And the initial valuation report is free before you decide.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 7. FINAL CTA */}
            <section
              className="px-4 sm:px-6"
              style={{
                backgroundColor: 'var(--color-text-primary)',
                color: '#FFFFFF',
                paddingTop: 'var(--section-py)',
                paddingBottom: 'var(--section-py)',
              }}
            >
              <div className="mx-auto text-center flex flex-col items-center" style={{ maxWidth: '820px' }}>
                <h2
                  className="text-2xl sm:text-3xl lg:text-[36px] font-bold leading-[1.25] mb-5 tracking-tight text-white"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  The spread between 4x and 12x is decided years before the sale — find out which side your practice is on.
                </h2>

                <p className="text-base sm:text-[17px] leading-[1.6] mb-8 text-[#DDD6CA] max-w-[60ch]">
                  Founding practice principals get the full valuation report free at launch, before paying anything.
                </p>

                <div className="w-full max-w-[540px]">
                  <CaptureForm source="Final CTA Band" />
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        className="w-full px-4 sm:px-6 py-12"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div
          className="mx-auto flex flex-col sm:flex-row items-center justify-between gap-6"
          style={{ maxWidth: 'var(--max-width)' }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 text-left">
            <Logo size={24} />
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              © 2026 Valubuild UK Ltd. Confidential practice valuation intelligence for British dental practice principals.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <button onClick={() => setActiveView('overview')} className="hover:underline">
              Overview
            </button>
            <button onClick={() => setActiveView('intake')} className="hover:underline">
              Practice Intake Form
            </button>
            <button onClick={() => setActiveView('market-comps')} className="hover:underline">
              Corporate Comps
            </button>
            <button onClick={() => setActiveView('benchmarks')} className="hover:underline">
              Local vs National
            </button>
            <button
              onClick={() => setShareKitOpen(true)}
              className="font-semibold hover:underline"
              style={{ color: 'var(--color-accent)' }}
            >
              Principal Share Kit
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CaptureModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        tierName={selectedTier}
        source={modalSource}
      />

      <ShareKitModal
        isOpen={shareKitOpen}
        onClose={() => setShareKitOpen(false)}
      />

      {/* Global Live Voice Valuation Advisor */}
      <LiveVoiceAdvisor intakeData={intakeData} report={valuationResult} />
    </div>
  );
}
