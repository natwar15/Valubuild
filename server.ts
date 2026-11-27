import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import nodemailer from 'nodemailer';
import { Modality, Type } from '@google/genai';
import { getGeminiClient } from './src/lib/gemini.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { registerMarketRoutes } from './src/server/marketRoutes.ts';
import { registerBrokerDocRoutes } from './src/server/brokerDocRoutes.ts';
import { registerLeadRoutes } from './src/server/leadEmail.ts';
import { prepareMarketDataDir } from './src/server/marketDataSync.ts';
import { recordPoolConsent } from './src/db/poolQueries.ts';
import { POOL_CONSENT_VERSION } from './src/shared/consent.ts';
import {
  answerAdaptiveQuestion,
  createAdaptiveQuestions,
  createOrUpdateSnapshot,
  getOrCreateUser,
  getUserReportById,
  listMonthlyBriefings,
  listUserDocuments,
  listUserEmailDigests,
  listUserQuestions,
  listUserReports,
  listUserSnapshots,
  logEmailDigest,
  saveUploadedDocument,
  saveValuationReport,
  toggleReportAnonymisedSharing,
  updateReportAiEnrichment,
  updateUserPreferences,
  upsertMonthlyBriefing,
  AiPointer,
  ValuationDriver,
} from './src/db/queries.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function escapeHtml(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatGbpSimple(n: number): string {
  if (!Number.isFinite(n)) return '£0';
  if (Math.abs(n) >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `£${Math.round(n / 1_000)}k`;
  return `£${Math.round(n).toLocaleString('en-GB')}`;
}

function extractSafeHttpUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  // Per-IP rate limits need the client's address. Behind Cloud Run or a load
  // balancer set TRUST_PROXY=1 so Express reads it from X-Forwarded-For.
  // Netlify Server already passes the client address, so leave it unset there
  // (trusting the header would let callers spoof it).
  if (process.env.TRUST_PROXY) {
    const hops = Number(process.env.TRUST_PROXY);
    app.set('trust proxy', Number.isFinite(hops) ? hops : process.env.TRUST_PROXY);
  }

  // Netlify (and other hosts without a disk copy of the listings) load them
  // from Postgres into a temp folder before the first request.
  await prepareMarketDataDir();

  // Bounded body limit for document uploads (PDFs, CSVs, images, text)
  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'valubuild-uk-dental-api' });
  });

  // =========================================================================
  // 1. ACCOUNT & PREFERENCES
  // =========================================================================
  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      const displayName = req.user!.name || email.split('@')[0];
      const user = await getOrCreateUser(uid, email, displayName);
      res.json({ user });
    } catch (error) {
      console.error('GET /api/me error:', error);
      res.status(500).json({ error: 'Unable to load user profile.' });
    }
  });

  app.patch('/api/me/preferences', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      await getOrCreateUser(uid, email, req.user!.name);

      const { monthlyEmailOptIn, anonymisedSharingDefault, displayName } = req.body || {};
      const user = await updateUserPreferences(uid, {
        monthlyEmailOptIn: typeof monthlyEmailOptIn === 'boolean' ? monthlyEmailOptIn : undefined,
        // Turning pooling on only counts with the current notice version (explicit consent).
        anonymisedSharingDefault:
          anonymisedSharingDefault === false
            ? false
            : anonymisedSharingDefault === true && req.body?.consentVersion === POOL_CONSENT_VERSION
            ? true
            : undefined,
        consentVersion: POOL_CONSENT_VERSION,
        displayName: typeof displayName === 'string' ? displayName : undefined,
      });

      res.json({ user });
    } catch (error) {
      console.error('PATCH /api/me/preferences error:', error);
      res.status(500).json({ error: 'Unable to update account preferences.' });
    }
  });

  // =========================================================================
  // 2. VALUATION REPORTS & ANONYMISED NATIONAL POOL
  // =========================================================================
  app.get('/api/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const reports = await listUserReports(req.user!.uid);
      res.json({ reports });
    } catch (error) {
      console.error('GET /api/reports error:', error);
      res.status(500).json({ error: 'Unable to load your saved valuation reports.' });
    }
  });

  app.post('/api/reports', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      const user = await getOrCreateUser(uid, email, req.user!.name);

      const body = req.body || {};
      const practiceName = String(body.practiceName || 'Unnamed UK Dental Practice').trim();
      const practiceType = String(body.practiceType || 'Mixed Practice').trim();
      const region = String(body.region || 'Yorkshire & Humber').trim();
      const postcodeOutward = String(body.postcodeOutward || body.postcode || 'UK').trim();
      const surgeriesCount = Math.max(1, Math.min(30, Number(body.surgeriesCount) || 4));
      const turnoverGbp = Math.max(0, Number(body.turnoverGbp) || 0);
      const fmopGbp = Math.max(0, Number(body.fmopGbp) || 0);
      const fmopMarginPercent = Number(body.fmopMarginPercent) || 0;
      const ypMultiple = Number(body.ypMultiple) || 6.5;
      const mv1GoodwillGbp = Math.max(0, Number(body.mv1GoodwillGbp) || 0);
      const buyerReadinessScore = Math.max(0, Math.min(100, Number(body.buyerReadinessScore) || 50));
      // Sharing needs consent to the current notice version, either given now or
      // recorded earlier, and a verified email (so the pool can't be flooded).
      const consentNow = body.consentVersion === POOL_CONSENT_VERSION;
      const priorConsent = user.poolConsentVersion === POOL_CONSENT_VERSION && Boolean(user.poolConsentAt);
      const isAnonymisedShared =
        body.isAnonymisedShared === true && (consentNow || priorConsent) && req.user!.email_verified === true;
      if (isAnonymisedShared && consentNow) {
        await recordPoolConsent(user.id, POOL_CONSENT_VERSION);
      }

      const report = await saveValuationReport({
        userId: user.id,
        userUid: uid,
        reportId: body.reportId ? Number(body.reportId) : undefined,
        practiceName,
        practiceType,
        region,
        postcodeOutward,
        surgeriesCount,
        turnoverGbp,
        fmopGbp,
        fmopMarginPercent,
        ypMultiple,
        mv1GoodwillGbp,
        buyerReadinessScore,
        isAnonymisedShared,
        shareConsentVersion: isAnonymisedShared ? POOL_CONSENT_VERSION : null,
        intakeJson: typeof body.intakeJson === 'object' && body.intakeJson !== null ? body.intakeJson : {},
        aiPointersJson: Array.isArray(body.aiPointersJson) ? body.aiPointersJson : undefined,
        valuationDriversJson: Array.isArray(body.valuationDriversJson)
          ? body.valuationDriversJson
          : undefined,
      });

      // Automatically ensure a monthly snapshot is recorded for the current month
      const snapshot = await createOrUpdateSnapshot({
        userId: user.id,
        userUid: uid,
        reportId: report.id,
        practiceLabel: practiceName,
        snapshotMonth: String(body.snapshotMonth || getCurrentMonthKey()),
        buyerReadinessScore,
        mv1GoodwillGbp,
        ypMultiple,
        fmopGbp,
        policyTriggerSummary: String(
          body.snapshotNote || 'Practice valuation dossier saved to account'
        ),
      });

      res.status(201).json({ report, snapshot });
    } catch (error) {
      console.error('POST /api/reports error:', error);
      res.status(500).json({ error: 'Unable to save practice valuation report.' });
    }
  });

  app.patch('/api/reports/:id/anonymise', requireAuth, async (req: AuthRequest, res) => {
    try {
      const reportId = Number(req.params.id);
      if (!Number.isInteger(reportId) || reportId <= 0) {
        return res.status(400).json({ error: 'Invalid report ID.' });
      }
      const isShared = Boolean(req.body?.isAnonymisedShared);
      if (isShared && req.body?.consentVersion !== POOL_CONSENT_VERSION) {
        return res.status(400).json({ error: 'Please read and accept the current pooling terms first.' });
      }
      if (isShared && req.user!.email_verified !== true) {
        return res.status(403).json({ error: 'Verify your email address before adding your figures to the pool.' });
      }
      const updated = await toggleReportAnonymisedSharing(
        req.user!.uid,
        reportId,
        isShared,
        isShared ? POOL_CONSENT_VERSION : undefined
      );
      if (updated && isShared) {
        const owner = await getOrCreateUser(req.user!.uid, req.user!.email || `${req.user!.uid}@valubuild.uk`, req.user!.name);
        await recordPoolConsent(owner.id, POOL_CONSENT_VERSION);
      }
      if (!updated) {
        return res.status(404).json({ error: 'Valuation report not found.' });
      }
      res.json({ report: updated });
    } catch (error) {
      console.error('PATCH /api/reports/:id/anonymise error:', error);
      res.status(500).json({ error: 'Unable to update anonymisation preference.' });
    }
  });

  // The old row-level /api/anonymised-reports endpoint was removed: it exposed
  // individual practices (postcode district, fees, AI notes). Pooled figures are
  // now served as suppressed aggregates by /api/pool/summary (src/server/marketRoutes.ts).
  registerMarketRoutes(app);
  registerBrokerDocRoutes(app);
  registerLeadRoutes(app);

  // =========================================================================
  // 3. PRACTICE VALUATION HISTORY SNAPSHOTS
  // =========================================================================
  app.get('/api/snapshots', requireAuth, async (req: AuthRequest, res) => {
    try {
      const snapshots = await listUserSnapshots(req.user!.uid);
      res.json({ snapshots });
    } catch (error) {
      console.error('GET /api/snapshots error:', error);
      res.status(500).json({ error: 'Unable to load practice valuation history.' });
    }
  });

  app.post('/api/snapshots', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      const user = await getOrCreateUser(uid, email, req.user!.name);

      const body = req.body || {};
      const snapshotMonth = String(body.snapshotMonth || getCurrentMonthKey());
      if (!/^\d{4}-\d{2}$/.test(snapshotMonth)) {
        return res.status(400).json({ error: 'Snapshot month must use YYYY-MM format.' });
      }

      const snapshot = await createOrUpdateSnapshot({
        userId: user.id,
        userUid: uid,
        reportId: body.reportId ? Number(body.reportId) : null,
        practiceLabel: String(body.practiceLabel || 'Primary Dental Practice'),
        snapshotMonth,
        buyerReadinessScore: Number(body.buyerReadinessScore) || 50,
        mv1GoodwillGbp: Number(body.mv1GoodwillGbp) || 0,
        ypMultiple: Number(body.ypMultiple) || 6.5,
        fmopGbp: Number(body.fmopGbp) || 0,
        policyTriggerSummary: String(body.policyTriggerSummary || 'Monthly valuation snapshot'),
      });

      res.status(201).json({ snapshot });
    } catch (error) {
      console.error('POST /api/snapshots error:', error);
      res.status(500).json({ error: 'Unable to save monthly valuation snapshot.' });
    }
  });

  // =========================================================================
  // 4. AI FINANCIAL DOCUMENT INGESTION & ADAPTIVE QUESTION DATASET
  // =========================================================================
  app.get('/api/documents', requireAuth, async (req: AuthRequest, res) => {
    try {
      const documents = await listUserDocuments(req.user!.uid);
      res.json({ documents });
    } catch (error) {
      console.error('GET /api/documents error:', error);
      res.status(500).json({ error: 'Unable to load uploaded documents.' });
    }
  });

  app.get('/api/questions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const questions = await listUserQuestions(req.user!.uid);
      res.json({ questions });
    } catch (error) {
      console.error('GET /api/questions error:', error);
      res.status(500).json({ error: 'Unable to load adaptive valuation questions.' });
    }
  });

  app.post('/api/ai/analyze-document', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      const user = await getOrCreateUser(uid, email, req.user!.name);

      const {
        docCategory = 'valuation_report',
        fileName = 'uploaded-document.txt',
        mimeType = 'text/plain',
        textContent,
        fileBase64,
        reportId,
        currentPracticeContext,
      } = req.body || {};

      const allowedCategories = [
        'valuation_report',
        'accounts_report',
        'bank_statement',
        'nhs_schedule',
        'expenses_list',
        'payroll',
      ];
      const safeCategory = allowedCategories.includes(docCategory) ? docCategory : 'valuation_report';

      if (!textContent && !fileBase64) {
        return res
          .status(400)
          .json({ error: 'Please upload a file or paste financial/valuation report text.' });
      }

      const ai = getGeminiClient();
      const prompt = `You are a RICS Red Book Chartered Dental Valuer and UK Healthcare M&A specialist.
Analyse the provided UK dental practice document (category: "${safeCategory}", file: "${String(fileName).slice(0, 120)}").
Current practice context (if provided): ${JSON.stringify(currentPracticeContext || {}).slice(0, 2500)}

Perform a forensic valuation diligence extraction:
1. Summarise key financial, cashflow, NHS Compass/UDA, payroll, or valuation findings in crisp UK dental M&A prose (GBP £).
2. Extract numerical metrics if present (turnoverGbp, fmopEbitdaGbp, nhsContractValueGbp, udaTarget, udaDelivered, clawbackRiskGbp, monthlyCashflowNetGbp, staffPayrollPaGbp, labMaterialsPercent, associateFeesPercent, adoptedYpMultiple, valuationGbp). Use null if not stated in the document.
3. Identify 3 to 5 specific valuation impact points explaining exactly what moves the practice's sale multiple or goodwill value up or down in GBP (£).
4. Provide 3 to 4 concrete, individualised pointers the principal should act on over the next 3-18 months to maximise exit value.
5. Automatically generate 3 to 4 sharp, adaptive due-diligence questions tailored to gaps or ambiguities uncovered in this document so the valuation becomes progressively more accurate as the principal answers them.
6. Estimate a realistic scoreDelta (-15 to +15) and ypDelta (-0.8 to +0.8) implied by this evidence relative to an average UK clinic.`;

      const contents: Array<Record<string, unknown>> = [];
      if (fileBase64 && typeof fileBase64 === 'string') {
        const safeMime =
          typeof mimeType === 'string' &&
          (mimeType === 'application/pdf' ||
            mimeType.startsWith('image/') ||
            mimeType.startsWith('text/'))
            ? mimeType
            : 'application/pdf';
        contents.push({
          inlineData: {
            mimeType: safeMime,
            data: fileBase64,
          },
        });
      }
      if (textContent && typeof textContent === 'string') {
        contents.push({ text: `DOCUMENT CONTENT:\n${textContent.slice(0, 60000)}` });
      }
      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: contents as never }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              extractedSummary: { type: Type.STRING },
              extractedMetrics: {
                type: Type.OBJECT,
                properties: {
                  turnoverGbp: { type: Type.NUMBER, nullable: true },
                  fmopEbitdaGbp: { type: Type.NUMBER, nullable: true },
                  nhsContractValueGbp: { type: Type.NUMBER, nullable: true },
                  udaTarget: { type: Type.NUMBER, nullable: true },
                  udaDelivered: { type: Type.NUMBER, nullable: true },
                  clawbackRiskGbp: { type: Type.NUMBER, nullable: true },
                  monthlyCashflowNetGbp: { type: Type.NUMBER, nullable: true },
                  staffPayrollPaGbp: { type: Type.NUMBER, nullable: true },
                  labMaterialsPercent: { type: Type.NUMBER, nullable: true },
                  associateFeesPercent: { type: Type.NUMBER, nullable: true },
                  adoptedYpMultiple: { type: Type.NUMBER, nullable: true },
                  valuationGbp: { type: Type.NUMBER, nullable: true },
                },
              },
              valuationImpactPoints: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    factor: { type: Type.STRING },
                    direction: { type: Type.STRING, enum: ['positive', 'negative', 'neutral'] },
                    estimatedPoundImpact: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                  },
                  required: ['factor', 'direction', 'estimatedPoundImpact', 'explanation'],
                },
              },
              individualisedPointers: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    detail: { type: Type.STRING },
                    category: { type: Type.STRING },
                    estimatedImpactGbp: { type: Type.STRING },
                    priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                  },
                  required: ['id', 'title', 'detail', 'category', 'estimatedImpactGbp', 'priority'],
                },
              },
              adaptiveQuestions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionText: { type: Type.STRING },
                    rationale: { type: Type.STRING },
                    category: { type: Type.STRING },
                    impactArea: { type: Type.STRING },
                  },
                  required: ['questionText', 'rationale', 'category', 'impactArea'],
                },
              },
              scoreDelta: { type: Type.NUMBER },
              ypDelta: { type: Type.NUMBER },
            },
            required: [
              'extractedSummary',
              'valuationImpactPoints',
              'individualisedPointers',
              'adaptiveQuestions',
              'scoreDelta',
              'ypDelta',
            ],
          },
        },
      });

      const rawText = response.text || '{}';
      const parsed = JSON.parse(rawText);

      const userReports = await listUserReports(uid);
      const targetReport =
        (reportId ? await getUserReportById(uid, Number(reportId)) : null) || userReports[0] || null;

      const savedDoc = await saveUploadedDocument({
        userId: user.id,
        userUid: uid,
        reportId: targetReport?.id ?? null,
        docCategory: safeCategory,
        fileName: String(fileName),
        mimeType: String(mimeType),
        extractedSummary: String(parsed.extractedSummary || 'Document analysed.'),
        extractedMetricsJson: parsed.extractedMetrics || {},
        valuationImpactPointsJson: Array.isArray(parsed.valuationImpactPoints)
          ? parsed.valuationImpactPoints
          : [],
      });

      const createdQuestions = await createAdaptiveQuestions(
        (Array.isArray(parsed.adaptiveQuestions) ? parsed.adaptiveQuestions : []).map(
          (q: { questionText: string; rationale: string; category: string; impactArea: string }) => ({
            userId: user.id,
            userUid: uid,
            reportId: targetReport?.id ?? null,
            documentId: savedDoc.id,
            questionText: q.questionText,
            rationale: q.rationale,
            category: q.category || safeCategory,
            impactArea: q.impactArea || 'EBITDA / YP Multiple',
          })
        )
      );

      let updatedReport = targetReport;
      if (targetReport) {
        const newPointers: AiPointer[] = [
          ...(Array.isArray(parsed.individualisedPointers) ? parsed.individualisedPointers : []),
          ...(targetReport.aiPointersJson || []),
        ].slice(0, 10);

        const newDrivers: ValuationDriver[] = [
          ...(Array.isArray(parsed.valuationImpactPoints)
            ? parsed.valuationImpactPoints.map(
                (p: { factor: string; direction: 'positive' | 'negative' | 'neutral'; estimatedPoundImpact: string }) => ({
                  factor: p.factor,
                  direction: p.direction,
                  impactSummary: p.estimatedPoundImpact,
                  sourceDoc: String(fileName),
                })
              )
            : []),
          ...(targetReport.valuationDriversJson || []),
        ].slice(0, 12);

        const boundedScoreDelta = Math.max(-10, Math.min(10, Number(parsed.scoreDelta) || 0));
        const boundedYpDelta = Math.max(-0.5, Math.min(0.5, Number(parsed.ypDelta) || 0));
        const nextScore = Math.max(20, Math.min(98, targetReport.buyerReadinessScore + boundedScoreDelta));
        const nextYp = Number(Math.max(4.0, Math.min(11.5, targetReport.ypMultiple + boundedYpDelta)).toFixed(2));
        const nextMv1 = Math.round((targetReport.fmopGbp * nextYp) / 10000) * 10000;

        updatedReport = await updateReportAiEnrichment(uid, targetReport.id, {
          aiPointersJson: newPointers,
          valuationDriversJson: newDrivers,
          buyerReadinessScore: nextScore,
          ypMultiple: nextYp,
          mv1GoodwillGbp: nextMv1,
        });
      }

      res.status(201).json({
        document: savedDoc,
        questions: createdQuestions,
        individualisedPointers: parsed.individualisedPointers || [],
        updatedReport,
      });
    } catch (error) {
      console.error('POST /api/ai/analyze-document error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? `Document intelligence failed: ${error.message}`
            : 'Unable to analyse document.',
      });
    }
  });

  app.post('/api/ai/answer-question', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      const user = await getOrCreateUser(uid, email, req.user!.name);

      const { questionId, answerText } = req.body || {};
      const qId = Number(questionId);
      if (!Number.isInteger(qId) || qId <= 0 || !answerText || !String(answerText).trim()) {
        return res.status(400).json({ error: 'Valid question ID and answer text are required.' });
      }

      const answered = await answerAdaptiveQuestion(uid, qId, String(answerText).trim());
      if (!answered) {
        return res.status(404).json({ error: 'Adaptive question not found.' });
      }

      const userReports = await listUserReports(uid);
      const targetReport =
        (answered.reportId ? await getUserReportById(uid, answered.reportId) : null) ||
        userReports[0] ||
        null;

      const ai = getGeminiClient();
      const prompt = `You are a UK Dental Practice Valuation Specialist refining an evolving RICS Red Book practice valuation.
Question asked: "${answered.questionText}"
Why it mattered: "${answered.rationale}"
Principal's answer: "${String(answerText).trim()}"
Current practice valuation summary: ${JSON.stringify(
        targetReport
          ? {
              practiceType: targetReport.practiceType,
              region: targetReport.region,
              surgeries: targetReport.surgeriesCount,
              fmopGbp: targetReport.fmopGbp,
              ypMultiple: targetReport.ypMultiple,
              mv1GoodwillGbp: targetReport.mv1GoodwillGbp,
              buyerReadinessScore: targetReport.buyerReadinessScore,
            }
          : { note: 'No saved report yet' }
      )}

Evaluate how this answer refines the valuation:
1. Provide a concise valuationRefinementNote explaining how buyers/lenders interpret this answer.
2. Estimate scoreDelta (-6 to +8) and ypDelta (-0.35 to +0.45).
3. Produce 1 high-value individualisedPointer tailored to this answer.
4. Generate 1 deeper follow-up adaptive question to further sharpen the practice's diligence dossier.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              valuationRefinementNote: { type: Type.STRING },
              scoreDelta: { type: Type.NUMBER },
              ypDelta: { type: Type.NUMBER },
              newPointer: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  detail: { type: Type.STRING },
                  category: { type: Type.STRING },
                  estimatedImpactGbp: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['High', 'Medium', 'Low'] },
                },
                required: ['id', 'title', 'detail', 'category', 'estimatedImpactGbp', 'priority'],
              },
              followUpQuestion: {
                type: Type.OBJECT,
                properties: {
                  questionText: { type: Type.STRING },
                  rationale: { type: Type.STRING },
                  category: { type: Type.STRING },
                  impactArea: { type: Type.STRING },
                },
                required: ['questionText', 'rationale', 'category', 'impactArea'],
              },
            },
            required: [
              'valuationRefinementNote',
              'scoreDelta',
              'ypDelta',
              'newPointer',
              'followUpQuestion',
            ],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');

      let followUp = null;
      if (parsed.followUpQuestion?.questionText) {
        const created = await createAdaptiveQuestions([
          {
            userId: user.id,
            userUid: uid,
            reportId: targetReport?.id ?? null,
            documentId: answered.documentId ?? null,
            questionText: parsed.followUpQuestion.questionText,
            rationale: parsed.followUpQuestion.rationale || 'Follow-up diligence refinement',
            category: parsed.followUpQuestion.category || answered.category,
            impactArea: parsed.followUpQuestion.impactArea || answered.impactArea,
          },
        ]);
        followUp = created[0] || null;
      }

      let updatedReport = targetReport;
      if (targetReport) {
        const scoreDelta = Math.max(-6, Math.min(8, Number(parsed.scoreDelta) || 0));
        const ypDelta = Math.max(-0.35, Math.min(0.45, Number(parsed.ypDelta) || 0));
        const nextScore = Math.max(20, Math.min(98, targetReport.buyerReadinessScore + scoreDelta));
        const nextYp = Number(Math.max(4.0, Math.min(11.5, targetReport.ypMultiple + ypDelta)).toFixed(2));
        const nextMv1 = Math.round((targetReport.fmopGbp * nextYp) / 10000) * 10000;

        const nextPointers: AiPointer[] = parsed.newPointer
          ? [parsed.newPointer, ...(targetReport.aiPointersJson || [])].slice(0, 10)
          : targetReport.aiPointersJson || [];

        updatedReport = await updateReportAiEnrichment(uid, targetReport.id, {
          buyerReadinessScore: nextScore,
          ypMultiple: nextYp,
          mv1GoodwillGbp: nextMv1,
          aiPointersJson: nextPointers,
        });

        await createOrUpdateSnapshot({
          userId: user.id,
          userUid: uid,
          reportId: targetReport.id,
          practiceLabel: targetReport.practiceName,
          snapshotMonth: getCurrentMonthKey(),
          buyerReadinessScore: nextScore,
          mv1GoodwillGbp: nextMv1,
          ypMultiple: nextYp,
          fmopGbp: targetReport.fmopGbp,
          policyTriggerSummary: `Adaptive diligence refined: ${String(
            parsed.valuationRefinementNote || 'Question answered'
          ).slice(0, 220)}`,
        });
      }

      res.json({
        answeredQuestion: answered,
        followUpQuestion: followUp,
        valuationRefinementNote: parsed.valuationRefinementNote,
        scoreDelta: parsed.scoreDelta,
        ypDelta: parsed.ypDelta,
        updatedReport,
      });
    } catch (error) {
      console.error('POST /api/ai/answer-question error:', error);
      res.status(500).json({ error: 'Unable to process adaptive question answer.' });
    }
  });

  // =========================================================================
  // 5. MONTHLY UK DENTAL MARKET NEWS & POLICY UPDATES (GOOGLE SEARCH GROUNDING)
  // =========================================================================
  app.get('/api/market-briefings', async (_req, res) => {
    try {
      const briefings = await listMonthlyBriefings();
      res.json({ briefings });
    } catch (error) {
      console.error('GET /api/market-briefings error:', error);
      res.status(500).json({ error: 'Unable to load monthly market briefings.' });
    }
  });

  app.post('/api/ai/monthly-market-update', requireAuth, async (req: AuthRequest, res) => {
    try {
      const ai = getGeminiClient();
      const monthKey = getCurrentMonthKey();

      // Step 1: Search-grounded live scan of UK dental market news, NHS policies, CQC, payroll/NI, and DSO multiples
      const searchResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Search for the latest UK dental practice market news, NHS GDS/UDA contract uplift or reform updates, UK National Minimum Wage & Employer National Insurance payroll cost impacts on dental practices, CQC inspection changes, and UK dental M&A / corporate DSO valuation multiple trends (Christie & Co, NASDAL, Frank Taylor & Associates, BDA) relevant to ${monthKey}.
Provide a factual, comprehensive UK market briefing with exact impacts on NHS, Private, Mixed, and Specialist dental clinic valuations.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const groundedText = searchResponse.text || '';
      const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Array<{ title: string; uri: string }> = [];
      const seenUris = new Set<string>();
      for (const chunk of chunks) {
        const safeUri = extractSafeHttpUrl(chunk.web?.uri);
        if (safeUri && !seenUris.has(safeUri)) {
          seenUris.add(safeUri);
          sources.push({
            title: String(chunk.web?.title || 'UK Dental Market Source').slice(0, 140),
            uri: safeUri,
          });
        }
      }

      // Step 2: Structure the grounded briefing into actionable valuation deltas
      const structuredResponse = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Convert the following grounded UK dental market research into a structured monthly policy & valuation update JSON for ${monthKey}:
---
${groundedText.slice(0, 18000)}
---
Return:
- headline: crisp headline for ${monthKey}
- summary: 2-3 sentence executive summary of how UK dental multiples & operating margins moved
- policyChanges: 3 to 5 items with title, category (NHS Policy | Payroll & Tax | Corporate M&A | CQC & Regulatory), impactOnMultiples (e.g. "-0.15x YP on NHS-heavy clinics" or "+0.20x YP on Private Plan clinics"), and affectedPracticeTypes array
- multipleAdjustments: numeric YP multiple adjustments between -0.35 and +0.35 for keys: "NHS Practice", "Private Practice", "Mixed Practice", "Specialist Practice"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              headline: { type: Type.STRING },
              summary: { type: Type.STRING },
              policyChanges: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    category: { type: Type.STRING },
                    impactOnMultiples: { type: Type.STRING },
                    affectedPracticeTypes: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                  required: ['title', 'category', 'impactOnMultiples', 'affectedPracticeTypes'],
                },
              },
              multipleAdjustments: {
                type: Type.OBJECT,
                properties: {
                  'NHS Practice': { type: Type.NUMBER },
                  'Private Practice': { type: Type.NUMBER },
                  'Mixed Practice': { type: Type.NUMBER },
                  'Specialist Practice': { type: Type.NUMBER },
                },
              },
            },
            required: ['headline', 'summary', 'policyChanges', 'multipleAdjustments'],
          },
        },
      });

      const parsed = JSON.parse(structuredResponse.text || '{}');

      const briefing = await upsertMonthlyBriefing({
        monthKey,
        headline: String(parsed.headline || `UK Dental Valuation Market Briefing (${monthKey})`),
        summary: String(parsed.summary || groundedText.slice(0, 500)),
        policyChangesJson: Array.isArray(parsed.policyChanges) ? parsed.policyChanges : [],
        multipleAdjustmentsJson: parsed.multipleAdjustments || {},
        sourcesJson: sources.slice(0, 10),
      });

      // If user is authenticated, apply monthly policy delta to their active report & record monthly snapshot
      let updatedReport = null;
      let recordedSnapshot = null;
      if (req.user?.uid) {
        const uid = req.user.uid;
        const email = req.user.email || `${uid}@valubuild.uk`;
        const user = await getOrCreateUser(uid, email, req.user.name);
        const reports = await listUserReports(uid);
        const active = reports[0];
        if (active) {
          const rawAdj = Number(parsed.multipleAdjustments?.[active.practiceType] ?? 0);
          const boundedAdj = Math.max(-0.35, Math.min(0.35, rawAdj));
          const nextYp = Number(Math.max(4.0, Math.min(11.5, active.ypMultiple + boundedAdj)).toFixed(2));
          const nextMv1 = Math.round((active.fmopGbp * nextYp) / 10000) * 10000;
          const impactDeltaGbp = nextMv1 - active.mv1GoodwillGbp;
          const scoreDelta = boundedAdj > 0.05 ? 2 : boundedAdj < -0.05 ? -2 : 0;
          const nextScore = Math.max(20, Math.min(98, active.buyerReadinessScore + scoreDelta));

          const existingNotes = (active.monthlyPolicyNotesJson || []).filter(
            (n) => n.monthKey !== monthKey
          );
          const nextNotes = [
            {
              monthKey,
              headline: briefing.headline,
              impactDeltaGbp,
              scoreDelta,
              summary: briefing.summary,
            },
            ...existingNotes,
          ].slice(0, 12);

          updatedReport = await updateReportAiEnrichment(uid, active.id, {
            ypMultiple: nextYp,
            mv1GoodwillGbp: nextMv1,
            buyerReadinessScore: nextScore,
            monthlyPolicyNotesJson: nextNotes,
          });

          recordedSnapshot = await createOrUpdateSnapshot({
            userId: user.id,
            userUid: uid,
            reportId: active.id,
            practiceLabel: active.practiceName,
            snapshotMonth: monthKey,
            buyerReadinessScore: nextScore,
            mv1GoodwillGbp: nextMv1,
            ypMultiple: nextYp,
            fmopGbp: active.fmopGbp,
            policyTriggerSummary: `Monthly UK Market Update: ${briefing.headline}`,
          });
        }
      }

      res.json({ briefing, updatedReport, recordedSnapshot });
    } catch (error) {
      console.error('POST /api/ai/monthly-market-update error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? `Monthly market intelligence failed: ${error.message}`
            : 'Unable to run monthly UK market update.',
      });
    }
  });

  // =========================================================================
  // 6. MONTHLY AUTO-UPDATED REPORT EMAIL DIGEST
  // =========================================================================
  app.get('/api/email/digests', requireAuth, async (req: AuthRequest, res) => {
    try {
      const digests = await listUserEmailDigests(req.user!.uid);
      res.json({ digests });
    } catch (error) {
      console.error('GET /api/email/digests error:', error);
      res.status(500).json({ error: 'Unable to load monthly email digests.' });
    }
  });

  app.post('/api/email/send-monthly-digest', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || `${uid}@valubuild.uk`;
      const user = await getOrCreateUser(uid, email, req.user!.name);

      const [reports, snapshots, briefings] = await Promise.all([
        listUserReports(uid),
        listUserSnapshots(uid),
        listMonthlyBriefings(),
      ]);

      const activeReport = reports[0];
      const latestBriefing = briefings[0];
      const monthKey = getCurrentMonthKey();

      const practiceTitle = activeReport?.practiceName || 'Your UK Dental Practice';
      const mv1Label = activeReport ? formatGbpSimple(activeReport.mv1GoodwillGbp) : 'Pending Intake';
      const scoreLabel = activeReport ? `${activeReport.buyerReadinessScore}/100` : 'N/A';
      const ypLabel = activeReport ? `${activeReport.ypMultiple} YP` : 'N/A';
      const pointers = (activeReport?.aiPointersJson || []).slice(0, 3);
      const recentSnapshots = snapshots.slice(-4);

      const subject = `Valubuild Monthly Valuation Update (${monthKey}): ${practiceTitle} — ${mv1Label} (${scoreLabel})`;

      const pointersHtml =
        pointers.length > 0
          ? pointers
              .map(
                (p) =>
                  `<li style="margin-bottom:10px;"><strong>${escapeHtml(p.title)}</strong> (${escapeHtml(
                    p.estimatedImpactGbp
                  )})<br/><span style="color:#5c554c;">${escapeHtml(p.detail)}</span></li>`
              )
              .join('')
          : `<li>Upload accounts, bank statements, NHS schedules, or payrolls in Valubuild to unlock tailored pointers.</li>`;

      const historyHtml =
        recentSnapshots.length > 0
          ? recentSnapshots
              .map(
                (s) =>
                  `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5dfd5;">${escapeHtml(
                    s.snapshotMonth
                  )}</td><td style="padding:6px 10px;border-bottom:1px solid #e5dfd5;"><strong>${
                    s.buyerReadinessScore
                  }/100</strong></td><td style="padding:6px 10px;border-bottom:1px solid #e5dfd5;">${escapeHtml(
                    formatGbpSimple(s.mv1GoodwillGbp)
                  )} (${s.ypMultiple} YP)</td></tr>`
              )
              .join('')
          : `<tr><td colspan="3" style="padding:8px;">Save your first monthly snapshot to start tracking your score trend.</td></tr>`;

      const briefingHtml = latestBriefing
        ? `<p style="margin:0 0 8px 0;"><strong>${escapeHtml(latestBriefing.headline)}</strong></p><p style="margin:0;color:#4a443c;">${escapeHtml(
            latestBriefing.summary
          )}</p>`
        : `<p style="margin:0;color:#4a443c;">Run the live UK Dental Market Policy Scanner in Valubuild to incorporate the latest NHS UDA, payroll, and corporate M&A shifts.</p>`;

      const htmlBody = `<!doctype html>
<html>
<body style="font-family:Georgia,serif;background:#FAF8F4;color:#26231E;padding:24px;margin:0;">
  <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E2DBD0;border-radius:6px;padding:28px;">
    <div style="border-bottom:2px solid #A6521C;padding-bottom:14px;margin-bottom:20px;">
      <div style="font-size:11px;font-family:sans-serif;text-transform:uppercase;letter-spacing:1px;color:#A6521C;font-weight:bold;">Valubuild UK Dental Exit Intelligence · Monthly Auto-Updated Report (${escapeHtml(
        monthKey
      )})</div>
      <h1 style="margin:6px 0 0 0;font-size:22px;color:#26231E;">${escapeHtml(practiceTitle)}</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-family:sans-serif;">
      <tr>
        <td style="background:#FAF5EE;border:1px solid #D6BC9E;padding:12px;width:33%;">
          <div style="font-size:11px;color:#6B6459;text-transform:uppercase;">MV1 Goodwill</div>
          <div style="font-size:20px;font-weight:bold;color:#A6521C;">${escapeHtml(mv1Label)}</div>
        </td>
        <td style="background:#FAF8F4;border:1px solid #E2DBD0;padding:12px;width:33%;">
          <div style="font-size:11px;color:#6B6459;text-transform:uppercase;">Readiness Score</div>
          <div style="font-size:20px;font-weight:bold;color:#26231E;">${escapeHtml(scoreLabel)}</div>
        </td>
        <td style="background:#FAF8F4;border:1px solid #E2DBD0;padding:12px;width:33%;">
          <div style="font-size:11px;color:#6B6459;text-transform:uppercase;">Adopted Multiple</div>
          <div style="font-size:20px;font-weight:bold;color:#26231E;">${escapeHtml(ypLabel)}</div>
        </td>
      </tr>
    </table>
    <h2 style="font-size:15px;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.5px;color:#26231E;margin:18px 0 8px 0;">Monthly UK Dental Policy &amp; Market Pulse</h2>
    <div style="background:#FAF8F4;border:1px solid #E2DBD0;padding:14px;font-family:sans-serif;font-size:13px;line-height:1.5;">
      ${briefingHtml}
    </div>
    <h2 style="font-size:15px;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.5px;color:#26231E;margin:18px 0 8px 0;">Individualised Valuation Pointers</h2>
    <ul style="font-family:sans-serif;font-size:13px;line-height:1.55;padding-left:18px;margin:0;">
      ${pointersHtml}
    </ul>
    <h2 style="font-size:15px;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.5px;color:#26231E;margin:18px 0 8px 0;">Practice Valuation History</h2>
    <table style="width:100%;border-collapse:collapse;font-family:sans-serif;font-size:13px;">
      <thead><tr style="background:#FAF8F4;text-align:left;"><th style="padding:6px 10px;">Month</th><th style="padding:6px 10px;">Score</th><th style="padding:6px 10px;">MV1 &amp; Multiple</th></tr></thead>
      <tbody>${historyHtml}</tbody>
    </table>
    <p style="font-family:sans-serif;font-size:11px;color:#6B6459;margin-top:24px;border-top:1px solid #E2DBD0;padding-top:12px;">
      Prepared for ${escapeHtml(user.displayName)} (${escapeHtml(
        user.email
      )}). Manage monthly digest preferences anytime in your Valubuild account.
    </p>
  </div>
</body>
</html>`;

      let deliveryStatus: 'sent_smtp' | 'generated_preview' = 'generated_preview';
      let deliveryMessage =
        'Monthly report generated and archived. Configure SMTP_HOST/SMTP_USER/SMTP_PASS environment variables for live outbound SMTP dispatch.';

      if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Number(process.env.SMTP_PORT || 587) === 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to: user.email,
          subject,
          html: htmlBody,
        });
        deliveryStatus = 'sent_smtp';
        deliveryMessage = `Monthly updated valuation email dispatched to ${user.email}.`;
      }

      const digest = await logEmailDigest({
        userId: user.id,
        userUid: uid,
        recipientEmail: user.email,
        monthKey,
        subject,
        htmlBody,
        deliveryStatus,
      });

      res.status(201).json({ digest, deliveryStatus, deliveryMessage });
    } catch (error) {
      console.error('POST /api/email/send-monthly-digest error:', error);
      res.status(500).json({ error: 'Unable to generate or send monthly valuation digest.' });
    }
  });

  // =========================================================================
  // 7. GOOGLE MAPS GROUNDING — LOCAL CATCHMENT & COMPETITOR ANALYSIS
  // =========================================================================
  app.post('/api/ai/catchment-intelligence', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { region, locationQuery, latitude, longitude } = req.body || {};
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Valid latitude and longitude coordinates are required.' });
      }

      const cleanLocation = String(locationQuery || region || 'United Kingdom').slice(0, 120);
      const ai = getGeminiClient();

      // NOTE: Per Gemini API rules, NEVER set responseMimeType/responseSchema or combine googleSearch when using googleMaps!
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Analyse the local dental clinic catchment and competitive landscape near ${cleanLocation} (UK).
Identify nearby dental practices, NHS vs private positioning signals, patient review themes, and local demographic demand factors that a corporate dental buyer or RICS Red Book valuer would consider when pricing a dental clinic in this area. Format clearly in Markdown.`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: { latitude: lat, longitude: lng },
            },
          },
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const places: Array<{
        title: string;
        uri: string;
        placeId?: string;
        reviewSnippets: Array<{ text?: string; uri?: string }>;
      }> = [];
      const seen = new Set<string>();

      for (const chunk of chunks) {
        const mapsChunk = chunk.maps;
        const safeUri = extractSafeHttpUrl(mapsChunk?.uri);
        if (mapsChunk && safeUri && !seen.has(safeUri)) {
          seen.add(safeUri);
          const rawSnippets = mapsChunk.placeAnswerSources?.reviewSnippets || [];
          places.push({
            title: String(mapsChunk.title || 'Dental Clinic').slice(0, 140),
            uri: safeUri,
            placeId: mapsChunk.placeId,
            reviewSnippets: rawSnippets.slice(0, 2).map((s) => {
              const snippetObj = s as Record<string, unknown>;
              const snippetText = snippetObj.content || snippetObj.title;
              const snippetUri = snippetObj.googleMapsUri || snippetObj.uri;
              return {
                text: typeof snippetText === 'string' ? snippetText.slice(0, 220) : undefined,
                uri: extractSafeHttpUrl(snippetUri) || undefined,
              };
            }),
          });
        }
      }

      res.json({
        analysisMarkdown: response.text || '',
        places,
      });
    } catch (error) {
      console.error('POST /api/ai/catchment-intelligence error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? `Local catchment analysis failed: ${error.message}`
            : 'Unable to run local catchment intelligence.',
      });
    }
  });

  // =========================================================================
  // 8. LIVE API VOICE ADVISOR (WEBSOCKET BRIDGE TO gemini-3.8-live)
  // =========================================================================
  const wss = new WebSocketServer({ server, path: '/api/live-voice' });

  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<ReturnType<typeof getGeminiClient>['live']['connect']>> | null =
      null;
    let isClosing = false;

    const closeAll = () => {
      if (isClosing) return;
      isClosing = true;
      try {
        liveSession?.close();
      } catch {
        // Ignore close error
      }
      liveSession = null;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.close();
      }
    };

    clientWs.on('message', async (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());

        if (msg.type === 'start') {
          if (liveSession) return;

          // Require a signed-in user so the Gemini key can't be used anonymously
          let userLabel = 'Dental Practice Principal';
          try {
            if (typeof msg.idToken !== 'string' || msg.idToken.length === 0) {
              throw new Error('missing token');
            }
            const decoded = await adminAuth.verifyIdToken(msg.idToken);
            userLabel = decoded.name || decoded.email || userLabel;
          } catch {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(
                JSON.stringify({
                  type: 'error',
                  message: 'Sign in with Google to use the live voice advisor.',
                })
              );
            }
            closeAll();
            return;
          }

          const practiceContext =
            typeof msg.practiceContext === 'string' ? msg.practiceContext.slice(0, 2000) : '';

          const ai = getGeminiClient();
          // CRITICAL: Do NOT pass thinkingConfig to gemini-3.8-live
          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Kore' },
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              systemInstruction: {
                parts: [
                  {
                    text: `You are a senior UK Dental Practice Exit & RICS Red Book Valuation Advisor speaking live with ${userLabel}.
Always use GBP (£) and UK dental market terminology (NHS GDS/UDA contracts, Denplan/Practice Plan capitation, FMOP/EBITDA, Years Purchase YP multiples, CQC, BDA associate covenants, Christie & Co / NASDAL benchmarks).
Keep answers concise, practical, and tailored to exit readiness.
Current practice context: ${practiceContext}`,
                  },
                ],
              },
            },
            callbacks: {
              onopen: () => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'ready' }));
                }
              },
              onmessage: (serverMsg) => {
                if (clientWs.readyState !== WebSocket.OPEN) return;
                const sc = serverMsg.serverContent;
                if (!sc) return;

                if (sc.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }
                if (sc.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ type: 'input_transcript', text: sc.inputTranscription.text })
                  );
                }
                if (sc.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ type: 'output_transcript', text: sc.outputTranscription.text })
                  );
                }
                if (sc.modelTurn?.parts) {
                  for (const part of sc.modelTurn.parts) {
                    if (part.inlineData?.data) {
                      clientWs.send(
                        JSON.stringify({
                          type: 'audio',
                          data: part.inlineData.data,
                          mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
                        })
                      );
                    }
                  }
                }
                if (sc.turnComplete) {
                  clientWs.send(JSON.stringify({ type: 'turn_complete' }));
                }
              },
              onerror: (err) => {
                console.error('Live API session error:', err);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      type: 'error',
                      message: 'Voice advisor connection encountered an error.',
                    })
                  );
                }
              },
              onclose: () => {
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'closed' }));
                }
                liveSession = null;
              },
            },
          });
          return;
        }

        if (msg.type === 'audio' && liveSession && typeof msg.data === 'string') {
          liveSession.sendRealtimeInput({
            audio: {
              data: msg.data,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
          return;
        }

        if (msg.type === 'text' && liveSession && typeof msg.text === 'string') {
          liveSession.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text.slice(0, 1000) }] }],
            turnComplete: true,
          });
          return;
        }

        if (msg.type === 'stop') {
          closeAll();
        }
      } catch (error) {
        console.error('Live Voice WebSocket message error:', error);
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: 'error',
              message:
                error instanceof Error ? error.message : 'Unable to start voice advisor session.',
            })
          );
        }
      }
    });

    clientWs.on('close', closeAll);
    clientWs.on('error', closeAll);
  });

  // =========================================================================
  // VITE MIDDLEWARE (DEV) OR STATIC DIST (PROD)
  // =========================================================================
  // Unknown API paths get a JSON 404 instead of falling through to the web app.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Valubuild UK Dental Valuation Server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
