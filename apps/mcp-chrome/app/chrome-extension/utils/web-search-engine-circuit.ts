import { STORAGE_KEYS } from '@/utils/storage-keys';
import type { WebSearchEngine } from '@/utils/web-search-core';

const DEFAULT_VERIFICATION_COOLDOWN_MS = 30 * 60 * 1000;

interface SearchEngineCircuit {
  blockedUntil: number;
  reason: string;
  updatedAt: number;
}

type SearchEngineCircuits = Partial<Record<WebSearchEngine, SearchEngineCircuit>>;

export interface SearchEngineAvailability {
  available: boolean;
  blockedUntil: number | null;
  reason: string;
}

async function loadCircuits(): Promise<SearchEngineCircuits> {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.WEB_SEARCH_ENGINE_CIRCUITS);
  const circuits = stored[STORAGE_KEYS.WEB_SEARCH_ENGINE_CIRCUITS];
  return circuits && typeof circuits === 'object' ? circuits as SearchEngineCircuits : {};
}

async function saveCircuits(circuits: SearchEngineCircuits): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.WEB_SEARCH_ENGINE_CIRCUITS]: circuits,
  });
}

export async function getSearchEngineAvailability(
  engine: WebSearchEngine,
): Promise<SearchEngineAvailability> {
  const circuits = await loadCircuits();
  const circuit = circuits[engine];
  const now = Date.now();

  if (!circuit) {
    return { available: true, blockedUntil: null, reason: '' };
  }
  if (circuit.blockedUntil > now) {
    return {
      available: false,
      blockedUntil: circuit.blockedUntil,
      reason: circuit.reason,
    };
  }

  delete circuits[engine];
  await saveCircuits(circuits);
  return { available: true, blockedUntil: null, reason: '' };
}

export async function blockSearchEngineForVerification(
  engine: WebSearchEngine,
  reason: string,
  cooldownMs = DEFAULT_VERIFICATION_COOLDOWN_MS,
): Promise<number> {
  const circuits = await loadCircuits();
  const now = Date.now();
  const blockedUntil = now + Math.max(1_000, cooldownMs);

  circuits[engine] = {
    blockedUntil,
    reason,
    updatedAt: now,
  };
  await saveCircuits(circuits);
  return blockedUntil;
}

export async function clearSearchEngineCircuit(engine: WebSearchEngine): Promise<void> {
  const circuits = await loadCircuits();
  if (!circuits[engine]) return;

  delete circuits[engine];
  await saveCircuits(circuits);
}
