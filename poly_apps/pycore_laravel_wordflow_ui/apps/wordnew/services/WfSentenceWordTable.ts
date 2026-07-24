import { WfNewApiPaths } from '../api/WfNewApiPaths';
import { wfNewEndpoints } from '../api/WfNewEndpoints';
import { postJSON } from '../api/WfNewApiTransport';
import { pycoreApi } from '../../../core/api-libs/pycore';

const CLIENT_KEY_STORAGE = 'wfnew.sentenceWords.clientKey';

export interface WfSentenceWordRow {
  word: string;
  audio_url?: string | null;
  image_url?: string | null;
  audio_status?: string;
  image_status?: string;
  translations?: unknown[];
  played: boolean;
  play_count: number;
}

function clientKey(): string {
  const existing = localStorage.getItem(CLIENT_KEY_STORAGE);
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `wfnew-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(CLIENT_KEY_STORAGE, generated);
  return generated;
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

async function post(path: string, body: Record<string, unknown>): Promise<any> {
  return postJSON(path, body);
}

function prioritizeMissing(
  rows: WfSentenceWordRow[],
  language: string,
  targetLanguage: string,
): void {
  const translationWords = rows
    .filter((row) => !Array.isArray(row.translations) || row.translations.length === 0)
    .map((row) => row.word);
  const audioWords = rows
    .filter((row) => !row.audio_url || row.audio_status !== 'ready')
    .map((row) => row.word);
  const imageItems = rows
    .filter((row) => Array.isArray(row.translations) && row.translations.length > 0
      && (!row.image_url || row.image_status !== 'ready'))
    .map((row) => ({ word: row.word, language }));
  const requests: Promise<unknown>[] = [];
  if (translationWords.length > 0) {
    requests.push(pycoreApi.stackQueue(translationWords, language, targetLanguage, 200));
  }
  if (audioWords.length > 0) {
    requests.push(pycoreApi.prioritizeWordAudioWords(audioWords, language));
  }
  if (imageItems.length > 0) {
    requests.push(pycoreApi.prioritizeWordImages(imageItems));
  }
  if (requests.length > 0) void Promise.allSettled(requests);
}

export async function getSentenceWordTable(
  sentence: string,
  language = 'en',
  targetLanguage = 'zh',
): Promise<WfSentenceWordRow[]> {
  const payload = await post(WfNewApiPaths.sentenceWords, {
    sentence,
    language,
    target_language: targetLanguage,
    client_key: clientKey(),
  });
  const rows = Array.isArray(payload?.data?.words) ? payload.data.words : [];
  const normalized = rows.map((row: WfSentenceWordRow) => ({
    ...row,
    audio_url: absoluteUrl(row.audio_url),
  }));
  prioritizeMissing(normalized, language, targetLanguage);
  return normalized;
}

export async function markSentenceWordsPlayed(words: string[], language = 'en'): Promise<void> {
  if (words.length === 0) return;
  await post(WfNewApiPaths.sentenceWordsPlayed, {
    words,
    language,
    client_key: clientKey(),
  });
}
