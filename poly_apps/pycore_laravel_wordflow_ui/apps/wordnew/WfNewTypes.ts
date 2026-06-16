export interface Word {
  id: string;
  text: string;
  phonetic: string;
  translation: string;
  definition?: string;
  example?: string;
  masteryLevel?: number; // 0 - 100
  tags?: string[];
}

export interface WordGroup {
  id: string;
  name: string;
  language?: string;
  count: number;
  progress?: number;
  type?: string;
  description?: string;
}

export interface ElementTheme {
  id: string;
  nameEn: string;
  nameZh: string;
  bgClass: string;
  cardClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  accentText: string;
  accentBg: string;
  borderClass: string;
  glowClass: string;
  inputClass: string;
}

export interface UserStats {
  learned: number;
  streak: number;
  dailyGoal: number;
  dailyProgress: number;
}
