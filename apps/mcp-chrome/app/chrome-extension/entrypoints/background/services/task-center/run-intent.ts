/**
 * Task Center Run-Intent — the SINGLE source of truth for whether the user
 * wants background assist running and which capabilities are active.
 *
 * Persisted in chrome.storage.local under `tc_run_intent`. Unlike the Bing
 * worker's own session-scoped runtime (wiped on browser close), this is the
 * authoritative allowlist the popup checkboxes write and the background gates
 * read — so a watchdog / SW-revival can never resurrect a lane the user did not
 * ask for. Every mutation goes through here; nothing else writes this key.
 */

import type { CapabilityKey } from '@/utils/task-capabilities';
import { STORAGE_KEYS } from '@/utils/storage-keys';

/** Persisted shape. Absent => treated as { running:false, activeCapabilities:[] }. */
export interface RunIntent {
  running: boolean;
  activeCapabilities: CapabilityKey[];
}

const STORAGE_KEY = STORAGE_KEYS.TC_RUN_INTENT;

const DEFAULT_INTENT: RunIntent = { running: false, activeCapabilities: [] };

/** Read the current run-intent, defaulting when absent or malformed. */
export async function getRunIntent(): Promise<RunIntent> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    const raw = result?.[STORAGE_KEY];
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_INTENT };
    const running = raw.running === true;
    const activeCapabilities = Array.isArray(raw.activeCapabilities)
      ? (raw.activeCapabilities.filter((k: unknown): k is CapabilityKey => typeof k === 'string') as CapabilityKey[])
      : [];
    return { running, activeCapabilities };
  } catch {
    return { ...DEFAULT_INTENT };
  }
}

/** Persist the full run-intent (deduped capability list). */
export async function setRunIntent(intent: RunIntent): Promise<void> {
  const seen = new Set<CapabilityKey>();
  const activeCapabilities: CapabilityKey[] = [];
  for (const key of intent.activeCapabilities || []) {
    if (!seen.has(key)) {
      seen.add(key);
      activeCapabilities.push(key);
    }
  }
  const payload: RunIntent = { running: intent.running === true, activeCapabilities };
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: payload });
  } catch {
    /* best-effort */
  }
}

/** Reset run-intent to the not-running default (called on Stop). */
export async function clearRunIntent(): Promise<void> {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: { ...DEFAULT_INTENT } });
  } catch {
    /* best-effort */
  }
}

/** True only when assist is running AND the given capability is active. */
export async function isCapabilityActive(key: CapabilityKey): Promise<boolean> {
  const intent = await getRunIntent();
  return intent.running && intent.activeCapabilities.includes(key);
}
