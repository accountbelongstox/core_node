import React from 'react';
import { ChipButton } from './ChipButton';

export type StateKind = 'loading' | 'empty' | 'error';

interface StateMessageProps {
  kind: StateKind;
  children?: React.ReactNode;
  /** `panel`: inside a card or table; `page`: a whole empty page area. */
  size?: 'panel' | 'page';
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

const KIND_CLASS: Record<StateKind, string> = {
  loading: 'text-zinc-500 animate-pulse',
  empty: 'text-zinc-500',
  error: 'text-rose-400',
};

const SIZE_CLASS: Record<NonNullable<StateMessageProps['size']>, string> = {
  panel: 'p-8',
  page: 'py-16',
};

/** The one loading / empty / error block (optional retry chip for errors). */
export const StateMessage: React.FC<StateMessageProps> = ({ kind, children, size = 'panel', onRetry, retryLabel, className = '' }) => (
  <div className={`${SIZE_CLASS[size]} text-center ${onRetry ? 'space-y-2' : ''} ${className}`}>
    <p className={`text-xs font-mono ${KIND_CLASS[kind]}`}>{children}</p>
    {onRetry && <ChipButton onClick={onRetry}>{retryLabel}</ChipButton>}
  </div>
);
