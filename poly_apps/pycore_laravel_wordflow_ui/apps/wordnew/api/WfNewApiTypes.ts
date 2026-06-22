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

/** One language's cell on a verse: text + (lazily filled) audio. `hasAudio` is the
 *  backend flag (audio for book sentences is generated over time by the pycore
 *  sentence-TTS worker); `explanation` is optional AI enrichment. */
export interface WfNewBookVerseLang {
  text: string | null;
  /** Absolute audio URL (resolved against the endpoint host), or null. */
  audio: string | null;
  /** True once TTS audio exists for this cell (else play is disabled / "generating"). */
  hasAudio?: boolean;
  explanation?: string | null;
}

/** One verse/sentence slot. `text`/`language` are the primary-language fields;
 *  `languages[lang]` carries every checked language's text/audio (null = 留空). */
export interface WfNewBookVerse {
  grain: string;
  seq: number;
  chapterIndex?: number;
  /** Real reference within the chapter, e.g. "1:1" (Bible chapter:verse). */
  ref?: string | null;
  /** Sub-book name for one-book-with-chapters sources (e.g. "Genesis"). */
  book?: string | null;
  text: string | null;
  language: string | null;
  audio?: string | null;
  corrId?: string;
  languages?: Record<string, WfNewBookVerseLang>;
}

/** A page of a book's verses (GET /media/books/{key}?chapter_index=&page=). */
export interface WfNewBookVersesPage {
  items: WfNewBookVerse[];
  total: number;
  perPage: number;
  currentPage: number;
  lastPage: number;
  /** Backend `has_more` flag (more pages after this one). */
  hasMore?: boolean;
}

// ---- Subtitle playback (GET /media/subtitles/{source_key}) ----------------

/** One subtitle/movie segment (a playable clip) with its media URLs. */
export interface WfNewSubtitleSegment {
  segIndex: number;
  startSec: number;
  endSec: number;
  subtitleCount?: number;
  /** Absolute clip URLs (HTTP impl resolves them against the endpoint host). */
  mp3Url?: string | null;
  mp4Url?: string | null;
  fullMp4Url?: string | null;
}

/** One subtitle line (a sentence). `text`/`language` are the primary-language
 *  fields; `languages[lang]` carries each language's text + audio for bilingual play. */
export interface WfNewSubtitleSentence {
  grain: string;
  seq: number;
  segIndex?: number;
  startSec?: number;
  endSec?: number;
  text: string | null;
  language: string | null;
  audio?: string | null;
  languages?: Record<string, { text: string | null; audio: string | null }>;
}

/** A subtitle source's full detail: the source row + ordered segments + a page of lines. */
export interface WfNewSubtitleDetail {
  sourceKey: string;
  title: string;
  language?: string;
  durationSec?: number;
  segments: WfNewSubtitleSegment[];
  sentences: {
    items: WfNewSubtitleSentence[];
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  };
}

// ---- Dictionary words (GET /vocabulary/dictionary/words, paginated) --------

/** One dictionary word row with audio + translation, for the word-stats sidebar. */
export interface WfNewDictWord {
  content: string;
  md5: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
  /** Primary translation text (first available), for a compact row. */
  translation?: string;
  hasTranslation?: boolean;
  /** Absolute audio URL (resolved against the endpoint host), or null. */
  audioUrl?: string | null;
  ttsStatus?: string;
}

/** A page of dictionary words (start/limit pagination, with the grand total). */
export interface WfNewWordPage {
  words: WfNewDictWord[];
  total: number;
  start: number;
  limit: number;
  language: string;
}

// ---- Vocabulary library words (GET /vocabulary/libraries/{id}/words, paginated) ----

/** One word in a vocabulary library, with audio + image + explanation. */
export interface WfNewLibraryWord {
  /** 0-based position within the library. */
  index: number;
  word: string;
  md5: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
  /** Long-form definition/explanation. */
  explanation?: string;
  /** Translation strings (may be empty). */
  translations: string[];
  /** Absolute image URLs (resolved against the endpoint host). */
  images: string[];
  /** Absolute TTS audio URL, or null. */
  audioUrl: string | null;
  hasTranslation: boolean;
  hasAudio: boolean;
  hasImage: boolean;
  isValid: boolean;
}

/** A page of a vocabulary library's words + the library header + aggregate stats. */
export interface WfNewLibraryWordsPage {
  library: { id: string; name: string; totalWords: number; language: string };
  words: WfNewLibraryWord[];
  stats: { total: number; translated: number; withAudio: number; withImage: number; invalid: number };
  pagination: { currentPage: number; perPage: number; total: number; lastPage: number; hasMore: boolean };
}

// ---- Word media on-demand (GET /word/{lang}/{word}/media) ------------------

/**
 * On-demand media + dictionary detail for ONE word, from the file-first resolve
 * endpoint GET /api/app_qy_v1/word/{lang}/{word}/media. Calling this both READS
 * the current state AND triggers/prioritizes backend generation:
 *
 *   - `imageUrl` / `audioUrl` are non-null ONLY when the file already exists on
 *     disk (absolute, resolved against the endpoint host by the HTTP impl).
 *   - When a file is missing the backend ENQUEUES the work + bumps its priority
 *     and reports the corresponding status as 'pending'. So a UI can poll this a
 *     few times until status flips to 'ready' and the url appears.
 */
export interface WfNewWordMedia {
  word: string;
  /** Backend content hash key for the word (stable dedupe id). */
  md5: string;
  language: string;
  /** Absolute image URL, or null while pending/absent. */
  imageUrl: string | null;
  /** Absolute audio URL, or null while pending/absent. */
  audioUrl: string | null;
  imageStatus: 'ready' | 'pending';
  audioStatus: 'ready' | 'pending';
  /** Translation strings (may be empty). */
  translations: string[];
  explanation?: string;
  phonetic?: string;
  usPhonetic?: string;
  ukPhonetic?: string;
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

/**
 * A social-login credential acquired by CapSocialAuth (Google / GitHub). The
 * frontend NEVER logs itself in — it sends this `code` to the backend, which
 * exchanges it with the server-side client secret, verifies the provider profile,
 * finds-or-creates the user, and returns a real WfNewAuthResult. Structurally a
 * subset of shared/capabilities CapSocialCredential.
 */
export interface WfNewSocialCredential {
  provider: 'google' | 'github';
  /** OAuth authorization code (normal path). */
  code?: string;
  /** Google One-Tap ID token (optional path). */
  idToken?: string;
  /** The exact redirect URI used (backend must reuse it on exchange). */
  redirectUri: string;
  /** CSRF state echoed back. */
  state?: string;
  /** PKCE verifier (native code flow). */
  codeVerifier?: string;
}

/** Editable profile fields (POST /user/profile + verification helpers). */
export interface WfNewProfileUpdate {
  nickname?: string;
  name?: string;
  /** Personal description (maps to users.bio). */
  bio?: string;
  location?: string;
  /** Phone number (login identifier; verified separately via SMS). */
  phone?: string;
  email?: string;
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

// ---- Social v2: discover / friend-requests / chat / presence / notifications ----
// Backend-aligned shapes (SOCIAL_FEATURE_SPECIFICATION.md §3). Every list endpoint
// wraps its rows under data.{users|requests|conversations|messages|notifications}.

/** Effective presence status (user_presence; >60s since last_seen ⇒ 'offline'). */
export type WfNewPresenceStatus = 'online' | 'away' | 'studying' | 'offline';

/** A language-match candidate (GET /social/discover → data.users). `match` ranks
 *  the language fit: 'exchange' (mutual native↔target) > 'native' > 'target'. */
export interface WfNewDiscoverUser {
  id: number;
  nickname: string;
  avatar: string;
  native_language: string;
  learning_languages: string[];
  is_following: boolean;
  is_friend: boolean;
  match: 'exchange' | 'native' | 'target';
  /** Effective presence at discovery time (seeds the partner-card dot). */
  presence?: WfNewPresenceStatus;
  stats?: WfNewSocialStats;
}

/** A pending friend request (GET /social/friends/requests → data.requests). */
export interface WfNewFriendRequest {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  /** The OTHER party's display fields (backend joins the user row). */
  username?: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
}

/** A 1:1 (or group) conversation (GET /social/conversations → data.conversations). */
export interface WfNewConversation {
  id: number;
  type: 'direct' | 'group';
  /** The other participant for a direct conversation. */
  peer: {
    id: number;
    nickname: string;
    avatar: string;
    /** Effective presence of the peer. */
    presence: WfNewPresenceStatus;
  };
  last_message?: string | null;
  unread_count: number;
  last_message_at?: string | null;
}

/** One chat message (GET /social/conversations/{id}/messages → data.messages). */
export interface WfNewMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  type: 'text' | 'image' | 'voice';
  metadata?: Record<string, any> | null;
  created_at: string;
}

/** A page of messages (id-ASC after cursor). */
export interface WfNewMessagePage {
  messages: WfNewMessage[];
  /** Pass back as `cursor` to fetch the next (older→newer) page; null when caught up. */
  next_cursor: number | null;
}

/** A per-user notification (GET /social/notifications → data.notifications). */
export interface WfNewNotification {
  id: number;
  type: string;
  payload?: Record<string, any> | null;
  read_at?: string | null;
  created_at: string;
}

/** A page of notifications (id-DESC, cursor-paginated). */
export interface WfNewNotificationPage {
  notifications: WfNewNotification[];
  next_cursor: number | null;
}

/** Batch presence read (GET /social/presence?user_ids=). */
export interface WfNewPresenceInfo {
  status: WfNewPresenceStatus;
  last_seen_at?: string | null;
}

// ---- Social Center: posts / comments / live ------------------------------- #
// Backend-aligned shapes (AppQyV1 /social/posts + /social/live). Image/video/cover
// urls are ROOT-RELATIVE ('/static/...') from the backend — always wrap with
// mediaUrl() before rendering. The author/host/user blocks carry the same
// {id,name,avatar_url} shape; avatar_url may be an emoji or a relative path.

/** A post author / live host / live-chat sender. */
export interface WfNewSocialActor {
  id: number;
  name: string;
  /** Emoji OR a (possibly root-relative) avatar URL — mediaUrl() it before rendering. */
  avatar_url: string;
}

/** One image attached to a post (root-relative url; mediaUrl() before render). */
export interface WfNewPostImage {
  id: number;
  url: string;
  caption?: string | null;
  sequence: number;
}

/** What kind of post this is (drives which media block renders). */
export type WfNewPostType = 'text' | 'images' | 'video' | 'live';

/** Plaza-feed visibility. */
export type WfNewPostVisibility = 'public' | 'friends' | 'private';

/** Feed filter (Plaza / Gallery / Video reuse this). */
export type WfNewPostFilter = 'all' | 'images' | 'videos' | 'following';

/** One timeline post (GET /social/posts → data.items[]). */
export interface WfNewPost {
  id: number;
  author: WfNewSocialActor;
  content: string;
  post_type: WfNewPostType;
  images: WfNewPostImage[];
  /** Root-relative uploaded clip url (video posts); mediaUrl() before render. */
  video_url?: string | null;
  /** External embed url (youtube/bilibili/vimeo or a live stream). */
  external_url?: string | null;
  /** Root-relative cover/poster; mediaUrl() before render. */
  cover_url?: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  visibility: WfNewPostVisibility;
  created_at: string;
}

/** A page of posts (cursor-paginated; next_cursor null when caught up). */
export interface WfNewPostPage {
  items: WfNewPost[];
  next_cursor: number | null;
}

/** One post comment (GET /social/posts/{id}/comments → data.items[]). */
export interface WfNewPostComment {
  id: number;
  post_id: number;
  parent_id?: number | null;
  author: WfNewSocialActor;
  body: string;
  created_at: string;
}

/** A page of comments (cursor-paginated). */
export interface WfNewPostCommentPage {
  items: WfNewPostComment[];
  next_cursor: number | null;
}

/** Result of a like / unlike toggle. */
export interface WfNewPostLikeResult {
  like_count: number;
  liked_by_me: boolean;
}

/** Create-post payload (text/images/video/live). */
export interface WfNewCreatePostPayload {
  content?: string;
  post_type: WfNewPostType;
  external_url?: string;
  visibility?: WfNewPostVisibility;
}

/** A live session (GET /social/live → data.items[]). */
export type WfNewLiveStatus = 'live' | 'ended' | 'scheduled';
export interface WfNewLive {
  id: number;
  host: WfNewSocialActor;
  title: string;
  description?: string | null;
  status: WfNewLiveStatus;
  /** External stream embed url (youtube/bilibili/vimeo/...) — iframe it. */
  external_url?: string | null;
  /** Root-relative cover; mediaUrl() before render. */
  cover_url?: string | null;
  viewer_count: number;
  started_at?: string | null;
}

/** Create-live payload. */
export interface WfNewCreateLivePayload {
  title: string;
  description?: string;
  external_url?: string;
}

/** One live-room chat message (GET /social/live/{id}/chat → data.items[]). */
export interface WfNewLiveMsg {
  id: number;
  user: WfNewSocialActor;
  body: string;
  created_at: string;
}

/** A page of live-chat messages (cursor-paginated, id-ASC after cursor). */
export interface WfNewLiveMsgPage {
  items: WfNewLiveMsg[];
  next_cursor: number | null;
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
  /**
   * One-click social login/register (Google / GitHub). Pass the credential from
   * CapSocialAuth; the backend verifies it and returns a real session (creating
   * the account on first sign-in). POST /auth/social.
   */
  socialLogin(cred: WfNewSocialCredential): Promise<WfNewAuthResult>;
  /** Link a social provider to the CURRENT account (auth). POST /user/social/bind. */
  bindProvider(cred: WfNewSocialCredential): Promise<void>;
  /** Unlink a social provider from the current account (auth). POST /user/social/unbind. */
  unbindProvider(provider: 'google' | 'github'): Promise<void>;
  /** Change password for the current account (auth). POST /user/change-password. */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  /** Update editable profile fields (auth). POST /user/profile. */
  updateProfile(patch: WfNewProfileUpdate): Promise<WfNewAuthUser>;
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
  /** Search users by username/nickname/name (excludes self). Optional language
   *  filters narrow by native / target (GET /social/friends/search?q=&native=&target=). */
  searchUsers(query: string, opts?: { native?: string; target?: string }): Promise<WfNewUserSearchResult[]>;
  /** Follow a user by id. */
  followUser(userId: number): Promise<void>;
  /** Unfollow a user by id. */
  unfollowUser(userId: number): Promise<void>;
  /** Global XP leaderboard ('week' or 'all'). */
  getLeaderboard(period?: 'week' | 'all'): Promise<WfNewLeaderboardEntry[]>;
  /** Recent learning activity of followed users. */
  getActivities(): Promise<WfNewActivity[]>;

  // ---- Social v2: discover / friend-requests / chat / presence / notifications ----
  /** Find language partners (GET /social/discover). Matches by native/target; the
   *  page derives native/target from the current user's languages. */
  discoverByLanguage(opts?: { native?: string; target?: string; q?: string; limit?: number }): Promise<WfNewDiscoverUser[]>;
  /** Send a friend request to a user (POST /social/friends/request). */
  sendFriendRequest(userId: number): Promise<void>;
  /** Accept or reject an incoming friend request (POST /social/friends/respond). */
  respondFriendRequest(requestId: number, action: 'accept' | 'reject'): Promise<void>;
  /** Pending friend requests in a direction (GET /social/friends/requests). */
  getFriendRequests(direction?: 'incoming' | 'outgoing'): Promise<WfNewFriendRequest[]>;
  /** Block a user (POST /social/friends/block). */
  blockUser(userId: number): Promise<void>;

  /** My conversations (GET /social/conversations). */
  getConversations(): Promise<WfNewConversation[]>;
  /** Get-or-create a direct conversation with a user (POST /social/conversations). */
  openConversation(userId: number): Promise<WfNewConversation>;
  /** A page of a conversation's messages, id-ASC after `cursor` (GET …/messages). */
  getMessages(conversationId: number, cursor?: number | null): Promise<WfNewMessagePage>;
  /** Send a message into a conversation (POST …/messages). */
  sendMessage(conversationId: number, body: string, type?: 'text' | 'image' | 'voice', metadata?: Record<string, any>): Promise<WfNewMessage>;
  /** Mark a conversation read up to a message id (POST …/read). */
  markConversationRead(conversationId: number, messageId: number): Promise<void>;

  /** Heartbeat my presence (POST /social/presence/heartbeat); ~30s while active. */
  presenceHeartbeat(status?: WfNewPresenceStatus): Promise<void>;
  /** Batch presence for users (GET /social/presence?user_ids=). */
  getPresence(userIds: number[]): Promise<Record<number, WfNewPresenceInfo>>;

  /** A page of my notifications (GET /social/notifications). */
  getNotifications(cursor?: number | null, unreadOnly?: boolean): Promise<WfNewNotificationPage>;
  /** Unread notification count (GET /social/notifications/unread-count). */
  getUnreadCount(): Promise<number>;
  /** Mark one notification (by id) or ALL ('all') read (POST /social/notifications/read). */
  markNotificationRead(idOrAll: number | 'all'): Promise<void>;

  // ---- Social Center: posts / comments / live ----
  /** A page of plaza posts (GET /social/posts). PUBLIC read (no token needed);
   *  `following` filter falls back to public when logged out. `author` scopes the
   *  feed to one user's posts (user-profile page) — see WfNewApiPaths note: the
   *  backend may not yet support author scoping; the http impl passes it through
   *  and the page tolerates an unfiltered result. */
  getPosts(opts?: { cursor?: number | null; limit?: number; filter?: WfNewPostFilter; author?: number }): Promise<WfNewPostPage>;
  /** One post by id (GET /social/posts/{id}). */
  getPost(postId: number): Promise<WfNewPost>;
  /** Create a post (POST /social/posts). Auth-required. */
  createPost(payload: WfNewCreatePostPayload): Promise<WfNewPost>;
  /** Delete a post (DELETE /social/posts/{id}). Auth-required. */
  deletePost(postId: number): Promise<void>;
  /** Like / unlike a post (POST /social/posts/{id}/like|unlike). Auth-required. */
  likePost(postId: number): Promise<WfNewPostLikeResult>;
  unlikePost(postId: number): Promise<WfNewPostLikeResult>;
  /** A page of a post's comments (GET /social/posts/{id}/comments). PUBLIC read. */
  getComments(postId: number, cursor?: number | null): Promise<WfNewPostCommentPage>;
  /** Add a comment (POST /social/posts/{id}/comments). Auth-required. */
  addComment(postId: number, body: string, parentId?: number): Promise<WfNewPostComment>;
  /** Delete a comment (DELETE /social/posts/{id}/comments/{cid}). Auth-required. */
  deleteComment(postId: number, commentId: number): Promise<void>;
  /** Attach images to a post (multipart images[]). Auth-required. */
  uploadPostImages(postId: number, files: File[]): Promise<WfNewPost>;
  /** Attach a short clip to a post (multipart video). Auth-required. */
  uploadPostVideo(postId: number, file: File): Promise<WfNewPost>;

  /** Live sessions (GET /social/live?status=). PUBLIC read. */
  getLiveSessions(status?: 'live' | 'all'): Promise<WfNewLive[]>;
  /** Start a live session (POST /social/live). Auth-required. */
  createLive(payload: WfNewCreateLivePayload): Promise<WfNewLive>;
  /** End a live session you host (POST /social/live/{id}/end). Auth-required. */
  endLive(liveId: number): Promise<void>;
  /** Viewer heartbeat → current viewer_count (POST /social/live/{id}/heartbeat). */
  liveHeartbeat(liveId: number): Promise<number>;
  /** A page of a live room's chat (GET /social/live/{id}/chat). PUBLIC read. */
  getLiveChat(liveId: number, cursor?: number | null): Promise<WfNewLiveMsgPage>;
  /** Send a live-chat message (POST /social/live/{id}/chat). Auth-required. */
  sendLiveChat(liveId: number, body: string): Promise<WfNewLiveMsg>;
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
  /** Ingested book sources as home cards (GET /media/books). Paged (default p1) so
   *  "load more" can fetch only the next fragment; an empty result = exhausted. */
  getBookGroups(page?: number, perPage?: number): Promise<WfNewContentGroup[]>;
  /** Ingested subtitle/movie sources as home cards (GET /media/subtitles). Paged. */
  getSubtitleGroups(page?: number, perPage?: number): Promise<WfNewContentGroup[]>;
  /** PUBLIC vocabulary/word libraries as home cards (GET /vocabulary/libraries). Paged. */
  getLibraryGroups(page?: number, perPage?: number): Promise<WfNewContentGroup[]>;
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

  // ---- Subtitle playback + word stats ----
  /** Full detail for one subtitle source (segments + a page of lines) for the player. */
  getSubtitleDetail(
    sourceKey: string,
    opts?: { page?: number; perPage?: number; grain?: string },
  ): Promise<WfNewSubtitleDetail>;
  /** A page of dictionary words (audio + translation) for the word-stats sidebar. */
  getDictionaryWords(
    opts?: { language?: string; start?: number; limit?: number; filter?: string },
  ): Promise<WfNewWordPage>;
  /** A page of one vocabulary library's words (GET /vocabulary/libraries/{id}/words). */
  getLibraryWords(
    libraryId: string,
    opts?: { page?: number; perPage?: number },
  ): Promise<WfNewLibraryWordsPage>;

  // ---- Word media on-demand ----
  /**
   * Resolve (and, file-first, ENQUEUE+prioritize) a word's image/audio + dictionary
   * detail (GET /word/{lang}/{word}/media). Simply calling this triggers backend
   * generation for any missing file; poll it until imageStatus/audioStatus flip to
   * 'ready' and the urls appear.
   */
  getWordMedia(language: string, word: string): Promise<WfNewWordMedia>;
}
