import React, { useEffect, useState } from 'react';
import { 
  Globe, 
  Wifi, 
  WifiOff, 
  MoreVertical, 
  Plus,
  RefreshCw,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { RemoteServer } from '../types';

const RemoteServers: React.FC = () => {
  const { t } = useApp();
  const [servers, setServers] = useState<RemoteServer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = async () => {
      setLoading(true);
      const data = await api.remote.getServers();
      setServers(data);
      setLoading(false);
  };

  useEffect(() => {
    fetchServers();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('remote.title')}</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Manage connection to external Pycore nodes</p>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={fetchServers}
                className="p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
                <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20">
                <Plus size={18} />
                {t('remote.add_server')}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {servers.map(server => (
              <ServerCard key={server.id} server={server} />
          ))}
      </div>
    </div>
  );
};

const ServerCard: React.FC<{ server: RemoteServer }> = ({ server }) => {
    const isOnline = server.status === 'online';
    
    return (
        <div className={`relative bg-white dark:bg-slate-900 rounded-xl shadow-sm border p-6 transition-all hover:shadow-md ${isOnline ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 dark:border-slate-800 opacity-75'}`}>
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl ${isOnline ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Globe size={24} />
                </div>
                <div className="flex items-center gap-2">
                    <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                        {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
                        {isOnline ? `${server.latency}ms` : 'Offline'}
                    </span>
                    <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <MoreVertical size={18} />
                    </button>
                </div>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{server.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 font-mono truncate mb-4">{server.url}</p>
            
            <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-4">
                <Server size={12} />
                <span>Type: {server.type}</span>
                <span className="ml-auto">Checked: {new Date(server.last_check).toLocaleTimeString()}</span>
            </div>
        </div>
    );
};

export default RemoteServers;
