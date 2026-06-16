import React from 'react';

/**
 * LoadingSpinner – small accessible spinner that matches the app aesthetic
 * (indigo accent ring, rounded, dark-mode aware). Tailwind only, no deps.
 */
export interface LoadingSpinnerProps {
  /** Visual size of the spinner. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg';
  /** Accessible label, also shown as caption text when provided. */
  label?: string;
  /** Optional extra classes for the wrapper. */
  className?: string;
}

const SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-10 h-10 border-2',
  lg: 'w-14 h-14 border-[3px]',
};

const TEXT_SIZE_MAP: Record<NonNullable<LoadingSpinnerProps['size']>, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label,
  className = '',
}) => {
  // Fallback accessible name so screen readers always announce the busy state.
  const accessibleLabel = label || 'Loading';

  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={`
          ${SIZE_MAP[size]}
          border-indigo-500 border-t-transparent rounded-full animate-spin
          dark:border-indigo-400 dark:border-t-transparent
        `}
      />
      {label ? (
        <p
          className={`${TEXT_SIZE_MAP[size]} text-slate-600 dark:text-slate-400 select-none`}
        >
          {label}
        </p>
      ) : null}
      {/* Always provide a name for assistive tech, even when no visible label. */}
      <span className="sr-only">{accessibleLabel}</span>
    </div>
  );
};

export default LoadingSpinner;
