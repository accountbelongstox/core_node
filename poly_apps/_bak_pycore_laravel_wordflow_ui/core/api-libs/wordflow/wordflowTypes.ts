/**
 * WordflowApi — self-contained type surface.
 *
 * Ported from poly_apps/qy_capacitor/{types.ts, services/languageUtils.ts,
 * config/api-endpoints.ts} so the wordflow API library has no imports from the
 * original Capacitor app directory. Only the shapes the lib actually consumes
 * are copied (data models + endpoint config types).
 */

// ---- Data models ----------------------------------------------------------

export interface Word {
  id: string;
  text: string;
  phonetic: string;
  translation: string;
  definition?: string;
  example: string;
  exampleTranslation?: string;
  masteryLevel: number; // 0-100
  lastReview?: string;
  nextReview?: string;
  tags: string[];
  audioUrl?: string;
}

export interface WordGroup {
  id: string;
  name: string;
  count: number;
  type: 'system' | 'user' | 'document';
  progress: number;
  coverImage?: string;
  language: string; // e.g., 'en', 'jp'
  description?: string;
}

export interface CourseAnalysis {
  groupId: string;
  totalWords: number;
  knownWords: number;
  newWords: number;
  estimatedDays: number;
  similarity: number; // % overlap with user memory
}

export interface QuizQuestion {
  id: string;
  wordId: string;
  question: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  type: 'meaning' | 'spelling' | 'audio';
}

export interface RetentionStat {
  level: string; // 'Critical', 'Learning', 'Mastered'
  count: number;
  color: string;
  percentage: number;
}

export interface User {
  id: string;
  name: string;
  username?: string;
  nickname?: string;
  avatar: string;
  avatar_url?: string;
  email: string;

  dailyGoal: number;
  dailyProgress: number;
  streak: number;
  totalLearned: number;
  total_words?: number;
  learned_words?: number;
  mastered_words?: number;

  selectedLanguage: string;
  learningLanguages: string[];
  learning_languages?: string[];
  native_language?: string;
  learning_stats?: any;

  isPro: boolean;
  token?: string;
}

export interface AppSettings {
  language: {
    appInterface: string | string[];
    targetLearning: string;
    translationTarget: string;
    learningLanguages?: string[];
  };
  [key: string]: any;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ---- Language utils (ported from services/languageUtils.ts) ---------------

/**
 * Infer language from word characters via Unicode ranges.
 * Returns a language code ('zh'|'ja'|'ko'|'en') or null.
 */
export function inferLanguageFromWords(words: any[]): string | null {
  if (!words || words.length === 0) return null;
  const firstWord = words[0]?.word || '';
  if (!firstWord) return null;
  if (/[一-龥]/.test(firstWord)) return 'zh';
  if (/[぀-ゟ゠-ヿ]/.test(firstWord)) return 'ja';
  if (/[가-힯]/.test(firstWord)) return 'ko';
  return 'en';
}

export interface BackendGroupData {
  gid: string;
  gname: string;
  total_words?: number;
  gwords?: any[];
  words_frequency?: Record<string, number>;
  created_at?: string;
  updated_at?: string;
  type?: 'system' | 'user' | 'document';
  progress?: number;
  language?: string;
  cover_image?: string;
  /** Live-verified /query_all_groups fields (absolute URLs). */
  cover_url?: string;
  thumbnail_url?: string;
  cover_category?: string;
  is_language_default?: boolean;
  description?: string;
}

// ---- API endpoint config (ported from config/api-endpoints.ts) ------------

export interface ApiEndpoint {
  id: string;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  priority: number;
  isLocal: boolean;
  description: string;
}

export interface ApiEndpointsConfig {
  endpoints: ApiEndpoint[];
  healthCheckInterval: number;
  timeout: number;
  retryAttempts: number;
}
