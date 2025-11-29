// Voice Subtitle API Client
// Centralized HTTP request handler

class VoiceSubtitleAPI {
    constructor(config) {
        this.config = config;
        this.endpoints = config.API;
        this.localBaseUrl = config.SERVER.BASE_URL;  // Always localhost for local services
    }

    // ========== Base URL Management ==========

    getBaseUrl() {
        return this.config.getBaseUrl();
    }

    getFullUrl(endpoint, forceLocal = false) {
        const baseUrl = forceLocal ? this.localBaseUrl : this.getBaseUrl();
        const apiPrefix = forceLocal ? '' : this.config.getApiPrefix();
        return `${baseUrl}${apiPrefix}${endpoint}`;
    }

    // ========== Generic Request Methods ==========

    async get(endpoint, params = {}, forceLocal = false) {
        const url = new URL(this.getFullUrl(endpoint, forceLocal));
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        try {
            const response = await fetch(url);
            return await response.json();
        } catch (error) {
            console.error('[API Client] GET request failed:', error);
            console.error('[API Client] Failed URL:', url.toString());
            throw error;
        }
    }

    async post(endpoint, body = {}, forceLocal = false) {
        const url = this.getFullUrl(endpoint, forceLocal);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });
            return await response.json();
        } catch (error) {
            console.error('[API Client] POST request failed:', error);
            console.error('[API Client] Failed URL:', url);
            console.error('[API Client] Request body:', body);
            throw error;
        }
    }

    async postFormData(endpoint, formData, forceLocal = false) {
        const url = this.getFullUrl(endpoint, forceLocal);

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            return await response.json();
        } catch (error) {
            console.error('[API Client] POST FormData request failed:', error);
            console.error('[API Client] Failed URL:', url);
            throw error;
        }
    }

    // ========== Service Discovery ==========

    async ping() {
        try {
            return await this.get(this.endpoints.PING);
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    // ========== Queue Management ==========

    async getQueue() {
        return await this.get(this.endpoints.QUEUE);
    }

    async getLatestItems(limit = 300) {
        return await this.get(this.endpoints.QUEUE_LATEST, { limit });
    }

    async getTodayItems() {
        return await this.get(this.endpoints.QUEUE_TODAY);
    }

    async getItemsByCategory(category) {
        return await this.get(this.endpoints.QUEUE_BY_CATEGORY, { category });
    }

    async clearQueue() {
        return await this.post(this.endpoints.CLEAR_QUEUE);
    }

    async setCurrentIndex(index) {
        return await this.post(this.endpoints.SET_INDEX, { index });
    }

    async incrementPlayCount(index = null) {
        return await this.post(this.endpoints.INCREMENT_PLAY_COUNT,
            index !== null ? { index } : {}
        );
    }

    // ========== Item Management ==========

    async addText(text, langs = ['en'], category = 'normal') {
        return await this.post(this.endpoints.ADD_TEXT, { text, langs, category });
    }

    async addImage(imagePath, langs = ['en'], category = 'image') {
        return await this.post(this.endpoints.ADD_IMAGE, {
            image_path: imagePath,
            langs,
            category
        });
    }

    async addVoice(audioPath, text = null, langs = ['en'], category = 'normal') {
        return await this.post(this.endpoints.ADD_VOICE, {
            audio_path: audioPath,
            text,
            langs,
            category
        });
    }

    async removeItems(indices) {
        return await this.post(this.endpoints.REMOVE_ITEMS, { indices });
    }

    async changeItemCategory(index, category) {
        return await this.post(this.endpoints.CHANGE_CATEGORY, { index, category });
    }

    // ========== Category Management ==========

    async getCategories() {
        return await this.get(this.endpoints.CATEGORIES);
    }

    // ========== File Upload ==========

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        return await this.postFormData(this.endpoints.FILE_UPLOAD, formData);
    }

    // ========== Background Services (Always Local) ==========

    async startClipboardMonitor() {
        return await this.post(this.endpoints.CLIPBOARD_START, {}, true);  // Force local
    }

    async stopClipboardMonitor() {
        return await this.post(this.endpoints.CLIPBOARD_STOP, {}, true);  // Force local
    }

    async getClipboardStatus() {
        return await this.get(this.endpoints.CLIPBOARD_STATUS, {}, true);  // Force local
    }

    async startScreenshotMonitor(interval) {
        return await this.post(this.endpoints.SCREENSHOT_START, { interval }, true);  // Force local
    }

    async stopScreenshotMonitor() {
        return await this.post(this.endpoints.SCREENSHOT_STOP, {}, true);  // Force local
    }

    async getScreenshotStatus() {
        return await this.get(this.endpoints.SCREENSHOT_STATUS, {}, true);  // Force local
    }

    // ========== Audio URL ==========

    getAudioUrl(audioPath) {
        const baseUrl = this.getBaseUrl();
        const apiPrefix = this.config.getApiPrefix();
        return `${baseUrl}${apiPrefix}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
    }

    // ========== Code Sync ==========

    async getCodeSyncStatus() {
        return await this.get(this.endpoints.CODE_SYNC_STATUS);
    }

    async startCodeSyncServer() {
        return await this.post(this.endpoints.CODE_SYNC_START_SERVER);
    }

    async startCodeSyncClient() {
        return await this.post(this.endpoints.CODE_SYNC_START_CLIENT);
    }

    async stopCodeSync() {
        return await this.post(this.endpoints.CODE_SYNC_STOP);
    }

    async toggleBackup(enabled) {
        return await this.post(this.endpoints.CODE_SYNC_TOGGLE_BACKUP, { enabled });
    }

    // ========== Task Management (Async Operations) ==========

    async getTaskStatus(taskId) {
        const endpoint = this.endpoints.TASK_STATUS.replace('{task_id}', taskId);
        return await this.get(endpoint);
    }

    async getAllTasks(limit = 50) {
        return await this.get(this.endpoints.TASKS, { limit });
    }

    async pollTask(taskId, onProgress, interval = 1000) {
        return new Promise((resolve, reject) => {
            const poll = setInterval(async () => {
                try {
                    const task = await this.getTaskStatus(taskId);

                    if (onProgress) {
                        onProgress(task);
                    }

                    if (task.status === 'completed') {
                        clearInterval(poll);
                        resolve(task.result);
                    } else if (task.status === 'failed') {
                        clearInterval(poll);
                        reject(new Error(task.error || 'Task failed'));
                    }
                } catch (e) {
                    clearInterval(poll);
                    reject(e);
                }
            }, interval);

            // Timeout after 60 seconds
            setTimeout(() => {
                clearInterval(poll);
                reject(new Error('Task polling timeout'));
            }, 60000);
        });
    }
}


