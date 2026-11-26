export type PracticeType = 'NHS Practice' | 'Private Practice' | 'Mixed Practice' | 'Specialist Practice';

export type UkRegion =
  | 'London & South East'
  | 'Midlands'
  | 'North West'
  | 'Yorkshire & Humber'
  | 'South West'
  | 'East of England'
  | 'Scotland'
  | 'Wales'
  | 'North East';

export interface DentalIntakeData {
  // Practice Identification & Type
  practiceName: string;
  practiceType: PracticeType;
  address: string;
  postcode: string;
  region: UkRegion;
  yearsEstablished: number;
  
  // Physical Property & Surgeries
  surgeriesCount: number; // e.g. 1 to 12
  floorAreaSqFt: number; // Net Internal Area (sq ft)
  tenure: 'Freehold' | 'Leasehold';
  passingRentPa?: number; // £/annum if leasehold
  hasDeconRoom: boolean; // HTM 01-05 compliant dedicated decontamination room
  hasOpgCbctRoom: boolean; // OPG / CBCT digital 3D imaging room
  disabledAccess: boolean;

  // Income & Contract Streams
  turnover: number; // £ Total Gross Income / Fees
  // NHS Contract Breakdown (if NHS or Mixed)
  nhsAnnualValue: number; // £ Total NHS contract value
  udaRequirement: number; // Number of contracted UDAs
  udaRate: number; // £ per UDA (e.g. £35.00)
  clawbackAmount: number; // £ Under-delivery clawback deduction if any
  // Private Breakdown
  privateFpiTurnover: number; // £ Private fee-per-item & elective cosmetic
  privatePlanTurnover: number; // £ Monthly patient capitation (Denplan / Practice Plan / DPAS)
  specialistReferralTurnover: number; // £ Specialist implantology / orthodontics / endodontics

  // Financials & Operating Costs
  materialsAndLabCostPercent: number; // Typically 14% - 20%
  directAssociateTherapistCostPercent: number; // Typically 35% - 48%
  staffWagesPa: number; // Practice manager, dental nurses, receptionists
  adjustedEbitda: number; // Normalized operating profit / FMOP
  // Which profit adjustedEbitda is: before paying anyone to do the principal's
  // clinical work (owner_operated) or after a market-rate associate replacement
  // (associate_led). Missing on older saved intakes; the engine then infers it.
  ebitdaBasis?: 'owner_operated' | 'associate_led';

  // Diligence & Clinical Autonomy
  principalChairHoursPerWeek: number; // 0 (fully managed) up to 40+ hrs
  associateRemunerationModel: 'percentage_split_bda' | 'per_uda_rate' | 'hybrid_informal';
  associateContracts: 'all_bda_with_covenants' | 'informal_some_covenants' | 'unwritten_high_flight_risk';
  surgeryChairUtilisationPercent: number; // 0 - 100%
  hygieneTherapistModel: 'direct_access_active' | 'dentist_referral_only' | 'dentist_does_all';
  cqcStatus: 'Good / Outstanding' | 'Requires Improvement' | 'Inspection Due';
  // Optional Broker Info & Staffing Schedule enrichment
  quickSchedule?: QuickPracticeScheduleData;
}

export interface ClinicianScheduleRow {
  id: string;
  role: 'Principal' | 'Associate';
  nameOrInitials: string;
  speciality: string;
  hoursPerWeek: number;
  stayPostSale: 'Stay' | 'Leave';
  privateFpiRevenue: number;
  privateFpiPercent: number;
  patientPlanRevenue: number;
  patientPlanPercent: number;
  allocatedUdas: number;
  allocatedUoas: number;
  netPayPerUda: number;
  labsDeductedPercent: number;
}

export interface HygienistScheduleRow {
  id: string;
  nameOrInitials: string;
  tenureYears: string;
  employmentType: 'Self Employed' | 'Employed';
  payBasis: 'percent_revenue' | 'hourly_rate';
  fpiHygieneRevenue: number;
  hoursPerWeek: number;
  hourlyRateGbp: number;
  revenuePercentEarned: number;
  usesNurse: boolean;
}

export interface FoundationDentistRow {
  id: string;
  nameOrInitials: string;
  startDate: string;
  hoursPerWeek: number;
  annualSalary: number;
}

export interface SupportEmployeeRow {
  id: string;
  initials: string;
  position: 'Practice Manager' | 'Nurse' | 'Trainee Nurse' | 'Receptionist' | 'TCO / Cleaner / Other';
  tenureYears: string;
  hoursPerWeek: number;
  hourlyRateGbp: number;
  annualBonus: number;
  pensionOptIn: boolean;
  payRiseDue: string;
  qualificationDueDate: string;
}

export interface SurgeryEquipmentRow {
  surgeryNumber: number;
  chairMake: string;
  approxAgeYears: number;
  hasXray: boolean;
  cabinetryAgeYears: number;
}

export interface QuickPracticeScheduleData {
  // Section 1: Practice Summary & Opening Hours
  ownershipSinceYear: number;
  partnersCount: number;
  businessStructure: 'Limited Co.' | 'Sole Trader' | 'Partnership';
  vtContract: boolean;
  spaceForAdditionalSurgeries: number;
  reasonForSelling: 'Retirement' | 'Corporate Exit' | 'Relocation' | 'Equity Release' | 'Other';
  software: 'SOE Exact' | 'Dentally' | 'R4' | 'Systems for Dentists (SfD)' | 'Other';
  openingHoursMonFri: string;
  openSaturday: boolean;
  openSunday: boolean;
  // Section 2: Extended Revenue Breakdown
  hygienistIncome: number;
  otherIncome: number;
  // Section 3 & 4: Clinicians, Hygiene, FD & Staff Schedule
  clinicians: ClinicianScheduleRow[];
  hygienists: HygienistScheduleRow[];
  hygienistRechargeActive: boolean;
  hygienistAnnualRechargeGbp: number;
  foundationDentists: FoundationDentistRow[];
  employees: SupportEmployeeRow[];
  // Section 5: Premises, Facilities & Equipment
  propertyStyle: 'Detached' | 'Semi-Detached' | 'Terraced' | 'Shop Front / High Street' | 'First Floor';
  buildingAge: string;
  ratesPayablePa: number;
  approxFreeholdValue: number;
  leaseYearsRemaining: number;
  groundFloorSurgeries: number;
  firstFloorSurgeries: number;
  secondFloorSurgeries: number;
  hasParking: boolean;
  hasFloorPlan: boolean;
  facilities: {
    staffRoom: boolean;
    waitingRoom: boolean;
    xrayRoom: boolean;
    wcWashroom: boolean;
    office: boolean;
    garden: boolean;
  };
  surgeriesEquipment: SurgeryEquipmentRow[];
  autoclavesCount: number;
  hasIntraoralScanner: boolean;
  hasCerec: boolean;
}

export interface FixItem {
  id: string;
  rank: number;
  title: string;
  description: string;
  estimatedPoundImpactMin: number; // £
  estimatedPoundImpactMax: number; // £
  category: 'UDA Delivery & Clawback' | 'Private Plan Conversion' | 'Chairside Autonomy' | 'Surgery Utilisation';
  timelineMonths: number;
}

export interface BankStandardValuationResult {
  practiceName: string;
  practiceType: PracticeType;
  location: string;
  surgeries: number;
  floorAreaSqFt: number;
  
  // Fair Maintainable Trade Assessment
  fmtIncome: number; // £ Fair Maintainable Turnover
  fmtCostOfSales: number; // £
  fmtGrossProfit: number; // £
  fmtAdminExpenses: number; // £
  fmop: number; // £ Fair Maintainable Operating Profit (Adopted EBITDA)
  fmopMarginPercent: number; // %

  // Multiplier & Valuation Profile
  ypMultiplierAdopted: number; // e.g. 7.00 YP
  ypMultiplierRangeLow: number; // e.g. 5.50 YP
  ypMultiplierRangeHigh: number; // e.g. 9.50 YP
  
  // Bank Valuations
  mv1MarketValueGoodwill: number; // £ MV1: Fully equipped operational entity on managed basis
  mv1MarketValueTotal: number; // £ MV1 including freehold if freehold
  mv2RestrictedMarketingValue: number; // £ MV2: 6-month restricted marketing assumption (20% discount)
  mv3ClosedPracticeValue: number; // £ MV3: Closed practice, depleted inventory, lost licenses (£Nil goodwill)
  
  // Property & Reinstatement
  marketRentPa: number; // £24,000 pa opinion of Market Rent
  marketRentPsf: number; // £/sq ft NIA
  reinstatementCostEstimate: number; // £ Day One fire insurance reinstatement

  // Diligence & Value Enhancement
  buyerReadinessScore: number; // 0 to 100
  potentialPremiumValuation: number; // £ Value at institutional readiness
  potentialUpsidePounds: number; // £ Value gain

  topFixes: FixItem[];
  swotAnalysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };

  methodologyComparison: {
    corporateEbitda: {
      name: string;
      ypMultiple: number;
      valuationGbp: number;
      valuationRange: [number, number];
      basis: string;
      typicalBuyer: string;
    };
    grossFeesTurnover: {
      name: string;
      adoptedPercent: number;
      valuationGbp: number;
      valuationRange: [number, number];
      basis: string;
      typicalBuyer: string;
    };
    reconstitutedNetProfit: {
      name: string;
      adjustedProfitGbp: number;
      principalClinicalSalaryAllowance: number;
      multiple: number;
      valuationGbp: number;
      basis: string;
      typicalBuyer: string;
    };
  };
  
  regionalComparison: {
    regionName: string;
    localAvgMultiple: number;
    nationalAvgMultiple: number;
    practiceMultiple: number;
    localPrivatePlanAvg: number;
    practicePrivatePlanMix: number;
  };
}

export interface MarketCompDeal {
  id: string;
  town: string;
  county: string;
  region: UkRegion;
  percentageNhs: string;
  completionDate: string;
  purchasePrice: number;
  turnover: number;
  ebitda: number;
  ebitdaPercent: number;
  ypMultiplier: number;
  isFreehold: boolean;
  isOwnerOperated: boolean;
}

export interface RegionalBenchmarkData {
  region: UkRegion;
  activeRollupPlatforms: number;
  averageEbitdaMultiple: number;
  premiumEbitdaMultiple: number;
  avgEbitdaMarginPercent: number;
  avgPrivateCapitationPercent: number;
  dealVelocityQuarter: number;
}
