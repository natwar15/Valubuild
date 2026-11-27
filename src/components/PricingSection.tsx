import React, { useState } from 'react';
import { Check, Handshake } from 'lucide-react';
import {
  PRICING_PLANS,
  PRE_SALE_SPRINT,
  FREE_FOREVER,
  type Audience,
  type PricingPlan,
} from '../shared/pricing';

interface PricingSectionProps {
  onOpenCapture: (source: string, tier?: string) => void;
}

const AUDIENCES: { id: Audience; label: string }[] = [
  { id: 'owner', label: 'I own a practice' },
  { id: 'professional', label: 'I work with practices' },
];

function PlanCard({ plan, onOpenCapture }: { plan: PricingPlan; onOpenCapture: PricingSectionProps['onOpenCapture'] }) {
  const accent = plan.recommended;
  return (
    <div
      className="relative p-6 sm:p-8 rounded-[6px] flex flex-col justify-between"
      style={{
        backgroundColor: accent ? '#FFFFFF' : 'var(--color-background)',
        border: accent ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
        boxShadow: accent ? 'var(--card-shadow-recommended)' : undefined,
      }}
    >
      {accent && (
        <div className="absolute -top-3 left-6">
          <span
            className="text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-[4px]"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-text-on-accent)' }}
          >
            {plan.audience === 'owner' ? 'Most popular' : 'Recommended'}
          </span>
        </div>
      )}
      <div>
        <h3
          className={`text-[20px] font-bold mb-2 ${accent ? 'mt-2' : ''}`}
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          {plan.name}
        </h3>
        <div className="flex items-baseline gap-1 mb-4">
          <span
            className="text-3xl font-bold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
          >
            {plan.price}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
            {plan.cadence}
          </span>
        </div>
        <p className="text-sm mb-6 font-medium" style={{ color: 'var(--color-text-muted)' }}>
          Best for: {plan.bestFor}
        </p>
        <div className="pt-6 border-t space-y-3.5" style={{ borderColor: 'var(--color-border)' }}>
          {plan.features.map((feature) => (
            <div key={feature} className="flex items-start gap-2.5 text-[15px]">
              <Check
                className="w-4 h-4 flex-shrink-0 mt-1"
                style={{ color: accent ? 'var(--color-accent)' : 'var(--color-text-primary)' }}
              />
              <span>{feature}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <button
          onClick={() => onOpenCapture(`Pricing ${plan.id}`, plan.captureLabel)}
          className={`${accent ? 'btn-primary' : 'btn-secondary'} w-full`}
        >
          {plan.cta}
        </button>
      </div>
    </div>
  );
}

export default function PricingSection({ onOpenCapture }: PricingSectionProps) {
  const [audience, setAudience] = useState<Audience>('owner');
  const plans = PRICING_PLANS.filter((p) => p.audience === audience);

  return (
    <section
      id="pricing"
      className="px-4 sm:px-6"
      style={{
        backgroundColor: 'var(--color-surface)',
        paddingTop: 'var(--section-py)',
        paddingBottom: 'var(--section-py)',
        borderTop: '1px solid var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="mx-auto" style={{ maxWidth: 'var(--max-width)' }}>
        <h2
          className="text-2xl sm:text-3xl lg:text-[32px] font-bold leading-[1.2] mb-4 text-left"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text-primary)' }}
        >
          Browse free. Pay when you need the report, or the data every week.
        </h2>
        <p className="text-[17px] leading-[1.6] mb-8 max-w-3xl" style={{ color: 'var(--color-text-muted)' }}>
          Anyone with an interest in UK dental practices can register and explore anonymised listings,
          valuations and trends at no cost. Owners pay per report. Brokers, accountants, lenders and buyers
          subscribe for benchmarks, comparables, alerts and exports.
        </p>

        <div
          role="tablist"
          aria-label="Choose pricing for"
          className="inline-flex p-1 mb-10 rounded-[6px] border"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
        >
          {AUDIENCES.map((a) => {
            const active = a.id === audience;
            return (
              <button
                key={a.id}
                role="tab"
                aria-selected={active}
                onClick={() => setAudience(a.id)}
                className="px-4 py-2 text-sm font-semibold rounded-[4px] transition-colors"
                style={{
                  backgroundColor: active ? 'var(--color-text-primary)' : 'transparent',
                  color: active ? '#FFFFFF' : 'var(--color-text-primary)',
                }}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        <div
          className={`grid grid-cols-1 gap-8 items-stretch text-left ${
            plans.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2 lg:max-w-[880px]'
          }`}
        >
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onOpenCapture={onOpenCapture} />
          ))}
        </div>

        {audience === 'owner' ? (
          <div
            className="mt-8 p-6 rounded-[6px] border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-left"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-background)' }}
          >
            <div>
              <p className="font-bold text-[17px]" style={{ color: 'var(--color-text-primary)' }}>
                {PRE_SALE_SPRINT.name} · {PRE_SALE_SPRINT.price}{' '}
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  {PRE_SALE_SPRINT.cadence}
                </span>
              </p>
              <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--color-text-muted)' }}>
                For principals within 12 months of going to market. {PRE_SALE_SPRINT.summary}
              </p>
            </div>
            <button
              onClick={() => onOpenCapture('Pricing pre-sale-sprint', PRE_SALE_SPRINT.captureLabel)}
              className="btn-secondary whitespace-nowrap"
            >
              Ask about the Sprint
            </button>
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <div className="p-6 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Handshake className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
              <p className="font-bold text-[17px]" style={{ color: 'var(--color-text-primary)' }}>
                Introductions, only when an owner asks
              </p>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
              {audience === 'owner'
                ? 'If you want to talk to a broker, lender or buyer, tick the box on your report and we will introduce you. Nothing about your practice is shared until you say so, and you can say no at any time. Partners may pay us an introduction fee, and we will always tell you when they do.'
                : 'Owners who choose to be introduced can be matched with partner brokers, lenders and buyers. Introductions only happen with the owner’s explicit consent, and partner fees are disclosed to the owner.'}
            </p>
          </div>
          <div className="p-6 rounded-[6px] border" style={{ borderColor: 'var(--color-border)' }}>
            <p className="font-bold text-[17px] mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Always free
            </p>
            <ul className="space-y-2">
              {FREE_FOREVER.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-text-primary)' }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Prices exclude VAT. Paid plans are opening to early-access members first; reserving a plan costs nothing.
          Valuations are estimates for planning, not a formal valuation or financial advice.
        </p>
      </div>
    </section>
  );
}
