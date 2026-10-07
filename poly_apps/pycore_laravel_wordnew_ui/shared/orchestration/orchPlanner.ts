/**
 * Pure planner: the pycore orchestration plan semantics
 * (`orch_generate.build_sentence_items`, `orch_books.partition_sentences`,
 * `orch_books.estimate_sentence_seconds`, `orch_words.select_words`) for the
 * client composer, so a composition made here plays exactly like pycore's.
 */
import { sha256Hex } from '../../core/utils/contentHash';
import type { OrchResourceKind } from '../../core/integrations/pycore';
import { orchClipIdentity, orchContentId } from './orchClipIdentity';
import { orchPassageBoundaries, orchPassageKey } from './orchPassages';
import {
  AUDIO_ORCH_DEFAULT_MAX_READ_COUNT,
  AUDIO_ORCH_DEFAULT_SEGMENT_MODE,
  AUDIO_ORCH_DEFAULT_SEGMENT_VALUE,
  AUDIO_ORCH_DEFAULT_VIRTUAL_BATCH,
  AUDIO_ORCH_MAX_STEP_TIMES,
  AUDIO_ORCH_PHRASE_PIPELINE,
  audioOrchDefaultPattern,
} from '../../core/contracts/AudioOrchestrationContract';
import type {
  OrchComposeConfig,
  OrchComposeItem,
  OrchComposePlan,
  OrchComposeResource,
  OrchComposeSegment,
  OrchComposeSentence,
  OrchComposeSource,
  OrchComposeSpec,
  OrchComposeStep,
  OrchPhrasesBySentence,
  OrchWordState,
} from './orchTypes';

export const ORCH_EN_WORDS_PER_SECOND = 2.5;
export const ORCH_ZH_CHARS_PER_SECOND = 4.5;
export const ORCH_SENTENCE_GAP_SECONDS = 1.0;
/** Silence between two clips of a segment (pycore `_GAP_SECONDS`). */
export const ORCH_CLIP_GAP_MS = 600;
/** The value a switch to "minutes" starts from. */
export const ORCH_DEFAULT_MINUTES = 10;
export const ORCH_MAX_STEP_TIMES = AUDIO_ORCH_MAX_STEP_TIMES;

const WORD_RE = /[\p{L}]+(?:['\u2019][\p{L}]+)*/gu;
const CJK_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]/;
const CJK_LANG_RE = /^(zh|cn|ja|ko)/i;

/** The virtual read batch that belongs to one orchestration task. */
export function orchTaskVirtualBatch(taskId: string): string {
  return `orch-${taskId}`.slice(0, ORCH_VIRTUAL_BATCH_MAX);
}

const ORCH_VIRTUAL_BATCH_MAX = 64;

/** Contract defaults (shared with pycore): one article = one segment, words -> zh -> en x2. */
export function defaultOrchConfig(_source: OrchComposeSource): OrchComposeConfig {
  return {
    pattern: audioOrchDefaultPattern(),
    segmentMode: AUDIO_ORCH_DEFAULT_SEGMENT_MODE,
    segmentValue: AUDIO_ORCH_DEFAULT_SEGMENT_VALUE,
    newOnlyMaxReadCount: AUDIO_ORCH_DEFAULT_MAX_READ_COUNT,
    languages: 'both',
    presetId: '',
    book: null,
    prompt: null,
    passages: [],
    wordGroupId: null,
    readState: 'virtual',
    // A new task's own batch is named when the task gets its id (`orchTaskVirtualBatch`).
    virtualBatch: AUDIO_ORCH_DEFAULT_VIRTUAL_BATCH,
  };
}

export function hasCjk(text: string): boolean {
  return CJK_RE.test(text);
}

/** Unique alphabetic tokens of one sentence, lower-cased, order kept (CJK runs skipped). */
export function tokenize(sentence: string): string[] {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const match of sentence.matchAll(WORD_RE)) {
    const word = match[0].replace(/^['’-]+|['’-]+$/g, '').toLowerCase();
    if (!word || seen.has(word) || hasCjk(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

/** Key of a sentence in `OrchPhrasesBySentence` (the content id Laravel `phrases_by_sentences` answers by). */
export function orchSentenceContentId(sentence: Pick<OrchComposeSentence, 'text'>): string {
  return orchContentId(sentence.text);
}

/** Whether the pattern reads phrases (the client then loads them and a book plan asks for phrase audio). */
export function orchPatternHasPhrases(pattern: ReadonlyArray<OrchComposeStep>): boolean {
  return pattern.some((step) => step.type === 'phrases');
}

/** Store key of a clip on every end: the pycore resource id (see orchClipIdentity). */
export function orchResourceKey(kind: OrchResourceKind, language: string, text: string): string {
  return orchClipIdentity(kind, language, text).resourceId;
}

export function estimateSentenceSeconds(sentence: OrchComposeSentence): number {
  let seconds = 0;
  for (const [code, text] of Object.entries(sentence.languages)) {
    if (!text) continue;
    seconds += CJK_LANG_RE.test(code)
      ? text.length / ORCH_ZH_CHARS_PER_SECOND
      : Math.max(1, text.split(/\s+/).filter(Boolean).length) / ORCH_EN_WORDS_PER_SECOND;
  }
  if (seconds <= 0) seconds = Math.max(1, sentence.text.split(/\s+/).filter(Boolean).length) / ORCH_EN_WORDS_PER_SECOND;
  return seconds + ORCH_SENTENCE_GAP_SECONDS;
}

interface Partition {
  index: number;
  start: number;
  end: number;
  estSeconds: number;
}

export function partitionSentences(sentences: OrchComposeSentence[], mode: 'count' | 'minutes', value: number): Partition[] {
  const entries = orchPassageBoundaries(sentences);
  if (entries.length > 0) return partitionWithPassages(sentences, entries, mode, value);
  return partitionPlain(sentences, mode, value);
}

/** The source's sentences by the segment settings, then one segment per short-passage entry. */
function partitionWithPassages(
  sentences: OrchComposeSentence[],
  entries: Array<{ start: number; end: number }>,
  mode: 'count' | 'minutes',
  value: number,
): Partition[] {
  const segments = partitionPlain(sentences.slice(0, entries[0].start), mode, value);
  entries.forEach(({ start, end }) => {
    const seconds = sentences.slice(start, end + 1).reduce((total, sentence) => total + estimateSentenceSeconds(sentence), 0);
    segments.push({ index: segments.length + 1, start, end, estSeconds: Math.round(seconds * 10) / 10 });
  });
  return segments;
}

function partitionPlain(sentences: OrchComposeSentence[], mode: 'count' | 'minutes', value: number): Partition[] {
  const total = sentences.length;
  if (total === 0) return [];
  const estimates = sentences.map(estimateSentenceSeconds);
  const segments: Partition[] = [];
  const push = (start: number, end: number, acc: number): void => {
    segments.push({ index: segments.length + 1, start, end, estSeconds: Math.round(acc * 10) / 10 });
  };
  let start = 0;
  let acc = 0;
  if (mode === 'minutes') {
    const target = Math.max(1, Math.trunc(value)) * 60;
    for (let index = 0; index < total; index += 1) {
      acc += estimates[index];
      if (acc >= target || index === total - 1) {
        push(start, index, acc);
        start = index + 1;
        acc = 0;
      }
    }
    return segments;
  }
  const count = Math.max(1, Math.min(Math.trunc(value), total));
  const perSegment = (estimates.reduce((sum, seconds) => sum + seconds, 0) || total) / count;
  for (let index = 0; index < total; index += 1) {
    acc += estimates[index];
    const remaining = count - segments.length;
    if (remaining <= 1) continue;
    if (acc >= perSegment && total - index - 1 >= remaining - 1) {
      push(start, index, acc);
      start = index + 1;
      acc = 0;
    }
  }
  push(start, total - 1, acc);
  return segments;
}

function sentenceLangText(sentence: OrchComposeSentence, lang: string): string {
  const text = (sentence.languages[lang] ?? '').trim();
  return text || (lang === sentence.language ? sentence.text.trim() : '');
}

/** The sentence language a pattern step reads (null for word and phrase steps). */
export function orchStepSentenceLanguage(type: OrchComposeStep['type']): string | null {
  if (type === 'sentence_en') return 'en';
  if (type === 'sentence_zh') return 'zh';
  return null;
}

/** How many sentences have no text in `lang` (the steps reading it are skipped for them). */
export function countSentencesMissingLanguage(sentences: ReadonlyArray<OrchComposeSentence>, lang: string): number {
  let missing = 0;
  for (const sentence of sentences) if (!sentenceLangText(sentence, lang)) missing += 1;
  return missing;
}

/** Per sentence language read by `pattern`: the sentences without it (only languages with a gap are listed). */
export function orchSkippedLanguages(sentences: ReadonlyArray<OrchComposeSentence>, pattern: ReadonlyArray<OrchComposeStep>): Record<string, number> {
  const skipped: Record<string, number> = {};
  for (const step of pattern) {
    const lang = orchStepSentenceLanguage(step.type);
    if (!lang || lang in skipped) continue;
    const missing = countSentencesMissingLanguage(sentences, lang);
    if (missing > 0) skipped[lang] = missing;
  }
  return skipped;
}

/**
 * Word policy per step: `words_all` reads every token; `words_new` reads the
 * tokens whose read count is within the limit and that no earlier sentence of
 * the task emitted (the task-local virtual read set, carried across segments).
 */
function selectWords(
  sentence: OrchComposeSentence,
  newOnly: boolean,
  config: OrchComposeConfig,
  states: ReadonlyMap<string, OrchWordState>,
  virtualRead: Set<string>,
): string[] {
  const words = tokenize(sentence.text).filter((word) => {
    if (!newOnly) return true;
    if (virtualRead.has(word)) return false;
    return (states.get(word)?.readCount ?? 0) <= config.newOnlyMaxReadCount;
  });
  if (newOnly) words.forEach((word) => virtualRead.add(word));
  return words;
}

/** The sentence's phrases in reading order, one per phrase content id (an empty phrase text is dropped). */
function sentencePhrases(sentence: OrchComposeSentence, phrases: OrchPhrasesBySentence): Array<{ text: string; meaning: string }> {
  const seen = new Set<string>();
  const unique: Array<{ text: string; meaning: string }> = [];
  for (const phrase of phrases.get(orchSentenceContentId(sentence)) ?? []) {
    const text = phrase.text.trim();
    const id = text ? orchContentId(text) : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push({ text, meaning: (phrase.meaning ?? '').trim() });
  }
  return unique;
}

function sentenceItems(
  sentence: OrchComposeSentence,
  position: number,
  config: OrchComposeConfig,
  language: string,
  states: ReadonlyMap<string, OrchWordState>,
  virtualRead: Set<string>,
  phrases: OrchPhrasesBySentence,
): OrchComposeItem[] {
  const items: OrchComposeItem[] = [];
  for (const step of config.pattern) {
    const times = Math.max(1, Math.min(ORCH_MAX_STEP_TIMES, Math.trunc(step.times) || 1));
    if (step.type === 'words_new' || step.type === 'words_all') {
      const words = selectWords(sentence, step.type === 'words_new', config, states, virtualRead);
      for (let round = 0; round < times; round += 1) {
        words.forEach((word) => {
          items.push({ kind: 'word', language, text: word, position, seq: sentence.seq });
          // The word's short Chinese meaning, read right after it (a zh sentence clip).
          const meaning = step.meaning ? states.get(word)?.meaning?.trim() : '';
          if (meaning) items.push({ kind: 'sentence', language: 'zh', text: meaning, position, seq: sentence.seq, meaningOf: word });
        });
      }
      continue;
    }
    if (step.type === 'phrases') {
      const own = sentencePhrases(sentence, phrases);
      for (let round = 0; round < times; round += 1) {
        own.forEach((phrase) => {
          items.push({ kind: 'phrase', language, text: phrase.text, position, seq: sentence.seq });
          // The phrase's Chinese meaning, read right after it (a zh sentence clip, like a word meaning).
          if (step.meaning && phrase.meaning) {
            items.push({
              kind: 'sentence', language: AUDIO_ORCH_PHRASE_PIPELINE.meaningLanguage, text: phrase.meaning,
              position, seq: sentence.seq, meaningOf: phrase.text, meaningKind: 'phrase',
            });
          }
        });
      }
      continue;
    }
    const lang = orchStepSentenceLanguage(step.type) ?? 'zh';
    const text = sentenceLangText(sentence, lang);
    if (!text) continue;
    for (let round = 0; round < times; round += 1) {
      items.push({ kind: 'sentence', language: lang, text, position, seq: sentence.seq });
    }
  }
  return items;
}

/** The Laravel URL a plan item already has from its source (null: none known). */
function itemLaravelUrl(item: OrchComposeItem, sentence: OrchComposeSentence, states: ReadonlyMap<string, OrchWordState>): string | null {
  // A meaning clip is the gloss text, never the sentence's own audio.
  if (item.meaningOf) return null;
  if (item.kind === 'sentence') return sentence.audio[item.language] ?? null;
  return item.kind === 'word' ? states.get(item.text)?.audioUrl ?? null : null;
}

/**
 * The whole plan: segments with their items and the unique resource list.
 * `phrases` feeds the `phrases` steps (a sentence without an entry yields no phrase clips).
 */
export function planComposition(
  { source, config, language }: OrchComposeSpec,
  sentences: OrchComposeSentence[],
  states: ReadonlyMap<string, OrchWordState>,
  phrases: OrchPhrasesBySentence = new Map(),
): OrchComposePlan {
  const mode = source === 'prompt_rewrite' ? 'count' : config.segmentMode;
  const value = source === 'prompt_rewrite' ? 1 : config.segmentValue;
  const virtualRead = new Set<string>();
  const resources = new Map<string, OrchComposeResource>();
  const segments: OrchComposeSegment[] = partitionSentences(sentences, mode, value).map((part) => {
    const items: OrchComposeItem[] = [];
    for (let position = part.start; position <= part.end; position += 1) {
      const sentence = sentences[position];
      for (const item of sentenceItems(sentence, position, config, language, states, virtualRead, phrases)) {
        items.push(item);
        const identity = orchClipIdentity(item.kind, item.language, item.text);
        const key = identity.resourceId;
        if (!resources.has(key)) {
          resources.set(key, {
            ...identity,
            key,
            laravelUrl: itemLaravelUrl(item, sentence, states),
          });
        }
      }
    }
    return { index: part.index, start: part.start, end: part.end, estSeconds: part.estSeconds, items };
  });
  return { segments, sentences, resources: [...resources.values()], skippedLanguages: orchSkippedLanguages(sentences, config.pattern) };
}

/** Hash of everything that shapes the plan (sync conflict + staleness marker). */
export function orchPlanHash({ source, config, language }: OrchComposeSpec): string {
  const passages = config.passages ?? [];
  return sha256Hex(JSON.stringify({
    source,
    language,
    pattern: config.pattern,
    segmentMode: config.segmentMode,
    segmentValue: config.segmentValue,
    newOnlyMaxReadCount: config.newOnlyMaxReadCount,
    book: config.book ? [config.book.sourceKey, config.book.chapterIndex] : null,
    prompt: config.prompt?.taskKey ?? null,
    wordGroupId: config.wordGroupId,
    readState: config.readState,
    virtualBatch: config.readState === 'real' ? '' : config.virtualBatch,
    // Added only with entries, so a composition without any keeps the hash (and the progress) it had.
    ...(passages.length > 0 ? { passages: passages.map((entry) => [orchPassageKey(entry), sha256Hex(`${entry.text ?? ''}
${entry.textZh ?? ''}`)]) } : {}),
  }));
}
