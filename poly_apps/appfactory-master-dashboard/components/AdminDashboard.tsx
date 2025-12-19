
import React, { useState, useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  Users,
  BarChart3,
  Bell,
  Search,
  PlusCircle,
  TrendingUp,
  DollarSign,
  UserCheck,
  ChevronRight,
  MoreVertical,
  Zap,
  Settings
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { MOCK_APPS, MOCK_CS, MOCK_DAILY_STATS } from '../constants';
import { AppStatus, UserRole } from '../types';
import { StatCard } from './StatCard';
import { useApp } from '../contexts/AppContext';

// Dashboard Overview Page
const DashboardOverview = () => {
  const { t } = useApp();
  const stats = useMemo(() => {
    const totalRevenue = MOCK_APPS.reduce((acc, app) => acc + app.revenue, 0);
    const totalVisits = MOCK_APPS.reduce((acc, app) => acc + app.visits, 0);
    const activeApps = MOCK_APPS.filter(a => a.status === AppStatus.LIVE).length;
    return { totalRevenue, totalVisits, activeApps };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.totalRevenue')} value={`$${stats.totalRevenue.toLocaleString()}`} change="+12.5%" isPositive icon={<DollarSign size={20} />} />
        <StatCard title={t('dashboard.totalVisits')} value={stats.totalVisits.toLocaleString()} change="+18.2%" isPositive icon={<TrendingUp size={20} />} />
        <StatCard title={t('dashboard.activeApps')} value={stats.activeApps} change="+2" isPositive icon={<Smartphone size={20} />} />
        <StatCard title={t('dashboard.csMembers')} value={MOCK_CS.length} icon={<UserCheck size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('dashboard.performanceTrends')}</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_DAILY_STATS}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#6366f1" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('dashboard.recentApplications')}</h3>
          <div className="space-y-4">
            {MOCK_APPS.slice(0, 5).map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${app.status === AppStatus.LIVE ? 'bg-emerald-500' : app.status === AppStatus.PENDING ? 'bg-amber-500' : 'bg-rose-500'}`} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-white">{app.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{app.createdAt}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">${app.revenue}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{app.visits} visits</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors">
            {t('dashboard.viewAllApps')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Apps Management Page
const AppsList = () => {
  const { t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredApps = MOCK_APPS.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white">{t('apps.title')}</h2>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t('apps.searchPlaceholder')}
              className="pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 w-full md:w-64"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2">
            <PlusCircle size={18} />
            {t('apps.generateNew')}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <tr>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apps.name')}</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apps.status')}</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apps.revenue')}</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Assigned CS</th>
              <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('apps.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredApps.map(app => (
              <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800 dark:text-white">{app.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Created: {app.createdAt}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    app.status === AppStatus.PENDING ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {t(`apps.${app.status.toLowerCase()}`)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">${app.revenue.toLocaleString()}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{app.visits.toLocaleString()} visits</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex -space-x-2">
                    {app.assignedCSIds.map(csId => {
                      const cs = MOCK_CS.find(c => c.id === csId);
                      return cs ? (
                        <img 
                          key={cs.id} 
                          src={cs.avatar} 
                          alt={cs.name} 
                          className="w-8 h-8 rounded-full border-2 border-white"
                          title={cs.name}
                        />
                      ) : null;
                    })}
                    <button className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-slate-500 hover:bg-slate-200">
                      <PlusCircle size={14} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <button className="text-slate-400 hover:text-indigo-600 transition-colors">
                    <MoreVertical size={20} />
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

// CS Management Page
const CSTeam = () => {
  const { t } = useApp();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('cs.title')}</h2>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
          {t('cs.addMember')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MOCK_CS.map(cs => (
          <div key={cs.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center">
            <div className="relative">
              <img src={cs.avatar} alt={cs.name} className="w-20 h-20 rounded-full mb-4 ring-4 ring-slate-50 dark:ring-slate-700" />
              <div className={`absolute bottom-4 right-0 w-4 h-4 rounded-full border-2 border-white ${cs.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white">{cs.name}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">CS Specialist</p>

            <div className="w-full grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">{t('cs.totalEarnings')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">${cs.totalEarnings.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">{t('cs.assignedApps')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{cs.assignedAppIds.length}</p>
              </div>
            </div>

            <button className="mt-6 w-full py-2 bg-slate-50 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 text-sm font-semibold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors flex items-center justify-center gap-2">
              Performance Details
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm mt-8">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('cs.revenueByCS')}</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_CS}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalEarnings" name="Cumulative Revenue ($)" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
    { icon: <Smartphone size={20} />, label: t('nav.applications'), path: '/apps' },
    { icon: <Users size={20} />, label: t('nav.csTeam'), path: '/cs' },
    { icon: <BarChart3 size={20} />, label: t('nav.analytics'), path: '/analytics' },
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
            {user ? user.name.substring(0, 2).toUpperCase() : 'AD'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.name || t('user.adminUser')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{user?.role === UserRole.ADMIN ? t('user.superAdmin') : user?.role}</p>
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
          <span>{t('dashboard.title')}</span>
          <ChevronRight size={14} />
          <span className="text-slate-800 dark:text-white font-medium">{t('nav.overview')}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
        </button>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">Auto-Gen Status:</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold uppercase">Active</span>
        </div>
      </div>
    </header>
  );
};

interface AdminDashboardProps {
  onOpenSettings: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenSettings }) => {
  const { t } = useApp();
  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-slate-900">
      <Sidebar onOpenSettings={onOpenSettings} />
      <main className="flex-1 ml-64 flex flex-col">
        <Header />
        <div className="p-8">
          <Routes>
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/apps" element={<AppsList />} />
            <Route path="/cs" element={<CSTeam />} />
            <Route path="/analytics" element={<div className="flex items-center justify-center h-96 text-slate-400">{t('analytics.comingSoon')}</div>} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

