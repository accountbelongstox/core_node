/**
 * Reply parser for the Book Study Generator (popup).
 *
 * Implements the reply format in
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md §6 — line-based
 * and tolerant, since the reply comes from a web-AI chat, not a strict formatter.
 * Split out of useBookStudyGenerator.ts to keep both files small and to make the
 * parser independently reusable.
 *
 * Grammar recap (doc §6):
 *   - sentence line  `^\s*([A-Za-z]{2,3})\((\d+)\)\s*(.+)$`, tail split on
 *     "| EXPLAIN:" → { text, explanation }. `n` maps to a library `seq` via the
 *     claim's slots array.
 *   - `SHORT PHRASES (CODE)` / `GRAMMAR POINTS (CODE)` section headers switch the
 *     active section+language; following `- left — right` items (em-dash, hyphen,
 *     or colon separators) belong to it until the next header or sentence line.
 *   - a reply yielding zero sentence lines AND zero section items is a generation
 *     failure (the caller releases the segment with an error).
 */
import type { BookStudySlot } from './promptPresets';

export interface ParsedSlot {
  seq: number;
  langs: Record<string, { text: string; explanation?: string }>;
}

export interface ParsedStudyPhrase {
  language: string;
  phrase: string;
  meaning?: string;
}

export interface ParsedStudyGrammarPoint {
  language: string;
  point: string;
  explanation?: string;
}

export interface ParsedStudySegment {
  slots: ParsedSlot[];
  phrases: ParsedStudyPhrase[];
  grammar_points: ParsedStudyGrammarPoint[];
  // Distinct target language codes seen across accepted sentence lines — becomes
  // the submission's `languages` (languages_done).
  languages: string[];
  // Yield counters; the caller treats (0 sentences AND 0 items) as a failure.
  sentenceLineCount: number;
  sectionItemCount: number;
}

export interface ParseStudyOptions {
  // When provided, sentence lines whose language code is not in this set are
  // dropped. The claim's target_languages already exclude the primary language,
  // so passing them here keeps the primary (source) text from being submitted as
  // a translation. Phrase/grammar sections are NOT filtered (they legitimately
  // cover the primary language too).
  targetLanguages?: string[];
}

const SENTENCE_RE = /^\s*([A-Za-z]{2,3})\((\d+)\)\s*(.+)$/;
const PHRASES_HEADER_RE = /^\s*SHORT\s+PHRASES\s*\(\s*([A-Za-z]{2,3})\s*\)\s*$/i;
const GRAMMAR_HEADER_RE = /^\s*GRAMMAR\s+POINTS\s*\(\s*([A-Za-z]{2,3})\s*\)\s*$/i;
const BULLET_RE = /^\s*[-•*]\s+(.*)$/;
const EXPLAIN_RE = /\|\s*EXPLAIN:/i;
// Item separator: em/en-dash (spaces optional), spaced hyphen, or a colon.
const ITEM_SPLIT_RE = /^(.*?)(?:\s*[—–]\s*|\s+-\s+|\s*[:：]\s*)(.*)$/;

type SectionKind = 'phrase' | 'grammar';

interface SectionContext {
  kind: SectionKind;
  language: string;
}

/** Split a "left <sep> right" bullet body; right is '' when there is no separator. */
const splitItem = (body: string): { left: string; right: string } => {
  const m = body.match(ITEM_SPLIT_RE);
  if (m) return { left: m[1].trim(), right: (m[2] || '').trim() };
  return { left: body.trim(), right: '' };
};

export const parseStudySegmentReply = (
  reply: string,
  slots: BookStudySlot[],
  options: ParseStudyOptions = {},
): ParsedStudySegment => {
  const allowed = new Set(
    (options.targetLanguages || [])
      .map((c) => (c || '').trim().toLowerCase())
      .filter((c) => c.length > 0),
  );

  // n → seq map from the claim's slots (doc §5.2 / §6).
  const nToSeq = new Map<number, number>();
  for (const s of slots || []) {
    if (s && typeof s.n === 'number' && typeof s.seq === 'number') nToSeq.set(s.n, s.seq);
  }

  const slotMap = new Map<number, ParsedSlot>();
  const phrases: ParsedStudyPhrase[] = [];
  const grammarPoints: ParsedStudyGrammarPoint[] = [];
  const languagesSeen = new Set<string>();
  let sentenceLineCount = 0;
  let sectionItemCount = 0;
  let section: SectionContext | null = null;

  const lines = (reply || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // 1) Sentence line — also resets any active section (back to sentence flow).
    const sm = line.match(SENTENCE_RE);
    if (sm) {
      section = null;
      const code = sm[1].toLowerCase();
      if (allowed.size > 0 && !allowed.has(code)) continue; // e.g. the primary language
      const n = parseInt(sm[2], 10);
      const seq = nToSeq.get(n);
      if (seq === undefined) continue; // out-of-range n, server would skip it too
      const rest = sm[3];
      let text = rest.trim();
      let explanation: string | undefined;
      const ei = rest.search(EXPLAIN_RE);
      if (ei >= 0) {
        text = rest.slice(0, ei).trim();
        explanation = rest.slice(ei).replace(EXPLAIN_RE, '').trim();
      }
      if (!text) continue;
      let slot = slotMap.get(seq);
      if (!slot) {
        slot = { seq, langs: {} };
        slotMap.set(seq, slot);
      }
      slot.langs[code] = explanation ? { text, explanation } : { text };
      languagesSeen.add(code);
      sentenceLineCount++;
      continue;
    }

    // 2) Section headers.
    const ph = line.match(PHRASES_HEADER_RE);
    if (ph) {
      section = { kind: 'phrase', language: ph[1].toLowerCase() };
      continue;
    }
    const gh = line.match(GRAMMAR_HEADER_RE);
    if (gh) {
      section = { kind: 'grammar', language: gh[1].toLowerCase() };
      continue;
    }

    // 3) Section item (bullet) — only meaningful inside an open section.
    if (section) {
      const bm = line.match(BULLET_RE);
      if (bm) {
        const { left, right } = splitItem(bm[1]);
        if (!left) continue;
        if (section.kind === 'phrase') {
          phrases.push(right ? { language: section.language, phrase: left, meaning: right } : { language: section.language, phrase: left });
        } else {
          grammarPoints.push(right ? { language: section.language, point: left, explanation: right } : { language: section.language, point: left });
        }
        sectionItemCount++;
        continue;
      }
    }
    // 4) Anything else is skipped (tolerant parse).
  }

  return {
    slots: [...slotMap.values()],
    phrases,
    grammar_points: grammarPoints,
    languages: [...languagesSeen],
    sentenceLineCount,
    sectionItemCount,
  };
};
