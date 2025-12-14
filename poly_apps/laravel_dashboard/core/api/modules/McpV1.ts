import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * McpV1 API Module
 * MCP 管理器 - 截图、任务、提示词等
 */
export class McpV1API extends BaseAPI {
  // ========== 截图管理 ==========
  async getScreenshots(page: number = 1, limit: number = 20): Promise<APIResponse> {
    return this.get('/screenshots', { page, limit });
  }

  async uploadScreenshot(data: { image: File; description?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.description) {
      formData.append('description', data.description);
    }

    // 特殊处理FormData
    return this.request({
      url: '/screenshots/upload',
      method: 'POST',
      data: formData,
      headers: {
        // 移除Content-Type，让浏览器自动设置
      }
    } as any);
  }

  async deleteScreenshot(id: string): Promise<APIResponse> {
    return this.delete(`/screenshots/${id}`);
  }

  // ========== 任务管理 ==========
  async getTaskCategories(): Promise<APIResponse> {
    return this.get('/tasks/categories', undefined, true, 600000);
  }

  async getTaskQueue(categoryId: string): Promise<APIResponse> {
    return this.get(`/tasks/queue/${categoryId}`);
  }

  async addTask(data: { category_id: string; content: string; priority?: number }): Promise<APIResponse> {
    return this.post('/tasks', data);
  }

  async executeTask(taskId: string): Promise<APIResponse> {
    return this.post(`/tasks/${taskId}/execute`);
  }

  // ========== 提示词管理 ==========
  async getPromptMappings(): Promise<APIResponse> {
    return this.get('/prompt-mappings');
  }

  async updatePromptMapping(categoryId: string, promptFilePath: string, promptContent?: string): Promise<APIResponse> {
    return this.put(`/prompt-mappings/${categoryId}`, {
      prompt_file_path: promptFilePath,
      prompt_content: promptContent
    });
  }

  // ========== Placeholder生成器 ==========
  async generatePlaceholder(data: {
    width: number;
    height: number;
    text?: string;
    bgColor?: string;
    textColor?: string;
    format?: 'png' | 'jpg' | 'svg' | 'webp';
  }): Promise<APIResponse> {
    return this.post('/placeholder/generate', data);
  }

  // ========== OCR 识别 ==========
  async ocrRecognize(data: { image: File; engine?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.engine) formData.append('engine', data.engine);
    return this.request({ url: '/ocr/recognize', method: 'POST', data: formData } as any);
  }

  async ocrSmartRecognize(data: { image: File }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    return this.request({ url: '/ocr/smart-recognize', method: 'POST', data: formData } as any);
  }

  async ocrBatch(data: { images: File[] }): Promise<APIResponse> {
    const formData = new FormData();
    data.images.forEach((image, index) => {
      formData.append(`images[${index}]`, image);
    });
    return this.request({ url: '/ocr/batch', method: 'POST', data: formData } as any);
  }

  async getOcrEngines(): Promise<APIResponse> {
    return this.get('/ocr/engines', undefined, true, 3600000); // Cache 1 hour
  }

  async getOcrEngineInfo(engine: string): Promise<APIResponse> {
    return this.get('/ocr/engine-info', { engine });
  }

  // ========== Voice Subtitle (语音字幕队列) ==========
  async vsAddToQueue(data: { type: 'text' | 'image' | 'voice'; content: any; group?: string; category?: string }): Promise<APIResponse> {
    return this.post('/voice-subtitle/add', data);
  }

  async vsAddText(data: { text: string; language?: string; group?: string }): Promise<APIResponse> {
    return this.post('/voice-subtitle/add-text', data);
  }

  async vsAddImage(data: { image: File; description?: string; group?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.description) formData.append('description', data.description);
    if (data.group) formData.append('group', data.group);
    return this.request({ url: '/voice-subtitle/add-image', method: 'POST', data: formData } as any);
  }

  async vsAddVoice(data: { voice: File; title?: string; group?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('voice', data.voice);
    if (data.title) formData.append('title', data.title);
    if (data.group) formData.append('group', data.group);
    return this.request({ url: '/voice-subtitle/add-voice', method: 'POST', data: formData } as any);
  }

  async vsGetQueue(params?: { page?: number; limit?: number }): Promise<APIResponse> {
    return this.get('/voice-subtitle/queue', params);
  }

  async vsGetQueueLatest(): Promise<APIResponse> {
    return this.get('/voice-subtitle/queue/latest');
  }

  async vsGetQueueToday(): Promise<APIResponse> {
    return this.get('/voice-subtitle/queue/filter-by-today');
  }

  async vsGetQueueByCategory(category: string): Promise<APIResponse> {
    return this.get('/voice-subtitle/queue/filter-by-category', { category });
  }

  async vsGetQueueByGroup(group?: string): Promise<APIResponse> {
    const url = group ? `/voice-subtitle/queue/group/${group}` : '/voice-subtitle/queue/group';
    return this.get(url);
  }

  async vsGetCurrent(): Promise<APIResponse> {
    return this.get('/voice-subtitle/current');
  }

  async vsNext(): Promise<APIResponse> {
    return this.post('/voice-subtitle/next');
  }

  async vsPrevious(): Promise<APIResponse> {
    return this.post('/voice-subtitle/previous');
  }

  async vsSetIndex(index: number): Promise<APIResponse> {
    return this.post('/voice-subtitle/set-index', { index });
  }

  async vsRemoveItem(id: string): Promise<APIResponse> {
    return this.request({
      url: '/voice-subtitle/remove',
      method: 'DELETE',
      data: { id }
    } as any);
  }

  async vsRemoveItems(ids: string[]): Promise<APIResponse> {
    return this.post('/voice-subtitle/remove-items', { ids });
  }

  async vsClearQueue(): Promise<APIResponse> {
    return this.delete('/voice-subtitle/clear');
  }

  async vsIncrementPlayCount(id: string): Promise<APIResponse> {
    return this.post('/voice-subtitle/increment-play-count', { id });
  }

  async vsGetStats(): Promise<APIResponse> {
    return this.get('/voice-subtitle/stats');
  }

  async vsServeAudio(filename: string): Promise<APIResponse> {
    return this.get(`/voice-subtitle/audio/${filename}`);
  }

  async vsUpdateItemGroup(data: { id: string; group: string }): Promise<APIResponse> {
    return this.post('/voice-subtitle/update-group', data);
  }

  async vsGetAllGroups(): Promise<APIResponse> {
    return this.get('/voice-subtitle/groups', undefined, true, 300000); // Cache 5 minutes
  }

  async vsGetCategories(): Promise<APIResponse> {
    return this.get('/voice-subtitle/categories', undefined, true, 300000); // Cache 5 minutes
  }

  async vsListTasks(): Promise<APIResponse> {
    return this.get('/voice-subtitle/tasks');
  }

  async vsDeleteTasks(taskIds: string[]): Promise<APIResponse> {
    return this.post('/voice-subtitle/tasks/delete', { task_ids: taskIds });
  }

  async vsGetTaskStatus(taskId: string): Promise<APIResponse> {
    return this.get(`/voice-subtitle/tasks/${taskId}`);
  }

  async vsGetUserSettings(): Promise<APIResponse> {
    return this.get('/voice-subtitle/settings');
  }

  async vsUpdateUserSettings(settings: any): Promise<APIResponse> {
    return this.post('/voice-subtitle/settings', settings);
  }

  async vsGetSupportedLanguages(): Promise<APIResponse> {
    return this.get('/voice-subtitle/languages', undefined, true, 3600000); // Cache 1 hour
  }

  async vsPing(): Promise<APIResponse> {
    return this.get('/voice-subtitle/ping');
  }

  // ========== Static Resources (静态资源管理) ==========

  /**
   * Get static resources file tree
   * Note: Static resources are at root level, bypassing /api/mcp/v1 prefix
   */
  async getStaticResourcesTree(path?: string): Promise<APIResponse> {
    try {
      const url = path
        ? `${this.baseURL}/static-resources/file-tree?path=${encodeURIComponent(path)}`
        : `${this.baseURL}/static-resources/file-tree`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Request failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Network error',
        status: 0
      };
    }
  }

  /**
   * Upload static resources
   */
  async uploadStaticResources(files: File[]): Promise<APIResponse> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const url = `${this.baseURL}/static-resources/upload`;

      const response = await fetch(url, {
        method: 'POST',
        headers: this.headers,
        body: formData
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Upload failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Upload error',
        status: 0
      };
    }
  }

  /**
   * Get streaming URL for static file
   */
  getStaticFileStreamUrl(path: string): string {
    return `${this.baseURL}/static-resources/stream-file?path=${encodeURIComponent(path)}`;
  }
}
