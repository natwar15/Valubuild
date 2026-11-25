import React, { useEffect, useState, useCallback } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Send,
  LogIn,
  FileSpreadsheet,
  Landmark,
  Receipt,
  Users,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { BankStandardValuationResult, DentalIntakeData } from '../types';

type DocCategory =
  | 'valuation_report'
  | 'accounts_report'
  | 'bank_statement'
  | 'nhs_schedule'
  | 'expenses_list'
  | 'payroll';

interface UploadedDocItem {
  id: number;
  docCategory: string;
  fileName: string;
  mimeType: string;
  extractedSummary: string;
  extractedMetricsJson: Record<string, unknown>;
  valuationImpactPointsJson: Array<{
    factor: string;
    direction: 'positive' | 'negative' | 'neutral';
    estimatedPoundImpact: string;
    explanation: string;
  }>;
  createdAt: string;
}

interface AdaptiveQuestionItem {
  id: number;
  questionText: string;
  rationale: string;
  category: string;
  impactArea: string;
  answerText: string | null;
  status: 'pending' | 'answered';
  createdAt: string;
}

interface DocumentIntelligenceHubProps {
  intakeData: DentalIntakeData;
  report: BankStandardValuationResult;
  activeReportId?: number | null;
  onValuationUpdated?: () => void;
}

const DOC_CATEGORIES: Array<{
  id: DocCategory;
  label: string;
  shortDesc: string;
  icon: React.ReactNode;
  sampleText: string;
  sampleName: string;
}> = [
  {
    id: 'valuation_report',
    label: 'Valuation Report',
    shortDesc: 'Existing broker or RICS Red Book valuation',
    icon: <FileText className="w-4 h-4" />,
    sampleName: 'sample-rics-valuation-excerpt.txt',
    sampleText: `CONFIDENTIAL PRACTICE VALUATION EXCERPT (UK MIXED DENTAL PRACTICE)
Surgeries: 4 operational surgeries, 1,750 sq ft NIA, 15-year FRI Lease at £28,500 pa.
Gross Fees FY25: £1,420,000 (NHS GDS: £890,000 across 24,500 UDAs @ £36.32; Private FPI: £360,000; Denplan Capitation: £170,000).
Fair Maintainable Operating Profit (FMOP / EBITDA): £278,000 (19.6% margin).
Adopted Multiplier: 6.75 YP -> MV1 Goodwill: £1,876,500 (Say £1,880,000).
Key Valuer Observations: Principal generates 38% of total gross fees; 2 associates operate on older non-BDA agreements without updated restrictive covenants. Dedicated HTM 01-05 decon room present; no CBCT scanner on site.`,
  },
  {
    id: 'accounts_report',
    label: 'Accounts Report',
    shortDesc: 'Annual P&L, management accounts, EBITDA add-backs',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    sampleName: 'fy25-management-accounts.csv',
    sampleText: `Line Item,FY24 (£),FY25 (£)
NHS GDS Contract Income,865000,892000
Private Fee-Per-Item,310000,375000
Denplan Monthly Plan Income,142000,198000
Total Turnover,1317000,1465000
Dental Materials & Lab Fees,-218000,-244000
Associate & Hygienist Fees,-514000,-568000
Staff Wages & Employer NI,-196000,-228000
Premises Rent & Rates,-36000,-38500
Repairs CQC Insurance & Utilities,-79000,-86500
Operating Profit (EBITDA),274000,300000
Note: Director personal motor & one-off surgery refurbishment of £24,000 included inside repairs.`,
  },
  {
    id: 'bank_statement',
    label: 'Bank Accounts / Cashflow',
    shortDesc: 'Monthly operating inflows, debt service & liquidity',
    icon: <Landmark className="w-4 h-4" />,
    sampleName: 'q1-business-bank-cashflow.csv',
    sampleText: `Date,Description,Category,Amount (£)
2026-01-02,NHS BSA Compass Monthly Schedule,NHS Inflow,74333
2026-01-05,Denplan Monthly Capitation Settlement,Plan Inflow,17250
2026-01-14,Card Merchant PDQ Private Receipts,Private Inflow,31800
2026-01-25,Staff Payroll & HMRC PAYE/NI,Payroll,-19450
2026-01-28,Associate Monthly Fee Transfers (3 Clinicians),Associate Fees,-46900
2026-01-29,Dental Sky & Henry Schein Consumables,Materials,-12400
2026-01-30,Commercial Practice Loan & Asset Finance,Debt Service,-8200
2026-01-31,Closing Operating Account Balance,Cash Balance,148600`,
  },
  {
    id: 'nhs_schedule',
    label: 'NHS Schedules (Compass)',
    shortDesc: 'UDA target, delivered UDAs, clawback & performer splits',
    icon: <Stethoscope className="w-4 h-4" />,
    sampleName: 'nhs-compass-uda-schedule.txt',
    sampleText: `NHS BSA COMPASS CONTRACT PERFORMANCE SUMMARY (2025/26)
Contract Number: Redacted | Region: Yorkshire & Humber
Annual Contracted UDAs: 24,500 UDAs | Contract Value: £892,000 (£36.41 per UDA)
Year-to-Date Delivery (Month 10): 19,110 UDAs (93.6% pro-rata run rate)
Projected Year-End Delivery: 22,930 UDAs (93.6% — below 96% tolerance threshold)
Estimated Clawback Exposure: £57,160 unless 1,100 UDAs recovered via therapist sessions
Performer Split: Principal 6,200 UDAs | Associate A 8,400 UDAs | Associate B 6,800 UDAs | Vacant Slot 3,100 UDAs.`,
  },
  {
    id: 'expenses_list',
    label: 'Expenses List',
    shortDesc: 'Labs, consumables, rent, utilities, software & CQC',
    icon: <Receipt className="w-4 h-4" />,
    sampleName: 'annual-operating-expenses.csv',
    sampleText: `Expense Category,Annual Cost (£),Notes
Dental Consumables (Henry Schein/DD),128500,8.8% of turnover
External Dental Laboratory Bills,115500,7.9% of turnover (crown & aligner labs)
Premises Rent (Leasehold),32000,7 years remaining on 15yr FRI lease
Utilities & Clinical Waste,16400,Fixed tariff ending Oct 2026
Software (SOE Exact & Denplan Admin),14200,Cloud PMS migrated
CQC Registration & Indemnity,11800,Last CQC inspection Good (2024)
Equipment Maintenance & Decontamination,15600,Autoclave service contract active`,
  },
  {
    id: 'payroll',
    label: 'Payrolls',
    shortDesc: 'Nurses, practice manager, reception, NI & pension',
    icon: <Users className="w-4 h-4" />,
    sampleName: 'practice-payroll-summary.csv',
    sampleText: `Role,Headcount,Annual Gross (£),Employer NI & Pension (£),Status
Practice Manager (Full-Time),1,42000,6720,Permanent 6 yrs tenure
Lead Dental Nurse / Decon Lead,1,30500,4580,GDC Registered
Qualified Dental Nurses,4,104000,15100,2 full-time / 2 part-time
Reception & Treatment Coordinator,2,46000,6350,TCO drives private plan signups
Locum Agency Nurse Spend (YTD),0,18400,0,High agency spend covering maternity leave
Total Annual Staff Payroll Cost,8,240900,32750,18.7% of Gross Fees`,
  },
];

export const DocumentIntelligenceHub: React.FC<DocumentIntelligenceHubProps> = ({
  intakeData,
  report,
  activeReportId,
  onValuationUpdated,
}) => {
  const { firebaseUser, signInWithGoogle } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<DocCategory>('accounts_report');
  const [fileName, setFileName] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('text/plain');
  const [textContent, setTextContent] = useState<string>('');
  const [fileBase64, setFileBase64] = useState<string | null>(null);

  const [documents, setDocuments] = useState<UploadedDocItem[]>([]);
  const [questions, setQuestions] = useState<AdaptiveQuestionItem[]>([]);
  const [answerDrafts, setAnswerDrafts] = useState<Record<number, string>>({});
  const [latestPointers, setLatestPointers] = useState<
    Array<{
      id: string;
      title: string;
      detail: string;
      category: string;
      estimatedImpactGbp: string;
      priority: string;
    }>
  >([]);

  const [analyzing, setAnalyzing] = useState(false);
  const [answeringId, setAnsweringId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      const [docRes, qRes] = await Promise.all([
        apiFetch<{ documents: UploadedDocItem[] }>('/api/documents'),
        apiFetch<{ questions: AdaptiveQuestionItem[] }>('/api/questions'),
      ]);
      setDocuments(docRes.documents || []);
      setQuestions(qRes.questions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load document intelligence data.');
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      setError('File size must be under 6 MB.');
      return;
    }

    setError(null);
    setFileName(file.name);
    setMimeType(file.type || 'text/plain');

    if (
      file.type.startsWith('text/') ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.json')
    ) {
      const reader = new FileReader();
      reader.onload = () => {
        setTextContent(String(reader.result || ''));
        setFileBase64(null);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        const resultStr = String(reader.result || '');
        const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        setFileBase64(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoadSample = (catId: DocCategory) => {
    const meta = DOC_CATEGORIES.find((c) => c.id === catId);
    if (!meta) return;
    setSelectedCategory(catId);
    setFileName(meta.sampleName);
    setMimeType('text/plain');
    setTextContent(meta.sampleText);
    setFileBase64(null);
    setError(null);
  };

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (!textContent.trim() && !fileBase64) {
      setError('Upload a file, paste text, or load a sample document first.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setFeedback(null);

    try {
      const res = await apiFetch<{
        document: UploadedDocItem;
        questions: AdaptiveQuestionItem[];
        individualisedPointers: Array<{
          id: string;
          title: string;
          detail: string;
          category: string;
          estimatedImpactGbp: string;
          priority: string;
        }>;
      }>('/api/ai/analyze-document', {
        method: 'POST',
        body: JSON.stringify({
          docCategory: selectedCategory,
          fileName: fileName || `${selectedCategory}.txt`,
          mimeType,
          textContent: textContent.trim() || undefined,
          fileBase64: fileBase64 || undefined,
          reportId: activeReportId ?? undefined,
          currentPracticeContext: {
            practiceName: intakeData.practiceName,
            practiceType: intakeData.practiceType,
            region: intakeData.region,
            surgeriesCount: intakeData.surgeriesCount,
            turnover: intakeData.turnover,
            fmop: report.fmop,
            ypMultiple: report.ypMultiplierAdopted,
            mv1Goodwill: report.mv1MarketValueGoodwill,
            buyerReadinessScore: report.buyerReadinessScore,
          },
        }),
      });

      setLatestPointers(res.individualisedPointers || []);
      setFeedback(
        `Analysed "${res.document.fileName}" — identified ${res.document.valuationImpactPointsJson.length} valuation drivers and generated ${res.questions.length} adaptive diligence questions.`
      );
      setTextContent('');
      setFileBase64(null);
      setFileName('');
      await loadData();
      onValuationUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Document analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAnswerQuestion = async (questionId: number) => {
    const answerText = (answerDrafts[questionId] || '').trim();
    if (!answerText) return;

    setAnsweringId(questionId);
    setError(null);
    setFeedback(null);

    try {
      const res = await apiFetch<{
        valuationRefinementNote: string;
        scoreDelta: number;
        ypDelta: number;
      }>('/api/ai/answer-question', {
        method: 'POST',
        body: JSON.stringify({ questionId, answerText }),
      });

      setFeedback(
        `Valuation refined (${res.scoreDelta >= 0 ? '+' : ''}${res.scoreDelta} score pts, ${
          res.ypDelta >= 0 ? '+' : ''
        }${res.ypDelta} YP): ${res.valuationRefinementNote}`
      );
      setAnswerDrafts((prev) => ({ ...prev, [questionId]: '' }));
      await loadData();
      onValuationUpdated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit answer.');
    } finally {
      setAnsweringId(null);
    }
  };

  const pendingQuestions = questions.filter((q) => q.status === 'pending');
  const answeredQuestions = questions.filter((q) => q.status === 'answered');

  return (
    <div className="space-y-8 text-left">
      {/* Header */}
      <div className="bg-white border rounded-[6px] p-6 sm:p-8" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-6 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#FAF5EE] text-[#A6521C] border border-[#D6BC9E]">
              Financial Evidence &amp; Adaptive Question Engine
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mt-2 text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              Ingest Accounts, Bank Cashflow, NHS Schedules, Expenses &amp; Payrolls
            </h2>
            <p className="text-sm text-[#6B6459] mt-1 max-w-3xl">
              Upload valuation reports or core financial schedules. Our valuation engine extracts pound-level impact drivers, delivers individualised pointers, and automatically develops a tailored question dataset that sharpens your practice valuation as you respond.
            </p>
          </div>
          {!firebaseUser && (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="btn-primary !py-2.5 !px-4 text-xs flex items-center gap-2 whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              Sign In to Analyse Documents
            </button>
          )}
        </div>

        {/* 6 Document Category Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
          {DOC_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`p-3.5 rounded-[6px] border cursor-pointer transition-all flex flex-col justify-between ${
                  active
                    ? 'bg-[#FAF5EE] border-[#A6521C]'
                    : 'bg-[#FAF8F4] border-[#E2DBD0] hover:border-[#C9C1B4]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#26231E]">
                    <span className={active ? 'text-[#A6521C]' : 'text-[#6B6459]'}>{cat.icon}</span>
                    {cat.label}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadSample(cat.id);
                    }}
                    className="text-[11px] font-semibold underline text-[#A6521C] hover:text-[#26231E]"
                  >
                    Load sample
                  </button>
                </div>
                <p className="text-xs text-[#6B6459] mt-1">{cat.shortDesc}</p>
              </div>
            );
          })}
        </div>

        {/* Upload / Paste Form */}
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-4">
              <label className="block text-xs font-bold uppercase text-[#6B6459] mb-1.5">
                Upload File (PDF, CSV, TXT, Image)
              </label>
              <label
                className="flex flex-col items-center justify-center h-[132px] border-2 border-dashed rounded-[6px] cursor-pointer bg-[#FAF8F4] hover:bg-[#FAF5EE] transition-colors px-4 text-center"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Upload className="w-5 h-5 text-[#A6521C] mb-1.5" />
                <span className="text-xs font-semibold text-[#26231E]">
                  {fileName || 'Choose practice document'}
                </span>
                <span className="text-[11px] text-[#6B6459] mt-0.5">
                  Max 6 MB · Private to your account
                </span>
                <input
                  type="file"
                  accept=".pdf,.csv,.txt,.json,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <div className="md:col-span-8">
              <label className="block text-xs font-bold uppercase text-[#6B6459] mb-1.5">
                Or Paste Report / Schedule Excerpt ({DOC_CATEGORIES.find((c) => c.id === selectedCategory)?.label})
              </label>
              <textarea
                rows={5}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Paste figures from your annual accounts, bank cashflow statement, NHS Compass UDA schedule, expenses list, payroll summary, or broker valuation report..."
                className="w-full p-3 text-xs font-mono rounded-[6px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#6B6459]">
              {fileBase64 ? `Binary file attached (${mimeType}) ready for extraction.` : 'Extracted metrics refine your valuation drivers and generate tailored follow-up questions.'}
            </span>
            <button
              type="submit"
              disabled={!firebaseUser || analyzing}
              className="btn-primary !py-2.5 !px-5 text-xs flex items-center gap-2 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {analyzing ? 'Extracting Valuation Drivers & Building Questions...' : 'Analyse Document & Develop Questions'}
            </button>
          </div>
        </form>

        {feedback && (
          <div className="mt-4 p-3.5 rounded-[6px] bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{feedback}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3.5 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Latest Individualised Pointers */}
        {latestPointers.length > 0 && (
          <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#A6521C] mb-3">
              Newly Generated Individualised Valuation Pointers
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {latestPointers.map((pt, idx) => (
                <div key={pt.id || idx} className="p-4 rounded-[6px] border bg-[#FAF5EE]" style={{ borderColor: '#D6BC9E' }}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-sm font-bold text-[#26231E]">{pt.title}</span>
                    <span className="text-xs font-mono font-bold text-[#A6521C] whitespace-nowrap">
                      {pt.estimatedImpactGbp}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6459] leading-relaxed">{pt.detail}</p>
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-mono text-[#6B6459]">
                    <span>{pt.category}</span>
                    <span>•</span>
                    <span>Priority: {pt.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ADAPTIVE QUESTION DATASET */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border rounded-[6px] p-6 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <h3 className="text-lg font-bold text-[#26231E] flex items-center gap-2" style={{ fontFamily: 'var(--font-heading)' }}>
                <HelpCircle className="w-5 h-5 text-[#A6521C]" />
                Adaptive Valuation Question Dataset
              </h3>
              <p className="text-xs text-[#6B6459]">
                Questions auto-developed from your uploaded documents. Each answer recalibrates your valuation and generates deeper follow-ups.
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-[#FAF5EE] text-[#A6521C] border border-[#D6BC9E]">
              {pendingQuestions.length} Open · {answeredQuestions.length} Answered
            </span>
          </div>

          {!firebaseUser ? (
            <p className="text-xs text-[#6B6459] py-6">
              Sign in and analyse any financial document to auto-generate your personalised diligence question dataset.
            </p>
          ) : pendingQuestions.length === 0 && answeredQuestions.length === 0 ? (
            <p className="text-xs text-[#6B6459] py-6">
              No adaptive questions yet. Load a sample Accounts Report, NHS Schedule, or Payroll above and click Analyse to build your first question set.
            </p>
          ) : (
            <div className="space-y-4">
              {pendingQuestions.map((q) => (
                <div key={q.id} className="p-4 rounded-[6px] border bg-[#FAF8F4] space-y-2.5" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span className="px-2 py-0.5 rounded bg-[#26231E] text-white uppercase">{q.category}</span>
                    <span className="text-[#A6521C] font-semibold">Impact: {q.impactArea}</span>
                  </div>
                  <p className="text-sm font-bold text-[#26231E]">{q.questionText}</p>
                  <p className="text-xs text-[#6B6459] italic">Why buyers ask: {q.rationale}</p>

                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={answerDrafts[q.id] || ''}
                      onChange={(e) =>
                        setAnswerDrafts((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Enter your clinic-specific answer to refine valuation..."
                      className="flex-1 px-3 py-2 text-xs rounded-[4px] border bg-white text-[#26231E]"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                    <button
                      type="button"
                      disabled={answeringId === q.id || !(answerDrafts[q.id] || '').trim()}
                      onClick={() => handleAnswerQuestion(q.id)}
                      className="btn-primary !py-2 !px-3.5 text-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      {answeringId === q.id ? 'Refining...' : 'Submit'}
                    </button>
                  </div>
                </div>
              ))}

              {answeredQuestions.length > 0 && (
                <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--color-border)' }}>
                  <span className="text-xs font-bold uppercase text-[#6B6459] block">
                    Answered Diligence Record ({answeredQuestions.length})
                  </span>
                  {answeredQuestions.slice(0, 6).map((q) => (
                    <div key={q.id} className="p-3 rounded-[4px] border bg-emerald-50/40 border-emerald-200 text-xs">
                      <p className="font-semibold text-[#26231E]">{q.questionText}</p>
                      <p className="text-emerald-800 mt-1">
                        <strong>Answer:</strong> {q.answerText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ANALYSED DOCUMENT ARCHIVE */}
        <div className="lg:col-span-5 bg-white border rounded-[6px] p-6 space-y-4" style={{ borderColor: 'var(--color-border)' }}>
          <div className="pb-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="text-lg font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              Analysed Practice Documents ({documents.length})
            </h3>
            <p className="text-xs text-[#6B6459]">
              Audit trail of extracted valuation drivers across your uploaded schedules.
            </p>
          </div>

          {documents.length === 0 ? (
            <p className="text-xs text-[#6B6459] py-6">
              Uploaded valuation reports, accounts, bank statements, NHS schedules, expenses, and payroll analyses will appear here.
            </p>
          ) : (
            <div className="space-y-4 max-h-[580px] overflow-y-auto pr-1">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-[6px] border bg-[#FAF8F4] space-y-2.5" style={{ borderColor: 'var(--color-border)' }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#26231E] truncate">{doc.fileName}</span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-white border text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                      {doc.docCategory.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B6459] leading-relaxed">{doc.extractedSummary}</p>

                  {doc.valuationImpactPointsJson && doc.valuationImpactPointsJson.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                      {doc.valuationImpactPointsJson.map((pt, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs bg-white p-2 rounded border" style={{ borderColor: 'var(--color-border)' }}>
                          {pt.direction === 'positive' ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700 flex-shrink-0 mt-0.5" />
                          ) : pt.direction === 'negative' ? (
                            <ArrowDownRight className="w-3.5 h-3.5 text-red-700 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Minus className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-[#26231E]">{pt.factor}</span>
                              <span className="font-mono font-bold text-[#A6521C]">{pt.estimatedPoundImpact}</span>
                            </div>
                            <p className="text-[11px] text-[#6B6459] mt-0.5">{pt.explanation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
