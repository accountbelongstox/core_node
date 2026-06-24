import React from 'react';
import { Loader2 } from 'lucide-react';
import LoadingSpinner from '../shared/LoadingSpinner';

/** Bare spinning icon for inline / in-button use (no layout wrapper). */
export const InlineSpinner: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <Loader2 className={`animate-spin ${className}`} size={size} aria-hidden="true" />
);

/**
 * Full-region centered loading state (accessible, dark-mode) for panel bodies —
 * replaces the ~190 inline "centered flex + spinning RefreshCw + 'Loading...'" blocks.
 */
export const LoadingBlock: React.FC<{
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  full?: boolean;
  className?: string;
}> = ({ label = 'Loading…', size = 'md', full = false, className = '' }) => (
  <div className={`flex items-center justify-center ${full ? 'h-full' : 'py-10'} ${className}`}>
    <LoadingSpinner size={size} label={label} />
  </div>
);
