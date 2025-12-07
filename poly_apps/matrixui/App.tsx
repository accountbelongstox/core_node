




import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Navigation';
import { DeviceDashboard } from './components/DeviceDashboard';
import { DeviceControl } from './components/DeviceControl';
import { BottomToolbar } from './components/BottomToolbar';
import { ScriptLibrary } from './components/ScriptLibrary'; 
import { FileManager } from './components/FileManager';
import { MediaGallery } from './components/MediaGallery'; // Import MediaGallery
import { DeviceConfigModal } from './components/DeviceConfigModal'; // Import DeviceConfigModal
import { Device, DeviceGroup, DeviceLog, BatchActionType, StreamConfig } from './types';
import { I18nProvider, useI18n } from './services/i18n';
import { wsService } from './services/websocket';

// --- Mock Groups Data ---
const MOCK_GROUPS: DeviceGroup[] = [
  {
    id: 'g1', name: 'Marketing Farm', parentId: 'root',
    children: [
       { id: 'g1-1', name: 'Instagram A', parentId: 'g1' },
       { id: 'g1-2', name: 'TikTok B', parentId: 'g1' }
    ]
  },
  { id: 'g2', name: 'Testing Lab', parentId: 'root' },
  { id: 'g3', name: 'Gaming', parentId: 'root' }
];

// Inner App Component
const MatrixApp: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  
  // Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  
  // Modal/Panel State
  const [showSettings, setShowSettings] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [showFileManager, setShowFileManager] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false); // New State
  const [fileManagerTarget, setFileManagerTarget] = useState<string | null>(null);
  const [deviceConfigTarget, setDeviceConfigTarget] = useState<Device | null>(null); // New State

  // Data State
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Selection & Control State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);
  const [isFullView, setIsFullView] = useState(false);
  
  // Group Control State
  const [isSyncMode, setIsSyncMode] = useState(false);

  // Settings State
  const [settingsForm, setSettingsForm] = useState({
    viewMode: 'grid',
    protocol: 'adb',
    autoConnect: true,
    proxy: false,
    theme: 'cyber',
    search: ''
  });

  // Stream Config State (Alignment v2.0)
  const [streamConfig, setStreamConfig] = useState<StreamConfig>({
    max_size: 720,
    bit_rate: 4000000,
    max_fps: 60,
    codec: 'h264',
    locked_video_orientation: -1
  });

  // Logs
  const [logs, setLogs] = useState<DeviceLog[]>([
    { time: '10:00:01', type: 'info', msg: 'System initialized' },
    { time: '10:00:02', type: 'success', msg: 'Connected to Cloud Matrix' },
  ]);

  useEffect(() => {
    wsService.connect();
  }, []);

  useEffect(() => {
    // Set document title dynamically
    document.title = t('app.title');
  }, [language, t]);

  const addLog = (type: DeviceLog['type'], msg: string) => {
    const now = new Date();
    const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    setLogs(prev => [...prev, { time, type, msg }].slice(-50));
  };

  const handleSelectDevice = (device: Device, multi: boolean) => {
    const newSet = new Set(multi ? selectedIds : []);
    if (newSet.has(device.serial)) {
        newSet.delete(device.serial);
    } else {
        newSet.add(device.serial);
    }
    setSelectedIds(newSet);
    setActiveDevice(device);
  };

  const handleOpenDevice = (device: Device) => {
     setActiveDevice(device);
     setIsFullView(true);
  };

  // Handler for quick actions from device card
  const handleDeviceQuickAction = (device: Device, action: string) => {
    if (action === 'files') {
      setFileManagerTarget(device.serial);
      setShowFileManager(true);
      setShowScripts(false);
      setShowSettings(false);
      setShowMediaGallery(false);
    } else if (action === 'config') {
      setDeviceConfigTarget(device);
    }
  };

  const handleDeviceConfigSave = (serial: string, config: Partial<StreamConfig>) => {
    addLog('success', `Config updated for ${serial}`);
    // Here you would call wsService.send('config', 'update_device', ...)
  };

  const handleBatchAction = (action: BatchActionType, payload?: any) => {
     addLog('success', `Action ${action} initiated on ${selectedIds.size > 0 ? selectedIds.size : 'ALL'} devices`);
     wsService.send('group', 'batch_action', { 
       action, 
       serials: Array.from(selectedIds),
       payload 
     });
  };

  const handleScriptExecution = (scriptId: string) => {
     addLog('info', `Starting script execution: ${scriptId}`);
     handleBatchAction('script', { scriptId });
  };

  // Nav Handlers
  const handleNavClick = (view: string) => {
    // Reset overlays
    setShowFileManager(false);
    setShowScripts(false);
    setShowMediaGallery(false);
    setShowSettings(false);

    if (view === 'files') {
      setFileManagerTarget(null); 
      setShowFileManager(true);
    } else if (view === 'matrix') {
       // Just close others
    } else if (view === 'media') {
       setShowMediaGallery(true);
    }
  };

  const SettingsPanel = () => (
    <div 
      className={`
        fixed inset-y-0 right-0 bg-[#0a0c10]/95 backdrop-blur-2xl border-l border-white/10 z-50 transform transition-all duration-300
        ${showSettings || showScripts ? 'translate-x-0' : 'translate-x-full'}
        ${showScripts ? 'w-[800px]' : 'w-[400px]'} 
      `}
    >
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6">
        <h2 className="text-[#00f2ff] font-bold tracking-widest text-lg">
          {showScripts ? t('scripts.library') : t('settings.title')}
        </h2>
        <button onClick={() => { setShowSettings(false); setShowScripts(false); }} className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white"><i className="ph ph-x"></i></button>
      </div>
      
      <div className={`h-[calc(100vh-64px)] ${showScripts ? 'overflow-hidden' : 'overflow-y-auto p-6'}`}>
        {showScripts ? (
           <ScriptLibrary 
             selectedCount={selectedIds.size}
             onExecute={handleScriptExecution}
           />
        ) : (
          <div className="space-y-8">
            {/* Language Selection */}
            <div>
               <label className="block text-xs font-mono text-[#00f2ff] mb-2 tracking-widest">{t('app.language_label')}</label>
               <div className="flex gap-2">
                 {['zh-CN', 'en-US'].map(lang => (
                   <button 
                     key={lang}
                     onClick={() => setLanguage(lang as any)}
                     className={`px-3 py-1.5 rounded text-xs border ${language === lang ? 'bg-[#00f2ff]/20 border-[#00f2ff] text-white' : 'border-white/10 text-slate-400'}`}
                   >
                     {lang}
                   </button>
                 ))}
               </div>
            </div>

            {/* Stream Configuration (New) */}
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 border-b border-white/10 pb-1">
                {t('settings.stream_config')}
              </div>
              
              <div className="space-y-4">
                {/* Max Size */}
                <div>
                   <label className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{t('settings.resolution')}</span>
                      <span className="text-white font-mono">{streamConfig.max_size}p</span>
                   </label>
                   <input 
                     type="range" min="360" max="1080" step="120"
                     value={streamConfig.max_size}
                     onChange={(e) => setStreamConfig({...streamConfig, max_size: parseInt(e.target.value)})}
                     className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
                   />
                </div>

                {/* Bitrate */}
                <div>
                   <label className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>{t('settings.bitrate')}</span>
                      <span className="text-white font-mono">{streamConfig.bit_rate / 1000000} Mbps</span>
                   </label>
                   <input 
                     type="range" min="500000" max="8000000" step="500000"
                     value={streamConfig.bit_rate}
                     onChange={(e) => setStreamConfig({...streamConfig, bit_rate: parseInt(e.target.value)})}
                     className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#00f2ff]"
                   />
                </div>

                {/* FPS */}
                <div>
                   <label className="block text-xs text-slate-400 mb-2">{t('settings.fps')}</label>
                   <div className="grid grid-cols-3 gap-2">
                      {[30, 60, 90].map(fps => (
                        <button 
                          key={fps}
                          onClick={() => setStreamConfig({...streamConfig, max_fps: fps})}
                          className={`py-1 rounded border text-xs ${streamConfig.max_fps === fps ? 'bg-[#00f2ff]/20 border-[#00f2ff] text-white' : 'border-white/10 text-slate-500'}`}
                        >
                          {fps}
                        </button>
                      ))}
                   </div>
                </div>

                {/* Codec */}
                <div>
                   <label className="block text-xs text-slate-400 mb-2">{t('settings.codec')}</label>
                   <select 
                      value={streamConfig.codec}
                      onChange={(e) => setStreamConfig({...streamConfig, codec: e.target.value as any})}
                      className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
                   >
                      <option value="h264">{t('app.codec_h264')}</option>
                      <option value="h265">{t('app.codec_h265')}</option>
                      <option value="av1">{t('app.codec_av1')}</option>
                   </select>
                </div>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-4">
              <label className="block text-xs font-mono text-[#00f2ff] mb-2 tracking-widest">{t('settings.protocol')}</label>
               <select 
                  value={settingsForm.protocol}
                  onChange={(e) => setSettingsForm({...settingsForm, protocol: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
               >
                  <option value="adb">{t('app.protocol_unified')}</option>
                  <option value="ws">{t('app.protocol_raw')}</option>
               </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full bg-transparent">
      {/* Settings & Stats Overlays */}
      <SettingsPanel />

      {/* Device Config Modal */}
      {deviceConfigTarget && (
        <DeviceConfigModal 
          device={deviceConfigTarget}
          onClose={() => setDeviceConfigTarget(null)}
          onSave={handleDeviceConfigSave}
        />
      )}

      {/* Header */}
      <header className="h-[60px] glass-panel border-b border-white/10 flex items-center justify-between px-6 shrink-0 relative z-30">
        <div className="flex items-center gap-4">
           {/* Logo */}
           <div className="w-8 h-8 bg-gradient-to-br from-[#00f2ff] to-[#bd00ff] flex items-center justify-center relative shadow-[0_0_15px_rgba(0,242,255,0.3)]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
              <div className="absolute inset-[2px] bg-black" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
              <div className="w-2 h-2 bg-[#00f2ff] rounded-full z-10 animate-pulse"></div>
           </div>
           <div>
              <div className="text-white font-bold tracking-[2px] text-sm">{t('app.title')}</div>
              <div className="text-[9px] text-[#00f2ff] tracking-widest opacity-80">{t('app.subtitle')}</div>
           </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={() => { setShowScripts(true); setShowSettings(false); }}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#bd00ff]/20 hover:border-[#bd00ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
              >
                <i className="ph ph-scroll"></i> {t('nav.scripts')}
              </button>
              <button 
                onClick={() => { setShowSettings(true); setShowScripts(false); }}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
              >
                <i className="ph ph-gear"></i> {t('settings.title')}
              </button>
           </div>

           <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                 <div className="text-xs font-bold text-white">{t('app.admin')}</div>
                 <div className="text-[9px] text-slate-500">{t('app.level_access')}</div>
              </div>
              <div className="w-8 h-8 bg-[#bd00ff] rounded-full flex items-center justify-center text-xs font-bold text-white shadow-[0_0_10px_#bd00ff]">
                 A
              </div>
           </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden relative z-20">
         <Sidebar 
           groups={MOCK_GROUPS}
           selectedGroupId={selectedGroupId}
           onSelectGroup={setSelectedGroupId}
           collapsed={sidebarCollapsed}
           setCollapsed={setSidebarCollapsed}
           onNavigate={handleNavClick}
         />
         
         {/* Main Content Area */}
         <main className="flex-1 overflow-hidden relative flex flex-col transition-all duration-300 bg-gradient-to-br from-white/[0.02] to-transparent pb-32">
             {showFileManager ? (
                <FileManager 
                   targetDeviceSerial={fileManagerTarget} 
                   onClose={() => setShowFileManager(false)} 
                />
             ) : showMediaGallery ? (
                <MediaGallery onClose={() => setShowMediaGallery(false)} />
             ) : (
                <DeviceDashboard 
                  selectedIds={selectedIds}
                  onSelectDevice={handleSelectDevice}
                  onOpenDevice={handleOpenDevice}
                  onBatchAction={handleBatchAction}
                  onQuickAction={handleDeviceQuickAction} 
                  filterStatus={filterStatus}
                  setFilterStatus={setFilterStatus}
                  addLog={addLog}
               />
             )}
         </main>
         
         <DeviceControl 
            device={activeDevice}
            logs={logs}
            collapsed={inspectorCollapsed}
            setCollapsed={setInspectorCollapsed}
            isFullView={isFullView}
            onCloseFullView={() => setIsFullView(false)}
         />
      </div>

      <BottomToolbar 
         selectedCount={selectedIds.size}
         isSyncMode={isSyncMode}
         toggleSyncMode={() => setIsSyncMode(!isSyncMode)}
         onAction={handleBatchAction}
         logs={logs}
      />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <I18nProvider>
      <MatrixApp />
    </I18nProvider>
  );
};

export default App;