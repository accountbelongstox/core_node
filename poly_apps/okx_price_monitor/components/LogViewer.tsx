import React, { useEffect, useState, useRef } from 'react';

interface LogMessage {
  type: string;
  level: string;
  message: string;
  timestamp: string;
  coin?: string;
}

const LogViewer: React.FC = () => {
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Determine WebSocket URL based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:58888/ws/logs`;

    console.log('[LogViewer] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[LogViewer] WebSocket connected');
      setIsConnected(true);
      setLogs(prev => [...prev, {
        type: 'system',
        level: 'info',
        message: 'Connected to log stream',
        timestamp: new Date().toISOString()
      }]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[LogViewer] Received:', data);

        if (data.type === 'log') {
          setLogs(prev => [...prev, data as LogMessage]);
        }
      } catch (error) {
        console.error('[LogViewer] Failed to parse message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[LogViewer] WebSocket error:', error);
      setLogs(prev => [...prev, {
        type: 'system',
        level: 'error',
        message: 'WebSocket connection error',
        timestamp: new Date().toISOString()
      }]);
    };

    ws.onclose = () => {
      console.log('[LogViewer] WebSocket disconnected');
      setIsConnected(false);
      setLogs(prev => [...prev, {
        type: 'system',
        level: 'warning',
        message: 'Disconnected from log stream',
        timestamp: new Date().toISOString()
      }]);
    };

    // Cleanup on unmount
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const clearLogs = () => {
    setLogs([]);
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
      default:
        return 'text-blue-400';
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="log-viewer">
      {/* Header */}
      <div className="log-viewer-header">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">System Logs</h3>
          <div className="flex items-center gap-2">
            <div className={`status-dot ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-400">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {logs.length} messages
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            Auto-scroll
          </label>
          <button
            onClick={clearLogs}
            className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Log Container */}
      <div
        ref={logContainerRef}
        className="log-container"
      >
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            No logs yet. Waiting for messages...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className="log-entry">
              <span className="log-timestamp">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className={`log-level ${getLevelColor(log.level)}`}>
                {getLevelIcon(log.level)}
              </span>
              {log.coin && (
                <span className="log-coin">
                  [{log.coin}]
                </span>
              )}
              <span className="log-message">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>

      <style>{`
        .log-viewer {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #1a1a1a;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #333;
        }

        .log-viewer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: #222;
          border-bottom: 1px solid #333;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
          line-height: 1.5;
        }

        .log-container::-webkit-scrollbar {
          width: 8px;
        }

        .log-container::-webkit-scrollbar-track {
          background: #1a1a1a;
        }

        .log-container::-webkit-scrollbar-thumb {
          background: #444;
          border-radius: 4px;
        }

        .log-container::-webkit-scrollbar-thumb:hover {
          background: #555;
        }

        .log-entry {
          display: flex;
          gap: 8px;
          padding: 4px 8px;
          border-bottom: 1px solid #252525;
        }

        .log-entry:hover {
          background: #252525;
        }

        .log-timestamp {
          color: #666;
          flex-shrink: 0;
          width: 90px;
        }

        .log-level {
          flex-shrink: 0;
          width: 20px;
          font-weight: bold;
        }

        .log-coin {
          color: #00ff88;
          flex-shrink: 0;
          min-width: 60px;
        }

        .log-message {
          color: #ccc;
          flex: 1;
        }

        .text-green-400 { color: #4ade80; }
        .text-red-400 { color: #f87171; }
        .text-yellow-400 { color: #facc15; }
        .text-blue-400 { color: #60a5fa; }
      `}</style>
    </div>
  );
};

export default LogViewer;
