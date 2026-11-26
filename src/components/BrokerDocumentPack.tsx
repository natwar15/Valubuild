import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  LogIn,
  Lock,
  PencilLine,
  Plus,
  Stethoscope,
  Trash2,
  Upload,
  Users,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import { DentalIntakeData } from '../types';
import { DEFAULT_QUICK_SCHEDULE } from './QuickPracticeInfoSheet';
import {
  applyIntakeChanges,
  BROKER_DOC_GUIDE,
  BROKER_DOC_TYPES,
  BrokerDocType,
  BrokerExtraction,
  ClinicianIncomeFigures,
  ClinicianIncomeRow,
  DocumentEvidence,
  FieldChange,
  proposeIntakeChanges,
} from '../shared/brokerDocuments';

interface Props {
  current: DentalIntakeData;
  onApply: (data: DentalIntakeData) => void;
}

type DocStatus = 'todo' | 'reading' | 'ready' | 'not_applicable';

interface DocState {
  status: DocStatus;
  source?: 'upload' | 'manual';
  figures?: BrokerExtraction['figures'];
  fileName?: string;
  error?: string;
  editing?: boolean;
}

const ICONS: Record<BrokerDocType, React.ReactNode> = {
  accounts: <FileSpreadsheet className="w-4 h-4" />,
  nhs_schedule: <Stethoscope className="w-4 h-4" />,
  clinician_income: <Users className="w-4 h-4" />,
  plan_schedule: <WalletCards className="w-4 h-4" />,
};

type NumField = { key: string; label: string; hint?: string };

const ACCOUNT_FIELDS: NumField[] = [
  { key: 'turnover', label: 'Turnover / total fees' },
  { key: 'materialsCost', label: 'Materials' },
  { key: 'labCost', label: 'Lab fees' },
  { key: 'clinicalFees', label: 'Associate, hygienist & therapist fees' },
  { key: 'staffWages', label: 'Staff wages (excl. directors)', hint: 'Incl. employer NI & pension' },
  { key: 'ownerRemuneration', label: 'Directors\' / partners\' pay', hint: 'Salary, NI & pension; added back' },
  { key: 'rent', label: 'Rent' },
  { key: 'depreciation', label: 'Depreciation' },
  { key: 'amortisation', label: 'Goodwill amortisation' },
  { key: 'interest', label: 'Interest payable' },
  { key: 'oneOffCosts', label: 'One-off costs', hint: 'e.g. a refit; added back' },
  { key: 'profitBeforeTax', label: 'Profit before tax / net profit' },
  { key: 'periodMonths', label: 'Months covered', hint: 'Usually 12' },
];
const NHS_FIELDS: NumField[] = [
  { key: 'annualContractValue', label: 'Annual contract value' },
  { key: 'contractedUdas', label: 'Contracted UDAs' },
  { key: 'udasDeliveredYtd', label: 'UDAs delivered so far this year' },
  { key: 'monthsElapsed', label: 'Months of the year so far' },
  { key: 'clawback', label: 'Clawback shown (if any)' },
];
const PLAN_FIELDS: NumField[] = [
  { key: 'patientCount', label: 'Patients on the plan' },
  { key: 'averageMonthlyFee', label: 'Average monthly fee' },
  { key: 'monthlyIncome', label: 'Gross monthly plan income' },
];

const MONEY_FIELDS = new Set<string>([
  'turnover', 'nhsAnnualValue', 'privateFpiTurnover', 'privatePlanTurnover', 'staffWagesPa', 'adjustedEbitda',
  'passingRentPa', 'clawbackAmount',
]);
const PCT_FIELDS = new Set<string>(['materialsAndLabCostPercent', 'directAssociateTherapistCostPercent']);

function formatValue(field: string, v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'number') {
    if (MONEY_FIELDS.has(field)) return `£${Math.round(v).toLocaleString('en-GB')}`;
    if (PCT_FIELDS.has(field)) return `${v}%`;
    if (field === 'udaRate') return `£${v.toFixed(2)}`;
    return v.toLocaleString('en-GB');
  }
  if (v === 'owner_operated') return 'Owner-operated';
  if (v === 'associate_led') return 'Associate-led';
  return String(v);
}

function readFile(file: File): Promise<{ textContent?: string; fileBase64?: string; mimeType: string }> {
  const isText = file.type.startsWith('text/') || /\.(csv|txt|json)$/i.test(file.name);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const result = String(reader.result || '');
      if (isText) resolve({ textContent: result, mimeType: 'text/plain' });
      else resolve({ fileBase64: result.includes(',') ? result.split(',')[1] : result, mimeType: file.type || 'application/pdf' });
    };
    if (isText) reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

const emptyFigures = (t: BrokerDocType): BrokerExtraction['figures'] =>
  t === 'clinician_income'
    ? { clinicians: [{ role: 'Principal' }, { role: 'Associate' }] }
    : {};

const NumInput: React.FC<{ value: unknown; onChange: (v: number | null) => void; label: string; hint?: string }> = ({
  value,
  onChange,
  label,
  hint,
}) => (
  <label className="block">
    <span className="block text-[11px] font-semibold text-[#26231E] mb-1">{label}</span>
    <input
      type="number"
      inputMode="decimal"
      value={typeof value === 'number' ? value : ''}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-full px-3 py-2 rounded-[4px] border text-sm bg-white outline-none focus:border-[#A6521C]"
      style={{ borderColor: 'var(--color-border)' }}
    />
    {hint && <span className="block text-[10px] text-[#6B6459] mt-0.5">{hint}</span>}
  </label>
);

export const BrokerDocumentPack: React.FC<Props> = ({ current, onApply }) => {
  const { firebaseUser, requestSignIn } = useAuth();
  const [docs, setDocs] = useState<Record<BrokerDocType, DocState>>({
    accounts: { status: 'todo' },
    nhs_schedule: { status: current.practiceType === 'Private Practice' || current.practiceType === 'Specialist Practice' ? 'not_applicable' : 'todo' },
    clinician_income: { status: 'todo' },
    plan_schedule: { status: 'todo' },
  });
  const [keepCopy, setKeepCopy] = useState(false);
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<string | null>(null);

  const update = (t: BrokerDocType, patch: Partial<DocState>) => {
    setApplied(null);
    setDocs((d) => ({ ...d, [t]: { ...d[t], ...patch } }));
  };
  const setFigure = (t: BrokerDocType, key: string, v: unknown) =>
    setDocs((d) => ({ ...d, [t]: { ...d[t], figures: { ...(d[t].figures ?? emptyFigures(t)), [key]: v } } }));

  const extractions: BrokerExtraction[] = useMemo(
    () =>
      BROKER_DOC_TYPES.filter((t) => docs[t].status === 'ready' && docs[t].figures).map(
        (t) => ({ docType: t, figures: docs[t].figures }) as BrokerExtraction,
      ),
    [docs],
  );
  const proposal = useMemo(
    () => proposeIntakeChanges(current, extractions, DEFAULT_QUICK_SCHEDULE),
    [current, extractions],
  );

  const handleUpload = async (t: BrokerDocType, file: File | undefined) => {
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) return update(t, { error: 'File must be under 6 MB.' });
    if (!firebaseUser) {
      requestSignIn();
      return;
    }
    update(t, { status: 'reading', error: undefined, fileName: file.name });
    try {
      const payload = await readFile(file);
      const res = await apiFetch<{ extraction: BrokerExtraction }>('/api/broker-docs/extract', {
        method: 'POST',
        body: JSON.stringify({ docType: t, fileName: file.name, keepCopy, ...payload }),
      });
      update(t, { status: 'ready', source: 'upload', figures: res.extraction.figures, editing: true });
    } catch (err) {
      update(t, {
        status: 'todo',
        error: err instanceof Error ? err.message : 'Could not read that document. You can enter the figures yourself.',
      });
    }
  };

  const handleApply = () => {
    const now = new Date().toISOString();
    const evidence: DocumentEvidence[] = BROKER_DOC_TYPES.filter((t) => docs[t].status === 'ready' || docs[t].status === 'not_applicable').map(
      (t) => {
        const f = docs[t].figures as Record<string, unknown> | undefined;
        const period = (f?.periodEnd ?? f?.financialYear) as string | undefined;
        return {
          docType: t,
          source: docs[t].status === 'not_applicable' ? 'not_applicable' : docs[t].source ?? 'manual',
          ...(period ? { period } : {}),
          appliedAt: now,
        };
      },
    );
    const accepted = new Set(
      proposal.changes.map((c) => c.field).filter((f) => !rejected.has(f)),
    ) as Set<FieldChange['field']>;
    const next = applyIntakeChanges(current, extractions, DEFAULT_QUICK_SCHEDULE, accepted, evidence);
    onApply(next);
    setApplied(`${accepted.size} figures applied. The valuation below has been recalculated.`);
  };

  const done = BROKER_DOC_TYPES.filter((t) => docs[t].status === 'ready' || docs[t].status === 'not_applicable').length;

  return (
    <div className="space-y-6">
      <div className="rounded-[6px] border p-4 bg-[#FAF8F4] text-sm text-[#26231E]" style={{ borderColor: 'var(--color-border)' }}>
        <p className="font-semibold">The four documents a broker asks for</p>
        <p className="text-[#6B6459] mt-1">
          Upload each one and we'll read the figures for you, or type them in. You check every figure before it goes into
          the valuation. {done} of 4 done.
        </p>
        <div className="flex items-start gap-2 mt-3 text-xs text-[#6B6459]">
          <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-[#A6521C]" />
          <span>
            Documents are read and then discarded: we keep only the figures you apply, with your private report. They are
            never added to the anonymised pool. Clinicians are labelled by role, not name.
          </span>
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs text-[#26231E] cursor-pointer">
          <input type="checkbox" checked={keepCopy} onChange={(e) => setKeepCopy(e.target.checked)} />
          Keep a private copy of documents I upload (you can delete them at any time)
        </label>
        {!firebaseUser && (
          <button type="button" onClick={() => requestSignIn()} className="btn-primary !py-2 !px-3 text-xs mt-3 inline-flex items-center gap-2">
            <LogIn className="w-3.5 h-3.5" /> Sign in to upload documents (typing figures in works without an account)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {BROKER_DOC_TYPES.map((t) => {
          const g = BROKER_DOC_GUIDE[t];
          const d = docs[t];
          const showForm = d.editing || (d.status === 'ready' && d.source === 'manual');
          return (
            <div key={t} className="rounded-[6px] border bg-white p-4 flex flex-col gap-3" style={{ borderColor: d.status === 'ready' ? '#A6521C' : 'var(--color-border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm text-[#26231E]">
                  <span className="text-[#A6521C]">{ICONS[t]}</span>
                  {g.title}
                  {g.optional && <span className="text-[10px] font-normal text-[#6B6459]">(if applicable)</span>}
                </div>
                {d.status === 'ready' && <CheckCircle2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />}
              </div>
              <p className="text-xs text-[#6B6459]">{g.what}</p>
              <p className="text-[11px] text-[#6B6459]"><span className="font-semibold text-[#26231E]">Where to get it: </span>{g.where}</p>
              <p className="text-[11px] text-[#6B6459]"><span className="font-semibold text-[#26231E]">Fills: </span>{g.fills.join(', ')}</p>

              {d.status === 'not_applicable' ? (
                <div className="text-xs text-[#6B6459] flex items-center justify-between">
                  Marked as not applicable.
                  <button type="button" className="underline text-[#A6521C]" onClick={() => update(t, { status: 'todo' })}>Undo</button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <label className={`text-xs font-semibold px-3 py-2 rounded-[4px] border inline-flex items-center gap-1.5 cursor-pointer ${d.status === 'reading' ? 'opacity-60 pointer-events-none' : ''}`} style={{ borderColor: '#D6BC9E', backgroundColor: '#FAF5EE', color: 'var(--color-accent)' }}>
                    {d.status === 'reading' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {d.status === 'reading' ? 'Reading…' : d.source === 'upload' ? 'Upload a different file' : 'Upload (PDF, CSV, image)'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.csv,.txt,image/*,application/pdf,text/csv,text/plain"
                      onChange={(e) => {
                        handleUpload(t, e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                  </label>
                  {!showForm && (
                    <button type="button" className="text-xs font-semibold px-3 py-2 rounded-[4px] border inline-flex items-center gap-1.5 bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}
                      onClick={() => update(t, { status: 'ready', source: 'manual', figures: d.figures ?? emptyFigures(t), editing: true })}>
                      <PencilLine className="w-3.5 h-3.5" /> Enter figures myself
                    </button>
                  )}
                  {g.optional && (
                    <button type="button" className="text-xs underline text-[#6B6459]" onClick={() => update(t, { status: 'not_applicable', editing: false })}>
                      Not applicable
                    </button>
                  )}
                  {d.status === 'ready' && (
                    <button type="button" className="text-xs underline text-[#6B6459]" onClick={() => update(t, { status: 'todo', figures: undefined, source: undefined, editing: false, fileName: undefined })}>
                      Clear
                    </button>
                  )}
                </div>
              )}
              {d.error && (
                <p className="text-xs text-red-700 flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{d.error}</p>
              )}
              {d.status === 'ready' && d.source === 'upload' && (
                <p className="text-[11px] text-[#6B6459]">
                  Read from <span className="font-mono">{d.fileName}</span>. Check the figures and correct anything we misread.
                </p>
              )}
              {showForm && d.status === 'ready' && (
                <DocFigureForm docType={t} figures={d.figures ?? emptyFigures(t)} setFigure={(k, v) => setFigure(t, k, v)} />
              )}
            </div>
          );
        })}
      </div>

      {extractions.length > 0 && (
        <div className="rounded-[6px] border bg-white p-4 sm:p-5" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>Review before applying</h3>
          {proposal.facts.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {proposal.facts.map((f) => (
                <span key={f.label} className="text-[11px] px-2 py-1 rounded bg-[#FAF8F4] border" style={{ borderColor: 'var(--color-border)' }}>
                  {f.label}: <span className="font-semibold">{f.value}</span>
                </span>
              ))}
            </div>
          )}
          {proposal.warnings.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {proposal.warnings.map((w) => (
                <li key={w} className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 flex gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{w}
                </li>
              ))}
            </ul>
          )}
          {proposal.changes.length === 0 ? (
            <p className="text-xs text-[#6B6459] mt-3">Every figure from these documents is already in your valuation.</p>
          ) : (
          <div className="overflow-x-auto mt-3">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[#6B6459] border-b" style={{ borderColor: 'var(--color-border)' }}>
                  <th className="py-2 pr-2">Use</th>
                  <th className="py-2 pr-2">Field</th>
                  <th className="py-2 pr-2">Now</th>
                  <th className="py-2 pr-2">From documents</th>
                  <th className="py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {proposal.changes.map((c) => (
                  <tr key={c.field} className="border-b align-top" style={{ borderColor: 'var(--color-border)' }}>
                    <td className="py-2 pr-2">
                      <input
                        type="checkbox"
                        aria-label={`Use ${c.label}`}
                        checked={!rejected.has(c.field)}
                        onChange={(e) =>
                          setRejected((r) => {
                            const n = new Set(r);
                            if (e.target.checked) n.delete(c.field);
                            else n.add(c.field);
                            return n;
                          })
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 font-semibold text-[#26231E]">
                      {c.label}
                      {c.note && <span className="block font-normal text-[10px] text-[#6B6459]">{c.note}</span>}
                    </td>
                    <td className="py-2 pr-2 font-mono text-[#6B6459]">{formatValue(c.field, c.from)}</td>
                    <td className="py-2 pr-2 font-mono font-bold text-[#A6521C]">{formatValue(c.field, c.to)}</td>
                    <td className="py-2 text-[#6B6459]">{BROKER_DOC_GUIDE[c.docType].title}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button type="button" onClick={handleApply} disabled={proposal.changes.length === 0} className="btn-primary !py-2.5 !px-4 text-sm disabled:opacity-50">
              Apply to my valuation
            </button>
            {applied && <span className="text-xs text-emerald-800 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />{applied}</span>}
          </div>
        </div>
      )}
      <KeptDocuments />
    </div>
  );
};

const DocFigureForm: React.FC<{
  docType: BrokerDocType;
  figures: BrokerExtraction['figures'];
  setFigure: (key: string, v: unknown) => void;
}> = ({ docType, figures, setFigure }) => {
  const f = figures as Record<string, unknown>;
  if (docType === 'clinician_income') {
    const rows = (figures as ClinicianIncomeFigures).clinicians ?? [];
    const setRow = (i: number, patch: Partial<ClinicianIncomeRow>) =>
      setFigure('clinicians', rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr_0.8fr_auto] gap-1.5 text-[10px] font-semibold text-[#6B6459]">
          <span>Role</span><span>Hrs/wk</span><span>Private £</span><span>Plan £</span><span>NHS UDAs</span><span />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.2fr_0.7fr_1fr_1fr_0.8fr_auto] gap-1.5">
            <select value={r.role} onChange={(e) => setRow(i, { role: e.target.value as ClinicianIncomeRow['role'] })} className="px-1.5 py-1.5 rounded border text-xs bg-white" style={{ borderColor: 'var(--color-border)' }}>
              <option>Principal</option><option>Associate</option><option>Hygienist</option><option>Therapist</option>
            </select>
            {(['hoursPerWeek', 'privateIncome', 'planIncome', 'nhsUdas'] as const).map((k) => (
              <input key={k} type="number" aria-label={`${r.role} ${k}`} value={typeof r[k] === 'number' ? (r[k] as number) : ''}
                onChange={(e) => setRow(i, { [k]: e.target.value === '' ? null : Number(e.target.value) })}
                className="min-w-0 px-1.5 py-1.5 rounded border text-xs bg-white" style={{ borderColor: 'var(--color-border)' }} />
            ))}
            <button type="button" aria-label="Remove clinician" onClick={() => setFigure('clinicians', rows.filter((_, j) => j !== i))} className="text-[#6B6459] hover:text-red-700">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setFigure('clinicians', [...rows, { role: 'Associate' }])} className="text-xs font-semibold text-[#A6521C] inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add clinician
        </button>
      </div>
    );
  }
  const fields = docType === 'accounts' ? ACCOUNT_FIELDS : docType === 'nhs_schedule' ? NHS_FIELDS : PLAN_FIELDS;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        {fields.map((fl) => (
          <NumInput key={fl.key} label={fl.label} hint={fl.hint} value={f[fl.key]} onChange={(v) => setFigure(fl.key, v)} />
        ))}
      </div>
      {docType === 'accounts' && (
        <label className="block">
          <span className="block text-[11px] font-semibold text-[#26231E] mb-1">Business structure</span>
          <select value={(f.businessStructure as string) ?? ''} onChange={(e) => setFigure('businessStructure', e.target.value || null)}
            className="w-full px-3 py-2 rounded-[4px] border text-sm bg-white" style={{ borderColor: 'var(--color-border)' }}>
            <option value="">Not sure</option>
            <option value="limited_company">Limited company</option>
            <option value="sole_trader">Sole trader</option>
            <option value="partnership">Partnership</option>
          </select>
        </label>
      )}
    </div>
  );
};

/** Documents the owner chose to keep, with delete. Shown only when signed in and there are some. */
const KeptDocuments: React.FC = () => {
  const { firebaseUser } = useAuth();
  const [list, setList] = useState<Array<{ id: number; docType: string; fileName: string; createdAt: string }> | null>(null);
  React.useEffect(() => {
    if (!firebaseUser) return;
    apiFetch<{ documents: typeof list }>('/api/broker-docs/kept')
      .then((r) => setList(r.documents ?? []))
      .catch(() => setList([]));
  }, [firebaseUser]);
  if (!firebaseUser || !list || list.length === 0) return null;
  const remove = async (id: number) => {
    await apiFetch(`/api/broker-docs/kept/${id}`, { method: 'DELETE' });
    setList((l) => (l ?? []).filter((d) => d.id !== id));
  };
  return (
    <div className="rounded-[6px] border bg-white p-4" style={{ borderColor: 'var(--color-border)' }}>
      <p className="text-sm font-semibold text-[#26231E] flex items-center gap-2"><FileText className="w-4 h-4 text-[#A6521C]" />Documents you kept</p>
      <ul className="mt-2 space-y-1.5">
        {list.map((d) => (
          <li key={d.id} className="flex items-center justify-between text-xs">
            <span>
              <span className="font-mono">{d.fileName}</span>
              <span className="text-[#6B6459]"> · {BROKER_DOC_GUIDE[d.docType as BrokerDocType]?.title ?? d.docType} · {new Date(d.createdAt).toLocaleDateString('en-GB')}</span>
            </span>
            <button type="button" onClick={() => remove(d.id)} className="text-red-700 underline">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};
