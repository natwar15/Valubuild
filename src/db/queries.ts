import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  adaptiveQuestions,
  emailDigestLogs,
  monthlyBriefings,
  uploadedDocuments,
  users,
  valuationReports,
  valuationSnapshots,
} from './schema.ts';

export type AiPointer = {
  id: string;
  title: string;
  detail: string;
  category: string;
  estimatedImpactGbp: string;
  priority: 'High' | 'Medium' | 'Low';
};

export type ValuationDriver = {
  factor: string;
  direction: 'positive' | 'negative' | 'neutral';
  impactSummary: string;
  sourceDoc?: string;
};

export type MonthlyPolicyNote = {
  monthKey: string;
  headline: string;
  impactDeltaGbp: number;
  scoreDelta: number;
  summary: string;
};

function generateAnonymisedCode(region: string): string {
  const prefixMap: Record<string, string> = {
    'London & South East': 'LSE',
    Midlands: 'MID',
    'North West': 'NW',
    'Yorkshire & Humber': 'YRK',
    'South West': 'SW',
    'East of England': 'EE',
    Scotland: 'SCO',
    Wales: 'WAL',
    'North East': 'NE',
  };
  const code = prefixMap[region] || 'UK';
  const rand = Math.floor(100 + Math.random() * 899);
  return `UK-${code}-${rand}`;
}

export async function getOrCreateUser(uid: string, email: string, displayName?: string) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (displayName || cleanEmail.split('@')[0] || 'Dental Principal').slice(0, 120);

    const [user] = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        displayName: cleanName,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
          displayName: cleanName,
          updatedAt: new Date(),
        },
      })
      .returning();

    return user;
  } catch (error) {
    throw new Error('Failed to synchronize user account in database', { cause: error });
  }
}

export async function updateUserPreferences(
  uid: string,
  prefs: {
    monthlyEmailOptIn?: boolean;
    anonymisedSharingDefault?: boolean;
    displayName?: string;
    consentVersion?: string;
  }
) {
  try {
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof prefs.monthlyEmailOptIn === 'boolean') {
      updateValues.monthlyEmailOptIn = prefs.monthlyEmailOptIn;
    }
    if (typeof prefs.anonymisedSharingDefault === 'boolean') {
      updateValues.anonymisedSharingDefault = prefs.anonymisedSharingDefault;
      if (prefs.anonymisedSharingDefault) {
        updateValues.poolConsentAt = new Date();
        updateValues.poolConsentVersion = prefs.consentVersion || null;
      }
    }
    if (typeof prefs.displayName === 'string' && prefs.displayName.trim().length > 0) {
      updateValues.displayName = prefs.displayName.trim().slice(0, 120);
    }

    const [updated] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.uid, uid))
      .returning();

    return updated;
  } catch (error) {
    throw new Error('Failed to update user preferences', { cause: error });
  }
}

export async function listUserReports(uid: string) {
  try {
    return await db
      .select()
      .from(valuationReports)
      .where(eq(valuationReports.userUid, uid))
      .orderBy(desc(valuationReports.updatedAt));
  } catch (error) {
    throw new Error('Failed to load user valuation reports', { cause: error });
  }
}

export async function getUserReportById(uid: string, reportId: number) {
  try {
    const [report] = await db
      .select()
      .from(valuationReports)
      .where(and(eq(valuationReports.id, reportId), eq(valuationReports.userUid, uid)))
      .limit(1);
    return report || null;
  } catch (error) {
    throw new Error('Failed to fetch valuation report', { cause: error });
  }
}

export async function saveValuationReport(params: {
  userId: number;
  userUid: string;
  reportId?: number;
  practiceName: string;
  practiceType: string;
  region: string;
  postcodeOutward: string;
  surgeriesCount: number;
  turnoverGbp: number;
  fmopGbp: number;
  fmopMarginPercent: number;
  ypMultiple: number;
  mv1GoodwillGbp: number;
  buyerReadinessScore: number;
  isAnonymisedShared: boolean;
  /** Notice version the owner agreed to when sharing; required for the row to be pooled. */
  shareConsentVersion?: string | null;
  intakeJson: Record<string, unknown>;
  aiPointersJson?: AiPointer[];
  valuationDriversJson?: ValuationDriver[];
  monthlyPolicyNotesJson?: MonthlyPolicyNote[];
}) {
  try {
    const outward = (params.postcodeOutward || 'UK').trim().toUpperCase().split(' ')[0].slice(0, 6);
    const shared = params.isAnonymisedShared && Boolean(params.shareConsentVersion);
    const consentFields = {
      isAnonymisedShared: shared,
      shareConsentAt: shared ? new Date() : null,
      shareConsentVersion: shared ? (params.shareConsentVersion as string) : null,
    };
    // Keep the street address and full postcode out of storage: the valuation only
    // needs the region and the postcode district.
    const { address: _address, ...intakeRest } = params.intakeJson as Record<string, unknown>;
    const intakeJson = { ...intakeRest, postcode: outward };

    if (params.reportId) {
      const existing = await getUserReportById(params.userUid, params.reportId);
      if (existing) {
        const [updated] = await db
          .update(valuationReports)
          .set({
            practiceName: params.practiceName.slice(0, 150),
            practiceType: params.practiceType.slice(0, 60),
            region: params.region.slice(0, 80),
            postcodeOutward: outward,
            surgeriesCount: params.surgeriesCount,
            turnoverGbp: Math.round(params.turnoverGbp),
            fmopGbp: Math.round(params.fmopGbp),
            fmopMarginPercent: Number(params.fmopMarginPercent.toFixed(2)),
            ypMultiple: Number(params.ypMultiple.toFixed(2)),
            mv1GoodwillGbp: Math.round(params.mv1GoodwillGbp),
            buyerReadinessScore: Math.max(0, Math.min(100, Math.round(params.buyerReadinessScore))),
            ...consentFields,
            intakeJson,
            ...(params.aiPointersJson ? { aiPointersJson: params.aiPointersJson } : {}),
            ...(params.valuationDriversJson ? { valuationDriversJson: params.valuationDriversJson } : {}),
            ...(params.monthlyPolicyNotesJson ? { monthlyPolicyNotesJson: params.monthlyPolicyNotesJson } : {}),
            updatedAt: new Date(),
          })
          .where(and(eq(valuationReports.id, params.reportId), eq(valuationReports.userUid, params.userUid)))
          .returning();
        return updated;
      }
    }

    const [created] = await db
      .insert(valuationReports)
      .values({
        userId: params.userId,
        userUid: params.userUid,
        practiceName: params.practiceName.slice(0, 150),
        practiceType: params.practiceType.slice(0, 60),
        region: params.region.slice(0, 80),
        postcodeOutward: outward,
        surgeriesCount: params.surgeriesCount,
        turnoverGbp: Math.round(params.turnoverGbp),
        fmopGbp: Math.round(params.fmopGbp),
        fmopMarginPercent: Number(params.fmopMarginPercent.toFixed(2)),
        ypMultiple: Number(params.ypMultiple.toFixed(2)),
        mv1GoodwillGbp: Math.round(params.mv1GoodwillGbp),
        buyerReadinessScore: Math.max(0, Math.min(100, Math.round(params.buyerReadinessScore))),
        ...consentFields,
        anonymisedCode: generateAnonymisedCode(params.region),
        intakeJson,
        aiPointersJson: params.aiPointersJson || [],
        valuationDriversJson: params.valuationDriversJson || [],
        monthlyPolicyNotesJson: params.monthlyPolicyNotesJson || [],
      })
      .returning();

    return created;
  } catch (error) {
    throw new Error('Failed to save valuation report', { cause: error });
  }
}

export async function toggleReportAnonymisedSharing(
  uid: string,
  reportId: number,
  isShared: boolean,
  consentVersion?: string
) {
  try {
    const shared = isShared && Boolean(consentVersion);
    const [updated] = await db
      .update(valuationReports)
      .set({
        isAnonymisedShared: shared,
        shareConsentAt: shared ? new Date() : null,
        shareConsentVersion: shared ? (consentVersion as string) : null,
        updatedAt: new Date(),
      })
      .where(and(eq(valuationReports.id, reportId), eq(valuationReports.userUid, uid)))
      .returning();
    return updated || null;
  } catch (error) {
    throw new Error('Failed to update report anonymisation setting', { cause: error });
  }
}

export async function updateReportAiEnrichment(
  uid: string,
  reportId: number,
  updates: {
    aiPointersJson?: AiPointer[];
    valuationDriversJson?: ValuationDriver[];
    monthlyPolicyNotesJson?: MonthlyPolicyNote[];
    buyerReadinessScore?: number;
    ypMultiple?: number;
    mv1GoodwillGbp?: number;
    fmopGbp?: number;
  }
) {
  try {
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (updates.aiPointersJson) patch.aiPointersJson = updates.aiPointersJson;
    if (updates.valuationDriversJson) patch.valuationDriversJson = updates.valuationDriversJson;
    if (updates.monthlyPolicyNotesJson) patch.monthlyPolicyNotesJson = updates.monthlyPolicyNotesJson;
    if (typeof updates.buyerReadinessScore === 'number') {
      patch.buyerReadinessScore = Math.max(0, Math.min(100, Math.round(updates.buyerReadinessScore)));
    }
    if (typeof updates.ypMultiple === 'number') {
      patch.ypMultiple = Number(Math.max(3.5, Math.min(12.5, updates.ypMultiple)).toFixed(2));
    }
    if (typeof updates.mv1GoodwillGbp === 'number') {
      patch.mv1GoodwillGbp = Math.max(0, Math.round(updates.mv1GoodwillGbp));
    }
    if (typeof updates.fmopGbp === 'number') {
      patch.fmopGbp = Math.max(0, Math.round(updates.fmopGbp));
    }

    const [updated] = await db
      .update(valuationReports)
      .set(patch)
      .where(and(eq(valuationReports.id, reportId), eq(valuationReports.userUid, uid)))
      .returning();

    return updated || null;
  } catch (error) {
    throw new Error('Failed to update report AI enrichment', { cause: error });
  }
}

export async function listUserSnapshots(uid: string) {
  try {
    return await db
      .select()
      .from(valuationSnapshots)
      .where(eq(valuationSnapshots.userUid, uid))
      .orderBy(asc(valuationSnapshots.snapshotMonth), asc(valuationSnapshots.createdAt));
  } catch (error) {
    throw new Error('Failed to load valuation history snapshots', { cause: error });
  }
}

export async function createOrUpdateSnapshot(params: {
  userId: number;
  userUid: string;
  reportId?: number | null;
  practiceLabel: string;
  snapshotMonth: string; // YYYY-MM
  buyerReadinessScore: number;
  mv1GoodwillGbp: number;
  ypMultiple: number;
  fmopGbp: number;
  policyTriggerSummary: string;
}) {
  try {
    const cleanMonth = params.snapshotMonth.slice(0, 7);
    const existing = await db
      .select()
      .from(valuationSnapshots)
      .where(
        and(
          eq(valuationSnapshots.userUid, params.userUid),
          eq(valuationSnapshots.snapshotMonth, cleanMonth)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      const [updated] = await db
        .update(valuationSnapshots)
        .set({
          reportId: params.reportId ?? existing[0].reportId,
          practiceLabel: params.practiceLabel.slice(0, 120),
          buyerReadinessScore: Math.max(0, Math.min(100, Math.round(params.buyerReadinessScore))),
          mv1GoodwillGbp: Math.max(0, Math.round(params.mv1GoodwillGbp)),
          ypMultiple: Number(params.ypMultiple.toFixed(2)),
          fmopGbp: Math.max(0, Math.round(params.fmopGbp)),
          policyTriggerSummary: params.policyTriggerSummary.slice(0, 300),
          createdAt: new Date(),
        })
        .where(eq(valuationSnapshots.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(valuationSnapshots)
      .values({
        userId: params.userId,
        userUid: params.userUid,
        reportId: params.reportId ?? null,
        practiceLabel: params.practiceLabel.slice(0, 120),
        snapshotMonth: cleanMonth,
        buyerReadinessScore: Math.max(0, Math.min(100, Math.round(params.buyerReadinessScore))),
        mv1GoodwillGbp: Math.max(0, Math.round(params.mv1GoodwillGbp)),
        ypMultiple: Number(params.ypMultiple.toFixed(2)),
        fmopGbp: Math.max(0, Math.round(params.fmopGbp)),
        policyTriggerSummary: params.policyTriggerSummary.slice(0, 300),
      })
      .returning();

    return created;
  } catch (error) {
    throw new Error('Failed to save monthly valuation snapshot', { cause: error });
  }
}

export async function listUserDocuments(uid: string) {
  try {
    return await db
      .select()
      .from(uploadedDocuments)
      .where(eq(uploadedDocuments.userUid, uid))
      .orderBy(desc(uploadedDocuments.createdAt))
      .limit(50);
  } catch (error) {
    throw new Error('Failed to load uploaded documents', { cause: error });
  }
}

export async function saveUploadedDocument(params: {
  userId: number;
  userUid: string;
  reportId?: number | null;
  docCategory: string;
  fileName: string;
  mimeType: string;
  extractedSummary: string;
  extractedMetricsJson: Record<string, unknown>;
  valuationImpactPointsJson: Array<{
    factor: string;
    direction: 'positive' | 'negative' | 'neutral';
    estimatedPoundImpact: string;
    explanation: string;
  }>;
}) {
  try {
    const [created] = await db
      .insert(uploadedDocuments)
      .values({
        userId: params.userId,
        userUid: params.userUid,
        reportId: params.reportId ?? null,
        docCategory: params.docCategory.slice(0, 50),
        fileName: params.fileName.slice(0, 180),
        mimeType: params.mimeType.slice(0, 100),
        extractedSummary: params.extractedSummary,
        extractedMetricsJson: params.extractedMetricsJson,
        valuationImpactPointsJson: params.valuationImpactPointsJson,
      })
      .returning();
    return created;
  } catch (error) {
    throw new Error('Failed to store document analysis', { cause: error });
  }
}

export async function listUserQuestions(uid: string) {
  try {
    return await db
      .select()
      .from(adaptiveQuestions)
      .where(eq(adaptiveQuestions.userUid, uid))
      .orderBy(asc(adaptiveQuestions.status), desc(adaptiveQuestions.createdAt))
      .limit(60);
  } catch (error) {
    throw new Error('Failed to load adaptive question dataset', { cause: error });
  }
}

export async function createAdaptiveQuestions(
  items: Array<{
    userId: number;
    userUid: string;
    reportId?: number | null;
    documentId?: number | null;
    questionText: string;
    rationale: string;
    category: string;
    impactArea: string;
  }>
) {
  try {
    if (items.length === 0) return [];
    return await db
      .insert(adaptiveQuestions)
      .values(
        items.map((item) => ({
          userId: item.userId,
          userUid: item.userUid,
          reportId: item.reportId ?? null,
          documentId: item.documentId ?? null,
          questionText: item.questionText.slice(0, 500),
          rationale: item.rationale.slice(0, 500),
          category: item.category.slice(0, 80),
          impactArea: item.impactArea.slice(0, 120),
          status: 'pending',
        }))
      )
      .returning();
  } catch (error) {
    throw new Error('Failed to store adaptive questions', { cause: error });
  }
}

export async function answerAdaptiveQuestion(uid: string, questionId: number, answerText: string) {
  try {
    const [updated] = await db
      .update(adaptiveQuestions)
      .set({
        answerText: answerText.slice(0, 2000),
        status: 'answered',
        answeredAt: new Date(),
      })
      .where(and(eq(adaptiveQuestions.id, questionId), eq(adaptiveQuestions.userUid, uid)))
      .returning();
    return updated || null;
  } catch (error) {
    throw new Error('Failed to save adaptive question answer', { cause: error });
  }
}

export async function listMonthlyBriefings() {
  try {
    return await db
      .select()
      .from(monthlyBriefings)
      .orderBy(desc(monthlyBriefings.monthKey))
      .limit(12);
  } catch (error) {
    throw new Error('Failed to load monthly market briefings', { cause: error });
  }
}

export async function upsertMonthlyBriefing(params: {
  monthKey: string;
  headline: string;
  summary: string;
  policyChangesJson: Array<{
    title: string;
    category: string;
    impactOnMultiples: string;
    affectedPracticeTypes: string[];
  }>;
  multipleAdjustmentsJson: Record<string, number>;
  sourcesJson: Array<{ title: string; uri: string }>;
}) {
  try {
    const [saved] = await db
      .insert(monthlyBriefings)
      .values({
        monthKey: params.monthKey.slice(0, 7),
        headline: params.headline.slice(0, 250),
        summary: params.summary,
        policyChangesJson: params.policyChangesJson,
        multipleAdjustmentsJson: params.multipleAdjustmentsJson,
        sourcesJson: params.sourcesJson,
      })
      .onConflictDoUpdate({
        target: monthlyBriefings.monthKey,
        set: {
          headline: params.headline.slice(0, 250),
          summary: params.summary,
          policyChangesJson: params.policyChangesJson,
          multipleAdjustmentsJson: params.multipleAdjustmentsJson,
          sourcesJson: params.sourcesJson,
          createdAt: new Date(),
        },
      })
      .returning();
    return saved;
  } catch (error) {
    throw new Error('Failed to save monthly market briefing', { cause: error });
  }
}

export async function listUserEmailDigests(uid: string) {
  try {
    return await db
      .select()
      .from(emailDigestLogs)
      .where(eq(emailDigestLogs.userUid, uid))
      .orderBy(desc(emailDigestLogs.sentAt))
      .limit(12);
  } catch (error) {
    throw new Error('Failed to load email digest archive', { cause: error });
  }
}

export async function logEmailDigest(params: {
  userId: number;
  userUid: string;
  recipientEmail: string;
  monthKey: string;
  subject: string;
  htmlBody: string;
  deliveryStatus: 'sent_smtp' | 'generated_preview';
}) {
  try {
    const [created] = await db
      .insert(emailDigestLogs)
      .values({
        userId: params.userId,
        userUid: params.userUid,
        recipientEmail: params.recipientEmail,
        monthKey: params.monthKey,
        subject: params.subject,
        htmlBody: params.htmlBody,
        deliveryStatus: params.deliveryStatus,
      })
      .returning();

    await db
      .update(users)
      .set({ lastDigestSentAt: new Date(), updatedAt: new Date() })
      .where(eq(users.uid, params.userUid));

    return created;
  } catch (error) {
    throw new Error('Failed to record email digest log', { cause: error });
  }
}
