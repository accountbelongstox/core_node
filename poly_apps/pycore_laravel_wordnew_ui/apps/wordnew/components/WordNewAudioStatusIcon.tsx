import React from 'react';
import {
  ArrowUpCircle,
  CircleAlert,
  Clock3,
  Languages,
  Loader2,
  Play,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import type { WordNewAudioCellState } from '../utils/WordNewAudioCellState';
import { useWordNewQueueReceipt, type WordNewQueueResource } from '../services/WordNewQueueRuntime';

export interface WordNewAudioStatusIconProps {
  state: WordNewAudioCellState;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
  queueKey?: string;
  resource?: WordNewQueueResource;
  trans?: (key: string, replacements?: Record<string, string | number>) => string;
}

const SIZE = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4' };

export const WordNewAudioStatusIcon: React.FC<WordNewAudioStatusIconProps> = ({
  state,
  onClick,
  disabled,
  title,
  size = 'sm',
  className = '',
  queueKey,
  resource = 'audio',
  trans,
}) => {
  const receipt = useWordNewQueueReceipt(queueKey);
  const receiptState = state === 'ready' || state === 'playing'
    ? state
    : receipt?.stage || state;
  const ic = SIZE[size];
  const base = `shrink-0 p-1 rounded transition-all ${onClick ? 'cursor-pointer' : 'cursor-default'} ${className}`;
  const stateTitle = title || (trans ? trans(`queue.${receiptState}`) : receiptState);
  const wrap = (cls: string, icon: React.ReactNode) => {
    const classes = `${base} ${cls} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`;
    if (!onClick) return <span title={stateTitle} className={classes}>{icon}</span>;
    return (
      <button type="button" disabled={disabled} onClick={onClick} title={stateTitle} className={classes}>
        {icon}
      </button>
    );
  };

  switch (receiptState) {
    case 'playing':
      return wrap('text-indigo-300 opacity-100', <Volume2 className={`${ic} animate-pulse`} />);
    case 'ready':
    case 'completed':
      return wrap(
        'text-emerald-400 hover:text-emerald-300 opacity-100',
        resource === 'translation' ? <Languages className={ic} /> : <Volume2 className={ic} />,
      );
    case 'processing':
      return wrap('text-sky-400 opacity-100', <Loader2 className={`${ic} animate-spin`} />);
    case 'queued':
    case 'laravel_received':
      return wrap('text-amber-400 opacity-100 animate-pulse', <ArrowUpCircle className={ic} />);
    case 'worker_received':
      return wrap('text-cyan-300 opacity-100 animate-pulse', <Zap className={ic} />);
    case 'waiting':
      return wrap('text-slate-400 opacity-100 animate-pulse', <Clock3 className={ic} />);
    case 'failed':
      return wrap('text-rose-400 opacity-100', <CircleAlert className={ic} />);
    case 'missing':
      return wrap('text-fuchsia-500/70 hover:text-fuchsia-300 opacity-100 animate-pulse', <VolumeX className={ic} />);
    case 'none':
    default:
      return <span className={`${base} opacity-0 pointer-events-none`}><Play className={ic} /></span>;
  }
};

export default WordNewAudioStatusIcon;
