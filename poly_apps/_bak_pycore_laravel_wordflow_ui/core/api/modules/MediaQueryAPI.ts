import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * MediaQueryAPI – read-only browser for ingested subtitle sources (movies)
 * and books, plus their ordered sentences / segment clips.
 *
 * Backed by laravel_main :9000 under the prefix `/api/app_qy_v1/media`.
 * Every method returns the unwrapped ApiResponse `data` payload (BaseAPI
 * already strips the `{ data }` envelope), so callers read `res.data`.
 *
 * Clip / audio URLs returned by the backend are RELATIVE (e.g.
 * `/api/app_qy_v1/media/clip/{key}/{name}`). The UI must prepend the live
 * base URL — see `resolveMediaUrl()` in the view — never call these directly.
 */

// ----- Paginated list item shapes -----------------------------------------

export interface MediaSourceListItem {
  source_key: string;
  title: string;
  original_name?: string;
  language?: string;
  duration_sec?: number;
  subtitle_count?: number;
  segment_count?: number;
  sentence_count?: number;
  synced_at?: string;
}

export interface MediaListResponse<T = MediaSourceListItem> {
  items: T[];
  total: number;
  per_page: number;
  current_page: number;
  last_page: number;
}

export interface MediaListParams {
  page?: number;
  per_page?: number;
  language?: string;
  search?: string;
}

// ----- Detail shapes -------------------------------------------------------

export interface MediaSegment {
  seg_index: number;
  start_sec: number;
  end_sec: number;
  sub_idx_start?: number;
  sub_idx_end?: number;
  subtitle_count?: number;
  /** RELATIVE clip URLs — prepend base URL before use. */
  mp4?: string;
  full_mp4?: string;
  mp3?: string;
}

export type MediaGrain = 'sentence' | 'cue' | 'all';

export interface MediaSentence {
  grain?: MediaGrain;
  seq: number;
  seg_index?: number;
  sub_idx?: number;
  start_sec?: number;
  end_sec?: number;
  text: string;
  language?: string;
  explanation?: string;
  grammar?: string;
  ai_commentary?: string;
  special_usage?: string;
  /** RELATIVE TTS audio URL — prepend base URL before use. */
  audio?: string;
  occurrence_count?: number;
}

export interface SubtitleDetail {
  subtitle: Record<string, any> & { files?: Record<string, any> };
  segments: MediaSegment[];
  sentences: MediaSentence[];
}

export interface BookDetail {
  book: Record<string, any>;
  sentences: MediaSentence[];
}

/**
 * MediaQueryAPI module. Prefix is configured in core/api/index.ts.
 */
export class MediaQueryAPI extends BaseAPI {
  /** Paginated list of ingested subtitle sources (movies). */
  async listSubtitles(params: MediaListParams = {}): Promise<APIResponse<MediaListResponse>> {
    return this.get<MediaListResponse>('/subtitles', this.cleanParams(params));
  }

  /** Paginated list of ingested books. */
  async listBooks(params: MediaListParams = {}): Promise<APIResponse<MediaListResponse>> {
    return this.get<MediaListResponse>('/books', this.cleanParams(params));
  }

  /**
   * Full detail for a single subtitle source: subtitle meta + ordered
   * segments (with clip URLs) + ordered sentences (with AI fields + TTS).
   */
  async getSubtitle(sourceKey: string, grain: MediaGrain = 'sentence'): Promise<APIResponse<SubtitleDetail>> {
    return this.get<SubtitleDetail>(`/subtitles/${encodeURIComponent(sourceKey)}`, { grain });
  }

  /** Full detail for a single book: book meta + ordered sentences. */
  async getBook(sourceKey: string): Promise<APIResponse<BookDetail>> {
    return this.get<BookDetail>(`/books/${encodeURIComponent(sourceKey)}`);
  }

  /** Drop undefined / empty params so they don't show up as `?search=`. */
  private cleanParams(params: MediaListParams): Record<string, any> {
    const out: Record<string, any> = {};
    if (params.page !== undefined) out.page = params.page;
    if (params.per_page !== undefined) out.per_page = params.per_page;
    if (params.language) out.language = params.language;
    if (params.search) out.search = params.search;
    return out;
  }
}
