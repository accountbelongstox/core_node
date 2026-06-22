/**
 * WfNewLoadingDots — a tiny reusable "loading…" indicator: three dots that flash
 * in sequence (staggered pulse) with an optional label. Used on the home hub to
 * mark a category whose data is still being fetched (BOOK / subtitles / library),
 * and reusable anywhere a compact inline loading cue is needed.
 *
 * Pure presentation, no state. Colour is inherited via `className` (the dots use
 * `bg-current`, so a text-color class tints both the dots and the label).
 */
import React from 'react';

interface WfNewLoadingDotsProps {
  /** Optional text shown after the dots (e.g. trans('content.loading')). */
  label?: string;
  /** Tailwind text-color class (tints dots + label via currentColor). */
  className?: string;
  /** Dot scale — 'sm' (default) for inline header use, 'md' for body use. */
  size?: 'sm' | 'md';
}

export const WfNewLoadingDots: React.FC<WfNewLoadingDotsProps> = ({
  label,
  className = 'text-zinc-500',
  size = 'sm',
}) => {
  const dot = size === 'md' ? 'w-1.5 h-1.5' : 'w-1 h-1';
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-mono ${size === 'md' ? 'text-[11px]' : 'text-[10px]'} ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`${dot} rounded-full bg-current animate-pulse`}
            // Staggered delay → the three dots flash in sequence like "…".
            style={{ animationDelay: `${i * 160}ms`, animationDuration: '900ms' }}
          />
        ))}
      </span>
      {label && <span className="uppercase tracking-wider">{label}</span>}
    </span>
  );
};
