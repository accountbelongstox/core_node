/** useWfNewAppState - the wordnew shell's state + effects + handlers, lifted
 * out of WfNewApp so the component stays a thin view under the 800-line modular
 * limit. Returns every binding the JSX reads; WfNewApp destructures them with the
 * same names so the `return (…)` block is byte-identical (behavior preserved).
 * WfTab + wfNewPageHeader move here too (the hook computes `pageHeader`). */
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  wfNewApi, wfNewEndpoints, wfNewEndpointStore, WFNEW_API_HEALTH_EVENT,
  startSocialSse, stopSocialSse, subscribeSocial,
} from '../api';
import type {
  Word, WordGroup, BentoGroup, WfNewContentGroup, WfNewContentKind,
  WfNewHomeContent, WfNewStatistics, WfNewLanguage, WfNewSuperAdminStatus,
} from '../api';
import { wfNewSettings } from '../WfNewSettingsStore';
import { translate } from '../WfNewLocales';
import { wfNewNotify, useWfNewToasts } from '../WfNewNotify';
import { CUSTOM_THEMES } from '../WfNewThemes';
import type { UserStats } from '../WfNewTypes';
import {
  getCachedGroups, getCachedGroupIds, putCachedGroups,
  getCachedWords, putCachedWords, setCacheScope, clearAuthScopedCache, dedupGroups,
} from '../cache/WfNewContentCache';
import type { WfNewCachedKind } from '../cache/WfNewContentCache';
import { useWfNewContentHandlers } from './useWfNewContentHandlers';

/** Every navigable page/tab in the wordnew shell (drives the history stack). */
export type WfTab =
  | 'home' | 'shelf' | 'practice' | 'labs' | 'settings' | 'walkman'
  | 'subtitles' | 'stats' | 'bilingual' | 'social' | 'profile' | 'auth' | 'languages'
  | 'learning-model' | 'review-settings' | 'playback' | 'book-reader' | 'content-list' | 'library' | 'about'
  | 'daily-reading' | 'admin';

/**
 * Per-tab header (big title + optional subtitle) shown in the global nav beside
 * the back/logo control (WfNewNavLogo's fixed-width, overflow-hidden info block).
 * Returns null for pages with no header (home / shelf / practice / labs) so only
 * the logo shows. Dynamic pages (content-list / library / book-reader) take their
 * title from the active route state.
 */
function wfNewPageHeader(
  tab: WfTab,
  trans: (key: string, replacements?: Record<string, string | number>) => string,
  dyn: { contentListKind: WfNewContentKind | null; libraryTitle?: string; bookTitle?: string },
): { title: string; subtitle?: string } | null {
  switch (tab) {
    case 'walkman': return { title: trans('hdr.walkman'), subtitle: trans('hdr.walkmanSub') };
    case 'subtitles': return { title: trans('hdr.subtitles'), subtitle: trans('hdr.subtitlesSub') };
    case 'bilingual': return { title: trans('hdr.bilingual'), subtitle: trans('hdr.bilingualSub') };
    case 'profile': return { title: trans('hdr.profile'), subtitle: trans('hdr.profileSub') };
    case 'stats': return { title: trans('hdr.analytics'), subtitle: trans('hdr.analyticsSub') };
    case 'learning-model': return { title: trans('lm.title'), subtitle: trans('lm.sub') };
    case 'review-settings': return { title: trans('rev.title'), subtitle: trans('rev.sub') };
    case 'playback': return { title: trans('playset.title'), subtitle: trans('playset.sub') };
    case 'languages': return { title: trans('lang.title'), subtitle: trans('lang.sub') };
    case 'settings': return { title: trans('settings.title'), subtitle: trans('settings.sub') };
    case 'about': return { title: trans('about.title'), subtitle: trans('about.sub') };
    case 'admin': return { title: trans('hdr.admin'), subtitle: trans('hdr.adminSub') };
    case 'daily-reading': return { title: 'Daily Reading', subtitle: 'AI-translated short sentences' };
    case 'social': return { title: trans('bc.social') };
    case 'auth': return { title: trans('bc.auth') };
    case 'content-list':
      return dyn.contentListKind ? { title: trans(`content.section.${dyn.contentListKind}`) } : null;
    case 'library':
      return dyn.libraryTitle ? { title: dyn.libraryTitle } : null;
    case 'book-reader':
      return dyn.bookTitle ? { title: dyn.bookTitle } : null;
    default:
      return null;
  }
}

export function useWfNewAppState(deps: { shellLang: string; dark: boolean }) {
  const { shellLang, dark } = deps;

  // Selected atmospheric theme state (persisted via the shared settings store)
  const [activeThemeId, setActiveThemeId] = useState<string>(() => wfNewSettings.get('themeId'));

  const activeTheme = useMemo(() => {
    return CUSTOM_THEMES.find(t => t.id === activeThemeId) || CUSTOM_THEMES[0];
  }, [activeThemeId]);

  // Tab navigation states + a page HISTORY STACK so "back" returns to the page
  // you came from (not always home). Forward navigations push the page you leave;
  // goBack() pops to it; goHome() clears the stack and jumps straight home.
  const [activeTab, setActiveTabRaw] = useState<WfTab>('home');
  const [navStack, setNavStack] = useState<WfTab[]>([]);
  // The vocabulary library currently open in the dedicated word-browser, with its
  // page + view reflected in the URL (#/library/<id>?page=N&view=dash|table).
  // Declared up here because the hash parse/write effects below reference it.
  const [libraryRoute, setLibraryRoute] = useState<{
    id: string; page: number; view: 'dash' | 'table'; title?: string; language?: string;
  } | null>(null);

  // Refs mirror the latest values so the navigation callbacks can stay stable
  // (empty-deps useCallback) without nesting one state setter inside another.
  const activeTabRef = useRef<WfTab>(activeTab);
  const navStackRef = useRef<WfTab[]>(navStack);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { navStackRef.current = navStack; }, [navStack]);

  /** Navigate forward to a page, pushing the page being left onto the stack.
   *  The stack is DEDUPED (MRU): each page appears at most once. On every push we
   *  drop any existing occurrence of both the page we're leaving (curr) and the
   *  page we're going to (tab — it becomes the active page, never a back target),
   *  then append curr as the most-recent back target. So re-pushing a page that's
   *  already in the stack just MOVES it to the top instead of duplicating it —
   *  this prevents the same page bouncing back and forth in the back history. */
  const setActiveTab = useCallback((tab: WfTab) => {
    const curr = activeTabRef.current;
    if (curr !== tab) {
      setNavStack(s => {
        const filtered = s.filter(t => t !== curr && t !== tab);
        return [...filtered, curr];
      });
    }
    setActiveTabRaw(tab);
  }, []);

  /** Pop the stack and return to the previous page (home when the stack is empty).
   *  Also stops any in-flight browser speech: the audio pages (walkman / subtitles
   *  / bilingual) used to halt TTS from their own back button; now the global nav
   *  back/logo owns it, so leaving an audio page always stops playback. */
  const goBack = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch { /* best-effort */ }
    const s = navStackRef.current;
    if (s.length === 0) {
      setActiveTabRaw('home');
      return;
    }
    setActiveTabRaw(s[s.length - 1]);
    setNavStack(s.slice(0, -1));
  }, []);

  /** Jump straight to home and clear the history stack (also halts any TTS). */
  const goHome = useCallback(() => {
    try { window.speechSynthesis.cancel(); } catch { /* best-effort */ }
    setNavStack([]);
    setActiveTabRaw('home');
  }, []);

  // URL route reflection: every page shows its route name in the address bar
  // (#/<tab>). On first mount, restore the tab from the hash (deep-link / refresh
  // keeps you on the page); on every change, write the hash back. Lightweight
  // hash routing (no react-router restructure of the whole shell).
  useEffect(() => {
    const fromHash = (typeof window !== 'undefined' ? window.location.hash : '').replace(/^#\/?/, '');
    const ALL: WfTab[] = [
      'home', 'shelf', 'practice', 'labs', 'settings', 'walkman', 'subtitles',
      'stats', 'bilingual', 'social', 'profile', 'auth', 'languages',
      'learning-model', 'review-settings', 'playback', 'book-reader', 'content-list', 'about',
      'daily-reading', 'admin',
    ];
    // Deep-link to a vocabulary library: #/library/<id>?page=N&view=dash|table
    if (fromHash.startsWith('library/')) {
      const [path, query = ''] = fromHash.split('?');
      const id = decodeURIComponent(path.slice('library/'.length));
      if (id) {
        const params = new URLSearchParams(query);
        const page = Math.max(1, parseInt(params.get('page') || '1', 10) || 1);
        const view = params.get('view') === 'dash' ? 'dash' : 'table';
        setLibraryRoute({ id, page, view });
        setActiveTabRaw('library');
        return;
      }
    }
    if (fromHash && (ALL as string[]).includes(fromHash) && fromHash !== 'home') {
      setActiveTabRaw(fromHash as WfTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let next = `#/${activeTab}`;
    // The library page carries its id/page/view in the URL so refresh/deep-link
    // restores the exact word-browser state.
    if (activeTab === 'library' && libraryRoute) {
      next = `#/library/${encodeURIComponent(libraryRoute.id)}?page=${libraryRoute.page}&view=${libraryRoute.view}`;
    }
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [activeTab, libraryRoute]);

  // Unified global auth user state (persisted via the shared settings store)
  const [currentUser, setCurrentUser] = useState(() => {
    return {
      nickname: wfNewSettings.get('nickname'),
      avatar: wfNewSettings.get('avatar'),
      email: wfNewSettings.get('email'),
      // Stable cache-scope identity (id ?? username ?? email) persisted at login,
      // so it survives reload AND logout reads the SAME id login wrote.
      userId: wfNewSettings.get('userId'),
      nativeLang: wfNewSettings.get('authNativeLang'),
      targetLang: wfNewSettings.get('authTargetLang'),
      bio: wfNewSettings.get('bio'),
      isLoggedIn: wfNewSettings.get('isLoggedIn')
    };
  });

  // Background breathing toggle — kept in sync with the settings store (set on
  // the Settings page), now via the reactive store instead of a 'storage' event.
  const [disableBgBreathing, setDisableBgBreathing] = useState<boolean>(() => wfNewSettings.get('disableBgBreathing'));

  useEffect(() => {
    return wfNewSettings.subscribe(() => {
      setDisableBgBreathing(wfNewSettings.get('disableBgBreathing'));
    });
  }, []);

  // Notification center (shared store — no per-component state, no prop-drilling
  // redundancy). `addToast` is a thin compat wrapper over wfNewNotify.push so the
  // existing callers keep working; new code can import wfNewNotify directly.
  const toasts = useWfNewToasts();
  const addToast = useCallback(
    (text: string, type: 'success' | 'info' | 'warning' | 'star' = 'info') => wfNewNotify.push(text, type),
    []
  );

  // Profile data (persisted via the shared settings store)
  const [nickname, setNickname] = useState<string>(() => wfNewSettings.get('nickname'));
  const [avatarUrl, setAvatarUrl] = useState<string>(() => wfNewSettings.get('avatar'));
  const [speechRate, setSpeechRate] = useState<number>(() => wfNewSettings.get('speechRate'));


  // Synchronized callback when profile saves
  const handleUpdateProfile = (updated: { nickname: string; avatar: string; nativeLang: string; targetLang: string; bio: string }) => {
    setNickname(updated.nickname);
    setAvatarUrl(updated.avatar);
    wfNewSettings.setField('nickname', updated.nickname);
    wfNewSettings.setField('avatar', updated.avatar);

    setCurrentUser(prev => {
      const copy = {
        ...prev,
        nickname: updated.nickname,
        avatar: updated.avatar,
        nativeLang: updated.nativeLang,
        targetLang: updated.targetLang,
        bio: updated.bio
      };
      wfNewSettings.setField('authNativeLang', updated.nativeLang);
      wfNewSettings.setField('authTargetLang', updated.targetLang);
      wfNewSettings.setField('bio', updated.bio);
      return copy;
    });
  };

  // ---- Super-admin (loopback local-management) mode -------------------------
  // The BACKEND decides from the connecting client IP (same debug bypass
  // laravel-manager uses): opened via 127.0.0.1/localhost → login-free super
  // permission. One probe on mount, pinned to the page-origin backend (never
  // the failover pool). Null = probe in flight; disabled stays silent.
  const [superAdmin, setSuperAdmin] = useState<WfNewSuperAdminStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    void wfNewAdminApi.probeStatus().then((status) => {
      if (cancelled) return;
      setSuperAdmin(status);
      if (status.enabled) {
        // Announce once per browser session — the persistent header badge is
        // the always-on hint; a toast every reload would be noise.
        try {
          if (!sessionStorage.getItem('wfnew_super_toast')) {
            sessionStorage.setItem('wfnew_super_toast', '1');
            wfNewNotify.push(translate(shellLang, 'admin.enabledToast'), 'star');
          }
        } catch { /* best-effort */ }
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Onboarding startup sequence state
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    // Mark complete so the welcome wizard never auto-shows again.
    wfNewSettings.setField('onboardingDone', true);
    addToast(trans('toast.onboardSynced'), 'success');
  };

  // Single source of truth for "am I logged in", read by the expiry subscriber
  // without re-subscribing.
  const isLoggedInRef = useRef(currentUser.isLoggedIn);
  useEffect(() => { isLoggedInRef.current = currentUser.isLoggedIn; }, [currentUser.isLoggedIn]);

  // ---- Cache scoping (cross-user / cross-endpoint isolation) ------------------
  // The local cache must be NAMESPACED by (endpoint, user) so that switching
  // backends or logging in as a different user never serves the previous scope's
  // cached groups/words. endpointId = the live current endpoint id (stable even
  // before detection finishes via the persisted currentType); userId = the
  // logged-in user's STABLE identity (id ?? username ?? email — never email-only,
  // null when logged out). We call setCacheScope
  // at every point either input can change: init, login, logout, endpoint change.

  /** The active endpoint id (live current, else the persisted last-used type). */
  const currentEndpointId = useCallback(
    (): string =>
      wfNewEndpoints.getCurrentEndpoint()?.id ?? wfNewEndpointStore.currentType ?? 'default',
    [],
  );

  /** Re-namespace the cache for the given user under the active endpoint. */
  const applyCacheScope = useCallback((userId: string | null) => {
    setCacheScope(currentEndpointId(), userId);
  }, [currentEndpointId]);

  /**
   * Unified logout/expiry reset. Clears ONLY the user IDENTITY/session together
   * (currentUser + the separate nickname/avatarUrl display state + the persisted
   * identity fields in the settings store) so there is never a half-logged-out UI
   * (e.g. "session expired" yet the avatar still showing). Optionally routes to
   * the login page.
   *
   * INTENTIONALLY PRESERVED (NOT cleared on logout):
   *   - cached media: the WfAudioCenter URL cache + the browser's HTTP cache of
   *     audio/video clips (only dropped on 'api-endpoint-changed'), and any OPFS
   *     blob cache — re-downloading media after a logout/login is wasteful;
   *   - local learning data + UI prefs in wfNewSettings (favorites, streakDays,
   *     theme, speech/review settings) — these survive a re-login;
   *   - endpoint prefs (WfNewEndpointStore).
   * So we clear the identity keys explicitly rather than wiping the whole store.
   */
  const clearUserSession = useCallback((routeToAuth: boolean) => {
    // Wipe the DEPARTING user's private word cache BEFORE switching scope, so a
    // different user logging in on the same device can never see their data
    // (the real cross-user leak fix). Use the SAME stable userId login wrote
    // (id ?? username ?? email) — read it BEFORE clearing — so the scope cleared
    // is exactly the scope written. Then re-namespace to the logged-out scope.
    const departingUserId = wfNewSettings.get('userId');
    if (departingUserId) clearAuthScopedCache(currentEndpointId(), departingUserId);
    applyCacheScope(null);
    // Identity/session fields only — leave caches + learning data untouched.
    wfNewSettings.setField('isLoggedIn', false);
    wfNewSettings.setField('nickname', '');
    wfNewSettings.setField('avatar', '');
    wfNewSettings.setField('email', '');
    wfNewSettings.setField('userId', '');
    wfNewSettings.setField('bio', '');
    setNickname('');
    setAvatarUrl('');
    setCurrentUser(prev => ({ ...prev, isLoggedIn: false, nickname: '', avatar: '', email: '', userId: '', bio: '' }));
    if (routeToAuth) setActiveTab('auth');
  }, [setActiveTab, applyCacheScope, currentEndpointId]);

  const handleLoginSuccess = (payload: typeof currentUser) => {
    setNickname(payload.nickname);
    setAvatarUrl(payload.avatar);
    wfNewSettings.setField('nickname', payload.nickname);
    wfNewSettings.setField('avatar', payload.avatar);
    wfNewSettings.setField('email', payload.email);
    wfNewSettings.setField('userId', payload.userId);
    wfNewSettings.setField('authNativeLang', payload.nativeLang);
    wfNewSettings.setField('authTargetLang', payload.targetLang);
    wfNewSettings.setField('bio', payload.bio);
    wfNewSettings.setField('isLoggedIn', true);
    setCurrentUser({
      ...payload,
      isLoggedIn: true
    });
    // Namespace the cache to THIS user (under the active endpoint) so their
    // private word data is isolated from any previously logged-in user. Use the
    // STABLE userId (id ?? username ?? email), NOT the optional email.
    applyCacheScope(payload.userId || null);
    // Welcome/onboarding wizard shows only the FIRST time (persisted flag).
    if (!wfNewSettings.get('onboardingDone')) {
      setShowOnboarding(true);
    }
    addToast(trans('toast.loginOk'), 'success');
    setActiveTab('profile');

    // Pull roaming preferences from the backend and apply them (daily goal +
    // the wordnew theme stored in the opaque app_settings blob). Best-effort:
    // offline / mock simply keeps the local settings.
    void (async () => {
      try {
        const prefs = await wfNewApi.getPreferences();
        if (typeof prefs.daily_goal === 'number') {
          wfNewSettings.setField('dailyGoal', prefs.daily_goal);
          setUserStats(prev => ({ ...prev, dailyGoal: prefs.daily_goal as number }));
        }
        const themeId = prefs.app_settings && (prefs.app_settings as any).themeId;
        if (typeof themeId === 'string' && themeId) {
          setActiveThemeId(themeId);
          wfNewSettings.setField('themeId', themeId);
        }
      } catch {
        /* offline / unauthenticated — keep local settings */
      }
    })();
  };

  const handleLogout = () => {
    // Best-effort: clear the API session token (real impl); the mock is stateless.
    void wfNewApi.logout().catch(() => {});
    clearUserSession(true);
    addToast(trans('toast.loggedOut'), 'info');
  };

  // Session integrity: a persisted `isLoggedIn` flag is only trustworthy if the
  // API actually holds a token. A stale flag (e.g. logged in before the token
  // existed, or an expired token) makes every authed call 401 — the "already
  // logged in but upload says login required" bug. On mount, reconcile: if the
  // UI thinks we're logged in but the API isn't authenticated, drop to logged-out
  // so a fresh login re-establishes the token. Also subscribe to auth-expiry so a
  // 401 from ANY endpoint flips the whole app to logged-out + the login screen.
  useEffect(() => {
    // Stale/expired session detected on load → clear everything and jump to login
    // ONCE (the user expects a single redirect when the session has expired).
    if (currentUser.isLoggedIn && !wfNewApi.isAuthenticated()) {
      clearUserSession(true);
      addToast(trans('toast.sessionExpired'), 'warning');
    }
    // A 401 from ANY endpoint fires this — already deduped to once per
    // session-death at the source; the isLoggedInRef guard ensures we never
    // re-toast / re-route once we're already logged out (single redirect).
    const unsubscribe = wfNewApi.onAuthExpired(() => {
      if (!isLoggedInRef.current) return;
      clearUserSession(true);
      addToast(trans('toast.sessionExpired'), 'warning');
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Social realtime lifecycle — keyed on the login flag. When logged IN: open the
  // SSE stream, beat presence immediately then every ~30s, prime the unread count,
  // and subscribe to live notifications. The cleanup tears EVERYTHING down on
  // logout / unmount (stop SSE, clear the heartbeat interval, reset state). Guard
  // ensures nothing runs while logged out. Offline-safe: the SSE client just keeps
  // retrying and getUnreadCount catches to 0.
  useEffect(() => {
    if (!currentUser.isLoggedIn) return;

    startSocialSse();

    // Heartbeat: immediately, then on a ~30s interval while active.
    void wfNewApi.presenceHeartbeat().catch(() => {});
    const heartbeat = setInterval(() => { void wfNewApi.presenceHeartbeat().catch(() => {}); }, 30000);

    // Prime the unread badge + keep it live via push.
    void wfNewApi.getUnreadCount().catch(() => 0);
    const unsubNotif = subscribeSocial('notification.new', () => {
      void wfNewApi.getUnreadCount().catch(() => 0);
    });

    return () => {
      clearInterval(heartbeat);
      unsubNotif();
      stopSocialSse();
    };
  }, [currentUser.isLoggedIn]);

  // Multilingual translation helper (en/zh/ja/ko, key-level English fallback).
  // Pass replacements for {name} placeholders, e.g. trans('toast.forged', { word }).
  const trans = (key: string, replacements?: Record<string, string | number>) =>
    translate(shellLang, key, replacements);
  // Language picker popover (top-right): open/close + choose a language.

  // Base API storage structures
  const [gGroups, setGGroups] = useState<WordGroup[]>([]);
  const [bentoGroups, setBentoGroups] = useState<BentoGroup[]>([]);
  // Multi-category home hub content (word/book/subtitle/document groups) read
  // from the backend via wfNewApi.getHomeContent — see WfNewHomeContent widget.
  const [homeContent, setHomeContent] = useState<WfNewHomeContent>({ words: [], books: [], subtitles: [], libraries: [], documents: [] });
  const [homeContentLoading, setHomeContentLoading] = useState<boolean>(true);
  // Per-grid-kind "load more in flight" guard. The page cursor is NO LONGER a
  // shared mutable ref that a concurrent background loadHomeContent could reset
  // mid-flight (the old desync bug) — the next page is derived from the currently
  // loaded count instead (see loadMoreGroups). This guard just serializes
  // overlapping load-more calls for the same kind so two clicks can't double-fetch.
  const loadMoreInFlight = useRef<Record<WfNewCachedKind, boolean>>({ word: false, book: false, subtitle: false, library: false });
  // Live mirror of the loaded count per grid kind, so loadMoreGroups can derive
  // the next API page from the count WITHOUT reading through a stale state closure
  // or a mutable cursor the background refresh also writes.
  const homeCountRef = useRef<Record<WfNewCachedKind, number>>({ word: 0, book: 0, subtitle: 0, library: 0 });
  // The book currently open in the reader (book -> chapter -> verses surface).
  const [bookReader, setBookReader] = useState<{ sourceKey: string; title: string } | null>(null);
  // The subtitle source pre-selected from the home hub (drives WfNewSubtitles).
  const [selectedSubtitleKey, setSelectedSubtitleKey] = useState<string | undefined>(undefined);
  // The category whose full "list page" is open (book/subtitle/library "More →").
  const [contentListKind, setContentListKind] = useState<WfNewContentKind | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<WordGroup | null>(null);
  const [courseWords, setCourseWords] = useState<Word[]>([]);
  // General distractor/search word pool (loaded once via the API).
  const [wordPool, setWordPool] = useState<Word[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [userStats, setUserStats] = useState<UserStats>({
    learned: 432,
    streak: 8,
    dailyGoal: 20,
    dailyProgress: 12
  });

  // Rich learning statistics (GET /user/statistics) for the home dashboard —
  // null until loaded / when logged out. Target-language options for its selector.
  const [statistics, setStatistics] = useState<WfNewStatistics | null>(null);
  const [languageOptions, setLanguageOptions] = useState<WfNewLanguage[]>([]);

  // Search logic
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Word[]>([]);
  const [searching, setSearching] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [favorites, setFavorites] = useState<Word[]>([]);

  // Practice runner parameters
  const [selectedPracticeGroup, setSelectedPracticeGroup] = useState<WordGroup | null>(null);
  const [practiceMode, setPracticeMode] = useState<'study' | 'quiz' | 'listening' | 'reading' | null>(null);
  const [practiceIndex, setPracticeIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Quiz parameters
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [selectedQuizOption, setSelectedQuizOption] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  // Listening Loop state
  const [isListeningPlaying, setIsListeningPlaying] = useState(false);
  const listeningIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dynamic contextual reading generator paragraphs
  const [readParagraph, setReadParagraph] = useState('');
  const [selectedWordDetail, setSelectedWordDetail] = useState<Word | null>(null);

  // Custom AI Lab manual forge form
  const [newWordText, setNewWordText] = useState('');
  const [newWordTransl, setNewWordTransl] = useState('');
  const [newWordPhon, setNewWordPhon] = useState('');
  const [newWordDef, setNewWordDef] = useState('');

  // Fetch profile & packages through the single gateway (mock or real — the
  // implementation behind ./api decides, this code is identical either way).
  const contentHandlers = useWfNewContentHandlers({
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
  });
  return {
    ...contentHandlers,
    activeThemeId,
    setActiveThemeId,
    activeTheme,
    activeTab,
    setActiveTabRaw,
    navStack,
    setNavStack,
    libraryRoute,
    setLibraryRoute,
    activeTabRef,
    navStackRef,
    setActiveTab,
    goBack,
    goHome,
    currentUser,
    setCurrentUser,
    disableBgBreathing,
    setDisableBgBreathing,
    toasts,
    addToast,
    nickname,
    setNickname,
    avatarUrl,
    setAvatarUrl,
    speechRate,
    setSpeechRate,
    handleUpdateProfile,
    superAdmin,
    setSuperAdmin,
    showOnboarding,
    setShowOnboarding,
    handleOnboardingComplete,
    isLoggedInRef,
    currentEndpointId,
    applyCacheScope,
    clearUserSession,
    handleLoginSuccess,
    handleLogout,
    trans,
    gGroups,
    setGGroups,
    bentoGroups,
    setBentoGroups,
    homeContent,
    setHomeContent,
    homeContentLoading,
    setHomeContentLoading,
    loadMoreInFlight,
    homeCountRef,
    bookReader,
    setBookReader,
    selectedSubtitleKey,
    setSelectedSubtitleKey,
    contentListKind,
    setContentListKind,
    selectedCourse,
    setSelectedCourse,
    courseWords,
    setCourseWords,
    wordPool,
    setWordPool,
    loading,
    setLoading,
    userStats,
    setUserStats,
    statistics,
    setStatistics,
    languageOptions,
    setLanguageOptions,
    searchQuery,
    setSearchQuery,
    searchResults,
    setSearchResults,
    searching,
    setSearching,
    isSearchOverlayOpen,
    setIsSearchOverlayOpen,
    favorites,
    setFavorites,
    selectedPracticeGroup,
    setSelectedPracticeGroup,
    practiceMode,
    setPracticeMode,
    practiceIndex,
    setPracticeIndex,
    isFlipped,
    setIsFlipped,
    quizScore,
    setQuizScore,
    quizStreak,
    setQuizStreak,
    quizAnswered,
    setQuizAnswered,
    selectedQuizOption,
    setSelectedQuizOption,
    quizFeedback,
    setQuizFeedback,
    isListeningPlaying,
    setIsListeningPlaying,
    listeningIntervalRef,
    readParagraph,
    setReadParagraph,
    selectedWordDetail,
    setSelectedWordDetail,
    newWordText,
    setNewWordText,
    newWordTransl,
    setNewWordTransl,
    newWordPhon,
    setNewWordPhon,
    newWordDef,
    setNewWordDef,
    loadContent,
    HOME_PER_PAGE,
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
    startGroupPractice,
    startModePractice,
    activeQuizOptions,
    handleQuizAnswer,
    proceedQuizNext,
    handleClearEverything,
    handleForgeCustomWord,
    pageHeader,
  };
}
