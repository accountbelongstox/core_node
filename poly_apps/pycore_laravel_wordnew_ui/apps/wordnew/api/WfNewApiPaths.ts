import type { WfNewWordMediaOptions } from './WfNewApiTypes';
import { APPQYV1_API_BASE, APPQYV1_AI_TOOLS_ROUTES } from '../../../core/contracts/AppQyV1AiToolsContract';

/**
 * WfNewApiPaths — the /wordnew ENDPOINT LIST CENTER.
 *
 * The ONE place every backend path the app calls is declared. Paths are appended
 * to the endpoint base URL by WfNewApiHttp (`wfNewEndpoints.buildUrl(path)`),
 * which only supplies `${protocol}://${host}:${port}` — so each path here MUST
 * include the full route, including the `/api/app_qy_v1` prefix.
 *
 * VERIFIED against the live backend routes (poly_apps/laravel_main):
 *   - Laravel mounts routes/api.php under `/api`.
 *   - Every AppQyV1 router file groups under `Route::prefix('app_qy_v1')`
 *     (routes/AppQyV1Router/*.php, $apiVersionPrefix = 'app_qy_v1').
 *   ⇒ Full base = `/api/app_qy_v1`.
 *
 * Route file → group → path map (keep in sync when the backend changes):
 *   AppQyV1Auth.php   (prefix app_qy_v1)        : /register /login /logout
 *                                                 /forgot-password /reset-password /user
 *   AppQyV1User.php   (app_qy_v1/user, sanctum) : /profile /statistics
 *   AppQyV1Dict.php   (app_qy_v1)               : /query_all_groups /query_gwords
 *   AppQyV1Words.php  (app_qy_v1/words, sanctum): /daily /search/{query}
 *   AppQyV1System.php (app_qy_v1/system)        : /supported-languages
 *   MediaBrowseController (app_qy_v1/media)       : /media/books /media/subtitles (public),
 *                                                   /media/documents (optional-auth, user-scoped)
 *   AppQyV1Vocabulary.php (app_qy_v1/vocabulary)  : /vocabulary/libraries (public word libraries)
 *
 * The 2026-06-19 register 404 was exactly this: the HTTP impl posted to the bare
 * `/register` instead of `/api/app_qy_v1/register`. Always route through here.
 */

/** Laravel api.php mount (`/api`) + the AppQyV1 route prefix (`app_qy_v1`). */
export const WFNEW_API_BASE = APPQYV1_API_BASE;

/** Prefix a route suffix with the AppQyV1 base. */
const p = (suffix: string): string => `${WFNEW_API_BASE}${suffix}`;
const sentenceAudioPath = (text: string, language: string, variantKey?: string, passive = false): string =>
  p(`${APPQYV1_AI_TOOLS_ROUTES.ttsSentenceAudio}?text=${encodeURIComponent(text)}&language=${encodeURIComponent(language)}${
    variantKey ? `&variant_key=${encodeURIComponent(variantKey)}` : ''}${passive ? '&passive=1' : ''}`);

/**
 * Every backend path the /wordnew app uses. Static strings for fixed routes;
 * builder functions for routes that carry path/query params (so callers never
 * hand-concatenate a URL).
 */
export const WfNewApiPaths = {
  // ---- Auth (AppQyV1Auth.php — prefix app_qy_v1) ----
  register: p('/register'),
  login: p('/login'),
  logout: p('/logout'), // auth required
  forgotPassword: p('/forgot-password'),
  resetPassword: p('/reset-password'),
  /** One-click social login/register (Google/GitHub) — backend exchanges the OAuth code. */
  socialLogin: p('/auth/social'),
  /** Current authenticated user (echo) — GET, auth required. */
  currentUser: p('/user'),
  /** Link / unlink a social provider to the current account (auth:sanctum). */
  socialBind: p('/user/social/bind'),
  socialUnbind: p('/user/social/unbind'),
  /** Change password for the current account (auth:sanctum). Canonical global
   *  route (routes/api/auth.php) — AppQyV1 has no app-scoped variant; the same
   *  Sanctum token authorizes it. Fields: current_password / new_password /
   *  confirm_password. */
  changePassword: '/api/user/change-password',

  // ---- User profile (AppQyV1User.php — prefix app_qy_v1/user, auth:sanctum) ----
  userProfile: p('/user/profile'), // GET read / POST update
  userStatistics: p('/user/statistics'),
  /** Roaming account preferences: GET read / POST update (merges + returns full). */
  userPreferences: p('/user/preferences'),
  /** Avatar upload (POST multipart `avatar`) → { avatar, avatar_url }. */
  userAvatar: p('/user/avatar'),
  /** Preset-avatar gallery — NOTE: no backend route exists yet; the http impl
   *  probes this and falls back to the built-in set on any non-2xx. */
  avatarPresets: p('/user/avatar/presets'),
  /** Book reading progress — GET list / GET one / POST save (auth:sanctum). */
  userBookProgressList: (limit = 100): string => p(`/user/book-progress?limit=${limit}`),
  userBookProgress: (sourceKey: string): string =>
    p(`/user/book-progress/${encodeURIComponent(sourceKey)}`),
  /** Daily-reading playback progress — one row per authenticated user. */
  userDailyReadingProgress: p('/user/daily-reading-progress'),

  /** Guest device settings (PUBLIC) — browser fingerprint client_key. */
  clientDeviceSettings: (clientKey: string): string =>
    p(`/client/device-settings?client_key=${encodeURIComponent(clientKey)}`),
  clientDeviceSettingsSave: p('/client/device-settings'),

  // ---- AI Tools: TTS (AppQyV1AITools.php — prefix app_qy_v1/ai_tools/tts, PUBLIC) ----
  /** Available TTS voices = the Laravel audio library. GET → data.voices = { lang: voice_id }. */
  ttsVoices: p('/ai_tools/tts/voices'),
  recentAgentArticles: (limit = 20): string => p(`/ai_tools/article/worker/recent?limit=${limit}`),

  // ---- Sentence audio (book reader on-demand TTS) ----
  sentenceAudio: sentenceAudioPath,
  /** Insert missing sentence-audio tasks or move existing tasks to the queue head. */
  sentenceAudioHead: p('/ai_tools/tts/sentence/audio/head'),
  /** Insert or move word-audio tasks to the queue head. */
  wordAudioHead: p('/word/audio/head'),
  wordImageQueueAdd: p('/ai_tools/word_image/queue/add'),

  // ---- Learning languages (AppQyV1Learning.php — prefix app_qy_v1/learning, sanctum) ----
  /** GET native + learning_languages / POST to update them. */
  learningLanguages: p('/learning/languages'),
  sentenceWords: p('/learning/sentence-words'),
  sentenceWordsPlayed: p('/learning/sentence-words/played'),

  // ---- Groups & dictionary (AppQyV1Dict.php — prefix app_qy_v1) ----
  queryAllGroups: p('/query_all_groups'),
  /** Words inside one group, by group id. */
  queryGroupWords: (gid: string): string => p(`/query_gwords?gid=${encodeURIComponent(gid)}`),
  /** Paginated words of ONE group from group_word_progress (POST {gid, page, per_page,
   *  with_progress}). Unlike queryGroupWords (gwords only), this reads the Default
   *  Vocabulary Group's words and returns enriched text/translation/phonetic/audio/definition. */
  groupGetWords: p('/group/get_words'),
  groupProgressBlob: p('/group/get_progress_blob'),
  groupUpdateProgress: p('/group/update_progress'),

  // ---- Daily recitation (auth:sanctum) ----
  recitationLog: p('/recitation/log'),
  recitationTodayPlan: (params: { language?: string; limit?: number } = {}): string => {
    const query = new URLSearchParams();
    if (params.language) query.set('language', params.language);
    if (params.limit != null) query.set('limit', String(params.limit));
    const value = query.toString();
    return p(`/recitation/today-plan${value ? `?${value}` : ''}`);
  },
  recitationSummary: (date?: string): string =>
    p(`/recitation/summary${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  recitationStreak: p('/recitation/streak'),

  // ---- Media browse (MediaBrowseController — prefix app_qy_v1/media, PUBLIC) ----
  // Paginated source lists; each row carries title / language / count + image_url.
  /** Book sources (data.items[]): id, source_key, title, language, sentence_count, image_url. */
  mediaBooks: (page = 1, perPage = 24): string => p(`/media/books?page=${page}&per_page=${perPage}`),
  /** Ordered chapter list for one book (Books v3.1): data.chapters[] = {chapter_index,
   *  sentence_count, titles:{lang:title|null}}, data.languages[], data.chapter_count. */
  mediaBookChapters: (sourceKey: string): string =>
    p(`/media/books/${encodeURIComponent(sourceKey)}/chapters`),
  /** Book detail = source + paginated sentences (data.sentences.items[]). Optional
   *  chapter_index scopes verses to one chapter (book -> chapter -> verses). */
  mediaBookDetail: (
    sourceKey: string,
    opts: { page?: number; perPage?: number; chapterIndex?: number; grain?: string } = {},
  ): string => {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 200;
    let q = `?page=${page}&per_page=${perPage}`;
    if (opts.grain) q += `&grain=${encodeURIComponent(opts.grain)}`;
    if (opts.chapterIndex !== undefined && opts.chapterIndex !== null) {
      q += `&chapter_index=${opts.chapterIndex}`;
    }
    return p(`/media/books/${encodeURIComponent(sourceKey)}${q}`);
  },
  /** Subtitle/movie sources (data.items[]): + duration_sec, subtitle_count, sentence_count. */
  mediaSubtitles: (page = 1, perPage = 24): string => p(`/media/subtitles?page=${page}&per_page=${perPage}`),
  /** Subtitle detail = source + segments[] (clip mp3/mp4 urls) + paginated sentences
   *  (data.sentences.items[] with per-language text/audio). For the player + line list. */
  mediaSubtitleDetail: (
    sourceKey: string,
    opts: { page?: number; perPage?: number; grain?: string } = {},
  ): string => {
    const page = opts.page ?? 1;
    const perPage = opts.perPage ?? 500;
    let q = `?page=${page}&per_page=${perPage}`;
    if (opts.grain) q += `&grain=${encodeURIComponent(opts.grain)}`;
    return p(`/media/subtitles/${encodeURIComponent(sourceKey)}${q}`);
  },
  /** The user's own uploaded documents (data.items[]): id, title, language, word_count.
   *  Optional-auth: returns an empty page when unauthenticated (no 401). */
  mediaDocuments: (page = 1, perPage = 24): string => p(`/media/documents?page=${page}&per_page=${perPage}`),

  // ---- Vocabulary libraries (AppQyV1Vocabulary.php — prefix app_qy_v1/vocabulary, PUBLIC) ----
  // The PUBLIC word-library list (e.g. "English Coca 60000"). These are word
  // collections (词库), distinct from a user's uploaded documents (mediaDocuments).
  /** Vocabulary libraries (data.libraries[]): id, name, word_count, language, category, image_url. */
  vocabularyLibraries: (page = 1, perPage = 24): string => p(`/vocabulary/libraries?page=${page}&per_page=${perPage}`),
  /** Words of ONE public library (paginated): data.{library, words[], stats, pagination}.
   *  Each word: word, md5, translations[], phonetic, explanation, images[{url}], audio_url. */
  vocabularyLibraryWords: (libraryId: string, page = 1, perPage = 100): string =>
    p(`/vocabulary/libraries/${encodeURIComponent(libraryId)}/words?page=${page}&per_page=${perPage}`),

  // ---- Word media on-demand (AppQyV1 — file-first resolve + enqueue, PUBLIC) ----
  /** Resolve a word's media + dictionary detail by (lang, word). File-first:
   *  returns current image_url/audio_url + image_status/audio_status, and
   *  ENQUEUES+prioritizes generation for whatever is still 'pending'.
   *  Optional accent requests a specific rendition; passive mode is read-only. */
  wordMedia: (lang: string, word: string, options: WfNewWordMediaOptions = {}): string => {
    const params = new URLSearchParams();
    if (options.accent) params.set('accent', options.accent);
    if (options.passive) params.set('passive', '1');
    const query = params.toString();
    return p(`/word/${encodeURIComponent(lang)}/${encodeURIComponent(word)}/media${query ? `?${query}` : ''}`);
  },
  wordAudio: (lang: string, word: string, options: WfNewWordMediaOptions = {}): string => {
    const params = new URLSearchParams();
    if (options.accent) params.set('accent', options.accent);
    if (options.passive) params.set('passive', '1');
    const query = params.toString();
    return p(`/word/${encodeURIComponent(lang)}/${encodeURIComponent(word)}/audio${query ? `?${query}` : ''}`);
  },

  // ---- Dictionary words (AppQyV1Vocabulary.php — paginated, PUBLIC) ----
  /** Paginated dictionary words with audio + translation for the word-stats sidebar.
   *  data.{words[], total, start, limit, language}. `filter` e.g. 'all'|'has_audio'. */
  dictionaryWords: (opts: { language?: string; start?: number; limit?: number; filter?: string } = {}): string => {
    const params = new URLSearchParams();
    if (opts.language) params.set('language', opts.language);
    params.set('start', String(opts.start ?? 0));
    params.set('limit', String(opts.limit ?? 30));
    if (opts.filter) params.set('filter', opts.filter);
    return p(`/vocabulary/dictionary/words?${params.toString()}`);
  },

  // ---- Words (AppQyV1Words.php — prefix app_qy_v1/words, auth:sanctum) ----
  dailyWords: (count: number): string => p(`/words/daily?count=${count}`),
  searchWords: (query: string): string => p(`/words/search/${encodeURIComponent(query)}`),

  // ---- System (AppQyV1System.php — prefix app_qy_v1/system) ----
  supportedLanguages: p('/system/supported-languages'),

  // ---- Social (AppQyV1Social.php — prefix app_qy_v1/social, auth:sanctum) ----
  socialFriends: p('/social/friends'),
  socialSearch: (query: string, opts: { native?: string; target?: string } = {}): string => {
    const params = new URLSearchParams();
    params.set('q', query);
    if (opts.native) params.set('native', opts.native);
    if (opts.target) params.set('target', opts.target);
    return p(`/social/friends/search?${params.toString()}`);
  },
  socialFollow: p('/social/friends/follow'),
  socialUnfollow: p('/social/friends/unfollow'),
  socialLeaderboard: (period: 'week' | 'all'): string => p(`/social/leaderboard?period=${period}`),
  socialActivities: p('/social/activities'),
  /** Public profile of another user by id (GET /social/users/{id}) — powers the
   *  #/social/user/<id> profile modal (avatar, languages, stats, follow/friend state). */
  socialUser: (id: number): string => p(`/social/users/${id}`),

  // ---- Social v2: discover / friend-requests / chat / presence / notifications ----
  /** Language-partner discovery (GET): ?native=&target=&q=&limit=. */
  socialDiscover: (opts: { native?: string; target?: string; q?: string; limit?: number } = {}): string => {
    const params = new URLSearchParams();
    if (opts.native) params.set('native', opts.native);
    if (opts.target) params.set('target', opts.target);
    if (opts.q) params.set('q', opts.q);
    if (opts.limit != null) params.set('limit', String(opts.limit));
    const qs = params.toString();
    return p(`/social/discover${qs ? `?${qs}` : ''}`);
  },
  socialFriendRequest: p('/social/friends/request'),
  socialFriendRespond: p('/social/friends/respond'),
  socialFriendRequests: (direction: 'incoming' | 'outgoing' = 'incoming'): string =>
    p(`/social/friends/requests?direction=${direction}`),
  socialBlock: p('/social/friends/block'),
  socialLocation: p('/social/location'),
  socialNearby: (radiusKm = 50, limit = 50): string =>
    p(`/social/nearby?radius_km=${radiusKm}&limit=${limit}`),

  // Chat
  socialConversations: p('/social/conversations'),
  socialConversationMessages: (conversationId: number, cursor?: number | null): string => {
    const params = new URLSearchParams();
    params.set('limit', '50');
    if (cursor != null) params.set('cursor', String(cursor));
    return p(`/social/conversations/${conversationId}/messages?${params.toString()}`);
  },
  socialConversationSend: (conversationId: number): string => p(`/social/conversations/${conversationId}/messages`),
  socialConversationRead: (conversationId: number): string => p(`/social/conversations/${conversationId}/read`),

  // Presence
  socialPresenceHeartbeat: p('/social/presence/heartbeat'),
  socialPresence: (userIds: number[]): string => p(`/social/presence?user_ids=${userIds.join(',')}`),

  // Notifications
  socialNotifications: (cursor?: number | null, unreadOnly?: boolean): string => {
    const params = new URLSearchParams();
    if (cursor != null) params.set('cursor', String(cursor));
    if (unreadOnly) params.set('unread', '1');
    const qs = params.toString();
    return p(`/social/notifications${qs ? `?${qs}` : ''}`);
  },
  socialNotificationsUnreadCount: p('/social/notifications/unread-count'),
  socialNotificationRead: p('/social/notifications/read'),

  /** Per-user private Reverb connection and bounded cursor replay. */
  socialRealtimeConnection: p('/social/realtime/connection'),
  socialRealtimeEvents: (cursor?: number | null): string =>
    p(`/social/realtime/events${cursor != null ? `?cursor=${cursor}` : ''}`),

  // ---- Social Center: posts / comments (AppQyV1Social.php — prefix app_qy_v1/social) ----
  /** Plaza posts list (GET, auth required): ?cursor=&limit=&filter=all|images|videos|following.
   *  `author` is an OPTIONAL user-id scope for the profile page — the backend may
   *  not honor it yet (see WfNewApiHttp.getPosts); sent only when provided. */
  socialPosts: (opts: { cursor?: number | null; limit?: number; filter?: string; author?: number } = {}): string => {
    const params = new URLSearchParams();
    if (opts.cursor != null) params.set('cursor', String(opts.cursor));
    params.set('limit', String(opts.limit ?? 20));
    if (opts.filter && opts.filter !== 'all') params.set('filter', opts.filter);
    if (opts.author != null) params.set('author_id', String(opts.author));
    return p(`/social/posts?${params.toString()}`);
  },
  /** Create post (POST). */
  socialPostsCreate: p('/social/posts'),
  /** One post by id (GET) / delete (DELETE). */
  socialPost: (postId: number): string => p(`/social/posts/${postId}`),
  /** Like / unlike a post (POST). */
  socialPostLike: (postId: number): string => p(`/social/posts/${postId}/like`),
  socialPostUnlike: (postId: number): string => p(`/social/posts/${postId}/unlike`),
  /** Post comments list (GET) / add (POST), both auth required. */
  socialPostComments: (postId: number, cursor?: number | null): string => {
    const params = new URLSearchParams();
    if (cursor != null) params.set('cursor', String(cursor));
    const qs = params.toString();
    return p(`/social/posts/${postId}/comments${qs ? `?${qs}` : ''}`);
  },
  /** Delete one comment (DELETE). */
  socialPostComment: (postId: number, commentId: number): string =>
    p(`/social/posts/${postId}/comments/${commentId}`),
  /** Attach images (POST multipart images[]) / a video clip (POST multipart video). */
  socialPostImages: (postId: number): string => p(`/social/posts/${postId}/images`),
  socialPostVideo: (postId: number): string => p(`/social/posts/${postId}/video`),

  // ---- Social Center: live (AppQyV1Social.php — prefix app_qy_v1/social) ----
  /** Live sessions list (GET, auth required): ?status=live|all. */
  socialLive: (status: 'live' | 'all' = 'live'): string => p(`/social/live?status=${status}`),
  /** Start a live session (POST). */
  socialLiveCreate: p('/social/live'),
  /** End a live session (POST). */
  socialLiveEnd: (liveId: number): string => p(`/social/live/${liveId}/end`),
  /** Viewer heartbeat (POST) → { viewer_count }. */
  socialLiveHeartbeat: (liveId: number): string => p(`/social/live/${liveId}/heartbeat`),
  /** Live room chat list (GET) / send (POST), both auth required. */
  socialLiveChat: (liveId: number, cursor?: number | null): string => {
    const params = new URLSearchParams();
    if (cursor != null) params.set('cursor', String(cursor));
    const qs = params.toString();
    return p(`/social/live/${liveId}/chat${qs ? `?${qs}` : ''}`);
  },
  socialLiveChatSend: (liveId: number): string => p(`/social/live/${liveId}/chat`),

  // ---- Vocabulary group membership (AppQyV1Dict.php — auth:sanctum) ----
  /** Add a vocabulary library to a word group (POST {gid, library_id}). */
  groupAddLibrary: p('/group/add_library'),
  /** Non-mutating preview of adding a library to a word group (POST {gid, library_id}). */
  groupPreviewAddLibrary: p('/group/preview_add_library'),
} as const;

/**
 * Health-check path. NOT app_qy_v1-scoped — it is the top-level `/api/health`
 * marker the endpoint manager probes (see WfNewEndpoints). Declared here so the
 * center holds every path, but kept separate from the AppQyV1 group.
 */
export const WFNEW_HEALTH_PATH = '/api/health';

/**
 * Loopback debug-status probe (dashboard surface, NOT app_qy_v1). The backend
 * decides super-admin mode from the CLIENT IP (DebugAuthService) — same open
 * endpoint laravel-manager probes for its login-free loopback mode.
 */
export const WFNEW_ADMIN_DEBUG_STATUS_PATH = '/api/dashboard/auth/debug-status';

/**
 * SUPER-ADMIN management paths — used ONLY by WfNewAdminApi against the pinned
 * page-origin base (never through wfNewEndpoints failover; see the WfNewAdminApi
 * header for why). Kept in this file so the endpoint catalog stays complete.
 * Verified against laravel_main routes/AppQyV1Router/{AppQyV1Vocabulary,
 * AppQyV1AITools,AppQyV1Learning,AppQyV1Assist}.php.
 */
export const WfNewAdminPaths = {
  // ---- dictionary word management (AppQyV1Vocabulary.php — PUBLIC) ----
  /** Paginated dictionary rows: ?language=&filter=&q=&sort=&order=&start=&limit=. */
  dictionaryWords: (opts: {
    language: string; filter?: string; q?: string;
    sort?: string; order?: 'asc' | 'desc'; start?: number; limit?: number;
  }): string => {
    const params = new URLSearchParams();
    params.set('language', opts.language);
    if (opts.filter && opts.filter !== 'all') params.set('filter', opts.filter);
    if (opts.q) params.set('q', opts.q);
    if (opts.sort) params.set('sort', opts.sort);
    if (opts.order) params.set('order', opts.order);
    params.set('start', String(opts.start ?? 0));
    params.set('limit', String(opts.limit ?? 50));
    return p(`/dictionary/words?${params.toString()}`);
  },
  /** Create a word (POST {language, content, ...editable}). */
  dictionaryWordCreate: p('/dictionary/words'),
  /** Update a word (PUT {language, ...editable}). */
  dictionaryWord: (md5: string): string => p(`/dictionary/words/${encodeURIComponent(md5)}`),
  /** Delete a word (DELETE ?language=). */
  dictionaryWordDelete: (md5: string, language: string): string =>
    p(`/dictionary/words/${encodeURIComponent(md5)}?language=${encodeURIComponent(language)}`),
  /** Batch actions (POST {language, md5s[], action: delete|mark_valid|mark_invalid|requeue_tts}). */
  dictionaryWordsBatch: p('/dictionary/words/batch'),
  /** Example sentences containing a word (GET). */
  dictionarySentences: (word: string, language: string, limit = 10): string =>
    p(`/dictionary/sentences?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}&limit=${limit}`),

  // ---- statistics / overview (PUBLIC) ----
  /** Per-language words/translated/audio/invalid aggregate. */
  languageBreakdown: p('/vocabulary/language-breakdown'),
  /** Library-catalog statistics: summary + per-language rows. */
  vocabularyStatistics: (language?: string): string =>
    p(`/vocabulary/statistics${language ? `?language=${encodeURIComponent(language)}` : ''}`),

  // ---- vocabulary libraries management (reads PUBLIC; delete sanctum) ----
  /** Library catalog page (management view — richer opts than vocabularyLibraries). */
  adminLibraries: (opts: { language?: string; page?: number; perPage?: number; search?: string } = {}): string => {
    const params = new URLSearchParams();
    if (opts.language) params.set('language', opts.language);
    params.set('page', String(opts.page ?? 1));
    params.set('per_page', String(opts.perPage ?? 24));
    if (opts.search) params.set('search', opts.search);
    return p(`/vocabulary/libraries?${params.toString()}`);
  },
  /** Delete a user-created library (DELETE, auth:sanctum). */
  learningLibrary: (libraryId: number | string): string =>
    p(`/learning/libraries/${encodeURIComponent(String(libraryId))}`),
  /** Reset failed/pending AI covers (POST {ids[]} | {all:true}, PUBLIC). */
  coverRetry: p('/assist/cover/retry'),

  // ---- queues (PUBLIC) ----
  /** Unified TTS queue statistics snapshot. */
  /** GET /ai_tools/tts/sentence/audio — file-first sentence audio resolve. */
  sentenceAudio: sentenceAudioPath,

  ttsQueueStats: p(APPQYV1_AI_TOOLS_ROUTES.ttsQueueStats),
  /** Paginated TTS queue items: ?status=&type=&start=&limit=. */
  ttsQueueItems: (opts: { status?: string; type?: string; start?: number; limit?: number } = {}): string => {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.type) params.set('type', opts.type);
    params.set('start', String(opts.start ?? 0));
    params.set('limit', String(opts.limit ?? 50));
    return p(`${APPQYV1_AI_TOOLS_ROUTES.ttsQueueItems}?${params.toString()}`);
  },
  /** Translation-queue control plane (PUBLIC — pycore monitor surface). */
  translationQueueList: p(APPQYV1_AI_TOOLS_ROUTES.translationQueueList),
  translationPendingWords: p('/ai_tools/translation/queue/pending-words'),
  translationEnqueuePending: p('/ai_tools/translation/queue/enqueue-pending'),
  /** Re-queue specific words (POST, custom.authenticate — needs session). */
  translationBatchAdd: p(APPQYV1_AI_TOOLS_ROUTES.translationBatchAdd),

  // ---- translate / TTS tools (translate + generate are auth:sanctum) ----
  translationLanguages: p(APPQYV1_AI_TOOLS_ROUTES.translationLanguages),
  translationTranslate: p(APPQYV1_AI_TOOLS_ROUTES.translationTranslate),
  ttsGenerate: p(APPQYV1_AI_TOOLS_ROUTES.ttsGenerate),
} as const;
