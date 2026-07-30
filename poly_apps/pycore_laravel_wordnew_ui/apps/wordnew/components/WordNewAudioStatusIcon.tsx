import React from 'react';
import { Volume2, VolumeX, Loader2, ArrowUpCircle, Play } from 'lucide-react';
import type { WordNewAudioCellState } from '../utils/WordNewAudioCellState';

export interface WordNewAudioStatusIconProps {
  state: WordNewAudioCellState;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE = { sm: 'w-3.5 h-3.5', md: 'w-4 h-4' };

export const WordNewAudioStatusIcon: React.FC<WordNewAudioStatusIconProps> = ({
  state, onClick, disabled, title, size = 'sm', className = '',
}) => {
  const ic = SIZE[size];
  const base = `shrink-0 p-1 rounded transition-all cursor-pointer ${className}`;
  const wrap = (cls: string, icon: React.ReactNode) => (
    <button type="button" disabled={disabled} onClick={onClick} title={title}
      className={`${base} ${cls} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
      {icon}
    </button>
  );

  switch (state) {
    case 'playing':
      return wrap('text-indigo-300 opacity-100', <Volume2 className={`${ic} animate-pulse`} />);
    case 'ready':
      return wrap('text-emerald-400 hover:text-emerald-300 opacity-100', <Volume2 className={ic} />);
    case 'processing':
      return wrap('text-sky-400 opacity-100', <Loader2 className={`${ic} animate-spin`} />);
    case 'queued':
      return wrap('text-amber-400 opacity-100 animate-pulse', <ArrowUpCircle className={ic} />);
    case 'missing':
      return wrap('text-fuchsia-500/70 hover:text-fuchsia-300 opacity-100 animate-pulse', <VolumeX className={ic} />);
    case 'none':
    default:
      return <span className={`${base} opacity-0 pointer-events-none`}><Play className={ic} /></span>;
  }
};

export default WordNewAudioStatusIcon;
