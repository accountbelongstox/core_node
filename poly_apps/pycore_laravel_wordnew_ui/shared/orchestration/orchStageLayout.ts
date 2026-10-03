/**
 * Stage layout: the pycore video layout (`orch_video.build_cards`,
 * `ffmpeg_scroll.ScrollCueBuilder` keyframes and line states) for the DOM
 * stage. Cards are measured by the browser; the viewport offset follows the
 * same piecewise-linear keyframes, so the stage moves like the rendered video.
 */
import type { OrchVideoLanguages, OrchVideoLayoutSettings } from '../../core/integrations/pycore';
import type { OrchComposeItem, OrchComposeSentence } from './orchTypes';

export type OrchLineRole = 'sentence_en' | 'sentence_zh' | 'word' | 'word_meaning';
export type OrchLineState = 'upcoming' | 'active' | 'companion' | 'past';
export type OrchSpan = readonly [number, number];

export interface OrchTimelineEntry {
  item: OrchComposeItem;
  clipUrl: string;
  startMs: number;
  endMs: number;
}

export interface OrchStageLine {
  text: string;
  role: OrchLineRole;
  spans: OrchSpan[];
}

export interface OrchStageCard {
  key: string;
  kind: 'word' | 'sentence';
  lines: OrchStageLine[];
  start: number;
  end: number;
}

export type OrchKeyframe = readonly [number, number];

const MIN_SCROLL_SECONDS = 0.05;

function normalize(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(' ');
}

function langOf(language: string): 'en' | 'zh' {
  return language.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function sentenceTexts(sentence: OrchComposeSentence | undefined, spoken: Record<string, string>): Record<string, string> {
  const texts: Record<string, string> = {};
  for (const language of ['en', 'zh'] as const) {
    let text = normalize(sentence?.languages[language] ?? '') || normalize(spoken[language] ?? '');
    if (!text && sentence?.language === language) text = normalize(sentence.text);
    if (text) texts[language] = text;
  }
  return texts;
}

interface CardGroup {
  key: string;
  kind: 'word' | 'sentence';
  sentence: OrchComposeSentence | undefined;
  text: string;
  spoken: Record<string, string>;
  spans: { en: OrchSpan[]; zh: OrchSpan[] };
  all: OrchSpan[];
}

/** Consecutive clips of one sentence (or repeats of one word) form one card. */
export function buildStageCards(
  timeline: OrchTimelineEntry[],
  sentences: OrchComposeSentence[],
  languages: OrchVideoLanguages,
  meaningOf: (word: string) => string,
): OrchStageCard[] {
  const bySeq = new Map(sentences.map((sentence) => [sentence.seq, sentence]));
  const groups: CardGroup[] = [];
  for (const entry of timeline) {
    const span: OrchSpan = [entry.startMs / 1000, entry.endMs / 1000];
    const text = normalize(entry.item.text);
    const language = langOf(entry.item.language);
    // A meaning clip belongs to the card of the word it explains.
    const explains = entry.item.meaningOf ? normalize(entry.item.meaningOf) : '';
    const isWord = entry.item.kind === 'word' || explains !== '';
    const sentence = isWord ? undefined : bySeq.get(entry.item.seq);
    const wordText = explains || text;
    const key = isWord ? `word:${wordText.toLowerCase()}` : `sentence:${sentence ? sentence.seq : text}`;
    let group = groups[groups.length - 1];
    if (!group || group.key !== key) {
      group = { key, kind: isWord ? 'word' : 'sentence', sentence, text: wordText, spoken: {}, spans: { en: [], zh: [] }, all: [] };
      groups.push(group);
    }
    group.spoken[language] ??= text;
    group.spans[language].push(span);
    group.all.push(span);
  }

  return groups.flatMap((group, index): OrchStageCard[] => {
    const lines: OrchStageLine[] = [];
    if (group.kind === 'word') {
      // Spoken meaning clips light the meaning line; without them it follows the word (pycore video).
      const spoken = group.spans.zh.length > 0;
      const meaning = group.spoken.zh || meaningOf(group.text.toLowerCase());
      const wordSpans = spoken ? group.spans.en : group.all;
      if (languages !== 'zh' || !meaning) lines.push({ text: group.text, role: 'word', spans: wordSpans });
      if (languages !== 'en' && meaning) lines.push({ text: meaning, role: 'word_meaning', spans: spoken ? group.spans.zh : group.all });
    } else {
      const texts = sentenceTexts(group.sentence, group.spoken);
      for (const language of ['en', 'zh'] as const) {
        if (!texts[language] || (languages !== 'both' && languages !== language)) continue;
        lines.push({ text: texts[language], role: language === 'en' ? 'sentence_en' : 'sentence_zh', spans: group.spans[language] });
      }
      const [fallback] = Object.keys(texts) as Array<'en' | 'zh'>;
      if (lines.length === 0 && fallback) {
        lines.push({ text: texts[fallback], role: fallback === 'zh' ? 'sentence_zh' : 'sentence_en', spans: group.all });
      }
    }
    // As pycore `_geometry`: a card spans its shown lines only (a hidden language never extends it).
    const spans = lines.flatMap((line) => line.spans).filter(([start, end]) => end > start);
    if (lines.length === 0 || spans.length === 0) return [];
    return [{
      key: `${index}:${group.key}`,
      kind: group.kind,
      lines,
      start: Math.min(...spans.map(([start]) => start)),
      end: Math.max(...spans.map(([, end]) => end)),
    }];
  });
}

/** Viewport keyframes (time, virtual y of the focus line) from measured card centres. */
export function stageKeyframes(cards: OrchStageCard[], centers: number[], layout: OrchVideoLayoutSettings): OrchKeyframe[] {
  if (cards.length === 0 || centers.length !== cards.length) return [[0, 0]];
  const points: OrchKeyframe[] = [[0, centers[0]]];
  for (let index = 1; index < cards.length; index += 1) {
    const last = points[points.length - 1][0];
    const arrive = Math.max(cards[index].start, last);
    const depart = layout.scroll_mode === 'smooth'
      ? last
      : Math.max(last, arrive - Math.max(MIN_SCROLL_SECONDS, layout.scroll_seconds));
    if (depart > last) points.push([depart, centers[index - 1]]);
    points.push([arrive, centers[index]]);
  }
  return points;
}

export function stageOffsetAt(keyframes: OrchKeyframe[], at: number): number {
  if (at <= keyframes[0][0]) return keyframes[0][1];
  let low = 1;
  let high = keyframes.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (at <= keyframes[middle][0]) high = middle;
    else low = middle + 1;
  }
  if (low >= keyframes.length) return keyframes[keyframes.length - 1][1];
  const [t0, o0] = keyframes[low - 1];
  const [t1, o1] = keyframes[low];
  return t1 <= t0 ? o0 : o0 + ((o1 - o0) * (at - t0)) / (t1 - t0);
}

/** Index of the card being spoken (the last one that started by `at`; the first card before any). */
export function stageCardIndexAt(cards: OrchStageCard[], at: number): number {
  let low = 0;
  let high = cards.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (cards[middle].start <= at) low = middle + 1;
    else high = middle;
  }
  return Math.max(0, low - 1);
}

export function stageLineState(card: OrchStageCard, line: OrchStageLine, at: number): OrchLineState {
  if (line.spans.some(([start, end]) => start <= at && at < end)) return 'active';
  if (at < card.start) return 'upcoming';
  if (at < card.end) return 'companion';
  return 'past';
}

const PLACEHOLDER_WORD_MS = 900;
const PLACEHOLDER_MIN_MS = 1_200;
const PLACEHOLDER_MAX_MS = 15_000;
const PLACEHOLDER_CJK_CHAR_MS = 220;
const PLACEHOLDER_LATIN_CHAR_MS = 65;
const CJK_PATTERN = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;

/** Estimated length of a clip that does not exist yet (its placeholder keeps the timeline complete). */
export function orchPlaceholderMs(item: OrchComposeItem): number {
  if (item.kind === 'word' && !item.meaningOf) return PLACEHOLDER_WORD_MS;
  const perChar = CJK_PATTERN.test(item.text) ? PLACEHOLDER_CJK_CHAR_MS : PLACEHOLDER_LATIN_CHAR_MS;
  return Math.min(PLACEHOLDER_MAX_MS, Math.max(PLACEHOLDER_MIN_MS, item.text.length * perChar));
}

/** A timeline entry without a clip yet: shown on the stage, skipped by the player. */
export function orchEntryPlayable(entry: OrchTimelineEntry): boolean {
  return entry.clipUrl !== '';
}

/**
 * Clip offsets inside a segment (clip, gap, clip, ...), as pycore `_segment_timeline`.
 * With `placeholderMs` every item is laid out (pre-compiled): a missing clip gets an
 * entry without URL and the estimated length, so later clips keep their place.
 */
export function buildTimeline(
  items: OrchComposeItem[],
  clipOf: (item: OrchComposeItem) => { url: string; durationMs: number } | null,
  gapMs: number,
  placeholderMs?: (item: OrchComposeItem) => number,
): OrchTimelineEntry[] {
  const timeline: OrchTimelineEntry[] = [];
  let cursor = 0;
  for (const item of items) {
    const found = clipOf(item);
    const clip = found && found.durationMs > 0 ? found : placeholderMs ? { url: '', durationMs: placeholderMs(item) } : null;
    if (!clip) continue;
    if (timeline.length > 0) cursor += gapMs;
    timeline.push({ item, clipUrl: clip.url, startMs: cursor, endMs: cursor + clip.durationMs });
    cursor += clip.durationMs;
  }
  return timeline;
}
