/* [v4.1-Iris] Wf achievement center — the single derivation of achievements
 * from REAL learning counters. Achievements are not a backend entity yet, so
 * every page must derive them from the same definitions here (previously
 * WordNewProfileProfilePage hardcoded 6 always-on badges while WordNewMineSocialPage /
 * WordNewSocialLeaderboardPage each kept a private 4-badge copy — three sources of
 * truth, one of them fabricated). Inputs map from either /user/statistics or a
 * leaderboard entry via the helpers below; no fabricated progress values. */

import type { LucideIcon } from 'lucide-react';
import { Sunrise, BookOpen, Flame, Globe2, Zap, CalendarCheck, Trophy, Sparkles } from 'lucide-react';

/** Real counters an achievement can be judged against. All optional — pages
 *  pass what their data source actually has; missing inputs simply leave the
 *  related achievements locked at 0 progress. */
export interface WordNewAchievementInput {
  /** Words in 'learning' (or learned) state. */
  learned?: number;
  /** Words mastered. */
  mastered?: number;
  /** Total tracked words. */
  total?: number;
  /** Current daily streak (days). */
  streak?: number;
  /** Distinct study days, all time. */
  studyDays?: number;
}

export interface WordNewAchievement {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
}

/** Clamped progress against a target (never fabricates beyond the counter). */
const toward = (value: number, target: number) => Math.max(0, Math.min(target, value));

/**
 * Derive the full achievement set from real counters. Order is display order:
 * starts with the early wins, ends with the long-haul badges.
 */
export function deriveAchievements(input: WordNewAchievementInput): WordNewAchievement[] {
  const learned = input.learned ?? 0;
  const mastered = input.mastered ?? 0;
  const total = input.total ?? 0;
  const streak = input.streak ?? 0;
  const studyDays = input.studyDays ?? 0;
  const known = learned + mastered;

  return [
    {
      id: 'first_steps', name: 'First Steps', description: 'Learn your first word',
      icon: Sunrise, unlocked: known >= 1, progress: toward(known, 1), maxProgress: 1,
    },
    {
      id: 'word_collector', name: 'Word Collector', description: 'Learn 50 words',
      icon: BookOpen, unlocked: known >= 50, progress: toward(known, 50), maxProgress: 50,
    },
    {
      id: 'vocabulary_builder', name: 'Vocabulary Builder', description: 'Track 100 words',
      icon: Globe2, unlocked: total >= 100, progress: toward(total, 100), maxProgress: 100,
    },
    {
      id: 'master_mind', name: 'Master Mind', description: 'Master 10 words',
      icon: Flame, unlocked: mastered >= 10, progress: toward(mastered, 10), maxProgress: 10,
    },
    {
      id: 'week_streak', name: '7-Day Streak', description: 'Study 7 days in a row',
      icon: Zap, unlocked: streak >= 7, progress: toward(streak, 7), maxProgress: 7,
    },
    {
      id: 'dedicated', name: 'Dedicated', description: 'Study on 30 different days',
      icon: CalendarCheck, unlocked: studyDays >= 30, progress: toward(studyDays, 30), maxProgress: 30,
    },
    {
      id: 'word_champion', name: 'Word Champion', description: 'Master 100 words',
      icon: Trophy, unlocked: mastered >= 100, progress: toward(mastered, 100), maxProgress: 100,
    },
    {
      id: 'polyglot_path', name: 'Polyglot Path', description: 'Track 500 words',
      icon: Sparkles, unlocked: total >= 500, progress: toward(total, 500), maxProgress: 500,
    },
  ];
}

/** Map a /user/statistics payload (snake_case superset) to derivation input. */
export function statsToAchievementInput(stats: any): WordNewAchievementInput {
  if (!stats || typeof stats !== 'object') return {};
  return {
    learned: stats.learning_words ?? stats.total_words_learned ?? 0,
    mastered: stats.mastered_words ?? 0,
    total: stats.total_words ?? 0,
    streak: stats.current_streak ?? 0,
    studyDays: stats.study_days ?? 0,
  };
}

/** Map a social leaderboard entry (the current user's row) to derivation input. */
export function leaderEntryToAchievementInput(entry: any): WordNewAchievementInput {
  if (!entry || typeof entry !== 'object') return {};
  return {
    learned: entry.learned_words ?? 0,
    mastered: entry.mastered_words ?? 0,
    total: entry.total_words ?? 0,
  };
}
