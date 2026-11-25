import { DentalIntakeData, BankStandardValuationResult, FixItem } from '../types';
import { UK_REGIONAL_BENCHMARKS, UK_NATIONAL_AVERAGES } from '../data/ukMarketData';
import {
  ASSOCIATE_LED_FULL_WEIGHT_AT_HOURS,
  ASSOCIATE_LED_MULTIPLE,
  DEFAULT_OWNER_MARGIN,
  DRIVER_FACTORS,
  GOODWILL_PCT_OF_FEES,
  OWNER_OPERATED_FULL_WEIGHT_AT_HOURS,
  OWNER_OPERATED_MULTIPLE,
  PRINCIPAL_HOURS_PER_SURGERY,
  PRINCIPAL_REPLACEMENT_PAY_RATE,
  REGION_FACTOR,
  VALUATION_RANGE,
  surgeryFactor,
} from '../data/valuationBenchmarks';

export type EbitdaBasis = 'owner_operated' | 'associate_led';

/**
 * Which basis the user's profit figure is on. Older saved intakes have no
 * `ebitdaBasis`. ASSUMPTION: then a principal working more than 10 chair hours
 * is taken to have typed their own owner-operated profit (the figure most
 * owners know, and the safer reading: the old engine's associate-led reading
 * overvalued owner-operated profit by ~70%).
 */
export function resolveEbitdaBasis(data: DentalIntakeData): EbitdaBasis {
  if (data.ebitdaBasis) return data.ebitdaBasis;
  return (data.principalChairHoursPerWeek ?? 20) > ASSOCIATE_LED_FULL_WEIGHT_AT_HOURS ? 'owner_operated' : 'associate_led';
}

interface CoreValuation {
  effectiveIncome: number;
  clawback: number;
  planPct: number;
  basis: EbitdaBasis;
  ownerEbitda: number;
  associateEbitda: number;
  principalReplacementCost: number;
  principalFeeShare: number;
  driverFactor: number;
  ownerMultiple: number;
  associateMultiple: number;
  associateWeight: number;
  ownerValue: number;
  associateValue: number;
  goodwill: number;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(Math.max(x, lo), hi);

/**
 * Share of practice fees the principal personally generates. Uses the
 * clinician schedule when one is given, else chair hours against surgery capacity.
 */
function principalFeeShare(data: DentalIntakeData): number {
  const hours = Math.max(data.principalChairHoursPerWeek || 0, 0);
  const clinicians = data.quickSchedule?.clinicians ?? [];
  const totalHours = clinicians.reduce((s, c) => s + (c.hoursPerWeek || 0), 0);
  if (totalHours > 0) {
    const principalHours = clinicians
      .filter((c) => c.role === 'Principal')
      .reduce((s, c) => s + (c.hoursPerWeek || 0), 0);
    return clamp(principalHours / totalHours, 0, 1);
  }
  const capacity = Math.max(data.surgeriesCount || 1, 1) * PRINCIPAL_HOURS_PER_SURGERY;
  return clamp(hours / capacity, 0, 1);
}

/** Multiplicative adjustments to the segment multiple (region, size, diligence). */
function driverFactor(data: DentalIntakeData, clawback: number, planPct: number): number {
  const f = DRIVER_FACTORS;
  let k = REGION_FACTOR[data.region] ?? 1;

  if (data.practiceType === 'NHS Practice' || data.practiceType === 'Mixed Practice') {
    if (data.udaRate >= 38) k *= f.udaRateHigh;
    else if (data.udaRate > 0 && data.udaRate <= 28) k *= f.udaRateLow;
    if (clawback > 0) k *= f.clawback;
  }

  if (planPct >= 35) k *= f.planShareHigh;
  else if (planPct >= 20) k *= f.planShareMid;

  if (data.associateContracts === 'all_bda_with_covenants') k *= f.contractsBdaWithCovenants;
  else if (data.associateContracts === 'unwritten_high_flight_risk') k *= f.contractsUnwritten;

  const qs = data.quickSchedule;
  if (qs) {
    if (qs.spaceForAdditionalSurgeries >= 1) k *= f.expansionSpace;
    if (qs.hasIntraoralScanner || qs.hasCerec) k *= f.digitalEquipment;
    if (data.tenure === 'Leasehold' && qs.leaseYearsRemaining > 0 && qs.leaseYearsRemaining < 7) k *= f.shortLease;
    if (qs.vtContract) k *= f.vtContract;
  }
  return k;
}

/**
 * Goodwill value on both EBITDA bases.
 *
 * The market prices owner-operated profit at ~3.5x and associate-led
 * (fully managed) profit at ~7x (Christie H1 2026). The two profits differ by
 * the cost of paying an associate to do the principal's clinical work, so each
 * multiple must be applied to its own profit. The old engine applied a ~7x
 * multiple to whatever profit was typed in.
 */
function valueGoodwill(data: DentalIntakeData): CoreValuation {
  const turnover = Math.max(data.turnover, 100000);
  const clawback = Math.max(data.clawbackAmount || 0, 0);
  const effectiveIncome = Math.max(turnover - clawback, 80000);
  const planPct = ((data.privatePlanTurnover || 0) / turnover) * 100;
  const basis = resolveEbitdaBasis(data);

  const share = principalFeeShare(data);
  const replacement = Math.round(effectiveIncome * share * PRINCIPAL_REPLACEMENT_PAY_RATE);

  // Profit on the user's basis: typed figure, else from their cost inputs,
  // else the segment's typical owner-operated margin.
  let ownerEbitda: number;
  let associateEbitda: number;
  const hasCostInputs =
    (data.materialsAndLabCostPercent || 0) > 0 ||
    (data.directAssociateTherapistCostPercent || 0) > 0 ||
    (data.staffWagesPa || 0) > 0;
  if (data.adjustedEbitda > 0 || hasCostInputs) {
    const stated = data.adjustedEbitda > 0 ? data.adjustedEbitda : costBasedProfit(data, effectiveIncome);
    if (basis === 'owner_operated') {
      ownerEbitda = stated;
      associateEbitda = stated - replacement;
    } else {
      associateEbitda = stated;
      ownerEbitda = stated + replacement;
    }
  } else {
    ownerEbitda = Math.round(effectiveIncome * DEFAULT_OWNER_MARGIN[data.practiceType]);
    associateEbitda = ownerEbitda - replacement;
  }

  const k = driverFactor(data, clawback, planPct);
  const ownerMultiple = OWNER_OPERATED_MULTIPLE[data.practiceType] * k * surgeryFactor(data.surgeriesCount || 3);
  const associateMultiple = ASSOCIATE_LED_MULTIPLE[data.practiceType] * k;

  const hours = data.principalChairHoursPerWeek ?? 20;
  let associateWeight = clamp(
    (OWNER_OPERATED_FULL_WEIGHT_AT_HOURS - hours) /
      (OWNER_OPERATED_FULL_WEIGHT_AT_HOURS - ASSOCIATE_LED_FULL_WEIGHT_AT_HOURS),
    0,
    1,
  );
  // A practice that makes no profit once the principal is replaced can only be
  // sold on its owner-operated profit.
  if (associateEbitda <= 0) associateWeight = 0;

  const ownerValue = Math.max(ownerEbitda, 0) * ownerMultiple;
  const associateValue = Math.max(associateEbitda, 0) * associateMultiple;
  const goodwill = Math.max(associateWeight * associateValue + (1 - associateWeight) * ownerValue, 0);

  return {
    effectiveIncome,
    clawback,
    planPct,
    basis,
    ownerEbitda: Math.round(ownerEbitda),
    associateEbitda: Math.round(associateEbitda),
    principalReplacementCost: replacement,
    principalFeeShare: share,
    driverFactor: k,
    ownerMultiple,
    associateMultiple,
    associateWeight,
    ownerValue: Math.round(ownerValue),
    associateValue: Math.round(associateValue),
    goodwill: Math.round(goodwill / 10000) * 10000,
  };
}

/** Profit from the cost inputs (principal not paid, so owner-operated if they work chairside). */
function costBasedProfit(data: DentalIntakeData, effectiveIncome: number): number {
  const b = costBreakdown(data, effectiveIncome);
  return b.grossProfit - b.totalAdminExpenses;
}

function costBreakdown(data: DentalIntakeData, effectiveIncome: number) {
  const matLabPct = data.materialsAndLabCostPercent ? data.materialsAndLabCostPercent / 100 : 0.16;
  const assocPct = data.directAssociateTherapistCostPercent ? data.directAssociateTherapistCostPercent / 100 : 0.38;
  const costOfSales = Math.round(effectiveIncome * matLabPct) + Math.round(effectiveIncome * assocPct);
  const grossProfit = effectiveIncome - costOfSales;
  const staffWages = data.staffWagesPa || Math.round(effectiveIncome * 0.18);
  const otherOverheads = Math.round(effectiveIncome * 0.13);
  return { costOfSales, grossProfit, totalAdminExpenses: staffWages + otherOverheads };
}

export function calculateDentalValuation(data: DentalIntakeData): BankStandardValuationResult {
  const regionStats = UK_REGIONAL_BENCHMARKS[data.region] || UK_REGIONAL_BENCHMARKS['Yorkshire & Humber'];
  const core = valueGoodwill(data);
  const { effectiveIncome, clawback, planPct } = core;
  const { costOfSales, grossProfit, totalAdminExpenses } = costBreakdown(data, effectiveIncome);

  // 1. Reported FMOP: the fully managed (associate-led) profit, as in a bank
  // valuation. If replacing the principal leaves too little profit to quote a
  // sensible multiple, report the owner-operated profit instead.
  const reportOnAssociateBasis = core.associateEbitda >= effectiveIncome * 0.05;
  const fmop = reportOnAssociateBasis ? core.associateEbitda : core.ownerEbitda;
  const fmopMarginPercent = parseFloat(((fmop / effectiveIncome) * 100).toFixed(1));

  // 2. Effective multiple of the reported FMOP.
  const mv1MarketValueGoodwill = core.goodwill;
  const adoptedYp = fmop > 0 ? parseFloat((mv1MarketValueGoodwill / fmop).toFixed(2)) : 0;
  const ypRangeLow = parseFloat((adoptedYp * VALUATION_RANGE.low).toFixed(2));
  const ypRangeHigh = parseFloat((adoptedYp * VALUATION_RANGE.high).toFixed(2));

  // 3. Bank-Standard Valuations
  // Freehold Bricks & Mortar estimate if freehold
  const floorArea = data.floorAreaSqFt || 2000;
  const estimatedFreeholdBuildingValue = data.tenure === 'Freehold'
    ? Math.round(floorArea * 215) // ~£215/sq ft capital value for commercial D1/E medical
    : 0;

  const mv1MarketValueTotal = mv1MarketValueGoodwill + estimatedFreeholdBuildingValue;

  // MV2: Special Assumption - 6 Month Restricted Marketing Period
  // Bank standard rule: 20% discount on goodwill
  const mv2RestrictedMarketingValue = Math.round(mv1MarketValueGoodwill * 0.8);

  // MV3: Special Assumption - Closed practice, depleted inventory, lost licenses
  const mv3ClosedPracticeValue = 0; // £Nil goodwill

  // Market Rent & Reinstatement Cost
  const marketRentPsf = data.region === 'London & South East' ? 22.5 : 17.5;
  const marketRentPa = Math.round(floorArea * marketRentPsf);
  const reinstatementCostEstimate = Math.round(floorArea * 370); // Day One rebuild cost ~£370/sq ft

  // 4. Buyer-Readiness Score (0 to 100)
  // ASSUMPTION: 60 for a benchmark practice, moved by the diligence factor and
  // by how far the practice runs without the principal in the chair.
  const hours = data.principalChairHoursPerWeek ?? 20;
  let score = 60 + Math.round((core.driverFactor - 1) * 150);
  if (hours <= 10) score += 10;
  else if (hours >= 30) score -= 10;
  if (data.hasDeconRoom) score += 5;
  if (data.cqcStatus === 'Good / Outstanding') score += 5;
  if (data.associateContracts === 'all_bda_with_covenants') score += 5;
  const buyerReadinessScore = Math.min(Math.max(score, 25), 98);

  // Premium readiness: the same practice with the main value drivers fixed.
  const premiumCase = valueGoodwill({
    ...data,
    ebitdaBasis: core.basis,
    principalChairHoursPerWeek: Math.min(hours, 10),
    privatePlanTurnover: Math.max(data.privatePlanTurnover || 0, Math.round(data.turnover * 0.35)),
    associateContracts: 'all_bda_with_covenants',
    clawbackAmount: 0,
  });
  const potentialPremiumValuation = Math.max(premiumCase.goodwill, mv1MarketValueGoodwill);
  const potentialUpsidePounds = potentialPremiumValuation - mv1MarketValueGoodwill;

  // Impact of one fix = value with the fix applied minus value today.
  // The profit basis is pinned so that changing chair hours doesn't change how
  // the typed profit is read.
  const fixImpact = (changes: Partial<DentalIntakeData>) =>
    Math.max(valueGoodwill({ ...data, ebitdaBasis: core.basis, ...changes }).goodwill - mv1MarketValueGoodwill, 0);
  // ASSUMPTION: a fix's low estimate is 60% of the modelled gain (execution risk).
  const impactRange = (gain: number) => ({ minG: Math.round(gain * 0.6), maxG: gain });
  const turnover = Math.max(data.turnover, 100000);

  // 5. Prioritized Fixes with Exact Pound (£) Impact
  const topFixes: FixItem[] = [];

  if (data.principalChairHoursPerWeek >= 20) {
    const { minG, maxG } = impactRange(fixImpact({ principalChairHoursPerWeek: 12 }));
    topFixes.push({
      id: 'fix-chair',
      rank: 1,
      title: 'Extract yourself from routine clinical chairtime (<15 hrs/week).',
      description: 'Corporate buyers (Portman Dentex, Bupa, Rodericks) impose severe multiple discounts or mandatory 3–5 year earn-outs when the principal generates over 35% of practice fees. Recruit an experienced associate and transition your routine patient book.',
      estimatedPoundImpactMin: minG,
      estimatedPoundImpactMax: maxG,
      category: 'Chairside Autonomy',
      timelineMonths: 18,
    });
  }

  if (planPct < 25) {
    const { minG, maxG } = impactRange(fixImpact({ privatePlanTurnover: Math.round(turnover * 0.35) }));
    topFixes.push({
      id: 'fix-plan',
      rank: 2,
      title: 'Convert private patients into monthly recurring capitation (Denplan / Practice Plan).',
      description: `Your monthly patient plan represents only ${planPct.toFixed(1)}% of turnover. Corporate acquirers assign premium multiples to contracted direct-debit patient lists (Denplan/Practice Plan/DPAS). Aim for 35%+ recurring capitation before listing.`,
      estimatedPoundImpactMin: minG,
      estimatedPoundImpactMax: maxG,
      category: 'Private Plan Conversion',
      timelineMonths: 12,
    });
  }

  if (clawback > 0 || (data.practiceType === 'NHS Practice' && data.surgeryChairUtilisationPercent < 80)) {
    // ASSUMPTION: delivering the missing UDAs costs ~50% of their value in associate pay.
    const { minG, maxG } = impactRange(fixImpact({
      clawbackAmount: 0,
      adjustedEbitda: data.adjustedEbitda > 0 ? data.adjustedEbitda + Math.round(clawback * 0.5) : 0,
    }));
    topFixes.push({
      id: 'fix-uda',
      rank: 3,
      title: 'Eliminate UDA clawback and deploy therapist-led NHS delivery.',
      description: `Under-delivery clawback of £${clawback.toLocaleString('en-GB')} directly erodes practice EBITDA and spooks corporate investment committees. Utilise dental therapists at £11/UDA to safeguard full contract retention.`,
      estimatedPoundImpactMin: minG,
      estimatedPoundImpactMax: maxG,
      category: 'UDA Delivery & Clawback',
      timelineMonths: 6,
    });
  }

  if (data.surgeryChairUtilisationPercent < 75) {
    // ASSUMPTION: filling chairs to 85% grows fees pro rata, at a 35% contribution
    // margin (after associate pay and materials; fixed costs don't rise).
    const util = Math.max(data.surgeryChairUtilisationPercent, 20);
    const extraFees = Math.round(turnover * (85 - util) / util);
    const { minG, maxG } = impactRange(fixImpact({
      turnover: turnover + extraFees,
      adjustedEbitda: data.adjustedEbitda > 0 ? data.adjustedEbitda + Math.round(extraFees * 0.35) : 0,
    }));
    topFixes.push({
      id: 'fix-chair-util',
      rank: 4,
      title: 'Maximise empty surgery chair hours across 5.5 operating days.',
      description: `With surgery utilisation at ${data.surgeryChairUtilisationPercent}%, you have unbilled clinical capacity. Introducing visiting specialist implantology or Saturday private clinics unlocks high-margin revenue without extra rent.`,
      estimatedPoundImpactMin: minG,
      estimatedPoundImpactMax: maxG,
      category: 'Surgery Utilisation',
      timelineMonths: 9,
    });
  }

  const finalTopFixes = topFixes.filter((f) => f.estimatedPoundImpactMax > 0).slice(0, 3).map((f, idx) => ({ ...f, rank: idx + 1 }));

  // 6. SWOT Analysis Table (Matching Bank Valuation Report standard)
  const swotAnalysis = {
    strengths: [
      `Established trading track record (${data.yearsEstablished} years) in ${data.region}.`,
      `${data.surgeriesCount} well-equipped operational dental surgeries with ${data.hasDeconRoom ? 'dedicated HTM 01-05 decontamination' : 'decontamination facilities'}.`,
      data.practiceType === 'NHS Practice' || data.practiceType === 'Mixed Practice'
        ? `Valuable NHS GDS contract with £${data.udaRate.toFixed(2)} UDA rate (${data.udaRequirement.toLocaleString()} contracted UDAs).`
        : `High-margin private patient base with £${data.privatePlanTurnover.toLocaleString()} recurring capitation.`,
      `CQC compliance rating (${data.cqcStatus}) with compliant clinical governance.`,
    ],
    weaknesses: [
      data.principalChairHoursPerWeek > 25
        ? `High principal chairside dependency (${data.principalChairHoursPerWeek} hrs/week), posing key-person risk to incoming acquirers.`
        : 'Moderate associate recruitment competition in local catchment area.',
      clawback > 0 ? `Historical NHS under-delivery clawback deduction of £${clawback.toLocaleString()}.` : 'Limited on-site patient parking.',
      data.tenure === 'Leasehold' ? 'Subject to commercial landlord lease terms and 5-year rent reviews.' : 'Capital expenditure required for ongoing digital scanner upgrades.',
    ],
    opportunities: [
      'Increase surgery chair utilisation across all surgeries by operating 5.5 days/week including Saturday mornings.',
      'Convert private fee-per-item patients into contracted monthly membership direct debits (Denplan/Practice Plan).',
      'Deploy therapist-led direct access hygiene recall to expand gross margin.',
      'Introduce specialist tertiary referral services (Invisalign orthodontics, implantology, endodontics).',
    ],
    threats: [
      'Potential NHS contractual reform or ICB clawback enforcement for under-delivery.',
      'National Minimum Wage and dental nurse wage inflation putting upward pressure on staff overheads.',
      'Consolidation and aggressive patient marketing from corporate dental groups (Portman Dentex, Bupa, mydentist) in surrounding 10-mile radius.',
    ],
  };

  // 7. Valuation Methodology Comparison (Corporate EBITDA vs % of Fees vs Owner-Operated Profit)
  // % of fees: NASDAL April 2026 segment figure, moved by the same drivers.
  let feePctAdjustment = 0;
  if (data.practiceType === 'NHS Practice' || data.practiceType === 'Mixed Practice') {
    if (data.udaRate >= 38) feePctAdjustment += 10;
    else if (data.udaRate > 0 && data.udaRate <= 28) feePctAdjustment -= 10;
    if (clawback > 0) feePctAdjustment -= 15;
  }
  if (planPct >= 35) feePctAdjustment += 10;
  else if (planPct >= 20) feePctAdjustment += 5;
  const baseGrossFeePct = Math.round(
    (GOODWILL_PCT_OF_FEES[data.practiceType] + feePctAdjustment) * (REGION_FACTOR[data.region] ?? 1),
  );

  const grossFeeValuation = Math.round(effectiveIncome * (baseGrossFeePct / 100));
  const grossFeeRangeLow = Math.round(effectiveIncome * ((baseGrossFeePct - 20) / 100));
  const grossFeeRangeHigh = Math.round(effectiveIncome * ((baseGrossFeePct + 20) / 100));

  // Owner-operated profit (before paying for the principal's clinical work).
  const principalClinicalSalaryAllowance = core.principalReplacementCost;
  const reconstitutedProfit = core.ownerEbitda;
  const reconstitutedMultiple = parseFloat(core.ownerMultiple.toFixed(2));
  const reconstitutedValuation = Math.round(core.ownerValue);
  const associateMultiple = parseFloat(core.associateMultiple.toFixed(2));

  const methodologyComparison = {
    corporateEbitda: {
      name: 'Corporate EBITDA Multiple (DSO / PE Standard)',
      ypMultiple: associateMultiple,
      valuationGbp: core.associateValue,
      valuationRange: [
        Math.round(core.associateValue * VALUATION_RANGE.low),
        Math.round(core.associateValue * VALUATION_RANGE.high),
      ] as [number, number],
      basis: `Associate-led EBITDA of £${Math.max(core.associateEbitda, 0).toLocaleString('en-GB')} (after a £${core.principalReplacementCost.toLocaleString('en-GB')} market-rate replacement for the principal's clinical work) at ${associateMultiple}x.`,
      typicalBuyer: 'Portman Dentex, Bupa Dental Care, Rodericks Dental Partners, Riverdale Healthcare, Clyde Munro',
    },
    grossFeesTurnover: {
      name: 'NASDAL Goodwill % of Fees Benchmark',
      adoptedPercent: baseGrossFeePct,
      valuationGbp: grossFeeValuation,
      valuationRange: [grossFeeRangeLow, grossFeeRangeHigh] as [number, number],
      basis: `${baseGrossFeePct}% of gross fees: the NASDAL April 2026 average for this practice type, adjusted for region, UDA rate, clawback and plan income.`,
      typicalBuyer: 'Independent practice owners, regional 2–5 practice groups, commercial bank debt underwriting',
    },
    reconstitutedNetProfit: {
      name: 'Owner-Operated EBITDA Multiple',
      adjustedProfitGbp: reconstitutedProfit,
      principalClinicalSalaryAllowance,
      multiple: reconstitutedMultiple,
      valuationGbp: reconstitutedValuation,
      basis: `Owner-operated EBITDA (before paying anyone to do the principal's clinical work) at ${reconstitutedMultiple}x, the Christie H1 2026 owner-operated multiple adjusted for this practice.`,
      typicalBuyer: 'First-time associate buyers, existing practice partners, local independent dentists',
    },
  };

  return {
    practiceName: data.practiceName,
    practiceType: data.practiceType,
    location: `${data.address}, ${data.postcode} (${data.region})`,
    surgeries: data.surgeriesCount,
    floorAreaSqFt: floorArea,
    fmtIncome: effectiveIncome,
    fmtCostOfSales: costOfSales,
    fmtGrossProfit: grossProfit,
    fmtAdminExpenses: totalAdminExpenses,
    fmop,
    fmopMarginPercent,
    ypMultiplierAdopted: adoptedYp,
    ypMultiplierRangeLow: ypRangeLow,
    ypMultiplierRangeHigh: ypRangeHigh,
    mv1MarketValueGoodwill,
    mv1MarketValueTotal,
    mv2RestrictedMarketingValue,
    mv3ClosedPracticeValue,
    marketRentPa,
    marketRentPsf,
    reinstatementCostEstimate,
    buyerReadinessScore,
    potentialPremiumValuation,
    potentialUpsidePounds,
    topFixes: finalTopFixes,
    swotAnalysis,
    methodologyComparison,
    regionalComparison: {
      regionName: data.region,
      localAvgMultiple: regionStats.averageEbitdaMultiple,
      nationalAvgMultiple: UK_NATIONAL_AVERAGES.averageEbitdaMultiple,
      practiceMultiple: adoptedYp,
      localPrivatePlanAvg: regionStats.avgPrivateCapitationPercent,
      practicePrivatePlanMix: planPct,
    },
  };
}

export function formatGbp(amount: number): string {
  if (amount >= 1000000) {
    return `£${(amount / 1000000).toFixed(2).replace(/\.00$/, '')}M`;
  }
  if (amount >= 1000) {
    return `£${Math.round(amount / 1000)}K`;
  }
  return `£${amount.toLocaleString('en-GB')}`;
}
