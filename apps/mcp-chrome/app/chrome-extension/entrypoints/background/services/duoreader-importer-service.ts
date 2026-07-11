/**
 * Duoreader import background service — tab scrape + Laravel upload.
 */

import { apiManager } from '@/services/ApiManager';
import { logger } from '@/utils/logger';
import {
  DEFAULT_IMPORTER_CONFIG,
  PROGRESS_STORAGE_KEY,
  STATE_STORAGE_KEY,
  DuoreaderImporterConfig,
  DuoreaderImportProgress,
  DuoreaderBookMeta,
  DuoreaderChapter,
  buildSlots,
  buildSource,
  computeContentId,
  emptyProgress,
  fetchShelf,
  fetchBookIngestStatus,
  globalSeqBeforeChapter,
  ingestStatusQueryForConfig,
  isChapterTextCompleteOnBackend,
  isChapterAudioCompleteOnBackend,
  canSkipFullChapter,
  canSkipChapterTextFetch,
  ingestChapter,
  listBilingualBooks,
  normalizeImportProgress,
  recomputeAudioPct,
  sourceKeyForBookAsync,
  uploadSlotAudio,
  viewerUrl,
  DUOREADER_WEB_BASE,
  DUOREADER_SHELF_URL,
  type BookIngestStatus,
  type BackendChapterIngestStatus,
  type BackendIngestSlotStatus,
} from '@/utils/duoreader-importer-core';
import { fetchDuoreaderAudio } from '@/utils/duoreader-audio';
import {
  backupChapterText,
  backupSentenceAudio,
  describeDuoreaderDataLocation,
  hasLocalSentenceAudio,
  readLocalSentenceAudio,
} from '@/utils/duoreader-audio-store';
import { waitForTabComplete } from '../tools/browser/ai-web-common';
import {
  articlePzUrl,
  bookPzUrl,
  fetchPz,
  parseArticleIdsFromBook,
  parseArticleParagraphs,
  type DuoreaderApiTestResult,
  type DuoreaderArticleRef,
} from '@/utils/duoreader-pz-decode';
import { unpackDuoreaderPzBytesAsync } from '@/utils/pz-bunzip';

const LOG = 'DuoreaderImporter';
const HELPER_SCRIPT = 'inject-scripts/duoreader-importer-helper.js';
const PING_ACTION = 'duoreader_importer_ping';

let stopRequested = false;
let workerTabId: number | null = null;
let importRunning = false;

interface PersistedState {
  books: Record<string, { chapters_done: number[]; global_seq: number; status: string }>;
}

async function loadState(): Promise<PersistedState> {
  const stored = await chrome.storage.local.get(STATE_STORAGE_KEY);
  return stored[STATE_STORAGE_KEY] || { books: {} };
}

async function saveState(state: PersistedState): Promise<void> {
  await chrome.storage.local.set({ [STATE_STORAGE_KEY]: state });
}

async function saveProgress(progress: DuoreaderImportProgress): Promise<void> {
  progress.updatedAt = new Date().toISOString();
  await chrome.storage.local.set({ [PROGRESS_STORAGE_KEY]: progress });
}

async function resolveApiBase(): Promise<string> {
  await apiManager.initialize({ autoDetect: false });
  return apiManager.getCurrentBaseUrl();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureHelperInjected(tabId: number): Promise<void> {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { action: PING_ACTION, files: [HELPER_SCRIPT] });
    if (ping?.status === 'pong') return;
  } catch {
    // not injected yet
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [HELPER_SCRIPT],
  });
  logger.debug(LOG, `Injected helper into tab ${tabId}`);
}

async function callPage<T>(tabId: number, action: string, extra: Record<string, unknown> = {}): Promise<T> {
  await ensureHelperInjected(tabId);
  const resp = await chrome.tabs.sendMessage(tabId, { action, ...extra });
  return resp as T;
}

async function ensureWorkerTab(): Promise<number> {
  if (workerTabId !== null) {
    try {
      await chrome.tabs.get(workerTabId);
      return workerTabId;
    } catch {
      workerTabId = null;
    }
  }
  const tab = await chrome.tabs.create({
    url: `${DUOREADER_WEB_BASE}/home?tab=discover`,
    active: true,
  });
  workerTabId = tab.id ?? null;
  if (!workerTabId) throw new Error('Failed to create worker tab');
  logger.info(LOG, `Opened worker tab ${workerTabId}`);
  await waitForTabComplete(workerTabId, 60000);
  await sleep(1500);
  const dismissed = await callPage<{ dismissed: boolean; reason: string }>(
    workerTabId,
    'duoreaderDismissLanguage',
  );
  logger.info(LOG, `Language sheet: ${dismissed.reason}`);
  return workerTabId;
}

async function navigateAndWait(tabId: number, url: string): Promise<void> {
  logger.info(LOG, `Navigate → ${url}`);
  await chrome.tabs.update(tabId, { url, active: true });
  await waitForTabComplete(tabId, 60000);
  await sleep(800);
  const ready = await callPage<{ ready: boolean; paragraphs: number }>(tabId, 'duoreaderWaitChapter', {
    timeoutMs: 45000,
  });
  if (!ready?.ready) {
    logger.warn(LOG, `Chapter not ready after timeout: ${url}`);
  } else {
    logger.debug(LOG, `Chapter ready (${ready.paragraphs} paragraphs)`);
  }
}

async function extractToc(
  tabId: number,
): Promise<Array<{ chapterIndex: number; titleZh: string; titleEn: string }>> {
  const resp = await callPage<{ ok: boolean; items: Array<{ chapterIndex: number; titleZh: string; titleEn: string }> }>(
    tabId,
    'duoreaderExtractToc',
  );
  const items = resp?.items || [];
  logger.info(LOG, `TOC extracted: ${items.length} chapters`);
  return items;
}

const AUDIO_FETCH_DELAY_MS = 120;

function resetBookProgress(progress: DuoreaderImportProgress): void {
  progress.chaptersScraped = 0;
  progress.chaptersDone = 0;
  progress.chaptersSkipped = 0;
  progress.chapterCurrent = 0;
  progress.chapterSlotsExpected = 0;
  progress.chapterSlotsUploaded = 0;
  progress.slotsIngested = 0;
  progress.audioFetchedLearn = 0;
  progress.audioFetchedMy = 0;
  progress.audioSlotsTarget = 0;
  progress.audioLang = '';
  progress.audioSlot = 0;
  progress.audioSlotsTotal = 0;
  progress.scrapePct = 0;
  progress.uploadPct = 0;
  progress.audioPct = 0;
  progress.detail = '';
}

async function fetchAndUploadSentenceAudio(
  baseUrl: string,
  bookId: string,
  chapterIndex: number,
  sourceKey: string,
  lang: string,
  text: string,
): Promise<'uploaded' | 'cached' | 'skipped' | 'failed'> {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 'skipped';

  const contentId = computeContentId(trimmed);
  let bytes: Uint8Array | null = null;

  if (await hasLocalSentenceAudio(bookId, chapterIndex, lang, contentId)) {
    bytes = await readLocalSentenceAudio(bookId, chapterIndex, lang, contentId);
  }
  if (!bytes?.length) {
    try {
      bytes = await fetchDuoreaderAudio(trimmed, lang);
      await backupSentenceAudio(bookId, chapterIndex, lang, contentId, trimmed, bytes);
    } catch (error: any) {
      logger.warn(LOG, `Audio fetch ${lang} ch${chapterIndex + 1}: ${error?.message || String(error)}`);
      return 'failed';
    }
  } else {
    await backupSentenceAudio(bookId, chapterIndex, lang, contentId, trimmed, bytes);
  }

  const upload = await uploadSlotAudio({
    baseUrl,
    language: lang,
    contentId,
    sourceKey,
    bytes: Array.from(bytes),
    mime: 'audio/mpeg',
  });
  if (upload.ok || upload.status === 'already_done') {
    return upload.status === 'already_done' ? 'cached' : 'uploaded';
  }
  logger.warn(LOG, `Audio upload ${lang} ${contentId}: ${upload.error || upload.status}`);
  return 'failed';
}

async function fetchChapterAudioFromBackendSlots(
  baseUrl: string,
  cfg: DuoreaderImporterConfig,
  progress: DuoreaderImportProgress,
  book: DuoreaderBookMeta,
  chapterIndex: number,
  backendChapter: BackendChapterIngestStatus | undefined,
  sourceKey: string,
): Promise<void> {
  if (!cfg.enableAudioFetch || stopRequested || !backendChapter?.slots?.length) return;

  const chNum = chapterIndex + 1;
  progress.chapterCurrent = chNum;
  progress.chapterSlotsExpected = backendChapter.slots.length;
  progress.audioSlotsTotal = backendChapter.slots.length;
  progress.audioSlotsTarget += backendChapter.slots.length;
  progress.step = 'audio';
  progress.phase = `Audio resume · ch ${chNum}/${progress.chaptersTotal}: ${book.titleEn}`;
  progress.detail = 'backend slot map (text+audio idempotent)';
  await saveProgress(progress);

  const langs = [cfg.learnLang, cfg.myLang];
  for (let slotIdx = 0; slotIdx < backendChapter.slots.length; slotIdx += 1) {
    if (stopRequested) break;
    const slot = backendChapter.slots[slotIdx] as BackendIngestSlotStatus;
    progress.audioSlot = slotIdx + 1;
    progress.detail = `slot ${slotIdx + 1}/${backendChapter.slots.length}`;
    await saveProgress(progress);

    for (const lang of langs) {
      if (stopRequested) break;
      if (slot.audio?.[lang]) continue;
      const text = slot.text?.[lang];
      if (!text?.trim()) {
        logger.warn(LOG, `Audio resume missing text ch${chNum} seq=${slot.seq} lang=${lang}`);
        continue;
      }
      progress.audioLang = lang;
      const result = await fetchAndUploadSentenceAudio(
        baseUrl,
        book.id,
        chapterIndex,
        sourceKey,
        lang,
        text,
      );
      if (result === 'uploaded' || result === 'cached') {
        if (lang === cfg.learnLang) progress.audioFetchedLearn += 1;
        else if (lang === cfg.myLang) progress.audioFetchedMy += 1;
        recomputeAudioPct(progress);
      }
    }
  }
}

async function fetchChapterAudio(
  baseUrl: string,
  cfg: DuoreaderImporterConfig,
  progress: DuoreaderImportProgress,
  book: DuoreaderBookMeta,
  chapter: DuoreaderChapter,
  slots: Record<string, unknown>[],
  sourceKey: string,
): Promise<void> {
  if (!cfg.enableAudioFetch || stopRequested || !slots.length) return;

  progress.audioSlotsTarget += slots.length;

  const chNum = chapter.chapterIndex + 1;
  progress.chapterCurrent = chNum;
  progress.chapterSlotsExpected = slots.length;
  progress.audioSlotsTotal = slots.length;
  progress.step = 'audio';
  progress.phase = `Audio fetch · ch ${chNum}/${progress.chaptersTotal}: ${book.titleEn}`;
  progress.detail = `backing up text → ${describeDuoreaderDataLocation()}`;
  await saveProgress(progress);

  await backupChapterText(book.id, chapter);

  const langs = [cfg.learnLang, cfg.myLang];
  for (let slotIdx = 0; slotIdx < slots.length; slotIdx += 1) {
    if (stopRequested) break;
    const slot = slots[slotIdx];
    const slotLangs = (slot.langs || {}) as Record<string, string | null>;
    progress.audioSlot = slotIdx + 1;
    progress.detail = `slot ${slotIdx + 1}/${slots.length}`;
    await saveProgress(progress);

    for (const lang of langs) {
      if (stopRequested) break;
      const text = slotLangs[lang];
      if (!text?.trim()) continue;
      progress.audioLang = lang;
      const result = await fetchAndUploadSentenceAudio(
        baseUrl,
        book.id,
        chapter.chapterIndex,
        sourceKey,
        lang,
        text,
      );
      if (result === 'uploaded' || result === 'cached') {
        if (lang === cfg.learnLang) progress.audioFetchedLearn += 1;
        else if (lang === cfg.myLang) progress.audioFetchedMy += 1;
        recomputeAudioPct(progress);
      }
      progress.detail = `slot ${slotIdx + 1}/${slots.length} · ${lang} ${result}`;
      await saveProgress(progress);
      await sleep(AUDIO_FETCH_DELAY_MS);
    }
  }

  progress.detail = `ch ${chNum} · audio ${progress.audioFetchedLearn}+${progress.audioFetchedMy} clips`;
  recomputeAudioPct(progress);
  await saveProgress(progress);
  logger.info(
    LOG,
    `Audio ch ${chNum} book=${book.id}: ${cfg.learnLang}=${progress.audioFetchedLearn} ${cfg.myLang}=${progress.audioFetchedMy}`,
  );
}

async function completeBook(
  state: PersistedState,
  book: DuoreaderBookMeta,
  progress: DuoreaderImportProgress,
  uploadCtx: ChapterUploadCtx,
  modeLabel: string,
): Promise<void> {
  if (!state.books[book.id]) {
    state.books[book.id] = { chapters_done: [], global_seq: uploadCtx.globalSeq, status: 'completed' };
  } else {
    state.books[book.id].status = 'completed';
    state.books[book.id].global_seq = uploadCtx.globalSeq;
  }
  await saveState(state);

  progress.booksDone += 1;
  progress.step = 'done';
  progress.phase = `Completed (${modeLabel}): ${book.titleEn} (${uploadCtx.slotsIngested} new slots, ${uploadCtx.chaptersSkipped} skipped)`;
  progress.detail = `text ${uploadCtx.slotsIngested} slots · audio ${progress.audioFetchedLearn}+${progress.audioFetchedMy} clips`;
  await saveProgress(progress);
  logger.info(
    LOG,
    `Book done (${modeLabel}): ${book.titleEn} new=${uploadCtx.slotsIngested} skipped=${uploadCtx.chaptersSkipped}`,
  );
}

async function loadBookArticlesViaCdn(bookId: string): Promise<DuoreaderArticleRef[]> {
  const bookBytes = await fetchPz(bookPzUrl(bookId));
  return parseArticleIdsFromBook(bookBytes);
}

async function loadChapterViaCdn(
  bookId: string,
  segmentIndex: number,
  articleIndex: number,
  myLang: string,
  learnLang: string,
): Promise<DuoreaderChapter['paragraphs']> {
  const artBytes = await fetchPz(articlePzUrl(bookId, segmentIndex, articleIndex, myLang, learnLang));
  return parseArticleParagraphs(artBytes);
}

export async function testDuoreaderImportApi(
  config: Partial<DuoreaderImporterConfig> = {},
  bookId?: string,
): Promise<DuoreaderApiTestResult> {
  const cfg = { ...DEFAULT_IMPORTER_CONFIG, ...config };
  const started = Date.now();
  let targetBookId = bookId || '';
  try {
    if (!targetBookId) {
      const shelf = await fetchShelf();
      const books = listBilingualBooks(shelf, cfg);
      targetBookId = books[0]?.id || 'pride_and_prejudice';
    }
    const bookBytes = await fetchPz(bookPzUrl(targetBookId));
    const articles = parseArticleIdsFromBook(bookBytes);
    if (!articles.length) {
      return {
        ok: false,
        bookId: targetBookId,
        bookPzBytes: bookBytes.byteLength,
        articleCount: 0,
        sampleArticleId: '',
        sampleParagraphs: 0,
        sampleEnPreview: '',
        sampleZhPreview: '',
        elapsedMs: Date.now() - started,
        error: 'No articles in book.pz',
        mode: 'cdn_api',
      };
    }
    const sample = articles[0];
    const artBytes = await fetchPz(
      articlePzUrl(targetBookId, sample.segmentIndex, sample.articleIndex, cfg.myLang, cfg.learnLang),
    );
    const paragraphs = parseArticleParagraphs(artBytes);
    const ok = paragraphs.length > 0;
    const result: DuoreaderApiTestResult = {
      ok,
      bookId: targetBookId,
      bookPzBytes: bookBytes.byteLength,
      articleCount: articles.length,
      sampleArticleId: sample.articleId,
      sampleParagraphs: paragraphs.length,
      sampleEnPreview: paragraphs[0]?.en?.slice(0, 120) || '',
      sampleZhPreview: paragraphs[0]?.zh?.slice(0, 80) || '',
      elapsedMs: Date.now() - started,
      error: ok ? undefined : 'Decoded sample chapter has 0 paragraphs',
      mode: 'cdn_api',
    };
    logger.info(
      LOG,
      `API test ${ok ? 'OK' : 'FAIL'} book=${targetBookId} articles=${articles.length} sampleParas=${paragraphs.length} ${result.elapsedMs}ms`,
    );
    return result;
  } catch (error: any) {
    const msg = error?.message || String(error);
    logger.error(LOG, `API test failed: ${msg}`, error);
    return {
      ok: false,
      bookId: targetBookId || bookId || '',
      bookPzBytes: 0,
      articleCount: 0,
      sampleArticleId: '',
      sampleParagraphs: 0,
      sampleEnPreview: '',
      sampleZhPreview: '',
      elapsedMs: Date.now() - started,
      error: msg,
      mode: 'cdn_api',
    };
  }
}

async function markChapterDone(
  state: PersistedState,
  bookId: string,
  chapterIndex: number,
  globalSeq: number,
): Promise<void> {
  if (!state.books[bookId]) {
    state.books[bookId] = { chapters_done: [], global_seq: 0, status: 'in_progress' };
  }
  const done = state.books[bookId].chapters_done;
  if (!done.includes(chapterIndex)) done.push(chapterIndex);
  state.books[bookId].global_seq = globalSeq;
  await saveState(state);
}

interface ChapterUploadCtx {
  book: DuoreaderBookMeta;
  cfg: DuoreaderImporterConfig;
  baseUrl: string;
  state: PersistedState;
  progress: DuoreaderImportProgress;
  sourceKey: string;
  ingestStatus: BookIngestStatus;
  sourceSent: boolean;
  globalSeq: number;
  slotsIngested: number;
  chaptersSkipped: number;
}

/**
 * Upload one chapter with backend idempotency: skip when complete, re-ingest when partial.
 * Returns updated ctx counters.
 */
async function uploadChapterIfNeeded(
  ctx: ChapterUploadCtx,
  chapter: DuoreaderChapter,
  phaseLabel: string,
): Promise<ChapterUploadCtx> {
  const backendCh = ctx.ingestStatus.chapterMap.get(chapter.chapterIndex);
  const expected = chapter.paragraphs.length;
  const seqStart = globalSeqBeforeChapter(chapter.chapterIndex, ctx.ingestStatus);

  const chNum = chapter.chapterIndex + 1;
  ctx.progress.chapterCurrent = chNum;
  ctx.progress.chapterSlotsExpected = expected;

  if (isChapterTextCompleteOnBackend(backendCh, expected)) {
    ctx.chaptersSkipped += 1;
    ctx.progress.chaptersDone += 1;
    ctx.progress.chaptersSkipped = ctx.chaptersSkipped;
    ctx.progress.chapterSlotsUploaded = 0;
    ctx.progress.step = 'skip';
    ctx.progress.uploadPct = Math.round((ctx.progress.chaptersDone / ctx.progress.chaptersTotal) * 100);
    ctx.progress.phase = `Skip upload ch ${chNum}/${ctx.progress.chaptersTotal}: ${ctx.book.titleEn}`;
    ctx.progress.detail = `${expected} slots already on backend`;
    await saveProgress(ctx.progress);
    logger.info(
      LOG,
      `Skip upload ch ${chapter.chapterIndex + 1} book=${ctx.book.id} slots=${expected} (backend ${backendCh?.slot_count}/${backendCh?.sentence_count})`,
    );
    await markChapterDone(ctx.state, ctx.book.id, chapter.chapterIndex, Math.max(ctx.globalSeq, seqStart + expected));

    const skipSlots = await buildSlots(ctx.book.id, chapter, ctx.cfg, seqStart);
    await fetchChapterAudio(
      ctx.baseUrl,
      ctx.cfg,
      ctx.progress,
      ctx.book,
      chapter,
      skipSlots,
      ctx.sourceKey,
    );
    return ctx;
  }

  if (backendCh && backendCh.slot_count > 0 && backendCh.slot_count < expected) {
    logger.info(
      LOG,
      `Repair ch ${chapter.chapterIndex + 1} book=${ctx.book.id}: backend ${backendCh.slot_count}/${expected} slots`,
    );
  }

  ctx.progress.step = 'upload';
  ctx.progress.phase = `${phaseLabel} ch ${chNum}/${ctx.progress.chaptersTotal}: ${ctx.book.titleEn}`;
  ctx.progress.detail = `uploading ${expected} slots`;
  ctx.progress.uploadPct = Math.round((chNum / ctx.progress.chaptersTotal) * 100);
  await saveProgress(ctx.progress);

  const source = ctx.sourceSent
    ? { source_key: ctx.sourceKey }
    : await buildSource(ctx.book, chapter, ctx.cfg);
  const chapterRow = {
    chapter_index: chapter.chapterIndex,
    sentence_count: expected,
    titles: {
      [ctx.cfg.learnLang]: chapter.titleEn || `Chapter ${chapter.chapterIndex + 1}`,
      [ctx.cfg.myLang]: chapter.titleZh || `第${chapter.chapterIndex + 1}章`,
    },
  };
  const slots = await buildSlots(ctx.book.id, chapter, ctx.cfg, seqStart);
  const ingestResult = await ingestChapter(
    ctx.baseUrl,
    source,
    chapterRow,
    slots,
    ctx.cfg.bookChunkSize,
    !ctx.sourceSent,
  );
  ctx.sourceSent = true;

  if (!ingestResult.ok) {
    throw new Error(ingestResult.errors.join('; '));
  }

  ctx.globalSeq = seqStart + slots.length;
  ctx.slotsIngested += slots.length;
  ctx.progress.chaptersDone += 1;
  ctx.progress.slotsIngested += slots.length;
  ctx.progress.chapterSlotsUploaded = slots.length;
  ctx.progress.uploadPct = Math.round((ctx.progress.chaptersDone / ctx.progress.chaptersTotal) * 100);
  ctx.progress.detail = `uploaded ${slots.length} slots · book total ${ctx.progress.slotsIngested}`;
  await saveProgress(ctx.progress);
  logger.info(
    LOG,
    `Ingested ch ${chapter.chapterIndex + 1}/${ctx.progress.chaptersTotal} book=${ctx.book.id} slots=${slots.length}`,
  );

  await markChapterDone(ctx.state, ctx.book.id, chapter.chapterIndex, ctx.globalSeq);

  const updated = backendCh
    ? {
        ...backendCh,
        sentence_count: expected,
        slot_count: Math.max(backendCh.slot_count, expected),
        complete: true,
      }
    : {
        chapter_index: chapter.chapterIndex,
        sentence_count: expected,
        slot_count: expected,
        complete: true,
      };
  ctx.ingestStatus.chapterMap.set(chapter.chapterIndex, updated);

  await fetchChapterAudio(
    ctx.baseUrl,
    ctx.cfg,
    ctx.progress,
    ctx.book,
    chapter,
    slots,
    ctx.sourceKey,
  );

  return ctx;
}

async function importBookViaCdnApi(
  book: DuoreaderBookMeta,
  cfg: DuoreaderImporterConfig,
  baseUrl: string,
  state: PersistedState,
  progress: DuoreaderImportProgress,
): Promise<void> {
  const bookState = state.books[book.id];
  progress.step = 'scrape';
  progress.phase = `CDN API TOC: ${book.titleEn}`;
  progress.detail = 'loading book.pz catalog';
  await saveProgress(progress);

  const sourceKey = await sourceKeyForBookAsync(book.id);
  const ingestStatus = await fetchBookIngestStatus(baseUrl, sourceKey);
  if (ingestStatus.book_exists) {
    logger.info(LOG, `Backend status ${book.id}: ${ingestStatus.chapters.length} chapter row(s), ${ingestStatus.total_slots} slots`);
  }

  const articles = await loadBookArticlesViaCdn(book.id);
  if (!articles.length) {
    throw new Error(`No articles in book.pz for ${book.id}`);
  }
  logger.info(LOG, `CDN API: ${articles.length} articles for ${book.id}`);

  progress.chaptersTotal = articles.length;
  progress.chaptersSkipped = 0;
  let uploadCtx: ChapterUploadCtx = {
    book,
    cfg,
    baseUrl,
    state,
    progress,
    sourceKey,
    ingestStatus,
    sourceSent: !!(bookState?.chapters_done?.length) || ingestStatus.book_exists,
    globalSeq: bookState?.global_seq || 0,
    slotsIngested: 0,
    chaptersSkipped: 0,
  };

  for (let chIdx = 0; chIdx < articles.length; chIdx += 1) {
    if (stopRequested) break;
    const art = articles[chIdx];
    const backendCh = ingestStatus.chapterMap.get(chIdx);

    if (canSkipChapterFetch(backendCh)) {
      uploadCtx.chaptersSkipped += 1;
      uploadCtx.progress.chaptersScraped += 1;
      uploadCtx.progress.chaptersDone += 1;
      uploadCtx.progress.chaptersSkipped = uploadCtx.chaptersSkipped;
      uploadCtx.progress.chapterCurrent = chIdx + 1;
      uploadCtx.progress.step = 'skip';
      uploadCtx.progress.scrapePct = Math.round((uploadCtx.progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
      uploadCtx.progress.uploadPct = Math.round((uploadCtx.progress.chaptersDone / uploadCtx.progress.chaptersTotal) * 100);
      uploadCtx.progress.phase = `Skip ch ${chIdx + 1}/${articles.length}: ${book.titleEn}`;
      uploadCtx.progress.detail = `${backendCh?.slot_count || 0} slots on backend`;
      await saveProgress(uploadCtx.progress);
      logger.info(
        LOG,
        `Skip fetch+upload ch ${chIdx + 1} book=${book.id} (${backendCh?.slot_count} slots on backend)`,
      );
      await markChapterDone(
        state,
        book.id,
        chIdx,
        globalSeqBeforeChapter(chIdx + 1, ingestStatus),
      );
      continue;
    }

    uploadCtx.progress.step = 'scrape';
    uploadCtx.progress.chapterCurrent = chIdx + 1;
    uploadCtx.progress.phase = `CDN fetch ch ${chIdx + 1}/${articles.length}: ${book.titleEn}`;
    uploadCtx.progress.detail = 'downloading .pz';
    uploadCtx.progress.scrapePct = Math.round(((chIdx + 1) / articles.length) * 100);
    await saveProgress(uploadCtx.progress);

    const paragraphs = await loadChapterViaCdn(
      book.id,
      art.segmentIndex,
      art.articleIndex,
      cfg.myLang,
      cfg.learnLang,
    );
    if (!paragraphs.length) {
      logger.warn(LOG, `CDN API empty chapter ${art.articleId} in ${book.id}`);
      continue;
    }

    const chapter: DuoreaderChapter = {
      segmentIndex: art.segmentIndex,
      articleIndex: art.articleIndex,
      chapterIndex: chIdx,
      titleZh: `第${chIdx + 1}章`,
      titleEn: `Chapter ${chIdx + 1}`,
      paragraphs,
    };

    uploadCtx.progress.chaptersScraped += 1;
    uploadCtx.progress.scrapePct = Math.round((uploadCtx.progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
    uploadCtx.progress.detail = `fetched ${paragraphs.length} paragraphs`;
    await saveProgress(uploadCtx.progress);

    uploadCtx = await uploadChapterIfNeeded(uploadCtx, chapter, 'Upload');
    await sleep(80);
  }

  await completeBook(state, book, progress, uploadCtx, 'CDN');
}

async function extractChapter(tabId: number): Promise<DuoreaderChapter | null> {
  const resp = await callPage<{
    ok: boolean;
    chapter: { chapterTitle: string; paragraphs: DuoreaderChapter['paragraphs'] };
  }>(tabId, 'duoreaderExtractChapter');
  const data = resp?.chapter;
  if (!data) return null;
  return {
    segmentIndex: 0,
    articleIndex: 0,
    chapterIndex: 0,
    titleZh: data.chapterTitle,
    titleEn: data.chapterTitle,
    paragraphs: data.paragraphs || [],
  };
}

export async function getDuoreaderProgress(): Promise<DuoreaderImportProgress> {
  const stored = await chrome.storage.local.get(PROGRESS_STORAGE_KEY);
  return normalizeImportProgress(stored[PROGRESS_STORAGE_KEY]);
}

export async function stopDuoreaderImport(): Promise<void> {
  stopRequested = true;
  const progress = await getDuoreaderProgress();
  progress.running = false;
  progress.phase = 'Stopped';
  await saveProgress(progress);
  logger.info(LOG, 'Stop requested');
}

export async function startDuoreaderImport(
  config: Partial<DuoreaderImporterConfig> = {},
): Promise<{ success: boolean; error?: string; started?: boolean }> {
  if (importRunning || (await getDuoreaderProgress()).running) {
    return { success: false, error: 'Import already running' };
  }

  importRunning = true;
  stopRequested = false;
  const legacyCfg = config as Partial<DuoreaderImporterConfig> & { enableTtsEnrich?: boolean };
  const cfg: DuoreaderImporterConfig = {
    ...DEFAULT_IMPORTER_CONFIG,
    ...config,
    enableAudioFetch: legacyCfg.enableAudioFetch ?? legacyCfg.enableTtsEnrich ?? DEFAULT_IMPORTER_CONFIG.enableAudioFetch,
  };
  const progress = emptyProgress();
  progress.running = true;
  progress.step = 'catalog';
  progress.phase = 'Starting…';
  progress.detail = `resolving API · backup ${describeDuoreaderDataLocation()}`;
  await saveProgress(progress);
  logger.info(LOG, `Import started (my=${cfg.myLang} learn=${cfg.learnLang} maxBooks=${cfg.maxBooks} cdnApi=${cfg.useCdnApi} audio=${cfg.enableAudioFetch})`);

  try {
    const baseUrl = await resolveApiBase();
    logger.info(LOG, `API base: ${baseUrl}`);

    progress.step = 'catalog';
    progress.phase = 'Loading catalog';
    progress.detail = DUOREADER_SHELF_URL;
    await saveProgress(progress);
    const shelf = await fetchShelf();
    const books = listBilingualBooks(shelf, cfg);
    const state = await loadState();

    progress.booksTotal = books.length;
    progress.phase = books.length ? `Found ${books.length} books` : 'No bilingual books found';
    await saveProgress(progress);
    logger.info(LOG, `Catalog: ${books.length} bilingual book(s)`);

    if (!books.length) {
      progress.running = false;
      await saveProgress(progress);
      importRunning = false;
      return { success: true, started: true };
    }

    let tabId: number | null = null;

    for (const book of books) {
      if (stopRequested) break;
      const bookState = state.books[book.id];
      if (bookState?.status === 'completed') {
        progress.booksDone += 1;
        await saveProgress(progress);
        logger.info(LOG, `Skip completed book: ${book.id}`);
        continue;
      }

      progress.bookId = book.id;
      progress.bookTitle = book.titleEn;
      resetBookProgress(progress);
      await saveProgress(progress);

      if (cfg.useCdnApi) {
        await importBookViaCdnApi(book, cfg, baseUrl, state, progress);
        continue;
      }

      if (tabId === null) {
        tabId = await ensureWorkerTab();
      }

      progress.step = 'scrape';
      progress.phase = `Scraping TOC: ${book.titleEn}`;
      progress.detail = 'opening viewer';
      await saveProgress(progress);

      await navigateAndWait(tabId, viewerUrl(book.id, 0, 0));
      const toc = await extractToc(tabId);
      if (!toc.length) {
        throw new Error(`No chapters for ${book.id}`);
      }

      progress.chaptersTotal = toc.length;
      progress.chaptersSkipped = 0;
      const sourceKey = await sourceKeyForBookAsync(book.id);
      const ingestStatus = await fetchBookIngestStatus(baseUrl, sourceKey);
      if (ingestStatus.book_exists) {
        logger.info(LOG, `Backend status ${book.id}: ${ingestStatus.chapters.length} chapter row(s), ${ingestStatus.total_slots} slots`);
      }

      let uploadCtx: ChapterUploadCtx = {
        book,
        cfg,
        baseUrl,
        state,
        progress,
        sourceKey,
        ingestStatus,
        sourceSent: !!(bookState?.chapters_done?.length) || ingestStatus.book_exists,
        globalSeq: bookState?.global_seq || 0,
        slotsIngested: 0,
        chaptersSkipped: 0,
      };

      for (const tocItem of toc) {
        if (stopRequested) break;
        const backendCh = ingestStatus.chapterMap.get(tocItem.chapterIndex);

        if (canSkipChapterFetch(backendCh)) {
          uploadCtx.chaptersSkipped += 1;
          uploadCtx.progress.chaptersScraped += 1;
          uploadCtx.progress.chaptersDone += 1;
          uploadCtx.progress.chaptersSkipped = uploadCtx.chaptersSkipped;
          uploadCtx.progress.chapterCurrent = tocItem.chapterIndex + 1;
          uploadCtx.progress.step = 'skip';
          uploadCtx.progress.scrapePct = Math.round((uploadCtx.progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
          uploadCtx.progress.uploadPct = Math.round((uploadCtx.progress.chaptersDone / uploadCtx.progress.chaptersTotal) * 100);
          uploadCtx.progress.phase = `Skip ch ${tocItem.chapterIndex + 1}/${toc.length}: ${book.titleEn}`;
          uploadCtx.progress.detail = `${backendCh?.slot_count || 0} slots on backend`;
          await saveProgress(uploadCtx.progress);
          logger.info(
            LOG,
            `Skip scrape+upload ch ${tocItem.chapterIndex + 1} book=${book.id} (${backendCh?.slot_count} slots on backend)`,
          );
          await markChapterDone(
            state,
            book.id,
            tocItem.chapterIndex,
            globalSeqBeforeChapter(tocItem.chapterIndex + 1, ingestStatus),
          );
          continue;
        }

        const chNum = tocItem.chapterIndex + 1;
        progress.step = 'scrape';
        progress.chapterCurrent = chNum;
        progress.phase = `Scraping ch ${chNum}/${toc.length}: ${book.titleEn}`;
        progress.detail = 'loading chapter in tab';
        await saveProgress(progress);

        await navigateAndWait(tabId, viewerUrl(book.id, tocItem.chapterIndex, 0));
        const rawChapter = await extractChapter(tabId);
        if (!rawChapter || !rawChapter.paragraphs.length) {
          logger.warn(LOG, `Empty chapter ${tocItem.chapterIndex} in ${book.id}`);
          continue;
        }

        progress.chaptersScraped += 1;
        progress.scrapePct = Math.round((progress.chaptersScraped / toc.length) * 100);
        progress.detail = `scraped ${rawChapter.paragraphs.length} paragraphs`;
        await saveProgress(progress);

        const chapter: DuoreaderChapter = {
          ...rawChapter,
          chapterIndex: tocItem.chapterIndex,
          articleIndex: tocItem.chapterIndex,
          titleZh: rawChapter.titleZh || tocItem.titleZh,
          titleEn: rawChapter.titleEn || tocItem.titleEn,
        };

        progress.scrapePct = Math.round((progress.chaptersScraped / toc.length) * 100);
        await saveProgress(progress);

        uploadCtx = await uploadChapterIfNeeded(uploadCtx, chapter, 'Uploading');
        await sleep(500);
      }

      await completeBook(state, book, progress, uploadCtx, 'scrape');
    }

    progress.running = false;
    progress.phase = stopRequested ? 'Stopped' : 'All done';
    await saveProgress(progress);
    logger.info(LOG, progress.phase);
    importRunning = false;
    return { success: true, started: true };
  } catch (error: any) {
    const progress = await getDuoreaderProgress();
    progress.running = false;
    progress.error = error?.message || String(error);
    progress.phase = 'Failed';
    await saveProgress(progress);
    logger.error(LOG, progress.error, error);
    importRunning = false;
    return { success: false, error: progress.error };
  }
}

export async function listDuoreaderBooks(
  config: Partial<DuoreaderImporterConfig> = {},
): Promise<DuoreaderBookMeta[]> {
  const cfg = { ...DEFAULT_IMPORTER_CONFIG, ...config };
  const shelf = await fetchShelf();
  return listBilingualBooks(shelf, cfg);
}

export async function unpackPzMessageBytes(bytes: number[] | Uint8Array): Promise<Uint8Array> {
  return unpackDuoreaderPzBytesAsync(bytes);
}
