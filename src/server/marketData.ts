/**
 * Loads the public market data the explorer and quick valuation are built on.
 *
 * The raw files are NOT committed to this (public) repository. Point
 * MARKET_DATA_DIR at a folder containing any of:
 *   - listings_all.csv               one row per listing observation (has observed_date)
 *   - uk_dental_listings_YYYY-MM.csv monthly snapshots (observed date taken from the file name)
 *   - market_index.csv               published market figures (NASDAL, Christie & Co, ...)
 *
 * Only the normalised fields in ListingRecord are kept in memory: broker refs,
 * counties, notes and source URLs are dropped at load time and never reach the API.
 * If no files are found, a small clearly-labelled synthetic sample is used so the
 * app still works in development.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  APP_REGIONS,
  AppRegion,
  ListingRecord,
  ListingStatus,
  PRACTICE_TYPES,
  PracticeType,
  Tenure,
} from '../shared/marketStats.ts';

export interface MarketIndexRow {
  periodEnd: string;
  periodLabel: string;
  source: string;
  metric: string;
  segment: string;
  value: number;
  unit: string;
  sourceUrl: string;
  notes: string;
}

export interface MarketDataset {
  listings: ListingRecord[];
  index: MarketIndexRow[];
  isSample: boolean;
  loadedAt: string;
  files: string[];
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((v) => v.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const num = (v: string | undefined): number | null => {
  if (v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[£,%\s]/g, ''));
  return Number.isFinite(n) ? n : null;
};

function normRegion(v: string): AppRegion | null {
  return (APP_REGIONS as readonly string[]).includes(v) ? (v as AppRegion) : null;
}

function normType(v: string): PracticeType | null {
  const t = v.trim().toLowerCase();
  const hit = PRACTICE_TYPES.find((p) => p.toLowerCase() === t);
  return hit || null;
}

export function normTenure(v: string): Tenure {
  const t = v.trim().toUpperCase();
  const hasF = /(^|\/)(F|VF|FREEHOLD)($|\/)/.test(t);
  const hasL = /(^|\/)(L|LEASEHOLD|LONG LEASEHOLD)($|\/)/.test(t);
  if (hasF && hasL) return 'Either';
  if (hasF) return 'Freehold';
  if (hasL) return 'Leasehold';
  if (t === 'ANY') return 'Either';
  return 'Unknown';
}

export function normStatus(v: string): ListingStatus {
  const s = v.trim().toLowerCase();
  if (s === 'sold' || s === 'completed') return 'Sold';
  if (s === 'sstc' || s.includes('offer') || s.includes('reserved')) return 'Under offer';
  return 'Available';
}

const STATUS_NORM: Record<string, ListingStatus> = { on_market: 'Available', sold_stc: 'Under offer', sold: 'Sold' };

export function toListing(r: Record<string, string>, fallbackDate: string): ListingRecord {
  const surgeries = num(r.surgeries);
  const key = r.source && r.ref ? crypto.createHash('sha256').update(`${r.source}|${r.ref}`).digest('hex').slice(0, 16) : undefined;
  return {
    observedDate: /^\d{4}-\d{2}-\d{2}$/.test(r.observed_date || '') ? r.observed_date : fallbackDate,
    region: normRegion(r.app_region || ''),
    type: normType(r.type || ''),
    surgeries: surgeries !== null && surgeries > 0 && surgeries <= 30 ? surgeries : null,
    tenure: normTenure(r.tenure || ''),
    status: STATUS_NORM[r.status_norm || ''] || normStatus(r.status || ''),
    fees: num(r.fees),
    askingGbp: num(r.asking),
    goodwillAskGbp: num(r.goodwill_ask),
    goodwillPctFees: num(r.goodwill_pct_fees),
    askXOwnerEbitda: num(r.ask_x_owner_ebitda),
    askXAssocEbitda: num(r.ask_x_assoc_ebitda),
    ownerMarginPct: num(r.owner_margin_pct),
    useInAnalysis: (r.use_in_analysis || '').toLowerCase() === 'yes',
    listingKey: key,
  };
}

function toIndexRow(r: Record<string, string>): MarketIndexRow | null {
  const value = num(r.value);
  if (value === null || !r.metric) return null;
  return {
    periodEnd: r.period_end || '',
    periodLabel: r.period_label || r.period_end || '',
    source: r.source || '',
    metric: r.metric,
    segment: r.segment || 'all',
    value,
    unit: r.unit || '',
    sourceUrl: /^https?:\/\//.test(r.source_url || '') ? r.source_url : '',
    notes: r.notes || '',
  };
}

/** Deterministic synthetic sample so a fresh checkout has something to show. */
export function syntheticSample(): ListingRecord[] {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const regionPct: Record<AppRegion, number> = {
    'London & South East': 160,
    'East of England': 140,
    'South West': 135,
    Midlands: 125,
    'North West': 120,
    'North East': 110,
    'Yorkshire & Humber': 105,
    Scotland: 100,
    Wales: 110,
  };
  const typeAdj: Record<PracticeType, number> = { NHS: 0.85, Mixed: 1, Private: 1.1, Specialist: 1.15 };
  const out: ListingRecord[] = [];
  for (let i = 0; i < 240; i++) {
    const region = APP_REGIONS[Math.floor(rand() * APP_REGIONS.length)];
    const type = PRACTICE_TYPES[Math.min(3, Math.floor(rand() * 3.3))];
    const surgeries = 1 + Math.floor(rand() * 6);
    const fees = Math.round((150000 + surgeries * 120000 * (0.7 + rand() * 0.6)) / 1000) * 1000;
    const pct = regionPct[region] * typeAdj[type] * (0.75 + rand() * 0.5);
    const goodwill = Math.round((fees * pct) / 100 / 5000) * 5000;
    const margin = 25 + rand() * 20;
    const month = 1 + Math.floor(rand() * 11);
    out.push({
      observedDate: `2026-${String(month).padStart(2, '0')}-01`,
      region,
      type,
      surgeries,
      tenure: rand() < 0.35 ? 'Freehold' : 'Leasehold',
      status: (['Available', 'Under offer', 'Sold'] as const)[Math.floor(rand() * 3)],
      fees,
      askingGbp: goodwill,
      goodwillAskGbp: goodwill,
      goodwillPctFees: Math.round((goodwill / fees) * 1000) / 10,
      askXOwnerEbitda: Math.round((goodwill / ((fees * margin) / 100)) * 100) / 100,
      askXAssocEbitda: null,
      ownerMarginPct: Math.round(margin * 10) / 10,
      useInAnalysis: true,
    });
  }
  return out;
}

export function loadMarketData(dir = process.env.MARKET_DATA_DIR || 'data/market'): MarketDataset {
  const abs = path.resolve(dir);
  const listings: ListingRecord[] = [];
  const index: MarketIndexRow[] = [];
  const files: string[] = [];

  if (fs.existsSync(abs)) {
    const names = fs.readdirSync(abs);
    const all = names.find((n) => n === 'listings_all.csv');
    const monthly = names.filter((n) => /^uk_dental_listings_\d{4}-\d{2}\.csv$/.test(n)).sort();
    const listingFiles = all ? [all] : monthly;
    for (const name of listingFiles) {
      const ym = name.match(/(\d{4}-\d{2})/)?.[1];
      const fallbackDate = ym ? `${ym}-01` : new Date().toISOString().slice(0, 10);
      for (const r of parseCsv(fs.readFileSync(path.join(abs, name), 'utf8'))) {
        listings.push(toListing(r, fallbackDate));
      }
      files.push(name);
    }
    if (names.includes('market_index.csv')) {
      for (const r of parseCsv(fs.readFileSync(path.join(abs, 'market_index.csv'), 'utf8'))) {
        const row = toIndexRow(r);
        if (row) index.push(row);
      }
      files.push('market_index.csv');
    }
  }

  const isSample = listings.length === 0;
  return {
    listings: isSample ? syntheticSample() : listings,
    index,
    isSample,
    loadedAt: new Date().toISOString(),
    files,
  };
}

let cache: MarketDataset | null = null;
let cacheAt = 0;
const CACHE_MS = 10 * 60 * 1000;

/** Cached for 10 minutes so dropping new files into MARKET_DATA_DIR is picked up without a restart. */
export function getMarketData(): MarketDataset {
  if (!cache || Date.now() - cacheAt > CACHE_MS) {
    cache = loadMarketData();
    cacheAt = Date.now();
  }
  return cache;
}
