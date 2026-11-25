import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateDentalValuation, resolveEbitdaBasis } from '../src/utils/valuationEngine.ts';
import {
  ASSOCIATE_LED_MULTIPLE,
  GOODWILL_PCT_OF_FEES,
  OWNER_OPERATED_MULTIPLE,
} from '../src/data/valuationBenchmarks.ts';
import { backtestReport, loadBacktestCases } from '../scripts/engineBacktest.ts';
import type { DentalIntakeData, PracticeType } from '../src/types.ts';

/** A plain practice: Midlands, 3 surgeries, no premiums or discounts. */
const practice = (o: Partial<DentalIntakeData> = {}): DentalIntakeData => ({
  practiceName: 'Test',
  practiceType: 'Mixed Practice',
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
  turnover: 600000,
  nhsAnnualValue: 240000,
  udaRequirement: 8000,
  udaRate: 33,
  clawbackAmount: 0,
  privateFpiTurnover: 360000,
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
  ...o,
});

const near = (actual: number, expected: number, tolPct: number, msg: string) =>
  assert.ok(Math.abs(actual / expected - 1) <= tolPct / 100, `${msg}: ${actual} vs ${expected} (±${tolPct}%)`);

test('owner-operated profit is valued at the owner-operated multiple, not ~7x', () => {
  const r = calculateDentalValuation(practice({ adjustedEbitda: 210000, ebitdaBasis: 'owner_operated' }));
  near(r.mv1MarketValueGoodwill / 210000, OWNER_OPERATED_MULTIPLE['Mixed Practice'], 5, 'multiple of owner EBITDA');
});

test('associate-led profit in a fully managed practice is valued at the associate-led multiple', () => {
  const r = calculateDentalValuation(
    practice({ adjustedEbitda: 110000, ebitdaBasis: 'associate_led', principalChairHoursPerWeek: 5 }),
  );
  near(r.mv1MarketValueGoodwill / 110000, ASSOCIATE_LED_MULTIPLE['Mixed Practice'], 5, 'multiple of associate EBITDA');
});

test('for a working principal, the same profit is worth much less if it is owner-operated', () => {
  const owner = calculateDentalValuation(practice({ adjustedEbitda: 200000, ebitdaBasis: 'owner_operated' }));
  const assoc = calculateDentalValuation(practice({ adjustedEbitda: 200000, ebitdaBasis: 'associate_led' }));
  assert.ok(owner.mv1MarketValueGoodwill < assoc.mv1MarketValueGoodwill * 0.75, `${owner.mv1MarketValueGoodwill} vs ${assoc.mv1MarketValueGoodwill}`);
});

test('a practice quoted on either profit basis gets a similar value', () => {
  // Owner-operated profit = associate-led profit + the principal's replacement cost.
  const base = practice({ principalChairHoursPerWeek: 20 });
  const asOwner = calculateDentalValuation({ ...base, adjustedEbitda: 210000, ebitdaBasis: 'owner_operated' });
  const replacement = asOwner.methodologyComparison.reconstitutedNetProfit.principalClinicalSalaryAllowance;
  const asAssoc = calculateDentalValuation({ ...base, adjustedEbitda: 210000 - replacement, ebitdaBasis: 'associate_led' });
  near(asOwner.mv1MarketValueGoodwill, asAssoc.mv1MarketValueGoodwill, 1, 'owner vs associate basis');
});

test('both bases at market margins land near the published % of fees', () => {
  // Christie: owner-operated margin ~33%, associate-led ~17%. A benchmark
  // practice should then sit near NASDAL's goodwill % of fees (95-135%) and
  // under the listings' asking median (~140%).
  const types: PracticeType[] = ['NHS Practice', 'Mixed Practice', 'Private Practice', 'Specialist Practice'];
  for (const practiceType of types) {
    const owner = calculateDentalValuation(practice({ practiceType, adjustedEbitda: 0.33 * 600000, ebitdaBasis: 'owner_operated' }));
    const assoc = calculateDentalValuation(
      practice({ practiceType, adjustedEbitda: 0.17 * 600000, ebitdaBasis: 'associate_led', principalChairHoursPerWeek: 5 }),
    );
    for (const r of [owner, assoc]) {
      const pct = (r.mv1MarketValueGoodwill / 600000) * 100;
      assert.ok(pct >= 90 && pct <= 150, `${practiceType}: ${pct.toFixed(0)}% of fees`);
    }
  }
});

test('fee-only valuation uses the NASDAL segment figure', () => {
  const r = calculateDentalValuation(practice({ practiceType: 'NHS Practice' }));
  assert.equal(r.methodologyComparison.grossFeesTurnover.adoptedPercent, GOODWILL_PCT_OF_FEES['NHS Practice']);
});

test('older intakes without a basis: busy principal means owner-operated', () => {
  assert.equal(resolveEbitdaBasis(practice({ principalChairHoursPerWeek: 30 })), 'owner_operated');
  assert.equal(resolveEbitdaBasis(practice({ principalChairHoursPerWeek: 6 })), 'associate_led');
  assert.equal(resolveEbitdaBasis(practice({ principalChairHoursPerWeek: 30, ebitdaBasis: 'associate_led' })), 'associate_led');
});

test('reported FMOP x YP reconciles to the headline value, and fixes are positive', () => {
  const r = calculateDentalValuation(
    practice({ adjustedEbitda: 200000, ebitdaBasis: 'owner_operated', clawbackAmount: 30000, surgeryChairUtilisationPercent: 65 }),
  );
  near(r.fmop * r.ypMultiplierAdopted, r.mv1MarketValueGoodwill, 1, 'FMOP x YP');
  assert.ok(r.topFixes.length > 0);
  for (const f of r.topFixes) {
    assert.ok(f.estimatedPoundImpactMin > 0 && f.estimatedPoundImpactMin <= f.estimatedPoundImpactMax, f.id);
  }
  assert.ok(r.potentialUpsidePounds >= 0);
});

// Back-test against broker asking prices. Needs the private listings file
// (MARKET_DATA_DIR, default data/market); skipped when it isn't there.
const cases = loadBacktestCases();
test('back-test against broker listings', { skip: cases ? false : 'no listings_all.csv in MARKET_DATA_DIR' }, () => {
  const report = backtestReport(cases!);
  console.table(report);
  const all = report['All listings'];
  const owner = report['Profit given: owner_operated'];
  const assoc = report['Profit given: associate_led'];
  assert.ok(all.n >= 100, `only ${all.n} listings`);
  // Old engine: 35.8% median error overall, 55% (and 1.55x too high) on owner-operated profit.
  assert.ok(all.medianAbsPctError <= 27, `overall error ${all.medianAbsPctError}%`);
  for (const [name, s] of [['owner-operated', owner], ['associate-led', assoc]] as const) {
    assert.ok(s.medianAbsPctError <= 23, `${name} error ${s.medianAbsPctError}%`);
    assert.ok(s.medianRatio >= 0.9 && s.medianRatio <= 1.1, `${name} bias ${s.medianRatio}`);
  }
});
