import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MOCK_ACTIVITIES,
  MOCK_ACHIEVEMENTS,
  MOCK_FRIENDS,
  MOCK_LEADERBOARD,
  MOCK_QUIZ_QUESTIONS,
  MOCK_RETENTION_STATS,
  MOCK_USER,
  MOCK_WORDS_EN,
  MOCK_WORDS_JP,
  MOCK_WORD_GROUPS,
  SUPPORTED_LANGUAGES,
} from './mockData';
import {
  ActivityLog,
  AppSettings,
  CourseAnalysis,
  Friend,
  LeaderboardUser,
  QuizQuestion,
  RetentionStat,
  User,
  Word,
  WordGroup,
} from '../models/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class ApiService {
  private token: string | null = null;
  private currentLanguage: string = 'en';

  setToken(token: string) {
    this.token = token;
    AsyncStorage.setItem('auth_token', token).catch(() => {});
  }

  setLanguage(lang: string) {
    this.currentLanguage = lang;
  }

  private async withLatency<T>(data: T): Promise<T> {
    await delay(200);
    return data;
  }

  async login(email: string, password: string) {
    const user: User = { ...MOCK_USER, email, token: 'mock-token' };
    this.setToken('mock-token');
    return this.withLatency({ token: 'mock-token', user });
  }

  async getUserProfile() {
    return this.withLatency<User>(MOCK_USER);
  }

  async getSupportedLanguages() {
    return this.withLatency(SUPPORTED_LANGUAGES);
  }

  async getWordGroups() {
    return this.withLatency<WordGroup[]>(MOCK_WORD_GROUPS);
  }

  async getWordsForGroup(groupId: string) {
    return this.withLatency<Word[]>(
      this.currentLanguage === 'jp' ? MOCK_WORDS_JP : MOCK_WORDS_EN,
    );
  }

  async getWordDetail(wordId: string) {
    const all = [...MOCK_WORDS_EN, ...MOCK_WORDS_JP];
    const found = all.find(w => w.id === wordId) || MOCK_WORDS_EN[0];
    return this.withLatency(found);
  }

  async getQuizSession() {
    return this.withLatency<QuizQuestion[]>(MOCK_QUIZ_QUESTIONS);
  }

  async getRetentionStats() {
    return this.withLatency<RetentionStat[]>(MOCK_RETENTION_STATS);
  }

  async analyzeCourse(groupId: string) {
    return this.withLatency<CourseAnalysis>({
      groupId,
      totalWords: 3000,
      knownWords: 450,
      newWords: 2550,
      estimatedDays: 128,
      similarity: 15,
    });
  }

  async addToLibrary(groupId: string) {
    return this.withLatency(true);
  }

  async syncSettings(settings: AppSettings) {
    console.log('Syncing settings (mock only)', settings);
    return this.withLatency(true);
  }

  async getLeaderboard() {
    return this.withLatency<LeaderboardUser[]>(MOCK_LEADERBOARD);
  }

  async getFriends() {
    return this.withLatency<Friend[]>(MOCK_FRIENDS);
  }

  async getActivities() {
    return this.withLatency<ActivityLog[]>(MOCK_ACTIVITIES);
  }
}

export const api = new ApiService();
