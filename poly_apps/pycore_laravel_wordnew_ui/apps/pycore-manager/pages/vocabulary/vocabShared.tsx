/**
 * Shared helpers, labels and small components for the pycore-manager Vocabulary
 * page tabs. Self-contained - no laravel-manager shell contexts (the page uses
 * pycoreApi + local React state, matching PcWordAudioPage's style).
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, AlertCircle } from 'lucide-react';
import { PcPresenceBadge } from '../../components/ai/PcStatusPill';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';

/** The sub-tabs (mirrors the laravel-manager #/vocabulary page). */
export const VOCAB_TABS = [
  { key: 'translate', labelKey: 'vocabularyPage.tabs.translate' },
  { key: 'words', labelKey: 'vocabularyPage.tabs.words' },
  { key: 'libraries', labelKey: 'vocabularyPage.tabs.libraries' },
  { key: 'statistics', labelKey: 'vocabularyPage.tabs.statistics' },
  { key: 'tts-queue', labelKey: 'vocabularyPage.tabs.ttsQueue' },
  { key: 'learning', labelKey: 'vocabularyPage.tabs.learning' },
  { key: 'dictionary', labelKey: 'vocabularyPage.tabs.dictionary' },
] as const;
export type VocabTabKey = (typeof VOCAB_TABS)[number]['key'];
export const VOCAB_TAB_KEY = StorageKeys.PYCORE_VOCAB_TAB;

/** Shared UI label keys in the `pc` namespace. */
export const VL = {
  offline: 'vocabularyPage.common.offline',
  refresh: 'vocabularyPage.common.refresh',
  loading: 'vocabularyPage.common.loading',
  empty: 'vocabularyPage.common.empty',
  error: 'vocabularyPage.common.error',
  search: 'vocabularyPage.common.search',
  language: 'vocabularyPage.common.language',
  totalCount: 'vocabularyPage.common.totalCount',
  range: 'vocabularyPage.common.range',
  prev: 'vocabularyPage.common.prev',
  next: 'vocabularyPage.common.next',
  actions: 'vocabularyPage.common.actions',
  delete: 'vocabularyPage.common.delete',
  save: 'vocabularyPage.common.save',
  cancel: 'vocabularyPage.common.cancel',
  close: 'vocabularyPage.common.close',
  confirmDelete: 'vocabularyPage.common.confirmDelete',
  translationBadge: 'vocabularyPage.common.badges.translation',
  audioBadge: 'vocabularyPage.common.badges.audio',
  validBadge: 'vocabularyPage.common.badges.valid',
} as const;

/** Boolean presence badge (has translation / has audio / is valid). */
export const PresenceBadge = PcPresenceBadge;

/** Offline / error banner shown at the top of a tab when pycore is unreachable. */
export function VocabBanner({ kind, message }: { kind: 'offline' | 'error' | 'warn'; message: string }) {
  const Icon = kind === 'offline' ? AlertCircle : kind === 'error' ? AlertCircle : Loader2;
  const cls = kind === 'warn'
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    : 'bg-rose-500/10 text-rose-400 border-rose-500/20';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${cls}`}>
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** Integer formatting with thousands separators. */
export function humanInt(n: number | undefined | null): string {
  const v = Number(n || 0);
  return v.toLocaleString('en-US');
}

/**
 * Unwrap the Laravel `{ success, data: <payload> }` envelope returned by the
 * browser-owned API boundary. For a bare
 * array response or a flat `{ success, items }` response (no `data` key), this
 * returns the body unchanged. Always returns the payload object/array.
 */
export function vp<T = Record<string, unknown>>(r: unknown): T {
  if (r && typeof r === 'object' && !Array.isArray(r) && (r as any).data !== undefined && (r as any).data !== null) {
    return (r as any).data as T;
  }
  return r as T;
}

/** Coerce a response payload to an array at the shared API boundary. */
export function toArray<T = Record<string, unknown>>(v: unknown): T[] {
  return findArrayPayload(v) as T[];
}

function findArrayPayload(v: unknown, depth = 0): unknown[] {
  let nested: unknown[] | null = null;

  if (Array.isArray(v)) return v;
  if (!v || typeof v !== 'object' || depth > 3) return [];

  const objectValue = v as Record<string, unknown>;
  const containerKeys = ['items', 'data', 'words', 'libraries', 'languages', 'breakdown'];
  for (const key of containerKeys) {
    const candidate = objectValue[key];
    if (Array.isArray(candidate)) return candidate;
    if (key === 'languages' && candidate && typeof candidate === 'object') {
      return languageOptions(candidate as Record<string, unknown>);
    }
    if (key === 'data' && candidate && typeof candidate === 'object') {
      nested = findArrayPayload(candidate, depth + 1);
      if (nested.length > 0) return nested;
    }
  }

  return nested || [];
}

function languageOptions(value: Record<string, unknown>): unknown[] {
  const options: Array<{ code: string; name: string; native?: string }> = [];

  for (const [code, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number') {
      options.push({ code, name: String(entry) });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const item = entry as Record<string, unknown>;
      if (typeof item.name === 'string') {
        const option: { code: string; name: string; native?: string } = {
          code,
          name: item.name,
        };
        if (typeof item.native === 'string') option.native = item.native;
        options.push(option);
      }
    }
  }

  return options;
}

/** Spinner row. */
export function VocabLoading({ label }: { label?: string }) {
  const { t } = useTranslation('pc');
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
      <Loader2 className="w-4 h-4 animate-spin" />
      <span>{label || t(VL.loading)}</span>
    </div>
  );
}
