/**
 * Copies the market data CSVs into Postgres so hosts without the files on
 * disk (Netlify) can load them at startup. Run after `npm run db:push`:
 *
 *   MARKET_DATA_DIR=/path/to/market-data npm run market:upload
 *
 * Uses the SQL_ADMIN_* login (same as db:push) and grants read access to
 * SQL_USER, the login the app runs as.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { sqlSsl } from '../src/db/ssl.ts';

const dir = path.resolve(process.argv[2] || process.env.MARKET_DATA_DIR || 'data/market');

function pickListings(): string {
  const all = path.join(dir, 'listings_all.csv');
  if (fs.existsSync(all)) return all;
  const monthly = fs.readdirSync(dir).filter((f) => /^uk_dental_listings_.*\.csv$/.test(f)).sort();
  if (!monthly.length) throw new Error(`No listings_all.csv or uk_dental_listings_*.csv in ${dir}`);
  return path.join(dir, monthly[monthly.length - 1]);
}

async function main() {
  const indexFile = path.join(dir, 'market_index.csv');
  if (!fs.existsSync(indexFile)) throw new Error(`No market_index.csv in ${dir}`);
  const files = [
    { name: 'listings_all.csv', content: fs.readFileSync(pickListings(), 'utf8') },
    { name: 'market_index.csv', content: fs.readFileSync(indexFile, 'utf8') },
  ];

  const client = new pg.Client({
    host: process.env.SQL_HOST,
    database: process.env.SQL_DB_NAME,
    user: process.env.SQL_ADMIN_USER || process.env.SQL_USER,
    password: process.env.SQL_ADMIN_PASSWORD || process.env.SQL_PASSWORD,
    ssl: sqlSsl(),
  });
  await client.connect();
  try {
    for (const f of files) {
      await client.query(
        `INSERT INTO market_data_files (name, content, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (name) DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
        [f.name, f.content],
      );
      console.log(`Uploaded ${f.name} (${Math.round(f.content.length / 1024)} KB)`);
    }
    const appUser = process.env.SQL_USER;
    if (appUser && appUser !== process.env.SQL_ADMIN_USER) {
      await client.query(`GRANT SELECT ON market_data_files TO "${appUser.replace(/"/g, '""')}"`);
      console.log(`Granted read access to ${appUser}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Upload failed:', err.message);
  process.exit(1);
});
