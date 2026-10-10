/** A mobile locale block: the Chinese tree must have exactly the English tree's keys. */
export function defineMobileLocale<T>(en: T, zh: T): { en: T; zh: T } {
  return { en, zh };
}
