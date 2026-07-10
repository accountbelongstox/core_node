/** WordflowApiMethods - method groups (auth, learning, word actions, public content,
 * word groups, group media, learning progress, daily recitation) extracted from
 * WordflowApiService so the main class file stays under the 800-line modular limit.
 * WordflowApiService extends this class; methods use this.transport / this.currentLanguage
 * / this.token as before (inherited properties). */
import type {
  WordGroup, Word, WfPublicLibrary, WfBookSummary, WfSubtitleSummary,
  WfBookListResult, WfSubtitleListResult, WfMediaContentDetail,
  WfGroupMediaSource, WfAddMediaSourceResult, WfGroupSourcesResult,
  WfRecitationAction, WfRecitationLogWord, WfRecitationToday,
  WfRecitationLogResult, WfRecitationPlanWord, WfRecitationTodayPlan,
  WfRecitationSummary, VocabularyRecommendation, PersonalDictionaryEntry,
  ArticlePreviewResult, ArticleSubmitResult, ArticleTaskStatus,
  GroupProgressStats, WfProgressEntryShort, WfProgressEntry,
  WfGroupProgressBlob, WfGroupProgressUpdate, WfMediaSentence,
  WfSentenceAudioResolve,
} from './wordflowApiTypes';
import type { WordflowTransport } from './WordflowApi';

import { WordflowApiGroupMethods } from './wordflowGroupMethods';
export class WordflowApiMethods extends WordflowApiGroupMethods {
  protected publicMediaCache!: Map<string, { ts: number; data: any }>;
  protected invalidatePublicMediaCache!: () => void;
  protected logWordflowFailure!: (msg: string, error: any, lang?: string) => void;

  // ---- Auth ----

  async login(email: string, password: string) {
    // The AppQyV1 login controller authenticates by `username` (it never reads
    // `email`); CommonAuthService matches it against username OR email OR phone,
    // so sending whatever the user typed as `username` is correct.
    //
    // Verified backend shape (AppQyV1AuthenticationLoginController::login →
    // CommonAuthService::createLoginResponse + legacy fields):
    //   {
    //     success, message,
    //     token,            // legacy top-level copy of data.login_token
    //     login_by,
    //     data: { user, login_token (Sanctum Bearer), user_token,
    //             user_token_expires_at, token_type, login_by, expiration,
    //             multi_device_enabled }
    //   }
    // request() unwraps the envelope to `data`, which drops the legacy
    // top-level `token` — so the Bearer token must be read from `login_token`.
    // Tolerate both unwrapped and raw shapes and normalize to { token, user }.
    const result = await this.request<any>('/login', {
      method: 'POST',
      body: JSON.stringify({ username: email, password }),
    });
    const data = result && result.data ? result.data : result;
    const token: string | undefined =
      (data && data.login_token) ||
      (result && result.token) ||
      (data && data.token) ||
      (data && data.user_token);
    const user: User | undefined = data ? data.user : undefined;
    if (user) {
      StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000);
    }
    return { ...data, token, user } as { token: string; user: User };
  }

  /**
   * Register a new account. Verified backend
   * (AppQyV1AuthenticationRegistrationController::apiStore): `username` +
   * `password` required; `email` / `nickname` / `invite_code` optional.
   * Failure modes: duplicate username → 400 'Username already exists';
   * unknown invite code → 400 'Invalid invite code'; exhausted/expired code →
   * 400 'Invite code is expired or already used'.
   * A successful registration returns the same login envelope as /login
   * (data.login_token is the Sanctum Bearer token — see login() for the full
   * envelope notes), i.e. registering immediately logs the user in. Normalized
   * to { token, user } exactly like login().
   */
  async register(payload: {
    username: string;
    password: string;
    email?: string;
    nickname?: string;
    invite_code?: string;
    /** Catalog learning-language codes chosen at sign-up (multi-select). The
     * backend validates these against /system/supported-languages and persists
     * them on the user (defaults to ['en'] when omitted). */
    learning_languages?: string[];
    /** Native language code (optional; backend defaults to 'zh'). */
    native_language?: string;
  }) {
    const result = await this.request<any>('/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = result && result.data ? result.data : result;
    const token: string | undefined =
      (data && data.login_token) ||
      (result && result.token) ||
      (data && data.token) ||
      (data && data.user_token);
    const user: User | undefined = data ? data.user : undefined;
    if (user) {
      StorageCenter.cache.invalidate(StorageKey.USER_PROFILE_CACHE);
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000);
    }
    return { ...data, token, user } as { token: string; user: User };
  }

  async getUserProfile() {
    const cached = await StorageCenter.cache.get<User>(StorageKey.USER_PROFILE_CACHE);
    if (cached) return cached;

    // Live-verified shape: GET /user/profile → data.{ user: {...} } — the
    // profile is nested under `user`. Unwrap it; tolerate older flat shapes.
    const res = await this.request<any>('/user/profile');
    const user: User = res && typeof res === 'object' && res.user ? (res.user as User) : (res as User);
    if (user) {
      StorageCenter.cache.set(StorageKey.USER_PROFILE_CACHE, user, 5 * 60 * 1000);
    }
    return user;
  }

  async getSupportedLanguages() {
    const cached = await StorageCenter.cache.get<any>(StorageKey.SUPPORTED_LANGUAGES_CACHE);
    if (cached) return cached;

    const languages = await this.request('/system/supported-languages');
    if (languages) {
      StorageCenter.cache.set(StorageKey.SUPPORTED_LANGUAGES_CACHE, languages, 24 * 60 * 60 * 1000);
    }
    return languages;
  }

  // ---- Learning content ----

  async getWordGroups(): Promise<WordGroup[]> {
    const cached = await StorageCenter.cache.get<WordGroup[]>(StorageKey.WORD_GROUPS_CACHE);
    if (cached) return cached;

    try {
      const response = await this.request<{ uid: string; total: number; groups: BackendGroupData[] }>(
        '/query_all_groups'
      );

      let groups: WordGroup[] = [];
      if (response && response.groups && Array.isArray(response.groups)) {
        groups = response.groups.map((bg: BackendGroupData) => ({
          id: bg.gid,
          name: bg.gname,
          count: bg.total_words || 0,
          type: bg.type || 'user',
          progress: bg.progress || 0,
          // Live-verified: /query_all_groups groups carry `cover_url` /
          // `thumbnail_url` (absolute URLs), not `cover_image`.
          coverImage: bg.cover_image || bg.thumbnail_url || bg.cover_url || '📚',
          language: bg.language || inferLanguageFromWords(bg.gwords || []) || 'en',
          description: bg.description,
        }));
      } else if (Array.isArray(response)) {
        groups = response as any as WordGroup[];
      } else {
        throw new Error('Unexpected response format from backend');
      }

      if (groups && Array.isArray(groups) && groups.length > 0) {
        StorageCenter.cache.set(StorageKey.WORD_GROUPS_CACHE, groups, 5 * 60 * 1000);
      }
      return groups;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch word groups:', formatWordflowRequestError(error, this.currentLanguage).message);
      // Degrade gracefully instead of throwing so pages can show an empty state.
      return [];
    }
  }

  async getWordsForGroup(groupId: string): Promise<Word[]> {
    // Live-verified shape: GET /query_gwords?gid= → data.{ gid, gname,
    // gwords: [...], words_frequency, ... } — the word list lives under
    // `gwords`, not at the top level. Tolerate bare-array / { words } shapes.
    const res = await this.request<any>(`/query_gwords?gid=${encodeURIComponent(groupId)}`);
    if (Array.isArray(res)) return res as Word[];
    if (Array.isArray(res?.gwords)) return res.gwords as Word[];
    if (Array.isArray(res?.words)) return res.words as Word[];
    return [];
  }

  async getWordDetail(wordId: string) {
    return this.request<Word>(`/words/${wordId}`);
  }

  // ---- Word actions ----
  // Backend routes: AppQyV1Words.php — POST /words/{id}/favorite, /words/{id}/learn,
  // /words/{id}/review (auth:sanctum, same Bearer token).
  // Implemented server-side on 2026-06-12 (AppQyV1WordQueryController::toggleFavorite,
  // AppQyV1WordLearningStatusController::markAsLearned / markAsReviewed) — the
  // earlier 500 "Method ... does not exist" responses are gone. Optimistic
  // update + rollback in callers is still good practice for offline tolerance.

  async toggleWordFavorite(wordId: string | number) {
    return this.request<any>(`/words/${encodeURIComponent(String(wordId))}/favorite`, {
      method: 'POST',
    });
  }

  async markWordLearned(wordId: string | number) {
    return this.request<any>(`/words/${encodeURIComponent(String(wordId))}/learn`, {
      method: 'POST',
    });
  }

  async markWordReviewed(wordId: string | number) {
    return this.request<any>(`/words/${encodeURIComponent(String(wordId))}/review`, {
      method: 'POST',
    });
  }

  async getQuizSession() {
    return this.request<QuizQuestion[]>('/quiz/generate');
  }

  async getRetentionStats() {
    return this.request<RetentionStat[]>('/user/stats/retention');
  }

  async analyzeCourse(groupId: string) {
    return this.request<CourseAnalysis>(`/word-groups/${groupId}/analysis`);
  }

  /**
   * Featured / recommended vocabulary libraries for the learning home.
   * Degrades to an empty list when the backend is unreachable.
   */
  async getRecommendedLibraries(): Promise<VocabularyRecommendation[]> {
    const cached = await StorageCenter.cache.get<VocabularyRecommendation[]>(
      StorageKey.RECOMMENDED_LIBRARIES_CACHE
    );
    if (cached) return cached;

    const normalize = (response: any): VocabularyRecommendation[] => {
      const list = Array.isArray(response)
        ? response
        : Array.isArray(response?.recommendations)
          ? response.recommendations
          : Array.isArray(response?.libraries)
            ? response.libraries
            : [];
      // Live-verified: /learning/recommendations items already match
      // VocabularyRecommendation; the /vocabulary/libraries/recommended
      // fallback items use { word_count, language, difficulty: string } — fill
      // the keys the pages read (total_words / lang_code / level) defensively.
      return list.map((it: any) => ({
        ...it,
        total_words: it.total_words ?? it.word_count ?? 0,
        lang_code: it.lang_code ?? it.language ?? '',
        level: it.level ?? (typeof it.difficulty === 'string' ? it.difficulty : '') ?? '',
      }));
    };

    try {
      // Verified backend route: GET /learning/recommendations. Falls back to
      // the recommended-libraries route if that path is unavailable.
      let list: VocabularyRecommendation[] = [];
      try {
        list = normalize(await this.request<any>('/learning/recommendations'));
      } catch (primaryError) {
        console.warn(
          '[WordflowApi] /learning/recommendations failed, falling back to /vocabulary/libraries/recommended:',
          primaryError
        );
        list = normalize(await this.request<any>('/vocabulary/libraries/recommended'));
      }
      if (list.length > 0) {
        StorageCenter.cache.set(StorageKey.RECOMMENDED_LIBRARIES_CACHE, list, 30 * 60 * 1000);
      }
      return list;
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch recommended libraries:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  // ---- Public content (vocabulary libraries / books / subtitles) ----
  // PUBLIC GETs — no auth required, anonymous browsing works. Media lists are
  // served by MediaBrowseController (Laravel paginator: items / total /
  // per_page / current_page / last_page; live-verified 2026-06-12).

  /** Read-through helper for the in-memory public-content list cache. */
  private async cachedPublicList<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
    const hit = this.publicMediaCache.get(cacheKey);
    if (hit && Date.now() - hit.ts < PUBLIC_MEDIA_CACHE_TTL) {
      return hit.value as T;
    }
    const value = await fetcher();
    this.publicMediaCache.set(cacheKey, { ts: Date.now(), value });
    return value;
  }

  /** Drop the in-memory public-content list cache (books / subtitles /
   *  vocabulary libraries) so the next call re-fetches. */
  invalidatePublicMediaCache() {
    this.publicMediaCache.clear();
  }

  /**
   * PUBLIC list of synced books (GET /media/books?language=&search=&page=&per_page=,
   * MediaBrowseController::books). Cached in memory ~10 min per param set;
   * degrades to an empty page when the backend is unreachable so anonymous
   * pages render an inline empty state.
   */
  async getPublicBooks(
    params: { language?: string; search?: string; page?: number; perPage?: number } = {}
  ): Promise<WfBookListResult> {
    const qs = new URLSearchParams();
    if (params.language) qs.set('language', params.language);
    if (params.search) qs.set('search', params.search);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.perPage != null) qs.set('per_page', String(params.perPage));
    const endpoint = `/media/books${qs.toString() ? `?${qs.toString()}` : ''}`;
    try {
      return await this.cachedPublicList<WfBookListResult>(endpoint, async () => {
        const res = await this.request<any>(endpoint);
        const items: any[] = Array.isArray(res?.items) ? res.items : [];
        return {
          total: Number(res?.total ?? items.length),
          per_page: Number(res?.per_page ?? params.perPage ?? 20),
          current_page: Number(res?.current_page ?? params.page ?? 1),
          last_page: Number(res?.last_page ?? 1),
          books: items.map((it: any): WfBookSummary => ({
            id: Number(it?.id ?? 0),
            source_key: String(it?.source_key ?? ''),
            title: String(it?.title ?? it?.original_name ?? it?.source_key ?? ''),
            original_name: it?.original_name ?? null,
            language: String(it?.language ?? ''),
            sentence_count: Number(it?.sentence_count ?? 0),
            has_audio: !!it?.has_audio,
            synced_at: it?.synced_at ?? null,
            image_url: it?.image_url ?? null,
            poster_status: it?.poster_status ?? null,
          })),
        };
      });
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch public books:', formatWordflowRequestError(error, this.currentLanguage).message);
      return {
        total: 0,
        per_page: params.perPage ?? 20,
        current_page: params.page ?? 1,
        last_page: 1,
        books: [],
      };
    }
  }

  /**
   * PUBLIC list of synced subtitles (GET /media/subtitles?language=&search=&page=&per_page=,
   * MediaBrowseController::subtitles). Same caching/degrade behavior as
   * getPublicBooks().
   */
  async getPublicSubtitles(
    params: { language?: string; search?: string; page?: number; perPage?: number } = {}
  ): Promise<WfSubtitleListResult> {
    const qs = new URLSearchParams();
    if (params.language) qs.set('language', params.language);
    if (params.search) qs.set('search', params.search);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.perPage != null) qs.set('per_page', String(params.perPage));
    const endpoint = `/media/subtitles${qs.toString() ? `?${qs.toString()}` : ''}`;
    try {
      return await this.cachedPublicList<WfSubtitleListResult>(endpoint, async () => {
        const res = await this.request<any>(endpoint);
        const items: any[] = Array.isArray(res?.items) ? res.items : [];
        return {
          total: Number(res?.total ?? items.length),
          per_page: Number(res?.per_page ?? params.perPage ?? 20),
          current_page: Number(res?.current_page ?? params.page ?? 1),
          last_page: Number(res?.last_page ?? 1),
          subtitles: items.map((it: any): WfSubtitleSummary => ({
            id: Number(it?.id ?? 0),
            source_key: String(it?.source_key ?? ''),
            title: String(it?.title ?? it?.original_name ?? it?.source_key ?? ''),
            original_name: it?.original_name ?? null,
            language: String(it?.language ?? ''),
            duration_sec: Number(it?.duration_sec ?? 0),
            subtitle_count: Number(it?.subtitle_count ?? 0),
            segment_count: Number(it?.segment_count ?? 0),
            sentence_count: Number(it?.sentence_count ?? 0),
            synced_at: it?.synced_at ?? null,
            image_url: it?.image_url ?? null,
            poster_status: it?.poster_status ?? null,
          })),
        };
      });
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch public subtitles:', formatWordflowRequestError(error, this.currentLanguage).message);
      return {
        total: 0,
        per_page: params.perPage ?? 20,
        current_page: params.page ?? 1,
        last_page: 1,
        subtitles: [],
      };
    }
  }

  /**
   * PUBLIC vocabulary libraries (anonymous OK; live-verified 2026-06-12).
   * Primary: GET /vocabulary/libraries/recommended?language= → data.libraries[]
   * — the REAL library rows whose ids /group/add_library expects (8 real
   * English libraries on this box, e.g. id=3 "English Coca 60000").
   * Fallback: GET /vocabulary/libraries. `language` accepts the 2-char UI code
   * and is mapped to the backend's FULL name ('en' → 'english'). ~10 min
   * in-memory cache; degrades to [] when the backend is unreachable.
   *
   * Distinct surface from getRecommendedLibraries(): that one is the
   * /learning/recommendations card feed (lang_code/total_words/level shape);
   * this one is the raw public library list (word_count/difficulty/image_url).
   */
  async getPublicVocabularyLibraries(language?: string): Promise<WfPublicLibrary[]> {
    const fullName = toFullLanguageName(language);
    const qs = fullName ? `?language=${encodeURIComponent(fullName)}` : '';
    const cacheKey = `/vocabulary/libraries${qs}#public`;
    const normalize = (res: any): WfPublicLibrary[] => {
      const list = Array.isArray(res?.libraries)
        ? res.libraries
        : Array.isArray(res)
          ? res
          : [];
      return list.map((it: any): WfPublicLibrary => ({
        id: Number(it?.id ?? 0),
        name: String(it?.name ?? ''),
        description: String(it?.description ?? ''),
        word_count: Number(it?.word_count ?? it?.total_words ?? 0),
        language: String(it?.language ?? it?.lang_code ?? ''),
        difficulty: String(it?.difficulty ?? it?.level ?? ''),
        category: String(it?.category ?? ''),
        image_url: it?.image_url ?? null,
        cover_status: it?.cover_status ?? null,
        cover_error_message: it?.cover_error_message ?? null,
        cover_attempts: Number(it?.cover_attempts ?? 0),
        is_recommended: !!it?.is_recommended,
        tags: Array.isArray(it?.tags) ? it.tags : [],
      }));
    };
    try {
      return await this.cachedPublicList<WfPublicLibrary[]>(cacheKey, async () => {
        try {
          return normalize(await this.request<any>(`/vocabulary/libraries/recommended${qs}`));
        } catch (primaryError) {
          console.warn(
            '[WordflowApi] /vocabulary/libraries/recommended failed, falling back to /vocabulary/libraries:',
            primaryError
          );
          return normalize(await this.request<any>(`/vocabulary/libraries${qs}`));
        }
      });
    } catch (error) {
      console.error('[WordflowApi] Failed to fetch public vocabulary libraries:', formatWordflowRequestError(error, this.currentLanguage).message);
      return [];
    }
  }

  /**
   * PUBLIC sentence-paged detail of one book/subtitle
   * (GET /media/content/{type}/{id}?start=&limit=). NOT cached and rethrows on
   * failure — detail pages must surface the real error, never a fake page.
   */
  async getMediaContentDetail(
    type: 'book' | 'subtitle',
    id: number | string,
    opts: { start?: number; limit?: number } = {}
  ): Promise<WfMediaContentDetail> {
    const qs = new URLSearchParams();
    if (opts.start != null) qs.set('start', String(opts.start));
    if (opts.limit != null) qs.set('limit', String(opts.limit));
    return this.request<WfMediaContentDetail>(
      `/media/content/${encodeURIComponent(type)}/${encodeURIComponent(String(id))}${
        qs.toString() ? `?${qs.toString()}` : ''
      }`
    );
  }

  /**
   * Re-queue a failed/stuck library cover for pycore (pull-only generation).
   * POST /api/app_qy_v1/assist/cover/retry { ids:[libraryId] } resets that row
   * to `pending` (cover_attempts=0, lease + error cleared) so the AssistWorker
   * re-claims and regenerates it. No-auth assist group; mirrors laravel-manager's
   * api.appQyV1.retryCover. Callers should refetch the library list afterwards.
   */
  async retryCover(libraryId: number): Promise<any> {
    return this.request<any>('/assist/cover/retry', {
      method: 'POST',
      body: JSON.stringify({ ids: [libraryId] }),
    });
  }

  /**
   * On-demand movie/TV poster fetch + backfill for one book/subtitle
   * (MOVIE_POSTER_PIPELINE.md §7). POST /media/poster/fetch
   * { type, id?, source_key? } → MoviePosterClient (TMDB→OMDB, CJK titles
   * translated first), saves the local file and returns the fresh
   * { image_url, poster_status }. Optional/non-blocking: callers should refetch
   * the list afterwards. Pass an id OR a source_key (id preferred).
   */
  async retryPoster(
    type: 'book' | 'subtitle',
    target: { id?: number | string; sourceKey?: string }
  ): Promise<{ image_url?: string | null; poster_status?: string | null } | any> {
    const body: Record<string, unknown> = { type };
    if (target.id != null) body.id = target.id;
    if (target.sourceKey) body.source_key = target.sourceKey;
    return this.request<any>('/media/poster/fetch', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // ---- Word groups (CRUD) ----
  // Verified backend routes: AppQyV1Dict.php (/create_group, /delete_group_by_gid,
  // /group/add_library, /query_group_by_gid).

  async getGroupById(gid: string) {
    return this.request<BackendGroupData>(`/query_group_by_gid?gid=${encodeURIComponent(gid)}`);
  }

  async createGroup(payload: { name: string; description?: string; language?: string }) {
    const result = await this.request<any>('/create_group', {
      method: 'POST',
      body: JSON.stringify({ gname: payload.name, ...payload }),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Append word STRINGS to a group addressed by name, creating the group when
   * it does not exist yet. Verified backend
   * (AppQyV1WordGroupCreationController::createDictGroup): /create_group is an
   * upsert — an existing `gname` gets the new gwords/gcontent APPENDED and its
   * word-frequency map refreshed. `gcontent` is required; `language` must be a
   * 2-char code when present. Success data { gid, uid, did, gname, new_words,
   * words_frequency, gwords_count, gcontent_count, ... }. This is the
   * words-by-string path: /group/add_word only accepts integer
   * vocabulary-item ids, so raw extracted/parsed words must go through here.
   */
  async addWordsToGroup(
    gname: string,
    words: string[],
    opts: { gcontent?: string; language?: string } = {}
  ) {
    const gwords = words.join('\n');
    const body: Record<string, any> = {
      gname,
      gcontent: opts.gcontent && opts.gcontent.trim() ? opts.gcontent : gwords,
      gwords,
    };
    if (opts.language && opts.language.length === 2) body.language = opts.language;
    const result = await this.request<any>('/create_group', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  async deleteGroupByGid(gid: string) {
    const result = await this.request<any>('/delete_group_by_gid', {
      method: 'POST',
      body: JSON.stringify({ gid }),
    });
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  async addLibraryToGroup(gid: string, libraryId: number | string) {
    let result: any;
    try {
      result = await this.request<any>('/group/add_library', {
        method: 'POST',
        body: JSON.stringify({ gid, library_id: libraryId }),
      });
    } catch (error: any) {
      // The already-linked case arrives as HTTP 400 (error_code
      // LIBRARY_ALREADY_ADDED) with data {already_linked: true, words_added: 0}
      // — surface it as a normal result so callers can show the proper
      // "already in this group" feedback instead of a generic failure.
      const body = error?.body;
      const alreadyData = body?.data?.already_linked ? body.data : null;
      if (alreadyData || body?.error_code === 'LIBRARY_ALREADY_ADDED') {
        return alreadyData ?? { already_linked: true, words_added: 0, gid, library_id: libraryId };
      }
      throw error;
    }
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Remove a library from a group. Verified backend
   * (AppQyV1WordGroupLibraryController::removeLibraryFromGroup): payload
   * { gid, library_id }; success data { gid, library_id }; failure 400 with
   * error_code LIBRARY_NOT_LINKED, or GROUP_NOT_FOUND.
   */
  async removeLibraryFromGroup(gid: string, libraryId: number | string) {
    const result = await this.request<{ gid: string; library_id: number | string }>(
      '/group/remove_library',
      {
        method: 'POST',
        body: JSON.stringify({ gid, library_id: libraryId }),
      }
    );
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Remove word(s) from a group. Verified backend
   * (AppQyV1WordGroupWordController::removeWordFromGroup): payload { gid,
   * word_id } or { gid, word_ids: [...] } — ids are the vocabulary-item integer
   * ids. Success data { gid, words_removed, total_requested }; note the call
   * still succeeds (words_removed: 0) when the word was not in the group.
   */
  async removeWordFromGroup(payload: {
    gid: string;
    word_id?: number | string;
    word_ids?: Array<number | string>;
  }) {
    const result = await this.request<{ gid: string; words_removed: number; total_requested: number }>(
      '/group/remove_word',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    await StorageCenter.cache.invalidate(StorageKey.WORD_GROUPS_CACHE);
    return result;
  }

  /**
   * Paged word list of a group, optionally with per-user progress. Verified
   * backend (AppQyV1WordGroupWordController::getGroupWords): success data
   * { gid, gname, total_words, page, per_page, words: [{ word_id, word,
   * word_index, language_code, added_at, proficiency?, read_count?,
   * review_count?, last_read_at?, next_review_at? }] }. per_page max is 100.
   */
  async getGroupWords(
    gid: string,
    opts: { page?: number; perPage?: number; withProgress?: boolean } = {}
  ) {
    return this.request<any>('/group/get_words', {
      method: 'POST',
      body: JSON.stringify({
        gid,
        page: opts.page ?? 1,
        per_page: opts.perPage ?? 100,
        with_progress: opts.withProgress ?? true,
      }),
    });
  }

  /**
   * Libraries linked to a group. Verified backend
   * (AppQyV1WordGroupLibraryController::getGroupLibraries): success data
   * { gid, gname, libraries_count, libraries: [{ id, name, language,
   * total_words, added_at }] }.
   */
  async getGroupLibraries(gid: string) {
    return this.request<any>('/group/get_libraries', {
      method: 'POST',
      body: JSON.stringify({ gid }),
    });
  }
}
