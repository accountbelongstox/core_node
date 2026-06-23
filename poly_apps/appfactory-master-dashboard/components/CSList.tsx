import React, { useState, useMemo } from 'react';
import { Search, Plus, User, DollarSign, Phone, Calendar, Award, Edit2, Trash2 } from 'lucide-react';
import { modelService } from '../services/modelService';
import { CustomerService } from '../types';
import { useApp } from '../contexts/AppContext';
import { CSDetailModal } from './CSDetailModal';
import { getAvatarUrl } from '../utils/avatarUtils';

interface CSListProps {
  onAddCS: () => void;
}

/**
 * Customer Service List Component (Admin Side)
 */
export const CSList: React.FC<CSListProps> = ({ onAddCS }) => {
  const { t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCS, setSelectedCS] = useState<CustomerService | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const csTeam = useMemo(() => {
    return modelService.getCSTeam() || [];
  }, [refreshKey]);

  const filteredCS = useMemo(() => {
    return csTeam.filter(cs => 
      cs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cs.nickname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cs.contact?.includes(searchQuery) ||
      cs.level?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [csTeam, searchQuery]);

  const handleUpdate = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDelete = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('csManagement.csList')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('csManagement.totalCSMembers', { count: filteredCS.length })}
          </p>
        </div>
        <button
          onClick={onAddCS}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold"
        >
          <Plus size={18} />
          {t('csManagement.addCS')}
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('csManagement.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
          />
        </div>
      </div>

      {/* CS list */}
      {filteredCS.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">{t('csManagement.noCSMembers')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCS.map(cs => (
            <div
              key={cs.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 hover:shadow-xl transition-all cursor-pointer"
              onClick={() => setSelectedCS(cs)}
            >
              <div className="flex items-start gap-4 mb-4">
                {(cs.photo || cs.avatar) ? (
                  <img
                    src={getAvatarUrl(cs.photo || cs.avatar, 150, 'pravatar')}
                    alt={cs.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                    {cs.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{cs.name}</h3>
                    {cs.nickname && (
                      <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded text-xs font-bold">
                        {cs.nickname}
                      </span>
                    )}
                    {cs.level && (
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-bold">
                        {cs.level}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <span className={`w-2 h-2 rounded-full ${
                      cs.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                    <span>{cs.status === 'Online' ? t('csManagement.online') : t('csManagement.offline')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {cs.contact && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone size={14} className="text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">{cs.contact}</span>
                  </div>
                )}
                {cs.joinDate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={14} className="text-slate-400" />
                    <span className="text-slate-600 dark:text-slate-400">{t('csManagement.joinDateLabel')} {cs.joinDate}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.businessAmount')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">¥{cs.businessAmount?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.commissionAmount')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">¥{cs.commissionAmount?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.commissionRate')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">{cs.commissionPercentage || cs.commissionRate}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.totalPrice')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">¥{cs.totalPrice?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.totalDeduction')}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">¥{cs.totalDeduction?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.totalSettlement')}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">¥{cs.totalSettlement?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.settled')}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">¥{cs.settledAmount?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('csManagement.unsettled')}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">¥{cs.unsettledAmount?.toLocaleString() || 0}</span>
                </div>
                {cs.approverName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{t('csManagement.approver')}</span>
                    <span className="font-bold text-slate-800 dark:text-white">{cs.approverName}</span>
                  </div>
                )}
                {cs.paymentAddress && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('csManagement.paymentAddressLabel')}</p>
                    <code className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                      {cs.paymentAddress.substring(0, 20)}...
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCS && (
        <CSDetailModal
          cs={selectedCS}
          onClose={() => setSelectedCS(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
};

