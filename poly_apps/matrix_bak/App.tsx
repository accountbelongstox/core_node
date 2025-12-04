import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Navigation';
import { DeviceDashboard } from './components/DeviceDashboard';
import { DeviceControl } from './components/DeviceControl';
import { Device, DeviceGroup, DeviceLog, BatchActionType } from './types';

// --- Mock Data ---
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

const App: React.FC = () => {
  // Layout State
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showScripts, setShowScripts] = useState(false);
  const [showStats, setShowStats] = useState(false);
  
  // Data State
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  // Selection & Control State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeDevice, setActiveDevice] = useState<Device | null>(null);
  const [isFullView, setIsFullView] = useState(false);
  
  // Settings Form State
  const [settingsForm, setSettingsForm] = useState({
    viewMode: 'grid',
    protocol: 'adb',
    autoConnect: true,
    proxy: false,
    theme: 'cyber',
    search: ''
  });

  // Logs
  const [logs, setLogs] = useState<DeviceLog[]>([
    { time: '10:00:01', type: 'info', msg: 'System initialized' },
    { time: '10:00:02', type: 'success', msg: 'Connected to Cloud Matrix' },
  ]);

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

  const handleBatchAction = (action: BatchActionType) => {
     addLog('success', `Batch ${action} initiated on ${selectedIds.size} devices`);
  };

  const displayDevices = MOCK_DEVICES.filter(d => !selectedGroupId || d.groupId === selectedGroupId || (selectedGroupId === 'g1' && d.groupId.startsWith('g1')));

  // --- Components for Overlays ---

  const SettingsPanel = () => (
    <div className={`fixed inset-y-0 right-0 w-[400px] bg-[#0a0c10]/95 backdrop-blur-2xl border-l border-white/10 z-50 transform transition-transform duration-300 ${showSettings || showScripts ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="h-16 border-b border-white/10 flex items-center justify-between px-6">
        <h2 className="text-[#00f2ff] font-bold tracking-widest text-lg">{showScripts ? 'SCRIPT ENGINE' : 'SYSTEM CONFIG'}</h2>
        <button onClick={() => { setShowSettings(false); setShowScripts(false); }} className="w-8 h-8 rounded hover:bg-white/10 flex items-center justify-center text-white"><i className="ph ph-x"></i></button>
      </div>
      
      <div className="p-6 overflow-y-auto h-[calc(100vh-64px)] custom-scrollbar">
        {showScripts ? (
           <div className="space-y-6">
              <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                 <label className="block text-xs font-mono text-slate-400 mb-2">SCRIPT SOURCE</label>
                 <select className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none">
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
                          <input type="radio" name="script_target" className="accent-[#00f2ff]" />
                          <span className="text-sm">{opt}</span>
                       </label>
                    ))}
                 </div>
              </div>
              <button className="w-full py-3 bg-[#00f2ff]/20 border border-[#00f2ff]/50 text-[#00f2ff] font-bold tracking-widest hover:bg-[#00f2ff]/30 transition-all rounded">
                 EXECUTE SCRIPT
              </button>
           </div>
        ) : (
          <div className="space-y-8">
            {/* Search */}
            <div>
              <label className="block text-xs font-mono text-[#00f2ff] mb-2 tracking-widest">GLOBAL SEARCH</label>
              <div className="relative">
                <i className="ph ph-magnifying-glass absolute left-3 top-2.5 text-slate-500"></i>
                <input 
                  type="text" 
                  value={settingsForm.search}
                  onChange={(e) => setSettingsForm({...settingsForm, search: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 pl-9 text-sm text-white focus:border-[#00f2ff] outline-none transition-colors"
                  placeholder="Find parameter..."
                />
              </div>
            </div>

            {/* View Mode (Radio) */}
            <div>
              <label className="block text-xs font-mono text-[#00f2ff] mb-3 tracking-widest">VIEW PREFERENCE</label>
              <div className="grid grid-cols-2 gap-3">
                 {['grid', 'list', 'compact', 'map'].map(mode => (
                    <label key={mode} className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${settingsForm.viewMode === mode ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/30'}`}>
                       <span className="capitalize text-sm font-medium">{mode}</span>
                       <input 
                         type="radio" 
                         name="viewMode" 
                         value={mode}
                         checked={settingsForm.viewMode === mode}
                         onChange={(e) => setSettingsForm({...settingsForm, viewMode: e.target.value})}
                         className="accent-[#00f2ff]" 
                       />
                    </label>
                 ))}
              </div>
            </div>

            {/* Protocol (Select) */}
            <div>
               <label className="block text-xs font-mono text-[#00f2ff] mb-2 tracking-widest">CONNECTION PROTOCOL</label>
               <select 
                  value={settingsForm.protocol}
                  onChange={(e) => setSettingsForm({...settingsForm, protocol: e.target.value})}
                  className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white focus:border-[#00f2ff] outline-none"
               >
                  <option value="adb">ADB Bridge (Default)</option>
                  <option value="ws">WebSocket Secure</option>
                  <option value="http">HTTP Long-Polling</option>
               </select>
            </div>

            {/* Toggles (Checkbox) */}
            <div>
              <label className="block text-xs font-mono text-[#00f2ff] mb-3 tracking-widest">ADVANCED OPTIONS</label>
              <div className="space-y-3">
                 <label className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10 cursor-pointer">
                    <span className="text-sm">Auto-reconnect on drop</span>
                    <input type="checkbox" checked={settingsForm.autoConnect} onChange={() => setSettingsForm({...settingsForm, autoConnect: !settingsForm.autoConnect})} className="w-4 h-4 accent-[#00f2ff] rounded bg-white/10 border-white/20" />
                 </label>
                 <label className="flex items-center justify-between p-3 rounded bg-white/5 border border-white/10 cursor-pointer">
                    <span className="text-sm">Use Global Proxy</span>
                    <input type="checkbox" checked={settingsForm.proxy} onChange={() => setSettingsForm({...settingsForm, proxy: !settingsForm.proxy})} className="w-4 h-4 accent-[#00f2ff] rounded bg-white/10 border-white/20" />
                 </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const StatsCenter = () => (
     <div className={`fixed inset-0 bg-[#030305]/95 backdrop-blur-xl z-[60] transition-transform duration-500 flex flex-col ${showStats ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="h-20 border-b border-white/10 flex items-center justify-between px-10 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-[#00f2ff] mask-hex flex items-center justify-center"><i className="ph-bold ph-chart-line text-black text-xl"></i></div>
              <div>
                 <h1 className="text-2xl font-bold tracking-widest text-white">DATA CENTER</h1>
                 <p className="text-xs text-[#00f2ff] font-mono">REAL-TIME ANALYTICS MATRIX</p>
              </div>
           </div>
           <button onClick={() => setShowStats(false)} className="px-6 py-2 border border-white/20 hover:bg-white/10 rounded text-sm text-white transition-colors">CLOSE CENTER</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
              {[
                 { label: 'ACTIVE NODES', val: '24', sub: '100% Online', color: 'text-[#05ffa1]' },
                 { label: 'THROUGHPUT', val: '4.2 GB/s', sub: '+12% vs last hour', color: 'text-[#00f2ff]' },
                 { label: 'ERROR RATE', val: '0.02%', sub: 'Within limits', color: 'text-[#05ffa1]' },
                 { label: 'CPU LOAD', val: '45%', sub: 'Cluster Average', color: 'text-[#bd00ff]' },
              ].map((stat, i) => (
                 <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors">
                    <div className="text-[10px] text-slate-400 font-mono tracking-widest mb-2">{stat.label}</div>
                    <div className={`text-4xl font-bold mb-2 ${stat.color}`}>{stat.val}</div>
                    <div className="text-xs text-slate-500">{stat.sub}</div>
                 </div>
              ))}
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
              <div className="lg:col-span-2 bg-black/40 border border-white/10 rounded-xl p-6 relative overflow-hidden">
                 <div className="text-xs text-[#00f2ff] font-bold tracking-widest mb-6">NETWORK TRAFFIC HISTORY</div>
                 <div className="absolute inset-x-0 bottom-0 top-16 flex items-end justify-between px-6 pb-6 gap-1">
                    {Array.from({length: 40}).map((_, i) => (
                       <div key={i} className="flex-1 bg-gradient-to-t from-[#00f2ff]/40 to-transparent hover:bg-[#00f2ff]/60 transition-all" style={{ height: `${Math.random() * 80 + 10}%`, borderRadius: '2px 2px 0 0' }}></div>
                    ))}
                 </div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl p-6">
                 <div className="text-xs text-[#bd00ff] font-bold tracking-widest mb-6">DEVICE DISTRIBUTION</div>
                 <div className="space-y-4">
                    {[
                       { name: 'Pixel Farm', val: 45, color: 'bg-[#00f2ff]' },
                       { name: 'Samsung Grid', val: 30, color: 'bg-[#bd00ff]' },
                       { name: 'Xiaomi Cluster', val: 15, color: 'bg-[#05ffa1]' },
                       { name: 'Other', val: 10, color: 'bg-white' },
                    ].map(d => (
                       <div key={d.name}>
                          <div className="flex justify-between text-xs text-slate-300 mb-1">
                             <span>{d.name}</span>
                             <span>{d.val}%</span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                             <div className={`h-full ${d.color}`} style={{ width: `${d.val}%` }}></div>
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
    <div className="flex flex-col h-full w-full bg-[#030305]">
      {/* Settings & Stats Overlays */}
      <SettingsPanel />
      <StatsCenter />

      {/* Header */}
      <header className="h-[60px] glass-panel border-b border-white/10 flex items-center justify-between px-6 shrink-0 relative z-30">
        <div className="flex items-center gap-4">
           {/* Logo */}
           <div className="w-8 h-8 bg-gradient-to-br from-[#00f2ff] to-[#bd00ff] flex items-center justify-center relative shadow-[0_0_15px_rgba(0,242,255,0.3)]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}>
              <div className="absolute inset-[2px] bg-black" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }}></div>
              <div className="w-2 h-2 bg-[#00f2ff] rounded-full z-10 animate-pulse"></div>
           </div>
           <div>
              <div className="text-white font-bold tracking-[2px] text-sm">·星灿传媒科技·</div>
              <div className="text-[9px] text-[#00f2ff] tracking-widest opacity-80">云矩阵 V3.0</div>
           </div>
        </div>

        <div className="flex items-center gap-6">
           {/* Top Menu Buttons */}
           <div className="hidden md:flex items-center gap-2">
              <button 
                onClick={() => setShowScripts(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#bd00ff]/20 hover:border-[#bd00ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
              >
                <i className="ph ph-scroll"></i> 脚本功能
              </button>
              <button 
                onClick={() => setShowSettings(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#00f2ff]/20 hover:border-[#00f2ff]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
              >
                <i className="ph ph-gear"></i> 设置
              </button>
              <button 
                onClick={() => setShowStats(true)}
                className="px-4 py-1.5 rounded bg-white/5 border border-white/10 hover:bg-[#05ffa1]/20 hover:border-[#05ffa1]/50 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-2"
              >
                <i className="ph ph-chart-bar"></i> 数据统计
              </button>
           </div>

           {/* User */}
           <div className="flex items-center gap-3 pl-4 border-l border-white/10">
              <div className="text-right hidden sm:block">
                 <div className="text-xs font-bold text-white">Admin</div>
                 <div className="text-[9px] text-slate-500">Level 9 Access</div>
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
         />
         
         <main className="flex-1 overflow-hidden relative flex flex-col transition-all duration-300 bg-gradient-to-br from-white/[0.02] to-transparent">
             <DeviceDashboard 
                devices={displayDevices}
                selectedIds={selectedIds}
                onSelectDevice={handleSelectDevice}
                onOpenDevice={handleOpenDevice}
                onBatchAction={handleBatchAction}
                filterStatus={filterStatus}
                setFilterStatus={setFilterStatus}
             />
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
    </div>
  );
};

export default App;