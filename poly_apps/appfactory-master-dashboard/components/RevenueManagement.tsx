import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Download, Calendar } from 'lucide-react';
import { modelService } from '../services/modelService';
import { useApp } from '../contexts/AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';

export const RevenueManagement: React.FC = () => {
  const { t } = useApp();

  const revenueStats = useMemo(() => {
    const apps = modelService.getApps() || [];
    const csTeam = modelService.getCSTeam() || [];
    const csAppRevenue = modelService.getCSAppRevenue() || [];
    const dailyStats = modelService.getDailyStats() || [];
    
    const totalRevenue = apps.reduce((acc, app) => acc + app.revenue, 0);
    const todayRevenue = dailyStats[0]?.revenue || 0;
    const monthRevenue = dailyStats.reduce((acc, stat) => acc + stat.revenue, 0);
    const growth = ((todayRevenue - (dailyStats[1]?.revenue || 0)) / (dailyStats[1]?.revenue || 1)) * 100;

    const topApps = [...apps]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    const csRevenue = csTeam.map(cs => {
      const csRevenueData = csAppRevenue.filter(r => r.csId === cs.id);
      const totalCommission = csRevenueData.reduce((acc, r) => acc + r.commission, 0);
      return {
        id: cs.id, // Use ID for matching instead of name
        name: cs.name, // Use name from centralized MOCK_CS (Chinese names)
        revenue: cs.totalEarnings || 0,
        commission: totalCommission,
        promotions: csRevenueData.reduce((acc, r) => acc + r.promotions, 0),
      };
    }).sort((a, b) => b.revenue - a.revenue);

    return { totalRevenue, todayRevenue, monthRevenue, growth, topApps, csRevenue };
  }, []);

  const categoryRevenue = useMemo(() => {
    const apps = modelService.getApps() || [];
    const categoryMap = new Map<string, number>();
    apps.forEach(app => {
      const current = categoryMap.get(app.category) || 0;
      categoryMap.set(app.category, current + app.revenue);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, []);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('revenue.title')}</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Download size={18} />
          {t('revenue.exportReport')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('revenue.totalRevenue')}</span>
            <DollarSign size={20} className="text-indigo-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">${revenueStats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">All time</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('revenue.today')}</span>
            <Calendar size={20} className="text-emerald-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">${revenueStats.todayRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-1 mt-1">
            {revenueStats.growth > 0 ? (
              <TrendingUp size={14} className="text-emerald-600" />
            ) : (
              <TrendingDown size={14} className="text-rose-600" />
            )}
            <span className={`text-xs ${revenueStats.growth > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {Math.abs(revenueStats.growth).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('revenue.thisMonth')}</span>
            <TrendingUp size={20} className="text-blue-600" />
          </div>
          <p className="text-3xl font-bold text-slate-800 dark:text-white">${revenueStats.monthRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Last 30 days</p>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">Top CS</span>
            <DollarSign size={20} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-slate-800 dark:text-white">
            {revenueStats.csRevenue[0]?.name || 'N/A'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ${revenueStats.csRevenue[0]?.revenue.toLocaleString() || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('revenue.top10Apps')}</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueStats.topApps}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} angle={-45} textAnchor="end" height={100} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip />
                <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">Revenue by Category</h3>
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
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">{t('revenue.csPerformance')}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('revenue.csName')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('revenue.totalRevenue')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('revenue.commission')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('revenue.promotions')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t('revenue.avgCommissionRate')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {revenueStats.csRevenue.map((cs, index) => {
                const csTeam = modelService.getCSTeam() || [];
                // Use ID to match instead of name to ensure we get the correct CS from centralized data
                const csData = csTeam.find(c => c.id === cs.id) || csTeam.find(c => c.name === cs.name);
                // Use name from centralized data (Chinese names from MOCK_CS)
                const displayName = csData?.name || cs.name;
                return (
                  <tr key={cs.id || index} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {csData && <img src={csData.avatar} alt={displayName} className="w-8 h-8 rounded-full" />}
                        <span className="font-semibold text-slate-800 dark:text-white">{displayName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-800 dark:text-white">${cs.revenue.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">${cs.commission.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{cs.promotions}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-slate-600 dark:text-slate-400">{csData?.commissionRate || csData?.commissionPercentage || 0}%</span>
                    </td>
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

