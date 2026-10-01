/**
 * TypeScript adapter of the shared sentence segmentation.
 *
 * Source of truth: config/sentence_segmentation_contract.json (rules, abbreviations,
 * speakable thresholds, timing constants and the test vectors).
 * Aligned adapters:
 * - pycore/pyfoundations/sentence_segmenter.py
 * - poly_apps/laravel_main/app/Support/SentenceSegmenter.php
 *
 * No component may cut text into sentences on its own (a split on ". ! ?" breaks
 * decimals, IPs, file names and abbreviations). A rule changes in the JSON first
 * and every adapter must pass every vector. Nothing here rewrites text: a
 * sentence is a slice of the input with runs of whitespace collapsed; `clean` is
 * the explicit clean-up for spoken text. Strings are handled by code point.
 */
import contractDocument from '../../../../config/sentence_segmentation_contract.json';

const HEADING_MAX_LEVEL = 6;

export interface SentenceSplitOptions {
  /** Clean markdown and drop what would be read as noise. */
  speakable?: boolean;
  minChars?: number;
  /** Cut a longer sentence at clause breaks, then spaces. */
  maxChars?: number;
  maxSentences?: number;
}

interface SegmentationContract {
  terminals: string;
  ellipsis: string;
  period_like: string;
  native_terminals: string;
  closers: string;
  openers: string;
  cjk_ranges: string[][];
  abbreviations: string[];
  block_markers: {
    list_prefixes: string[];
    numbered_max_digits: number;
    numbered_suffixes: string[];
    heading_marker: string;
    quote_marker: string;
  };
  long_sentence: { clause_breaks: string };
  verses: { max_digits: number; single_letter_words: string };
  speakable: { min_letters: number; code_symbols: string; max_code_symbol_ratio: number; emphasis_markers: string[] };
  timing: {
    en_words_per_second: number;
    zh_chars_per_second: number;
    sentence_gap_seconds: number;
    chars_language_prefixes: string[];
  };
}

const chars = (text: string): string[] => Array.from(text);
const strip = (text: string): string => text.replace(/^\s+|\s+$/g, '');
const collapse = (text: string): string => text.split(/\s+/).filter(Boolean).join(' ');
const isSpace = (char: string): boolean => /^\s$/u.test(char);
const isAlpha = (char: string): boolean => /^\p{L}$/u.test(char);
const isLower = (char: string): boolean => char.toLowerCase() === char && char.toUpperCase() !== char;
const isUpper = (char: string): boolean => char.toUpperCase() === char && char.toLowerCase() !== char;
const isAsciiDigit = (char: string): boolean => char >= '0' && char <= '9';

export interface VerseSentence {
  text: string;
  chapter: number | null;
  verse: number | null;
}

export class SentenceSegmenter {
  private readonly terminals: Set<string>;
  private readonly periodLike: Set<string>;
  private readonly nativeTerminals: Set<string>;
  private readonly closers: Set<string>;
  private readonly openers: Set<string>;
  private readonly cjk: Array<[number, number]>;
  private readonly abbreviations: Set<string>;
  private readonly clauseBreaks: Set<string>;
  private readonly codeSymbols: Set<string>;

  readonly sentenceGapSeconds: number;

  constructor(private readonly contract: SegmentationContract) {
    this.terminals = new Set(chars(contract.terminals + contract.ellipsis));
    this.periodLike = new Set(chars(contract.period_like));
    this.nativeTerminals = new Set(chars(contract.native_terminals));
    this.closers = new Set(chars(contract.closers));
    this.openers = new Set(chars(contract.openers));
    this.cjk = contract.cjk_ranges.map(([low, high]) => [parseInt(low, 16), parseInt(high, 16)]);
    this.abbreviations = new Set(contract.abbreviations);
    this.clauseBreaks = new Set(chars(contract.long_sentence.clause_breaks));
    this.codeSymbols = new Set(chars(contract.speakable.code_symbols));
    this.sentenceGapSeconds = contract.timing.sentence_gap_seconds;
  }

  /** Sentences of `text` (see the contract for the rules). */
  split(text: string, options: SentenceSplitOptions = {}): string[] {
    let sentences: string[] = [];
    for (const block of this.blocks(text || '')) {
      sentences.push(...this.scan(block));
    }
    if (options.speakable) {
      sentences = this.speakableOnly(sentences);
    }
    if ((options.maxChars ?? 0) > 0) {
      sentences = sentences.flatMap((sentence) => this.cutLong(sentence, options.maxChars as number));
    }
    if ((options.minChars ?? 0) > 0) {
      sentences = sentences.filter((sentence) => chars(sentence).length >= (options.minChars as number));
    }
    if ((options.maxSentences ?? 0) > 0) {
      sentences = sentences.slice(0, options.maxSentences);
    }
    return sentences;
  }

  /**
   * Sentences of verse-numbered text (the verses option). A marker glued to the
   * text is a hard boundary and becomes `verse`; a number-only block sets the
   * `chapter` and clears the verse. Both carry across blocks.
   */
  splitVerses(text: string): VerseSentence[] {
    const rows: VerseSentence[] = [];
    let chapter: number | null = null;
    let verse: number | null = null;
    for (const block of this.blocks(text || '')) {
      const list = chars(block);
      if (list.length >= 1 && list.length <= this.contract.verses.max_digits && list.every(isAsciiDigit)) {
        chapter = parseInt(block, 10);
        verse = null;
        continue;
      }
      let start = 0;
      const pieces: Array<[number | null, string]> = [];
      for (const [position, digits] of this.verseMarkers(list)) {
        pieces.push([verse, list.slice(start, position).join('')]);
        verse = parseInt(digits, 10);
        start = position + digits.length;
      }
      pieces.push([verse, list.slice(start).join('')]);
      for (const [pieceVerse, piece] of pieces) {
        for (const sentence of this.scan(piece)) {
          rows.push({ text: sentence, chapter, verse: pieceVerse });
        }
      }
    }
    return rows;
  }

  /** True when `text` holds a glued verse marker (see splitVerses). */
  hasVerseMarker(text: string): boolean {
    return this.blocks(text || '').some((block) => this.verseMarkers(chars(block)).length > 0);
  }

  /** One list / heading / quote marker and the emphasis marks removed. */
  clean(text: string): string {
    let result = strip(String(text || ''));
    result = chars(result).slice(this.markerLength(result)).join('');
    for (const marker of this.contract.speakable.emphasis_markers) {
      result = result.split(marker).join('');
    }
    return collapse(result);
  }

  /** False for a fragment (too few letters) or text that is mostly code symbols. */
  isSpeakable(text: string): boolean {
    const letters = (text.match(/\p{L}/gu) ?? []).length;
    if (letters < this.contract.speakable.min_letters) {
      return false;
    }
    const symbols = chars(text).filter((char) => this.codeSymbols.has(char)).length;
    return symbols / Math.max(1, chars(text).length) < this.contract.speakable.max_code_symbol_ratio;
  }

  /** Rough spoken duration of `text`, without the gap between clips. */
  estimateSeconds(text: string, language = 'en'): number {
    if (strip(String(text || '')) === '') {
      return 0;
    }
    const timing = this.contract.timing;
    if (timing.chars_language_prefixes.some((prefix) => language.toLowerCase().startsWith(prefix))) {
      return chars(text).length / timing.zh_chars_per_second;
    }
    return Math.max(1, strip(text).split(/\s+/).filter(Boolean).length) / timing.en_words_per_second;
  }

  isCjk(char: string): boolean {
    const code = char.codePointAt(0) ?? 0;
    return this.cjk.some(([low, high]) => code >= low && code <= high);
  }

  // ------------------------------------------------------------------ blocks

  private isHeading(line: string): boolean {
    const marker = this.contract.block_markers.heading_marker;
    let hashes = 0;
    while (line.startsWith(marker, hashes * marker.length)) {
      hashes += 1;
    }
    return hashes > 0 && hashes <= HEADING_MAX_LEVEL && line.charAt(hashes * marker.length) === ' ';
  }

  private markerLength(line: string): number {
    const markers = this.contract.block_markers;
    for (const prefix of markers.list_prefixes) {
      if (line.startsWith(`${prefix} `)) {
        return chars(prefix).length + 1;
      }
    }
    let digits = 0;
    while (digits < line.length && isAsciiDigit(line.charAt(digits))) {
      digits += 1;
    }
    if (digits > 0 && digits <= markers.numbered_max_digits) {
      for (const suffix of markers.numbered_suffixes) {
        if (line.substr(digits, suffix.length + 1) === `${suffix} `) {
          return digits + suffix.length + 1;
        }
      }
    }
    if (line.startsWith(markers.quote_marker)) {
      let count = 0;
      while (line.startsWith(markers.quote_marker, count)) {
        count += markers.quote_marker.length;
      }
      return line.charAt(count) === ' ' ? count + 1 : 0;
    }
    return this.isHeading(line) ? line.indexOf(' ') + 1 : 0;
  }

  private blocks(text: string): string[] {
    const blocks: string[][] = [];
    let current: string[] = [];
    for (const raw of text.split(/\r\n|\r|\n/)) {
      const line = strip(raw);
      if (line === '') {
        if (current.length) {
          blocks.push(current);
        }
        current = [];
        continue;
      }
      if (this.markerLength(line) > 0 && current.length) {
        blocks.push(current);
        current = [];
      }
      current.push(line);
      if (this.isHeading(line)) {
        blocks.push(current);
        current = [];
      }
    }
    if (current.length) {
      blocks.push(current);
    }
    return blocks.map((block) => block.join(' '));
  }

  // ----------------------------------------------------------------- scanner

  private scan(block: string): string[] {
    const list = chars(block);
    const sentences: string[] = [];
    let start = 0;
    let index = 0;
    while (index < list.length) {
      if (!this.terminals.has(list[index])) {
        index += 1;
        continue;
      }
      let runEnd = index;
      while (runEnd < list.length && this.terminals.has(list[runEnd])) {
        runEnd += 1;
      }
      let end = runEnd;
      while (end < list.length && this.closers.has(list[end])) {
        end += 1;
      }
      if (this.endsSentence(list, start, index, runEnd, end)) {
        sentences.push(collapse(list.slice(start, end).join('')));
        start = end;
      }
      index = end;
    }
    const rest = collapse(list.slice(start).join(''));
    if (rest) {
      sentences.push(rest);
    }
    return sentences.filter(Boolean);
  }

  private endsSentence(list: string[], start: number, runStart: number, runEnd: number, end: number): boolean {
    const run = list.slice(runStart, runEnd);
    if (run.some((char) => this.nativeTerminals.has(char))) {
      return true;
    }
    const following = end < list.length ? list[end] : '';
    if (following !== '' && !isSpace(following) && !this.isCjk(following)) {
      return false;
    }
    if (!this.periodLike.has(run[0]) || following === '') {
      return true;
    }
    const next = chars(list.slice(end).join('').replace(/^\s+/, ''))[0] ?? '';
    if (next !== '' && isLower(next)) {
      return false;
    }
    if (run.join('') !== '.') {
      return true;
    }
    const head = list.slice(start, runStart).join('');
    const tokens = head.split(' ');
    let token = tokens[tokens.length - 1];
    while (token !== '' && this.openers.has(chars(token)[0])) {
      token = chars(token).slice(1).join('');
    }
    if (this.abbreviations.has(token.toLowerCase())) {
      return false;
    }
    const tokenChars = chars(token);
    if (tokenChars.length === 1 && isAlpha(token) && isUpper(token)) {
      return false;
    }
    const parts = token.split('.');
    if (parts.length >= 2 && parts.every((part) => chars(part).length === 1 && isAlpha(part))) {
      return false;
    }
    if (tokenChars.length >= 1 && tokenChars.length <= 2 && tokenChars.every(isAsciiDigit) && strip(head) === token) {
      return false;
    }
    return true;
  }

  // ------------------------------------------------------------------ verses

  private verseMarkers(list: string[]): Array<[number, string]> {
    const markers: Array<[number, string]> = [];
    let index = 0;
    while (index < list.length) {
      if (!isAsciiDigit(list[index]) || (index > 0 && !this.mayPrecedeVerse(list[index - 1]))) {
        index += 1;
        continue;
      }
      let end = index;
      while (end < list.length && isAsciiDigit(list[end])) {
        end += 1;
      }
      if (end - index <= this.contract.verses.max_digits && this.startsVerseText(list, end)) {
        markers.push([index, list.slice(index, end).join('')]);
      }
      index = end;
    }
    return markers;
  }

  private mayPrecedeVerse(char: string): boolean {
    return isSpace(char) || this.terminals.has(char) || this.closers.has(char);
  }

  private startsVerseText(list: string[], at: number): boolean {
    const first = at < list.length ? list[at] : '';
    const second = at + 1 < list.length ? list[at + 1] : '';
    if (first === '') {
      return false;
    }
    if (this.isCjk(first)) {
      return true;
    }
    if (this.openers.has(first)) {
      return second !== '' && isAlpha(second) && isUpper(second);
    }
    if (!(isAlpha(first) && isUpper(first))) {
      return false;
    }
    if (second !== '' && isAlpha(second) && isLower(second)) {
      return true;
    }
    return this.contract.verses.single_letter_words.includes(first) && !(second !== '' && isAlpha(second));
  }

  // -------------------------------------------------------- speech and length

  private speakableOnly(sentences: string[]): string[] {
    const kept: string[] = [];
    for (const sentence of sentences) {
      if (!this.isSpeakable(sentence)) {
        continue;
      }
      const cleaned = this.clean(sentence);
      if (this.isSpeakable(cleaned)) {
        kept.push(cleaned);
      }
    }
    return kept;
  }

  private cutLong(sentence: string, maxChars: number): string[] {
    const pieces: string[] = [];
    let rest = sentence;
    while (chars(rest).length > maxChars) {
      const cut = this.cutPosition(rest, maxChars);
      const list = chars(rest);
      pieces.push(strip(list.slice(0, cut).join('')));
      rest = strip(list.slice(cut).join(''));
    }
    if (rest) {
      pieces.push(rest);
    }
    return pieces.filter(Boolean);
  }

  private cutPosition(text: string, maxChars: number): number {
    const list = chars(text);
    let clause = 0;
    for (let position = 0; position < Math.min(list.length, maxChars); position += 1) {
      if (this.clauseBreaks.has(list[position]) && (position + 1 === list.length || list[position + 1] === ' ')) {
        clause = position + 1;
      }
    }
    if (clause > 0) {
      return clause;
    }
    for (let position = Math.min(maxChars, list.length - 1); position >= 1; position -= 1) {
      if (list[position] === ' ') {
        return position;
      }
    }
    return maxChars;
  }
}

export const sentenceSegmenter = new SentenceSegmenter(contractDocument as unknown as SegmentationContract);
