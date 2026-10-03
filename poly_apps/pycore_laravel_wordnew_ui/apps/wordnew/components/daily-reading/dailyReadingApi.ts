/** Daily Reading data gateway — reads canonical article rows from Laravel.
 * Pycore push only invalidates this query; Laravel remains the data authority.
 * Field fallbacks retain compatibility with older agent-history payloads. */
import { wfNewApi, type WfNewAgentArticle } from '../../api';
import { absUrl } from '../../api/WfNewApiMappers';
import type { LaravelArticleAudioReadyEvent } from '../../../../core/integrations/laravel';
import { protocolFetch } from '../../../../core/network/ProtocolFetch';

export interface DailyReadingRow extends WfNewAgentArticle {
  category: 'daily';
  title_en: string;
}

export function normalizeDailyReading(item: WfNewAgentArticle, index: number): DailyReadingRow {
  return {
    ...item,
    id: String(item.id ?? item.article_id ?? item.source_key ?? item.document_id ?? `article-${index}`),
    category: 'daily',
    title: String(item.title ?? item.title_en ?? 'Untitled article'),
    title_en: String(item.title_en ?? item.title ?? 'Untitled article'),
    title_cn: typeof item.title_cn === 'string' ? item.title_cn : null,
    article_en: typeof item.article_en === 'string' ? item.article_en : null,
    reference_cn: typeof item.reference_cn === 'string' ? item.reference_cn : null,
    audio_url: typeof item.audio_url === 'string' ? item.audio_url : null,
    audio_ready: item.audio_ready === true,
    audio_status: typeof item.audio_status === 'string' ? item.audio_status : null,
    tts_engine: typeof item.tts_engine === 'string' ? item.tts_engine : null,
    tts_model: typeof item.tts_model === 'string' ? item.tts_model : null,
    tts_chunked: item.tts_chunked === true,
    audio_generation_type: item.tts_chunked === true ? 'multi_sentence' : 'legacy',
    audio_rebuilt_at: typeof item.audio_rebuilt_at === 'string' ? item.audio_rebuilt_at : null,
    reading_date: typeof item.reading_date === 'string'
      ? item.reading_date
      : (typeof item.published_at === 'string' ? item.published_at : null),
    created_at: typeof item.created_at === 'string' ? item.created_at : null,
    word_count: typeof item.word_count === 'number' ? item.word_count : null,
    read: item.read === true,
    read_at: typeof item.read_at === 'string' ? item.read_at : null,
  };
}

export interface DailyReadingPage {
  items: DailyReadingRow[];
  total: number;
  limit: number;
  offset: number;
  statistics: {
    total: number;
    rawTotal: number;
    historicalDuplicates: number;
    multiSentence: number;
    legacyAudio: number;
    rebuilt: number;
  };
}

export async function fetchDailyReadings(limit = 100, offset = 0): Promise<DailyReadingPage> {
  const page = await wfNewApi.getAgentArticlesPage(limit, offset);
  return {
    ...page,
    items: page.items.map((item, index) => normalizeDailyReading(item, offset + index)),
    statistics: page.statistics ?? {
      total: page.total,
      rawTotal: page.total,
      historicalDuplicates: 0,
      multiSentence: 0,
      legacyAudio: 0,
      rebuilt: 0,
    },
  };
}

export interface DailyReadingFeedPage {
  items: DailyReadingRow[];
  total: number;
  hasMore: boolean;
  nextCursor: number | null;
}

/** One cursor page of a day's articles with the signed-in user's read flags. */
export async function fetchDailyReadingFeed(
  date: string | null,
  cursor: number | null,
  limit: number,
): Promise<DailyReadingFeedPage> {
  const page = await wfNewApi.getDailyReadingFeed(date, cursor, limit);
  return {
    items: page.items.map((item, index) => normalizeDailyReading(item, index)),
    total: page.total,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

export function applyDailyReadingAudioReady(
  row: DailyReadingRow,
  payload: LaravelArticleAudioReadyEvent,
): DailyReadingRow {
  if (row.id !== payload.article_id && row.article_id !== payload.article_id) return row;
  const audioUrl = payload.audio_url ? (absUrl(payload.audio_url) ?? row.audio_url) : row.audio_url;
  return {
    ...row,
    audio_url: audioUrl,
    audio_ready: true,
    audio_status: 'ready',
    tts_engine: payload.tts_engine ?? row.tts_engine,
    tts_model: payload.tts_model ?? row.tts_model,
    tts_chunked: payload.tts_chunked ?? row.tts_chunked,
    audio_generation_type: payload.tts_chunked === true ? 'multi_sentence' : row.audio_generation_type,
    audio_rebuilt_at: payload.audio_rebuilt_at ?? row.audio_rebuilt_at,
  };
}

export async function requestDailyReadingAudio(row: DailyReadingRow): Promise<void> {
  if (!row.audio_url || row.audio_ready) return;
  await protocolFetch(row.audio_url, {
    method: 'GET',
    cache: 'no-store',
    mode: 'no-cors',
  });
}
