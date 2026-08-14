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
import { StorageManager } from '../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../persistence/WordNewStorageKeys';

let identityPromise: Promise<string> | null = null;

function readSessionCache(): string | null {
  try {
    return StorageManager.getSession<string | null>(StorageKeys.WORDNEW_FINGERPRINT_VISITOR, null);
  } catch {
    return null;
  }
}

function writeSessionCache(id: string): void {
  try {
    StorageManager.setSession(StorageKeys.WORDNEW_FINGERPRINT_VISITOR, id);
  } catch {
    /* ignore */
  }
}

function localFallbackId(): string {
  const existing = StorageManager.get<string | null>(StorageKeys.WORDNEW_CLIENT_ID, null);
  if (existing) return existing;
  const id = `local-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
  StorageManager.set(StorageKeys.WORDNEW_CLIENT_ID, id);
  return id;
}

async function computeFingerprintVisitorId(): Promise<string> {
  const agent = await FingerprintJS.load();
  const result = await agent.get();
  return result.visitorId;
}

/** Resolve the roaming client key (`fp-…` or `local-…`). */
export async function getWordNewClientKey(): Promise<string> {
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
      console.warn('[WordNewClientIdentity] Fingerprint unavailable, using local fallback.', error);
      const key = localFallbackId();
      writeSessionCache(key);
      return key;
    }
  })();

  return identityPromise;
}
