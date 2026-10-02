/* Wf custom-word store - the forged words of the AI Lab, kept on this device (no backend involved).
 * Persisted through StorageManager; React reads it through `useWordNewCustomWords`. */

import { useSyncExternalStore } from 'react';
import { ChangeSignal } from '../../../core/events/ChangeSignal';
import { StorageManager } from '../../../core/persistence';
import type { Word } from '../api';
import { WordNewStorageKeys as StorageKeys } from '../persistence/WordNewStorageKeys';

const EMPTY_WORDS: Word[] = [];

class WordNewCustomWordsClass {
  private words: Word[] = this.restore();
  private readonly changes = new ChangeSignal();

  readonly subscribe = this.changes.subscribe;

  get = (): Word[] => this.words;

  add(word: Word): void {
    this.commit([word, ...this.words.filter((entry) => entry.id !== word.id)]);
  }

  remove(id: string): void {
    this.commit(this.words.filter((entry) => entry.id !== id));
  }

  private restore(): Word[] {
    try {
      const stored = StorageManager.get<unknown>(StorageKeys.WORDNEW_CUSTOM_WORDS, null);
      return Array.isArray(stored) ? (stored as Word[]) : EMPTY_WORDS;
    } catch {
      return EMPTY_WORDS;
    }
  }

  private commit(next: Word[]): void {
    this.words = next;
    try {
      StorageManager.set(StorageKeys.WORDNEW_CUSTOM_WORDS, next);
    } catch {
      /* storage unavailable: the list stays for this session */
    }
    this.changes.emit();
  }
}

export const wordNewCustomWords = new WordNewCustomWordsClass();

export function useWordNewCustomWords(): Word[] {
  return useSyncExternalStore(wordNewCustomWords.subscribe, wordNewCustomWords.get, () => EMPTY_WORDS);
}
