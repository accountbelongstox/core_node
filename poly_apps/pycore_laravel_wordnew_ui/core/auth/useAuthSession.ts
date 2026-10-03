import { useSyncExternalStore } from 'react';
import {
  getAuthSnapshot,
  getAuthToken,
  getServerAuthSnapshot,
  subscribeAuthStore,
  type AuthSnapshot,
} from './AuthSession';

const getServerSessionSnapshot = (): boolean => false;

/** True while the API (default: the active one) holds a bearer token. */
export function useAuthSession(endpoint?: string | null): boolean {
  return useSyncExternalStore(
    subscribeAuthStore,
    () => getAuthToken(endpoint) !== null,
    getServerSessionSnapshot,
  );
}

/** Login state and user of one Laravel API (default: the active one); re-renders on every change. */
export function useAuthSnapshot(endpoint?: string | null): AuthSnapshot {
  return useSyncExternalStore(
    subscribeAuthStore,
    () => getAuthSnapshot(endpoint),
    getServerAuthSnapshot,
  );
}
