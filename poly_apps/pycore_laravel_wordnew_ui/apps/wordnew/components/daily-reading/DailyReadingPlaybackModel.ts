import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

export type DailyReadingPlaybackMode = 'sequential' | 'repeat-all' | 'repeat-one' | 'shuffle';
export type DailyReadingWordMode = 'off' | 'new' | 'all';
export type DailyReadingWordOrder = 'sentence' | 'shuffle' | 'alpha';

let playbackStepSequence = 0;

export const DAILY_READING_PLAYBACK_LIMITS = Object.freeze({
  maxSteps: 12,
  maxStepRepeats: 10,
  maxNewReadCount: 100,
  minRate: 0.25,
  maxRate: 4,
  maxStepIdLength: 96,
});

export interface DailyReadingSentencePlaybackStep {
  id: string;
  type: 'sentence';
  lang: 'en' | 'cn';
  times: number;
}

export interface DailyReadingWordPlaybackStep {
  id: string;
  type: 'words';
  times: number;
}

export type DailyReadingPlaybackStep = DailyReadingSentencePlaybackStep | DailyReadingWordPlaybackStep;

export interface DailyReadingPlaybackSettings {
  playbackMode: DailyReadingPlaybackMode;
  wordMode: DailyReadingWordMode;
  wordOrder: DailyReadingWordOrder;
  newOnlyMaxReadCount: number;
  underlineCurrentSentence: boolean;
  bilingual: boolean;
  sentenceRate: number;
  wordRate: number;
  playbackPattern: DailyReadingPlaybackStep[];
}

export interface DailyReadingResourceStatus {
  articleAudioReady: number;
  articleAudioTotal: number;
  wordAudioReady: number;
  wordAudioTotal: number;
  translationsReady: number;
  translationsTotal: number;
}

export const DEFAULT_DAILY_READING_SETTINGS: DailyReadingPlaybackSettings = {
  playbackMode: 'sequential',
  wordMode: 'new',
  wordOrder: 'sentence',
  newOnlyMaxReadCount: 0,
  underlineCurrentSentence: true,
  bilingual: true,
  sentenceRate: 1,
  wordRate: 1,
  playbackPattern: [
    { id: 'default-words', type: 'words', times: 1 },
    { id: 'default-sentence-en', type: 'sentence', lang: 'en', times: 1 },
  ],
};

export const EMPTY_DAILY_READING_RESOURCE_STATUS: DailyReadingResourceStatus = {
  articleAudioReady: 0,
  articleAudioTotal: 0,
  wordAudioReady: 0,
  wordAudioTotal: 0,
  translationsReady: 0,
  translationsTotal: 0,
};

export function createDailyReadingStepId(): string {
  playbackStepSequence += 1;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `daily-step-${crypto.randomUUID()}`;
  }
  return `daily-step-${Date.now()}-${playbackStepSequence}`;
}

export function defaultDailyReadingPattern(): DailyReadingPlaybackStep[] {
  return DEFAULT_DAILY_READING_SETTINGS.playbackPattern.map((step) => ({ ...step }));
}

export function clampDailyReadingRate(value: unknown): number {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate <= 0) return 1;
  return Math.max(
    DAILY_READING_PLAYBACK_LIMITS.minRate,
    Math.min(DAILY_READING_PLAYBACK_LIMITS.maxRate, rate),
  );
}

function parsePattern(value: unknown): DailyReadingPlaybackStep[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  return value.map((value, index): DailyReadingPlaybackStep | null => {
    if (!value || typeof value !== 'object') return null;
    const step = value as { id?: unknown; type?: unknown; lang?: unknown; times?: unknown };
    if (step.type !== 'words' && step.type !== 'sentence') return null;
    const times = Math.max(
      1,
      Math.min(DAILY_READING_PLAYBACK_LIMITS.maxStepRepeats, Math.trunc(Number(step.times) || 1)),
    );
    const storedId = typeof step.id === 'string'
      ? step.id.trim().replace(/[^a-zA-Z0-9_-]+/g, '-')
      : '';
    const candidateId = storedId
      ? storedId.slice(0, DAILY_READING_PLAYBACK_LIMITS.maxStepIdLength)
      : `legacy-step-${index}-${step.type}`;
    let id = candidateId;
    let duplicateIndex = 1;
    while (usedIds.has(id)) {
      const suffix = `-${duplicateIndex}`;
      id = `${candidateId.slice(
        0,
        DAILY_READING_PLAYBACK_LIMITS.maxStepIdLength - suffix.length,
      )}${suffix}`;
      duplicateIndex += 1;
    }
    usedIds.add(id);
    if (step.type === 'words') return { id, type: 'words', times };
    return { id, type: 'sentence', lang: step.lang === 'cn' ? 'cn' : 'en', times };
  }).filter((step): step is DailyReadingPlaybackStep => step !== null)
    .slice(0, DAILY_READING_PLAYBACK_LIMITS.maxSteps);
}

function migratePattern(stored: Record<string, unknown>): DailyReadingPlaybackStep[] {
  const currentPattern = parsePattern(stored.playbackPattern);
  if (currentPattern.length > 0) return currentPattern;
  if (!Array.isArray(stored.sentencePattern)) return defaultDailyReadingPattern();
  const legacySentencePattern = stored.sentencePattern.map((step) => (
    step && typeof step === 'object'
      ? { ...(step as Record<string, unknown>), type: 'sentence' }
      : step
  ));
  const sentencePattern = parsePattern(legacySentencePattern);
  if (sentencePattern.length === 0 || stored.wordMode === 'off') {
    return sentencePattern.length > 0 ? sentencePattern : defaultDailyReadingPattern();
  }
  const wordStep: DailyReadingWordPlaybackStep = {
    id: 'legacy-word-step',
    type: 'words',
    times: Math.max(
      1,
      Math.min(
        DAILY_READING_PLAYBACK_LIMITS.maxStepRepeats,
        Math.trunc(Number(stored.wordRepeats) || 1),
      ),
    ),
  };
  const wordsDuring = stored.wordTiming === 'during' || stored.sentenceFirst === true;
  const migratedPattern = wordsDuring
    ? [sentencePattern[0], wordStep, ...sentencePattern.slice(1)]
    : [wordStep, ...sentencePattern];
  return parsePattern(migratedPattern);
}

export function sanitizeDailyReadingPattern(value: unknown): DailyReadingPlaybackStep[] {
  const pattern = parsePattern(value);
  return pattern.length > 0 ? pattern : defaultDailyReadingPattern();
}

export function normalizeDailyReadingSettings(stored: Record<string, unknown>): DailyReadingPlaybackSettings {
  const playbackMode = ['sequential', 'repeat-all', 'repeat-one', 'shuffle'].includes(String(stored.playbackMode))
    ? stored.playbackMode as DailyReadingPlaybackMode
    : DEFAULT_DAILY_READING_SETTINGS.playbackMode;
  const wordMode = ['off', 'new', 'all'].includes(String(stored.wordMode))
    ? stored.wordMode as DailyReadingWordMode
    : DEFAULT_DAILY_READING_SETTINGS.wordMode;
  const wordOrder = ['sentence', 'shuffle', 'alpha'].includes(String(stored.wordOrder))
    ? stored.wordOrder as DailyReadingWordOrder
    : DEFAULT_DAILY_READING_SETTINGS.wordOrder;
  return {
    playbackMode,
    wordMode,
    wordOrder,
    newOnlyMaxReadCount: Math.max(
      0,
      Math.min(
        DAILY_READING_PLAYBACK_LIMITS.maxNewReadCount,
        Math.trunc(Number(stored.newOnlyMaxReadCount) || 0),
      ),
    ),
    underlineCurrentSentence: stored.underlineCurrentSentence !== false,
    bilingual: stored.bilingual !== false,
    sentenceRate: clampDailyReadingRate(stored.sentenceRate),
    wordRate: clampDailyReadingRate(stored.wordRate),
    playbackPattern: migratePattern(stored),
  };
}

export function mergeDailyReadingSettings(
  current: DailyReadingPlaybackSettings,
  patch: Partial<DailyReadingPlaybackSettings>,
): DailyReadingPlaybackSettings {
  const candidate = { ...current, ...patch } as unknown as Record<string, unknown>;
  const normalized = normalizeDailyReadingSettings(candidate);
  return {
    ...normalized,
    playbackPattern: patch.playbackPattern
      ? sanitizeDailyReadingPattern(patch.playbackPattern)
      : current.playbackPattern,
  };
}

export function initialDailyReadingSettings(): DailyReadingPlaybackSettings {
  try {
    return normalizeDailyReadingSettings(StorageManager.get<Record<string, unknown>>(
      StorageKeys.WORDNEW_DAILY_READING_PLAYER,
      {},
    ));
  } catch {
    return {
      ...DEFAULT_DAILY_READING_SETTINGS,
      playbackPattern: defaultDailyReadingPattern(),
    };
  }
}
