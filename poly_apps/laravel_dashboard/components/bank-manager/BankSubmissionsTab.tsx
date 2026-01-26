import React from 'react';
import { Search } from 'lucide-react';

interface DataSubmission {
  id: number;
  device_id: string;
  device_name: string;
  platform: string;
  phone?: string;
  full_name?: string;
  total_balance?: number;
  submit_time: string;
  created_at: string;
}

interface BankSubmissionsTabProps {
  submissions: DataSubmission[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  translations: {
    search: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    phone: string;
    fullName: string;
    balance: string;
    submitTime: string;
    noData: string;
  };
}

const BankSubmissionsTab: React.FC<BankSubmissionsTabProps> = ({
  submissions,
  searchTerm,
  onSearchChange,
  translations
}) => {
  const filteredSubmissions = submissions.filter(sub => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      sub.device_id.toLowerCase().includes(term) ||
      sub.device_name.toLowerCase().includes(term) ||
      (sub.phone && sub.phone.includes(term)) ||
      (sub.full_name && sub.full_name.toLowerCase().includes(term))
    );
  });

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder={translations.search}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.deviceId}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.deviceName}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.platform}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.phone}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.fullName}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.balance}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">{translations.submitTime}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filteredSubmissions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  {translations.noData}
                </td>
              </tr>
            ) : (
              filteredSubmissions.map((submission) => (
                <tr key={submission.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">{submission.device_id}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{submission.device_name}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{submission.platform}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{submission.phone || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">{submission.full_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-900 dark:text-white">
                    {submission.total_balance ? `¥${submission.total_balance.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                    {new Date(submission.submit_time).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default BankSubmissionsTab;

