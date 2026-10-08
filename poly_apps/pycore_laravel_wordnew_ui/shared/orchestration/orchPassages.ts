/**
 * Short-passage entries of a composition (docs_fix/DESIGN_AUDIO_ORCHESTRATION.md). A passage becomes
 * ordinary plan sentences: each sentence is a `sentence` clip (resourceId = sha256("sentence:<language>:<content id>")),
 * so the planner, the clip scheduler (R1 order) and the stage layout treat it exactly like a book sentence.
 */
import { sentenceSegmenter } from '../../core/contracts/SentenceSegmenter';
import { orchContentId } from './orchClipIdentity';
import type { OrchComposePassageRef, OrchComposeSentence } from './orchTypes';

/** Entries one composition may hold, and the room their kept texts may take in the synced task config (Laravel keeps 256 KiB). */
export const ORCH_PASSAGE_MAX_ENTRIES = 40;
export const ORCH_PASSAGE_MAX_CONFIG_BYTES = 200_000;

const ENGLISH = 'en';
const CHINESE = 'zh';
const CHINESE_PREFIX = 'zh';

/** Identity of an entry inside a composition. */
export function orchPassageKey(ref: Pick<OrchComposePassageRef, 'store' | 'id'>): string {
  return `${ref.store}:${ref.id}`;
}

/** Bytes the entries take in the task config (the texts they keep dominate). */
export function orchPassageBytes(passages: ReadonlyArray<OrchComposePassageRef>): number {
  return new TextEncoder().encode(JSON.stringify(passages)).length;
}

/** Whether `ref` can join `passages` (an entry is added once; the count and the config size are bounded). */
export function orchPassageFits(passages: ReadonlyArray<OrchComposePassageRef>, ref: OrchComposePassageRef): boolean {
  const key = orchPassageKey(ref);
  if (passages.some((entry) => orchPassageKey(entry) === key)) return false;
  return passages.length < ORCH_PASSAGE_MAX_ENTRIES && orchPassageBytes([...passages, ref]) <= ORCH_PASSAGE_MAX_CONFIG_BYTES;
}

/** The sequence number after the last of `sentences` (the next entry continues the numbering: stage cards are keyed by it). */
export function orchNextSeq(sentences: ReadonlyArray<Pick<OrchComposeSentence, 'seq'>>): number {
  return sentences.reduce((next, sentence) => Math.max(next, sentence.seq + 1), 0);
}

/** `sentences` as the entry `key`, numbered from `firstSeq` in order. */
export function orchTagPassage(sentences: ReadonlyArray<OrchComposeSentence>, key: string, firstSeq: number): OrchComposeSentence[] {
  return sentences.map((sentence, index) => ({ ...sentence, seq: firstSeq + index, passage: key }));
}

function pieces(text: string | undefined): string[] {
  return sentenceSegmenter.split(text ?? '', { speakable: true });
}

/** Sentences of an entry that still need a Chinese line (not Chinese themselves, no Chinese text, not translated yet). */
export function orchPassageZhMissing(sentences: ReadonlyArray<OrchComposeSentence>, ref: Pick<OrchComposePassageRef, 'zh'>): OrchComposeSentence[] {
  return sentences.filter((sentence) => sentence.language !== CHINESE && !sentence.languages[CHINESE]
    && ref.zh?.[orchContentId(sentence.text)] === undefined);
}

/** What the passage sentences of a plan read (their lines in order): a change shifts the plan positions after them. */
export function orchPassageSignature(sentences: ReadonlyArray<OrchComposeSentence>): string {
  return JSON.stringify(sentences.filter((sentence) => sentence.passage).map((sentence) => [sentence.passage, sentence.text, sentence.languages[CHINESE] ?? '']));
}

/** `sentences` with the entry's translated Chinese lines filled in where they have none. */
export function orchApplyPassageZh(sentences: ReadonlyArray<OrchComposeSentence>, ref: Pick<OrchComposePassageRef, 'zh'>): OrchComposeSentence[] {
  if (!ref.zh) return [...sentences];
  return sentences.map((sentence) => {
    const zh = sentence.language === CHINESE || sentence.languages[CHINESE] ? '' : ref.zh?.[orchContentId(sentence.text)] ?? '';
    return zh ? { ...sentence, languages: { ...sentence.languages, [CHINESE]: zh } } : sentence;
  });
}

/**
 * Sentences of an `article` entry. The passage and its Chinese reference are cut by the shared segmenter; equal
 * counts pair up line by line (bilingual sentences). Otherwise the pairing would be a guess: the passage keeps its
 * sentences, each with its translated Chinese line (`zh`) once the translation ran; before that the reference
 * follows as Chinese-only sentences, so every step still reads what the text has.
 */
export function orchArticleSentences(ref: OrchComposePassageRef): OrchComposeSentence[] {
  const language = ref.language.toLowerCase().startsWith(CHINESE_PREFIX) ? CHINESE : (ref.language.toLowerCase() || ENGLISH);
  const main = pieces(ref.text);
  const other = language === CHINESE ? [] : pieces(ref.textZh);
  const paired = other.length === main.length;
  const sentences: OrchComposeSentence[] = main.map((text, index) => ({
    seq: index,
    text,
    language,
    languages: paired && other[index] ? { [language]: text, [CHINESE]: other[index] } : { [language]: text },
    audio: {},
  }));
  if (paired || ref.zh) return orchApplyPassageZh(sentences, ref);
  other.forEach((text) => sentences.push({ seq: sentences.length, text, language: CHINESE, languages: { [CHINESE]: text }, audio: {} }));
  return sentences;
}

/** Plan segments: the sentences before the first entry are the source's, then one segment per entry (consecutive sentences of one entry). */
export function orchPassageBoundaries(sentences: ReadonlyArray<Pick<OrchComposeSentence, 'passage'>>): Array<{ start: number; end: number }> {
  const groups: Array<{ start: number; end: number; key: string }> = [];
  sentences.forEach((sentence, index) => {
    if (!sentence.passage) return;
    const last = groups[groups.length - 1];
    if (last && last.key === sentence.passage && last.end === index - 1) last.end = index;
    else groups.push({ start: index, end: index, key: sentence.passage });
  });
  return groups.map(({ start, end }) => ({ start, end }));
}
