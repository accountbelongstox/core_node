/**
 * Duoreader → Laravel Books v3 ingest core (shared by background service + popup).
 */

import { normalizeCoverUrls } from '@/utils/cover-playback';
import { MEDIA_PATHS } from '@/utils/api-paths';
import { STORAGE_KEYS } from '@/utils/storage-keys';

export const DUOREADER_SHELF_URL = 'https://duoreader.cn/assets/shelf.json';
export const DUOREADER_WEB_BASE = 'https://web.duoreader.cn';
// API paths re-exported from the central registry so existing importers keep
// their names while the value lives in one place.
export const INGEST_PATH = MEDIA_PATHS.INGEST;
export const AUDIO_PATH = MEDIA_PATHS.AUDIO;
export const BOOK_INGEST_STATUS_PATH = MEDIA_PATHS.BOOKS;
export const PROGRESS_STORAGE_KEY = STORAGE_KEYS.DUOREADER_IMPORT_PROGRESS;
export const STATE_STORAGE_KEY = STORAGE_KEYS.DUOREADER_IMPORT_STATE;
export const SESSION_STORAGE_KEY = STORAGE_KEYS.DUOREADER_IMPORT_SESSION;

export interface DuoreaderBookMeta {
  id: string;
  titleEn: string;
  titleZh: string;
  authorEn: string;
  authorZh: string;
  /** Primary cover (first of coverUrls). */
  coverUrl: string;
  /** Up to 5 search/shelf cover URLs for carousel + backend metadata. */
  coverUrls: string[];
  sectionTagEn: string;
  sectionTagZh: string;
  langs: string[];
}

export interface DuoreaderParagraph {
  seq: number;
  en: string;
  zh: string;
}

export interface DuoreaderChapter {
  segmentIndex: number;
  articleIndex: number;
  chapterIndex: number;
  titleZh: string;
  titleEn: string;
  paragraphs: DuoreaderParagraph[];
}

export type DuoreaderImportStep =
  | 'idle'
  | 'catalog'
  | 'scrape'
  | 'upload'
  | 'audio'
  | 'skip'
  | 'done';

export interface DuoreaderImportProgress {
  running: boolean;
  /** True when user paused — job stays alive, counters preserved. */
  paused: boolean;
  phase: string;
  /** High-level step for UI badges. */
  step: DuoreaderImportStep;
  /** Secondary line: batch/round/slot detail. */
  detail: string;
  bookId: string;
  bookTitle: string;
  booksTotal: number;
  booksDone: number;
  chaptersTotal: number;
  /** Chapters scraped/fetched this book. */
  chaptersScraped: number;
  /** Chapters uploaded (or skipped as complete) this book. */
  chaptersDone: number;
  chaptersSkipped: number;
  /** 1-based chapter index currently being processed. */
  chapterCurrent: number;
  /** Paragraph/slot count for the active chapter. */
  chapterSlotsExpected: number;
  /** Slots uploaded for the active chapter (0 when skipping upload). */
  chapterSlotsUploaded: number;
  slotsIngested: number;
  /** Duoreader audio clips fetched+uploaded this session (per language). */
  audioFetchedLearn: number;
  audioFetchedMy: number;
  /** Sentence slots queued for audio this book (for progress bar). */
  audioSlotsTarget: number;
  audioLang: string;
  audioSlot: number;
  audioSlotsTotal: number;
  scrapePct: number;
  uploadPct: number;
  /** Rough audio coverage vs uploaded slots (both langs). */
  audioPct: number;
  /** True while background audio queue is still draining. */
  audioPending: boolean;
  error: string;
  updatedAt: string;
}

export interface BackendChapterAudioLangStatus {
  expected: number;
  with_audio: number;
  complete: boolean;
}

export interface BackendIngestSlotStatus {
  seq: number;
  corr_id?: string;
  lang_content_ids: Record<string, string>;
  audio: Record<string, boolean>;
  text?: Record<string, string>;
}

export interface BackendChapterIngestStatus {
  chapter_index: number;
  sentence_count: number;
  slot_count: number;
  /** Legacy alias: text ingest complete for this chapter. */
  complete: boolean;
  text_complete: boolean;
  audio_complete?: boolean;
  audio?: Record<string, BackendChapterAudioLangStatus>;
  slots?: BackendIngestSlotStatus[];
}

export interface BookIngestStatus {
  book_exists: boolean;
  total_slots: number;
  text_complete?: boolean;
  audio_complete?: boolean;
  variant_key?: string;
  languages?: string[];
  chapters: BackendChapterIngestStatus[];
  chapterMap: Map<number, BackendChapterIngestStatus>;
}

export interface IngestStatusQuery {
  langs?: string[];
  variantKey?: string;
  includeSlots?: boolean;
  includeText?: boolean;
}

export interface DuoreaderImporterConfig {
  myLang: string;
  learnLang: string;
  bookChunkSize: number;
  /** Fetch sentence MP3 from Duoreader API and upload to Laravel. */
  enableAudioFetch: boolean;
  maxBooks: number;
  bookIds: string[];
  /** Fetch chapters from Duoreader CDN .pz API (fast) instead of DOM scrape. */
  useCdnApi: boolean;
  /** When loading catalog, search Google/Bing images for book covers. */
  enrichCoversFromSearch: boolean;
  /** Re-upload chapter text even when backend already has it (audio stays idempotent). */
  forceReplaceUpload: boolean;
}

export type DuoreaderImportInterruptReason = 'stop' | 'pause' | '';

export interface DuoreaderImportSession {
  config: DuoreaderImporterConfig;
  interrupted: boolean;
  reason: DuoreaderImportInterruptReason;
  updatedAt: string;
}

export const DEFAULT_IMPORTER_CONFIG: DuoreaderImporterConfig = {
  myLang: 'zh',
  learnLang: 'en',
  bookChunkSize: 80,
  enableAudioFetch: true,
  maxBooks: 0,
  bookIds: [],
  useCdnApi: false,
  enrichCoversFromSearch: false,
  forceReplaceUpload: false,
};

/** Strip punctuation/symbols (Unicode P/S) — mirrors Laravel MediaIngestService. */
export function stripPunctuation(text: string): string {
  if (!text) return '';
  const out = text.replace(/[\p{P}\p{S}]/gu, ' ');
  return out ?? text;
}

/** md5 hex digest for content_id (browser-safe, no Node crypto). */
export function md5Hex(input: string): string {
  const data = new TextEncoder().encode(input);
  const wordCount = (((data.length + 8) >> 6) + 1) * 16;
  const words = new Array<number>(wordCount).fill(0);
  for (let i = 0; i < data.length; i += 1) {
    words[i >> 2] |= data[i] << ((i % 4) * 8);
  }
  words[data.length >> 2] |= 0x80 << ((data.length % 4) * 8);
  words[wordCount - 2] = data.length * 8;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const rot = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const ff = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = aa + ((bb & cc) | (~bb & dd)) + x + t;
    return (rot(r, s) + bb) | 0;
  };
  const gg = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = aa + ((bb & dd) | (cc & ~dd)) + x + t;
    return (rot(r, s) + bb) | 0;
  };
  const hh = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = aa + (bb ^ cc ^ dd) + x + t;
    return (rot(r, s) + bb) | 0;
  };
  const ii = (aa: number, bb: number, cc: number, dd: number, x: number, s: number, t: number) => {
    const r = aa + (cc ^ (bb | ~dd)) + x + t;
    return (rot(r, s) + bb) | 0;
  };

  for (let i = 0; i < words.length; i += 16) {
    const oa = a;
    const ob = b;
    const oc = c;
    const od = d;

    a = ff(a, b, c, d, words[i], 7, 0xd76aa478);
    d = ff(d, a, b, c, words[i + 1], 12, 0xe8c7b756);
    c = ff(c, d, a, b, words[i + 2], 17, 0x242070db);
    b = ff(b, c, d, a, words[i + 3], 22, 0xc1bdceee);
    a = ff(a, b, c, d, words[i + 4], 7, 0xf57c0faf);
    d = ff(d, a, b, c, words[i + 5], 12, 0x4787c62a);
    c = ff(c, d, a, b, words[i + 6], 17, 0xa8304613);
    b = ff(b, c, d, a, words[i + 7], 22, 0xfd469501);
    a = ff(a, b, c, d, words[i + 8], 7, 0x698098d8);
    d = ff(d, a, b, c, words[i + 9], 12, 0x8b44f7af);
    c = ff(c, d, a, b, words[i + 10], 17, 0xffff5bb1);
    b = ff(b, c, d, a, words[i + 11], 22, 0x895cd7be);
    a = ff(a, b, c, d, words[i + 12], 7, 0x6b901122);
    d = ff(d, a, b, c, words[i + 13], 12, 0xfd987193);
    c = ff(c, d, a, b, words[i + 14], 17, 0xa679438e);
    b = ff(b, c, d, a, words[i + 15], 22, 0x49b40821);

    a = gg(a, b, c, d, words[i + 1], 5, 0xf61e2562);
    d = gg(d, a, b, c, words[i + 6], 9, 0xc040b340);
    c = gg(c, d, a, b, words[i + 11], 14, 0x265e5a51);
    b = gg(b, c, d, a, words[i], 20, 0xe9b6c7aa);
    a = gg(a, b, c, d, words[i + 5], 5, 0xd62f105d);
    d = gg(d, a, b, c, words[i + 10], 9, 0x02441453);
    c = gg(c, d, a, b, words[i + 15], 14, 0xd8a1e681);
    b = gg(b, c, d, a, words[i + 4], 20, 0xe7d3fbc8);
    a = gg(a, b, c, d, words[i + 9], 5, 0x21e1cde6);
    d = gg(d, a, b, c, words[i + 14], 9, 0xc33707d6);
    c = gg(c, d, a, b, words[i + 3], 14, 0xf4d50d87);
    b = gg(b, c, d, a, words[i + 8], 20, 0x455a14ed);
    a = gg(a, b, c, d, words[i + 13], 5, 0xa9e3e905);
    d = gg(d, a, b, c, words[i + 2], 9, 0xfcefa3f8);
    c = gg(c, d, a, b, words[i + 7], 14, 0x676f02d9);
    b = gg(b, c, d, a, words[i + 12], 20, 0x8d2a4c8a);

    a = hh(a, b, c, d, words[i + 5], 4, 0xfffa3942);
    d = hh(d, a, b, c, words[i + 8], 11, 0x8771f681);
    c = hh(c, d, a, b, words[i + 11], 16, 0x6d9d6122);
    b = hh(b, c, d, a, words[i + 14], 23, 0xfde5380c);
    a = hh(a, b, c, d, words[i + 1], 4, 0xa4beea44);
    d = hh(d, a, b, c, words[i + 4], 11, 0x4bdecfa9);
    c = hh(c, d, a, b, words[i + 7], 16, 0xf6bb4b60);
    b = hh(b, c, d, a, words[i + 10], 23, 0xbebfbc70);
    a = hh(a, b, c, d, words[i + 13], 4, 0x289b7ec6);
    d = hh(d, a, b, c, words[i], 11, 0xeaa127fa);
    c = hh(c, d, a, b, words[i + 3], 16, 0xd4ef3085);
    b = hh(b, c, d, a, words[i + 6], 23, 0x04881d05);
    a = hh(a, b, c, d, words[i + 9], 4, 0xd9d4d039);
    d = hh(d, a, b, c, words[i + 12], 11, 0xe6db99e5);
    c = hh(c, d, a, b, words[i + 15], 16, 0x1fa27cf8);
    b = hh(b, c, d, a, words[i + 2], 23, 0xc4ac5665);

    a = ii(a, b, c, d, words[i], 6, 0xf4292244);
    d = ii(d, a, b, c, words[i + 7], 10, 0x432aff97);
    c = ii(c, d, a, b, words[i + 14], 15, 0xab9423a7);
    b = ii(b, c, d, a, words[i + 5], 21, 0xfc93a039);
    a = ii(a, b, c, d, words[i + 12], 6, 0x655b59c3);
    d = ii(d, a, b, c, words[i + 3], 10, 0x8f0ccc92);
    c = ii(c, d, a, b, words[i + 10], 15, 0xffeff47d);
    b = ii(b, c, d, a, words[i + 1], 21, 0x85845dd1);
    a = ii(a, b, c, d, words[i + 8], 6, 0x6fa87e4f);
    d = ii(d, a, b, c, words[i + 15], 10, 0xfe2ce6e0);
    c = ii(c, d, a, b, words[i + 6], 15, 0xa3014314);
    b = ii(b, c, d, a, words[i + 13], 21, 0x4e0811a1);
    a = ii(a, b, c, d, words[i + 4], 6, 0xf7537e82);
    d = ii(d, a, b, c, words[i + 11], 10, 0xbd3af235);
    c = ii(c, d, a, b, words[i + 2], 15, 0x2ad7d2bb);
    b = ii(b, c, d, a, words[i + 9], 21, 0xeb86d391);

    a = (a + oa) | 0;
    b = (b + ob) | 0;
    c = (c + oc) | 0;
    d = (d + od) | 0;
  }

  const toHex = (n: number) => {
    let s = '';
    for (let i = 0; i < 4; i += 1) {
      s += ((n >> (i * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return s;
  };
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

/** Laravel content_id = md5(lower(strip_punct(text)) with collapsed spaces). */
export function computeContentId(text: string): string {
  const stripped = stripPunctuation(text);
  const normalized = stripped.toLowerCase().trim().replace(/\s+/g, ' ');
  return md5Hex(normalized);
}

export async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sourceKeyForBookAsync(bookId: string): Promise<string> {
  const digest = await sha1Hex(`duoreader:${bookId}`);
  return `duoreader_${digest.slice(0, 40)}`;
}

export async function corrId(sourceKey: string, grain: string, seq: number): Promise<string> {
  return sha1Hex(`${sourceKey}|${grain}|${seq}`);
}

export async function fetchShelf(): Promise<any> {
  const res = await fetch(DUOREADER_SHELF_URL);
  if (!res.ok) {
    throw new Error(`Shelf HTTP ${res.status}`);
  }
  return res.json();
}

/** Duoreader shelf section for literature (名著), not FAO news articles. */
export const DUOREADER_CLASSICS_SECTION_EN = 'Classics';

/**
 * Literature entries in shelf.json carry detailed_metadata_available; FAO articles use fao_* ids.
 * Web UI lists them under separate sections (名著 vs 联合国粮农组织).
 */
export function isDuoreaderLiteratureBook(book: any): boolean {
  const id = String(book?.id || '');
  if (!id || id.startsWith('fao_')) return false;
  return book.detailed_metadata_available === true;
}

export function listBilingualBooks(shelf: any, config: DuoreaderImporterConfig): DuoreaderBookMeta[] {
  const myLang = config.myLang;
  const learnLang = config.learnLang;
  const allowSet = new Set(config.bookIds || []);
  const hasAllow = allowSet.size > 0;
  const books: DuoreaderBookMeta[] = [];

  for (const section of shelf.sections || []) {
    for (const book of section.books || []) {
      if (!book?.id) continue;
      if (!isDuoreaderLiteratureBook(book)) continue;
      if (hasAllow && !allowSet.has(book.id)) continue;
      const langs: string[] = book.langs || [];
      if (!langs.includes(myLang) || !langs.includes(learnLang)) continue;
      const shelfCover = book.coverUrl || '';
      const coverUrls = normalizeCoverUrls(shelfCover);
      books.push({
        id: book.id,
        titleEn: book.title?.en || book.title?.[learnLang] || book.id,
        titleZh: book.title?.zh || book.title?.[myLang] || '',
        authorEn: book.author?.name?.en || book.author?.en || '',
        authorZh: book.author?.name?.zh || book.author?.zh || '',
        coverUrl: coverUrls[0] || '',
        coverUrls,
        sectionTagEn: section.tag_name?.en || '',
        sectionTagZh: section.tag_name?.zh || '',
        langs,
      });
    }
  }

  if (config.maxBooks > 0) {
    return books.slice(0, config.maxBooks);
  }
  return books;
}

export async function buildSource(
  book: DuoreaderBookMeta,
  chapter: DuoreaderChapter,
  config: DuoreaderImporterConfig,
): Promise<Record<string, unknown>> {
  const sourceKey = await sourceKeyForBookAsync(book.id);
  const parts: string[] = [];
  for (const p of chapter.paragraphs) {
    if (p.en) parts.push(p.en);
    if (p.zh) parts.push(p.zh);
  }
  return {
    source_key: sourceKey,
    title: book.titleEn,
    original_name: `${book.id}.duoreader`,
    ascii_name: book.id,
    language: config.learnLang,
    selected_languages: [config.learnLang, config.myLang],
    full_content: parts.join('\n'),
    metadata: {
      duoreader_id: book.id,
      provider: 'duoreader',
      titles: { [config.learnLang]: book.titleEn, [config.myLang]: book.titleZh },
      author: { [config.learnLang]: book.authorEn, [config.myLang]: book.authorZh },
      cover_url: book.coverUrl,
      cover_urls: book.coverUrls?.length ? book.coverUrls : (book.coverUrl ? [book.coverUrl] : []),
      section: { [config.learnLang]: book.sectionTagEn, [config.myLang]: book.sectionTagZh },
      seeded_languages: [config.learnLang, config.myLang],
    },
  };
}

export async function buildSlots(
  bookId: string,
  chapter: DuoreaderChapter,
  config: DuoreaderImporterConfig,
  globalSeqStart: number,
): Promise<Record<string, unknown>[]> {
  const sourceKey = await sourceKeyForBookAsync(bookId);
  const slots: Record<string, unknown>[] = [];
  let seq = globalSeqStart;

  for (const paragraph of chapter.paragraphs) {
    const langs: Record<string, string | null> = {};
    langs[config.learnLang] = paragraph.en || null;
    langs[config.myLang] = paragraph.zh || null;
    if (!langs[config.learnLang] && !langs[config.myLang]) continue;
    slots.push({
      chapter_index: chapter.chapterIndex,
      grain: 'sentence',
      seq,
      corr_id: await corrId(sourceKey, 'sentence', seq),
      primary_language: config.learnLang,
      langs,
      metadata: {
        duoreader_article_index: chapter.articleIndex,
        duoreader_segment_index: chapter.segmentIndex || 0,
        duoreader_paragraph_seq: paragraph.seq,
      },
    });
    seq += 1;
  }
  return slots;
}

export async function fetchBookIngestStatus(
  baseUrl: string,
  sourceKey: string,
  query: IngestStatusQuery = {},
): Promise<BookIngestStatus> {
  const empty: BookIngestStatus = {
    book_exists: false,
    total_slots: 0,
    chapters: [],
    chapterMap: new Map(),
  };
  try {
    const params = new URLSearchParams();
    if (query.langs?.length) {
      params.set('langs', query.langs.join(','));
    }
    if (query.variantKey) {
      params.set('variant_key', query.variantKey);
    }
    if (query.includeSlots) {
      params.set('include_slots', '1');
    }
    if (query.includeText) {
      params.set('include_text', '1');
    }
    const qs = params.toString();
    const url = `${baseUrl.replace(/\/+$/, '')}${BOOK_INGEST_STATUS_PATH}/${encodeURIComponent(sourceKey)}/ingest-status${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) {
      return empty;
    }
    const json = await res.json();
    const data = json?.data || json;
    const chapters: BackendChapterIngestStatus[] = Array.isArray(data?.chapters)
      ? data.chapters.map((row: BackendChapterIngestStatus) => ({
          chapter_index: Number(row.chapter_index),
          sentence_count: Number(row.sentence_count) || 0,
          slot_count: Number(row.slot_count) || 0,
          complete: !!(row.text_complete ?? row.complete),
          text_complete: !!(row.text_complete ?? row.complete),
          audio_complete: row.audio_complete !== undefined ? !!row.audio_complete : undefined,
          audio: row.audio,
          slots: Array.isArray(row.slots) ? row.slots : undefined,
        }))
      : [];
    const chapterMap = new Map<number, BackendChapterIngestStatus>();
    for (const row of chapters) {
      chapterMap.set(row.chapter_index, row);
    }
    return {
      book_exists: !!data?.book_exists,
      total_slots: Number(data?.total_slots) || 0,
      text_complete: data?.text_complete !== undefined ? !!data.text_complete : undefined,
      audio_complete: data?.audio_complete !== undefined ? !!data.audio_complete : undefined,
      variant_key: data?.variant_key,
      languages: Array.isArray(data?.languages) ? data.languages : undefined,
      chapters,
      chapterMap,
    };
  } catch {
    return empty;
  }
}

/** Cumulative global seq offset before chapterIndex (for stable slot seq across chapters). */
export function globalSeqBeforeChapter(
  chapterIndex: number,
  status: BookIngestStatus,
): number {
  let seq = 0;
  const sorted = [...status.chapters].sort((a, b) => a.chapter_index - b.chapter_index);
  for (const row of sorted) {
    if (row.chapter_index >= chapterIndex) break;
    if (row.sentence_count > 0) {
      seq += row.sentence_count;
    } else {
      seq += row.slot_count;
    }
  }
  return seq;
}

/** True when backend already has all text slots for this chapter (skip text upload). */
export function isChapterTextCompleteOnBackend(
  backendChapter: BackendChapterIngestStatus | undefined,
  expectedParagraphs?: number,
): boolean {
  if (!backendChapter) return false;
  const expected = expectedParagraphs ?? backendChapter.sentence_count;
  if (expected > 0) {
    return backendChapter.slot_count >= expected && backendChapter.sentence_count >= expected;
  }
  return backendChapter.text_complete || backendChapter.complete;
}

/** True when all requested langs have audio for every slot (variant-aware on backend). */
export function isChapterAudioCompleteOnBackend(
  backendChapter: BackendChapterIngestStatus | undefined,
  enableAudioFetch: boolean,
): boolean {
  if (!enableAudioFetch) return true;
  return !!backendChapter?.audio_complete;
}

/** Skip CDN/DOM fetch when text is already on backend. */
export function canSkipChapterTextFetch(backendChapter: BackendChapterIngestStatus | undefined): boolean {
  return isChapterTextCompleteOnBackend(backendChapter) && (backendChapter?.sentence_count ?? 0) > 0;
}

/** Match backend chapter row by Duoreader article index (legacy) or dense chapter_index. */
export function resolveBackendChapter(
  ingestStatus: BookIngestStatus,
  articleIndex: number,
  denseChapterIndex: number,
): BackendChapterIngestStatus | undefined {
  return ingestStatus.chapterMap.get(articleIndex)
    ?? ingestStatus.chapterMap.get(denseChapterIndex);
}

/** Skip entire chapter (text + audio) when both layers are complete. */
export function canSkipFullChapter(
  backendChapter: BackendChapterIngestStatus | undefined,
  enableAudioFetch: boolean,
): boolean {
  return canSkipChapterTextFetch(backendChapter)
    && isChapterAudioCompleteOnBackend(backendChapter, enableAudioFetch);
}

/** Seed chapter total and reset per-book counters when opening a book (resume-safe). */
export function seedBookProgressFromBackend(
  progress: DuoreaderImportProgress,
  ingestStatus: BookIngestStatus,
  chaptersTotal: number,
  enableAudioFetch: boolean,
  preserveCounters = false,
): void {
  progress.chaptersTotal = chaptersTotal;
  if (!preserveCounters) {
    progress.chaptersScraped = 0;
    progress.chaptersDone = 0;
    progress.chaptersSkipped = 0;
    progress.chapterSlotsExpected = 0;
    progress.chapterSlotsUploaded = 0;
    progress.slotsIngested = 0;
    progress.scrapePct = 0;
    progress.uploadPct = 0;
    progress.audioFetchedLearn = 0;
    progress.audioFetchedMy = 0;
    progress.audioSlotsTarget = 0;
    progress.audioLang = '';
    progress.audioSlot = 0;
    progress.audioSlotsTotal = 0;
    progress.audioPct = 0;
    progress.step = 'idle';
  }

  for (let i = 0; i < chaptersTotal; i += 1) {
    const ch = ingestStatus.chapterMap.get(i);
    if (!canSkipFullChapter(ch, enableAudioFetch)) {
      progress.chapterCurrent = i + 1;
      return;
    }
  }
  progress.chapterCurrent = chaptersTotal > 0 ? chaptersTotal : 0;
}

/** @deprecated Use canSkipChapterTextFetch or canSkipFullChapter */
export function canSkipChapterFetch(backendChapter: BackendChapterIngestStatus | undefined): boolean {
  return canSkipChapterTextFetch(backendChapter);
}

export function ingestStatusQueryForConfig(cfg: DuoreaderImporterConfig): IngestStatusQuery {
  return {
    langs: [cfg.learnLang, cfg.myLang],
    variantKey: DUOREADER_AUDIO_VARIANT_KEY,
    includeSlots: cfg.enableAudioFetch,
    includeText: cfg.enableAudioFetch,
  };
}

export async function postIngest(
  baseUrl: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; detail: string }> {
  const url = `${baseUrl.replace(/\/+$/, '')}${INGEST_PATH}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  return {
    ok: res.status >= 200 && res.status < 300,
    status: res.status,
    detail: text.slice(0, 300),
  };
}

export async function ingestChapter(
  baseUrl: string,
  source: Record<string, unknown>,
  chapterRow: Record<string, unknown>,
  slots: Record<string, unknown>[],
  chunkSize: number,
  sourceIsFull: boolean,
): Promise<{ ok: boolean; errors: string[] }> {
  const sourceKey = String(source.source_key || '');
  const chunks = Math.max(1, Math.ceil(slots.length / chunkSize));
  const errors: string[] = [];

  for (let i = 0; i < chunks; i += 1) {
    const slice = slots.slice(i * chunkSize, (i + 1) * chunkSize);
    const body: Record<string, unknown> = {
      source_type: 'book',
      model_version: 3,
      source: (sourceIsFull && i === 0) ? source : { source_key: sourceKey },
      chapters: i === 0 ? [chapterRow] : [],
      slots: slice,
    };
    const result = await postIngest(baseUrl, body);
    if (!result.ok) {
      errors.push(`chunk ${i + 1}/${chunks}: HTTP ${result.status} ${result.detail}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Upload sentence audio binary (POST /api/app_qy_v1/media/audio). */
export const DUOREADER_AUDIO_VARIANT_KEY = 'duoreader_tts';

// FUTURE (backend): uk_f via uploadSlotAudio({ variantKey:'uk_f', accent:'uk', provider:'edge-tts' })
// Public API: audio_files[] on resolveSlotLanguages; play via ?variant_key= or ?accent=
// Worker claim: per missing audio_files entry, not whole-sentence has_audio — see
// AppQyV1SentenceAudioFiles.php roadmap in laravel_main.

export async function uploadSlotAudio(params: {
  baseUrl: string;
  language: string;
  contentId: string;
  sourceKey?: string;
  bytes: number[];
  mime?: string;
  variantKey?: string;
  accent?: string;
  source?: string;
  voiceType?: string;
  provider?: string;
}): Promise<{ ok: boolean; status?: string; error?: string; variantKey?: string }> {
  const {
    baseUrl,
    language,
    contentId,
    sourceKey,
    bytes,
    mime = 'audio/mpeg',
    variantKey = DUOREADER_AUDIO_VARIANT_KEY,
    accent,
    source = 'tts',
    voiceType = 'machine',
    provider = 'duoreader-api',
  } = params;
  if (!bytes?.length) {
    return { ok: false, error: 'empty audio' };
  }
  const url = `${baseUrl.replace(/\/+$/, '')}${AUDIO_PATH}`;
  const ext = mime.includes('webm') ? 'webm' : mime.includes('wav') ? 'wav' : 'mp3';
  const blob = new Blob([new Uint8Array(bytes)], { type: mime });
  const form = new FormData();
  form.append('language', language);
  form.append('content_id', contentId);
  if (sourceKey) form.append('source_key', sourceKey);
  if (variantKey) form.append('variant_key', variantKey);
  if (accent) form.append('accent', accent);
  form.append('source', source);
  form.append('voice_type', voiceType);
  form.append('provider', provider);
  form.append('audio', blob, `${contentId}.${ext}`);

  try {
    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok !== false) {
      return { ok: true, status: data.status || 'completed', variantKey };
    }
    return { ok: false, status: data?.status, error: data?.error || `HTTP ${res.status}`, variantKey };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export function viewerUrl(bookId: string, articleIndex: number, segmentIndex = 0): string {
  return `${DUOREADER_WEB_BASE}/viewer/${bookId}?segmentIndex=${segmentIndex}&articleIndex=${articleIndex}&paragraphIndex=0`;
}

export function emptyProgress(): DuoreaderImportProgress {
  return {
    running: false,
    paused: false,
    phase: '',
    step: 'idle',
    detail: '',
    bookId: '',
    bookTitle: '',
    booksTotal: 0,
    booksDone: 0,
    chaptersTotal: 0,
    chaptersScraped: 0,
    chaptersDone: 0,
    chaptersSkipped: 0,
    chapterCurrent: 0,
    chapterSlotsExpected: 0,
    chapterSlotsUploaded: 0,
    slotsIngested: 0,
    audioFetchedLearn: 0,
    audioFetchedMy: 0,
    audioSlotsTarget: 0,
    audioLang: '',
    audioSlot: 0,
    audioSlotsTotal: 0,
    scrapePct: 0,
    uploadPct: 0,
    audioPct: 0,
    audioPending: false,
    error: '',
    updatedAt: new Date().toISOString(),
  };
}

export function recomputeAudioPct(progress: DuoreaderImportProgress): void {
  const target = progress.audioSlotsTarget * 2;
  if (target <= 0) {
    progress.audioPct = 0;
    return;
  }
  const done = progress.audioFetchedLearn + progress.audioFetchedMy;
  progress.audioPct = Math.min(100, Math.round((done / target) * 100));
}

/** Map legacy persisted progress keys from older builds. */
export function normalizeImportProgress(raw: DuoreaderImportProgress | null | undefined): DuoreaderImportProgress {
  const base = emptyProgress();
  if (!raw) return base;
  const legacy = raw as DuoreaderImportProgress & Record<string, unknown>;
  return {
    ...base,
    ...raw,
    paused: !!raw.paused,
    audioPending: !!raw.audioPending,
    step: raw.step === 'tts' || raw.step === 'catchup' ? 'audio' : raw.step,
    audioFetchedLearn: Number(legacy.audioFetchedLearn ?? legacy.ttsEnrichedLearn ?? 0),
    audioFetchedMy: Number(legacy.audioFetchedMy ?? legacy.ttsEnrichedMy ?? 0),
    audioSlotsTarget: Number(legacy.audioSlotsTarget ?? legacy.slotsIngested ?? 0),
    audioLang: String(legacy.audioLang ?? legacy.ttsLang ?? ''),
    audioSlot: Number(legacy.audioSlot ?? legacy.ttsRound ?? 0),
    audioSlotsTotal: Number(legacy.audioSlotsTotal ?? legacy.ttsRoundsTotal ?? 0),
    audioPct: Number(legacy.audioPct ?? legacy.ttsPct ?? 0),
  };
}
