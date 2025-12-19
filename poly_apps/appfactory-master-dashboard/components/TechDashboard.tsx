
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
  Cpu,
  Server,
  Code2,
  Search,
  Filter,
  MoreVertical,
  ArrowUpRight,
  Rocket,
  ArrowLeft
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { UserRole, AppStatus } from '../types';
import { StatCard } from './StatCard';
import { MOCK_APP_REQUESTS, MOCK_APPS, MOCK_DAILY_STATS } from '../constants';

const TechOverview = () => {
  const { t } = useApp();
  
  const techStats = useMemo(() => {
    const myTasks = MOCK_APP_REQUESTS.filter(r => r.assignedTechId === 'tech2'); // Mocking tech2
    const myProjects = MOCK_APPS.filter(a => a.assignedTechId === 'tech2');
    return {
      activeTasks: myTasks.length,
      completedApps: myProjects.length,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Tasks" value={techStats.activeTasks.toString()} change="+1" isPositive icon={<Terminal size={20} />} />
        <StatCard title="Completed Apps" value={techStats.completedApps.toString()} icon={<Box size={20} />} />
        <StatCard title="Avg Build Time" value="4m 20s" change="-15s" isPositive icon={<Activity size={20} />} />
        <StatCard title="System Health" value="99.9%" icon={<Monitor size={20} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Build Activity</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_DAILY_STATS}>
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
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Active Generation Queue</h3>
              <Link to="/queue" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View Full Queue</Link>
            </div>
            <div className="space-y-4">
              {MOCK_APP_REQUESTS.filter(r => r.assignedTechId === 'tech2').map(req => (
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
              Server Resources
            </h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>CPU Usage</span>
                  <span className="text-emerald-400">24%</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: '24%' }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>RAM Usage</span>
                  <span className="text-indigo-400">4.2GB / 16GB</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400" style={{ width: '35%' }} />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span>Active Builds</span>
                  <span className="text-amber-400">2 / 5 Max</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400" style={{ width: '40%' }} />
                </div>
              </div>
            </div>
            <button className="w-full mt-8 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              Resource Monitor
              <ArrowUpRight size={14} />
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Quick Tools</h3>
            <div className="grid grid-cols-2 gap-4">
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Code2 className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Snippets</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Rocket className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Deploy</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Terminal className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">Logs</span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-2xl border border-slate-100 dark:border-slate-700 hover:border-indigo-500/50 transition-all group">
                <Zap className="text-slate-400 group-hover:text-indigo-600" size={24} />
                <span className="text-[10px] font-bold text-slate-500 uppercase">AI Help</span>
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">APP Generation Queue</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage and monitor automated APP generation tasks</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Auto-Gen: Active</span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
            {['All Status', 'Pending', 'In Progress', 'Completed', 'Failed'].map(status => (
              <button
                key={status}
                className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  status === 'All Status' 
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
              placeholder="Search tasks..."
              className="pl-10 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-64"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Request ID</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">App Name</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Category</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Progress</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {MOCK_APP_REQUESTS.map(req => (
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
                      req.status === 'in_progress' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                    }`}>
                      {req.status === 'in_progress' ? <Zap size={10} /> : <Clock size={10} />}
                      {req.status}
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

import { Profile } from './Profile';
import { NotificationCenter } from './NotificationCenter';

// Build & Deployment Component
const BuildDeployment = () => {
  const builds = [
    { id: 'BUILD-001', app: 'Smart Expense Pro', status: 'Success', duration: '4m 23s', timestamp: '2 hours ago', version: 'v1.2.4' },
    { id: 'BUILD-002', app: 'FitTrack Plus', status: 'Failed', duration: '2m 15s', timestamp: '5 hours ago', version: 'v1.1.0' },
    { id: 'BUILD-003', app: 'LearnHub Academy', status: 'Success', duration: '5m 42s', timestamp: '1 day ago', version: 'v2.0.1' },
    { id: 'BUILD-004', app: 'CryptoTrade Hub', status: 'In Progress', duration: '3m 10s', timestamp: 'Just now', version: 'v1.5.2' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Build & Deployment</h2>
          <p className="text-sm text-slate-500">Manage app builds and deployments</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all">
            <Rocket size={18} />
            New Build
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
            <Rocket size={18} />
            Deploy to Production
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Build History</h3>
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
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Build Logs</h4>
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
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                <Rocket size={18} />
                Deploy to Test
              </button>
              <button className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <Rocket size={18} />
                Deploy to Prod
              </button>
              <button className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2">
                <ArrowLeft size={18} />
                Rollback
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
  const apps = MOCK_APPS.filter(a => a.assignedTechId === 'tech2').slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Performance Monitoring</h2>
          <p className="text-sm text-slate-500">Real-time app performance metrics</p>
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
                  <span className="text-slate-500">Response Time</span>
                  <span className="text-emerald-500">142ms</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: '85%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">Error Rate</span>
                  <span className="text-rose-500">0.02%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-rose-500" style={{ width: '2%' }} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-bold mb-2">
                  <span className="text-slate-500">Uptime</span>
                  <span className="text-indigo-500">99.98%</span>
                </div>
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: '99.98%' }} />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 mb-1">Active Users</p>
                    <p className="font-bold text-slate-800 dark:text-white">{app.dailyActiveUsers.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Requests/min</p>
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
  const bugs = [
    { id: 'BUG-001', app: 'Smart Expense Pro', issue: 'API timeout on receipt scan', priority: 'High', status: 'In Progress', reporter: 'Alice Chen' },
    { id: 'BUG-002', app: 'FitTrack Plus', issue: 'Avatar upload failing on Android', priority: 'Medium', status: 'Pending', reporter: 'Bob Smith' },
    { id: 'BUG-003', app: 'LearnHub Academy', issue: 'Video player controls hidden in dark mode', priority: 'Low', status: 'Closed', reporter: 'David Lee' },
    { id: 'BUG-004', app: 'CryptoTrade Hub', issue: 'Chart data not refreshing in real-time', priority: 'Critical', status: 'In Progress', reporter: 'John Admin' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Bug Tracking</h2>
          <p className="text-sm text-slate-500">Monitor and resolve application issues</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
          <AlertCircle size={18} />
          Report Bug
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">ID & Application</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Issue</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Priority</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Reporter</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
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
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const req = useMemo(() => MOCK_APP_REQUESTS.find(r => r.id === id), [id]);

  if (!req) return <div className="p-8 text-center">Task not found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={20} />
          Back to Queue
        </button>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20">
            <Play size={18} fill="currentColor" />
            Start Build
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
                  Project Requirements
                </h3>
                <div className="bg-slate-50 dark:bg-slate-700/30 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed italic">
                    "{req.description}"
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Core Features to Implement</h3>
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
                  AI Generated Suggestions (Gemini)
                </h3>
                <div className="p-6 border-2 border-dashed border-indigo-100 dark:border-indigo-900/50 rounded-2xl bg-indigo-50/30 dark:bg-indigo-900/10">
                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                        <Code size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Recommended Tech Stack</p>
                        <p className="text-xs text-slate-500">React 18+, TailwindCSS, Supabase for realtime DB, Edge Functions.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white shrink-0">
                        <Zap size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Performance Tip</p>
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
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6">Task Info</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-500">Status</span>
                <span className="text-xs font-bold text-amber-500 uppercase">{req.status}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-500">Requested At</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">{req.requestedAt}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-b border-slate-50 dark:border-slate-700">
                <span className="text-xs text-slate-500">Target Audience</span>
                <span className="text-xs font-bold text-slate-800 dark:text-white">{req.targetAudience}</span>
              </div>
              <div className="flex items-center justify-between py-3">
                <span className="text-xs text-slate-500">Estimated Effort</span>
                <span className="text-xs font-bold text-indigo-600 uppercase">3-4 Days</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 p-6 rounded-2xl text-white">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Build Logs</h4>
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
  const myProjects = MOCK_APPS.filter(a => a.assignedTechId === 'tech2');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Technical Projects</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Applications generated and maintained by you</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all">
          <Code size={18} />
          Open IDE
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
                <span>Last deploy</span>
                <span>2 hours ago</span>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <button className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1 hover:text-indigo-600 transition-all">
                <Terminal size={14} />
                Build Logs
              </button>
              <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                <Settings size={14} />
                Config
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
    { icon: <Terminal size={20} />, label: 'Generation Queue', path: '/queue' },
    { icon: <Box size={20} />, label: 'My Projects', path: '/projects' },
    { icon: <Rocket size={20} />, label: 'Build & Deploy', path: '/build' },
    { icon: <AlertCircle size={20} />, label: 'Bug Tracking', path: '/bugs' },
    { icon: <Monitor size={20} />, label: 'Monitoring', path: '/monitoring' },
  ];

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <div className="p-6 flex items-center gap-3">
        <div className="bg-indigo-600 p-2 rounded-lg text-white">
          <Zap size={24} fill="currentColor" />
        </div>
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-indigo-400">
          AppFactory
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
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.name || 'Tech User'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Technical Engineer</p>
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
          <span>Technical Portal</span>
          <ChevronRight size={14} />
          <span className="text-slate-800 dark:text-white font-medium">{t('nav.overview')}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <Link to="/notifications" className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
        </Link>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
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

