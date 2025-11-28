// Voice Subtitle API Client
// Centralized HTTP request handler

class VoiceSubtitleAPI {
    constructor(config) {
        this.baseUrl = config.SERVER.BASE_URL;
        this.endpoints = config.API;
    }

    // ========== Generic Request Methods ==========

    async get(endpoint, params = {}) {
        const url = new URL(this.baseUrl + endpoint);
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

        const response = await fetch(url);
        return await response.json();
    }

    async post(endpoint, body = {}) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body)
        });
        return await response.json();
    }

    async postFormData(endpoint, formData) {
        const response = await fetch(this.baseUrl + endpoint, {
            method: 'POST',
            body: formData
        });
        return await response.json();
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

    // ========== Background Services ==========

    async startClipboardMonitor() {
        return await this.post(this.endpoints.CLIPBOARD_START);
    }

    async stopClipboardMonitor() {
        return await this.post(this.endpoints.CLIPBOARD_STOP);
    }

    async getClipboardStatus() {
        return await this.get(this.endpoints.CLIPBOARD_STATUS);
    }

    async startScreenshotMonitor(interval) {
        return await this.post(this.endpoints.SCREENSHOT_START, { interval });
    }

    async stopScreenshotMonitor() {
        return await this.post(this.endpoints.SCREENSHOT_STOP);
    }

    async getScreenshotStatus() {
        return await this.get(this.endpoints.SCREENSHOT_STATUS);
    }

    // ========== Audio URL ==========

    getAudioUrl(audioPath) {
        return `${this.baseUrl}${this.endpoints.AUDIO}?path=${encodeURIComponent(audioPath)}`;
    }
}
