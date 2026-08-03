/**
 * WfNewEndpointStore — /wordnew view over the ONE shared Laravel endpoint
 * persistence (core StorageKeys + the core custom-endpoint registry). The
 * legacy wordnew-owned keys (WORDNEW_API_PREFS and the five scattered keys
 * before it) are migrated into core exactly once, then removed; every getter
 * here reads the core state directly.
 */
import { StorageKeys, StorageManager } from '../../../core/persistence';
import { WordNewStorageKeys } from '../persistence/WordNewStorageKeys';
import { CURRENT_URL_TYPE } from '../../../core/api-libs/base/endpointIdentity';
import {
  addCustomEndpoint,
  getCustomEndpoints,
} from '../../../config/api-endpoints';
import type { WfNewEndpoint } from './WfNewApiTypes';

export { CURRENT_URL_TYPE } from '../../../core/api-libs/base/endpointIdentity';

/** Legacy wordnew preference object shape (pre-core storage layout). */
export interface WfNewEndpointPrefs {
  customEndpoints: WfNewEndpoint[];
  selectedType: string | null;
  autoType: string | null;
  currentType: string | null;
  recheckIntervalMs: number | null;
}

const LEGACY_TYPE_REMAP: Record<string, string> = {
  // Same target (43.163.112.77:9000) already exists in the core registry.
  'remote-primary': 'remote-cloud-43',
  // Legacy id 'current-origin' is now the 'current-url' selection type.
  'current-origin': CURRENT_URL_TYPE,
};

function remapType(type: string | null): string | null {
  if (!type) return null;
  return LEGACY_TYPE_REMAP[type] ?? type;
}

class WfNewEndpointStore {
  private migrated = false;

  // ---- custom endpoints (core registry) ----

  get customEndpoints(): WfNewEndpoint[] {
    return getCustomEndpoints().map((e) => ({ ...e, kind: 'custom' as const, custom: true }));
  }

  /** Custom endpoints are managed one-by-one through the core registry. */
  setCustomEndpoints(list: WfNewEndpoint[]): void {
    for (const ep of list) {
      addCustomEndpoint({ url: ep.url, protocol: ep.protocol, port: ep.port, description: ep.description });
    }
  }

  // ---- selection types (core keys) ----

  get selectedType(): string | null {
    return StorageManager.getRaw(StorageKeys.LARAVEL_API_USER_MODIFIED_ENDPOINT);
  }
  get autoType(): string | null {
    return StorageManager.getRaw(StorageKeys.LARAVEL_API_AUTO_DETECTED_ENDPOINT);
  }
  get currentType(): string | null {
    return StorageManager.getRaw(StorageKeys.LARAVEL_API_CURRENT_ENDPOINT);
  }

  /** Pin a user-chosen TYPE (also records it as the current type). */
  setSelected(type: string): void {
    StorageManager.setRaw(StorageKeys.LARAVEL_API_USER_MODIFIED_ENDPOINT, type);
    StorageManager.setRaw(StorageKeys.LARAVEL_API_CURRENT_ENDPOINT, type);
  }

  /** Record an availability-auto-picked TYPE (also the current type). */
  setAuto(type: string): void {
    StorageManager.setRaw(StorageKeys.LARAVEL_API_AUTO_DETECTED_ENDPOINT, type);
    StorageManager.setRaw(StorageKeys.LARAVEL_API_CURRENT_ENDPOINT, type);
  }

  /** Forget every persisted reference to a TYPE so detection re-picks. */
  forgetType(type: string): void {
    if (this.selectedType === type) StorageManager.remove(StorageKeys.LARAVEL_API_USER_MODIFIED_ENDPOINT);
    if (this.autoType === type) StorageManager.remove(StorageKeys.LARAVEL_API_AUTO_DETECTED_ENDPOINT);
    if (this.currentType === type) StorageManager.remove(StorageKeys.LARAVEL_API_CURRENT_ENDPOINT);
  }

  // ---- recheck interval (core key) ----

  get recheckIntervalMs(): number | null {
    const raw = StorageManager.getRaw(StorageKeys.LARAVEL_API_RECHECK_INTERVAL_MS);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  setRecheckIntervalMs(ms: number): void {
    StorageManager.setRaw(StorageKeys.LARAVEL_API_RECHECK_INTERVAL_MS, String(ms));
  }

  // ---- one-time migration from the wordnew-owned layout into core ----

  migrateToCore(): void {
    if (this.migrated) return;
    this.migrated = true;

    const prefs = StorageManager.get<WfNewEndpointPrefs | null>(WordNewStorageKeys.WORDNEW_API_PREFS, null);
    const legacyCustom = StorageManager.get<WfNewEndpoint[]>(WordNewStorageKeys.WORDNEW_API_CUSTOM_ENDPOINTS, []);
    const legacySelected = StorageManager.get<string | null>(WordNewStorageKeys.WORDNEW_API_USER_ENDPOINT, null);
    const legacyAuto = StorageManager.get<string | null>(WordNewStorageKeys.WORDNEW_API_AUTO_ENDPOINT, null);
    const legacyCurrent = StorageManager.get<string | null>(WordNewStorageKeys.WORDNEW_API_CURRENT, null);
    const legacyRecheck = StorageManager.get<number | null>(WordNewStorageKeys.WORDNEW_API_RECHECK_INTERVAL_MS, null);

    const custom = [
      ...(prefs && Array.isArray(prefs.customEndpoints) ? prefs.customEndpoints : []),
      ...(Array.isArray(legacyCustom) ? legacyCustom : []),
    ];
    const selected = remapType(prefs?.selectedType ?? legacySelected);
    const auto = remapType(prefs?.autoType ?? legacyAuto);
    const current = remapType(prefs?.currentType ?? legacyCurrent);
    const recheck = prefs?.recheckIntervalMs ?? legacyRecheck;

    for (const ep of custom) {
      if (!ep || typeof ep.url !== 'string') continue;
      addCustomEndpoint({ url: ep.url, protocol: ep.protocol, port: ep.port, description: ep.description });
    }
    if (selected && !this.selectedType) this.setSelected(selected);
    if (auto && !this.autoType) this.setAuto(auto);
    if (current && !this.currentType) {
      StorageManager.setRaw(StorageKeys.LARAVEL_API_CURRENT_ENDPOINT, current);
    }
    if (typeof recheck === 'number' && this.recheckIntervalMs === null) {
      this.setRecheckIntervalMs(recheck);
    }

    for (const key of [
      WordNewStorageKeys.WORDNEW_API_PREFS,
      WordNewStorageKeys.WORDNEW_API_CUSTOM_ENDPOINTS,
      WordNewStorageKeys.WORDNEW_API_USER_ENDPOINT,
      WordNewStorageKeys.WORDNEW_API_AUTO_ENDPOINT,
      WordNewStorageKeys.WORDNEW_API_CURRENT,
      WordNewStorageKeys.WORDNEW_API_RECHECK_INTERVAL_MS,
    ] as const) {
      StorageManager.remove(key);
    }
  }
}

/** Global singleton — the /wordnew view over the shared endpoint persistence. */
export const wfNewEndpointStore = new WfNewEndpointStore();
