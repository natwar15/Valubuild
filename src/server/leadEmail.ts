import type { Express, Request, Response } from 'express';
import nodemailer from 'nodemailer';

/**
 * Sends the 12-point buyer-readiness checklist promised on the founding-owner
 * sign-up form. The lead itself is still written to Firestore by the browser;
 * this endpoint only sends the email.
 *
 * Needs SMTP_HOST, SMTP_USER and SMTP_PASS (and ideally SMTP_FROM). Without
 * them it answers { sent: false } and the form tells the visitor we'll email
 * them later instead of promising an email now.
 */

export const READINESS_CHECKLIST: { title: string; detail: string }[] = [
  {
    title: 'You are under 15 hours a week in the chair',
    detail: 'Buyers discount or tie you into a long earn-out when the principal produces a large share of fees.',
  },
  {
    title: 'Every associate is on a written BDA contract with restrictive covenants',
    detail: 'Unsigned or verbal arrangements are the most common diligence finding and put patient goodwill at risk.',
  },
  {
    title: 'At least a third of private income comes from monthly plans',
    detail: 'Direct-debit plan income (Denplan, Practice Plan and similar) is valued above pay-as-you-go fees.',
  },
  {
    title: 'NHS contract delivered in full for the last three years, with no clawback',
    detail: 'Have UDA delivery reports and any year-end reconciliation letters ready to show.',
  },
  {
    title: 'Three years of accounts, with owner add-backs listed and evidenced',
    detail: 'Personal costs, one-off items and the principal’s own drawings should be clearly separated.',
  },
  {
    title: 'Associate and therapist costs are known as a percentage of fees',
    detail: 'Buyers rebuild your profit with a market-rate associate in your place, so know your real costs.',
  },
  {
    title: 'CQC rated Good or Outstanding, with no open actions',
    detail: 'Keep the latest inspection report, action plan and registered manager details to hand.',
  },
  {
    title: 'Compliance files are complete',
    detail: 'Radiation protection, decontamination (HTM 01-05), fire, legionella, gas and electrical certificates, all in date.',
  },
  {
    title: 'A lease with at least 15 years left, or a freehold with a recent valuation',
    detail: 'Short leases and rent reviews due during the sale slow lenders and lower offers.',
  },
  {
    title: 'Surgeries are well used and equipment is maintained',
    detail: 'Have chair utilisation figures and a dated equipment list with service records.',
  },
  {
    title: 'The team is stable and employment paperwork is in order',
    detail: 'Contracts, right-to-work checks and GDC registrations on file, with low recent turnover.',
  },
  {
    title: 'The practice runs without you for a fortnight',
    detail: 'A practice manager, written procedures and shared diaries show a buyer the income will stay after you go.',
  },
];

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function checklistEmail(): { subject: string; html: string; text: string } {
  const subject = 'Your 12-point buyer-readiness checklist from Valubuild';
  const items = READINESS_CHECKLIST.map(
    (c) =>
      `<li style="margin-bottom:12px;"><strong>${escapeHtml(c.title)}</strong><br/><span style="color:#5c554c;">${escapeHtml(
        c.detail,
      )}</span></li>`,
  ).join('');
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#F7F4EE;">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E2DBD0;border-radius:6px;padding:28px;font-family:Georgia,serif;color:#26231E;">
  <h1 style="font-size:22px;margin:0 0 12px 0;">Your buyer-readiness checklist</h1>
  <p style="font-family:sans-serif;font-size:14px;line-height:1.6;">Thanks for joining Valubuild. These are the twelve things a corporate buyer's diligence team checks first. Tick off the ones you already have: each gap is a reason for a lower offer or a longer earn-out.</p>
  <ol style="font-family:sans-serif;font-size:14px;line-height:1.5;padding-left:20px;">${items}</ol>
  <p style="font-family:sans-serif;font-size:14px;line-height:1.6;">When you're ready, get a quick valuation range on the site, then save it under a nickname to track it over time.</p>
  <p style="font-family:sans-serif;font-size:11px;color:#6B6459;margin-top:24px;border-top:1px solid #E2DBD0;padding-top:12px;">You're receiving this because you signed up at Valubuild. Reply to this email to unsubscribe or to ask us to delete your email address.</p>
</div></body></html>`;
  const text = [
    'Your buyer-readiness checklist',
    '',
    "These are the twelve things a corporate buyer's diligence team checks first.",
    '',
    ...READINESS_CHECKLIST.map((c, i) => `${i + 1}. ${c.title}\n   ${c.detail}`),
    '',
    'Reply to this email to unsubscribe or to ask us to delete your email address.',
  ].join('\n');
  return { subject, html, text };
}

// Abuse limits: this endpoint is public and sends mail to any address, so cap
// it per IP and send at most one checklist per address per day.
const ipHits = new Map<string, { count: number; resetAt: number }>();
const recentlySent = new Map<string, number>();
const IP_MAX = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;
const PER_ADDRESS_MS = 24 * 60 * 60 * 1000;

function prune(now: number) {
  if (ipHits.size > 5000) for (const [k, v] of ipHits) if (v.resetAt < now) ipHits.delete(k);
  if (recentlySent.size > 5000) for (const [k, t] of recentlySent) if (now - t > PER_ADDRESS_MS) recentlySent.delete(k);
}

export function registerLeadRoutes(app: Express) {
  app.post('/api/leads/checklist', async (req: Request, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (!smtpConfigured()) {
      console.warn('Checklist email not sent: SMTP_HOST/SMTP_USER/SMTP_PASS are not set.');
      return res.json({ sent: false, reason: 'email_not_configured' });
    }

    const now = Date.now();
    prune(now);
    const key = req.ip || 'unknown';
    const h = ipHits.get(key);
    if (!h || h.resetAt < now) ipHits.set(key, { count: 1, resetAt: now + IP_WINDOW_MS });
    else if (++h.count > IP_MAX) return res.status(429).json({ error: 'Too many requests, please try later.' });

    const last = recentlySent.get(email);
    if (last && now - last < PER_ADDRESS_MS) return res.json({ sent: true, duplicate: true });

    try {
      const port = Number(process.env.SMTP_PORT || 587);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      const { subject, html, text } = checklistEmail();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject,
        html,
        text,
      });
      recentlySent.set(email, now);
      res.json({ sent: true });
    } catch (err) {
      // Don't log the address itself.
      console.error('Checklist email failed:', (err as Error).message);
      res.status(502).json({ sent: false, reason: 'send_failed' });
    }
  });
}
