

// Data Models
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
  question: string; // e.g. "Select the correct meaning for: Serendipity"
  options: { id: string; text: string; isCorrect: boolean }[];
  type: 'meaning' | 'spelling' | 'audio';
}

export interface RetentionStat {
  level: string; // 'Critical', 'Learning', 'Mastered'
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
  action: string; // "learned 20 words", "unlocked badge"
  time: string;
  likes: number;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'promo' | 'alert';
  date: string;
}

export interface User {
  // Basic Info
  id: string;
  name: string;
  username?: string;              // Backend field
  nickname?: string;               // Backend field
  avatar: string;                  // Relative path
  avatar_url?: string;             // Full URL (from backend)
  email: string;

  // Learning Stats
  dailyGoal: number;
  dailyProgress: number;
  streak: number;
  totalLearned: number;
  total_words?: number;            // Backend field
  learned_words?: number;          // Backend field
  mastered_words?: number;         // Backend field

  // Language Settings
  selectedLanguage: string;        // Primary interface language
  learningLanguages: string[];     // Array of language codes user is learning (e.g. ['en', 'jp'])
  native_language?: string;        // Backend field
  learning_stats?: any;            // Backend field (detailed stats)

  // Account Status
  isPro: boolean;
  token?: string;                  // Auth token
}

// Playlist Specific Settings
export interface PlaylistSettings {
  wordsPerPage: number;
  playInterval: number; // seconds between words
  repeatCount: number; // times to play a word before moving next
  playbackSpeed: number; // 0.5 to 2.0
  
  // Instant Review
  instantReviewEnabled: boolean;
  instantReviewInterval: number; // e.g., every 5 words
  instantReviewBackCount: number; // jump back 3 words
  instantReviewRepeat: number; // times to play during IR
  
  // Display
  displayMode: 'simple' | 'detailed';
  largeFont: boolean;
  showAnimation: boolean;
  autoScroll: boolean;
  
  // Audio
  accent: 'US' | 'UK';
  
  // Review Mode
  reviewModeEnabled: boolean;
  reviewModeIntervalPage: number; // 0 = immediately after page
  disableIRInReview: boolean;
  
  dailyGoal: number; // Default 1000
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

// Comprehensive Settings Tree (Matches Prompt)
export interface AppSettings {
  language: {
    appInterface: string | string[]; // 'zh', 'en', etc. or ['zh', 'en'] for multi-select
    targetLearning: string; // DEPRECATED: use User.learningLanguages
    translationTarget: string; // 'zh-CN'
  };
  audio: {
    voiceEngine: 'US' | 'UK' | 'AU' | 'IN';
    speed: number; // 0.5 to 2.0
    volume: number;
    autoPlay: boolean;
    ttsProvider: 'google' | 'microsoft' | 'system';
  };
  learning: {
    dailyWordGoal: number; // 20
    dailyReviewGoal: number; // 50
    sessionSize: number; // 100
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
    reminderTime: string; // "08:00"
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
    reminderTime: "20:00",
    reviewReminder: true,
  }
};

// API Responses
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export type SupportedLanguage = {
  code: string;
  name: string;
  native_name: string;
  voice_id: string;
  has_tts: boolean;
  flag?: string;  // Optional, for backward compatibility (emoji from frontend)
  icon?: string;  // Generic icon name from backend (e.g., 'flag-usa', 'globe')
};

// Nexus / GenAI Types
export enum AppMode {
  CHAT = 'chat',
  IMAGE = 'image',
  VISION = 'vision',
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

// Added for MuseView
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  error: string | null;
}

// Added for general loading states
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  timestamp: number;
}

export interface VisionAnalysis {
  id: string;
  imageUrl: string;
  analysis: string;
  timestamp: number;
}
