/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React from 'react';

interface BentoCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  headerControls?: React.ReactNode;
  glowing?: boolean;
  colSpan?: 1 | 2;
}

const BentoCard: React.FC<BentoCardProps> = ({
  children,
  title,
  className = '',
  headerControls,
  glowing = false,
  colSpan = 1,
}) => {
  return (
    <div
      className={`
        ds-card relative overflow-hidden flex flex-col transition-all duration-300
        rounded-[var(--radius-card)]
        ${glowing
          ? 'border-[var(--klein-ring)]'
          : 'hover:border-[var(--border-highlight)]'}
        ${colSpan === 2 ? 'col-span-2' : ''}
        ${className}
      `}
      style={glowing ? { boxShadow: 'var(--klein-grad-glow)' } : undefined}
    >
      {(title || headerControls) && (
        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--border-highlight)] relative z-10">
          {title && (
            <h3 className="ds-section-title truncate">
              {title}
            </h3>
          )}
          {headerControls && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {headerControls}
            </div>
          )}
        </div>
      )}
      <div className="relative z-10 flex-1 min-h-0 overflow-auto scrollbar-thin scrollbar-thumb-[var(--border-highlight)] scrollbar-track-transparent">
        {children}
      </div>
    </div>
  );
};

export default BentoCard;
