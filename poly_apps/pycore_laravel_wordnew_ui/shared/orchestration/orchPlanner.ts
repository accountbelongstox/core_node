/**
 * Pure planner: the pycore orchestration plan semantics
 * (`orch_generate.build_sentence_items`, `orch_books.partition_sentences`,
 * `orch_books.estimate_sentence_seconds`, `orch_words.select_words`) for the
 * client composer, so a composition made here plays exactly like pycore's.
 */
import { sha256Hex } from '../../core/utils/contentHash';
import type { OrchResourceKind } from '../../core/integrations/pycore';
import { orchClipIdentity } from './orchClipIdentity';
import {
  AUDIO_ORCH_DEFAULT_MAX_READ_COUNT,
  AUDIO_ORCH_DEFAULT_SEGMENT_MODE,
  AUDIO_ORCH_DEFAULT_SEGMENT_VALUE,
  AUDIO_ORCH_DEFAULT_VIRTUAL_BATCH,
  AUDIO_ORCH_MAX_STEP_TIMES,
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
    wordGroupId: null,
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

function sentenceItems(
  sentence: OrchComposeSentence,
  position: number,
  config: OrchComposeConfig,
  language: string,
  states: ReadonlyMap<string, OrchWordState>,
  virtualRead: Set<string>,
): OrchComposeItem[] {
  const items: OrchComposeItem[] = [];
  for (const step of config.pattern) {
    const times = Math.max(1, Math.min(ORCH_MAX_STEP_TIMES, Math.trunc(step.times) || 1));
    if (step.type === 'words_new' || step.type === 'words_all') {
      const words = selectWords(sentence, step.type === 'words_new', config, states, virtualRead);
      for (let round = 0; round < times; round += 1) {
        words.forEach((word) => items.push({ kind: 'word', language, text: word, position, seq: sentence.seq }));
      }
      continue;
    }
    const lang = step.type === 'sentence_en' ? 'en' : 'zh';
    const text = sentenceLangText(sentence, lang);
    if (!text) continue;
    for (let round = 0; round < times; round += 1) {
      items.push({ kind: 'sentence', language: lang, text, position, seq: sentence.seq });
    }
  }
  return items;
}

/** The whole plan: segments with their items and the unique resource list. */
export function planComposition(
  { source, config, language }: OrchComposeSpec,
  sentences: OrchComposeSentence[],
  states: ReadonlyMap<string, OrchWordState>,
): OrchComposePlan {
  const mode = source === 'prompt_rewrite' ? 'count' : config.segmentMode;
  const value = source === 'prompt_rewrite' ? 1 : config.segmentValue;
  const virtualRead = new Set<string>();
  const resources = new Map<string, OrchComposeResource>();
  const segments: OrchComposeSegment[] = partitionSentences(sentences, mode, value).map((part) => {
    const items: OrchComposeItem[] = [];
    for (let position = part.start; position <= part.end; position += 1) {
      const sentence = sentences[position];
      for (const item of sentenceItems(sentence, position, config, language, states, virtualRead)) {
        items.push(item);
        const identity = orchClipIdentity(item.kind, item.language, item.text);
        const key = identity.resourceId;
        if (!resources.has(key)) {
          resources.set(key, {
            ...identity,
            key,
            laravelUrl: item.kind === 'sentence'
              ? sentence.audio[item.language] ?? null
              : states.get(item.text)?.audioUrl ?? null,
          });
        }
      }
    }
    return { index: part.index, start: part.start, end: part.end, estSeconds: part.estSeconds, items };
  });
  return { segments, sentences, resources: [...resources.values()] };
}

/** Hash of everything that shapes the plan (sync conflict + staleness marker). */
export function orchPlanHash({ source, config, language }: OrchComposeSpec): string {
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
    virtualBatch: config.virtualBatch,
  }));
}
