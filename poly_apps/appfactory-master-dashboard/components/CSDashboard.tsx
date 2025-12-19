
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
  Users
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { UserRole, AppStatus } from '../types';
import { StatCard } from './StatCard';
import { MOCK_APPS, MOCK_CS, MOCK_CS_APP_REVENUE } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

const CSOverview = () => {
  const { t, user } = useApp();
  const csData = useMemo(() => {
    const cs = MOCK_CS.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    
    const assignedApps = MOCK_APPS.filter(app => cs.assignedAppIds.includes(app.id));
    const totalRevenue = assignedApps.reduce((acc, app) => acc + app.revenue, 0);
    const csAppRevenue = MOCK_CS_APP_REVENUE.filter(r => r.csId === cs.id);
    const totalPromotions = csAppRevenue.reduce((acc, r) => acc + r.promotions, 0);
    
    return { cs, assignedApps, totalRevenue, totalPromotions };
  }, [user]);

  if (!csData) {
    return <div className="text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Revenue" value={`$${csData.cs.totalEarnings.toLocaleString()}`} change="+8.2%" isPositive icon={<DollarSign size={20} />} />
        <StatCard title="Promotions" value={csData.totalPromotions.toString()} change="+12" isPositive icon={<TrendingUp size={20} />} />
        <StatCard title="Active Apps" value={csData.assignedApps.length.toString()} icon={<Smartphone size={20} />} />
        <StatCard title="Commission Rate" value={`${csData.cs.commissionRate}%`} icon={<Target size={20} />} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">My Assigned Apps</h3>
          <div className="space-y-3">
            {csData.assignedApps.slice(0, 5).map(app => (
              <div key={app.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{app.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{app.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{app.visits} visits</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Performance Summary</h3>
          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Earnings</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">${csData.cs.totalEarnings.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Successful Promotions</p>
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
    const cs = MOCK_CS.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    return {
      cs,
      assignedApps: MOCK_APPS.filter(app => cs.assignedAppIds.includes(app.id))
    };
  }, [user]);

  if (!csData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My Apps</h2>
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
                {app.status}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{app.description}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Today's Revenue</p>
                <p className="text-lg font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Visits</p>
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
              View Details
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
    const cs = MOCK_CS.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    return {
      cs,
      promotions: MOCK_CS_APP_REVENUE.filter(r => r.csId === cs.id)
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
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Promotion Records</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">Promotion Trends</h3>
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
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">Commission Trends</h3>
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
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">Promotion History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">App</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Promotions</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Revenue</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Commission</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {csData.promotions.map(p => {
                const app = MOCK_APPS.find(a => a.id === p.appId);
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
    const cs = MOCK_CS.find(c => c.id === user?.id || 'cs1');
    if (!cs) return null;
    const allCS = MOCK_CS.sort((a, b) => b.totalEarnings - a.totalEarnings);
    const rank = allCS.findIndex(c => c.id === cs.id) + 1;
    return { cs, rank, totalCS: allCS.length };
  }, [user]);

  if (!csData) return <div className="text-slate-400">Loading...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Performance Analytics</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <BarChart3 size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">My Ranking</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">#{csData.rank}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Out of {csData.totalCS} CS members</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <DollarSign size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Earnings</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${csData.cs.totalEarnings.toLocaleString()}</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">All time revenue</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
              <Target size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Commission Rate</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{csData.cs.commissionRate}%</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Average commission</p>
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
    { icon: <Smartphone size={20} />, label: 'My Apps', path: '/my-apps' },
    { icon: <History size={20} />, label: 'Promotions', path: '/promotions' },
    { icon: <BarChart3 size={20} />, label: 'Performance', path: '/performance' },
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
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user?.name || 'CS User'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">CS Specialist</p>
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
          <span>CS Portal</span>
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
            <Route path="/promotions" element={<Promotions />} />
            <Route path="/performance" element={<Performance />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

