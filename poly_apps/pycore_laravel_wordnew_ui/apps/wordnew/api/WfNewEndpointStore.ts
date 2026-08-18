/**
 * WfNewEndpointStore — /wordnew view over the ONE shared Laravel endpoint
 * persistence (Laravel integration keys + the core custom-endpoint registry).
 * Every getter here reads the core state directly.
 */
import { StorageManager } from '../../../core/persistence';
import { LaravelStorageKeys as StorageKeys } from '../../../core/integrations/laravel/LaravelStorageKeys';
import { CURRENT_URL_TYPE } from '../../../core/network/api-client/endpointIdentity';
import {
  addCustomEndpoint,
  getCustomEndpoints,
} from '@/core/integrations/laravel/LaravelEndpoints';
import type { WfNewEndpoint } from './WfNewApiTypes';

export { CURRENT_URL_TYPE } from '../../../core/network/api-client/endpointIdentity';

class WfNewEndpointStore {
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
    return StorageManager.getRaw(StorageKeys.USER_MODIFIED_ENDPOINT);
  }
  get autoType(): string | null {
    return StorageManager.getRaw(StorageKeys.AUTO_DETECTED_ENDPOINT);
  }
  get currentType(): string | null {
    return StorageManager.getRaw(StorageKeys.CURRENT_ENDPOINT);
  }

  /** Pin a user-chosen TYPE (also records it as the current type). */
  setSelected(type: string): void {
    StorageManager.setRaw(StorageKeys.USER_MODIFIED_ENDPOINT, type);
    StorageManager.setRaw(StorageKeys.CURRENT_ENDPOINT, type);
  }

  /** Record an availability-auto-picked TYPE (also the current type). */
  setAuto(type: string): void {
    StorageManager.setRaw(StorageKeys.AUTO_DETECTED_ENDPOINT, type);
    StorageManager.setRaw(StorageKeys.CURRENT_ENDPOINT, type);
  }

  /** Forget every persisted reference to a TYPE so detection re-picks. */
  forgetType(type: string): void {
    if (this.selectedType === type) StorageManager.remove(StorageKeys.USER_MODIFIED_ENDPOINT);
    if (this.autoType === type) StorageManager.remove(StorageKeys.AUTO_DETECTED_ENDPOINT);
    if (this.currentType === type) StorageManager.remove(StorageKeys.CURRENT_ENDPOINT);
  }

  // ---- recheck interval (core key) ----

  get recheckIntervalMs(): number | null {
    const raw = StorageManager.getRaw(StorageKeys.RECHECK_INTERVAL_MS);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }
  setRecheckIntervalMs(ms: number): void {
    StorageManager.setRaw(StorageKeys.RECHECK_INTERVAL_MS, String(ms));
  }
}

/** Global singleton — the /wordnew view over the shared endpoint persistence. */
export const wfNewEndpointStore = new WfNewEndpointStore();
