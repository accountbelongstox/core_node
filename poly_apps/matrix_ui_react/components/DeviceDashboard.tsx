import React, { useMemo } from 'react';
import { Device, BatchActionType } from '../types';
import { useTranslation } from '../services/i18n';
import { useAppStore } from '../store';

interface DeviceDashboardProps {
  devices: Device[];
  selectedIds: Set<string>;
  onSelectDevice: (device: Device, multi: boolean) => void;
  onOpenDevice: (device: Device) => void;
  onBatchAction: (action: BatchActionType) => void;
  filterStatus: string;
  setFilterStatus: (s: string) => void;
}

export const DeviceDashboard: React.FC<DeviceDashboardProps> = ({
  devices,
  selectedIds,
  onSelectDevice,
  onOpenDevice,
  onBatchAction,
  filterStatus,
  setFilterStatus
}) => {
  const { t } = useTranslation();
  const { loadDevices } = useAppStore();
  
  const filtered = useMemo(() => {
    if (filterStatus === 'online') return devices.filter(d => d.status === 'online');
    if (filterStatus === 'offline') return devices.filter(d => d.status !== 'online');
    return devices;
  }, [devices, filterStatus]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Stage Toolbar */}
      <div className="h-12 glass-panel border-b border-white/10 flex items-center justify-between px-6 shrink-0">
        <div className="flex bg-black/30 p-1 rounded-lg gap-1">
          {[
            { key: 'all', label: t('common.search') },
            { key: 'online', label: t('device.status.online') },
            { key: 'offline', label: t('device.status.offline') },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`px-3 py-1 rounded text-[10px] font-mono uppercase transition-all
                ${filterStatus === key ? 'bg-white/10 text-white font-bold' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
           <button
             onClick={() => loadDevices()}
             className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
             title={t('common.loading')}
           >
              <i className="ph ph-arrows-clockwise"></i>
           </button>
           <button className="h-8 px-3 rounded border flex items-center gap-2 text-[10px] font-bold tracking-wider transition-colors" style={{ backgroundColor: 'var(--cyan-dim)', borderColor: 'rgba(0, 242, 255, 0.5)', color: 'var(--cyan)' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 242, 255, 0.2)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--cyan-dim)'}>
              <i className="ph-bold ph-plus"></i> {t('device.actions.connect').toUpperCase()}
           </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        {/* 'justify-start' ensures left alignment as requested, flex-wrap creates grid-like behavior */}
        <div className="flex flex-wrap content-start gap-6">
          {filtered.map(device => (
            <div
              key={device.serial}
              onClick={(e) => onSelectDevice(device, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpenDevice(device)}
                className={`
                group relative
                border rounded-2xl overflow-hidden transition-all duration-300
                hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:z-10
                flex flex-col h-[300px] w-[200px] select-none
                ${selectedIds.has(device.serial) 
                  ? 'shadow-[0_0_0_1px_var(--cyan),0_0_20px_rgba(0,242,255,0.2)]' 
                  : 'border-white/10 hover:border-white/30'}
              `}
              style={{ 
                backgroundColor: 'var(--bg-black)',
                borderColor: selectedIds.has(device.serial) ? 'var(--cyan)' : undefined
              }}
            >
              {/* Screen Area (Connecting Effect) */}
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden border-b border-white/5">
                {device.status === 'online' ? (
                  <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
                     {/* Background Grid */}
                     <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,242,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,242,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                     
                     {/* Central Spinner */}
                     <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: 'var(--cyan)' }}></div>
                        <div className="absolute inset-2 rounded-full border-2 border-transparent animate-[spin_1.5s_linear_infinite_reverse]" style={{ borderLeftColor: 'var(--purple)' }}></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <i className="ph-fill ph-lightning text-xl animate-pulse" style={{ color: 'var(--cyan)' }}></i>
                        </div>
                     </div>
                     
                     {/* Status Text */}
                     <div className="font-mono text-[9px] tracking-[2px] mb-2 animate-pulse" style={{ color: 'var(--cyan)' }}>{t('websocket.connecting').toUpperCase()}</div>
                     
                     {/* Progress Bar */}
                     <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full w-[60%] animate-[shimmer_1.5s_infinite]" style={{ background: 'linear-gradient(to right, var(--cyan), var(--purple), var(--cyan))' }}></div>
                     </div>
                     
                     {/* Terminal Lines */}
                     <div className="absolute bottom-2 left-2 text-[8px] font-mono text-slate-500 opacity-60">
                        <div>{'>'} init_protocol_v3</div>
                        <div>{'>'} handshake_ack...</div>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-700">
                    <i className="ph ph-plugs text-3xl mb-2"></i>
                    <span className="text-[10px] font-mono tracking-widest">{t('websocket.disconnected').toUpperCase()}</span>
                  </div>
                )}
                
                {/* HUD Overlay */}
                <div className="absolute inset-0 p-3 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-1.5 py-0.5 bg-black/80 border border-white/10 backdrop-blur rounded text-[9px] font-mono text-white/80">{device.serial}</span>
                    {device.status === 'online' && <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--success)', boxShadow: '0 0 10px var(--success)' }}></span>}
                  </div>
                </div>

                {/* Selection Check */}
                {selectedIds.has(device.serial) && (
                   <div className="absolute top-0 right-0 p-2">
                      <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: 'var(--cyan)', boxShadow: '0 0 10px var(--cyan)' }}>
                        <i className="ph-bold ph-check text-black text-xs"></i>
                      </div>
                   </div>
                )}
              </div>

              {/* Footer */}
              <div className="h-[45px] flex items-center justify-between px-3" style={{ backgroundColor: 'var(--bg-black-light)' }}>
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-slate-200">{device.name}</span>
                   <span className="text-[9px] font-mono text-slate-500">{device.ip}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                   <i className={`ph-fill ph-wifi-high text-[10px] ${device.status === 'online' ? '' : 'text-slate-600'}`} style={device.status === 'online' ? { color: 'var(--success)' } : {}}></i>
                   <span className="text-[9px] font-mono text-slate-400">{device.ping}ms</span>
                </div>
              </div>

              {/* Enhanced Sidebar Tools Slide-out */}
              <div className="absolute right-0 top-10 bottom-14 flex flex-col gap-1.5 p-2 translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out z-20">
                 {[
                   { icon: 'ph-eye', title: t('common.search'), action: () => onOpenDevice(device), color: 'var(--cyan)' },
                   { icon: 'ph-terminal-window', title: t('menu.rightbar.logs'), action: () => {}, color: 'var(--success)' },
                   { icon: 'ph-folder-open', title: t('menu.rightbar.properties'), action: () => {}, color: 'var(--purple)' },
                   { icon: 'ph-camera', title: t('device.actions.screenshot'), action: () => {}, color: '#ffffff' },
                   { icon: 'ph-gear', title: t('menu.topbar.settings'), action: () => {}, color: 'rgb(203, 213, 225)' },
                   { icon: 'ph-power', title: t('device.actions.power'), action: () => {}, color: 'var(--alert)' },
                 ].map((tool, i) => (
                   <button 
                     key={i}
                     onClick={(e) => { e.stopPropagation(); tool.action(); }}
                     className="w-8 h-8 rounded-lg bg-black/90 border backdrop-blur flex items-center justify-center shadow-lg transition-all hover:scale-105"
                     title={tool.title}
                     style={{ 
                       transitionDelay: `${i * 50}ms`,
                       color: tool.color,
                       borderColor: `${tool.color}30`,
                     }}
                     onMouseEnter={(e) => {
                       e.currentTarget.style.backgroundColor = `${tool.color}20`;
                     }}
                     onMouseLeave={(e) => {
                       e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                     }}
                   >
                     <i className={`ph ${tool.icon} text-sm`}></i>
                   </button>
                 ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="absolute bottom-8 left-8 glass-panel rounded-xl p-2 flex items-center gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border animate-[float_0.3s_ease-out_forwards] z-40" style={{ borderColor: 'rgba(0, 242, 255, 0.3)' }}>
          <div className="px-4 py-2 rounded-lg border mr-2" style={{ backgroundColor: 'var(--cyan-dim)', borderColor: 'rgba(0, 242, 255, 0.2)' }}>
             <div className="text-xs font-bold" style={{ color: 'var(--cyan)' }}>{t('common.selected').toUpperCase()}</div>
             <div className="text-lg font-mono text-white leading-none">{selectedIds.size}</div>
          </div>
          
          <div className="h-8 w-px bg-white/10 mx-1"></div>

          <div className="flex items-center gap-1">
            {[
              { id: 'home', icon: 'ph-house', label: t('device.actions.home') },
              { id: 'screenshot', icon: 'ph-camera', label: t('device.actions.screenshot') },
              { id: 'install', icon: 'ph-download-simple', label: t('device.actions.install') },
              { id: 'script', icon: 'ph-magic-wand', label: t('device.actions.script'), color: 'text-[#bd00ff]' },
              { id: 'recording', icon: 'ph-video', label: t('device.actions.recording'), color: 'text-[#ff2a6d]' },
            ].map(action => (
              <button 
                key={action.id}
                onClick={() => onBatchAction(action.id as BatchActionType)}
                className={`w-10 h-10 rounded-lg hover:bg-white/10 flex flex-col items-center justify-center gap-0.5 transition-colors ${action.color || 'text-white'}`}
                title={action.label}
              >
                <i className={`ph ${action.icon} text-lg`}></i>
                <span className="text-[8px] font-bold uppercase opacity-70">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};