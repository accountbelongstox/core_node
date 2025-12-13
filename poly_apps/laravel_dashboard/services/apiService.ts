
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

const getDefaultBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    return `${protocol}//${hostname}:9000`;
  }
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:9000';
};

const DEFAULT_BASE_URL = getDefaultBaseUrl();

class ApiService {
  private baseUrl: string = DEFAULT_BASE_URL;
  private apiKey: string | undefined = undefined;

  // Method to update base URL and API key from context
  public setConfig(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(
    method: string,
    path: string,
    data?: any,
    options?: RequestInit
  ): Promise<ApiResponse<T>> {
    const start = Date.now();
    const url = `${this.baseUrl}${path}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options?.headers,
    };

    // Add API Key if available
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const config: RequestInit = {
      method,
      headers,
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
  async getApiInfo(): Promise<ApiResponse<SystemInfo>> {
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
    return this.request<SSLCertificate[]>('GET', '/api/servermanager/v1/certificates/');
  }

  async generateSSLCertificate(request: SSLCertificateGenerateRequest): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/certificates/generate', request);
  }

  async renewSSLCertificates(all: boolean = true): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request<{ success: boolean; message: string }>('POST', '/api/servermanager/v1/certificates/renew', { all });
  }

  async getSSLCertificateStatus(domain: string): Promise<ApiResponse<SSLCertificate>> {
    return this.request<SSLCertificate>('GET', `/api/servermanager/v1/certificates/status?domain=${encodeURIComponent(domain)}`);
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
  async browseFiles(path?: string): Promise<ApiResponse<ServerFileNode[]>> {
    const url = path 
      ? `/api/servermanager/v1/files/browse?path=${encodeURIComponent(path)}`
      : '/api/servermanager/v1/files/browse';
    return this.request<ServerFileNode[]>('GET', url);
  }

  async downloadFile(filePath: string): Promise<Blob> {
    const headers: HeadersInit = {
      'Accept': 'application/octet-stream',
    };
    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }
    const response = await fetch(`${this.baseUrl}/api/servermanager/v1/files/download?file_path=${encodeURIComponent(filePath)}`, {
      method: 'GET',
      headers,
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

  // ========== API Info ==========
  async getFullApiInfo(app?: string): Promise<ApiResponse<FullApiInfo>> {
    const url = app ? `/api_info?app=${app}` : '/api_info';
    return this.request<FullApiInfo>('GET', url);
  }

  // ========== Static Resources ==========
  async getStaticResourcesTree(path?: string): Promise<ApiResponse<FileNode[]>> {
    const url = path
      ? `/static-resources/file-tree?path=${encodeURIComponent(path)}`
      : '/static-resources/file-tree';
    const response = await this.request<any>('GET', url);

    if (response.success && response.data && 'items' in response.data) {
      return {
        ...response,
        data: response.data.items
      };
    }

    return response;
  }

  async uploadStaticResources(files: FileList): Promise<ApiResponse<any>> {
    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('files', file);
    });
    return this.request<any>('POST', '/static-resources/upload', formData);
  }

  // ========== AppQyV1 - User Authentication ==========
  async appQyV1Register(data: { name: string; email: string; password: string; password_confirmation: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/register', data);
  }

  async appQyV1Login(data: { email: string; password: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/login', data);
  }

  async appQyV1Logout(): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/logout');
  }

  async appQyV1GetUser(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/user');
  }

  async appQyV1ForgotPassword(data: { email: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/forgot-password', data);
  }

  async appQyV1ResetPassword(data: { token: string; email: string; password: string; password_confirmation: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/reset-password', data);
  }

  // ========== AppQyV1 - System ==========
  async appQyV1SystemInitialize(): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/system/initialize');
  }

  async appQyV1InitializationStatus(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/system/initialization-status');
  }

  async appQyV1ProcessVocabulary(): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/system/process-vocabulary');
  }

  async appQyV1VocabularyStatus(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/system/vocabulary-status');
  }

  async appQyV1DictionaryStatistics(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/system/dictionary-statistics');
  }

  async appQyV1GetSupportedLanguages(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/system/supported-languages');
  }

  async appQyV1GetLanguageDetails(code: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/dict/v1/system/supported-languages/${code}`);
  }

  // ========== AppQyV1 - Vocabulary Libraries ==========
  async appQyV1GetRecommendedLibraries(params?: { language?: string; limit?: number }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params?.language) query.append('language', params.language);
    if (params?.limit) query.append('limit', params.limit.toString());
    const url = query.toString() ? `/api/dict/v1/vocabulary/libraries/recommended?${query}` : '/api/dict/v1/vocabulary/libraries/recommended';
    return this.request<any>('GET', url);
  }

  async appQyV1GetVocabularyLibraries(params?: { page?: number; per_page?: number; language?: string; category?: string; difficulty?: string; search?: string }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.per_page) query.append('per_page', params.per_page.toString());
    if (params?.language) query.append('language', params.language);
    if (params?.category) query.append('category', params.category);
    if (params?.difficulty) query.append('difficulty', params.difficulty);
    if (params?.search) query.append('search', params.search);
    const url = query.toString() ? `/api/dict/v1/vocabulary/libraries?${query}` : '/api/dict/v1/vocabulary/libraries';
    return this.request<any>('GET', url);
  }

  async appQyV1DeleteLibrary(libraryId: string): Promise<ApiResponse<any>> {
    return this.request<any>('DELETE', `/api/dict/v1/learning/libraries/${libraryId}`);
  }

  // ========== AppQyV1 - Learning ==========
  async appQyV1GetLearningLanguages(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/learning/languages');
  }

  async appQyV1SetLearningLanguages(data: { languages: string[] }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/learning/languages', data);
  }

  async appQyV1GetUserLibraries(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/learning/libraries');
  }

  async appQyV1SelectLibrary(data: { library_id: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/learning/libraries/select', data);
  }

  async appQyV1GetRecommendations(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/learning/recommendations');
  }

  async appQyV1SelectCollection(data: { collection_id: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/learning/collections/select', data);
  }

  async appQyV1GetSelectedCollections(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/learning/collections/selected');
  }

  async appQyV1GetLearningWords(params?: { limit?: number; offset?: number }): Promise<ApiResponse<any>> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.offset) query.append('offset', params.offset.toString());
    const url = query.toString() ? `/api/dict/v1/learning/words?${query}` : '/api/dict/v1/learning/words';
    return this.request<any>('GET', url);
  }

  async appQyV1UpdateProgress(data: { word_id: string; status: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/learning/progress', data);
  }

  async appQyV1GetLearningStats(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/learning/stats');
  }

  async appQyV1UploadDocument(file: File): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append('file', file);
    return this.request<any>('POST', '/api/dict/v1/learning/upload', formData);
  }

  // ========== AppQyV1 - Words ==========
  async appQyV1GetDailyWord(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/words/daily');
  }

  async appQyV1GetWordDetails(id: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/words/${id}`);
  }

  async appQyV1MarkWordLearned(id: string): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/words/${id}/learn`);
  }

  async appQyV1MarkWordReview(id: string): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/words/${id}/review`);
  }

  async appQyV1ToggleFavorite(id: string): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/words/${id}/favorite`);
  }

  async appQyV1SearchWord(query: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/words/search/${encodeURIComponent(query)}`);
  }

  async appQyV1PublicWordQuery(word: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/words/public/${encodeURIComponent(word)}`);
  }

  async appQyV1EnhancedWordQuery(word: string): Promise<ApiResponse<any>> {
    return this.request<any>('GET', `/api/dict/v1/word/${encodeURIComponent(word)}/enhanced`);
  }

  // ========== AppQyV1 - Untranslated Words ==========
  async appQyV1GetUntranslatedWords(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/untranslated');
  }

  async appQyV1GetUntranslatedByPriority(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/untranslated/priority');
  }

  async appQyV1SubmitTranslation(word: string, data: { translation: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/dict/v1/word/${encodeURIComponent(word)}/translation`, data);
  }

  async appQyV1SubmitAudio(word: string, data: { audio: string }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/dict/v1/word/${encodeURIComponent(word)}/audio`, data);
  }

  async appQyV1SubmitImages(word: string, data: { images: string[] }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/dict/v1/word/${encodeURIComponent(word)}/images`, data);
  }

  async appQyV1SubmitCompleteData(word: string, data: any): Promise<ApiResponse<any>> {
    return this.request<any>('POST', `/api/dict/v1/word/${encodeURIComponent(word)}/complete`, data);
  }

  // ========== AppQyV1 - User Initialization ==========
  async appQyV1GetUserInitStatus(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/dict/v1/user/initialization-status');
  }

  async appQyV1CompleteUserInit(data: { learning_languages: string[]; occupation?: string; daily_words_target?: number; daily_study_time?: number; preferences?: any }): Promise<ApiResponse<any>> {
    return this.request<any>('POST', '/api/dict/v1/user/initialize', data);
  }

  // ========== AppQyV1 - User Profile ==========
  async appQyV1GetUserProgress(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/user/progress');
  }

  async appQyV1GetUserStats(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/user/stats');
  }

  async appQyV1GetUserProfile(): Promise<ApiResponse<any>> {
    return this.request<any>('GET', '/api/user/profile');
  }

  async appQyV1UpdateUserProfile(data: { displayName?: string; avatar?: string }): Promise<ApiResponse<any>> {
    return this.request<any>('PUT', '/api/user/profile', data);
  }
}

export const apiService = new ApiService();

