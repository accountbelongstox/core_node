/**
 * Stable browser client identity for guest settings roaming.
 *
 * Primary: FingerprintJS open-source visitorId (hashed browser signals; survives
 * localStorage clears on the same browser profile — see fingerprintjs/fingerprintjs).
 * Fallback: persisted local id when fingerprinting is unavailable.
 *
 * Fingerprint docs recommend caching in sessionStorage with short TTL for paid
 * Identification; for our guest-settings use case we cache the visitorId in
 * sessionStorage for the tab session only.
 */
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { StorageKeys, StorageManager } from '../../../core/persistence';

const SESSION_FP_KEY = 'wf_client_fp_visitor';
const LOCAL_FALLBACK_KEY = 'wf_client_local_id';

let identityPromise: Promise<string> | null = null;

function readSessionCache(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(SESSION_FP_KEY);
  } catch {
    return null;
  }
}

function writeSessionCache(id: string): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(SESSION_FP_KEY, id);
  } catch {
    /* ignore */
  }
}

function localFallbackId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const existing = window.localStorage.getItem(LOCAL_FALLBACK_KEY);
      if (existing) return existing;
      const id = `local-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
      window.localStorage.setItem(LOCAL_FALLBACK_KEY, id);
      return id;
    } catch {
      /* fall through */
    }
  }
  const stored = StorageManager.get<string>(StorageKeys.WORDNEW_CLIENT_ID);
  if (stored) return stored;
  const id = `local-${Date.now().toString(36)}`;
  StorageManager.set(StorageKeys.WORDNEW_CLIENT_ID, id);
  return id;
}

async function computeFingerprintVisitorId(): Promise<string> {
  const agent = await FingerprintJS.load();
  const result = await agent.get();
  return result.visitorId;
}

/** Resolve the roaming client key (`fp-…` or `local-…`). */
export async function getWfClientKey(): Promise<string> {
  if (identityPromise) return identityPromise;

  identityPromise = (async () => {
    const cached = readSessionCache();
    if (cached) return cached;

    try {
      const visitorId = await computeFingerprintVisitorId();
      const key = `fp-${visitorId}`;
      writeSessionCache(key);
      return key;
    } catch (error) {
      console.warn('[WfClientIdentity] Fingerprint unavailable, using local fallback.', error);
      const key = `local-${localFallbackId()}`;
      writeSessionCache(key);
      return key;
    }
  })();

  return identityPromise;
}
