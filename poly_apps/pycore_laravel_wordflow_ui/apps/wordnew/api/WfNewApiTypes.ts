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
  // ---- Auth ----
  /** Authenticate by username/email/phone + password. Rejects on bad creds. */
  login(identifier: string, password: string): Promise<WfNewAuthResult>;
  /** Create an account (immediately logged in). Rejects with a backend message on failure. */
  register(payload: WfNewRegisterPayload): Promise<WfNewAuthResult>;
  /** Clear the current session token (best-effort; always resolves). */
  logout(): Promise<void>;

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
}
