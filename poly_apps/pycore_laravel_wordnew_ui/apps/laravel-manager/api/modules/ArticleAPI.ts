import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';
import { LARAVEL_API_ROUTE } from '../ApiContract';

const ARTICLE_DELETE_TIMEOUT_MS = 120000;

export interface ArticleItem {
  id: string;
  article_id?: string | null;
  source_key?: string | null;
  category: string;
  source?: string | null;
  article_type?: string | null;
  title?: string | null;
  title_en: string;
  title_cn?: string | null;
  article_en?: string | null;
  reference_cn?: string | null;
  language?: string | null;
  difficulty_level?: string | null;
  word_count?: number | null;
  unique_word_count?: number | null;
  sentence_count?: number | null;
  is_daily_reading?: boolean;
  tts_generated?: boolean;
  task_id?: string | null;
  audio_url?: string | null;
  document_id?: string | number | null;
  reading_date?: string | null;
  created_at?: string | null;
  published_at?: string | null;
}

export interface ArticleList {
  items: ArticleItem[];
  total: number;
  limit: number;
  offset: number;
  categories: Record<string, number>;
}

export interface ArticleDeleteResult {
  article_id: string;
  category: string;
  article_words_deleted: number;
  document_deleted: boolean;
  audio_deleted: boolean;
}

export interface ArticleBatchDeleteResult {
  deleted: ArticleDeleteResult[];
  deleted_count: number;
}

export function normalizeArticleItem(raw: Partial<ArticleItem>, index = 0): ArticleItem {
  const id = String(raw.id ?? raw.article_id ?? raw.source_key ?? raw.document_id ?? `article-${index}`);
  const title = String(raw.title_en ?? raw.title ?? 'Untitled article');
  const category = typeof raw.category === 'string' && raw.category !== ''
    ? raw.category
    : (raw.is_daily_reading ? 'daily' : String(raw.article_type ?? 'general'));

  return {
    ...raw,
    id,
    category,
    title_en: title,
    title_cn: typeof raw.title_cn === 'string' ? raw.title_cn : null,
    article_en: typeof raw.article_en === 'string' ? raw.article_en : null,
    reference_cn: typeof raw.reference_cn === 'string' ? raw.reference_cn : null,
    audio_url: typeof raw.audio_url === 'string' ? raw.audio_url : null,
    reading_date: typeof raw.reading_date === 'string'
      ? raw.reading_date
      : (typeof raw.published_at === 'string' ? raw.published_at : null),
    created_at: typeof raw.created_at === 'string' ? raw.created_at : null,
    word_count: typeof raw.word_count === 'number' ? raw.word_count : null,
  };
}

export class ArticleAPI extends BaseAPI {
  async list(params?: { limit?: number; offset?: number; category?: string }): Promise<APIResponse<ArticleList>> {
    const response = await this.get<ArticleList>(LARAVEL_API_ROUTE.articles.list, params);

    if (response.success && response.data && Array.isArray(response.data.items)) {
      response.data.items = response.data.items.map((item, index) => normalizeArticleItem(item, index));
    }

    return response;
  }

  async remove(articleId: string): Promise<APIResponse<ArticleDeleteResult>> {
    return this.request<ArticleDeleteResult>({
      url: LARAVEL_API_ROUTE.articles.byId(articleId),
      method: 'DELETE',
      timeout: ARTICLE_DELETE_TIMEOUT_MS,
      retry: false,
    });
  }

  async removeMany(articleIds: string[]): Promise<APIResponse<ArticleBatchDeleteResult>> {
    return this.request<ArticleBatchDeleteResult>({
      url: LARAVEL_API_ROUTE.articles.batchDelete,
      method: 'POST',
      data: { article_ids: articleIds },
      timeout: ARTICLE_DELETE_TIMEOUT_MS,
      retry: false,
    });
  }
}
