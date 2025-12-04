import React, { useState, useEffect } from 'react';
import { AppProvider, useAppStore } from './store';
import { Sidebar } from './components/Navigation';
import { DeviceDashboard } from './components/DeviceDashboard';
import { DeviceControl } from './components/DeviceControl';
import { ManagementPanel } from './components/ManagementPanel';
import { Device, DeviceGroup, DeviceLog, BatchActionType } from './types';
import { useTranslation } from './services/i18n';
import { wsClient } from './services/websocket/client';
import { apiClient } from './services/api/client';

// --- Mock Data (will be replaced by API) ---
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

const generateMockDevices = (count: number): Device[] => {
  return Array.from({ length: count }).map((_, i) => ({
    serial: `D-2025-${1000 + i}`,
    model: i % 3 === 0 ? 'Pixel 7' : i % 2 === 0 ? 'Samsung S23' : 'Xiaomi 13',
    version: '13.0',
    status: Math.random() > 0.1 ? 'online' : 'offline',
    battery: Math.floor(Math.random() * 80 + 20),
    resolution: '1080x2400',
    groupId: i < 5 ? 'g1-1' : 'g2',
    tags: ['farm', 'eu-west'],
    ip: `192.168.1.${100 + i}`,
    ping: Math.floor(Math.random() * 40 + 5),
    name: `Node-${String(i).padStart(3, '0')}`
  }));
};

const MOCK_DEVICES = generateMockDevices(24);

// Main App Content
const AppContent: React.FC = () => {
  const { t } = useTranslation();
  const { state, dispatch, loadDevices, loadGroups } = useAppStore();
  
  // Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  
  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    viewMode: 'grid',
    protocol: 'adb',
    autoConnect: true,
    proxy: false,
    theme: 'cyber',
    search: ''
  });

  // Load data on mount
  useEffect(() => {
    loadDevices();
    loadGroups();
  }, []);

  // Set up WebSocket listeners for device updates
  useEffect(() => {
    const handleDeviceUpdate = (response: any) => {
      if (response.data?.device) {
        dispatch({ type: 'UPDATE_DEVICE', payload: response.data.device });
      }
    };

    wsClient.on('device', '*', handleDeviceUpdate);

    return () => {
      wsClient.off('device', '*', handleDeviceUpdate);
    };
  }, []);

  const handleSelectDevice = (device: Device, multi: boolean) => {
    dispatch({
      type: 'SELECT_DEVICE',
      payload: { serial: device.serial, multi },
    });
    dispatch({ type: 'SET_ACTIVE_DEVICE', payload: device });
  };

  const handleOpenDevice = (device: Device) => {
    dispatch({ type: 'SET_ACTIVE_DEVICE', payload: device });
    dispatch({ type: 'SET_FULL_VIEW', payload: true });
  };

  const handleBatchAction = async (action: BatchActionType) => {
    const selectedSerials = Array.from(state.selectedDeviceIds);
    if (selectedSerials.length === 0) return;

    try {
      // Use WebSocket for batch actions
      for (const serial of selectedSerials) {
        switch (action) {
          case 'screenshot':
            await wsClient.send({
              namespace: 'screen',
              action: 'screenshot',
              data: { serial },
            });
            break;
          case 'home':
            await wsClient.controlSystemKey(serial, 3);
            break;
          case 'back':
            await wsClient.controlSystemKey(serial, 4);
            break;
          case 'power':
            await wsClient.screenPower(serial, 'toggle');
            break;
        }
      }

      dispatch({
        type: 'ADD_LOG',
        payload: {
          time: new Date().toLocaleTimeString(),
          type: 'success',
          msg: `${t('device.actions.' + action)} ${t('common.success')} on ${selectedSerials.length} devices`,
        },
      });
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

  const displayDevices = (state.devices.length > 0 ? state.devices : MOCK_DEVICES).filter((d) => {
    if (state.selectedGroupId && d.groupId !== state.selectedGroupId) {
      if (state.selectedGroupId === 'g1' && !d.groupId.startsWith('g1')) {
        return false;
      }
      return false;
    }
    if (state.filterStatus !== 'all' && d.status !== state.filterStatus) {
      return false;
    }
    return true;
  });

  // --- Components for Overlays ---

  const SettingsPanel = () => (
    <div className={`fixed inset-y-0 right-0 w-[400px] backdrop-blur-2xl border-l border-white/10 z-50 transform transition-transform duration-300 ${showSettings || showScripts ? 'translate-x-0' : 'translate-x-full'}`} style={{ backgroundColor: 'var(--bg-panel-transparent)' }}>
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6">
        <h2 className="font-bold tracking-widest text-lg" style={{ color: 'var(--cyan)' }}>{showScripts ? 'SCRIPT ENGINE' : 'SYSTEM CONFIG'}</h2>
        <button onClick={() => { setShowSettings(false); setShowScripts(false); }} className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white"><i className="ph ph-x"></i></button>
      </div>
      
      <div className="p-6 overflow-y-auto h-[calc(100vh-64px)] custom-scrollbar">
        {showScripts ? (
           <div className="space-y-6">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                 <label className="block text-xs font-mono text-slate-400 mb-2">SCRIPT SOURCE</label>
                 <select className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white outline-none" style={{ '--tw-ring-color': 'var(--cyan)' } as any}>
                    <option>Daily_Checkin_V2.py</option>
                    <option>Auto_Reply_Bot.js</option>
                    <option>Device_Health_Check.sh</option>
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-mono text-slate-400 mb-2">TARGET GROUP</label>
                 <div className="flex flex-col gap-2">
                    {['All Online', 'Selected Only', 'Specific Group'].map(opt => (
                       <label key={opt} className="flex items-center gap-3 p-3 rounded bg-white/5 border border-white/10 cursor-pointer hover:border-white/30">
                          <input type="radio" name="script_target" style={{ accentColor: 'var(--cyan)' }} />
                          <span className="text-sm">{opt}</span>
                       </label>
                    ))}
                 </div>
              </div>
              <button className="w-full py-3 border font-bold tracking-widest transition-all rounded" style={{ backgroundColor: 'var(--cyan-dim)', borderColor: 'rgba(0, 242, 255, 0.5)', color: 'var(--cyan)' }}>
                 EXECUTE SCRIPT
              </button>
           </div>
        ) : (
          <div className="space-y-8">
            {/* Search */}
            <div>
              <label className="block text-xs font-mono mb-2 tracking-widest" style={{ color: 'var(--cyan)' }}>GLOBAL SEARCH</label>
              <div className="relative">
                <i className="ph ph-magnifying-glass absolute left-3 top-2.5 text-slate-500"></i>
                <input 
                  type="text" 
                  value={settingsForm.search}
                  onChange={(e) => setSettingsForm({...settingsForm, search: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 pl-9 text-sm text-white outline-none transition-colors"
                  placeholder={t('common.search')}
                  style={{ '--tw-ring-color': 'var(--cyan)' } as any}
                />
              </div>
            </div>

            {/* View Mode (Radio) */}
            <div>
              <label className="block text-xs font-mono mb-3 tracking-widest" style={{ color: 'var(--cyan)' }}>VIEW PREFERENCE</label>
              <div className="grid grid-cols-2 gap-3">
                 {['grid', 'list', 'compact', 'map'].map(mode => (
                    <label key={mode} className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${settingsForm.viewMode === mode ? 'text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'}`} style={settingsForm.viewMode === mode ? { backgroundColor: 'var(--cyan-dim)', borderColor: 'var(--cyan)' } : {}}>
                       <span className="capitalize text-sm font-medium">{mode}</span>
                       <input 
                         type="radio" 
                         name="viewMode" 
                         value={mode}
                         checked={settingsForm.viewMode === mode}
                         onChange={(e) => setSettingsForm({...settingsForm, viewMode: e.target.value})}
                         style={{ accentColor: 'var(--cyan)' }}
                       />
                    </label>
                 ))}
              </div>
            </div>

            {/* Protocol (Select) */}
            <div>
               <label className="block text-xs font-mono mb-2 tracking-widest" style={{ color: 'var(--cyan)' }}>CONNECTION PROTOCOL</label>
               <select 
                  value={settingsForm.protocol}
                  onChange={(e) => setSettingsForm({...settingsForm, protocol: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white outline-none"
                  style={{ '--tw-ring-color': 'var(--cyan)' } as any}
               >
                  <option value="adb">ADB Bridge (Default)</option>
                  <option value="ws">WebSocket Secure</option>
                  <option value="http">HTTP Long-Polling</option>
               </select>
            </div>

            {/* Toggles (Checkbox) */}
            <div>
              <label className="block text-xs font-mono mb-3 tracking-widest" style={{ color: 'var(--cyan)' }}>ADVANCED OPTIONS</label>
              <div className="space-y-3">
                 <label className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10 cursor-pointer">
                    <span className="text-sm">Auto-reconnect on drop</span>
                    <input type="checkbox" checked={settingsForm.autoConnect} onChange={() => setSettingsForm({...settingsForm, autoConnect: !settingsForm.autoConnect})} className="w-4 h-4 rounded bg-white/10 border-white/20" style={{ accentColor: 'var(--cyan)' }} />
                 </label>
                 <label className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10 cursor-pointer">
                    <span className="text-sm">Use Global Proxy</span>
                    <input type="checkbox" checked={settingsForm.proxy} onChange={() => setSettingsForm({...settingsForm, proxy: !settingsForm.proxy})} className="w-4 h-4 rounded bg-white/10 border-white/20" style={{ accentColor: 'var(--cyan)' }} />
                 </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const StatsCenter = () => (
     <div className={`fixed inset-0 backdrop-blur-xl z-[60] transition-transform duration-500 flex flex-col ${showStats ? 'translate-y-0' : 'translate-y-full'}`} style={{ backgroundColor: 'rgba(3, 3, 5, 0.95)' }}>
        <div className="h-20 border-b border-white/10 flex items-center justify-between px-10 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 mask-hex flex items-center justify-center" style={{ backgroundColor: 'var(--cyan)' }}><i className="ph-bold ph-chart-line text-black text-xl"></i></div>
              <div>
                 <h1 className="text-2xl font-bold tracking-widest text-white">DATA CENTER</h1>
                 <p className="text-xs font-mono" style={{ color: 'var(--cyan)' }}>REAL-TIME ANALYTICS MATRIX</p>
              </div>
           </div>
           <button onClick={() => setShowStats(false)} className="px-6 py-2 border border-white/20 hover:bg-white/10 rounded text-sm text-white transition-colors">{t('common.close').toUpperCase()}</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                 { label: 'ACTIVE NODES', val: '24', sub: '100% Online', color: 'var(--success)' },
                 { label: 'THROUGHPUT', val: '4.2 GB/s', sub: '+12% vs last hour', color: 'var(--cyan)' },
                 { label: 'ERROR RATE', val: '0.02%', sub: 'Within limits', color: 'var(--success)' },
                 { label: 'CPU LOAD', val: '45%', sub: 'Cluster Average', color: 'var(--purple)' },
              ].map((stat, i) => (
                 <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
                    <div className="text-[10px] text-slate-400 font-mono tracking-widest mb-2">{stat.label}</div>
                    <div className="text-4xl font-bold mb-2" style={{ color: stat.color }}>{stat.val}</div>
                    <div className="text-xs text-slate-500">{stat.sub}</div>
                 </div>
              ))}
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
              <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-xl p-6 relative overflow-hidden">
                 <div className="text-xs font-bold tracking-widest mb-6" style={{ color: 'var(--cyan)' }}>NETWORK TRAFFIC HISTORY</div>
                 <div className="absolute inset-x-0 bottom-0 top-16 flex items-end justify-between px-6 pb-6 gap-1">
                    {Array.from({length: 40}).map((_, i) => (
                       <div key={i} className="flex-1 bg-gradient-to-t transition-all" style={{ height: `${Math.random() * 80 + 10}%`, borderRadius: '2px 2px 0 0', background: 'linear-gradient(to top, rgba(0, 242, 255, 0.4), transparent)' }}></div>
                    ))}
                 </div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-6">
                 <div className="text-xs font-bold tracking-widest mb-6" style={{ color: 'var(--purple)' }}>DEVICE DISTRIBUTION</div>
                 <div className="space-y-4">
                    {[
                       { name: 'Pixel Farm', val: 45, color: 'var(--cyan)' },
                       { name: 'Samsung Grid', val: 30, color: 'var(--purple)' },
                       { name: 'Xiaomi Cluster', val: 15, color: 'var(--success)' },
                       { name: 'Other', val: 10, color: '#ffffff' },
                    ].map(d => (
                       <div key={d.name}>
                          <div className="flex justify-between text-xs text-slate-300 mb-1">
                             <span>{d.name}</span>
                             <span>{d.val}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                             <div className="h-full" style={{ width: `${d.val}%`, backgroundColor: d.color }}></div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>
           </div>
        </div>
     </div>
  );

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: 'var(--bg-void)' }}>
      {/* Settings & Stats Overlays */}
      <SettingsPanel />
      <StatsCenter />
      <ManagementPanel isOpen={showManagement} onClose={() => setShowManagement(false)} />

      {/* Header */}
      <header className="h-[60px] glass-panel border-b border-white/10 flex items-center justify-between px-6 shrink-0 relative z-30">
        <div className="flex items-center gap-4">
           {/* Logo */}
           <div className="w-8 h-8 flex items-center justify-center relative" style={{ background: 'linear-gradient(to bottom right, var(--cyan), var(--purple))', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)', boxShadow: '0 0 15px rgba(0, 242, 255, 0.3)' }}>
              <div className="absolute inset-[2px]" style={{ backgroundColor: 'black', clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
              <div className="w-2 h-2 rounded-full z-10 animate-pulse" style={{ backgroundColor: 'var(--cyan)' }}></div>
           </div>
           <div>
              <div className="text-white font-bold tracking-[2px] text-sm">·星灿传媒科技·</div>
              <div className="text-[9px] tracking-widest opacity-80" style={{ color: 'var(--cyan)' }}>云矩阵 V3.0</div>
           </div>
        </div>

        <div className="flex items-center gap-6">
           {/* Top Menu Buttons */}
           <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={() => setShowScripts(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:border-[#bd00ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
                style={{ '--tw-bg-opacity': '0.2' } as any}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(189, 0, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              >
                <i className="ph ph-scroll"></i> {t('menu.topbar.scripts')}
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:border-[#00f2ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 242, 255, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              >
                <i className="ph ph-gear"></i> {t('menu.topbar.settings')}
              </button>
              <button 
                onClick={() => setShowManagement(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:border-[#a855f7]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              >
                <i className="ph ph-sliders"></i> {t('menu.topbar.management')}
              </button>
              <button 
                onClick={() => setShowStats(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:border-[#05ffa1]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(5, 255, 161, 0.2)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
              >
                <i className="ph ph-chart-bar"></i> {t('menu.topbar.stats')}
              </button>
           </div>

           {/* User */}
           <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                 <div className="text-xs font-bold text-white">Admin</div>
                 <div className="text-[9px] text-slate-500">Level 9 Access</div>
              </div>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: 'var(--purple)', boxShadow: '0 0 10px var(--purple)' }}>
                 A
              </div>
           </div>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden relative z-20">
         <Sidebar 
           groups={state.groups.length > 0 ? state.groups : MOCK_GROUPS}
           selectedGroupId={state.selectedGroupId}
           onSelectGroup={(id) => dispatch({ type: 'SELECT_GROUP', payload: id })}
           collapsed={sidebarCollapsed}
           setCollapsed={setSidebarCollapsed}
         />
         
         <main className="flex-1 overflow-hidden relative flex flex-col transition-all duration-300" style={{ background: 'linear-gradient(to bottom right, rgba(255,255,255,0.02), transparent)' }}>
             <DeviceDashboard 
                devices={displayDevices}
                selectedIds={state.selectedDeviceIds}
                onSelectDevice={handleSelectDevice}
                onOpenDevice={handleOpenDevice}
                onBatchAction={handleBatchAction}
                filterStatus={state.filterStatus}
                setFilterStatus={(s) => dispatch({ type: 'SET_FILTER_STATUS', payload: s })}
             />
         </main>
         
         <DeviceControl 
            device={state.activeDevice}
            logs={state.logs}
            collapsed={inspectorCollapsed}
            setCollapsed={setInspectorCollapsed}
            isFullView={state.isFullView}
            onCloseFullView={() => dispatch({ type: 'SET_FULL_VIEW', payload: false })}
         />
      </div>
    </div>
  );
};

// App with Provider
const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;
