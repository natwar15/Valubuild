import React, { useState } from 'react';
import { X, Copy, Check, Share2 } from 'lucide-react';

interface ShareKitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareKitModal: React.FC<ShareKitModalProps> = ({ isOpen, onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.href : 'https://valubuild.com';

  const posts = [
    {
      title: 'Post 1 — UK Dental Principals Group (GDPUK / Facebook Dental Owners)',
      channel: 'GDPUK & UK Dental Practice Owners Groups',
      content: `Question for the practice principals in here who've thought about an exit or partial equity sale someday. I've been researching UK dental practice M&A over the past few months, and the thing that stopped me cold: in 2026, dental practices in Great Britain sell at anywhere from 4x to 12x the same EBITDA. A £300K-EBITDA practice with a strong Denplan/Practice Plan list and associate-led chairtime sells for £2.8M–£3.6M (9x–12x). The same £300K EBITDA with heavy NHS UDA reliance and the principal billing 50% of practice fees sells for £1.4M–£1.7M (4.5x–5.5x). Same profit, over £1.4M difference — and most principals only learn which side they're on 90 days before sale when a broker sends an appraisal. I put together a live tool that calculates your practice valuation range and the specific diligence gaps corporate buyers (Portman Dentex, Bupa, Rodericks) flag, years before you speak to them. Would genuinely like to hear from UK principals: is this something you'd use, or is this a "my specialist accountant handles it" situation? Honest opinions welcome. ${currentUrl}`,
    },
    {
      title: 'Post 2 — LinkedIn (UK Practice Principals, NASDAL Accountants, Dental Brokers)',
      channel: 'LinkedIn (UK Dental M&A & Healthcare)',
      content: `56 corporate dental chains and PE-backed DSOs are actively acquiring UK dental practices — up from 17 two years ago. Deals closed across Portman Dentex, Bupa Dental Care, Rodericks Dental Partners, and regional groups this autumn. What the corporates know and most independent principals don't: the multiple spread on identical EBITDA runs from 4x to 12x+, and the criteria for the premium multiple are published — monthly patient capitation direct debits, associate-led chairtime (<20% principal fee generation), enforceable BDA covenants, and direct access hygiene recall. Yet the first time most owners see their gaps is an advisor report 90 days before sale. I put together a live valuation dashboard that scores a UK dental practice against those corporate diligence criteria years early, with each operational fix ranked by pound (£) impact. If you're a practice principal, NASDAL accountant, or dental exit advisor, I'd value your honest feedback. ${currentUrl}`,
    },
    {
      title: 'Post 3 — Dental Forums & Online Communities (Reddit / UK Dental)',
      channel: 'Reddit (r/Dentistry / UK Business Forums)',
      content: `I've been digging into SME valuation in UK healthcare, specifically independent dental practices, where roll-ups by corporate DSOs have surged. The EBITDA multiple dispersion is striking: 4.0x–5.5x for NHS-reliant practices with high principal chairside dependency, 9.0x–12.5x+ for associate-led private practices with contracted Denplan/Practice Plan memberships — on identical underlying earnings. Most of the multiple gap traces to three auditable factors: principal fee dependence, patient capitation percentage, and associate restrictive covenants. I built a live tool that scores a UK practice against those corporate audit factors and estimates the pound (£) impact of each fix in real time. Curious what practice owners and dental advisors think about the methodology — where would you poke holes? ${currentUrl}`,
    },
    {
      title: 'DM version (Direct outreach to UK Dental Principals)',
      channel: 'Direct Message (Practice Principals)',
      content: `I've been researching how UK dental practices get valued when corporate groups (Portman Dentex, Bupa, Rodericks) come calling — the spread on identical EBITDA is 4x to 12x (over £1.4M difference on £300K EBITDA), and it mostly comes down to a short list of things corporate deal teams audit. I put together a live UK tool that shows principals their range and their gaps years before a sale — would you take a look and tell me honestly if it's useful or off base? ${currentUrl}`,
    },
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(38, 35, 30, 0.65)', backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-[6px] p-6 sm:p-8"
        style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 36px rgba(38, 35, 30, 0.20)',
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-[4px] transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-2">
          <Share2 className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
          <h3
            className="text-xl font-bold"
            style={{
              fontFamily: 'var(--font-heading)',
              color: 'var(--color-text-primary)',
            }}
          >
            Dental Practice Validation Share Kit
          </h3>
        </div>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
          Exact pre-written messages tailored for UK practice owners across GDPUK, dental forums, and LinkedIn.
        </p>

        <div className="space-y-5">
          {posts.map((post, idx) => (
            <div
              key={idx}
              className="p-4 rounded-[6px] border"
              style={{
                backgroundColor: 'var(--color-background)',
                borderColor: 'var(--color-border)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#26231E]">
                  {post.channel}
                </span>
                <button
                  onClick={() => handleCopy(post.content, idx)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded transition-colors"
                  style={{
                    backgroundColor: copiedIndex === idx ? '#E8F5E9' : '#FFFFFF',
                    color: copiedIndex === idx ? '#2E7D32' : 'var(--color-text-primary)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Post
                    </>
                  )}
                </button>
              </div>
              <div
                className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed p-3 bg-white rounded border font-mono select-all"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)' }}
              >
                {post.content}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
