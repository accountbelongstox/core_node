/**
 * Global app state (React context): settings, queue, player, toasts, active tab.
 * Centralizes persistence (localStorage cache) and pycore wiring so pages stay thin.
 */
import {
  createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode,
} from 'react';
import type { AppSettings, PlayerState, QueueItem, TabType, Language } from '../types';
import { getT } from '../i18n/translations';
import { ACCENTS, type AccentStyle } from '../lib/accent';
import { pycoreApi } from '../api/pycore';
import { useLive } from './LiveContext';
import {
  loadSettings, saveSettings, loadQueueCache, saveQueueCache,
} from '../store/cache';

export type ToastType = 'success' | 'info' | 'error';
export interface Toast { id: string; message: string; type: ToastType; }

const DEFAULT_SETTINGS: AppSettings = {
  lang: 'en', theme: 'dark', isConnected: true,
  monitorClipboard: false, scheduledScreenshot: false, screenshotInterval: 60,
  notebooklmAutoConvert: false, glassOpacity: 20, blurStrength: 16, accentColor: 'indigo',
};

interface AppContextValue {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  updateSettings: (patch: Partial<AppSettings>) => void;
  toggleTheme: (mode: 'light' | 'dark') => void;
  setLang: (lang: Language) => void;
  t: Record<string, string>;
  accent: AccentStyle;

  queue: QueueItem[];
  setQueue: (items: QueueItem[]) => void;
  fetchQueue: () => Promise<void>;
  syncQueue: (items: QueueItem[]) => void;

  playerState: PlayerState;
  setPlayerState: React.Dispatch<React.SetStateAction<PlayerState>>;

  toasts: Toast[];
  toast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;

  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // Settings overlay (global floating modal, not a routed page).
  showSettings: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Pick only the keys we recognize as AppSettings from an arbitrary backend object.
 * This keeps unknown backend fields from polluting our typed settings state.
 */
function pickKnownSettings(raw: Record<string, unknown> | null | undefined): Partial<AppSettings> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof AppSettings)[]) {
    if (k in raw && raw[k] !== undefined && raw[k] !== null) out[k] = raw[k];
  }
  return out as Partial<AppSettings>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { onSystemSettings } = useLive();
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...DEFAULT_SETTINGS, ...(loadSettings() || {}),
  }));
  const [queue, setQueueState] = useState<QueueItem[]>(() => loadQueueCache() || []);
  const [playerState, setPlayerState] = useState<PlayerState>({
    isPlaying: false, speed: 1.0, volume: 0.8, playCount: 1, currentAudioFile: '', currentIndex: -1,
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('voice_player');
  const [showSettings, setShowSettings] = useState(false);

  // --- persistence ------------------------------------------------------- #
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { if (queue.length) saveQueueCache(queue); }, [queue]);

  // --- backend settings sync -------------------------------------------- #
  // Guards so backend-driven updates don't echo back to the backend.
  const settingsHydrated = useRef(false);          // becomes true after first load
  const applyingFromBackend = useRef(false);       // true while applying a backend push
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1) Initial load: backend wins if it has settings; otherwise keep local state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await pycoreApi.getSystemSettings();
        if (cancelled) return;
        const known = pickKnownSettings(r?.settings);
        if (r?.success && r.settings && Object.keys(known).length > 0) {
          applyingFromBackend.current = true;
          setSettings((prev) => ({ ...prev, ...known }));
        }
        // else: backend has none -> keep existing local state (required fallback).
      } catch {
        // backend unreachable -> keep local state (offline cache already loaded).
      } finally {
        if (!cancelled) settingsHydrated.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 2) Live backend pushes (system_settings_update) -> apply without echoing back.
  useEffect(() => {
    const off = onSystemSettings((raw) => {
      const known = pickKnownSettings(raw);
      if (Object.keys(known).length === 0) return;
      applyingFromBackend.current = true;
      setSettings((prev) => ({ ...prev, ...known }));
    });
    return off;
  }, [onSystemSettings]);

  // 3) Local changes -> debounced POST to backend (fire-and-forget). The first
  //    render and backend-driven applies are skipped to avoid feedback loops.
  useEffect(() => {
    if (!settingsHydrated.current) return;
    if (applyingFromBackend.current) { applyingFromBackend.current = false; return; }
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => {
      pycoreApi.setSystemSettings(settings as unknown as Record<string, unknown>)
        .catch(() => { /* offline: localStorage cache still holds it */ });
    }, 400);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [settings]);

  // --- toasts ------------------------------------------------------------ #
  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}_${Math.round(performance.now())}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4500);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  // --- settings helpers -------------------------------------------------- #
  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);
  const toggleTheme = useCallback((mode: 'light' | 'dark') => {
    setSettings((prev) => ({ ...prev, theme: mode }));
  }, []);
  const setLang = useCallback((lang: Language) => {
    setSettings((prev) => ({ ...prev, lang }));
  }, []);

  // --- settings overlay -------------------------------------------------- #
  const openSettings = useCallback(() => setShowSettings(true), []);
  const closeSettings = useCallback(() => setShowSettings(false), []);

  // --- queue ------------------------------------------------------------- #
  const setQueue = useCallback((items: QueueItem[]) => setQueueState(items), []);
  const syncQueue = useCallback((items: QueueItem[]) => {
    pycoreApi.syncQueue(items).catch(() => {/* offline: cache already holds it */});
  }, []);
  const fetchQueue = useCallback(async () => {
    try {
      const data = await pycoreApi.getQueue();
      if (data.success && data.items) {
        setQueueState(data.items);
        setSettings((prev) => (prev.isConnected ? prev : { ...prev, isConnected: true }));
      } else {
        throw new Error(data.error || 'no data');
      }
    } catch {
      const cached = loadQueueCache();
      if (cached && cached.length) setQueueState(cached);
      setSettings((prev) => (prev.isConnected ? { ...prev, isConnected: false } : prev));
    }
  }, []);

  // initial load + periodic refresh
  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, 5000);
    return () => clearInterval(id);
  }, [fetchQueue]);

  const value: AppContextValue = {
    settings, setSettings, updateSettings, toggleTheme, setLang,
    t: getT(settings.lang), accent: ACCENTS[settings.accentColor],
    queue, setQueue, fetchQueue, syncQueue,
    playerState, setPlayerState,
    toasts, toast, dismissToast,
    activeTab, setActiveTab,
    showSettings, openSettings, closeSettings,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within <AppProvider>');
  return ctx;
}
