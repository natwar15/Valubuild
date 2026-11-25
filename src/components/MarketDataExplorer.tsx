import React, { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Database, Filter, Info, RotateCcw, ShieldCheck, Users } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { formatGbp } from '../utils/valuationEngine';
import type { Cell, ListingsSummary, PoolCell, PoolSummary } from '../shared/marketStats';
import { APP_REGIONS, LISTING_STATUSES, PRACTICE_TYPES } from '../shared/marketStats';

interface IndexRow {
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

interface Filters {
  regions: string[];
  types: string[];
  statuses: string[];
  tenure: string;
  minSurgeries: string;
  maxSurgeries: string;
  minPrice: string;
  maxPrice: string;
  from: string;
  to: string;
}

const EMPTY: Filters = {
  regions: [],
  types: [],
  statuses: [],
  tenure: 'Any',
  minSurgeries: '',
  maxSurgeries: '',
  minPrice: '',
  maxPrice: '',
  from: '',
  to: '',
};

// Categorical slots 1-4 (validated reference palette), fixed per segment.
const SEGMENT_COLORS: Record<string, string> = { all: '#257de0', nhs: '#f47230', mixed: '#00b894', private: '#f2a600' };
const SEGMENT_LABEL: Record<string, string> = { all: 'All practices', nhs: 'NHS', mixed: 'Mixed', private: 'Private' };
const ACCENT = '#A6521C';
const border = { borderColor: 'var(--color-border)' };

function toQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.regions.length) p.set('region', f.regions.join(','));
  if (f.types.length) p.set('type', f.types.join(','));
  if (f.statuses.length) p.set('status', f.statuses.join(','));
  if (f.tenure !== 'Any') p.set('tenure', f.tenure);
  for (const k of ['minSurgeries', 'maxSurgeries', 'minPrice', 'maxPrice', 'from', 'to'] as const) {
    if (f[k]) p.set(k, f[k]);
  }
  return p.toString();
}

const pct = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${Math.round(v)}%`);
const gbp = (v: number | null | undefined) => (v === null || v === undefined ? '–' : formatGbp(v));
const mult = (v: number | null | undefined) => (v === null || v === undefined ? '–' : `${v.toFixed(1)}x`);

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-2.5 py-1 rounded-[4px] border text-xs font-semibold transition-colors ${
      active ? 'bg-[#26231E] text-white border-[#26231E]' : 'bg-white text-[#6B6459] hover:text-[#26231E]'
    }`}
    style={active ? undefined : border}
  >
    {children}
  </button>
);

const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="p-4 rounded-[6px] border bg-white" style={border}>
    <span className="block text-[10px] font-bold uppercase tracking-wider text-[#6B6459]">{label}</span>
    <span className="block text-2xl font-bold text-[#26231E] mt-1" style={{ fontFamily: 'var(--font-heading)' }}>
      {value}
    </span>
    {sub && <span className="block text-xs text-[#6B6459] mt-0.5">{sub}</span>}
  </div>
);

const SUPPRESSED = 'Fewer than 5';

const CellTable: React.FC<{ title: string; cells: Cell[] }> = ({ title, cells }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B6459] border-b" style={border}>
          <th className="py-2 pr-3">{title}</th>
          <th className="py-2 pr-3 text-right">Listings</th>
          <th className="py-2 pr-3 text-right">Median asking</th>
          <th className="py-2 pr-3 text-right">Goodwill % fees (IQR)</th>
          <th className="py-2 text-right">x owner EBITDA</th>
        </tr>
      </thead>
      <tbody>
        {cells.map((c) => (
          <tr key={c.key} className="border-b last:border-0" style={border}>
            <td className="py-2 pr-3 font-semibold text-[#26231E]">{c.key}</td>
            {c.suppressed ? (
              <td colSpan={4} className="py-2 text-right text-[#6B6459] italic">
                {SUPPRESSED}
              </td>
            ) : (
              <>
                <td className="py-2 pr-3 text-right font-mono">{c.n}</td>
                <td className="py-2 pr-3 text-right font-mono">{gbp(c.askingGbp?.median)}</td>
                <td className="py-2 pr-3 text-right font-mono">
                  {pct(c.goodwillPctFees?.median)}{' '}
                  <span className="text-[#6B6459]">
                    {c.goodwillPctFees ? `(${pct(c.goodwillPctFees.p25)}–${pct(c.goodwillPctFees.p75)})` : ''}
                  </span>
                </td>
                <td className="py-2 text-right font-mono">{mult(c.askXOwnerEbitda?.median)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const PoolTable: React.FC<{ title: string; cells: PoolCell[] }> = ({ title, cells }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B6459] border-b" style={border}>
          <th className="py-2 pr-3">{title}</th>
          <th className="py-2 pr-3 text-right">Practices</th>
          <th className="py-2 pr-3 text-right">Median fees</th>
          <th className="py-2 pr-3 text-right">Owner margin</th>
          <th className="py-2 text-right">Reported value % fees</th>
        </tr>
      </thead>
      <tbody>
        {cells.map((c) => (
          <tr key={c.key} className="border-b last:border-0" style={border}>
            <td className="py-2 pr-3 font-semibold text-[#26231E]">{c.key}</td>
            {c.suppressed ? (
              <td colSpan={4} className="py-2 text-right text-[#6B6459] italic">
                {SUPPRESSED}
              </td>
            ) : (
              <>
                <td className="py-2 pr-3 text-right font-mono">{c.n}+</td>
                <td className="py-2 pr-3 text-right font-mono">{gbp(c.feesGbp?.median)}</td>
                <td className="py-2 pr-3 text-right font-mono">{pct(c.ownerMarginPct?.median)}</td>
                <td className="py-2 text-right font-mono">{pct(c.reportedValuePctFees?.median)}</td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export const MarketDataExplorer: React.FC<{ onStartValuation?: () => void }> = ({ onStartValuation }) => {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [summary, setSummary] = useState<ListingsSummary | null>(null);
  const [isSample, setIsSample] = useState(false);
  const [index, setIndex] = useState<IndexRow[]>([]);
  const [pool, setPool] = useState<PoolSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const query = toQuery(filters);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      apiFetch<{ summary: ListingsSummary; isSample: boolean }>(`/api/market/summary?${query}`)
        .then((d) => {
          if (cancelled) return;
          setSummary(d.summary);
          setIsSample(d.isSample);
          setError(null);
        })
        .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Unable to load market data.'))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    apiFetch<{ rows: IndexRow[] }>('/api/market/index').then((d) => setIndex(d.rows)).catch(() => setIndex([]));
    apiFetch<{ summary: PoolSummary }>('/api/pool/summary').then((d) => setPool(d.summary)).catch(() => setPool(null));
  }, []);

  const toggle = (key: 'regions' | 'types' | 'statuses', value: string) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value) ? f[key].filter((v) => v !== value) : [...f[key], value],
    }));
  const set = (key: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));

  // NASDAL goodwill as % of fees, by segment over time (published survey figures).
  const history = useMemo(() => {
    const rows = index.filter((r) => r.metric === 'goodwill_pct_fees' && SEGMENT_COLORS[r.segment]);
    const byPeriod = new Map<string, Record<string, number | string>>();
    for (const r of rows) {
      const p = byPeriod.get(r.periodEnd) || { periodEnd: r.periodEnd, label: r.periodLabel };
      p[r.segment] = r.value;
      byPeriod.set(r.periodEnd, p);
    }
    return Array.from(byPeriod.values()).sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)));
  }, [index]);
  const historySegments = Object.keys(SEGMENT_COLORS).filter((s) => history.some((h) => typeof h[s] === 'number'));

  const publishedFigures = useMemo(
    () =>
      index
        .filter((r) => r.metric !== 'goodwill_pct_fees')
        .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))
        .slice(0, 40),
    [index]
  );

  const regionChart = (summary?.byRegion || []).map((c) => ({
    region: c.key,
    median: c.suppressed ? null : c.goodwillPctFees?.median ?? null,
    n: c.n,
  }));

  const o = summary?.overall;

  return (
    <div className="space-y-6 text-left">
      <div className="bg-white border rounded-[6px] p-6 sm:p-8 space-y-6" style={border}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b" style={border}>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1 mb-2">
              <Database className="w-3.5 h-3.5" /> Free to use, no account needed
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#26231E]" style={{ fontFamily: 'var(--font-heading)' }}>
              UK dental practice market data
            </h2>
            <p className="text-sm text-[#6B6459] mt-1 max-w-3xl">
              Asking prices from public broker listings, published market surveys, and anonymised figures shared by
              practice owners. Filter by region, practice type, size, price and date.
            </p>
          </div>
          {onStartValuation && (
            <button type="button" onClick={onStartValuation} className="btn-primary text-xs !py-2.5 !px-4 whitespace-nowrap">
              Value my practice in 6 questions
            </button>
          )}
        </div>

        {isSample && (
          <div className="p-3 rounded-[6px] bg-amber-50 border border-amber-200 text-xs text-amber-900 flex gap-2">
            <Info className="w-4 h-4 flex-shrink-0" />
            <span>
              Showing synthetic sample data. Set <code>MARKET_DATA_DIR</code> on the server to load the real listings.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="p-4 rounded-[6px] bg-[#FAF8F4] border space-y-3" style={border}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#26231E] flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filters
            </span>
            <button
              type="button"
              onClick={() => setFilters(EMPTY)}
              className="text-xs font-semibold text-[#6B6459] hover:text-[#26231E] flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
          <div>
            <span className="block text-[10px] font-bold uppercase text-[#6B6459] mb-1">Region</span>
            <div className="flex flex-wrap gap-1.5">
              {APP_REGIONS.map((r) => (
                <Chip key={r} active={filters.regions.includes(r)} onClick={() => toggle('regions', r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <span className="block text-[10px] font-bold uppercase text-[#6B6459] mb-1">NHS / private mix</span>
              <div className="flex flex-wrap gap-1.5">
                {PRACTICE_TYPES.map((t) => (
                  <Chip key={t} active={filters.types.includes(t)} onClick={() => toggle('types', t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase text-[#6B6459] mb-1">Status</span>
              <div className="flex flex-wrap gap-1.5">
                {LISTING_STATUSES.map((s) => (
                  <Chip key={s} active={filters.statuses.includes(s)} onClick={() => toggle('statuses', s)}>
                    {s}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
            <label className="block">
              <span className="block text-[10px] font-bold uppercase text-[#6B6459] mb-1">Tenure</span>
              <select value={filters.tenure} onChange={set('tenure')} className="w-full px-2 py-1.5 rounded-[4px] border bg-white" style={border}>
                <option>Any</option>
                <option>Freehold</option>
                <option>Leasehold</option>
              </select>
            </label>
            {(
              [
                ['minSurgeries', 'Surgeries from', 'number', '1'],
                ['maxSurgeries', 'Surgeries to', 'number', '10'],
                ['minPrice', 'Asking from (£)', 'number', '250000'],
                ['maxPrice', 'Asking to (£)', 'number', '2000000'],
                ['from', 'Listed from', 'month', ''],
                ['to', 'Listed to', 'month', ''],
              ] as const
            ).map(([key, label, type, ph]) => (
              <label key={key} className="block">
                <span className="block text-[10px] font-bold uppercase text-[#6B6459] mb-1">{label}</span>
                <input
                  type={type}
                  min={type === 'number' ? 0 : undefined}
                  value={filters[key]}
                  placeholder={ph}
                  onChange={set(key)}
                  className="w-full px-2 py-1.5 rounded-[4px] border bg-white"
                  style={border}
                />
              </label>
            ))}
          </div>
        </div>

        {error && <div className="p-3 rounded-[6px] bg-red-50 border border-red-200 text-xs text-red-800">{error}</div>}

        {/* Headline figures */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${loading ? 'opacity-60' : ''}`}>
          {o && !o.suppressed ? (
            <>
              <Stat label="Listings matched" value={String(o.n)} sub={`of ${summary?.totalListings} in the dataset`} />
              <Stat label="Median asking price" value={gbp(o.askingGbp?.median)} sub={`middle half ${gbp(o.askingGbp?.p25)} to ${gbp(o.askingGbp?.p75)}`} />
              <Stat
                label="Goodwill as % of fees"
                value={pct(o.goodwillPctFees?.median)}
                sub={o.goodwillPctFees ? `middle half ${pct(o.goodwillPctFees.p25)} to ${pct(o.goodwillPctFees.p75)}` : 'not enough data'}
              />
              <Stat
                label="Asking ÷ owner EBITDA"
                value={mult(o.askXOwnerEbitda?.median)}
                sub={o.askXOwnerEbitda ? `${o.askXOwnerEbitda.n} listings with profit figures` : 'not enough data'}
              />
            </>
          ) : (
            <div className="col-span-full p-4 rounded-[6px] border bg-[#FAF8F4] text-sm text-[#6B6459]" style={border}>
              Fewer than {summary?.minCellSize ?? 5} listings match these filters, so figures are hidden. Widen the filters to see results.
            </div>
          )}
        </div>

        {/* Region chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 rounded-[6px] border" style={border}>
            <h3 className="text-sm font-bold text-[#26231E]">Median goodwill as % of fees, by region</h3>
            <p className="text-xs text-[#6B6459] mb-3">Regions with fewer than 5 matching listings are left blank.</p>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={regionChart} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid horizontal={false} stroke="#EFEAE2" />
                  <XAxis type="number" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6B6459' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="region" width={130} tick={{ fontSize: 11, fill: '#26231E' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#FAF5EE' }}
                    formatter={(v: unknown, _n: unknown, item: { payload?: { n?: number | null } }) =>
                      v === null || v === undefined ? [SUPPRESSED, 'Listings'] : [`${v}% (${item?.payload?.n} listings)`, 'Median']
                    }
                  />
                  <Bar dataKey="median" fill={ACCENT} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="p-4 rounded-[6px] border" style={border}>
            <h3 className="text-sm font-bold text-[#26231E]">Goodwill as % of fees over time</h3>
            <p className="text-xs text-[#6B6459] mb-3">Published NASDAL goodwill survey figures, by practice type.</p>
            {history.length > 0 ? (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ left: 0, right: 16, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="#EFEAE2" />
                    <XAxis dataKey="periodEnd" tickFormatter={(v: string) => v.slice(0, 7)} tick={{ fontSize: 11, fill: '#6B6459' }} axisLine={false} tickLine={false} minTickGap={24} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#6B6459' }} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} />
                    <Tooltip labelFormatter={(_l, p) => String((p?.[0]?.payload as { label?: string })?.label ?? '')} formatter={(v: unknown, name: unknown) => [`${v}%`, SEGMENT_LABEL[String(name)] || String(name)]} />
                    <Legend formatter={(v: string) => SEGMENT_LABEL[v] || v} wrapperStyle={{ fontSize: 11 }} />
                    {historySegments.map((s) => (
                      <Line key={s} type="monotone" dataKey={s} stroke={SEGMENT_COLORS[s]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-xs text-[#6B6459] italic">Historical survey data has not been loaded on this server yet.</p>
            )}
          </div>
        </div>

        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 rounded-[6px] border space-y-2" style={border}>
              <h3 className="text-sm font-bold text-[#26231E]">By practice type</h3>
              <CellTable title="Type" cells={summary.byType} />
            </div>
            <div className="p-4 rounded-[6px] border space-y-2" style={border}>
              <h3 className="text-sm font-bold text-[#26231E]">By number of surgeries</h3>
              <CellTable title="Surgeries" cells={summary.bySurgeries} />
            </div>
            <div className="p-4 rounded-[6px] border space-y-2 lg:col-span-2" style={border}>
              <h3 className="text-sm font-bold text-[#26231E]">By region</h3>
              <CellTable title="Region" cells={summary.byRegion} />
            </div>
          </div>
        )}

        {/* Pool */}
        <div className="p-4 rounded-[6px] border space-y-3" style={border}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[#26231E] flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#A6521C]" /> Shared by practice owners
            </h3>
            <span className="text-[11px] text-[#6B6459] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Groups of 5 or more only. Counts rounded down to the nearest 5.
            </span>
          </div>
          {pool && pool.contributors !== null ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PoolTable title="Region" cells={pool.byRegion} />
              <PoolTable title="Type" cells={pool.byType} />
            </div>
          ) : (
            <p className="text-xs text-[#6B6459]">
              Not enough owners have shared their figures yet to show anything without risking identifying a practice. Every
              owner who values their practice and opts in makes these benchmarks better for everyone.
            </p>
          )}
        </div>

        {publishedFigures.length > 0 && (
          <details className="p-4 rounded-[6px] border" style={border}>
            <summary className="text-sm font-bold text-[#26231E] cursor-pointer">Other published market figures ({publishedFigures.length} most recent)</summary>
            <div className="overflow-x-auto mt-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-[#6B6459] border-b" style={border}>
                    <th className="py-2 pr-3">Period</th>
                    <th className="py-2 pr-3">Measure</th>
                    <th className="py-2 pr-3">Segment</th>
                    <th className="py-2 pr-3 text-right">Value</th>
                    <th className="py-2">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {publishedFigures.map((r, i) => (
                    <tr key={i} className="border-b last:border-0" style={border}>
                      <td className="py-1.5 pr-3 whitespace-nowrap">{r.periodLabel}</td>
                      <td className="py-1.5 pr-3">{r.metric.replace(/_/g, ' ')}</td>
                      <td className="py-1.5 pr-3">{r.segment.replace(/_/g, ' ')}</td>
                      <td className="py-1.5 pr-3 text-right font-mono whitespace-nowrap">
                        {r.value} <span className="text-[#6B6459]">{r.unit}</span>
                      </td>
                      <td className="py-1.5">
                        {r.sourceUrl ? (
                          <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline text-[#A6521C]">
                            {r.source}
                          </a>
                        ) : (
                          r.source
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        <p className="text-[11px] text-[#6B6459]">
          Listing figures are broker asking prices, not agreed prices. Individual listings, broker references and locations
          below region level are not shown. Figures are a guide, not a formal valuation.
        </p>
      </div>
    </div>
  );
};
