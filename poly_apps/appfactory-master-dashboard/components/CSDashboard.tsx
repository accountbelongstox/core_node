
import React, { useMemo } from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
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
  BarChart3,
  ExternalLink,
  Users,
  Award,
  ArrowUpRight,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Download,
  PlusCircle,
  MoreVertical
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useApp } from '../contexts/AppContext';
import { UserRole, AppStatus } from '../types';
import { StatCard } from './StatCard';
import { MOCK_APPS, MOCK_CS_APP_REVENUE, MOCK_DAILY_STATS } from '../constants';

import { Profile } from './Profile';
import { NotificationCenter } from './NotificationCenter';

// Customer Management Component
const CustomerManagement = () => {
  const customers = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', lastActive: '2 hours ago', status: 'Active', value: '$450', tags: ['High Value', 'VIP'] },
    { id: 2, name: 'Mark Wilson', email: 'mark@test.com', lastActive: '5 hours ago', status: 'Idle', value: '$120', tags: ['Trial'] },
    { id: 3, name: 'Sarah Parker', email: 'sarah.p@domain.com', lastActive: '1 day ago', status: 'Inactive', value: '$0', tags: ['New'] },
    { id: 4, name: 'James Brown', email: 'j.brown@gmail.com', lastActive: '3 days ago', status: 'Active', value: '$2,100', tags: ['Loyal'] },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Customer Management</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track and engage with your app users</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
          <PlusCircle size={18} />
          Add Customer
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Search className="text-slate-400" size={18} />
            <input type="text" placeholder="Search customers..." className="bg-transparent border-none text-sm focus:ring-0 w-64" />
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-700 rounded-lg text-xs font-bold text-slate-500">
              <Filter size={14} />
              Filter
            </button>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Customer</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Last Active</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Lifetime Value</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Tags</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {customers.map(customer => (
              <tr key={customer.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{customer.name}</p>
                      <p className="text-xs text-slate-500">{customer.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                    customer.status === 'Active' ? 'bg-emerald-50 text-emerald-600' :
                    customer.status === 'Idle' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {customer.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-slate-500">{customer.lastActive}</td>
                <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">{customer.value}</td>
                <td className="px-6 py-4">
                  <div className="flex gap-1">
                    {customer.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 rounded text-[10px] font-bold">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                    <MoreVertical size={18} />
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

const CSOverview = () => {
  const { t, user } = useApp();
  
  // Calculate CS specific stats
  const csStats = useMemo(() => {
    const myRevenues = MOCK_CS_APP_REVENUE.filter(r => r.csId === 'cs1'); // Using cs1 as mock current user
    const totalCommission = myRevenues.reduce((acc, r) => acc + r.commission, 0);
    const totalPromotions = myRevenues.reduce((acc, r) => acc + r.promotions, 0);
    const myAppsCount = MOCK_APPS.filter(a => a.assignedCSIds.includes('cs1')).length;
    
    return { totalCommission, totalPromotions, myAppsCount };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="My Commission" value={`$${csStats.totalCommission.toLocaleString()}`} change="+12.5%" isPositive icon={<DollarSign size={20} />} />
        <StatCard title="Total Promotions" value={csStats.totalPromotions.toString()} change="+18" isPositive icon={<TrendingUp size={20} />} />
        <StatCard title="Assigned Apps" value={csStats.myAppsCount.toString()} icon={<Smartphone size={20} />} />
        <StatCard title="Performance Rank" value="#2" icon={<Award size={20} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Earnings Trend</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_DAILY_STATS}>
                  <defs>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} fontWeight="bold" tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip />
                  <Area type="monotone" dataKey="revenue" name="Earnings" stroke="#6366f1" fillOpacity={1} fill="url(#colorComm)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">Recent Promotions</h3>
              <Link to="/promotions" className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</Link>
            </div>
            <div className="space-y-4">
              {MOCK_CS_APP_REVENUE.slice(0, 4).map(rev => {
                const app = MOCK_APPS.find(a => a.id === rev.appId);
                return (
                  <div key={rev.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-indigo-600">
                        <Rocket size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-white">{app?.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Promotion Successful • {rev.lastUpdated}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-500">+${rev.commission}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Commission</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-2xl text-white shadow-xl shadow-indigo-500/20">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md">
                <Award size={24} />
              </div>
              <span className="text-xs font-bold bg-emerald-500 px-2 py-1 rounded-full">Level 4</span>
            </div>
            <h4 className="text-lg font-bold mb-1">Monthly Goal</h4>
            <p className="text-indigo-100 text-xs mb-4">You are doing great! 85% of your goal reached.</p>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-white" style={{ width: '85%' }} />
            </div>
            <div className="flex justify-between text-[10px] font-bold">
              <span>$8,500 earned</span>
              <span>$10,000 goal</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Assigned Apps</h3>
            <div className="space-y-4">
              {MOCK_APPS.filter(a => a.assignedCSIds.includes('cs1')).map(app => (
                <div key={app.id} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-slate-600">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-indigo-600">
                      {app.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-white">{app.name}</p>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase">{app.status}</span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-400" />
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 bg-slate-50 dark:bg-slate-700 text-indigo-600 text-xs font-bold rounded-xl hover:bg-indigo-50 transition-colors">
              Manage All Apps
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// CS Apps List Component
const MyApps = () => {
  const myApps = MOCK_APPS.filter(a => a.assignedCSIds.includes('cs1'));
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">My Assigned Apps</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track performance for your portfolio</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="text" placeholder="Search my apps..." className="pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {myApps.map(app => (
          <div key={app.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden group hover:shadow-xl transition-all">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xl">
                  {app.name.charAt(0)}
                </div>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${
                  app.status === AppStatus.LIVE ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}>
                  {app.status}
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors">{app.name}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 line-clamp-2">{app.description}</p>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Revenue</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">${app.revenue.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-700/50 p-3 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">My Earnings</p>
                  <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">${(app.revenue * 0.15).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Daily Visits</span>
                  <span className="font-bold text-slate-800 dark:text-white">{app.visits.toLocaleString()}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-700/50 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center">
              <button className="text-xs font-bold text-indigo-600 flex items-center gap-1 hover:underline">
                <ExternalLink size={14} />
                Open Dashboard
              </button>
              <button className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
                <Settings size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Promotion Tools Component
const PromotionTools = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Promotion Tools</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Everything you need to boost your app earnings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center group hover:border-indigo-500 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-lg shadow-indigo-500/10">
            <ExternalLink size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Smart Links</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Generate trackable deep links for social media sharing.</p>
          <button className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-indigo-600 font-bold rounded-xl hover:bg-indigo-600 hover:text-white transition-all">
            Generate Link
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center group hover:border-purple-500 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 mb-6 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-lg shadow-purple-500/10">
            <Download size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Asset Library</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Download high-quality banners, videos and icons.</p>
          <button className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-purple-600 font-bold rounded-xl hover:bg-purple-600 hover:text-white transition-all">
            Browse Assets
          </button>
        </div>

        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center text-center group hover:border-emerald-500 transition-all">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-lg shadow-emerald-500/10">
            <Zap size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Copy Templates</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">Ready-to-use high converting ad copy templates.</p>
          <button className="w-full py-3 bg-slate-50 dark:bg-slate-700 text-emerald-600 font-bold rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
            Get Templates
          </button>
        </div>
      </div>
    </div>
  );
};

// Promotion Records Component
const PromotionRecords = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Promotion History</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">View your successful promotion activity</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-500/20">
          Export History
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
            <Calendar size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">All Time</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700 px-3 py-1.5 rounded-lg">
            <Filter size={16} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Success Only</span>
          </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-700 border-b border-slate-100 dark:border-slate-600">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">App Name</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Promotion ID</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Date</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">Status</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {MOCK_CS_APP_REVENUE.map(rev => {
              const app = MOCK_APPS.find(a => a.id === rev.appId);
              return (
                <tr key={rev.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 font-bold text-xs">
                        {app?.name.charAt(0)}
                      </div>
                      <span className="text-sm font-bold text-slate-800 dark:text-white">{app?.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <code className="text-xs font-mono text-slate-500">#PROM-{rev.id.toUpperCase()}</code>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500">{rev.lastUpdated}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 uppercase">
                      <CheckCircle2 size={12} />
                      Completed
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-bold text-slate-800 dark:text-white">${rev.commission.toLocaleString()}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

    </div>
  );
};

// Performance Analytics Component
const PerformanceAnalytics = () => {
  const { t } = useApp();
  
  const myRanking = 2;
  const teamAverage = 8500;
  const myEarnings = 12500;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Performance Analytics</h2>
          <p className="text-sm text-slate-500">Track your performance metrics and rankings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">My Ranking</h3>
            <div className="space-y-6">
              <div className="flex items-center justify-between p-6 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-2xl border-2 border-indigo-200 dark:border-indigo-800">
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Current Rank</p>
                  <p className="text-5xl font-bold text-indigo-600">#{myRanking}</p>
                  <p className="text-sm text-slate-500 mt-2">Out of {MOCK_CS.length} CS members</p>
                </div>
                <div className="text-right">
                  <Award size={48} className="text-amber-500" />
                  <p className="text-xs font-bold text-amber-600 mt-2">Top Performer</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">My Earnings</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">${myEarnings.toLocaleString()}</p>
                  <div className="flex items-center gap-1 mt-2 text-xs font-bold text-emerald-500">
                    <ArrowUpRight size={12} />
                    +47% vs average
                  </div>
                </div>
                <div className="p-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-bold text-slate-400 uppercase mb-2">Team Average</p>
                  <p className="text-2xl font-bold text-slate-800 dark:text-white">${teamAverage.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 mt-2">All CS members</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-8 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Performance Report</h3>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">Weekly Report</span>
                  <span className="text-xs text-slate-500">Week 50, 2025</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">Key metrics: 124 promotions, $2,085 commission, 98% success rate</p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">Excellent</span>
                  <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold">+12% Growth</span>
                </div>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-slate-800 dark:text-white">Monthly Report</span>
                  <span className="text-xs text-slate-500">December 2025</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">Key metrics: 512 promotions, $8,500 commission, 95% success rate</p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold">On Track</span>
                  <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-[10px] font-bold">85% Goal</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6">Improvement Suggestions</h3>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <div className="flex items-start gap-3">
                  <Zap size={20} className="text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Focus on High-Value Apps</p>
                    <p className="text-xs text-slate-500">Prioritize promoting apps with higher revenue potential</p>
                  </div>
                </div>
              </div>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                <div className="flex items-start gap-3">
                  <TrendingUp size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-white mb-1">Increase Social Media Activity</p>
                    <p className="text-xs text-slate-500">Your social promotions have 2x higher conversion</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
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
    { icon: <Zap size={20} />, label: 'Promotion Tools', path: '/tools' },
    { icon: <Users size={20} />, label: 'Customers', path: '/customers' },
    { icon: <TrendingUp size={20} />, label: 'Performance', path: '/performance' },
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
            <Route path="/promotions" element={<PromotionRecords />} />
            <Route path="/tools" element={<PromotionTools />} />
            <Route path="/customers" element={<CustomerManagement />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/notifications" element={<NotificationCenter />} />
            <Route path="/performance" element={<PerformanceAnalytics />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

