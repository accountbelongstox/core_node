
import React, { useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
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
  Play,
  CheckCircle,
  XCircle,
  Clock,
  GitBranch,
  Server
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { UserRole, AppStatus } from '../types';
import { StatCard } from './StatCard';
import { MOCK_APPS, MOCK_TECH, MOCK_APP_REQUESTS } from '../constants';

const TechOverview = () => {
  const { t, user } = useApp();
  const techData = useMemo(() => {
    const tech = MOCK_TECH.find(t => t.id === user?.id || 'tech1');
    if (!tech) return null;
    
    const myApps = MOCK_APPS.filter(app => app.assignedTechId === tech.id);
    const pendingTasks = MOCK_APP_REQUESTS.filter(req => req.assignedTechId === tech.id && req.status === 'pending');
    const inProgressTasks = MOCK_APP_REQUESTS.filter(req => req.assignedTechId === tech.id && req.status === 'in_progress');
    
    return { tech, myApps, pendingTasks, inProgressTasks };
  }, [user]);

  if (!techData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Tasks" value={techData.inProgressTasks.length.toString()} change="+1" isPositive icon={<Terminal size={20} />} />
        <StatCard title="Apps Generated" value={techData.tech.appsGenerated.toString()} icon={<Box size={20} />} />
        <StatCard title="Pending Tasks" value={techData.pendingTasks.length.toString()} icon={<Clock size={20} />} />
        <StatCard title="Status" value={techData.tech.status} icon={<Activity size={20} />} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">My Projects</h3>
          <div className="space-y-3">
            {techData.myApps.slice(0, 5).map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{app.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{app.category}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  app.status === AppStatus.LIVE ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  app.status === AppStatus.PENDING ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
                }`}>
                  {app.status}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Work Summary</h3>
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Specialization</p>
              <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{techData.tech.specialization}</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Apps Generated</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{techData.tech.appsGenerated}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const GenerationQueue = () => {
  const { t, user } = useApp();
  const techData = useMemo(() => {
    const tech = MOCK_TECH.find(t => t.id === user?.id || 'tech1');
    if (!tech) return null;
    return {
      tech,
      allTasks: MOCK_APP_REQUESTS,
      myTasks: MOCK_APP_REQUESTS.filter(req => req.assignedTechId === tech.id),
      pendingTasks: MOCK_APP_REQUESTS.filter(req => req.status === 'pending'),
      inProgressTasks: MOCK_APP_REQUESTS.filter(req => req.status === 'in_progress')
    };
  }, [user]);

  if (!techData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Generation Queue</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Clock size={20} />
            Pending Tasks ({techData.pendingTasks.length})
          </h3>
          <div className="space-y-3">
            {techData.pendingTasks.map(task => (
              <div key={task.id} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-800 dark:text-white">{task.name}</h4>
                  <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs">
                    {task.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">{task.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                  <span>{task.category}</span>
                  <span>{task.requestedAt}</span>
                </div>
                {!task.assignedTechId && (
                  <button className="mt-3 w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                    Accept Task
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
            <Activity size={20} />
            In Progress ({techData.inProgressTasks.length})
          </h3>
          <div className="space-y-3">
            {techData.inProgressTasks.map(task => (
              <div key={task.id} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-indigo-200 dark:border-indigo-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-800 dark:text-white">{task.name}</h4>
                  <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full text-xs">
                    {task.status}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{task.description}</p>
                {task.estimatedCompletionDate && (
                  <div className="mb-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Estimated Completion</p>
                    <p className="text-sm font-medium text-slate-800 dark:text-white">{task.estimatedCompletionDate}</p>
                  </div>
                )}
                <div className="flex gap-2">
                  <button className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm flex items-center justify-center gap-2">
                    <CheckCircle size={16} />
                    Complete
                  </button>
                  <button className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-sm">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const MyProjects = () => {
  const { t, user } = useApp();
  const techData = useMemo(() => {
    const tech = MOCK_TECH.find(t => t.id === user?.id || 'tech1');
    if (!tech) return null;
    return {
      tech,
      myApps: MOCK_APPS.filter(app => app.assignedTechId === tech.id)
    };
  }, [user]);

  if (!techData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My Projects</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {techData.myApps.map(app => (
          <div key={app.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{app.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                app.status === AppStatus.PENDING ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
              }`}>
                {app.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{app.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Revenue</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Visits</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm flex items-center justify-center gap-2">
                <GitBranch size={16} />
                Deploy
              </button>
              <button className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500 transition-colors text-sm">
                Monitor
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Monitoring = () => {
  const { t, user } = useApp();
  const techData = useMemo(() => {
    const tech = MOCK_TECH.find(t => t.id === user?.id || 'tech1');
    if (!tech) return null;
    return {
      tech,
      myApps: MOCK_APPS.filter(app => app.assignedTechId === tech.id)
    };
  }, [user]);

  if (!techData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">App Monitoring</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <Server size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">System Health</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">99.9%</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity size={24} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Active Apps</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{techData.myApps.filter(a => a.status === AppStatus.LIVE).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Monitor size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Avg Response</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">120ms</p>
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">App Performance</h3>
        <div className="space-y-3">
          {techData.myApps.map(app => (
            <div key={app.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
              <div>
                <p className="font-medium text-slate-800 dark:text-white">{app.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{app.status}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">visits</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">${app.revenue.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">revenue</p>
                </div>
                <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
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
    { icon: <Monitor size={20} />, label: 'Monitoring', path: '/monitoring' },
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
        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>
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
            <Route path="/projects" element={<MyProjects />} />
            <Route path="/monitoring" element={<Monitoring />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

