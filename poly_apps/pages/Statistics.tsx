import React, { useEffect, useState } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  HardDrive, 
  Activity 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { PerformanceStats, UsageTrends, ResourceStats } from '../types';

const Statistics: React.FC = () => {
  const { t } = useApp();
  const [activeTab, setActiveTab] = useState<'performance' | 'trends' | 'resources'>('performance');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('stats.title')}</h1>
      </div>

      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex gap-6">
          <TabButton active={activeTab === 'performance'} onClick={() => setActiveTab('performance')} label={t('stats.performance')} icon={Activity} />
          <TabButton active={activeTab === 'trends'} onClick={() => setActiveTab('trends')} label={t('stats.trends')} icon={TrendingUp} />
          <TabButton active={activeTab === 'resources'} onClick={() => setActiveTab('resources')} label={t('stats.resources')} icon={HardDrive} />
        </nav>
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'performance' && <PerformanceView />}
        {activeTab === 'trends' && <TrendsView />}
        {activeTab === 'resources' && <ResourcesView />}
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

const PerformanceView: React.FC = () => {
    const { t } = useApp();
    const [stats, setStats] = useState<PerformanceStats | null>(null);

    useEffect(() => {
        api.stats.getPerformance().then(setStats);
    }, []);

    if (!stats) return <div className="p-8 text-center">{t('common.loading')}</div>;

    return (
        <div className="space-y-6">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('stats.cpu_mem')} (24h)</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.cpu_history}>
                            <defs>
                                <linearGradient id="colorCpuStat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorMemStat" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                            <XAxis 
                                dataKey="timestamp" 
                                tickFormatter={(tick) => new Date(tick).getHours() + ':00'} 
                                stroke="#94a3b8"
                                tick={{fontSize: 12}}
                            />
                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                            <Tooltip 
                                contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}}
                                itemStyle={{color: '#f8fafc'}}
                                labelFormatter={(label) => new Date(label).toLocaleString()}
                            />
                            <Legend />
                            <Area type="monotone" dataKey="value" name="CPU %" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpuStat)" data={stats.cpu_history} />
                            <Area type="monotone" dataKey="value" name="RAM %" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorMemStat)" data={stats.memory_history} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
             </div>
        </div>
    );
};

const TrendsView: React.FC = () => {
    const { t } = useApp();
    const [trends, setTrends] = useState<UsageTrends | null>(null);

    useEffect(() => {
        api.stats.getTrends().then(setTrends);
    }, []);

    if (!trends) return <div className="p-8 text-center">{t('common.loading')}</div>;

    return (
        <div className="space-y-6">
             <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">Task & Upload Volume (7 Days)</h3>
                <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trends.data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                            <XAxis dataKey="date" stroke="#94a3b8" tick={{fontSize: 12}} />
                            <YAxis stroke="#94a3b8" tick={{fontSize: 12}} />
                            <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}}
                                itemStyle={{color: '#f8fafc'}}
                            />
                            <Legend />
                            <Bar dataKey="tasks" name="Processed Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="uploads" name="Files Uploaded" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
             </div>
        </div>
    );
};

const ResourcesView: React.FC = () => {
    const { t } = useApp();
    const [resources, setResources] = useState<ResourceStats | null>(null);

    useEffect(() => {
        api.stats.getResources().then(setResources);
    }, []);

    if (!resources) return <div className="p-8 text-center">{t('common.loading')}</div>;

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {/* Disk Usage */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('stats.disk')}</h3>
                {resources.disk.map((disk, index) => (
                    <div key={index} className="mb-6 last:mb-0">
                         <div className="flex justify-between items-center mb-2">
                             <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{disk.mount}</span>
                             <span className="text-xs text-slate-500">{disk.used} GB / {disk.total} GB</span>
                         </div>
                         <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                             <div 
                                className="bg-blue-600 h-full rounded-full" 
                                style={{width: `${(disk.used / disk.total) * 100}%`}}
                             ></div>
                         </div>
                    </div>
                ))}
             </div>

             {/* Network Usage */}
             <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">{t('stats.network')}</h3>
                <div className="space-y-4">
                    {resources.network.map((net, index) => (
                        <div key={index} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                                    <Activity size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800 dark:text-slate-200">{net.interface}</div>
                                    <div className="text-xs text-slate-500">Network Interface</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <span className="text-green-500">↓ {(net.download_total / 1024).toFixed(1)} GB</span>
                                </div>
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <span className="text-blue-500">↑ {(net.upload_total / 1024).toFixed(1)} GB</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>
    );
};

export default Statistics;