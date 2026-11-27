import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * The broker listings are kept out of git, so a host that builds from the
 * repo (Netlify) has no copy on disk. If MARKET_DATA_DIR doesn't hold the
 * files, copy them from the `market_data_files` table into a temp folder and
 * point MARKET_DATA_DIR at it. Upload them once with `npm run market:upload`.
 *
 * Never throws: without the files the app falls back to its synthetic sample.
 */
const NEEDED = ['listings_all.csv', 'market_index.csv'];
const TIMEOUT_MS = 6000;

function hasFiles(dir: string | undefined): boolean {
  if (!dir) return false;
  try {
    const abs = path.resolve(dir);
    return fs.existsSync(path.join(abs, 'market_index.csv')) &&
      fs.readdirSync(abs).some((f) => f === 'listings_all.csv' || /^uk_dental_listings_.*\.csv$/.test(f));
  } catch {
    return false;
  }
}

export async function prepareMarketDataDir(): Promise<void> {
  const configured = process.env.MARKET_DATA_DIR || 'data/market';
  if (hasFiles(configured)) return;
  if (!process.env.SQL_HOST) return;

  try {
    const { db } = await import('../db/index.ts');
    const { marketDataFiles } = await import('../db/schema.ts');
    const rows = (await Promise.race([
      db.select({ name: marketDataFiles.name, content: marketDataFiles.content }).from(marketDataFiles),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), TIMEOUT_MS)),
    ])) as { name: string; content: string }[];

    const files = rows.filter((r) => NEEDED.includes(r.name));
    if (files.length < NEEDED.length) {
      console.warn('Market data: not found on disk or in the database; using the synthetic sample. Run `npm run market:upload`.');
      return;
    }
    const dir = path.join(os.tmpdir(), 'valubuild-market-data');
    fs.mkdirSync(dir, { recursive: true });
    for (const f of files) fs.writeFileSync(path.join(dir, f.name), f.content, 'utf8');
    process.env.MARKET_DATA_DIR = dir;
    console.log(`Market data: loaded ${files.length} files from the database.`);
  } catch (err) {
    console.warn('Market data: could not load from the database:', (err as Error).message);
  }
}
