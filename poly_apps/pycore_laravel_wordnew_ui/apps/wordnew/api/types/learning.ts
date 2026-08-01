/** Learning-progress and daily-recitation contracts used by the active WordNew UI. */

export interface WordNewProgressEntryShort {
  fr?: string | null;
  lr?: string | null;
  lv?: string | null;
  nr?: string | null;
  rc?: number | null;
  vc?: number | null;
  wt?: number | null;
  pf?: number | null;
  aa?: string | null;
  [shortKey: string]: any;
}

export interface WordNewProgressEntry {
  first_read_at: string | null;
  last_read_at: string | null;
  last_review_at: string | null;
  next_review_at: string | null;
  read_count: number;
  review_count: number;
  weight: number;
  proficiency: number;
  added_at: string | null;
  [key: string]: any;
}

export interface WordNewGroupProgressBlob {
  gid: string;
  gname: string;
  language_code: string | null;
  total_words: number;
  legend: Record<string, string>;
  words: Record<string, WordNewProgressEntryShort>;
}

export interface WordNewGroupProgressUpdate {
  word_id: string | number;
  correct: boolean;
}

export interface GroupProgressStats {
  total_words: number;
  avg_proficiency: number;
  total_reads: number;
  total_reviews: number;
  mastered_words: number;
  learning_words: number;
  struggling_words: number;
  due_for_review: number;
}

export const WORDNEW_PROGRESS_LEGEND: Record<string, string> = {
  fr: 'first_read_at',
  lr: 'last_read_at',
  lv: 'last_review_at',
  nr: 'next_review_at',
  rc: 'read_count',
  vc: 'review_count',
  wt: 'weight',
  pf: 'proficiency',
  aa: 'added_at',
};

const WORDNEW_PROGRESS_NUMERIC_FIELDS = new Set([
  'read_count',
  'review_count',
  'weight',
  'proficiency',
]);

export function expandProgressEntry(
  entry: WordNewProgressEntryShort,
  legend?: Record<string, string>,
): WordNewProgressEntry {
  const map = legend && typeof legend === 'object' ? legend : WORDNEW_PROGRESS_LEGEND;
  const expanded: Record<string, any> = {
    first_read_at: null,
    last_read_at: null,
    last_review_at: null,
    next_review_at: null,
    read_count: 0,
    review_count: 0,
    weight: 0,
    proficiency: 0,
    added_at: null,
  };
  for (const [shortKey, value] of Object.entries(entry ?? {})) {
    const longKey = map[shortKey];
    if (!longKey) {
      expanded[shortKey] = value;
      continue;
    }
    expanded[longKey] = WORDNEW_PROGRESS_NUMERIC_FIELDS.has(longKey)
      ? Number(value ?? 0) || 0
      : value ?? null;
  }
  return expanded as WordNewProgressEntry;
}

export type WordNewRecitationAction = 'read' | 'learn' | 'review_correct' | 'review_wrong';

export interface WordNewRecitationLogWord {
  word: string;
  action: WordNewRecitationAction;
}

export interface WordNewRecitationToday {
  unique_words: number;
  actions: number;
  goal: number;
  goal_met: boolean;
}

export interface WordNewRecitationLogResult {
  logged: number;
  date: string;
  today: WordNewRecitationToday;
  replayed?: boolean;
}

export interface WordNewRecitationPlanWord {
  word: string;
  source: 'due' | 'new';
  personal: {
    read: number;
    learned: number;
    reviewed: number;
    review_time: string | null;
  };
  translation: string | null;
  phonetic: string | null;
}

export interface WordNewRecitationTodayPlan {
  date: string;
  goal: number;
  done_today: number;
  words: WordNewRecitationPlanWord[];
}

export interface WordNewRecitationSummary {
  date: string;
  unique_words: number;
  actions: number;
  goal: number;
  goal_met: boolean;
  words: Array<{ word: string; actions: WordNewRecitationAction[] }>;
}

export interface WordNewRecitationStreakDay {
  date: string;
  unique_words: number;
}

export interface WordNewRecitationStreak {
  current_streak: number;
  longest_streak: number;
  days: WordNewRecitationStreakDay[];
}

export type WordNewGroupProgressPayload =
  | ({ gid?: string } & WordNewGroupProgressUpdate & Record<string, any>)
  | { gid?: string; word_id: string | number; action: 'read'; play_time: number }
  | { gid?: string; updates: WordNewGroupProgressUpdate[] };

export interface WordNewRecitationLogPayload {
  words: WordNewRecitationLogWord[];
  language?: string;
  session_id?: string;
  batch_id?: string;
}
