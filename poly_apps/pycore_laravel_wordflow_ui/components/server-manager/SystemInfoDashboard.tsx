'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/core/api';
import { StatsCard, StatsGrid, DataTable, type DataTableColumn } from '@/components/admin';
import { useToast } from '@/components/admin';
import { useTranslation } from '@/core/i18n';
import { StatusBadge } from '@/components/common';
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

      // Backend wraps each payload in an envelope; unwrap to the array/object
      // the UI expects (lists must stay arrays so .map/.filter never crash).
      if (infoRes.success) setSystemInfo(infoRes.data);
      if (processRes.success) {
        setProcesses(Array.isArray(processRes.data?.processes) ? processRes.data.processes : []);
      }
      if (serviceRes.success) {
        // Backend groups services as objects (system_services / octane_services /
        // application_services); flatten them into the flat array the table renders.
        const grouped = serviceRes.data || {};
        const flat = [
          ...Object.values(grouped.system_services || {}),
          ...Object.values(grouped.octane_services || {}),
          ...Object.values(grouped.application_services || {})
        ];
        setServices(flat);
      }
      if (storageRes.success) {
        setStorage(Array.isArray(storageRes.data?.disk_usage) ? storageRes.data.disk_usage : []);
      }
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

  // Derived views over the backend `getSystemInfo` / `getStorage` payloads.
  // memory_info is reported in bytes; disk_usage is df output (string fields).
  const memInfo = systemInfo?.hardware_info?.memory_info as
    | { total?: number; used?: number; free?: number }
    | undefined;
  const rootDisk = storage.find((d: any) => d?.mounted_on === '/') || storage[0];

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
      key: 'user',
      title: 'User',
      sortable: true,
      width: '120px'
    },
    {
      // Backend `ps aux` rows expose the full command line under `command`.
      key: 'command',
      title: 'Process',
      sortable: true,
      render: (value) => (
        <span className="block truncate max-w-md" title={value}>{value}</span>
      )
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
      // `ps aux` %MEM is a percentage of physical memory, not a byte count.
      key: 'memory',
      title: 'MEM %',
      sortable: true,
      width: '100px',
      render: (value) => `${value}%`
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
        <StatusBadge
          status={value}
          tone={value === 'active' ? 'success' : value === 'inactive' ? 'idle' : 'error'}
          withDot={false}
        />
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
          title="CPU"
          value={systemInfo?.hardware_info?.cpu_info?.cores != null
            ? `${systemInfo.hardware_info.cpu_info.cores} cores`
            : '-'}
          icon={Cpu}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          subtitle={Array.isArray(systemInfo?.hardware_info?.load_average)
            ? `load ${systemInfo.hardware_info.load_average.map((n: number) => Number(n).toFixed(2)).join(' / ')}`
            : undefined}
          loading={loading}
        />

        <StatsCard
          title="Memory Usage"
          value={memInfo ? formatBytes(memInfo.used || 0) : '-'}
          icon={Database}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
          subtitle={memInfo ? `${formatBytes(memInfo.total || 0)} total` : undefined}
          trend={
            memInfo && memInfo.total ? {
              value: Math.round((memInfo.used / memInfo.total) * 100),
              direction: 'up',
              label: 'used'
            } : undefined
          }
          loading={loading}
        />

        <StatsCard
          title="Disk Usage"
          value={rootDisk ? rootDisk.used : '-'}
          icon={HardDrive}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          subtitle={rootDisk ? `${rootDisk.size} total` : undefined}
          loading={loading}
        />

        <StatsCard
          title="System Uptime"
          value={systemInfo?.basic_info?.uptime || '-'}
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
            {storage.map((device, index) => {
              // Backend `disk_usage` rows are df output: filesystem, size, used,
              // available, use_percent (e.g. "45%"), mounted_on — all strings.
              const usePercent = parseInt(String(device.use_percent || '0'), 10) || 0;
              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium truncate">{device.mounted_on || device.filesystem}</span>
                    <span className="text-sm text-gray-600">{device.size}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Used:</span>
                      <span>{device.used}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Free:</span>
                      <span>{device.available}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          usePercent > 90 ? 'bg-red-600' :
                          usePercent > 70 ? 'bg-yellow-600' :
                          'bg-green-600'
                        }`}
                        style={{ width: `${usePercent}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-right">
                      {usePercent}% used
                    </div>
                  </div>
                </div>
              );
            })}
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
