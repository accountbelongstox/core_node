import { WfNewApiPaths } from '../api/WfNewApiPaths';
import { wfNewEndpoints } from '../api/WfNewEndpoints';
import { authedPostJSON, authedQueueablePostJSON } from '../api/WfNewApiTransport';
import { normalizeEnglishWord } from './WordNewCommonWordFilter';
import { wordNewQueueCenter } from './WordNewQueueCenter';
import { StorageManager } from '../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../persistence/WordNewStorageKeys';

export interface WordNewSentenceWordRow {
  word: string;
  audio_url?: string | null;
  image_url?: string | null;
  audio_status?: string;
  image_status?: string;
  translations?: string[];
  explanation?: string | null;
  phonetic?: string | null;
  us_phonetic?: string | null;
  uk_phonetic?: string | null;
  played: boolean;
  play_count: number;
  in_target_group: boolean;
  added_to_target_group: boolean;
  in_default_group: boolean;
  added_to_default_group: boolean;
  eligible_for_new_only: boolean;
}

export function sentenceWordTranslations(row: WordNewSentenceWordRow): string[] {
  return row.translations?.filter((value) => typeof value === 'string' && value.trim() !== '') ?? [];
}

export function sentenceWordTranslationText(row: WordNewSentenceWordRow): string | null {
  return sentenceWordTranslations(row).join(' / ') || null;
}

export function sentenceWordMeaning(row: WordNewSentenceWordRow): string | null {
  return sentenceWordTranslationText(row) || row.explanation?.trim() || null;
}

export const sentenceWordKey = normalizeEnglishWord;

export function uniqueSentenceWordRows(rows: WordNewSentenceWordRow[]): WordNewSentenceWordRow[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = sentenceWordKey(row.word);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Distinct words this session newly linked to the target group. */
export function countSentenceWordsAddedToTargetGroup(rows: WordNewSentenceWordRow[]): number {
  return new Set(rows
    .filter((row) => row.added_to_target_group)
    .map((row) => sentenceWordKey(row.word))
    .filter(Boolean)).size;
}

export function mergeSentenceWordRuntimeState(
  fresh: WordNewSentenceWordRow,
  current: WordNewSentenceWordRow | undefined,
): WordNewSentenceWordRow {
  if (!current) return fresh;
  return {
    ...fresh,
    played: fresh.played || current.played,
    play_count: Math.max(fresh.play_count, current.play_count),
    in_target_group: fresh.in_target_group || current.in_target_group,
    added_to_target_group: fresh.added_to_target_group || current.added_to_target_group,
    in_default_group: fresh.in_default_group || current.in_default_group,
    added_to_default_group: fresh.added_to_default_group || current.added_to_default_group,
  };
}

function clientKey(): string {
  const existing = StorageManager.get<string | null>(StorageKeys.WORDNEW_SENTENCE_WORD_CLIENT_KEY, null);
  if (existing) return existing;
  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `wfnew-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  StorageManager.set(StorageKeys.WORDNEW_SENTENCE_WORD_CLIENT_KEY, generated);
  return generated;
}

function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : wfNewEndpoints.buildUrl(url);
}

async function post(path: string, body: Record<string, unknown>): Promise<any> {
  return authedPostJSON(path, body);
}

function uniqueWords(words: string[]): string[] {
  return [...new Map(words.map((word) => [normalizeEnglishWord(word), word])).values()]
    .filter((word) => word.trim() !== '');
}

export interface WordNewSentenceWordTableOptions {
  prioritizeImages?: boolean;
}

function prioritizeMissing(
  rows: WordNewSentenceWordRow[],
  language: string,
  targetLanguage: string,
  options: WordNewSentenceWordTableOptions,
): void {
  const translationWords = uniqueWords(rows
    .filter((row) => !Array.isArray(row.translations) || row.translations.length === 0)
    .map((row) => row.word));
  const audioWords = uniqueWords(rows
    .filter((row) => !row.audio_url || row.audio_status !== 'ready')
    .map((row) => row.word));
  const imageItems = options.prioritizeImages === false
    ? []
    : rows
      .filter((row) => Array.isArray(row.translations) && row.translations.length > 0
        && (!row.image_url || row.image_status !== 'ready'))
      .map((row) => ({ word: row.word, language }));
  const requests: Promise<unknown>[] = [];
  if (translationWords.length > 0) {
    requests.push(wordNewQueueCenter.prioritizeTranslations(translationWords, language, targetLanguage));
  }
  if (audioWords.length > 0) {
    requests.push(wordNewQueueCenter.moveWordsToHead(audioWords, language));
  }
  if (imageItems.length > 0) {
    requests.push(wordNewQueueCenter.prioritizeWordImages(imageItems));
  }
  if (requests.length > 0) void Promise.allSettled(requests);
}

export async function getSentenceWordTable(
  sentence: string,
  language = 'en',
  targetLanguage = 'zh',
  maxReadCount = 0,
  groupId: string | null = null,
  options: WordNewSentenceWordTableOptions = {},
): Promise<WordNewSentenceWordRow[]> {
  const payload = await post(WfNewApiPaths.sentenceWords, {
    sentence,
    language,
    target_language: targetLanguage,
    client_key: clientKey(),
    max_read_count: Math.max(0, Math.min(100, Number(maxReadCount) || 0)),
    ...(groupId ? { group_id: groupId } : {}),
  });
  const rows = Array.isArray(payload?.data?.words) ? payload.data.words : [];
  const normalized = rows.map((row: WordNewSentenceWordRow) => {
    const inTargetGroup = row.in_target_group ?? row.in_default_group ?? false;
    const addedToTargetGroup = row.added_to_target_group ?? row.added_to_default_group ?? false;
    return {
      ...row,
      audio_url: absoluteUrl(row.audio_url),
      in_target_group: inTargetGroup,
      added_to_target_group: addedToTargetGroup,
      in_default_group: inTargetGroup,
      added_to_default_group: addedToTargetGroup,
    };
  });
  prioritizeMissing(normalized, language, targetLanguage, options);
  return normalized;
}

export async function markSentenceWordsPlayed(
  words: string[],
  language = 'en',
  groupId: string | null = null,
): Promise<void> {
  if (words.length === 0) return;
  await authedQueueablePostJSON(WfNewApiPaths.sentenceWordsPlayed, {
    words,
    language,
    client_key: clientKey(),
    ...(groupId ? { group_id: groupId } : {}),
  });
}
