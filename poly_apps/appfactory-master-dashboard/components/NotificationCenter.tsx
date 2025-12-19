
import React from 'react';
import { 
  Bell, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  DollarSign, 
  Rocket, 
  X,
  ChevronRight,
  Filter,
  Trash2
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

export const NotificationCenter: React.FC = () => {
  const { t } = useApp();

  const notifications = [
    {
      id: 1,
      title: 'New Revenue Milestone',
      message: 'App "Smart Expense Pro" reached $5,000 in revenue today!',
      type: 'success',
      icon: <DollarSign size={18} />,
      time: '2 hours ago',
      unread: true,
    },
    {
      id: 2,
      title: 'APP Generation Complete',
      message: 'Your new app "RecipeShare" is ready for review.',
      type: 'info',
      icon: <Rocket size={18} />,
      time: '5 hours ago',
      unread: true,
    },
    {
      id: 3,
      title: 'System Maintenance',
      message: 'Scheduled maintenance tonight at 02:00 AM UTC.',
      type: 'warning',
      icon: <Clock size={18} />,
      time: '1 day ago',
      unread: false,
    },
    {
      id: 4,
      title: 'New CS Member Joined',
      message: 'Emma Zhang has been added to the CS Team.',
      type: 'info',
      icon: <CheckCircle2 size={18} />,
      time: '2 days ago',
      unread: false,
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Notifications</h2>
          <p className="text-sm text-slate-500">Stay updated with your app ecosystem activity</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition-colors">
            <Filter size={14} />
            Filter
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors">
            <Trash2 size={14} />
            Clear All
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
        {notifications.map((notif) => (
          <div key={notif.id} className={`p-6 flex gap-6 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group relative ${notif.unread ? 'bg-indigo-50/20 dark:bg-indigo-900/10' : ''}`}>
            {notif.unread && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-600" />
            )}
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              notif.type === 'success' ? 'bg-emerald-100 text-emerald-600' :
              notif.type === 'warning' ? 'bg-amber-100 text-amber-600' :
              'bg-indigo-100 text-indigo-600'
            }`}>
              {notif.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-bold text-slate-800 dark:text-white">{notif.title}</h4>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{notif.time}</span>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{notif.message}</p>
              <div className="flex items-center gap-4">
                <button className="text-xs font-bold text-indigo-600 hover:underline">View Details</button>
                <button className="text-xs font-bold text-slate-400 hover:text-slate-600">Mark as Read</button>
              </div>
            </div>
            <button className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-500 transition-opacity">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

