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
export const WFNEW_API_BASE = '/api/app_qy_v1';

/** Prefix a route suffix with the AppQyV1 base. */
const p = (suffix: string): string => `${WFNEW_API_BASE}${suffix}`;

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
  /** Current authenticated user (echo) — GET, auth required. */
  currentUser: p('/user'),

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

  // ---- Learning languages (AppQyV1Learning.php — prefix app_qy_v1/learning, sanctum) ----
  /** GET native + learning_languages / POST to update them. */
  learningLanguages: p('/learning/languages'),

  // ---- Groups & dictionary (AppQyV1Dict.php — prefix app_qy_v1) ----
  queryAllGroups: p('/query_all_groups'),
  /** Words inside one group, by group id. */
  queryGroupWords: (gid: string): string => p(`/query_gwords?gid=${encodeURIComponent(gid)}`),

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
  /** The user's own uploaded documents (data.items[]): id, title, language, word_count.
   *  Optional-auth: returns an empty page when unauthenticated (no 401). */
  mediaDocuments: (page = 1, perPage = 24): string => p(`/media/documents?page=${page}&per_page=${perPage}`),

  // ---- Vocabulary libraries (AppQyV1Vocabulary.php — prefix app_qy_v1/vocabulary, PUBLIC) ----
  // The PUBLIC word-library list (e.g. "English Coca 60000"). These are word
  // collections (词库), distinct from a user's uploaded documents (mediaDocuments).
  /** Vocabulary libraries (data.libraries[]): id, name, word_count, language, category, image_url. */
  vocabularyLibraries: (page = 1, perPage = 24): string => p(`/vocabulary/libraries?page=${page}&per_page=${perPage}`),

  // ---- Words (AppQyV1Words.php — prefix app_qy_v1/words, auth:sanctum) ----
  dailyWords: (count: number): string => p(`/words/daily?count=${count}`),
  searchWords: (query: string): string => p(`/words/search/${encodeURIComponent(query)}`),

  // ---- System (AppQyV1System.php — prefix app_qy_v1/system) ----
  supportedLanguages: p('/system/supported-languages'),

  // ---- Social (AppQyV1Social.php — prefix app_qy_v1/social, custom.authenticate) ----
  socialFriends: p('/social/friends'),
  socialSearch: (query: string): string => p(`/social/friends/search?q=${encodeURIComponent(query)}`),
  socialFollow: p('/social/friends/follow'),
  socialUnfollow: p('/social/friends/unfollow'),
  socialLeaderboard: (period: 'week' | 'all'): string => p(`/social/leaderboard?period=${period}`),
  socialActivities: p('/social/activities'),
} as const;

/**
 * Health-check path. NOT app_qy_v1-scoped — it is the top-level `/api/health`
 * marker the endpoint manager probes (see WfNewEndpoints). Declared here so the
 * center holds every path, but kept separate from the AppQyV1 group.
 */
export const WFNEW_HEALTH_PATH = '/api/health';
