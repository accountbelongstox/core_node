import React, { useState, useMemo } from 'react';
import { Search, Plus, User, DollarSign, MapPin, Phone, Calendar } from 'lucide-react';
import { modelService } from '../services/modelService';
import { Promoter } from '../types';
import { useApp } from '../contexts/AppContext';

interface PromoterListProps {
  onAddPromoter: () => void;
}

/**
 * 推广人员列表组件（管理端）
 */
export const PromoterList: React.FC<PromoterListProps> = ({ onAddPromoter }) => {
  const { t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');

  const promoters = useMemo(() => {
    return modelService.getPromoters() || [];
  }, []);

  const filteredPromoters = useMemo(() => {
    return promoters.filter(promoter => 
      promoter.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promoter.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      promoter.contact.includes(searchQuery)
    );
  }, [promoters, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('promoterManagement.promoterList')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('promoterManagement.totalPromoters', { count: filteredPromoters.length })}
          </p>
        </div>
        <button
          onClick={onAddPromoter}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold"
        >
          <Plus size={18} />
          {t('promoterManagement.addPromoter')}
        </button>
      </div>

      {/* 搜索 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('promoterManagement.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
          />
        </div>
      </div>

      {/* 推广人员列表 */}
      {filteredPromoters.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">{t('promoterManagement.noPromoters')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPromoters.map(promoter => (
            <div
              key={promoter.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 hover:shadow-xl transition-all"
            >
              <div className="flex items-start gap-4 mb-4">
                {promoter.photo ? (
                  <img
                    src={promoter.photo}
                    alt={promoter.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-slate-200 dark:border-slate-600"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xl">
                    {promoter.name.charAt(0)}
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">{promoter.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mt-1">
                    <MapPin size={14} />
                    <span>{promoter.region}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">{promoter.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-slate-400" />
                  <span className="text-slate-600 dark:text-slate-400">{t('promoterManagement.joinDateLabel')} {promoter.joinDate}</span>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.totalValidCount')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">{promoter.totalValidCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.unitPrice')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">¥{promoter.unitPrice}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.totalPrice')}</span>
                  <span className="font-bold text-slate-800 dark:text-white">¥{promoter.totalPrice.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.totalDeduction')}</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">¥{promoter.totalDeduction.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.totalSettlement')}</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">¥{promoter.totalSettlement.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.settled')}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">¥{promoter.settledAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.unsettled')}</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">¥{promoter.unsettledAmount.toLocaleString()}</span>
                </div>
                {promoter.approverName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">{t('promoterManagement.approver')}</span>
                    <span className="font-bold text-slate-800 dark:text-white">{promoter.approverName}</span>
                  </div>
                )}
                {promoter.paymentAddress && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t('promoterManagement.paymentAddressLabel')}</p>
                    <code className="text-xs text-slate-600 dark:text-slate-400 font-mono break-all">
                      {promoter.paymentAddress.substring(0, 20)}...
                    </code>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

