import React, { useMemo } from 'react';
import { Device, BatchActionType } from '../types';

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
          {['all', 'online', 'offline'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded text-[10px] font-mono uppercase transition-all
                ${filterStatus === status ? 'bg-white/10 text-white font-bold' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
           <button className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors">
              <i className="ph ph-arrows-clockwise"></i>
           </button>
           <button className="h-8 px-3 rounded bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/50 text-[#00f2ff] flex items-center gap-2 text-[10px] font-bold tracking-wider transition-colors">
              <i className="ph-bold ph-plus"></i> ENROLL DEVICE
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
                group relative bg-[#0a0c10]
                border rounded-2xl overflow-hidden transition-all duration-300
                hover:-translate-y-1 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:z-10
                flex flex-col h-[300px] w-[200px] select-none
                ${selectedIds.has(device.serial) 
                  ? 'border-[#00f2ff] shadow-[0_0_0_1px_#00f2ff,0_0_20px_rgba(0,242,255,0.2)]' 
                  : 'border-white/10 hover:border-white/30'}
              `}
            >
              {/* Screen Area (Connecting Effect) */}
              <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden border-b border-white/5">
                {device.status === 'online' ? (
                  <div className="w-full h-full relative flex flex-col items-center justify-center p-4">
                     {/* Background Grid */}
                     <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'linear-gradient(rgba(0,242,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,242,255,0.1) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                     
                     {/* Central Spinner */}
                     <div className="relative w-16 h-16 mb-4">
                        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00f2ff] animate-spin"></div>
                        <div className="absolute inset-2 rounded-full border-2 border-transparent border-l-[#bd00ff] animate-[spin_1.5s_linear_infinite_reverse]"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <i className="ph-fill ph-lightning text-[#00f2ff] text-xl animate-pulse"></i>
                        </div>
                     </div>
                     
                     {/* Status Text */}
                     <div className="font-mono text-[9px] text-[#00f2ff] tracking-[2px] mb-2 animate-pulse">ESTABLISHING LINK</div>
                     
                     {/* Progress Bar */}
                     <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#00f2ff] via-[#bd00ff] to-[#00f2ff] w-[60%] animate-[shimmer_1.5s_infinite]"></div>
                     </div>
                     
                     {/* Terminal Lines */}
                     <div className="absolute bottom-2 left-2 text-[8px] font-mono text-slate-500 opacity-60">
                        <div>> init_protocol_v3</div>
                        <div>> handshake_ack...</div>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-700">
                    <i className="ph ph-plugs text-3xl mb-2"></i>
                    <span className="text-[10px] font-mono tracking-widest">DISCONNECTED</span>
                  </div>
                )}
                
                {/* HUD Overlay */}
                <div className="absolute inset-0 p-3 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-1.5 py-0.5 bg-black/80 border border-white/10 backdrop-blur rounded text-[9px] font-mono text-white/80">{device.serial}</span>
                    {device.status === 'online' && <span className="w-2 h-2 bg-[#05ffa1] rounded-full shadow-[0_0_10px_#05ffa1] animate-pulse"></span>}
                  </div>
                </div>

                {/* Selection Check */}
                {selectedIds.has(device.serial) && (
                   <div className="absolute top-0 right-0 p-2">
                      <div className="w-5 h-5 bg-[#00f2ff] rounded flex items-center justify-center shadow-[0_0_10px_#00f2ff]">
                        <i className="ph-bold ph-check text-black text-xs"></i>
                      </div>
                   </div>
                )}
              </div>

              {/* Footer */}
              <div className="h-[45px] bg-[#0d0f14] flex items-center justify-between px-3">
                <div className="flex flex-col">
                   <span className="text-[11px] font-bold text-slate-200">{device.name}</span>
                   <span className="text-[9px] font-mono text-slate-500">{device.ip}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/5">
                   <i className={`ph-fill ph-wifi-high text-[10px] ${device.status === 'online' ? 'text-[#05ffa1]' : 'text-slate-600'}`}></i>
                   <span className="text-[9px] font-mono text-slate-400">{device.ping}ms</span>
                </div>
              </div>

              {/* Enhanced Sidebar Tools Slide-out */}
              <div className="absolute right-0 top-10 bottom-14 flex flex-col gap-1.5 p-2 translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out z-20">
                 {[
                   { icon: 'ph-eye', title: 'View', action: () => onOpenDevice(device), color: 'text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/20' },
                   { icon: 'ph-terminal-window', title: 'Shell', action: () => {}, color: 'text-[#05ffa1] border-[#05ffa1]/30 hover:bg-[#05ffa1]/20' },
                   { icon: 'ph-folder-open', title: 'Files', action: () => {}, color: 'text-[#bd00ff] border-[#bd00ff]/30 hover:bg-[#bd00ff]/20' },
                   { icon: 'ph-camera', title: 'Snap', action: () => {}, color: 'text-white border-white/30 hover:bg-white/20' },
                   { icon: 'ph-gear', title: 'Config', action: () => {}, color: 'text-slate-300 border-white/20 hover:bg-white/10' },
                   { icon: 'ph-power', title: 'Reboot', action: () => {}, color: 'text-[#ff2a6d] border-[#ff2a6d]/30 hover:bg-[#ff2a6d]/20' },
                 ].map((tool, i) => (
                   <button 
                     key={i}
                     onClick={(e) => { e.stopPropagation(); tool.action(); }}
                     className={`w-8 h-8 rounded-lg bg-black/90 border backdrop-blur flex items-center justify-center shadow-lg transition-all hover:scale-105 ${tool.color}`}
                     title={tool.title}
                     style={{ transitionDelay: `${i * 50}ms` }}
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
        <div className="absolute bottom-8 left-8 glass-panel rounded-xl p-2 flex items-center gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-[#00f2ff]/30 animate-[float_0.3s_ease-out_forwards] z-40">
          <div className="bg-[#00f2ff]/10 px-4 py-2 rounded-lg border border-[#00f2ff]/20 mr-2">
             <div className="text-xs text-[#00f2ff] font-bold">SELECTED</div>
             <div className="text-lg font-mono text-white leading-none">{selectedIds.size}</div>
          </div>
          
          <div className="h-8 w-px bg-white/10 mx-1"></div>

          <div className="flex items-center gap-1">
            {[
              { id: 'home', icon: 'ph-house', label: 'Home' },
              { id: 'screenshot', icon: 'ph-camera', label: 'Snap' },
              { id: 'install', icon: 'ph-download-simple', label: 'Install' },
              { id: 'script', icon: 'ph-magic-wand', label: 'Script', color: 'text-[#bd00ff]' },
              { id: 'recording', icon: 'ph-video', label: 'Rec', color: 'text-[#ff2a6d]' },
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