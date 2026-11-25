import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull().default('Dental Principal'),
  monthlyEmailOptIn: boolean('monthly_email_opt_in').notNull().default(true),
  anonymisedSharingDefault: boolean('anonymised_sharing_default').notNull().default(true),
  lastDigestSentAt: timestamp('last_digest_sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const valuationReports = pgTable('valuation_reports', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  practiceName: text('practice_name').notNull(),
  practiceType: text('practice_type').notNull(),
  region: text('region').notNull(),
  postcodeOutward: text('postcode_outward').notNull().default('UK'),
  surgeriesCount: integer('surgeries_count').notNull().default(4),
  turnoverGbp: integer('turnover_gbp').notNull(),
  fmopGbp: integer('fmop_gbp').notNull(),
  fmopMarginPercent: doublePrecision('fmop_margin_percent').notNull().default(18.0),
  ypMultiple: doublePrecision('yp_multiple').notNull(),
  mv1GoodwillGbp: integer('mv1_goodwill_gbp').notNull(),
  buyerReadinessScore: integer('buyer_readiness_score').notNull(),
  isAnonymisedShared: boolean('is_anonymised_shared').notNull().default(false),
  anonymisedCode: text('anonymised_code').notNull(),
  intakeJson: jsonb('intake_json').$type<Record<string, unknown>>().notNull(),
  aiPointersJson: jsonb('ai_pointers_json').$type<
    Array<{
      id: string;
      title: string;
      detail: string;
      category: string;
      estimatedImpactGbp: string;
      priority: 'High' | 'Medium' | 'Low';
    }>
  >().default([]),
  valuationDriversJson: jsonb('valuation_drivers_json').$type<
    Array<{
      factor: string;
      direction: 'positive' | 'negative' | 'neutral';
      impactSummary: string;
      sourceDoc?: string;
    }>
  >().default([]),
  monthlyPolicyNotesJson: jsonb('monthly_policy_notes_json').$type<
    Array<{
      monthKey: string;
      headline: string;
      impactDeltaGbp: number;
      scoreDelta: number;
      summary: string;
    }>
  >().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const valuationSnapshots = pgTable('valuation_snapshots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  reportId: integer('report_id').references(() => valuationReports.id, { onDelete: 'set null' }),
  practiceLabel: text('practice_label').notNull().default('Primary Dental Practice'),
  snapshotMonth: text('snapshot_month').notNull(), // YYYY-MM
  buyerReadinessScore: integer('buyer_readiness_score').notNull(),
  mv1GoodwillGbp: integer('mv1_goodwill_gbp').notNull(),
  ypMultiple: doublePrecision('yp_multiple').notNull(),
  fmopGbp: integer('fmop_gbp').notNull(),
  policyTriggerSummary: text('policy_trigger_summary').notNull().default('Manual valuation snapshot'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const uploadedDocuments = pgTable('uploaded_documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  reportId: integer('report_id').references(() => valuationReports.id, { onDelete: 'set null' }),
  docCategory: text('doc_category').notNull(), // valuation_report | accounts_report | bank_statement | nhs_schedule | expenses_list | payroll
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull().default('text/plain'),
  extractedSummary: text('extracted_summary').notNull(),
  extractedMetricsJson: jsonb('extracted_metrics_json').$type<Record<string, unknown>>().default({}),
  valuationImpactPointsJson: jsonb('valuation_impact_points_json').$type<
    Array<{
      factor: string;
      direction: 'positive' | 'negative' | 'neutral';
      estimatedPoundImpact: string;
      explanation: string;
    }>
  >().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const adaptiveQuestions = pgTable('adaptive_questions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  reportId: integer('report_id').references(() => valuationReports.id, { onDelete: 'set null' }),
  documentId: integer('document_id').references(() => uploadedDocuments.id, { onDelete: 'set null' }),
  questionText: text('question_text').notNull(),
  rationale: text('rationale').notNull(),
  category: text('category').notNull(),
  impactArea: text('impact_area').notNull(),
  answerText: text('answer_text'),
  status: text('status').notNull().default('pending'), // pending | answered
  createdAt: timestamp('created_at').defaultNow().notNull(),
  answeredAt: timestamp('answered_at'),
});

export const monthlyBriefings = pgTable('monthly_briefings', {
  id: serial('id').primaryKey(),
  monthKey: text('month_key').notNull().unique(), // YYYY-MM
  headline: text('headline').notNull(),
  summary: text('summary').notNull(),
  policyChangesJson: jsonb('policy_changes_json').$type<
    Array<{
      title: string;
      category: string;
      impactOnMultiples: string;
      affectedPracticeTypes: string[];
    }>
  >().default([]),
  multipleAdjustmentsJson: jsonb('multiple_adjustments_json').$type<Record<string, number>>().default({}),
  sourcesJson: jsonb('sources_json').$type<Array<{ title: string; uri: string }>>().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const emailDigestLogs = pgTable('email_digest_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  recipientEmail: text('recipient_email').notNull(),
  monthKey: text('month_key').notNull(),
  subject: text('subject').notNull(),
  htmlBody: text('html_body').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('generated_preview'), // sent_smtp | generated_preview
  sentAt: timestamp('sent_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  reports: many(valuationReports),
  snapshots: many(valuationSnapshots),
  documents: many(uploadedDocuments),
  questions: many(adaptiveQuestions),
  digests: many(emailDigestLogs),
}));

export const valuationReportsRelations = relations(valuationReports, ({ one, many }) => ({
  owner: one(users, {
    fields: [valuationReports.userId],
    references: [users.id],
  }),
  snapshots: many(valuationSnapshots),
  documents: many(uploadedDocuments),
  questions: many(adaptiveQuestions),
}));
