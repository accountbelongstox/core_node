import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * AppQyV1 API Module
 * Vocabulary learning system + AI tools
 */
export class AppQyV1API extends BaseAPI {
  // ========== Authentication ==========
  async register(data: { username: string; password: string; email?: string; nickname?: string; name?: string; registration_code?: string }): Promise<APIResponse> {
    return this.post('/register', data);
  }

  async login(data: { username: string; password: string }): Promise<APIResponse> {
    return this.post('/login', data);
  }

  async logout(): Promise<APIResponse> {
    return this.post('/logout');
  }

  async getCurrentUser(): Promise<APIResponse> {
    return this.get('/user');
  }

  async registerWithCode(data: { registration_code: string; referral_source?: string }): Promise<APIResponse> {
    return this.post('/register-code', data);
  }

  // ========== Translation ==========
  /**
   * Translate text. Accepts EITHER positional args
   * `translate(text, sourceLang, targetLang)` (AppQyV1Model / legacy callers)
   * OR a single payload object — the universal `ToolModel.execute()` dispatch
   * always calls `apiModule.method(input)` with one object, so the AI Tools
   * Translation form and VocabularyLearning pass `{ text, sourceLang?,
   * source_lang?, source_language?, targetLang?, target_lang?,
   * target_language?, type? }`. Without this both live paths silently posted
   * `{ text: <object>, source_lang: undefined }` and never translated.
   */
  async translate(
    textOrPayload: string | Record<string, any>,
    sourceLang?: string,
    targetLang?: string
  ): Promise<APIResponse> {
    let body: Record<string, any>;

    if (typeof textOrPayload === 'string') {
      body = {
        text: textOrPayload,
        source_lang: sourceLang,
        target_lang: targetLang
      };
    } else {
      const p = textOrPayload || {};
      body = {
        text: p.text,
        source_lang: p.source_lang ?? p.sourceLang ?? p.source_language,
        target_lang: p.target_lang ?? p.targetLang ?? p.target_language
      };
      if (p.type !== undefined) body.type = p.type;
      if (p.options !== undefined) body.options = p.options;
    }

    return this.post('/ai_tools/translation/translate', body);
  }

  async detectAndTranslate(text: string, targetLang: string): Promise<APIResponse> {
    return this.post('/ai_tools/translation/detect-translate', {
      text,
      target_lang: targetLang
    });
  }

  async getTranslationLanguages(): Promise<APIResponse> {
    return this.get('/ai_tools/translation/languages', undefined, true, 3600000); // Cache 1 hour
  }

  // ========== TTS ==========
  async getTTSLanguages(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/languages', undefined, true, 3600000);
  }

  async getTTSVoices(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/voices', undefined, true, 3600000);
  }

  async getTTSOptions(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/options', undefined, true, 3600000);
  }

  async generateTTS(data: { text: string; language: string; type?: string; options?: any }): Promise<APIResponse> {
    return this.post('/ai_tools/tts/generate', data);
  }

  async batchGenerateTTS(items: Array<{ text: string; language: string; type?: string; options?: any }>): Promise<APIResponse> {
    return this.post('/ai_tools/tts/batch-generate', { items });
  }

  // ========== TTS Queue Management ==========
  async getTTSQueueStats(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/queue/stats', undefined, false); // No cache, real-time data
  }

  async checkTTSQueueStatus(word: string, language: string): Promise<APIResponse> {
    return this.get('/ai_tools/tts/queue/status', { word, language });
  }

  async queueBatchTTS(words: Array<{ word: string; language: string; priority?: number }>): Promise<APIResponse> {
    return this.post('/ai_tools/tts/queue_batch', { words });
  }

  // ========== Image Generation ==========
  async generateImage(data: { prompt: string; style?: string; size?: string; quality?: string }): Promise<APIResponse> {
    return this.post('/ai_tools/image/generate', data);
  }

  // ========== Speech-to-Text ==========
  async transcribeAudio(data: { audio: File; language?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('audio', data.audio);
    if (data.language) {
      formData.append('language', data.language);
    }
    return this.request({ url: '/ai_tools/speech/transcribe', method: 'POST', data: formData } as any);
  }

  // ========== Vocabulary Learning ==========
  async getLearningWords(params: { limit?: number; library_id?: string }): Promise<APIResponse> {
    return this.get('/learning/words', params);
  }

  async getLibraryWords(libraryId: number, params?: { page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get(`/vocabulary/libraries/${libraryId}/words`, params);
  }

  async getLibraries(params?: { language?: string; category?: string; difficulty?: string; search?: string; page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/libraries', params, true, 600000); // Cache 10 minutes
  }

  async getRecommendedLibraries(params?: { language?: string; limit?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/libraries/recommended', params, true, 600000); // Cache 10 minutes
  }

  async getVocabularyStatistics(params?: { language?: string; include_words?: boolean | number; page?: number; per_page?: number }): Promise<APIResponse> {
    return this.get('/vocabulary/statistics', params, false);
  }

  async updateProgress(data: { word_id: string; status: string }): Promise<APIResponse> {
    return this.post('/learning/progress', data);
  }

  async getStats(): Promise<APIResponse> {
    return this.get('/user/stats');
  }

  async updateWordReview(wordId: string, data: { correct: boolean; reviewDate: string }): Promise<APIResponse> {
    return this.post(`/words/${wordId}/review`, data);
  }

  // ========== Document Processing ==========
  async uploadDocument(formData: FormData): Promise<APIResponse> {
    return this.request({ url: '/learning/upload', method: 'POST', data: formData } as any);
  }

  async extractSentences(documentId: string): Promise<APIResponse> {
    return this.post(`/vocabulary/document/${documentId}/extract-sentences`);
  }

  async extractWords(documentId: string): Promise<APIResponse> {
    return this.post(`/vocabulary/document/${documentId}/extract-words`);
  }

  // ========== System Initialization ==========
  async getInitializationStatus(): Promise<APIResponse> {
    return this.get('/system/initialization-status');
  }

  async getDictionaryStatistics(): Promise<APIResponse> {
    return this.get('/system/dictionary-statistics', undefined, true, 300000);
  }

  async initializeSystem(): Promise<APIResponse> {
    return this.post('/system/initialize');
  }

  async getSupportedLanguages(): Promise<APIResponse> {
    return this.get('/system/supported-languages', undefined, true, 3600000); // Cache 1 hour
  }

  async completeUserInit(data: {
    learning_languages: string[];
    occupation?: string;
    daily_words_target: number;
    daily_study_time: number;
    preferences: any;
  }): Promise<APIResponse> {
    return this.post('/user/initialize', data);
  }

  // ========== Export Features ==========
  async exportToCSV(options: any): Promise<APIResponse> {
    return this.post('/vocabulary/export/csv', options);
  }

  async exportToJSON(options: any): Promise<APIResponse> {
    return this.post('/vocabulary/export/json', options);
  }

  async exportToAnki(options: any): Promise<APIResponse> {
    return this.post('/vocabulary/export/anki', options);
  }

  async exportToPDF(options: any): Promise<APIResponse> {
    return this.post('/vocabulary/export/pdf', options);
  }

  async exportToText(options: any): Promise<APIResponse> {
    return this.post('/vocabulary/export/text', options);
  }

  // ========== User ==========
  async getUserProfile(): Promise<APIResponse> {
    return this.get('/user/profile');
  }

  async updateUserProfile(data: { nickname?: string; name?: string; bio?: string; location?: string; avatar?: string }): Promise<APIResponse> {
    return this.put('/user/profile', data);
  }

  async getUserPreferences(): Promise<APIResponse> {
    return this.get('/user/preferences');
  }

  async updateUserPreferences(data: any): Promise<APIResponse> {
    return this.put('/user/preferences', data);
  }
}
