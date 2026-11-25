import React, { useState } from 'react';
import { SCHEDULE_OF_SALES_EVIDENCE, UK_REGIONAL_BENCHMARKS, UK_NATIONAL_AVERAGES } from '../data/ukMarketData';
import { UkRegion } from '../types';
import { formatGbp } from '../utils/valuationEngine';
import {
  TrendingUp,
  Building,
  Layers,
  Search,
  ExternalLink,
  ShieldCheck,
  Compass,
  ArrowUpRight,
  Filter,
} from 'lucide-react';

interface MarketIntelligenceProps {
  onSelectRegion?: (region: UkRegion) => void;
}

export const MarketIntelligence: React.FC<MarketIntelligenceProps> = ({ onSelectRegion }) => {
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('All');
  const [practiceTypeFilter, setPracticeTypeFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDeals = SCHEDULE_OF_SALES_EVIDENCE.filter((deal) => {
    const matchesRegion = selectedRegionFilter === 'All' || deal.region === selectedRegionFilter;
    const matchesType =
      practiceTypeFilter === 'All' ||
      (practiceTypeFilter === 'NHS' && deal.percentageNhs.includes('NHS')) ||
      (practiceTypeFilter === 'Private' && deal.percentageNhs.includes('Private')) ||
      (practiceTypeFilter === 'Mixed' && deal.percentageNhs.includes('Mixed'));
    const matchesQuery =
      deal.town.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.county.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.percentageNhs.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.ypMultiplier.toString().includes(searchQuery);
    return matchesRegion && matchesType && matchesQuery;
  });

  return (
    <div className="space-y-10 text-left">
      {/* Overview Banner */}
      <div
        className="p-6 sm:p-8 rounded-[6px] border text-left"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 mb-6 border-b gap-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ backgroundColor: '#FAF5EE', color: 'var(--color-accent)' }}
              >
                Official Valuation Evidence Schedule
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                RICS Bank Valuation Panel Records · 2024–2026
              </span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              UK Dental Practice Sales &amp; YP Multiplier Comps
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Actual verified transaction comps from professional valuation reports across NHS, mixed, private, and specialist dental practices in Great Britain.
            </p>
          </div>

          {/* High-level stats */}
          <div className="flex items-center gap-6 text-left">
            <div>
              <span className="text-xs uppercase font-bold text-gray-500 block">Average YP Multiplier</span>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
                6.10 YP
              </span>
            </div>
            <div className="border-l pl-6" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs uppercase font-bold text-gray-500 block">Top Multiplier Recorded</span>
              <span className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-accent)' }}>
                9.55 YP
              </span>
            </div>
          </div>
        </div>

        {/* 4 Practice Type Multiplier Bands */}
        <h3 className="text-xs font-bold uppercase tracking-wider mb-4 text-gray-500">
          UK Dental Valuation Multiplier Spread by Practice Model
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs font-mono font-bold text-red-700 block mb-1">
              1. NHS CONTRACT HEAVY
            </span>
            <div className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              3.50 – 5.50 YP
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              &gt;80% GDS contract, standard UDA rates (£28–£34), clawback underperformance risk, single principal dependence.
            </p>
          </div>

          <div className="p-4 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs font-mono font-bold text-amber-700 block mb-1">
              2. MIXED PRACTICE
            </span>
            <div className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              6.50 – 7.80 YP
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              High UDA rates (£36–£42+), balanced private fee-per-item and Denplan patients, established associate agreements.
            </p>
          </div>

          <div className="p-4 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
            <span className="text-xs font-mono font-bold text-emerald-700 block mb-1">
              3. PRIVATE &amp; CAPITATION
            </span>
            <div className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              8.00 – 10.00 YP
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              &gt;40% monthly Denplan / Practice Plan direct debits, associate-led, low patient churn, direct access hygiene.
            </p>
          </div>

          <div className="p-4 rounded-[6px] border bg-[#FAF5EE]" style={{ borderColor: '#D6BC9E' }}>
            <span className="text-xs font-mono font-bold text-[#A6521C] block mb-1">
              4. SPECIALIST CENTRE
            </span>
            <div className="text-xl font-bold mb-1 text-[#A6521C]" style={{ fontFamily: 'var(--font-heading)' }}>
              9.50 – 12.00 YP
            </div>
            <p className="text-xs text-[#8A4215] leading-relaxed">
              Tertiary referrals (Implantology, Ortho, Endo, CBCT 3D imaging), multi-surgery clinical hub in affluent catchment.
            </p>
          </div>
        </div>
      </div>

      {/* SCHEDULE OF SALES TRANSACTIONS (From Bank Report Appendix 4) */}
      <div
        className="p-6 sm:p-8 rounded-[6px] border overflow-x-auto"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b gap-4" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <h3
              className="text-xl font-bold text-gray-900"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Schedule of Dental Practice Sales Evidence
            </h3>
            <p className="text-xs text-gray-500">
              Extracted from RICS valuation comparables relied upon by UK commercial lending institutions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search town, county, YP..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded border outline-none w-48"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            {/* Practice Type Filter */}
            <select
              value={practiceTypeFilter}
              onChange={(e) => setPracticeTypeFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded border outline-none"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <option value="All">All Types</option>
              <option value="NHS">NHS Contracts</option>
              <option value="Private">Private / Plan</option>
              <option value="Mixed">Mixed Practices</option>
            </select>

            {/* Region select filter */}
            <select
              value={selectedRegionFilter}
              onChange={(e) => setSelectedRegionFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded border outline-none"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <option value="All">All Regions</option>
              {Object.keys(UK_REGIONAL_BENCHMARKS).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Schedule Table */}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs font-bold uppercase text-gray-600 bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
              <th className="py-3 px-3">Town / Location</th>
              <th className="py-3 px-3">County / Region</th>
              <th className="py-3 px-3">Revenue Profile</th>
              <th className="py-3 px-3 text-right">Turnover</th>
              <th className="py-3 px-3 text-right">EBITDA</th>
              <th className="py-3 px-3 text-right">EBITDA %</th>
              <th className="py-3 px-3 text-right">YP Multiplier</th>
              <th className="py-3 px-3 text-right font-bold text-[#A6521C]">Purchase Price</th>
            </tr>
          </thead>
          <tbody className="divide-y text-xs sm:text-sm" style={{ borderColor: 'var(--color-border)' }}>
            {filteredDeals.map((deal) => (
              <tr key={deal.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="py-3 px-3 font-semibold text-gray-900">
                  {deal.town}
                  {deal.isOwnerOperated && <span className="text-[10px] text-gray-500 block font-normal">(Owner-Operated)</span>}
                  {deal.isFreehold && <span className="text-[10px] text-emerald-700 block font-normal">(Freehold Transacted)</span>}
                </td>
                <td className="py-3 px-3 text-gray-700">{deal.county} ({deal.region})</td>
                <td className="py-3 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    deal.percentageNhs.includes('Private')
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}>
                    {deal.percentageNhs}
                  </span>
                </td>
                <td className="py-3 px-3 text-right font-mono">{formatGbp(deal.turnover)}</td>
                <td className="py-3 px-3 text-right font-mono font-medium">{formatGbp(deal.ebitda)}</td>
                <td className="py-3 px-3 text-right font-mono">{deal.ebitdaPercent.toFixed(1)}%</td>
                <td className="py-3 px-3 text-right font-bold font-mono text-gray-900">
                  {deal.ypMultiplier.toFixed(2)} YP
                </td>
                <td className="py-3 px-3 text-right font-bold font-mono text-[#A6521C]">
                  {formatGbp(deal.purchasePrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 pt-3 border-t text-xs text-gray-500 flex flex-wrap justify-between items-center" style={{ borderColor: 'var(--color-border)' }}>
          <span>* YP (Years Purchase) is the capitalisation multiple applied to Fair Maintainable Operating Profit (EBITDA).</span>
          <span>Source: RICS Registered Valuer Bank Comps Appendix 4</span>
        </div>
      </div>
    </div>
  );
};
