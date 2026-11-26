import React from 'react';
import { POOL_CONSENT_VERSION } from '../shared/consent';
import { MIN_CELL_SIZE, POOL_MIN_CONTRIBUTORS } from '../shared/marketStats';

const border = { borderColor: 'var(--color-border)' };

const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h3 className="text-base font-bold text-[#26231E] mt-6 mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
    {children}
  </h3>
);

/**
 * DRAFT privacy notice. The operator's legal name, contact address and ICO
 * registration number are placeholders and must be filled in, and the text
 * should be reviewed by someone qualified before launch.
 */
export const PrivacyNotice: React.FC = () => (
  <div className="bg-white border rounded-[6px] p-6 sm:p-8 text-left text-sm text-[#26231E] leading-relaxed max-w-3xl mx-auto" style={border}>
    <h2 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-heading)' }}>
      Privacy notice
    </h2>
    <p className="text-xs text-[#6B6459] mt-1">Version {POOL_CONSENT_VERSION}. Draft, pending review.</p>

    <H>Who we are</H>
    <p>
      Valubuild is run by <strong>[operator legal name]</strong>, <strong>[address]</strong>, ICO registration{' '}
      <strong>[number]</strong>. Contact us about your data at <strong>[privacy email]</strong>.
    </p>

    <H>Using the site without an account</H>
    <p>
      You can browse the market data and get a quick valuation without signing up. Quick-valuation answers are used to
      work out your range and are not stored unless you save them to an account.
    </p>

    <H>What we keep if you create an account</H>
    <ul className="list-disc pl-5 space-y-1">
      <li>Your email address and, if you sign in with Google, your name as Google provides it.</li>
      <li>
        The valuations you save: the nickname you choose, the first letters of your postcode (for example "LS", never the
        full postcode or district), fees, income split, surgeries, premises type, clinical days, and any optional profit,
        valuation, offer or sale figure you add.
      </li>
      <li>The quick valuation never asks for your practice's real name or address. Please don't put them in the nickname.</li>
    </ul>
    <p className="mt-2">
      We use this to run your account and show you your saved valuations (lawful basis: performing our agreement with
      you). Marketing emails are sent only if you switch them on (consent).
    </p>
    <H>The detailed valuation and document upload</H>
    <ul className="list-disc pl-5 space-y-1">
      <li>
        If you use the detailed valuation, you can enter a practice name. We store it with your saved report so you can
        recognise it; it is only ever shown to you. We don't store the street address, and we keep only the postcode
        district (for example "LS1"), not the full postcode.
      </li>
      <li>
        Documents you upload for analysis (accounts, bank statements, NHS schedules, payroll) are sent to Google's Gemini
        API to extract figures, and we keep the extracted summary with your report. Google processes them for us under its
        paid API terms, which don't allow it to use them to train its models. Payroll and staff documents can contain your team's personal
        data: please remove names before uploading, or upload totals only.
      </li>
      <li>
        The broker document pack (accounts, NHS schedule, private income per clinician, plan schedules) is read the same
        way, but the file itself is discarded once its figures are read, unless you tick "keep a private copy". The
        figures are shown to you to check and are saved only if you save the report. Clinicians are recorded by role,
        not name. Kept documents are visible only to you, can be deleted at any time, are removed when you delete your
        account, and are never added to the anonymised pool.
      </li>
      <li>The voice advisor and the follow-up questions are also processed by Gemini. Answers you give to follow-up questions are saved with your report.</li>
    </ul>
    <H>Email sign-ups</H>
    <p>
      If you leave your email for the founding-owner list, we keep the email and where you signed up, to send you
      Valubuild updates (lawful basis: consent). Ask us to remove it at any time; deleting your account also removes it.
    </p>
    <H>The anonymised pool (optional)</H>
    <p>
      If you tick the box to add a valuation to the pool, its figures are combined with other practices' to build the
      benchmarks everyone sees. Our lawful basis is your consent, which you can withdraw at any time from "My saved
      valuations"; your figures then stop being used from the next refresh (within a few minutes).
    </p>
    <ul className="list-disc pl-5 space-y-1 mt-2">
      <li>Your nickname, email, practice name and postcode are never shown to anyone else.</li>
      <li>
        Pooled figures are only published for groups of at least {POOL_MIN_CONTRIBUTORS} different owners, each counted
        once however many valuations they save. We publish only a rounded median, slightly adjusted so it can't be
        worked back to any one practice, never the highest, lowest or quartiles. Group sizes are rounded down to the
        nearest 5.
      </li>
      <li>Groups are by region or practice type only. We don't offer filters on pooled data that could single out one practice.</li>
      <li>Only owners with a verified email can contribute, to keep the pool reliable.</li>
      <li>Valuations shared under earlier versions of this notice are not used until you opt in again.</li>
    </ul>
    <H>Market data</H>
    <p>
      Listing figures come from public broker adverts and published market surveys. They contain no personal data. We
      show them only as group medians and ranges for groups of at least {MIN_CELL_SIZE} listings, without broker references or locations below region level. Figures obtained under a confidentiality
      agreement are never used.
    </p>

    <H>Where it's stored and for how long</H>
    <p>
      Data is stored with Google Cloud and Firebase in <strong>[region]</strong>. We keep your account data until you
      delete it. You can delete a single valuation, or your whole account and everything saved to it, at any time from
      the valuation page.
    </p>

    <H>Your rights</H>
    <p>
      You can ask for a copy of your data (email us and we'll send it within one month), ask us to correct or delete
      it, object to or restrict its use, and withdraw consent. You can also complain to the Information Commissioner's Office (ico.org.uk).
    </p>
  </div>
);
