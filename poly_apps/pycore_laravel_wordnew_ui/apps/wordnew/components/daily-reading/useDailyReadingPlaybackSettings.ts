import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import {
  requestAuthLogin,
  subscribeAuthLoginSuccess,
} from '../../../../core/auth/AuthRequestCenter';
import { StorageManager } from '../../../../core/persistence';
import { wfNewApi } from '../../api';
import { WordNewStorageKeys as StorageKeys } from '../../persistence/WordNewStorageKeys';
import {
  initialDailyReadingSettings,
  mergeDailyReadingSettings,
  normalizeDailyReadingSettings,
  type DailyReadingPlaybackSettings,
} from './DailyReadingPlaybackModel';

const CLOUD_PUSH_DEBOUNCE_MS = 700;

interface DailyReadingPlaybackSettingsController {
  settings: DailyReadingPlaybackSettings;
  settingsRef: MutableRefObject<DailyReadingPlaybackSettings>;
  cloudDirtyRef: MutableRefObject<boolean>;
  pullCloudSettings: () => Promise<void>;
  updateSettings: (patch: Partial<DailyReadingPlaybackSettings>) => void;
}

export function useDailyReadingPlaybackSettings(): DailyReadingPlaybackSettingsController {
  const initialSettingsRef = useRef(initialDailyReadingSettings());
  const settingsRef = useRef(initialSettingsRef.current);
  const settingsVersionRef = useRef(0);
  const cloudPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cloudDirtyRef = useRef(false);
  const cloudPullIdRef = useRef(0);
  const pendingPatchRef = useRef<Partial<DailyReadingPlaybackSettings> | null>(null);
  const [settings, setSettings] = useState(initialSettingsRef.current);

  const applySettings = useCallback((nextSettings: DailyReadingPlaybackSettings) => {
    settingsRef.current = nextSettings;
    settingsVersionRef.current += 1;
    setSettings(nextSettings);
    try {
      StorageManager.set(StorageKeys.WORDNEW_DAILY_READING_PLAYER, nextSettings);
    } catch (error: unknown) {
      console.warn('[WordNewDailyReadingSettings] Local settings save skipped:', error);
    }
  }, []);

  const pushCloudSettings = useCallback((
    snapshot: DailyReadingPlaybackSettings,
    settingsVersion: number,
  ): Promise<void> => {
    if (!wfNewApi.isAuthenticated()) return Promise.resolve();
    const updatedAt = new Date().toISOString();
    return wfNewApi.updatePreferences({
      app_settings: {
        dailyReadingPlayer: { ...snapshot, updatedAt },
      },
    }).then(() => {
      if (settingsVersionRef.current === settingsVersion) cloudDirtyRef.current = false;
    });
  }, []);

  const pullCloudSettings = useCallback((): Promise<void> => {
    if (!wfNewApi.isAuthenticated() || cloudDirtyRef.current) return Promise.resolve();
    const pullId = ++cloudPullIdRef.current;
    return wfNewApi.getPreferences().then((preferences) => {
      if (pullId !== cloudPullIdRef.current || cloudDirtyRef.current) return;
      const remote = preferences?.app_settings?.dailyReadingPlayer;
      if (remote && typeof remote === 'object') {
        applySettings(normalizeDailyReadingSettings(remote as Record<string, unknown>));
        return;
      }
      const snapshot = settingsRef.current;
      cloudDirtyRef.current = true;
      return pushCloudSettings(snapshot, settingsVersionRef.current);
    }).catch((error: unknown) => {
      console.warn('[WordNewDailyReadingSettings] Cloud settings pull skipped:', error);
    });
  }, [applySettings, pushCloudSettings]);

  const updateSettings = useCallback((patch: Partial<DailyReadingPlaybackSettings>) => {
    if (!wfNewApi.isAuthenticated()) {
      pendingPatchRef.current = { ...(pendingPatchRef.current ?? {}), ...patch };
      requestAuthLogin({ source: 'wordnew-daily-reading', reason: 'playback-settings' });
      return;
    }
    const nextSettings = mergeDailyReadingSettings(settingsRef.current, patch);
    applySettings(nextSettings);
    cloudDirtyRef.current = true;
    if (cloudPushTimerRef.current) clearTimeout(cloudPushTimerRef.current);
    cloudPushTimerRef.current = setTimeout(() => {
      cloudPushTimerRef.current = null;
      void pushCloudSettings(settingsRef.current, settingsVersionRef.current).catch((error: unknown) => {
        console.warn('[WordNewDailyReadingSettings] Cloud settings push skipped:', error);
      });
    }, CLOUD_PUSH_DEBOUNCE_MS);
  }, [applySettings, pushCloudSettings]);

  useEffect(() => subscribeAuthLoginSuccess((detail) => {
    if (
      detail.request?.source !== 'wordnew-daily-reading'
      || detail.request.reason !== 'playback-settings'
    ) return;
    const pendingPatch = pendingPatchRef.current;
    if (!pendingPatch) return;
    pendingPatchRef.current = null;
    updateSettings(pendingPatch);
  }), [updateSettings]);

  useEffect(() => () => {
    cloudPullIdRef.current += 1;
    pendingPatchRef.current = null;
    if (cloudPushTimerRef.current) {
      clearTimeout(cloudPushTimerRef.current);
      cloudPushTimerRef.current = null;
    }
    if (cloudDirtyRef.current) {
      void pushCloudSettings(settingsRef.current, settingsVersionRef.current).catch((error: unknown) => {
        console.warn('[WordNewDailyReadingSettings] Cloud settings flush skipped:', error);
      });
    }
  }, [pushCloudSettings]);

  return {
    settings,
    settingsRef,
    cloudDirtyRef,
    pullCloudSettings,
    updateSettings,
  };
}
