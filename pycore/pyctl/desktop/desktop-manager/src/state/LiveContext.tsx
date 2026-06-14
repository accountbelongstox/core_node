/**
 * Live context: bridges the pycore RPC WebSocket bus into React.
 *
 * Connects via src/api/ws.ts on mount and exposes:
 *   - logs:        rolling buffer of backend `pycore_log` lines (cap ~500)
 *   - wsConnected: live WS connection status
 *   - clearLogs(): empty the buffer
 *   - latestSettings: most recent backend `system_settings_update` payload
 *   - onSystemSettings(): subscribe to backend settings pushes (AppContext uses this)
 */
import {
  createContext, useContext, useEffect, useRef, useState, useCallback,
  type ReactNode,
} from 'react';
import type { LogLine, CodeSyncSnapshot } from '../types';
import { connectPycoreWs, subscribe, onWsStatus, onWsDiag } from '../api/ws';

const LOG_CAP = 1000;

type SettingsHandler = (settings: Record<string, unknown>) => void;

interface LiveContextValue {
  logs: LogLine[];
  wsConnected: boolean;
  clearLogs: () => void;
  latestSettings: Record<string, unknown> | null;
  /** Subscribe to backend-pushed system settings. Returns an unsubscribe fn. */
  onSystemSettings: (handler: SettingsHandler) => () => void;
  /** Latest `code_sync_update` snapshot (peer mesh), or null until the first tick. */
  codeSync: CodeSyncSnapshot | null;
}

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [latestSettings, setLatestSettings] = useState<Record<string, unknown> | null>(null);
  const [codeSync, setCodeSync] = useState<CodeSyncSnapshot | null>(null);
  const settingsHandlers = useRef<Set<SettingsHandler>>(new Set());

  const clearLogs = useCallback(() => setLogs([]), []);

  const onSystemSettings = useCallback((handler: SettingsHandler) => {
    settingsHandlers.current.add(handler);
    return () => { settingsHandlers.current.delete(handler); };
  }, []);

  useEffect(() => {
    const offStatus = onWsStatus(setWsConnected);

    // Surface WS connection diagnostics (URL tried, open/close/error) into the log
    // panel, so a failed connection is visible even with dev-tools off. Subscribe
    // BEFORE connecting so the very first "connecting …" line is captured.
    const offDiag = onWsDiag(({ level, message }) => {
      setLogs((prev) => {
        const next = prev.length >= LOG_CAP ? prev.slice(prev.length - LOG_CAP + 1) : prev.slice();
        next.push({ message: `[ws] ${message}`, level, color: '', ts: Date.now() });
        return next;
      });
    });

    connectPycoreWs();

    const offLog = subscribe('pycore_log', (data: any) => {
      const line: LogLine = {
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
      settingsHandlers.current.forEach((h) => {
        try { h(s); } catch { /* ignore */ }
      });
    });

    // Live peer-mesh tick: the backend broadcasts `code_sync_update` with the
    // full { self, peers, version } snapshot whenever roles/peers/reachability
    // change. The Code Sync page reads this via useLive().codeSync.
    const offCodeSync = subscribe('code_sync_update', (data: any) => {
      if (!data || typeof data !== 'object') return;
      setCodeSync({
        self: data.self ?? null,
        peers: Array.isArray(data.peers) ? data.peers : [],
        version: typeof data.version === 'number' ? data.version : 0,
      });
    });

    return () => { offStatus(); offDiag(); offLog(); offSettings(); offCodeSync(); };
  }, []);

  const value: LiveContextValue = {
    logs, wsConnected, clearLogs, latestSettings, onSystemSettings, codeSync,
  };
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used within <LiveProvider>');
  return ctx;
}
