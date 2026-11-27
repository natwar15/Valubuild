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
  // Off by default: marketing email needs opt-in consent (PECR).
  monthlyEmailOptIn: boolean('monthly_email_opt_in').notNull().default(false),
  // Off by default: sharing into the pooled benchmarks needs explicit opt-in consent.
  anonymisedSharingDefault: boolean('anonymised_sharing_default').notNull().default(false),
  // When the user last agreed to the pooling terms, and which version of the privacy notice they saw.
  poolConsentAt: timestamp('pool_consent_at'),
  poolConsentVersion: text('pool_consent_version'),
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
  // Proof of opt-in for this report. Rows shared before versioned consent existed have
  // NULL here and are left out of the pool until the owner opts in again.
  shareConsentAt: timestamp('share_consent_at'),
  shareConsentVersion: text('share_consent_version'),
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

/**
 * Quick-valuation submissions (6-question intake). Stored under an anonymised
 * alias chosen or generated in the browser; the real practice name is never asked for.
 * Only the postcode AREA (e.g. "LS") is kept, never the full postcode or district.
 * Rows with shareConsent = true feed the pooled benchmarks, as aggregates only.
 */
export const practiceSubmissions = pgTable('practice_submissions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  alias: text('alias').notNull(),
  postcodeArea: text('postcode_area').notNull(),
  region: text('region').notNull(),
  practiceType: text('practice_type').notNull(),
  surgeries: integer('surgeries').notNull(),
  tenure: text('tenure').notNull(),
  feesGbp: integer('fees_gbp').notNull(),
  nhsPct: integer('nhs_pct').notNull(),
  privatePct: integer('private_pct').notNull(),
  planPct: integer('plan_pct').notNull(),
  principalDaysPerWeek: doublePrecision('principal_days_per_week').notNull(),
  ownerEbitdaGbp: integer('owner_ebitda_gbp'),
  // Optional: a professional valuation, offer or agreed sale price the owner has had.
  reportedValueGbp: integer('reported_value_gbp'),
  reportedValueKind: text('reported_value_kind'), // valuation | offer | sale
  reportedValueYear: integer('reported_value_year'),
  estimateLowGbp: integer('estimate_low_gbp').notNull(),
  estimateMidGbp: integer('estimate_mid_gbp').notNull(),
  estimateHighGbp: integer('estimate_high_gbp').notNull(),
  shareConsent: boolean('share_consent').notNull().default(false),
  shareConsentAt: timestamp('share_consent_at'),
  shareConsentVersion: text('share_consent_version'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Broker documents the owner chose to keep after extraction. Off by default:
 * normally a document is read in memory, its figures returned, and the file
 * discarded. Private to the owner, never pooled, removed with the account.
 */
export const keptDocuments = pgTable('kept_documents', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  userUid: text('user_uid').notNull(),
  docType: text('doc_type').notNull(), // accounts | nhs_schedule | clinician_income | plan_schedule
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  contentBase64: text('content_base64').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  reports: many(valuationReports),
  snapshots: many(valuationSnapshots),
  documents: many(uploadedDocuments),
  questions: many(adaptiveQuestions),
  digests: many(emailDigestLogs),
  submissions: many(practiceSubmissions),
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

/**
 * Copies of the market data files (listings_all.csv, market_index.csv) for
 * hosts with no persistent disk, such as Netlify. Loaded into a temp folder at
 * startup; see src/server/marketDataSync.ts and `npm run market:upload`.
 * Server-side only: rows are never sent to the browser.
 */
export const marketDataFiles = pgTable('market_data_files', {
  name: text('name').primaryKey(),
  content: text('content').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
