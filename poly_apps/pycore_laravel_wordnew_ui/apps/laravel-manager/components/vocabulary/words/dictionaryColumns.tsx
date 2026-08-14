import React from 'react';
import { Play } from 'lucide-react';
import { type PaginatedListColumn } from '../PaginatedListModal';
import { StatusBadge } from '../../common';

export interface DictionaryColumnsDeps {
  /** Play a word's pronunciation audio from a URL (label is used for logging/UI). */
  playWordAudio: (url: string, label?: string) => void;
  /** Format a (possibly nullish) number for display. */
  nf: (n: number | undefined | null) => string;
}

/**
 * Shared column set for dictionary-word lists (drill modal + Words tab).
 * Factory: the columns close over `playWordAudio` and `nf` from the container,
 * but have no other container coupling — both the drill modal (openDictionaryDrill)
 * and the inline Words tab (InlineWordsList) consume the same result. Each column's
 * `render(row, absoluteIndex)` signature is unchanged from the original closure.
 */
export const buildDictionaryColumns = (
  { playWordAudio, nf }: DictionaryColumnsDeps
): PaginatedListColumn[] => [
  { key: 'content', header: 'Word', sortKey: 'word', className: 'font-medium text-slate-900 dark:text-slate-100' },
  {
    key: 'translations',
    header: 'Translation',
    sortKey: 'translation',
    className: 'max-w-[16rem]',
    render: (r) => {
      const text = Array.isArray(r.translations) && r.translations.length
        ? r.translations.join('; ')
        : (r.has_translation ? '—' : '');
      if (!text) return <span className="text-slate-400">—</span>;
      return <span className="block truncate" title={text}>{text}</span>;
    },
  },
  {
    key: 'audio',
    header: 'Audio',
    sortKey: 'audio',
    className: 'text-center',
    render: (r) =>
      r.audio_url ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); playWordAudio(r.audio_url as string, r.content); }}
          className="inline-flex items-center justify-center rounded-full p-1 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
          aria-label={`Play audio for ${r.content}`}
          title="Play audio"
        >
          <Play className="w-3.5 h-3.5" />
        </button>
      ) : (
        <span className="text-slate-400">-</span>
      ),
  },
  { key: 'us_phonetic', header: 'US', sortKey: 'us_phonetic', className: 'font-mono text-slate-500 dark:text-slate-400', render: (r) => r.us_phonetic || <span className="text-slate-300 dark:text-slate-600">—</span> },
  { key: 'uk_phonetic', header: 'UK', sortKey: 'uk_phonetic', className: 'font-mono text-slate-500 dark:text-slate-400', render: (r) => r.uk_phonetic || <span className="text-slate-300 dark:text-slate-600">—</span> },
  {
    key: 'is_valid',
    header: 'Valid',
    sortKey: 'is_valid',
    className: 'text-center',
    render: (r) => (
      <StatusBadge status={r.is_valid ? 'Yes' : 'No'} tone={r.is_valid ? 'success' : 'error'} withDot={false} />
    ),
  },
  { key: 'query_count', header: 'Queries', sortKey: 'queries', className: 'text-right tabular-nums', render: (r) => nf(r.query_count) },
];

export default buildDictionaryColumns;
