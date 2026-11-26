import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  annualPlanIncome,
  applyIntakeChanges,
  BrokerExtraction,
  expectedClawback,
  ownerOperatedEbitdaFromAccounts,
  periodText,
  planProvider,
  proposeIntakeChanges,
  sanitiseExtraction,
} from '../src/shared/brokerDocuments.ts';
import { calculateDentalValuation } from '../src/utils/valuationEngine.ts';
import type { DentalIntakeData, QuickPracticeScheduleData } from '../src/types.ts';

const base: DentalIntakeData = {
  practiceName: 'Test',
  practiceType: 'Private Practice',
  address: '-',
  postcode: '-',
  region: 'Midlands',
  yearsEstablished: 15,
  surgeriesCount: 3,
  floorAreaSqFt: 1800,
  tenure: 'Leasehold',
  hasDeconRoom: true,
  hasOpgCbctRoom: false,
  disabledAccess: true,
  turnover: 0,
  nhsAnnualValue: 0,
  udaRequirement: 0,
  udaRate: 0,
  clawbackAmount: 0,
  privateFpiTurnover: 0,
  privatePlanTurnover: 0,
  specialistReferralTurnover: 0,
  materialsAndLabCostPercent: 0,
  directAssociateTherapistCostPercent: 0,
  staffWagesPa: 0,
  adjustedEbitda: 0,
  principalChairHoursPerWeek: 30,
  associateRemunerationModel: 'percentage_split_bda',
  associateContracts: 'informal_some_covenants',
  surgeryChairUtilisationPercent: 80,
  hygieneTherapistModel: 'direct_access_active',
  cqcStatus: 'Good / Outstanding',
};
const schedule = { clinicians: [] } as unknown as QuickPracticeScheduleData;

const pack: BrokerExtraction[] = [
  {
    docType: 'accounts',
    figures: {
      periodMonths: 12,
      businessStructure: 'limited_company',
      turnover: 800000,
      materialsCost: 56000,
      labCost: 48000,
      clinicalFees: 240000,
      staffWages: 150000,
      ownerRemuneration: 60000,
      depreciation: 20000,
      amortisation: 10000,
      interest: 5000,
      profitBeforeTax: 145000,
    },
  },
  {
    docType: 'nhs_schedule',
    figures: { contractedUdas: 10000, annualContractValue: 340000, udasDeliveredYtd: 6000, monthsElapsed: 8 },
  },
  {
    docType: 'clinician_income',
    figures: {
      clinicians: [
        { role: 'Principal', hoursPerWeek: 16, privateIncome: 150000, nhsUdas: 3000 },
        { role: 'Associate', hoursPerWeek: 35, privateIncome: 100000, nhsUdas: 6000 },
        { role: 'Hygienist', privateIncome: 50000 },
      ],
    },
  },
  { docType: 'plan_schedule', figures: { provider: 'Denplan', patientCount: 800, averageMonthlyFee: 16.5 } },
];

test('owner-operated EBITDA from accounts adds back interest, depreciation, amortisation and owner pay', () => {
  assert.equal(ownerOperatedEbitdaFromAccounts(pack[0].figures as never), 145000 + 5000 + 20000 + 10000 + 60000);
  // A 6-month period is scaled to a year.
  assert.equal(ownerOperatedEbitdaFromAccounts({ profitBeforeTax: 50000, periodMonths: 6 }), 100000);
  assert.equal(ownerOperatedEbitdaFromAccounts({}), null);
});

test('plan income from the schedule: annual, monthly, or patients x fee', () => {
  assert.equal(annualPlanIncome({ annualIncome: 120000, monthlyIncome: 1 }), 120000);
  assert.equal(annualPlanIncome({ monthlyIncome: 10000 }), 120000);
  assert.equal(annualPlanIncome({ patientCount: 800, averageMonthlyFee: 16.5 }), 158400);
  assert.equal(annualPlanIncome({ patientCount: 800 }), null);
});

test('clawback is projected from the year-to-date run rate below 96% delivery', () => {
  const cb = expectedClawback({ contractedUdas: 10000, annualContractValue: 340000, udasDeliveredYtd: 6000, monthsElapsed: 8 });
  assert.equal(cb.deliveryPct, 90);
  assert.equal(cb.amount, 34000); // 1,000 UDAs short at £34
  assert.equal(cb.estimated, true);
  const ok = expectedClawback({ contractedUdas: 10000, annualContractValue: 340000, udasDeliveredYtd: 6500, monthsElapsed: 8 });
  assert.equal(ok.amount, 0);
  assert.equal(expectedClawback({ clawback: 12000 }).amount, 12000);
});

test('the full pack fills the intake fields a broker would', () => {
  const p = proposeIntakeChanges(base, pack, schedule);
  const to = Object.fromEntries(p.changes.map((c) => [c.field, c.to]));
  assert.equal(to.turnover, 800000);
  assert.equal(to.materialsAndLabCostPercent, 13);
  assert.equal(to.directAssociateTherapistCostPercent, 30);
  assert.equal(to.staffWagesPa, 150000);
  assert.equal(to.adjustedEbitda, 240000);
  assert.equal(to.ebitdaBasis, 'owner_operated');
  assert.equal(to.nhsAnnualValue, 340000); // schedule beats accounts
  assert.equal(to.udaRequirement, 10000);
  assert.equal(to.udaRate, 34);
  assert.equal(to.clawbackAmount, 34000);
  assert.equal(to.privateFpiTurnover, 300000); // incl. hygienist
  assert.equal(to.privatePlanTurnover, 158400);
  assert.equal(to.planPatientCount, 800);
  assert.equal(to.principalChairHoursPerWeek, 16);
  assert.equal(to.practiceType, 'Mixed Practice');
  assert.ok(p.changes.some((c) => c.field === 'quickSchedule.clinicians'));
  // 340k + 300k + 158k = 798k vs 800k accounts: within 10%, no warning.
  assert.ok(!p.warnings.some((w) => w.includes('add up to')));
});

test('income streams that disagree with the accounts are flagged', () => {
  const p = proposeIntakeChanges(base, [...pack.slice(0, 3), { docType: 'plan_schedule', figures: { monthlyIncome: 30000 } }], schedule);
  assert.ok(p.warnings.some((w) => w.includes('add up to')));
});

test('applying keeps only accepted changes, labels clinicians by role and records evidence', () => {
  const p = proposeIntakeChanges(base, pack, schedule);
  const accepted = new Set(p.changes.map((c) => c.field).filter((f) => f !== 'clawbackAmount'));
  const out = applyIntakeChanges(base, pack, schedule, accepted, [
    { docType: 'accounts', source: 'upload', appliedAt: '2026-11-26T00:00:00Z' },
    { docType: 'clinician_income', source: 'manual', appliedAt: '2026-11-26T00:00:00Z' },
  ]);
  assert.equal(out.clawbackAmount, 0);
  assert.equal(out.turnover, 800000);
  assert.deepEqual(out.quickSchedule?.clinicians.map((c) => c.nameOrInitials), ['Principal 1', 'Associate 1']);
  assert.equal(out.documentEvidence?.length, 2);
  // Applied values no longer show as changes.
  assert.ok(!proposeIntakeChanges(out, pack, schedule).changes.some((c) => c.field === 'turnover'));
});

test('with a clinician income report, principal dependence comes from income share', () => {
  const p = proposeIntakeChanges(base, pack, schedule);
  const out = applyIntakeChanges(base, pack, schedule, new Set(p.changes.map((c) => c.field)), [
    { docType: 'clinician_income', source: 'upload', appliedAt: 'x' },
  ]);
  const withEvidence = calculateDentalValuation(out);
  const withoutEvidence = calculateDentalValuation({ ...out, documentEvidence: [] });
  // Principal earns 150k + 3,000 x £34 = 252k of 452k (56%), vs 16 of 51 hours (31%):
  // a bigger replacement cost, so a lower value.
  assert.ok(withEvidence.mv1MarketValueGoodwill < withoutEvidence.mv1MarketValueGoodwill);
});

test('model output is sanitised: unknown fields, names and free text are dropped', () => {
  const e = sanitiseExtraction('clinician_income', {
    periodStart: 'Dr Jane Smith',
    periodEnd: '31 March 2026',
    clinicians: [
      { role: 'Principal', name: 'Dr Jane Smith', privateIncome: '£150,000' },
      { role: 'Receptionist', privateIncome: 1 },
    ],
  });
  assert.equal(e.docType, 'clinician_income');
  if (e.docType !== 'clinician_income') return;
  assert.equal(e.figures.periodStart, null);
  assert.equal(e.figures.periodEnd, '31 March 2026');
  assert.equal(e.figures.clinicians.length, 1);
  assert.deepEqual(Object.keys(e.figures.clinicians[0]).sort(), ['hoursPerWeek', 'nhsUdas', 'planIncome', 'privateIncome', 'role']);
  assert.equal(e.figures.clinicians[0].privateIncome, 150000);
  assert.equal(periodText('2025/26'), '2025/26');
  assert.equal(periodText('Smith Dental'), null);
  assert.equal(planProvider('Denplan Ltd'), 'Denplan');
  assert.equal(planProvider('Smith Family Dental Care Plan'), 'In-house / other');
});
