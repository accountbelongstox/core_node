/**
 * Inputs of a composition, all from the API side:
 *   vocab_book      Laravel media books (one chapter or the whole book), with the
 *                   per-language sentence audio Laravel already holds
 *   prompt_rewrite  a prompt-rewrite result Laravel holds (`/orch_audio/tasks`,
 *                   source prompt_rewrite): bilingual sentences with audio
 * Word read states come from Laravel `learning/sentence-words` for the task's
 * word group, overlaid (read only) with its API-side virtual read batch; the
 * lookup also queues missing word audio at the head of the generation lane.
 *
 * Native keeps the inputs of every task on the device (cache library,
 * `Directory.Data`): Laravel serves only the initial load, later opens re-plan
 * from the copy (offline too); the web uses the API responses directly. The
 * initial load runs in parallel (sentence pages, word-state batches) and is
 * checkpointed, so a long load (a whole book) survives leaving and reopening.
 */
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import { orchPool } from '../../../../shared/orchestration/orchClipResolver';
import type { OrchComposeInputs, OrchInputsProgress } from '../../../../shared/orchestration/orchComposer';
import { tokenize } from '../../../../shared/orchestration/orchPlanner';
import type { OrchComposeSentence, OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';
import { CapJsonStore, Directory, capFs } from '../../platform/capabilities';
import { wfNewApi, type WfNewBookVerse, type WfNewOrchAudioSentence } from '../../api';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { getSentenceWordTable, sentenceWordTranslations } from '../WordNewSentenceWordTable';

const VERSE_PAGE_SIZE = 500;
const WORD_STATE_BATCH = 300;
const MAX_MEANING_CHARS = 24;
const INPUT_DIR = 'wfnew-orch/inputs';
const STATES_SUFFIX = '.states.json';
const VERSE_PAGE_CONCURRENCY = 4;
const WORD_STATE_CONCURRENCY = 3;
const CHECKPOINT_SAVE_MS = 2_000;

interface StoredInputs {
  sourceKey: string;
  sentences: OrchComposeSentence[];
  wordStates: OrchWordState[];
  /** False while the initial load is still running (states live in the checkpoint). */
  complete?: boolean;
}

function inputStore(taskId: string): CapJsonStore<StoredInputs> {
  return new CapJsonStore<StoredInputs>(
    `${INPUT_DIR}/${taskId}.json`,
    { sourceKey: '', sentences: [], wordStates: [] },
    Directory.Data,
  );
}

function stateStore(taskId: string): CapJsonStore<WordStateCheckpoint> {
  return new CapJsonStore<WordStateCheckpoint>(`${INPUT_DIR}/${taskId}${STATES_SUFFIX}`, EMPTY_CHECKPOINT, Directory.Data);
}

/** Identity of the inputs a task needs (a kept copy of other inputs is not used). */
function sourceKeyOf(task: OrchComposeTask): string {
  const { book, prompt, wordGroupId, virtualBatch, readState } = task.config;
  const origin = book ? `book:${book.sourceKey}:${book.chapterIndex ?? 'all'}` : `prompt:${prompt?.taskKey ?? ''}`;
  return `${origin}|group:${wordGroupId ?? ''}|reads:${readState}:${readState === 'real' ? '' : virtualBatch}`;
}

function verseToSentence(verse: WfNewBookVerse, position: number): OrchComposeSentence {
  const languages: Record<string, string> = {};
  const audio: Record<string, string> = {};
  Object.entries(verse.languages ?? {}).forEach(([lang, cell]) => {
    if (cell?.text?.trim()) languages[lang] = cell.text.trim();
    if (cell?.audio) audio[lang] = cell.audio;
  });
  const language = verse.language || 'en';
  const text = (verse.text ?? languages[language] ?? '').trim();
  if (text && !languages[language]) languages[language] = text;
  return { seq: Number.isFinite(verse.seq) ? verse.seq : position, text, language, languages, audio };
}

function promptSentence(sentence: WfNewOrchAudioSentence): OrchComposeSentence {
  return {
    seq: sentence.seq,
    text: sentence.text.trim(),
    language: sentence.language,
    languages: { ...sentence.languages },
    audio: sentence.audioUrl ? { [sentence.language]: sentence.audioUrl } : {},
  };
}

/** Report sentence pages as they land. */
type ReportSentences = (loaded: number, total: number) => void;

async function bookSentences(task: OrchComposeTask, report: ReportSentences): Promise<OrchComposeSentence[]> {
  const book = task.config.book;
  if (!book) return [];
  const fetchPage = (page: number) => wfNewApi.getBookVerses(book.sourceKey, {
    page,
    perPage: VERSE_PAGE_SIZE,
    ...(book.chapterIndex != null ? { chapterIndex: book.chapterIndex } : {}),
  });
  const first = await fetchPage(1);
  const pages: WfNewBookVerse[][] = [first.items];
  let loaded = first.items.length;
  report(loaded, first.total);
  if (first.lastPage > 1) {
    // The page count is known: the other pages load in parallel, kept in page order.
    const rest = Array.from({ length: first.lastPage - 1 }, (_, index) => index + 2);
    await orchPool(rest, async (page) => {
      const result = await fetchPage(page);
      pages[page - 1] = result.items;
      loaded += result.items.length;
      report(loaded, first.total);
    }, undefined, VERSE_PAGE_CONCURRENCY);
  } else {
    // No page count (open-ended listing): page by page.
    for (let page = 2, more = first.hasMore && first.items.length > 0; more; page += 1) {
      const result = await fetchPage(page);
      pages.push(result.items);
      loaded += result.items.length;
      report(loaded, Math.max(first.total, loaded));
      more = result.hasMore && result.items.length > 0;
    }
  }
  const sentences: OrchComposeSentence[] = [];
  pages.flat().forEach((verse) => {
    const sentence = verseToSentence(verse, sentences.length);
    if (sentence.text) sentences.push(sentence);
  });
  return sentences;
}

async function promptSentences(task: OrchComposeTask, report: ReportSentences): Promise<OrchComposeSentence[]> {
  const prompt = task.config.prompt;
  if (!prompt) return [];
  const detail = await wfNewApi.getOrchAudioDetail(prompt.taskKey);
  if (!detail) return [];
  const total = detail.firstSentencePage.total;
  const pages: WfNewOrchAudioSentence[][] = [detail.firstSentencePage.items];
  let loaded = pages[0].length;
  report(loaded, total);
  const count = Math.ceil(total / Math.max(1, detail.firstSentencePage.perPage));
  const rest = Array.from({ length: Math.max(0, count - 1) }, (_, index) => index + 2);
  await orchPool(rest, async (page) => {
    pages[page - 1] = (await wfNewApi.getOrchAudioSentencePage(prompt.taskKey, page)).items;
    loaded += pages[page - 1].length;
    report(loaded, total);
  }, undefined, VERSE_PAGE_CONCURRENCY);
  return pages.flat().map(promptSentence).filter((sentence) => sentence.text !== '');
}

function shortMeaning(translations: string[]): string {
  const first = (translations[0] ?? '').split(/[;；,，\n]/)[0]?.trim() ?? '';
  return first.slice(0, MAX_MEANING_CHARS);
}

/** Word-state checkpoint of an interrupted load: the batches done and their states. */
interface WordStateCheckpoint {
  sourceKey: string;
  batches: number;
  done: number[];
  wordStates: OrchWordState[];
}

const EMPTY_CHECKPOINT: WordStateCheckpoint = { sourceKey: '', batches: 0, done: [], wordStates: [] };

/**
 * Read states of every word of the sentences, in batches (WORD_STATE_CONCURRENCY
 * at a time). Batches a checkpoint already holds are skipped; `onBatch` gets
 * the checkpoint after every batch (the caller keeps it).
 */
async function wordStates(
  sentences: OrchComposeSentence[],
  task: OrchComposeTask,
  sourceKey: string,
  checkpoint: WordStateCheckpoint,
  report: (done: number, total: number) => void,
  onBatch: (checkpoint: () => WordStateCheckpoint) => void,
): Promise<Map<string, OrchWordState>> {
  const words = [...new Set(sentences.flatMap((sentence) => tokenize(sentence.text)))];
  const target = task.config.book?.targetLanguage || 'zh';
  const batches = Math.ceil(words.length / WORD_STATE_BATCH);
  // A checkpoint of other words (other sentences) is not used.
  const resumed = checkpoint.sourceKey === sourceKey && checkpoint.batches === batches ? checkpoint : EMPTY_CHECKPOINT;
  const states = new Map<string, OrchWordState>(resumed.wordStates.map((state) => [state.word, state]));
  const done = new Set(resumed.done);
  const todo = Array.from({ length: batches }, (_, index) => index).filter((index) => !done.has(index));
  const wordsDone = (): number => Math.min(words.length, done.size * WORD_STATE_BATCH);
  report(wordsDone(), words.length);
  await orchPool(todo, async (index) => {
    const rows = await getSentenceWordTable(
      words.slice(index * WORD_STATE_BATCH, (index + 1) * WORD_STATE_BATCH).join(' '),
      task.language,
      target,
      task.config.newOnlyMaxReadCount,
      task.config.wordGroupId,
      task.config.readState === 'real' ? null : task.config.virtualBatch || null,
    );
    rows.forEach((row) => {
      const word = row.word.trim().toLowerCase();
      if (!word) return;
      const readCount = Number(row.play_count) || 0;
      const virtualReadCount = Number(row.virtual_read_count) || 0;
      states.set(word, {
        word,
        readCount,
        groupReadCount: row.group_read_count != null ? Number(row.group_read_count) || 0 : Math.max(0, readCount - virtualReadCount),
        virtualReadCount,
        wordId: Number(row.dictionary_word_id) || 0,
        audioUrl: row.audio_url && row.audio_status !== 'pending' ? row.audio_url : null,
        meaning: shortMeaning(sentenceWordTranslations(row)),
      });
    });
    done.add(index);
    report(wordsDone(), words.length);
    // The checkpoint is built when it is written (throttled), not per batch.
    onBatch(() => ({ sourceKey, batches, done: [...done], wordStates: [...states.values()] }));
  }, undefined, WORD_STATE_CONCURRENCY);
  return states;
}

/**
 * Writes a checkpoint at most every CHECKPOINT_SAVE_MS, one write at a time;
 * `flush` writes the last one. A push is a producer: the value is built only
 * when it is written.
 */
function checkpointWriter<T>(write: (value: T) => Promise<void>): { push: (value: () => T) => void; flush: () => Promise<void> } {
  let latest: (() => T) | null = null;
  let savedAt = 0;
  let chain: Promise<void> = Promise.resolve();
  const save = (): Promise<void> => {
    const make = latest;
    latest = null;
    savedAt = Date.now();
    chain = chain.then(() => (make === null ? undefined : write(make()))).catch(() => undefined);
    return chain;
  };
  return {
    push: (value) => {
      latest = value;
      if (Date.now() - savedAt >= CHECKPOINT_SAVE_MS) void save();
    },
    flush: () => save(),
  };
}

class WordNewOrchSourcesService {
  private readonly keep = isNativeAppShell();

  /**
   * Local-first (native): Laravel serves the initial load; a complete kept copy
   * of the same inputs is used without network. The initial load is
   * checkpointed - sentences once fetched, word states after every batch - so
   * an interrupted load (app closed, page left, network lost) continues where
   * it stopped. `force` reloads from Laravel (re-resolve). `report` gets the
   * load progress.
   */
  async load(
    task: OrchComposeTask,
    options: { force?: boolean } = {},
    report: (progress: OrchInputsProgress) => void = () => undefined,
  ): Promise<OrchComposeInputs> {
    const sourceKey = sourceKeyOf(task);
    const progress: OrchInputsProgress = { sentences: 0, sentencesTotal: 0, words: 0, wordsTotal: 0 };
    const publish = (patch: Partial<OrchInputsProgress>): void => {
      Object.assign(progress, patch);
      report({ ...progress });
    };
    const kept = this.keep ? await inputStore(task.id).load() : null;
    const keptMatch = !options.force && kept !== null && kept.sourceKey === sourceKey && kept.sentences.length > 0;
    // A copy written before checkpoints existed has no `complete` flag: it is complete.
    if (keptMatch && kept.complete !== false) {
      return { sentences: kept.sentences, wordStates: new Map(kept.wordStates.map((state) => [state.word, state])), fresh: true };
    }
    const sentences = keptMatch ? kept.sentences
      : await (task.config.book ? bookSentences : promptSentences)(task, (loaded, total) => publish({ sentences: loaded, sentencesTotal: total })).catch(() => null);
    if (sentences) {
      publish({ sentences: sentences.length, sentencesTotal: sentences.length });
      if (this.keep && !keptMatch) await inputStore(task.id).save({ sourceKey, sentences, wordStates: [], complete: false });
    }
    const checkpoint = this.keep && !options.force ? await stateStore(task.id).load() : EMPTY_CHECKPOINT;
    const writer = checkpointWriter<WordStateCheckpoint>((value) => (this.keep ? stateStore(task.id).save(value) : Promise.resolve()));
    // Read states are per user: logged out, every word counts as unread (not a failure).
    const states = !sentences ? null
      : wfNewApi.isAuthenticated()
        ? await wordStates(sentences, task, sourceKey, checkpoint, (done, total) => publish({ words: done, wordsTotal: total }), writer.push).catch(() => null)
        : new Map<string, OrchWordState>();
    await writer.flush();
    if (sentences && states) {
      if (this.keep) {
        await inputStore(task.id).save({ sourceKey, sentences, wordStates: [...states.values()], complete: true });
        await stateStore(task.id).clear();
      }
      // The API that just answered the load (requests go to the current endpoint).
      return { sentences, wordStates: states, fresh: true, laravelUrl: wfNewEndpoints.getCurrentBaseUrl() };
    }
    // Offline / failed: what is kept (an incomplete load's states included) is used as stale.
    const stored = this.keep ? await inputStore(task.id).load() : null;
    const usable = stored?.sourceKey === sourceKey;
    const partial = this.keep ? await stateStore(task.id).load() : EMPTY_CHECKPOINT;
    const keptStates = usable && stored?.complete !== false ? stored?.wordStates ?? []
      : partial.sourceKey === sourceKey ? partial.wordStates : [];
    return {
      sentences: sentences ?? (usable && stored ? stored.sentences : []),
      wordStates: states ?? new Map(keptStates.map((state) => [state.word, state])),
      fresh: false,
    };
  }

  /** Kept input copies (cache registry item `orchInputs`). */
  async stats(): Promise<number> {
    if (!this.keep) return 0;
    return (await capFs.readdir(INPUT_DIR, Directory.Data))
      .filter((entry) => entry.type === 'file' && !entry.name.endsWith(STATES_SUFFIX)).length;
  }

  async clear(): Promise<void> {
    if (this.keep) await capFs.rmdir(INPUT_DIR, Directory.Data);
  }

  async forget(taskId: string): Promise<void> {
    if (!this.keep) return;
    await inputStore(taskId).clear();
    await stateStore(taskId).clear();
  }
}

export const wordNewOrchSources = new WordNewOrchSourcesService();
