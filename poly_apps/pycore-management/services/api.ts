<<<<<<< HEAD
/**
 * 统一 API 服务层
 * 
 * 职责：
 * - 提供类型安全的 API 调用接口
 * - 封装 API 客户端调用
 * - 支持 Mock 和真实 API 切换
 */

import { apiClient } from './api-client';
import { API_ENDPOINTS } from './endpoints';
import { DashboardOverview, RealtimeMetrics } from '../types';
import { SystemStatus, SystemConfig } from '../types';
import { LocalCapabilities, LocalProcessingConfig, LocalProcessingStats, TestRequest, TestResponse } from '../types';
import { ScreenshotRequest, ScreenshotResponse, OCRRequest, OCRResponse, AudioTranscribeRequest, AudioTranscribeResponse, VideoProcessRequest, VideoProcessResponse, FileAnalyzeRequest, FileAnalyzeResponse } from '../types';
import { UploadTask, UploadHistoryItem, UploadServer } from '../types';
import { RemoteServer } from '../types';
import { LogEntry } from '../types';
import { PerformanceStats, UsageTrends, ResourceStats } from '../types';

/**
 * 统一 API 接口
 * 所有 API 调用都通过此对象进行，支持自动回退到 Mock
 */
export const api = {
  dashboard: {
    getOverview: async (): Promise<DashboardOverview> => {
      return apiClient.get<DashboardOverview>(API_ENDPOINTS.DASHBOARD_OVERVIEW);
    },
    getRealtimeMetrics: async (count: number = 10): Promise<RealtimeMetrics[]> => {
      const endpoint = `${API_ENDPOINTS.DASHBOARD_METRICS}?count=${count}`;
      return apiClient.get<RealtimeMetrics[]>(endpoint);
    },
  },
  system: {
    getStatus: async (): Promise<SystemStatus> => {
      return apiClient.get<SystemStatus>(API_ENDPOINTS.SYSTEM_STATUS);
    },
    getConfig: async (): Promise<SystemConfig> => {
      return apiClient.get<SystemConfig>(API_ENDPOINTS.SYSTEM_CONFIG);
    },
    updateConfig: async (config: SystemConfig): Promise<boolean> => {
      return apiClient.post<boolean>(API_ENDPOINTS.SYSTEM_CONFIG_UPDATE, config);
    },
    restart: async (): Promise<{ success: boolean; message: string }> => {
      return apiClient.post(API_ENDPOINTS.SYSTEM_CONTROL_RESTART);
    },
    stop: async (): Promise<{ success: boolean; message: string }> => {
      return apiClient.post(API_ENDPOINTS.SYSTEM_CONTROL_STOP);
    },
    reloadConfig: async (): Promise<{ success: boolean; message: string }> => {
      return apiClient.post(API_ENDPOINTS.SYSTEM_CONTROL_RELOAD);
    },
    clearCache: async (): Promise<{ success: boolean; message: string }> => {
      return apiClient.post(API_ENDPOINTS.SYSTEM_CONTROL_CLEAR_CACHE);
    },
  },
  local: {
    getCapabilities: async (): Promise<LocalCapabilities> => {
      return apiClient.get<LocalCapabilities>(API_ENDPOINTS.LOCAL_CAPABILITIES);
    },
    getConfig: async (): Promise<LocalProcessingConfig> => {
      return apiClient.get<LocalProcessingConfig>(API_ENDPOINTS.LOCAL_CONFIG);
    },
    updateConfig: async (config: LocalProcessingConfig): Promise<boolean> => {
      return apiClient.post<boolean>(API_ENDPOINTS.LOCAL_CONFIG_UPDATE, config);
    },
    getStats: async (): Promise<LocalProcessingStats> => {
      return apiClient.get<LocalProcessingStats>(API_ENDPOINTS.LOCAL_STATS);
    },
    runTest: async (request: TestRequest): Promise<TestResponse> => {
      return apiClient.post<TestResponse>(API_ENDPOINTS.LOCAL_TEST, request);
    },
  },
  tools: {
    // Screenshot
    captureScreenshot: async (request: ScreenshotRequest): Promise<ScreenshotResponse> => {
      return apiClient.post<ScreenshotResponse>(API_ENDPOINTS.TOOL_SCREENSHOT, request);
    },
    screenshotWithOCR: async (request: ScreenshotRequest): Promise<ScreenshotResponse> => {
      return apiClient.post<ScreenshotResponse>(API_ENDPOINTS.TOOL_SCREENSHOT_OCR, request);
    },
    screenshotAndUpload: async (request: ScreenshotRequest): Promise<ScreenshotResponse> => {
      return apiClient.post<ScreenshotResponse>(API_ENDPOINTS.TOOL_SCREENSHOT_UPLOAD, request);
    },
    // Image Processing
    performOCR: async (request: OCRRequest): Promise<OCRResponse> => {
      return apiClient.post<OCRResponse>(API_ENDPOINTS.TOOL_IMAGE_OCR, request);
    },
    compressImage: async (request: { image_data: string; quality?: number }): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.TOOL_IMAGE_COMPRESS, request);
    },
    processImageAndUpload: async (request: any): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.TOOL_IMAGE_PROCESS_UPLOAD, request);
    },
    // Audio Processing
    transcribeAudio: async (request: AudioTranscribeRequest): Promise<AudioTranscribeResponse> => {
      return apiClient.post<AudioTranscribeResponse>(API_ENDPOINTS.TOOL_AUDIO_TRANSCRIBE, request);
    },
    generateSubtitle: async (request: AudioTranscribeRequest): Promise<AudioTranscribeResponse> => {
      return apiClient.post<AudioTranscribeResponse>(API_ENDPOINTS.TOOL_AUDIO_SUBTITLE, request);
    },
    processAudioAndUpload: async (request: AudioTranscribeRequest): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.TOOL_AUDIO_PROCESS_UPLOAD, request);
    },
    // Video Processing
    extractAudio: async (request: VideoProcessRequest): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.TOOL_VIDEO_EXTRACT_AUDIO, request);
    },
    processVideo: async (request: VideoProcessRequest): Promise<VideoProcessResponse> => {
      return apiClient.post<VideoProcessResponse>(API_ENDPOINTS.TOOL_VIDEO_SUBTITLE, request);
    },
    processVideoAndUpload: async (request: VideoProcessRequest): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.TOOL_VIDEO_PROCESS_UPLOAD, request);
    },
    // File Processing
    analyzeFile: async (request: FileAnalyzeRequest): Promise<FileAnalyzeResponse> => {
      return apiClient.post<FileAnalyzeResponse>(API_ENDPOINTS.TOOL_FILE_ANALYZE, request);
    },
    extractText: async (request: FileAnalyzeRequest): Promise<FileAnalyzeResponse> => {
      return apiClient.post<FileAnalyzeResponse>(API_ENDPOINTS.TOOL_FILE_EXTRACT_TEXT, request);
    },
    processFileAndUpload: async (request: FileAnalyzeRequest): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.TOOL_FILE_PROCESS_UPLOAD, request);
    },
  },
  upload: {
    getTasks: async (): Promise<UploadTask[]> => {
      return apiClient.get<UploadTask[]>(API_ENDPOINTS.UPLOAD_TASKS);
    },
    getProgress: async (id: string): Promise<{ progress: number; status: string }> => {
      return apiClient.get(`${API_ENDPOINTS.UPLOAD_PROGRESS}/${id}`);
    },
    cancel: async (id: string): Promise<{ success: boolean }> => {
      return apiClient.delete(`${API_ENDPOINTS.UPLOAD_CANCEL}/${id}`);
    },
    getHistory: async (): Promise<UploadHistoryItem[]> => {
      return apiClient.get<UploadHistoryItem[]>(API_ENDPOINTS.UPLOAD_HISTORY);
    },
    uploadResult: async (data: any): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.UPLOAD_RESULT, data);
    },
    batchUpload: async (data: any): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.UPLOAD_BATCH, data);
    },
    getStats: async (): Promise<any> => {
      return apiClient.get(API_ENDPOINTS.UPLOAD_STATS);
    },
    getServers: async (): Promise<UploadServer[]> => {
      return apiClient.get<UploadServer[]>(API_ENDPOINTS.UPLOAD_SERVERS);
    },
    addServer: async (server: UploadServer): Promise<UploadServer> => {
      return apiClient.post<UploadServer>(API_ENDPOINTS.UPLOAD_SERVER_ADD, server);
    },
    updateServer: async (name: string, server: Partial<UploadServer>): Promise<UploadServer> => {
      return apiClient.put<UploadServer>(`${API_ENDPOINTS.UPLOAD_SERVER_UPDATE}/${name}`, server);
    },
    deleteServer: async (name: string): Promise<{ success: boolean }> => {
      return apiClient.delete(`${API_ENDPOINTS.UPLOAD_SERVER_DELETE}/${name}`);
    },
    testServer: async (name: string): Promise<{ success: boolean; latency?: number }> => {
      return apiClient.post(`${API_ENDPOINTS.UPLOAD_SERVER_TEST}/${name}/test`);
    },
  },
  remote: {
    forward: async (data: any): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.CLIENT_FORWARD, data);
    },
    encodeRequest: async (data: any): Promise<any> => {
      return apiClient.post(API_ENDPOINTS.CLIENT_ENCODE_REQUEST, data);
    },
    getServerConfig: async (): Promise<RemoteServer[]> => {
      return apiClient.get<RemoteServer[]>(API_ENDPOINTS.CLIENT_SERVER_CONFIG);
    },
    addServer: async (server: RemoteServer): Promise<RemoteServer> => {
      return apiClient.post<RemoteServer>(API_ENDPOINTS.CLIENT_SERVER_CONFIG_ADD, server);
    },
    updateServer: async (name: string, server: Partial<RemoteServer>): Promise<RemoteServer> => {
      return apiClient.put<RemoteServer>(`${API_ENDPOINTS.CLIENT_SERVER_CONFIG_UPDATE}/${name}`, server);
    },
    deleteServer: async (name: string): Promise<{ success: boolean }> => {
      return apiClient.delete(`${API_ENDPOINTS.CLIENT_SERVER_CONFIG_DELETE}/${name}`);
    },
    getConnectionStatus: async (): Promise<any> => {
      return apiClient.get(API_ENDPOINTS.CLIENT_CONNECTION_STATUS);
    },
    testConnection: async (name: string): Promise<{ success: boolean; latency?: number }> => {
      return apiClient.post(`${API_ENDPOINTS.CLIENT_TEST_CONNECTION}/${name}`);
    },
  },
  logs: {
    getLogs: async (): Promise<LogEntry[]> => {
      return apiClient.get<LogEntry[]>(API_ENDPOINTS.LOGS);
    },
  },
  stats: {
    getPerformance: async (): Promise<PerformanceStats> => {
      return apiClient.get<PerformanceStats>(API_ENDPOINTS.STATS_PERFORMANCE);
    },
    getTrends: async (): Promise<UsageTrends> => {
      return apiClient.get<UsageTrends>(API_ENDPOINTS.STATS_TRENDS);
    },
    getResources: async (): Promise<ResourceStats> => {
      return apiClient.get<ResourceStats>(API_ENDPOINTS.STATS_RESOURCES);
    },
  },
};
=======
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
>>>>>>> 50447b58a7cf4913b20ff7875b042e6568a17522
