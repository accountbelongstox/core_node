import * as mockService from './mockService';

// This is the unified API surface.
// In the future, we can swap mockService for a real axios/fetch implementation
// without changing the frontend code.

export const api = {
  dashboard: {
    getOverview: mockService.getDashboardOverview,
    getRealtimeMetrics: mockService.getRealtimeMetrics,
  },
  system: {
    getStatus: mockService.getSystemStatus,
    getConfig: mockService.getSystemConfig,
    updateConfig: mockService.updateSystemConfig,
  },
  local: {
    getCapabilities: mockService.getLocalCapabilities,
    getConfig: mockService.getLocalConfig,
    updateConfig: mockService.updateLocalConfig,
  },
  upload: {
    getTasks: mockService.getUploadTasks,
    getHistory: mockService.getUploadHistory,
    getServers: mockService.getUploadServers,
  },
  remote: {
    getServers: mockService.getRemoteServers,
  },
  logs: {
    getLogs: mockService.getLogs,
  },
  stats: {
      getPerformance: mockService.getPerformanceStats,
      getTrends: mockService.getUsageTrends,
      getResources: mockService.getResourceStats,
  }
};