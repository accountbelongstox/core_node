import React, { useMemo } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Download, 
  Calendar,
  BarChart3,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { modelService } from '../services/modelService';
import { useApp } from '../contexts/AppContext';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend 
} from 'recharts';

export const Analytics: React.FC = () => {
  const { t } = useApp();

  // Get all data from centralized modelService
  const apps = useMemo(() => modelService.getApps() || [], []);
  const csTeam = useMemo(() => modelService.getCSTeam() || [], []);
  const dailyStats = useMemo(() => modelService.getDailyStats() || [], []);
  const csAppRevenue = useMemo(() => modelService.getCSAppRevenue() || [], []);

  // Calculate revenue statistics
  const revenueStats = useMemo(() => {
    const totalRevenue = apps.reduce((acc, app) => acc + app.revenue, 0);
    const todayRevenue = dailyStats[0]?.revenue || 0;
    const yesterdayRevenue = dailyStats[1]?.revenue || 0;
    const monthRevenue = dailyStats.reduce((acc, stat) => acc + stat.revenue, 0);
    const growth = yesterdayRevenue > 0 
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 
      : 0;
    
    return { totalRevenue, todayRevenue, monthRevenue, growth };
  }, [apps, dailyStats]);

  // Top revenue apps
  const topApps = useMemo(() => {
    return [...apps]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(app => ({
        name: app.name,
        revenue: app.revenue,
        visits: app.visits,
        dau: app.dailyActiveUsers,
      }));
  }, [apps]);

  // Revenue by category
  const categoryRevenue = useMemo(() => {
    const categoryMap = new Map<string, number>();
    apps.forEach(app => {
      const current = categoryMap.get(app.category) || 0;
      categoryMap.set(app.category, current + app.revenue);
    });
    return Array.from(categoryMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [apps]);

  // CS revenue performance
  const csRevenue = useMemo(() => {
    return csTeam.map(cs => {
      const csRevenueData = csAppRevenue.filter(r => r.csId === cs.id);
      const totalCommission = csRevenueData.reduce((acc, r) => acc + r.commission, 0);
      const totalPromotions = csRevenueData.reduce((acc, r) => acc + r.promotions, 0);
      return {
        name: cs.name,
        revenue: cs.totalEarnings,
        commission: totalCommission,
        promotions: totalPromotions,
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [csTeam, csAppRevenue]);

  // Daily revenue trend (last 7 days)
  const dailyRevenueTrend = useMemo(() => {
    return dailyStats.slice(0, 7).reverse().map(stat => ({
      date: stat.date,
      revenue: stat.revenue,
      visits: stat.visits,
      activeUsers: stat.activeUsers,
    }));
  }, [dailyStats]);

  // App revenue distribution
  const appRevenueDistribution = useMemo(() => {
    return apps.slice(0, 8).map(app => ({
      name: app.name,
      value: app.revenue,
    }));
  }, [apps]);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('analytics.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('analytics.description') || 'Comprehensive revenue analytics and insights'}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            <Calendar size={18} />
            {t('analytics.selectPeriod')}
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
            <Download size={18} />
            {t('analytics.exportReport')}
          </button>
        </div>
      </div>

      {/* Revenue Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <DollarSign size={24} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className={`flex items-center gap-1 text-sm font-bold ${
              revenueStats.growth >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}>
              {revenueStats.growth >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {Math.abs(revenueStats.growth).toFixed(1)}%
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('analytics.totalRevenue')}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">${revenueStats.totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Activity size={24} className="text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('analytics.todayRevenue')}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">${revenueStats.todayRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <BarChart3 size={24} className="text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('analytics.monthRevenue')}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">${revenueStats.monthRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <PieChartIcon size={24} className="text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">{t('analytics.activeApps')}</p>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">{apps.length}</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Revenue Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('analytics.dailyRevenueTrend')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyRevenueTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name={t('analytics.revenue')} 
                  stroke="#6366f1" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  strokeWidth={2} 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Category */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('analytics.revenueByCategory')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryRevenue}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {categoryRevenue.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Apps Revenue */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('analytics.top10AppsRevenue')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topApps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CS Performance */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('analytics.csRevenuePerformance')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={csRevenue}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip />
                <Legend />
                <Bar dataKey="revenue" name={t('analytics.revenue')} fill="#6366f1" radius={[8, 8, 0, 0]} />
                <Bar dataKey="commission" name={t('revenue.commission')} fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Additional Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Visits Trend */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('analytics.dailyVisitsTrend')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyRevenueTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="visits" name={t('analytics.visits')} stroke="#10b981" strokeWidth={2} />
                <Line type="monotone" dataKey="activeUsers" name={t('analytics.activeUsers')} stroke="#6366f1" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Apps Table */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('analytics.topRevenueApps')}</h3>
          <div className="space-y-4">
            {topApps.slice(0, 5).map((app, index) => (
              <div key={app.name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-100 text-amber-600' :
                    index === 1 ? 'bg-slate-200 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{app.name}</p>
                    <p className="text-xs text-slate-500">{app.visits.toLocaleString()} visits</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{app.dau.toLocaleString()} DAU</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

