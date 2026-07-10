/**
 * PcLiveContext — bridges the pycore RPC WebSocket bus into React for the
 * pycore-manager end. Mirrors desktop-manager/src/state/LiveContext.tsx.
 *
 * Connects via core/api-libs/pycore on mount and exposes:
 *   - logs:        rolling buffer of backend `pycore_log` lines (cap 1000)
 *   - wsConnected: live WS connection status
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
  connectPycoreWs, subscribe, onWsStatus, onWsDiag,
} from '../../core/api-libs/pycore';

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
  wsConnected: boolean;
  clearLogs: () => void;
  latestSettings: Record<string, unknown> | null;
  /** Subscribe to backend-pushed system settings. Returns an unsubscribe fn. */
  onSystemSettings: (handler: SettingsHandler) => () => void;
}

const PcLiveContext = createContext<PcLiveContextValue | null>(null);

export function PcLiveProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<PcLogLine[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [latestSettings, setLatestSettings] = useState<Record<string, unknown> | null>(null);
  const settingsHandlers = useRef<Set<SettingsHandler>>(new Set());

  const clearLogs = useCallback(() => setLogs([]), []);

  const onSystemSettings = useCallback((handler: SettingsHandler) => {
    settingsHandlers.current.add(handler);
    return () => { settingsHandlers.current.delete(handler); };
  }, []);

  useEffect(() => {
    const offStatus = onWsStatus(setWsConnected);

    // Surface WS connection diagnostics (URL tried, open/close/error) into the
    // log panel so a failed connection is visible even with dev-tools off.
    // Subscribe BEFORE connecting so the first "connecting …" line is captured.
    const offDiag = onWsDiag(({ level, message }) => {
      setLogs((prev) => {
        const next = prev.length >= LOG_CAP ? prev.slice(prev.length - LOG_CAP + 1) : prev.slice();
        next.push({ message: `[ws] ${message}`, level, color: '', ts: Date.now() });
        return next;
      });
    });

    connectPycoreWs();

    const offLog = subscribe('pycore_log', (data: any) => {
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

    const offSettings = subscribe('system_settings_update', (data: any) => {
      const s = (data && typeof data.settings === 'object' && data.settings)
        ? data.settings as Record<string, unknown>
        : null;
      if (!s) return;
      setLatestSettings(s);
      settingsHandlers.current.forEach((h) => { h(s); });
    });

    return () => { offStatus(); offDiag(); offLog(); offSettings(); };
  }, []);

  const value: PcLiveContextValue = {
    logs, wsConnected, clearLogs, latestSettings, onSystemSettings,
  };
  return <PcLiveContext.Provider value={value}>{children}</PcLiveContext.Provider>;
}

export function usePcLive(): PcLiveContextValue {
  const ctx = useContext(PcLiveContext);
  if (!ctx) throw new Error('usePcLive must be used within <PcLiveProvider>');
  return ctx;
}
