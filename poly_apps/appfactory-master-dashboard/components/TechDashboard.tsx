
import React from 'react';
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
  Activity
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { UserRole } from '../types';
import { StatCard } from './StatCard';

const TechOverview = () => {
  const { t } = useApp();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Active Tasks" value="5" change="+1" isPositive icon={<Terminal size={20} />} />
        <StatCard title="Apps Generated" value="42" icon={<Box size={20} />} />
        <StatCard title="Avg Build Time" value="4m 20s" change="-15s" isPositive icon={<Activity size={20} />} />
        <StatCard title="System Health" value="99.9%" icon={<Monitor size={20} />} />
      </div>
      
      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center min-h-[400px]">
        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-full text-indigo-600 dark:text-indigo-400 mb-4">
          <Code size={48} />
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white">Technical Workspace</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-center max-w-md">
          Access the generation queue, manage builds, and monitor app performance from your technical dashboard.
        </p>
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
            <Route path="/queue" element={<div className="flex items-center justify-center h-96 text-slate-400">Queue Coming Soon</div>} />
            <Route path="/projects" element={<div className="flex items-center justify-center h-96 text-slate-400">Projects Coming Soon</div>} />
            <Route path="/monitoring" element={<div className="flex items-center justify-center h-96 text-slate-400">Monitoring Coming Soon</div>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

