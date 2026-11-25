import React from 'react';

interface LogoProps {
  size?: number;
  showWordmark?: boolean;
  className?: string;
  wordmarkColor?: string;
}

export const LogoEmblem: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Roof gable left slope & eaves in charcoal #26231E */}
      <path
        d="M6 34L22 18"
        stroke="var(--color-text-primary, #26231E)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Gable tie beam */}
      <path
        d="M12 34H30"
        stroke="var(--color-text-primary, #26231E)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Ridgeline extending right and ascending upward as copper trend line */}
      <path
        d="M22 18L28 18L41 5"
        stroke="var(--color-accent, #A6521C)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head */}
      <path
        d="M32 5H41V14"
        stroke="var(--color-accent, #A6521C)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({
  size = 28,
  showWordmark = true,
  className = '',
  wordmarkColor = 'var(--color-text-primary)',
}) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoEmblem size={size} />
      {showWordmark && (
        <span
          style={{
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: '22px',
            lineHeight: 1,
            color: wordmarkColor,
            letterSpacing: '-0.02em',
          }}
        >
          Valubuild
        </span>
      )}
    </div>
  );
};
