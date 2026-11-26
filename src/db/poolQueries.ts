import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from './index.ts';
import { practiceSubmissions, users, valuationReports } from './schema.ts';
import { AppRegion, PooledComparable, PoolRecord, PracticeType } from '../shared/marketStats.ts';

export type SubmissionInsert = typeof practiceSubmissions.$inferInsert;
export type SubmissionRow = typeof practiceSubmissions.$inferSelect;

export async function recordPoolConsent(userId: number, version: string) {
  await db
    .update(users)
    .set({ poolConsentAt: new Date(), poolConsentVersion: version, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function createSubmission(values: SubmissionInsert) {
  const [row] = await db.insert(practiceSubmissions).values(values).returning();
  return row;
}

export async function listUserSubmissions(uid: string) {
  return db
    .select()
    .from(practiceSubmissions)
    .where(eq(practiceSubmissions.userUid, uid))
    .orderBy(desc(practiceSubmissions.updatedAt));
}

export async function setSubmissionSharing(uid: string, id: number, share: boolean, version?: string) {
  const [row] = await db
    .update(practiceSubmissions)
    .set({
      shareConsent: share,
      shareConsentAt: share ? new Date() : null,
      shareConsentVersion: share ? version || null : null,
      updatedAt: new Date(),
    })
    .where(and(eq(practiceSubmissions.id, id), eq(practiceSubmissions.userUid, uid)))
    .returning();
  return row || null;
}

export async function deleteSubmission(uid: string, id: number) {
  const rows = await db
    .delete(practiceSubmissions)
    .where(and(eq(practiceSubmissions.id, id), eq(practiceSubmissions.userUid, uid)))
    .returning({ id: practiceSubmissions.id });
  return rows.length > 0;
}

/** Erases every row we hold for this user (cascades to reports, snapshots, documents, submissions...). */
export async function deleteUserAndData(uid: string) {
  const rows = await db.delete(users).where(eq(users.uid, uid)).returning({ id: users.id });
  return rows.length > 0;
}

/**
 * Rows for the pooled benchmarks. Server-side only: the result is always passed
 * through summarisePool() before anything leaves the server.
 */
export async function loadPoolRecords(): Promise<PoolRecord[]> {
  const subs = await db
    .select({
      userId: practiceSubmissions.userId,
      region: practiceSubmissions.region,
      type: practiceSubmissions.practiceType,
      surgeries: practiceSubmissions.surgeries,
      feesGbp: practiceSubmissions.feesGbp,
      ownerEbitdaGbp: practiceSubmissions.ownerEbitdaGbp,
      nhsPct: practiceSubmissions.nhsPct,
      reportedValueGbp: practiceSubmissions.reportedValueGbp,
      estimateMidGbp: practiceSubmissions.estimateMidGbp,
    })
    .from(practiceSubmissions)
    .where(and(eq(practiceSubmissions.shareConsent, true), isNotNull(practiceSubmissions.shareConsentVersion)))
    .orderBy(desc(practiceSubmissions.updatedAt));

  // Detailed-intake reports shared with consent contribute their input figures
  // (fees, margin, NHS share). Their engine-derived values are not pooled.
  const reports = await db
    .select({
      userId: valuationReports.userId,
      region: valuationReports.region,
      practiceType: valuationReports.practiceType,
      surgeries: valuationReports.surgeriesCount,
      feesGbp: valuationReports.turnoverGbp,
      marginPct: valuationReports.fmopMarginPercent,
    })
    .from(valuationReports)
    // Only reports with recorded, versioned consent. Older rows were shared by default.
    .where(and(eq(valuationReports.isAnonymisedShared, true), isNotNull(valuationReports.shareConsentVersion)))
    .orderBy(desc(valuationReports.updatedAt));

  const pct = (a: number | null, b: number) => (a && b > 0 ? (a / b) * 100 : null);
  const typeFromLabel = (t: string): PracticeType => {
    const l = t.toLowerCase();
    if (l.includes('nhs')) return 'NHS';
    if (l.includes('private')) return 'Private';
    if (l.includes('special')) return 'Specialist';
    return 'Mixed';
  };

  return [
    ...subs.map((s) => ({
      contributorKey: `u${s.userId}`,
      region: s.region as AppRegion,
      type: s.type as PracticeType,
      surgeries: s.surgeries,
      feesGbp: s.feesGbp,
      ownerMarginPct: pct(s.ownerEbitdaGbp, s.feesGbp),
      nhsPct: s.nhsPct,
      reportedValuePctFees: pct(s.reportedValueGbp, s.feesGbp),
      estimatePctFees: pct(s.estimateMidGbp, s.feesGbp),
    })),
    ...reports.map((r) => ({
      contributorKey: `u${r.userId}`,
      region: r.region as AppRegion,
      type: typeFromLabel(r.practiceType),
      surgeries: r.surgeries,
      feesGbp: r.feesGbp,
      ownerMarginPct: null,
      nhsPct: r.practiceType.toLowerCase().includes('nhs') ? 80 : r.practiceType.toLowerCase().includes('private') ? 10 : 50,
      reportedValuePctFees: null,
      estimatePctFees: null,
    })),
  ].filter((r) => r.feesGbp > 0);
}

/** Owner-reported valuations/offers/sales, used as extra comparables in the quick valuation. */
export async function loadPooledComparables(): Promise<PooledComparable[]> {
  const rows = await db
    .select({
      userId: practiceSubmissions.userId,
      region: practiceSubmissions.region,
      type: practiceSubmissions.practiceType,
      surgeries: practiceSubmissions.surgeries,
      feesGbp: practiceSubmissions.feesGbp,
      reportedValueGbp: practiceSubmissions.reportedValueGbp,
    })
    .from(practiceSubmissions)
    .where(and(eq(practiceSubmissions.shareConsent, true), isNotNull(practiceSubmissions.shareConsentVersion)))
    .orderBy(desc(practiceSubmissions.updatedAt));
  return rows
    .filter((r) => r.reportedValueGbp && r.feesGbp > 0)
    .map((r) => ({
      contributorKey: `u${r.userId}`,
      region: r.region as AppRegion,
      type: r.type as PracticeType,
      surgeries: r.surgeries,
      valuePctFees: ((r.reportedValueGbp as number) / r.feesGbp) * 100,
    }))
    .filter((r) => r.valuePctFees > 20 && r.valuePctFees < 500);
}
