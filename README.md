# Valubuild

Exit valuations for UK dental practices. A practice owner enters their practice's details (NHS contract and UDA rate, private and plan income, costs, staffing, premises) and gets a bank-style valuation: Fair Maintainable Operating Profit (FMOP), an adopted years-purchase (YP) multiple, MV1/MV2 values, a buyer-readiness score and a list of fixes that would raise the value.

Around that core the app has regional benchmarks, a UK valuation map, valuation history, monthly market updates and email digests, an anonymised national comparison, AI document analysis (upload accounts and the figures are extracted) and a live voice advisor.

All sample practices in the app are fictional and their figures are illustrative.

## Public market data, quick valuation and the owner pool

- **Market data** (no account): filter public broker listings by region, NHS/private mix, status, tenure, surgeries, asking price and listing date, plus published survey history (NASDAL goodwill % of fees, Christie & Co figures). Only medians and ranges are served; individual listings, broker refs and counties never leave the server.
- **Quick valuation** (no account to see the result): six questions (postcode start, fees, NHS/private/plan split, surgeries, tenure, principal's clinical days) give a goodwill range from comparable listings. Signing up (Google or email + password) lets the owner save it under a nickname; the real practice name and full postcode are never asked for.
- **Owner pool** (opt-in): saved valuations can be added to the pool with explicit consent (versioned in `src/shared/consent.ts`, verified email required). Owner-reported valuations/offers/sales then feed the quick valuation as extra comparables, and pool aggregates appear in Market Data and UK Pool.
- **Small-cell rule**: every cell built from fewer than 5 records is suppressed (`MIN_CELL_SIZE` in `src/shared/marketStats.ts`), pool counts are rounded down to 5, and pooled data has only fixed region/type facets so two queries can't be differenced to isolate one practice.
- **Data files** live outside git. Set `MARKET_DATA_DIR` to a folder with `listings_all.csv` and `market_index.csv`; without it a synthetic sample is shown.
- **Privacy**: a draft notice is at the "Privacy" link; users can withdraw consent, delete a valuation, or delete their account and data.

## Stack

| Part | Technology |
| --- | --- |
| Front end | React 19, Vite 8, Tailwind CSS 4, Recharts, Google Maps (`@vis.gl/react-google-maps`) |
| Server | Express (`server.ts`) on port 3000; serves the API and the site (Vite middleware in dev, `dist/` in production) |
| AI | Google Gemini via `@google/genai`, including a live-voice WebSocket at `/api/live-voice` |
| Sign-in | Firebase Authentication (Google sign-in); config in `firebase-applet-config.json` |
| Data | Firestore (leads, user profiles, snapshots; rules in `firestore.rules`) and PostgreSQL via Drizzle ORM (reports, documents, questions, briefings, digests; schema in `src/db/schema.ts`) |
| Email | Nodemailer over SMTP (optional) |

The valuation maths is deterministic and lives in `src/utils/valuationEngine.ts`; regional benchmark data is in `src/data/ukMarketData.ts`.

## Running locally

Requires Node.js 22 or newer.

```bash
npm install
cp .env.example .env     # then fill in the values
npm run db:push          # first time only: creates the Postgres tables
npm run dev              # http://localhost:3000
```

The site loads without a database or Gemini key, but sign-in, saving reports and the AI features need them.

## Production

```bash
npm run build            # builds the front end into dist/
npm start                # serves the API and dist/ on port 3000
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build of the front end |
| `npm start` | Production server (`NODE_ENV=production`) |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm test` | Unit tests for the market statistics, suppression and parsing |
| `npm run db:push` | Push the Drizzle schema to Postgres (uses `SQL_ADMIN_*`) |

## Notes

- All AI endpoints require a signed-in user, so the Gemini key can't be used anonymously.
- The project was originally generated in Google AI Studio; `metadata.json` and `.gmp_cache/` are left over from that and are not used at runtime.
