/**
 * Duoreader import background service — tab scrape + Laravel upload.
 */

import { apiManager } from '@/services/ApiManager';
import { logger } from '@/utils/logger';
import {
  DEFAULT_IMPORTER_CONFIG,
  PROGRESS_STORAGE_KEY,
  STATE_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  DuoreaderImporterConfig,
  DuoreaderImportProgress,
  DuoreaderImportSession,
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
  canSkipChapterTextFetch,
  isChapterAudioCompleteOnBackend,
  seedBookProgressFromBackend,
  resolveBackendChapter,
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
let pauseRequested = false;
let workerTabId: number | null = null;
let importRunning = false;
let activeImportConfig: DuoreaderImporterConfig | null = null;

interface PersistedState {
  books: Record<string, { chapters_done: number[]; global_seq: number; status: string }>;
}

async function loadSession(): Promise<DuoreaderImportSession | null> {
  const stored = await chrome.storage.local.get(SESSION_STORAGE_KEY);
  const raw = stored[SESSION_STORAGE_KEY] as DuoreaderImportSession | undefined;
  return raw?.config ? raw : null;
}

async function saveSession(patch: Partial<DuoreaderImportSession> & { config?: DuoreaderImporterConfig }): Promise<void> {
  const prev = (await loadSession()) || {
    config: { ...DEFAULT_IMPORTER_CONFIG },
    interrupted: false,
    reason: '' as const,
    updatedAt: new Date().toISOString(),
  };
  const next: DuoreaderImportSession = {
    ...prev,
    ...patch,
    config: patch.config || prev.config,
    updatedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [SESSION_STORAGE_KEY]: next });
}

/** Wait while paused; return false when stop was requested. */
async function importShouldContinue(): Promise<boolean> {
  while (pauseRequested && !stopRequested) {
    await sleep(350);
  }
  return !stopRequested;
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
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [HELPER_SCRIPT],
    });
    logger.debug(LOG, `Injected helper into tab ${tabId}`);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (/duplicate script id/i.test(msg)) {
      logger.debug(LOG, `Helper already registered in tab ${tabId}`);
      return;
    }
    throw error;
  }
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

interface PendingAudioChapter {
  baseUrl: string;
  cfg: DuoreaderImporterConfig;
  book: DuoreaderBookMeta;
  chapterIndex: number;
  sourceKey: string;
  backendChapter?: BackendChapterIngestStatus;
  slots?: Record<string, unknown>[];
}

const pendingAudioChapters: PendingAudioChapter[] = [];
let audioWorkerRunning = false;

function enqueueChapterAudio(job: PendingAudioChapter): void {
  if (!job.cfg.enableAudioFetch) return;
  pendingAudioChapters.push(job);
  void runAudioWorker();
}

async function runAudioWorker(): Promise<void> {
  if (audioWorkerRunning) return;
  audioWorkerRunning = true;
  try {
    let progress = await getDuoreaderProgress();
    progress.audioPending = true;
    progress.step = 'audio';
    await saveProgress(progress);

    while (pendingAudioChapters.length) {
      if (!(await importShouldContinue())) {
        if (stopRequested) break;
        continue;
      }
      const job = pendingAudioChapters.shift()!;
      progress = await getDuoreaderProgress();
      if (job.backendChapter?.slots?.length) {
        await fetchChapterAudioFromBackendSlots(
          job.baseUrl,
          job.cfg,
          progress,
          job.book,
          job.chapterIndex,
          job.backendChapter,
          job.sourceKey,
        );
      } else if (job.slots?.length) {
        const chapter: DuoreaderChapter = {
          segmentIndex: 0,
          articleIndex: job.chapterIndex,
          chapterIndex: job.chapterIndex,
          titleZh: '',
          titleEn: '',
          paragraphs: [],
        };
        await fetchChapterAudio(
          job.baseUrl,
          job.cfg,
          progress,
          job.book,
          chapter,
          job.slots,
          job.sourceKey,
        );
      }
    }

    progress = await getDuoreaderProgress();
    progress.audioPending = false;
    if (!progress.running && !stopRequested) {
      progress.phase = progress.phase === 'Text import done' ? 'All done' : progress.phase;
    }
    await saveProgress(progress);
  } finally {
    audioWorkerRunning = false;
  }
}

function scheduleChapterAudioFromBackend(
  baseUrl: string,
  cfg: DuoreaderImporterConfig,
  book: DuoreaderBookMeta,
  chapterIndex: number,
  backendChapter: BackendChapterIngestStatus | undefined,
  sourceKey: string,
): void {
  if (!cfg.enableAudioFetch || !backendChapter) return;
  if (isChapterAudioCompleteOnBackend(backendChapter, true)) return;
  enqueueChapterAudio({
    baseUrl,
    cfg,
    book,
    chapterIndex,
    sourceKey,
    backendChapter,
  });
}

function scheduleChapterAudioFromSlots(
  baseUrl: string,
  cfg: DuoreaderImporterConfig,
  book: DuoreaderBookMeta,
  chapter: DuoreaderChapter,
  slots: Record<string, unknown>[],
  sourceKey: string,
): void {
  if (!cfg.enableAudioFetch || !slots.length) return;
  enqueueChapterAudio({
    baseUrl,
    cfg,
    book,
    chapterIndex: chapter.chapterIndex,
    sourceKey,
    slots,
  });
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
      logger.warn(LOG, `Audio fetch ${lang} ch${chapterIndex + 1}: ${error?.message || String(error)} (${trimmed.length} chars)`);
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
  if (!cfg.enableAudioFetch || !backendChapter?.slots?.length) return;
  if (!(await importShouldContinue())) return;

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
    if (!(await importShouldContinue())) break;
    const slot = backendChapter.slots[slotIdx] as BackendIngestSlotStatus;
    progress.audioSlot = slotIdx + 1;
    progress.detail = `slot ${slotIdx + 1}/${backendChapter.slots.length}`;
    await saveProgress(progress);

    for (const lang of langs) {
      if (!(await importShouldContinue())) break;
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
  if (!cfg.enableAudioFetch || !slots.length) return;
  if (!(await importShouldContinue())) return;

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
    if (!(await importShouldContinue())) break;
    const slot = slots[slotIdx];
    const slotLangs = (slot.langs || {}) as Record<string, string | null>;
    progress.audioSlot = slotIdx + 1;
    progress.detail = `slot ${slotIdx + 1}/${slots.length}`;
    await saveProgress(progress);

    for (const lang of langs) {
      if (!(await importShouldContinue())) break;
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
  forceReplaceUpload: boolean;
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

  if (!ctx.forceReplaceUpload && isChapterTextCompleteOnBackend(backendCh, expected)) {
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
    scheduleChapterAudioFromSlots(
      ctx.baseUrl,
      ctx.cfg,
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
  if (!slots.length) {
    logger.warn(
      LOG,
      `Skip ingest ch ${chapter.chapterIndex + 1} book=${ctx.book.id}: no sentence slots`,
    );
    return ctx;
  }

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

  scheduleChapterAudioFromSlots(
    ctx.baseUrl,
    ctx.cfg,
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
  const ingestStatus = await fetchBookIngestStatus(baseUrl, sourceKey, ingestStatusQueryForConfig(cfg));
  if (ingestStatus.book_exists) {
    logger.info(LOG, `Backend status ${book.id}: ${ingestStatus.chapters.length} chapter row(s), ${ingestStatus.total_slots} slots`);
  }

  const articles = await loadBookArticlesViaCdn(book.id);
  if (!articles.length) {
    throw new Error(`No articles in book.pz for ${book.id}`);
  }
  logger.info(LOG, `CDN API: ${articles.length} articles for ${book.id}`);

  const priorChapterTotal = progress.chaptersTotal;
  progress.chaptersTotal = articles.length;
  const preserveCounters = progress.bookId === book.id
    && priorChapterTotal === articles.length
    && (progress.chapterCurrent > 0 || progress.chaptersDone > 0);
  seedBookProgressFromBackend(progress, ingestStatus, articles.length, cfg.enableAudioFetch, preserveCounters);
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
    slotsIngested: preserveCounters ? progress.slotsIngested : 0,
    chaptersSkipped: preserveCounters ? progress.chaptersSkipped : 0,
    forceReplaceUpload: !!cfg.forceReplaceUpload,
  };

  for (let chIdx = 0; chIdx < articles.length; chIdx += 1) {
    if (!(await importShouldContinue())) break;
    const art = articles[chIdx];
    let denseChapterIndex = uploadCtx.progress.chaptersDone + uploadCtx.chaptersSkipped;
    const backendCh = resolveBackendChapter(ingestStatus, art.articleIndex, denseChapterIndex);

    if (!uploadCtx.forceReplaceUpload && canSkipChapterTextFetch(backendCh)) {
      uploadCtx.chaptersSkipped += 1;
      uploadCtx.progress.chaptersScraped += 1;
      uploadCtx.progress.chaptersDone += 1;
      uploadCtx.progress.chaptersSkipped = uploadCtx.chaptersSkipped;
      uploadCtx.progress.chapterCurrent = denseChapterIndex + 1;
      uploadCtx.progress.step = 'skip';
      uploadCtx.progress.scrapePct = Math.round((uploadCtx.progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
      uploadCtx.progress.uploadPct = Math.round((uploadCtx.progress.chaptersDone / uploadCtx.progress.chaptersTotal) * 100);
      uploadCtx.progress.phase = `Skip text ch ${denseChapterIndex + 1}/${uploadCtx.progress.chaptersTotal}: ${book.titleEn}`;
      uploadCtx.progress.detail = `text on backend · audio queued async`;
      await saveProgress(uploadCtx.progress);
      logger.info(LOG, `Skip text ch ${denseChapterIndex + 1} book=${book.id} (audio async)`);
      scheduleChapterAudioFromBackend(baseUrl, cfg, book, denseChapterIndex, backendCh, sourceKey);
      await markChapterDone(
        state,
        book.id,
        denseChapterIndex,
        globalSeqBeforeChapter(denseChapterIndex + 1, ingestStatus),
      );
      continue;
    }

    uploadCtx.progress.step = 'scrape';
    uploadCtx.progress.chapterCurrent = denseChapterIndex + 1;
    uploadCtx.progress.phase = `CDN fetch ch ${denseChapterIndex + 1}/${uploadCtx.progress.chaptersTotal}: ${book.titleEn}`;
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
      uploadCtx.progress.chaptersTotal = Math.max(
        uploadCtx.progress.chaptersDone,
        uploadCtx.progress.chaptersTotal - 1,
      );
      await saveProgress(uploadCtx.progress);
      continue;
    }

    const chapter: DuoreaderChapter = {
      segmentIndex: art.segmentIndex,
      articleIndex: art.articleIndex,
      chapterIndex: denseChapterIndex,
      titleZh: `第${denseChapterIndex + 1}章`,
      titleEn: `Chapter ${denseChapterIndex + 1}`,
      paragraphs,
    };

    uploadCtx.progress.chaptersScraped += 1;
    uploadCtx.progress.scrapePct = Math.round((uploadCtx.progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
    uploadCtx.progress.detail = `fetched ${paragraphs.length} paragraphs`;
    await saveProgress(uploadCtx.progress);

    uploadCtx = await uploadChapterIfNeeded(uploadCtx, chapter, 'Upload');
    await sleep(80);
  }

  uploadCtx.progress.chaptersTotal = Math.max(
    uploadCtx.progress.chaptersDone,
    uploadCtx.progress.chaptersScraped,
  );
  await saveProgress(uploadCtx.progress);

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
  pauseRequested = false;
  const progress = await getDuoreaderProgress();
  progress.paused = false;
  progress.phase = 'Stopping…';
  progress.detail = 'finishing current step';
  await saveProgress(progress);
  if (activeImportConfig) {
    await saveSession({ config: activeImportConfig, interrupted: true, reason: 'stop' });
  }
  logger.info(LOG, 'Stop requested');
}

export async function pauseDuoreaderImport(): Promise<void> {
  if (!importRunning) {
    logger.warn(LOG, 'Pause ignored — no active import');
    return;
  }
  pauseRequested = true;
  const progress = await getDuoreaderProgress();
  progress.paused = true;
  progress.running = false;
  progress.phase = 'Paused';
  progress.detail = progress.bookTitle
    ? `paused at ${progress.bookTitle} · ch ${progress.chapterCurrent || '?'}/${progress.chaptersTotal || '?'}`
    : 'paused';
  await saveProgress(progress);
  if (activeImportConfig) {
    await saveSession({ config: activeImportConfig, interrupted: true, reason: 'pause' });
  }
  logger.info(LOG, 'Pause requested');
}

export async function resumeDuoreaderImport(
  config: Partial<DuoreaderImporterConfig> = {},
): Promise<{ success: boolean; error?: string; resumed?: boolean }> {
  if (importRunning && pauseRequested) {
    pauseRequested = false;
    const progress = await getDuoreaderProgress();
    progress.paused = false;
    progress.running = true;
    progress.phase = 'Resuming…';
    progress.error = '';
    await saveProgress(progress);
    if (activeImportConfig) {
      await saveSession({ config: activeImportConfig, interrupted: false, reason: '' });
    }
    logger.info(LOG, 'Resumed in-place');
    return { success: true, resumed: true };
  }
  if (importRunning) {
    return { success: false, error: 'Import already running' };
  }
  return startDuoreaderImport({ ...config, resume: true });
}

export async function startDuoreaderImport(
  config: Partial<DuoreaderImporterConfig> & { resume?: boolean } = {},
): Promise<{ success: boolean; error?: string; started?: boolean; resumed?: boolean }> {
  if (importRunning) {
    if (pauseRequested) {
      return resumeDuoreaderImport(config);
    }
    return { success: false, error: 'Import already running' };
  }

  const prevProgress = await getDuoreaderProgress();
  const session = await loadSession();
  const explicitResume = config.resume === true;
  const canResume = explicitResume
    || ((session?.interrupted || prevProgress.phase === 'Stopped' || prevProgress.paused)
      && !!prevProgress.bookId
      && prevProgress.booksTotal > 0);

  importRunning = true;
  stopRequested = false;
  pauseRequested = false;

  const legacyCfg = config as Partial<DuoreaderImporterConfig> & { enableTtsEnrich?: boolean; resume?: boolean };
  const cfg: DuoreaderImporterConfig = {
    ...DEFAULT_IMPORTER_CONFIG,
    ...(canResume && session?.config ? session.config : {}),
    ...config,
    enableAudioFetch: legacyCfg.enableAudioFetch ?? legacyCfg.enableTtsEnrich ?? DEFAULT_IMPORTER_CONFIG.enableAudioFetch,
  };
  delete (cfg as Partial<DuoreaderImporterConfig> & { resume?: boolean }).resume;
  activeImportConfig = cfg;

  const progress = canResume
    ? {
        ...normalizeImportProgress(prevProgress),
        running: true,
        paused: false,
        error: '',
        phase: 'Resuming…',
        detail: prevProgress.bookTitle
          ? `resume ${prevProgress.bookTitle} · ch ${prevProgress.chapterCurrent || '?'}/${prevProgress.chaptersTotal || '?'}`
          : 'resuming import',
      }
    : {
        ...emptyProgress(),
        running: true,
        step: 'catalog' as const,
        phase: 'Starting…',
        detail: `resolving API · backup ${describeDuoreaderDataLocation()}`,
      };

  await saveProgress(progress);
  await saveSession({ config: cfg, interrupted: false, reason: '' });
  logger.info(
    LOG,
    `${canResume ? 'Resume' : 'Start'} import (my=${cfg.myLang} learn=${cfg.learnLang} maxBooks=${cfg.maxBooks} cdnApi=${cfg.useCdnApi} audio=${cfg.enableAudioFetch})`,
  );

  try {
    const baseUrl = await resolveApiBase();
    logger.info(LOG, `API base: ${baseUrl}`);

    if (!canResume || !progress.booksTotal) {
      progress.step = 'catalog';
      progress.phase = 'Loading catalog';
      progress.detail = DUOREADER_SHELF_URL;
      await saveProgress(progress);
    }

    const shelf = await fetchShelf();
    let books = listBilingualBooks(shelf, cfg);
    if (cfg.enrichCoversFromSearch && books.length && !canResume) {
      progress.phase = 'Searching cover images';
      progress.detail = 'Google/Bing image search';
      await saveProgress(progress);
      const { enrichBookCovers } = await import('./web-search-service');
      books = await enrichBookCovers(books, { onlyMissing: true, waitForVerification: true });
    }
    const state = await loadState();

    progress.booksTotal = books.length;
    progress.booksDone = books.filter((b) => state.books[b.id]?.status === 'completed').length;
    if (!canResume) {
      progress.phase = books.length ? `Found ${books.length} books` : 'No bilingual books found';
    }
    await saveProgress(progress);
    logger.info(LOG, `Catalog: ${books.length} bilingual book(s)`);

    if (!books.length) {
      progress.running = false;
      progress.paused = false;
      await saveProgress(progress);
      return { success: true, started: true };
    }

    let tabId: number | null = null;

    for (const book of books) {
      if (!(await importShouldContinue())) break;
      const bookState = state.books[book.id];
      if (bookState?.status === 'completed') {
        progress.booksDone += 1;
        await saveProgress(progress);
        logger.info(LOG, `Skip completed book: ${book.id}`);
        continue;
      }

      if (canResume && prevProgress.bookId && book.id !== prevProgress.bookId) {
        const bookOrder = books.findIndex((b) => b.id === prevProgress.bookId);
        const thisOrder = books.findIndex((b) => b.id === book.id);
        if (bookOrder >= 0 && thisOrder >= 0 && thisOrder < bookOrder) {
          continue;
        }
      }

      progress.bookId = book.id;
      progress.bookTitle = book.titleEn;
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

      const sourceKey = await sourceKeyForBookAsync(book.id);
      const ingestStatus = await fetchBookIngestStatus(baseUrl, sourceKey, ingestStatusQueryForConfig(cfg));
      const priorChapterTotal = progress.chaptersTotal;
      progress.chaptersTotal = toc.length;
      const preserveCounters = progress.bookId === book.id
        && priorChapterTotal === toc.length
        && (progress.chapterCurrent > 0 || progress.chaptersDone > 0);
      seedBookProgressFromBackend(progress, ingestStatus, toc.length, cfg.enableAudioFetch, preserveCounters);
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
        slotsIngested: progress.slotsIngested || 0,
        chaptersSkipped: progress.chaptersSkipped || 0,
        forceReplaceUpload: !!cfg.forceReplaceUpload,
      };

      for (const tocItem of toc) {
        if (!(await importShouldContinue())) break;
        const denseChapterIndex = uploadCtx.progress.chaptersDone + uploadCtx.chaptersSkipped;
        const backendCh = resolveBackendChapter(ingestStatus, tocItem.chapterIndex, denseChapterIndex);

        if (!uploadCtx.forceReplaceUpload && canSkipChapterTextFetch(backendCh)) {
          uploadCtx.chaptersSkipped += 1;
          uploadCtx.progress.chaptersScraped += 1;
          uploadCtx.progress.chaptersDone += 1;
          uploadCtx.progress.chaptersSkipped = uploadCtx.chaptersSkipped;
          uploadCtx.progress.chapterCurrent = denseChapterIndex + 1;
          uploadCtx.progress.step = 'skip';
          uploadCtx.progress.scrapePct = Math.round((uploadCtx.progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
          uploadCtx.progress.uploadPct = Math.round((uploadCtx.progress.chaptersDone / uploadCtx.progress.chaptersTotal) * 100);
          uploadCtx.progress.phase = `Skip text ch ${denseChapterIndex + 1}/${uploadCtx.progress.chaptersTotal}: ${book.titleEn}`;
          uploadCtx.progress.detail = 'text on backend · audio queued async';
          await saveProgress(uploadCtx.progress);
          logger.info(LOG, `Skip text ch ${denseChapterIndex + 1} book=${book.id} (audio async)`);
          scheduleChapterAudioFromBackend(baseUrl, cfg, book, denseChapterIndex, backendCh, sourceKey);
          await markChapterDone(
            state,
            book.id,
            denseChapterIndex,
            globalSeqBeforeChapter(denseChapterIndex + 1, ingestStatus),
          );
          continue;
        }

        const chNum = denseChapterIndex + 1;
        progress.step = 'scrape';
        progress.chapterCurrent = chNum;
        progress.phase = `Scraping ch ${chNum}/${uploadCtx.progress.chaptersTotal}: ${book.titleEn}`;
        progress.detail = 'loading chapter in tab';
        await saveProgress(progress);

        await navigateAndWait(tabId, viewerUrl(book.id, tocItem.chapterIndex, 0));
        const rawChapter = await extractChapter(tabId);
        if (!rawChapter || !rawChapter.paragraphs.length) {
          logger.warn(LOG, `Empty chapter ${tocItem.chapterIndex} in ${book.id}`);
          uploadCtx.progress.chaptersTotal = Math.max(
            uploadCtx.progress.chaptersDone,
            uploadCtx.progress.chaptersTotal - 1,
          );
          await saveProgress(uploadCtx.progress);
          continue;
        }

        progress.chaptersScraped += 1;
        progress.scrapePct = Math.round((progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
        progress.detail = `scraped ${rawChapter.paragraphs.length} paragraphs`;
        await saveProgress(progress);

        const chapter: DuoreaderChapter = {
          ...rawChapter,
          segmentIndex: 0,
          chapterIndex: denseChapterIndex,
          articleIndex: tocItem.chapterIndex,
          titleZh: rawChapter.titleZh || tocItem.titleZh,
          titleEn: rawChapter.titleEn || tocItem.titleEn,
        };

        progress.scrapePct = Math.round((progress.chaptersScraped / uploadCtx.progress.chaptersTotal) * 100);
        await saveProgress(progress);

        uploadCtx = await uploadChapterIfNeeded(uploadCtx, chapter, 'Uploading');
        await sleep(500);
      }

      uploadCtx.progress.chaptersTotal = Math.max(
        uploadCtx.progress.chaptersDone,
        uploadCtx.progress.chaptersScraped,
      );
      await saveProgress(uploadCtx.progress);

      await completeBook(state, book, progress, uploadCtx, 'scrape');
    }

    const finalProgress = await getDuoreaderProgress();
    if (stopRequested) {
      finalProgress.running = false;
      finalProgress.paused = false;
      finalProgress.phase = 'Stopped';
      finalProgress.detail = pendingAudioChapters.length
        ? `stopped · ${pendingAudioChapters.length} audio chapter(s) queued`
        : finalProgress.detail;
      pendingAudioChapters.length = 0;
      await saveProgress(finalProgress);
      if (activeImportConfig) {
        await saveSession({ config: activeImportConfig, interrupted: true, reason: 'stop' });
      }
      logger.info(LOG, 'Import stopped');
      return { success: true, started: true, resumed: canResume };
    }

    finalProgress.running = false;
    finalProgress.paused = false;
    finalProgress.phase = 'Text import done';
    finalProgress.detail = cfg.enableAudioFetch
      ? 'text complete · audio continues in background'
      : 'import complete';
    await saveProgress(finalProgress);
    if (activeImportConfig) {
      await saveSession({ config: activeImportConfig, interrupted: false, reason: '' });
    }
    logger.info(LOG, finalProgress.phase);
    return { success: true, started: true, resumed: canResume };
  } catch (error: any) {
    const progress = await getDuoreaderProgress();
    progress.running = false;
    progress.paused = false;
    progress.error = error?.message || String(error);
    progress.phase = 'Failed';
    await saveProgress(progress);
    if (activeImportConfig) {
      await saveSession({ config: activeImportConfig, interrupted: true, reason: 'stop' });
    }
    logger.error(LOG, progress.error, error);
    return { success: false, error: progress.error };
  } finally {
    importRunning = false;
    activeImportConfig = null;
    stopRequested = false;
    pauseRequested = false;
  }
}

export async function listDuoreaderBooks(
  config: Partial<DuoreaderImporterConfig> = {},
  options: { enrichCovers?: boolean } = {},
): Promise<DuoreaderBookMeta[]> {
  const cfg = { ...DEFAULT_IMPORTER_CONFIG, ...config };
  const shelf = await fetchShelf();
  let books = listBilingualBooks(shelf, cfg);
  const shouldEnrich = options.enrichCovers === true && cfg.enrichCoversFromSearch;
  if (shouldEnrich && books.length) {
    const { enrichBookCovers } = await import('./web-search-service');
    books = await enrichBookCovers(books, { onlyMissing: true, waitForVerification: true });
  }
  return books;
}

export async function unpackPzMessageBytes(bytes: number[] | Uint8Array): Promise<Uint8Array> {
  return unpackDuoreaderPzBytesAsync(bytes);
}
