import type { PracticeType, UkRegion } from '../types';

/**
 * Calibration constants for the detailed valuation engine.
 *
 * Every number here is either taken from a published market benchmark
 * (source given) or is an ASSUMPTION fitted to the private broker-listings
 * back-test (scripts/engineBacktest.ts). Only aggregates are recorded here;
 * row-level listings stay out of the repo.
 *
 * Sources:
 *  - Christie & Co Dental Market Review, H1 2026: EBITDA multiples achieved,
 *    split owner-operated vs associate-led and by NHS / mixed / private.
 *  - NASDAL Goodwill Survey, April 2026: goodwill as % of fees
 *    (all 109%, NHS 135%, mixed 113%, private 95%).
 *  - Christie & Co EBITDA margins: owner-operated 33.2% (H1 2025),
 *    associate-led 16-24% (2024-2025).
 *  - Valubuild listings scan, 25 Nov 2026 (n=214 usable, excluding one broker
 *    whose rows look like demo data): asking 3.5x owner-operated EBITDA,
 *    7.5x associate-led EBITDA, 140% of fees overall.
 */

/**
 * Multiple of OWNER-OPERATED EBITDA (profit before paying anyone to do the
 * principal's clinical work). Christie H1 2026. Mixed is the mean of the
 * NHS-led (3.6x) and private-led (3.2x) mixed figures.
 * ASSUMPTION: specialist practices use the private multiple (no published split).
 */
export const OWNER_OPERATED_MULTIPLE: Record<PracticeType, number> = {
  'NHS Practice': 3.2,
  'Mixed Practice': 3.4,
  'Private Practice': 3.7,
  'Specialist Practice': 3.7,
};

/**
 * Multiple of ASSOCIATE-LED EBITDA (profit after paying a market-rate associate
 * for all clinical work, i.e. a fully managed practice). Christie H1 2026.
 * Mixed is the mean of NHS-led (6.7x) and private-led (7.1x).
 * ASSUMPTION: specialist practices use the private multiple.
 */
export const ASSOCIATE_LED_MULTIPLE: Record<PracticeType, number> = {
  'NHS Practice': 6.4,
  'Mixed Practice': 6.9,
  'Private Practice': 7.1,
  'Specialist Practice': 7.1,
};

/**
 * Owner-operated EBITDA margin used only when the user gives neither a profit
 * figure nor any cost inputs. Listings medians by type (owner margin), which
 * sit close to Christie's 33.2% all-practice figure.
 */
export const DEFAULT_OWNER_MARGIN: Record<PracticeType, number> = {
  'NHS Practice': 0.36,
  'Mixed Practice': 0.35,
  'Private Practice': 0.34,
  'Specialist Practice': 0.36,
};

/**
 * Cost of replacing the principal's clinical work with an associate, as a share
 * of the principal's own gross fees.
 * ASSUMPTION: associates are paid ~45-50% of gross less their share of lab
 * fees, so ~38% net. Fitted together with PRINCIPAL_HOURS_PER_SURGERY to the
 * gap between owner-operated and associate-led EBITDA in 66 listings that
 * publish both (median gap 19.5% of fees; ~30% for 1-2 surgeries, ~14% for
 * 3-4, ~11% for 6).
 */
export const PRINCIPAL_REPLACEMENT_PAY_RATE = 0.38;

/**
 * ASSUMPTION: chair hours a surgery generates fees for each week. Used to
 * estimate the principal's share of fees when no clinician schedule is given:
 * share = principal hours / (surgeries x this), capped at 100%.
 */
export const PRINCIPAL_HOURS_PER_SURGERY = 22;

/**
 * Weight given to the associate-led valuation, by principal chair hours.
 * ASSUMPTION: at 10 hours or fewer a buyer prices the practice as fully
 * managed; at 30 or more on the owner-operated basis; linear in between.
 * Both bases agree when the replacement cost is right, so the blend mainly
 * hedges errors in that estimate.
 */
export const ASSOCIATE_LED_FULL_WEIGHT_AT_HOURS = 10;
export const OWNER_OPERATED_FULL_WEIGHT_AT_HOURS = 30;

/** NASDAL goodwill % of fees, April 2026. */
export const GOODWILL_PCT_OF_FEES: Record<PracticeType, number> = {
  'NHS Practice': 135,
  'Mixed Practice': 113,
  'Private Practice': 95,
  // ASSUMPTION: NASDAL has no specialist segment. Listings put specialist
  // asking goodwill ~17% above private, so 95% x 1.17.
  'Specialist Practice': 111,
};

/**
 * Regional factor on the multiple.
 * ASSUMPTION: fitted to the listings back-test residuals and shrunk about
 * halfway to 1.0, because most regions have under 20 listings (Scotland,
 * Wales and the North East have 3-5). London & South East asking goodwill is
 * ~163% of fees against ~100-120% in Yorkshire, Scotland and the South West.
 */
export const REGION_FACTOR: Record<UkRegion, number> = {
  'London & South East': 1.1,
  'East of England': 1.05,
  Midlands: 1.0,
  'Yorkshire & Humber': 1.0,
  'North East': 1.0,
  'North West': 0.95,
  Wales: 0.95,
  'South West': 0.9,
  Scotland: 0.9,
};

/**
 * Size factor on the OWNER-OPERATED multiple only, by surgery count.
 * In a 1-2 surgery practice most owner-operated profit is the principal's own
 * clinical earnings, which a buyer has to replace, so it sells for fewer years'
 * profit. Listings: 2.6-2.8x owner EBITDA for 1-2 surgeries, ~4x for 3+.
 * ASSUMPTION: fitted to back-test residuals (n=69 with owner EBITDA) and shrunk
 * about a third towards 1.0.
 */
export function surgeryFactor(surgeries: number): number {
  if (surgeries <= 1) return 0.82;
  if (surgeries === 2) return 0.86;
  if (surgeries === 3) return 1.0;
  if (surgeries <= 5) return 1.1;
  return 1.15;
}

/**
 * Diligence drivers, as multiplicative factors on the multiple. These replace
 * the old additive "+0.6 YP" style adjustments, which were sized for a ~7x
 * base and over-moved owner-operated valuations.
 * ASSUMPTION: magnitudes are judgement, sized so that a practice with every
 * premium stays within ~25% of the segment benchmark. They are not fitted to
 * the listings (listings don't publish UDA rates, contracts or equipment).
 */
export const DRIVER_FACTORS = {
  udaRateHigh: 1.05, // UDA rate >= £38
  udaRateLow: 0.95, // UDA rate <= £28
  clawback: 0.95, // any NHS under-delivery clawback
  planShareHigh: 1.07, // plan income >= 35% of fees
  planShareMid: 1.03, // plan income >= 20% of fees
  contractsBdaWithCovenants: 1.03,
  contractsUnwritten: 0.9,
  expansionSpace: 1.02,
  digitalEquipment: 1.01,
  shortLease: 0.95, // leasehold with under 7 years left
  vtContract: 1.01,
} as const;

/**
 * Low/high range around the headline value. In the 25 Nov 2026 back-test,
 * half of the listings with a published profit asked between 0.78x and 1.21x
 * the engine's figure (25th/75th percentile), so +/-20%.
 */
export const VALUATION_RANGE = { low: 0.8, high: 1.2 } as const;
