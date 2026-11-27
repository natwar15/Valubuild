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

## Pricing

Plans live in `src/shared/pricing.ts` and are rendered by `src/components/PricingSection.tsx`. There is no billing integration yet; every paid button opens the early-access sign-up with the plan name. Reasoning and rollout order: `docs/monetisation-plan.md`.

| Plan | Who | Price |
| --- | --- | --- |
| Free account | Anyone in UK dentistry | Free |
| Full Valuation Report | Owners | £149 per report (£299 broker-ready pack) |
| Exit Dashboard | Owners | £99 / month |
| Pre-Sale Sprint | Owners | £15,000 one-time |
| Professional | Brokers, accountants, buyers | £149 / month |
| Firm | Brokerages, lenders, corporates | £499 / month (5 seats) |

Consented introductions to brokers, lenders and buyers (referral fees) and anonymised market reports come later; see the plan.

## Founding-owner sign-up email

The sign-up form saves the email to the Firestore `leads` collection and then calls `POST /api/leads/checklist`, which emails the 12-point buyer-readiness checklist (`src/server/leadEmail.ts`). It needs `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM`; without them no email is sent and the form says the checklist will follow later. The endpoint is limited to 5 requests per IP per hour and one email per address per day.

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
npm start                # serves the API and dist/ on port 3000 (or $PORT)
```

Behind Cloud Run or another proxy, set `TRUST_PROXY=1` so the per-IP rate limits see the visitor's address.

## Deploying to Netlify

`netlify.toml` builds the front end into `dist/` (served from Netlify's CDN) and runs the Express API, including the live-voice WebSocket, on [Netlify Server](https://docs.netlify.com/build/server/) in Frankfurt. The entry is `netlify/server/index.ts` and it handles `/api/*`. Netlify Server is in Early Access and needs a credit-based Netlify plan.

1. In Netlify, **Add new project > Import an existing project**, pick this GitHub repo. The build settings come from `netlify.toml`.
2. Under **Site configuration > Environment variables**, add the variables below. Give the `VITE_` one the **Builds** scope and the rest the **Functions** scope. Redeploy after changing any of them.
3. Market data: the repo carries an **encrypted** copy of the listings (`src/server/generated/marketDataSealed.ts`). Set `MARKET_DATA_KEY` (Functions scope) and the server decrypts it into a temp folder at startup, so no database is needed. To refresh the data, run `MARKET_DATA_KEY=... MARKET_DATA_DIR=/path/to/market-data npm run market:seal` and commit the regenerated file. Without the key, the database copy (`npm run market:upload`, after `npm run db:push`) is used, and failing that a synthetic sample.

| Variable | Needed for |
| --- | --- |
| `MARKET_DATA_KEY` | Decrypts the bundled market data (base64, 32 bytes). Already set on valubuild-lbae |
| `GEMINI_API_KEY` | Every AI feature. Use a key on a paid plan, because the privacy notice says uploads aren't used for training |
| `VITE_GOOGLE_MAPS_API_KEY` | The regional map (build time; restrict the key to your Netlify domain) |
| `SQL_HOST`, `SQL_DB_NAME`, `SQL_USER`, `SQL_PASSWORD` | Postgres. The database must accept connections from the internet, because Netlify has no fixed IP addresses |
| `SQL_SSL` | `true` for Supabase, Neon and most hosted Postgres; `no-verify` for Cloud SQL's public IP. Don't connect over the internet without it |
| `FIREBASE_SERVICE_ACCOUNT` | Account deletion (removing Firestore data and the sign-in account). Firebase console > Project settings > Service accounts > Generate new private key, then base64-encode the file (`base64 -i key.json`) and paste the result |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | The sign-up checklist email and monthly emails |

Also add the Netlify domain (and any custom domain) under Firebase console > Authentication > Settings > **Authorized domains**, or sign-in will fail.

Netlify Server limits to know about: a response must start within 20 seconds (a long Gemini document analysis could hit this), and outgoing connections idle for 60 seconds are closed (the Postgres pool closes idle connections after 30).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build of the front end |
| `npm start` | Production server (`NODE_ENV=production`) |
| `npm run lint` | Type-check with `tsc --noEmit` |
| `npm test` | Unit tests for the market statistics, suppression and parsing |
| `npm run db:push` | Push the Drizzle schema to Postgres (uses `SQL_ADMIN_*`) |
| `npm run market:seal` | Re-encrypt the market data CSVs into the bundled copy (needs `MARKET_DATA_KEY`) |
| `npm run market:upload` | Copy the market data CSVs from `MARKET_DATA_DIR` into Postgres for hosts without them on disk |

## Notes

- All AI endpoints require a signed-in user, so the Gemini key can't be used anonymously.
- The project was originally generated in Google AI Studio; `metadata.json` and `.gmp_cache/` are left over from that and are not used at runtime.
