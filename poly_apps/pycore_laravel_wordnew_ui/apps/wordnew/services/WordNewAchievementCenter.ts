/* [v4.1-Iris] Wf achievement center — the single derivation of achievements
 * from REAL learning counters. Achievements are not a backend entity yet, so
 * every page must derive them from the same definitions here (previously
 * WordNewProfileProfilePage hardcoded 6 always-on badges while WordNewMineSocialPage /
 * WordNewSocialLeaderboardPage each kept a private 4-badge copy — three sources of
 * truth, one of them fabricated). Inputs map from either /user/statistics or a
 * leaderboard entry via the helpers below; no fabricated progress values. */

import type { LucideIcon } from 'lucide-react';
import { Sunrise, BookOpen, Flame, Globe2, Zap, CalendarCheck, Trophy, Sparkles, Sprout, Rocket, Star, Crown, Gem } from 'lucide-react';

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

// --- Member level tier ladder ------------------------------------------------
// Data-driven: a score from real counters (learned words + streak) places the
// user on a tier. Each tier carries a distinct lucide icon + accent gradient so
// the level banner is visually unique per tier (not a generic chip).
export interface WordNewMemberTier {
  /** Tier id → localized name via trans('profile.tier.<id>'). */
  id: string;
  /** Numeric level shown as "Lv. N". */
  level: number;
  Icon: LucideIcon;
  /** Per-tier accent gradient (Tailwind from/to) for the banner + ring. */
  gradient: string;
  /** Ring/stroke + text accent color. */
  accent: string;
  /** Score needed to reach this tier. */
  min: number;
}

const MEMBER_TIERS: WordNewMemberTier[] = [
  { id: 'seedling', level: 1, Icon: Sprout, gradient: 'from-emerald-500/30 to-teal-500/10', accent: 'text-emerald-300', min: 0 },
  { id: 'voyager', level: 2, Icon: Rocket, gradient: 'from-sky-500/30 to-indigo-500/10', accent: 'text-sky-300', min: 50 },
  { id: 'stellar', level: 3, Icon: Star, gradient: 'from-indigo-500/30 to-purple-500/10', accent: 'text-indigo-300', min: 150 },
  { id: 'nova', level: 4, Icon: Gem, gradient: 'from-fuchsia-500/30 to-pink-500/10', accent: 'text-fuchsia-300', min: 400 },
  { id: 'celestial', level: 5, Icon: Crown, gradient: 'from-amber-400/30 to-orange-500/10', accent: 'text-amber-300', min: 800 },
];

/** Compute the member level from real counters: 1 point per learned word + 5
 *  per streak day. Returns the current tier, the next tier (if any) and the
 *  0–1 progress toward it. No fabricated member_type — purely data-driven. */
export function computeMemberLevel(learnedWords: number, streakDays: number) {
  const score = Math.max(0, Math.round(learnedWords + streakDays * 5));
  let idx = 0;
  for (let i = 0; i < MEMBER_TIERS.length; i += 1) {
    if (score >= MEMBER_TIERS[i].min) idx = i;
  }
  const tier = MEMBER_TIERS[idx];
  const next = MEMBER_TIERS[idx + 1] ?? null;
  const span = next ? next.min - tier.min : 1;
  const progress = next ? Math.max(0, Math.min(1, (score - tier.min) / span)) : 1;
  const toNext = next ? Math.max(0, next.min - score) : 0;
  return { tier, next, progress, score, toNext };
}
