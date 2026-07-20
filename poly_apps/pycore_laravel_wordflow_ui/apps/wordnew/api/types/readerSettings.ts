import type { WfNewReaderDisplayMode, WfNewReaderPlayStep } from './bookProgress';

/** Book reader UI settings synced to cloud (user or device scope). */
export interface WfNewReaderSettingsBlob {
  readerSimul?: boolean;
  readerLangs?: string[];
  readerDisplayMode?: WfNewReaderDisplayMode;
  readerPlaySequence?: WfNewReaderPlayStep[];
  readerSpeedByLang?: Record<string, number>;
  readerAutoAdvance?: boolean;
  readerRepeatOne?: boolean;
  readerAutoPlayOnOpen?: boolean;
  readerBrowserTts?: boolean;
  readerVariantByLang?: Record<string, string>;
  /** Word cards (English only): read unrecited Default Vocabulary Group words aloud. */
  readerWordCards?: boolean;
  /** Word-card reading position relative to the sentence audio. */
  readerWordCardPosition?: 'before' | 'after';
  /** ISO8601 — used for last-write-wins merge on pull. */
  updatedAt?: string | null;
}

export interface WfNewClientDeviceSettings {
  clientKey?: string;
  reader?: WfNewReaderSettingsBlob | null;
  updatedAt?: string | null;
}
