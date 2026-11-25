/**
 * Pure statistics for the public market-data explorer, the quick valuation and
 * the pooled owner benchmarks. Shared by the server (which owns the data) and
 * the browser (which only ever receives aggregates).
 *
 * Privacy rule used everywhere: any cell built from fewer than MIN_CELL_SIZE
 * records is suppressed (no count, no figures). This applies to owner-submitted
 * data (personal data under UK GDPR) and, for consistency and to avoid
 * republishing individual broker adverts, to the listings data too.
 */

export const MIN_CELL_SIZE = 5;

/**
 * Owner-submitted (pooled) data is held to a stricter rule than public listings:
 * a cell needs at least POOL_MIN_CONTRIBUTORS distinct accounts, each account
 * counts once, only a median is published (never p25/p75, which with a few
 * planted accounts would pin one owner's figure), and that median is rounded and
 * nudged by a small deterministic offset so it can't be solved back to one value.
 */
export const POOL_MIN_CONTRIBUTORS = 10;

export const APP_REGIONS = [
  'London & South East',
  'Midlands',
  'North West',
  'Yorkshire & Humber',
  'South West',
  'East of England',
  'Scotland',
  'Wales',
  'North East',
] as const;
export type AppRegion = (typeof APP_REGIONS)[number];

export const PRACTICE_TYPES = ['NHS', 'Mixed', 'Private', 'Specialist'] as const;
export type PracticeType = (typeof PRACTICE_TYPES)[number];

export type Tenure = 'Freehold' | 'Leasehold' | 'Either' | 'Unknown';

export const LISTING_STATUSES = ['Available', 'Under offer', 'Sold'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

/** One public broker listing observation, normalised. No refs, no county, no source URL. */
export interface ListingRecord {
  observedDate: string; // YYYY-MM-DD
  region: AppRegion | null;
  type: PracticeType | null;
  surgeries: number | null;
  tenure: Tenure;
  status: ListingStatus;
  fees: number | null;
  askingGbp: number | null;
  goodwillAskGbp: number | null;
  goodwillPctFees: number | null;
  askXOwnerEbitda: number | null;
  askXAssocEbitda: number | null;
  ownerMarginPct: number | null;
  useInAnalysis: boolean;
  /** Opaque per-listing id (hash of broker + ref). Server-side only, used to de-duplicate repeat observations. */
  listingKey?: string;
}

export interface ListingFilters {
  regions?: string[];
  types?: string[];
  statuses?: string[];
  tenure?: string;
  minSurgeries?: number;
  maxSurgeries?: number;
  minPrice?: number;
  maxPrice?: number;
  from?: string; // YYYY-MM-DD or YYYY-MM
  to?: string;
}

export interface Distribution {
  n: number;
  p25: number | null;
  median: number | null;
  p75: number | null;
}

/** A cell that may be suppressed. When suppressed, every figure is null. */
export interface Cell {
  key: string;
  suppressed: boolean;
  n: number | null;
  askingGbp: Distribution | null;
  goodwillPctFees: Distribution | null;
  askXOwnerEbitda: Distribution | null;
  feesGbp: Distribution | null;
}

// ---------------------------------------------------------------------------
// Basic helpers
// ---------------------------------------------------------------------------

export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function distribution(values: Array<number | null | undefined>): Distribution {
  const clean = values
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  return {
    n: clean.length,
    p25: quantile(clean, 0.25),
    median: quantile(clean, 0.5),
    p75: quantile(clean, 0.75),
  };
}

/** Distribution that is itself suppressed when built from too few values. */
function safeDistribution(values: Array<number | null | undefined>, round: (n: number) => number): Distribution | null {
  const d = distribution(values);
  if (d.n < MIN_CELL_SIZE) return null;
  return {
    n: d.n,
    p25: d.p25 === null ? null : round(d.p25),
    median: d.median === null ? null : round(d.median),
    p75: d.p75 === null ? null : round(d.p75),
  };
}

const roundTo = (step: number) => (n: number) => Math.round(n / step) * step;
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

function normDate(d: string | undefined, end: boolean): string | undefined {
  if (!d) return undefined;
  if (/^\d{4}-\d{2}$/.test(d)) return end ? `${d}-31` : `${d}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  return undefined;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export function filterListings(rows: ListingRecord[], f: ListingFilters): ListingRecord[] {
  const from = normDate(f.from, false);
  const to = normDate(f.to, true);
  return rows.filter((r) => {
    if (f.regions?.length && (!r.region || !f.regions.includes(r.region))) return false;
    if (f.types?.length && (!r.type || !f.types.includes(r.type))) return false;
    if (f.statuses?.length && !f.statuses.includes(r.status)) return false;
    if (f.tenure && f.tenure !== 'Any' && r.tenure !== f.tenure && r.tenure !== 'Either') return false;
    if (typeof f.minSurgeries === 'number' && (r.surgeries === null || r.surgeries < f.minSurgeries)) return false;
    if (typeof f.maxSurgeries === 'number' && (r.surgeries === null || r.surgeries > f.maxSurgeries)) return false;
    if (typeof f.minPrice === 'number' && (r.askingGbp === null || r.askingGbp < f.minPrice)) return false;
    if (typeof f.maxPrice === 'number' && (r.askingGbp === null || r.askingGbp > f.maxPrice)) return false;
    if (from && r.observedDate < from) return false;
    if (to && r.observedDate > to) return false;
    return true;
  });
}

export function buildCell(key: string, rows: ListingRecord[]): Cell {
  if (rows.length < MIN_CELL_SIZE) {
    return { key, suppressed: true, n: null, askingGbp: null, goodwillPctFees: null, askXOwnerEbitda: null, feesGbp: null };
  }
  const analysed = rows.filter((r) => r.useInAnalysis);
  return {
    key,
    suppressed: false,
    n: rows.length,
    askingGbp: safeDistribution(rows.map((r) => r.askingGbp), roundTo(5000)),
    goodwillPctFees: safeDistribution(analysed.map((r) => r.goodwillPctFees), round1),
    askXOwnerEbitda: safeDistribution(analysed.map((r) => r.askXOwnerEbitda), round2),
    feesGbp: safeDistribution(rows.map((r) => r.fees), roundTo(5000)),
  };
}

export function surgeriesBand(n: number | null): string {
  if (n === null) return 'Unknown';
  if (n <= 2) return '1-2';
  if (n <= 4) return '3-4';
  if (n <= 6) return '5-6';
  return '7+';
}
export const SURGERY_BANDS = ['1-2', '3-4', '5-6', '7+'];

export function quarterOf(date: string): string {
  const [y, m] = date.split('-').map(Number);
  return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
}

function groupBy<T>(rows: T[], keyOf: (r: T) => string | null): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k === null) continue;
    const arr = out.get(k);
    if (arr) arr.push(r);
    else out.set(k, [r]);
  }
  return out;
}

export interface ListingsSummary {
  minCellSize: number;
  totalListings: number; // whole dataset, before filters
  overall: Cell;
  byRegion: Cell[];
  byType: Cell[];
  bySurgeries: Cell[];
  byStatus: Cell[];
  byQuarter: Cell[];
  dateRange: { first: string | null; last: string | null };
}

/** Keep only the latest observation of each listing (rows without a key are kept as-is). */
export function latestPerListing(rows: ListingRecord[]): ListingRecord[] {
  const latest = new Map<string, ListingRecord>();
  const out: ListingRecord[] = [];
  for (const r of rows) {
    if (!r.listingKey) {
      out.push(r);
      continue;
    }
    const prev = latest.get(r.listingKey);
    if (!prev || prev.observedDate < r.observedDate) latest.set(r.listingKey, r);
  }
  return [...out, ...latest.values()];
}

export function summariseListings(all: ListingRecord[], f: ListingFilters): ListingsSummary {
  const filtered = filterListings(all, f);
  // A listing seen on several dates counts once (its latest state in the filtered window)...
  const rows = latestPerListing(filtered);
  const byKey = (keys: readonly string[], keyOf: (r: ListingRecord) => string | null) => {
    const g = groupBy(rows, keyOf);
    return keys.map((k) => buildCell(k, g.get(k) || []));
  };
  const quarters = Array.from(new Set(filtered.map((r) => quarterOf(r.observedDate)))).sort();
  const dates = all.map((r) => r.observedDate).sort();
  return {
    minCellSize: MIN_CELL_SIZE,
    overall: buildCell('All', rows),
    byRegion: byKey(APP_REGIONS, (r) => r.region),
    byType: byKey(PRACTICE_TYPES, (r) => r.type),
    bySurgeries: byKey(SURGERY_BANDS, (r) => surgeriesBand(r.surgeries)),
    byStatus: byKey(LISTING_STATUSES, (r) => r.status),
    // ...except over time, where each quarter counts the listings observed in it.
    byQuarter: quarters.map((q) => buildCell(q, latestPerListing(filtered.filter((r) => quarterOf(r.observedDate) === q)))),
    totalListings: latestPerListing(all).length,
    dateRange: { first: dates[0] || null, last: dates[dates.length - 1] || null },
  };
}

// ---------------------------------------------------------------------------
// Quick valuation (6 questions)
// ---------------------------------------------------------------------------

export interface QuickValuationInput {
  postcodeArea: string; // e.g. "LS" (letters only)
  region: AppRegion;
  feesGbp: number;
  nhsPct: number;
  privatePct: number;
  planPct: number;
  surgeries: number;
  tenure: 'Freehold' | 'Leasehold';
  principalDaysPerWeek: number;
  ownerEbitdaGbp?: number | null; // optional extra question
}

/** Owner-reported value used as an extra comparable (from consented submissions). */
export interface PooledComparable {
  /** Opaque per-account key, server-side only. Each account counts once. */
  contributorKey: string;
  region: AppRegion;
  type: PracticeType;
  surgeries: number;
  valuePctFees: number;
}

export interface QuickValuationResult {
  practiceType: PracticeType;
  basis: string; // which comparable set was used
  comparablesUsed: number;
  /**
   * Median owner-reported value (% of fees) for the same comparable group, only when
   * at least POOL_MIN_CONTRIBUTORS owners are in it. Rounded and offset like the pool
   * summary. Shown alongside the listings range, never mixed into it.
   */
  ownerReportedMedianPctFees: number | null;
  goodwillPctFees: Distribution;
  goodwillLowGbp: number;
  goodwillMidGbp: number;
  goodwillHighGbp: number;
  ebitdaCrossCheck: { multiple: number; valueGbp: number } | null;
  notes: string[];
}

export function practiceTypeFromMix(nhsPct: number, privatePct: number, planPct: number): PracticeType {
  const nonNhs = privatePct + planPct;
  if (nhsPct >= 70) return 'NHS';
  if (nonNhs >= 70) return 'Private';
  return 'Mixed';
}

const MIN_COMPARABLES = 8;

export function quickValuation(
  input: QuickValuationInput,
  listings: ListingRecord[],
  pooled: PooledComparable[] = []
): QuickValuationResult {
  const type = practiceTypeFromMix(input.nhsPct, input.privatePct, input.planPct);
  const usable = latestPerListing(listings).filter(
    (r) => r.useInAnalysis && r.goodwillPctFees !== null && r.goodwillPctFees > 20 && r.goodwillPctFees < 500
  );
  const band = surgeriesBand(input.surgeries);

  const tiers: Array<{ label: string; listings: ListingRecord[]; pooled: PooledComparable[] }> = [
    {
      label: `${type} practices in ${input.region} with ${band} surgeries`,
      listings: usable.filter((r) => r.type === type && r.region === input.region && surgeriesBand(r.surgeries) === band),
      pooled: pooled.filter((p) => p.type === type && p.region === input.region && surgeriesBand(p.surgeries) === band),
    },
    {
      label: `${type} practices in ${input.region}`,
      listings: usable.filter((r) => r.type === type && r.region === input.region),
      pooled: pooled.filter((p) => p.type === type && p.region === input.region),
    },
    {
      label: `${type} practices across the UK`,
      listings: usable.filter((r) => r.type === type),
      pooled: pooled.filter((p) => p.type === type),
    },
    { label: 'All UK practices', listings: usable, pooled },
  ];
  const chosen = tiers.find((t) => t.listings.length >= MIN_COMPARABLES) || tiers[tiers.length - 1];

  // Pooled owner data never enters the published range (its quartiles could be
  // pinned with planted accounts). It is reported as a separate, protected median.
  const pooledByOwner = onePerContributor(chosen.pooled);
  const ownerReportedMedianPctFees =
    pooledByOwner.length >= POOL_MIN_CONTRIBUTORS
      ? protectedMedian(`quick|${chosen.label}`, pooledByOwner.map((p) => p.valuePctFees), 5, 5)
      : null;
  const dist = distribution(chosen.listings.map((r) => r.goodwillPctFees));
  const pct = (v: number | null) => (v === null ? 0 : v / 100);
  const fees = Math.max(0, input.feesGbp);

  const notes: string[] = [
    'Based on public asking prices. Agreed prices are often lower than asking, so treat this as a guide, not a formal valuation.',
  ];
  if (input.tenure === 'Freehold') {
    notes.push('Goodwill only. A freehold building is valued separately and added on top.');
  }
  if (input.principalDaysPerWeek >= 4) {
    notes.push(
      'You work most days in the practice, so a buyer has to replace your clinical time. Expect buyers to price on associate-led profit, which can pull the figure towards the low end.'
    );
  }
  if (type === 'NHS') {
    notes.push('Few NHS practices are publicly listed, so the range is wider than for private or mixed practices.');
  }

  let ebitdaCrossCheck: QuickValuationResult['ebitdaCrossCheck'] = null;
  if (input.ownerEbitdaGbp && input.ownerEbitdaGbp > 0) {
    const multiples = distribution(
      chosen.listings.map((r) => r.askXOwnerEbitda).filter((m) => m !== null && m > 0.5 && m < 15)
    );
    if (multiples.median !== null && multiples.n >= MIN_CELL_SIZE) {
      ebitdaCrossCheck = {
        multiple: round2(multiples.median),
        valueGbp: roundTo(1000)(multiples.median * input.ownerEbitdaGbp),
      };
    }
  }

  return {
    practiceType: type,
    basis: chosen.label,
    comparablesUsed: chosen.listings.length,
    ownerReportedMedianPctFees,
    goodwillPctFees: {
      n: dist.n,
      p25: dist.p25 === null ? null : round1(dist.p25),
      median: dist.median === null ? null : round1(dist.median),
      p75: dist.p75 === null ? null : round1(dist.p75),
    },
    goodwillLowGbp: roundTo(1000)(fees * pct(dist.p25)),
    goodwillMidGbp: roundTo(1000)(fees * pct(dist.median)),
    goodwillHighGbp: roundTo(1000)(fees * pct(dist.p75)),
    ebitdaCrossCheck,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Pooled owner submissions (personal data: aggregates only, k >= MIN_CELL_SIZE)
// ---------------------------------------------------------------------------

export interface PoolRecord {
  /** Opaque per-account key, server-side only. Each account counts once per cell. */
  contributorKey: string;
  region: AppRegion;
  type: PracticeType;
  surgeries: number;
  feesGbp: number;
  ownerMarginPct: number | null;
  nhsPct: number;
  reportedValuePctFees: number | null;
  estimatePctFees: number | null;
}

/** A pooled figure: median only. */
export interface PoolFigure {
  median: number;
}

export interface PoolCell {
  key: string;
  suppressed: boolean;
  /** Distinct contributors, rounded down to the nearest 5. */
  n: number | null;
  feesGbp: PoolFigure | null;
  ownerMarginPct: PoolFigure | null;
  nhsPct: PoolFigure | null;
  reportedValuePctFees: PoolFigure | null;
}

export interface PoolSummary {
  minCellSize: number;
  contributors: number | null; // null when the whole pool is below the threshold
  overall: PoolCell;
  byRegion: PoolCell[];
  byType: PoolCell[];
}

/** Keeps the first record for each contributor (callers pass newest first). */
export function onePerContributor<T extends { contributorKey: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.contributorKey) ? false : (seen.add(r.contributorKey), true)));
}

/** FNV-1a, so the offset is stable for the same data (it can't be averaged away by repeat requests). */
function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Median of values, moved by a deterministic offset in [-maxOffset, +maxOffset]
 * derived from the cell and its exact contents, then rounded to `step`. Any change
 * to the cell (such as one new contributor) re-draws the offset, so comparing two
 * releases doesn't reveal the new value either.
 */
export function protectedMedian(cellKey: string, values: number[], maxOffset: number, step: number): number | null {
  const d = distribution(values);
  if (d.median === null) return null;
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  const u = hash32(`${cellKey}|${sorted.join(',')}`) / 0xffffffff; // 0..1
  const offset = (u * 2 - 1) * maxOffset;
  return Math.round((d.median + offset) / step) * step;
}

function poolFigure(cellKey: string, values: Array<number | null>, maxOffset: number, step: number): PoolFigure | null {
  const clean = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (clean.length < POOL_MIN_CONTRIBUTORS) return null;
  const median = protectedMedian(cellKey, clean, maxOffset, step);
  return median === null ? null : { median };
}

function buildPoolCell(key: string, rows: PoolRecord[]): PoolCell {
  const owners = onePerContributor(rows);
  if (owners.length < POOL_MIN_CONTRIBUTORS) {
    return { key, suppressed: true, n: null, feesGbp: null, ownerMarginPct: null, nhsPct: null, reportedValuePctFees: null };
  }
  const medianFees = distribution(owners.map((r) => r.feesGbp)).median ?? 0;
  return {
    key,
    suppressed: false,
    // Counts are rounded down to the nearest 5 so small changes don't reveal a single new contributor.
    n: Math.floor(owners.length / 5) * 5,
    feesGbp: poolFigure(`${key}|fees`, owners.map((r) => r.feesGbp), medianFees * 0.05, 10000),
    ownerMarginPct: poolFigure(`${key}|margin`, owners.map((r) => r.ownerMarginPct), 2, 1),
    nhsPct: poolFigure(`${key}|nhs`, owners.map((r) => r.nhsPct), 5, 5),
    reportedValuePctFees: poolFigure(`${key}|value`, owners.map((r) => r.reportedValuePctFees), 5, 5),
  };
}

/**
 * Pool aggregates. Deliberately offers only fixed region and type facets (no free
 * price/date filters) so that differencing two queries can't isolate one practice.
 */
export function summarisePool(rows: PoolRecord[]): PoolSummary {
  const byRegion = groupBy(rows, (r) => r.region);
  const byType = groupBy(rows, (r) => r.type);
  const overall = buildPoolCell('All', rows);
  return {
    minCellSize: POOL_MIN_CONTRIBUTORS,
    contributors: overall.n,
    overall,
    byRegion: APP_REGIONS.map((k) => buildPoolCell(k, byRegion.get(k) || [])),
    byType: PRACTICE_TYPES.map((k) => buildPoolCell(k, byType.get(k) || [])),
  };
}

// ---------------------------------------------------------------------------
// Postcode area -> app region (England, Scotland, Wales). Northern Ireland,
// Isle of Man and the Channel Islands are not covered by the dataset.
// ---------------------------------------------------------------------------

const AREA_TO_REGION: Record<string, AppRegion> = {};
const assign = (region: AppRegion, areas: string) =>
  areas.split(' ').forEach((a) => (AREA_TO_REGION[a] = region));
assign('London & South East', 'E EC N NW SE SW W WC BR CR DA EN HA IG KT RM SM TW UB WD BN CT GU ME MK OX PO RG RH SL SO TN HP');
assign('East of England', 'AL CB CM CO IP LU NR PE SG SS');
assign('South West', 'BA BH BS DT EX GL PL SN SP TA TQ TR');
assign('Midlands', 'B CV DE DY HR LE LN NG NN ST TF WR WS WV SY');
assign('North West', 'BB BL CA CH CW FY L LA M OL PR SK WA WN');
assign('North East', 'DH DL NE SR TS');
assign('Yorkshire & Humber', 'BD DN HD HG HU HX LS S WF YO');
assign('Wales', 'CF LD LL NP SA');
assign('Scotland', 'AB DD DG EH FK G HS IV KA KW KY ML PA PH TD ZE');

/** "LS1 4AB", "ls14", "LS" -> "LS". Returns null if it doesn't look like a UK postcode start. */
export function postcodeArea(postcode: string): string | null {
  const m = String(postcode || '').trim().toUpperCase().match(/^([A-Z]{1,2})(\d|$)/);
  return m ? m[1] : null;
}

export function regionForPostcode(postcode: string): AppRegion | null {
  const area = postcodeArea(postcode);
  return area ? AREA_TO_REGION[area] || null : null;
}
