import React, { useState } from 'react';
import { UK_REGIONAL_BENCHMARKS, UK_NATIONAL_AVERAGES } from '../data/ukMarketData';
import { DentalIntakeData, UkRegion } from '../types';
import {
  MapPin,
  TrendingUp,
  BarChart3,
  Award,
  ArrowRight,
  Compass,
  CheckCircle2,
  Stethoscope,
} from 'lucide-react';

interface RegionalBenchmarkProps {
  intakeData: DentalIntakeData;
  onSelectRegion: (region: UkRegion) => void;
}

export const RegionalBenchmark: React.FC<RegionalBenchmarkProps> = ({
  intakeData,
  onSelectRegion,
}) => {
  const [selectedRegion, setSelectedRegion] = useState<UkRegion>(intakeData.region);
  const regionStats = UK_REGIONAL_BENCHMARKS[selectedRegion];
  const safeTurnover = Math.max(intakeData.turnover || 100000, 1);
  const userMargin = (((intakeData.adjustedEbitda || 250000) / safeTurnover) * 100).toFixed(1);
  const userPlanMix = Math.round(((intakeData.privatePlanTurnover || 0) / safeTurnover) * 100);
  const userChairUtilisation = intakeData.surgeryChairUtilisationPercent || 70;

  return (
    <div className="space-y-10 text-left">
      {/* Top Banner */}
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
                Local vs National Dental Benchmarks
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                British Dental Practice M&amp;A Index
              </span>
            </div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
            >
              Benchmark Your Dental Clinic Against Local &amp; National Comps
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              See how your practice EBITDA margin, Denplan/private list density, and corporate valuation multiples compare across the UK.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase text-gray-500">Selected Region:</label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                const reg = e.target.value as UkRegion;
                setSelectedRegion(reg);
                onSelectRegion(reg);
              }}
              className="px-3 py-2 rounded-[6px] border text-sm font-semibold outline-none"
              style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
            >
              {Object.keys(UK_REGIONAL_BENCHMARKS).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 3-Way Comparative Cards: Your Practice vs Local Region vs UK National */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Card 1: Your Practice */}
          <div
            className="p-5 rounded-[6px] border flex flex-col justify-between"
            style={{
              backgroundColor: '#FAF5EE',
              borderColor: '#D6BC9E',
            }}
          >
            <div>
              <span className="text-xs font-mono font-bold text-[#A6521C] uppercase block mb-1">
                YOUR PRACTICE
              </span>
              <h3 className="text-lg font-bold mb-3 text-[#26231E]">
                {intakeData.practiceName || 'Your Dental Clinic'}
              </h3>

              <div className="space-y-3 pt-3 border-t border-[#D6BC9E]/60 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Surgeries (Chairs):</span>
                  <span className="font-bold text-[#A6521C]">{intakeData.surgeriesCount} Surgeries</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">EBITDA Margin:</span>
                  <span className="font-bold text-[#A6521C]">{userMargin}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Monthly Plan (Denplan) %:</span>
                  <span className="font-bold text-[#A6521C]">{userPlanMix}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Chair Utilisation:</span>
                  <span className="font-bold text-[#A6521C]">{userChairUtilisation}%</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-[#D6BC9E]/60 text-[11px] text-[#8A4215]">
              Metrics populated from your active practice intake.
            </div>
          </div>

          {/* Card 2: Local Region */}
          <div
            className="p-5 rounded-[6px] border flex flex-col justify-between bg-[#FAF8F4]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div>
              <span className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">
                LOCAL REGIONAL BENCHMARK
              </span>
              <h3 className="text-lg font-bold mb-3 text-[#26231E]">
                {selectedRegion}
              </h3>

              <div className="space-y-3 pt-3 border-t border-gray-200 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg EBITDA Margin:</span>
                  <span className="font-bold">{regionStats.avgEbitdaMarginPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Private/Plan Share:</span>
                  <span className="font-bold">{regionStats.avgPrivateCapitationPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Base EBITDA Multiple:</span>
                  <span className="font-bold">{regionStats.averageEbitdaMultiple}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Premium Multiple:</span>
                  <span className="font-bold text-green-700">{regionStats.premiumEbitdaMultiple}x</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500">
              {regionStats.activeRollupPlatforms} corporate dental groups actively acquiring in this region.
            </div>
          </div>

          {/* Card 3: UK National Average */}
          <div
            className="p-5 rounded-[6px] border flex flex-col justify-between bg-[#FAF8F4]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <div>
              <span className="text-xs font-mono font-bold text-gray-500 uppercase block mb-1">
                UK NATIONAL BENCHMARK
              </span>
              <h3 className="text-lg font-bold mb-3 text-[#26231E]">
                British Dentistry Overall
              </h3>

              <div className="space-y-3 pt-3 border-t border-gray-200 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">National EBITDA Margin:</span>
                  <span className="font-bold">{UK_NATIONAL_AVERAGES.avgEbitdaMarginPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">National Private/Plan:</span>
                  <span className="font-bold">{UK_NATIONAL_AVERAGES.avgPrivateCapitationPercent}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">National Base Multiple:</span>
                  <span className="font-bold">{UK_NATIONAL_AVERAGES.averageEbitdaMultiple}x</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">National Premium Multiple:</span>
                  <span className="font-bold text-green-700">{UK_NATIONAL_AVERAGES.premiumEbitdaMultiple}x</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500">
              {UK_NATIONAL_AVERAGES.totalDealsLast12Months} dental practice acquisitions logged across the UK in 12 months.
            </div>
          </div>
        </div>

        {/* Visual Benchmark Gauges */}
        <div className="space-y-6 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Comparative Clinical &amp; Commercial Diagnostics
          </h4>

          {/* Metric 1: Monthly Patient Capitation % */}
          <div>
            <div className="flex justify-between text-sm font-semibold mb-1.5">
              <span>Monthly Recurring Capitation (Denplan / Practice Plan)</span>
              <span>
                Your practice: <strong>{userPlanMix}%</strong> · Local ({selectedRegion}): <strong>{regionStats.avgPrivateCapitationPercent}%</strong> · UK National: <strong>{UK_NATIONAL_AVERAGES.avgPrivateCapitationPercent}%</strong>
              </span>
            </div>
            <div className="w-full h-3.5 rounded-full bg-gray-200 relative overflow-hidden flex">
              <div
                className="h-full bg-[#A6521C]"
                style={{ width: `${Math.min(userPlanMix * 1.5, 100)}%` }}
                title={`Your Practice: ${userPlanMix}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mt-1">
              <span>0% (100% NHS/Fee-per-item)</span>
              <span>35% (Corporate Premium Threshold)</span>
              <span>70%+ (Fully Private Membership Practice)</span>
            </div>
          </div>

          {/* Metric 2: Adjusted EBITDA Margin */}
          <div>
            <div className="flex justify-between text-sm font-semibold mb-1.5">
              <span>Adjusted Practice EBITDA Margin</span>
              <span>
                Your practice: <strong>{userMargin}%</strong> · Local: <strong>{regionStats.avgEbitdaMarginPercent}%</strong> · UK National: <strong>{UK_NATIONAL_AVERAGES.avgEbitdaMarginPercent}%</strong>
              </span>
            </div>
            <div className="w-full h-3.5 rounded-full bg-gray-200 relative overflow-hidden flex">
              <div
                className="h-full bg-[#26231E]"
                style={{ width: `${Math.min(Number(userMargin) * 3.5, 100)}%` }}
                title={`Your Practice: ${userMargin}%`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-500 mt-1">
              <span>10% (Associate Cost Squeeze)</span>
              <span>18% (UK Dental Median)</span>
              <span>25%+ (High Efficiency Multi-Chair)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive UK All-Regions Table */}
      <div
        className="p-6 sm:p-8 rounded-[6px] border overflow-x-auto"
        style={{
          backgroundColor: '#FFFFFF',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="pb-4 mb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-xl font-bold" style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}>
            All-UK Regional Dental Practice Valuation Table (2026 Corporate Multiple Spread)
          </h3>
          <p className="text-xs text-gray-500">
            Compare active corporate dental chains, multiple ranges, and quarterly deal velocity across England, Scotland, and Wales.
          </p>
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-xs font-bold uppercase text-gray-500" style={{ borderColor: 'var(--color-border)' }}>
              <th className="py-3 px-3">UK Region</th>
              <th className="py-3 px-3">Active Dental Corporates</th>
              <th className="py-3 px-3">Avg EBITDA Margin</th>
              <th className="py-3 px-3">Avg Private / Plan %</th>
              <th className="py-3 px-3">Baseline Multiple</th>
              <th className="py-3 px-3">Premium Multiple</th>
              <th className="py-3 px-3">Quarterly Deals</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {Object.values(UK_REGIONAL_BENCHMARKS).map((bench) => {
              const isSelected = bench.region === selectedRegion;
              return (
                <tr
                  key={bench.region}
                  onClick={() => {
                    setSelectedRegion(bench.region);
                    onSelectRegion(bench.region);
                  }}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#FAF5EE] font-semibold text-[#A6521C]' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-3.5 px-3 flex items-center gap-2">
                    <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-[#A6521C]' : 'text-gray-400'}`} />
                    <span>{bench.region}</span>
                    {isSelected && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#A6521C] text-white ml-2">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-3">{bench.activeRollupPlatforms} Corporates</td>
                  <td className="py-3.5 px-3">{bench.avgEbitdaMarginPercent}%</td>
                  <td className="py-3.5 px-3">{bench.avgPrivateCapitationPercent}%</td>
                  <td className="py-3.5 px-3">{bench.averageEbitdaMultiple}x</td>
                  <td className="py-3.5 px-3 font-bold text-green-700">{bench.premiumEbitdaMultiple}x</td>
                  <td className="py-3.5 px-3">{bench.dealVelocityQuarter} deals/qtr</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
