import React, { useMemo, useState } from 'react';
import {
  DentalIntakeData,
  PracticeType,
  UkRegion,
  QuickPracticeScheduleData,
  ClinicianScheduleRow,
  HygienistScheduleRow,
  SupportEmployeeRow,
  FoundationDentistRow,
} from '../types';
import { UK_REGIONAL_BENCHMARKS } from '../data/ukMarketData';
import { calculateDentalValuation, formatGbp } from '../utils/valuationEngine';
import {
  Plus,
  Trash2,
  ArrowRight,
  RotateCcw,
  Check,
  Building2,
  PoundSterling,
  Users,
  Stethoscope,
  Wrench,
} from 'lucide-react';

interface QuickPracticeInfoSheetProps {
  initialData: DentalIntakeData;
  onCalculate: (data: DentalIntakeData) => void;
}

// UK 2025/26 statutory payroll multipliers (Employer NI 15% above £5,000 threshold, Workplace Pension 3% above £6,240)
const UK_EMPLOYER_NI_THRESHOLD = 5000;
const UK_EMPLOYER_NI_RATE = 0.15;
const UK_PENSION_LOWER_THRESHOLD = 6240;
const UK_PENSION_RATE = 0.03;

export function calculateEmployeeRowTotals(row: SupportEmployeeRow) {
  const annualSalary = Math.round(row.hoursPerWeek * row.hourlyRateGbp * 52);
  const totalGrossPay = annualSalary + Math.round(row.annualBonus || 0);
  const employersNi =
    totalGrossPay > UK_EMPLOYER_NI_THRESHOLD
      ? Math.round((totalGrossPay - UK_EMPLOYER_NI_THRESHOLD) * UK_EMPLOYER_NI_RATE)
      : 0;
  const annualPension =
    row.pensionOptIn && totalGrossPay > UK_PENSION_LOWER_THRESHOLD
      ? Math.round((totalGrossPay - UK_PENSION_LOWER_THRESHOLD) * UK_PENSION_RATE)
      : 0;
  const totalStaffCost = totalGrossPay + employersNi + annualPension;
  return { annualSalary, totalGrossPay, employersNi, annualPension, totalStaffCost };
}

export function calculateClinicianRowTotals(row: ClinicianScheduleRow) {
  const nhsPay = Math.round((row.allocatedUdas + row.allocatedUoas) * row.netPayPerUda);
  const privatePay = Math.round(row.privateFpiRevenue * (row.privateFpiPercent / 100));
  const planPay = Math.round(row.patientPlanRevenue * (row.patientPlanPercent / 100));
  const totalPay = nhsPay + privatePay + planPay;
  return { nhsPay, privatePay, planPay, totalPay };
}

export function calculateHygienistRowTotals(row: HygienistScheduleRow) {
  const grossPay =
    row.payBasis === 'percent_revenue'
      ? Math.round(row.fpiHygieneRevenue * (row.revenuePercentEarned / 100))
      : Math.round(row.hoursPerWeek * row.hourlyRateGbp * 46); // ~46 clinical working weeks
  const employersNi =
    row.employmentType === 'Employed' && grossPay > UK_EMPLOYER_NI_THRESHOLD
      ? Math.round((grossPay - UK_EMPLOYER_NI_THRESHOLD) * UK_EMPLOYER_NI_RATE)
      : 0;
  const annualPension =
    row.employmentType === 'Employed' && grossPay > UK_PENSION_LOWER_THRESHOLD
      ? Math.round((grossPay - UK_PENSION_LOWER_THRESHOLD) * UK_PENSION_RATE)
      : 0;
  return { grossPay, employersNi, annualPension, totalCost: grossPay + employersNi + annualPension };
}

export function calculateFdRowTotals(row: FoundationDentistRow) {
  const employersNi =
    row.annualSalary > UK_EMPLOYER_NI_THRESHOLD
      ? Math.round((row.annualSalary - UK_EMPLOYER_NI_THRESHOLD) * UK_EMPLOYER_NI_RATE)
      : 0;
  const annualPension =
    row.annualSalary > UK_PENSION_LOWER_THRESHOLD
      ? Math.round((row.annualSalary - UK_PENSION_LOWER_THRESHOLD) * UK_PENSION_RATE)
      : 0;
  return { employersNi, annualPension, totalCost: row.annualSalary + employersNi + annualPension };
}

export const DEFAULT_QUICK_SCHEDULE: QuickPracticeScheduleData = {
  ownershipSinceYear: 2012,
  partnersCount: 1,
  businessStructure: 'Limited Co.',
  vtContract: false,
  spaceForAdditionalSurgeries: 1,
  reasonForSelling: 'Retirement',
  software: 'SOE Exact',
  openingHoursMonFri: '09:00 - 17:30',
  openSaturday: false,
  openSunday: false,
  hygienistIncome: 52000,
  otherIncome: 0,
  clinicians: [
    {
      id: 'p-1',
      role: 'Principal',
      nameOrInitials: 'Principal 1 (Retiring)',
      speciality: 'General GDP',
      hoursPerWeek: 20,
      stayPostSale: 'Leave',
      privateFpiRevenue: 50000,
      privateFpiPercent: 45,
      patientPlanRevenue: 20000,
      patientPlanPercent: 45,
      allocatedUdas: 6500,
      allocatedUoas: 0,
      netPayPerUda: 12.5,
      labsDeductedPercent: 50,
    },
    {
      id: 'a-1',
      role: 'Associate',
      nameOrInitials: 'Associate 1',
      speciality: 'General GDP',
      hoursPerWeek: 35,
      stayPostSale: 'Stay',
      privateFpiRevenue: 50000,
      privateFpiPercent: 50,
      patientPlanRevenue: 40000,
      patientPlanPercent: 45,
      allocatedUdas: 11500,
      allocatedUoas: 0,
      netPayPerUda: 13.5,
      labsDeductedPercent: 55,
    },
    {
      id: 'a-2',
      role: 'Associate',
      nameOrInitials: 'Associate 2',
      speciality: 'General / Restorative',
      hoursPerWeek: 28,
      stayPostSale: 'Stay',
      privateFpiRevenue: 35000,
      privateFpiPercent: 45,
      patientPlanRevenue: 30000,
      patientPlanPercent: 45,
      allocatedUdas: 9500,
      allocatedUoas: 0,
      netPayPerUda: 13.5,
      labsDeductedPercent: 55,
    },
  ],
  hygienists: [
    {
      id: 'h-1',
      nameOrInitials: 'Hygienist / Therapist 1',
      tenureYears: '4 yrs',
      employmentType: 'Self Employed',
      payBasis: 'percent_revenue',
      fpiHygieneRevenue: 52000,
      hoursPerWeek: 15,
      hourlyRateGbp: 42,
      revenuePercentEarned: 47.5,
      usesNurse: false,
    },
  ],
  hygienistRechargeActive: true,
  hygienistAnnualRechargeGbp: 6500,
  foundationDentists: [],
  employees: [
    {
      id: 'e-1',
      initials: 'PM',
      position: 'Practice Manager',
      tenureYears: '7 yrs',
      hoursPerWeek: 37.5,
      hourlyRateGbp: 21.5,
      annualBonus: 1500,
      pensionOptIn: true,
      payRiseDue: 'April',
      qualificationDueDate: '',
    },
    {
      id: 'e-2',
      initials: 'DN1',
      position: 'Nurse',
      tenureYears: '5 yrs',
      hoursPerWeek: 36,
      hourlyRateGbp: 14.5,
      annualBonus: 0,
      pensionOptIn: true,
      payRiseDue: 'April',
      qualificationDueDate: '',
    },
    {
      id: 'e-3',
      initials: 'DN2',
      position: 'Nurse',
      tenureYears: '3 yrs',
      hoursPerWeek: 36,
      hourlyRateGbp: 14.0,
      annualBonus: 0,
      pensionOptIn: true,
      payRiseDue: 'April',
      qualificationDueDate: '',
    },
    {
      id: 'e-4',
      initials: 'DN3',
      position: 'Nurse',
      tenureYears: '2 yrs',
      hoursPerWeek: 32,
      hourlyRateGbp: 13.75,
      annualBonus: 0,
      pensionOptIn: true,
      payRiseDue: 'April',
      qualificationDueDate: '',
    },
    {
      id: 'e-5',
      initials: 'TN1',
      position: 'Trainee Nurse',
      tenureYears: '1 yr',
      hoursPerWeek: 32,
      hourlyRateGbp: 12.25,
      annualBonus: 0,
      pensionOptIn: true,
      payRiseDue: 'On qualification',
      qualificationDueDate: '2026-10',
    },
    {
      id: 'e-6',
      initials: 'REC1',
      position: 'Receptionist',
      tenureYears: '6 yrs',
      hoursPerWeek: 35,
      hourlyRateGbp: 13.0,
      annualBonus: 0,
      pensionOptIn: true,
      payRiseDue: 'April',
      qualificationDueDate: '',
    },
    {
      id: 'e-7',
      initials: 'REC2',
      position: 'Receptionist',
      tenureYears: '2 yrs',
      hoursPerWeek: 24,
      hourlyRateGbp: 12.75,
      annualBonus: 0,
      pensionOptIn: true,
      payRiseDue: 'April',
      qualificationDueDate: '',
    },
  ],
  propertyStyle: 'Semi-Detached',
  buildingAge: '1920s Period',
  ratesPayablePa: 7200,
  approxFreeholdValue: 440000,
  leaseYearsRemaining: 12,
  groundFloorSurgeries: 2,
  firstFloorSurgeries: 2,
  secondFloorSurgeries: 0,
  hasParking: true,
  hasFloorPlan: true,
  facilities: {
    staffRoom: true,
    waitingRoom: true,
    xrayRoom: true,
    wcWashroom: true,
    office: true,
    garden: false,
  },
  surgeriesEquipment: [
    { surgeryNumber: 1, chairMake: 'A-dec 300', approxAgeYears: 5, hasXray: true, cabinetryAgeYears: 5 },
    { surgeryNumber: 2, chairMake: 'Belmont Clesta', approxAgeYears: 7, hasXray: true, cabinetryAgeYears: 7 },
    { surgeryNumber: 3, chairMake: 'Belmont Eurus', approxAgeYears: 4, hasXray: true, cabinetryAgeYears: 4 },
    { surgeryNumber: 4, chairMake: 'A-dec 200', approxAgeYears: 8, hasXray: true, cabinetryAgeYears: 8 },
  ],
  autoclavesCount: 2,
  hasIntraoralScanner: true,
  hasCerec: false,
};

type SectionKey = 'summary' | 'revenue' | 'clinicians' | 'staff' | 'premises';

export const QuickPracticeInfoSheet: React.FC<QuickPracticeInfoSheetProps> = ({
  initialData,
  onCalculate,
}) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('summary');

  // Core practice fields synced to DentalIntakeData
  const [practiceName, setPracticeName] = useState(initialData.practiceName);
  const [practiceType, setPracticeType] = useState<PracticeType>(initialData.practiceType);
  const [address, setAddress] = useState(initialData.address);
  const [postcode, setPostcode] = useState(initialData.postcode);
  const [region, setRegion] = useState<UkRegion>(initialData.region);
  const [yearsEstablished, setYearsEstablished] = useState(initialData.yearsEstablished);
  const [floorAreaSqFt, setFloorAreaSqFt] = useState(initialData.floorAreaSqFt);
  const [tenure, setTenure] = useState<'Freehold' | 'Leasehold'>(initialData.tenure);
  const [passingRentPa, setPassingRentPa] = useState(initialData.passingRentPa || 24000);
  const [hasDeconRoom, setHasDeconRoom] = useState(initialData.hasDeconRoom);
  const [hasOpgCbctRoom, setHasOpgCbctRoom] = useState(initialData.hasOpgCbctRoom);
  const [disabledAccess, setDisabledAccess] = useState(initialData.disabledAccess);
  const [chairUtilisation, setChairUtilisation] = useState(initialData.surgeryChairUtilisationPercent);
  const [cqcStatus, setCqcStatus] = useState(initialData.cqcStatus);
  const [associateContracts, setAssociateContracts] = useState(initialData.associateContracts);
  const [materialsAndLabPct, setMaterialsAndLabPct] = useState(initialData.materialsAndLabCostPercent);

  // Revenue breakdown fields (DPS Practice Info page 2)
  const [nhsAnnualValue, setNhsAnnualValue] = useState(initialData.nhsAnnualValue);
  const [udaRequirement, setUdaRequirement] = useState(initialData.udaRequirement);
  const [clawbackAmount, setClawbackAmount] = useState(initialData.clawbackAmount);
  const [privatePlanTurnover, setPrivatePlanTurnover] = useState(initialData.privatePlanTurnover);
  const [privateFpiTurnover, setPrivateFpiTurnover] = useState(
    initialData.privateFpiTurnover || 85000
  );
  const [specialistReferralTurnover, setSpecialistReferralTurnover] = useState(
    initialData.specialistReferralTurnover
  );

  // Extended DPS + Staffing Schedule state
  const [schedule, setSchedule] = useState<QuickPracticeScheduleData>(
    initialData.quickSchedule || DEFAULT_QUICK_SCHEDULE
  );

  // Derived Totals from Schedules (Live)
  const derived = useMemo(() => {
    const totalTurnover =
      Math.max(0, nhsAnnualValue) +
      Math.max(0, privatePlanTurnover) +
      Math.max(0, schedule.hygienistIncome) +
      Math.max(0, privateFpiTurnover) +
      Math.max(0, specialistReferralTurnover) +
      Math.max(0, schedule.otherIncome);

    const effectiveTurnover = Math.max(totalTurnover - Math.max(0, clawbackAmount), 1);
    const derivedUdaRate =
      udaRequirement > 0 ? parseFloat((nhsAnnualValue / udaRequirement).toFixed(2)) : 0;

    // Clinician rollup
    const principals = schedule.clinicians.filter((c) => c.role === 'Principal');
    const associates = schedule.clinicians.filter((c) => c.role === 'Associate');

    const totalPrincipalHours = principals.reduce((sum, p) => sum + (p.hoursPerWeek || 0), 0);
    const totalAssociateHours = associates.reduce((sum, a) => sum + (a.hoursPerWeek || 0), 0);

    // Every clinician's pay (including notional replacement pay for retiring/leaving principals!)
    const totalPrincipalReplacementCost = principals.reduce(
      (sum, p) => sum + calculateClinicianRowTotals(p).totalPay,
      0
    );
    const totalAssociatePay = associates.reduce(
      (sum, a) => sum + calculateClinicianRowTotals(a).totalPay,
      0
    );
    const totalHygienistCost = schedule.hygienists.reduce(
      (sum, h) => sum + calculateHygienistRowTotals(h).totalCost,
      0
    );
    const hygieneRechargeCredit = schedule.hygienistRechargeActive
      ? Math.max(0, schedule.hygienistAnnualRechargeGbp)
      : 0;

    const totalClinicalDirectCost = Math.max(
      0,
      totalPrincipalReplacementCost + totalAssociatePay + totalHygienistCost - hygieneRechargeCredit
    );
    const derivedClinicalCostPct = parseFloat(
      Math.min(Math.max((totalClinicalDirectCost / effectiveTurnover) * 100, 15), 65).toFixed(1)
    );

    // Employee + FD payroll rollup
    const employeeRollup = schedule.employees.reduce(
      (acc, emp) => {
        const calc = calculateEmployeeRowTotals(emp);
        return {
          gross: acc.gross + calc.totalGrossPay,
          ni: acc.ni + calc.employersNi,
          pension: acc.pension + calc.annualPension,
          total: acc.total + calc.totalStaffCost,
        };
      },
      { gross: 0, ni: 0, pension: 0, total: 0 }
    );

    const fdCost = schedule.foundationDentists.reduce(
      (sum, fd) => sum + calculateFdRowTotals(fd).totalCost,
      0
    );
    const totalStaffPayrollPa = employeeRollup.total + fdCost;

    // Surgeries count from floor distribution (fallback 1)
    const surgeriesCount = Math.max(
      1,
      (schedule.groundFloorSurgeries || 0) +
        (schedule.firstFloorSurgeries || 0) +
        (schedule.secondFloorSurgeries || 0)
    );

    // Derived FMOP / EBITDA from exact schedule inputs
    const matLabCost = Math.round(effectiveTurnover * (materialsAndLabPct / 100));
    const premisesOverhead =
      (tenure === 'Leasehold' ? passingRentPa : 0) + (schedule.ratesPayablePa || 0);
    const generalOverheads = Math.round(effectiveTurnover * 0.095); // CQC, insurance, software, utilities, repairs
    const derivedEbitda = Math.max(
      Math.round(
        effectiveTurnover -
          matLabCost -
          totalClinicalDirectCost -
          totalStaffPayrollPa -
          premisesOverhead -
          generalOverheads
      ),
      Math.round(effectiveTurnover * 0.1)
    );

    const intakePayload: DentalIntakeData = {
      practiceName: practiceName.trim() || 'UK Dental Practice',
      practiceType,
      address: address.trim() || 'Practice Address',
      postcode: postcode.trim().toUpperCase() || 'UK',
      region,
      yearsEstablished,
      surgeriesCount,
      floorAreaSqFt,
      tenure,
      passingRentPa: tenure === 'Leasehold' ? passingRentPa : 0,
      hasDeconRoom,
      hasOpgCbctRoom,
      disabledAccess,
      turnover: totalTurnover || 100000,
      nhsAnnualValue,
      udaRequirement,
      udaRate: derivedUdaRate,
      clawbackAmount,
      privateFpiTurnover: privateFpiTurnover + schedule.hygienistIncome + schedule.otherIncome,
      privatePlanTurnover,
      specialistReferralTurnover,
      materialsAndLabCostPercent: materialsAndLabPct,
      directAssociateTherapistCostPercent: derivedClinicalCostPct,
      staffWagesPa: totalStaffPayrollPa,
      adjustedEbitda: derivedEbitda,
      principalChairHoursPerWeek: totalPrincipalHours,
      associateRemunerationModel: udaRequirement > 0 ? 'per_uda_rate' : 'percentage_split_bda',
      associateContracts,
      surgeryChairUtilisationPercent: chairUtilisation,
      hygieneTherapistModel:
        schedule.hygienists.length > 0 ? 'direct_access_active' : 'dentist_does_all',
      cqcStatus,
      quickSchedule: schedule,
    };

    const previewValuation = calculateDentalValuation(intakePayload);

    return {
      totalTurnover,
      derivedUdaRate,
      totalPrincipalHours,
      totalAssociateHours,
      totalPrincipalReplacementCost,
      totalAssociatePay,
      totalHygienistCost,
      totalClinicalDirectCost,
      derivedClinicalCostPct,
      employeeRollup,
      fdCost,
      totalStaffPayrollPa,
      surgeriesCount,
      derivedEbitda,
      intakePayload,
      previewValuation,
    };
  }, [
    practiceName,
    practiceType,
    address,
    postcode,
    region,
    yearsEstablished,
    floorAreaSqFt,
    tenure,
    passingRentPa,
    hasDeconRoom,
    hasOpgCbctRoom,
    disabledAccess,
    chairUtilisation,
    cqcStatus,
    associateContracts,
    materialsAndLabPct,
    nhsAnnualValue,
    udaRequirement,
    clawbackAmount,
    privatePlanTurnover,
    privateFpiTurnover,
    specialistReferralTurnover,
    schedule,
  ]);

  // Row mutators
  const addClinician = (role: 'Principal' | 'Associate') => {
    const count = schedule.clinicians.filter((c) => c.role === role).length + 1;
    const newRow: ClinicianScheduleRow = {
      id: `${role.toLowerCase()}-${Date.now()}`,
      role,
      nameOrInitials: `${role} ${count}`,
      speciality: 'General GDP',
      hoursPerWeek: role === 'Principal' ? 16 : 28,
      stayPostSale: role === 'Principal' ? 'Leave' : 'Stay',
      privateFpiRevenue: 30000,
      privateFpiPercent: 45,
      patientPlanRevenue: 15000,
      patientPlanPercent: 45,
      allocatedUdas: 4000,
      allocatedUoas: 0,
      netPayPerUda: 13.0,
      labsDeductedPercent: 50,
    };
    setSchedule((prev) => ({ ...prev, clinicians: [...prev.clinicians, newRow] }));
  };

  const updateClinician = (id: string, patch: Partial<ClinicianScheduleRow>) => {
    setSchedule((prev) => ({
      ...prev,
      clinicians: prev.clinicians.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  };

  const removeClinician = (id: string) => {
    setSchedule((prev) => ({
      ...prev,
      clinicians: prev.clinicians.filter((c) => c.id !== id),
    }));
  };

  const addHygienist = () => {
    const newRow: HygienistScheduleRow = {
      id: `h-${Date.now()}`,
      nameOrInitials: `Hygienist ${schedule.hygienists.length + 1}`,
      tenureYears: '2 yrs',
      employmentType: 'Self Employed',
      payBasis: 'percent_revenue',
      fpiHygieneRevenue: 35000,
      hoursPerWeek: 14,
      hourlyRateGbp: 42,
      revenuePercentEarned: 47.5,
      usesNurse: false,
    };
    setSchedule((prev) => ({ ...prev, hygienists: [...prev.hygienists, newRow] }));
  };

  const updateHygienist = (id: string, patch: Partial<HygienistScheduleRow>) => {
    setSchedule((prev) => ({
      ...prev,
      hygienists: prev.hygienists.map((h) => (h.id === id ? { ...h, ...patch } : h)),
    }));
  };

  const removeHygienist = (id: string) => {
    setSchedule((prev) => ({
      ...prev,
      hygienists: prev.hygienists.filter((h) => h.id !== id),
    }));
  };

  const addFoundationDentist = () => {
    setSchedule((prev) => ({
      ...prev,
      foundationDentists: [
        ...prev.foundationDentists,
        {
          id: `fd-${Date.now()}`,
          nameOrInitials: `FD ${prev.foundationDentists.length + 1}`,
          startDate: '2025-09',
          hoursPerWeek: 35,
          annualSalary: 39800,
        },
      ],
    }));
  };

  const addEmployee = (
    position: SupportEmployeeRow['position'] = 'Nurse'
  ) => {
    const defaultRate =
      position === 'Practice Manager'
        ? 21.0
        : position === 'Nurse'
        ? 14.25
        : position === 'Trainee Nurse'
        ? 12.25
        : 12.75;
    setSchedule((prev) => ({
      ...prev,
      employees: [
        ...prev.employees,
        {
          id: `emp-${Date.now()}`,
          initials: `${position.slice(0, 2).toUpperCase()}${prev.employees.length + 1}`,
          position,
          tenureYears: '2 yrs',
          hoursPerWeek: 35,
          hourlyRateGbp: defaultRate,
          annualBonus: 0,
          pensionOptIn: true,
          payRiseDue: 'April',
          qualificationDueDate: '',
        },
      ],
    }));
  };

  const updateEmployee = (id: string, patch: Partial<SupportEmployeeRow>) => {
    setSchedule((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  };

  const removeEmployee = (id: string) => {
    setSchedule((prev) => ({
      ...prev,
      employees: prev.employees.filter((e) => e.id !== id),
    }));
  };

  const addSurgeryEquipment = () => {
    setSchedule((prev) => ({
      ...prev,
      surgeriesEquipment: [
        ...prev.surgeriesEquipment,
        {
          surgeryNumber: prev.surgeriesEquipment.length + 1,
          chairMake: 'Belmont / A-dec',
          approxAgeYears: 5,
          hasXray: true,
          cabinetryAgeYears: 5,
        },
      ],
    }));
  };

  const handleResetBlank = () => {
    setPracticeName('');
    setAddress('');
    setPostcode('');
    setNhsAnnualValue(0);
    setUdaRequirement(0);
    setClawbackAmount(0);
    setPrivatePlanTurnover(0);
    setPrivateFpiTurnover(0);
    setSpecialistReferralTurnover(0);
    setSchedule({
      ...DEFAULT_QUICK_SCHEDULE,
      hygienistIncome: 0,
      otherIncome: 0,
      hygienistAnnualRechargeGbp: 0,
      clinicians: [
        {
          id: `p-${Date.now()}`,
          role: 'Principal',
          nameOrInitials: 'Principal 1',
          speciality: 'General GDP',
          hoursPerWeek: 0,
          stayPostSale: 'Leave',
          privateFpiRevenue: 0,
          privateFpiPercent: 45,
          patientPlanRevenue: 0,
          patientPlanPercent: 45,
          allocatedUdas: 0,
          allocatedUoas: 0,
          netPayPerUda: 10,
          labsDeductedPercent: 55,
        },
      ],
      hygienists: [],
      foundationDentists: [],
      employees: [],
    });
  };

  const sections: Array<{ key: SectionKey; label: string; icon: React.ReactNode }> = [
    { key: 'summary', label: '1. Practice Summary & Hours', icon: <Building2 className="w-3.5 h-3.5" /> },
    { key: 'revenue', label: '2. Revenue Breakdown', icon: <PoundSterling className="w-3.5 h-3.5" /> },
    { key: 'clinicians', label: '3. Clinicians & Hygiene', icon: <Stethoscope className="w-3.5 h-3.5" /> },
    { key: 'staff', label: '4. Staff Payroll, NI & Pension', icon: <Users className="w-3.5 h-3.5" /> },
    { key: 'premises', label: '5. Premises & Equipment', icon: <Wrench className="w-3.5 h-3.5" /> },
  ];

  const handleCalculateClick = (e: React.FormEvent) => {
    e.preventDefault();
    onCalculate(derived.intakePayload);
  };

  return (
    <form onSubmit={handleCalculateClick} className="space-y-6 text-left">
      {/* Top Broker Templates & Live Rollup Strip */}
      <div
        className="p-4 sm:p-5 rounded-[6px] border bg-[#FAF8F4] space-y-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#6B6459]">
              Structured from UK Practice Sale Questionnaire &amp; Retiring Dentist Staffing Schedule
            </p>
            <h3
              className="text-lg sm:text-xl font-bold text-[#26231E] mt-0.5"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Quick Practice Info &amp; Staffing Schedule Valuation Builder
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={handleResetBlank}
              className="inline-flex items-center gap-1 font-semibold text-[#6B6459] hover:text-red-700 whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Clear to Blank
            </button>
          </div>
        </div>

        {/* Live Auto-Calculated Rollup KPIs (Tabular Numerals) */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
          <div>
            <span className="text-[11px] font-semibold text-[#6B6459] block">Total Gross Fees</span>
            <span className="text-lg font-bold font-mono tabular-nums text-[#26231E]">
              {formatGbp(derived.totalTurnover)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#6B6459] block">Clinicians &amp; Hygiene</span>
            <span className="text-lg font-bold font-mono tabular-nums text-[#26231E]">
              {formatGbp(derived.totalClinicalDirectCost)}{' '}
              <span className="text-xs font-normal text-[#6B6459]">({derived.derivedClinicalCostPct}%)</span>
            </span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#6B6459] block">Staff Payroll (+NI &amp; 3%)</span>
            <span className="text-lg font-bold font-mono tabular-nums text-[#26231E]">
              {formatGbp(derived.totalStaffPayrollPa)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-semibold text-[#6B6459] block">Derived FMOP / EBITDA</span>
            <span className="text-lg font-bold font-mono tabular-nums text-[#26231E]">
              {formatGbp(derived.previewValuation.fmop)}{' '}
              <span className="text-xs font-normal text-[#6B6459]">
                ({derived.previewValuation.fmopMarginPercent}%)
              </span>
            </span>
          </div>
          <div className="col-span-2 lg:col-span-1">
            <span className="text-[11px] font-semibold text-[#A6521C] block">Live MV1 Goodwill</span>
            <span className="text-lg font-bold font-mono tabular-nums text-[#A6521C]">
              {formatGbp(derived.previewValuation.mv1MarketValueGoodwill)}{' '}
              <span className="text-xs font-semibold">({derived.previewValuation.ypMultiplierAdopted} YP)</span>
            </span>
          </div>
        </div>
      </div>

      {/* 5 Section Segmented Navigation */}
      <div
        className="flex flex-wrap items-center gap-1.5 border-b pb-3"
        style={{ borderColor: 'var(--color-border)' }}
      >
        {sections.map((sec) => (
          <button
            key={sec.key}
            type="button"
            onClick={() => setActiveSection(sec.key)}
            className={`px-3 py-2 rounded-[4px] text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeSection === sec.key
                ? 'bg-[#26231E] text-white'
                : 'bg-[#FAF8F4] text-[#6B6459] hover:text-[#26231E]'
            }`}
          >
            {sec.icon}
            {sec.label}
          </button>
        ))}
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: PRACTICE SUMMARY & OPENING HOURS (DPS Page 1 & 5)          */}
      {/* ===================================================================== */}
      {activeSection === 'summary' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Practice Trading Name
              </label>
              <input
                type="text"
                value={practiceName}
                onChange={(e) => setPracticeName(e.target.value)}
                placeholder="e.g. Riverside Dental Practice"
                className="w-full px-3 py-2.5 text-sm rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Type of Practice
              </label>
              <select
                value={practiceType}
                onChange={(e) => setPracticeType(e.target.value as PracticeType)}
                className="w-full px-3 py-2.5 text-sm font-semibold rounded-[4px] border bg-[#FAF5EE] text-[#A6521C]"
                style={{ borderColor: '#D6BC9E' }}
              >
                <option value="Mixed Practice">Mixed (NHS + Private / Plan)</option>
                <option value="NHS Practice">NHS Practice</option>
                <option value="Private Practice">Private Practice</option>
                <option value="Specialist Practice">Specialist Practice</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                UK Region
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as UkRegion)}
                className="w-full px-3 py-2.5 text-sm rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                {Object.keys(UK_REGIONAL_BENCHMARKS).map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Practice Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street & Town"
                className="w-full px-3 py-2.5 text-sm rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Postcode
              </label>
              <input
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
                placeholder="AB1 2CD"
                className="w-full px-3 py-2.5 text-sm font-mono uppercase rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Business Structure
              </label>
              <select
                value={schedule.businessStructure}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    businessStructure: e.target.value as QuickPracticeScheduleData['businessStructure'],
                  })
                }
                className="w-full px-3 py-2.5 text-sm rounded-[4px] border bg-white text-[#26231E]"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="Limited Co.">Limited Company</option>
                <option value="Sole Trader">Sole Trader</option>
                <option value="Partnership">Partnership / Expense Share</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Years Established
              </label>
              <input
                type="number"
                min={1}
                max={120}
                value={yearsEstablished}
                onChange={(e) => setYearsEstablished(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Current Owner Since
              </label>
              <input
                type="number"
                min={1960}
                max={2026}
                value={schedule.ownershipSinceYear}
                onChange={(e) =>
                  setSchedule({ ...schedule, ownershipSinceYear: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                No. of Partners
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={schedule.partnersCount}
                onChange={(e) =>
                  setSchedule({ ...schedule, partnersCount: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Chair Utilisation (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={chairUtilisation}
                onChange={(e) => setChairUtilisation(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Reason for Selling
              </label>
              <select
                value={schedule.reasonForSelling}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    reasonForSelling: e.target.value as QuickPracticeScheduleData['reasonForSelling'],
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="Retirement">Retirement</option>
                <option value="Corporate Exit">Corporate Exit</option>
                <option value="Equity Release">Equity Release</option>
                <option value="Relocation">Relocation</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Practice Software (PMS)
              </label>
              <select
                value={schedule.software}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    software: e.target.value as QuickPracticeScheduleData['software'],
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="SOE Exact">SOE Exact</option>
                <option value="Dentally">Dentally (Cloud)</option>
                <option value="R4">Carestream R4</option>
                <option value="Systems for Dentists (SfD)">Systems for Dentists (SfD)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Mon–Fri Opening Hours
              </label>
              <input
                type="text"
                value={schedule.openingHoursMonFri}
                onChange={(e) =>
                  setSchedule({ ...schedule, openingHoursMonFri: e.target.value })
                }
                placeholder="09:00 - 17:30"
                className="w-full px-3 py-2 text-sm font-mono rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                CQC Status
              </label>
              <select
                value={cqcStatus}
                onChange={(e) => setCqcStatus(e.target.value as DentalIntakeData['cqcStatus'])}
                className="w-full px-3 py-2 text-sm rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="Good / Outstanding">Good / Outstanding</option>
                <option value="Requires Improvement">Requires Improvement</option>
                <option value="Inspection Due">Inspection Due</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Associate Contracts
              </label>
              <select
                value={associateContracts}
                onChange={(e) =>
                  setAssociateContracts(e.target.value as DentalIntakeData['associateContracts'])
                }
                className="w-full px-3 py-2 text-sm rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="all_bda_with_covenants">BDA Standard + Covenants</option>
                <option value="informal_some_covenants">Informal / Partial Covenants</option>
                <option value="unwritten_high_flight_risk">Unwritten Agreements</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-[#26231E]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.vtContract}
                onChange={(e) => setSchedule({ ...schedule, vtContract: e.target.checked })}
                className="accent-[#A6521C]"
              />
              VT / Foundation Training Contract Approved
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.openSaturday}
                onChange={(e) => setSchedule({ ...schedule, openSaturday: e.target.checked })}
                className="accent-[#A6521C]"
              />
              Open Saturdays
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={schedule.openSunday}
                onChange={(e) => setSchedule({ ...schedule, openSunday: e.target.checked })}
                className="accent-[#A6521C]"
              />
              Open Sundays
            </label>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: REVENUE BREAKDOWN (DPS Page 2 & 6)                         */}
      {/* ===================================================================== */}
      {activeSection === 'revenue' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                NHS Contract Value (£ pa)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={nhsAnnualValue}
                onChange={(e) => setNhsAnnualValue(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">From latest NHS Compass contract schedule</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                No. of Contracted UDAs / UOAs
              </label>
              <input
                type="number"
                step={250}
                min={0}
                value={udaRequirement}
                onChange={(e) => setUdaRequirement(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#A6521C] font-mono">
                Implied rate: £{derived.derivedUdaRate.toFixed(2)} / UDA
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-red-700 mb-1">
                NHS Under-Delivery Clawback (£ pa)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={clawbackAmount}
                onChange={(e) => setClawbackAmount(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white text-red-700"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">Enter £0 if delivering ≥96% target</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div>
              <label className="block text-xs font-semibold text-[#A6521C] mb-1">
                Dental Plan Income (£ pa)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={privatePlanTurnover}
                onChange={(e) => setPrivatePlanTurnover(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums font-bold rounded-[4px] border bg-[#FAF5EE] text-[#A6521C]"
                style={{ borderColor: '#D6BC9E' }}
              />
              <span className="text-[11px] text-[#6B6459]">Denplan, Practice Plan, DPAS monthly statements</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Dentist Private FPI Income (£ pa)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={privateFpiTurnover}
                onChange={(e) => setPrivateFpiTurnover(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">Recent 12-month PMS report</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Hygienist Income (£ pa)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={schedule.hygienistIncome}
                onChange={(e) =>
                  setSchedule({ ...schedule, hygienistIncome: Number(e.target.value) })
                }
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">Direct-access &amp; referred hygiene fees</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Specialisms Income (£ pa)
              </label>
              <input
                type="number"
                step={1000}
                min={0}
                value={specialistReferralTurnover}
                onChange={(e) => setSpecialistReferralTurnover(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">Implants, Invisalign/Ortho, Endodontics</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Other Income (£ pa)
              </label>
              <input
                type="number"
                step={500}
                min={0}
                value={schedule.otherIncome}
                onChange={(e) =>
                  setSchedule({ ...schedule, otherIncome: Number(e.target.value) })
                }
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">Room rental, sundries, facial aesthetics</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Materials &amp; Lab Fees (% of Turnover)
              </label>
              <input
                type="number"
                step={0.5}
                min={5}
                max={35}
                value={materialsAndLabPct}
                onChange={(e) => setMaterialsAndLabPct(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
              <span className="text-[11px] text-[#6B6459]">UK dental norm: 14%–18%</span>
            </div>
          </div>

          <div
            className="p-4 rounded-[6px] border bg-[#FAF8F4] flex flex-wrap items-center justify-between gap-4"
            style={{ borderColor: 'var(--color-border)' }}
          >
            <span className="text-xs font-semibold text-[#6B6459]">
              Auto-Summed Annual Gross Practice Income (6 Streams)
            </span>
            <span className="text-xl font-bold font-mono tabular-nums text-[#26231E]">
              £{derived.totalTurnover.toLocaleString('en-GB')}
            </span>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: CLINICIANS, HYGIENISTS & FOUNDATION DENTIST (PDF 1 + DPS)  */}
      {/* ===================================================================== */}
      {activeSection === 'clinicians' && (
        <div className="space-y-6">
          {/* Principals & Associates Table */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-[#26231E]">
                  Principals &amp; Associates Schedule (Pay, UDAs, Private/Plan Splits &amp; Post-Sale Status)
                </h4>
                <p className="text-xs text-[#6B6459]">
                  Retiring principals are automatically costed at associate replacement rates for RICS Red Book FMOP.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => addClinician('Principal')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-[4px] border bg-white hover:bg-[#FAF8F4] flex items-center gap-1"
                  style={{ borderColor: 'var(--color-border)' }}
                >
                  <Plus className="w-3.5 h-3.5" /> Add Principal
                </button>
                <button
                  type="button"
                  onClick={() => addClinician('Associate')}
                  className="px-3 py-1.5 text-xs font-semibold rounded-[4px] bg-[#26231E] text-white hover:bg-black flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Associate
                </button>
              </div>
            </div>

            <div className="border rounded-[6px] overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b text-[11px] font-semibold text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                  <tr>
                    <th className="py-2.5 px-2.5">Role / Initials</th>
                    <th className="py-2.5 px-2">Hrs/Wk</th>
                    <th className="py-2.5 px-2">Post-Sale</th>
                    <th className="py-2.5 px-2 text-right">FPI Rev (£)</th>
                    <th className="py-2.5 px-2 text-right">FPI %</th>
                    <th className="py-2.5 px-2 text-right">Plan Rev (£)</th>
                    <th className="py-2.5 px-2 text-right">Plan %</th>
                    <th className="py-2.5 px-2 text-right">UDAs</th>
                    <th className="py-2.5 px-2 text-right">£/UDA</th>
                    <th className="py-2.5 px-2 text-right">Labs %</th>
                    <th className="py-2.5 px-2.5 text-right">Total Pay (£)</th>
                    <th className="py-2.5 px-2" />
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {schedule.clinicians.map((row) => {
                    const calc = calculateClinicianRowTotals(row);
                    return (
                      <tr key={row.id} className="hover:bg-[#FAF8F4]/60">
                        <td className="py-2 px-2.5 min-w-[160px]">
                          <div className="text-[10px] font-semibold text-[#A6521C]">{row.role}</div>
                          <input
                            type="text"
                            value={row.nameOrInitials}
                            onChange={(e) => updateClinician(row.id, { nameOrInitials: e.target.value })}
                            className="w-full px-2 py-1 text-xs rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            min={0}
                            max={50}
                            value={row.hoursPerWeek}
                            onChange={(e) => updateClinician(row.id, { hoursPerWeek: Number(e.target.value) })}
                            className="w-14 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <select
                            value={row.stayPostSale}
                            onChange={(e) =>
                              updateClinician(row.id, {
                                stayPostSale: e.target.value as 'Stay' | 'Leave',
                              })
                            }
                            className="px-1.5 py-1 text-xs rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <option value="Stay">Stay</option>
                            <option value="Leave">Leave</option>
                          </select>
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={1000}
                            min={0}
                            value={row.privateFpiRevenue}
                            onChange={(e) =>
                              updateClinician(row.id, { privateFpiRevenue: Number(e.target.value) })
                            }
                            className="w-20 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={1}
                            min={0}
                            max={60}
                            value={row.privateFpiPercent}
                            onChange={(e) =>
                              updateClinician(row.id, { privateFpiPercent: Number(e.target.value) })
                            }
                            className="w-14 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={1000}
                            min={0}
                            value={row.patientPlanRevenue}
                            onChange={(e) =>
                              updateClinician(row.id, { patientPlanRevenue: Number(e.target.value) })
                            }
                            className="w-20 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={1}
                            min={0}
                            max={60}
                            value={row.patientPlanPercent}
                            onChange={(e) =>
                              updateClinician(row.id, { patientPlanPercent: Number(e.target.value) })
                            }
                            className="w-14 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={250}
                            min={0}
                            value={row.allocatedUdas}
                            onChange={(e) =>
                              updateClinician(row.id, { allocatedUdas: Number(e.target.value) })
                            }
                            className="w-20 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={0.5}
                            min={0}
                            value={row.netPayPerUda}
                            onChange={(e) =>
                              updateClinician(row.id, { netPayPerUda: Number(e.target.value) })
                            }
                            className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step={5}
                            min={0}
                            max={100}
                            value={row.labsDeductedPercent}
                            onChange={(e) =>
                              updateClinician(row.id, { labsDeductedPercent: Number(e.target.value) })
                            }
                            className="w-14 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#26231E] whitespace-nowrap">
                          £{calc.totalPay.toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-2">
                          <button
                            type="button"
                            onClick={() => removeClinician(row.id)}
                            className="text-[#6B6459] hover:text-red-700 p-1"
                            aria-label="Remove clinician"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-[#FAF8F4] font-semibold text-xs border-t" style={{ borderColor: 'var(--color-border)' }}>
                  <tr>
                    <td className="py-2.5 px-2.5">
                      Principal hrs: <span className="font-mono">{derived.totalPrincipalHours}h</span> · Associate hrs:{' '}
                      <span className="font-mono">{derived.totalAssociateHours}h</span>
                    </td>
                    <td colSpan={9} className="py-2.5 px-2 text-right text-[#6B6459]">
                      Combined Clinician Replacement &amp; Associate Pay:
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#A6521C]">
                      £{(derived.totalPrincipalReplacementCost + derived.totalAssociatePay).toLocaleString('en-GB')}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Hygienists & Therapists + Recharge */}
          <div className="space-y-3 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[#26231E]">
                Hygienists &amp; Therapists (Pay Basis, NI/Pension &amp; Private Plan Recharge)
              </h4>
              <button
                type="button"
                onClick={addHygienist}
                className="px-3 py-1.5 text-xs font-semibold rounded-[4px] border bg-white hover:bg-[#FAF8F4] flex items-center gap-1"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Add Hygienist / Therapist
              </button>
            </div>

            {schedule.hygienists.length > 0 && (
              <div className="border rounded-[6px] overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F4] border-b text-[11px] font-semibold text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                    <tr>
                      <th className="py-2 px-2.5">Name / Initials</th>
                      <th className="py-2 px-2">Status</th>
                      <th className="py-2 px-2">Pay Basis</th>
                      <th className="py-2 px-2 text-right">FPI Rev (£)</th>
                      <th className="py-2 px-2 text-right">Hrs/Wk</th>
                      <th className="py-2 px-2 text-right">Rate (£ or %)</th>
                      <th className="py-2 px-2 text-center">Uses Nurse</th>
                      <th className="py-2 px-2.5 text-right">Total Cost (£)</th>
                      <th className="py-2 px-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                    {schedule.hygienists.map((row) => {
                      const calc = calculateHygienistRowTotals(row);
                      return (
                        <tr key={row.id}>
                          <td className="py-2 px-2.5">
                            <input
                              type="text"
                              value={row.nameOrInitials}
                              onChange={(e) =>
                                updateHygienist(row.id, { nameOrInitials: e.target.value })
                              }
                              className="w-full min-w-[140px] px-2 py-1 text-xs rounded border bg-white"
                              style={{ borderColor: 'var(--color-border)' }}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={row.employmentType}
                              onChange={(e) =>
                                updateHygienist(row.id, {
                                  employmentType: e.target.value as 'Self Employed' | 'Employed',
                                })
                              }
                              className="px-2 py-1 text-xs rounded border bg-white"
                              style={{ borderColor: 'var(--color-border)' }}
                            >
                              <option value="Self Employed">Self Employed</option>
                              <option value="Employed">Employed (+NI/3%)</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <select
                              value={row.payBasis}
                              onChange={(e) =>
                                updateHygienist(row.id, {
                                  payBasis: e.target.value as 'percent_revenue' | 'hourly_rate',
                                })
                              }
                              className="px-2 py-1 text-xs rounded border bg-white"
                              style={{ borderColor: 'var(--color-border)' }}
                            >
                              <option value="percent_revenue">% of Revenue</option>
                              <option value="hourly_rate">Hourly Rate (£)</option>
                            </select>
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step={1000}
                              value={row.fpiHygieneRevenue}
                              onChange={(e) =>
                                updateHygienist(row.id, { fpiHygieneRevenue: Number(e.target.value) })
                              }
                              className="w-20 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                              style={{ borderColor: 'var(--color-border)' }}
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="number"
                              step={1}
                              value={row.hoursPerWeek}
                              onChange={(e) =>
                                updateHygienist(row.id, { hoursPerWeek: Number(e.target.value) })
                              }
                              className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                              style={{ borderColor: 'var(--color-border)' }}
                            />
                          </td>
                          <td className="py-2 px-2">
                            {row.payBasis === 'percent_revenue' ? (
                              <input
                                type="number"
                                step={0.5}
                                value={row.revenuePercentEarned}
                                onChange={(e) =>
                                  updateHygienist(row.id, {
                                    revenuePercentEarned: Number(e.target.value),
                                  })
                                }
                                className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                                style={{ borderColor: 'var(--color-border)' }}
                              />
                            ) : (
                              <input
                                type="number"
                                step={1}
                                value={row.hourlyRateGbp}
                                onChange={(e) =>
                                  updateHygienist(row.id, { hourlyRateGbp: Number(e.target.value) })
                                }
                                className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                                style={{ borderColor: 'var(--color-border)' }}
                              />
                            )}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={row.usesNurse}
                              onChange={(e) =>
                                updateHygienist(row.id, { usesNurse: e.target.checked })
                              }
                              className="accent-[#A6521C]"
                            />
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold">
                            £{calc.totalCost.toLocaleString('en-GB')}
                          </td>
                          <td className="py-2 px-2">
                            <button
                              type="button"
                              onClick={() => removeHygienist(row.id)}
                              className="text-[#6B6459] hover:text-red-700 p-1"
                              aria-label="Remove hygienist"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-6 text-xs bg-[#FAF8F4] p-3.5 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
              <label className="inline-flex items-center gap-2 font-semibold text-[#26231E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedule.hygienistRechargeActive}
                  onChange={(e) =>
                    setSchedule({ ...schedule, hygienistRechargeActive: e.target.checked })
                  }
                  className="accent-[#A6521C]"
                />
                Hygienist Private Plan Recharge Scheme in Place
              </label>

              {schedule.hygienistRechargeActive && (
                <div className="flex items-center gap-2">
                  <span className="text-[#6B6459]">Annual Associate Recharge (£ pa):</span>
                  <input
                    type="number"
                    step={500}
                    min={0}
                    value={schedule.hygienistAnnualRechargeGbp}
                    onChange={(e) =>
                      setSchedule({
                        ...schedule,
                        hygienistAnnualRechargeGbp: Number(e.target.value),
                      })
                    }
                    className="w-24 px-2 py-1 text-xs font-mono tabular-nums rounded border bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={addFoundationDentist}
                className="ml-auto text-xs font-semibold text-[#A6521C] hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Foundation Dentist ({schedule.foundationDentists.length})
              </button>
            </div>

            {schedule.foundationDentists.length > 0 && (
              <div className="space-y-2">
                {schedule.foundationDentists.map((fd) => {
                  const fdCalc = calculateFdRowTotals(fd);
                  return (
                    <div
                      key={fd.id}
                      className="flex flex-wrap items-center gap-3 p-3 rounded-[4px] border bg-white text-xs"
                      style={{ borderColor: 'var(--color-border)' }}
                    >
                      <span className="font-semibold text-[#26231E]">{fd.nameOrInitials}</span>
                      <label className="flex items-center gap-1.5">
                        <span className="text-[#6B6459]">Salary (£):</span>
                        <input
                          type="number"
                          step={500}
                          value={fd.annualSalary}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              foundationDentists: prev.foundationDentists.map((f) =>
                                f.id === fd.id ? { ...f, annualSalary: Number(e.target.value) } : f
                              ),
                            }))
                          }
                          className="w-24 px-2 py-1 font-mono tabular-nums rounded border"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </label>
                      <span className="font-mono tabular-nums text-[#6B6459]">
                        NI: £{fdCalc.employersNi.toLocaleString('en-GB')} · Pension: £
                        {fdCalc.annualPension.toLocaleString('en-GB')} · Total:{' '}
                        <strong className="text-[#26231E]">£{fdCalc.totalCost.toLocaleString('en-GB')}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setSchedule((prev) => ({
                            ...prev,
                            foundationDentists: prev.foundationDentists.filter((f) => f.id !== fd.id),
                          }))
                        }
                        className="ml-auto text-[#6B6459] hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 4: EMPLOYEES PAYROLL + EMPLOYER NI + 3% PENSION (PDF 1 P.4/6) */}
      {/* ===================================================================== */}
      {activeSection === 'staff' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-[#26231E]">
                Support Staff Payroll Schedule (Auto-Calculates Employer NI &amp; 3% Workplace Pension)
              </h4>
              <p className="text-xs text-[#6B6459]">
                Add Practice Manager, Nurses, Trainee Nurses, Receptionists, and TCOs — total payroll flows directly into FMOP.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(['Practice Manager', 'Nurse', 'Trainee Nurse', 'Receptionist', 'TCO / Cleaner / Other'] as const).map(
                (role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => addEmployee(role)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-[4px] border bg-white hover:bg-[#FAF8F4] flex items-center gap-1 whitespace-nowrap"
                    style={{ borderColor: 'var(--color-border)' }}
                  >
                    <Plus className="w-3 h-3" /> {role.split(' ')[0]}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="border rounded-[6px] overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF8F4] border-b text-[11px] font-semibold text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                <tr>
                  <th className="py-2.5 px-2.5">Initials</th>
                  <th className="py-2.5 px-2">Position</th>
                  <th className="py-2.5 px-2 text-right">Hrs/Wk</th>
                  <th className="py-2.5 px-2 text-right">£/Hr</th>
                  <th className="py-2.5 px-2 text-right">Bonus (£)</th>
                  <th className="py-2.5 px-2 text-center">3% Pension</th>
                  <th className="py-2.5 px-2 text-right">Gross (£)</th>
                  <th className="py-2.5 px-2 text-right">Emp NI (£)</th>
                  <th className="py-2.5 px-2 text-right">Pension (£)</th>
                  <th className="py-2.5 px-2.5 text-right">Total Cost (£)</th>
                  <th className="py-2.5 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                {schedule.employees.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-6 text-center text-[#6B6459]">
                      No employees added yet. Use the quick role buttons above to add your dental team.
                    </td>
                  </tr>
                ) : (
                  schedule.employees.map((emp) => {
                    const calc = calculateEmployeeRowTotals(emp);
                    return (
                      <tr key={emp.id} className="hover:bg-[#FAF8F4]/60">
                        <td className="py-2 px-2.5">
                          <input
                            type="text"
                            value={emp.initials}
                            onChange={(e) => updateEmployee(emp.id, { initials: e.target.value })}
                            className="w-16 px-1.5 py-1 text-xs font-mono rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={emp.position}
                            onChange={(e) =>
                              updateEmployee(emp.id, {
                                position: e.target.value as SupportEmployeeRow['position'],
                              })
                            }
                            className="px-2 py-1 text-xs rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          >
                            <option value="Practice Manager">Practice Manager</option>
                            <option value="Nurse">Nurse</option>
                            <option value="Trainee Nurse">Trainee Nurse</option>
                            <option value="Receptionist">Receptionist</option>
                            <option value="TCO / Cleaner / Other">TCO / Cleaner / Other</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step={0.5}
                            min={0}
                            max={48}
                            value={emp.hoursPerWeek}
                            onChange={(e) =>
                              updateEmployee(emp.id, { hoursPerWeek: Number(e.target.value) })
                            }
                            className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step={0.25}
                            min={0}
                            value={emp.hourlyRateGbp}
                            onChange={(e) =>
                              updateEmployee(emp.id, { hourlyRateGbp: Number(e.target.value) })
                            }
                            className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step={250}
                            min={0}
                            value={emp.annualBonus}
                            onChange={(e) =>
                              updateEmployee(emp.id, { annualBonus: Number(e.target.value) })
                            }
                            className="w-16 px-1.5 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                            style={{ borderColor: 'var(--color-border)' }}
                          />
                        </td>
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={emp.pensionOptIn}
                            onChange={(e) =>
                              updateEmployee(emp.id, { pensionOptIn: e.target.checked })
                            }
                            className="accent-[#A6521C]"
                          />
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#26231E]">
                          £{calc.totalGrossPay.toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#6B6459]">
                          £{calc.employersNi.toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-2 text-right font-mono tabular-nums text-[#6B6459]">
                          £{calc.annualPension.toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-[#26231E]">
                          £{calc.totalStaffCost.toLocaleString('en-GB')}
                        </td>
                        <td className="py-2 px-2">
                          <button
                            type="button"
                            onClick={() => removeEmployee(emp.id)}
                            className="text-[#6B6459] hover:text-red-700 p-1"
                            aria-label="Remove staff member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-[#FAF8F4] font-semibold text-xs border-t" style={{ borderColor: 'var(--color-border)' }}>
                <tr>
                  <td colSpan={6} className="py-2.5 px-2.5 text-[#6B6459]">
                    {schedule.employees.length} Support Staff ({derived.totalTurnover > 0 ? ((derived.totalStaffPayrollPa / derived.totalTurnover) * 100).toFixed(1) : '0.0'}% of Gross Fees)
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                    £{derived.employeeRollup.gross.toLocaleString('en-GB')}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                    £{derived.employeeRollup.ni.toLocaleString('en-GB')}
                  </td>
                  <td className="py-2.5 px-2 text-right font-mono tabular-nums">
                    £{derived.employeeRollup.pension.toLocaleString('en-GB')}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-[#A6521C]">
                    £{derived.totalStaffPayrollPa.toLocaleString('en-GB')}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 5: PREMISES, FACILITIES & SURGERY EQUIPMENT (DPS Page 3,4,7,8)*/}
      {/* ===================================================================== */}
      {activeSection === 'premises' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Property Style
              </label>
              <select
                value={schedule.propertyStyle}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    propertyStyle: e.target.value as QuickPracticeScheduleData['propertyStyle'],
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="Detached">Detached</option>
                <option value="Semi-Detached">Semi-Detached</option>
                <option value="Terraced">Terraced</option>
                <option value="Shop Front / High Street">Shop Front / High Street</option>
                <option value="First Floor">First Floor</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Tenure
              </label>
              <select
                value={tenure}
                onChange={(e) => setTenure(e.target.value as 'Freehold' | 'Leasehold')}
                className="w-full px-3 py-2 text-sm rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <option value="Leasehold">Leasehold</option>
                <option value="Freehold">Freehold</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                {tenure === 'Leasehold' ? 'Rent pa (£)' : 'Approx. Freehold Value (£)'}
              </label>
              {tenure === 'Leasehold' ? (
                <input
                  type="number"
                  step={1000}
                  value={passingRentPa}
                  onChange={(e) => setPassingRentPa(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              ) : (
                <input
                  type="number"
                  step={10000}
                  value={schedule.approxFreeholdValue}
                  onChange={(e) =>
                    setSchedule({ ...schedule, approxFreeholdValue: Number(e.target.value) })
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Rates Payable (£ pa)
              </label>
              <input
                type="number"
                step={500}
                value={schedule.ratesPayablePa}
                onChange={(e) =>
                  setSchedule({ ...schedule, ratesPayablePa: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Approx. Floor Area (sq ft)
              </label>
              <input
                type="number"
                step={50}
                value={floorAreaSqFt}
                onChange={(e) => setFloorAreaSqFt(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Lease Length Remaining (yrs)
              </label>
              <input
                type="number"
                min={0}
                max={99}
                value={schedule.leaseYearsRemaining}
                onChange={(e) =>
                  setSchedule({ ...schedule, leaseYearsRemaining: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Surgeries (Ground / 1st / 2nd)
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={schedule.groundFloorSurgeries}
                  onChange={(e) =>
                    setSchedule({ ...schedule, groundFloorSurgeries: Number(e.target.value) })
                  }
                  title="Ground floor surgeries"
                  className="px-2 py-2 text-xs font-mono tabular-nums text-center rounded-[4px] border bg-white"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={schedule.firstFloorSurgeries}
                  onChange={(e) =>
                    setSchedule({ ...schedule, firstFloorSurgeries: Number(e.target.value) })
                  }
                  title="1st floor surgeries"
                  className="px-2 py-2 text-xs font-mono tabular-nums text-center rounded-[4px] border bg-white"
                  style={{ borderColor: 'var(--color-border)' }}
                />
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={schedule.secondFloorSurgeries}
                  onChange={(e) =>
                    setSchedule({ ...schedule, secondFloorSurgeries: Number(e.target.value) })
                  }
                  title="2nd floor surgeries"
                  className="px-2 py-2 text-xs font-mono tabular-nums text-center rounded-[4px] border bg-white"
                  style={{ borderColor: 'var(--color-border)' }}
                />
              </div>
              <span className="text-[11px] text-[#6B6459]">Total: {derived.surgeriesCount} operational</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#26231E] mb-1">
                Space for Extra Surgeries
              </label>
              <input
                type="number"
                min={0}
                max={6}
                value={schedule.spaceForAdditionalSurgeries}
                onChange={(e) =>
                  setSchedule({
                    ...schedule,
                    spaceForAdditionalSurgeries: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-[4px] border bg-white"
                style={{ borderColor: 'var(--color-border)' }}
              />
            </div>
          </div>

          {/* Facilities & Decontamination / Digital Equipment Checklists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-[#26231E] block">
                Premises Facilities &amp; Access
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#26231E]">
                {(
                  [
                    ['staffRoom', 'Staff Room'],
                    ['waitingRoom', 'Waiting Room'],
                    ['xrayRoom', 'X-Ray Room'],
                    ['wcWashroom', 'W/C Washroom'],
                    ['office', 'Practice Office'],
                    ['garden', 'Garden / Rear Yard'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.facilities[key]}
                      onChange={(e) =>
                        setSchedule({
                          ...schedule,
                          facilities: { ...schedule.facilities, [key]: e.target.checked },
                        })
                      }
                      className="accent-[#A6521C]"
                    />
                    {label}
                  </label>
                ))}
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.hasParking}
                    onChange={(e) => setSchedule({ ...schedule, hasParking: e.target.checked })}
                    className="accent-[#A6521C]"
                  />
                  Patient / Staff Parking
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={disabledAccess}
                    onChange={(e) => setDisabledAccess(e.target.checked)}
                    className="accent-[#A6521C]"
                  />
                  Disabled Access
                </label>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-xs font-bold text-[#26231E] block">
                Decontamination Room &amp; Digital Equipment
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#26231E]">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasDeconRoom}
                    onChange={(e) => setHasDeconRoom(e.target.checked)}
                    className="accent-[#A6521C]"
                  />
                  Dedicated Decon Room
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasOpgCbctRoom}
                    onChange={(e) => setHasOpgCbctRoom(e.target.checked)}
                    className="accent-[#A6521C]"
                  />
                  OPT / CBCT 3D Scanner
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.hasIntraoralScanner}
                    onChange={(e) =>
                      setSchedule({ ...schedule, hasIntraoralScanner: e.target.checked })
                    }
                    className="accent-[#A6521C]"
                  />
                  Intraoral Scanner (iTero/Trios)
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.hasCerec}
                    onChange={(e) => setSchedule({ ...schedule, hasCerec: e.target.checked })}
                    className="accent-[#A6521C]"
                  />
                  CEREC CAD/CAM
                </label>
                <label className="inline-flex items-center gap-2 col-span-2 pt-1">
                  <span className="text-[#6B6459]">Autoclaves in Decon Room:</span>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={schedule.autoclavesCount}
                    onChange={(e) =>
                      setSchedule({ ...schedule, autoclavesCount: Number(e.target.value) })
                    }
                    className="w-16 px-2 py-1 text-xs font-mono tabular-nums rounded border bg-white"
                    style={{ borderColor: 'var(--color-border)' }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Per-Surgery Equipment Table */}
          <div className="space-y-2.5 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#26231E]">
                Surgery Chair &amp; Cabinetry Inventory
              </span>
              <button
                type="button"
                onClick={addSurgeryEquipment}
                className="px-2.5 py-1 text-xs font-semibold rounded-[4px] border bg-white hover:bg-[#FAF8F4] flex items-center gap-1"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <Plus className="w-3 h-3" /> Add Surgery
              </button>
            </div>
            <div className="border rounded-[6px] overflow-x-auto" style={{ borderColor: 'var(--color-border)' }}>
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F4] border-b text-[11px] font-semibold text-[#6B6459]" style={{ borderColor: 'var(--color-border)' }}>
                  <tr>
                    <th className="py-2 px-3">Surgery</th>
                    <th className="py-2 px-3">Chair Make</th>
                    <th className="py-2 px-3 text-right">Chair Age (yrs)</th>
                    <th className="py-2 px-3 text-center">Intraoral X-Ray</th>
                    <th className="py-2 px-3 text-right">Cabinetry Age (yrs)</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
                  {schedule.surgeriesEquipment.map((eq, idx) => (
                    <tr key={eq.surgeryNumber}>
                      <td className="py-2 px-3 font-mono font-semibold">Surgery {eq.surgeryNumber}</td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={eq.chairMake}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              surgeriesEquipment: prev.surgeriesEquipment.map((item, i) =>
                                i === idx ? { ...item, chairMake: e.target.value } : item
                              ),
                            }))
                          }
                          className="w-full px-2 py-1 text-xs rounded border bg-white"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={35}
                          value={eq.approxAgeYears}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              surgeriesEquipment: prev.surgeriesEquipment.map((item, i) =>
                                i === idx ? { ...item, approxAgeYears: Number(e.target.value) } : item
                              ),
                            }))
                          }
                          className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </td>
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={eq.hasXray}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              surgeriesEquipment: prev.surgeriesEquipment.map((item, i) =>
                                i === idx ? { ...item, hasXray: e.target.checked } : item
                              ),
                            }))
                          }
                          className="accent-[#A6521C]"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <input
                          type="number"
                          min={0}
                          max={35}
                          value={eq.cabinetryAgeYears}
                          onChange={(e) =>
                            setSchedule((prev) => ({
                              ...prev,
                              surgeriesEquipment: prev.surgeriesEquipment.map((item, i) =>
                                i === idx ? { ...item, cabinetryAgeYears: Number(e.target.value) } : item
                              ),
                            }))
                          }
                          className="w-16 px-2 py-1 text-xs font-mono tabular-nums text-right rounded border bg-white"
                          style={{ borderColor: 'var(--color-border)' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Action Row */}
      <div
        className="pt-4 border-t flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2 text-xs text-[#6B6459]">
          <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
          <span>
            Live sync ready: {derived.surgeriesCount} surgeries · {schedule.clinicians.length} clinicians ·{' '}
            {schedule.employees.length} staff · FMOP {formatGbp(derived.previewValuation.fmop)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {activeSection !== 'premises' && (
            <button
              type="button"
              onClick={() => {
                const order: SectionKey[] = ['summary', 'revenue', 'clinicians', 'staff', 'premises'];
                const next = order[order.indexOf(activeSection) + 1];
                if (next) setActiveSection(next);
              }}
              className="btn-secondary !py-2.5 !px-4 text-xs whitespace-nowrap"
            >
              Next Section &rarr;
            </button>
          )}
          <button
            type="submit"
            className="btn-primary !py-2.5 !px-5 text-xs flex items-center gap-1.5 whitespace-nowrap"
          >
            Calculate Full Valuation Report <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  );
};
