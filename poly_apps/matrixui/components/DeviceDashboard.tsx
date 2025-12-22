




import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { Device, BatchActionType, DeviceLog } from '../types';
import { DeviceInfo } from '../types/api';
import { wsService } from '../services/websocket';
import { useI18n } from '../services/i18n';
import { DeviceVideoStream } from './DeviceVideoStream';
import { ShellDialog } from './ShellDialog';
import { useNotifications } from './Notification';
import { useConfirmDialog } from './ConfirmDialog';

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
  const [loading, setLoading] = useState(true);
  const [videoStreamEnabled, setVideoStreamEnabled] = useState<Map<string, boolean>>(new Map());
  const addLogRef = useRef(addLog);

  // Store stream info for each device
  const [deviceStreamInfo, setDeviceStreamInfo] = useState<Map<string, { width: number; height: number; fps: number; format: string }>>(new Map());

  // Zoomed device state (for layout change, NOT unmounting)
  const [zoomedDeviceId, setZoomedDeviceId] = useState<string | null>(null);

  // Dialog and notification state
  const [activeShellDialog, setActiveShellDialog] = useState<{ deviceId: string; deviceName?: string } | null>(null);
  const { notifications, showNotification, NotificationContainer } = useNotifications();
  const { showConfirmDialog, ConfirmDialogComponent } = useConfirmDialog();

  // ESC key to exit zoom
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && zoomedDeviceId) {
        setZoomedDeviceId(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [zoomedDeviceId]);

  // Update ref when addLog changes
  useEffect(() => {
    addLogRef.current = addLog;
  }, [addLog]);
  
  // Stable error handler for video streams (use ref to avoid recreating)
  const handleVideoStreamErrorRef = useRef<Map<string, (error: Error) => void>>(new Map());
  
  const getVideoStreamErrorHandler = useCallback((deviceId: string) => {
    if (!handleVideoStreamErrorRef.current.has(deviceId)) {
      handleVideoStreamErrorRef.current.set(deviceId, (error: Error) => {
        console.error(`[DeviceVideoStream] Error for ${deviceId}:`, error);
        addLogRef.current('error', `Video stream error for ${deviceId}: ${error.message}`);
      });
    }
    return handleVideoStreamErrorRef.current.get(deviceId)!;
  }, []);

  // Handle stream init callback
  const handleStreamInit = useCallback((deviceId: string, info: { width: number; height: number; fps: number; format: string }) => {
    setDeviceStreamInfo(prev => {
      const newMap = new Map(prev);
      newMap.set(deviceId, info);
      return newMap;
    });
  }, []);
  
  // Selection Box State
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ start: {x: number, y: number}, end: {x: number, y: number} } | null>(null);
  const deviceRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Fetch devices using RPC v2 API
  const fetchDevices = async () => {
    try {
      setLoading(true);
      if (!wsService.isRpcConnected()) {
        await wsService.connectRpc();
      }
      const result = await wsService.callRpc('adb.device.list', {});
      if (result && result.devices) {
        setWsDevices(result.devices);
        addLog('success', `Loaded ${result.devices.length} devices`);
      }
    } catch (error) {
      console.error('[DeviceDashboard] Failed to fetch devices:', error);
      addLog('error', `Failed to fetch devices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchDevices();

    // Listen for device updates via RPC events
    wsService.onRpcEvent('adb.devices.update', (data: any) => {
      if (data && data.devices) {
        console.log('[DeviceDashboard] Received adb.devices.update event:', data);
        // Ensure all devices have deviceId
        const devicesWithId = data.devices.map((d: any) => {
          if (!d.deviceId) {
            console.warn('[DeviceDashboard] Device missing deviceId in event, serial:', d.serial);
          }
          return d;
        });
        setWsDevices(devicesWithId);
        addLog('info', `Device list updated: ${data.devices.length} devices`);
      }
    });

    // Periodic refresh (every 10 seconds)
    const refreshInterval = setInterval(() => {
      fetchDevices();
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
      wsService.offRpcEvent('adb.devices.update');
    };
  }, []);

  const mappedDevices: Device[] = useMemo(() => {
    return wsDevices
      .filter(d => {
        // Filter out devices without deviceId (should not happen, but safety check)
        if (!d.deviceId) {
          console.warn('[DeviceDashboard] Device missing deviceId, skipping:', d);
          return false;
        }
        return true;
      })
      .map(d => {
        // Determine device status based on state or legacy status field
        let deviceStatus: 'online' | 'offline' | 'busy' = 'offline';
        
        if (d.state) {
          // Use new state field
          if (d.state === 'wifi_connected' || d.state === 'usb_connected') {
            deviceStatus = 'online';
          } else if (d.state === 'configuring') {
            deviceStatus = 'busy';
          } else {
            deviceStatus = 'offline';
          }
        } else if (d.status) {
          // Fallback to legacy status field
          deviceStatus = d.status === 'device' ? 'online' : 'offline'; 
        }
        
        // Validate deviceId format - must be "device_N" format, not serial
        if (!d.deviceId || (!d.deviceId.startsWith('device_') && d.deviceId.includes(':'))) {
          console.error(`[DeviceDashboard] Invalid deviceId format: ${d.deviceId}. Expected "device_1" format, got what looks like serial: ${d.serial}`);
          // Fallback: skip this device or use serial as deviceId (will cause error but at least we log it)
        }
        
        return {
          deviceId: d.deviceId, // MUST use deviceId from API (required for video streaming) - format: "device_1", "device_2", etc.
          serial: d.serial,
          model: d.model || 'Unknown',
          version: d.android_version || 'unknown',
          status: deviceStatus,
          battery: 85, // TODO: Get from device info
          resolution: '1080x2400', // TODO: Get from device info
          groupId: 'root',
          tags: [],
          ip: d.ip || d.serial || '192.168.1.x',
          ping: 25, // TODO: Get from device info
          name: d.model || d.serial,
          manufacturer: d.manufacturer || 'Unknown'
        };
      });
  }, [wsDevices]);

  const filtered = useMemo(() => {
    if (filterStatus === 'online') return mappedDevices.filter(d => d.status === 'online');
    if (filterStatus === 'offline') return mappedDevices.filter(d => d.status !== 'online');
    return mappedDevices;
  }, [mappedDevices, filterStatus]);

  const handleEnroll = async () => {
    await fetchDevices();
  };

  // --- Box Selection Logic ---

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
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
          {loading && filtered.length === 0 ? (
            <div className="w-full flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#00f2ff] animate-spin"></div>
                  <div className="absolute inset-2 rounded-full border-2 border-transparent border-l-[#bd00ff] animate-[spin_1.5s_linear_infinite_reverse]"></div>
                </div>
                <span className="text-slate-400 font-mono text-sm">Loading devices...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="w-full flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-2 text-slate-500">
                <i className="ph ph-devices text-4xl"></i>
                <span className="font-mono text-sm">No devices found</span>
              </div>
            </div>
          ) : (
            filtered.map(device => (
            <div
              key={device.serial}
              ref={el => { if (el) deviceRefs.current.set(device.serial, el); else deviceRefs.current.delete(device.serial); }}
              className={`
                device-card group relative bg-[#0a0c10]
                border rounded-2xl transition-all duration-300
                flex flex-col select-none
                ${zoomedDeviceId === device.deviceId
                  ? 'fixed inset-4 z-50 w-auto h-auto shadow-[0_0_0_100vmax_rgba(0,0,0,0.8)]'
                  : zoomedDeviceId
                    ? 'h-[160px] w-[100px] opacity-50'
                    : 'h-[320px] w-[200px] hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:z-10'
                }
                ${selectedIds.has(device.serial)
                  ? 'border-[#00f2ff] shadow-[0_0_0_1px_#00f2ff,0_0_20px_rgba(0,242,255,0.2)]'
                  : 'border-white/10 hover:border-white/30'}
              `}
            >
              {/* Top Info Bar - Clickable for selection */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDevice(device, e.ctrlKey || e.metaKey);
                }}
                className={`bg-[#0d0f14] border-b border-white/5 flex items-center justify-between px-3 pointer-events-auto shrink-0 cursor-pointer hover:bg-white/5 transition-colors rounded-t-2xl ${zoomedDeviceId === device.deviceId ? 'h-16' : 'h-[32px]'}`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Selection Checkbox */}
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                      selectedIds.has(device.serial)
                        ? 'bg-[#00f2ff] border-[#00f2ff] shadow-[0_0_8px_#00f2ff]'
                        : 'border-white/30 hover:border-white/50'
                    }`}
                  >
                    {selectedIds.has(device.serial) && (
                      <i className="ph-bold ph-check text-black text-[10px]"></i>
                    )}
                  </div>

                  {zoomedDeviceId === device.deviceId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomedDeviceId(null);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors text-sm"
                    >
                      <i className="ph ph-arrow-left"></i>
                      <span>Back</span>
                    </button>
                  )}
                  <span className={`font-mono text-white/60 truncate ${zoomedDeviceId === device.deviceId ? 'text-sm' : 'text-[9px]'}`}>{device.ip || device.serial}</span>
                  {device.status === 'online' && (
                    <span className="w-1.5 h-1.5 bg-[#05ffa1] rounded-full shadow-[0_0_8px_#05ffa1] animate-pulse"></span>
                  )}
                  {deviceStreamInfo.get(device.deviceId) && (
                    <span className={`font-mono text-slate-400 ${zoomedDeviceId === device.deviceId ? 'text-xs' : 'text-[8px]'}`}>
                      {deviceStreamInfo.get(device.deviceId)!.width}x{deviceStreamInfo.get(device.deviceId)!.height} @ {deviceStreamInfo.get(device.deviceId)!.fps}fps
                    </span>
                  )}
                </div>
                <span className={`font-mono text-slate-500 ${zoomedDeviceId === device.deviceId ? 'text-xs' : 'text-[8px]'}`}>{device.serial.slice(-6)}</span>
              </div>

              {/* Screen Area (Interactive) - Video fills this area */}
              <div
                className="flex-1 bg-black relative overflow-hidden"
              >
                {device.status === 'online' ? (
                  <DeviceVideoStream
                    key={`video-${device.serial}`} // CRITICAL: Use serial (stable identifier) to prevent unmount on device info updates
                    deviceId={device.deviceId}
                    enabled={videoStreamEnabledRef.current.get(device.deviceId) ?? true}
                    onError={getVideoStreamErrorHandler(device.deviceId)}
                    onInit={(info) => handleStreamInit(device.deviceId, info)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-700 pointer-events-none">
                    <i className="ph ph-plugs text-3xl mb-2"></i>
                    <span className="text-[10px] font-mono tracking-widest">{t('dashboard.disconnected')}</span>
                  </div>
                )}

              </div>

              {/* Footer - Bottom Toolbar - Clickable for selection */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectDevice(device, e.ctrlKey || e.metaKey);
                }}
                className="h-[40px] bg-[#0d0f14] border-t border-white/5 flex items-center justify-between px-3 pointer-events-auto shrink-0 cursor-pointer hover:bg-white/5 transition-colors rounded-b-2xl"
              >
                <div className="flex flex-col flex-1 min-w-0">
                   <span className="text-[10px] font-bold text-slate-200 truncate">{device.name}</span>
                   <div className="flex items-center gap-1.5">
                     <span className="text-[8px] font-mono text-slate-500">{device.manufacturer || 'Unknown'}</span>
                     <span className="text-[7px] text-slate-600">•</span>
                     <span className="text-[8px] font-mono text-slate-500">Android {device.version}</span>
                   </div>
                </div>
                <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded border border-white/5 ml-2">
                   <i className={`ph-fill ph-wifi-high text-[10px] ${device.status === 'online' ? 'text-[#05ffa1]' : 'text-slate-600'}`}></i>
                   <span className="text-[8px] font-mono text-slate-400">{device.ping}ms</span>
                </div>
              </div>

              {/* Enhanced Sidebar Tools Slide-out - 在卡片右边外面，不遮挡视频 */}
              <div className="absolute -right-10 top-12 bottom-12 flex flex-col gap-1.5 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out z-20 pointer-events-none group-hover:pointer-events-auto">
                 {[
                   { 
                     icon: 'ph-arrows-out', 
                     title: '大屏', 
                     action: () => { 
                       setZoomedDeviceId(zoomedDeviceId === device.deviceId ? null : device.deviceId); 
                       addLog('info', `Toggled zoom for ${device.name || device.serial}`); 
                     }, 
                     color: 'text-[#ffd60a] border-[#ffd60a]/30 hover:bg-[#ffd60a]/20' 
                   },
                   { 
                     icon: 'ph-eye', 
                     title: 'View', 
                     action: () => onOpenDevice(device), 
                     color: 'text-[#00f2ff] border-[#00f2ff]/30 hover:bg-[#00f2ff]/20' 
                   },
                   { 
                     icon: 'ph-terminal-window', 
                     title: 'Shell', 
                     action: async () => {
                       setActiveShellDialog({ deviceId: device.deviceId, deviceName: device.name || device.serial });
                     }, 
                     color: 'text-[#05ffa1] border-[#05ffa1]/30 hover:bg-[#05ffa1]/20' 
                   },
                   { 
                     icon: 'ph-folder-open', 
                     title: 'Files', 
                     action: () => onQuickAction?.(device, 'files'), 
                     color: 'text-[#bd00ff] border-[#bd00ff]/30 hover:bg-[#bd00ff]/20' 
                   },
                   { 
                     icon: 'ph-camera', 
                     title: t('control.actions.snap'), 
                     action: async () => {
                       try {
                         if (!wsService.isRpcConnected()) {
                           await wsService.connectRpc();
                         }
                         showNotification('info', 'Capturing screenshot...', 2000);
                         const result = await wsService.callRpcV2('screenshot.capture', {
                           deviceId: device.deviceId,
                           format: 'png'
                         });
                         if (result && result.success) {
                           showNotification('success', `Screenshot saved: ${result.filePath || 'Success'}`);
                           addLog('success', `Screenshot captured for ${device.name || device.serial}`);
                         } else {
                           throw new Error(result?.error?.message || 'Screenshot failed');
                         }
                       } catch (error) {
                         const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                         showNotification('error', `Screenshot failed: ${errorMsg}`);
                         addLog('error', `Screenshot failed for ${device.name || device.serial}: ${errorMsg}`);
                       }
                     }, 
                     color: 'text-white border-white/30 hover:bg-white/20' 
                   },
                   { 
                     icon: 'ph-gear', 
                     title: 'Config', 
                     action: () => onQuickAction?.(device, 'config'), 
                     color: 'text-slate-300 border-white/20 hover:bg-white/10' 
                   },
                   { 
                     icon: 'ph-power', 
                     title: 'Reboot', 
                     action: async () => {
                       const confirmed = await showConfirmDialog({
                         title: 'Reboot Device',
                         message: `Are you sure you want to reboot ${device.name || device.serial}? This action cannot be undone.`,
                         confirmText: 'Reboot',
                         cancelText: 'Cancel',
                         type: 'danger'
                       });
                       if (confirmed) {
                         try {
                           if (!wsService.isRpcConnected()) {
                             await wsService.connectRpc();
                           }
                           showNotification('info', 'Sending reboot command...', 2000);
                           const result = await wsService.callRpcV2('control.reboot', {
                             deviceId: device.deviceId
                           });
                           if (result && result.success) {
                             showNotification('success', 'Reboot command sent successfully');
                             addLog('success', `Reboot command sent to ${device.name || device.serial}`);
                           } else {
                             throw new Error(result?.error?.message || 'Reboot failed');
                           }
                         } catch (error) {
                           const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                           showNotification('error', `Reboot failed: ${errorMsg}`);
                           addLog('error', `Reboot failed for ${device.name || device.serial}: ${errorMsg}`);
                         }
                       }
                     }, 
                     color: 'text-[#ff2a6d] border-[#ff2a6d]/30 hover:bg-[#ff2a6d]/20' 
                   },
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
            ))
          )}
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

      {/* Shell Dialog */}
      {activeShellDialog && (
        <ShellDialog
          deviceId={activeShellDialog.deviceId}
          deviceName={activeShellDialog.deviceName}
          onClose={() => setActiveShellDialog(null)}
        />
      )}

      {/* Notification Container */}
      <NotificationContainer />

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}

    </div>
  );
};
