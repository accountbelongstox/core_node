// DeviceControl Component - Right menu with WebSocket and API integration
import React, { useEffect, useRef, useState } from 'react';
import { Device, DeviceLog } from '../types';
import { useTranslation } from '../services/i18n';
import { useAppStore } from '../store';
import { wsClient } from '../services/websocket/client';

interface InspectorProps {
  device: Device | null;
  logs: DeviceLog[];
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  isFullView: boolean;
  onCloseFullView?: () => void;
}

export const DeviceControl: React.FC<InspectorProps> = ({
  device,
  logs,
  collapsed,
  setCollapsed,
  isFullView,
  onCloseFullView,
}) => {
  const { t } = useTranslation();
  const { dispatch } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState<number[]>(Array(20).fill(10));
  const [brightness, setBrightness] = useState<number | null>(null);
  const [rotation, setRotation] = useState<number | null>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  // Load device telemetry and properties
  useEffect(() => {
    if (!device) return;

    // Load brightness
    wsClient
      .screenGetBrightness(device.serial)
      .then((response) => {
        if (response.success && response.data?.level !== undefined) {
          setBrightness(response.data.level);
        }
      })
      .catch(() => {});

    // Load rotation
    wsClient
      .send({
        namespace: 'screen',
        action: 'get_rotation',
        data: { serial: device.serial },
      })
      .then((response) => {
        if (response.success && response.data?.rotation !== undefined) {
          setRotation(response.data.rotation);
        }
      })
      .catch(() => {});

    // Simulate telemetry updates
    const interval = setInterval(() => {
      setTelemetry((prev) => {
        const next = [...prev];
        next.shift();
        next.push(Math.floor(Math.random() * 80 + 10));
        return next;
      });
    }, 500);

    return () => clearInterval(interval);
  }, [device]);

  // Handle touch events in full view
  const handleTouch = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!device || !isFullView) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 1080;
    const y = ((e.clientY - rect.top) / rect.height) * 2400;

    try {
      await wsClient.controlTouch(device.serial, 'down', x, y, 1080, 2400);
      await wsClient.controlTouch(device.serial, 'up', x, y, 1080, 2400);
    } catch (error: any) {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          time: new Date().toLocaleTimeString(),
          type: 'error',
          msg: error.message || t('api.error.requestFailed'),
        },
      });
    }
  };

  // Handle quick actions
  const handleQuickAction = async (action: string) => {
    if (!device) return;

    try {
      switch (action) {
        case 'screenshot':
          await wsClient.send({
            namespace: 'screen',
            action: 'screenshot',
            data: { serial: device.serial },
          });
          dispatch({
            type: 'ADD_LOG',
            payload: {
              time: new Date().toLocaleTimeString(),
              type: 'success',
              msg: t('device.actions.screenshot') + ' ' + t('common.success'),
            },
          });
          break;
        case 'home':
          await wsClient.controlSystemKey(device.serial, 3);
          break;
        case 'back':
          await wsClient.controlSystemKey(device.serial, 4);
          break;
        case 'power':
          await wsClient.screenPower(device.serial, 'toggle');
          break;
      }
    } catch (error: any) {
      dispatch({
        type: 'ADD_LOG',
        payload: {
          time: new Date().toLocaleTimeString(),
          type: 'error',
          msg: error.message || t('api.error.requestFailed'),
        },
      });
    }
  };

  if (isFullView && device) {
    return (
       <div className="absolute inset-0 z-50 flex flex-col animate-[scan_0.5s_ease-out]" style={{ backgroundColor: 'var(--bg-void)' }}>
          {/* Header */}
          <div className="h-14 border-b border-white/10 flex items-center justify-between px-6" style={{ backgroundColor: 'var(--bg-black)' }}>
          <div className="flex items-center gap-4">
            <button
              onClick={onCloseFullView}
              className="p-2 hover:bg-white/10 rounded-full text-white transition-colors"
            >
              <i className="ph-bold ph-arrow-left"></i>
            </button>
            <div>
              <h1 className="text-white font-bold tracking-wider">
                {device.name || device.model}{' '}
                <span className="font-mono text-sm" style={{ color: 'var(--cyan)' }}>//{device.serial}</span>
              </h1>
            </div>
          </div>
          <div className="flex gap-4">
                <div className="px-3 py-1 border rounded text-xs font-mono flex items-center gap-2" style={{ backgroundColor: 'rgba(5, 255, 161, 0.1)', borderColor: 'rgba(5, 255, 161, 0.3)', color: 'var(--success)' }}>
                   <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)' }}></div> LIVE 60FPS
                </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Main Stream Area */}
          <div className="flex-1 bg-black/50 relative flex items-center justify-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black">
            {/* Simulated Stream */}
            <div
              className="aspect-[9/16] h-full max-h-full border border-white/10 rounded-xl relative shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden group"
              style={{ backgroundColor: '#1a1c23' }}
              onMouseDown={handleTouch}
            >
              <div className="absolute inset-0 animate-pulse" style={{ background: 'linear-gradient(to bottom right, rgba(0, 242, 255, 0.05), rgba(189, 0, 255, 0.05))' }}></div>

              {/* Grid Overlay */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              ></div>

              {/* Touch overlay */}
              <div
                className="absolute inset-0 z-10 cursor-crosshair active:cursor-grabbing"
                title={t('device.actions.connect')}
              ></div>

              {/* Android Nav Bar */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-8 z-20 bg-black/80 backdrop-blur px-6 py-3 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleQuickAction('back')}
                  className="text-white transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--cyan)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'white'}
                >
                  <i className="ph-bold ph-caret-left text-xl"></i>
                </button>
                <button
                  onClick={() => handleQuickAction('home')}
                  className="text-white transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--cyan)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'white'}
                >
                  <i className="ph-bold ph-circle text-xl"></i>
                </button>
                <button
                  onClick={() => handleQuickAction('power')}
                  className="text-white transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--cyan)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'white'}
                >
                  <i className="ph-bold ph-square text-xl"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Right Tools Panel */}
             <div className="w-[300px] border-l border-white/10 flex flex-col" style={{ backgroundColor: 'var(--bg-black)' }}>
            <InspectorContent
              device={device}
              logs={logs}
              telemetry={telemetry}
              scrollRef={scrollRef}
              brightness={brightness}
              rotation={rotation}
              onQuickAction={handleQuickAction}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <aside
      className={`glass-panel border-l border-white/10 flex flex-col transition-[width] duration-300 relative z-20 h-full overflow-hidden
        ${collapsed ? 'w-[60px]' : 'w-[300px]'}
      `}
    >
      <div
        className="absolute -left-3 top-5 w-6 h-6 rounded-full border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 text-white z-30 shadow-lg"
        style={{ backgroundColor: 'var(--bg-black)' }}
        onClick={() => setCollapsed(!collapsed)}
      >
        <i className={`ph-bold ${collapsed ? 'ph-caret-left' : 'ph-caret-right'}`}></i>
      </div>

      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-3 text-slate-400 font-mono text-[10px] font-bold tracking-[1px] bg-white/[0.02] whitespace-nowrap overflow-hidden">
        <i className="ph ph-faders text-lg"></i>
        {!collapsed && <span>{t('menu.rightbar.deviceControl').toUpperCase()}</span>}
      </div>

      {!collapsed ? (
        <InspectorContent
          device={device}
          logs={logs}
          telemetry={telemetry}
          scrollRef={scrollRef}
          brightness={brightness}
          rotation={rotation}
          onQuickAction={handleQuickAction}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center pt-8 gap-6 opacity-50">
          <i className="ph ph-info text-2xl" title={t('menu.rightbar.deviceControl')}></i>
          <div className="w-1 h-8 bg-white/10"></div>
          <i className="ph ph-cpu text-xl"></i>
          <i className="ph ph-terminal-window text-xl"></i>
        </div>
      )}
    </aside>
  );
};

const InspectorContent: React.FC<{
  device: Device | null;
  logs: DeviceLog[];
  telemetry: number[];
  scrollRef: React.RefObject<HTMLDivElement | null>;
  brightness?: number | null;
  rotation?: number | null;
  onQuickAction?: (action: string) => void;
}> = ({ device, logs, telemetry, scrollRef, brightness, rotation, onQuickAction }) => {
  const { t } = useTranslation();

  if (!device) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
          <i className="ph ph-cursor-click text-3xl opacity-50"></i>
        </div>
        <p className="text-xs tracking-wider">{t('menu.rightbar.deviceControl').toUpperCase()}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-[scan_0.3s_ease-out]">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* Identity Block */}
        <div className="mb-6">
          <div className="text-[10px] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:to-transparent" style={{ color: 'var(--cyan)' }} after:style={{ background: 'linear-gradient(to right, rgba(0, 242, 255, 0.2), transparent)' } as any}>
            IDENTITY
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InfoItem label="MODEL" value={device.model} />
            <InfoItem label="SERIAL" value={device.serial} mono />
            <InfoItem
              label="BATTERY"
              value={`${device.battery}%`}
              valueColor={device.battery > 20 ? 'var(--success)' : 'var(--alert)'}
            />
            <InfoItem label="STATUS" value={t(`device.status.${device.status}`)} />
            {brightness !== null && (
              <InfoItem label="BRIGHTNESS" value={`${Math.round((brightness / 255) * 100)}%`} />
            )}
            {rotation !== null && (
              <InfoItem label="ROTATION" value={`${rotation}°`} />
            )}
          </div>
        </div>

        {/* Telemetry Block */}
        <div className="mb-6">
          <div className="text-[10px] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:to-transparent" style={{ color: 'var(--cyan)' }} after:style={{ background: 'linear-gradient(to right, rgba(0, 242, 255, 0.2), transparent)' } as any}>
            TELEMETRY
          </div>
          <div className="h-24 bg-black/40 border border-white/10 rounded-lg flex items-end justify-between px-1 pb-1 pt-6 gap-1 overflow-hidden relative">
            <div className="absolute top-2 left-2 text-[8px] text-slate-500 font-mono flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--cyan)' }}></div> CPU LOAD
            </div>
            {telemetry.map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-sm transition-all duration-300"
                style={{ background: 'linear-gradient(to top, rgba(0, 242, 255, 0.8), rgba(0, 242, 255, 0.2))' }}
                style={{ height: `${h}%` }}
              ></div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <div className="text-[10px] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:to-transparent" style={{ color: 'var(--cyan)' }} after:style={{ background: 'linear-gradient(to right, rgba(0, 242, 255, 0.2), transparent)' } as any}>
            {t('menu.rightbar.deviceControl').toUpperCase()}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ActionButton
              icon="ph-camera"
              label={t('device.actions.screenshot')}
              onClick={() => onQuickAction?.('screenshot')}
            />
            <ActionButton
              icon="ph-video"
              label={t('device.actions.recording')}
              onClick={() => onQuickAction?.('recording')}
            />
            <ActionButton
              icon="ph-clipboard"
              label={t('common.edit')}
              onClick={() => onQuickAction?.('paste')}
            />
            <ActionButton
              icon="ph-lock-key"
              label={t('device.actions.power')}
              onClick={() => onQuickAction?.('power')}
            />
            <ActionButton
              icon="ph-house"
              label={t('device.actions.home')}
              onClick={() => onQuickAction?.('home')}
            />
            <ActionButton
              icon="ph-arrow-left"
              label={t('device.actions.back')}
              onClick={() => onQuickAction?.('back')}
            />
          </div>
        </div>
      </div>

      {/* Console */}
      <div className="h-[200px] bg-black/40 border-t border-white/10 flex flex-col">
        <div className="h-8 flex items-center px-4 text-[10px] font-bold text-slate-500 bg-white/[0.02]">
          <i className="ph ph-terminal-window mr-2"></i> {t('menu.rightbar.logs').toUpperCase()}
        </div>
        <div
          className="flex-1 overflow-y-auto p-3 font-mono text-[9px] custom-scrollbar"
          ref={scrollRef}
        >
          {logs.map((log, i) => (
            <div
              key={i}
              className="mb-1.5 flex gap-2 border-l-2 border-transparent hover:border-white/20 pl-1"
            >
              <span className="text-slate-600">[{log.time}]</span>
              <span
                style={{
                  color: log.type === 'info' ? 'var(--cyan)' : 
                         log.type === 'error' ? 'var(--alert)' : 
                         'rgb(203, 213, 225)'
                }}
              >
                {log.msg}
              </span>
            </div>
          ))}
           <div className="animate-pulse" style={{ color: 'var(--cyan)' }}>_</div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, mono, valueColor }: any) => (
  <div className="bg-white/5 border border-white/5 rounded p-2.5 hover:bg-white/10 transition-colors">
    <span className="block text-[8px] text-slate-500 mb-0.5 tracking-wider">{label}</span>
    <span
      className={`block text-xs font-semibold ${mono ? 'font-mono' : ''} ${valueColor || 'text-white'}`}
    >
      {value}
    </span>
  </div>
);

const ActionButton = ({ icon, label, onClick, danger }: any) => (
  <button
    onClick={onClick}
    className="aspect-square rounded-lg border bg-white/5 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/10 hover:scale-95 active:scale-90 border-white/10 text-slate-400 hover:text-white hover:border-white/30"
    style={danger ? { borderColor: 'rgba(255, 42, 109, 0.3)', color: 'var(--alert)' } : {}}
  >
    <i className={`ph ${icon} text-lg`}></i>
    <span className="text-[9px] font-medium">{label}</span>
  </button>
);
