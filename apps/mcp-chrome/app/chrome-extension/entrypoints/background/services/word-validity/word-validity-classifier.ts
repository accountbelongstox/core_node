/**
 * Word-Validity Classifier (shared, pure functions)
 *
 * The single source of truth for the invalid-word DETECTION prompt + answer
 * parser. Both consumers reuse these functions so the prompt and the whitelist
 * parse can never drift:
 *   - WordValidityWebWorkerService  (server-lane `word_validity` task worker)
 *   - WordValidityPanel             (single-feature diagnostic)
 *
 * Behavior is moved verbatim from the worker's former private buildPrompt /
 * parseClassification. No network, no tab, no side effects — pure in/out.
 */

/**
 * One word to classify; md5 is carried through so the backend keys on it.
 * `translation` is optional and only set on VALID words when the prompt asked
 * for a target-language translation (absent for the legacy no-target lane).
 */
export interface ClassifierWord {
  word: string;
  md5?: string;
  translation?: string;
}

/** Parse output: whitelisted, de-duped verdicts split into valid / invalid. */
export interface ClassifierResult {
  valid: ClassifierWord[];
  invalid: ClassifierWord[];
}

/**
 * Build a strict-JSON classification prompt the model can answer mechanically.
 * (Verbatim from WordValidityWebWorkerService.buildPrompt.)
 *
 * When `targetLanguage` is provided, valid words are returned WITH a translation
 * into that language (object shape). When absent, the legacy string shape is
 * emitted verbatim so the no-target lane worker is unaffected.
 */
export function buildValidityPrompt(words: string[], targetLanguage?: string): string {
  const list = words.map((w) => `- ${w}`).join('\n');
  const lines = [
    'You are a strict English dictionary validator.',
    'For each item below, decide whether it is a REAL word or phrase that exists in a standard dictionary (or a valid proper noun / common term), versus INVALID (nonsense, random characters, a clear typo, or a non-word).',
    'Only put a word in "invalid" when you are confident it is not a real word — when unsure, treat it as valid.',
    'Classify EVERY item. Use the EXACT original text for each word.',
    'Respond with ONLY a JSON object, no prose, no code fence, of the exact form:',
  ];
  if (targetLanguage) {
    lines.push(
      `{"valid":[{"word":"<original>","translation":"<translation in ${targetLanguage}>"}],"invalid":["<word>"]}`,
      `For every valid word, include its translation into ${targetLanguage}. Invalid words stay bare strings.`,
    );
  } else {
    lines.push('{"valid":["<word>"],"invalid":["<word>"]}');
  }
  lines.push('Words:', list);
  return lines.join('\n');
}

/**
 * Parse a {valid:[...],invalid:[...]} object out of the answer, tolerating a
 * surrounding code fence / prose. Only words actually requested are kept
 * (case-insensitive whitelist) so a chatty model cannot inject spurious
 * entries; each kept verdict carries the REQUESTED word + its md5 so the
 * backend keys on the stored md5. A word omitted from both lists is left
 * unmarked (re-pulled next cycle): a parse miss is NEVER force-marked invalid.
 *
 * (Verbatim behavior from WordValidityWebWorkerService.parseClassification,
 * renamed keys valid_words/invalid_words -> valid/invalid.)
 */
export function parseValidityClassification(
  answer: string,
  requested: ClassifierWord[],
): ClassifierResult {
  const empty: ClassifierResult = { valid: [], invalid: [] };
  const start = answer.indexOf('{');
  const end = answer.lastIndexOf('}');
  if (start === -1 || end <= start) return empty;

  let obj: any;
  try {
    obj = JSON.parse(answer.slice(start, end + 1));
  } catch {
    return empty;
  }
  if (!obj || typeof obj !== 'object') return empty;

  const byKey = new Map<string, ClassifierWord>();
  for (const w of requested) {
    byKey.set(w.word.toLowerCase(), w);
  }
  const seen = new Set<string>();
  const pick = (arr: any): ClassifierWord[] => {
    if (!Array.isArray(arr)) return [];
    const out: ClassifierWord[] = [];
    for (const it of arr) {
      const isObj = it && typeof it === 'object' && typeof it.word === 'string';
      const raw = typeof it === 'string' ? it : isObj ? it.word : '';
      const key = raw.trim().toLowerCase();
      if (!key) continue;
      const match = byKey.get(key);
      // Whitelist: only words we asked about; de-dupe across BOTH lists.
      if (!match || seen.has(key)) continue;
      seen.add(key);
      const entry: ClassifierWord = { word: match.word, md5: match.md5 };
      // Optional translation: only carried when the model returned the object
      // shape with a non-empty translation string (valid words only).
      if (isObj && typeof it.translation === 'string' && it.translation.trim()) {
        entry.translation = it.translation.trim();
      }
      out.push(entry);
    }
    return out;
  };
  return { valid: pick(obj.valid), invalid: pick(obj.invalid) };
}
