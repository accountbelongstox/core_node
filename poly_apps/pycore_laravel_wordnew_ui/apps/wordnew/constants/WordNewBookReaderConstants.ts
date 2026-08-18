/** Shared book-reader constants (UI + defaults). */
export const READER_SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export const DEFAULT_READER_PLAY_SEQUENCE = [
  { lang: 'en', repeat: 1 },
  { lang: 'zh', repeat: 1 },
  { lang: 'en', repeat: 3 },
] as const;
