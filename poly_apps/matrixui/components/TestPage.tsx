import React, { useState, useEffect, useRef } from 'react';
import { wsService } from '../services/websocket';
import { useI18n } from '../services/i18n';

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error' | 'event';
  message: string;
  data?: any;
}

export const TestPage: React.FC = () => {
  const { t } = useI18n();
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [deviceSerial, setDeviceSerial] = useState('192.168.1.100:5555');
  const logEndRef = useRef<HTMLDivElement>(null);

  const addLog = (type: LogEntry['type'], message: string, data?: any) => {
    const now = new Date();
    const time = now.toLocaleTimeString();
    setLogs(prev => [...prev, { time, type, message, data }]);
    setTimeout(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    wsService.configureRpc({
      baseUrl: 'http://localhost:48000',
      wsPath: '/rpc/ws',
      reconnect: true,
      reconnectInterval: 3000,
      maxReconnectAttempts: 10,
      debug: true
    });
    setClientId(wsService.getRpcClientId());
    
    // 检查初始连接状态
    const isInitiallyConnected = wsService.isRpcConnected();
    if (isInitiallyConnected) {
      setConnected(true);
    }
  }, []);

  const handleConnect = async () => {
    try {
      addLog('info', '正在连接到 ws://localhost:48000/rpc/ws ...');
      await wsService.connectRpc();
      setConnected(true);
      setClientId(wsService.getRpcClientId());
      addLog('success', '连接成功');
    } catch (error) {
      addLog('error', `连接失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setConnected(false);
    }
  };

  const handleDisconnect = () => {
    wsService.disconnectRpc();
    setConnected(false);
    addLog('info', '已断开连接');
  };

  const testDeviceList = async () => {
    try {
      addLog('info', '调用 adb.device.list ...');
      const result = await wsService.callRpc('adb.device.list', {});
      addLog('success', `成功获取设备列表: ${result.count || 0} 个设备`);
      setLastResponse(result);
    } catch (error) {
      addLog('error', `失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testDeviceStats = async () => {
    try {
      addLog('info', '调用 adb.device.stats ...');
      const result = await wsService.callRpc('adb.device.stats', {});
      addLog('success', `成功获取统计: ${result.total_devices || 0} 个设备, 状态=${result.heartbeat_status || 'unknown'}`);
      setLastResponse(result);
    } catch (error) {
      addLog('error', `失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testDeviceListGeneric = async () => {
    try {
      addLog('info', '调用 device.list ...');
      const result = await wsService.callRpc('device.list', {});
      addLog('success', '成功获取所有设备');
      setLastResponse(result);
    } catch (error) {
      addLog('error', `失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testDeviceInfo = async () => {
    try {
      addLog('info', `调用 device.info (serial: ${deviceSerial}) ...`);
      const result = await wsService.callRpc('device.info', { serial: deviceSerial });
      addLog('success', '成功获取设备详情');
      setLastResponse(result);
    } catch (error) {
      addLog('error', `失败: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleStartListen = () => {
    if (!connected) {
      addLog('error', '请先连接');
      return;
    }

    addLog('info', '开始监听 adb.devices.update 事件...');
    
    wsService.onRpcEvent('adb.devices.update', (data) => {
      const time = new Date(data.timestamp || Date.now()).toLocaleTimeString();
      addLog('event', `收到设备推送事件: ${data.count || 0} 个设备, 时间=${time}`, data);
      setLastResponse(data);
    });

    addLog('success', '监听已启动，等待服务器推送 (每10秒)');
  };

  const handleStopListen = () => {
    if (!connected) {
      addLog('error', '请先连接');
      return;
    }

    wsService.offRpcEvent('adb.devices.update');
    addLog('info', '已停止监听 adb.devices.update');
  };

  const clearLogs = () => {
    setLogs([]);
    setLastResponse(null);
  };

  return (
    <div className="h-full w-full flex flex-col bg-gradient-to-br from-white/[0.02] to-transparent p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#00f2ff] mb-2">Matrix RPC v2 API 测试</h1>
        <div className="flex items-center gap-4 text-sm">
          <div className={`px-3 py-1 rounded ${connected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
            状态: {connected ? '已连接' : '未连接'}
          </div>
          <div className="px-3 py-1 rounded bg-white/5 text-slate-400">
            客户端ID: {clientId || '-'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="flex flex-col gap-4">
          <div className="bg-black/40 border border-white/10 rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#00f2ff] mb-4">连接控制</h2>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleConnect}
                disabled={connected}
                className="px-4 py-2 rounded bg-[#00f2ff]/20 border border-[#00f2ff]/50 hover:bg-[#00f2ff]/30 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
              >
                连接
              </button>
              <button
                onClick={handleDisconnect}
                disabled={!connected}
                className="px-4 py-2 rounded bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
              >
                断开
              </button>
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#00f2ff] mb-4">API 测试</h2>
            <div className="space-y-2">
              <button
                onClick={testDeviceList}
                disabled={!connected}
                className="w-full px-4 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm text-left"
              >
                1. adb.device.list
              </button>
              <button
                onClick={testDeviceStats}
                disabled={!connected}
                className="w-full px-4 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm text-left"
              >
                2. adb.device.stats
              </button>
              <button
                onClick={testDeviceListGeneric}
                disabled={!connected}
                className="w-full px-4 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm text-left"
              >
                3. device.list
              </button>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="设备序列号"
                  className="flex-1 px-3 py-2 rounded bg-black/40 border border-white/10 text-white text-sm focus:border-[#00f2ff] outline-none"
                />
                <button
                  onClick={testDeviceInfo}
                  disabled={!connected}
                  className="px-4 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
                >
                  4. device.info
                </button>
              </div>
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-lg p-4">
            <h2 className="text-lg font-bold text-[#00f2ff] mb-4">事件监听</h2>
            <div className="flex gap-2">
              <button
                onClick={handleStartListen}
                disabled={!connected}
                className="flex-1 px-4 py-2 rounded bg-[#00f2ff]/20 border border-[#00f2ff]/50 hover:bg-[#00f2ff]/30 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
              >
                开始监听
              </button>
              <button
                onClick={handleStopListen}
                disabled={!connected}
                className="flex-1 px-4 py-2 rounded bg-red-500/20 border border-red-500/50 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm"
              >
                停止监听
              </button>
            </div>
          </div>

          <button
            onClick={clearLogs}
            className="px-4 py-2 rounded bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm"
          >
            清空日志
          </button>
        </div>

        {/* Right Panel - Logs and Response */}
        <div className="flex flex-col gap-4 overflow-hidden">
          <div className="bg-black/40 border border-white/10 rounded-lg p-4 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-lg font-bold text-[#00f2ff] mb-4">日志</h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded p-3 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-slate-500">暂无日志</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="mb-2">
                    <span className="text-slate-500">[{log.time}]</span>{' '}
                    <span className={
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'event' ? 'text-[#00f2ff]' :
                      'text-slate-300'
                    }>
                      {log.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          <div className="bg-black/40 border border-white/10 rounded-lg p-4 flex-1 flex flex-col overflow-hidden">
            <h2 className="text-lg font-bold text-[#00f2ff] mb-4">最后响应</h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/20 rounded p-3">
              {lastResponse ? (
                <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap">
                  {JSON.stringify(lastResponse, null, 2)}
                </pre>
              ) : (
                <div className="text-slate-500">暂无响应数据</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

