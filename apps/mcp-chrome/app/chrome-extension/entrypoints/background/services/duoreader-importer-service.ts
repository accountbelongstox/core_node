/**
 * Duoreader import background service — tab scrape + Laravel upload.
 */

import { apiManager } from '@/services/ApiManager';
import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import { toErrorMessage } from '@/utils/errors';
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
import { createDuoreaderAudioQueue } from './duoreader-importer-audio-queue';
import {
  createDuoreaderBookImporter,
  type DuoreaderPersistedState as PersistedState,
} from './duoreader-importer-book';

const LOG = 'DuoreaderImporter';
const HELPER_SCRIPT = 'inject-scripts/duoreader-importer-helper.js';
const PING_ACTION = 'duoreader_importer_ping';

let stopRequested = false;
let pauseRequested = false;
let workerTabId: number | null = null;
let importRunning = false;
let activeImportConfig: DuoreaderImporterConfig | null = null;

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
    await delay(350);
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
    const msg = toErrorMessage(error);
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
  await delay(1500);
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
  await delay(800);
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

const duoreaderAudioQueue = createDuoreaderAudioQueue({
  getProgress: getDuoreaderProgress,
  saveProgress,
  shouldContinue: importShouldContinue,
  isStopRequested: () => stopRequested,
});
const { scheduleChapterAudioFromBackend, scheduleChapterAudioFromSlots } = duoreaderAudioQueue;

const duoreaderBookImporter = createDuoreaderBookImporter({
  saveState,
  saveProgress,
  scheduleChapterAudioFromSlots,
});
const {
  completeBook,
  loadBookArticlesViaCdn,
  loadChapterViaCdn,
  markChapterDone,
  uploadChapterIfNeeded,
} = duoreaderBookImporter;
export const testDuoreaderImportApi = duoreaderBookImporter.testDuoreaderImportApi;

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
  let uploadCtx = {
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
    await delay(80);
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

      let uploadCtx = {
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
        await delay(500);
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
      finalProgress.detail = duoreaderAudioQueue.pendingCount()
        ? `stopped · ${duoreaderAudioQueue.pendingCount()} audio chapter(s) queued`
        : finalProgress.detail;
      duoreaderAudioQueue.clear();
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
