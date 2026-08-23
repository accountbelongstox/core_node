import { useSyncExternalStore } from 'react';
import { getAuthToken, subscribeAuthSession } from './AuthSession';

const getSessionSnapshot = (): boolean => getAuthToken() !== null;
const getServerSessionSnapshot = (): boolean => false;

export function useAuthSession(): boolean {
  return useSyncExternalStore(
    subscribeAuthSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
}
