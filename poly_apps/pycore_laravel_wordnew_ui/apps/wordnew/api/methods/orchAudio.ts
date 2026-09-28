import type {
  WfNewOrchAudioDetail,
  WfNewOrchAudioItem,
  WfNewOrchAudioPage,
  WfNewOrchAudioSegment,
  WfNewOrchAudioSentence,
  WfNewOrchAudioSentencePage,
  WfNewOrchAudioSourceCount,
  WfNewOrchAudioTimelineEntry,
  WfNewOrchAudioWord,
} from '../types/orchAudio';
import { WfNewApiPaths } from '../WfNewApiPaths';
import { absUrl } from '../WfNewApiMappers';
import { authedGetJSON } from '../WfNewApiTransport';

export const ORCH_AUDIO_DEFAULT_PAGE_SIZE = 20;
/** Detail resolves sentence audio per row, so sentence pages stay at Laravel's
 * default size and are fetched on demand by the player. */
export const ORCH_AUDIO_SENTENCE_PAGE_SIZE = 200;

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOr(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback;
}

function secondsFromMs(value: unknown): number | null {
  const ms = numberOr(value, -1);
  return ms >= 0 ? ms / 1000 : null;
}

function mediaUrl(value: unknown): string | null {
  return typeof value === 'string' && value ? absUrl(value) ?? null : null;
}

function rows(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function toOrchAudioItem(raw: any): WfNewOrchAudioItem {
  const id = String(raw?.id ?? '');
  return {
    id,
    taskId: String(raw?.task_id ?? id),
    source: text(raw?.source) || 'vocab_book',
    title: text(raw?.name) || String(raw?.task_id ?? id),
    language: text(raw?.language) || 'en',
    status: text(raw?.status),
    segmentCount: numberOr(raw?.segment_count, 0),
    segmentsReady: numberOr(raw?.segments_ready, 0),
    sentenceCount: numberOr(raw?.sentence_count, 0),
    durationSec: secondsFromMs(raw?.duration_ms),
    previewText: text(raw?.preview_text),
    sourceRef: raw?.source_ref && typeof raw.source_ref === 'object' ? raw.source_ref : null,
    createdAt: nullableText(raw?.created_at),
    updatedAt: nullableText(raw?.updated_at),
  };
}

function toSourceCount(raw: any): WfNewOrchAudioSourceCount | null {
  const id = typeof raw === 'string' ? raw : text(raw?.id);
  return id ? { id, count: numberOr(raw?.count, 0) } : null;
}

function toTimelineEntry(raw: any): WfNewOrchAudioTimelineEntry {
  return {
    seq: raw?.seq == null ? null : numberOr(raw.seq, 0),
    type: raw?.type === 'word' ? 'word' : 'sentence',
    startMs: numberOr(raw?.start_ms, 0),
    endMs: numberOr(raw?.end_ms, 0),
  };
}

function toSegment(raw: any, index: number): WfNewOrchAudioSegment {
  return {
    index: numberOr(raw?.index, index),
    url: raw?.ready === false ? null : mediaUrl(raw?.audio_url),
    start: numberOr(raw?.start, 0),
    end: numberOr(raw?.end, -1),
    durationSec: secondsFromMs(raw?.duration_ms),
    timeline: rows(raw?.timeline).map(toTimelineEntry),
  };
}

function toSentence(raw: any, position: number): WfNewOrchAudioSentence {
  const language = text(raw?.language) || 'en';
  const languages: Record<string, string> = {};
  if (raw?.languages && typeof raw.languages === 'object') {
    for (const [lang, value] of Object.entries(raw.languages)) {
      if (typeof value === 'string' && value.trim()) languages[lang] = value;
    }
  }
  const sentenceText = text(raw?.text) || languages[language] || '';
  if (sentenceText && !languages[language]) languages[language] = sentenceText;
  return {
    seq: numberOr(raw?.seq, position),
    position,
    language,
    text: sentenceText,
    languages,
    audioUrl: raw?.audio_ready === false ? null : mediaUrl(raw?.audio_url),
  };
}

function toWord(raw: any): WfNewOrchAudioWord {
  return {
    word: text(raw?.word),
    language: text(raw?.language) || 'en',
    audioUrl: mediaUrl(raw?.audio_url),
    audioStatus: nullableText(raw?.audio_status),
  };
}

function toSentencePage(res: any, page: number): WfNewOrchAudioSentencePage {
  const perPage = numberOr(res?.sentences?.per_page, ORCH_AUDIO_SENTENCE_PAGE_SIZE);
  const offset = (numberOr(res?.sentences?.page, page) - 1) * perPage;
  const items = rows(res?.sentences?.items).map((raw, index) => toSentence(raw, offset + index));
  return {
    items,
    page: numberOr(res?.sentences?.page, page),
    perPage,
    total: numberOr(res?.sentences?.total, items.length),
  };
}

export const orchAudioMethods = {
  async getOrchAudioPage(
    opts: { source?: string | null; page?: number; perPage?: number } = {},
  ): Promise<WfNewOrchAudioPage> {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? ORCH_AUDIO_DEFAULT_PAGE_SIZE;
    const res = await authedGetJSON<any>(WfNewApiPaths.orchAudioTasks(page, perPage, opts.source), null);
    const items = rows(res?.items).map(toOrchAudioItem);
    return {
      items,
      total: numberOr(res?.total, items.length),
      page: numberOr(res?.page, page),
      perPage: numberOr(res?.per_page, perPage),
      sources: rows(res?.sources)
        .map(toSourceCount)
        .filter((source): source is WfNewOrchAudioSourceCount => source !== null),
    };
  },

  async getOrchAudioDetail(id: string): Promise<WfNewOrchAudioDetail | null> {
    const res = await authedGetJSON<any>(WfNewApiPaths.orchAudioTask(id, 1, ORCH_AUDIO_SENTENCE_PAGE_SIZE), null);
    if (!res?.task) return null;
    const firstPage = toSentencePage(res, 1);
    return {
      item: toOrchAudioItem(res.task),
      segments: rows(res.segments).map(toSegment),
      firstSentencePage: firstPage,
      words: rows(res.words).map(toWord).filter((word) => word.word),
      sourceText: nullableText(res.task.source_text),
    };
  },

  async getOrchAudioSentencePage(id: string, page: number): Promise<WfNewOrchAudioSentencePage> {
    const res = await authedGetJSON<any>(WfNewApiPaths.orchAudioTask(id, page, ORCH_AUDIO_SENTENCE_PAGE_SIZE), null);
    return toSentencePage(res, page);
  },
};
