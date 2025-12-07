import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Filter, 
  Download,
  AlertTriangle,
  Info,
  Bug,
  AlertOctagon
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { LogEntry } from '../types';

const Logs: React.FC = () => {
  const { t } = useApp();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api.logs.getLogs().then(setLogs);
  }, []);

  return (
    <div className="space-y-6 h-[calc(100vh-8rem)] flex flex-col animate-fade-in">
      <div className="flex justify-between items-center flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('logs.title')}</h1>
        <div className="flex gap-3">
             <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <input 
                    type="text" 
                    placeholder="Search logs..." 
                    className="pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-64"
                />
             </div>
             <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Filter size={16} />
                Filter
             </button>
             <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <Download size={16} />
                Export
             </button>
        </div>
      </div>

      <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
          <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-medium text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <div className="w-48">Timestamp</div>
              <div className="w-24">Level</div>
              <div className="w-32">Category</div>
              <div className="flex-1">Message</div>
          </div>
          <div className="flex-1 overflow-y-auto p-0 font-mono text-sm">
              {logs.map((log, index) => (
                  <div key={log.id} className={`flex items-start px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800/50 ${index % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-900/50'}`}>
                      <div className="w-48 text-slate-500 dark:text-slate-500 flex-shrink-0 text-xs py-1">
                          {new Date(log.timestamp).toLocaleString()}
                      </div>
                      <div className="w-24 flex-shrink-0">
                          <LogLevelBadge level={log.level} />
                      </div>
                      <div className="w-32 text-slate-600 dark:text-slate-400 flex-shrink-0 text-xs py-1 font-semibold">
                          {log.category}
                      </div>
                      <div className="flex-1 text-slate-700 dark:text-slate-300 py-1 break-all">
                          {log.message}
                      </div>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

const LogLevelBadge: React.FC<{ level: string }> = ({ level }) => {
    let color = "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400";
    let icon = Info;

    if (level === 'ERROR') {
        color = "text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400";
        icon = AlertOctagon;
    } else if (level === 'WARNING') {
        color = "text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400";
        icon = AlertTriangle;
    } else if (level === 'DEBUG') {
        color = "text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400";
        icon = Bug;
    }

    const Icon = icon;

    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${color}`}>
            <Icon size={10} />
            {level}
        </span>
    );
};

export default Logs;
