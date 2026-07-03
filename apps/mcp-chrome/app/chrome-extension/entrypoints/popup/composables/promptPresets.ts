/**
 * Built-in prompt presets for the Extensions-tab "test" panels.
 * Each preset is a fixed instruction template composed with user-supplied text
 * and (for Gemini Translate) a per-language options config. See
 * apps/mcp-chrome/docs/GEMINI_TRANSLATE_PROMPT_DESIGN.md for the abstract
 * template with placeholder markers and the full field reference.
 */

export interface GeminiTranslateLangOption {
  code: string;
  label: string;
  phonetics: boolean; // connected-reading / IPA marks appended to each sentence
  sentencePattern: boolean; // short grammatical sentence-pattern label appended to each sentence
  shortPhrases: boolean; // "SHORT PHRASES" section for this language
  words: boolean; // "WORDS" section for this language
  grammarPoints: boolean; // "GRAMMAR POINTS" section for this language
  expressions: boolean; // append EXPR2..EXPRk alternate phrasings per sentence
  expressionsCount: number; // total phrasing count including the sentence itself (>=1)
}

export const GEMINI_TRANSLATE_LANGUAGE_CATALOG: Record<string, string> = {
  en: 'English',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
};

const LANG_OPTION_DEFAULTS: Omit<GeminiTranslateLangOption, 'code' | 'label'> = {
  phonetics: false,
  sentencePattern: false,
  shortPhrases: false,
  words: false,
  grammarPoints: false,
  expressions: false,
  expressionsCount: 3,
};

export const makeGeminiTranslateLangOption = (code: string): GeminiTranslateLangOption => ({
  code,
  label: GEMINI_TRANSLATE_LANGUAGE_CATALOG[code] || code.toUpperCase(),
  ...LANG_OPTION_DEFAULTS,
});

// Default config: EN gets short phrases + phonetics + sentence-pattern labels
// + grammar points + 3 alternate phrasings; ZH gets sentence alignment only.
export const DEFAULT_GEMINI_TRANSLATE_LANGUAGES: GeminiTranslateLangOption[] = [
  {
    ...makeGeminiTranslateLangOption('en'),
    phonetics: true,
    sentencePattern: true,
    shortPhrases: true,
    grammarPoints: true,
    expressions: true,
    expressionsCount: 3,
  },
  makeGeminiTranslateLangOption('zh'),
];

const languageTag = (l: GeminiTranslateLangOption): string =>
  `  <language code=${l.code} phonetics=${l.phonetics} sentencePattern=${l.sentencePattern} shortPhrases=${l.shortPhrases} words=${l.words} grammarPoints=${l.grammarPoints} expressions=${l.expressions} expressionsCount=${l.expressions ? Math.max(1, l.expressionsCount) : 0} />`;

/**
 * Build the Article Study Guide prompt. XML-LIKE structure (loosely tagged,
 * unquoted attributes, no CDATA/entity-escaping) — not strict/parseable XML,
 * since the consumer is an LLM, not an XML parser; strict escaping only adds
 * visual noise here. The tags + an explicit <instructions> block still keep
 * the reply far more consistently formatted across runs than plain prose.
 */
export const buildGeminiArticleTranslatePrompt = (
  article: string,
  languages: GeminiTranslateLangOption[] = DEFAULT_GEMINI_TRANSLATE_LANGUAGES,
  sourceLanguageSkipExpressions = true,
): string => {
  const langs = (languages || []).filter((l) => typeof l?.code === 'string' && l.code.trim().length > 0);
  const orderedCodes = langs.map((l) => l.code.toUpperCase()).join(', ');
  return `<task type=article_study_guide>
<config>
<languages>
${langs.map(languageTag).join('\n')}
</languages>
<sourceLanguageSkipExpressions>${sourceLanguageSkipExpressions}</sourceLanguageSkipExpressions>
</config>
<instructions>
Detect the article's own source language first.
Split the article into sentences and number them 1..N in original order. Output the sentences GROUPED BY SENTENCE NUMBER, not grouped by language: for sentence 1, output its line in EVERY configured language (in this order: ${orderedCodes}) back to back, then move to sentence 2 and do the same, and so on through sentence N. Do NOT output all of one language's sentences before starting the next language.

For sentence n, each language's line has the form:
<CODE>(n) <sentence text>[ | PATTERN: <short sentence-structure label>][ | PHONETICS: <IPA / connected-reading marks>][ | EXPR2: <alt phrasing>][ | EXPR3: <alt phrasing>]...
- Include " | PATTERN: ..." for EVERY sentence when that language's sentencePattern=true — never skip it, even for a simple sentence. A short label naming the sentence's grammatical structure (e.g. "not only...but also", "S+V+O", "if-conditional").
- Include " | PHONETICS: ..." for EVERY sentence when that language's phonetics=true — never skip it.
- Include " | EXPRk: ..." (k = 2..expressionsCount) only when that language's expressions=true, AND — when sourceLanguageSkipExpressions=true — only for languages that are NOT the article's detected source language.
- EXPR1 is the sentence text itself; do not repeat it as a suffix.
- <CODE>(n) always refers to the same original sentence across every language.

After ALL sentence-number groups (1..N), for each language (in the order above) output, only when requested by its flags:
"SHORT PHRASES (<CODE>)" — when shortPhrases=true, list EVERY notable short phrase from EVERY sentence of that language, not a curated sample — cover the whole article, one bullet per phrase with a one-line meaning. Do not stop early or cap the count.
"WORDS (<CODE>)" — when words=true, list EVERY key standalone word from EVERY sentence of that language, not a curated sample, one bullet per word with a one-line meaning.
"GRAMMAR POINTS (<CODE>)" — when grammarPoints=true, list EVERY distinct grammar point found across ALL sentences of that language (tenses, clauses, structures) — one bullet per sentence that introduces a point, not a generic top-5 summary.

Use exactly this structure and order. No commentary outside it.
</instructions>
<article>
${article.trim()}
</article>
</task>`;
};

/**
 * One source sentence in a claimed study segment. `n` is the 1-based in-segment
 * sentence number the prompt/reply format uses; `seq` is the library slot seq
 * the extension submits results by (the reply's `n` is mapped back to `seq` via
 * the claim's slots array). Mirrors the claim response `slots[]` shape in
 * development-guides/cross-docs/BOOK_STUDY_GENERATION_PIPELINE.md §5.2.
 */
export interface BookStudySlot {
  n: number;
  seq: number;
  text: string;
}

/**
 * Build the Book Study Generator segment prompt (doc §6). XML-LIKE, not strict
 * XML — same tier/style as buildGeminiArticleTranslatePrompt: the consumer is an
 * LLM, so loose tags + an explicit <instructions> block keep replies consistent
 * without the noise of strict escaping.
 *
 * Source sentences are emitted as `S(n)` lines (leading "S" is a single letter,
 * so they never collide with the reply's `<CODE>(n)` sentence lines, whose codes
 * are 2-3 letters). The reply must, for every sentence, output one line per
 * target language `CODE(n) <translation> | EXPLAIN: <meaning>`, then exhaustive
 * SHORT PHRASES / GRAMMAR POINTS sections for every target language plus the
 * primary language. The primary language is never a translation target (it is
 * the source text) but IS covered by the phrase/grammar sections.
 */
export const buildBookStudySegmentPrompt = (
  slots: BookStudySlot[],
  primaryLang: string,
  targetLangs: string[],
): string => {
  const primary = (primaryLang || 'en').trim().toLowerCase();
  const targets = (targetLangs || [])
    .map((c) => (c || '').trim().toLowerCase())
    .filter((c) => c.length > 0 && c !== primary);
  const targetCodes = targets.map((c) => c.toUpperCase()).join(', ');
  // Sections are produced for every target language PLUS the primary language.
  const sectionCodes = [primary, ...targets].map((c) => c.toUpperCase()).join(', ');
  const sentenceLines = (slots || [])
    .filter((s) => s && typeof s.text === 'string')
    .map((s, i) => `S(${typeof s.n === 'number' ? s.n : i + 1}) ${(s.text || '').trim()}`)
    .join('\n');
  return `<task type=book_study_segment>
<config>
<primaryLanguage>${primary.toUpperCase()}</primaryLanguage>
<targetLanguages>${targetCodes}</targetLanguages>
</config>
<instructions>
For every numbered source sentence S(n), output one line per target language:
  <CODE>(n) <translation> | EXPLAIN: <one-line meaning in that language>
(EXPLAIN is required for every sentence.) <CODE>(n) always refers to source sentence S(n). Output the sentences in order 1..N.
After all sentences, output for EVERY language in <targetLanguages> plus the primary language ${primary.toUpperCase()} (cover these codes: ${sectionCodes}):
  SHORT PHRASES (<CODE>)   — every notable phrase, one "- phrase — meaning" per line
  GRAMMAR POINTS (<CODE>)  — every distinct grammar point, one "- point — explanation" per line
Sections are exhaustive, not samples. No commentary outside this format.
</instructions>
<sentences>
${sentenceLines}
</sentences>
</task>`;
};

export const NOTEBOOKLM_DIALOGUE_PROMPT_TEMPLATE = `You are a language-learning content creator. Using ONLY the words and/or sentences given below, write a short natural dialogue (4 to 8 lines, two speakers labeled A: and B:) that naturally incorporates every item at least once. Keep it simple and appropriate for a language learner. After the dialogue, add a "USAGE" section listing which dialogue line each given word/sentence appears in.

WORDS/SENTENCES:
`;

export const buildNotebookLmDialoguePrompt = (items: string): string =>
  `${NOTEBOOKLM_DIALOGUE_PROMPT_TEMPLATE}${items.trim()}`;
