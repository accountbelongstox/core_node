
import { ApiResponse } from '../types';
import {
  SystemInfo,
  TranslationRequest,
  TranslationResponse,
  BatchTranslationRequest,
  BatchTranslationResponse,
  TTSGenerateRequest,
  TTSGenerateResponse,
  ScreenshotUploadRequest,
  ScreenshotUploadResponse,
  ScreenshotSearchRequest,
  ScreenshotSearchResponse,
  TaskCategory,
  AddTaskRequest,
  DispatchTask,
  PlaceholderGenerateRequest,
  PlaceholderResponse,
  VoiceQueueItem,
  AddVoiceQueueRequest,
  OctaneTasksStatus,
  OctaneTask,
  NginxSite,
  NginxSiteCreateRequest,
  NginxSiteConfig,
  NginxSiteUpdateRequest,
  NginxTestResponse,
  NginxReloadResponse,
  SSLCertificate,
  SSLCertificateGenerateRequest,
  SystemServiceStatus,
  SystemProcess,
  SystemStorage,
  FileNode,
  FileInfo,
  FilePreview,
  PredefinedScript,
  ScriptExecution,
  ScriptExecutionRequest,
  UnifiedApp,
  UnifiedAppDeployRequest,
  UnifiedAppStatus,
  CertbotStatus
} from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://api.nexus-orbit.io';

class ApiService {
  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const url = `${BASE_URL}${path}`;
    
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options?.headers,
      },
      ...options,
    };

    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        config.body = data;
        delete (config.headers as any)['Content-Type'];
      } else {
        config.body = JSON.stringify(data);
      }
    }

    try {
      const response = await fetch(url, config);
      const result = await response.json();
      const latency = Date.now() - start;

      return {
        success: response.ok,
        data: result.data || result,
        error: result.error,
        statusCode: response.status,
        latency,
        dataSource: 'cloud'
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Network error',
        statusCode: 0,
        latency: Date.now() - start,
        dataSource: 'cloud'
      };
    }
  }

  // ========== System Information ==========
  async getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
    return this.request<SystemInfo>('GET', '/api_info');
  }

  // ========== Translation ==========
  async translate(request: TranslationRequest): Promise<ApiResponse<TranslationResponse>> {
    return this.request<TranslationResponse>('POST', '/translation/translate', request);
  }

  async batchTranslate(request: BatchTranslationRequest): Promise<ApiResponse<BatchTranslationResponse>> {
    return this.request<BatchTranslationResponse>('POST', '/translation/batch', request);
  }

  async detectAndTranslate(text: string, targetLanguage: string): Promise<ApiResponse<TranslationResponse>> {
    return this.request<TranslationResponse>('POST', '/translation/detect', { text, target_language: targetLanguage });
  }

  async getLanguages(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('GET', '/translation/languages');
  }

  // ========== TTS ==========
  async generateTTS(request: TTSGenerateRequest): Promise<ApiResponse<TTSGenerateResponse>> {
    return this.request<TTSGenerateResponse>('POST', '/tts/generate', request);
  }

  async getVoices(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('GET', '/tts/voices');
  }

  async checkTTS(text: string, language: string, voiceType?: string): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/tts/check', { text, language, voice_type: voiceType });
  }

  // ========== MCP Screenshots ==========
  async uploadScreenshot(request: ScreenshotUploadRequest): Promise<ApiResponse<ScreenshotUploadResponse>> {
    const formData = new FormData();
    formData.append('image', request.image);
    if (request.description) formData.append('description', request.description);
    if (request.tags) formData.append('tags', JSON.stringify(request.tags));
    if (request.metadata) formData.append('metadata', JSON.stringify(request.metadata));

    return this.request<ScreenshotUploadResponse>('POST', '/api/mcp/v1/screenshots/upload', formData);
  }

  async batchUploadScreenshots(images: File[]): Promise<ApiResponse<any>> {
    const formData = new FormData();
    images.forEach((img, idx) => {
      formData.append(`images[${idx}]`, img);
    });
    return this.request<any>('POST', '/api/mcp/v1/screenshots/upload-batch', formData);
  }

  async searchScreenshots(request: ScreenshotSearchRequest): Promise<ApiResponse<ScreenshotSearchResponse>> {
    const params = new URLSearchParams();
    if (request.keyword) params.append('keyword', request.keyword);
    if (request.tags) params.append('tags', request.tags.join(','));
    if (request.start_date) params.append('start_date', request.start_date);
    if (request.end_date) params.append('end_date', request.end_date);
    if (request.limit) params.append('limit', request.limit.toString());
    if (request.offset) params.append('offset', request.offset.toString());

    return this.request<ScreenshotSearchResponse>('GET', `/api/mcp/v1/screenshots/search?${params.toString()}`);
  }

  async getScreenshots(page = 1, perPage = 20): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/mcp/v1/screenshots/?page=${page}&per_page=${perPage}`);
  }

  async getScreenshotDetail(id: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/mcp/v1/screenshots/${id}`);
  }

  async deleteScreenshot(id: string): Promise<ApiResponse<void>> {
    return this.request<void>('DELETE', `/api/mcp/v1/screenshots/${id}`);
  }

  async getScreenshotStats(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/mcp/v1/screenshots/stats');
  }

  // ========== MCP Task Dispatch ==========
  async getTaskCategories(): Promise<ApiResponse<TaskCategory[]>> {
    return this.request<TaskCategory[]>('GET', '/api/mcp/v1/task-dispatch/categories');
  }

  async createTaskCategory(name: string, description?: string): Promise<ApiResponse<TaskCategory>> {
    return this.request<TaskCategory>('POST', '/api/mcp/v1/task-dispatch/categories', { name, description });
  }

  async addTask(request: AddTaskRequest): Promise<ApiResponse<DispatchTask>> {
    return this.request<DispatchTask>('POST', '/api/mcp/v1/task-dispatch/queue/add-file', request);
  }

  async getTaskQueue(categoryId: string, status?: string, limit?: number): Promise<ApiResponse<DispatchTask[]>> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    return this.request<DispatchTask[]>('GET', `/api/mcp/v1/task-dispatch/queue/${categoryId}/tasks?${params.toString()}`);
  }

  async getQueueStats(categoryId: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/mcp/v1/task-dispatch/queue/${categoryId}/stats`);
  }

  async getPromptMappings(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('GET', '/api/mcp/v1/task-dispatch/mappings');
  }

  async updatePromptMapping(categoryId: string, promptFilePath: string, promptContent?: string): Promise<ApiResponse<any>> {
    return this.request<any>('PUT', `/api/mcp/v1/task-dispatch/mappings/${categoryId}`, {
      prompt_file_path: promptFilePath,
      prompt_content: promptContent
    });
  }

  // ========== MCP Placeholder ==========
  async generatePlaceholder(request: PlaceholderGenerateRequest): Promise<ApiResponse<PlaceholderResponse>> {
    return this.request<PlaceholderResponse>('POST', '/api/mcp/v1/placeholders/generate', request);
  }

  async getPlaceholders(): Promise<ApiResponse<any[]>> {
    return this.request<any[]>('GET', '/api/mcp/v1/placeholders/');
  }

  async getPlaceholderStats(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/mcp/v1/placeholders/stats');
  }

  // ========== MCP Voice Subtitle ==========
  async addToVoiceQueue(request: AddVoiceQueueRequest): Promise<ApiResponse<VoiceQueueItem>> {
    return this.request<VoiceQueueItem>('POST', '/api/mcp/v1/voice-subtitle/add', request);
  }

  async getVoiceQueue(): Promise<ApiResponse<VoiceQueueItem[]>> {
    return this.request<VoiceQueueItem[]>('GET', '/api/mcp/v1/voice-subtitle/queue');
  }

  async getCurrentVoiceTrack(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/mcp/v1/voice-subtitle/current');
  }

  async playNextVoice(): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/mcp/v1/voice-subtitle/next');
  }

  async playPreviousVoice(): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/mcp/v1/voice-subtitle/previous');
  }

  // ========== Octane Tasks ==========
  async getOctaneTasksStatus(): Promise<ApiResponse<OctaneTasksStatus>> {
    return this.request<OctaneTasksStatus>('GET', '/octane-tasks/status');
  }

  async getOctaneTaskDetail(taskName: string): Promise<ApiResponse<OctaneTask>> {
    return this.request<OctaneTask>('GET', `/octane-tasks/task/${taskName}`);
  }

  async getOctaneBasicObjects(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/octane-tasks/basic');
  }

  async verifyOctaneInit(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/octane-tasks/verify');
  }

  // ========== ServerManager - Nginx ==========
  async getNginxSites(): Promise<ApiResponse<NginxSite[]>> {
    return this.request<NginxSite[]>('GET', '/api/servermanager/v1/nginx/sites');
  }

  async createNginxSite(request: NginxSiteCreateRequest): Promise<ApiResponse<NginxSite>> {
    return this.request<NginxSite>('POST', '/api/servermanager/v1/nginx/sites', request);
  }

  async getNginxSiteConfig(siteName: string): Promise<ApiResponse<NginxSiteConfig>> {
    return this.request<NginxSiteConfig>('GET', `/api/servermanager/v1/nginx/config?site_name=${encodeURIComponent(siteName)}`);
  }

  async updateNginxSite(siteName: string, request: NginxSiteUpdateRequest): Promise<ApiResponse<NginxSite>> {
    return this.request<NginxSite>('PUT', `/api/servermanager/v1/nginx/sites/${encodeURIComponent(siteName)}`, request);
  }

  async enableNginxSite(siteName: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/nginx/enable', { site_name: siteName });
  }

  async disableNginxSite(siteName: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/nginx/disable', { site_name: siteName });
  }

  async testNginxConfig(): Promise<ApiResponse<NginxTestResponse>> {
    return this.request<NginxTestResponse>('POST', '/api/servermanager/v1/nginx/test');
  }

  async reloadNginx(): Promise<ApiResponse<NginxReloadResponse>> {
    return this.request<NginxReloadResponse>('POST', '/api/servermanager/v1/nginx/reload');
  }

  async deleteNginxSite(siteName: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('DELETE', `/api/servermanager/v1/nginx/sites/${encodeURIComponent(siteName)}`);
  }

  // ========== ServerManager - SSL ==========
  async getSSLCertificates(): Promise<ApiResponse<SSLCertificate[]>> {
    return this.request<SSLCertificate[]>('GET', '/api/servermanager/v1/certificate/list');
  }

  async generateSSLCertificate(request: SSLCertificateGenerateRequest): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/certificate/generate', request);
  }

  async renewSSLCertificates(all: boolean = true): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/certificate/renew', { all });
  }

  async getSSLCertificateStatus(domain: string): Promise<ApiResponse<SSLCertificate>> {
    return this.request<SSLCertificate>('GET', `/api/servermanager/v1/certificate/status?domain=${encodeURIComponent(domain)}`);
  }

  async detectCertbot(): Promise<ApiResponse<CertbotStatus>> {
    return this.request<CertbotStatus>('GET', '/api/servermanager/v1/certificates/detect-certbot');
  }

  async installCertbot(): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/certificates/install-certbot');
  }

  // ========== ServerManager - System ==========
  async getSystemInfo(): Promise<ApiResponse<SystemInfo>> {
    return this.request<SystemInfo>('GET', '/api/servermanager/v1/system/info');
  }

  async getSystemServices(): Promise<ApiResponse<SystemServiceStatus[]>> {
    return this.request<SystemServiceStatus[]>('GET', '/api/servermanager/v1/system/services');
  }

  async getSystemProcesses(): Promise<ApiResponse<SystemProcess[]>> {
    return this.request<SystemProcess[]>('GET', '/api/servermanager/v1/system/processes');
  }

  async getSystemStorage(): Promise<ApiResponse<SystemStorage[]>> {
    return this.request<SystemStorage[]>('GET', '/api/servermanager/v1/system/storage');
  }

  async getSystemPermissions(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/servermanager/v1/system/permissions');
  }

  // ========== ServerManager - File Management ==========
  async browseFiles(path?: string): Promise<ApiResponse<FileNode[]>> {
    const url = path 
      ? `/api/servermanager/v1/files/browse?path=${encodeURIComponent(path)}`
      : '/api/servermanager/v1/files/browse';
    return this.request<FileNode[]>('GET', url);
  }

  async downloadFile(filePath: string): Promise<Blob> {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.nexus-orbit.io';
    const response = await fetch(`${baseUrl}/api/servermanager/v1/files/download?file_path=${encodeURIComponent(filePath)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/octet-stream',
      },
    });
    return response.blob();
  }

  async getFileInfo(filePath: string): Promise<ApiResponse<FileInfo>> {
    return this.request<FileInfo>('GET', `/api/servermanager/v1/files/info?file_path=${encodeURIComponent(filePath)}`);
  }

  async previewFile(filePath: string, maxLines?: number): Promise<ApiResponse<FilePreview>> {
    const url = maxLines
      ? `/api/servermanager/v1/files/preview?file_path=${encodeURIComponent(filePath)}&max_lines=${maxLines}`
      : `/api/servermanager/v1/files/preview?file_path=${encodeURIComponent(filePath)}`;
    return this.request<FilePreview>('GET', url);
  }

  // ========== ServerManager - Code Executor ==========
  async listScripts(): Promise<ApiResponse<PredefinedScript[]>> {
    return this.request<PredefinedScript[]>('GET', '/api/servermanager/v1/executor/scripts');
  }

  async executeScript(request: ScriptExecutionRequest): Promise<ApiResponse<ScriptExecution>> {
    return this.request<ScriptExecution>('POST', '/api/servermanager/v1/executor/run', request);
  }

  async getExecutionLogs(executionId?: string): Promise<ApiResponse<any[]>> {
    const url = executionId
      ? `/api/servermanager/v1/executor/logs?execution_id=${executionId}`
      : '/api/servermanager/v1/executor/logs';
    return this.request<any[]>('GET', url);
  }

  async getExecutionStatus(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/servermanager/v1/executor/status');
  }

  // ========== ServerManager - Unified Manager ==========
  async getUnifiedApps(): Promise<ApiResponse<UnifiedApp[]>> {
    return this.request<UnifiedApp[]>('GET', '/api/servermanager/v1/unified/apps');
  }

  async deployUnifiedApp(request: UnifiedAppDeployRequest): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/servermanager/v1/unified/deploy', request);
  }

  async getUnifiedAppStatus(appName: string): Promise<ApiResponse<UnifiedAppStatus>> {
    return this.request<UnifiedAppStatus>('GET', `/api/servermanager/v1/unified/status?app_name=${encodeURIComponent(appName)}`);
  }

  async getUnifiedAppLogs(appName: string, lines?: number): Promise<ApiResponse<any>> {
    const url = lines
      ? `/api/servermanager/v1/unified/logs?app_name=${encodeURIComponent(appName)}&lines=${lines}`
      : `/api/servermanager/v1/unified/logs?app_name=${encodeURIComponent(appName)}`;
    return this.request<any>('GET', url);
  }
}

export const apiService = new ApiService();

