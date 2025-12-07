import React, { useEffect, useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Check, 
  Clock, 
  XOctagon,
  Trash2,
  Server,
  Settings,
  History
} from 'lucide-react';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { UploadTask, UploadHistoryItem, UploadServer } from '../types';

const UploadTasks: React.FC = () => {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<'tasks' | 'history' | 'servers'>('tasks');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('nav.uploads')}</h1>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex gap-6">
          <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} label={t('upload.tasks')} icon={UploadCloud} />
          <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')} label={t('upload.history')} icon={History} />
          <TabButton active={activeTab === 'servers'} onClick={() => setActiveTab('servers')} label={t('upload.servers')} icon={Server} />
        </nav>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'tasks' && <TasksView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'servers' && <ServersView />}
      </div>
    </div>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; label: string; icon: any }> = ({ active, onClick, label, icon: Icon }) => (
    <button
      onClick={onClick}
      className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
        active
          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
);

const TasksView: React.FC = () => {
    const [tasks, setTasks] = useState<UploadTask[]>([]);
  
    useEffect(() => {
      api.upload.getTasks().then(setTasks);
    }, []);
  
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Clear Completed</button>
            </div>
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                        <th className="px-6 py-3 font-medium">Task ID</th>
                        <th className="px-6 py-3 font-medium">Type</th>
                        <th className="px-6 py-3 font-medium">Progress</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                        <th className="px-6 py-3 font-medium">Speed</th>
                        <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {tasks.map((task) => (
                        <tr key={task.upload_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{task.upload_id}</td>
                            <td className="px-6 py-4">
                                <span className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                                    <FileText size={16} className="text-slate-400" />
                                    {task.result_type}
                                </span>
                            </td>
                            <td className="px-6 py-4 w-48">
                                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                                    <div 
                                        className={`h-full rounded-full ${task.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`} 
                                        style={{ width: `${task.progress}%` }}
                                    ></div>
                                </div>
                                <div className="text-xs text-slate-400 mt-1 text-right">{task.progress}%</div>
                            </td>
                            <td className="px-6 py-4">
                                <StatusBadge status={task.status} />
                            </td>
                            <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                {task.status === 'uploading' ? `${task.speed} MB/s` : '-'}
                            </td>
                            <td className="px-6 py-4 text-right">
                                 <button className="text-slate-400 hover:text-red-600 transition-colors">
                                     <Trash2 size={16} />
                                 </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const HistoryView: React.FC = () => {
    const [history, setHistory] = useState<UploadHistoryItem[]>([]);

    useEffect(() => {
        api.upload.getHistory().then(setHistory);
    }, []);

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
             <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <tr>
                        <th className="px-6 py-3 font-medium">Uploaded At</th>
                        <th className="px-6 py-3 font-medium">Type</th>
                        <th className="px-6 py-3 font-medium">Files</th>
                        <th className="px-6 py-3 font-medium">Size</th>
                        <th className="px-6 py-3 font-medium">Server</th>
                        <th className="px-6 py-3 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {history.map((item) => (
                        <tr key={item.upload_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                             <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                                 {new Date(item.uploaded_at).toLocaleString()}
                             </td>
                             <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200">{item.result_type}</td>
                             <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{item.file_count}</td>
                             <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{(item.total_size / 1024).toFixed(2)} KB</td>
                             <td className="px-6 py-4 text-blue-600 dark:text-blue-400 underline cursor-pointer truncate max-w-xs">{item.server_url}</td>
                             <td className="px-6 py-4"><StatusBadge status={item.status} /></td>
                        </tr>
                    ))}
                </tbody>
             </table>
        </div>
    );
};

const ServersView: React.FC = () => {
    const [servers, setServers] = useState<UploadServer[]>([]);

    useEffect(() => {
        api.upload.getServers().then(setServers);
    }, []);

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">Add Server</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {servers.map((server, idx) => (
                    <div key={idx} className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                         <div className="flex items-center gap-4">
                             <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 dark:text-slate-400">
                                 <Server size={24} />
                             </div>
                             <div>
                                 <h3 className="font-bold text-slate-900 dark:text-white">{server.name}</h3>
                                 <p className="text-sm text-slate-500 dark:text-slate-400">{server.url}</p>
                                 <div className="flex items-center gap-2 mt-1">
                                     <span className={`w-2 h-2 rounded-full ${server.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                     <span className="text-xs text-slate-400 uppercase font-bold">{server.status}</span>
                                 </div>
                             </div>
                         </div>
                         <div className="flex flex-col gap-2">
                             <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"><Settings size={18}/></button>
                         </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    if (status === 'completed') {
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-1 rounded-full"><Check size={12} /> Done</span>;
    }
    if (status === 'uploading') {
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-1 rounded-full"><UploadCloud size={12} /> Uploading</span>;
    }
    if (status === 'failed') {
        return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-400 px-2 py-1 rounded-full"><XOctagon size={12} /> Failed</span>;
    }
    return <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 bg-slate-100 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-full"><Clock size={12} /> Pending</span>;
};

export default UploadTasks;
