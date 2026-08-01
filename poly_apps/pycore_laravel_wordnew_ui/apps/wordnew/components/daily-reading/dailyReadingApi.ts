/** Daily Reading data gateway — reads canonical article rows from Laravel.
 * Pycore push only invalidates this query; Laravel remains the data authority.
 * Field fallbacks retain compatibility with older agent-history payloads. */
import { wfNewApi, type WfNewAgentArticle } from '../../api';

export interface DailyReadingRow extends WfNewAgentArticle {
  category: 'daily';
  title_en: string;
}

function normalizeDailyReading(item: WfNewAgentArticle, index: number): DailyReadingRow {
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
    reading_date: typeof item.reading_date === 'string'
      ? item.reading_date
      : (typeof item.published_at === 'string' ? item.published_at : null),
    created_at: typeof item.created_at === 'string' ? item.created_at : null,
    word_count: typeof item.word_count === 'number' ? item.word_count : null,
  };
}

export async function fetchDailyReadings(limit = 20): Promise<DailyReadingRow[]> {
  const items = await wfNewApi.getRecentAgentArticles(limit);
  return items.map(normalizeDailyReading);
}
