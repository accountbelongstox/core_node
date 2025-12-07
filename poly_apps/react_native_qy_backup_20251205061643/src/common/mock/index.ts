/**
 * Mock Data Center
 * Provides mock data when API is unavailable
 */

import { WordGroup, Word, MemoryRecord, User, Statistics, DictionaryData } from '@/qy/qy_types';

// Mock Word Groups
export const mockWordGroups: WordGroup[] = [
  {
    id: '1',
    name: 'CoCo 60000',
    type: 'standard',
    wordCount: 100,
    learnedCount: 25,
    reviewCount: 10,
    createdAt: new Date('2024-01-01').toISOString(),
    updatedAt: new Date('2024-12-01').toISOString(),
  },
  {
    id: '2',
    name: '四六级词库',
    type: 'standard',
    wordCount: 500,
    learnedCount: 150,
    reviewCount: 30,
    createdAt: new Date('2024-02-01').toISOString(),
    updatedAt: new Date('2024-12-01').toISOString(),
  },
  {
    id: '3',
    name: '托福词汇',
    type: 'standard',
    wordCount: 300,
    learnedCount: 80,
    reviewCount: 20,
    createdAt: new Date('2024-03-01').toISOString(),
    updatedAt: new Date('2024-12-01').toISOString(),
  },
];

// Mock Words
export const mockWords: Word[] = [
  {
    id: '1',
    word: 'vocabulary',
    phonetic: '/vəˈkæbjəˌlɛri/',
    definitions: [
      { partOfSpeech: 'n', meaning: '词汇；词汇量；词表' },
    ],
    examples: [
      { sentence: 'He has a large vocabulary.', translation: '他词汇量很大。' },
    ],
    difficulty: 'medium',
    cefrLevel: 'B2',
  },
  {
    id: '2',
    word: 'study',
    phonetic: '/ˈstʌdi/',
    definitions: [
      { partOfSpeech: 'v', meaning: '学习；研究' },
      { partOfSpeech: 'n', meaning: '学习；书房' },
    ],
    examples: [
      { sentence: 'I study English every day.', translation: '我每天学习英语。' },
    ],
    difficulty: 'easy',
    cefrLevel: 'A1',
  },
  {
    id: '3',
    word: 'comprehensive',
    phonetic: '/ˌkɑmprɪˈhensɪv/',
    definitions: [
      { partOfSpeech: 'adj', meaning: '全面的；综合的' },
    ],
    examples: [
      { sentence: 'This is a comprehensive guide.', translation: '这是一本全面的指南。' },
    ],
    difficulty: 'hard',
    cefrLevel: 'C1',
  },
];

// Mock Memory Records
export const mockMemoryRecords: MemoryRecord[] = [
  {
    wordId: '1',
    isRead: true,
    readCount: 5,
    correctCount: 3,
    wrongCount: 2,
    mastery: 60,
    firstLearnedAt: new Date('2024-11-01').toISOString(),
    lastReviewedAt: new Date('2024-12-01').toISOString(),
    nextReviewAt: new Date('2024-12-03').toISOString(),
    reviewInterval: 2,
    sourceGroups: ['1'],
    notes: '',
    tags: [],
    isFavorite: false,
  },
  {
    wordId: '2',
    isRead: true,
    readCount: 10,
    correctCount: 8,
    wrongCount: 2,
    mastery: 80,
    firstLearnedAt: new Date('2024-10-01').toISOString(),
    lastReviewedAt: new Date('2024-12-01').toISOString(),
    nextReviewAt: new Date('2024-12-08').toISOString(),
    reviewInterval: 7,
    sourceGroups: ['1', '2'],
    notes: '',
    tags: [],
    isFavorite: true,
  },
];

// Mock User
export const mockUser: User = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  avatar: '',
  createdAt: new Date('2024-01-01').toISOString(),
};

// Mock Statistics
export const mockStatistics: Statistics = {
  totalWords: 1000,
  todayWords: 20,
  streakDays: 30,
  totalStudyTime: 3600,
  masteryRate: 75,
  todayReviewCount: 50,
  overdueCount: 10,
};

// Mock Dictionary Data
export const mockDictionaryData: DictionaryData = {
  wordId: '1',
  word: 'vocabulary',
  phonetic: '/vəˈkæbjəˌlɛri/',
  definitions: [
    { partOfSpeech: 'n', meaning: '词汇；词汇量；词表' },
  ],
  examples: [
    { sentence: 'He has a large vocabulary.', translation: '他词汇量很大。' },
  ],
  synonyms: ['lexicon', 'wordbook'],
  antonyms: [],
  wordForms: {
    plural: 'vocabularies',
  },
  etymology: 'From Latin vocabulum',
  frequency: 'high',
  difficulty: 'medium',
  cefrLevel: 'B2',
};

/**
 * Get mock data by key
 */
export const getMockData = <T>(key: string): T | null => {
  const mockDataMap: Record<string, any> = {
    'wordGroups': mockWordGroups,
    'words': mockWords,
    'memoryRecords': mockMemoryRecords,
    'user': mockUser,
    'statistics': mockStatistics,
    'dictionary': mockDictionaryData,
  };
  
  return mockDataMap[key] || null;
};

/**
 * Mock API delay
 */
export const mockDelay = (ms: number = 500): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Mock API response
 */
export const mockApiResponse = <T>(data: T, success: boolean = true, delay: number = 500) => {
  return mockDelay(delay).then(() => ({
    success,
    data,
    message: success ? 'Success' : 'Error',
  }));
};

