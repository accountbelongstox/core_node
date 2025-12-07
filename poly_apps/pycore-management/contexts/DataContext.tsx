/**
 * 数据中心化上下文
 * 
 * 职责：
 * - 统一管理全局数据状态
 * - 提供数据缓存机制
 * - 支持数据自动刷新
 * - 减少重复 API 调用
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../services/api';
import {
  DashboardOverview,
  RealtimeMetrics,
  SystemStatus,
  SystemConfig,
  LocalCapabilities,
  LocalProcessingConfig,
  LocalProcessingStats,
  UploadTask,
  UploadHistoryItem,
  UploadServer,
  RemoteServer,
  LogEntry,
  PerformanceStats,
  UsageTrends,
  ResourceStats,
} from '../types';

interface DataContextType {
  // Dashboard Data
  dashboardOverview: DashboardOverview | null;
  realtimeMetrics: RealtimeMetrics[];
  refreshDashboard: () => Promise<void>;
  refreshMetrics: (count?: number) => Promise<void>;

  // System Data
  systemStatus: SystemStatus | null;
  systemConfig: SystemConfig | null;
  refreshSystemStatus: () => Promise<void>;
  refreshSystemConfig: () => Promise<void>;
  updateSystemConfig: (config: SystemConfig) => Promise<void>;

  // Local Processing Data
  localCapabilities: LocalCapabilities | null;
  localConfig: LocalProcessingConfig | null;
  localStats: LocalProcessingStats | null;
  refreshLocalCapabilities: () => Promise<void>;
  refreshLocalConfig: () => Promise<void>;
  refreshLocalStats: () => Promise<void>;
  updateLocalConfig: (config: LocalProcessingConfig) => Promise<void>;

  // Upload Data
  uploadTasks: UploadTask[];
  uploadHistory: UploadHistoryItem[];
  uploadServers: UploadServer[];
  refreshUploadTasks: () => Promise<void>;
  refreshUploadHistory: () => Promise<void>;
  refreshUploadServers: () => Promise<void>;

  // Remote Servers Data
  remoteServers: RemoteServer[];
  refreshRemoteServers: () => Promise<void>;

  // Logs Data
  logs: LogEntry[];
  refreshLogs: () => Promise<void>;

  // Statistics Data
  performanceStats: PerformanceStats | null;
  usageTrends: UsageTrends | null;
  resourceStats: ResourceStats | null;
  refreshPerformanceStats: () => Promise<void>;
  refreshUsageTrends: () => Promise<void>;
  refreshResourceStats: () => Promise<void>;

  // Loading States
  isLoading: (key: string) => boolean;

  // Error States
  getError: (key: string) => Error | null;

  // Clear Error
  clearError: (key: string) => void;
}

const DataContext = createContext<DataContextType | null>(null);

interface DataProviderProps {
  children: React.ReactNode;
  autoRefreshInterval?: number; // 自动刷新间隔（毫秒），0 表示不自动刷新
}

export const DataProvider: React.FC<DataProviderProps> = ({
  children,
  autoRefreshInterval = 0,
}) => {
  // Dashboard State
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverview | null>(null);
  const [realtimeMetrics, setRealtimeMetrics] = useState<RealtimeMetrics[]>([]);

  // System State
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  // Local Processing State
  const [localCapabilities, setLocalCapabilities] = useState<LocalCapabilities | null>(null);
  const [localConfig, setLocalConfig] = useState<LocalProcessingConfig | null>(null);
  const [localStats, setLocalStats] = useState<LocalProcessingStats | null>(null);

  // Upload State
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [uploadServers, setUploadServers] = useState<UploadServer[]>([]);

  // Remote Servers State
  const [remoteServers, setRemoteServers] = useState<RemoteServer[]>([]);

  // Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Statistics State
  const [performanceStats, setPerformanceStats] = useState<PerformanceStats | null>(null);
  const [usageTrends, setUsageTrends] = useState<UsageTrends | null>(null);
  const [resourceStats, setResourceStats] = useState<ResourceStats | null>(null);

  // Loading States
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Error States
  const [errors, setErrors] = useState<Record<string, Error>>({});

  // 自动刷新定时器引用
  const refreshTimersRef = useRef<Record<string, NodeJS.Timeout>>({});

  // 通用刷新函数
  const createRefreshFunction = useCallback((
    key: string,
    fetchFunction: () => Promise<any>,
    setState: (data: any) => void
  ) => {
    return async () => {
      setLoadingStates(prev => ({ ...prev, [key]: true }));
      try {
        const data = await fetchFunction();
        setState(data);
        setErrors(prev => {
          const { [key]: _, ...rest } = prev;
          return rest;
        });
      } catch (error) {
        setErrors(prev => ({ ...prev, [key]: error as Error }));
        console.error(`[DataContext] Error fetching ${key}:`, error);
      } finally {
        setLoadingStates(prev => ({ ...prev, [key]: false }));
      }
    };
  }, []);

  // Dashboard Refresh Functions
  const refreshDashboard = useCallback(
    createRefreshFunction('dashboard', api.dashboard.getOverview, setDashboardOverview),
    [createRefreshFunction]
  );

  const refreshMetrics = useCallback(
    async (count: number = 10) => {
      const refreshFn = createRefreshFunction(
        'metrics',
        () => api.dashboard.getRealtimeMetrics(count),
        setRealtimeMetrics
      );
      await refreshFn();
    },
    [createRefreshFunction]
  );

  // System Refresh Functions
  const refreshSystemStatus = useCallback(
    createRefreshFunction('systemStatus', api.system.getStatus, setSystemStatus),
    [createRefreshFunction]
  );

  const refreshSystemConfig = useCallback(
    createRefreshFunction('systemConfig', api.system.getConfig, setSystemConfig),
    [createRefreshFunction]
  );

  const updateSystemConfig = useCallback(async (config: SystemConfig) => {
    setLoadingStates(prev => ({ ...prev, systemConfig: true }));
    try {
      await api.system.updateConfig(config);
      setSystemConfig(config);
      setErrors(prev => {
        const { systemConfig: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      setErrors(prev => ({ ...prev, systemConfig: error as Error }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, systemConfig: false }));
    }
  }, []);

  // Local Processing Refresh Functions
  const refreshLocalCapabilities = useCallback(
    createRefreshFunction('localCapabilities', api.local.getCapabilities, setLocalCapabilities),
    [createRefreshFunction]
  );

  const refreshLocalConfig = useCallback(
    createRefreshFunction('localConfig', api.local.getConfig, setLocalConfig),
    [createRefreshFunction]
  );

  const refreshLocalStats = useCallback(
    createRefreshFunction('localStats', api.local.getStats, setLocalStats),
    [createRefreshFunction]
  );

  const updateLocalConfig = useCallback(async (config: LocalProcessingConfig) => {
    setLoadingStates(prev => ({ ...prev, localConfig: true }));
    try {
      await api.local.updateConfig(config);
      setLocalConfig(config);
      setErrors(prev => {
        const { localConfig: _, ...rest } = prev;
        return rest;
      });
    } catch (error) {
      setErrors(prev => ({ ...prev, localConfig: error as Error }));
      throw error;
    } finally {
      setLoadingStates(prev => ({ ...prev, localConfig: false }));
    }
  }, []);

  // Upload Refresh Functions
  const refreshUploadTasks = useCallback(
    createRefreshFunction('uploadTasks', api.upload.getTasks, setUploadTasks),
    [createRefreshFunction]
  );

  const refreshUploadHistory = useCallback(
    createRefreshFunction('uploadHistory', api.upload.getHistory, setUploadHistory),
    [createRefreshFunction]
  );

  const refreshUploadServers = useCallback(
    createRefreshFunction('uploadServers', api.upload.getServers, setUploadServers),
    [createRefreshFunction]
  );

  // Remote Servers Refresh Functions
  const refreshRemoteServers = useCallback(
    createRefreshFunction('remoteServers', api.remote.getServers, setRemoteServers),
    [createRefreshFunction]
  );

  // Logs Refresh Functions
  const refreshLogs = useCallback(
    createRefreshFunction('logs', api.logs.getLogs, setLogs),
    [createRefreshFunction]
  );

  // Statistics Refresh Functions
  const refreshPerformanceStats = useCallback(
    createRefreshFunction('performanceStats', api.stats.getPerformance, setPerformanceStats),
    [createRefreshFunction]
  );

  const refreshUsageTrends = useCallback(
    createRefreshFunction('usageTrends', api.stats.getTrends, setUsageTrends),
    [createRefreshFunction]
  );

  const refreshResourceStats = useCallback(
    createRefreshFunction('resourceStats', api.stats.getResources, setResourceStats),
    [createRefreshFunction]
  );

  // Loading State Helper
  const isLoading = useCallback((key: string): boolean => {
    return loadingStates[key] || false;
  }, [loadingStates]);

  // Error State Helper
  const getError = useCallback((key: string): Error | null => {
    return errors[key] || null;
  }, [errors]);

  // Clear Error
  const clearError = useCallback((key: string): void => {
    setErrors(prev => {
      const { [key]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // 自动刷新逻辑
  useEffect(() => {
    if (autoRefreshInterval > 0) {
      // 设置自动刷新定时器
      const timer = setInterval(() => {
        refreshDashboard();
        refreshMetrics();
        refreshSystemStatus();
      }, autoRefreshInterval);

      return () => clearInterval(timer);
    }
  }, [autoRefreshInterval, refreshDashboard, refreshMetrics, refreshSystemStatus]);

  // 清理定时器
  useEffect(() => {
    return () => {
      Object.values(refreshTimersRef.current).forEach(timer => {
        clearInterval(timer);
      });
    };
  }, []);

  const value: DataContextType = {
    // Dashboard
    dashboardOverview,
    realtimeMetrics,
    refreshDashboard,
    refreshMetrics,

    // System
    systemStatus,
    systemConfig,
    refreshSystemStatus,
    refreshSystemConfig,
    updateSystemConfig,

    // Local Processing
    localCapabilities,
    localConfig,
    localStats,
    refreshLocalCapabilities,
    refreshLocalConfig,
    refreshLocalStats,
    updateLocalConfig,

    // Upload
    uploadTasks,
    uploadHistory,
    uploadServers,
    refreshUploadTasks,
    refreshUploadHistory,
    refreshUploadServers,

    // Remote Servers
    remoteServers,
    refreshRemoteServers,

    // Logs
    logs,
    refreshLogs,

    // Statistics
    performanceStats,
    usageTrends,
    resourceStats,
    refreshPerformanceStats,
    refreshUsageTrends,
    refreshResourceStats,

    // Helpers
    isLoading,
    getError,
    clearError,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

/**
 * 使用数据上下文的 Hook
 */
export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within DataProvider');
  }
  return context;
};

