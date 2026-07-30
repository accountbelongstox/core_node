/**
 * WfNewApiHttp — live/real implementation of the WfNewApi contract.
 *
 * Talks to the AppQyV1 backend (laravel_main, Octane :9000) through the wordnew
 * endpoint manager (WfNewEndpoints), which picks an available endpoint from the
 * configured list (STORED-FIRST, availability-first failover). Every request
 * waits for endpoint detection, then hits the current endpoint's base URL.
 *
 * Implements the exact same `WfNewApi` interface as WfNewApiMock and returns the
 * exact same types from ./WfNewApiTypes — keep the two in lock-step.
 *
 * Coverage note (honest, no silent gaps):
 *   - REAL backend data: getWordGroups / getBentoGroups / getVocabulary /
 *     getUserProfile / getUserStats / getWalkmanWords.
 *   - searchDictionary has no stable public endpoint here yet, so it returns []
 *     and the UI fuzzy-filters its loaded word pool (logged once).
 *   - Subtitles / Bilingual / Analytics are curated CONTENT with no dedicated
 *     backend endpoint yet, so this impl serves the same curated datasets the
 *     mock uses (logged once). When real endpoints land, swap those bodies to a
 *     fetch call — the interface and types do not change.
 *
 * Selected via ./index.ts. See ./README.md.
 */
import type {
  WfNewApi, Word, WordGroup, BentoGroup, UserProfile, UserStats,
  SubtitleCourse, BilingualSentence, AnalyticsStats,
  WfNewAuthResult, WfNewAuthUser, WfNewRegisterPayload, WfNewPreferences,
  WfNewLanguage, WfNewLanguageSelection, WfNewAvatarResult,
  WfNewFriend, WfNewUserSearchResult, WfNewLeaderboardEntry, WfNewActivity,
  WfNewDiscoverUser, WfNewFriendRequest, WfNewConversation, WfNewMessage,
  WfNewMessagePage, WfNewNotification, WfNewNotificationPage, WfNewPresenceInfo,
  WfNewPresenceStatus,
  WfNewSocialActor, WfNewPostImage, WfNewPost, WfNewPostPage, WfNewPostComment,
  WfNewPostCommentPage, WfNewPostLikeResult, WfNewCreatePostPayload, WfNewPostFilter,
  WfNewPostType, WfNewPostVisibility, WfNewLive, WfNewLiveStatus, WfNewCreateLivePayload,
  WfNewLiveMsg, WfNewLiveMsgPage,
  WfNewContentGroup, WfNewHomeContent, WfNewStatistics,
  WfNewBookChapters, WfNewBookChapter, WfNewBookVersesPage, WfNewBookVerse, WfNewBookVerseLang,
  WfNewSubtitleDetail, WfNewSubtitleSegment, WfNewSubtitleSentence, WfNewDictWord, WfNewWordPage,
  WfNewLibraryWord, WfNewLibraryWordsPage, WfNewWordMedia,
  WfNewWordAccent, WfNewWordAudioVariant,
} from './WfNewApiTypes';
import { WfNewApiPaths } from './WfNewApiPaths';
import {
  absUrl, toBookVerse, normPresence, toMessage, toNotification,
  toActor, toPostImage, toPost, toComment, toLive, toLiveMsg,
} from './WfNewApiMappers';
import { socialMethods } from './methods/social';
import { learningMethods } from './methods/learning';
import { WFNEW_BUILTIN_LANGUAGES, WFNEW_BUILTIN_PRESET_AVATARS } from './WfNewApiDefaults';
import {
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
} from '../WfNewMockDb';


// Transport core + word mappers extracted (see WfNewApiTransport / WfNewApiMappers).
import {
  getJSON, authedGetJSON, postJSON, postMultipart, deleteJSON,
  setToken, authToken, authExpiredSubs, unwrapEnvelope, toAuthResult,
} from './WfNewApiTransport';
import {
  toWord, toGroup, decorate, asArray, logContentFallback, toAbsoluteUrl,
  wordRowToContentGroup, mediaRowToContentGroup, libraryRowToContentGroup, documentRowToContentGroup,
} from './WfNewApiMappers';

// --- implementation -------------------------------------------------------- #


export const wfNewApiHttp: WfNewApi = {
  // ---- Session ----
  isAuthenticated(): boolean {
    return !!authToken;
  },

  onAuthExpired(cb: () => void): () => void {
    authExpiredSubs.add(cb);
    return () => authExpiredSubs.delete(cb);
  },

  // ---- Auth ----
  async login(identifier: string, password: string): Promise<WfNewAuthResult> {
    // The AppQyV1 login controller authenticates by `username`, but
    // CommonAuthService matches it against username OR email OR phone — so the
    // raw identifier the user typed is sent as `username`.
    const res = await postJSON<any>(WfNewApiPaths.login, { username: identifier, password });
    const result = toAuthResult(res);
    if (result.token) setToken(result.token);
    else console.warn('[WfNewApiHttp] login succeeded but no token was found in the response — authed calls will 401.');
    return result;
  },

  async register(payload: WfNewRegisterPayload): Promise<WfNewAuthResult> {
    // avatar is UI-only (emoji) — the backend does not persist it, so it is not
    // sent. Everything else maps straight onto the registration controller.
    const res = await postJSON<any>(WfNewApiPaths.register, {
      username: payload.username,
      password: payload.password,
      email: payload.email,
      nickname: payload.nickname,
      native_language: payload.native_language,
      learning_languages: payload.learning_languages,
      invite_code: payload.invite_code,
    });
    const result = toAuthResult(res);
    if (result.token) setToken(result.token);
    return result;
  },

  async logout(): Promise<void> {
    // Best-effort server-side revoke; the local token is cleared regardless.
    try {
      if (authToken) await postJSON(WfNewApiPaths.logout, {});
    } catch {
      /* ignore — clearing the local token below is what matters */
    }
    setToken(null);
  },

  // ---- Social login + account management ----
  async socialLogin(cred): Promise<WfNewAuthResult> {
    // The frontend only forwards the OAuth code; the backend (POST /auth/social)
    // exchanges it with the server-side client secret, verifies the provider
    // profile, finds-or-creates the user (matching users.google_id/github_id),
    // and returns the normal login envelope.
    const res = await postJSON<any>(WfNewApiPaths.socialLogin, {
      provider: cred.provider,
      code: cred.code,
      id_token: cred.idToken,
      redirect_uri: cred.redirectUri,
      state: cred.state,
      code_verifier: cred.codeVerifier,
    });
    const result = toAuthResult(res);
    if (result.token) setToken(result.token);
    else console.warn('[WfNewApiHttp] socialLogin succeeded but no token was found — authed calls will 401.');
    return result;
  },

  async bindProvider(cred): Promise<void> {
    await postJSON(WfNewApiPaths.socialBind, {
      provider: cred.provider,
      code: cred.code,
      id_token: cred.idToken,
      redirect_uri: cred.redirectUri,
      state: cred.state,
      code_verifier: cred.codeVerifier,
    });
  },

  async unbindProvider(provider): Promise<void> {
    await postJSON(WfNewApiPaths.socialUnbind, { provider });
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await postJSON(WfNewApiPaths.changePassword, {
      old_password: oldPassword,
      new_password: newPassword,
      new_password_confirmation: newPassword,
    });
  },

  async updateProfile(patch): Promise<WfNewAuthUser> {
    // POST /user/profile accepts { nickname, name, bio, location, phone, email }.
    const res = await postJSON<any>(WfNewApiPaths.userProfile, patch);
    const data = (unwrapEnvelope(res) as any) || {};
    const user = data.user && typeof data.user === 'object' ? data.user : data;
    return (user && typeof user === 'object' ? user : {}) as WfNewAuthUser;
  },

  async getPreferences(): Promise<WfNewPreferences> {
    // GET /user/preferences returns the merged defaults+stored set under `data`.
    return (await authedGetJSON<WfNewPreferences>(WfNewApiPaths.userPreferences, null)) || {};
  },

  async updatePreferences(patch: WfNewPreferences): Promise<WfNewPreferences> {
    // POST merges server-side and echoes the full updated set (envelope-wrapped).
    const res = await postJSON<any>(WfNewApiPaths.userPreferences, patch);
    return (unwrapEnvelope(res) as WfNewPreferences) || {};
  },

  async getSupportedLanguages(): Promise<WfNewLanguage[]> {
    try {
      const rows = await getJSON<any[]>(WfNewApiPaths.supportedLanguages);
      const list = Array.isArray(rows) ? rows : [];
      const mapped: WfNewLanguage[] = list
        // Only 2-char codes are savable via setUserLanguages (size:2).
        .filter((r) => typeof r?.code === 'string' && r.code.length === 2)
        .map((r) => ({
          code: r.code,
          name: typeof r.name === 'string' && r.name ? r.name : r.code,
          native_name: typeof r.native_name === 'string' && r.native_name ? r.native_name : r.name || r.code,
        }));
      return mapped.length ? mapped : [...WFNEW_BUILTIN_LANGUAGES];
    } catch {
      return [...WFNEW_BUILTIN_LANGUAGES];
    }
  },

  async getLearningLanguages(): Promise<WfNewLanguageSelection> {
    const res = await authedGetJSON<any>(WfNewApiPaths.learningLanguages, null);
    const learning = Array.isArray(res?.learning_languages) ? res.learning_languages : [];
    const native = typeof res?.native_language === 'string' && res.native_language ? res.native_language : 'zh';
    return { native_language: native, learning_languages: learning.length ? learning : ['en'] };
  },

  async setLearningLanguages(selection: WfNewLanguageSelection): Promise<WfNewLanguageSelection> {
    const res = await postJSON<any>(WfNewApiPaths.learningLanguages, {
      learning_languages: selection.learning_languages,
      native_language: selection.native_language,
    });
    const data = unwrapEnvelope(res) || {};
    return {
      native_language: data.native_language ?? selection.native_language,
      learning_languages: Array.isArray(data.learning_languages) ? data.learning_languages : selection.learning_languages,
    };
  },

  async uploadAvatar(file: File): Promise<WfNewAvatarResult> {
    const form = new FormData();
    form.append('avatar', file);
    const response = await postMultipart<any>(WfNewApiPaths.userAvatar, form);
    const data = unwrapEnvelope(response) || {};
    return { avatar: data.avatar ?? '', avatar_url: data.avatar_url ?? '' };
  },

  async getPresetAvatars(): Promise<string[]> {
    // No backend preset gallery exists yet — probe, and fall back to built-ins.
    try {
      const res = await getJSON<any>(WfNewApiPaths.avatarPresets);
      const list = Array.isArray(res) ? res : Array.isArray(res?.presets) ? res.presets : [];
      const presets = list.filter((v: any) => typeof v === 'string' && v);
      return presets.length ? presets : [...WFNEW_BUILTIN_PRESET_AVATARS];
    } catch {
      return [...WFNEW_BUILTIN_PRESET_AVATARS];
    }
  },

  ...socialMethods,
  ...learningMethods,

  // ---- Home content groups (words / books / subtitles / documents) ----

  async getWordContentGroups(): Promise<WfNewContentGroup[]> {
    // Auth-required — no token -> [] without a request (home browse works logged out).
    const res = await authedGetJSON<any>(WfNewApiPaths.queryAllGroups, null);
    return asArray(res, 'groups').map(wordRowToContentGroup);
  },

  async getBookGroups(page = 1, perPage = 24): Promise<WfNewContentGroup[]> {
    const res = await getJSON<any>(WfNewApiPaths.mediaBooks(page, perPage));
    return asArray(res, 'items').map((r, i) => mediaRowToContentGroup(r, 'book', (page - 1) * perPage + i));
  },

  async getSubtitleGroups(page = 1, perPage = 24): Promise<WfNewContentGroup[]> {
    const res = await getJSON<any>(WfNewApiPaths.mediaSubtitles(page, perPage));
    return asArray(res, 'items').map((r, i) => mediaRowToContentGroup(r, 'subtitle', (page - 1) * perPage + i));
  },

  async getLibraryGroups(page = 1, perPage = 24): Promise<WfNewContentGroup[]> {
    // Public word-library list (e.g. "English Coca 60000") — word collections, not docs.
    const res = await getJSON<any>(WfNewApiPaths.vocabularyLibraries(page, perPage));
    return asArray(res, 'libraries').map((r, i) => libraryRowToContentGroup(r, (page - 1) * perPage + i));
  },

  async getDocumentGroups(): Promise<WfNewContentGroup[]> {
    // The user's OWN uploaded documents — auth-required. No token -> [] without a
    // request (so logged-out home browse never fires the 401/404 on /media/documents).
    const res = await authedGetJSON<any>(WfNewApiPaths.mediaDocuments(), null);
    return asArray(res, 'items').map(documentRowToContentGroup);
  },

  async getHomeContent(): Promise<WfNewHomeContent> {
    // All five categories in parallel; PARTIAL-TOLERANT — a category whose endpoint
    // fails resolves to [] instead of failing the whole home. Auth-only categories
    // (words, documents) self-gate via authedGetJSON: they resolve to [] WITHOUT a
    // request when logged out, so the home browse never 401s/404s pre-login while
    // the public categories (books/subtitles/libraries) still load for everyone.
    const [words, books, subtitles, libraries, documents] = await Promise.all([
      this.getWordContentGroups().catch(() => [] as WfNewContentGroup[]),
      this.getBookGroups().catch(() => [] as WfNewContentGroup[]),
      this.getSubtitleGroups().catch(() => [] as WfNewContentGroup[]),
      this.getLibraryGroups().catch(() => [] as WfNewContentGroup[]),
      this.getDocumentGroups().catch(() => [] as WfNewContentGroup[]),
    ]);
    return { words, books, subtitles, libraries, documents };
  },

  async getRecentAgentArticles(limit = 20): Promise<import('./WfNewApiTypes').WfNewAgentArticle[]> {
    const res = await getJSON<any>(WfNewApiPaths.recentAgentArticles(limit));
    const rows = Array.isArray(res?.articles)
      ? res.articles
      : Array.isArray(res?.rows) ? res.rows : Array.isArray(res?.items) ? res.items : [];
    return rows.map((item: any, index: number) => ({
      id: String(item?.id ?? item?.article_id ?? item?.source_key ?? item?.title_en ?? item?.title ?? `article-${index}`),
      title: String(item?.title ?? item?.title_en ?? 'Article'),
      title_en: item?.title_en ?? item?.title ?? null,
      title_cn: item?.title_cn ?? null,
      reference_cn: item?.reference_cn ?? null,
      article_en: item?.article_en ?? null,
      source_key: item?.source_key ?? item?.article_id ?? null,
      article_id: item?.article_id ?? null,
      audio_url: item?.audio_url ? (absUrl(item.audio_url) ?? null) : null,
      word_count: item?.word_count ?? null,
      published_at: item?.created_at ?? item?.published_at ?? null,
      reading_date: item?.reading_date ?? item?.created_at ?? null,
      created_at: item?.created_at ?? null,
      document_id: item?.document_id ?? null,
    }));
  },

  // ---- Book reading (book -> chapter -> verses) ----

  async getBookChapters(sourceKey: string): Promise<WfNewBookChapters> {
    const res = await getJSON<any>(WfNewApiPaths.mediaBookChapters(sourceKey));
    const chapters: WfNewBookChapter[] = (Array.isArray(res?.chapters) ? res.chapters : []).map((c: any) => ({
      chapterIndex: Number(c?.chapter_index ?? 0),
      corrId: c?.corr_id ?? undefined,
      sentenceCount: Number(c?.sentence_count ?? 0),
      titles: c && typeof c.titles === 'object' && c.titles ? c.titles : {},
    }));
    return {
      sourceKey: res?.source_key ?? sourceKey,
      languages: Array.isArray(res?.languages) ? res.languages : [],
      chapterCount: Number(res?.chapter_count ?? chapters.length),
      chapters,
    };
  },

  async getBookVerses(
    sourceKey: string,
    opts: { chapterIndex?: number; page?: number; perPage?: number; grain?: string } = {},
  ): Promise<WfNewBookVersesPage> {
    const res = await getJSON<any>(WfNewApiPaths.mediaBookDetail(sourceKey, opts));
    const page = res?.sentences ?? {};
    const items: WfNewBookVerse[] = (Array.isArray(page?.items) ? page.items : []).map(toBookVerse);
    const currentPage = Number(page?.current_page ?? opts.page ?? 1);
    const perPage = Number(page?.per_page ?? items.length);
    const total = Number(page?.total ?? items.length);
    const lastPage = Number(page?.last_page ?? (perPage > 0 ? Math.max(1, Math.ceil(total / perPage)) : 1));
    return {
      items,
      total,
      perPage,
      currentPage,
      lastPage,
      hasMore: page?.has_more != null ? !!page.has_more : currentPage < lastPage,
    };
  },

  // ---- Subtitle playback + word stats ----

  async getSubtitleDetail(
    sourceKey: string,
    opts: { page?: number; perPage?: number; grain?: string } = {},
  ): Promise<WfNewSubtitleDetail> {
    const res = await getJSON<any>(WfNewApiPaths.mediaSubtitleDetail(sourceKey, opts));
    const src = res?.source ?? {};
    const segments: WfNewSubtitleSegment[] = (Array.isArray(res?.segments) ? res.segments : []).map((s: any) => ({
      segIndex: Number(s?.seg_index ?? 0),
      startSec: Number(s?.start_sec ?? 0),
      endSec: Number(s?.end_sec ?? 0),
      subtitleCount: Number(s?.subtitle_count ?? 0) || undefined,
      mp3Url: absUrl(s?.mp3_url) ?? null,
      mp4Url: absUrl(s?.mp4_url) ?? null,
      fullMp4Url: absUrl(s?.full_mp4_url) ?? null,
    }));
    const page = res?.sentences ?? {};
    const items: WfNewSubtitleSentence[] = (Array.isArray(page?.items) ? page.items : []).map((v: any) => ({
      grain: v?.grain ?? 'sentence',
      seq: Number(v?.seq ?? 0),
      segIndex: v?.seg_index ?? undefined,
      startSec: v?.start_sec ?? undefined,
      endSec: v?.end_sec ?? undefined,
      text: v?.text ?? null,
      language: v?.language ?? null,
      audio: absUrl(v?.audio) ?? null,
      languages: v && typeof v.languages === 'object' && v.languages
        ? Object.fromEntries(Object.entries(v.languages).map(([k, val]: [string, any]) => [k, { text: val?.text ?? null, audio: absUrl(val?.audio) ?? null }]))
        : undefined,
    }));
    return {
      sourceKey: src?.source_key ?? sourceKey,
      title: src?.title ?? src?.original_name ?? sourceKey,
      language: src?.language ?? undefined,
      durationSec: src?.duration_sec ?? undefined,
      segments,
      sentences: {
        items,
        total: Number(page?.total ?? items.length),
        perPage: Number(page?.per_page ?? items.length),
        currentPage: Number(page?.current_page ?? 1),
        lastPage: Number(page?.last_page ?? 1),
      },
    };
  },

  async getDictionaryWords(
    opts: { language?: string; start?: number; limit?: number; filter?: string } = {},
  ): Promise<WfNewWordPage> {
    const res = await getJSON<any>(WfNewApiPaths.dictionaryWords(opts));
    const rows = Array.isArray(res?.words) ? res.words : [];
    const words: WfNewDictWord[] = rows.map((w: any) => {
      // translations can be a map/array/string — pick the first usable text.
      let translation: string | undefined;
      const t = w?.translations;
      if (typeof t === 'string') translation = t;
      else if (Array.isArray(t)) translation = t.find((x) => typeof x === 'string') ?? (t[0]?.translation ?? t[0]?.text);
      else if (t && typeof t === 'object') translation = (Object.values(t).find((x) => typeof x === 'string') as string) ?? undefined;
      return {
        content: w?.content ?? '',
        md5: w?.md5 ?? '',
        phonetic: w?.phonetic ?? w?.us_phonetic ?? w?.uk_phonetic ?? undefined,
        usPhonetic: w?.us_phonetic ?? undefined,
        ukPhonetic: w?.uk_phonetic ?? undefined,
        translation,
        hasTranslation: !!w?.has_translation,
        audioUrl: absUrl(w?.audio_url) ?? null,
        ttsStatus: w?.tts_status ?? undefined,
      };
    });
    return {
      words,
      total: Number(res?.total ?? words.length),
      start: Number(res?.start ?? opts.start ?? 0),
      limit: Number(res?.limit ?? opts.limit ?? words.length),
      language: res?.language ?? opts.language ?? 'english',
    };
  },

  async getLibraryWords(
    libraryId: string,
    opts: { page?: number; perPage?: number } = {},
  ): Promise<WfNewLibraryWordsPage> {
    const page = Math.max(1, Number(opts.page ?? 1));
    const perPage = Math.min(2000, Math.max(1, Number(opts.perPage ?? 100)));
    const res = await getJSON<any>(WfNewApiPaths.vocabularyLibraryWords(libraryId, page, perPage));
    const lib = res?.library ?? {};
    const rows = Array.isArray(res?.words) ? res.words : [];
    const words: WfNewLibraryWord[] = rows.map((w: any) => {
      const t = w?.translations;
      const translations: string[] = Array.isArray(t)
        ? t.filter((x: any) => typeof x === 'string')
        : (typeof t === 'string' && t ? [t] : []);
      const images: string[] = Array.isArray(w?.images)
        ? w.images.map((im: any) => absUrl(typeof im === 'string' ? im : im?.url)).filter(Boolean) as string[]
        : [];
      return {
        index: Number(w?.index ?? 0),
        word: w?.word ?? '',
        md5: w?.md5 ?? '',
        phonetic: w?.phonetic ?? w?.us_phonetic ?? w?.uk_phonetic ?? undefined,
        usPhonetic: w?.us_phonetic ?? undefined,
        ukPhonetic: w?.uk_phonetic ?? undefined,
        explanation: w?.explanation ?? undefined,
        translations,
        images,
        audioUrl: absUrl(w?.audio_url) ?? null,
        hasTranslation: !!w?.has_translation || translations.length > 0,
        hasAudio: !!w?.has_audio || !!w?.audio_available,
        hasImage: !!w?.has_image || images.length > 0,
        isValid: w?.is_valid !== false,
      };
    });
    const pg = res?.pagination ?? {};
    const st = res?.stats ?? {};
    return {
      library: {
        id: String(lib?.id ?? libraryId),
        name: lib?.name ?? '',
        totalWords: Number(lib?.total_words ?? pg?.total ?? 0) || 0,
        language: lib?.language ?? 'english',
      },
      words,
      stats: {
        total: Number(st?.total ?? pg?.total ?? words.length) || 0,
        translated: Number(st?.translated ?? 0) || 0,
        withAudio: Number(st?.with_audio ?? 0) || 0,
        withImage: Number(st?.with_image ?? 0) || 0,
        invalid: Number(st?.invalid ?? 0) || 0,
      },
      pagination: {
        currentPage: Number(pg?.current_page ?? page) || page,
        perPage: Number(pg?.per_page ?? perPage) || perPage,
        total: Number(pg?.total ?? words.length) || 0,
        lastPage: Number(pg?.last_page ?? 1) || 1,
        hasMore: !!pg?.has_more,
      },
    };
  },

  async getWordMedia(
    language: string,
    word: string,
    opts: { accent?: WfNewWordAccent } = {},
  ): Promise<WfNewWordMedia> {
    const res = await getJSON<any>(WfNewApiPaths.wordMedia(language, word, opts.accent));
    const t = res?.translations;
    const translations: string[] = Array.isArray(t)
      ? t.filter((x: any) => typeof x === 'string')
      : (typeof t === 'string' && t ? [t] : []);
    // Accent additions (contract C1) — all optional so pre-accent backends still map.
    const isAccent = (v: any): v is WfNewWordAccent | 'unknown' =>
      v === 'us' || v === 'uk' || v === 'unknown';
    const audioVariants: WfNewWordAudioVariant[] = Array.isArray(res?.audio_variants)
      ? res.audio_variants
          .filter((v: any) => v && isAccent(v.accent))
          .map((v: any): WfNewWordAudioVariant => ({
            accent: v.accent,
            url: absUrl(v.url) ?? null,
            status: v.status === 'ready' ? 'ready' : 'pending',
          }))
      : [];
    return {
      word: res?.word ?? word,
      md5: res?.md5 ?? '',
      language: res?.language ?? language,
      imageUrl: absUrl(res?.image_url) ?? null,
      audioUrl: absUrl(res?.audio_url) ?? null,
      imageStatus: res?.image_status === 'ready' ? 'ready' : 'pending',
      audioStatus: res?.audio_status === 'ready' ? 'ready' : 'pending',
      audioAccent: isAccent(res?.audio_accent) ? res.audio_accent : null,
      accentFallback: !!res?.accent_fallback,
      audioVariants,
      translations,
      explanation: res?.explanation ?? undefined,
      phonetic: res?.phonetic ?? undefined,
      usPhonetic: res?.us_phonetic ?? undefined,
      ukPhonetic: res?.uk_phonetic ?? undefined,
    };
  },

  async resolveSentenceAudio(text: string, language: string, variantKey?: string) {
    const res = await getJSON<any>(WfNewApiPaths.sentenceAudio(text, language, variantKey));
    return {
      exists: !!res?.exists,
      url: res?.url ?? null,
      queued: !!res?.queued,
      content_id: res?.content_id ?? res?.hash ?? undefined,
      hash: res?.hash ?? res?.content_id ?? undefined,
      tts_status: res?.tts_status ?? null,
      audio_files: Array.isArray(res?.audio_files) ? res.audio_files : [],
    };
  },

  async getBookReadingProgress(sourceKey: string) {
    if (!authToken) return null;
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.userBookProgress(sourceKey), null);
      const p = res?.progress;
      if (!p) return null;
      return {
        sourceKey: p.source_key ?? sourceKey,
        chapterIndex: p.chapter_index ?? null,
        verseSeq: Number(p.verse_seq ?? 0),
        grain: p.grain ?? 'sentence',
        page: Number(p.page ?? 1),
        updatedAt: p.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async saveBookReadingProgress(
    sourceKey: string,
    payload: { chapterIndex?: number | null; verseSeq: number; grain?: string; page?: number },
  ) {
    if (!authToken) return null;
    try {
      const raw = await postJSON<any>(WfNewApiPaths.userBookProgress(sourceKey), {
        chapter_index: payload.chapterIndex ?? null,
        verse_seq: payload.verseSeq,
        grain: payload.grain ?? 'sentence',
        page: payload.page ?? 1,
      });
      const res = unwrapEnvelope(raw);
      const p = res?.progress;
      if (!p) return null;
      return {
        sourceKey: p.source_key ?? sourceKey,
        chapterIndex: p.chapter_index ?? null,
        verseSeq: Number(p.verse_seq ?? 0),
        grain: p.grain ?? 'sentence',
        page: Number(p.page ?? 1),
        updatedAt: p.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async listBookReadingProgress(limit = 100) {
    if (!authToken) return [];
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.userBookProgressList(limit), { items: [] });
      const items = Array.isArray(res?.items) ? res.items : [];
      return items.map((p: any) => ({
        sourceKey: p.source_key ?? '',
        chapterIndex: p.chapter_index ?? null,
        verseSeq: Number(p.verse_seq ?? 0),
        grain: p.grain ?? 'sentence',
        page: Number(p.page ?? 1),
        updatedAt: p.updated_at ?? null,
      }));
    } catch {
      return [];
    }
  },

  async getClientDeviceSettings(clientKey: string) {
    try {
      const res = await getJSON<any>(WfNewApiPaths.clientDeviceSettings(clientKey));
      const s = res?.settings;
      if (!s) return null;
      return {
        clientKey: s.client_key ?? clientKey,
        reader: s.reader ?? null,
        updatedAt: s.updated_at ?? null,
      };
    } catch {
      return null;
    }
  },

  async saveClientDeviceSettings(
    clientKey: string,
    reader: import('./WfNewApiTypes').WfNewReaderSettingsBlob,
    updatedAt?: string,
  ) {
    try {
      const res = await postJSON<any>(WfNewApiPaths.clientDeviceSettingsSave, {
        client_key: clientKey,
        reader,
        updated_at: updatedAt ?? new Date().toISOString(),
      });
      const s = unwrapEnvelope(res)?.settings ?? res?.settings;
      if (!s) return null;
      return {
        clientKey: s.client_key ?? clientKey,
        reader: s.reader ?? reader,
        updatedAt: s.updated_at ?? updatedAt ?? null,
      };
    } catch {
      return null;
    }
  },

  async addLibraryToDefaultGroup(libraryId) {
    const groupsRes = await authedGetJSON<any>(WfNewApiPaths.queryAllGroups, null);
    const all: any[] = asArray(groupsRes, 'groups');
    const def = all.find((g: any) => g.gname === 'Default Vocabulary Group');
    if (!def) throw new Error('Default Vocabulary Group not found');
    const res = await postJSON<any>(WfNewApiPaths.groupAddLibrary, {
      gid: String(def.gid),
      library_id: Number(libraryId),
    });
    const data = unwrapEnvelope(res) ?? res;
    return {
      gid: String(data?.gid ?? def.gid),
      library_id: Number(data?.library_id ?? libraryId),
      library_name: data?.library_name ?? '',
      already_linked: !!(data?.already_linked),
      words_added: Number(data?.words_added ?? 0),
      total_words_in_library: Number(data?.total_words_in_library ?? 0),
    };
  },

  async previewAddLibraryToDefaultGroup(libraryId) {
    const groupsRes = await authedGetJSON<any>(WfNewApiPaths.queryAllGroups, null);
    const all: any[] = asArray(groupsRes, 'groups');
    const def = all.find((g: any) => g.gname === 'Default Vocabulary Group');
    if (!def) throw new Error('Default Vocabulary Group not found');
    const res = await postJSON<any>(WfNewApiPaths.groupPreviewAddLibrary, {
      gid: String(def.gid),
      library_id: Number(libraryId),
    });
    const data = unwrapEnvelope(res) ?? res;
    const sb: any = data?.status_breakdown ?? {};
    return {
      gid: String(data?.gid ?? def.gid),
      library_id: Number(data?.library_id ?? libraryId),
      library_name: data?.library_name ?? '',
      already_linked: !!(data?.already_linked),
      current_in_group: Number(data?.current_in_group ?? 0),
      library_total: Number(data?.library_total ?? 0),
      to_add: Number(data?.to_add ?? 0),
      projected_total: Number(data?.projected_total ?? 0),
      duplicates: Array.isArray(data?.duplicates)
        ? data.duplicates.map((d: any) => ({ word_id: Number(d?.word_id), word: String(d?.word ?? '') }))
        : [],
      duplicates_count: Number(data?.duplicates_count ?? 0),
      language_match: data?.language_match !== false,
      status_breakdown: {
        read: Number(sb?.read ?? 0),
        memorized: Number(sb?.memorized ?? 0),
        due: Number(sb?.due ?? 0),
        total: Number(sb?.total ?? 0),
      },
    };
  },
};
