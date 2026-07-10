/**
 * Duoreader → Laravel Books v3 ingest core (shared by background service + popup).
 */

export const DUOREADER_SHELF_URL = 'https://duoreader.cn/assets/shelf.json';
export const DUOREADER_WEB_BASE = 'https://web.duoreader.cn';
export const INGEST_PATH = '/api/app_qy_v1/media/ingest';
export const ENRICH_PATH = '/api/app_qy_v1/media/enrich';
export const AUDIO_PATH = '/api/app_qy_v1/media/audio';
export const BOOK_INGEST_STATUS_PATH = '/api/app_qy_v1/media/books';
export const PROGRESS_STORAGE_KEY = 'duoreader_importer_progress';
export const STATE_STORAGE_KEY = 'duoreader_importer_state';

export interface DuoreaderBookMeta {
  id: string;
  titleEn: string;
  titleZh: string;
  authorEn: string;
  authorZh: string;
  coverUrl: string;
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

export interface DuoreaderImportProgress {
  running: boolean;
  phase: string;
  bookId: string;
  bookTitle: string;
  booksTotal: number;
  booksDone: number;
  chaptersTotal: number;
  chaptersDone: number;
  chaptersSkipped: number;
  slotsIngested: number;
  scrapePct: number;
  uploadPct: number;
  error: string;
  updatedAt: string;
}

export interface BackendChapterIngestStatus {
  chapter_index: number;
  sentence_count: number;
  slot_count: number;
  complete: boolean;
}

export interface BookIngestStatus {
  book_exists: boolean;
  total_slots: number;
  chapters: BackendChapterIngestStatus[];
  chapterMap: Map<number, BackendChapterIngestStatus>;
}

export interface DuoreaderImporterConfig {
  myLang: string;
  learnLang: string;
  bookChunkSize: number;
  enableTtsEnrich: boolean;
  ttsEnrichBatchSize: number;
  ttsEnrichRounds: number;
  maxBooks: number;
  bookIds: string[];
  /** Fetch chapters from Duoreader CDN .pz API (fast) instead of DOM scrape. */
  useCdnApi: boolean;
}

export const DEFAULT_IMPORTER_CONFIG: DuoreaderImporterConfig = {
  myLang: 'zh',
  learnLang: 'en',
  bookChunkSize: 80,
  enableTtsEnrich: true,
  ttsEnrichBatchSize: 100,
  ttsEnrichRounds: 20,
  maxBooks: 0,
  bookIds: [],
  useCdnApi: false,
};

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

export function listBilingualBooks(shelf: any, config: DuoreaderImporterConfig): DuoreaderBookMeta[] {
  const myLang = config.myLang;
  const learnLang = config.learnLang;
  const allowSet = new Set(config.bookIds || []);
  const hasAllow = allowSet.size > 0;
  const books: DuoreaderBookMeta[] = [];

  for (const section of shelf.sections || []) {
    for (const book of section.books || []) {
      if (!book?.id) continue;
      if (hasAllow && !allowSet.has(book.id)) continue;
      const langs: string[] = book.langs || [];
      if (!langs.includes(myLang) || !langs.includes(learnLang)) continue;
      books.push({
        id: book.id,
        titleEn: book.title?.en || book.title?.[learnLang] || book.id,
        titleZh: book.title?.zh || book.title?.[myLang] || '',
        authorEn: book.author?.name?.en || book.author?.en || '',
        authorZh: book.author?.name?.zh || book.author?.zh || '',
        coverUrl: book.coverUrl || '',
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

export async function fetchBookIngestStatus(baseUrl: string, sourceKey: string): Promise<BookIngestStatus> {
  const empty: BookIngestStatus = {
    book_exists: false,
    total_slots: 0,
    chapters: [],
    chapterMap: new Map(),
  };
  try {
    const url = `${baseUrl.replace(/\/+$/, '')}${BOOK_INGEST_STATUS_PATH}/${encodeURIComponent(sourceKey)}/ingest-status`;
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
          complete: !!row.complete,
        }))
      : [];
    const chapterMap = new Map<number, BackendChapterIngestStatus>();
    for (const row of chapters) {
      chapterMap.set(row.chapter_index, row);
    }
    return {
      book_exists: !!data?.book_exists,
      total_slots: Number(data?.total_slots) || 0,
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

/** True when backend already has all slots for this chapter (skip upload). */
export function isChapterCompleteOnBackend(
  backendChapter: BackendChapterIngestStatus | undefined,
  expectedParagraphs: number,
): boolean {
  if (!backendChapter || expectedParagraphs <= 0) return false;
  return backendChapter.slot_count >= expectedParagraphs
    && backendChapter.sentence_count >= expectedParagraphs;
}

/** True when we can skip CDN/DOM fetch — backend marked complete from prior import. */
export function canSkipChapterFetch(backendChapter: BackendChapterIngestStatus | undefined): boolean {
  return !!backendChapter?.complete && backendChapter.sentence_count > 0;
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

export async function postEnrich(
  baseUrl: string,
  language: string,
  limit: number,
  extra: Record<string, unknown> = {},
  timeoutMs = 120000,
): Promise<{ ok: boolean; enriched: number; detail: string; timedOut?: boolean }> {
  const url = `${baseUrl.replace(/\/+$/, '')}${ENRICH_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit, language, ...extra }),
      signal: controller.signal,
    });
  } catch (error: any) {
    clearTimeout(timer);
    const timedOut = error?.name === 'AbortError';
    return {
      ok: false,
      enriched: 0,
      detail: timedOut ? `timeout after ${timeoutMs}ms` : (error?.message || String(error)),
      timedOut,
    };
  }
  clearTimeout(timer);
  const text = await res.text();
  let enriched = 0;
  try {
    const parsed = JSON.parse(text);
    enriched = parsed?.data?.enriched || parsed?.data?.processed || 0;
  } catch {
    enriched = 0;
  }
  return { ok: res.ok, enriched, detail: text.slice(0, 200) };
}

/** Upload sentence audio binary (POST /api/app_qy_v1/media/audio). */
export async function uploadSlotAudio(params: {
  baseUrl: string;
  language: string;
  contentId: string;
  sourceKey?: string;
  bytes: number[];
  mime?: string;
  voiceAccent?: string;
}): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { baseUrl, language, contentId, sourceKey, bytes, mime = 'audio/mpeg', voiceAccent } = params;
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
  if (voiceAccent) form.append('voice_accent', voiceAccent);
  form.append('audio', blob, `${contentId}.${ext}`);

  try {
    const res = await fetch(url, { method: 'POST', body: form });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.ok !== false) {
      return { ok: true, status: data.status || 'completed' };
    }
    return { ok: false, status: data?.status, error: data?.error || `HTTP ${res.status}` };
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
    phase: '',
    bookId: '',
    bookTitle: '',
    booksTotal: 0,
    booksDone: 0,
    chaptersTotal: 0,
    chaptersDone: 0,
    chaptersSkipped: 0,
    slotsIngested: 0,
    scrapePct: 0,
    uploadPct: 0,
    error: '',
    updatedAt: new Date().toISOString(),
  };
}
