/**
 * Shared ECDICT offline-dictionary contract for both manager UIs.
 *
 * The SAME stardict.db is served by two ends:
 *   - pycore local: ui/dictionary/dictionary_status + dictionary_lookup
 *     (pycore/pyutils/translator/dictionary.py, relay-exposed per
 *     config/pycore_relay_contract.json)
 *   - laravel api:  /api/app_qy_v1/ecdict/status + /ecdict/lookup
 *     (app/Support/EcdictDictionary.php via PathMapper)
 *
 * Each app injects an EcdictLookupAdapter; EcdictLookupPanel renders either
 * end identically. A SQLite lock race between the two ends surfaces as
 * `busy: true` — callers pass results through withBusyRetry so the lookup
 * retries immediately (the backends already retry server-side first).
 */

/** Availability snapshot (normalized from either end). */
export interface EcdictStatusInfo {
  available: boolean;
  dbPath?: string;
  entries: number;
  wordnetAvailable?: boolean;
  busy?: boolean;
  error?: string;
}

/** Rich word entry (normalized; WordNet fields only exist via pycore). */
export interface EcdictEntryInfo {
  found: boolean;
  word: string;
  translation: string;
  definition: string;
  phonetic: string;
  pos: string;
  tags: string[];
  collins: number;
  oxford: boolean;
  bnc: number;
  frq: number;
  exchange: string;
  wordnetDefinition?: string;
  synonyms?: string[];
  targetTranslation?: string | null;
  source?: string;
  busy?: boolean;
  error?: string;
}

/** End-specific data source injected by the hosting app. */
export interface EcdictLookupAdapter {
  /** Short badge label, e.g. 'pycore local' or 'laravel api'. */
  sourceLabel: string;
  fetchStatus: () => Promise<EcdictStatusInfo>;
  fetchLookup: (word: string, target?: string) => Promise<EcdictEntryInfo>;
}

/**
 * Immediate client-side retry for the shared-database busy signal. The
 * backends already retry SQLITE_BUSY server-side; when the lock still
 * outlasts that, the API says busy=true and we retry once more here.
 */
export async function withBusyRetry<T extends { busy?: boolean }>(
  fn: () => Promise<T>,
  retries = 1,
  delayMs = 180,
): Promise<T> {
  let result = await fn();
  for (let attempt = 0; attempt < retries && result?.busy; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    result = await fn();
  }
  return result;
}
