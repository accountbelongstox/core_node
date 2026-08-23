import React from 'react';
import { Eye } from 'lucide-react';

export const ROUGH_TEXT_EXTENSIONS = Object.freeze(['txt', 'md', 'markdown', 'html', 'htm', 'csv', 'log']);

export interface RoughBookTextStats {
  words: number;
  uniqueWords: number;
  sentences: number;
  chars: number;
}

export interface BookStatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
  onClick?: () => void;
  variant?: 'upload' | 'source';
}

export const formatBookMetric = (value: number | undefined | null): string => (
  typeof value === 'number' ? value.toLocaleString() : '0'
);

export function roughBookTextStats(text: string): RoughBookTextStats {
  const stripped = text.replace(/<[^>]+>/g, ' ');
  const words = stripped.match(/[\p{L}\p{N}']+/gu) || [];
  const uniqueWords = new Set(words.map((word) => word.toLowerCase()));
  const sentences = stripped.split(/[.!?。！？\n]+/).map((sentence) => sentence.trim()).filter(Boolean);
  return { words: words.length, uniqueWords: uniqueWords.size, sentences: sentences.length, chars: text.length };
}

export const BookStatTile: React.FC<BookStatTileProps> = ({
  icon,
  label,
  value,
  accent,
  onClick,
  variant = 'upload',
}) => {
  const sourceSurface = 'rounded-xl bg-slate-100 dark:bg-black/30 border-slate-200/50 dark:border-white/5';
  const uploadSurface = 'rounded-lg bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700';
  const interactive = onClick
    ? 'cursor-pointer hover:border-indigo-400 hover:ring-1 hover:ring-indigo-400/40 transition'
    : 'cursor-default';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`w-full border p-3 text-left ${variant === 'source' ? sourceSurface : uploadSurface} ${interactive}`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-400">
        {icon}
        {label}
        {onClick && <Eye className="ml-auto h-3 w-3 opacity-50" />}
      </div>
      <div className={`text-base font-bold ${accent || 'text-slate-700 dark:text-slate-200'}`}>{value}</div>
    </button>
  );
};
