import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * McpV1 API Module
 * MCP manager - screenshots, tasks, prompts, etc.
 */
export class McpV1API extends BaseAPI {
  // ========== Screenshot Management ==========
  async getScreenshots(page: number = 1, limit: number = 20): Promise<APIResponse> {
    return this.get('/screenshots', { page, limit });
  }

  async uploadScreenshot(data: { image: File; description?: string; keywords?: string[]; id?: string; replace?: boolean }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.description) formData.append('description', data.description);
    if (data.keywords) formData.append('keywords', JSON.stringify(data.keywords));
    if (data.id) formData.append('id', data.id);
    if (data.replace !== undefined) formData.append('replace', String(data.replace));

    return this.request({
      url: '/screenshots/upload',
      method: 'POST',
      data: formData
    } as any);
  }

  async deleteScreenshot(id: string): Promise<APIResponse> {
    return this.delete(`/screenshots/${id}`);
  }

  async searchScreenshots(params: { query?: string; page?: number; limit?: number }): Promise<APIResponse> {
    return this.get('/screenshots/search', params);
  }

  async getScreenshotStats(): Promise<APIResponse> {
    return this.get('/screenshots/stats');
  }

  async getLatestScreenshot(): Promise<APIResponse> {
    return this.get('/screenshots/latest');
  }

  async clearAllScreenshots(): Promise<APIResponse> {
    return this.delete('/screenshots/clear-all/confirm');
  }

  // ========== Task Management ==========
  async getTaskCategories(): Promise<APIResponse> {
    return this.get('/task-dispatch/categories', undefined, true, 600000);
  }

  async getTaskQueue(categoryId: string): Promise<APIResponse> {
    return this.get(`/task-dispatch/queue/${categoryId}/tasks`);
  }

  async getQueueStats(categoryId: string): Promise<APIResponse> {
    return this.get(`/task-dispatch/queue/${categoryId}/stats`);
  }

  async addTask(data: { category_id: string; content: string; file_name?: string; priority?: number }): Promise<APIResponse> {
    return this.post('/task-dispatch/queue/add-file', data);
  }

  async searchTasks(categoryId: string, query: string): Promise<APIResponse> {
    return this.get(`/task-dispatch/queue/${categoryId}/search`, { query });
  }

  async createTaskCategory(name: string): Promise<APIResponse> {
    return this.post('/task-dispatch/categories', { name });
  }

  async getCategoryFiles(categoryId: string): Promise<APIResponse> {
    return this.get(`/task-dispatch/categories/${categoryId}/files`);
  }

  async updateTaskStatus(categoryId: string, taskId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed'): Promise<APIResponse> {
    return this.put(`/task-dispatch/queue/${categoryId}/tasks/${taskId}/status`, { status });
  }

  async deleteTask(categoryId: string, taskId: string): Promise<APIResponse> {
    return this.delete(`/task-dispatch/queue/${categoryId}/tasks/${taskId}`);
  }

  async getLastTask(categoryId: string): Promise<APIResponse> {
    return this.get(`/task-dispatch/queue/${categoryId}/last-task`);
  }

  async hasLatestTask(categoryId: string): Promise<APIResponse> {
    return this.get(`/task-dispatch/queue/${categoryId}/has-latest`);
  }

  async getAllTaskMappings(): Promise<APIResponse> {
    return this.get('/task-dispatch/mappings');
  }

  async resetCategoryMapping(categoryId: string): Promise<APIResponse> {
    return this.post(`/task-dispatch/mappings/${categoryId}/reset`, {});
  }

  async deleteCategoryMapping(categoryId: string): Promise<APIResponse> {
    return this.delete(`/task-dispatch/mappings/${categoryId}`);
  }

  // ========== Prompt Management ==========
  async getPromptMappings(): Promise<APIResponse> {
    return this.get('/task-dispatch/mappings');
  }

  async updatePromptMapping(categoryId: string, promptFilePath: string, promptContent?: string): Promise<APIResponse> {
    return this.put(`/task-dispatch/mappings/${categoryId}`, {
      prompt_file_path: promptFilePath,
      prompt_content: promptContent
    });
  }

  // ========== Placeholder Generator ==========
  async getPlaceholders(): Promise<APIResponse> {
    return this.get('/placeholders');
  }

  async generatePlaceholder(data: {
    width: number;
    height: number;
    text?: string;
    bg_color?: string;
    text_color?: string;
    format?: 'png' | 'jpg' | 'svg' | 'webp';
    mode?: 'simple' | 'real';
  }): Promise<APIResponse> {
    return this.post('/placeholders/generate', data);
  }

  async deletePlaceholder(uuid: string): Promise<APIResponse> {
    return this.delete(`/placeholders/${uuid}`);
  }

  async getPlaceholderStats(): Promise<APIResponse> {
    return this.get('/placeholders/stats');
  }

  async cleanupPlaceholders(): Promise<APIResponse> {
    return this.post('/placeholders/cleanup', {});
  }

  // ========== OCR Recognition ==========
  async ocrRecognize(data: { image: File; engine?: string; model_type?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    if (data.engine) formData.append('engine', data.engine);
    // Optional language-targeted model hint (general|scene|doc|number|english|
    // chinese_traditional); the controller falls back to 'general' when absent.
    if (data.model_type) formData.append('model_type', data.model_type);
    return this.request({ url: '/ocr/recognize', method: 'POST', data: formData } as any);
  }

  async ocrSmartRecognize(data: { image: File }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('image', data.image);
    return this.request({ url: '/ocr/smart-recognize', method: 'POST', data: formData } as any);
  }

  async ocrBatch(data: { images: File[] }): Promise<APIResponse> {
    const formData = new FormData();
    data.images.forEach((image) => {
      formData.append('images[]', image);
    });
    return this.request({ url: '/ocr/batch', method: 'POST', data: formData } as any);
  }

  async getOcrEngines(): Promise<APIResponse> {
    return this.get('/ocr/engines', undefined, true, 3600000); // Cache 1 hour
  }

  async getOcrEngineInfo(engine: string): Promise<APIResponse> {
    // Backend reads `model_type` (general/scene/doc/number/english/chinese_traditional),
    // not `engine`. Send the param under the name the controller actually reads.
    return this.get('/ocr/engine-info', { model_type: engine });
  }

  // ========== Voice Subtitle (voice subtitle queue) ==========
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

  async uploadMerge(data: { images: File[]; descriptions?: string[]; keyword?: string; id?: string; replace?: boolean }): Promise<APIResponse> {
    const formData = new FormData();
    data.images.forEach((image) => {
      formData.append('images[]', image);
    });
    if (data.descriptions) formData.append('descriptions', JSON.stringify(data.descriptions));
    if (data.keyword) formData.append('keyword', data.keyword);
    if (data.id) formData.append('id', data.id);
    if (data.replace !== undefined) formData.append('replace', String(data.replace));
    return this.request({ url: '/screenshots/upload-merge', method: 'POST', data: formData } as any);
  }

  async uploadBatch(data: { images: File[]; descriptions?: string[]; keyword?: string }): Promise<APIResponse> {
    const formData = new FormData();
    data.images.forEach((image) => {
      formData.append('images[]', image);
    });
    if (data.descriptions) formData.append('descriptions', JSON.stringify(data.descriptions));
    if (data.keyword) formData.append('keyword', data.keyword);
    return this.request({ url: '/screenshots/upload-batch', method: 'POST', data: formData } as any);
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

  // ========== Static Resources (static resource management) ==========

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
   *
   * Backward-compatible: `targetPath` and `relativePaths` are optional. When
   * provided, `target_path` selects the destination directory and `file_paths[]`
   * carries each file's relative path (preserving folder structure on upload).
   *
   * When `onProgress` is supplied, the upload runs via XMLHttpRequest so upload
   * progress (0-100) can be reported. When absent, the original `fetch` path is
   * used unchanged (backward compatible).
   */
  async uploadStaticResources(
    files: File[],
    targetPath: string = '',
    relativePaths?: string[],
    onProgress?: (percent: number) => void
  ): Promise<APIResponse> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        // `files[]` (not `files`) so Laravel's $request->file('files') receives
        // the whole array — a repeated bare `files` key keeps only the last file.
        formData.append('files[]', file);
      });

      if (targetPath) {
        formData.append('target_path', targetPath);
      }

      if (relativePaths) {
        relativePaths.forEach((relativePath) => {
          formData.append('file_paths[]', relativePath);
        });
      }

      const url = `${this.baseURL}/static-resources/upload`;

      // Progress-aware path: XMLHttpRequest exposes upload progress events that
      // fetch cannot. Builds the SAME FormData/headers/endpoint as the fetch path.
      if (onProgress) {
        return await new Promise<APIResponse>((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open('POST', url);

          // Apply the module's auth/custom headers. Do NOT set Content-Type —
          // the browser sets the multipart boundary from the FormData body.
          Object.entries(this.headers).forEach(([key, value]) => {
            xhr.setRequestHeader(key, value);
          });

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            const ok = xhr.status >= 200 && xhr.status < 300;
            let parsed: any = null;
            try {
              const json = JSON.parse(xhr.responseText);
              parsed = json && json.data !== undefined ? json.data : json;
              resolve({
                success: ok,
                data: ok ? parsed : (json && json.data) || json,
                error: ok ? null : (json && json.error) || 'Upload failed',
                status: xhr.status
              });
            } catch {
              resolve({
                success: ok,
                data: ok ? xhr.responseText : null,
                error: ok ? null : 'Upload failed',
                status: xhr.status
              });
            }
          };

          xhr.onerror = () => {
            resolve({
              success: false,
              data: null,
              error: 'Network error',
              status: xhr.status || 0
            });
          };

          xhr.send(formData);
        });
      }

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

  /**
   * Read a static file's content (text or base64 for binary)
   */
  async getStaticFileContent(path: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/static-resources/read-file?path=${encodeURIComponent(path)}`;

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
   * Write/save a static file's content
   */
  async saveStaticFileContent(path: string, content: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/static-resources/write-file`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path, content })
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Save failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Save error',
        status: 0
      };
    }
  }

  /**
   * Create a directory under a static-resources parent path
   */
  async createStaticResourceDir(parentPath: string, dirName: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/static-resources/create-directory`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_path: parentPath, dir_name: dirName })
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Create directory failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Create directory error',
        status: 0
      };
    }
  }

  /**
   * Rename a static resource (file or directory)
   */
  async renameStaticResource(oldPath: string, newName: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/static-resources/rename`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: oldPath, new_name: newName })
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Rename failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Rename error',
        status: 0
      };
    }
  }

  /**
   * Preview what would be deleted for a static resource path
   */
  async deleteStaticResourcePreview(path: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/static-resources/delete-preview`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Delete preview failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Delete preview error',
        status: 0
      };
    }
  }

  /**
   * Delete a static resource (file or directory)
   */
  async deleteStaticResource(path: string): Promise<APIResponse> {
    try {
      const url = `${this.baseURL}/static-resources/delete`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { ...this.headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ path })
      });

      const data = await response.json();

      return {
        success: response.ok,
        data: data.data || data,
        error: response.ok ? null : data.error || 'Delete failed',
        status: response.status
      };
    } catch (error: any) {
      return {
        success: false,
        data: null,
        error: error.message || 'Delete error',
        status: 0
      };
    }
  }

  /**
   * Get download URL for a static file (forces attachment via download=1)
   */
  getStaticFileDownloadUrl(path: string): string {
    return `${this.baseURL}/static-resources/stream-file?path=${encodeURIComponent(path)}&download=1`;
  }
}
