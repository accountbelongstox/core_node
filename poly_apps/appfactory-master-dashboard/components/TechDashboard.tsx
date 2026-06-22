
import React, { useMemo } from 'react';
import { Routes, Route, Link, useLocation, useParams, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Code,
  Box,
  Monitor,
  Zap,
  Settings,
  Bell,
  ChevronRight,
  Terminal,
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Server,
  Code2,
  Search,
  Filter,
  MoreVertical,
  ArrowUpRight,
  Rocket,
  ArrowLeft,
  MapPin,
  Smartphone
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { UserRole, AppStatus } from '../types';
import { StatCard } from './StatCard';
import { modelService } from '../services/modelService';
import { LanguageSelector } from './LanguageSelector';
import { Profile } from './Profile';
import { NotificationCenter } from './NotificationCenter';
import { AppReleaseForm } from './AppReleaseForm';
import { PromotionTrackView } from './PromotionTrackView';
import { AppReleaseList } from './AppReleaseList';
import { AppReleaseDetail } from './AppReleaseDetail';

const TechOverview = () => {
  const { t, user } = useApp();
  
  const techStats = useMemo(() => {
    const techTeam = modelService.getTechTeam();
    const appRequests = modelService.getAppRequests();
    const apps = modelService.getApps();
    
    const tech = techTeam.find(t => t.id === (user?.id ?? 'tech1'));
    if (!tech) return null;
    
    const myTasks = appRequests.filter(r => r.assignedTechId === tech.id);
    const myProjects = apps.filter(a => a.assignedTechId === tech.id);
    return {
      tech,
      activeTasks: myTasks.filter(t => t.status === 'in_progress').length,
      completedApps: myProjects.length,
      pendingTasks: myTasks.filter(t => t.status === 'pending').length,
      myTasks,
      myProjects,
    };
  }, [user]);

  if (!techStats) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('techDashboard.activeTasks')} value={techStats.activeTasks.toString()} change="+1" isPositive icon={<Terminal size={20} />} />
        <StatCard title={t('techDashboard.completedApps')} value={techStats.completedApps.toString()} icon={<Box size={20} />} />
        <StatCard title={t('techDashboard.avgBuildTime')} value="4m 20s" change="-15s" isPositive icon={<Activity size={20} />} />
        <StatCard title={t('techDashboard.systemHealth')} value="99.9%" icon={<Monitor size={20} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('techDashboard.buildActivity')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={modelService.getDailyStats()}>
                  <defs>
                    <linearGradient id="colorBuild" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="visits" name="Builds" stroke="#6366f1" fillOpacity={1} fill="url(#colorBuild)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('techDashboard.activeGenerationQueue')}</h3>
              <Link to="/queue" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">{t('techDashboard.viewFullQueue')}</Link>
            </div>
            <div className="space-y-4">
              {techStats.myTasks?.filter(r => r.status === 'in_progress').slice(0, 3).map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 group hover:border-indigo-500/50 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Terminal size={24} />
                    </div>
                    <div>
                      <Link to={`/queue/${req.id}`} className="text-sm font-bold text-slate-800 dark:text-white hover:text-indigo-600 transition-colors">{req.name}</Link>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded uppercase">{req.category}</span>
                        <span className="text-[10px] font-bold text-amber-500 uppercase flex items-center gap-1">
                          <Clock size={10} />
                          {req.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
                    <Play size={18} fill="currentColor" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl text-white shadow-xl shadow-slate-900/20">
            <h4 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Server size={16} />
              {t('techDashboard.serverResources')}
            </h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>{t('techDashboard.cpuUsage')}</span>
                  <span className="text-emerald-400">24%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: '24%' }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>{t('techDashboard.ramUsage')}</span>
                  <span className="text-indigo-400">4.2GB / 16GB</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400" style={{ width: '35%' }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>{t('techDashboard.activeBuilds')}</span>
                  <span className="text-amber-400">2 / 5 Max</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: '40%' }} />
                </div>
              </div>
            </div>
            <button className="w-full mt-8 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              {t('techDashboard.resourceMonitor')}
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('techDashboard.quickTools')}</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Code2 className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t('techDashboard.snippets')}</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Rocket className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t('techDashboard.deploy')}</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Terminal className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t('techDashboard.logs')}</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Zap className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">{t('techDashboard.aiHelp')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Generation Queue Component
const GenerationQueue = () => {
  const { t } = useApp();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.appGenerationQueue')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('techDashboard.manageAndMonitor')}</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{t('techDashboard.autoGenActive')}</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {[t('techDashboard.allStatus'), t('techDashboard.pending'), t('techDashboard.inProgress'), t('techDashboard.completed'), t('techDashboard.failed')].map(status => (
              <button
                key={status}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  status === t('techDashboard.allStatus')
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' 
                    : 'bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t('techDashboard.searchTasks')}
              className="pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.requestId')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.appName')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.category')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.progress')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">{t('techDashboard.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {modelService.getAppRequests().map(req => (
                <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-slate-500">#{req.id.toUpperCase()}</code>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/queue/${req.id}`} className="text-sm font-bold text-slate-800 dark:text-white hover:text-indigo-600 transition-colors">{req.name}</Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded uppercase">{req.category}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${
                          req.status === 'in_progress' ? 'bg-indigo-500' : 'bg-slate-300'
                        }`} style={{ width: req.status === 'in_progress' ? '45%' : '0%' }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{req.status === 'in_progress' ? '45%' : '0%'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      req.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 
                      req.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      req.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                      'bg-rose-50 text-rose-700 border border-rose-100'
                    }`}>
                      {req.status === 'in_progress' ? <Zap size={10} /> : 
                       req.status === 'pending' ? <Clock size={10} /> :
                       req.status === 'completed' ? <CheckCircle2 size={10} /> :
                       <AlertCircle size={10} />}
                      {req.status === 'pending' ? t('appGeneration.statusPending') :
                       req.status === 'in_progress' ? t('appGeneration.statusInProgress') :
                       req.status === 'completed' ? t('appGeneration.statusCompleted') :
                       req.status === 'failed' ? t('appGeneration.statusFailed') : req.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                      <Play size={16} fill="currentColor" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg transition-all ml-2">
                      <MoreVertical size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Build & Deployment Component
const BuildDeployment = () => {
  const { t } = useApp();
  const builds = useMemo(() => modelService.getBuilds(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.buildAndDeploy')}</h2>
          <p className="text-sm text-slate-500">{t('techDashboard.manageAndMonitor')}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all">
            <Rocket size={18} />
            {t('techDashboard.newBuild')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
            <Rocket size={18} />
            {t('techDashboard.deployToProduction')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('techDashboard.buildHistory')}</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {builds.map(build => (
                <div key={build.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      build.status === 'Success' ? 'bg-emerald-100 text-emerald-600' :
                      build.status === 'Failed' ? 'bg-rose-100 text-rose-600' :
                      'bg-indigo-100 text-indigo-600 animate-pulse'
                    }`}>
                      {build.status === 'Success' ? <CheckCircle2 size={24} /> :
                       build.status === 'Failed' ? <AlertCircle size={24} /> :
                       <Clock size={24} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{build.app}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono text-slate-500">{build.id}</code>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs text-slate-500">{build.version}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{build.duration}</p>
                    <p className="text-xs text-slate-500">{build.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 p-6 rounded-2xl text-white">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t('techDashboard.buildLogs')}</h4>
            <div className="font-mono text-[10px] space-y-1 opacity-60 max-h-64 overflow-y-auto">
              <p className="text-emerald-400">[14:23:15] Starting build process...</p>
              <p>[14:23:16] Installing dependencies...</p>
              <p>[14:23:45] Compiling TypeScript...</p>
              <p>[14:24:12] Running tests...</p>
              <p className="text-emerald-400">[14:24:30] All tests passed</p>
              <p>[14:25:00] Building production bundle...</p>
              <p className="text-emerald-400">[14:27:38] Build completed successfully</p>
              <p>[14:27:38] Total size: 2.4MB (gzipped: 856KB)</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('techDashboard.quickActions')}</h3>
            <div className="space-y-3">
              <button className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                <Rocket size={18} />
                {t('techDashboard.deployToTest')}
              </button>
              <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <Rocket size={18} />
                {t('techDashboard.deployToProd')}
              </button>
              <button className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                <ArrowLeft size={18} />
                {t('techDashboard.rollback')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Performance Monitoring Component
const PerformanceMonitoring = () => {
  const { t, user } = useApp();
  const apps = useMemo(() => {
    const techTeam = modelService.getTechTeam();
    const apps = modelService.getApps();
    const tech = techTeam.find(t => t.id === (user?.id ?? 'tech1'));
    if (!tech) return [];
    return apps.filter(a => a.assignedTechId === tech.id).slice(0, 5);
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.performanceMonitoring')}</h2>
          <p className="text-sm text-slate-500">{t('techDashboard.realTimeMetrics')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {apps.map(app => (
          <div key={app.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{app.name}</h3>
              <div className={`w-3 h-3 rounded-full ${
                app.status === AppStatus.LIVE ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`} />
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">{t('techDashboard.responseTime')}</span>
                  <span className="text-emerald-500">142ms</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '85%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">{t('techDashboard.errorRate')}</span>
                  <span className="text-rose-500">0.02%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: '2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">{t('techDashboard.uptime')}</span>
                  <span className="text-indigo-500">99.98%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: '99.98%' }} />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 mb-1">{t('techDashboard.activeUsers')}</p>
                    <p className="font-bold text-slate-800 dark:text-white">{app.dailyActiveUsers.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">{t('techDashboard.requestsPerMin')}</p>
                    <p className="font-bold text-slate-800 dark:text-white">1,234</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Bug Tracking Component
const BugTracking = () => {
  const { t } = useApp();
  const bugs = useMemo(() => modelService.getBugs(), []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.bugTracking')}</h2>
          <p className="text-sm text-slate-500">{t('techDashboard.manageAndMonitor')}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
          <AlertCircle size={18} />
          {t('techDashboard.reportBug')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.idAndApplication')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.issue')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.priority')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.status')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('techDashboard.reporter')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">{t('techDashboard.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {bugs.map(bug => (
              <tr key={bug.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-xs font-mono text-indigo-600 font-bold">{bug.id}</span>
                    <span className="text-sm font-bold text-slate-800 dark:text-white">{bug.app}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">{bug.issue}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                    bug.priority === 'Critical' ? 'bg-rose-100 text-rose-600' :
                    bug.priority === 'High' ? 'bg-orange-100 text-orange-600' :
                    bug.priority === 'Medium' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {bug.priority}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`flex items-center gap-1 text-[10px] font-bold uppercase ${
                    bug.status === 'In Progress' ? 'text-indigo-600' :
                    bug.status === 'Pending' ? 'text-amber-600' : 'text-emerald-600'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      bug.status === 'In Progress' ? 'bg-indigo-600 animate-pulse' :
                      bug.status === 'Pending' ? 'bg-amber-600' : 'bg-emerald-600'
                    }`} />
                    {bug.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{bug.reporter}</td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <ChevronRight size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Task Details Component
const TaskDetails = () => {
  const { t } = useApp();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const req = useMemo(() => {
    const appRequests = modelService.getAppRequests();
    return appRequests.find(r => r.id === id);
  }, [id]);

  if (!req) return <div className="p-8 text-center">{t('techDashboard.taskNotFound')}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={20} />
          {t('techDashboard.backToQueue')}
        </button>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20">
            <Play size={18} fill="currentColor" />
            {t('techDashboard.startBuild')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-indigo-600 shadow-sm">
                <Terminal size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{req.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 rounded uppercase">{req.category}</span>
                  <span className="text-xs font-bold text-slate-400">Request ID: #{req.id}</span>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Rocket size={16} />
                  {t('techDashboard.projectRequirements')}
                </h3>
                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic">
                    "{req.description}"
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{t('techDashboard.coreFeaturesToImplement')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {req.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={14} />
                      </div>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Zap size={16} />
                  {t('techDashboard.aiGeneratedSuggestions')}
                </h3>
                <div className="p-6 border-2 border-dashed border-indigo-100 dark:border-indigo-900/50 rounded-2xl bg-indigo-50/30 dark:bg-indigo-900/10">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                        <Code size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">{t('techDashboard.recommendedTechStack')}</p>
                        <p className="text-xs text-slate-500">React 18+, TailwindCSS, Supabase for realtime DB, Edge Functions.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shrink-0">
                        <Zap size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">{t('techDashboard.performanceTip')}</p>
                        <p className="text-xs text-slate-500">Use optimistic UI updates for recipe ratings to ensure zero-latency feel.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">{t('techDashboard.taskInfo')}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-500">{t('techDashboard.status')}</span>
                <span className="text-xs font-bold text-amber-500 uppercase">{req.status}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-500">{t('techDashboard.requestedAt')}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">{req.requestedAt}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-500">{t('techDashboard.targetAudience')}</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">{req.targetAudience}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-slate-500">{t('techDashboard.estimatedEffort')}</span>
                <span className="text-xs font-bold text-indigo-600 uppercase">3-4 Days</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{t('techDashboard.buildLogs')}</h4>
            <div className="font-mono text-[10px] space-y-1 opacity-60">
              <p className="text-emerald-400">[09:00:21] Task initialized...</p>
              <p>[09:00:22] Fetching requirements...</p>
              <p>[09:00:24] Analyzing with Gemini AI...</p>
              <p className="text-amber-400">[09:00:25] Warning: missing icon assets</p>
              <p>[09:00:25] Ready for manual build.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Technical Projects List
const MyProjects = () => {
  const { t, user } = useApp();
  const myProjects = useMemo(() => {
    const techTeam = modelService.getTechTeam();
    const apps = modelService.getApps();
    const tech = techTeam.find(t => t.id === (user?.id ?? 'tech1'));
    if (!tech) return [];
    return apps.filter(a => a.assignedTechId === tech.id);
  }, [user]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('techDashboard.technicalProjects')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('techDashboard.applicationsGeneratedAndMaintained')}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
          <Code size={18} />
          {t('techDashboard.openIDE')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myProjects.map(app => (
          <div key={app.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-xl">
                  {app.name.charAt(0)}
                </div>
                <div className="flex flex-col items-end">
                  <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                    app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {app.status}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">v1.2.4</span>
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors">{app.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">Technical stack: React, Node.js, PostgreSQL</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Activity size={10} /> Performance
                  </p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">99%</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1">
                    <Monitor size={10} /> Error Rate
                  </p>
                  <p className="text-sm font-bold text-rose-500">0.02%</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                <span>{t('techDashboard.lastDeploy')}</span>
                <span>2 hours ago</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <button className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 hover:text-indigo-600 transition-all">
                <Terminal size={14} />
                {t('techDashboard.buildLogs')}
              </button>
              <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                <Settings size={14} />
                {t('techDashboard.config')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Sidebar: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { t, user, logout } = useApp();
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: t('nav.overview'), path: '/' },
    { icon: <Terminal size={20} />, label: t('techDashboard.generationQueue'), path: '/queue' },
    { icon: <Box size={20} />, label: t('techDashboard.myProjects'), path: '/projects' },
    { icon: <Rocket size={20} />, label: t('techDashboard.releaseApp'), path: '/release' },
    { icon: <Smartphone size={20} />, label: t('nav.publishedApps'), path: '/app-releases' },
    { icon: <MapPin size={20} />, label: t('techDashboard.promotionTrack'), path: '/promotion-tracks' },
    { icon: <Rocket size={20} />, label: t('techDashboard.buildAndDeploy'), path: '/build' },
    { icon: <AlertCircle size={20} />, label: t('techDashboard.bugTracking'), path: '/bugs' },
    { icon: <Monitor size={20} />, label: t('techDashboard.monitoring'), path: '/monitoring' },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <Zap size={24} fill="currentColor" />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400">
          {t('app.name')}
        </h1>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
              isActive(item.path)
                ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            {item.icon}
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold">
            {user ? user.name.substring(0, 2).toUpperCase() : 'TE'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.name ?? t('techDashboard.techUser')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('techDashboard.technicalEngineer')}</p>
          </div>
          <button onClick={onOpenSettings} className="ml-auto text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <Settings size={18} />
          </button>
        </div>
        <button 
          onClick={logout}
          className="w-full py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {t('common.logout')}
        </button>
      </div>
    </aside>
  );
};

const Header = () => {
  const { t } = useApp();
  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-10 px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 text-slate-400">
        <div className="flex items-center gap-1 text-sm">
          <span>{t('techDashboard.technicalPortal')}</span>
          <ChevronRight size={14} />
          <span className="text-slate-800 dark:text-white font-medium">{t('nav.overview')}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <LanguageSelector />
        <Link to="/notifications" className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
        </Link>
        <div className="h-6 w-px bg-slate-200 dark:border-slate-700 mx-2" />
        <Link to="/profile" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs group-hover:ring-2 ring-indigo-500 transition-all">
            TE
          </div>
        </Link>
      </div>
    </header>
  );
};

interface TechDashboardProps {
  onOpenSettings: () => void;
}

export const TechDashboard: React.FC<TechDashboardProps> = ({ onOpenSettings }) => {
  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-slate-900">
      <Sidebar onOpenSettings={onOpenSettings} />
      <main className="flex-1 ml-64 flex flex-col">
        <Header />
        <div className="p-8">
          <Routes>
            <Route path="/" element={<TechOverview />} />
            <Route path="/queue" element={<GenerationQueue />} />
            <Route path="/queue/:id" element={<TaskDetails />} />
            <Route path="/projects" element={<MyProjects />} />
            <Route path="/release" element={<AppReleaseForm />} />
            <Route path="/app-releases" element={<AppReleaseList />} />
            <Route path="/app-releases/:id" element={<AppReleaseDetail />} />
            <Route path="/promotion-tracks" element={<PromotionTrackView />} />
            <Route path="/build" element={<BuildDeployment />} />
            <Route path="/bugs" element={<BugTracking />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/monitoring" element={<PerformanceMonitoring />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};
