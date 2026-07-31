/**
 * WfNewEndpointStore — persisted settings for the /wordnew backend endpoint
 * manager. A SUBCLASS of the shared `PersistedStore` (core/persistence): all
 * endpoint settings live in ONE consolidated localStorage key instead of the
 * five scattered keys used before.
 *
 * Selection is stored as a TYPE (an endpoint id token), never a frozen URL —
 * `selectedType: 'current-url'` re-resolves to the live page origin on every
 * load (see WfNewEndpointKind). The concrete endpoint is resolved from the type
 * by WfNewEndpointManager.getEndpointById at runtime.
 */
import { PersistedStore, StorageManager } from '../../../core/persistence';
import { WordNewStorageKeys as StorageKeys } from '../persistence/WordNewStorageKeys';
import { CURRENT_URL_TYPE } from '../../../core/api-libs/base/endpointIdentity';
import type { WfNewEndpoint } from './WfNewApiTypes';

export { CURRENT_URL_TYPE } from '../../../core/api-libs/base/endpointIdentity';

/** Everything the endpoint manager persists, in one object under one key. */
export interface WfNewEndpointPrefs {
  /** User-added endpoints (full records). */
  customEndpoints: WfNewEndpoint[];
  /** User-pinned selection, stored as an endpoint TYPE/id (e.g. 'current-url'). */
  selectedType: string | null;
  /** Last availability-auto-picked TYPE/id. */
  autoType: string | null;
  /** Last applied TYPE/id (record of what is in use). */
  currentType: string | null;
  /** Offline-recheck cadence override (ms); null = use the manager default. */
  recheckIntervalMs: number | null;
}

const makeDefaults = (): WfNewEndpointPrefs => ({
  customEndpoints: [],
  selectedType: null,
  autoType: null,
  currentType: null,
  recheckIntervalMs: null,
});

class WfNewEndpointStore extends PersistedStore<WfNewEndpointPrefs> {
  constructor() {
    super(StorageKeys.WORDNEW_API_PREFS, makeDefaults);
    this.migrateLegacyKeys();
  }

  // ---- custom endpoints ----

  /** Stored custom endpoints (each re-tagged custom + kind for safety). */
  get customEndpoints(): WfNewEndpoint[] {
    const list = this.get('customEndpoints');
    return Array.isArray(list) ? list.map((e) => ({ ...e, kind: 'custom' as const, custom: true })) : [];
  }

  setCustomEndpoints(list: WfNewEndpoint[]): void {
    this.patch({ customEndpoints: list });
  }

  // ---- selection types ----

  get selectedType(): string | null { return this.get('selectedType'); }
  get autoType(): string | null { return this.get('autoType'); }
  get currentType(): string | null { return this.get('currentType'); }

  /** Pin a user-chosen TYPE (also records it as the current type). */
  setSelected(type: string): void {
    this.patch({ selectedType: type, currentType: type });
  }

  /** Record an availability-auto-picked TYPE (also the current type). */
  setAuto(type: string): void {
    this.patch({ autoType: type, currentType: type });
  }

  /** Forget every persisted reference to a TYPE so detection re-picks. */
  forgetType(type: string): void {
    const updates: Partial<WfNewEndpointPrefs> = {};
    if (this.get('selectedType') === type) updates.selectedType = null;
    if (this.get('autoType') === type) updates.autoType = null;
    if (this.get('currentType') === type) updates.currentType = null;
    if (Object.keys(updates).length) this.patch(updates);
  }

  // ---- recheck interval ----

  get recheckIntervalMs(): number | null { return this.get('recheckIntervalMs'); }
  setRecheckIntervalMs(ms: number): void { this.patch({ recheckIntervalMs: ms }); }

  // ---- one-time migration from the legacy five-key layout ----

  private migrateLegacyKeys(): void {
    if (StorageManager.has(StorageKeys.WORDNEW_API_PREFS)) return;

    const custom = StorageManager.get<WfNewEndpoint[]>(StorageKeys.WORDNEW_API_CUSTOM_ENDPOINTS, []);
    const selected = StorageManager.get<string | null>(StorageKeys.WORDNEW_API_USER_ENDPOINT, null);
    const auto = StorageManager.get<string | null>(StorageKeys.WORDNEW_API_AUTO_ENDPOINT, null);
    const current = StorageManager.get<string | null>(StorageKeys.WORDNEW_API_CURRENT, null);
    const recheck = StorageManager.get<number | null>(StorageKeys.WORDNEW_API_RECHECK_INTERVAL_MS, null);

    const hasAny =
      (Array.isArray(custom) && custom.length > 0) ||
      !!selected || !!auto || !!current || typeof recheck === 'number';
    if (!hasAny) return;

    // Legacy id 'current-origin' is now the 'current-url' selection type.
    const remap = (t: string | null) => (t === 'current-origin' ? CURRENT_URL_TYPE : t);

    this.patch({
      customEndpoints: Array.isArray(custom) ? custom : [],
      selectedType: remap(selected),
      autoType: remap(auto),
      currentType: remap(current),
      recheckIntervalMs: typeof recheck === 'number' ? recheck : null,
    });

    for (const key of [
      StorageKeys.WORDNEW_API_CUSTOM_ENDPOINTS,
      StorageKeys.WORDNEW_API_USER_ENDPOINT,
      StorageKeys.WORDNEW_API_AUTO_ENDPOINT,
      StorageKeys.WORDNEW_API_CURRENT,
      StorageKeys.WORDNEW_API_RECHECK_INTERVAL_MS,
    ] as const) {
      StorageManager.remove(key);
    }
  }
}

/** Global singleton — the one persisted endpoint-settings store for /wordnew. */
export const wfNewEndpointStore = new WfNewEndpointStore();
