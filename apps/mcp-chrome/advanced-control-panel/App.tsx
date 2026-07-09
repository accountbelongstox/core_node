
import React, { useState, useEffect, useMemo } from 'react';
import { Tab, ExtensionItem, LogEntry, ServerState } from './types';
import { 
  ServerIcon, 
  SemanticIcon, 
  DataIcon, 
  ExtensionIcon, 
  AudioIcon, 
  SettingsIcon, 
  DebugIcon 
} from './components/Icons';

// --- Shared Components ---

const StatusBadge = ({ active, text }: { active: boolean, text: string }) => (
  <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border ${active ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
    <div className={`w-1 h-1 rounded-full ${active ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></div>
    <span className="text-[9px] font-bold uppercase tracking-wider">{text}</span>
  </div>
);

// Fix: Make children optional to resolve TS property missing errors when using component as wrapper
const Card = ({ children, title, subtitle }: { children?: React.ReactNode, title?: string, subtitle?: string }) => (
  <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3 overflow-hidden">
    {(title || subtitle) && (
      <div className="mb-2 flex items-center justify-between">
        {title && <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{title}</h4>}
        {subtitle && <span className="text-[9px] text-slate-500 font-mono">{subtitle}</span>}
      </div>
    )}
    {children}
  </div>
);

// --- Tab Contents ---

const ServerTab = ({ server, setServer }: { server: ServerState, setServer: any }) => (
  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
    <div className="flex items-center justify-between p-4 bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 shadow-lg">
      <div>
        <h3 className="text-sm font-bold text-white">Main Server Instance</h3>
        <p className="text-[10px] text-slate-500">Port: {server.port} • TCP/HTTP</p>
      </div>
      <button 
        onClick={() => setServer({ ...server, status: server.status === 'running' ? 'stopped' : 'running' })}
        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
          server.status === 'running' ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
        }`}
      >
        {server.status === 'running' ? 'Stop Server' : 'Start Server'}
      </button>
    </div>
    
    <div className="grid grid-cols-2 gap-3">
      <Card title="Connectivity">
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-400">Listener Port</span>
            <input type="number" value={server.port} onChange={e => setServer({ ...server, port: Number(e.target.value) || 0 })} className="w-16 bg-slate-900 border border-slate-700 rounded px-1 text-[11px] text-indigo-400 font-mono" />
          </div>
          <button className="w-full bg-slate-700 hover:bg-slate-600 text-[10px] py-1.5 rounded transition-colors flex items-center justify-center gap-2">
            <span>Copy MCP Config</span>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
          </button>
        </div>
      </Card>
      <Card title="Traffic">
        <div className="flex flex-col justify-center items-center h-full gap-1">
          <span className="text-lg font-mono font-bold text-indigo-400">1.2 MB/s</span>
          <span className="text-[9px] text-slate-500 uppercase">Current Throughput</span>
        </div>
      </Card>
    </div>
  </div>
);

const SemanticTab = () => {
  const [loading, setLoading] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center px-1">
        <StatusBadge active={!loading} text={loading ? "Initializing..." : "Engine Active"} />
        <button onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1500); }} className="text-[10px] text-indigo-400 hover:underline">Force Re-init</button>
      </div>
      <Card title="Model Selection">
        <div className="space-y-3">
          <select className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
            <option>gemini-text-embedding-004</option>
            <option>bge-large-en-v1.5 (Local)</option>
            <option>openai-ada-002</option>
          </select>
          <div className="p-2 bg-slate-900/50 rounded border border-slate-700/50 text-[10px] text-slate-400 leading-relaxed italic">
            "Semantic engine handles vectorization of incoming data streams for retrieval augmented generation."
          </div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="p-2 border border-slate-700 rounded bg-slate-800/20">Errors: 0</div>
        <div className="p-2 border border-slate-700 rounded bg-slate-800/20">Retries: 2 (Last 1h)</div>
      </div>
    </div>
  );
};

const DataTab = () => (
  <div className="space-y-3">
    <div className="grid grid-cols-3 gap-2">
      {[
        { label: 'Indexed Pages', val: '4,102' },
        { label: 'Vector Count', val: '128k' },
        { label: 'Active Tabs', val: '8' }
      ].map(s => (
        <div key={s.label} className="p-2 bg-slate-800 border border-slate-700 rounded-lg text-center">
          <p className="text-[9px] text-slate-500 uppercase font-bold">{s.label}</p>
          <p className="text-sm font-mono font-bold text-slate-100">{s.val}</p>
        </div>
      ))}
    </div>
    <Card title="Cache Management">
      <div className="space-y-2">
        <div className="flex justify-between text-[10px]">
          <span className="text-slate-400">Embedding Cache</span>
          <span className="text-slate-200">156 MB / 512 MB</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1 overflow-hidden">
          <div className="bg-indigo-500 h-full w-[30%]"></div>
        </div>
        <div className="flex gap-2 mt-2">
          <button className="flex-1 py-1 bg-slate-700 rounded text-[9px] font-bold hover:bg-slate-600">Flush Cache</button>
          <button className="flex-1 py-1 bg-rose-900/20 border border-rose-900/40 text-rose-400 rounded text-[9px] font-bold hover:bg-rose-900/30">Purge Data</button>
        </div>
      </div>
    </Card>
  </div>
);

const ExtensionsTab = () => {
  const [masterActive, setMasterActive] = useState(true);
  const [selectedExt, setSelectedExt] = useState<string | null>(null);
  const extensions = [
    { id: 'api', name: 'API Settings', desc: 'Endpoint orchestration' },
    { id: 'local', name: 'Local Task Queue', desc: 'Background workers' },
    { id: 'logs', name: 'Task Queue Logs', desc: 'Worker diagnostics' },
    { id: 'bing', name: 'Bing Dictionary', desc: 'External reference' },
    { id: 'deep', name: 'Deepseek Chat', desc: 'Model fallback' },
  ];

  return (
    <div className="flex h-[280px] gap-3">
      <div className="w-1/2 space-y-2 flex flex-col">
        <div className="flex items-center justify-between p-2 bg-indigo-950/20 border border-indigo-500/30 rounded mb-1">
          <span className="text-[10px] font-bold text-indigo-400 uppercase">Global Task System</span>
          <button onClick={() => setMasterActive(!masterActive)} className={`w-8 h-4 rounded-full relative transition-colors ${masterActive ? 'bg-indigo-600' : 'bg-slate-600'}`}>
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${masterActive ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {extensions.map(ext => (
            <div 
              key={ext.id} 
              onClick={() => setSelectedExt(ext.id)}
              className={`p-2 rounded border cursor-pointer transition-all ${selectedExt === ext.id ? 'bg-indigo-600/20 border-indigo-500/50' : 'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800'}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium">{ext.name}</span>
                <input type="checkbox" checked defaultChecked className="w-3 h-3 accent-indigo-500" />
              </div>
              <p className="text-[9px] text-slate-500">{ext.desc}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 bg-slate-950/50 rounded border border-slate-800 p-3">
        {selectedExt ? (
          <div className="space-y-3 animate-in fade-in duration-200">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-1">{selectedExt} CONFIG</h5>
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500">API KEY / ID</label>
                <input type="password" value="********" className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px] font-mono" readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-500">REFRESH INTERVAL</label>
                <input type="range" className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button className="bg-indigo-600 text-[9px] px-2 py-1 rounded">Save</button>
                <button className="bg-slate-700 text-[9px] px-2 py-1 rounded">Test Connection</button>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-600 text-[10px] italic">Select an extension to configure</div>
        )}
      </div>
    </div>
  );
};

const AudioTab = () => {
  const [recording, setRecording] = useState(false);
  return (
    <div className="space-y-3">
      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 relative overflow-hidden h-24 flex items-center justify-center">
        {recording ? (
          <div className="flex items-end gap-1 h-12">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="w-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ height: `${Math.random() * 100}%`, animationDelay: `${i * 0.1}s` }}></div>
            ))}
          </div>
        ) : (
          <div className="text-slate-700 text-[10px] font-bold uppercase tracking-widest">Mic Standby</div>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] text-slate-500 font-bold">API SERVER</label>
          <select className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-[10px]">
            <option>Deepgram (Low Latency)</option>
            <option>OpenAI Whisper v3</option>
            <option>Azure Speech Service</option>
          </select>
        </div>
        <div className="flex flex-col justify-end">
          <div className="flex items-center justify-between p-1 bg-slate-800/50 rounded border border-slate-700">
             <span className="text-[9px] text-slate-400">BG Stream</span>
             <input type="checkbox" className="w-3 h-3 accent-emerald-500" />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setRecording(!recording)} className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all flex items-center justify-center gap-2 ${recording ? 'bg-slate-700 text-slate-300' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20'}`}>
          <div className={`w-2 h-2 rounded-full ${recording ? 'bg-slate-500' : 'bg-red-500 animate-pulse'}`}></div>
          {recording ? 'Stop Transcription' : 'Start Recording'}
        </button>
        <button className="px-3 bg-slate-800 rounded-lg hover:bg-slate-700">
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
};

const SettingsTab = ({ server, setServer }: { server: ServerState, setServer: any }) => {
  const [apiGateway, setApiGateway] = useState('https://core-v2.internal:8080');
  return (
  <div className="space-y-4 max-h-[280px] overflow-y-auto pr-2">
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-3">
        <h5 className="text-[10px] font-bold text-slate-500 border-b border-slate-800 pb-1">INFRASTRUCTURE</h5>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-300">Auto-start</span>
            <input type="checkbox" checked={server.autoConnect} onChange={e => setServer({...server, autoConnect: e.target.checked})} className="w-4 h-4 rounded bg-slate-900 border-slate-700 accent-indigo-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-slate-500">API GATEWAY</label>
            <input type="text" value={apiGateway} onChange={e => setApiGateway(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[10px]" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <h5 className="text-[10px] font-bold text-slate-500 border-b border-slate-800 pb-1">QUEUE METRICS</h5>
        <div className="space-y-2">
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <div className="flex justify-between text-[9px] mb-1"><span className="text-slate-500">Load Factor</span><span className="text-indigo-400">42%</span></div>
            <div className="w-full bg-slate-800 h-1 rounded-full"><div className="bg-indigo-500 h-full w-[42%]"></div></div>
          </div>
          <div className="p-2 bg-slate-950 rounded border border-slate-800">
            <div className="flex justify-between text-[9px] mb-1"><span className="text-slate-500">Wait Time</span><span className="text-emerald-400">12ms</span></div>
          </div>
        </div>
      </div>
    </div>
    <div className="pt-4 border-t border-slate-800 flex gap-2">
      <button className="flex-1 py-1.5 bg-rose-600/10 border border-rose-600/30 text-rose-500 text-[10px] font-bold rounded hover:bg-rose-600/20">Reset Settings</button>
      <button className="flex-1 py-1.5 bg-indigo-600/10 border border-indigo-600/30 text-indigo-400 text-[10px] font-bold rounded hover:bg-indigo-600/20">Backup Configuration</button>
    </div>
  </div>
  );
};

const DebugTab = () => {
  const [showJson, setShowJson] = useState(false);
  const logs = [
    { t: '12:00:01', l: 'INF', m: 'Engine startup sequence initiated.' },
    { t: '12:00:04', l: 'INF', m: 'Connected to semantic store (v2).' },
    { t: '12:01:22', l: 'WRN', m: 'High memory usage detected in cache.' },
    { t: '12:05:00', l: 'ERR', m: 'Extension BingDict failed heartbeat.' },
  ];

  return (
    <div className="h-[280px] flex flex-col gap-2">
      <div className="flex justify-between items-center bg-slate-950 p-1.5 border border-slate-800 rounded-lg">
        <div className="flex gap-2">
           <button onClick={() => setShowJson(false)} className={`px-3 py-0.5 rounded text-[10px] font-bold transition-all ${!showJson ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>LOGS</button>
           <button onClick={() => setShowJson(true)} className={`px-3 py-0.5 rounded text-[10px] font-bold transition-all ${showJson ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>JSON STATE</button>
        </div>
        <button className="text-rose-400 text-[10px] font-bold hover:underline px-2">Purge</button>
      </div>
      
      <div className="flex-1 bg-slate-950 rounded-lg border border-slate-800 p-3 overflow-y-auto font-mono text-[10px]">
        {showJson ? (
          <pre className="text-indigo-400 leading-relaxed">
            {JSON.stringify({
              server: { uptime: '12:45:11', memory: '1.2GB', threads: 4 },
              engine: { mode: 'semantic', nodes: 12, shards: 2 },
              audio: { bitrate: '128kbps', format: 'pcm' }
            }, null, 2)}
          </pre>
        ) : (
          <div className="space-y-1.5">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 leading-tight">
                <span className="text-slate-600 shrink-0">[{log.t}]</span>
                <span className={`shrink-0 font-bold ${log.l === 'ERR' ? 'text-rose-500' : log.l === 'WRN' ? 'text-amber-500' : 'text-emerald-500'}`}>{log.l}</span>
                <span className="text-slate-400">{log.m}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.SERVER);
  const [serverState, setServerState] = useState<ServerState>({
    status: 'running',
    port: 3000,
    autoConnect: true
  });

  const getIcon = (tab: Tab) => {
    switch (tab) {
      case Tab.SERVER: return <ServerIcon />;
      case Tab.SEMANTIC: return <SemanticIcon />;
      case Tab.DATA: return <DataIcon />;
      case Tab.EXTENSIONS: return <ExtensionIcon />;
      case Tab.AUDIO: return <AudioIcon />;
      case Tab.SETTINGS: return <SettingsIcon />;
      case Tab.DEBUG: return <DebugIcon />;
    }
  };

  const currentView = useMemo(() => {
    switch (activeTab) {
      case Tab.SERVER: return <ServerTab server={serverState} setServer={setServerState} />;
      case Tab.SEMANTIC: return <SemanticTab />;
      case Tab.DATA: return <DataTab />;
      case Tab.EXTENSIONS: return <ExtensionsTab />;
      case Tab.AUDIO: return <AudioTab />;
      case Tab.SETTINGS: return <SettingsTab server={serverState} setServer={setServerState} />;
      case Tab.DEBUG: return <DebugTab />;
    }
  }, [activeTab, serverState]);

  return (
    <div className="w-[600px] h-[400px] bg-[#0f172a] text-slate-200 flex flex-col rounded-2xl border border-slate-800 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-5 bg-slate-900/80 backdrop-blur-md z-20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>
          <div>
            <h1 className="text-[13px] font-black tracking-tighter text-white uppercase italic">Advanced Control</h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest leading-none">Management Console v4.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <select className="bg-transparent text-[10px] font-bold text-slate-400 border-none focus:ring-0 p-0 hover:text-indigo-400 transition-colors cursor-pointer text-right">
              <option>ENGLISH / EN</option>
              <option>CHINESE / ZH</option>
              <option>JAPANESE / JA</option>
            </select>
            <span className="text-[8px] text-slate-600 font-mono tracking-tighter">ID: X7-R9-P2</span>
          </div>
          <div className="w-px h-6 bg-slate-800"></div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${serverState.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
          </div>
        </div>
      </header>

      {/* Horizontal Navigation */}
      <nav className="h-12 border-b border-slate-800/60 bg-slate-950/20 flex items-center px-2 gap-1 shrink-0 overflow-x-auto no-scrollbar">
        {(Object.values(Tab) as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap group ${
              activeTab === tab 
              ? 'bg-indigo-600/15 text-indigo-400 border border-indigo-500/30' 
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
            }`}
          >
            <span className={`transition-transform duration-200 ${activeTab === tab ? 'scale-110' : 'opacity-60 grayscale group-hover:grayscale-0'}`}>
              {getIcon(tab)}
            </span>
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Main Content Body */}
      <main className="flex-1 p-5 overflow-hidden relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-500/5 via-slate-950 to-slate-950">
        <div className="max-w-2xl mx-auto h-full flex flex-col">
          <div className="flex items-center justify-between mb-4 shrink-0">
             <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-3">
               {activeTab}
               <span className="h-0.5 w-12 bg-indigo-500/30 rounded-full"></span>
             </h2>
             <span className="text-[10px] text-slate-500 font-mono bg-slate-800/50 px-2 py-0.5 rounded border border-slate-700">MOD::VIEW_0{Object.values(Tab).indexOf(activeTab) + 1}</span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
            {currentView}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-10 border-t border-slate-800 bg-slate-950 px-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Core Sys</span>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${serverState.status === 'running' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-tighter">Ready</span>
            </div>
          </div>
          <div className="flex flex-col">
             <span className="text-[8px] text-slate-600 uppercase font-black tracking-widest">Sync Port</span>
             <span className="text-[10px] font-mono text-indigo-500 uppercase tracking-tighter">3000 // Active</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
             <div className="text-[10px] font-bold text-slate-500 tracking-tighter uppercase leading-none">System Load</div>
             <div className="text-[12px] font-mono text-indigo-400 font-black">2.44%</div>
          </div>
          <div className="w-10 h-10 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-800 cursor-pointer transition-colors group">
             <svg className="w-5 h-5 text-slate-600 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
        </div>
      </footer>
    </div>
  );
}
