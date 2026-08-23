import { logger } from '@/utils/logger';
import { delay } from '@/utils/async';
import {
  computeContentId,
  isChapterAudioCompleteOnBackend,
  recomputeAudioPct,
  uploadSlotAudio,
  type BackendChapterIngestStatus,
  type BackendIngestSlotStatus,
  type DuoreaderBookMeta,
  type DuoreaderChapter,
  type DuoreaderImporterConfig,
  type DuoreaderImportProgress,
} from '@/utils/duoreader-importer-core';
import { fetchDuoreaderAudio } from '@/utils/duoreader-audio';
import {
  backupChapterText,
  backupSentenceAudio,
  describeDuoreaderDataLocation,
  hasLocalSentenceAudio,
  readLocalSentenceAudio,
} from '@/utils/duoreader-audio-store';

const LOG = 'DuoreaderImporter';

interface DuoreaderAudioQueueDependencies {
  getProgress: () => Promise<DuoreaderImportProgress>;
  saveProgress: (progress: DuoreaderImportProgress) => Promise<void>;
  shouldContinue: () => Promise<boolean>;
  isStopRequested: () => boolean;
}

export function createDuoreaderAudioQueue(dependencies: DuoreaderAudioQueueDependencies) {
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
    let progress = await dependencies.getProgress();
    progress.audioPending = true;
    progress.step = 'audio';
    await dependencies.saveProgress(progress);

    while (pendingAudioChapters.length) {
      if (!(await dependencies.shouldContinue())) {
        if (dependencies.isStopRequested()) break;
        continue;
      }
      const job = pendingAudioChapters.shift()!;
      progress = await dependencies.getProgress();
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

    progress = await dependencies.getProgress();
    progress.audioPending = false;
    if (!progress.running && !dependencies.isStopRequested()) {
      progress.phase = progress.phase === 'Text import done' ? 'All done' : progress.phase;
    }
    await dependencies.saveProgress(progress);
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
  if (!(await dependencies.shouldContinue())) return;

  const chNum = chapterIndex + 1;
  progress.chapterCurrent = chNum;
  progress.chapterSlotsExpected = backendChapter.slots.length;
  progress.audioSlotsTotal = backendChapter.slots.length;
  progress.audioSlotsTarget += backendChapter.slots.length;
  progress.step = 'audio';
  progress.phase = `Audio resume · ch ${chNum}/${progress.chaptersTotal}: ${book.titleEn}`;
  progress.detail = 'backend slot map (text+audio idempotent)';
  await dependencies.saveProgress(progress);

  const langs = [cfg.learnLang, cfg.myLang];
  for (let slotIdx = 0; slotIdx < backendChapter.slots.length; slotIdx += 1) {
    if (!(await dependencies.shouldContinue())) break;
    const slot = backendChapter.slots[slotIdx] as BackendIngestSlotStatus;
    progress.audioSlot = slotIdx + 1;
    progress.detail = `slot ${slotIdx + 1}/${backendChapter.slots.length}`;
    await dependencies.saveProgress(progress);

    for (const lang of langs) {
      if (!(await dependencies.shouldContinue())) break;
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
  if (!(await dependencies.shouldContinue())) return;

  progress.audioSlotsTarget += slots.length;

  const chNum = chapter.chapterIndex + 1;
  progress.chapterCurrent = chNum;
  progress.chapterSlotsExpected = slots.length;
  progress.audioSlotsTotal = slots.length;
  progress.step = 'audio';
  progress.phase = `Audio fetch · ch ${chNum}/${progress.chaptersTotal}: ${book.titleEn}`;
  progress.detail = `backing up text → ${describeDuoreaderDataLocation()}`;
  await dependencies.saveProgress(progress);

  await backupChapterText(book.id, chapter);

  const langs = [cfg.learnLang, cfg.myLang];
  for (let slotIdx = 0; slotIdx < slots.length; slotIdx += 1) {
    if (!(await dependencies.shouldContinue())) break;
    const slot = slots[slotIdx];
    const slotLangs = (slot.langs || {}) as Record<string, string | null>;
    progress.audioSlot = slotIdx + 1;
    progress.detail = `slot ${slotIdx + 1}/${slots.length}`;
    await dependencies.saveProgress(progress);

    for (const lang of langs) {
      if (!(await dependencies.shouldContinue())) break;
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
      await dependencies.saveProgress(progress);
      await delay(AUDIO_FETCH_DELAY_MS);
    }
  }

  progress.detail = `ch ${chNum} · audio ${progress.audioFetchedLearn}+${progress.audioFetchedMy} clips`;
  recomputeAudioPct(progress);
  await dependencies.saveProgress(progress);
  logger.info(
    LOG,
    `Audio ch ${chNum} book=${book.id}: ${cfg.learnLang}=${progress.audioFetchedLearn} ${cfg.myLang}=${progress.audioFetchedMy}`,
  );
}
  return {
    scheduleChapterAudioFromBackend,
    scheduleChapterAudioFromSlots,
    clear: () => { pendingAudioChapters.length = 0; },
    pendingCount: () => pendingAudioChapters.length,
  };
}

