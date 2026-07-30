/**
 * PcLiveContext — bridges the pycore HTTP event bus into React for the
 * pycore-manager end. Mirrors desktop-manager/src/state/LiveContext.tsx.
 *
 * Connects via core/api-libs/pycore on mount and exposes:
 *   - logs:        rolling buffer of backend `pycore_log` lines (cap 1000)
 *   - httpConnected: live HTTP event connection status
 *   - clearLogs(): empty the buffer
 *   - latestSettings: most recent backend `system_settings_update` payload
 *   - onSystemSettings(): subscribe to backend settings pushes
 *
 * Wrap the pycore layout with <PcLiveProvider> (done in PcProviders / PcLayout) so the global
 * floating log and any page can read the same buffer via usePcLive().
 */
import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from 'react';
import {
  connectPycoreHttp, onHttpStatus, onHttpDiag,
} from '../../core/api-libs/pycore';
import { appendHttpDebug } from '../../core/api-libs/pycore/pycoreHttpLog';
import { pycoreEventBus } from '../../core/api-libs/pycore/PycoreEventBus';
import { PYCORE_EVENT_TOPICS } from '../../core/api-libs/pycore/PycoreEventTopics';

const LOG_CAP = 1000;

export interface PcLogLine {
  message: string;
  level: string;
  color: string;
  ts: number;
}

type SettingsHandler = (settings: Record<string, unknown>) => void;

interface PcLiveContextValue {
  logs: PcLogLine[];
  httpConnected: boolean;
  clearLogs: () => void;
  latestSettings: Record<string, unknown> | null;
  /** Subscribe to backend-pushed system settings. Returns an unsubscribe fn. */
  onSystemSettings: (handler: SettingsHandler) => () => void;
}

const PcLiveContext = createContext<PcLiveContextValue | null>(null);

export function PcLiveProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<PcLogLine[]>([]);
  const [httpConnected, setHttpConnected] = useState(false);
  const [latestSettings, setLatestSettings] = useState<Record<string, unknown> | null>(null);
  const settingsHandlers = useRef<Set<SettingsHandler>>(new Set());

  const clearLogs = useCallback(() => setLogs([]), []);

  const onSystemSettings = useCallback((handler: SettingsHandler) => {
    settingsHandlers.current.add(handler);
    return () => { settingsHandlers.current.delete(handler); };
  }, []);

  useEffect(() => {
    const offStatus = onHttpStatus(setHttpConnected);

    // Surface HTTP event connection diagnostics into the
    // log panel so a failed connection is visible even with dev-tools off.
    // Subscribe BEFORE connecting so the first "connecting …" line is captured.
    const offDiag = onHttpDiag(({ level, message }) => {
      setLogs((prev) => {
        const next = prev.length >= LOG_CAP ? prev.slice(prev.length - LOG_CAP + 1) : prev.slice();
        next.push({ message: `[http] ${message}`, level, color: '', ts: Date.now() });
        return next;
      });
    });

    connectPycoreHttp();

    const offLog = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.pycoreLog, (data: any) => {
      const line: PcLogLine = {
        message: typeof data?.message === 'string' ? data.message : String(data?.message ?? ''),
        level: typeof data?.level === 'string' ? data.level : 'info',
        color: typeof data?.color === 'string' ? data.color : '',
        ts: Date.now(),
      };
      setLogs((prev) => {
        const next = prev.length >= LOG_CAP ? prev.slice(prev.length - LOG_CAP + 1) : prev.slice();
        next.push(line);
        return next;
      });
    });

    const offSettings = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.systemSettingsUpdate, (data: any) => {
      const s = (data && typeof data.settings === 'object' && data.settings)
        ? data.settings as Record<string, unknown>
        : null;
      if (!s) return;
      setLatestSettings(s);
      settingsHandlers.current.forEach((h) => { h(s); });
    });

    // pycore -> Laravel request records (LaravelClient -> LaravelHttpRecorder ->
    // rpc_v2 broadcast) feed the HTTP debugger's 'laravel' direction rows.
    const offLaravelHttp = pycoreEventBus.subscribe(PYCORE_EVENT_TOPICS.laravelHttp, (data: any) => {
      appendHttpDebug({
        direction: 'laravel',
        method: typeof data?.method === 'string' ? data.method : '',
        path: typeof data?.path === 'string' ? data.path : '',
        fullUrl: typeof data?.url === 'string' ? data.url : undefined,
        paramsSummary: typeof data?.params_summary === 'string' ? data.params_summary : '',
        status: Number(data?.status) || 0,
        ms: Number(data?.ms) || 0,
        error: data?.error ? String(data.error) : null,
      });
    });

    return () => { offStatus(); offDiag(); offLog(); offSettings(); offLaravelHttp(); };
  }, []);

  const value: PcLiveContextValue = {
    logs, httpConnected, clearLogs, latestSettings, onSystemSettings,
  };
  return <PcLiveContext.Provider value={value}>{children}</PcLiveContext.Provider>;
}

export function usePcLive(): PcLiveContextValue {
  const ctx = useContext(PcLiveContext);
  if (!ctx) throw new Error('usePcLive must be used within <PcLiveProvider>');
  return ctx;
}
