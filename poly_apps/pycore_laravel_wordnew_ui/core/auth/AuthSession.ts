import { StorageManager } from '../persistence';
import { AuthStorageKeys } from './AuthStorageKeys';

let activeToken: string | null = null;
const authSessionListeners = new Set<() => void>();

function notifyAuthSessionChanged(): void {
  authSessionListeners.forEach((listener) => listener());
}

function normalizeToken(token: string | null): string | null {
  if (!token) return null;
  const normalized = token.replace(/^Bearer\s+/i, '').trim();
  return normalized || null;
}

function persist(token: string | null): void {
  if (token) {
    StorageManager.set(AuthStorageKeys.TOKEN, token);
    return;
  }
  StorageManager.remove(AuthStorageKeys.TOKEN);
}

/** Shared authentication state only; each app keeps its own network transport. */
export function getAuthToken(): string | null {
  if (activeToken) return activeToken;
  const stored = normalizeToken(
    StorageManager.get<string | null>(AuthStorageKeys.TOKEN, null),
  );
  if (stored) {
    activeToken = stored;
    persist(stored);
  }
  return activeToken;
}

export function setAuthToken(token: string | null): string | null {
  const previousToken = activeToken;
  activeToken = normalizeToken(token);
  persist(activeToken);
  if (activeToken !== previousToken) notifyAuthSessionChanged();
  return activeToken;
}

export function getAuthHeader(): string | null {
  const token = getAuthToken();
  return token ? `Bearer ${token}` : null;
}

export function subscribeAuthSession(listener: () => void): () => void {
  authSessionListeners.add(listener);
  return () => authSessionListeners.delete(listener);
}
