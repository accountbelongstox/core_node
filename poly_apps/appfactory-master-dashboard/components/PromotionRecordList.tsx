import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Search, Filter, Eye, Calendar, User, DollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { modelService } from '../services/modelService';
import { PromotionRecord } from '../types';
import { useApp } from '../contexts/AppContext';
import { getAppNameById } from '../utils/dataHelpers';

/**
 * 推广记录列表组件
 * 显示所有推广记录，点击查看详情
 */
export const PromotionRecordList: React.FC = () => {
  const { t } = useApp();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled' | 'unsettled'>('all');

  const records = useMemo(() => modelService.getPromotionRecords(), []);

  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Get app name from central data source
      const appName = getAppNameById(record.appId);
      const matchesSearch = appName.toLowerCase().includes(searchQuery.toLowerCase()) ? true :
                           record.promoterName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' ? true : 
                           (statusFilter === 'settled' ? record.isSettled : !record.isSettled);
      return matchesSearch && matchesStatus;
    });
  }, [records, searchQuery, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('promotionRecord.list')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('promotionRecord.totalRecords', { count: filteredRecords.length })}
          </p>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('promotionRecord.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'settled' | 'unsettled')}
              className="px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm"
            >
              <option value="all">{t('promotionRecord.allStatus')}</option>
              <option value="settled">{t('promotionRecord.settled')}</option>
              <option value="unsettled">{t('promotionRecord.unsettled')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* 推广记录列表 */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-12 text-center">
          <p className="text-slate-500 dark:text-slate-400">{t('promotionRecord.noRecords')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map(record => (
            <div
              key={record.id}
              className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 hover:shadow-xl transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">{getAppNameById(record.appId)}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      record.isSettled 
                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
                        : 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {record.isSettled ? t('promotionRecord.settled') : t('promotionRecord.unsettled')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <User size={16} />
                      <span>{t('promotionRecord.promoter')}{record.promoterName}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <Calendar size={16} />
                      <span>{record.startTime} - {record.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>{t('promotionRecord.validCount')}{record.validCount}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                      <DollarSign size={16} className="text-indigo-500" />
                      <span>{t('promotionRecord.settlement')}¥{record.settlement.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>{t('promotionRecord.unitPrice')}¥{record.unitPrice}</span>
                    <span>{t('promotionRecord.totalPrice')}¥{record.totalPrice.toLocaleString()}</span>
                    <span>{t('promotionRecord.deduction')}¥{record.deduction.toLocaleString()}</span>
                    {record.approverName && <span>{t('promotionRecord.approver')}{record.approverName}</span>}
                  </div>
                </div>

                <Link
                  to={`/promotion-records/${record.id}`}
                  className="ml-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 text-sm font-bold"
                >
                  <Eye size={16} />
                  {t('promotionRecord.viewDetails')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

