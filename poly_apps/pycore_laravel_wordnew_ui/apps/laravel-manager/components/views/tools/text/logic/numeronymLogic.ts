/** Numeronym generator: first letter + count of letters in between + last letter. */
export const FAMOUS_NUMERONYMS: ReadonlyArray<{ numeronym: string; word: string }> = [
  { numeronym: 'i18n', word: 'internationalization' },
  { numeronym: 'l10n', word: 'localization' },
  { numeronym: 'a11y', word: 'accessibility' },
  { numeronym: 'k8s', word: 'kubernetes' },
  { numeronym: 'o11y', word: 'observability' },
  { numeronym: 'p13n', word: 'personalization' },
  { numeronym: 'e2e', word: 'end-to-end' },
  { numeronym: 'm17n', word: 'multilingualization' },
];

export const toNumeronym = (word: string, minLength: number): string => {
  const chars = Array.from(word);
  if (chars.length < Math.max(minLength, 4)) return word;
  return `${chars[0]}${chars.length - 2}${chars[chars.length - 1]}`;
};

export interface NumeronymToken {
  text: string;
  isWord: boolean;
  numeronym: string;
}

export const convertText = (text: string, minLength: number): NumeronymToken[] => {
  const parts = text.match(/[\p{L}\p{N}]+|[^\p{L}\p{N}]+/gu) ?? [];
  return parts.map((part) => {
    const isWord = /^[\p{L}\p{N}]+$/u.test(part);
    return { text: part, isWord, numeronym: isWord ? toNumeronym(part, minLength) : part };
  });
};
