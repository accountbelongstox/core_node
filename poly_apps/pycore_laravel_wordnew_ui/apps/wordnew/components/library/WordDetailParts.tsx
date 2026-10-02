import React from 'react';
import { Languages, Volume2 } from 'lucide-react';

export const TRANSLATION_SEPARATOR = '；';

export const joinTranslations = (translations: readonly string[]): string => translations.join(TRANSLATION_SEPARATOR);

/** Small amber "invalid" tag shown beside a word that failed validation. */
export const InvalidWordChip: React.FC<{ label: string; className?: string }> = ({ label, className = '' }) => (
  <span className={`text-[9px] font-mono text-amber-500/80 border border-amber-500/30 rounded px-1 ${className}`}>{label}</span>
);

/** Emerald language icon + the full translation list of a word. */
export const WordTranslationsLine: React.FC<{ translations: readonly string[] }> = ({ translations }) => (
  <div className="flex items-start gap-2">
    <Languages className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
    <p className="text-[12px] text-zinc-200">{joinTranslations(translations)}</p>
  </div>
);

/** US / UK phonetic pair of a word. */
export const WordPhoneticsLine: React.FC<{ us?: string | null; uk?: string | null }> = ({ us, uk }) => (
  <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500">
    {us && <span><Volume2 className="w-3 h-3 inline mr-1" />US /{us}/</span>}
    {uk && <span><Volume2 className="w-3 h-3 inline mr-1" />UK /{uk}/</span>}
  </div>
);
