import { useCallback } from 'react';
import { StorageManager } from '../../../core/persistence';
import { WordNewStorageKeys } from '../persistence/WordNewStorageKeys';

const KEY = WordNewStorageKeys.WORDNEW_DAILY_READING_SCROLL_OFFSETS;

export function useDailyReadingScrollOffset(): {
  getOffset: (articleId: string) => number;
  setOffset: (articleId: string, offset: number) => void;
} {
  const getOffset = useCallback((articleId: string): number => {
    try {
      const map = StorageManager.get<Record<string, number>>(KEY, {});
      return Number(map[articleId]) || 0;
    } catch {
      return 0;
    }
  }, []);

  const setOffset = useCallback((articleId: string, offset: number): void => {
    try {
      const map = StorageManager.get<Record<string, number>>(KEY, {});
      map[articleId] = offset;
      StorageManager.set(KEY, map);
    } catch {
      // Storage errors are non-fatal for scroll offset.
    }
  }, []);

  return { getOffset, setOffset };
}
