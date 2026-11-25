import { DentalIntakeData, BankStandardValuationResult, FixItem, PracticeType } from '../types';
import { UK_REGIONAL_BENCHMARKS, UK_NATIONAL_AVERAGES } from '../data/ukMarketData';

export function calculateDentalValuation(data: DentalIntakeData): BankStandardValuationResult {
  const turnover = Math.max(data.turnover, 100000);
  const regionStats = UK_REGIONAL_BENCHMARKS[data.region] || UK_REGIONAL_BENCHMARKS['Yorkshire & Humber'];

  // 1. Fair Maintainable Trade (FMT) Assessment
  const clawback = Math.max(data.clawbackAmount || 0, 0);
  const effectiveIncome = Math.max(turnover - clawback, 80000);

  // Cost of Sales Breakdown
  const matLabPct = data.materialsAndLabCostPercent ? data.materialsAndLabCostPercent / 100 : 0.16;
  const matLabCost = Math.round(effectiveIncome * matLabPct);

  // Direct Associate / Clinical Costs
  const assocPct = data.directAssociateTherapistCostPercent ? data.directAssociateTherapistCostPercent / 100 : 0.38;
  const assocCost = Math.round(effectiveIncome * assocPct);

  const costOfSales = matLabCost + assocCost;
  const grossProfit = effectiveIncome - costOfSales;

  // Administrative / Overheads & Managed Running Costs
  const staffWages = data.staffWagesPa || Math.round(effectiveIncome * 0.18);
  const otherOverheads = Math.round(effectiveIncome * 0.13);
  const totalAdminExpenses = staffWages + otherOverheads;

  // Fair Maintainable Operating Profit (FMOP) / Adopted EBITDA
  // If user provided a specific adjusted EBITDA, benchmark and blend with calculated FMOP
  let fmop = data.adjustedEbitda > 0
    ? Math.round((data.adjustedEbitda * 0.7) + ((grossProfit - totalAdminExpenses) * 0.3))
    : Math.max(grossProfit - totalAdminExpenses, Math.round(effectiveIncome * 0.18));

  // Ensure reasonable bounds
  if (fmop < effectiveIncome * 0.08) fmop = Math.round(effectiveIncome * 0.12);
  const fmopMarginPercent = parseFloat(((fmop / effectiveIncome) * 100).toFixed(1));

  // 2. Multiplier Determination (Years Purchase / YP)
  // Base YP multiplier by Practice Type
  let baseMultiplier = 5.5;
  if (data.practiceType === 'Private Practice') {
    baseMultiplier = 7.5;
  } else if (data.practiceType === 'Specialist Practice') {
    baseMultiplier = 8.5;
  } else if (data.practiceType === 'Mixed Practice') {
    baseMultiplier = 6.8;
  } else {
    // NHS Practice
    baseMultiplier = 5.2;
  }

  // Adjustments based on real UK Diligence Drivers:
  // Driver A: UDA Rate & Contract Health
  if (data.practiceType === 'NHS Practice' || data.practiceType === 'Mixed Practice') {
    if (data.udaRate >= 38) {
      baseMultiplier += 0.6; // High UDA rate premium
    } else if (data.udaRate <= 28) {
      baseMultiplier -= 0.4;
    }
    if (clawback > 0) {
      baseMultiplier -= 0.5; // Clawback penalty
    }
  }

  // Driver B: Monthly Recurring Capitation (Denplan / Practice Plan)
  const planPct = (data.privatePlanTurnover / turnover) * 100;
  if (planPct >= 35) {
    baseMultiplier += 1.2;
  } else if (planPct >= 20) {
    baseMultiplier += 0.6;
  }

  // Driver C: Principal Chairside Dependency (The #1 Haircut in Dental M&A)
  if (data.principalChairHoursPerWeek <= 10) {
    baseMultiplier += 0.8; // Fully associate-led managed entity
  } else if (data.principalChairHoursPerWeek >= 30) {
    baseMultiplier -= 1.0; // Heavy owner-operator penalty
  }

  // Driver D: Surgeries & Capacity
  if (data.surgeriesCount >= 5) {
    baseMultiplier += 0.4;
  } else if (data.surgeriesCount <= 2) {
    baseMultiplier -= 0.4;
  }

  // Driver E: Associate Contracts
  if (data.associateContracts === 'all_bda_with_covenants') {
    baseMultiplier += 0.3;
  } else if (data.associateContracts === 'unwritten_high_flight_risk') {
    baseMultiplier -= 0.8;
  }

  // Regional adjustments
  if (data.region === 'London & South East') baseMultiplier += 0.5;
  if (data.region === 'North East' || data.region === 'Wales') baseMultiplier -= 0.2;

  // Driver F: Quick Broker Schedule Enrichments (expansion capacity, digital equipment, lease security)
  if (data.quickSchedule) {
    if (data.quickSchedule.spaceForAdditionalSurgeries >= 1) {
      baseMultiplier += 0.2;
    }
    if (data.quickSchedule.hasIntraoralScanner || data.quickSchedule.hasCerec) {
      baseMultiplier += 0.15;
    }
    if (data.tenure === 'Leasehold' && data.quickSchedule.leaseYearsRemaining > 0 && data.quickSchedule.leaseYearsRemaining < 7) {
      baseMultiplier -= 0.35; // Short lease risk for bank funding
    }
    if (data.quickSchedule.vtContract) {
      baseMultiplier += 0.1;
    }
  }

  const adoptedYp = parseFloat(Math.min(Math.max(baseMultiplier, 3.2), 11.5).toFixed(2));
  const ypRangeLow = parseFloat(Math.max(adoptedYp - 0.75, 3.0).toFixed(2));
  const ypRangeHigh = parseFloat(Math.min(adoptedYp + 1.25, 12.0).toFixed(2));

  // 3. Bank-Standard Valuations
  // MV1: Market Value of Goodwill on Fully Managed Basis
  const mv1MarketValueGoodwill = Math.round((fmop * adoptedYp) / 10000) * 10000;
  
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
  let score = Math.round((adoptedYp / 11.5) * 85);
  if (data.hasDeconRoom) score += 5;
  if (data.cqcStatus === 'Good / Outstanding') score += 5;
  if (data.associateContracts === 'all_bda_with_covenants') score += 5;
  const buyerReadinessScore = Math.min(Math.max(score, 25), 98);

  // Premium Readiness Valuation Potential (Target 85+ score)
  const premiumYp = Math.min(adoptedYp + 2.2, 11.8);
  const potentialPremiumValuation = Math.round(fmop * premiumYp);
  const potentialUpsidePounds = Math.max(potentialPremiumValuation - mv1MarketValueGoodwill, 200000);

  // 5. Prioritized Fixes with Exact Pound (£) Impact
  const topFixes: FixItem[] = [];

  if (data.principalChairHoursPerWeek >= 20) {
    const minG = Math.round(fmop * 1.0);
    const maxG = Math.round(fmop * 1.8);
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
    const minG = Math.round(fmop * 0.8);
    const maxG = Math.round(fmop * 1.4);
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
    const minG = Math.round(fmop * 0.4);
    const maxG = Math.round(fmop * 0.8);
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
    const minG = Math.round(fmop * 0.35);
    const maxG = Math.round(fmop * 0.7);
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

  const finalTopFixes = topFixes.slice(0, 3).map((f, idx) => ({ ...f, rank: idx + 1 }));

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

  // 7. Valuation Methodology Comparison (Corporate EBITDA vs Christie/FTA % of Fees vs Reconstituted Net Profit)
  let baseGrossFeePct = 125;
  if (data.practiceType === 'NHS Practice') {
    baseGrossFeePct = 135;
    if (data.udaRate >= 38) baseGrossFeePct += 15;
    if (data.udaRate <= 28) baseGrossFeePct -= 15;
    if (clawback > 0) baseGrossFeePct -= 20;
  } else if (data.practiceType === 'Private Practice') {
    baseGrossFeePct = 115;
    if (planPct >= 35) baseGrossFeePct += 20;
  } else if (data.practiceType === 'Specialist Practice') {
    baseGrossFeePct = 140;
  } else {
    // Mixed Practice
    baseGrossFeePct = 128;
    if (planPct >= 25) baseGrossFeePct += 10;
  }

  const grossFeeValuation = Math.round(effectiveIncome * (baseGrossFeePct / 100));
  const grossFeeRangeLow = Math.round(effectiveIncome * ((baseGrossFeePct - 18) / 100));
  const grossFeeRangeHigh = Math.round(effectiveIncome * ((baseGrossFeePct + 22) / 100));

  // Reconstituted Net Profit for Sole Principal / Partner Buy-In
  const principalChairHrs = data.principalChairHoursPerWeek || 20;
  const principalClinicalSalaryAllowance = Math.round((principalChairHrs / 40) * 95000);
  const reconstitutedProfit = Math.max(fmop + Math.round(principalClinicalSalaryAllowance * 0.4), Math.round(effectiveIncome * 0.16));
  const reconstitutedMultiple = parseFloat((adoptedYp * 0.85).toFixed(2));
  const reconstitutedValuation = Math.round(reconstitutedProfit * reconstitutedMultiple);

  const methodologyComparison = {
    corporateEbitda: {
      name: 'Corporate EBITDA Multiple (DSO / PE Standard)',
      ypMultiple: adoptedYp,
      valuationGbp: mv1MarketValueGoodwill,
      valuationRange: [Math.round(fmop * ypRangeLow), Math.round(fmop * ypRangeHigh)] as [number, number],
      basis: 'Capitalisation of Fair Maintainable Operating Profit (EBITDA) with fully managed associate staffing.',
      typicalBuyer: 'Portman Dentex, Bupa Dental Care, Rodericks Dental Partners, Riverdale Healthcare, Clyde Munro',
    },
    grossFeesTurnover: {
      name: 'FTA & Christie & Co % of Turnover Benchmark',
      adoptedPercent: baseGrossFeePct,
      valuationGbp: grossFeeValuation,
      valuationRange: [grossFeeRangeLow, grossFeeRangeHigh] as [number, number],
      basis: `Traditional valuation benchmark based on ${baseGrossFeePct}% of verified gross annual fee income.`,
      typicalBuyer: 'Independent practice owners, regional 2–5 practice groups, commercial bank debt underwriting',
    },
    reconstitutedNetProfit: {
      name: 'Reconstituted Net Profit (Principal Buy-In)',
      adjustedProfitGbp: reconstitutedProfit,
      principalClinicalSalaryAllowance,
      multiple: reconstitutedMultiple,
      valuationGbp: reconstitutedValuation,
      basis: 'Assessment of owner-operator net cashflow after notional principal clinical replacement salary.',
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
