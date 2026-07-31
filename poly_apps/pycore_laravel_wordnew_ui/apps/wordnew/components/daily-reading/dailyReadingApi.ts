/** Daily Reading data gateway — reads canonical article rows from Laravel.
 * Pycore push only invalidates this query; Laravel remains the data authority.
 * Field fallbacks retain compatibility with older agent-history payloads. */
import { wfNewApi } from '../../api';
import {
  normalizeArticleItem,
  type ArticleItem,
} from '@/apps/wordnew/integrations/laravel';

export type DailyReadingRow = ArticleItem;

export async function fetchDailyReadings(limit = 20): Promise<DailyReadingRow[]> {
  const items = await wfNewApi.getRecentAgentArticles(limit);
  return items.map((item, index) => normalizeArticleItem({ ...item, category: 'daily' }, index));
}
