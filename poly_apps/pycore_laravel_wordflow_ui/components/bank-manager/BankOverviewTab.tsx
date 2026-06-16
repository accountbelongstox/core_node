import React from 'react';
import { Database, Smartphone, Users, CreditCard } from 'lucide-react';

interface Stats {
  total_submissions: number;
  total_devices: number;
  total_users: number;
  total_cards: number;
}

interface BankOverviewTabProps {
  stats: Stats | null;
  translations: {
    totalSubmissions: string;
    totalDevices: string;
    totalUsers: string;
    totalCards: string;
  };
}

const BankOverviewTab: React.FC<BankOverviewTabProps> = ({ stats, translations }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{translations.totalSubmissions}</h3>
          <Database className="text-indigo-600 dark:text-indigo-400" size={20} />
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {stats?.total_submissions || 0}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{translations.totalDevices}</h3>
          <Smartphone className="text-indigo-600 dark:text-indigo-400" size={20} />
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {stats?.total_devices || 0}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{translations.totalUsers}</h3>
          <Users className="text-indigo-600 dark:text-indigo-400" size={20} />
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {stats?.total_users || 0}
        </p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">{translations.totalCards}</h3>
          <CreditCard className="text-indigo-600 dark:text-indigo-400" size={20} />
        </div>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {stats?.total_cards || 0}
        </p>
      </div>
    </div>
  );
};

export default BankOverviewTab;

