# Detailed valuation engine: calibration and back-test

The detailed engine (`src/utils/valuationEngine.ts`) values goodwill from profit.
Its constants live in `src/data/valuationBenchmarks.ts`, each with a source or
marked **ASSUMPTION**.

## How it values a practice

1. **Profit on two bases.** The user says whether their profit is
   *owner-operated* (before paying anyone to do the principal's clinical work)
   or *associate-led* (after paying an associate to do it). The engine converts
   between them using the principal's replacement cost: their share of fees
   (from the clinician schedule, or chair hours against surgery capacity) x 38%.
2. **Each profit gets its own multiple** (Christie & Co, H1 2026):
   owner-operated 3.2x NHS, 3.4x mixed, 3.7x private; associate-led 6.4x, 6.9x, 7.1x.
   The old engine applied a ~7x multiple to whatever profit was typed in, so
   owner-operated profit came out ~55-70% too high.
3. **Blend by chair hours.** 10 hours or fewer is valued as fully managed,
   30 or more as owner-operated, linear in between. If the two bases are
   consistent they give similar answers, so the blend mostly hedges the
   replacement-cost estimate.
4. **Multiplicative adjustments** for region, size (owner-operated only), UDA
   rate, clawback, plan income, associate contracts and the broker-schedule
   extras. These replace the old additive "+0.6 YP" adjustments.
5. **Cross-check** at NASDAL goodwill % of fees (April 2026: NHS 135%, mixed
   113%, private 95%).

If no profit and no costs are given, the engine assumes the segment's typical
owner-operated margin (34-36%).

## Back-test

`scripts/engineBacktest.ts` compares the engine's goodwill with broker asking
prices for goodwill (leaseholds, or freeholds with the property split out), using
the private listings file. Row-level listings are never committed; set
`MARKET_DATA_DIR` to run it:

```
MARKET_DATA_DIR=/path/to/market-data npx tsx scripts/engineBacktest.ts
MARKET_DATA_DIR=/path/to/market-data npm test
```

Excluded: listings marked `use_in_analysis=no`, and one broker's 77 rows that
look like demo data (see `EXCLUDED_SOURCES`) until confirmed.

Results, 25 Nov 2026 listings (172 listings; ratio = engine / asking):

| Group | n | Before: median ratio | Before: median error | After: median ratio | After: median error |
| --- | --- | --- | --- | --- | --- |
| All listings | 172 | 0.90 | 35.8% | 0.85 | 24.2% |
| Owner-operated profit given | 69 | 1.55 | 55.0% | 1.03 | 20.5% |
| Associate-led profit given | 38 | 0.83 | 26.8% | 0.97 | 18.0% |
| Fees only (no profit) | 103 | 0.70 | 32.4% | 0.76 | 26.8% |
| Private | 97 | 1.03 | 32.7% | 0.96 | 20.7% |
| Mixed | 60 | 0.67 | 36.6% | 0.75 | 28.3% |
| NHS | 11 | 0.89 | 10.7% | 0.80 | 20.5% |
| Specialist | 4 | 1.51 | 50.9% | 0.93 | 7.3% |

Within ±25% of asking: 35% of listings before, 52% after (61% where a profit was given).

### Known limits

- Asking prices are not sale prices. Christie reports 57% of accepted offers at
  or above asking in H1 2026, so asking is a fair but not exact target.
- Fee-only listings (mostly one broker, London-heavy) ask ~158% of fees, well
  above NASDAL's ~109%. The engine follows the published benchmarks there, so it
  reads ~24% under those asking prices. Users of the detailed form always give
  a profit, so this path matters less.
- NHS (11) and specialist (4) samples are small; treat those rows as indicative.
- Listings don't publish chair hours, UDA rates or contracts. The back-test
  assumes a ~30-hour principal and neutral diligence drivers.
