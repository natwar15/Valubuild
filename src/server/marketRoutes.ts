/**
 * Public market data, quick valuation and pooled-benchmark routes.
 *
 * Public (no account): GET /api/market/summary, GET /api/market/index,
 *   POST /api/market/quick-estimate, GET /api/pool/summary
 * Signed in: GET/POST /api/submissions, PATCH/DELETE /api/submissions/:id,
 *   DELETE /api/me (erase account data)
 *
 * Nothing row-level ever leaves the server: listings and pool rows go through
 * summariseListings()/summarisePool(). Listing cells need MIN_CELL_SIZE rows; pooled
 * owner cells need POOL_MIN_CONTRIBUTORS distinct accounts and publish a protected median only.
 */
import type { Express, NextFunction, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getMarketData } from './marketData.ts';
import {
  APP_REGIONS,
  AppRegion,
  ListingFilters,
  PooledComparable,
  PoolRecord,
  QuickValuationInput,
  postcodeArea,
  quickValuation,
  regionForPostcode,
  summariseListings,
  summarisePool,
} from '../shared/marketStats.ts';
import { POOL_CONSENT_VERSION } from '../shared/consent.ts';
import {
  createSubmission,
  deleteSubmission,
  deleteUserAndData,
  listUserSubmissions,
  loadPoolRecords,
  loadPooledComparables,
  recordPoolConsent,
  setSubmissionSharing,
} from '../db/poolQueries.ts';
import { getOrCreateUser } from '../db/queries.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// --- tiny per-IP rate limiter for the public endpoints ----------------------
const hits = new Map<string, { count: number; resetAt: number }>();
function rateLimit(max: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const h = hits.get(key);
    if (!h || h.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      if (hits.size > 10000) {
        for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
      }
      return next();
    }
    if (++h.count > max) return res.status(429).json({ error: 'Too many requests, please slow down.' });
    next();
  };
}

// --- pooled data cache (DB may be absent in development) ----------------------
let poolCache: { at: number; records: PoolRecord[]; comparables: PooledComparable[] } | null = null;
async function getPool() {
  if (poolCache && Date.now() - poolCache.at < 5 * 60 * 1000) return poolCache;
  try {
    const [records, comparables] = await Promise.all([loadPoolRecords(), loadPooledComparables()]);
    poolCache = { at: Date.now(), records, comparables };
  } catch (err) {
    console.warn('Pooled benchmarks unavailable (database not reachable?):', (err as Error).message);
    poolCache = { at: Date.now(), records: [], comparables: [] };
  }
  return poolCache;
}
const invalidatePool = () => (poolCache = null);

// --- parsing helpers ----------------------------------------------------------
const list = (v: unknown): string[] | undefined => {
  if (typeof v !== 'string' || !v.trim()) return undefined;
  return v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20);
};
const optNum = (v: unknown): number | undefined => {
  if (v === undefined || v === '' || v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function parseFilters(q: Record<string, unknown>): ListingFilters {
  const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(v) ? v : undefined);
  return {
    regions: list(q.region),
    types: list(q.type),
    statuses: list(q.status),
    tenure: typeof q.tenure === 'string' ? q.tenure : undefined,
    minSurgeries: optNum(q.minSurgeries),
    maxSurgeries: optNum(q.maxSurgeries),
    minPrice: optNum(q.minPrice),
    maxPrice: optNum(q.maxPrice),
    from: date(q.from),
    to: date(q.to),
  };
}

export type QuickInputResult = { ok: true; input: QuickValuationInput } | { ok: false; error: string };

export function parseQuickInput(b: Record<string, unknown>): QuickInputResult {
  const area = postcodeArea(String(b.postcode || ''));
  const region = regionForPostcode(String(b.postcode || ''));
  if (!area || !region) {
    return { ok: false, error: 'Enter the first part of a postcode in England, Scotland or Wales (for example LS1).' };
  }
  const fees = Number(b.feesGbp);
  if (!Number.isFinite(fees) || fees < 50000 || fees > 20000000) {
    return { ok: false, error: 'Enter annual gross fees between £50,000 and £20m.' };
  }
  const nhs = clamp(Number(b.nhsPct) || 0, 0, 100);
  const priv = clamp(Number(b.privatePct) || 0, 0, 100);
  const plan = clamp(Number(b.planPct) || 0, 0, 100);
  if (Math.abs(nhs + priv + plan - 100) > 1) {
    return { ok: false, error: 'NHS, private and plan income should add up to 100%.' };
  }
  const ebitda = optNum(b.ownerEbitdaGbp);
  return {
    ok: true,
    input: {
      postcodeArea: area,
      region,
      feesGbp: Math.round(fees),
      nhsPct: Math.round(nhs),
      privatePct: Math.round(priv),
      planPct: Math.round(plan),
      surgeries: clamp(Math.round(Number(b.surgeries) || 1), 1, 30),
      tenure: b.tenure === 'Freehold' ? 'Freehold' : 'Leasehold',
      principalDaysPerWeek: clamp(Number(b.principalDaysPerWeek) || 0, 0, 7),
      ownerEbitdaGbp: ebitda !== undefined && ebitda > 0 && ebitda < fees ? Math.round(ebitda) : null,
    },
  };
}

const ALIAS_RE = /^[A-Za-z0-9 \-]{3,40}$/;

export function registerMarketRoutes(app: Express) {
  const publicLimit = rateLimit(120, 60 * 1000);

  app.get('/api/market/summary', publicLimit, (req, res) => {
    const data = getMarketData();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      isSample: data.isSample,
      loadedAt: data.loadedAt,
      regions: APP_REGIONS,
      summary: summariseListings(data.listings, parseFilters(req.query as Record<string, unknown>)),
    });
  });

  app.get('/api/market/index', publicLimit, (_req, res) => {
    const data = getMarketData();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ rows: data.index });
  });

  app.post('/api/market/quick-estimate', rateLimit(30, 60 * 1000), async (req, res) => {
    const parsed = parseQuickInput(req.body || {});
    if (!parsed.ok) return res.status(400).json({ error: parsed.error });
    const { comparables } = await getPool();
    const data = getMarketData();
    res.json({
      input: { region: parsed.input.region, postcodeArea: parsed.input.postcodeArea },
      isSample: data.isSample,
      result: quickValuation(parsed.input, data.listings, comparables),
    });
  });

  app.get('/api/pool/summary', publicLimit, async (_req, res) => {
    const { records } = await getPool();
    res.set('Cache-Control', 'public, max-age=300');
    res.json({ summary: summarisePool(records) });
  });

  // ---------------------------------------------------------------------------
  // Signed-in: save a quick valuation under an alias, manage sharing, erase data
  // ---------------------------------------------------------------------------
  app.get('/api/submissions', requireAuth, async (req: AuthRequest, res) => {
    try {
      res.json({ submissions: await listUserSubmissions(req.user!.uid) });
    } catch (err) {
      console.error('GET /api/submissions error:', err);
      res.status(500).json({ error: 'Unable to load your saved valuations.' });
    }
  });

  app.post('/api/submissions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const body = req.body || {};
      const parsed = parseQuickInput(body);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      const alias = String(body.alias || '').trim();
      if (!ALIAS_RE.test(alias)) {
        return res.status(400).json({ error: 'Choose a nickname of 3 to 40 letters, numbers, spaces or dashes.' });
      }
      const share = body.shareConsent === true && body.consentVersion === POOL_CONSENT_VERSION;
      // Pooling requires a verified email so the pool can't be flooded by throwaway accounts.
      if (share && !req.user!.email_verified) {
        return res.status(403).json({ error: 'Verify your email address before adding your figures to the pool.' });
      }

      const kind = ['valuation', 'offer', 'sale'].includes(body.reportedValueKind) ? body.reportedValueKind : null;
      const reported = optNum(body.reportedValueGbp);
      const year = optNum(body.reportedValueYear);
      const thisYear = new Date().getFullYear();

      const uid = req.user!.uid;
      const user = await getOrCreateUser(uid, req.user!.email || `${uid}@users.valubuild.invalid`, req.user!.name);
      const { comparables } = await getPool();
      const result = quickValuation(parsed.input, getMarketData().listings, comparables);
      const i = parsed.input;

      const row = await createSubmission({
        userId: user.id,
        userUid: uid,
        alias,
        postcodeArea: i.postcodeArea,
        region: i.region as AppRegion,
        practiceType: result.practiceType,
        surgeries: i.surgeries,
        tenure: i.tenure,
        feesGbp: i.feesGbp,
        nhsPct: i.nhsPct,
        privatePct: i.privatePct,
        planPct: i.planPct,
        principalDaysPerWeek: i.principalDaysPerWeek,
        ownerEbitdaGbp: i.ownerEbitdaGbp ?? null,
        reportedValueGbp: kind && reported && reported > 0 && reported < 50000000 ? Math.round(reported) : null,
        reportedValueKind: kind && reported ? kind : null,
        reportedValueYear: kind && year && year >= 2015 && year <= thisYear ? year : null,
        estimateLowGbp: result.goodwillLowGbp,
        estimateMidGbp: result.goodwillMidGbp,
        estimateHighGbp: result.goodwillHighGbp,
        shareConsent: share,
        shareConsentAt: share ? new Date() : null,
        shareConsentVersion: share ? POOL_CONSENT_VERSION : null,
      });
      if (share) {
        await recordPoolConsent(user.id, POOL_CONSENT_VERSION);
        invalidatePool();
      }
      res.status(201).json({ submission: row, result });
    } catch (err) {
      console.error('POST /api/submissions error:', err);
      res.status(500).json({ error: 'Unable to save your valuation.' });
    }
  });

  app.patch('/api/submissions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id.' });
      const share = req.body?.shareConsent === true;
      if (share && req.body?.consentVersion !== POOL_CONSENT_VERSION) {
        return res.status(400).json({ error: 'Please read and accept the current pooling terms.' });
      }
      if (share && !req.user!.email_verified) {
        return res.status(403).json({ error: 'Verify your email address before adding your figures to the pool.' });
      }
      const row = await setSubmissionSharing(req.user!.uid, id, share, POOL_CONSENT_VERSION);
      if (!row) return res.status(404).json({ error: 'Not found.' });
      invalidatePool();
      res.json({ submission: row });
    } catch (err) {
      console.error('PATCH /api/submissions error:', err);
      res.status(500).json({ error: 'Unable to update sharing.' });
    }
  });

  app.delete('/api/submissions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid id.' });
      const ok = await deleteSubmission(req.user!.uid, id);
      if (!ok) return res.status(404).json({ error: 'Not found.' });
      invalidatePool();
      res.json({ deleted: true });
    } catch (err) {
      console.error('DELETE /api/submissions error:', err);
      res.status(500).json({ error: 'Unable to delete.' });
    }
  });

  /** Right to erasure: removes everything held in Postgres for this account. */
  app.delete('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      await deleteUserAndData(uid);
      invalidatePool();
      // Best effort: the Firestore mirror and the sign-in account. Needs server
      // credentials (automatic on Google Cloud); the browser retries the account
      // deletion itself if this part fails.
      let firestoreDeleted = false;
      let authDeleted = false;
      try {
        const fs = getFirestore(firebaseConfig.firestoreDatabaseId);
        await fs.recursiveDelete(fs.doc(`users/${uid}`));
        firestoreDeleted = true;
      } catch (e) {
        console.warn('Firestore erase skipped:', (e as Error).message);
      }
      // Founding-owner sign-ups (the "leads" collection) are keyed by email, not uid.
      let leadsDeleted = 0;
      const email = (req.user!.email || '').trim().toLowerCase();
      if (email && req.user!.email_verified) {
        try {
          const fs = getFirestore(firebaseConfig.firestoreDatabaseId);
          const snap = await fs.collection('leads').where('email', '==', email).get();
          await Promise.all(snap.docs.map((d) => d.ref.delete()));
          leadsDeleted = snap.size;
        } catch (e) {
          console.warn('Lead erase skipped:', (e as Error).message);
        }
      }
      try {
        await adminAuth.deleteUser(uid);
        authDeleted = true;
      } catch (e) {
        console.warn('Auth user delete skipped:', (e as Error).message);
      }
      res.json({ deleted: true, firestoreDeleted, authDeleted, leadsDeleted });
    } catch (err) {
      console.error('DELETE /api/me error:', err);
      res.status(500).json({ error: 'Unable to delete your data. Please contact us.' });
    }
  });
}
