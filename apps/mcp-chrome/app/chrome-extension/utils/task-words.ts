export interface NormalizedWord {
  word: string;
  md5?: string;
}

export function normalizeWords(raw: unknown): NormalizedWord[] {
  if (!Array.isArray(raw)) return [];

  const normalized: NormalizedWord[] = [];
  for (const item of raw as any[]) {
    if (typeof item === 'string') {
      const word = item.trim();
      if (word) normalized.push({ word });
    } else if (item && typeof item.word === 'string') {
      const word = item.word.trim();
      if (word) normalized.push({ word, md5: item.md5 });
    }
  }
  return normalized;
}
