/**
 * The document pack a UK dental broker asks for before valuing a practice, and
 * how each document fills the detailed valuation.
 *
 * Brokers typically ask for:
 *   1. the latest submitted (filed) practice accounts,
 *   2. the latest NHS schedule (if the practice holds an NHS contract),
 *   3. private income per clinician for the last 12 months, from the practice software,
 *   4. plan schedules (Denplan, Practice Plan, an in-house plan, etc.).
 *
 * Every document, whether read from an upload or typed in by hand, becomes the
 * same `BrokerExtraction`. `proposeIntakeChanges` turns extractions into a list
 * of field changes the owner reviews before anything is applied, so the
 * valuation never silently takes a figure the owner hasn't seen.
 *
 * Shared by the browser (review screen) and the server (extraction schema).
 * No names: clinicians are labelled by role ("Principal 1", "Associate 2").
 */
import type { ClinicianScheduleRow, DentalIntakeData, PracticeType, QuickPracticeScheduleData } from '../types';

export type BrokerDocType = 'accounts' | 'nhs_schedule' | 'clinician_income' | 'plan_schedule';

export const BROKER_DOC_TYPES: BrokerDocType[] = ['accounts', 'nhs_schedule', 'clinician_income', 'plan_schedule'];

export interface AccountsFigures {
  periodEnd?: string | null; // e.g. "2026-03-31"
  periodMonths?: number | null; // 12 unless a short/long period
  businessStructure?: 'limited_company' | 'sole_trader' | 'partnership' | null;
  turnover?: number | null;
  nhsIncome?: number | null;
  privateIncome?: number | null;
  planIncome?: number | null;
  materialsCost?: number | null;
  labCost?: number | null;
  /** Associates, hygienists and therapists (self-employed clinical fees). */
  clinicalFees?: number | null;
  /** Non-clinical staff wages incl. employer NI and pension. Excludes directors. */
  staffWages?: number | null;
  /** Directors' / partners' salary, NI and pension: added back, as the buyer pays the clinician instead. */
  ownerRemuneration?: number | null;
  rent?: number | null;
  depreciation?: number | null;
  amortisation?: number | null;
  interest?: number | null;
  /** Clearly one-off costs (refit, legal costs of a dispute, etc.). */
  oneOffCosts?: number | null;
  /** Profit before tax (company) or net profit (sole trader / partnership). */
  profitBeforeTax?: number | null;
}

export interface NhsScheduleFigures {
  financialYear?: string | null; // e.g. "2025/26"
  contractedUdas?: number | null;
  contractedUoas?: number | null;
  annualContractValue?: number | null;
  monthlyContractPayment?: number | null;
  udasDeliveredYtd?: number | null;
  monthsElapsed?: number | null;
  /** Clawback / under-delivery recovery on the schedule, £. */
  clawback?: number | null;
}

export interface ClinicianIncomeRow {
  role: 'Principal' | 'Associate' | 'Hygienist' | 'Therapist';
  hoursPerWeek?: number | null;
  privateIncome?: number | null; // fee-per-item private income, 12 months
  planIncome?: number | null; // plan income attributed to this clinician, if the report splits it
  nhsUdas?: number | null;
}

export interface ClinicianIncomeFigures {
  periodStart?: string | null;
  periodEnd?: string | null;
  clinicians: ClinicianIncomeRow[];
}

export interface PlanScheduleFigures {
  provider?: string | null; // Denplan, Practice Plan, in-house...
  periodEnd?: string | null;
  patientCount?: number | null;
  averageMonthlyFee?: number | null;
  /** Gross monthly plan income before the provider's fees. */
  monthlyIncome?: number | null;
  annualIncome?: number | null;
}

export type BrokerExtraction =
  | { docType: 'accounts'; figures: AccountsFigures }
  | { docType: 'nhs_schedule'; figures: NhsScheduleFigures }
  | { docType: 'clinician_income'; figures: ClinicianIncomeFigures }
  | { docType: 'plan_schedule'; figures: PlanScheduleFigures };

export interface DocumentEvidence {
  docType: BrokerDocType;
  source: 'upload' | 'manual' | 'not_applicable';
  period?: string;
  appliedAt: string;
}

/** Guidance shown to the owner for each document. */
export const BROKER_DOC_GUIDE: Record<
  BrokerDocType,
  { title: string; optional: boolean; what: string; where: string; fills: string[] }
> = {
  accounts: {
    title: 'Latest submitted accounts',
    optional: false,
    what: 'The full-year accounts your accountant filed (profit and loss page with the notes), not management accounts.',
    where: 'From your accountant, or Companies House for a limited company (the filed version may omit the P&L, so ask for the full set).',
    fills: ['Total fees', 'Materials & lab %', 'Associate & hygienist cost %', 'Staff wages', 'Adjusted EBITDA (owner-operated)', 'Rent'],
  },
  nhs_schedule: {
    title: 'Latest NHS schedule',
    optional: true,
    what: 'The most recent monthly schedule of payments or contract statement showing contracted UDAs, annual contract value and year-to-date delivery.',
    where: 'England: NHSBSA Compass (Reports). Wales: NHS Wales Shared Services. Download it as a PDF.',
    fills: ['NHS contract value', 'Contracted UDAs', 'UDA rate', 'Expected clawback'],
  },
  clinician_income: {
    title: 'Private income per clinician (last 12 months)',
    optional: false,
    what: 'A report from your practice software of private fees per clinician for the most recent 12 months. Include hours or sessions if you can.',
    where: 'Your practice software\'s production or fees report, run by clinician for the last 12 months (e.g. Dentally, SOE Exact, R4, SfD). Export as CSV or PDF.',
    fills: ['Private fee-per-item income', 'Clinician schedule (how much depends on the principal)'],
  },
  plan_schedule: {
    title: 'Plan schedules',
    optional: true,
    what: 'The latest statement from your plan provider (or in-house plan report) showing patients registered and monthly income.',
    where: 'Your plan provider\'s portal (Denplan, Practice Plan, Patient Plan, etc.) or the plan report in your practice software.',
    fills: ['Plan income', 'Plan patients'],
  },
};

const n = (x: number | null | undefined): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null;
const pos = (x: number | null | undefined): number | null => {
  const v = n(x);
  return v !== null && v > 0 ? v : null;
};
const round = (x: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

/** Accounts covering a short or long period are scaled to 12 months. */
function annualise(value: number | null, months: number | null | undefined): number | null {
  if (value === null) return null;
  const m = n(months);
  if (!m || m <= 0 || m === 12) return value;
  return Math.round((value * 12) / m);
}

/**
 * Owner-operated EBITDA from filed accounts: profit before tax with interest,
 * depreciation, amortisation, the owner's own pay and clearly one-off costs
 * added back. This is the profit before anyone is paid to do the principal's
 * clinical work, which is the basis the engine values at the owner-operated multiple.
 */
export function ownerOperatedEbitdaFromAccounts(a: AccountsFigures): number | null {
  const pbt = n(a.profitBeforeTax);
  if (pbt === null) return null;
  const addBacks =
    (pos(a.interest) ?? 0) +
    (pos(a.depreciation) ?? 0) +
    (pos(a.amortisation) ?? 0) +
    (pos(a.ownerRemuneration) ?? 0) +
    (pos(a.oneOffCosts) ?? 0);
  return annualise(Math.round(pbt + addBacks), a.periodMonths);
}

/** Annual plan income: stated annual, else monthly x 12, else patients x average fee x 12. */
export function annualPlanIncome(p: PlanScheduleFigures): number | null {
  const annual = pos(p.annualIncome);
  if (annual) return Math.round(annual);
  const monthly = pos(p.monthlyIncome);
  if (monthly) return Math.round(monthly * 12);
  const patients = pos(p.patientCount);
  const fee = pos(p.averageMonthlyFee);
  if (patients && fee) return Math.round(patients * fee * 12);
  return null;
}

/**
 * Clawback the schedule implies. Uses the stated figure when there is one.
 * Otherwise projects year-end delivery from the year-to-date run rate: under the
 * GDS contract in England, delivery of 96% or more can be carried forward, below
 * 96% the shortfall is recovered. ASSUMPTION: the whole shortfall below 100% is
 * recovered at the contract's UDA rate (the usual broker treatment).
 */
export function expectedClawback(s: NhsScheduleFigures): { amount: number; estimated: boolean; deliveryPct: number | null } {
  const stated = n(s.clawback);
  const udas = pos(s.contractedUdas);
  const value = pos(s.annualContractValue) ?? (pos(s.monthlyContractPayment) ? pos(s.monthlyContractPayment)! * 12 : null);
  const ytd = pos(s.udasDeliveredYtd);
  const months = pos(s.monthsElapsed);
  let deliveryPct: number | null = null;
  if (udas && ytd && months && months <= 12) deliveryPct = round(((ytd / months) * 12 / udas) * 100, 1);
  if (stated !== null && stated > 0) return { amount: Math.round(stated), estimated: false, deliveryPct };
  if (deliveryPct !== null && deliveryPct < 96 && udas && value) {
    const rate = value / udas;
    return { amount: Math.round(udas * (1 - deliveryPct / 100) * rate), estimated: true, deliveryPct };
  }
  return { amount: 0, estimated: deliveryPct !== null, deliveryPct };
}

export interface FieldChange {
  field: keyof DentalIntakeData | 'quickSchedule.clinicians';
  label: string;
  from: unknown;
  to: unknown;
  docType: BrokerDocType;
  note?: string;
}

export interface Proposal {
  changes: FieldChange[];
  warnings: string[];
  /** Headline facts for the review screen (not applied as fields). */
  facts: Array<{ label: string; value: string; docType: BrokerDocType }>;
}

const gbp = (x: number) => `£${Math.round(x).toLocaleString('en-GB')}`;

function clinicianLabel(role: ClinicianIncomeRow['role'], i: number) {
  return `${role} ${i}`;
}

/** Clinician schedule rows (dentists only) from a per-clinician income report. Names are never carried over. */
export function clinicianRows(f: ClinicianIncomeFigures, udaRate: number): ClinicianScheduleRow[] {
  const counters: Record<string, number> = {};
  return f.clinicians
    .filter((c) => c.role === 'Principal' || c.role === 'Associate')
    .map((c, idx) => {
      counters[c.role] = (counters[c.role] ?? 0) + 1;
      const privateRev = Math.round(pos(c.privateIncome) ?? 0);
      const planRev = Math.round(pos(c.planIncome) ?? 0);
      const udas = Math.round(pos(c.nhsUdas) ?? 0);
      return {
        id: `doc-${c.role === 'Principal' ? 'p' : 'a'}-${idx + 1}`,
        role: c.role as 'Principal' | 'Associate',
        nameOrInitials: clinicianLabel(c.role, counters[c.role]),
        speciality: 'General GDP',
        hoursPerWeek: round(pos(c.hoursPerWeek) ?? 0, 1),
        stayPostSale: c.role === 'Principal' ? 'Leave' : 'Stay',
        privateFpiRevenue: privateRev,
        privateFpiPercent: 50,
        patientPlanRevenue: planRev,
        patientPlanPercent: 50,
        allocatedUdas: udas,
        allocatedUoas: 0,
        netPayPerUda: udaRate > 0 ? round(udaRate * 0.4, 2) : 0,
        labsDeductedPercent: 50,
      };
    });
}

/** Share of dentists' income the principal(s) generate, from the clinician report. */
export function principalIncomeShare(f: ClinicianIncomeFigures, udaRate: number): number | null {
  let total = 0;
  let principal = 0;
  for (const c of f.clinicians) {
    if (c.role !== 'Principal' && c.role !== 'Associate') continue;
    const v = (pos(c.privateIncome) ?? 0) + (pos(c.planIncome) ?? 0) + (pos(c.nhsUdas) ?? 0) * udaRate;
    total += v;
    if (c.role === 'Principal') principal += v;
  }
  return total > 0 ? principal / total : null;
}

/**
 * Field changes implied by the documents, against the current intake.
 * Later documents in the pack take precedence where two fill the same field:
 * the NHS schedule beats the accounts' NHS line, the plan schedule beats the
 * accounts' plan line, the clinician report beats the accounts' private line.
 */
export function proposeIntakeChanges(
  current: DentalIntakeData,
  extractions: BrokerExtraction[],
  baseSchedule: QuickPracticeScheduleData,
): Proposal {
  const byType = new Map<BrokerDocType, BrokerExtraction>();
  for (const e of extractions) byType.set(e.docType, e);
  const accounts = byType.get('accounts')?.figures as AccountsFigures | undefined;
  const nhs = byType.get('nhs_schedule')?.figures as NhsScheduleFigures | undefined;
  const clin = byType.get('clinician_income')?.figures as ClinicianIncomeFigures | undefined;
  const plan = byType.get('plan_schedule')?.figures as PlanScheduleFigures | undefined;

  const next: Partial<DentalIntakeData> = {};
  const changes: FieldChange[] = [];
  const warnings: string[] = [];
  const facts: Proposal['facts'] = [];

  const set = <K extends keyof DentalIntakeData>(
    field: K,
    label: string,
    value: DentalIntakeData[K],
    docType: BrokerDocType,
    note?: string,
  ) => {
    next[field] = value;
    const i = changes.findIndex((c) => c.field === field);
    if (current[field] === value) {
      // Already the intake's value (e.g. after applying): nothing to review.
      if (i >= 0) changes.splice(i, 1);
      return;
    }
    const change: FieldChange = { field, label, from: current[field], to: value, docType, note };
    if (i >= 0) changes[i] = change;
    else changes.push(change);
  };

  // 1. Accounts
  let accountsTurnover: number | null = null;
  if (accounts) {
    const months = accounts.periodMonths;
    accountsTurnover = annualise(pos(accounts.turnover), months);
    if (n(accounts.periodMonths) && accounts.periodMonths !== 12) {
      warnings.push(`The accounts cover ${accounts.periodMonths} months; figures were scaled to 12 months.`);
    }
    if (accounts.periodEnd) facts.push({ label: 'Accounts period end', value: accounts.periodEnd, docType: 'accounts' });
    if (accountsTurnover) {
      set('turnover', 'Total fees (turnover)', accountsTurnover, 'accounts');
      const matLab = (pos(accounts.materialsCost) ?? 0) + (pos(accounts.labCost) ?? 0);
      if (matLab > 0) {
        set('materialsAndLabCostPercent', 'Materials & lab costs (% of fees)', round((annualise(matLab, months)! / accountsTurnover) * 100, 1), 'accounts');
      }
      const clinical = pos(accounts.clinicalFees);
      if (clinical) {
        set(
          'directAssociateTherapistCostPercent',
          'Associate, hygienist & therapist costs (% of fees)',
          round((annualise(clinical, months)! / accountsTurnover) * 100, 1),
          'accounts',
        );
      }
      const nhsLine = annualise(pos(accounts.nhsIncome), months);
      if (nhsLine) set('nhsAnnualValue', 'NHS contract value', nhsLine, 'accounts', 'From the accounts; the NHS schedule is more precise.');
      const privLine = annualise(pos(accounts.privateIncome), months);
      if (privLine) set('privateFpiTurnover', 'Private fee-per-item income', privLine, 'accounts');
      const planLine = annualise(pos(accounts.planIncome), months);
      if (planLine) set('privatePlanTurnover', 'Plan income', planLine, 'accounts');
    }
    const wages = annualise(pos(accounts.staffWages), months);
    if (wages) set('staffWagesPa', 'Non-clinical staff wages', wages, 'accounts');
    const rent = annualise(pos(accounts.rent), months);
    if (rent) set('passingRentPa', 'Rent (per year)', rent, 'accounts', 'Check this is the market rent if you rent from yourself.');

    const ebitda = ownerOperatedEbitdaFromAccounts(accounts);
    if (ebitda !== null) {
      set(
        'adjustedEbitda',
        'Adjusted EBITDA',
        Math.max(ebitda, 0),
        'accounts',
        'Profit before tax with interest, depreciation, your own pay and one-off costs added back.',
      );
      set('ebitdaBasis', 'Profit basis', 'owner_operated', 'accounts', 'Before paying anyone to do the principal\'s clinical work.');
      if (!pos(accounts.ownerRemuneration) && accounts.businessStructure === 'limited_company') {
        warnings.push(
          'No directors\' pay was found in the accounts. If you pay yourself a salary or pension through the company, add it so it can be added back.',
        );
      }
    } else {
      warnings.push('Profit before tax was not found in the accounts, so the profit figure was not changed.');
    }
  }

  // 2. NHS schedule
  let udaRate = current.udaRate || 0;
  if (nhs) {
    const udas = pos(nhs.contractedUdas);
    const value = pos(nhs.annualContractValue) ?? (pos(nhs.monthlyContractPayment) ? Math.round(pos(nhs.monthlyContractPayment)! * 12) : null);
    if (value) set('nhsAnnualValue', 'NHS contract value', Math.round(value), 'nhs_schedule');
    if (udas) set('udaRequirement', 'Contracted UDAs', Math.round(udas), 'nhs_schedule');
    if (value && udas) {
      udaRate = round(value / udas, 2);
      set('udaRate', 'UDA rate', udaRate, 'nhs_schedule');
    }
    const cb = expectedClawback(nhs);
    if (cb.deliveryPct !== null) {
      facts.push({ label: 'Projected UDA delivery', value: `${cb.deliveryPct}% of contract`, docType: 'nhs_schedule' });
    }
    if (cb.amount > 0 || n(nhs.clawback) !== null || cb.deliveryPct !== null) {
      set(
        'clawbackAmount',
        'Expected clawback',
        cb.amount,
        'nhs_schedule',
        cb.estimated
          ? cb.amount > 0
            ? `Estimated: projected delivery ${cb.deliveryPct}% is below the 96% threshold.`
            : `Projected delivery ${cb.deliveryPct}% is at or above 96%, so no clawback expected.`
          : undefined,
      );
    }
    if (nhs.financialYear) facts.push({ label: 'NHS contract year', value: nhs.financialYear, docType: 'nhs_schedule' });
  }

  // 3. Private income per clinician
  if (clin && clin.clinicians.length > 0) {
    const privateTotal = clin.clinicians.reduce((s, c) => s + (pos(c.privateIncome) ?? 0), 0);
    if (privateTotal > 0) {
      set(
        'privateFpiTurnover',
        'Private fee-per-item income',
        Math.round(privateTotal),
        'clinician_income',
        'All clinicians, including hygienists and therapists, last 12 months.',
      );
    }
    const rows = clinicianRows(clin, udaRate);
    const sameRows = JSON.stringify(current.quickSchedule?.clinicians ?? []) === JSON.stringify(rows);
    if (rows.length > 0 && !sameRows) {
      const schedule = { ...(current.quickSchedule ?? baseSchedule), clinicians: rows };
      next.quickSchedule = schedule;
      changes.push({
        field: 'quickSchedule.clinicians',
        label: 'Clinician schedule',
        from: `${current.quickSchedule?.clinicians.length ?? 0} clinicians`,
        to: `${rows.length} clinicians (${rows.filter((r) => r.role === 'Principal').length} principal)`,
        docType: 'clinician_income',
        note: 'Names are not kept; clinicians are labelled by role.',
      });
    }
    const principalHours = rows.filter((r) => r.role === 'Principal').reduce((s, r) => s + r.hoursPerWeek, 0);
    if (principalHours > 0) set('principalChairHoursPerWeek', 'Principal chair hours per week', principalHours, 'clinician_income');
    const share = principalIncomeShare(clin, udaRate);
    if (share !== null) {
      facts.push({ label: 'Principal\'s share of dentists\' income', value: `${Math.round(share * 100)}%`, docType: 'clinician_income' });
      if (share >= 0.5) {
        warnings.push(
          `The principal earns ${Math.round(share * 100)}% of the dentists' income. A buyer has to pay someone to do that work after the sale, so the valuation deducts the cost of replacing it.`,
        );
      }
    }
    if (clin.periodStart && clin.periodEnd) {
      facts.push({ label: 'Clinician report period', value: `${clin.periodStart} to ${clin.periodEnd}`, docType: 'clinician_income' });
    }
  }

  // 4. Plan schedule
  if (plan) {
    const annual = annualPlanIncome(plan);
    if (annual) set('privatePlanTurnover', 'Plan income', annual, 'plan_schedule');
    if (pos(plan.patientCount)) {
      set('planPatientCount', 'Plan patients', Math.round(pos(plan.patientCount)!), 'plan_schedule');
    }
    if (pos(plan.averageMonthlyFee)) {
      facts.push({ label: 'Average plan fee', value: `${gbp(pos(plan.averageMonthlyFee)!)} a month`, docType: 'plan_schedule' });
    }
    if (plan.provider) facts.push({ label: 'Plan provider', value: plan.provider, docType: 'plan_schedule' });
  }

  // Cross-checks, as a broker would make them.
  const merged = { ...current, ...next };
  const streams = (merged.nhsAnnualValue || 0) + (merged.privateFpiTurnover || 0) + (merged.privatePlanTurnover || 0) + (merged.specialistReferralTurnover || 0);
  // Only once the private income report is in: before that, the private line is
  // whatever the intake already held, so a gap would be noise.
  if (accountsTurnover && streams > 0 && clin) {
    const gap = (streams - accountsTurnover) / accountsTurnover;
    if (Math.abs(gap) > 0.1) {
      warnings.push(
        `NHS, private and plan income add up to ${gbp(streams)}, ${Math.round(Math.abs(gap) * 100)}% ${gap > 0 ? 'above' : 'below'} the accounts' fees of ${gbp(accountsTurnover)}. Brokers will ask why: the documents may cover different periods, or income may be missing.`,
      );
    }
  } else if (!accountsTurnover && !current.turnover && streams > 0) {
    set('turnover', 'Total fees (turnover)', Math.round(streams), clin ? 'clinician_income' : 'nhs_schedule', 'Sum of NHS, private and plan income.');
  }

  const fees = merged.turnover || streams;
  if (fees > 0 && current.practiceType !== 'Specialist Practice' && (nhs || accounts)) {
    const nhsShare = (merged.nhsAnnualValue || 0) / fees;
    const type: PracticeType = nhsShare >= 0.7 ? 'NHS Practice' : nhsShare >= 0.1 ? 'Mixed Practice' : 'Private Practice';
    if (type !== current.practiceType) {
      set('practiceType', 'Practice type', type, nhs ? 'nhs_schedule' : 'accounts', `NHS is ${Math.round(nhsShare * 100)}% of fees.`);
    }
  }

  return { changes, warnings, facts };
}

/** Apply the changes the owner accepted. */
export function applyIntakeChanges(
  current: DentalIntakeData,
  extractions: BrokerExtraction[],
  baseSchedule: QuickPracticeScheduleData,
  accepted: Set<FieldChange['field']>,
  evidence: DocumentEvidence[],
): DentalIntakeData {
  const { changes } = proposeIntakeChanges(current, extractions, baseSchedule);
  const out: DentalIntakeData = { ...current };
  for (const c of changes) {
    if (!accepted.has(c.field)) continue;
    if (c.field === 'quickSchedule.clinicians') {
      const clin = extractions.find((e) => e.docType === 'clinician_income');
      if (clin && clin.docType === 'clinician_income') {
        const rate = accepted.has('udaRate') ? Number(changes.find((x) => x.field === 'udaRate')?.to ?? current.udaRate) : current.udaRate;
        out.quickSchedule = { ...(current.quickSchedule ?? baseSchedule), clinicians: clinicianRows(clin.figures, rate || 0) };
      }
      continue;
    }
    (out as unknown as Record<string, unknown>)[c.field] = c.to;
  }
  out.documentEvidence = evidence;
  return out;
}

// -------------------------------------------------------------------------
// Server-side sanitising of model output. The model is told not to return
// names, but nothing it returns is trusted: only known numeric/enum fields survive.
// -------------------------------------------------------------------------

const num = (x: unknown): number | null => {
  if (typeof x === 'number' && Number.isFinite(x)) return x;
  if (typeof x === 'string') {
    const v = Number(x.replace(/[£,\s]/g, ''));
    return Number.isFinite(v) && x.trim() !== '' ? v : null;
  }
  return null;
};
const shortText = (x: unknown, max = 40): string | null => {
  if (typeof x !== 'string') return null;
  const t = x.trim().slice(0, max);
  return t || null;
};
const MONTHS = /\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|may|june?|july?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?|to)\b/gi;
/** Dates and periods only (digits, separators, month names), so no free text can carry a name. */
export const periodText = (x: unknown): string | null => {
  const t = shortText(x, 24);
  if (!t) return null;
  return /^[0-9/\-\s.,]+$/.test(t.replace(MONTHS, '')) ? t : null;
};
const KNOWN_PLAN_PROVIDERS = ['Denplan', 'Practice Plan', 'Patient Plan', 'Coplan', 'Dentalplan', 'Simplyhealth', 'Medenta'];
/** Known plan providers by name; anything else (often the practice's own name) becomes "In-house / other". */
export const planProvider = (x: unknown): string | null => {
  const t = shortText(x, 60);
  if (!t) return null;
  const hit = KNOWN_PLAN_PROVIDERS.find((p) => t.toLowerCase().replace(/\s/g, '').includes(p.toLowerCase().replace(/\s/g, '')));
  return hit ?? 'In-house / other';
};

export function sanitiseExtraction(docType: BrokerDocType, raw: unknown): BrokerExtraction {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  switch (docType) {
    case 'accounts': {
      const bs = r.businessStructure;
      return {
        docType,
        figures: {
          periodEnd: periodText(r.periodEnd),
          periodMonths: num(r.periodMonths),
          businessStructure:
            bs === 'limited_company' || bs === 'sole_trader' || bs === 'partnership' ? bs : null,
          turnover: num(r.turnover),
          nhsIncome: num(r.nhsIncome),
          privateIncome: num(r.privateIncome),
          planIncome: num(r.planIncome),
          materialsCost: num(r.materialsCost),
          labCost: num(r.labCost),
          clinicalFees: num(r.clinicalFees),
          staffWages: num(r.staffWages),
          ownerRemuneration: num(r.ownerRemuneration),
          rent: num(r.rent),
          depreciation: num(r.depreciation),
          amortisation: num(r.amortisation),
          interest: num(r.interest),
          oneOffCosts: num(r.oneOffCosts),
          profitBeforeTax: num(r.profitBeforeTax),
        },
      };
    }
    case 'nhs_schedule':
      return {
        docType,
        figures: {
          financialYear: periodText(r.financialYear),
          contractedUdas: num(r.contractedUdas),
          contractedUoas: num(r.contractedUoas),
          annualContractValue: num(r.annualContractValue),
          monthlyContractPayment: num(r.monthlyContractPayment),
          udasDeliveredYtd: num(r.udasDeliveredYtd),
          monthsElapsed: num(r.monthsElapsed),
          clawback: num(r.clawback),
        },
      };
    case 'clinician_income': {
      const list = Array.isArray(r.clinicians) ? r.clinicians.slice(0, 30) : [];
      const roles = ['Principal', 'Associate', 'Hygienist', 'Therapist'] as const;
      return {
        docType,
        figures: {
          periodStart: periodText(r.periodStart),
          periodEnd: periodText(r.periodEnd),
          clinicians: list
            .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
            .filter((c) => roles.includes(c.role as (typeof roles)[number]))
            .map((c) => ({
              role: c.role as ClinicianIncomeRow['role'],
              hoursPerWeek: num(c.hoursPerWeek),
              privateIncome: num(c.privateIncome),
              planIncome: num(c.planIncome),
              nhsUdas: num(c.nhsUdas),
            })),
        },
      };
    }
    case 'plan_schedule':
      return {
        docType,
        figures: {
          provider: planProvider(r.provider),
          periodEnd: periodText(r.periodEnd),
          patientCount: num(r.patientCount),
          averageMonthlyFee: num(r.averageMonthlyFee),
          monthlyIncome: num(r.monthlyIncome),
          annualIncome: num(r.annualIncome),
        },
      };
  }
}

export function isBrokerDocType(x: unknown): x is BrokerDocType {
  return typeof x === 'string' && (BROKER_DOC_TYPES as string[]).includes(x);
}
