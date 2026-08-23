import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import {
  DEFAULT_IMPORTER_CONFIG,
  buildSlots,
  buildSource,
  canSkipChapterTextFetch,
  fetchShelf,
  globalSeqBeforeChapter,
  ingestChapter,
  isChapterTextCompleteOnBackend,
  listBilingualBooks,
  type BookIngestStatus,
  type DuoreaderBookMeta,
  type DuoreaderChapter,
  type DuoreaderImporterConfig,
  type DuoreaderImportProgress,
} from '@/utils/duoreader-importer-core';
import { backupChapterText } from '@/utils/duoreader-audio-store';
import {
  articlePzUrl,
  bookPzUrl,
  fetchPz,
  parseArticleIdsFromBook,
  parseArticleParagraphs,
  type DuoreaderApiTestResult,
  type DuoreaderArticleRef,
} from '@/utils/duoreader-pz-decode';

const LOG = 'DuoreaderImporter';

export interface DuoreaderPersistedState {
  books: Record<string, { chapters_done: number[]; global_seq: number; status: string }>;
}

type PersistedState = DuoreaderPersistedState;

interface DuoreaderBookImporterDependencies {
  saveState: (state: DuoreaderPersistedState) => Promise<void>;
  saveProgress: (progress: DuoreaderImportProgress) => Promise<void>;
  scheduleChapterAudioFromSlots: (
    baseUrl: string,
    config: DuoreaderImporterConfig,
    book: DuoreaderBookMeta,
    chapter: DuoreaderChapter,
    slots: Record<string, unknown>[],
    sourceKey: string,
  ) => void;
}

export function createDuoreaderBookImporter(dependencies: DuoreaderBookImporterDependencies) {
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
  await dependencies.saveState(state);

  progress.booksDone += 1;
  progress.step = 'done';
  progress.phase = `Completed (${modeLabel}): ${book.titleEn} (${uploadCtx.slotsIngested} new slots, ${uploadCtx.chaptersSkipped} skipped)`;
  progress.detail = `text ${uploadCtx.slotsIngested} slots · audio ${progress.audioFetchedLearn}+${progress.audioFetchedMy} clips`;
  await dependencies.saveProgress(progress);
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

async function testDuoreaderImportApi(
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
  await dependencies.saveState(state);
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
    await dependencies.saveProgress(ctx.progress);
    logger.info(
      LOG,
      `Skip upload ch ${chapter.chapterIndex + 1} book=${ctx.book.id} slots=${expected} (backend ${backendCh?.slot_count}/${backendCh?.sentence_count})`,
    );
    await markChapterDone(ctx.state, ctx.book.id, chapter.chapterIndex, Math.max(ctx.globalSeq, seqStart + expected));

    const skipSlots = await buildSlots(ctx.book.id, chapter, ctx.cfg, seqStart);
    dependencies.scheduleChapterAudioFromSlots(
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
  await dependencies.saveProgress(ctx.progress);

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
  await dependencies.saveProgress(ctx.progress);
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
        text_complete: true,
      };
  ctx.ingestStatus.chapterMap.set(chapter.chapterIndex, updated);

  dependencies.scheduleChapterAudioFromSlots(
    ctx.baseUrl,
    ctx.cfg,
    ctx.book,
    chapter,
    slots,
    ctx.sourceKey,
  );

  return ctx;
}
  return {
    completeBook,
    loadBookArticlesViaCdn,
    loadChapterViaCdn,
    markChapterDone,
    testDuoreaderImportApi,
    uploadChapterIfNeeded,
  };
}
