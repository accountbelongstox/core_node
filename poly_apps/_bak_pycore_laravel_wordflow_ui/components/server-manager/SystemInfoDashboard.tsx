'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/core/api';
import { StatsCard, StatsGrid, DataTable, type DataTableColumn } from '@/components/admin';
import { useToast } from '@/components/admin';
import { useTranslation } from '@/core/i18n';
import {
  Cpu,
  HardDrive,
  Activity,
  Server,
  RefreshCw,
  Clock,
  Zap,
  Database
} from 'lucide-react';

/**
 * System Info Dashboard
 *
 * Displays comprehensive system information including:
 * - CPU usage and stats
 * - Memory usage
 * - Disk usage
 * - Running processes
 * - System services
 * - Storage devices
 */
export function SystemInfoDashboard() {
  const [systemInfo, setSystemInfo] = useState<any>(null);
  const [processes, setProcesses] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [storage, setStorage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [infoRes, processRes, serviceRes, storageRes] = await Promise.all([
        api.serverManagerV1.getSystemInfo(),
        api.serverManagerV1.getProcesses(),
        api.serverManagerV1.getServices(),
        api.serverManagerV1.getStorage()
      ]);

      if (infoRes.success) setSystemInfo(infoRes.data);
      if (processRes.success) setProcesses(processRes.data);
      if (serviceRes.success) setServices(serviceRes.data);
      if (storageRes.success) setStorage(storageRes.data);
    } catch (error: any) {
      toast.error(error.message || t('messages.networkError'));
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    toast.success(t('messages.refreshed'));
  }

  /**
   * Format uptime
   */
  function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * Format bytes
   */
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Process columns
   */
  const processColumns: DataTableColumn[] = [
    {
      key: 'pid',
      title: 'PID',
      sortable: true,
      width: '80px'
    },
    {
      key: 'name',
      title: 'Process Name',
      sortable: true
    },
    {
      key: 'cpu',
      title: 'CPU %',
      sortable: true,
      width: '100px',
      render: (value) => (
        <span className={value > 50 ? 'text-red-600 font-semibold' : ''}>
          {value}%
        </span>
      )
    },
    {
      key: 'memory',
      title: 'Memory',
      sortable: true,
      width: '120px',
      render: (value) => formatBytes(value)
    },
    {
      key: 'status',
      title: 'Status',
      width: '100px',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs ${
          value === 'running' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
        }`}>
          {value}
        </span>
      )
    }
  ];

  /**
   * Service columns
   */
  const serviceColumns: DataTableColumn[] = [
    {
      key: 'name',
      title: 'Service Name',
      sortable: true
    },
    {
      key: 'status',
      title: 'Status',
      width: '120px',
      render: (value) => (
        <span className={`px-2 py-1 rounded text-xs ${
          value === 'active' ? 'bg-green-100 text-green-800' :
          value === 'inactive' ? 'bg-gray-100 text-gray-800' :
          'bg-red-100 text-red-800'
        }`}>
          {value}
        </span>
      )
    },
    {
      key: 'enabled',
      title: 'Auto Start',
      width: '100px',
      render: (value) => (
        <span className={value ? 'text-green-600' : 'text-gray-400'}>
          {value ? 'Yes' : 'No'}
        </span>
      )
    },
    {
      key: 'description',
      title: 'Description'
    }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('serverManager.systemInfo')}
          </h1>
          <p className="text-gray-600 mt-1">
            Monitor system performance and resource usage
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          {t('common.refresh')}
        </button>
      </div>

      {/* Stats Grid */}
      <StatsGrid columns={4} gap="md">
        <StatsCard
          title="CPU Usage"
          value={systemInfo ? `${systemInfo.cpu?.usage || 0}%` : '-'}
          icon={Cpu}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          subtitle={systemInfo ? `${systemInfo.cpu?.cores || 0} cores` : undefined}
          trend={
            systemInfo?.cpu?.trend ? {
              value: systemInfo.cpu.trend,
              direction: systemInfo.cpu.trend > 0 ? 'up' : 'down'
            } : undefined
          }
          loading={loading}
        />

        <StatsCard
          title="Memory Usage"
          value={systemInfo ? formatBytes(systemInfo.memory?.used || 0) : '-'}
          icon={Database}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          subtitle={systemInfo ? `${formatBytes(systemInfo.memory?.total || 0)} total` : undefined}
          trend={
            systemInfo?.memory ? {
              value: Math.round((systemInfo.memory.used / systemInfo.memory.total) * 100),
              direction: 'up',
              label: 'used'
            } : undefined
          }
          loading={loading}
        />

        <StatsCard
          title="Disk Usage"
          value={systemInfo ? formatBytes(systemInfo.disk?.used || 0) : '-'}
          icon={HardDrive}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          subtitle={systemInfo ? `${formatBytes(systemInfo.disk?.total || 0)} total` : undefined}
          loading={loading}
        />

        <StatsCard
          title="System Uptime"
          value={systemInfo ? formatUptime(systemInfo.uptime || 0) : '-'}
          icon={Clock}
          iconColor="text-orange-600"
          iconBgColor="bg-orange-100"
          loading={loading}
        />
      </StatsGrid>

      {/* Storage Devices */}
      {storage.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Storage Devices
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {storage.map((device, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{device.name}</span>
                  <span className="text-sm text-gray-600">{device.type}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Used:</span>
                    <span>{formatBytes(device.used)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Free:</span>
                    <span>{formatBytes(device.free)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (device.used / device.total) > 0.9 ? 'bg-red-600' :
                        (device.used / device.total) > 0.7 ? 'bg-yellow-600' :
                        'bg-green-600'
                      }`}
                      style={{ width: `${(device.used / device.total) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    {Math.round((device.used / device.total) * 100)}% used
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running Processes */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Top Processes
          </h2>
        </div>
        <DataTable
          columns={processColumns}
          data={processes.slice(0, 10)}
          loading={loading}
          emptyMessage="No processes found"
        />
      </div>

      {/* System Services */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5" />
            System Services
          </h2>
        </div>
        <DataTable
          columns={serviceColumns}
          data={services}
          loading={loading}
          search={{
            value: '',
            placeholder: 'Search services...',
            onSearch: () => {}
          }}
          emptyMessage="No services found"
        />
      </div>
    </div>
  );
}
