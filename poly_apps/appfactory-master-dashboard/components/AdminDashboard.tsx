
import React, { useState, useMemo, useEffect } from 'react';
import { Routes, Route, Link, useLocation, useNavigate, useParams } from 'react-router-dom';
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
  Settings,
  DollarSign as DollarIcon,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowUpRight,
  ArrowLeft,
  Edit3,
  Trash2,
  Star,
  Shield,
  MessageCircle
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { modelService } from '../services/modelService';
import { AppStatus, UserRole, AppCategory, AppInstance, CustomerService } from '../types';
import { StatCard } from './StatCard';
import { useApp } from '../contexts/AppContext';
import { getAvatarUrl } from '../utils/avatarUtils';
import { AppGenerationForm } from './AppGenerationForm';
import { AppDetailPage } from './AppDetailPage';
import { CSAssignment } from './CSAssignment';
import { RevenueManagement } from './RevenueManagement';
import { PromotionTrackView } from './PromotionTrackView';
import { AppReleaseList } from './AppReleaseList';
import { AppReleaseDetail } from './AppReleaseDetail';
import { PromotionRecordList } from './PromotionRecordList';
import { PromotionRecordDetail } from './PromotionRecordDetail';
import { PromoterList } from './PromoterList';
import { AppImageDisplay } from './AppImageDisplay';
import { CSList } from './CSList';
import { AddPromoterForm } from './AddPromoterForm';
import { AddCSForm } from './AddCSForm';

import { Profile } from './Profile';
import { NotificationCenter } from './NotificationCenter';
import { Analytics } from './Analytics';
import { LanguageSelector } from './LanguageSelector';
import { AdminChatManagement } from './AdminChatManagement';
import { PaymentVerificationManagement } from './PaymentVerificationManagement';

// Revenue Analytics Component
const RevenueAnalytics = () => {
  const { t } = useApp();
  
  const apps = useMemo(() => modelService.getApps() ?? [], []);
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  const techTeam = useMemo(() => modelService.getTechTeam() ?? [], []);
  const dailyStats = useMemo(() => modelService.getDailyStats() ?? [], []);
  const appRequests = useMemo(() => modelService.getAppRequests() ?? [], []);

  const topApps = useMemo(() => 
    [...apps].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    [apps]
  );

  const revenueByCategory = useMemo(() => {
    const categoryMap = new Map<string, number>();
    apps.forEach(app => {
      const current = categoryMap.get(app.category) ?? 0;
      categoryMap.set(app.category, current + app.revenue);
      categoryMap.set(app.category, current + app.revenue);
    });
    return Array.from(categoryMap.entries()).map(([name, value]) => ({ name, value }));
  }, [apps]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('revenue.revenueAnalytics')}</h2>
          <p className="text-sm text-slate-500">{t('revenue.revenueAnalyticsDesc')}</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors">
            <Download size={18} />
            {t('revenue.exportReport')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('revenue.revenueTrends')}</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="colorRevenueTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenueTrend)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('revenue.top10RevenueApps')}</h3>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {topApps.map((app, index) => (
                <div key={app.id} className="p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
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
                      <p className="text-xs text-slate-500">{app.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
                    <p className="text-[10px] text-emerald-500 font-bold">+{Math.floor(Math.random() * 20 + 5)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">{t('revenue.revenueByCategory')}</h3>
            <div className="space-y-4">
              {revenueByCategory.map((cat, i) => {
                const total = revenueByCategory.reduce((acc, c) => acc + c.value, 0);
                const percentage = (cat.value / total * 100).toFixed(1);
                return (
                  <div key={cat.name} className="space-y-2">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-600 dark:text-slate-300">{cat.name}</span>
                      <span className="text-slate-800 dark:text-white">${cat.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-indigo-500" 
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400">{percentage}%</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
            <h4 className="text-sm font-bold uppercase tracking-widest mb-4 opacity-80">{t('revenue.totalRevenue')}</h4>
            <p className="text-4xl font-bold mb-2">${apps.reduce((acc, a) => acc + a.revenue, 0).toLocaleString()}</p>
            <p className="text-sm opacity-80 mb-6">{t('revenue.allTimeCumulative')}</p>
            <div className="flex items-center gap-2 text-xs">
              <ArrowUpRight size={14} />
              <span className="font-bold">+24.5% {t('revenue.fromLastMonth')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Commission Management Component
const CommissionManagement = () => {
  const { t } = useApp();
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('revenue.commissionManagement')}</h2>
          <p className="text-sm text-slate-500">{t('revenue.commissionManagementDesc')}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('revenue.csMember')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('revenue.currentRate')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('revenue.totalCommission')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">{t('revenue.pending')}</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {csTeam.map(cs => (
              <tr key={cs.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img src={getAvatarUrl(cs.avatar, 150, 'pravatar')} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{cs.name}</p>
                      <p className="text-xs text-slate-500">{cs.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      defaultValue={cs.commissionRate}
                      className="w-20 px-2 py-1 text-sm font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 rounded-lg"
                    />
                    <span className="text-sm text-slate-500">%</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">${cs.totalEarnings.toLocaleString()}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-bold text-amber-500">${(cs.totalEarnings * 0.1).toLocaleString()}</span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors">
                      {t('revenue.approve')}
                    </button>
                    <button className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Settings size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// APP-CS Revenue Matrix Component
const RevenueMatrix = () => {
  const { t } = useApp();
  const apps = useMemo(() => modelService.getApps() ?? [], []);
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('revenue.appCsRevenueMatrix')}</h2>
          <p className="text-sm text-slate-500">{t('revenue.appCsRevenueMatrixDesc')}</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
          <Download size={18} />
          {t('revenue.exportMatrix')}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase sticky left-0 bg-slate-50 dark:bg-slate-700 z-10">{t('revenue.application')} / CS</th>
                {csTeam.map(cs => (
                  <th key={cs.id} className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-center min-w-[120px]">
                    <div className="flex flex-col items-center gap-1">
                      <img src={getAvatarUrl(cs.avatar, 150, 'pravatar')} className="w-6 h-6 rounded-full" />
                      <span>{cs.name}</span>
                    </div>
                  </th>
                ))}
                <th className="px-6 py-4 text-xs font-bold text-slate-800 dark:text-white uppercase text-center bg-slate-100 dark:bg-slate-600">{t('revenue.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {apps.slice(0, 10).map(app => (
                <tr key={app.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-800 dark:text-white sticky left-0 bg-white dark:bg-slate-800 z-10 border-r border-slate-100 dark:border-slate-700">
                    {app.name}
                  </td>
                  {csTeam.map(cs => {
                    const isAssigned = app.assignedCSIds.includes(cs.id);
                    const revenue = isAssigned ? Math.floor(app.revenue / app.assignedCSIds.length) : 0;
                    return (
                      <td key={cs.id} className="px-6 py-4 text-center">
                        {revenue > 0 ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">${revenue.toLocaleString()}</span>
                            <span className="text-[10px] text-emerald-500 font-bold">{(revenue/app.revenue*100).toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-6 py-4 text-center font-bold text-indigo-600 bg-slate-50/50 dark:bg-slate-700/30">
                    ${app.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 dark:bg-slate-700 font-bold">
              <tr>
                <td className="px-6 py-4 text-slate-800 dark:text-white uppercase text-xs">CS Total Earnings</td>
                {csTeam.map(cs => (
                  <td key={cs.id} className="px-6 py-4 text-center text-sm text-indigo-600">
                    ${cs.totalEarnings.toLocaleString()}
                  </td>
                ))}
                <td className="px-6 py-4 text-center text-lg text-emerald-500">
                  ${apps.reduce((acc, a) => acc + a.revenue, 0).toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

// Individual APP Detail Page
const AppDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useApp();
  
  const apps = useMemo(() => modelService.getApps() ?? [], []);
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  const techTeam = useMemo(() => modelService.getTechTeam() ?? [], []);
  const dailyStats = useMemo(() => modelService.getDailyStats() ?? [], []);
  const app = useMemo(() => apps.find(a => a.id === id), [apps, id]);

  if (!app) return <div className="p-8 text-center">App not found</div>;

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444'];
  const pieData = [
    { name: 'Organic', value: 45 },
    { name: 'Social', value: 25 },
    { name: 'Referral', value: 20 },
    { name: 'Direct', value: 10 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors">
          <ArrowLeft size={20} />
          Back to Apps
        </button>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            <Edit3 size={18} />
            Edit App
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-lg text-sm font-bold hover:bg-rose-100 transition-colors">
            <Trash2 size={18} />
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Info Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
            <div className="flex items-start justify-between mb-8">
              <div className="flex gap-6">
                <div className="w-20 h-20 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-3xl shadow-xl shadow-indigo-500/20">
                  {app.name.charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">{app.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-bold uppercase">{app.category}</span>
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                      app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>{app.status}</span>
                    <span className="flex items-center gap-1 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold">
                      <Star size={12} fill="currentColor" />
                      {app.rating ?? '4.5'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400 uppercase font-bold tracking-wider mb-1">{t('revenue.createdAt')}</p>
                <p className="text-slate-800 dark:text-white font-bold">{app.createdAt}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-slate-50 dark:bg-slate-700/30 rounded-2xl border border-slate-100 dark:border-slate-700">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('revenue.totalRevenue')}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('revenue.totalVisits')}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Daily Active Users</p>
                <p className="text-xl font-bold text-slate-800 dark:text-white">{app.dailyActiveUsers.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Monthly Revenue</p>
                <p className="text-xl font-bold text-emerald-500">${app.monthlyRevenue.toLocaleString()}</p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Description</h3>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                {app.description}
              </p>
            </div>

            <div className="mt-8">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Core Features</h3>
              <div className="flex flex-wrap gap-2">
                {app.features.map(f => (
                  <span key={f} className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300">
                    <CheckCircle2 size={16} className="text-emerald-500" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Charts Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Visitor Trends</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="visits" stroke="#6366f1" fillOpacity={1} fill="url(#colorVisits)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Assignment Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Assigned Team</h3>
            
            <div className="space-y-6">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Technical Leader</p>
                <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                    <img src={techTeam[0] ? getAvatarUrl(techTeam[0].avatar, 150, 'pravatar') : ''} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{techTeam[0]?.name}</p>
                      <p className="text-[10px] text-slate-500">{techTeam[0]?.specialization}</p>
                    </div>
                  </div>
                  <Shield size={18} className="text-indigo-600" />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Customer Service</p>
                <div className="space-y-2">
                  {app.assignedCSIds.map(csId => {
                    const cs = csTeam.find(c => c.id === csId);
                    return cs ? (
                      <div key={cs.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-3">
                          <img src={getAvatarUrl(cs.avatar, 150, 'pravatar')} className="w-8 h-8 rounded-full" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-white">{cs.name}</p>
                            <p className="text-[10px] text-slate-500">{cs.status}</p>
                          </div>
                        </div>
                        <button className="text-slate-400 hover:text-rose-500">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ) : null;
                  })}
                  <button className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-400 hover:text-indigo-600 hover:border-indigo-600 transition-all flex items-center justify-center gap-2">
                    <PlusCircle size={14} />
                    Assign New CS
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Traffic Source Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Traffic Sources</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Technical Team List Component
const TechTeam = () => {
  const { t } = useApp();
  const techTeam = useMemo(() => modelService.getTechTeam() ?? [], []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Technical Team</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your product and development engineers</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all shadow-lg">
          <PlusCircle size={18} />
          Add Engineer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {techTeam.map(tech => (
          <div key={tech.id} className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center group transition-all hover:shadow-xl hover:shadow-slate-500/5">
            <div className="relative mb-4">
              <div className="p-1 rounded-full border-2 border-slate-100 dark:border-slate-700 group-hover:border-indigo-500 transition-colors">
                <img src={getAvatarUrl(tech.avatar, 150, 'pravatar')} alt="" className="w-20 h-20 rounded-full" />
              </div>
              <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${
                tech.status === 'Available' ? 'bg-emerald-500' : 'bg-amber-500'
              }`} />
            </div>
            
            <h3 className="font-bold text-slate-800 dark:text-white mb-1">{tech.name}</h3>
            <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-[10px] font-bold uppercase tracking-wider mb-4">
              {tech.specialization}
            </span>

            <div className="w-full grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-4 mb-6">
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Apps Generated</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{tech.appsGenerated}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Efficiency</p>
                <p className="text-sm font-bold text-emerald-500">98%</p>
              </div>
            </div>

            <button className="w-full py-2 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
              Manage Tasks
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// Dashboard Overview Page
const DashboardOverview = () => {
  const { t } = useApp();
  const apps = useMemo(() => modelService.getApps() ?? [], []);
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  const dailyStats = useMemo(() => modelService.getDailyStats() ?? [], []);
  const appRequests = useMemo(() => modelService.getAppRequests() ?? [], []);
  
  const stats = useMemo(() => {
    const totalRevenue = apps.reduce((acc, app) => acc + app.revenue, 0);
    const totalVisits = apps.reduce((acc, app) => acc + app.visits, 0);
    const activeApps = apps.filter(a => a.status === AppStatus.LIVE).length;
    return { totalRevenue, totalVisits, activeApps };
  }, [apps]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title={t('dashboard.totalRevenue')} value={`$${stats.totalRevenue.toLocaleString()}`} change="+12.5%" isPositive icon={<DollarSign size={20} />} />
        <StatCard title={t('dashboard.totalVisits')} value={stats.totalVisits.toLocaleString()} change="+18.2%" isPositive icon={<TrendingUp size={20} />} />
        <StatCard title={t('dashboard.activeApps')} value={stats.activeApps} change="+2" isPositive icon={<Smartphone size={20} />} />
        <StatCard title={t('dashboard.csMembers')} value={csTeam.length} icon={<UserCheck size={20} />} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('dashboard.performanceTrends')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyStats}>
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
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('techDashboard.generationQueue')}</h3>
            <div className="space-y-4">
              {appRequests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      req.status === 'pending' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      {req.status === 'pending' ? <Clock size={20} /> : <Zap size={20} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{req.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{req.category} • {t('appGeneration.requestedByAdmin')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <p className={`text-xs font-bold uppercase ${
                        req.status === 'pending' ? 'text-amber-600' : 'text-indigo-600'
                      }`}>
                        {req.status === 'pending' ? t('appGeneration.statusPending') :
                         req.status === 'in_progress' ? t('appGeneration.statusInProgress') :
                         req.status === 'completed' ? t('appGeneration.statusCompleted') :
                         req.status === 'failed' ? t('appGeneration.statusFailed') : req.status}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{req.requestedAt}</p>
                    </div>
                    <ChevronRight className="text-slate-400" size={16} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-6">{t('dashboard.recentApplications')}</h3>
            <div className="space-y-4">
              {apps.slice(0, 5).map(app => (
                <div key={app.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      app.status === AppStatus.LIVE ? 'bg-emerald-500' : 
                      app.status === AppStatus.PENDING ? 'bg-amber-500' : 
                      app.status === AppStatus.GENERATING ? 'bg-indigo-500 animate-pulse' :
                      'bg-rose-500'
                    }`} />
                  <div>
                    <Link to={`/apps/${app.id}`} className="text-sm font-semibold text-slate-800 dark:text-white hover:text-indigo-600 transition-colors">{app.name}</Link>
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
            <Link to="/apps" className="block w-full mt-6 py-2 text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors border-t border-slate-100 dark:border-slate-700 pt-4">
              {t('dashboard.viewAllApps')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

// CS Assignment Modal Component
const CSAssignmentModal = ({ isOpen, onClose, app }: { isOpen: boolean; onClose: () => void; app: AppInstance }) => {
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  const { t } = useApp();
  const [selectedCS, setSelectedCS] = useState<string[]>(app.assignedCSIds);

  const toggleCS = (id: string) => {
    if (selectedCS.includes(id)) {
      setSelectedCS(selectedCS.filter(i => i !== id));
    } else {
      setSelectedCS([...selectedCS, id]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-white">Assign CS Members</h3>
            <p className="text-xs text-slate-500 mt-1">Select customer service representatives for <span className="font-bold text-indigo-600">{app.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <MoreVertical size={20} className="rotate-90" />
          </button>
        </div>

        <div className="p-6 max-h-[400px] overflow-y-auto space-y-3">
                {csTeam.map(cs => (
            <div 
              key={cs.id}
              onClick={() => toggleCS(cs.id)}
              className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                selectedCS.includes(cs.id)
                  ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-200'
              }`}
            >
              <div className="flex items-center gap-4">
                <img src={getAvatarUrl(cs.avatar, 150, 'pravatar')} className="w-12 h-12 rounded-full" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-white">{cs.name}</p>
                  <p className="text-xs text-slate-500">{cs.email} • {cs.assignedAppIds.length} apps</p>
                </div>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                selectedCS.includes(cs.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'
              }`}>
                {selectedCS.includes(cs.id) && <CheckCircle2 size={14} className="text-white" />}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="px-6 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
            Cancel
          </button>
          <button className="px-8 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all">
            Save Assignment
          </button>
        </div>
      </div>
    </div>
  );
};

// Apps Management Page
const AppsList = () => {
  const { t } = useApp();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [showGenerationForm, setShowGenerationForm] = useState(false);

  const allApps = useMemo(() => modelService.getApps(), []);
  // Only show first 5 apps (app1-app5) with icon/splash
  const apps = useMemo(() => allApps.filter(app => {
    const match = app.id.match(/app(\d+)/);
    if (match) {
      const index = parseInt(match[1]);
      return index >= 1 && index <= 5;
    }
    return false;
  }), [allApps]);
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  const filteredApps = apps.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleGenerateApp = (appData: { name: string; category: AppCategory; description: string; targetAudience: string; features: string[]; assignedTechId?: string; requestedAt: string }) => {
    console.log('Generating app:', appData);
    alert('APP generation started! (This is a demo)');
  };

  return (
    <>
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
            <button 
              onClick={() => setShowGenerationForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
            >
              <PlusCircle size={18} />
              {t('apps.generateNew')}
            </button>
          </div>
        </div>

      {/* Apps Grid with Icons and Splashes - Only show first 5 apps */}
      {filteredApps.length === 0 ? (
        <div className="p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">{t('apps.noApps')}</p>
        </div>
      ) : (
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map(app => (
              <AppCard key={app.id} app={app} csTeam={csTeam} />
            ))}
          </div>
        </div>
      )}
      </div>
      {showGenerationForm && (
        <AppGenerationForm
          onClose={() => setShowGenerationForm(false)}
          onGenerate={handleGenerateApp}
        />
      )}
    </>
  );
};

/**
 * App Card Component with encrypted icon and splash support
 * Shows app icon, splash screen, and app information
 * Uses AppImageDisplay component for consistent image handling
 */
const AppCard: React.FC<{
  app: AppInstance;
  csTeam: CustomerService[];
}> = ({ app, csTeam }) => {
  const { t } = useApp();
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden hover:shadow-xl transition-all cursor-pointer" onClick={() => navigate(`/apps/${app.id}`)}>
      {/* Splash Screen - uses AppImageDisplay component for consistent image handling */}
      <AppImageDisplay app={app} mode="card" />

      <div className="p-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Small icon - uses AppImageDisplay component for consistent image handling */}
            <AppImageDisplay 
              app={app} 
              mode="icon-only" 
              iconSize="small"
              className="rounded-lg"
            />
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">
                {app.name}
              </h3>
              <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded w-fit mt-1 inline-block">
                {app.category}
              </span>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
            app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
            app.status === AppStatus.PENDING ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
            app.status === AppStatus.GENERATING ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 animate-pulse' :
            'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400'
          }`}>
            {app.status === AppStatus.LIVE && <CheckCircle2 size={10} className="inline mr-1" />}
            {app.status === AppStatus.PENDING && <Clock size={10} className="inline mr-1" />}
            {app.status === AppStatus.FAILED && <AlertCircle size={10} className="inline mr-1" />}
            {t(`apps.${app.status.toLowerCase()}`)}
          </span>
        </div>

        {app.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">
            {app.description}
          </p>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('apps.revenue')}:</span>
            <span className="font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">{t('apps.visits')}:</span>
            <span className="font-bold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">DAU:</span>
            <span className="font-bold text-slate-800 dark:text-white">{app.dailyActiveUsers.toLocaleString()}</span>
          </div>
        </div>

        {app.assignedCSIds.length > 0 && (
          <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
            <span className="text-xs text-slate-500 dark:text-slate-400">Assigned CS:</span>
            <div className="flex -space-x-2">
              {app.assignedCSIds.map(csId => {
                const cs = csTeam.find(c => c.id === csId);
                return cs ? (
                  <img 
                    key={cs.id} 
                    src={getAvatarUrl(cs.avatar, 150, 'pravatar')} 
                    alt={cs.name} 
                    className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700" 
                    title={cs.name}
                  />
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// CS Management Page
const CSTeam = () => {
  const { t } = useApp();
  const csTeam = useMemo(() => modelService.getCSTeam() ?? [], []);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('cs.title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your customer success team and performance</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/20">
          <PlusCircle size={18} />
          {t('cs.addMember')}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {csTeam.map(cs => (
          <div key={cs.id} className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            
            <div className="relative mb-4">
              <div className="p-1 rounded-full border-2 border-indigo-100 dark:border-indigo-900/50 group-hover:border-indigo-500 transition-colors">
                <img src={getAvatarUrl(cs.avatar, 150, 'pravatar')} alt={cs.name} className="w-20 h-20 rounded-full object-cover" />
              </div>
              <div className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 ${cs.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
            </div>

            <h3 className="font-bold text-slate-800 dark:text-white group-hover:text-indigo-600 transition-colors">{cs.name}</h3>
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mb-4">{cs.email}</p>

            <div className="w-full flex items-center justify-center gap-2 mb-6">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded uppercase">
                {cs.commissionRate}% rate
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                cs.status === 'Online' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-50 text-slate-500'
              }`}>
                {cs.status}
              </span>
            </div>

            <div className="w-full grid grid-cols-2 gap-4 border-t border-slate-100 dark:border-slate-700 pt-4">
              <div className="text-left">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cs.totalEarnings')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">${cs.totalEarnings.toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('cs.assignedApps')}</p>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{cs.assignedAppIds.length}</p>
              </div>
            </div>

            <button className="mt-6 w-full py-2 bg-slate-50 dark:bg-slate-700 group-hover:bg-indigo-600 group-hover:text-white text-indigo-600 dark:text-indigo-400 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2">
              View Analytics
              <ChevronRight size={14} />
            </button>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white">{t('cs.revenueByCS')}</h3>
            <select className="bg-slate-50 dark:bg-slate-700 border-none text-xs font-bold rounded-lg focus:ring-0">
              <option>Last 7 Days</option>
              <option>Last 30 Days</option>
              <option>This Year</option>
            </select>
          </div>
          <div className="h-80 min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={320}>
              <BarChart data={csTeam}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f8fafc' }}
                />
                <Bar dataKey="totalEarnings" name="Revenue" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Top Performing CS</h3>
          <div className="space-y-4">
            {[...csTeam].sort((a, b) => b.totalEarnings - a.totalEarnings).map((cs, index) => (
              <div key={cs.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-amber-100 text-amber-600' :
                    index === 1 ? 'bg-slate-200 text-slate-600' :
                    index === 2 ? 'bg-orange-100 text-orange-600' :
                    'bg-slate-100 text-slate-400'
                  }`}>
                    {index + 1}
                  </div>
                  <img src={getAvatarUrl(cs.avatar, 150, 'pravatar')} alt="" className="w-10 h-10 rounded-full" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white">{cs.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{cs.assignedAppIds.length} apps assigned</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-800 dark:text-white">${cs.totalEarnings.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-emerald-500">+15.4%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Sidebar: React.FC<{ onOpenSettings: () => void }> = ({ onOpenSettings }) => {
  const { t, user, logout } = useApp();
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/' && location.pathname === '/') return true;
    if (path !== '/' && location.pathname.startsWith(path)) return true;
    return false;
  };

  const menuItems = [
    { icon: <LayoutDashboard size={20} />, label: t('nav.overview'), path: '/' },
    { icon: <Smartphone size={20} />, label: t('nav.applications'), path: '/apps' },
    { icon: <Smartphone size={20} />, label: t('nav.publishedApps'), path: '/app-releases' },
    { icon: <Users size={20} />, label: t('nav.csTeam'), path: '/cs' },
    { icon: <Users size={20} />, label: t('nav.csMembers'), path: '/cs-list' },
    { icon: <Users size={20} />, label: t('nav.promoters'), path: '/promoters' },
    { icon: <MapPin size={20} />, label: t('nav.promotionRecords'), path: '/promotion-records' },
    { icon: <MapPin size={20} />, label: t('nav.promotionTracks'), path: '/promotion-tracks' },
    { icon: <Users size={20} />, label: t('nav.csAssignment'), path: '/cs-assignment' },
    { icon: <MessageCircle size={20} />, label: t('chat.chatManagement'), path: '/chat-management' },
    { icon: <DollarSign size={20} />, label: t('paymentVerification.management'), path: '/payment-verification' },
    { icon: <DollarIcon size={20} />, label: t('nav.revenue'), path: '/revenue' },
    { icon: <BarChart3 size={20} />, label: t('nav.analytics'), path: '/analytics' },
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
            {user ? user.name.substring(0, 2).toUpperCase() : 'AD'}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{user !== null && user !== undefined && user.name !== null && user.name !== undefined ? user.name : t('user.adminUser')}</p>
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
        <LanguageSelector />
        <Link to="/notifications" className="relative p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-slate-900" />
        </Link>
        <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2" />
        <Link to="/profile" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs group-hover:ring-2 ring-indigo-500 transition-all">
            AD
          </div>
        </Link>
      </div>
    </header>
  );
};

interface AdminDashboardProps {
  onOpenSettings: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onOpenSettings }) => {
  const { t } = useApp();
  const [showAddPromoter, setShowAddPromoter] = useState(false);
  const [showAddCS, setShowAddCS] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handlePromoterAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleCSAdded = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen flex bg-[#f8fafc] dark:bg-slate-900">
      <Sidebar onOpenSettings={onOpenSettings} />
      <main className="flex-1 ml-64 flex flex-col">
        <Header />
        <div className="p-8">
          <Routes>
            <Route path="/" element={<DashboardOverview />} />
            <Route path="/apps" element={<AppsList />} />
            <Route path="/apps/:appId" element={<AppDetailPage />} />
            <Route path="/cs" element={<CSTeam />} />
            <Route path="/cs-list" element={<CSList key={refreshKey} onAddCS={() => setShowAddCS(true)} />} />
            <Route path="/promoters" element={<PromoterList key={refreshKey} onAddPromoter={() => setShowAddPromoter(true)} />} />
            <Route path="/promotion-records" element={<PromotionRecordList />} />
            <Route path="/promotion-records/:id" element={<PromotionRecordDetail />} />
            <Route path="/cs-assignment" element={<CSAssignment />} />
            <Route path="/chat-management" element={<AdminChatManagement />} />
            <Route path="/payment-verification" element={<PaymentVerificationManagement />} />
            <Route path="/revenue" element={<RevenueManagement />} />
            <Route path="/promotion-tracks" element={<PromotionTrackView />} />
            <Route path="/app-releases" element={<AppReleaseList />} />
            <Route path="/app-releases/:id" element={<AppReleaseDetail />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </div>
      </main>
      {showAddPromoter && (
        <AddPromoterForm
          onClose={() => setShowAddPromoter(false)}
          onSuccess={handlePromoterAdded}
        />
      )}
      {showAddCS && (
        <AddCSForm
          onClose={() => setShowAddCS(false)}
          onSuccess={handleCSAdded}
        />
      )}
    </div>
  );
};

