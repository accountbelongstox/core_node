/**
 * WfNewApi — SINGLE shared TYPE surface for the /wordnew app.
 *
 * This is the ONE place every data shape lives. Both the mock implementation
 * (WfNewApiMock) and the real HTTP implementation (WfNewApiHttp) implement the
 * same `WfNewApi` interface using these exact types, and every page/component
 * consumes them. The golden rule (see ./README.md):
 *
 *   When you change the API, you MUST update BOTH implementations and the mock
 *   data, and they MUST keep sharing these types. Never let mock and real drift.
 *
 * Anything UI-only (theme descriptors etc.) stays in WfNewTypes.ts; this file is
 * strictly the data contract that crosses the API boundary.
 */

// ---- Core data models -----------------------------------------------------

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
  audioUrl?: string;
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
  /** Absolute cover/poster URL, or undefined when none. */
  imageUrl?: string;
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

/** One chapter of a book, merged across languages. `titles[lang]` is null where a
 *  language has no chapter title (留空); `sentenceCount` is the verse count. */
export interface WfNewBookChapter {
  chapterIndex: number;
  corrId?: string;
  sentenceCount: number;
  titles: Record<string, string | null>;
}

/** A book's chapter list (GET /media/books/{key}/chapters). `chapterCount === 0`
 *  for a legacy/unstructured book (read it flat via getBookVerses with no chapter). */
export interface WfNewBookChapters {
  sourceKey: string;
  languages: string[];
  chapterCount: number;
  chapters: WfNewBookChapter[];
}

/** One verse/sentence slot. `text`/`language` are the primary-language fields;
 *  `languages[lang]` carries every checked language's text/audio (null = 留空). */
export interface WfNewBookVerse {
  grain: string;
  seq: number;
  chapterIndex?: number;
  text: string | null;
  language: string | null;
  audio?: string | null;
  languages?: Record<string, { text: string | null; audio: string | null }>;
}

/** A page of a book's verses (GET /media/books/{key}?chapter_index=&page=). */
export interface WfNewBookVersesPage {
  items: WfNewBookVerse[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
}

// ---- Auth -----------------------------------------------------------------

/**
 * Authenticated user as returned by the AppQyV1 /login and /register endpoints
 * (backend-aligned snake_case fields). Every field optional so a partial backend
 * payload — or the mock — is always assignable.
 */
export interface WfNewAuthUser {
  id?: string;
  username?: string;
  nickname?: string;
  name?: string;
  email?: string;
  avatar?: string;
  avatar_url?: string;
  native_language?: string;
  learning_languages?: string[];
  member_type?: string;
  bio?: string;
}

/** Normalized result of a successful login/register. */
export interface WfNewAuthResult {
  /** Sanctum Bearer token (backend data.login_token). */
  token: string;
  user: WfNewAuthUser;
}

/**
 * Roaming account preferences (AppQyV1ProfileController get/updatePreferences).
 * `theme` is backend-constrained to 'light' | 'dark'; the wordnew custom theme id
 * and any other client settings live in the opaque `app_settings` blob.
 */
export interface WfNewPreferences {
  theme?: 'light' | 'dark' | string;
  language?: string;
  daily_goal?: number;
  /** Opaque client settings blob (wordnew stores `{ themeId, ... }` here). */
  app_settings?: Record<string, any> | null;
  favorites?: any[];
  recentTools?: any[];
}

/**
 * Registration form payload. `username` + `password` are required; everything
 * else is optional and mirrors the backend's accepted fields (the AppQyV1
 * registration controller validates `learning_languages` / `native_language`
 * against the supported-language catalog).
 */
export interface WfNewRegisterPayload {
  username: string;
  password: string;
  email?: string;
  nickname?: string;
  native_language?: string;
  learning_languages?: string[];
  bio?: string;
  /** Emoji avatar chosen in the form (UI-only; the backend ignores it). */
  avatar?: string;
  invite_code?: string;
}

// ---- Languages & avatars --------------------------------------------------

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

/** Result of an avatar upload (AppQyV1ProfileController::uploadAvatar). */
export interface WfNewAvatarResult {
  /** Stored relative path (e.g. 'avatars/appqyv1/avatar_1_123.png'). */
  avatar: string;
  /** Absolute URL for rendering. */
  avatar_url: string;
}

// ---- Social ---------------------------------------------------------------
// Backend-aligned shapes (AppQyV1SocialController). Every list endpoint wraps its
// rows under `data.{friends|users|leaderboard|activities}`.

/** Per-user learning counters attached to social rows (statsRowFor). */
export interface WfNewSocialStats {
  learned?: number;
  mastered?: number;
  streak?: number;
  [k: string]: any;
}

/** A followed user (GET /social/friends → data.friends). */
export interface WfNewFriend {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  /** presenceStatus: e.g. 'online' | 'studying' | 'offline'. */
  status: string;
  followed_at?: string | null;
  stats?: WfNewSocialStats;
}

/** A user-search hit (GET /social/friends/search → data.users). */
export interface WfNewUserSearchResult {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  status: string;
  is_following: boolean;
}

/** A leaderboard row (GET /social/leaderboard → data.leaderboard; stats merged in). */
export interface WfNewLeaderboardEntry {
  user_id: number;
  username: string;
  name: string;
  avatar_url: string;
  xp: number;
  rank: number;
  is_current_user: boolean;
  [k: string]: any;
}

/** A followed user's recent activity (GET /social/activities → data.activities). */
export interface WfNewActivity {
  id: string;
  user_id: number;
  user_name: string;
  avatar_url: string;
  action?: string;
  learned_count?: number;
  mastered_count?: number;
  time?: string;
  [k: string]: any;
}

// ---- Interactive subtitles ------------------------------------------------

export interface SubtitleWord {
  text: string;
  translation: string;
  definition: string;
  phonetic: string;
  tags?: string[];
}

export interface SubtitleLine {
  startTime: number;
  endTime: number;
  text: string;
  translation: string;
  words: SubtitleWord[];
}

export interface SubtitleCourse {
  id: string;
  title: string;
  category: string;
  subtitles: SubtitleLine[];
}

// ---- Bilingual recital ----------------------------------------------------

export interface BilingualWord {
  text: string;
  phonetic: string;
  translation: string;
  definition: string;
}

export interface BilingualSentence {
  id: string;
  nativeLang: string;
  targetLang: string;
  targetText: string;
  nativeText: string;
  words: BilingualWord[];
}

// ---- Analytics ------------------------------------------------------------

export interface WeeklyActivity {
  day: string;
  mins: number;
  /** Words studied that day (shown in the bar-chart tooltip). */
  count: number;
}

export interface CategoryScore {
  name: string;
  count: number;
  /** 0-100 mastery for the category bar. */
  score: number;
}

export interface StudiedTimelineItem {
  word: string;
  status: 'Mastered' | 'Familiar' | 'Learning' | string;
  time: string;
}

export interface AnalyticsStats {
  totalStudyMins: number;
  retentionRate: number;
  cumulativeLearned: number;
  vocabularyTarget: number;
  streakDays: number;
  weeklyActivity: WeeklyActivity[];
  categoryScores: CategoryScore[];
  recentlyStudiedTimeline: StudiedTimelineItem[];
}

// ---- Backend endpoint management ------------------------------------------

/**
 * The KIND of an endpoint — also its persisted "selection type". The settings
 * store a TYPE (the endpoint id), and the concrete endpoint is resolved from it
 * at runtime, so e.g. 'current-url' always re-resolves to the live page origin
 * rather than freezing a host that may later change.
 *   - 'current-url' : the page's own origin, host from window.location, port 9000.
 *   - 'default'     : a built-in named endpoint (remote-primary / loopback / mesh).
 *   - 'custom'      : a user-added endpoint.
 */
export type WfNewEndpointKind = 'current-url' | 'default' | 'custom';

/**
 * One configurable backend endpoint. `url` is the host only (no protocol/port);
 * the full base is `${protocol}://${url}:${port}`. All wordnew defaults use
 * port 9000 (the laravel_main / AppQyV1 Octane backend).
 */
export interface WfNewEndpoint {
  /** Unique id; doubles as the persisted selection TYPE token. */
  id: string;
  /** Selection kind (current-url resolves dynamically; see WfNewEndpointKind). */
  kind: WfNewEndpointKind;
  url: string;
  protocol: 'http' | 'https';
  port?: number;
  /** Lower = preferred (current-url is tried/selected first when healthy). */
  priority: number;
  isLocal: boolean;
  description: string;
  /** True for user-added endpoints (removable in Settings). */
  custom?: boolean;
}

/** Result of probing one endpoint's `/api/health`. */
export interface WfNewEndpointHealth {
  id: string;
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: number;
}

/**
 * Immutable snapshot of the endpoint manager's state, consumed reactively via
 * `useSyncExternalStore` (the project's store pattern — see core/logstore,
 * core/notify). A new object is produced on every change; the reference is
 * stable between changes so React can bail out of re-renders.
 */
export interface WfNewEndpointSnapshot {
  endpoints: WfNewEndpoint[];
  health: Record<string, WfNewEndpointHealth>;
  currentId: string | null;
  /** At least one endpoint answered healthy in the last pass. */
  healthy: boolean;
  /** First detection pass has completed. */
  ready: boolean;
  /** A manual "Test & select" pass is in flight. */
  testing: boolean;
}

// ---- The API contract -----------------------------------------------------

/**
 * Every data access the /wordnew app needs, in one interface. Both
 * WfNewApiMock and WfNewApiHttp implement THIS — keep them in lock-step.
 */
export interface WfNewApi {
  // ---- Session ----
  /** True when a usable session token is held (always true in mock mode). */
  isAuthenticated(): boolean;
  /** Subscribe to "session expired" (a 401 from any authed call). Returns an unsubscribe fn. */
  onAuthExpired(cb: () => void): () => void;

  // ---- Auth ----
  /** Authenticate by username/email/phone + password. Rejects on bad creds. */
  login(identifier: string, password: string): Promise<WfNewAuthResult>;
  /** Create an account (immediately logged in). Rejects with a backend message on failure. */
  register(payload: WfNewRegisterPayload): Promise<WfNewAuthResult>;
  /** Clear the current session token (best-effort; always resolves). */
  logout(): Promise<void>;
  /** Read the roaming account preferences (defaults applied server-side). */
  getPreferences(): Promise<WfNewPreferences>;
  /** Merge-update preferences; resolves to the full updated set. */
  updatePreferences(patch: WfNewPreferences): Promise<WfNewPreferences>;

  /** Selectable learning languages (live catalog, falls back to the built-in list). */
  getSupportedLanguages(): Promise<WfNewLanguage[]>;
  /** The user's native + learning-target selection. */
  getLearningLanguages(): Promise<WfNewLanguageSelection>;
  /** Persist the native + learning-target selection; resolves to the saved set. */
  setLearningLanguages(selection: WfNewLanguageSelection): Promise<WfNewLanguageSelection>;

  /** Upload a new avatar image; resolves to the stored path + absolute URL. */
  uploadAvatar(file: File): Promise<WfNewAvatarResult>;

  // ---- Social ----
  /** Users the current account follows (with presence + learning stats). */
  getFriends(): Promise<WfNewFriend[]>;
  /** Search users by username/nickname/name (excludes self). */
  searchUsers(query: string): Promise<WfNewUserSearchResult[]>;
  /** Follow a user by id. */
  followUser(userId: number): Promise<void>;
  /** Unfollow a user by id. */
  unfollowUser(userId: number): Promise<void>;
  /** Global XP leaderboard ('week' or 'all'). */
  getLeaderboard(period?: 'week' | 'all'): Promise<WfNewLeaderboardEntry[]>;
  /** Recent learning activity of followed users. */
  getActivities(): Promise<WfNewActivity[]>;
  /**
   * Preset avatar choices (emoji strings or image URLs). Tries the backend first,
   * falls back to the built-in set so the picker is never empty offline.
   */
  getPresetAvatars(): Promise<string[]>;

  /** Decorated home-grid groups (bento layout). */
  getBentoGroups(): Promise<BentoGroup[]>;
  /** Plain learning groups for the library shelf. */
  getWordGroups(): Promise<WordGroup[]>;
  /** Words inside one group/course. */
  getVocabulary(groupId: string): Promise<Word[]>;
  /** Current user's profile, or null when unauthenticated/offline. */
  getUserProfile(): Promise<UserProfile | null>;
  /** Home dashboard counters (derived from the profile when real). */
  getUserStats(): Promise<UserStats>;
  /** Rich learning statistics for the dashboard (GET /user/statistics). Null when unauthenticated/offline. */
  getUserStatistics(): Promise<WfNewStatistics | null>;
  /** Dictionary / fuzzy search for the global search overlay. */
  searchDictionary(text: string): Promise<Word[]>;
  /** Cassette playlist for the Cyber Walkman page. */
  getWalkmanWords(): Promise<Word[]>;
  /** Interactive subtitle courses. */
  getSubtitleCourses(): Promise<SubtitleCourse[]>;
  /** Learning analytics for the stats board. */
  getAnalytics(): Promise<AnalyticsStats>;
  /** Bilingual recital sentence pairs. */
  getBilingualSentences(): Promise<BilingualSentence[]>;

  // ---- Home content groups (words / books / subtitles / libraries / documents) ----
  /** User word/vocabulary groups as normalized home cards (GET /query_all_groups, auth). */
  getWordContentGroups(): Promise<WfNewContentGroup[]>;
  /** Ingested book sources as home cards (GET /media/books). */
  getBookGroups(): Promise<WfNewContentGroup[]>;
  /** Ingested subtitle/movie sources as home cards (GET /media/subtitles). */
  getSubtitleGroups(): Promise<WfNewContentGroup[]>;
  /** PUBLIC vocabulary/word libraries as home cards (GET /vocabulary/libraries). */
  getLibraryGroups(): Promise<WfNewContentGroup[]>;
  /** The user's OWN uploaded documents as home cards (GET /media/documents; empty if unauthed). */
  getDocumentGroups(): Promise<WfNewContentGroup[]>;
  /** All five home categories at once (parallel; partial-tolerant — a failed category resolves to []). */
  getHomeContent(): Promise<WfNewHomeContent>;

  // ---- Book reading (book -> chapter -> verses) ----
  /** Ordered chapter list for a book (GET /media/books/{key}/chapters). */
  getBookChapters(sourceKey: string): Promise<WfNewBookChapters>;
  /** A page of a book's verses; pass chapterIndex to scope to one chapter. */
  getBookVerses(
    sourceKey: string,
    opts?: { chapterIndex?: number; page?: number; perPage?: number; grain?: string },
  ): Promise<WfNewBookVersesPage>;
}
