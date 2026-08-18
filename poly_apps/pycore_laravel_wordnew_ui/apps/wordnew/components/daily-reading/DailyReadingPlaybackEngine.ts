import type { DailyReadingRow } from './dailyReadingApi';
import {
  sentenceWordKey,
  uniqueSentenceWordRows,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import type {
  DailyReadingPlaybackSettings,
  DailyReadingPlaybackStep,
  DailyReadingSentencePlaybackStep,
} from './DailyReadingPlaybackModel';

export type DailyReadingTransportState = 'idle' | 'loading' | 'playing' | 'paused' | 'stopped';

const TRANSPORT_TRANSITIONS: Record<DailyReadingTransportState, ReadonlySet<DailyReadingTransportState>> = {
  idle: new Set(['idle', 'loading', 'stopped']),
  loading: new Set(['loading', 'playing', 'paused', 'idle', 'stopped']),
  playing: new Set(['playing', 'paused', 'loading', 'idle', 'stopped']),
  paused: new Set(['paused', 'playing', 'loading', 'idle', 'stopped']),
  stopped: new Set(['stopped', 'loading', 'idle']),
};

export class DailyReadingPlaybackStateMachine {
  static transition(
    current: DailyReadingTransportState,
    next: DailyReadingTransportState,
  ): DailyReadingTransportState {
    return TRANSPORT_TRANSITIONS[current].has(next) ? next : current;
  }
}

export interface DailyReadingSequenceItem {
  type: DailyReadingPlaybackStep['type'];
  stepId: string;
  stepIndex: number;
  stepItemIndex: number;
  executionKey: string;
  url?: string;
  speechText?: string;
  speakLang?: string;
  wordRow?: WordNewSentenceWordRow;
  wordIndex?: number;
  sentenceLang?: DailyReadingSentencePlaybackStep['lang'];
}

export interface DailyReadingActiveItemState {
  stepType: DailyReadingPlaybackStep['type'] | null;
  stepId: string | null;
  stepItemIndex: number;
  sentenceLanguage: DailyReadingSentencePlaybackStep['lang'] | null;
  word: string | null;
  wordIndex: number;
}

export const EMPTY_DAILY_READING_ACTIVE_ITEM: DailyReadingActiveItemState = {
  stepType: null,
  stepId: null,
  stepItemIndex: -1,
  sentenceLanguage: null,
  word: null,
  wordIndex: -1,
};

export interface DailyReadingSequencePlan {
  items: DailyReadingSequenceItem[];
  words: WordNewSentenceWordRow[];
  articleWords: WordNewSentenceWordRow[];
  groupId: string | null;
  executionSignature: string;
  wordSelectionSignature: string;
}

function appendStepItem(
  items: DailyReadingSequenceItem[],
  step: DailyReadingPlaybackStep,
  stepIndex: number,
  stepItemIndex: number,
  executionSuffix: string,
  item: Omit<DailyReadingSequenceItem, 'stepId' | 'stepIndex' | 'stepItemIndex' | 'executionKey' | 'type'>,
): void {
  items.push({
    ...item,
    type: step.type,
    stepId: step.id,
    stepIndex,
    stepItemIndex,
    executionKey: `${step.id}:${executionSuffix}`,
  });
}

export function dailyReadingWordSelectionSignature(
  settings: DailyReadingPlaybackSettings,
): string {
  return JSON.stringify([
    settings.wordMode,
    settings.wordOrder,
    settings.newOnlyMaxReadCount,
  ]);
}

export function dailyReadingExecutionSignature(
  settings: DailyReadingPlaybackSettings,
): string {
  return JSON.stringify([
    dailyReadingWordSelectionSignature(settings),
    settings.playbackPattern,
  ]);
}

function shuffleWords(rows: WordNewSentenceWordRow[]): WordNewSentenceWordRow[] {
  const shuffled = [...rows];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function selectDailyReadingPlaybackWords(
  rows: WordNewSentenceWordRow[],
  settings: DailyReadingPlaybackSettings,
  sessionReadCounts: ReadonlyMap<string, number>,
  completedWordKeys: ReadonlySet<string>,
): WordNewSentenceWordRow[] {
  let selected = settings.wordMode === 'new'
    ? uniqueSentenceWordRows(rows.filter((word) => {
      const key = sentenceWordKey(word.word);
      const effectiveReadCount = Math.max(
        Number(word.play_count) || 0,
        sessionReadCounts.get(key) ?? 0,
      );
      return word.eligible_for_new_only
        && !completedWordKeys.has(key)
        && effectiveReadCount <= settings.newOnlyMaxReadCount;
    }))
    : settings.wordMode === 'all' ? [...rows] : [];

  if (settings.wordOrder === 'shuffle') {
    selected = shuffleWords(selected);
  } else if (settings.wordOrder === 'alpha') {
    selected = [...selected].sort((first, second) => first.word.localeCompare(second.word));
  }
  return selected;
}

export function buildDailyReadingSequenceItems(
  row: DailyReadingRow,
  sentenceUrl: string,
  selectedWords: WordNewSentenceWordRow[],
  pattern: DailyReadingPlaybackStep[],
): DailyReadingSequenceItem[] {
  const items: DailyReadingSequenceItem[] = [];

  pattern.forEach((step, stepIndex) => {
    let stepItemIndex = 0;
    if (step.type === 'words') {
      selectedWords.forEach((word, wordIndex) => {
        for (let repeatIndex = 0; repeatIndex < step.times; repeatIndex += 1) {
          appendStepItem(
            items,
            step,
            stepIndex,
            stepItemIndex,
            `word:${sentenceWordKey(word.word)}:${repeatIndex}`,
            word.audio_url
              ? { url: word.audio_url, wordRow: word, wordIndex }
              : { speechText: word.word, speakLang: 'en-US', wordRow: word, wordIndex },
          );
          stepItemIndex += 1;
        }
      });
      return;
    }

    for (let repeatIndex = 0; repeatIndex < step.times; repeatIndex += 1) {
      if (step.lang === 'cn') {
        if (row.reference_cn) {
          appendStepItem(items, step, stepIndex, stepItemIndex, `sentence:cn:${repeatIndex}`, {
            speechText: row.reference_cn,
            speakLang: 'zh-CN',
            sentenceLang: 'cn',
          });
          stepItemIndex += 1;
        }
      } else {
        appendStepItem(items, step, stepIndex, stepItemIndex, `sentence:en:${repeatIndex}`, {
          url: sentenceUrl,
          sentenceLang: 'en',
        });
        stepItemIndex += 1;
      }
    }
  });

  if (items.length === 0) {
    items.push({
      type: 'sentence',
      stepId: 'fallback-sentence',
      stepIndex: pattern.length,
      stepItemIndex: 0,
      executionKey: 'fallback-sentence:sentence:en:0',
      url: sentenceUrl,
      sentenceLang: 'en',
    });
  }

  return items;
}

export function nextReconciledSequenceIndex(
  current: DailyReadingSequenceItem,
  nextItems: DailyReadingSequenceItem[],
  completedExecutionKeys: ReadonlySet<string>,
  previousItems: DailyReadingSequenceItem[] = [],
): number {
  const currentStepItems = nextItems.filter((item) => item.stepId === current.stepId);
  const currentStep = currentStepItems[0];

  if (currentStep && currentStep.type === current.type) {
    const currentIndex = nextItems.findIndex((item) => item.executionKey === current.executionKey);
    if (currentIndex >= 0) {
      const sameStepNext = nextItems.findIndex((item, index) => (
        index > currentIndex
        && item.stepId === current.stepId
        && !completedExecutionKeys.has(item.executionKey)
      ));
      if (sameStepNext >= 0) return sameStepNext;
    } else {
      const firstUnfinishedInStep = nextItems.findIndex((item) => (
        item.stepId === current.stepId
        && !completedExecutionKeys.has(item.executionKey)
      ));
      if (firstUnfinishedInStep >= 0) return firstUnfinishedInStep;
    }

    const nextStep = nextItems.findIndex((item) => (
      item.stepIndex > currentStep.stepIndex
      && !completedExecutionKeys.has(item.executionKey)
    ));
    return nextStep;
  }

  if (currentStep) {
    return nextItems.findIndex((item) => (
      item.stepIndex > currentStep.stepIndex
      && !completedExecutionKeys.has(item.executionKey)
    ));
  }

  const previousFutureStepIds = new Set(previousItems
    .filter((item) => item.stepIndex > current.stepIndex)
    .map((item) => item.stepId));
  const retainedFutureIndex = nextItems.findIndex((item) => (
    previousFutureStepIds.has(item.stepId)
    && !completedExecutionKeys.has(item.executionKey)
  ));
  if (retainedFutureIndex >= 0) return retainedFutureIndex;

  return nextItems.findIndex((item) => (
    item.stepIndex >= current.stepIndex
    && !completedExecutionKeys.has(item.executionKey)
  ));
}

export function activeStateForSequenceItem(
  item: DailyReadingSequenceItem,
): DailyReadingActiveItemState {
  return {
    stepType: item.type,
    stepId: item.stepId,
    stepItemIndex: item.stepItemIndex,
    sentenceLanguage: item.type === 'sentence' ? item.sentenceLang ?? 'en' : null,
    word: item.wordRow?.word ?? null,
    wordIndex: item.wordIndex ?? -1,
  };
}

export function rateForSequenceItem(
  item: DailyReadingSequenceItem,
  settings: DailyReadingPlaybackSettings,
): number {
  return item.type === 'words' ? settings.wordRate : settings.sentenceRate;
}
