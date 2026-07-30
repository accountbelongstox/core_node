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
  ascii_name?: string;
  language?: string;
  duration_sec?: number;
  subtitle_count?: number;
  segment_count?: number;
  sentence_count?: number;
  synced_at?: string;
  /** Books only — cover art (relative URL; prepend base URL before use) + its generation status. */
  image_url?: string | null;
  poster_status?: string | null;
}

/** One row of the signed-in user's uploaded documents (GET /media/documents). */
export interface MediaDocumentListItem {
  id: number;
  title: string;
  language?: string | null;
  word_count: number;
  collection_id?: number | null;
  created_at?: string;
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

// ----- Reader (book / document) shapes -------------------------------------

/** One language cell of a v3-correspondence sentence (per-language text+audio). */
export interface ReaderLangCell {
  text: string | null;
  /** Bare storage-relative audio path `{lang}/{content_id}.mp3` — resolve via readerAudioUrl(). */
  audio: string | null;
  explanation: string | null;
  /** Authoritative "has playable audio" gate for the audio icon. */
  has_audio: boolean;
}

/**
 * One reader sentence row (books/documents share this shape).
 * Flat fields are the primary-language values; `languages` (present only when a
 * v3 correspondence is resolved) carries every language side by side.
 */
export interface ReaderSentence {
  grain: 'sentence' | 'cue';
  seq: number;
  /** Verse reference, e.g. "1:1" (Bible-style sources). */
  ref?: string | null;
  book?: string | null;
  text: string | null;
  language?: string | null;
  explanation?: string | null;
  grammar?: string | null;
  ai_commentary?: string | null;
  special_usage?: string | null;
  /** Bare storage-relative audio path (or null) — resolve via readerAudioUrl(). */
  audio?: string | null;
  occurrence_count?: number | null;
  // Present only when v3 correspondence resolved:
  corr_id?: string | number;
  chapter_index?: number;
  languages?: Record<string, ReaderLangCell>;
}

/** book/document detail: source meta + a paginated sentences slice. */
export interface ReaderDetail {
  source: Record<string, any>;
  chapter_index: number | null;
  sentences: MediaListResponse<ReaderSentence>;
}

/** One chapter of a book (per-language titles; null = that language has no row). */
export interface ReaderChapter {
  chapter_index: number;
  corr_id?: string | number | null;
  sentence_count: number;
  titles: Record<string, string | null>;
}

export interface ReaderChaptersResponse {
  source_key: string;
  languages: string[];
  chapter_count: number;
  chapters: ReaderChapter[];
}

export interface ReaderDetailParams {
  grain?: MediaGrain;
  page?: number;
  per_page?: number;
  chapter_index?: number;
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
   * Paginated list of the signed-in user's uploaded documents. Optional-auth on
   * the backend: with no bearer token it resolves as an empty page (not a 401).
   * This method does NOT check login state itself — every caller MUST gate on
   * its own `isLoggedIn` (see ExistingDocumentsPanel) and skip calling this
   * entirely while logged out, mirroring apps/wordnew's `getDocumentGroups()`.
   */
  async listDocuments(params: MediaListParams = {}): Promise<APIResponse<MediaListResponse<MediaDocumentListItem>>> {
    return this.get<MediaListResponse<MediaDocumentListItem>>('/documents', this.cleanParams(params));
  }

  /**
   * Full detail for a single subtitle source: subtitle meta + ordered
   * segments (with clip URLs) + ordered sentences (with AI fields + TTS).
   */
  async getSubtitle(sourceKey: string, grain: MediaGrain = 'sentence'): Promise<APIResponse<SubtitleDetail>> {
    const res = await this.get<SubtitleDetail>(`/subtitles/${encodeURIComponent(sourceKey)}`, { grain });
    return this.normalizeDetail(res);
  }

  /** Full detail for a single book: book meta + ordered sentences. */
  async getBook(sourceKey: string): Promise<APIResponse<BookDetail>> {
    const res = await this.get<BookDetail>(`/books/${encodeURIComponent(sourceKey)}`);
    return this.normalizeDetail(res);
  }

  // ----- Reader (paginated sentences + chapters, keeps the paginator) -----

  /**
   * One page of a book's sentences for the reader. Unlike getBook() this keeps
   * the paginator (items + total/last_page) so the reader can page. Pass
   * `chapter_index` to scope to one chapter (chapter mode).
   */
  async getBookDetail(sourceKey: string, params: ReaderDetailParams = {}): Promise<APIResponse<ReaderDetail>> {
    return this.get<ReaderDetail>(`/books/${encodeURIComponent(sourceKey)}`, this.cleanReaderParams(params));
  }

  /** Ordered chapter list for a book (per-language titles). Empty for chapterless books. */
  async getBookChapters(sourceKey: string): Promise<APIResponse<ReaderChaptersResponse>> {
    return this.get<ReaderChaptersResponse>(`/books/${encodeURIComponent(sourceKey)}/chapters`);
  }

  /**
   * One page of an uploaded document's sentences for the reader (owner-scoped,
   * needs a bearer token). Documents are chapterless, so no chapters endpoint.
   * Sentences exist only after the document has been sentence-extracted.
   */
  async getDocumentDetail(id: number | string, params: ReaderDetailParams = {}): Promise<APIResponse<ReaderDetail>> {
    return this.get<ReaderDetail>(`/documents/${encodeURIComponent(String(id))}`, this.cleanReaderParams(params));
  }

  private cleanReaderParams(params: ReaderDetailParams): Record<string, any> {
    const out: Record<string, any> = {};
    if (params.grain) out.grain = params.grain;
    if (params.page !== undefined) out.page = params.page;
    if (params.per_page !== undefined) out.per_page = params.per_page;
    if (params.chapter_index !== undefined && params.chapter_index !== null) out.chapter_index = params.chapter_index;
    return out;
  }

  /**
   * Reconcile the backend detail payload onto the FE detail/segment shape:
   *  - `sentences` comes back as a Laravel paginator object `{ items, total, ...}`
   *    — flatten it to its `items` array (consumers do `Array.isArray(sentences)`).
   *  - segment clip URLs are `mp4_url` / `full_mp4_url` / `mp3_url` on the wire,
   *    but the MediaSegment type + all consumers read `mp4` / `full_mp4` / `mp3`.
   */
  private normalizeDetail<T>(res: APIResponse<T>): APIResponse<T> {
    if (res.success && res.data && typeof res.data === 'object') {
      const d = res.data as any;

      if (d.sentences && !Array.isArray(d.sentences) && Array.isArray(d.sentences.items)) {
        d.sentences = d.sentences.items;
      }

      if (Array.isArray(d.segments)) {
        d.segments = d.segments.map((seg: any) => ({
          ...seg,
          mp4: seg.mp4 ?? seg.mp4_url,
          full_mp4: seg.full_mp4 ?? seg.full_mp4_url,
          mp3: seg.mp3 ?? seg.mp3_url
        }));
      }
    }
    return res;
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
