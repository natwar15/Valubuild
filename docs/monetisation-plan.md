# Valubuild monetisation plan

Last updated 27 November 2026. Plans in code: `src/shared/pricing.ts`.

## The idea in one line

Owners build the anonymised data pool and pay occasionally; professionals use the data every week and pay every month.

Pay-per-download on its own earns little over time, because most owners need a report once, around a sale. The pool of anonymised practice data is the real asset, so browsing stays free to keep it growing, and the recurring revenue comes from people who need the data as part of their job.

## Layers

| Layer | Who pays | Price | What they get | Status |
| --- | --- | --- | --- | --- |
| 1. Free account | Nobody | Free | Browse anonymised listings, valuations, trends; quick valuation; nickname-only saved valuations; scorecard with top 3 fixes | Live |
| 2. Full Valuation Report | Owners | £149 per report; £299 broker-ready pack with document review | Downloadable PDF with method, multiples, comparables and every gap ranked by £ impact | Waitlist (no billing yet). Founding owners get first report free |
| 2b. Exit Dashboard | Owners | £99 / month | Monthly re-score, value tracking, unlimited report downloads, full fix-it plan | Waitlist |
| 2c. Pre-Sale Sprint | Owners | £15,000 one-time | 12 months of Exit Dashboard, weekly sessions, contract and P&L review, phone access through due diligence | By enquiry |
| 3. Professional | Independent brokers, accountants, individual buyers | £149 / month | Regional benchmarks, comparable sales search, alerts, CSV exports, unlimited client reports | Waitlist |
| 3b. Firm | Brokerages, lenders, accountancy firms, corporate groups | £499 / month (5 seats) | Everything in Professional, white-label reports, portfolio tracking, quarterly briefing, API on request | Waitlist |
| 4. Introductions | Partner brokers, lenders, buyers | Referral fee per completed introduction, agreed per partner | Warm, consented introductions to owners who asked for one | Not built |
| 5. Market reports and data | Banks, investors, corporates | £1k–£5k per report; data licences priced per deal | Quarterly UK dental market report; aggregated, anonymised datasets | Later |

## What is free and what is gated

Free, always: browsing anonymised listings, valuations and trends; quick valuations; adding a practice to the pool (opt-in, withdrawable).

Gated:

- **Downloads.** The full PDF report (owners) and CSV exports (professionals). Viewing stays free, downloading is the paywall. This matches the original "see everything, pay to download" idea.
- **Depth.** Comparable sales detail, regional benchmarks beyond the headline median, and alerts are professional features.
- **Frequency.** Monthly re-scoring and tracking are Exit Dashboard.

Never gated or sold: any row-level or identifiable practice data. Everything shown or sold stays aggregated and anonymised with the existing small-group suppression (k ≥ 5 on public stats, 10 distinct owners for the pool).

## Rollout order

1. **Now: pricing page and waitlist.** Done in this change. Every paid button opens the early-access sign-up with the plan name, so we can count demand per plan before building billing.
2. **Next 1–2 months: paid owner report.** Add Stripe Checkout for the £149 report and the £99 Exit Dashboard; gate the PDF download behind it. Honour the "founding owners' first report free" promise.
3. **Months 2–4: Professional plan.** Interview 5–10 brokers and accountants from the waitlist, then ship benchmarks, comps search, alerts and CSV export behind a subscription. Start with Professional; add Firm seats when a firm asks.
4. **Months 4–6: introductions.** Sign 2–3 partner brokers and a lender on written referral agreements. Add the owner opt-in described below.
5. **Once the pool is large enough: market reports and data.** Only when aggregates are robust (well above the suppression thresholds in each region reported).

Watch numbers: free sign-ups per week, share of owners who add their practice to the pool, waitlist count per plan, report conversion rate, professional churn.

## Introductions: consent and regulatory caveats

Introductions can be the biggest single earner, and also carry the most risk. Ground rules:

- **Explicit, separate opt-in.** An owner ticks a box that names the type of partner (broker, lender, buyer) and what will be shared. It is not bundled with sign-up, pool consent or the report purchase. Record the consent version and time, as `src/shared/consent.ts` already does for the pool.
- **Share the minimum.** Until the owner agrees to a specific introduction, partners see nothing identifiable. After that, only what the owner approved.
- **Disclose fees.** Tell the owner that Valubuild may be paid by the partner, before they agree.
- **Withdrawable.** Owners can withdraw consent at any time; the privacy notice and account deletion must cover introduction records.
- **Lender introductions may be FCA-regulated.** Introducing owners to lenders for commercial loans is usually unregulated, but if any borrower is an individual, sole trader or small partnership, or if Valubuild does more than make an introduction, it can become credit broking that needs FCA authorisation. Get advice before taking lender fees, or work as an introducer appointed representative of an authorised firm.
- **Business sales.** Introducing sellers to brokers or buyers is generally not FCA-regulated, but agreements should say Valubuild is not acting as an estate or business transfer agent and gives no advice.
- **Not advice.** Reports and introductions are planning estimates, not regulated financial advice or a formal valuation. Keep this wording on reports and pricing (it is in the pricing footer now).
- **Data protection.** Sharing an owner's details with a partner is a new purpose. Update the privacy notice, rely on consent, and sign a data-sharing agreement with each partner. The operator company should complete ICO registration first.

This is a summary for planning, not legal advice. Have a solicitor review the referral agreements and the consent wording before the first paid introduction.

## Selling data later

- Only aggregated, anonymised outputs; no row-level data, no postcode below area level, and the same suppression rules as the public pages.
- Owners' pool consent must cover commercial use of aggregates. If the current consent wording does not, bump the consent version and ask again rather than reuse old consent.
- Historical web data (broker listings) can be sold as trend analysis, but check each source's terms before redistributing anything derived from it.

## Open decisions

- Final price points. £149 report and £149 / £499 professional plans are starting guesses within the agreed ranges; adjust after the first 20 waitlist conversations.
- Whether Exit Dashboard should include professional-level comparables.
- Payment provider (Stripe suggested) and VAT registration timing.
