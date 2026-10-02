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

interface StateGateProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  loadingText: string;
  emptyText: string;
  retryLabel: string;
  onRetry: () => void;
  size?: StateMessageProps['size'];
  children: React.ReactNode;
}

/** Loading / error (with retry) / empty gate in front of a list. */
export const StateGate: React.FC<StateGateProps> = ({ loading, error, empty, loadingText, emptyText, retryLabel, onRetry, size, children }) => {
  if (loading) return <StateMessage kind="loading" size={size}>{loadingText}</StateMessage>;
  if (error) return <StateMessage kind="error" size={size} onRetry={onRetry} retryLabel={retryLabel}>{error}</StateMessage>;
  if (empty) return <StateMessage kind="empty" size={size}>{emptyText}</StateMessage>;
  return <>{children}</>;
};
