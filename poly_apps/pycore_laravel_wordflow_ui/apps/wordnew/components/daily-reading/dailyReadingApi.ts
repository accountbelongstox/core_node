/** Daily Reading data gateway — polls the Laravel article worker's recent
 * endpoint only (wordnew never calls pycore directly). Field fallbacks keep
 * the block backward-compatible with both the `articles|rows` reading payload
 * and the older `data.items|items` agent-history shape. */
import { wfNewApi } from '../../api';

export interface DailyReadingRow {
  id: string;
  title_en: string;
  title_cn?: string | null;
  article_en?: string | null;
  reference_cn?: string | null;
  audio_url?: string | null;
  reading_date?: string | null;
  created_at?: string | null;
  document_id?: string | null;
  source_key?: string | null;
  word_count?: number | null;
}

export async function fetchDailyReadings(limit = 20): Promise<DailyReadingRow[]> {
  const items = await wfNewApi.getRecentAgentArticles(limit);
  return items.map((item) => ({
    id: item.id,
    title_en: item.title_en ?? item.title,
    title_cn: item.title_cn ?? null,
    article_en: item.article_en ?? null,
    reference_cn: item.reference_cn ?? null,
    audio_url: item.audio_url ?? null,
    reading_date: item.reading_date ?? item.published_at ?? null,
    created_at: item.created_at ?? null,
    document_id: item.document_id ?? null,
    source_key: item.source_key ?? item.article_id ?? item.document_id ?? null,
    word_count: item.word_count ?? null,
  }));
}
