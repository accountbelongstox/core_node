
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
  OctaneTask
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
}

export const apiService = new ApiService();

