import { StorageManager } from '../../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

const MAX_GUEST_READS = 2000;

/** Read marks of a signed-out device; pushed to Laravel and cleared after sign-in. */
function load(): string[] {
  try {
    const stored = StorageManager.get<unknown>(StorageKeys.WORDNEW_DAILY_READING_GUEST_READS, []);
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function save(ids: string[]): void {
  try {
    StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_GUEST_READS, ids.slice(-MAX_GUEST_READS));
  } catch {
    // Storage unavailable: read marks stay in memory for this session only.
  }
}

export function guestReadIds(): Set<string> {
  return new Set(load());
}

export function setGuestRead(articleId: string, read: boolean): void {
  const ids = load().filter((id) => id !== articleId);
  if (read) ids.push(articleId);
  save(ids);
}

export function clearGuestReads(): void {
  save([]);
}
