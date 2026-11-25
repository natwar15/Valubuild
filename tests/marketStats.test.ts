import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_CELL_SIZE,
  ListingRecord,
  POOL_MIN_CONTRIBUTORS,
  PoolRecord,
  distribution,
  protectedMedian,
  practiceTypeFromMix,
  quickValuation,
  regionForPostcode,
  summariseListings,
  summarisePool,
} from '../src/shared/marketStats.ts';
import { normStatus, normTenure, parseCsv, syntheticSample, toListing } from '../src/server/marketData.ts';
import { parseFilters, parseQuickInput } from '../src/server/marketRoutes.ts';

const listing = (o: Partial<ListingRecord>): ListingRecord => ({
  observedDate: '2026-11-01',
  region: 'Midlands',
  type: 'Mixed',
  surgeries: 3,
  tenure: 'Leasehold',
  status: 'Available',
  fees: 500000,
  askingGbp: 600000,
  goodwillAskGbp: 600000,
  goodwillPctFees: 120,
  askXOwnerEbitda: 3.5,
  askXAssocEbitda: 7,
  ownerMarginPct: 35,
  useInAnalysis: true,
  ...o,
});

test('distribution gives quartiles', () => {
  const d = distribution([1, 2, 3, 4, 5]);
  assert.equal(d.median, 3);
  assert.equal(d.p25, 2);
  assert.equal(d.p75, 4);
});

test('cells below the threshold are fully suppressed', () => {
  const rows = [
    ...Array.from({ length: MIN_CELL_SIZE }, () => listing({ region: 'Midlands' })),
    ...Array.from({ length: MIN_CELL_SIZE - 1 }, () => listing({ region: 'Wales' })),
  ];
  const s = summariseListings(rows, {});
  const mid = s.byRegion.find((c) => c.key === 'Midlands')!;
  const wal = s.byRegion.find((c) => c.key === 'Wales')!;
  assert.equal(mid.suppressed, false);
  assert.equal(mid.n, MIN_CELL_SIZE);
  assert.equal(wal.suppressed, true);
  assert.equal(wal.n, null);
  assert.equal(wal.goodwillPctFees, null);
});

test('filters narrow the listings and can suppress the overall cell', () => {
  const rows = Array.from({ length: 10 }, (_, i) => listing({ askingGbp: 100000 * (i + 1) }));
  assert.equal(summariseListings(rows, { minPrice: 600000 }).overall.n, 5);
  assert.equal(summariseListings(rows, { minPrice: 700000 }).overall.suppressed, true);
  assert.equal(summariseListings(rows, { regions: ['Wales'] }).overall.suppressed, true);
});

const poolRec = (key: string, region: PoolRecord['region'], value = 140): PoolRecord => ({
  contributorKey: key, region, type: 'Private', surgeries: 3, feesGbp: 600000, ownerMarginPct: 30, nhsPct: 10,
  reportedValuePctFees: value, estimatePctFees: 130,
});

test('pool needs 10 distinct owners, rounds counts down to 5 and publishes medians only', () => {
  const rows = [
    ...Array.from({ length: 12 }, (_, i) => poolRec(`u${i}`, 'Midlands')),
    poolRec('w1', 'Wales'),
  ];
  const s = summarisePool(rows);
  assert.equal(s.minCellSize, POOL_MIN_CONTRIBUTORS);
  assert.equal(s.contributors, 10);
  const mid = s.byRegion.find((c) => c.key === 'Midlands')!;
  assert.equal(mid.n, 10);
  assert.deepEqual(Object.keys(mid.reportedValuePctFees!), ['median']);
  assert.equal(s.byRegion.find((c) => c.key === 'Wales')!.suppressed, true);
  assert.equal(summarisePool(rows.slice(0, 9)).contributors, null);
});

test('one owner saving many valuations still counts once', () => {
  const rows = Array.from({ length: 15 }, () => poolRec('same-owner', 'Midlands'));
  assert.equal(summarisePool(rows).overall.suppressed, true);
});

test('planted accounts cannot pin one owner\'s value', () => {
  // 9 planted accounts (4 very low, 5 very high) around one real owner at 173%.
  const planted = [
    ...Array.from({ length: 4 }, (_, i) => poolRec(`low${i}`, 'Wales', 20)),
    ...Array.from({ length: 5 }, (_, i) => poolRec(`high${i}`, 'Wales', 400)),
  ];
  const victim = poolRec('victim', 'Wales', 173);
  const cell = summarisePool([...planted, victim]).byRegion.find((c) => c.key === 'Wales')!;
  // Only a median is published, so the attacker learns (victim + 400) / 2 at best,
  // moved by up to 5 points and rounded to 5: the victim's figure is uncertain by about +/-15 points.
  assert.equal(cell.reportedValuePctFees!.median % 5, 0);
  assert.ok(!('p25' in cell.reportedValuePctFees!) && !('p75' in cell.reportedValuePctFees!));
});

test('protected median is stable for the same data and changes when data changes', () => {
  const v = [100, 120, 130, 150, 160, 170, 180, 190, 200, 210];
  const a = protectedMedian('k', v, 5, 5);
  assert.equal(a, protectedMedian('k', [...v].reverse(), 5, 5));
  assert.ok(Math.abs(a! - 165) <= 10);
});

test('postcode area maps to app region', () => {
  assert.equal(regionForPostcode('LS1 4AB'), 'Yorkshire & Humber');
  assert.equal(regionForPostcode('sw1a'), 'London & South East');
  assert.equal(regionForPostcode('EH3'), 'Scotland');
  assert.equal(regionForPostcode('S10'), 'Yorkshire & Humber');
  assert.equal(regionForPostcode('BT1'), null);
  assert.equal(regionForPostcode('123'), null);
});

test('practice type from income mix', () => {
  assert.equal(practiceTypeFromMix(80, 20, 0), 'NHS');
  assert.equal(practiceTypeFromMix(10, 50, 40), 'Private');
  assert.equal(practiceTypeFromMix(50, 30, 20), 'Mixed');
});

test('quick valuation uses comparables and falls back to wider sets', () => {
  const rows = syntheticSample();
  const r = quickValuation(
    { postcodeArea: 'LS', region: 'Yorkshire & Humber', feesGbp: 800000, nhsPct: 20, privatePct: 50, planPct: 30,
      surgeries: 4, tenure: 'Freehold', principalDaysPerWeek: 4, ownerEbitdaGbp: 250000 },
    rows
  );
  assert.equal(r.practiceType, 'Private');
  assert.ok(r.comparablesUsed >= 8);
  assert.ok(r.goodwillLowGbp <= r.goodwillMidGbp && r.goodwillMidGbp <= r.goodwillHighGbp);
  assert.ok(r.goodwillMidGbp > 0);
  assert.ok(r.ebitdaCrossCheck && r.ebitdaCrossCheck.valueGbp > 0);
  assert.ok(r.notes.some((n) => n.includes('freehold')));
  assert.ok(r.notes.some((n) => n.includes('associate-led')));
});

test('pooled owner values are shown as a separate median and never move the listings range', () => {
  const rows = Array.from({ length: 10 }, () => listing({ region: 'Wales', type: 'Private', goodwillPctFees: 100 }));
  const input = { postcodeArea: 'CF', region: 'Wales' as const, feesGbp: 500000, nhsPct: 0, privatePct: 100, planPct: 0,
    surgeries: 3, tenure: 'Leasehold' as const, principalDaysPerWeek: 2 };
  const pooled = (n: number, sameOwner = false) =>
    Array.from({ length: n }, (_, i) => ({ contributorKey: sameOwner ? 'x' : `u${i}`, region: 'Wales' as const, type: 'Private' as const, surgeries: 3, valuePctFees: 200 }));
  assert.equal(quickValuation(input, rows, pooled(9)).ownerReportedMedianPctFees, null);
  assert.equal(quickValuation(input, rows, pooled(20, true)).ownerReportedMedianPctFees, null);
  const r = quickValuation(input, rows, pooled(10));
  assert.ok(r.ownerReportedMedianPctFees !== null && Math.abs(r.ownerReportedMedianPctFees - 200) <= 10);
  assert.equal(r.goodwillPctFees.p75, 100);
  assert.equal(r.goodwillPctFees.median, 100);
});

test('CSV parser handles quotes and commas', () => {
  const rows = parseCsv('a,b,notes\n1,2,"c.20,000 UDAs"\r\n3,4,"say ""hi"""\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].notes, 'c.20,000 UDAs');
  assert.equal(rows[1].notes, 'say "hi"');
});

test('listing normalisation drops identifying fields', () => {
  const l = toListing(
    { source: 'Broker', ref: 'X-1', county: 'Kent', app_region: 'London & South East', type: 'Private', surgeries: '3.0',
      tenure: 'F/L', status: 'SSTC', fees: '500000', asking: '700000', goodwill_pct_fees: '140', use_in_analysis: 'yes' },
    '2026-11-01'
  );
  assert.equal(l.tenure, 'Either');
  assert.equal(l.status, 'Under offer');
  assert.equal(l.surgeries, 3);
  assert.ok(!('ref' in l) && !('county' in l) && !('source' in l));
  assert.equal(normTenure('VF'), 'Freehold');
  assert.equal(normTenure('Long leasehold'), 'Leasehold');
  assert.equal(normStatus('For sale'), 'Available');
});

test('request parsing validates input', () => {
  assert.equal(parseQuickInput({ postcode: 'BT1', feesGbp: 500000, nhsPct: 100 }).ok, false);
  assert.equal(parseQuickInput({ postcode: 'LS1', feesGbp: 500000, nhsPct: 50, privatePct: 10 }).ok, false);
  const ok = parseQuickInput({ postcode: 'LS1 4AB', feesGbp: 500000, nhsPct: 50, privatePct: 30, planPct: 20, surgeries: 3, tenure: 'Freehold', principalDaysPerWeek: 4 });
  assert.ok(ok.ok && ok.input.postcodeArea === 'LS');
  const f = parseFilters({ region: 'Wales,Midlands', from: '2026-01', to: 'bad', minPrice: '100000' });
  assert.deepEqual(f.regions, ['Wales', 'Midlands']);
  assert.equal(f.from, '2026-01');
  assert.equal(f.to, undefined);
  assert.equal(f.minPrice, 100000);
});

test('repeat observations of one listing count once, but once per quarter over time', () => {
  const rows = [
    ...Array.from({ length: 5 }, (_, i) => listing({ listingKey: `k${i}`, observedDate: '2026-02-03', status: 'Available' })),
    ...Array.from({ length: 5 }, (_, i) => listing({ listingKey: `k${i}`, observedDate: '2026-05-03', status: 'Sold' })),
  ];
  const s = summariseListings(rows, {});
  assert.equal(s.overall.n, 5);
  assert.equal(s.totalListings, 5);
  assert.equal(s.byStatus.find((c) => c.key === 'Sold')!.n, 5);
  assert.equal(s.byQuarter.length, 2);
  assert.equal(s.byQuarter[0].n, 5);
});
