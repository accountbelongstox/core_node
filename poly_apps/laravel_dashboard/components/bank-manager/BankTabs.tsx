import React from 'react';

type TabType = 'overview' | 'submissions' | 'devices' | 'users';

interface BankTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  translations: {
    overview: string;
    submissions: string;
    devices: string;
    users: string;
  };
}

const BankTabs: React.FC<BankTabsProps> = ({ activeTab, onTabChange, translations }) => {
  return (
    <div className="mb-6">
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        <button
          onClick={() => onTabChange('overview')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {translations.overview}
        </button>
        <button
          onClick={() => onTabChange('submissions')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'submissions'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {translations.submissions}
        </button>
        <button
          onClick={() => onTabChange('devices')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'devices'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {translations.devices}
        </button>
        <button
          onClick={() => onTabChange('users')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          {translations.users}
        </button>
      </div>
    </div>
  );
};

export default BankTabs;

