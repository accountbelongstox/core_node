import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Server, 
  Cpu, 
  ArrowUp, 
  ArrowDown, 
  HardDrive
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { api } from '../services/api';
import { useApp } from '../contexts/AppContext';
import { DashboardOverview, RealtimeMetrics } from '../types';

const Dashboard: React.FC = () => {
  const { t } = useApp();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [metrics, setMetrics] = useState<RealtimeMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewData, metricsData] = await Promise.all([
            api.dashboard.getOverview(),
            api.dashboard.getRealtimeMetrics(15)
        ]);
        setOverview(overviewData);
        setMetrics(metricsData);
      } catch (e) {
        console.error("Failed to load dashboard data", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading || !overview) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('dash.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">{t('dash.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                overview.system.status === 'running' 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
                System: {overview.system.status.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">v{overview.system.version}</span>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
            title={t('dash.cpu')} 
            value={`${overview.resources.cpu_usage.toFixed(1)}%`}
            icon={Cpu}
            color="text-blue-600 dark:text-blue-400"
            bg="bg-blue-600"
            trend="+2.4%"
            trendUp={true}
        />
        <StatCard 
            title={t('dash.memory')} 
            value={`${(overview.resources.memory_usage / 1024).toFixed(1)} GB`}
            icon={Server}
            color="text-purple-600 dark:text-purple-400"
            bg="bg-purple-600"
            subtext="of 64 GB"
        />
        <StatCard 
            title={t('dash.processed')} 
            value={overview.today_stats.processed_tasks.toLocaleString()}
            icon={Activity}
            color="text-green-600 dark:text-green-400"
            bg="bg-green-600"
            trend="99.6% Success"
            trendUp={true}
        />
        <StatCard 
            title={t('dash.disk')} 
            value={`${overview.resources.disk_usage.used} GB`}
            icon={HardDrive}
            color="text-orange-600 dark:text-orange-400"
            bg="bg-orange-600"
            subtext={`of ${overview.resources.disk_usage.total} GB`}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">CPU History (Real-time)</h3>
            <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics}>
                        <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                        <XAxis dataKey="timestamp" hide />
                        <YAxis domain={[0, 100]} tick={{fontSize: 12}} stroke="#94a3b8" />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}}
                          itemStyle={{color: '#f8fafc'}}
                        />
                        <Area type="monotone" dataKey="cpu_usage" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCpu)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Task Throughput</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics}>
                        <defs>
                            <linearGradient id="colorTask" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.3} />
                        <XAxis dataKey="timestamp" hide />
                        <YAxis tick={{fontSize: 12}} stroke="#94a3b8" />
                        <Tooltip 
                          contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc'}}
                          itemStyle={{color: '#f8fafc'}}
                        />
                        <Area type="monotone" dataKey="tasks_per_minute" stroke="#10b981" fillOpacity={1} fill="url(#colorTask)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">{t('dash.actions')}</h3>
          <div className="flex flex-wrap gap-4">
              <button className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors">
                  Restart Service
              </button>
              <button className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  Clear Cache
              </button>
              <button className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                  Run Diagnostics
              </button>
          </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
    title: string;
    value: string;
    icon: React.ElementType;
    color: string;
    bg: string;
    trend?: string;
    trendUp?: boolean;
    subtext?: string;
}> = ({ title, value, icon: Icon, color, bg, trend, trendUp, subtext }) => (
    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between h-32">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
            </div>
            <div className={`p-2 rounded-lg bg-opacity-10 dark:bg-opacity-20 ${bg.replace('bg-', 'bg-')} ${color}`}>
                <Icon size={20} />
            </div>
        </div>
        <div className="mt-auto">
            {trend && (
                <div className={`flex items-center text-xs font-medium ${trendUp ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {trendUp ? <ArrowUp size={12} className="mr-1" /> : <ArrowDown size={12} className="mr-1" />}
                    {trend}
                </div>
            )}
            {subtext && (
                <div className="text-xs text-slate-400 dark:text-slate-500">
                    {subtext}
                </div>
            )}
        </div>
    </div>
);

export default Dashboard;