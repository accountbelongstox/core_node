import React, { useMemo } from 'react';
import { ArrowLeft, TrendingUp, Users, DollarSign, Star, Calendar, Code, Edit2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppInstance, AppStatus } from '../types';
import { modelService } from '../services/modelService';
import { useApp } from '../contexts/AppContext';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export const AppDetailPage: React.FC = () => {
  const { t } = useApp();
  const navigate = useNavigate();
  const { appId } = useParams<{ appId: string }>();
  
  const app = useMemo(() => {
    const apps = modelService.getApps() || [];
    return apps.find(a => a.id === appId);
  }, [appId]);

  if (!app) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-slate-400">{t('appDetail.notFound')}</p>
      </div>
    );
  }

  const csTeam = useMemo(() => modelService.getCSTeam() || [], []);
  const techTeam = useMemo(() => modelService.getTechTeam() || [], []);
  const dailyStats = useMemo(() => modelService.getDailyStats() || [], []);
  const assignedCS = csTeam.filter(cs => app.assignedCSIds.includes(cs.id));
  const assignedTech = techTeam.find(tech => tech.id === app.assignedTechId);

  // Generate visit and revenue data from centralized dailyStats
  // Use app's visits and revenue as base, with dailyStats for trend
  const visitData = useMemo(() => {
    return dailyStats.slice(0, 7).reverse().map((stat, index) => ({
      date: stat.date,
      visits: Math.floor(app.visits * (0.8 + (index * 0.05))), // Simulate trend based on app visits
    }));
  }, [dailyStats, app.visits]);

  const revenueData = useMemo(() => {
    return dailyStats.slice(0, 7).reverse().map((stat, index) => ({
      date: stat.date,
      revenue: Math.floor((app.revenue / 7) * (0.9 + (index * 0.02))), // Simulate trend based on app revenue
    }));
  }, [dailyStats, app.revenue]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/apps')}
          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">{app.name}</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{app.description}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Edit2 size={18} />
          {t('appDetail.edit')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('appDetail.status')}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
              app.status === AppStatus.PENDING ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
              app.status === AppStatus.FAILED ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' :
              'bg-slate-50 text-slate-700 dark:bg-slate-700 dark:text-slate-400'
            }`}>
              {app.status}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <TrendingUp size={20} className="text-indigo-600" />
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('appDetail.totalVisits')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('apps.revenue')}</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <DollarSign size={20} className="text-emerald-600" />
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('appDetail.totalRevenue')}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('appDetail.dailyActiveUsers')}</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Users size={20} className="text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{app.dailyActiveUsers.toLocaleString()}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">DAU</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500 dark:text-slate-400">{t('appDetail.userRating')}</span>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <Star size={20} className="text-amber-600 fill-amber-600" />
            <div>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{app.rating || 'N/A'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">User Rating</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('appDetail.visitTrends')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visitData}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="visits" stroke="#6366f1" fillOpacity={1} fill="url(#colorVisits)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('appDetail.revenueTrends')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ fill: '#10b981', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{t('appDetail.assignedCS')}</h3>
          <div className="space-y-3">
            {assignedCS.length > 0 ? (
              assignedCS.map(cs => (
                <div key={cs.id} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <img src={cs.avatar} alt={cs.name} className="w-10 h-10 rounded-full" />
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">{cs.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t('appDetail.commission')}: {cs.commissionRate}%</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    cs.status === 'Online' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                    'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
                  }`}>
                    {cs.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-slate-400 text-center py-4">{t('appDetail.noCSAssigned')}</p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{t('appDetail.technicalInfo')}</h3>
          <div className="space-y-4">
            {assignedTech ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                  <Code size={20} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-slate-800 dark:text-white">{assignedTech.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{assignedTech.specialization}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs ${
                  assignedTech.status === 'Available' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  assignedTech.status === 'Busy' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-400'
                }`}>
                  {assignedTech.status}
                </span>
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">{t('appDetail.noTechAssigned')}</p>
            )}

            <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <Calendar size={16} />
                <span>{t('appDetail.created')}: {app.createdAt}</span>
              </div>
              {app.launchDate && (
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <Calendar size={16} />
                  <span>{t('appDetail.launched')}: {app.launchDate}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span>{t('appDetail.category')}: {app.category}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">{t('appDetail.features')}</h3>
        <div className="flex flex-wrap gap-2">
          {app.features.map((feature, index) => (
            <span
              key={index}
              className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm"
            >
              {feature}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

