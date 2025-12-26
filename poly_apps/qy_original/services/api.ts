
import { MOCK_USER, MOCK_WORD_GROUPS, MOCK_WORDS_EN, MOCK_WORDS_JP, SUPPORTED_LANGUAGES, MOCK_QUIZ_QUESTIONS, MOCK_RETENTION_STATS } from './mockData';
import { User, Word, WordGroup, AppSettings, QuizQuestion, RetentionStat, CourseAnalysis } from '../types';

// Laravel API Endpoint
const API_BASE_URL = 'http://192.168.50.2:9000/api/v1';
const USE_MOCK_FALLBACK = true;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiService {
  private token: string | null = null;
  private currentLanguage: string = 'en';

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  // Generic fetch wrapper with Fallback Logic
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500); // Fast fail to mock

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-App-Language': this.currentLanguage,
          ...options.headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`API Error: ${response.status}`);
      const data = await response.json();
      return data.data;

    } catch (error) {
      console.warn(`[MockDataCenter] API unavailable for ${endpoint}. Serving mock data.`);
      if (USE_MOCK_FALLBACK) {
        return this.getMockResponse<T>(endpoint);
      }
      throw error;
    }
  }

  private async getMockResponse<T>(endpoint: string): Promise<T> {
    await delay(400); // Simulate subtle latency for realism

    if (endpoint.includes('/login')) {
      return { token: 'mock-jwt-token', user: MOCK_USER } as unknown as T;
    }
    if (endpoint === '/user/profile') return MOCK_USER as unknown as T;
    if (endpoint === '/languages') return SUPPORTED_LANGUAGES as unknown as T;
    if (endpoint === '/word-groups') {
       return MOCK_WORD_GROUPS as unknown as T;
    }
    if (endpoint.includes('/words')) {
      return (this.currentLanguage === 'jp' ? MOCK_WORDS_JP : MOCK_WORDS_EN) as unknown as T;
    }
    if (endpoint === '/quiz/generate') {
      return MOCK_QUIZ_QUESTIONS as unknown as T;
    }
    if (endpoint === '/user/stats/retention') {
      return MOCK_RETENTION_STATS as unknown as T;
    }
    if (endpoint.includes('/words/detail/')) {
        return MOCK_WORDS_EN[0] as unknown as T;
    }
    if (endpoint.includes('/analysis')) {
        // Mock Analysis
        return {
           groupId: 'g1',
           totalWords: 3000,
           knownWords: 450,
           newWords: 2550,
           estimatedDays: 128,
           similarity: 15
        } as unknown as T;
    }
    
    return {} as T;
  }

  // Public Methods
  async login(email: string, password: string) {
    return this.request<{token: string, user: User}>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  }

  async getUserProfile() {
    return this.request<User>('/user/profile');
  }

  async getSupportedLanguages() {
    return this.request('/languages');
  }

  async getWordGroups() {
    return this.request<WordGroup[]>('/word-groups');
  }

  async getWordsForGroup(groupId: string) {
    return this.request<Word[]>(`/word-groups/${groupId}/words`);
  }
  
  async getWordDetail(wordId: string) {
    return this.request<Word>(`/words/detail/${wordId}`);
  }

  async getQuizSession() {
    return this.request<QuizQuestion[]>('/quiz/generate');
  }

  async getRetentionStats() {
    return this.request<RetentionStat[]>('/user/stats/retention');
  }

  async analyzeCourse(groupId: string) {
      return this.request<CourseAnalysis>(`/word-groups/${groupId}/analysis`);
  }

  async addToLibrary(groupId: string) {
      // Mock action
      await delay(500);
      return true;
  }

  async syncSettings(settings: AppSettings) {
    console.log('Syncing settings to backend...', settings);
    return true;
  }
}

export const api = new ApiService();
