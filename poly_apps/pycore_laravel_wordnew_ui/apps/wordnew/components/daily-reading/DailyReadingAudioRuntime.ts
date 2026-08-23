import type { DailyReadingRow } from './dailyReadingApi';
import { wfNewEndpoints } from '../../api/WfNewEndpoints';
import { ensureAudio, preloadAudioTracked } from '../../runtime-store/WfNewAudioCache';
import {
  sentenceWordTranslations,
  uniqueSentenceWordRows,
  type WordNewSentenceWordRow,
} from '../../services/WordNewSentenceWordTable';
import type { DailyReadingResourceStatus } from './DailyReadingPlaybackModel';

interface DailyReadingPreloadCallbacks {
  onArticleReady: () => void;
  onWordsReady: (count: number) => void;
}

export function absoluteDailyReadingAudio(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

export function dailyReadingSentenceAudioUrl(row: DailyReadingRow): string | null {
  return row.audio_ready ? absoluteDailyReadingAudio(row.audio_url) : null;
}

export function resetDailyReadingAudio(audio: HTMLAudioElement | null): void {
  if (!audio) return;
  audio.onended = null;
  audio.onerror = null;
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

export function normalizeDailyReadingWordAudio(
  rows: WordNewSentenceWordRow[],
): WordNewSentenceWordRow[] {
  return rows.map((word) => {
    const audioUrl = absoluteDailyReadingAudio(word.audio_url);
    return audioUrl && audioUrl !== word.audio_url ? { ...word, audio_url: audioUrl } : word;
  });
}

export function preloadDailyReadingResources(
  sentenceUrl: string,
  words: WordNewSentenceWordRow[],
  callbacks: DailyReadingPreloadCallbacks,
): DailyReadingResourceStatus {
  const uniqueWords = uniqueSentenceWordRows(words);
  const wordsWithAudio = uniqueWords.filter((word) => !!word.audio_url);
  const wordCountByAudioUrl = new Map<string, number>();
  for (const word of wordsWithAudio) {
    const url = word.audio_url as string;
    wordCountByAudioUrl.set(url, (wordCountByAudioUrl.get(url) ?? 0) + 1);
  }

  void ensureAudio(sentenceUrl)
    .then((localUrl) => {
      if (localUrl) callbacks.onArticleReady();
    })
    .catch(() => undefined);
  void preloadAudioTracked(wordCountByAudioUrl.keys(), (url, ready) => {
    if (ready) callbacks.onWordsReady(wordCountByAudioUrl.get(url) ?? 1);
  }).catch(() => undefined);

  return {
    articleAudioReady: 0,
    articleAudioTotal: 1,
    wordAudioReady: 0,
    wordAudioTotal: uniqueWords.length,
    translationsReady: uniqueWords.filter((word) => sentenceWordTranslations(word).length > 0).length,
    translationsTotal: uniqueWords.length,
  };
}
