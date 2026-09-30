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
 * Native keeps the last inputs of every task on the device (cache library,
 * `Directory.Data`) so a composition re-plans and plays offline; the web uses
 * the API responses directly and keeps no copy.
 */
import { isNativeAppShell } from '../../../../core/network/NativeShell';
import type { OrchComposeInputs } from '../../../../shared/orchestration/orchComposer';
import { tokenize } from '../../../../shared/orchestration/orchPlanner';
import type { OrchComposeSentence, OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';
import { CapJsonStore, Directory, capFs } from '../../platform/capabilities';
import { wfNewApi, type WfNewBookVerse, type WfNewOrchAudioSentence } from '../../api';
import { getSentenceWordTable, sentenceWordTranslations } from '../WordNewSentenceWordTable';

const VERSE_PAGE_SIZE = 500;
const WORD_STATE_BATCH = 300;
const MAX_MEANING_CHARS = 24;
const INPUT_DIR = 'wfnew-orch/inputs';

interface StoredInputs {
  sourceKey: string;
  sentences: OrchComposeSentence[];
  wordStates: OrchWordState[];
}

function inputStore(taskId: string): CapJsonStore<StoredInputs> {
  return new CapJsonStore<StoredInputs>(
    `${INPUT_DIR}/${taskId}.json`,
    { sourceKey: '', sentences: [], wordStates: [] },
    Directory.Data,
  );
}

/** Identity of the inputs a task needs (a kept copy of other inputs is not used). */
function sourceKeyOf(task: OrchComposeTask): string {
  const { book, prompt, wordGroupId, virtualBatch } = task.config;
  const origin = book ? `book:${book.sourceKey}:${book.chapterIndex ?? 'all'}` : `prompt:${prompt?.taskKey ?? ''}`;
  return `${origin}|group:${wordGroupId ?? ''}|batch:${virtualBatch}`;
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

async function bookSentences(task: OrchComposeTask): Promise<OrchComposeSentence[]> {
  const book = task.config.book;
  if (!book) return [];
  const sentences: OrchComposeSentence[] = [];
  for (let page = 1; ; page += 1) {
    const result = await wfNewApi.getBookVerses(book.sourceKey, {
      page,
      perPage: VERSE_PAGE_SIZE,
      ...(book.chapterIndex != null ? { chapterIndex: book.chapterIndex } : {}),
    });
    result.items.forEach((verse) => {
      const sentence = verseToSentence(verse, sentences.length);
      if (sentence.text) sentences.push(sentence);
    });
    if (!result.hasMore || result.items.length === 0) break;
  }
  return sentences;
}

async function promptSentences(task: OrchComposeTask): Promise<OrchComposeSentence[]> {
  const prompt = task.config.prompt;
  if (!prompt) return [];
  const detail = await wfNewApi.getOrchAudioDetail(prompt.taskKey);
  if (!detail) return [];
  const rows = [...detail.firstSentencePage.items];
  const pages = Math.ceil(detail.firstSentencePage.total / Math.max(1, detail.firstSentencePage.perPage));
  for (let page = 2; page <= pages; page += 1) {
    rows.push(...(await wfNewApi.getOrchAudioSentencePage(prompt.taskKey, page)).items);
  }
  return rows.map(promptSentence).filter((sentence) => sentence.text !== '');
}

function shortMeaning(translations: string[]): string {
  const first = (translations[0] ?? '').split(/[;；,，\n]/)[0]?.trim() ?? '';
  return first.slice(0, MAX_MEANING_CHARS);
}

async function wordStates(sentences: OrchComposeSentence[], task: OrchComposeTask): Promise<Map<string, OrchWordState>> {
  const words = [...new Set(sentences.flatMap((sentence) => tokenize(sentence.text)))];
  const target = task.config.book?.targetLanguage || 'zh';
  const states = new Map<string, OrchWordState>();
  for (let offset = 0; offset < words.length; offset += WORD_STATE_BATCH) {
    const rows = await getSentenceWordTable(
      words.slice(offset, offset + WORD_STATE_BATCH).join(' '),
      task.language,
      target,
      task.config.newOnlyMaxReadCount,
      task.config.wordGroupId,
      task.config.virtualBatch || null,
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
        audioUrl: row.audio_url && row.audio_status !== 'pending' ? row.audio_url : null,
        meaning: shortMeaning(sentenceWordTranslations(row)),
      });
    });
  }
  return states;
}

class WordNewOrchSourcesService {
  private readonly keep = isNativeAppShell();

  async load(task: OrchComposeTask): Promise<OrchComposeInputs> {
    const sourceKey = sourceKeyOf(task);
    const sentences = await (task.config.book ? bookSentences(task) : promptSentences(task)).catch(() => null);
    // Read states are per user: logged out, every word counts as unread (not a failure).
    const states = !sentences ? null
      : wfNewApi.isAuthenticated() ? await wordStates(sentences, task).catch(() => null)
        : new Map<string, OrchWordState>();
    if (sentences && states) {
      if (this.keep) await inputStore(task.id).save({ sourceKey, sentences, wordStates: [...states.values()] });
      return { sentences, wordStates: states, fresh: true };
    }
    const stored = this.keep ? await inputStore(task.id).load() : null;
    const usable = stored?.sourceKey === sourceKey;
    return {
      sentences: sentences ?? (usable && stored ? stored.sentences : []),
      wordStates: states ?? new Map((usable && stored ? stored.wordStates : []).map((state) => [state.word, state])),
      fresh: false,
    };
  }

  /** Kept input copies (cache registry item `orchInputs`). */
  async stats(): Promise<number> {
    if (!this.keep) return 0;
    return (await capFs.readdir(INPUT_DIR, Directory.Data)).filter((entry) => entry.type === 'file').length;
  }

  async clear(): Promise<void> {
    if (this.keep) await capFs.rmdir(INPUT_DIR, Directory.Data);
  }

  async forget(taskId: string): Promise<void> {
    if (this.keep) await inputStore(taskId).clear();
  }
}

export const wordNewOrchSources = new WordNewOrchSourcesService();
