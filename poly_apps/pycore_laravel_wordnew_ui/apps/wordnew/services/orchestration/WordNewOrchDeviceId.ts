/**
 * This device's id for its orchestration records: random, generated once and kept (a browser
 * fingerprint can change between sessions; this does not). `orchClientDeviceId` is the same id in the
 * short form the server's window and telemetry keys carry (contract `book_plan.device_id_max_chars`).
 */
import { StorageManager } from '../../../../core/persistence';
import { AUDIO_ORCH_BOOK_PLAN } from '../../../../core/contracts/AudioOrchestrationContract';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';

const DEVICE_ID_MAX = 64;
/** Prefix of a stable device id (a fingerprint id has another). */
export const STABLE_DEVICE_PREFIX = 'd-';

export function newOrchRandomId(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}${random}`.slice(0, DEVICE_ID_MAX);
}

export function orchDeviceId(): string {
  const stored = StorageManager.get<string>(StorageKeys.WORDNEW_ORCH_DEVICE_ID, '');
  if (stored) return stored;
  const created = newOrchRandomId(STABLE_DEVICE_PREFIX);
  StorageManager.set(StorageKeys.WORDNEW_ORCH_DEVICE_ID, created);
  return created;
}

/** The device id as the server keys windows and reports by it: no prefix or dashes, at most `device_id_max_chars`. */
export function orchClientDeviceId(): string {
  return orchDeviceId().replace(STABLE_DEVICE_PREFIX, '').replace(/-/g, '').slice(0, AUDIO_ORCH_BOOK_PLAN.deviceIdMaxChars);
}
