import { wfNewApi } from '../api';
import { wfNewSettings, type WfNewSettings } from '../WfNewSettingsStore';
import { getWfClientKey } from '../utils/WfClientIdentity';
import type { WfNewReaderSettingsBlob } from '../api/types/readerSettings';

const READER_KEYS = [
  'readerSimul',
  'readerLangs',
  'readerDisplayMode',
  'readerPlaySequence',
  'readerSpeedByLang',
  'readerAutoAdvance',
  'readerRepeatOne',
  'readerAutoPlayOnOpen',
  'readerBrowserTts',
  'readerVariantByLang',
  'readerWordCards',
  'readerWordCardPosition',
  'readerWordRepeats',
  'readerWordMode',
] as const satisfies ReadonlyArray<keyof WfNewSettings>;

const PUSH_DEBOUNCE_MS = 900;

export function snapshotReaderSettings(): WfNewReaderSettingsBlob {
  const blob: WfNewReaderSettingsBlob = {};
  for (const key of READER_KEYS) {
    (blob as Record<string, unknown>)[key] = wfNewSettings.get(key);
  }
  blob.updatedAt = wfNewSettings.get('readerSettingsUpdatedAt') || new Date().toISOString();
  return blob;
}

export function applyReaderSettings(blob: WfNewReaderSettingsBlob | null | undefined): boolean {
  if (!blob || typeof blob !== 'object') return false;

  const localUpdated = wfNewSettings.get('readerSettingsUpdatedAt');
  const remoteUpdated = blob.updatedAt || null;
  if (localUpdated && remoteUpdated && remoteUpdated <= localUpdated) {
    return false;
  }

  const patch: Partial<WfNewSettings> = {};
  for (const key of READER_KEYS) {
    if (blob[key] !== undefined) {
      (patch as Record<string, unknown>)[key] = blob[key];
    }
  }
  if (remoteUpdated) {
    patch.readerSettingsUpdatedAt = remoteUpdated;
  }
  if (Object.keys(patch).length === 0) return false;

  wfNewSettings.patch(patch);
  return true;
}

class WfReaderSettingsRoamerClass {
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private pullPromise: Promise<boolean> | null = null;

  async pull(): Promise<boolean> {
    if (this.pullPromise) return this.pullPromise;

    this.pullPromise = (async () => {
      try {
        if (wfNewApi.isAuthenticated()) {
          const prefs = await wfNewApi.getPreferences();
          const reader = prefs?.app_settings?.reader as WfNewReaderSettingsBlob | undefined;
          return applyReaderSettings(reader ?? null);
        }
        const clientKey = await getWfClientKey();
        const remote = await wfNewApi.getClientDeviceSettings(clientKey);
        return applyReaderSettings(remote?.reader ?? null);
      } catch (error) {
        console.warn('[WfReaderSettingsRoamer] Pull skipped:', error);
        return false;
      } finally {
        this.pullPromise = null;
      }
    })();

    return this.pullPromise;
  }

  schedulePush(): void {
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      void this.push();
    }, PUSH_DEBOUNCE_MS);
  }

  /**
   * Immediately run any pending debounced push. Call on navigate-away / logout
   * so a change made within the debounce window is never dropped.
   */
  flush(): void {
    if (!this.pushTimer) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = null;
    void this.push();
  }

  private async push(): Promise<void> {
    const updatedAt = new Date().toISOString();
    wfNewSettings.setField('readerSettingsUpdatedAt', updatedAt);
    const reader = snapshotReaderSettings();
    reader.updatedAt = updatedAt;

    try {
      if (wfNewApi.isAuthenticated()) {
        await wfNewApi.updatePreferences({
          app_settings: { reader },
        });
        return;
      }
      const clientKey = await getWfClientKey();
      await wfNewApi.saveClientDeviceSettings(clientKey, reader, updatedAt);
    } catch (error) {
      console.warn('[WfReaderSettingsRoamer] Push skipped:', error);
    }
  }
}

export const wfReaderSettingsRoamer = new WfReaderSettingsRoamerClass();
