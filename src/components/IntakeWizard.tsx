import React, { useState } from 'react';
import { DentalIntakeData, PracticeType, UkRegion } from '../types';
import { UK_REGIONAL_BENCHMARKS } from '../data/ukMarketData';
import { QuickPracticeInfoSheet } from './QuickPracticeInfoSheet';
import {
  ArrowRight,
  ClipboardList,
  SlidersHorizontal,
} from 'lucide-react';

interface IntakeWizardProps {
  initialData: DentalIntakeData;
  onCalculate: (data: DentalIntakeData) => void;
}

// 1. Sample Mixed Practice (Exact Real Bank Valuation Report Sample)
export const SAMPLE_BANK_REPORT_PRESET: DentalIntakeData = {
  practiceName: 'Sample Mixed Practice',
  practiceType: 'Mixed Practice',
  address: '1 Sample Street, Northtown',
  postcode: 'ZZ1 1AA',
  region: 'Yorkshire & Humber',
  yearsEstablished: 18,
  surgeriesCount: 4,
  floorAreaSqFt: 2000,
  tenure: 'Leasehold',
  passingRentPa: 24000,
  hasDeconRoom: true,
  hasOpgCbctRoom: true,
  disabledAccess: true,
  turnover: 1200000,
  nhsAnnualValue: 1100000, // 2 GDS contracts (illustrative figures)
  udaRequirement: 30000,
  udaRate: 37.8, // Weighted avg UDA rate
  clawbackAmount: 132000, // Under-delivery clawback noted in bank report
  privateFpiTurnover: 0,
  privatePlanTurnover: 90000, // £90k private plan noted in report
  specialistReferralTurnover: 0,
  materialsAndLabCostPercent: 15.0,
  directAssociateTherapistCostPercent: 40.0,
  staffWagesPa: 210000,
  adjustedEbitda: 250000, // FMOP assessed in bank report
  principalChairHoursPerWeek: 20,
  associateRemunerationModel: 'per_uda_rate',
  associateContracts: 'all_bda_with_covenants',
  surgeryChairUtilisationPercent: 70,
  hygieneTherapistModel: 'direct_access_active',
  cqcStatus: 'Good / Outstanding',
};

// 2. Mayfair Specialist & Implant Centre (Specialist Practice)
export const SPECIALIST_PRESET: DentalIntakeData = {
  practiceName: 'West End Implantology & Specialist Centre',
  practiceType: 'Specialist Practice',
  address: '42 Wimpole Street, London',
  postcode: 'W1G 8GZ',
  region: 'London & South East',
  yearsEstablished: 14,
  surgeriesCount: 6,
  floorAreaSqFt: 3100,
  tenure: 'Leasehold',
  passingRentPa: 65000,
  hasDeconRoom: true,
  hasOpgCbctRoom: true,
  disabledAccess: true,
  turnover: 2850000,
  nhsAnnualValue: 0,
  udaRequirement: 0,
  udaRate: 0,
  clawbackAmount: 0,
  privateFpiTurnover: 850000,
  privatePlanTurnover: 400000,
  specialistReferralTurnover: 1600000, // High-end implant & ortho referrals
  materialsAndLabCostPercent: 16.5,
  directAssociateTherapistCostPercent: 36.0,
  staffWagesPa: 420000,
  adjustedEbitda: 680000,
  principalChairHoursPerWeek: 8, // Fully associate & specialist led
  associateRemunerationModel: 'percentage_split_bda',
  associateContracts: 'all_bda_with_covenants',
  surgeryChairUtilisationPercent: 90,
  hygieneTherapistModel: 'direct_access_active',
  cqcStatus: 'Good / Outstanding',
};

// 3. Cotswold Private & Capitation Clinic (Private Practice)
export const PRIVATE_CAPITATION_PRESET: DentalIntakeData = {
  practiceName: 'Cotswold Private Dental Suite',
  practiceType: 'Private Practice',
  address: '14 High Street, Cirencester',
  postcode: 'GL7 2AU',
  region: 'South West',
  yearsEstablished: 12,
  surgeriesCount: 4,
  floorAreaSqFt: 1850,
  tenure: 'Freehold',
  passingRentPa: 0,
  hasDeconRoom: true,
  hasOpgCbctRoom: true,
  disabledAccess: true,
  turnover: 1450000,
  nhsAnnualValue: 0,
  udaRequirement: 0,
  udaRate: 0,
  clawbackAmount: 0,
  privateFpiTurnover: 580000,
  privatePlanTurnover: 870000, // 60% recurring Denplan / Practice Plan direct debits
  specialistReferralTurnover: 0,
  materialsAndLabCostPercent: 14.0,
  directAssociateTherapistCostPercent: 35.0,
  staffWagesPa: 245000,
  adjustedEbitda: 390000,
  principalChairHoursPerWeek: 12,
  associateRemunerationModel: 'percentage_split_bda',
  associateContracts: 'all_bda_with_covenants',
  surgeryChairUtilisationPercent: 85,
  hygieneTherapistModel: 'direct_access_active',
  cqcStatus: 'Good / Outstanding',
};

// 4. Midlands Community GDS Dental (NHS Practice)
export const NHS_PRESET: DentalIntakeData = {
  practiceName: 'Midlands Community Dental Practice',
  practiceType: 'NHS Practice',
  address: '88 High Street, Dudley',
  postcode: 'DY1 1PY',
  region: 'Midlands',
  yearsEstablished: 22,
  surgeriesCount: 3,
  floorAreaSqFt: 1450,
  tenure: 'Leasehold',
  passingRentPa: 18000,
  hasDeconRoom: true,
  hasOpgCbctRoom: false,
  disabledAccess: true,
  turnover: 780000,
  nhsAnnualValue: 740000,
  udaRequirement: 22000,
  udaRate: 33.63,
  clawbackAmount: 0,
  privateFpiTurnover: 40000,
  privatePlanTurnover: 0,
  specialistReferralTurnover: 0,
  materialsAndLabCostPercent: 17.0,
  directAssociateTherapistCostPercent: 42.0,
  staffWagesPa: 165000,
  adjustedEbitda: 148000,
  principalChairHoursPerWeek: 32, // Principal heavily chair-bound
  associateRemunerationModel: 'per_uda_rate',
  associateContracts: 'informal_some_covenants',
  surgeryChairUtilisationPercent: 78,
  hygieneTherapistModel: 'dentist_referral_only',
  cqcStatus: 'Good / Outstanding',
};

export const IntakeWizard: React.FC<IntakeWizardProps> = ({ initialData, onCalculate }) => {
  const [formData, setFormData] = useState<DentalIntakeData>(initialData);
  const [intakeMode, setIntakeMode] = useState<'quick_sheet' | 'summary_form'>('quick_sheet');
  const [presetKey, setPresetKey] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'profile' | 'revenue' | 'diligence'>('profile');

  const handlePreset = (preset: DentalIntakeData) => {
    setFormData(preset);
    setPresetKey((k) => k + 1);
    onCalculate(preset);
  };

  const handleQuickCalculate = (data: DentalIntakeData) => {
    setFormData(data);
    onCalculate(data);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(formData);
  };

  return (
    <div
      className="rounded-[6px] border text-left p-6 sm:p-8"
      style={{
        backgroundColor: 'var(--color-surface)',
        borderColor: 'var(--color-border)',
      }}
    >
      {/* Header and Presets Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-6 mb-6 border-b gap-4" style={{ borderColor: 'var(--color-border)' }}>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-accent)',
                border: '1px solid var(--color-border)',
              }}
            >
              RICS Valuation Standard (Profits Method)
            </span>
            <span className="text-xs font-mono text-gray-500">
              NHS · Private · Mixed · Specialist
            </span>
          </div>
          <h2
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            UK Dental Practice Valuation Intake
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Used by UK commercial banks (Lloyds, NatWest, Barclays) and specialist healthcare valuers to assess Fair Maintainable Operating Profit (FMOP) and Goodwill.
          </p>
        </div>

        {/* Real Sample Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500">Load sample:</span>
          <button
            type="button"
            onClick={() => handlePreset(SAMPLE_BANK_REPORT_PRESET)}
            className="text-xs font-bold px-2.5 py-1.5 rounded-[4px] border transition-colors hover:bg-black/5"
            style={{
              backgroundColor: '#FAF5EE',
              borderColor: '#D6BC9E',
              color: 'var(--color-accent)',
            }}
            title="Load the 4-surgery Northtown bank report data (Sample Mixed Practice)"
          >
            ★ Sample Practice Northtown (£1.7M Report)
          </button>
          <button
            type="button"
            onClick={() => handlePreset(SPECIALIST_PRESET)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-[4px] border transition-colors hover:bg-black/5 bg-[#FAF8F4]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Specialist Centre (£2.85M)
          </button>
          <button
            type="button"
            onClick={() => handlePreset(PRIVATE_CAPITATION_PRESET)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-[4px] border transition-colors hover:bg-black/5 bg-[#FAF8F4]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            Private Denplan (£1.45M)
          </button>
          <button
            type="button"
            onClick={() => handlePreset(NHS_PRESET)}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-[4px] border transition-colors hover:bg-black/5 bg-[#FAF8F4]"
            style={{ borderColor: 'var(--color-border)' }}
          >
            NHS Community (£780K)
          </button>
        </div>
      </div>

      {/* Mode Switcher: Quick Broker Sheet vs Summary 3-Step Intake */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div
          className="inline-flex items-center gap-1 p-1 rounded-[6px] bg-[#FAF8F4] border"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <button
            type="button"
            onClick={() => setIntakeMode('quick_sheet')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              intakeMode === 'quick_sheet'
                ? 'bg-[#26231E] text-white'
                : 'text-[#6B6459] hover:text-[#26231E]'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Quick Info &amp; Staffing Schedule (5 Sections)
          </button>
          <button
            type="button"
            onClick={() => setIntakeMode('summary_form')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-[4px] transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              intakeMode === 'summary_form'
                ? 'bg-[#26231E] text-white'
                : 'text-[#6B6459] hover:text-[#26231E]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Summary Intake Form (3 Steps)
          </button>
        </div>

        <span className="text-xs text-[#6B6459]">
          Auto-calculates Employer NI, 3% pension, clinician pay &amp; FMOP
        </span>
      </div>

      {intakeMode === 'quick_sheet' ? (
        <QuickPracticeInfoSheet
          key={presetKey}
          initialData={formData}
          onCalculate={handleQuickCalculate}
        />
      ) : (
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`text-sm font-semibold px-4 py-2 rounded-[4px] transition-colors ${
              activeTab === 'profile' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black'
            }`}
          >
            1. Practice Profile, Classification &amp; Property
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('revenue')}
            className={`text-sm font-semibold px-4 py-2 rounded-[4px] transition-colors ${
              activeTab === 'revenue' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black'
            }`}
          >
            2. Revenue Streams (NHS GDS / Private / Plans)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('diligence')}
            className={`text-sm font-semibold px-4 py-2 rounded-[4px] transition-colors ${
              activeTab === 'diligence' ? 'bg-[#26231E] text-white' : 'text-[#6B6459] hover:text-black'
            }`}
          >
            3. Costs, EBITDA (FMOP) &amp; Chairside Autonomy
          </button>
        </div>

        {/* TAB 1: Profile & Property */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Practice Trading Name
                </label>
                <input
                  type="text"
                  value={formData.practiceName}
                  onChange={(e) => setFormData({ ...formData, practiceName: e.target.value })}
                  placeholder="e.g. Sample Mixed Practice"
                  className="w-full px-4 py-3 rounded-[6px] border text-base outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Practice Classification
                </label>
                <select
                  value={formData.practiceType}
                  onChange={(e) => setFormData({ ...formData, practiceType: e.target.value as PracticeType })}
                  className="w-full px-4 py-3 rounded-[6px] border text-base font-semibold outline-none"
                  style={{ backgroundColor: '#FAF5EE', borderColor: '#D6BC9E', color: 'var(--color-accent)' }}
                >
                  <option value="NHS Practice">NHS Practice (Predominantly GDS contract)</option>
                  <option value="Mixed Practice">Mixed Practice (NHS GDS + Private / Capitation)</option>
                  <option value="Private Practice">Private Practice (Fee-Per-Item &amp; Denplan/Plans)</option>
                  <option value="Specialist Practice">Specialist Practice (Implantology / Ortho / Endo)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  UK Region (Location)
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value as UkRegion })}
                  className="w-full px-4 py-3 rounded-[6px] border text-base outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                >
                  {Object.keys(UK_REGIONAL_BENCHMARKS).map((reg) => (
                    <option key={reg} value={reg}>
                      {reg} (Regional Avg: {UK_REGIONAL_BENCHMARKS[reg as UkRegion].averageEbitdaMultiple} YP)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Practice Street Address
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g. 1 Sample Street"
                  className="w-full px-4 py-3 rounded-[6px] border text-sm outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Postcode
                </label>
                <input
                  type="text"
                  value={formData.postcode}
                  onChange={(e) => setFormData({ ...formData, postcode: e.target.value })}
                  placeholder="e.g. ZZ1 1AA"
                  className="w-full px-4 py-3 rounded-[6px] border text-sm uppercase font-mono outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-primary)' }}>
                  Years Established
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={formData.yearsEstablished}
                  onChange={(e) => setFormData({ ...formData, yearsEstablished: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-[6px] border text-sm outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                />
              </div>
            </div>

            {/* Physical Premises Details */}
            <div className="p-4 rounded-[6px] border bg-[#FAF8F4] space-y-4" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs font-bold uppercase tracking-wider block text-gray-500">
                Surgery &amp; Clinical Accommodation Details
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Equipped Surgeries (Chairs)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={formData.surgeriesCount}
                    onChange={(e) => setFormData({ ...formData, surgeriesCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border font-bold"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Floor Area (Sq Ft NIA)</label>
                  <input
                    type="number"
                    step="50"
                    value={formData.floorAreaSqFt}
                    onChange={(e) => setFormData({ ...formData, floorAreaSqFt: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Tenure</label>
                  <select
                    value={formData.tenure}
                    onChange={(e) => setFormData({ ...formData, tenure: e.target.value as any })}
                    className="w-full px-3 py-2 rounded border"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <option value="Leasehold">Leasehold (Commercial Lease)</option>
                    <option value="Freehold">Freehold (Bricks &amp; Mortar Owned)</option>
                  </select>
                </div>

                {formData.tenure === 'Leasehold' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">Passing Rent (£ pa)</label>
                    <input
                      type="number"
                      step="1000"
                      value={formData.passingRentPa || 24000}
                      onChange={(e) => setFormData({ ...formData, passingRentPa: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded border"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  </div>
                )}
              </div>

              {/* Checkboxes */}
              <div className="flex flex-wrap items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasDeconRoom}
                    onChange={(e) => setFormData({ ...formData, hasDeconRoom: e.target.checked })}
                    className="rounded accent-[#A6521C]"
                  />
                  <span>HTM 01-05 Dedicated Decontamination Room</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.hasOpgCbctRoom}
                    onChange={(e) => setFormData({ ...formData, hasOpgCbctRoom: e.target.checked })}
                    className="rounded accent-[#A6521C]"
                  />
                  <span>OPG / CBCT 3D Digital Imaging Facility</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.disabledAccess}
                    onChange={(e) => setFormData({ ...formData, disabledAccess: e.target.checked })}
                    className="rounded accent-[#A6521C]"
                  />
                  <span>Equality Act Compliant Disabled Access</span>
                </label>
              </div>
            </div>

            <div className="pt-4 flex justify-end border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('revenue')}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Next: Revenue Streams &rarr;
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Revenue Streams (NHS, Private, Capitation, Specialist) */}
        {activeTab === 'revenue' && (
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-primary)' }}>
                Total Annual Gross Fee Income (£)
              </label>
              <div className="relative max-w-sm">
                <span className="absolute left-3.5 top-3.5 text-base font-bold text-gray-500">£</span>
                <input
                  type="number"
                  step="10000"
                  value={formData.turnover}
                  onChange={(e) => setFormData({ ...formData, turnover: Number(e.target.value) })}
                  className="w-full pl-8 pr-4 py-3 rounded-[6px] border text-lg font-bold outline-none"
                  style={{ backgroundColor: '#FFFFFF', borderColor: 'var(--color-border)' }}
                  required
                />
              </div>
            </div>

            {/* NHS Details Section */}
            {(formData.practiceType === 'NHS Practice' || formData.practiceType === 'Mixed Practice') && (
              <div className="p-5 rounded-[6px] border bg-[#FAF5EE]" style={{ borderColor: '#D6BC9E' }}>
                <span className="text-xs font-bold uppercase tracking-wider block mb-3 text-[#A6521C]">
                  NHS General Dental Services (GDS / PDS) Contract
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">NHS Contract Value (£)</label>
                    <input
                      type="number"
                      step="5000"
                      value={formData.nhsAnnualValue}
                      onChange={(e) => setFormData({ ...formData, nhsAnnualValue: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded border bg-white"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Contracted UDAs</label>
                    <input
                      type="number"
                      step="500"
                      value={formData.udaRequirement}
                      onChange={(e) => setFormData({ ...formData, udaRequirement: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded border bg-white"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">UDA Rate (£/UDA)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={formData.udaRate}
                      onChange={(e) => setFormData({ ...formData, udaRate: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded border bg-white font-bold text-[#A6521C]"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                    <span className="text-[11px] text-gray-500">North avg: £28–£35; High: £38–£45+</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1 text-red-700">Clawback Deduction (£)</label>
                    <input
                      type="number"
                      step="1000"
                      value={formData.clawbackAmount}
                      onChange={(e) => setFormData({ ...formData, clawbackAmount: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded border bg-white text-red-700 font-bold"
                      style={{ borderColor: 'var(--color-border)' }}
                    />
                    <span className="text-[11px] text-red-600">Under-delivery penalty if any</span>
                  </div>
                </div>
              </div>
            )}

            {/* Private & Plan Breakdown */}
            <div className="p-5 rounded-[6px] border bg-[#FAF8F4]" style={{ borderColor: 'var(--color-border)' }}>
              <span className="text-xs font-bold uppercase tracking-wider block mb-3 text-gray-700">
                Private &amp; Recurring Patient Plan Streams
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Private Fee-Per-Item (£ pa)</label>
                  <input
                    type="number"
                    step="5000"
                    value={formData.privateFpiTurnover}
                    onChange={(e) => setFormData({ ...formData, privateFpiTurnover: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <span className="text-[11px] text-gray-500">Elective restorations, whitening, private checkups</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1 text-[#A6521C]">
                    Monthly Patient Capitation (£ pa)
                  </label>
                  <input
                    type="number"
                    step="5000"
                    value={formData.privatePlanTurnover}
                    onChange={(e) => setFormData({ ...formData, privatePlanTurnover: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border bg-white font-bold text-[#A6521C]"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <span className="text-[11px] text-[#8A4215]">Denplan, Practice Plan, DPAS direct debits</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Specialist Treatments (£ pa)</label>
                  <input
                    type="number"
                    step="5000"
                    value={formData.specialistReferralTurnover}
                    onChange={(e) => setFormData({ ...formData, specialistReferralTurnover: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded border bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                  <span className="text-[11px] text-gray-500">Implants, Invisalign orthodontics, endo referrals</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className="text-xs font-semibold hover:underline text-gray-600"
              >
                &larr; Back to Profile
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('diligence')}
                className="btn-primary !py-2 !px-4 text-sm"
              >
                Next: Costs &amp; Diligence &rarr;
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: Costs, EBITDA (FMOP) & Diligence */}
        {activeTab === 'diligence' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Materials &amp; Laboratory Fees (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.materialsAndLabCostPercent}
                  onChange={(e) => setFormData({ ...formData, materialsAndLabCostPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <span className="text-[11px] text-gray-500">Dental industry norm: 14% – 19%</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Direct Associate / Therapist Cost (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formData.directAssociateTherapistCostPercent}
                  onChange={(e) => setFormData({ ...formData, directAssociateTherapistCostPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <span className="text-[11px] text-gray-500">Associate pay: ~45% less 50% labs; £11–£14/UDA</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Annual Staff Wage Bill (£)
                </label>
                <input
                  type="number"
                  step="5000"
                  value={formData.staffWagesPa}
                  onChange={(e) => setFormData({ ...formData, staffWagesPa: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded border"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <span className="text-[11px] text-gray-500">Practice manager, dental nurses, receptionists</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Principal Dentist Weekly Chair Hours
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={formData.principalChairHoursPerWeek}
                  onChange={(e) => setFormData({ ...formData, principalChairHoursPerWeek: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded border font-bold"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <span className="text-[11px] text-gray-500">
                  0–10 hrs: Fully managed (Highest multiple); 30+ hrs: Heavy owner-operator haircut
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--color-text-primary)' }}>
                  Current Adjusted EBITDA / FMOP (£)
                </label>
                <input
                  type="number"
                  step="5000"
                  value={formData.adjustedEbitda}
                  onChange={(e) => setFormData({ ...formData, adjustedEbitda: Number(e.target.value) })}
                  className="w-full px-3 py-2.5 rounded border font-bold text-[#A6521C]"
                  style={{ borderColor: '#D6BC9E', backgroundColor: '#FAF5EE' }}
                />
                <span className="text-[11px] text-gray-500">
                  Pre-tax profit after principal replacement &amp; non-recurring add-backs
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Associate Contracts</label>
                <select
                  value={formData.associateContracts}
                  onChange={(e) => setFormData({ ...formData, associateContracts: e.target.value as any })}
                  className="w-full px-3 py-2 rounded border text-xs"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <option value="all_bda_with_covenants">BDA Standard with 2–3 mile covenants</option>
                  <option value="informal_some_covenants">Informal with partial covenants</option>
                  <option value="unwritten_high_flight_risk">Unwritten / expired agreements</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Surgery Chair Utilisation (%)</label>
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={formData.surgeryChairUtilisationPercent}
                  onChange={(e) => setFormData({ ...formData, surgeryChairUtilisationPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded border text-xs"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">CQC Inspection Status</label>
                <select
                  value={formData.cqcStatus}
                  onChange={(e) => setFormData({ ...formData, cqcStatus: e.target.value as any })}
                  className="w-full px-3 py-2 rounded border text-xs"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <option value="Good / Outstanding">Good / Outstanding</option>
                  <option value="Requires Improvement">Requires Improvement</option>
                  <option value="Inspection Due">Inspection Due</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button
                type="button"
                onClick={() => setActiveTab('revenue')}
                className="text-xs font-semibold hover:underline text-gray-600"
              >
                &larr; Back to Revenue Streams
              </button>
              <button
                type="submit"
                className="btn-primary flex items-center gap-2"
              >
                Generate Bank-Standard Valuation Report <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </form>
      )}
    </div>
  );
};
