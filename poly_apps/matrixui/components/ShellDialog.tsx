
import React, { useState, useEffect, useRef } from 'react';
import { wsService } from '../services/websocket';
import { useI18n } from '../services/i18n';

interface ShellDialogProps {
  deviceId: string;
  deviceName?: string;
  onClose: () => void;
}

interface CommandHistory {
  command: string;
  output: string;
  timestamp: number;
}

export const ShellDialog: React.FC<ShellDialogProps> = ({ deviceId, deviceName, onClose }) => {
  const { t } = useI18n();
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [systemInfo, setSystemInfo] = useState<{
    cpu?: string;
    memory?: string;
    battery?: string;
    disk?: string;
  }>({});
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const outputEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [output]);

  // Load system info on mount
  useEffect(() => {
    loadSystemInfo();
  }, [deviceId]);

  const loadSystemInfo = async () => {
    try {
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }
      const result = await wsService.callRpcV2('shell.info', { deviceId });
      if (result && result.systemInfo) {
        setSystemInfo(result.systemInfo);
        addOutput(`[System Info]`, 'info');
        addOutput(`CPU: ${result.systemInfo.cpu || 'N/A'}`, 'info');
        addOutput(`Memory: ${result.systemInfo.memory || 'N/A'}`, 'info');
        addOutput(`Battery: ${result.systemInfo.battery || 'N/A'}`, 'info');
        addOutput(`Disk: ${result.systemInfo.disk || 'N/A'}`, 'info');
        addOutput('', 'info');
      }
    } catch (error) {
      addOutput(`[Error] Failed to load system info: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  };

  const addOutput = (text: string, type: 'command' | 'output' | 'error' | 'info' = 'output') => {
    setOutput(prev => [...prev, `[${type.toUpperCase()}] ${text}`]);
  };

  const executeCommand = async (cmd: string) => {
    if (!cmd.trim()) return;

    setIsExecuting(true);
    addOutput(`$ ${cmd}`, 'command');

    try {
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }

      const result = await wsService.callRpcV2('shell.execute', {
        deviceId,
        command: cmd,
        timeout: 30
      });

      if (result) {
        if (result.error) {
          addOutput(result.error.message || 'Command failed', 'error');
        } else if (result.output !== undefined) {
          addOutput(result.output || '(no output)', 'output');
        } else {
          addOutput('Command executed successfully', 'output');
        }
      }

      // Add to history
      setHistory(prev => {
        const newHistory = [...prev];
        if (newHistory[newHistory.length - 1] !== cmd) {
          newHistory.push(cmd);
        }
        return newHistory.slice(-50); // Keep last 50 commands
      });
      setCommandHistory(prev => [
        ...prev,
        { command: cmd, output: result?.output || '', timestamp: Date.now() }
      ].slice(-100)); // Keep last 100 entries

    } catch (error) {
      addOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setIsExecuting(false);
      setHistoryIndex(-1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isExecuting) {
      executeCommand(command);
      setCommand('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCommand(history[newIndex]);
        }
      }
    } else if (e.key === 'Enter') {
      handleSubmit(e);
    } else if (e.ctrlKey && e.key === 'c') {
      e.preventDefault();
      if (isExecuting) {
        addOutput('[Cancelled]', 'error');
        setIsExecuting(false);
      }
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl h-[80vh] bg-[#0a0c10] border border-white/10 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden animate-scale-in flex flex-col">
        
        {/* Header */}
        <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <i className="ph ph-terminal-window text-[#05ffa1] text-xl"></i>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Shell Terminal</h3>
              <div className="text-[10px] font-mono text-slate-500">
                {deviceName || deviceId}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {systemInfo.cpu && (
              <div className="px-2 py-1 bg-[#05ffa1]/10 border border-[#05ffa1]/30 rounded text-[10px] font-mono text-[#05ffa1]">
                {systemInfo.cpu.split(' ')[0]}
              </div>
            )}
            <button
              onClick={clearOutput}
              className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
              title="Clear output"
            >
              <i className="ph ph-trash text-sm"></i>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <i className="ph ph-x text-lg"></i>
            </button>
          </div>
        </div>

        {/* System Info Bar */}
        {Object.keys(systemInfo).length > 0 && (
          <div className="h-10 border-b border-white/5 bg-black/20 flex items-center gap-4 px-6 text-[10px] font-mono text-slate-400 shrink-0">
            {systemInfo.cpu && <span>CPU: <span className="text-[#05ffa1]">{systemInfo.cpu}</span></span>}
            {systemInfo.memory && <span>Memory: <span className="text-[#00f2ff]">{systemInfo.memory}</span></span>}
            {systemInfo.battery && <span>Battery: <span className="text-[#ffd60a]">{systemInfo.battery}</span></span>}
            {systemInfo.disk && <span>Disk: <span className="text-white">{systemInfo.disk}</span></span>}
          </div>
        )}

        {/* Output Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-black/40 font-mono text-xs custom-scrollbar">
          {output.length === 0 ? (
            <div className="text-slate-500 text-center py-8">
              <i className="ph ph-terminal-window text-4xl mb-2 block"></i>
              <p>Shell terminal ready. Type a command and press Enter.</p>
              <p className="text-[10px] mt-2">Use ↑/↓ for command history, Ctrl+C to cancel</p>
            </div>
          ) : (
            output.map((line, index) => {
              const isCommand = line.startsWith('[COMMAND]');
              const isError = line.startsWith('[ERROR]');
              const isInfo = line.startsWith('[INFO]');
              const text = line.replace(/^\[.*?\]\s*/, '');
              
              return (
                <div
                  key={index}
                  className={`
                    mb-1 break-words
                    ${isCommand ? 'text-[#05ffa1]' : ''}
                    ${isError ? 'text-[#ff2a6d]' : ''}
                    ${isInfo ? 'text-[#00f2ff]' : ''}
                    ${!isCommand && !isError && !isInfo ? 'text-slate-300' : ''}
                  `}
                >
                  {text || '\u00A0'}
                </div>
              );
            })
          )}
          {isExecuting && (
            <div className="text-[#05ffa1] animate-pulse">
              <i className="ph ph-circle-notch text-sm animate-spin"></i> Executing...
            </div>
          )}
          <div ref={outputEndRef} />
        </div>

        {/* Input Area */}
        <div className="h-14 border-t border-white/10 bg-white/[0.02] flex items-center gap-2 px-4 shrink-0">
          <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
            <span className="text-[#05ffa1] font-mono text-sm">$</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isExecuting}
              placeholder={isExecuting ? 'Executing...' : 'Enter command...'}
              className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white font-mono focus:border-[#05ffa1] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
            />
            <button
              type="submit"
              disabled={!command.trim() || isExecuting}
              className="px-4 py-2 bg-[#05ffa1]/20 hover:bg-[#05ffa1]/30 border border-[#05ffa1]/50 text-[#05ffa1] rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isExecuting ? (
                <i className="ph ph-circle-notch text-sm animate-spin"></i>
              ) : (
                'Execute'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

