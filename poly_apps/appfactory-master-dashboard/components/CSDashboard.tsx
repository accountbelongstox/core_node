
import React, { useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Smartphone,
  TrendingUp,
  DollarSign,
  Zap,
  Settings,
  Bell,
  ChevronRight,
  History,
  Target,
  Eye,
  Star,
  BarChart3,
  Users,
  MessageCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, LineChart, Line } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { UserRole, AppStatus } from '../types';
import { StatCard } from './StatCard';
import { modelService } from '../services/modelService';
import { LanguageSelector } from './LanguageSelector';
import { CustomerServiceChat } from './CustomerServiceChat';

const CSOverview = () => {
  const { t, user } = useApp();
  const csData = useMemo(() => {
    const csTeam = modelService.getCSTeam() || [];
    const apps = modelService.getApps() || [];
    const csAppRevenue = modelService.getCSAppRevenue() || [];
    
    const cs = csTeam.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    
    const assignedApps = apps.filter(app => cs.assignedAppIds.includes(app.id));
    const totalRevenue = assignedApps.reduce((acc, app) => acc + app.revenue, 0);
    const csRevenue = csAppRevenue.filter(r => r.csId === cs.id);
    const totalPromotions = csRevenue.reduce((acc, r) => acc + r.promotions, 0);
    
    return { cs, assignedApps, totalRevenue, totalPromotions, csRevenue };
  }, [user]);

  if (!csData) {
    return <div className="text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('csDashboard.myRevenue')} value={`$${csData.cs.totalEarnings.toLocaleString()}`} change="+8.2%" isPositive icon={<DollarSign size={20} />} />
        <StatCard title={t('csDashboard.promotions')} value={csData.totalPromotions.toString()} change="+12" isPositive icon={<TrendingUp size={20} />} />
        <StatCard title={t('csDashboard.activeApps')} value={csData.assignedApps.length.toString()} icon={<Smartphone size={20} />} />
        <StatCard title={t('csDashboard.commissionRate')} value={`${csData.cs.commissionRate}%`} icon={<Target size={20} />} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{t('csDashboard.myAssignedApps')}</h3>
          <div className="space-y-3">
            {csData.assignedApps.slice(0, 5).map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{app.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{app.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{app.visits} {t('csDashboard.visits')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{t('csDashboard.performanceSummary')}</h3>
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('csDashboard.totalEarnings')}</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${csData.cs.totalEarnings.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('csDashboard.successfulPromotions')}</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{csData.totalPromotions}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MyApps = () => {
  const { t, user } = useApp();
  const navigate = useNavigate();
  const csData = useMemo(() => {
    const csTeam = modelService.getCSTeam() || [];
    const apps = modelService.getApps() || [];
    const cs = csTeam.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    return {
      cs,
      assignedApps: apps.filter(app => cs.assignedAppIds.includes(app.id))
    };
  }, [user]);

  if (!csData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('csDashboard.myApps')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {csData.assignedApps.map(app => (
          <div key={app.id} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{app.name}</h3>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                app.status === AppStatus.PENDING ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
              }`}>
                {t(`apps.${app.status.toLowerCase()}`)}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{app.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('csDashboard.todayRevenue')}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{t('csDashboard.visits')}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</p>
              </div>
            </div>
            {app.rating && (
              <div className="flex items-center gap-1 mb-4">
                <Star size={16} className="text-amber-500 fill-amber-500" />
                <span className="text-sm text-slate-600 dark:text-slate-400">{app.rating}</span>
              </div>
            )}
            <button
              onClick={() => navigate(`/my-apps/${app.id}`)}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Eye size={16} />
              {t('csDashboard.viewDetails')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const Promotions = () => {
  const { t, user } = useApp();
  const csData = useMemo(() => {
    const csTeam = modelService.getCSTeam() || [];
    const csAppRevenue = modelService.getCSAppRevenue() || [];
    const cs = csTeam.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    return {
      cs,
      promotions: csAppRevenue.filter(r => r.csId === cs.id)
    };
  }, [user]);

  if (!csData) return <div className="text-slate-400">Loading...</div>;

  const promotionData = csData.promotions.map(p => ({
    date: p.lastUpdated,
    promotions: p.promotions,
    revenue: p.revenue,
    commission: p.commission
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('csDashboard.promotionRecords')}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('csDashboard.promotionTrends')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={promotionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="promotions" stroke="#6366f1" fill="#6366f1" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('csDashboard.commissionTrends')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={promotionData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip />
                <Line type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{t('csDashboard.promotionHistory')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('csDashboard.app')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('csDashboard.promotions')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('apps.revenue')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('csDashboard.commission')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('csDashboard.lastUpdated')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {csData.promotions.map(p => {
                const apps = modelService.getApps() || [];
                const app = apps.find(a => a.id === p.appId);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700">
                    <td className="px-6 py-4 font-medium text-slate-800 dark:text-white">{app?.name || 'Unknown'}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">{p.promotions}</td>
                    <td className="px-6 py-4 text-slate-600 dark:text-slate-400">${p.revenue.toLocaleString()}</td>
                    <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 font-semibold">${p.commission.toLocaleString()}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-sm">{p.lastUpdated}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const Performance = () => {
  const { t, user } = useApp();
  const csData = useMemo(() => {
    const csTeam = modelService.getCSTeam() || [];
    const cs = csTeam.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    const allCS = csTeam.sort((a, b) => b.totalEarnings - a.totalEarnings);
    const rank = allCS.findIndex(c => c.id === cs.id) + 1;
    return { cs, rank, totalCS: allCS.length };
  }, [user]);

  if (!csData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('csDashboard.performanceAnalytics')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <BarChart3 size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('csDashboard.myRanking')}</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">#{csData.rank}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('csDashboard.outOf')} {csData.totalCS} {t('csDashboard.csMembers')}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <DollarSign size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('csDashboard.totalEarnings')}</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${csData.cs.totalEarnings.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('csDashboard.allTimeRevenue')}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Target size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('csDashboard.commissionRate')}</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{csData.cs.commissionRate}%</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t('csDashboard.averageCommission')}</p>
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
    { icon: <Smartphone size={20} />, label: t('csDashboard.myApps'), path: '/my-apps' },
    { icon: <MessageCircle size={20} />, label: t('chat.chatSessions'), path: '/chat' },
    { icon: <History size={20} />, label: t('csDashboard.promotions'), path: '/promotions' },
    { icon: <BarChart3 size={20} />, label: t('csDashboard.performanceAnalytics'), path: '/performance' },
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
          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
            {user ? user.name.substring(0, 2).toUpperCase() : 'CS'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.name || t('user.csUser')}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('user.csSpecialist')}</p>
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
          <span>{t('nav.csPortal')}</span>
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
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
        <Link to="/profile" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-xs group-hover:ring-2 ring-emerald-500 transition-all">
            CS
          </div>
        </Link>
      </div>
    </header>
  );
};

interface CSDashboardProps {
  onOpenSettings: () => void;
}

export const CSDashboard: React.FC<CSDashboardProps> = ({ onOpenSettings }) => {
  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-slate-900">
      <Sidebar onOpenSettings={onOpenSettings} />
      <main className="flex-1 ml-64 flex flex-col">
        <Header />
        <div className="p-8">
          <Routes>
            <Route path="/" element={<CSOverview />} />
            <Route path="/my-apps" element={<MyApps />} />
            <Route path="/chat" element={<CustomerServiceChat />} />
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/performance" element={<Performance />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

