/**
 * Sentence and word-state inputs of a composition. Book sentences come from the
 * Laravel media API (with the per-language audio URLs Laravel already holds),
 * pasted text is split locally; word read states, audio URLs and meanings come
 * from Laravel `learning/sentence-words` (which also queues missing word audio
 * at the head of the generation lane). The last inputs of every task are kept
 * on the device, so a composition re-plans and plays offline.
 */
import { CapJsonStore, Directory } from '../../platform/capabilities';
import { wfNewApi, type WfNewBookVerse } from '../../api';
import { getSentenceWordTable, sentenceWordTranslations } from '../WordNewSentenceWordTable';
import { sentencesFromText, tokenize } from '../../../../shared/orchestration/orchPlanner';
import type { OrchComposeInputs } from '../../../../shared/orchestration/orchComposer';
import type { OrchComposeSentence, OrchComposeTask, OrchWordState } from '../../../../shared/orchestration/orchTypes';

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

function sourceKeyOf(task: OrchComposeTask): string {
  const book = task.config.book;
  return book ? `book:${book.sourceKey}:${book.chapterIndex ?? 'all'}` : `text:${task.config.sourceText.length}:${task.config.sourceText.slice(0, 64)}`;
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

function shortMeaning(translations: string[]): string {
  const first = (translations[0] ?? '').split(/[;；,，\n]/)[0]?.trim() ?? '';
  return first.slice(0, MAX_MEANING_CHARS);
}

async function wordStates(
  sentences: OrchComposeSentence[],
  task: OrchComposeTask,
): Promise<Map<string, OrchWordState>> {
  const words = [...new Set(sentences.flatMap((sentence) => tokenize(sentence.text)))];
  const target = task.config.book?.targetLanguage || 'zh';
  const states = new Map<string, OrchWordState>();
  for (let offset = 0; offset < words.length; offset += WORD_STATE_BATCH) {
    const rows = await getSentenceWordTable(
      words.slice(offset, offset + WORD_STATE_BATCH).join(' '),
      task.language,
      target,
      task.config.newOnlyMaxReadCount,
    );
    rows.forEach((row) => {
      const word = row.word.trim().toLowerCase();
      if (!word) return;
      states.set(word, {
        word,
        readCount: Number(row.play_count) || 0,
        audioUrl: row.audio_url && row.audio_status !== 'pending' ? row.audio_url : null,
        meaning: shortMeaning(sentenceWordTranslations(row)),
      });
    });
  }
  return states;
}

class WordNewOrchSourcesService {
  async load(task: OrchComposeTask): Promise<OrchComposeInputs> {
    const store = inputStore(task.id);
    const sourceKey = sourceKeyOf(task);
    const sentences = task.config.book
      ? await bookSentences(task).catch(() => null)
      : sentencesFromText(task.config.sourceText, task.language);
    // Read states are per user: logged out, every word counts as unread (not a failure).
    const states = !sentences ? null
      : wfNewApi.isAuthenticated() ? await wordStates(sentences, task).catch(() => null)
        : new Map<string, OrchWordState>();
    if (sentences && states) {
      await store.save({ sourceKey, sentences, wordStates: [...states.values()] });
      return { sentences, wordStates: states, fresh: true };
    }
    const stored = await store.load();
    const usable = stored.sourceKey === sourceKey;
    return {
      sentences: sentences ?? (usable ? stored.sentences : []),
      wordStates: states ?? new Map((usable ? stored.wordStates : []).map((state) => [state.word, state])),
      fresh: false,
    };
  }

  async forget(taskId: string): Promise<void> {
    await inputStore(taskId).clear();
  }
}

export const wordNewOrchSources = new WordNewOrchSourcesService();
