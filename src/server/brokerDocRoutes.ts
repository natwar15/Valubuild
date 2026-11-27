/**
 * Broker document pack: read the four documents a broker asks for and return
 * the figures, for the owner to review before they go into the valuation.
 *
 * Signed in only:
 *   POST   /api/broker-docs/extract     read one document, return figures
 *   GET    /api/broker-docs/kept        list documents the owner chose to keep
 *   DELETE /api/broker-docs/kept/:id    delete a kept document
 *
 * Privacy: the file is held in memory for the request, sent to Gemini to read,
 * and discarded. Nothing is stored unless the owner ticks "keep a copy", and
 * then only in their private kept_documents rows. Extracted figures are
 * returned to the browser, not saved here; they reach the database only if
 * the owner saves their report. Raw documents are never pooled.
 */
import type { Express } from 'express';
import { Type } from '@google/genai';
import { requireAuth, AuthRequest } from '../middleware/auth.ts';
import { getGeminiClient } from '../lib/gemini.ts';
import { getOrCreateUser } from '../db/queries.ts';
import { deleteKeptDocument, keepDocument, listKeptDocuments } from '../db/keptDocumentQueries.ts';
import { BrokerDocType, isBrokerDocType, sanitiseExtraction } from '../shared/brokerDocuments.ts';

const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_CHARS = 80_000;

const NUM = { type: Type.NUMBER, nullable: true };
const STR = { type: Type.STRING, nullable: true };

const SCHEMAS: Record<BrokerDocType, Record<string, unknown>> = {
  accounts: {
    type: Type.OBJECT,
    properties: {
      periodEnd: STR,
      periodMonths: NUM,
      businessStructure: { type: Type.STRING, nullable: true, enum: ['limited_company', 'sole_trader', 'partnership'] },
      turnover: NUM,
      nhsIncome: NUM,
      privateIncome: NUM,
      planIncome: NUM,
      materialsCost: NUM,
      labCost: NUM,
      clinicalFees: NUM,
      staffWages: NUM,
      ownerRemuneration: NUM,
      rent: NUM,
      depreciation: NUM,
      amortisation: NUM,
      interest: NUM,
      oneOffCosts: NUM,
      profitBeforeTax: NUM,
    },
  },
  nhs_schedule: {
    type: Type.OBJECT,
    properties: {
      financialYear: STR,
      contractedUdas: NUM,
      contractedUoas: NUM,
      annualContractValue: NUM,
      monthlyContractPayment: NUM,
      udasDeliveredYtd: NUM,
      monthsElapsed: NUM,
      clawback: NUM,
    },
  },
  clinician_income: {
    type: Type.OBJECT,
    properties: {
      periodStart: STR,
      periodEnd: STR,
      clinicians: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            role: { type: Type.STRING, enum: ['Principal', 'Associate', 'Hygienist', 'Therapist'] },
            hoursPerWeek: NUM,
            privateIncome: NUM,
            planIncome: NUM,
            nhsUdas: NUM,
          },
          required: ['role'],
        },
      },
    },
    required: ['clinicians'],
  },
  plan_schedule: {
    type: Type.OBJECT,
    properties: {
      provider: STR,
      periodEnd: STR,
      patientCount: NUM,
      averageMonthlyFee: NUM,
      monthlyIncome: NUM,
      annualIncome: NUM,
    },
  },
};

const INSTRUCTIONS: Record<BrokerDocType, string> = {
  accounts: `This is a UK dental practice's year-end accounts (limited company, sole trader or partnership).
Read the profit and loss account and its notes. All amounts in GBP for the whole accounting period.
- turnover: total fees / turnover. nhsIncome, privateIncome, planIncome: only if the accounts split income that way.
- materialsCost: dental materials / consumables. labCost: laboratory fees.
- clinicalFees: associates', hygienists' and therapists' fees (self-employed clinicians).
- staffWages: non-clinical and nursing wages incl. employer NI and pension, EXCLUDING directors' remuneration.
- ownerRemuneration: directors' (or partners') salaries, NI and pension contributions for the owners. For a sole trader or partnership drawings are not an expense, so use null.
- rent: rent payable for the premises. depreciation, amortisation (of goodwill), interest (interest payable).
- oneOffCosts: only costs the accounts or notes clearly describe as one-off or exceptional.
- profitBeforeTax: profit before taxation (company) or net profit (sole trader / partnership).
- periodEnd as YYYY-MM-DD; periodMonths: length of the accounting period in months.`,
  nhs_schedule: `This is a UK NHS dental contract schedule or statement (e.g. NHSBSA Compass schedule of payments, contract statement or annual reconciliation).
- contractedUdas / contractedUoas: annual contracted units. annualContractValue: annual contract value in GBP.
- monthlyContractPayment: the usual monthly contract payment, if the annual value is not shown.
- udasDeliveredYtd: UDAs delivered so far this financial year; monthsElapsed: months of the financial year covered (1-12).
- clawback: any under-delivery recovery / clawback amount shown, in GBP.
- financialYear like "2025/26".`,
  clinician_income: `This is a report from a UK dental practice's software showing income per clinician (e.g. a production or fees report), ideally for the last 12 months.
Return one entry per clinician:
- role: Principal (practice owner), Associate (other dentists), Hygienist or Therapist. If the owner is not marked, assume the clinician listed as owner/principal, or else return the role as Associate.
- privateIncome: private fee-per-item income for the period, GBP. planIncome: plan / capitation income attributed to them, if shown.
- nhsUdas: NHS UDAs delivered in the period, if shown. hoursPerWeek: if hours or sessions are shown (one session = 4 hours).
- periodStart / periodEnd as YYYY-MM-DD.
Do not return names: the role is enough.`,
  plan_schedule: `This is a statement from a UK dental plan provider (Denplan, Practice Plan, Patient Plan, etc.) or an in-house plan report.
- provider: the plan provider's company name only ("Denplan", "Practice Plan"); for an in-house plan return "In-house".
- patientCount: patients currently registered on the plan.
- averageMonthlyFee: average monthly fee per patient, GBP.
- monthlyIncome: gross monthly plan income before the provider's fees, GBP. annualIncome: if a 12-month total is shown.
- periodEnd as YYYY-MM-DD.`,
};

const PRIVACY_RULES = `Rules:
- Return only the requested figures. Use null for anything not clearly stated. Do not guess or calculate figures that are not in the document.
- Never return any person's name, patient details, addresses, contract or performer numbers, or the practice's name.
- Amounts are plain numbers in GBP (no £ signs or commas). Negative numbers only for losses.`;

function safeMime(mimeType: unknown): string {
  if (typeof mimeType !== 'string') return 'application/pdf';
  if (mimeType === 'application/pdf' || mimeType.startsWith('image/') || mimeType.startsWith('text/')) return mimeType;
  return 'application/pdf';
}

export function registerBrokerDocRoutes(app: Express) {
  app.post('/api/broker-docs/extract', requireAuth, async (req: AuthRequest, res) => {
    const { docType, fileName, mimeType, textContent, fileBase64, keepCopy } = req.body || {};
    if (!isBrokerDocType(docType)) return res.status(400).json({ error: 'Unknown document type.' });
    if (!textContent && !fileBase64) return res.status(400).json({ error: 'Upload a file or paste the document text.' });
    if (fileBase64 && (typeof fileBase64 !== 'string' || (fileBase64.length * 3) / 4 > MAX_FILE_BYTES)) {
      return res.status(413).json({ error: 'File must be under 6 MB.' });
    }
    if (textContent && typeof textContent !== 'string') return res.status(400).json({ error: 'Invalid text.' });

    try {
      const parts: Array<Record<string, unknown>> = [];
      if (fileBase64) parts.push({ inlineData: { mimeType: safeMime(mimeType), data: fileBase64 } });
      if (textContent) parts.push({ text: `DOCUMENT CONTENT:\n${String(textContent).slice(0, MAX_TEXT_CHARS)}` });
      parts.push({ text: `${INSTRUCTIONS[docType]}\n\n${PRIVACY_RULES}` });

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: parts as never }],
        config: { responseMimeType: 'application/json', responseSchema: SCHEMAS[docType] as never, temperature: 0 },
      });
      const extraction = sanitiseExtraction(docType, JSON.parse(response.text || '{}'));

      let kept: { id: number } | null = null;
      if (keepCopy === true) {
        const uid = req.user!.uid;
        const user = await getOrCreateUser(uid, req.user!.email || `${uid}@valubuild.uk`, req.user!.name);
        const content = fileBase64 || Buffer.from(String(textContent), 'utf8').toString('base64');
        kept = await keepDocument({
          userId: user.id,
          userUid: uid,
          docType,
          fileName: String(fileName || `${docType}`),
          mimeType: fileBase64 ? safeMime(mimeType) : 'text/plain',
          contentBase64: content,
        });
      }

      res.json({ extraction, kept: kept ? { id: kept.id } : null });
    } catch (error) {
      // Never log the request body: it is the owner's document.
      console.error('POST /api/broker-docs/extract error:', error instanceof Error ? error.message : 'unknown');
      res.status(500).json({ error: 'We could not read that document. Try a clearer PDF or CSV, or enter the figures yourself.' });
    }
  });

  app.get('/api/broker-docs/kept', requireAuth, async (req: AuthRequest, res) => {
    try {
      res.json({ documents: await listKeptDocuments(req.user!.uid) });
    } catch {
      res.status(500).json({ error: 'Unable to load kept documents.' });
    }
  });

  app.delete('/api/broker-docs/kept/:id', requireAuth, async (req: AuthRequest, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id.' });
    try {
      const ok = await deleteKeptDocument(req.user!.uid, id);
      if (!ok) return res.status(404).json({ error: 'Not found.' });
      res.json({ deleted: true });
    } catch {
      res.status(500).json({ error: 'Unable to delete.' });
    }
  });
}
