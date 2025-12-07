/**
 * QY Word Learning App Types
 */

// Word Group Types
export type WordGroupType = 'document' | 'standard' | 'custom';

export interface WordGroup {
  id: string;
  name: string;
  type: WordGroupType;
  wordCount: number;
  learnedCount: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  lastLearnedAt?: string;
  tags?: string[];
}

// Word Definition
export interface WordDefinition {
  partOfSpeech: string; // n, v, adj, adv, etc.
  meaning: string;
}

// Word Example
export interface WordExample {
  sentence: string;
  translation: string;
}

// Word
export interface Word {
  id: string;
  word: string;
  phonetic?: string;
  definitions: WordDefinition[];
  examples?: WordExample[];
  difficulty?: 'easy' | 'medium' | 'hard';
  cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
}

// Memory Record
export interface MemoryRecord {
  wordId: string;
  isRead: boolean;
  readCount: number;
  correctCount: number;
  wrongCount: number;
  mastery: number; // 0-100
  firstLearnedAt: string;
  lastReviewedAt: string;
  nextReviewAt: string;
  reviewInterval: number; // days
  reviewStage: number; // 1-10
  sourceGroups: string[]; // WordGroup IDs
  notes?: string;
  tags?: string[];
  isFavorite?: boolean;
}

// User
export interface User {
  id: string;
  username: string;
  email: string;
  avatar?: string;
  createdAt: string;
}

// Statistics
export interface Statistics {
  totalWords: number;
  todayWords: number;
  streakDays: number;
  totalStudyTime: number; // seconds
  masteryRate: number; // 0-100
  todayReviewCount: number;
  overdueCount: number;
}

// Dictionary Data
export interface DictionaryData extends Word {
  synonyms?: string[];
  antonyms?: string[];
  wordForms?: {
    plural?: string;
    past?: string;
    pastParticiple?: string;
    presentParticiple?: string;
    comparative?: string;
    superlative?: string;
  };
  etymology?: string;
  frequency?: 'high' | 'medium' | 'low';
}

// Learning Settings
export interface LearningSettings {
  dailyWordGoal: number;
  dailyReviewGoal: number;
  defaultMode: 'reading' | 'card' | 'random' | 'smart';
  readingSpeed: number; // seconds per word
  readingInterval: number; // seconds
  repeatCount: number;
  instantReviewEnabled: boolean;
}

// Review Settings
export interface ReviewSettings {
  algorithm: 'ebbinghaus' | 'supermemo' | 'leitner' | 'custom';
  reminderTimes: string[]; // HH:mm format
  allowEarlyReview: boolean;
  earlyReviewDays: number;
  overdueHandling: 'accumulate' | 'separate' | 'reduce';
  completionStandard: number; // 0-100
}

// Pronunciation Settings
export interface PronunciationSettings {
  defaultEngine: 'us' | 'uk' | 'au' | 'ca' | 'in';
  speed: number; // 0.5 - 2.0
  phoneticFormat: 'ipa' | 'kk' | 'webster' | 'none';
  ttsEngine: 'system' | 'google' | 'microsoft' | 'amazon' | 'iflytek' | 'baidu';
  volume: number; // 0-100
  autoPlay: {
    onWordClick: boolean;
    onLearning: boolean;
    onExample: boolean;
    onContinuous: boolean;
  };
}

// Theme Settings
export interface ThemeSettings {
  mode: 'light' | 'dark' | 'auto';
  accentColor: string;
  eyeProtection: boolean;
  eyeProtectionSchedule?: {
    start: string; // HH:mm
    end: string; // HH:mm
  };
}

// App Settings
export interface AppSettings {
  language: string;
  theme: ThemeSettings;
  pronunciation: PronunciationSettings;
  learning: LearningSettings;
  review: ReviewSettings;
  notifications: {
    dailyReminder: boolean;
    reviewReminder: boolean;
    achievementNotification: boolean;
    doNotDisturb: boolean;
    doNotDisturbSchedule?: {
      start: string;
      end: string;
    };
  };
  dataSync: {
    autoSync: boolean;
    syncFrequency: 'realtime' | 'hourly' | 'daily';
    wifiOnly: boolean;
  };
}

