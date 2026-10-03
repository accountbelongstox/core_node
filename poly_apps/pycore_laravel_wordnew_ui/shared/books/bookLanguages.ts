/** A language found in an analyzed book: its code and the share of the text it covers (0..1). */
export interface BookLanguageShare {
  code: string;
  ratio: number;
}

/** A language below this share of the text is noise (quotes, names), not a translation. */
export const BOOK_LANGUAGE_MIN_RATIO = 0.03;

/** Language codes that make up the book's text, largest first. */
export function bookDetectedLanguages(languages: ReadonlyArray<BookLanguageShare> | null | undefined): string[] {
  return [...(languages ?? [])]
    .filter((entry) => entry.code && entry.ratio >= BOOK_LANGUAGE_MIN_RATIO)
    .sort((a, b) => b.ratio - a.ratio)
    .map((entry) => entry.code);
}

/**
 * True only when the analysis positively found a single language. An empty or
 * missing language list means "unknown" and never raises the notice.
 */
export function bookIsMonolingual(languages: ReadonlyArray<BookLanguageShare> | null | undefined): boolean {
  return (languages?.length ?? 0) > 0 && bookDetectedLanguages(languages).length < 2;
}
