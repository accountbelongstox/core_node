/** useWfNewContentHandlers - content loading, practice/quiz/search handlers
 * extracted from useWfNewAppState so the main hook stays under the 800-line
 * modular limit. Takes state as a deps object; returns all handler functions. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { wfNewApi, wfNewEndpoints, WORDNEW_API_HEALTH_EVENT } from '../api';
import type {
  Word, WordGroup, BentoGroup, WfNewContentGroup, WfNewContentKind,
  WfNewHomeContent, WfNewStatistics, WfNewLanguage,
} from '../api';
import type { PreviewAddLibraryResult } from '../api/types/api';
import type { WfNewCachedKind } from '../runtime-store/WfNewContentCache';
import {
  getCachedGroups, getCachedGroupIds, putCachedGroups, getCachedWords, putCachedWords, dedupGroups,
} from '../runtime-store/WfNewContentCache';
import { wfNewSettings } from '../WfNewSettingsStore';
import { wordNewProgressCenter } from '../services/WordNewProgressCenter';
import { wordNewQueueCenter } from '../services/WordNewQueueCenter';
import { wfNewStudyProgress } from '../components/study/WfNewStudyProgress';
import { isDefaultVocabularyGroup } from '../api';
import { wfNewPageHeader, type WordNewTab } from './useWfNewAppState';
import { requestAuthLogin } from '../../../core/auth/AuthRequestCenter';

export function useWfNewContentHandlers(deps: Record<string, any>) {
  const {
    activeTab,
    addToast,
    applyCacheScope,
    bookReader,
    contentListKind,
    courseWords,
    currentUser,
    dark,
    favorites,
    gGroups,
    homeContent,
    homeCountRef,
    isListeningPlaying,
    isLoggedInRef,
    libraryRoute,
    listeningIntervalRef,
    loadMoreInFlight,
    newWordDef,
    newWordPhon,
    newWordText,
    newWordTransl,
    nickname,
    practiceIndex,
    practiceMode,
    quizAnswered,
    searchQuery,
    selectedCourse,
    setActiveTab,
    setAvatarUrl,
    setBentoGroups,
    setBookReader,
    setCourseWords,
    setCurrentUser,
    setFavorites,
    setGGroups,
    setHomeContent,
    setHomeContentLoading,
    setIsFlipped,
    setIsListeningPlaying,
    setLanguageOptions,
    setLibraryRoute,
    setWordGroupRouteId,
    setLoading,
    setNewWordDef,
    setNewWordPhon,
    setNewWordText,
    setNewWordTransl,
    setNickname,
    setPracticeIndex,
    setPracticeMode,
    setQuizAnswered,
    setQuizFeedback,
    setQuizScore,
    setQuizStreak,
    setReadParagraph,
    setSearchResults,
    setSearching,
    setSelectedCourse,
    setSelectedPracticeGroup,
    setSelectedQuizOption,
    setSelectedSubtitleKey,
    setSpeechRate,
    setStatistics,
    setUserStats,
    setWordPool,
    speechRate,
    trans,
    wordPool,
    wordGroupRouteId,
  } = deps;

  // Confirmation dialog state for "add a library to the Default Vocabulary Group":
  // opened by handleAddLibraryToStudy (fetches a non-mutating preview), then
  // resolved by confirmAddLibraryNow (performs the add) or closeAddLibraryConfirm.
  const [addLibraryConfirm, setAddLibraryConfirm] = useState<{
    group: WfNewContentGroup;
    loading: boolean;
    submitting: boolean;
    preview: PreviewAddLibraryResult | null;
    error: string | null;
  } | null>(null);

  const loadContent = async () => {
    setLoading(true);
    try {
      const [bento, groups, profile, stats, langs] = await Promise.all([
        wfNewApi.getBentoGroups(),
        wfNewApi.getWordGroups(),
        wfNewApi.getUserProfile(),
        // Rich stats (null when logged out — the dashboard locks that area).
        wfNewApi.getUserStatistics(),
        // Target-language options for the dashboard selector (falls back to built-ins).
        wfNewApi.getSupportedLanguages().catch(() => [] as WfNewLanguage[]),
      ]);
      setBentoGroups(Array.isArray(bento) ? bento : []);
      setGGroups(Array.isArray(groups) ? groups : []);
      // Ingest the backend progress blob of the Default Vocabulary Group on
      // every content load (app start / shelf), not just inside the study
      // panel, so the shelf card reads synced target/read/memorized state.
      // Best-effort: offline or logged-out keeps local-only progress.
      if (Array.isArray(groups) && wfNewApi.isAuthenticated()) {
        const defaultGroup = groups.find(isDefaultVocabularyGroup) ?? groups[0];
        if (defaultGroup?.id) {
          const gid = String(defaultGroup.id);
          wordNewProgressCenter
            .getBlob(gid)
            .then((blob) => wfNewStudyProgress.ingestBlob(gid, blob))
            .catch(() => undefined);
        }
      }
      setStatistics(stats ?? null);
      if (Array.isArray(langs) && langs.length) setLanguageOptions(langs);

      if (profile) {
        if (profile.nickname || profile.name) {
          setNickname(profile.nickname || profile.name || nickname);
        }
        setUserStats({
          learned: profile.learned_words ?? profile.totalLearned ?? 432,
          streak: profile.streak ?? 8,
          dailyGoal: wfNewSettings.get('dailyGoal'),
          dailyProgress: profile.dailyProgress ?? 12,
        });
      }

      // Seed a general distractor/search pool from the first group's words.
      const firstId = bento[0]?.id ?? groups[0]?.id;
      if (firstId) {
        const pool = await wfNewApi.getVocabulary(firstId);
        if (Array.isArray(pool) && pool.length > 0) setWordPool(pool);
      }
    } catch (e) {
      console.warn('[wordnew] Failed to load content from the API gateway.', e);
    } finally {
      setLoading(false);
    }
  };

  // The grid categories the home cache backs (documents intentionally NOT cached /
  // not shown in the hub). Each maps to its WfNewHomeContent field + API fetcher.
  // Home grid per-page size — must match the WfNewApi default perPage (24) so the
  // "a full page means there may be more" heuristic in loadMoreGroups holds.
  const HOME_PER_PAGE = 24;
  const HOME_GRID_KINDS: ReadonlyArray<{
    kind: WfNewCachedKind;
    key: keyof WfNewHomeContent;
    paged: boolean;                                   // word groups have no paging endpoint
    fetch: (page?: number) => Promise<WfNewContentGroup[]>;
  }> = [
    { kind: 'word', key: 'words', paged: false, fetch: () => wfNewApi.getWordContentGroups() },
    { kind: 'book', key: 'books', paged: true, fetch: (page) => wfNewApi.getBookGroups(page, HOME_PER_PAGE) },
    { kind: 'subtitle', key: 'subtitles', paged: true, fetch: (page) => wfNewApi.getSubtitleGroups(page, HOME_PER_PAGE) },
    { kind: 'library', key: 'libraries', paged: true, fetch: (page) => wfNewApi.getLibraryGroups(page, HOME_PER_PAGE) },
  ];

  // Keep the loaded-count mirror in sync with the live home content, so load-more
  // can derive the next page from the count rather than a racy shared cursor.
  useEffect(() => {
    HOME_GRID_KINDS.forEach(({ kind, key }) => {
      homeCountRef.current[kind] = ((homeContent[key] as WfNewContentGroup[]) || []).length;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeContent]);

  // Load the home hub's backend categories — CACHE-FIRST + partial-tolerant.
  // Kept separate from loadContent so a slow/empty media category never blocks the
  // main shelf + profile load.
  //
  // For every grid kind we (a) read the local cache and paint it IMMEDIATELY, then
  // (b) fetch the fresh list from the API, REPLACE the cache (full refresh) and
  // update the UI. A category whose fetch fails keeps its cached view. Documents
  // are fetched only to keep the (hidden) `documents` field populated for anything
  // that still reads it — they are never cached or shown in the hub.
  const loadHomeContent = async () => {
    setHomeContentLoading(true);

    // (a) Instant paint from cache — never blocks on the network.
    try {
      const cached = await Promise.all(HOME_GRID_KINDS.map((k) => getCachedGroups(k.kind)));
      const seed: Partial<WfNewHomeContent> = {};
      HOME_GRID_KINDS.forEach((k, i) => { seed[k.key] = cached[i] as WfNewContentGroup[]; });
      if (HOME_GRID_KINDS.some((_, i) => cached[i].length > 0)) {
        setHomeContent((prev) => ({ ...prev, ...seed }));
        setHomeContentLoading(false); // we have something to show; refresh in the background
      }
    } catch { /* cache miss → fall through to the network */ }

    // (b) Fresh fetch per kind: refresh UI + cache as each resolves; failures keep cache.
    await Promise.all(
      HOME_GRID_KINDS.map(async ({ kind, key, fetch }) => {
        try {
          // Dedup the fresh list so the home hub (and its "(N)" count badge, which
          // reads this array's length) can never show a group twice — even if the
          // backend returns duplicate libraries. putCachedGroups dedups again.
          const fresh = dedupGroups(await fetch());
          setHomeContent((prev) => ({ ...prev, [key]: fresh }));
          await putCachedGroups(kind, fresh, { replace: true });
        } catch {
          /* keep the cached view for this category */
        }
      }),
    );

    // Keep the hidden documents field populated (not cached, not shown in the hub).
    // Only overwrite on a SUCCESSFUL fetch — a transient error keeps the prior
    // value instead of blanking it (same keep-on-failure contract as the grids).
    try {
      const docs = await wfNewApi.getDocumentGroups();
      setHomeContent((prev) => ({ ...prev, documents: docs }));
    } catch { /* keep prior documents on a transient error */ }

    setHomeContentLoading(false);
  };

  // Fragment "load more" for a home grid kind. The grid component calls this ONLY
  // after its already-loaded/cached rows are exhausted — revealing the cached rows
  // beyond the 2-row window is purely local (no network), so shrinking the width +
  // pressing "load more" never re-fetches. Here we fetch the NEXT API page, SKIP
  // ids already cached (so an already-cached fragment isn't re-requested), MERGE
  // the new ids into the cache + UI, and return true while a full page suggests
  // more remains. Returns false on exhaustion (empty/partial last page) so the
  // grid stops asking. NEVER throws.
  const loadMoreGroups = async (kind: WfNewContentKind): Promise<boolean> => {
    const entry = HOME_GRID_KINDS.find((k) => k.kind === kind);
    if (!entry || !entry.paged) return false; // word rail / document: no paging endpoint
    // Serialize per kind — a second overlapping load-more for the same kind is a
    // no-op (returns "more may remain" so the grid retries after this one lands).
    if (loadMoreInFlight.current[entry.kind]) return true;
    loadMoreInFlight.current[entry.kind] = true;
    try {
      // Derive the next page from the CURRENT loaded count, not a shared mutable
      // cursor. A concurrent background loadHomeContent that replaced the list
      // also updates homeCountRef, so we always ask for the page that follows what
      // is actually loaded — no skipped/repeated page even under a mid-flight
      // refresh. (perPage = HOME_PER_PAGE, so N loaded items ⇒ next page = N/per + 1.)
      const loaded = homeCountRef.current[entry.kind] || 0;
      const nextPage = Math.floor(loaded / HOME_PER_PAGE) + 1;
      const more = await entry.fetch(nextPage);
      if (!more.length) return false; // exhausted
      // Only request/keep ids we don't already have (the "skip cached" rule), AND
      // drop secondary-key (kind|title|language) duplicates of already-loaded rows
      // so two backend ids for the same logical library never both append.
      const cachedIds = await getCachedGroupIds(entry.kind);
      const loadedGroups = (homeContent[entry.key] as WfNewContentGroup[]) || [];
      const loadedLogical = new Set(loadedGroups.map((g) => `${g.kind}|${g.title}|${g.language ?? ''}`));
      const fresh = dedupGroups(
        more.filter(
          (g) => !cachedIds.has(g.id) && !loadedLogical.has(`${g.kind}|${g.title}|${g.language ?? ''}`),
        ),
      );
      if (fresh.length) {
        await putCachedGroups(entry.kind, fresh, {}); // append after existing (order base = max(_order)+1)
        setHomeContent((prev) => ({
          ...prev,
          // Final guard: dedup the merged array so the hub list + "(N)" badge are
          // always unique regardless of any race with the background refresh.
          [entry.key]: dedupGroups([...((prev[entry.key] as WfNewContentGroup[]) || []), ...fresh]),
        }));
        // Advance the count mirror immediately so a follow-up load-more (before the
        // homeContent effect re-runs) computes the next page off the new total.
        homeCountRef.current[entry.kind] = (homeCountRef.current[entry.kind] || 0) + fresh.length;
      }
      return more.length >= HOME_PER_PAGE; // a full page → there may be more
    } catch {
      return false;
    } finally {
      loadMoreInFlight.current[entry.kind] = false;
    }
  };

  // Paginated network fetcher for the full "list page" (More → on the hub). The
  // list page OWNS its paging through this — fetching each page straight from the
  // backend so large categories are never truncated to the hub fragment. NEVER
  // throws (returns [] on error so the page shows "empty" instead of crashing).
  // Memoized (stable identity) so passing it as the list page's `fetchPage` prop
  // does NOT recreate an inline arrow every WfNewApp render — which would make
  // WfNewContentListPage re-fetch its current page on every parent re-render.
  // Deps are empty: it only closes over the module-level wfNewApi gateway.
  const fetchContentListPage = useCallback(async (
    kind: WfNewContentKind,
    page: number,
    perPage: number,
  ): Promise<WfNewContentGroup[]> => {
    try {
      switch (kind) {
        case 'book': return await wfNewApi.getBookGroups(page, perPage);
        case 'subtitle': return await wfNewApi.getSubtitleGroups(page, perPage);
        case 'library': return await wfNewApi.getLibraryGroups(page, perPage);
        // word groups have no paging endpoint; documents aren't shown in the hub.
        default: return page === 1 ? await wfNewApi.getWordContentGroups() : [];
      }
    } catch {
      return [];
    }
  }, []);

  // Stable `fetchPage` prop for the list page: a memoized binding of the open
  // category onto fetchContentListPage. Recreated ONLY when the open kind changes
  // (not every render), so WfNewContentListPage's page-load effect — which has
  // fetchPage in its deps — does not refetch on each parent re-render.
  const fetchContentListPageBound = useCallback(
    (page: number, perPage: number): Promise<WfNewContentGroup[]> =>
      contentListKind
        ? fetchContentListPage(contentListKind, page, perPage)
        : Promise.resolve([]),
    [contentListKind, fetchContentListPage],
  );

  // Cache-first word loader for a group's (large) word list. Reads the local cache
  // first (instant on a re-open), then fetches fresh from the API and refreshes the
  // cache. `onWords` is called once with the cache hit (if any) and again with the
  // fresh API list — so the UI paints instantly and self-corrects. Correct for a
  // group that has no cache yet: the first call is simply skipped and only the
  // fresh list is delivered. Done at the call site (not inside the API impl).
  const loadVocabularyCached = async (
    groupId: string,
    onWords: (words: Word[]) => void,
  ): Promise<void> => {
    if (!groupId) { onWords([]); return; }
    // (a) Instant paint from cache when present.
    try {
      const cached = await getCachedWords(groupId);
      if (cached && cached.length) onWords(cached);
    } catch { /* miss → network */ }
    // (b) Fresh fetch → update UI + cache (keeps the cached view on failure).
    try {
      const fresh = await wfNewApi.getVocabulary(groupId);
      const words = Array.isArray(fresh) ? fresh : [];
      onWords(words);
      await putCachedWords(groupId, words);
    } catch {
      /* keep whatever the cache already painted */
    }
  };

  // Open a home content group — routing depends on the kind: word groups deep-dive
  // into the shelf course view; books/subtitles jump to their study surfaces;
  // documents/libraries open the shelf. (Detail pages for media land later.)
  const openHomeGroup = (group: WfNewContentGroup) => {
    if (group.kind === 'word') {
      const match = gGroups.find(g => g.id === group.id);
      if (match) { setActiveTab('shelf'); selectBookCourse(match); return; }
    }
    // book → the book reader (chapters + bilingual verses). Needs the media source_key.
    if (group.kind === 'book' && group.sourceKey) {
      setBookReader({ sourceKey: group.sourceKey, title: group.title });
      setActiveTab('book-reader');
      return;
    }
    if (group.kind === 'subtitle') {
      if (group.sourceKey) setSelectedSubtitleKey(group.sourceKey);
      setActiveTab('subtitles');
      return;
    }
    // library → the dedicated paginated word-browser (URL encodes id/page/view).
    if (group.kind === 'library') {
      setLibraryRoute({ id: group.id, page: 1, view: 'table', title: group.title, language: group.language });
      setActiveTab('library');
      return;
    }
    // document (and word with no loaded match) → the library shelf.
    setActiveTab('shelf');
    addToast(trans('content.opening', { name: group.title }), 'info');
  };

  // Save the dashboard's editable settings (target language + daily goal). Always
  // mirrors the local settings store; LOGGED IN → persists to the backend (daily
  // goal preference + learning language) and refreshes stats. LOGGED OUT → keeps
  // the local draft but routes to login (per spec: editable, but save needs auth).
  const handleSaveDashboard = async (next: { targetLang: string; dailyGoal: number }) => {
    wfNewSettings.setField('settingTargetLang', next.targetLang);
    wfNewSettings.setField('dailyGoal', next.dailyGoal);
    setUserStats(prev => ({ ...prev, dailyGoal: next.dailyGoal }));

    if (!currentUser.isLoggedIn) {
      addToast(trans('dashboard.loginHint'), 'warning');
      requestAuthLogin({ source: 'wordnew-dashboard', reason: 'save-preferences' });
      return;
    }
    try {
      await wfNewApi.updatePreferences({ daily_goal: next.dailyGoal });
      await wfNewApi.setLearningLanguages({
        native_language: currentUser.nativeLang || wfNewSettings.get('authNativeLang'),
        learning_languages: [next.targetLang],
      });
      setCurrentUser(prev => ({ ...prev, targetLang: next.targetLang }));
      const fresh = await wfNewApi.getUserStatistics();
      if (fresh) setStatistics(fresh);
      addToast(trans('dashboard.saved'), 'success');
    } catch (e: any) {
      addToast(e?.message || trans('dashboard.saveFailed'), 'warning');
    }
  };

  // Synchronize light/dark state globally to document element for perfect Tailwind operation
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  // Local settings (Favorites + daily goal) once on mount.
  useEffect(() => {
    setFavorites(wfNewSettings.get('favorites'));
    setUserStats(prev => ({ ...prev, dailyGoal: wfNewSettings.get('dailyGoal') }));
  }, []);

  // Live-refresh the home dashboard statistics (today's recite / streak / ...)
  // whenever any surface reports study activity (daily reading, recite loop,
  // quiz). Debounced: a burst of per-word events collapses into one refetch.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = wordNewProgressCenter.subscribe(() => {
      if (!wfNewApi.isAuthenticated()) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void wfNewApi.getUserStatistics()
          .then((fresh) => { if (fresh) setStatistics(fresh); })
          .catch(() => undefined);
      }, 2500);
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  // Cache scope — set ONCE on mount BEFORE any content load runs, so the very
  // first cache reads/writes are already namespaced to (endpoint, current user).
  // Declared above the content-load effect so React fires it first.
  useEffect(() => {
    applyCacheScope(currentUser.isLoggedIn ? (currentUser.userId || null) : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Content load, re-run whenever auth state flips (mount / login / logout). UNIFIED
  // gate: public home categories (books/subtitles/libraries) always load, but the
  // auth-only content (word groups + profile + vocab) is fetched ONLY when a session
  // token is present — so nothing 401s before login, and the just-unlocked data
  // appears immediately after a successful login with no manual navigation.
  useEffect(() => {
    loadHomeContent();
    if (wfNewApi.isAuthenticated()) loadContent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser.isLoggedIn]);

  // When the backend endpoint recovers (offline → online, or the user switches
  // endpoints in Settings), reload content. No-op in mock mode (event never
  // fires) and when nothing is healthy. The http impl lazily runs endpoint
  // detection on its first request, so no explicit init is needed here.
  useEffect(() => {
    const onHealth = () => {
      // The active endpoint may have just changed — re-namespace the cache to the
      // new (endpoint, current user) scope BEFORE reloading, so the reload's
      // cache reads/writes land in the right namespace (no cross-endpoint bleed).
      applyCacheScope(isLoggedInRef.current ? (wfNewSettings.get('userId') || null) : null);
      if (wfNewEndpoints.hasHealthyEndpoint()) { loadContent(); loadHomeContent(); }
    };
    window.addEventListener(WORDNEW_API_HEALTH_EVENT, onHealth);
    return () => window.removeEventListener(WORDNEW_API_HEALTH_EVENT, onHealth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync favorites (persisted in the shared settings store).
  const handleToggleFavorite = (word: Word) => {
    const nowFavorited = wfNewSettings.toggleFavorite(word);
    setFavorites(wfNewSettings.get('favorites'));
    addToast(nowFavorited ? trans('toast.added') : trans('toast.removed'), nowFavorited ? 'success' : 'warning');
  };

  // Perform Speeches robustly with rates
  const playPhoneticSpeech = (word: Word) => {
    wordNewQueueCenter.notifyMissingWord(word.text, 'en');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word.text);
      utterance.lang = 'en-US';
      utterance.rate = speechRate;
      window.speechSynthesis.speak(utterance);
    } else {
      console.warn("SpeechSynthesis not robustly supported in host iframe.");
    }
  };

  // Match words online or locally
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const trigger = setTimeout(async () => {
      try {
        const results = await wfNewApi.searchDictionary(searchQuery);
        if (Array.isArray(results) && results.length > 0) {
          setSearchResults(results);
        } else {
          // No backend hit — fuzzy-filter the loaded local pool.
          const filterRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          setSearchResults(wordPool.filter(w => filterRegex.test(w.text) || filterRegex.test(w.translation)));
        }
      } catch {
        const filterRegex = new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        setSearchResults(wordPool.filter(w => filterRegex.test(w.text) || filterRegex.test(w.translation)));
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(trigger);
  }, [searchQuery, wordPool]);

  const selectBookCourse = async (group: WordGroup) => {
    setWordGroupRouteId(group.id);
    setSelectedCourse(group);
    // Cache-first: paint cached words instantly on a re-open, then refresh from API.
    await loadVocabularyCached(group.id, setCourseWords);
  };

  const openWordGroupList = () => {
    setWordGroupRouteId(null);
    setSelectedCourse(null);
    setCourseWords([]);
    setActiveTab('shelf');
  };

  useEffect(() => {
    if (activeTab !== 'shelf') return;
    if (!wordGroupRouteId) {
      if (selectedCourse) {
        setSelectedCourse(null);
        setCourseWords([]);
      }
      return;
    }
    if (selectedCourse?.id === wordGroupRouteId) return;
    const group = gGroups.find((candidate) => candidate.id === wordGroupRouteId);
    if (!group) return;
    setSelectedCourse(group);
    void loadVocabularyCached(group.id, setCourseWords);
    // The route id and freshly loaded backend group list are the restore inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, gGroups, selectedCourse?.id, wordGroupRouteId]);

  // Open a group's practice session. Words are NO LONGER loaded here via
  // getVocabulary (GET /query_gwords) — that returns EMPTY for the Default
  // Vocabulary Group (its words live in group_word_progress), the "blank arena"
  // bug. The practice surface now owns loading through useWfNewPracticePager
  // (POST /group/get_words, paged + auto-advance) and mirrors the current page
  // into courseWords, so every mode (quiz/cards/reading/auto-play) gets real words.
  const startGroupPractice = async (
    group: WordGroup,
    mode: 'study' | 'quiz' | 'listening' | 'reading',
  ) => {
    setSelectedPracticeGroup(group);
    setActiveTab('practice');
    startModePractice(mode);
  };

  // Launch Practice Session Mode
  const startModePractice = (mode: 'study' | 'quiz' | 'listening' | 'reading') => {
    setPracticeMode(mode);
    setPracticeIndex(0);
    setIsFlipped(false);
    setQuizAnswered(false);
    setQuizStreak(0);
    setQuizFeedback(null);
    setSelectedQuizOption(null);

    if (mode === 'listening') {
      setIsListeningPlaying(true);
    } else {
      setIsListeningPlaying(false);
    }

    if (mode === 'reading' && courseWords.length > 0) {
      // Assemble nice literary paragraphs showcasing these high-frequency keywords
      const terms = courseWords.map(w => w.text);
      if (terms.length > 0) {
        setReadParagraph(
          `In modern computational environments, our active appreciation of visual aesthetics defines the interface standard. Users operate with extreme focus, but their attention remains an ephemeral spark. To prevent overload, software engineers must respect human cognition. When designing, we seek symmetrical layout parameters where elements glow with radiant halos. However, like nebula dust in deep outer space, these virtual visual concepts are quickly replaced by raw mathematical code matrices.`
        );
      }
    }
  };

  // Quiz multiple options generation
  const activeQuizOptions = useMemo(() => {
    if (practiceMode !== 'quiz' || courseWords.length === 0) return [];
    const current = courseWords[practiceIndex];
    if (!current) return [];

    const translations = new Set<string>();
    translations.add(current.translation);

    // Distractor pool: the loaded general pool, falling back to the course words.
    const pool = wordPool.length > 4 ? wordPool : courseWords;
    while (translations.size < 4 && pool.length > 4) {
      const randomWord = pool[Math.floor(Math.random() * pool.length)];
      if (randomWord.translation !== current.translation) {
        translations.add(randomWord.translation);
      }
    }

    return Array.from(translations).sort(() => Math.random() - 0.5);
  }, [practiceMode, practiceIndex, courseWords, wordPool]);

  const handleQuizAnswer = (option: string) => {
    if (quizAnswered) return;
    const current = courseWords[practiceIndex];
    setSelectedQuizOption(option);
    setQuizAnswered(true);

    if (option === current.translation) {
      setQuizFeedback('correct');
      setQuizStreak(prev => prev + 1);
      setQuizScore(prev => prev + 10);
      setUserStats(prev => ({ ...prev, dailyProgress: Math.min(prev.dailyProgress + 1, prev.dailyGoal) }));
      playPhoneticSpeech(current);
    } else {
      setQuizFeedback('incorrect');
      setQuizStreak(0);
    }
  };

  const proceedQuizNext = () => {
    setQuizAnswered(false);
    setQuizFeedback(null);
    setSelectedQuizOption(null);
    if (practiceIndex + 1 < courseWords.length) {
      setPracticeIndex(prev => prev + 1);
    } else {
      // Loops or ends
      addToast(trans('quiz.complete'), 'success');
      setPracticeMode(null);
    }
  };

  // Clear cached profile + local learning data (resets the relevant settings).
  const handleClearEverything = () => {
    wfNewSettings.clearProfileCache();
    setFavorites(wfNewSettings.get('favorites'));
    setNickname(wfNewSettings.get('nickname'));
    setAvatarUrl(wfNewSettings.get('avatar'));
    setSpeechRate(wfNewSettings.get('speechRate'));
    setUserStats(prev => ({ ...prev, dailyGoal: wfNewSettings.get('dailyGoal') }));
    addToast(trans('toast.cacheClear'), 'success');
  };

  // Custom forging system
  const handleForgeCustomWord = () => {
    if (!newWordText.trim() || !newWordTransl.trim()) {
      addToast(trans('toast.needSpellTransl'), 'warning');
      return;
    }
    const newlyForged: Word = {
      id: `custom-${Date.now()}`,
      text: newWordText,
      phonetic: newWordPhon || '/forged/',
      translation: newWordTransl,
      definition: newWordDef || 'Custom forged lexeme in cognitive sanctum.',
      example: 'The master pilot forged custom terms to interface with the control machine.',
      tags: ['Forged']
    };

    // Prepend to current word shelf list
    setCourseWords(prev => [newlyForged, ...prev]);
    addToast(trans('toast.forged', { word: newWordText }), 'success');
    
    // Reset form
    setNewWordText('');
    setNewWordTransl('');
    setNewWordPhon('');
    setNewWordDef('');
  };

  // Phase 1: gate on login, then open the confirm dialog and fetch a non-mutating
  // preview (words already in group / to add / duplicates / status breakdown).
  const handleAddLibraryToStudy = async (group: WfNewContentGroup) => {
    if (!currentUser.isLoggedIn) {
      addToast(trans('social.loginRequired'), 'warning');
      requestAuthLogin({ source: 'wordnew-library', reason: 'add-to-study' });
      return;
    }
    setAddLibraryConfirm({ group, loading: true, submitting: false, preview: null, error: null });
    try {
      const preview = await wfNewApi.previewAddLibraryToDefaultGroup(group.id);
      setAddLibraryConfirm((s) => (s && s.group.id === group.id ? { ...s, loading: false, preview } : s));
    } catch (e: any) {
      setAddLibraryConfirm((s) => (s && s.group.id === group.id
        ? { ...s, loading: false, error: e?.message || trans('toast.libraryAddFailed') }
        : s));
    }
  };

  // Phase 2: perform the actual add once the user confirms in the dialog.
  const confirmAddLibraryNow = async () => {
    if (!addLibraryConfirm || addLibraryConfirm.submitting) return;
    const group = addLibraryConfirm.group;
    setAddLibraryConfirm((s) => (s ? { ...s, submitting: true, error: null } : s));
    try {
      const result = await wfNewApi.addLibraryToDefaultGroup(group.id);
      addToast(
        result.already_linked
          ? trans('toast.libraryAlreadyInStudy', { name: group.title })
          : trans('toast.libraryAddedToStudy', { name: group.title, count: result.words_added }),
        result.already_linked ? 'warning' : 'success',
      );
      setAddLibraryConfirm(null);
    } catch (e: any) {
      addToast(e?.message || trans('toast.libraryAddFailed'), 'warning');
      setAddLibraryConfirm((s) => (s ? { ...s, submitting: false } : s));
    }
  };

  const closeAddLibraryConfirm = () => setAddLibraryConfirm(null);

  // Current page's header (big title + subtitle) for the global nav's fixed-width
  // info block beside the back/logo control. Recomputed each render from the
  // active tab; null on pages with no header (home / shelf / practice / labs).
  const pageHeader = wfNewPageHeader(activeTab, trans, {
    contentListKind,
    wordGroupTitle: selectedCourse?.name,
    libraryTitle: libraryRoute?.title,
    bookTitle: bookReader?.title,
  });


  return {
    loadContent,
    HOME_PER_PAGE,
    HOME_GRID_KINDS,
    loadHomeContent,
    loadMoreGroups,
    fetchContentListPage,
    fetchContentListPageBound,
    loadVocabularyCached,
    openHomeGroup,
    handleSaveDashboard,
    handleToggleFavorite,
    playPhoneticSpeech,
    selectBookCourse,
    openWordGroupList,
    startGroupPractice,
    startModePractice,
    activeQuizOptions,
    handleQuizAnswer,
    proceedQuizNext,
    handleClearEverything,
    handleForgeCustomWord,
    handleAddLibraryToStudy,
    addLibraryConfirm,
    confirmAddLibraryNow,
    closeAddLibraryConfirm,
    pageHeader,
  };
}
