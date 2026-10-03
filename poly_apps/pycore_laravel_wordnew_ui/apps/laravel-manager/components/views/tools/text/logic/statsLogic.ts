/** Text statistics: counters, reading time and word frequency (Intl.Segmenter with regex fallback). */
export interface TextStats {
  characters: number;
  charactersNoSpaces: number;
  bytes: number;
  words: number;
  uniqueWords: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  letters: number;
  digits: number;
  punctuation: number;
  avgWordLength: number;
  longestWord: string;
  topWords: Array<{ word: string; count: number; share: number }>;
}

export const STOP_WORDS = new Set(('a an and are as at be but by for from has have he her his i in is it its me my not of on or our she so that the their them they this to us was we were what when which who will with you your').split(' '));

const segmenterCtor = (Intl as unknown as { Segmenter?: new (locale?: string, options?: { granularity: string }) => { segment: (text: string) => Iterable<{ segment: string; isWordLike?: boolean }> } }).Segmenter;

const splitWords = (text: string): string[] => {
  if (segmenterCtor) {
    const words: string[] = [];
    for (const part of new segmenterCtor(undefined, { granularity: 'word' }).segment(text)) if (part.isWordLike) words.push(part.segment);
    return words;
  }
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu) ?? [];
};

const countSentences = (text: string): number => {
  if (!text.trim()) return 0;
  if (segmenterCtor) {
    let count = 0;
    for (const part of new segmenterCtor(undefined, { granularity: 'sentence' }).segment(text)) if (part.segment.trim()) count += 1;
    return count;
  }
  return text.split(/(?<=[.!?。！？])\s+/).filter((part) => part.trim()).length;
};

export const analyzeText = (text: string, excludeStopWords: boolean, topLimit = 10): TextStats => {
  const words = splitWords(text);
  const lower = words.map((word) => word.toLowerCase());
  const frequency = new Map<string, number>();
  lower.forEach((word) => {
    if (excludeStopWords && STOP_WORDS.has(word)) return;
    if (word.length < 2 && /^[\p{L}]$/u.test(word) && !/\p{Script=Han}/u.test(word)) return;
    frequency.set(word, (frequency.get(word) ?? 0) + 1);
  });
  const total = Array.from(frequency.values()).reduce((sum, count) => sum + count, 0);
  const topWords = Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topLimit)
    .map(([word, count]) => ({ word, count, share: total ? count / total : 0 }));
  const letterTotal = words.reduce((sum, word) => sum + Array.from(word).length, 0);
  return {
    characters: Array.from(text).length,
    charactersNoSpaces: Array.from(text.replace(/\s/gu, '')).length,
    bytes: new TextEncoder().encode(text).length,
    words: words.length,
    uniqueWords: new Set(lower).size,
    sentences: countSentences(text),
    paragraphs: text.split(/\n\s*\n/).filter((part) => part.trim()).length,
    lines: text === '' ? 0 : text.split('\n').length,
    letters: (text.match(/\p{L}/gu) ?? []).length,
    digits: (text.match(/\p{N}/gu) ?? []).length,
    punctuation: (text.match(/\p{P}/gu) ?? []).length,
    avgWordLength: words.length ? Math.round((letterTotal / words.length) * 10) / 10 : 0,
    longestWord: words.reduce((best, word) => (Array.from(word).length > Array.from(best).length ? word : best), ''),
    topWords,
  };
};

export const minutesToClock = (minutes: number): { minutes: number; seconds: number } => {
  const totalSeconds = Math.round(minutes * 60);
  return { minutes: Math.floor(totalSeconds / 60), seconds: totalSeconds % 60 };
};
