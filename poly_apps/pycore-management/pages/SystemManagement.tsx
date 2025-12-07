import React, { useEffect, useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  PlayCircle,
  RefreshCw,
  Power,
  Save
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { SystemStatus, SystemConfig } from '../types';

interface Props {
  defaultTab?: 'status' | 'config';
}

const SystemManagement: React.FC<Props> = ({ defaultTab = 'status' }) => {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<'status' | 'config' | 'control'>('status');
  
  // Use effect to sync prop with state if it changes
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.system')}</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex gap-6">
          <TabButton 
            active={activeTab === 'status'} 
            onClick={() => setActiveTab('status')} 
            label={t('nav.system.status')} 
          />
          <TabButton 
            active={activeTab === 'config'} 
            onClick={() => setActiveTab('config')} 
            label={t('nav.system.config')} 
          />
          <TabButton 
            active={activeTab === 'control'} 
            onClick={() => setActiveTab('control')} 
            label={t('sys.controls')} 
          />
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'status' && <StatusView />}
        {activeTab === 'config' && <ConfigView />}
        {activeTab === 'control' && <ControlView />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button
    onClick={onClick}
    className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
      active
        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
        : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
    }`}
  >
    {label}
  </button>
);

// --- Sub-Views ---

const StatusView: React.FC = () => {
  const { t } = useApp();
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    const data = await api.system.getStatus();
    setStatus(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  if (loading || !status) return <div className="p-8 text-center text-slate-500">{t('common.loading')}</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-end">
        <button 
            onClick={fetchStatus}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
        >
            <RefreshCw size={14} />
            {t('common.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Main System Status */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 border-b dark:border-slate-800 pb-2">{t('sys.core')}</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
               <span className="text-slate-500 dark:text-slate-400">System State</span>
               <StatusBadge status={status.system.status} />
            </div>
            <div className="flex justify-between items-center">
               <span className="text-slate-500 dark:text-slate-400">Uptime</span>
               <span className="font-mono text-slate-700 dark:text-slate-300">{formatUptime(status.system.uptime)}</span>
            </div>
            <div className="flex justify-between items-center">
               <span className="text-slate-500 dark:text-slate-400">Version</span>
               <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-mono text-slate-600 dark:text-slate-400">{status.system.version}</span>
            </div>
             <div className="flex justify-between items-center">
               <span className="text-slate-500 dark:text-slate-400">Process ID</span>
               <span className="font-mono text-slate-700 dark:text-slate-300">{status.system.pid}</span>
            </div>
          </div>
        </div>

        {/* Services Status */}
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
           <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 border-b dark:border-slate-800 pb-2">{t('sys.microservices')}</h2>
           <div className="space-y-4">
             {Object.entries(status.services).map(([name, svcStatus]) => (
                <div key={name} className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-medium capitalize">{name.replace('_', ' ')}</span>
                  <StatusBadge status={svcStatus} />
                </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
};

const ConfigView: React.FC = () => {
    const { t } = useApp();
    const [config, setConfig] = useState<SystemConfig | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.system.getConfig().then(setConfig);
    }, []);

    const handleSave = async () => {
        if (!config) return;
        setSaving(true);
        await api.system.updateConfig(config);
        setSaving(false);
    };

    if (!config) return <div className="p-8 text-center">{t('common.loading')}</div>;

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 animate-fade-in">
             <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('sys.config.title')}</h2>
             
             <div className="grid grid-cols-1 gap-6 max-w-2xl">
                 <div className="flex items-center justify-between">
                     <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sys.debug_mode')}</label>
                         <p className="text-xs text-slate-500 dark:text-slate-400">Enable verbose logging output</p>
                     </div>
                     <button 
                        onClick={() => setConfig({...config, debug: !config.debug})}
                        className={`w-11 h-6 flex items-center rounded-full transition-colors ${config.debug ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                     >
                         <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${config.debug ? 'translate-x-6' : 'translate-x-1'}`}></div>
                     </button>
                 </div>

                 <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('sys.log_level')}</label>
                     <select 
                        value={config.log_level}
                        onChange={(e) => setConfig({...config, log_level: e.target.value as any})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                     >
                         <option value="DEBUG">DEBUG</option>
                         <option value="INFO">INFO</option>
                         <option value="WARNING">WARNING</option>
                         <option value="ERROR">ERROR</option>
                     </select>
                 </div>

                 <div>
                     <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('sys.max_conn')}</label>
                     <input 
                        type="number"
                        value={config.max_connections}
                        onChange={(e) => setConfig({...config, max_connections: parseInt(e.target.value)})}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
                     />
                 </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                     <div>
                         <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t('sys.auto_start')}</label>
                     </div>
                     <button 
                        onClick={() => setConfig({...config, auto_start: !config.auto_start})}
                        className={`w-11 h-6 flex items-center rounded-full transition-colors ${config.auto_start ? 'bg-green-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                     >
                         <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform ${config.auto_start ? 'translate-x-6' : 'translate-x-1'}`}></div>
                     </button>
                 </div>

                 <div className="pt-6">
                     <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                     >
                         <Save size={18} />
                         {saving ? 'Saving...' : t('common.save')}
                     </button>
                 </div>
             </div>
        </div>
    );
};

const ControlView: React.FC = () => {
    const { t } = useApp();
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 animate-fade-in">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('sys.controls')}</h2>
            <div className="flex flex-wrap gap-4">
                <button className="flex items-center gap-2 px-6 py-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg font-medium transition-colors border border-red-200 dark:border-red-900/50">
                    <Power size={18} />
                    {t('sys.stop')}
                </button>
                <button className="flex items-center gap-2 px-6 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg font-medium transition-colors border border-blue-200 dark:border-blue-900/50">
                    <RefreshCw size={18} />
                    {t('sys.restart')}
                </button>
                <button className="flex items-center gap-2 px-6 py-3 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg font-medium transition-colors border border-amber-200 dark:border-amber-900/50">
                    <RefreshCw size={18} />
                    {t('sys.reload')}
                </button>
            </div>
            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="flex gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <AlertCircle size={18} className="text-blue-500" />
                    <p>System actions may cause temporary service interruption. Ensure no critical tasks are running.</p>
                </div>
            </div>
        </div>
    );
};

// --- Helpers ---

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    let color = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    let Icon = AlertCircle;

    if (status === 'running') {
        color = "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
        Icon = CheckCircle;
    } else if (status === 'stopped') {
        color = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
        Icon = Power;
    } else if (status === 'error') {
        color = "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
        Icon = XCircle;
    } else if (status === 'starting') {
        color = "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
        Icon = PlayCircle;
    }

    return (
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${color}`}>
            <Icon size={14} />
            {status}
        </span>
    );
};

const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
};

export default SystemManagement;