/**
 * Back-test the detailed valuation engine against broker asking prices.
 *
 * Reads the private listings file (listings_all.csv) from MARKET_DATA_DIR
 * (default data/market, git-ignored). Row-level listings must never be
 * committed; this script only prints aggregates.
 *
 *   MARKET_DATA_DIR=/path/to/market-data npx tsx scripts/engineBacktest.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { calculateDentalValuation } from '../src/utils/valuationEngine.ts';
import type { DentalIntakeData, PracticeType, UkRegion } from '../src/types.ts';

/**
 * Brokers excluded from calibration. The 2026-11-25 data audit found this
 * broker's rows look like demo/placeholder content (US-city refs, unrounded
 * prices). Remove from this list once the rows are confirmed genuine.
 */
export const EXCLUDED_SOURCES = ['Dental Practice Sale (Derby)'];

const REGIONS: UkRegion[] = [
  'London & South East', 'Midlands', 'North West', 'Yorkshire & Humber', 'South West',
  'East of England', 'Scotland', 'Wales', 'North East',
];

const TYPE_MAP: Record<string, PracticeType> = {
  NHS: 'NHS Practice',
  Mixed: 'Mixed Practice',
  Private: 'Private Practice',
  Specialist: 'Specialist Practice',
};

/**
 * NHS share of fees assumed when a listing doesn't split its income.
 * ASSUMPTION: mid-points of the PFM-style bands used to label the listings
 * (75%+ NHS = NHS, 10-75% = Mixed).
 */
const DEFAULT_NHS_SHARE: Record<PracticeType, number> = {
  'NHS Practice': 0.85,
  'Mixed Practice': 0.4,
  'Private Practice': 0.03,
  'Specialist Practice': 0,
};

export interface BacktestCase {
  /** Listing identity (source + ref), shared by the cases of one listing. */
  key: string;
  type: PracticeType;
  region: UkRegion;
  fees: number;
  /** Asking price for goodwill only (leasehold, or property split out). */
  goodwillAsk: number;
  intake: DentalIntakeData;
  ebitdaBasis: 'owner_operated' | 'associate_led' | 'none';
}

export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [header, ...body] = rows.filter((r) => r.some((v) => v !== ''));
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const num = (v: string | undefined): number | undefined => {
  if (v === undefined || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Tenure codes where the asking price can include the building. */
const FREEHOLD_TENURES = new Set(['F', 'F/L', 'VF', 'VF/L', 'Freehold', 'Any']);

/**
 * One case per profit figure the listing publishes: owner-operated EBITDA,
 * associate-led EBITDA, or (if neither) fees only. A listing that publishes
 * both is tested on both bases, which checks the two give the same answer.
 */
export function listingToCases(r: Record<string, string>): BacktestCase[] {
  const owner = num(r.ebitda_owner);
  const assoc = num(r.ebitda_assoc);
  const out: BacktestCase[] = [];
  if (owner) out.push(...listingToCase(r, 'owner_operated'));
  if (assoc) out.push(...listingToCase(r, 'associate_led'));
  if (!owner && !assoc) out.push(...listingToCase(r, 'none'));
  return out;
}

function listingToCase(r: Record<string, string>, ebitdaBasis: BacktestCase['ebitdaBasis']): BacktestCase[] {
  if (r.use_in_analysis !== 'yes' || EXCLUDED_SOURCES.includes(r.source)) return [];
  const type = TYPE_MAP[r.type];
  const region = REGIONS.find((x) => x === r.app_region);
  const fees = num(r.fees);
  if (!type || !region || !fees) return [];

  // Goodwill only: skip freeholds whose asking price still contains the property.
  const freeholdSplit = num(r.freehold_in_price);
  if (FREEHOLD_TENURES.has(r.tenure.trim()) && !freeholdSplit) return [];
  const goodwillAsk = num(r.goodwill_ask);
  if (!goodwillAsk || goodwillAsk <= 0) return [];

  // ASSUMPTION: listings don't publish chair hours. Most are principal-led
  // (they quote owner-operated profit), so assume ~30 hours. The
  // associate-led case keeps the same practice and hours; only the profit
  // figure and its basis change.
  const chairHours = 30;
  const profit = ebitdaBasis === 'owner_operated' ? num(r.ebitda_owner) : ebitdaBasis === 'associate_led' ? num(r.ebitda_assoc) : undefined;

  const nhs = num(r.nhs) ?? Math.round(fees * DEFAULT_NHS_SHARE[type]);
  const plan = num(r.plan) ?? 0;
  const priv = num(r.private) ?? Math.max(fees - nhs - plan, 0);

  const intake: DentalIntakeData = {
    practiceName: 'Back-test listing',
    practiceType: type,
    address: '-',
    postcode: '-',
    region,
    yearsEstablished: 15,
    surgeriesCount: num(r.surgeries) ?? 3,
    floorAreaSqFt: 1800,
    tenure: 'Leasehold',
    hasDeconRoom: true,
    hasOpgCbctRoom: false,
    disabledAccess: true,
    turnover: fees,
    nhsAnnualValue: nhs,
    udaRequirement: 0,
    // ASSUMPTION: listings don't publish UDA rates; use a mid-market rate so the
    // UDA drivers stay neutral.
    udaRate: type === 'NHS Practice' || type === 'Mixed Practice' ? 33 : 0,
    clawbackAmount: 0,
    privateFpiTurnover: priv,
    privatePlanTurnover: plan,
    specialistReferralTurnover: 0,
    materialsAndLabCostPercent: 0,
    directAssociateTherapistCostPercent: 0,
    staffWagesPa: 0,
    adjustedEbitda: profit ?? 0,
    ...(ebitdaBasis !== 'none' ? { ebitdaBasis } : {}),
    principalChairHoursPerWeek: chairHours,
    associateRemunerationModel: 'percentage_split_bda',
    associateContracts: 'informal_some_covenants',
    surgeryChairUtilisationPercent: 80,
    hygieneTherapistModel: 'direct_access_active',
    cqcStatus: 'Good / Outstanding',
  } as DentalIntakeData;

  return [{ key: `${r.source}|${r.ref}`, type, region, fees, goodwillAsk, intake, ebitdaBasis }];
}

export function loadBacktestCases(dir = process.env.MARKET_DATA_DIR || 'data/market'): BacktestCase[] | null {
  const file = path.resolve(dir, 'listings_all.csv');
  if (!fs.existsSync(file)) return null;
  const rows = parseCsv(fs.readFileSync(file, 'utf8'));
  // Use the latest observation of each listing.
  const latest = new Map<string, Record<string, string>>();
  for (const r of rows) {
    const key = `${r.source}|${r.ref}`;
    const prev = latest.get(key);
    if (!prev || r.observed_date > prev.observed_date) latest.set(key, r);
  }
  return [...latest.values()].flatMap(listingToCases);
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export interface BacktestStats {
  n: number;
  /** Median of engine goodwill / asking goodwill (1 = unbiased). */
  medianRatio: number;
  /** Median absolute % error vs asking goodwill. */
  medianAbsPctError: number;
  /** Share of cases within +/-25% of the asking price. */
  within25Pct: number;
  /** Median engine goodwill as % of fees, next to the listings' median. */
  engineMedianPctFees: number;
  askMedianPctFees: number;
}

export function scoreCases(cases: BacktestCase[]): BacktestStats {
  const ratios: number[] = [];
  const enginePct: number[] = [];
  const askPct: number[] = [];
  for (const c of cases) {
    const v = calculateDentalValuation(c.intake).mv1MarketValueGoodwill;
    ratios.push(v / c.goodwillAsk);
    enginePct.push((v / c.fees) * 100);
    askPct.push((c.goodwillAsk / c.fees) * 100);
  }
  const abs = ratios.map((r) => Math.abs(r - 1) * 100);
  return {
    n: cases.length,
    medianRatio: round(median(ratios), 3),
    medianAbsPctError: round(median(abs), 1),
    within25Pct: round((abs.filter((e) => e <= 25).length / Math.max(cases.length, 1)) * 100, 1),
    engineMedianPctFees: round(median(enginePct), 1),
    askMedianPctFees: round(median(askPct), 1),
  };
}

const round = (x: number, dp: number) => Math.round(x * 10 ** dp) / 10 ** dp;

/**
 * Groups for the report. "All" counts each listing once, preferring its
 * owner-operated profit, so listings with two profit figures aren't double-counted.
 */
export function backtestReport(cases: BacktestCase[]) {
  const seen = new Set<string>();
  const primary = cases.filter((c) => !seen.has(c.key) && seen.add(c.key));
  const groups: Record<string, BacktestCase[]> = { 'All listings': primary };
  for (const c of primary) (groups[c.type] ??= []).push(c);
  for (const c of cases) (groups[`Profit given: ${c.ebitdaBasis}`] ??= []).push(c);
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, scoreCases(v)]));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const cases = loadBacktestCases();
  if (!cases) {
    console.error('No listings_all.csv found. Set MARKET_DATA_DIR to the private market-data folder.');
    process.exit(1);
  }
  console.table(backtestReport(cases));
}
