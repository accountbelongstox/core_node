import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Device, DeviceLog } from '../types';
import { useI18n } from '../services/i18n';
import { wsService } from '../services/websocket';

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
  onCloseFullView
}) => {
  const { t } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [telemetry, setTelemetry] = useState<number[]>(Array(20).fill(10));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [logs]);

  useEffect(() => {
    if (!device) return;
    const interval = setInterval(() => {
      setTelemetry(prev => {
        const next = [...prev];
        next.shift();
        next.push(Math.floor(Math.random() * 80 + 10));
        return next;
      });
    }, 500);
    return () => clearInterval(interval);
  }, [device]);

  if (isFullView && device) {
     return (
       <div className="absolute inset-0 z-50 bg-[#030305] flex flex-col animate-[scan_0.5s_ease-out]">
          {/* Header */}
          <div className="h-14 border-b border-white/10 flex items-center justify-between px-6 bg-[#0a0c10]">
             <div className="flex items-center gap-4">
               <button onClick={onCloseFullView} className="p-2 hover:bg-white/10 rounded-full text-white transition-colors">
                 <i className="ph-bold ph-arrow-left"></i>
               </button>
               <div>
                  <h1 className="text-white font-bold tracking-wider">{device.name || device.model} <span className="text-[#00f2ff] font-mono text-sm">//{device.serial}</span></h1>
               </div>
             </div>
             <div className="flex gap-4">
                <div className="px-3 py-1 bg-[#05ffa1]/10 border border-[#05ffa1]/30 rounded text-[#05ffa1] text-xs font-mono flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-[#05ffa1] animate-pulse"></div> {t('device_control.live_fps')}
                </div>
             </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
             {/* Main Stream Area */}
             <div className="flex-1 bg-black/50 relative flex items-center justify-center p-8 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-black">
                {/* Simulated Stream */}
                <div className="aspect-[9/16] h-full max-h-full bg-[#1a1c23] border border-white/10 rounded-xl relative shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden group">
                   <div className="absolute inset-0 bg-gradient-to-br from-[#00f2ff]/5 to-[#bd00ff]/5 animate-pulse"></div>
                   
                   {/* Grid Overlay */}
                   <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>

                   {/* Touch overlay */}
                   <div className="absolute inset-0 z-10 cursor-crosshair active:cursor-grabbing" title={t('device_control.touch_control')}></div>

                   {/* Android Nav Bar */}
                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-8 z-20 bg-black/80 backdrop-blur px-6 py-3 rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="text-white hover:text-[#00f2ff] transition-colors"><i className="ph-bold ph-caret-left text-xl"></i></button>
                      <button className="text-white hover:text-[#00f2ff] transition-colors"><i className="ph-bold ph-circle text-xl"></i></button>
                      <button className="text-white hover:text-[#00f2ff] transition-colors"><i className="ph-bold ph-square text-xl"></i></button>
                   </div>
                </div>
             </div>

             {/* Right Tools Panel (Reusing Inspector Style) */}
             <div className="w-[300px] bg-[#0a0c10] border-l border-white/10 flex flex-col">
                <InspectorContent device={device} logs={logs} telemetry={telemetry} scrollRef={scrollRef} />
             </div>
          </div>
       </div>
     )
  }

  return (
    <aside 
      className={`glass-panel border-l border-white/10 flex flex-col transition-[width] duration-300 relative z-20 h-full overflow-hidden
        ${collapsed ? 'w-[60px]' : 'w-[300px]'}
      `}
    >
      <div 
        className="absolute -left-3 top-5 w-6 h-6 rounded-full bg-[#0a0c10] border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 text-white z-30 shadow-lg"
        onClick={() => setCollapsed(!collapsed)}
      >
        <i className={`ph-bold ${collapsed ? 'ph-caret-left' : 'ph-caret-right'}`}></i>
      </div>

      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-3 text-slate-400 font-mono text-[10px] font-bold tracking-[1px] bg-white/[0.02] whitespace-nowrap overflow-hidden">
         <i className="ph ph-faders text-lg"></i>
         {!collapsed && <span>{t('device_control.inspector')}</span>}
      </div>

      {!collapsed ? (
        <InspectorContent device={device} logs={logs} telemetry={telemetry} scrollRef={scrollRef} />
      ) : (
        <div className="flex-1 flex flex-col items-center pt-8 gap-6 opacity-50">
           <i className="ph ph-info text-2xl" title={t('device_control.select_device')}></i>
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
}> = ({ device, logs, telemetry, scrollRef }) => {
  const { t } = useI18n();
  const [textInput, setTextInput] = useState('');
  const [isInputting, setIsInputting] = useState(false);

  // Control functions
  const sendKeyEvent = useCallback(async (keyCode: number) => {
    if (!device) return;
    try {
      await wsService.send('control.key', {
        deviceId: device.id,
        action: 'down',
        keyCode: keyCode,
        metaState: 0
      });
      // Send up event immediately after down
      await wsService.send('control.key', {
        deviceId: device.id,
        action: 'up',
        keyCode: keyCode,
        metaState: 0
      });
    } catch (error) {
      console.error('[DeviceControl] Failed to send key event:', error);
    }
  }, [device]);

  const sendSystemKey = useCallback(async (action: string) => {
    if (!device) return;
    try {
      await wsService.send('control.systemkey', {
        deviceId: device.id,
        action: action
      });
    } catch (error) {
      console.error('[DeviceControl] Failed to send system key:', error);
    }
  }, [device]);

  const sendText = useCallback(async () => {
    if (!device || !textInput.trim()) return;
    setIsInputting(true);
    try {
      await wsService.send('control.text', {
        deviceId: device.id,
        text: textInput
      });
      setTextInput('');
    } catch (error) {
      console.error('[DeviceControl] Failed to send text:', error);
    } finally {
      setIsInputting(false);
    }
  }, [device, textInput]);

  if (!device) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-center p-6">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4 border border-white/5">
           <i className="ph ph-cursor-click text-3xl opacity-50"></i>
        </div>
        <p className="text-xs tracking-wider">{t('device_control.select_node')}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-[scan_0.3s_ease-out]">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">

        {/* Identity Block */}
        <div className="mb-6">
          <div className="text-[10px] text-[#00f2ff] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-gradient-to-r after:from-[#00f2ff]/20 after:to-transparent">
            {t('device_control.identity')}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <InfoItem label={t('device_control.model')} value={device.model} />
            <InfoItem label={t('device_control.serial')} value={device.serial} mono />
            <InfoItem label={t('device_control.battery')} value={`${device.battery}%`} valueColor={device.battery > 20 ? 'text-[#05ffa1]' : 'text-[#ff2a6d]'} />
            <InfoItem label="Status" value="ONLINE" valueColor="text-[#05ffa1]" />
          </div>
        </div>

        {/* Virtual D-Pad Control */}
        <div className="mb-6">
          <div className="text-[10px] text-[#00f2ff] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-gradient-to-r after:from-[#00f2ff]/20 after:to-transparent">
            NAVIGATION
          </div>
          <div className="flex gap-4">
            {/* D-Pad */}
            <div className="flex-1 aspect-square relative">
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1">
                <div></div>
                <DPadButton icon="ph-caret-up" onClick={() => sendKeyEvent(19)} />
                <div></div>
                <DPadButton icon="ph-caret-left" onClick={() => sendKeyEvent(21)} />
                <DPadButton icon="ph-circle" onClick={() => sendKeyEvent(23)} label="OK" />
                <DPadButton icon="ph-caret-right" onClick={() => sendKeyEvent(22)} />
                <div></div>
                <DPadButton icon="ph-caret-down" onClick={() => sendKeyEvent(20)} />
                <div></div>
              </div>
            </div>

            {/* System Keys */}
            <div className="flex-1 grid grid-cols-2 gap-2">
              <SystemButton icon="ph-arrow-left" label="Back" onClick={() => sendSystemKey('back')} />
              <SystemButton icon="ph-house" label="Home" onClick={() => sendSystemKey('home')} />
              <SystemButton icon="ph-squares-four" label="Recent" onClick={() => sendSystemKey('recent')} />
              <SystemButton icon="ph-power" label="Power" onClick={() => sendSystemKey('power')} danger />
            </div>
          </div>
        </div>

        {/* Text Input */}
        <div className="mb-6">
          <div className="text-[10px] text-[#00f2ff] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-gradient-to-r after:from-[#00f2ff]/20 after:to-transparent">
            TEXT INPUT
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') sendText();
              }}
              placeholder="Type text to send..."
              className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00f2ff]/50"
              disabled={isInputting}
            />
            <button
              onClick={sendText}
              disabled={!textInput.trim() || isInputting}
              className="px-4 bg-[#00f2ff]/20 border border-[#00f2ff]/50 rounded text-[#00f2ff] text-xs font-bold hover:bg-[#00f2ff]/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {isInputting ? '...' : 'SEND'}
            </button>
          </div>
        </div>

        {/* Volume Control */}
        <div className="mb-6">
          <div className="text-[10px] text-[#00f2ff] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-gradient-to-r after:from-[#00f2ff]/20 after:to-transparent">
            VOLUME
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => sendKeyEvent(25)}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-white"
            >
              <i className="ph-bold ph-speaker-simple-low text-lg"></i>
              <span className="text-xs">DOWN</span>
            </button>
            <button
              onClick={() => sendKeyEvent(24)}
              className="flex-1 py-3 bg-white/5 border border-white/10 rounded hover:bg-white/10 transition-all flex items-center justify-center gap-2 text-white"
            >
              <i className="ph-bold ph-speaker-simple-high text-lg"></i>
              <span className="text-xs">UP</span>
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
           <div className="text-[10px] text-[#00f2ff] font-bold tracking-widest mb-3 flex items-center gap-2 after:content-[''] after:flex-1 after:h-[1px] after:bg-gradient-to-r after:from-[#00f2ff]/20 after:to-transparent">
            QUICK ACTIONS
          </div>
          <div className="grid grid-cols-3 gap-2">
             <ActionButton icon="ph-camera" label="Snap" onClick={() => sendSystemKey('screenshot')} />
             <ActionButton icon="ph-keyboard" label="Enter" onClick={() => sendKeyEvent(66)} />
             <ActionButton icon="ph-backspace" label="Delete" onClick={() => sendKeyEvent(67)} />
             <ActionButton icon="ph-arrow-u-up-left" label="Esc" onClick={() => sendKeyEvent(111)} />
             <ActionButton icon="ph-arrow-clockwise" label="Menu" onClick={() => sendKeyEvent(82)} />
             <ActionButton icon="ph-x-circle" label="Clear" onClick={() => sendKeyEvent(28)} danger />
          </div>
        </div>

      </div>

      {/* Console */}
      <div className="h-[160px] bg-black/40 border-t border-white/10 flex flex-col">
        <div className="h-8 flex items-center px-4 text-[10px] font-bold text-slate-500 bg-white/[0.02]">
           <i className="ph ph-terminal-window mr-2"></i> {t('device_control.system_log')}
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] custom-scrollbar" ref={scrollRef}>
           {logs.map((log, i) => (
             <div key={i} className="mb-1.5 flex gap-2 border-l-2 border-transparent hover:border-white/20 pl-1">
                <span className="text-slate-600">[{log.time}]</span>
                <span className={
                  log.type === 'info' ? 'text-[#00f2ff]' :
                  log.type === 'error' ? 'text-[#ff2a6d]' : 'text-slate-300'
                }>{log.msg}</span>
             </div>
           ))}
           <div className="animate-pulse text-[#00f2ff]">_</div>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, mono, valueColor }: any) => (
  <div className="bg-white/5 border border-white/5 rounded p-2.5 hover:bg-white/10 transition-colors">
    <span className="block text-[8px] text-slate-500 mb-0.5 tracking-wider">{label}</span>
    <span className={`block text-xs font-semibold ${mono ? 'font-mono' : ''} ${valueColor || 'text-white'}`}>{value}</span>
  </div>
);

const DPadButton = ({ icon, label, onClick }: any) => (
  <button
    onClick={onClick}
    className="bg-white/5 border border-white/10 rounded hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]/50 transition-all active:scale-90 flex items-center justify-center text-white"
  >
    <i className={`ph-bold ${icon} text-xl`}></i>
    {label && <span className="text-[8px] ml-1">{label}</span>}
  </button>
);

const SystemButton = ({ icon, label, onClick, danger }: any) => (
  <button
    onClick={onClick}
    className={`
      py-3 rounded flex flex-col items-center justify-center gap-1 transition-all hover:scale-95 active:scale-90
      ${danger
        ? 'bg-[#ff2a6d]/10 border border-[#ff2a6d]/30 text-[#ff2a6d] hover:bg-[#ff2a6d]/20 hover:border-[#ff2a6d]/50'
        : 'bg-white/5 border border-white/10 text-white hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]/50'
      }
    `}
  >
    <i className={`ph-bold ${icon} text-lg`}></i>
    <span className="text-[9px] font-medium">{label}</span>
  </button>
);

const ActionButton = ({ icon, label, onClick, danger }: any) => (
  <button
    onClick={onClick}
    className={`
    aspect-square rounded-lg border bg-white/5 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-white/10 hover:scale-95 active:scale-90
    ${danger ? 'border-[#ff2a6d]/30 text-[#ff2a6d] hover:border-[#ff2a6d]' : 'border-white/10 text-slate-400 hover:text-white hover:border-white/30'}
  `}>
    <i className={`ph ${icon} text-lg`}></i>
    <span className="text-[9px] font-medium">{label}</span>
  </button>
);