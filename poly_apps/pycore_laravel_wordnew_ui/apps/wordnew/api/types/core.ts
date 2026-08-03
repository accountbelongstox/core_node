/** types/core.ts - core data models shared across the wordnew app (Word, groups, stats, content, languages). (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
export interface Word {
  id: string;
  text: string;
  phonetic: string;
  translation: string;
  definition?: string;
  example?: string;
  exampleTranslation?: string;
  /** 0-100 */
  masteryLevel?: number;
  /** Grammatical hint shown in the Walkman screen (e.g. 'n.', 'verb'). */
  wordType?: string;
  tags?: string[];
  /** Absolute primary audio URL (rebased onto the current endpoint), or undefined. */
  audioUrl?: string;
  /** All generated audio renditions from the Laravel library (absolute urls). */
  audioFiles?: { url?: string; voice?: string; lang?: string }[];
  /** How many audio renditions exist for this word (audioFiles.length). */
  audioCount?: number;
  /** True when `translation` holds a REAL target string (empty '' = no translation). */
  hasTranslation?: boolean;
}

export interface WordGroup {
  id: string;
  name: string;
  language?: string;
  count: number;
  progress?: number;
  type?: string;
  description?: string;
  isLanguageDefault?: boolean;
}

/**
 * The backend name of the user's Default Vocabulary Group
 * (AppQyV1WordGroupPublicController::$default_group_name). Created lazily at
 * login/register; the shelf study surface scopes shuffle-once + daily-goal
 * unread reading to this group. The mapped WordGroup.name carries this value
 * (WfNewApiMappers.toGroup reads raw.gname).
 */
export const DEFAULT_VOCAB_GROUP_NAME = 'Default Vocabulary Group';

export function isDefaultVocabularyGroup(group: Pick<WordGroup, 'name' | 'language' | 'isLanguageDefault'>): boolean {
  return group.name === DEFAULT_VOCAB_GROUP_NAME
    || (group.isLanguageDefault === true && (group.language ?? 'en') === 'en');
}

/**
 * A WordGroup enriched with the decorative fields the home "bento" grid needs.
 * The mock supplies hand-tuned values; the HTTP impl fills sensible defaults
 * derived from a real WordGroup so the same grid renders from live data.
 */
export interface BentoGroup extends WordGroup {
  badge: string;
  /** Tailwind grid-span classes, e.g. 'md:col-span-2 md:row-span-2 h-[340px]'. */
  gridSpan: string;
  bgGradient: string;
  bgGradientDark: string;
  decorColor: string;
  decorativeSvg: 'nebula' | 'matrix' | 'stars' | 'waves' | 'bars' | 'rings';
  statsLabel: string;
}

/** Home dashboard counters. */
export interface UserStats {
  learned: number;
  streak: number;
  dailyGoal: number;
  dailyProgress: number;
}

/**
 * Rich learning statistics for the home dashboard, mapped 1:1 from the backend
 * GET /user/statistics (AppQyV1ProfileController::getStatistics). Every field is
 * a REAL backend value (camelCased here); `totalStudyTime` is a known backend gap
 * (no session table yet) and comes back 0. Auth-only — null when logged out.
 */
export interface WfNewStatistics {
  totalWordsLearned: number;
  totalWords: number;
  newWords: number;
  learningWords: number;
  masteredWords: number;
  weakWords: number;
  needsReview: number;
  currentStreak: number;
  longestStreak: number;
  /** 0-100. */
  averageAccuracy: number;
  dailyAverage: number;
  studyDays: number;
  /** Words studied per day for the trailing 7 days (index 6 = today). */
  weeklyProgress: number[];
  todayProgress: number;
  dailyGoal: number;
  /** 0-100 mastered/total. */
  completionRate: number;
}

/**
 * User profile as the wordnew home screen reads it. Superset of the fields the
 * UI actually touches; every field is optional so a partial backend payload (or
 * the mock) is always assignable.
 */
export interface UserProfile {
  nickname?: string;
  name?: string;
  email?: string;
  avatar?: string;
  learned_words?: number;
  totalLearned?: number;
  streak?: number;
  dailyProgress?: number;
  dailyGoal?: number;
}

// ---- Home content groups (multi-category) ---------------------------------

/**
 * The five content categories the home page reads from the AppQyV1 backend:
 *   - 'word'     : a user word/vocabulary group   → GET /query_all_groups (auth)
 *   - 'book'     : an ingested book source         → GET /media/books
 *   - 'subtitle' : an ingested subtitle/movie src  → GET /media/subtitles
 *   - 'library'  : a PUBLIC vocabulary/word library → GET /vocabulary/libraries
 *                  (e.g. "English Coca 60000" — a word collection, NOT a document)
 *   - 'document' : the user's OWN uploaded document → GET /media/documents
 *                  (user-scoped; empty until the user uploads — distinct from a library)
 *
 * 'library' vs 'document' matters: in this backend an uploaded document ALSO
 * produces a vocabulary library, so the two were once conflated. They are kept
 * separate here — public word libraries vs the user's own uploaded files.
 */
export type WfNewContentKind = 'word' | 'book' | 'subtitle' | 'library' | 'document';

/**
 * One home content card, normalized across all four backend categories so a
 * single widget renders them uniformly. `count`/`countUnit` are kind-specific
 * (words / sentences / subtitle lines). `imageUrl` is an ABSOLUTE cover URL — the
 * HTTP impl resolves backend-relative poster paths against the current endpoint
 * host; undefined when the source has no cover (the card draws a gradient).
 */
export interface WfNewContentGroup {
  id: string;
  kind: WfNewContentKind;
  title: string;
  count: number;
  /** What `count` measures: 'words' | 'sentences' | 'subtitles'. */
  countUnit: string;
  language?: string;
  /** Absolute primary cover URL (first of imageUrls), or undefined when none. */
  imageUrl?: string;
  /** All cover/poster URLs for carousel playback (string or array from API). */
  imageUrls?: string[];
  /** Optional classifier (group type / library category). */
  category?: string;
  description?: string;
  /** Media source key (book/subtitle) for detail navigation; undefined for words. */
  sourceKey?: string;
}

/** The home page's five content sections, each a list of normalized groups. */
export interface WfNewHomeContent {
  words: WfNewContentGroup[];
  books: WfNewContentGroup[];
  subtitles: WfNewContentGroup[];
  libraries: WfNewContentGroup[];
  documents: WfNewContentGroup[];
}

// ---- Book reading (book -> chapter -> verses, Books v3.1) ------------------

/** One selectable learning language (backend /system/supported-languages row). */
export interface WfNewLanguage {
  code: string;
  name: string;
  native_name: string;
}

/**
 * A user's language selection (AppQyV1LearningController get/setUserLanguages):
 * one native/source language + one-or-more learning targets. Backend requires
 * 2-char codes.
 */
export interface WfNewLanguageSelection {
  native_language: string;
  learning_languages: string[];
}
