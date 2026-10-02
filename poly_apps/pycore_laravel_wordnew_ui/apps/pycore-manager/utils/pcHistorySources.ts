/**
 * pcHistorySources — the ONE table of history stores behind usePcHistory /
 * PcHistoryList: how to list, normalize, delete and clear each store. Adding a
 * store is one entry here; no per-kind switch exists anywhere else.
 */
import type { TFunction } from 'i18next';
import {
  FlaskConical, Image as ImageIcon, ScanSearch, Captions, Languages, AudioLines,
  type LucideIcon,
} from 'lucide-react';
import { pycoreApi } from '@/apps/pycore-manager/api';
import type {
  AiHubHistoryRecord,
  ImageHistoryEntry,
  ImageSearchHistoryEntry,
  SpeechRecord,
  SubtitleSearchHistoryEntry,
  TranslateHistoryEntry,
} from '@/apps/pycore-manager/api';
import { aiHubData } from '@/apps/pycore-manager/api';
import { formatElapsedMs, toEpochMs } from './pcFormat';

export type PcHistoryKind = 'hub' | 'aiImage' | 'imageSearch' | 'subtitleSearch' | 'translate' | 'speech';

export const PC_HISTORY_KINDS: PcHistoryKind[] = ['hub', 'aiImage', 'imageSearch', 'subtitleSearch', 'translate', 'speech'];
/** Speech clips are linked from hub test records, so the merged feed leaves them out. */
export const PC_HISTORY_FEED_KINDS: PcHistoryKind[] = PC_HISTORY_KINDS.filter((kind) => kind !== 'speech');

export const PC_HISTORY_DEFAULT_LIMIT = 100;
const SUMMARY_MAX_CHARS = 120;
const REF_SPEECH = 'speech_history';
const REF_IMAGE = 'image_history';

export interface PcHistoryQuery {
  /** Hub entry key ("tts:azure"); scopes the hub store only. */
  key?: string;
  /** Hub category; scopes the hub store only. */
  category?: string;
  limit: number;
}

export interface PcHistoryRow {
  key: string;
  kind: PcHistoryKind;
  id: string;
  /** Epoch milliseconds. */
  ts: number;
  ok: boolean;
  title: string;
  subtitle: string;
  thumbPath?: string;
  audioPath?: string;
  error?: string;
  raw: unknown;
}

export interface PcHistorySource {
  labelKey: string;
  Icon: LucideIcon;
  accent: string;
  load: (query: PcHistoryQuery, t: TFunction) => Promise<PcHistoryRow[]>;
  remove: (row: PcHistoryRow) => Promise<void>;
  clear: (query: PcHistoryQuery) => Promise<void>;
}

const clip = (text: string | null | undefined, limit = SUMMARY_MAX_CHARS): string => {
  const value = String(text || '');
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

const itemsOf = <E>(answer: { items?: E[] } | null | undefined): E[] => answer?.items ?? [];

const joinParts = (parts: Array<string | number | null | undefined | false>): string =>
  parts.filter((part) => part !== null && part !== undefined && part !== false && part !== '').join(' · ');

function hubRow(record: AiHubHistoryRecord): PcHistoryRow {
  const ref = record.result_ref;
  return {
    key: `hub:${record.record_id}`,
    kind: 'hub',
    id: record.record_id,
    ts: toEpochMs(record.created_at),
    ok: !!record.ok,
    title: record.summary || record.id,
    subtitle: joinParts([record.key || `${record.category}:${record.id}`, record.elapsed_ms != null && formatElapsedMs(record.elapsed_ms)]),
    audioPath: ref?.kind === REF_SPEECH ? pycoreApi.speechHistoryFileUrl(ref.id) : undefined,
    thumbPath: ref?.kind === REF_IMAGE ? pycoreApi.imageHistoryFileUrl(ref.id) : undefined,
    error: record.error || undefined,
    raw: record,
  };
}

const hubSource: PcHistorySource = {
  labelKey: 'aiHub.history.kind.hub',
  Icon: FlaskConical,
  accent: 'text-indigo-500',
  load: async (query) => {
    const answer = await pycoreApi.getAiHubHistory({ key: query.key, category: query.category, limit: query.limit });
    if (answer?.success === false || !Array.isArray(answer?.items)) throw new Error('hub history unavailable');
    return answer.items.map(hubRow);
  },
  remove: async (row) => { await pycoreApi.deleteAiHubHistory(row.id); },
  clear: async (query) => { await pycoreApi.clearAiHubHistory({ key: query.key, category: query.category }); },
};

const aiImageSource: PcHistorySource = {
  labelKey: 'aiHub.history.kind.aiImage',
  Icon: ImageIcon,
  accent: 'text-fuchsia-500',
  load: async (query) => itemsOf<ImageHistoryEntry>(await pycoreApi.getImageHistory(query.limit)).map((e) => ({
    key: `aiImage:${e.id}`,
    kind: 'aiImage',
    id: e.id,
    ts: toEpochMs(e.ts),
    ok: e.ok !== false,
    title: clip(e.prompt),
    subtitle: joinParts([e.provider, e.model]) || e.size || '',
    thumbPath: pycoreApi.imageHistoryFileUrl(e.id),
    raw: e,
  })),
  remove: async (row) => { await pycoreApi.deleteImageHistory(row.id); },
  clear: async () => { await pycoreApi.clearImageHistory(); },
};

const imageSearchSource: PcHistorySource = {
  labelKey: 'aiHub.history.kind.imageSearch',
  Icon: ScanSearch,
  accent: 'text-sky-500',
  load: async (query, t) => itemsOf<ImageSearchHistoryEntry>(await pycoreApi.getImageSearchHistory(query.limit)).map((e) => ({
    key: `imageSearch:${e.id}`,
    kind: 'imageSearch',
    id: e.id,
    ts: toEpochMs(e.ts),
    ok: true,
    title: clip(e.query),
    subtitle: joinParts([e.engine, t('aiHub.history.results', { count: e.result_count ?? 0 }), e.ai && t('aiHub.history.withAi')]),
    raw: e,
  })),
  remove: async (row) => { await pycoreApi.deleteImageSearchHistory(row.id); },
  clear: async () => { await pycoreApi.clearImageSearchHistory(); },
};

const subtitleSearchSource: PcHistorySource = {
  labelKey: 'aiHub.history.kind.subtitleSearch',
  Icon: Captions,
  accent: 'text-amber-500',
  load: async (query, t) => itemsOf<SubtitleSearchHistoryEntry>(await pycoreApi.getSubtitleSearchHistory(query.limit)).map((e) => ({
    key: `subtitleSearch:${e.id}`,
    kind: 'subtitleSearch',
    id: e.id,
    ts: toEpochMs(e.ts),
    ok: true,
    title: clip(e.query),
    subtitle: joinParts([(e.languages ?? []).join(', '), e.year, t('aiHub.history.results', { count: e.result_count ?? 0 })]),
    raw: e,
  })),
  remove: async (row) => { await pycoreApi.deleteSubtitleSearchHistory(row.id); },
  clear: async () => { await pycoreApi.clearSubtitleSearchHistory(); },
};

const translateSource: PcHistorySource = {
  labelKey: 'aiHub.history.kind.translate',
  Icon: Languages,
  accent: 'text-emerald-500',
  load: async (query) => itemsOf<TranslateHistoryEntry>(await pycoreApi.getTranslateHistory(query.limit)).map((e) => ({
    key: `translate:${e.id}`,
    kind: 'translate',
    id: e.id,
    ts: toEpochMs(e.ts),
    ok: true,
    title: clip(e.text),
    subtitle: joinParts([`${e.source || '?'} → ${e.target || '?'}`, e.engine, clip(e.result, 60)]),
    raw: e,
  })),
  remove: async (row) => { await pycoreApi.deleteTranslateHistory(row.id); },
  clear: async () => { await pycoreApi.clearTranslateHistory(); },
};

const speechSource: PcHistorySource = {
  labelKey: 'aiHub.history.kind.speech',
  Icon: AudioLines,
  accent: 'text-cyan-500',
  load: async (query) => itemsOf<SpeechRecord>(await pycoreApi.getSpeechHistory(query.limit)).map((e) => ({
    key: `speech:${e.id}`,
    kind: 'speech',
    id: e.id,
    ts: toEpochMs(e.ts),
    ok: e.ok !== false,
    title: clip(e.text),
    subtitle: joinParts([e.kind, e.engine, e.language, e.latency_ms != null && formatElapsedMs(e.latency_ms)]),
    audioPath: pycoreApi.speechHistoryFileUrl(e.id),
    raw: e,
  })),
  remove: async (row) => { await pycoreApi.deleteSpeechHistory(row.id); },
  clear: async () => { await pycoreApi.clearSpeechHistory(); },
};

export const PC_HISTORY_SOURCES: Record<PcHistoryKind, PcHistorySource> = {
  hub: hubSource,
  aiImage: aiImageSource,
  imageSearch: imageSearchSource,
  subtitleSearch: subtitleSearchSource,
  translate: translateSource,
  speech: speechSource,
};
