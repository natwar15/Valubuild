import React from 'react';

export const HeroVisual: React.FC = () => {
  return (
    <div className="relative w-full max-w-[520px] mx-auto select-none">
      {/* Background simulating slate practice desk surface */}
      <div
        className="relative p-5 sm:p-7 rounded-[6px] overflow-hidden"
        style={{
          backgroundColor: '#1E1D1A',
          border: '1px solid #332F28',
          backgroundImage: `
            linear-gradient(135deg, rgba(255,255,255,0.03) 25%, transparent 25%),
            linear-gradient(225deg, rgba(255,255,255,0.03) 25%, transparent 25%),
            linear-gradient(45deg, rgba(255,255,255,0.02) 25%, transparent 25%),
            linear-gradient(315deg, rgba(255,255,255,0.02) 25%, #1A1916 25%)
          `,
          backgroundPosition: '10px 0, 10px 0, 0 0, 0 0',
          backgroundSize: '20px 20px',
        }}
      >
        {/* Subtle warm daylight angle overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(115deg, rgba(255,248,235,0.09) 0%, transparent 60%)',
          }}
        />

        {/* Clinical desk instrument detail */}
        <div
          className="hidden sm:flex absolute -right-1 top-10 flex-col items-center z-20 pointer-events-none"
          style={{ transform: 'rotate(14deg)' }}
        >
          {/* Graphite lead tip */}
          <div
            className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[10px]"
            style={{ borderBottomColor: '#2B2B2B' }}
          />
          {/* Shaved cedar wood cone */}
          <div
            className="w-2 h-3.5"
            style={{
              backgroundColor: '#DDB282',
              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
            }}
          />
          {/* Pencil body in copper ochre */}
          <div
            className="w-3.5 h-36 rounded-b-[2px] flex flex-col justify-between items-center py-2 shadow-sm"
            style={{
              backgroundColor: '#A6381C',
              border: '1px solid #842810',
            }}
          >
            <div className="w-[1.5px] h-20 bg-amber-100/30" />
            <span
              className="text-[7px] tracking-widest text-amber-100/80 font-mono -rotate-90 select-none whitespace-nowrap"
              style={{ fontSize: '6px' }}
            >
              DENTAL M&amp;A
            </span>
          </div>
        </div>

        {/* Paper Practice Valuation Report Document */}
        <div
          className="relative bg-white rounded-[6px] p-5 sm:p-6 shadow-md transition-transform"
          style={{
            border: '1px solid var(--color-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          {/* Document Header */}
          <div
            className="flex items-start justify-between pb-3.5 mb-4"
            style={{ borderBottom: '1px solid var(--color-border)' }}
          >
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="text-[11px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-[4px]"
                  style={{
                    backgroundColor: '#F3EFE9',
                    color: 'var(--color-text-muted)',
                  }}
                >
                  Confidential
                </span>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Ref: LSH-2026-RIPON
                </span>
              </div>
              <h4
                className="text-base sm:text-lg font-bold mt-1"
                style={{
                  fontFamily: 'var(--font-heading)',
                  color: 'var(--color-text-primary)',
                }}
              >
                Bridge House Dental Valuation (£)
              </h4>
              <p
                className="text-xs"
                style={{ color: 'var(--color-text-muted)' }}
              >
                4-Surgery Mixed NHS/Private Practice (Ripon, HG4 1QW)
              </p>
            </div>

            {/* Verification stamp icon */}
            <div
              className="w-10 h-10 rounded-[6px] flex items-center justify-center text-xs font-mono font-bold"
              style={{
                backgroundColor: '#FAF8F4',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-primary)',
              }}
            >
              RICS
            </div>
          </div>

          {/* Dial and Valuation Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center mb-4">
            {/* Score Dial (70/100) */}
            <div className="sm:col-span-5 flex flex-col items-center text-center">
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="#EFEBE4"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="8"
                    strokeDasharray={251.32}
                    strokeDashoffset={251.32 * (1 - 0.70)}
                    strokeLinecap="round"
                  />
                </svg>
                {/* Center score readout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="text-2xl font-bold tracking-tight"
                    style={{
                      fontFamily: 'var(--font-heading)',
                      color: 'var(--color-accent)',
                    }}
                  >
                    7.00
                  </span>
                  <span
                    className="text-[10px] uppercase tracking-wider font-semibold"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    YP Multiplier
                  </span>
                </div>
              </div>
              <span
                className="text-[11px] font-semibold uppercase tracking-wider mt-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Adopted by Valuer
              </span>
            </div>

            {/* Valuation Range Details in GBP */}
            <div className="sm:col-span-7 flex flex-col gap-2.5">
              <div
                className="p-2.5 rounded-[6px]"
                style={{
                  backgroundColor: 'var(--color-background)',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span
                    className="text-[11px] font-medium"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    MV1: Market Value (Goodwill)
                  </span>
                  <span
                    className="text-[10px] font-mono px-1 rounded"
                    style={{ backgroundColor: '#ECE6DC', color: 'var(--color-text-primary)' }}
                  >
                    7.00 YP
                  </span>
                </div>
                <div
                  className="text-lg sm:text-xl font-bold tracking-tight"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  £1,750,000
                </div>
              </div>

              <div
                className="p-2.5 rounded-[6px]"
                style={{
                  backgroundColor: '#FAF5EE',
                  border: '1px solid #D6BC9E',
                }}
              >
                <div className="flex justify-between items-baseline mb-0.5">
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: 'var(--color-accent)' }}
                  >
                    Fair Maintainable Profit (FMOP)
                  </span>
                  <span
                    className="text-[10px] font-mono font-bold px-1 rounded"
                    style={{ backgroundColor: '#EAD7C2', color: 'var(--color-accent)' }}
                  >
                    Adopted
                  </span>
                </div>
                <div
                  className="text-lg sm:text-xl font-bold tracking-tight"
                  style={{
                    fontFamily: 'var(--font-heading)',
                    color: 'var(--color-accent)',
                  }}
                >
                  £251,584 pa
                </div>
              </div>
            </div>
          </div>

          {/* Sample auditable factor bar */}
          <div
            className="pt-2.5 flex items-center justify-between text-xs"
            style={{ borderTop: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}
          >
            <span>MV2 (6-Mo Restricted): £1.40M</span>
            <span
              className="font-semibold"
              style={{ color: 'var(--color-accent)' }}
            >
              Market Rent: £24,000 pa
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
