import React, { useState, useEffect } from 'react';
import { wsService } from '../services/websocket';

interface BrowserSupport {
  webcodecs: boolean;
  canvas2d: boolean;
  webgl: boolean;
  webgl2: boolean;
  userAgent: string;
  platform: string;
  language: string;
}

interface SystemStats {
  websocket: {
    connected: boolean;
    url: string;
    readyState: number;
    reconnectAttempts: number;
  };
  browser: BrowserSupport;
  devices: {
    total: number;
    connected: number;
    streaming: number;
  };
  performance: {
    memory?: {
      used: number;
      limit: number;
    };
    fps: number;
  };
}

export const SystemHealth: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; level: string; message: string }>>([]);

  useEffect(() => {
    // Check browser capabilities ONCE on mount (not every second!)
    const checkBrowserSupport = (): BrowserSupport => {
      const support: BrowserSupport = {
        webcodecs: typeof VideoDecoder !== 'undefined',
        canvas2d: false,
        webgl: false,
        webgl2: false,
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language
      };

      // Check Canvas 2D
      try {
        const canvas = document.createElement('canvas');
        support.canvas2d = !!canvas.getContext('2d');
      } catch (e) {
        console.error('Canvas 2D check failed:', e);
      }

      // Check WebGL (with proper cleanup)
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        support.webgl = !!gl;

        // Clean up WebGL context immediately
        if (gl) {
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      } catch (e) {
        console.error('WebGL check failed:', e);
      }

      // Check WebGL2 (with proper cleanup)
      try {
        const canvas = document.createElement('canvas');
        const gl2 = canvas.getContext('webgl2');
        support.webgl2 = !!gl2;

        // Clean up WebGL2 context immediately
        if (gl2) {
          const loseContext = gl2.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
      } catch (e) {
        console.error('WebGL2 check failed:', e);
      }

      return support;
    };

    // Check browser support ONCE on mount
    const browserSupport = checkBrowserSupport();
    console.log('[SystemHealth] Browser support checked:', browserSupport);

    // Initial stats
    const updateStats = () => {

      const newStats: SystemStats = {
        websocket: {
          connected: wsService.isRpcConnected(),
          url: 'ws://localhost:48000/rpc/ws',
          readyState: (wsService as any).ws?.readyState || 3,
          reconnectAttempts: 0
        },
        browser: browserSupport, // Use cached browser support
        devices: {
          total: 0,
          connected: 0,
          streaming: 0
        },
        performance: {
          memory: (performance as any).memory ? {
            used: (performance as any).memory.usedJSHeapSize,
            limit: (performance as any).memory.jsHeapSizeLimit
          } : undefined,
          fps: 0
        }
      };

      setStats(newStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 1000);

    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    const addLog = (level: string, ...args: any[]) => {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');

      setLogs(prev => [...prev.slice(-99), { time, level, message }]);
    };

    console.log = (...args) => {
      addLog('info', ...args);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      addLog('error', ...args);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      addLog('warn', ...args);
      originalWarn.apply(console, args);
    };

    return () => {
      clearInterval(interval);
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    };
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#00f2ff]">Loading system health...</div>
      </div>
    );
  }

  const StatusBadge: React.FC<{ status: boolean; label: string }> = ({ status, label }) => (
    <div className={`px-3 py-1.5 rounded border text-xs font-mono ${
      status
        ? 'bg-green-500/10 border-green-500/50 text-green-400'
        : 'bg-red-500/10 border-red-500/50 text-red-400'
    }`}>
      <i className={`ph ${status ? 'ph-check-circle' : 'ph-x-circle'} mr-1`}></i>
      {label}
    </div>
  );

  const readyStateText = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][stats.websocket.readyState] || 'UNKNOWN';

  return (
    <div className="h-full w-full bg-gradient-to-br from-black/95 to-[#0a0c10]/95 backdrop-blur-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#00f2ff] rounded-full animate-pulse"></div>
          <h1 className="text-[#00f2ff] font-bold tracking-widest text-lg">SYSTEM HEALTH</h1>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white transition-colors"
        >
          <i className="ph ph-x"></i>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* WebSocket Status */}
        <div className="glass-panel border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold tracking-wider text-sm">WebSocket Connection</h2>
            <div className={`px-2 py-1 rounded text-xs font-mono ${
              stats.websocket.connected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {readyStateText}
            </div>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">URL:</span>
              <span className="text-white">{stats.websocket.url}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Ready State:</span>
              <span className="text-white">{stats.websocket.readyState} ({readyStateText})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">RPC Connected:</span>
              <span className={stats.websocket.connected ? 'text-green-400' : 'text-red-400'}>
                {stats.websocket.connected ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Browser Support */}
        <div className="glass-panel border border-white/10 rounded-lg p-4">
          <h2 className="text-white font-bold tracking-wider text-sm mb-4">Browser Capabilities</h2>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <StatusBadge status={stats.browser.webcodecs} label="WebCodecs" />
            <StatusBadge status={stats.browser.canvas2d} label="Canvas 2D" />
            <StatusBadge status={stats.browser.webgl} label="WebGL" />
            <StatusBadge status={stats.browser.webgl2} label="WebGL 2" />
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div>
              <div className="text-slate-500 mb-1">User Agent:</div>
              <div className="text-white bg-black/30 rounded p-2 break-all">{stats.browser.userAgent}</div>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Platform:</span>
              <span className="text-white">{stats.browser.platform}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Language:</span>
              <span className="text-white">{stats.browser.language}</span>
            </div>
          </div>
        </div>

        {/* Performance */}
        {stats.performance.memory && (
          <div className="glass-panel border border-white/10 rounded-lg p-4">
            <h2 className="text-white font-bold tracking-wider text-sm mb-4">Performance</h2>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Memory Used:</span>
                <span className="text-white">
                  {(stats.performance.memory.used / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Memory Limit:</span>
                <span className="text-white">
                  {(stats.performance.memory.limit / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
              <div className="w-full h-2 bg-black/40 rounded overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#00f2ff] to-[#bd00ff]"
                  style={{
                    width: `${(stats.performance.memory.used / stats.performance.memory.limit) * 100}%`
                  }}
                ></div>
              </div>
            </div>
          </div>
        )}

        {/* Console Logs */}
        <div className="glass-panel border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold tracking-wider text-sm">Console Logs</h2>
            <button
              onClick={() => setLogs([])}
              className="px-2 py-1 rounded text-xs text-slate-400 hover:text-white border border-white/10 hover:border-white/30 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="bg-black/60 rounded p-2 h-64 overflow-y-auto font-mono text-xs space-y-1">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-4">No logs captured yet</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className="flex gap-2">
                  <span className="text-slate-600 shrink-0">{log.time}</span>
                  <span className={`shrink-0 ${
                    log.level === 'error' ? 'text-red-400' :
                    log.level === 'warn' ? 'text-yellow-400' :
                    'text-[#00f2ff]'
                  }`}>
                    [{log.level.toUpperCase()}]
                  </span>
                  <span className="text-slate-300 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
