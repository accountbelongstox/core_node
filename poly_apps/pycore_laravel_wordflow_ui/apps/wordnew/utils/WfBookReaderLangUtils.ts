import type { WfNewReaderPlayStep } from '../api/types/bookProgress';

/** Display label: `EN · English` (code from the book + localized name). */
export function formatBookLangLabel(code: string, trans: (key: string) => string): string {
  const key = `lang.name.${code}`;
  const name = trans(key);
  const resolved = name && name !== key ? name : code.toUpperCase();
  return `${code.toUpperCase()} · ${resolved}`;
}

/** Default play sequence from the book's actual language list. */
export function buildDefaultPlaySequence(langs: string[]): WfNewReaderPlayStep[] {
  if (!langs.length) return [{ lang: 'en', repeat: 1 }];
  if (langs.includes('en') && langs.includes('zh')) {
    return [
      { lang: 'en', repeat: 1 },
      { lang: 'zh', repeat: 1 },
      { lang: 'en', repeat: 3 },
    ];
  }
  return langs.slice(0, 4).map((lang) => ({ lang, repeat: 1 }));
}

export function syncPlaySequenceForBook(
  current: WfNewReaderPlayStep[],
  bookLangs: string[],
): WfNewReaderPlayStep[] {
  const filtered = current.filter((s) => bookLangs.includes(s.lang));
  if (filtered.length) return filtered;
  return buildDefaultPlaySequence(bookLangs);
}

export function syncSpeedByLangForBook(
  current: Record<string, number>,
  bookLangs: string[],
): Record<string, number> {
  const next: Record<string, number> = {};
  for (const lang of bookLangs) {
    next[lang] = current[lang] ?? 1;
  }
  return next;
}

/** Languages visible in the verse list: single = one; simultaneous = all selected (book-scoped). */
export function visibleBookLangs(
  bookLangs: string[],
  selectedLangs: string[],
  simul: boolean,
): string[] {
  const picked = selectedLangs.filter((l) => bookLangs.includes(l));
  if (!simul) {
    const one = picked[0] || bookLangs[0];
    return one ? [one] : [];
  }
  if (picked.length) return bookLangs.filter((l) => picked.includes(l));
  return bookLangs.length ? [bookLangs[0]] : [];
}
