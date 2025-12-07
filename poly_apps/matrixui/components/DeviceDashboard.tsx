




import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Device, BatchActionType, DeviceLog } from '../types';
import { DeviceInfo } from '../types/api';
import { wsService } from '../services/websocket';
import { useI18n } from '../services/i18n';

interface DeviceDashboardProps {
  selectedIds: Set<string>;
  onSelectDevice: (device: Device, multi: boolean) => void;
  onOpenDevice: (device: Device) => void;
  onBatchAction: (action: BatchActionType) => void;
  onQuickAction?: (device: Device, action: string) => void; // Added callback
  filterStatus: string;
  setFilterStatus: (s: string) => void;
  addLog: (type: DeviceLog['type'], msg: string) => void;
}

export const DeviceDashboard: React.FC<DeviceDashboardProps> = ({
  selectedIds,
  onSelectDevice,
  onOpenDevice,
  onBatchAction,
  onQuickAction,
  filterStatus,
  setFilterStatus,
  addLog
}) => {
  const { t } = useI18n();
  const [wsDevices, setWsDevices] = useState<DeviceInfo[]>([]);
  
  // Selection Box State
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: {x: number, y: number}, end: {x: number, y: number} } | null>(null);
  const deviceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Interaction State
  const [activeTouch, setActiveTouch] = useState<string | null>(null); // Device serial currently being touched
  const [hoveredDevice, setHoveredDevice] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    wsService.send('device', 'list');

    // Listener
    const removeListener = wsService.addListener((res) => {
      if (res.namespace === 'device' && res.action === 'list') {
        setWsDevices(res.data.devices);
      }
    });

    return () => { removeListener(); };
  }, []);

  const mappedDevices: Device[] = useMemo(() => {
    return wsDevices.map(d => ({
      serial: d.serial,
      model: d.model,
      version: d.android_version || 'unknown',
      status: d.status === 'device' ? 'online' : 'offline',
      battery: 85,
      resolution: '1080x2400',
      groupId: 'root',
      tags: [],
      ip: '192.168.1.x',
      ping: 25,
      name: d.model
    }));
  }, [wsDevices]);

  const filtered = useMemo(() => {
    if (filterStatus === 'online') return mappedDevices.filter(d => d.status === 'online');
    if (filterStatus === 'offline') return mappedDevices.filter(d => d.status !== 'online');
    return mappedDevices;
  }, [mappedDevices, filterStatus]);

  const handleEnroll = () => {
    wsService.send('device', 'list');
  };

  // --- Box Selection Logic ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || activeTouch) return; // Only left click and if not interacting with a device
    
    // Check if we clicked on a device or UI element (prevent selection box start)
    if ((e.target as HTMLElement).closest('.device-card') || (e.target as HTMLElement).closest('button')) {
      return;
    }

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const start = {
        x: e.clientX - rect.left + containerRef.current.scrollLeft,
        y: e.clientY - rect.top + containerRef.current.scrollTop
      };
      setSelectionBox({ start, end: start });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!selectionBox || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const current = {
      x: e.clientX - rect.left + containerRef.current.scrollLeft,
      y: e.clientY - rect.top + containerRef.current.scrollTop
    };
    
    setSelectionBox({ ...selectionBox, end: current });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (selectionBox && containerRef.current) {
      // Calculate intersection
      const boxRect = {
        left: Math.min(selectionBox.start.x, selectionBox.end.x),
        top: Math.min(selectionBox.start.y, selectionBox.end.y),
        right: Math.max(selectionBox.start.x, selectionBox.end.x),
        bottom: Math.max(selectionBox.start.y, selectionBox.end.y),
      };

      const newSelected = new Set(e.ctrlKey ? selectedIds : []);
      let addedCount = 0;

      filtered.forEach(device => {
        const el = deviceRefs.current.get(device.serial);
        if (el) {
          const itemRect = {
            left: el.offsetLeft,
            top: el.offsetTop,
            right: el.offsetLeft + el.offsetWidth,
            bottom: el.offsetTop + el.offsetHeight
          };

          const intersect = !(boxRect.left > itemRect.right || 
                              boxRect.right < itemRect.left || 
                              boxRect.top > itemRect.bottom || 
                              boxRect.bottom < itemRect.top);

          if (intersect) {
            newSelected.add(device.serial);
            if (!selectedIds.has(device.serial)) {
                onSelectDevice(device, true); 
                addedCount++;
            }
          }
        }
      });
      
      if (addedCount > 0) {
        addLog('info', `Box Select: ${addedCount} devices selected`);
      }
    }
    setSelectionBox(null);
  };

  // --- Advanced Device Interaction Logic ---

  const handleDeviceInteraction = (e: React.MouseEvent, serial: string, type: 'down' | 'move' | 'up' | 'leave' | 'enter' | 'double') => {
    if (type === 'down') e.stopPropagation();

    const target = e.currentTarget as HTMLDivElement;
    const rect = target.getBoundingClientRect();
    
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    const coordsStr = `[${x.toFixed(2)},${y.toFixed(2)}]`;

    if (type === 'enter') {
        setHoveredDevice(serial);
    }
    else if (type === 'leave') {
        setHoveredDevice(null);
        if (activeTouch === serial) {
             setActiveTouch(null);
             wsService.send('control', 'touch', { serial, action: 'up', x, y, width: rect.width, height: rect.height });
             addLog('warning', `Device ${serial}: Auto-release (Out of bounds)`);
        }
    }
    else if (type === 'down') {
      setActiveTouch(serial);
      wsService.send('control', 'touch', { serial, action: 'down', x, y, width: rect.width, height: rect.height });
      addLog('success', `Device ${serial}: Touch Down ${coordsStr}`);
    } 
    else if (type === 'move') {
        if (activeTouch === serial) {
           wsService.send('control', 'touch', { serial, action: 'move', x, y, width: rect.width, height: rect.height });
        }
    } 
    else if (type === 'up') {
      if (activeTouch === serial) {
          setActiveTouch(null);
          wsService.send('control', 'touch', { serial, action: 'up', x, y, width: rect.width, height: rect.height });
          addLog('info', `Device ${serial}: Touch Up ${coordsStr}`);
      }
    }
    else if (type === 'double') {
        wsService.send('control', 'touch', { serial, action: 'double', x, y, width: rect.width, height: rect.height });
        addLog('success', `Device ${serial}: Double Click executed`);
    }
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden select-none">
      {/* Stage Toolbar */}
      <div className="h-12 glass-panel border-b border-white/10 flex items-center justify-between px-6 shrink-0 relative z-20">
        <div className="flex bg-black/30 p-1 rounded-lg gap-1">
          {['all', 'online', 'offline'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1 rounded text-[10px] font-mono uppercase transition-all
                ${filterStatus === status ? 'bg-white/10 text-white font-bold' : 'text-slate-500 hover:text-slate-300'}
              `}
            >
              {t(`dashboard.${status}`)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
           <button 
             onClick={handleEnroll}
             className="w-8 h-8 rounded bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white transition-colors"
             title={t('dashboard.refresh')}
           >
              <i className="ph ph-arrows-clockwise"></i>
           </button>
           <button className="h-8 px-3 rounded bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/50 text-[#00f2ff] flex items-center gap-2 text-[10px] font-bold tracking-wider transition-colors">
              <i className="ph-bold ph-plus"></i> {t('dashboard.enroll_device')}
           </button>
        </div>
      </div>

      {/* Grid Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-6 custom-scrollbar relative"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Selection Box Overlay */}
        {selectionBox && (
          <div 
            className="absolute border border-[#00f2ff] bg-[#00f2ff]/10 pointer-events-none z-50"
            style={{
              left: Math.min(selectionBox.start.x, selectionBox.end.x),
              top: Math.min(selectionBox.start.y, selectionBox.end.y),
              width: Math.abs(selectionBox.end.x - selectionBox.start.x),
              height: Math.abs(selectionBox.end.y - selectionBox.start.y),
            }}
          ></div>
        )}

        <div className="flex flex-wrap content-start gap-6">
          {filtered.map(device => (
            <div
              key={device.serial}
              ref={el => { if (el) deviceRefs.current.set(device.serial, el); else deviceRefs.current.delete(device.serial); }}
              onClick={(e) => onSelectDevice(device, e.ctrlKey || e.metaKey)}
              onDoubleClick={() => onOpenDevice(device)}
              className={`
                device-card group relative bg-[#0a0c10]
                border rounded-2xl overflow-hidden transition-all duration-300
                hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:z-10
                flex flex-col h-[300px] w-[200px] select-none
                ${selectedIds.has(device.serial) 
                  ? 'border-[#00f2ff] shadow-[0_0_0_1px_#00f2ff,0_0_20px_rgba(0,242,255,0.2)]' 
                  : 'border-white/10 hover:border-white/30'}
                ${hoveredDevice === device.serial ? 'scale-[1.02]' : ''}
              `}
            >
              {/* Screen Area (Interactive) */}
              <div 
                className="flex-1 bg-black relative flex items-center justify-center overflow-hidden border-b border-white/5 cursor-crosshair"
                onMouseEnter={(e) => handleDeviceInteraction(e, device.serial, 'enter')}
                onMouseLeave={(e) => handleDeviceInteraction(e, device.serial, 'leave')}
                onMouseDown={(e) => handleDeviceInteraction(e, device.serial, 'down')}
                onMouseMove={(e) => handleDeviceInteraction(e, device.serial, 'move')}
                onMouseUp={(e) => handleDeviceInteraction(e, device.serial, 'up')}
                onDoubleClick={(e) => handleDeviceInteraction(e, device.serial, 'double')}
              >
                {device.status === 'online' ? (
                  <div className="w-full h-full relative flex flex-col items-center justify-center p-4 pointer-events-none">
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
                     <div className="font-mono text-[9px] text-[#00f2ff] tracking-[2px] mb-2 animate-pulse">{t('dashboard.establishing_link')}</div>
                     
                     {/* Progress Bar */}
                     <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#00f2ff] via-[#bd00ff] to-[#00f2ff] w-[60%] animate-[shimmer_1.5s_infinite]"></div>
                     </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-700 pointer-events-none">
                    <i className="ph ph-plugs text-3xl mb-2"></i>
                    <span className="text-[10px] font-mono tracking-widest">{t('dashboard.disconnected')}</span>
                  </div>
                )}
                
                {/* HUD Overlay */}
                <div className="absolute inset-0 p-3 pointer-events-none flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <span className="px-1.5 py-0.5 bg-black/80 border border-white/10 backdrop-blur rounded text-[9px] font-mono text-white/80">{device.serial}</span>
                    {device.status === 'online' && <span className="w-2 h-2 bg-[#05ffa1] rounded-full shadow-[0_0_10px_#05ffa1] animate-pulse"></span>}
                  </div>
                </div>
                
                {/* Interaction Feedback Point */}
                {activeTouch === device.serial && (
                   <div className="absolute inset-0 pointer-events-none z-50">
                     <div className="absolute top-2 right-2 w-2 h-2 bg-[#ff2a6d] rounded-full animate-ping"></div>
                     <div className="absolute bottom-2 left-2 text-[9px] font-mono text-[#ff2a6d] bg-black/50 px-1 rounded animate-pulse">TOUCH ACTIVE</div>
                   </div>
                )}
                
                {/* Hover Feedback */}
                {hoveredDevice === device.serial && !activeTouch && (
                   <div className="absolute inset-0 border border-[#00f2ff]/30 pointer-events-none bg-[#00f2ff]/5"></div>
                )}

                {/* Selection Check */}
                {selectedIds.has(device.serial) && (
                   <div className="absolute top-0 right-0 p-2 pointer-events-none">
                      <div className="w-5 h-5 bg-[#00f2ff] rounded flex items-center justify-center shadow-[0_0_10px_#00f2ff]">
                        <i className="ph-bold ph-check text-black text-xs"></i>
                      </div>
                   </div>
                )}
              </div>

              {/* Footer */}
              <div className="h-[45px] bg-[#0d0f14] flex items-center justify-between px-3 pointer-events-auto">
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
              <div className="absolute right-0 top-10 bottom-14 flex flex-col gap-1.5 p-2 translate-x-full opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300 ease-out z-20 pointer-events-auto">
                 {[
                   { icon: 'ph-eye', title: 'View', action: () => onOpenDevice(device), color: 'text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/20' },
                   { icon: 'ph-terminal-window', title: 'Shell', action: () => {}, color: 'text-[#05ffa1] border-[#05ffa1]/30 hover:bg-[#05ffa1]/20' },
                   { icon: 'ph-folder-open', title: 'Files', action: () => onQuickAction?.(device, 'files'), color: 'text-[#bd00ff] border-[#bd00ff]/30 hover:bg-[#bd00ff]/20' },
                   { icon: 'ph-camera', title: t('control.actions.snap'), action: () => {}, color: 'text-white border-white/30 hover:bg-white/20' },
                   { icon: 'ph-gear', title: 'Config', action: () => onQuickAction?.(device, 'config'), color: 'text-slate-300 border-white/20 hover:bg-white/10' },
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
        <div className="absolute bottom-8 left-8 glass-panel rounded-xl p-2 flex items-center gap-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-[#00f2ff]/30 animate-[float_0.3s_ease-out_forwards] z-40 pointer-events-auto">
          <div className="bg-[#00f2ff]/10 px-4 py-2 rounded-lg border border-[#00f2ff]/20 mr-2">
             <div className="text-xs text-[#00f2ff] font-bold">{t('dashboard.selected')}</div>
             <div className="text-lg font-mono text-white leading-none">{selectedIds.size}</div>
          </div>
          
          <div className="h-8 w-px bg-white/10 mx-1"></div>

          <div className="flex items-center gap-1">
            {[
              { id: 'home', icon: 'ph-house', label: t('control.actions.home') },
              { id: 'screenshot', icon: 'ph-camera', label: t('control.actions.snap') },
              { id: 'install', icon: 'ph-download-simple', label: 'Install' },
              { id: 'script', icon: 'ph-magic-wand', label: 'Script', color: 'text-[#bd00ff]' },
              { id: 'recording', icon: 'ph-video', label: t('control.actions.rec'), color: 'text-[#ff2a6d]' },
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
