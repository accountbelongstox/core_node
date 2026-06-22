import { api } from '../api';
import { BaseModel } from './BaseModel';

/**
 * AppQyV1 Model - Vocabulary learning system + AI tools
 * Uses namespaces to organize the different feature modules
 */
export class AppQyV1Model extends BaseModel {
  private static instance: AppQyV1Model;

  private constructor() {
    super();
  }

  static getInstance(): AppQyV1Model {
    if (!AppQyV1Model.instance) {
      AppQyV1Model.instance = new AppQyV1Model();
    }
    return AppQyV1Model.instance;
  }

  // ========== Auth namespace ==========
  auth = {
    register: (data: { username: string; password: string; email?: string; nickname?: string; name?: string; registration_code?: string }) =>
      this.execute(api.appQyV1.register(data)),

    login: (username: string, password: string) =>
      this.execute(api.appQyV1.login({ username, password })),

    logout: () =>
      this.execute(api.appQyV1.logout()),

    getCurrentUser: () =>
      this.execute(api.appQyV1.getCurrentUser()),

    registerWithCode: (code: string, referralSource?: string) =>
      this.execute(api.appQyV1.registerWithCode({ registration_code: code, referral_source: referralSource }))
  };

  // ========== AI Tools namespace ==========
  aiTools = {
    // Translation
    translation: {
      translate: (text: string, sourceLang: string, targetLang: string) =>
        this.execute(api.appQyV1.translate(text, sourceLang, targetLang)),

      detectAndTranslate: (text: string, targetLang: string) =>
        this.execute(api.appQyV1.detectAndTranslate(text, targetLang)),

      getLanguages: () =>
        this.execute(api.appQyV1.getTranslationLanguages())
    },

    // Text-to-Speech
    tts: {
      getLanguages: () =>
        this.execute(api.appQyV1.getTTSLanguages()),

      getVoices: () =>
        this.execute(api.appQyV1.getTTSVoices()),

      getOptions: () =>
        this.execute(api.appQyV1.getTTSOptions()),

      generate: (text: string, language: string, options?: { type?: string; voice?: string; speed?: number; pitch?: number }) =>
        this.execute(api.appQyV1.generateTTS({ text, language, ...options })),

      batchGenerate: (items: Array<{ text: string; language: string; type?: string; options?: any }>) =>
        this.execute(api.appQyV1.batchGenerateTTS(items))
    },

    // Image Generation
    image: {
      generate: (prompt: string, options?: { style?: string; size?: string; quality?: string }) =>
        this.execute(api.appQyV1.generateImage({ prompt, ...options }))
    },

    // Speech-to-Text
    speech: {
      transcribe: (audio: File, language?: string) =>
        this.execute(api.appQyV1.transcribeAudio({ audio, language }))
    }
  };

  // ========== Vocabulary namespace ==========
  vocabulary = {
    // Libraries
    libraries: {
      list: (params?: { language?: string; category?: string; difficulty?: string; search?: string; page?: number; per_page?: number }) =>
        this.execute(api.appQyV1.getLibraries(params)),

      recommended: (language?: string, limit?: number) =>
        this.execute(api.appQyV1.getRecommendedLibraries({ language, limit })),

      statistics: () =>
        this.execute(api.appQyV1.getVocabularyStatistics())
    },

    // Learning
    learning: {
      getWords: (libraryId?: string, limit?: number) =>
        this.execute(api.appQyV1.getLearningWords({ library_id: libraryId, limit })),

      updateProgress: (wordId: string, status: string) =>
        this.execute(api.appQyV1.updateProgress({ word_id: wordId, status })),

      review: (wordId: string, correct: boolean, reviewDate: string) =>
        this.execute(api.appQyV1.updateWordReview(wordId, { correct, reviewDate }))
    },

    // User Stats
    stats: () =>
      this.execute(api.appQyV1.getStats())
  };

  // ========== System namespace ==========
  system = {
    getLanguages: () =>
      this.execute(api.appQyV1.get('/system/supported-languages', undefined, true, 3600000)),

    getConfig: () =>
      this.execute(api.appQyV1.get('/system/config', undefined, true, 600000))
  };

  // Legacy method aliases for backward compatibility (deprecated)
  login = this.auth.login;
  logout = this.auth.logout;
  translate = this.aiTools.translation.translate;
  generateTTS = this.aiTools.tts.generate;
  getLibraries = this.vocabulary.libraries.list;
}

export const appQyV1Model = AppQyV1Model.getInstance();
