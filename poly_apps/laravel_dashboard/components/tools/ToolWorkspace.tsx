import React, { useState } from 'react';
import { ArrowLeft, Settings, Cloud, Zap, AlertCircle, Save } from "lucide-react";
import BentoCard from '../BentoCard';
import { ToolItem, ToolConfig } from '../../types';
import { DEFAULT_API_CONFIGS } from '../../constants';
import { apiClient } from '../../services/api';

interface ToolWorkspaceProps {
  tool: ToolItem;
  onBack: () => void;
  children: (config: ToolConfig, setConfig: (c: ToolConfig) => void) => React.ReactNode;
}

const ToolWorkspace: React.FC<ToolWorkspaceProps> = ({ tool, onBack, children }) => {
  const [config, setConfig] = useState<ToolConfig>(
    DEFAULT_API_CONFIGS[tool.id] || { toolId: tool.id, apiUrl: '', mode: 'cloud' }
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showToast, setShowToast] = useState<string | null>(null);

  // Load Global Defaults on Init (Mock Logic)
  // useEffect(() => { ... }, [])

  const handleSaveConfig = () => {
    // Update Central Client if needed, or just local config
    // apiClient.updateToolConfig(config); 
    setShowToast("Configuration Saved");
    setTimeout(() => setShowToast(null), 2000);
    setShowSettings(false);
  };

  const toggleMode = () => {
    setConfig(prev => ({ ...prev, mode: prev.mode === 'cloud' ? 'local' : 'cloud' }));
  };

  return (
    <div className="h-full flex flex-col relative animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-xl border border-white/10 flex items-center gap-2 text-sm animate-in fade-in slide-in-from-top-2">
           <AlertCircle size={16} className="text-emerald-500" />
           {showToast}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between p-4 mb-4 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-bold text-white leading-none">{tool.name}</h2>
            <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Workspace Active</span>
                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-black/20 rounded-lg p-1 border border-white/5">
            <button 
                onClick={() => setConfig(prev => ({ ...prev, mode: 'local' }))}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${config.mode === 'local' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Zap size={12} /> Local
            </button>
            <button 
                onClick={() => setConfig(prev => ({ ...prev, mode: 'cloud' }))}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 transition-all ${config.mode === 'cloud' ? 'bg-sky-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
                <Cloud size={12} /> Cloud
            </button>
          </div>

          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors border ${showSettings ? 'bg-white/10 text-white border-white/20' : 'text-slate-400 hover:text-white border-transparent hover:bg-white/5'}`}
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Main Tool Area */}
        <div className="flex-1 min-w-0 flex flex-col">
            {children(config, setConfig)}
        </div>

        {/* API Settings Sidebar */}
        <div className={`
            w-80 flex-shrink-0 bg-slate-900/50 border border-white/10 rounded-2xl backdrop-blur-xl transition-all duration-300 overflow-hidden flex flex-col
            ${showSettings ? 'mr-0 opacity-100' : '-mr-[21rem] opacity-0 pointer-events-none'}
        `}>
            <div className="p-4 border-b border-white/10 bg-white/5">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Cloud size={18} className="text-sky-400" /> API Configuration
                </h3>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase">Endpoint URL</label>
                    <input 
                        type="text" 
                        value={config.apiUrl}
                        onChange={(e) => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                        placeholder="http://localhost:9000/v1/..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-500">
                        Central API Client will use this URL for this session.
                    </p>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-bold uppercase">API Key (Optional)</label>
                    <input 
                        type="password" 
                        value={config.apiKey || ''}
                        onChange={(e) => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                        placeholder="sk-..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-sm text-white placeholder-slate-600 focus:border-indigo-500 outline-none font-mono"
                    />
                </div>

                <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <h4 className="text-indigo-400 text-xs font-bold mb-1 flex items-center gap-1">
                        <AlertCircle size={12} /> Central Link: Active
                    </h4>
                    <p className="text-[10px] text-indigo-200/70">
                        Requests are routed through the unified API client.
                    </p>
                </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/5">
                <button 
                    onClick={handleSaveConfig}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                    <Save size={16} /> Save Settings
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ToolWorkspace;