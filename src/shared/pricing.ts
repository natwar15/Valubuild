/**
 * Valubuild pricing, in one place.
 *
 * Layered model: anyone in UK dentistry browses for free (this grows the
 * anonymised data pool), owners pay per report, professionals subscribe, and
 * consented introductions earn referral fees. There is no billing integration
 * yet: every paid button opens the early-access sign-up with the plan name.
 * See docs/monetisation-plan.md for the reasoning and rollout order.
 */

export type Audience = 'owner' | 'professional';

export interface PricingPlan {
  id: string;
  audience: Audience;
  name: string;
  price: string;
  cadence: string;
  bestFor: string;
  features: string[];
  cta: string;
  recommended?: boolean;
  /** Label passed to the sign-up form so we can see which plan people want. */
  captureLabel: string;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    audience: 'owner',
    name: 'Free account',
    price: 'Free',
    cadence: 'no card needed',
    bestFor: 'Anyone in UK dentistry: owners, associates, buyers and advisers.',
    features: [
      'Browse anonymised practice listings, valuations and market trends',
      'Quick valuation from comparable sales',
      'Save valuations under a nickname, never your practice name',
      'Corporate-readiness scorecard with your top 3 fixes',
    ],
    cta: 'Create a free account',
    captureLabel: 'Free account',
  },
  {
    id: 'report',
    audience: 'owner',
    name: 'Full Valuation Report',
    price: '£149',
    cadence: 'per report',
    bestFor: 'Owners who want a document to share with an accountant, bank or broker.',
    features: [
      'Downloadable PDF valuation with method, multiples and comparables',
      'Every gap ranked by pound (£) impact on sale price',
      'Broker-ready pack with document review: £299',
      'Founding owners get their first report free',
    ],
    cta: 'Reserve my report',
    recommended: true,
    captureLabel: 'Full Valuation Report (£149)',
  },
  {
    id: 'exit-dashboard',
    audience: 'owner',
    name: 'Exit Dashboard',
    price: '£99',
    cadence: '/ mo',
    bestFor: 'Principals planning to sell or take corporate equity within 2–3 years.',
    features: [
      'Monthly re-score and value tracking over time',
      'Unlimited report downloads while subscribed',
      'Full fix-it plan, re-ranked as your numbers change',
      'Priority support inside one business day',
    ],
    cta: 'Reserve Exit Dashboard',
    captureLabel: 'Exit Dashboard (£99/mo)',
  },
  {
    id: 'professional',
    audience: 'professional',
    name: 'Professional',
    price: '£149',
    cadence: '/ mo',
    bestFor: 'Independent brokers, accountants and individual buyers.',
    features: [
      'Regional benchmarks: multiples, fee mix, UDA and private income',
      'Comparable sales search with anonymised detail',
      'New-listing and price-change alerts by area',
      'CSV exports and unlimited client reports',
    ],
    cta: 'Join the professional waitlist',
    recommended: true,
    captureLabel: 'Professional (£149/mo)',
  },
  {
    id: 'firm',
    audience: 'professional',
    name: 'Firm',
    price: '£499',
    cadence: '/ mo',
    bestFor: 'Brokerages, lenders, accountancy firms and corporate groups.',
    features: [
      'Everything in Professional for up to 5 seats',
      'White-labelled client reports with your branding',
      'Portfolio and pipeline tracking across many practices',
      'Quarterly market briefing and API access on request',
    ],
    cta: 'Talk to us about Firm',
    captureLabel: 'Firm (£499/mo)',
  },
];

/** Hands-on advisory service, kept from the earlier pricing. */
export const PRE_SALE_SPRINT = {
  name: 'Pre-Sale Sprint',
  price: '£15,000',
  cadence: 'one-time',
  summary:
    'Twelve months of Exit Dashboard plus weekly working sessions, associate contract and P&L review, and direct phone access through due diligence.',
  captureLabel: 'Pre-Sale Sprint (£15,000)',
};

/** Always free, whatever plan someone is on. */
export const FREE_FOREVER = [
  'Browsing anonymised listings, valuations and trends',
  'Quick valuations',
  'Adding your practice to the anonymised pool (opt-in, withdraw any time)',
];
