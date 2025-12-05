// Shared data models mirroring the original web project
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
  language: string;
  description?: string;
}

export interface CourseAnalysis {
  groupId: string;
  totalWords: number;
  knownWords: number;
  newWords: number;
  estimatedDays: number;
  similarity: number;
}

export interface QuizQuestion {
  id: string;
  wordId: string;
  question: string;
  options: { id: string; text: string; isCorrect: boolean }[];
  type: 'meaning' | 'spelling' | 'audio';
}

export interface RetentionStat {
  level: string;
  count: number;
  color: string;
  percentage: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

export interface LeaderboardUser {
  rank: number;
  name: string;
  avatar: string;
  xp: number;
  isCurrentUser: boolean;
}

export interface Friend {
  id: string;
  name: string;
  avatar: string;
  status: 'online' | 'offline' | 'studying';
  lastActive: string;
  streak: number;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  action: string;
  time: string;
  likes: number;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  email: string;
  dailyGoal: number;
  dailyProgress: number;
  streak: number;
  totalLearned: number;
  isPro: boolean;
  token?: string;
  selectedLanguage: string;
  learningLanguages: string[];
}

export interface PlaylistSettings {
  wordsPerPage: number;
  playInterval: number;
  repeatCount: number;
  playbackSpeed: number;
  instantReviewEnabled: boolean;
  instantReviewInterval: number;
  instantReviewBackCount: number;
  instantReviewRepeat: number;
  displayMode: 'simple' | 'detailed';
  largeFont: boolean;
  showAnimation: boolean;
  autoScroll: boolean;
  accent: 'US' | 'UK';
  reviewModeEnabled: boolean;
  reviewModeIntervalPage: number;
  disableIRInReview: boolean;
  dailyGoal: number;
}

export const DEFAULT_PLAYLIST_SETTINGS: PlaylistSettings = {
  wordsPerPage: 50,
  playInterval: 2,
  repeatCount: 1,
  playbackSpeed: 1.0,
  instantReviewEnabled: true,
  instantReviewInterval: 5,
  instantReviewBackCount: 3,
  instantReviewRepeat: 1,
  displayMode: 'detailed',
  largeFont: false,
  showAnimation: true,
  autoScroll: true,
  accent: 'US',
  reviewModeEnabled: true,
  reviewModeIntervalPage: 0,
  disableIRInReview: true,
  dailyGoal: 1000,
};

export interface AppSettings {
  language: {
    appInterface: string;
    targetLearning: string;
    translationTarget: string;
  };
  audio: {
    voiceEngine: 'US' | 'UK' | 'AU' | 'IN';
    speed: number;
    volume: number;
    autoPlay: boolean;
    ttsProvider: 'google' | 'microsoft' | 'system';
  };
  learning: {
    dailyWordGoal: number;
    dailyReviewGoal: number;
    sessionSize: number;
    mode: 'reading' | 'card' | 'random';
    autoAdvance: boolean;
    instantReviewEnabled: boolean;
  };
  display: {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    showPhonetic: boolean;
    showTranslation: boolean;
    enableAnimations: boolean;
  };
  notifications: {
    dailyReminder: boolean;
    reminderTime: string;
    reviewReminder: boolean;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: {
    appInterface: 'zh',
    targetLearning: 'en',
    translationTarget: 'zh',
  },
  audio: {
    voiceEngine: 'US',
    speed: 1.0,
    volume: 0.8,
    autoPlay: true,
    ttsProvider: 'google',
  },
  learning: {
    dailyWordGoal: 20,
    dailyReviewGoal: 50,
    sessionSize: 20,
    mode: 'reading',
    autoAdvance: false,
    instantReviewEnabled: true,
  },
  display: {
    theme: 'light',
    fontSize: 'medium',
    showPhonetic: true,
    showTranslation: true,
    enableAnimations: true,
  },
  notifications: {
    dailyReminder: true,
    reminderTime: '20:00',
    reviewReminder: true,
  },
};

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export type SupportedLanguage = {
  code: string;
  name: string;
  flag: string;
  ttsCode: string;
};
