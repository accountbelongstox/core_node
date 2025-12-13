import { BaseAPI } from '../base/BaseAPI';
import { APIResponse } from '../../types';

/**
 * AppQyV1 API Module
 * 词汇学习系统 + AI工具
 */
export class AppQyV1API extends BaseAPI {
  // ========== 认证 ==========
  async register(data: { name: string; email: string; password: string; password_confirmation: string }): Promise<APIResponse> {
    return this.post('/auth/register', data);
  }

  async login(data: { email: string; password: string }): Promise<APIResponse> {
    return this.post('/auth/login', data);
  }

  async logout(): Promise<APIResponse> {
    return this.post('/auth/logout');
  }

  // ========== 翻译 ==========
  async translate(text: string, sourceLang: string, targetLang: string): Promise<APIResponse> {
    return this.post('/ai_tools/translation/translate', {
      text,
      source_lang: sourceLang,
      target_lang: targetLang
    });
  }

  async detectAndTranslate(text: string, targetLang: string): Promise<APIResponse> {
    return this.post('/ai_tools/translation/detect-translate', {
      text,
      target_lang: targetLang
    });
  }

  async getTranslationLanguages(): Promise<APIResponse> {
    return this.get('/ai_tools/translation/languages', undefined, true, 3600000); // 缓存1小时
  }

  // ========== TTS ==========
  async getVoices(): Promise<APIResponse> {
    return this.get('/ai_tools/tts/voices', undefined, true, 3600000);
  }

  async generateTTS(data: { text: string; language: string; voice?: string; speed?: number; pitch?: number }): Promise<APIResponse> {
    return this.post('/ai_tools/tts/generate', data);
  }

  // ========== 图像生成 ==========
  async generateImage(data: { prompt: string; style?: string; size?: string; quality?: string }): Promise<APIResponse> {
    return this.post('/ai_tools/image/generate', data);
  }

  // ========== 语音转文字 ==========
  async transcribeAudio(data: { audio: File; language?: string }): Promise<APIResponse> {
    const formData = new FormData();
    formData.append('audio', data.audio);
    if (data.language) {
      formData.append('language', data.language);
    }
    return this.request({ url: '/ai_tools/speech/transcribe', method: 'POST', data: formData } as any);
  }

  // ========== 词汇学习 ==========
  async getLearningWords(params: { limit?: number; library_id?: string }): Promise<APIResponse> {
    return this.get('/words/learning', params);
  }

  async getLibraries(): Promise<APIResponse> {
    return this.get('/libraries', undefined, true, 600000); // 缓存10分钟
  }

  async updateProgress(data: { word_id: string; status: string }): Promise<APIResponse> {
    return this.post('/progress/update', data);
  }

  async getStats(): Promise<APIResponse> {
    return this.get('/user/stats');
  }

  // ========== 用户 ==========
  async getUserProfile(): Promise<APIResponse> {
    return this.get('/user/profile');
  }

  async updateUserProfile(data: { displayName?: string; avatar?: string }): Promise<APIResponse> {
    return this.put('/user/profile', data);
  }

  async getUserPreferences(): Promise<APIResponse> {
    return this.get('/user/preferences');
  }

  async updateUserPreferences(data: any): Promise<APIResponse> {
    return this.put('/user/preferences', data);
  }
}
