import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, Sparkles, GraduationCap, Flame, ChevronRight, 
  Search, Volume2, Star, Settings, Check, RefreshCw, Layers, 
  CheckCircle, Play, Pause, SkipForward, ArrowRight,
  Languages, Moon, Sun, Heart, Send, Info, Trash2, ArrowLeft, RotateCw,
  BarChart2, LogIn
} from 'lucide-react';

import { useShell } from '../../shell/ShellContext';
// Single data gateway — mock vs real backend is decided ONLY by ./api/index.ts
// (swap one import line there). All data shapes come from the same TYPE surface.
import { wfNewApi, wfNewEndpoints, wfNewEndpointStore, WFNEW_API_HEALTH_EVENT, startSocialSse, stopSocialSse, subscribeSocial } from './api';
import type { Word, WordGroup, BentoGroup, WfNewContentGroup, WfNewContentKind, WfNewHomeContent, WfNewStatistics, WfNewLanguage } from './api';
// Unified local cache (CapDatabase: native SQLite / web IndexedDB). Lets the home
// hub paint INSTANTLY from cache, then refresh from the API, and lets a re-opened
// word group skip re-fetching the whole list. Never throws — a miss falls back to
// the network. See ./cache/WfNewContentCache.
import {
  getCachedGroups, getCachedGroupIds, putCachedGroups,
  getCachedWords, putCachedWords,
  setCacheScope, clearAuthScopedCache,
  dedupGroups,
  type WfNewCachedKind,
} from './cache/WfNewContentCache';
import { wfNewSettings } from './WfNewSettingsStore';
import { WfNewHomeContent as WfNewHomeContentWidget } from './components/WfNewHomeContent';

// Modular Imports
import { UserStats, ElementTheme } from './WfNewTypes';
import { translate, getSupportedLanguages } from './WfNewLocales';
import { CUSTOM_THEMES } from './WfNewThemes';
import { WfNewSearchOverlay } from './components/WfNewSearchOverlay';
import { WfNewToast } from './components/WfNewToast';
import { wfNewNotify, useWfNewToasts } from './WfNewNotify';
import { WfNewBottomDock } from './components/WfNewBottomDock';
import { CourseBlockCard, WordRowItem } from './components/WfNewCards';
import { WfNewSettings } from './pages/WfNewSettings';

// New Custom Study Suites Pages
import { WfNewWalkman } from './pages/WfNewWalkman';
import { WfNewSubtitles } from './pages/WfNewSubtitles';
import { WfNewAnalytics } from './pages/WfNewAnalytics';
import { WfNewBilingual } from './pages/WfNewBilingual';
import { WfNewBookReader } from './pages/WfNewBookReader';
import { WfNewContentListPage } from './pages/WfNewContentListPage';
import { WfNewLibraryPage } from './pages/WfNewLibraryPage';
import { WfNewSocial } from './pages/WfNewSocial';
import { WfNewAuth } from './pages/WfNewAuth';
import { WfNewProfile } from './pages/WfNewProfile';
import { WfNewLanguages } from './pages/WfNewLanguages';
import { WfNewLearningModel } from './pages/WfNewLearningModel';
import { WfNewReviewSettings } from './pages/WfNewReviewSettings';
import { WfNewPlaybackSettings } from './pages/WfNewPlaybackSettings';
import { WfNewAbout } from './pages/WfNewAbout';
import { WfNewAvatarView } from './components/WfNewAvatarView';
import { WfNewHomeDashboard } from './components/WfNewHomeDashboard';
import { WfNewOnboarding } from './pages/WfNewOnboarding';
import { WfNewNavLogo } from './components/WfNewNavLogo';
import { WfNewNotificationBell } from './components/WfNewNotificationBell';

/** Every navigable page/tab in the wordnew shell (drives the history stack). */
type WfTab =
  | 'home' | 'shelf' | 'practice' | 'labs' | 'settings' | 'walkman'
  | 'subtitles' | 'stats' | 'bilingual' | 'social' | 'profile' | 'auth' | 'languages'
  | 'learning-model' | 'review-settings' | 'playback' | 'book-reader' | 'content-list' | 'library' | 'about';

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

export const WfNewApp: React.FC = () => {
  const { lang: shellLang, setLang: setShellLang, dark, toggleDark } = useShell();

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
      setActiveTab('auth');
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
    window.addEventListener(WFNEW_API_HEALTH_EVENT, onHealth);
    return () => window.removeEventListener(WFNEW_API_HEALTH_EVENT, onHealth);
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
    setSelectedCourse(group);
    // Cache-first: paint cached words instantly on a re-open, then refresh from API.
    await loadVocabularyCached(group.id, setCourseWords);
  };

  // Load a group's words then start a practice session (replaces the old
  // synchronous getFallbackDataset path; data always flows through the API).
  const startGroupPractice = async (
    group: WordGroup,
    mode: 'study' | 'quiz' | 'listening' | 'reading',
  ) => {
    setSelectedPracticeGroup(group);
    // Cache-first word list (instant on a re-open, then API-refreshed + re-cached).
    await loadVocabularyCached(group.id, setCourseWords);
    setActiveTab('practice');
    startModePractice(mode);
  };

  // Listening continuous loop implementation
  useEffect(() => {
    if (isListeningPlaying && courseWords.length > 0) {
      // Say first word instantly
      playPhoneticSpeech(courseWords[practiceIndex]);

      listeningIntervalRef.current = setInterval(() => {
        setPracticeIndex(prev => {
          const nextVal = (prev + 1) % courseWords.length;
          playPhoneticSpeech(courseWords[nextVal]);
          return nextVal;
        });
      }, 4300);
    } else {
      if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    }
    return () => {
      if (listeningIntervalRef.current) clearInterval(listeningIntervalRef.current);
    };
  }, [isListeningPlaying, courseWords]);

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

  // Current page's header (big title + subtitle) for the global nav's fixed-width
  // info block beside the back/logo control. Recomputed each render from the
  // active tab; null on pages with no header (home / shelf / practice / labs).
  const pageHeader = wfNewPageHeader(activeTab, trans, {
    contentListKind,
    libraryTitle: libraryRoute?.title,
    bookTitle: bookReader?.title,
  });

  return (
    <div className={dark ? 'dark' : ''}>
      <div className={`min-h-screen transition-all duration-1000 overflow-x-hidden ${activeTheme.bgClass} ${
        activeTheme.id === 'nordic' ? 'text-slate-800 dark:text-slate-100' : (dark ? 'text-slate-100' : 'text-slate-900')
      }`}>
      
      {/* Decorative Luminous Orbs with dynamic dual-mode breathability and glassmorphism */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        {/* Orb 1: Upper Right */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 1.15, 0.95, 1.05, 1],
            x: [0, 25, -20, 10, 0],
            y: [0, -40, 20, -10, 0],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className={`absolute top-[-10%] right-[5%] w-[450px] h-[450px] rounded-full filter blur-[120px] transition-colors duration-1000 ${
            dark 
              ? 'bg-indigo-600/10' 
              : 'bg-indigo-400/25 shadow-[inset_0_0_80px_rgba(168,85,247,0.15)] bg-purple-300/20'
          }`}
        />
        {/* Orb 2: Middle Left */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 0.85, 1.1, 0.95, 1],
            x: [0, -35, 20, -10, 0],
            y: [0, 50, -20, 25, 0],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className={`absolute top-[35%] left-[-5%] w-[380px] h-[380px] rounded-full filter blur-[100px] transition-colors duration-1000 ${
            dark 
              ? 'bg-fuchsia-600/8' 
              : 'bg-pink-400/25 shadow-[inset_0_0_80px_rgba(244,63,94,0.15)] bg-rose-200/20'
          }`}
        />
        {/* Orb 3: Bottom Right */}
        <motion.div
          animate={disableBgBreathing ? undefined : {
            scale: [1, 1.2, 0.9, 1.1, 1],
            x: [0, 30, -20, 15, 0],
            y: [0, 40, -30, 10, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2
          }}
          className={`absolute bottom-[10%] right-[-5%] w-[420px] h-[420px] rounded-full filter blur-[110px] transition-colors duration-1000 ${
            dark 
              ? 'bg-emerald-600/8' 
              : 'bg-emerald-300/25 bg-teal-200/15'
          }`}
        />
      </div>

      {/* Header section with glass background */}
      <header className={`sticky top-0 z-40 w-full backdrop-blur-xl border-b border-white/5 py-4 px-4 sm:px-8 flex justify-between items-center transition-all ${
        activeTheme.id === 'nordic' 
          ? 'bg-white/80 dark:bg-slate-950/70' 
          : 'bg-slate-950/40'
      }`}>
        {/* GLOBAL nav/brand control: a back arrow when there is a previous page
            in the stack (goBack), else the brand logo (goHome). One component for
            the whole app — pages no longer need their own back row. */}
        <WfNewNavLogo
          canGoBack={navStack.length > 0}
          onBack={goBack}
          onHome={goHome}
          trans={trans}
          title={pageHeader?.title}
          subtitle={pageHeader?.subtitle}
        />

        {/* Real-time search button triggering instant search popup */}
        <div className="relative max-w-sm flex-1 mx-6 hidden md:block">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className={`w-full py-2.5 pl-4 pr-10 rounded-full text-xs font-mono text-left flex items-center gap-2 border transition-all ${
              activeTheme.id === 'nordic'
                ? 'bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500'
                : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <span>{trans('search.placeholder')}</span>
          </button>
        </div>

        {/* Setting items right portion */}
        <div className="flex items-center gap-2.5 font-mono">
          <button
            onClick={() => setIsSearchOverlayOpen(true)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 text-zinc-300 md:hidden"
            title={trans('tip.search')}
          >
            <Search className="w-4 h-4 text-zinc-300" />
          </button>

          {/* Social exchange portal */}
          <button
            onClick={() => setActiveTab('social')}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-full border bg-white/5 hover:bg-indigo-500/10 text-indigo-400 hover:text-indigo-300 transition-all text-xs cursor-pointer ${
              activeTab === 'social' ? 'bg-indigo-500/15 border-indigo-500/30' : 'border-white/5'
            }`}
            title={trans('tip.social')}
          >
            <span>🌐</span>
            <span className="hidden sm:inline font-mono font-bold text-[10px] tracking-tight">{trans('bc.social')}</span>
          </button>

          {/* Notification center bell (only when logged in) */}
          {currentUser.isLoggedIn && (
            <WfNewNotificationBell
              trans={trans}
              addToast={addToast}
              onOpenSocial={() => setActiveTab('social')}
            />
          )}

          {/* Individual Profile Console / Login bubble */}
          <button
            onClick={() => setActiveTab(currentUser.isLoggedIn ? 'profile' : 'auth')}
            className={`flex items-center p-1.5 rounded-full border bg-white/5 transition-all cursor-pointer ${
              activeTab === 'profile' || activeTab === 'auth' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'text-zinc-300 hover:bg-white/10 border-white/5'
            }`}
            title={currentUser.isLoggedIn ? (nickname || trans('tip.profile')) : trans('common.login')}
            aria-label={currentUser.isLoggedIn ? (nickname || trans('tip.profile')) : trans('common.login')}
          >
            {/* Logged in -> avatar (with online dot); logged out -> a plain login
                icon (next to the settings gear), NOT a placeholder avatar. The name
                is available via the title/aria-label tooltip when present. */}
            {currentUser.isLoggedIn ? (
              <div className="w-7 h-7 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-sm relative overflow-visible">
                <WfNewAvatarView value={avatarUrl} className="text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 bg-emerald-500" />
              </div>
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-zinc-300">
                <LogIn className="w-4 h-4" />
              </div>
            )}
          </button>

          {/* Dark/light + language controls moved into Settings → Appearance to
              keep the header compact (a quick gear shortcut remains). */}
          <button
            onClick={() => setActiveTab('settings')}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-zinc-300"
            title={trans('nav.settings')}
            aria-label={trans('nav.settings')}
          >
            <Settings className="w-4 h-4 text-zinc-300" />
          </button>
        </div>
      </header>

      {/* Main scrolling wrapper */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-8 pb-32">
        <AnimatePresence mode="wait">
          
          {/* ====== HOME CONTROL CENTER ====== */}
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Unified learning dashboard. When LOGGED IN: identity + real backend
                  stats render and Save writes through. When LOGGED OUT: the stats
                  area is hidden entirely (no login CTA) — only the editable learning
                  settings row shows, and Save routes to login. */}
              <WfNewHomeDashboard
                activeTheme={activeTheme}
                trans={trans}
                isLoggedIn={currentUser.isLoggedIn}
                nickname={nickname}
                avatarUrl={avatarUrl}
                stats={statistics}
                groupName={gGroups[0]?.name || ''}
                groupCount={gGroups[0]?.count || 0}
                targetLang={currentUser.targetLang || wfNewSettings.get('settingTargetLang')}
                dailyGoal={userStats.dailyGoal}
                languageOptions={languageOptions}
                onSave={handleSaveDashboard}
              />

              {/* Omni-Symmetrical Audio-Visual Laboratory */}
              <div className="space-y-3.5 pt-4 animate-fade-in">
                <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 px-1">
                  Omni-Dimensional Audio-Visual Labs
                </h3>
                {/* Mobile: compact 2-col icon-on-top / label-below grid (no list rows);
                    sm+ keeps the richer card with description. */}
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
                  
                  {/* Cyber Walkman Card */}
                  <div
                    onClick={() => {
                      setActiveTab('walkman');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-indigo-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <Volume2 className="w-5.5 h-5.5 animate-pulse" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                      {trans('home.walkmanTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.walkmanDesc')}
                    </p>
                  </div>

                  {/* Interactive Subtitles Video Card */}
                  <div
                    onClick={() => {
                      setActiveTab('subtitles');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-fuchsia-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-fuchsia-500/10 text-fuchsia-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <Play className="w-5.5 h-5.5" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-fuchsia-400 transition-colors">
                      {trans('home.subsTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.subsDesc')}
                    </p>
                  </div>

                  {/* Bilingual Cosmos Recital Room Card */}
                  <div
                    onClick={() => {
                      setActiveTab('bilingual');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-amber-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <Languages className="w-5.5 h-5.5 text-amber-400" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-amber-400 transition-colors">
                      {trans('home.bilingualTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.bilingualDesc')}
                    </p>
                  </div>

                  {/* Telemetry Stats Card */}
                  <div
                    onClick={() => {
                      setActiveTab('stats');
                      window.speechSynthesis.cancel();
                    }}
                    className={`p-6 rounded-3xl ${activeTheme.cardClass} hover:border-emerald-500/25 border border-white/5 cursor-pointer hover:scale-[1.01] transition-all duration-300 group flex flex-col items-center text-center sm:items-start sm:text-left`}
                  >
                    <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl sm:rounded-2xl w-fit mb-2.5 sm:mb-4">
                      <BarChart2 className="w-5.5 h-5.5" />
                    </div>
                    <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-emerald-400 transition-colors">
                      {trans('home.statsTitle')}
                    </h4>
                    <p className="hidden sm:block text-xs text-zinc-500 mt-2 font-mono leading-relaxed">
                      {trans('home.statsDesc')}
                    </p>
                  </div>

                </div>
              </div>

              {/* Quantum Recitation Portal modes */}
              <div className="space-y-3.5 pt-4">
                <h3 className="text-xs font-black font-mono uppercase tracking-widest text-zinc-400 px-1">
                  {trans('home.modesHeader')}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  {([
                    { id: 'study', title: trans('modes.flashcards'), desc: trans('home.modeStudyDesc'), color: 'border-fuchsia-500/25 text-fuchsia-400', bg: 'bg-fuchsia-500/5' },
                    { id: 'quiz', title: trans('modes.quiz'), desc: trans('home.modeQuizDesc'), color: 'border-emerald-500/25 text-emerald-400', bg: 'bg-emerald-500/5' },
                    { id: 'listening', title: trans('modes.listening'), desc: trans('home.modeListenDesc'), color: 'border-amber-500/25 text-amber-400', bg: 'bg-amber-500/5' },
                    { id: 'reading', title: trans('modes.reading'), desc: trans('home.modeReadDesc'), color: 'border-blue-500/25 text-blue-400', bg: 'bg-blue-500/5' }
                  ] as const).map(mode => (
                    <div
                      key={mode.id}
                      onClick={() => {
                        const g = gGroups[0] || bentoGroups[0];
                        if (g) {
                          void startGroupPractice(g, mode.id);
                        } else {
                          setActiveTab('practice');
                          startModePractice(mode.id);
                        }
                      }}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-900/15 border border-white/5 hover:border-indigo-500/25 hover:bg-slate-900/50 cursor-pointer group transition-all duration-300 flex flex-col items-center text-center sm:items-start sm:text-left"
                    >
                      <div className={`p-2.5 sm:p-3 rounded-xl w-fit mb-2.5 sm:mb-4 group-hover:scale-105 transition-transform ${mode.color} ${mode.bg}`}>
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h4 className="font-extrabold text-[11px] leading-tight sm:text-sm text-slate-100 group-hover:text-indigo-400 transition-colors">
                        {mode.title}
                      </h4>
                      <p className="hidden sm:block text-xs text-zinc-500 mt-1.5 font-mono">{mode.desc}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quantum Custom Bento Box Waterfall Catalog */}
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center px-1">
                  <div>
                    <h3 className="text-sm font-black font-mono uppercase tracking-widest text-zinc-400">
                      {trans('home.dossiersTitle')}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                      {trans('home.dossiersDesc')}
                    </p>
                  </div>
                  <button 
                    onClick={() => setActiveTab('shelf')}
                    className="text-xs font-mono text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    {trans('home.allPacks')} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Staggered Bento Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 auto-rows-auto">
                  {bentoGroups.map((group, idx) => {
                    // Match decoration variables
                    const progressVal = group.progress;
                    
                    return (
                      <motion.div
                        key={group.id}
                        onClick={() => {
                          setActiveTab('shelf');
                          selectBookCourse(group);
                        }}
                        whileHover={{ scale: 1.015, y: -4 }}
                        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                        className={`rounded-3xl relative overflow-hidden cursor-pointer group flex flex-col justify-between p-6 transition-all duration-300 border backdrop-blur-xl ${group.gridSpan} ${
                          dark 
                            ? `bg-slate-900/40 border-white/5 hover:border-indigo-500/30 ${activeTheme.glowClass}` 
                            : `bg-white/40 border-zinc-200 hover:border-indigo-400/40 shadow-sm hover:shadow-indigo-100/40`
                        }`}
                      >
                        {/* A. Premium Photo Backdrops */}
                        <div 
                          className="absolute inset-0 bg-cover bg-center mix-blend-overlay opacity-[0.14] dark:opacity-[0.08] pointer-events-none transition-transform duration-700 group-hover:scale-105"
                          style={{
                            backgroundImage: group.id === 'bento-cosmic-1' 
                              ? 'url("https://images.unsplash.com/photo-1506318137071-a8e063b4bec0?auto=format&fit=crop&q=60&w=800")' 
                              : group.id === 'bento-silicon-2'
                              ? 'url("https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&q=60&w=800")' 
                              : group.id === 'bento-literary-3'
                              ? 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=60&w=800")' 
                              : 'url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=60&w=800")'
                          }}
                        />

                        {/* B. Kinetic Text Waterfall Rainfall Backdrop */}
                        <div className="absolute inset-0 overflow-hidden opacity-[0.06] dark:opacity-[0.04] pointer-events-none select-none font-mono text-[8px] uppercase tracking-widest leading-none">
                          <div className={`flex flex-col gap-2 ${idx % 2 === 0 ? 'animate-[pulse_4s_infinite]' : 'animate-pulse'}`}>
                            {Array.from({ length: 12 }).map((_, rIdx) => (
                              <div key={rIdx} className="flex gap-4 whitespace-nowrap animate-marquee">
                                <span>{group.type}</span>
                                <span>{group.name.split(' ')[0]}</span>
                                <span>INDEXED</span>
                                <span>VOCAB</span>
                                <span>FLOW</span>
                                <span>SYNAPSE</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* C. Beautiful SVG Decorative Artwork Backdrops */}
                        <div className="absolute right-2 bottom-2 w-32 h-32 opacity-20 dark:opacity-15 pointer-events-none transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12">
                          {group.decorativeSvg === 'nebula' && (
                            <svg className="w-full h-full fill-none stroke-current text-indigo-500" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="30" strokeWidth="1" strokeDasharray="4 2" />
                              <circle cx="50" cy="50" r="20" strokeWidth="2" strokeDasharray="8 8" className="animate-[spin_20s_linear_infinite]" />
                              <path d="M10,50 L90,50 M50,10 L50,90" strokeWidth="0.5" strokeDasharray="1 3" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'matrix' && (
                            <svg className="w-full h-full fill-none stroke-current text-emerald-500" viewBox="0 0 100 100">
                              <path d="M20,10 V90 M40,20 V80 M60,10 V90 M80,20 V80" strokeWidth="1.5" strokeDasharray="5 15" className="animate-[pulse_2s_infinite]" />
                              <circle cx="20" cy="40" r="3" fill="currentColor" />
                              <circle cx="60" cy="70" r="3" fill="currentColor" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'stars' && (
                            <svg className="w-full h-full fill-none stroke-current text-rose-500" viewBox="0 0 100 100">
                              <polygon points="50,10 53,40 85,43 55,55 60,85 50,65 40,85 45,55 15,43 47,40" strokeWidth="1" className="animate-pulse" />
                              <circle cx="15" cy="15" r="2" fill="currentColor" />
                              <circle cx="85" cy="85" r="2" fill="currentColor" className="animate-ping" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'waves' && (
                            <svg className="w-full h-full fill-none stroke-current text-sky-500" viewBox="0 0 100 100">
                              <path d="M10,30 Q30,60 50,30 T90,30" strokeWidth="1.5" className="animate-[bounce_3s_infinite]" />
                              <path d="M10,50 Q30,80 50,50 T90,50" strokeWidth="1" opacity="0.6" />
                              <path d="M10,70 Q30,100 50,70 T90,70" strokeWidth="0.5" opacity="0.3" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'rings' && (
                            <svg className="w-full h-full fill-none stroke-current text-amber-500" viewBox="0 0 100 100">
                              <circle cx="50" cy="50" r="35" strokeWidth="0.5" />
                              <circle cx="50" cy="50" r="25" strokeWidth="1" strokeDasharray="2 2" className="animate-[spin_10s_linear_infinite]" />
                              <circle cx="50" cy="50" r="15" strokeWidth="1.5" />
                            </svg>
                          )}
                          {group.decorativeSvg === 'bars' && (
                            <svg className="w-full h-full fill-none stroke-current text-fuchsia-500" viewBox="0 0 100 100">
                              <rect x="20" y="40" width="10" height="40" strokeWidth="1" className="animate-[pulse_1.5s_infinite]" />
                              <rect x="40" y="20" width="10" height="60" strokeWidth="1.5" className="animate-pulse" />
                              <rect x="60" y="50" width="10" height="30" strokeWidth="1" className="animate-[pulse_2.5s_infinite]" />
                            </svg>
                          )}
                        </div>

                        {/* Top Metadata Header with One-click Enroll */}
                        <div className="relative z-10 space-y-1">
                          <div className="flex justify-between items-center gap-2">
                            <div className="flex gap-1.5 items-center">
                              <span className="text-[9px] font-black font-mono uppercase tracking-widest bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/10">
                                {group.badge}
                              </span>
                              <span className="text-[9px] font-mono uppercase tracking-wider bg-zinc-500/10 dark:bg-zinc-500/20 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded-full border border-zinc-500/10" title={trans('tip.langCode')}>
                                lang: {group.language || 'en'}
                              </span>
                            </div>

                            {/* One-click Enroll button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToast(trans('toast.pinned', { name: group.name }), 'success');
                              }}
                              className="px-2 py-1 text-[9px] font-mono font-bold tracking-tight uppercase bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-650 hover:to-indigo-750 text-white rounded-lg transition-all shadow-md active:scale-95 flex items-center gap-1 cursor-pointer z-20"
                              title={trans('tip.sync1click')}
                            >
                              <Sparkles className="w-2.5 h-2.5" />
                              <span>{trans('home.enroll')}</span>
                            </button>
                          </div>

                          <h4 className="text-md font-black tracking-tight mt-2.5 group-hover:text-indigo-500 transition-colors">
                            {group.name}
                          </h4>
                          <p className="text-[11px] text-zinc-500 font-sans line-clamp-2 leading-snug mt-1 max-w-[85%]">
                            {group.description}
                          </p>
                        </div>

                        {/* Bottom Status Panel */}
                        <div className="relative z-10 pt-4 mt-4 border-t border-zinc-200/50 dark:border-white/5 space-y-2">
                          <div className="flex justify-between items-end text-[10px] font-mono select-none">
                            <div className="space-y-0.5">
                              <span className="text-zinc-600 dark:text-zinc-400 block">{group.statsLabel}</span>
                              <span className="font-bold text-sky-500 dark:text-indigo-300">{trans('home.lexAvail', { n: group.count })}</span>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-emerald-500">{trans('home.pctMastered', { n: progressVal })}</span>
                            </div>
                          </div>

                          {/* Linear progress bar */}
                          <div className="w-full bg-zinc-200/60 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <motion.div 
                              className="h-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${progressVal}%` }}
                              transition={{ duration: 1.5, delay: idx * 0.1 }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              {/* Multi-category content hub — live backend word / book / subtitle
                  / document groups (WfNewHomeContent widget reads getHomeContent). */}
              <WfNewHomeContentWidget
                content={homeContent}
                loading={homeContentLoading}
                theme={activeTheme}
                trans={trans}
                onOpen={openHomeGroup}
                onMore={(kind) => { setContentListKind(kind); setActiveTab('content-list'); }}
                onNeedMore={loadMoreGroups}
              />
            </motion.div>
          )}

          {/* ====== CONTENT LIST PAGE (full category — 20 rows/page) ====== */}
          {activeTab === 'content-list' && contentListKind && (
            <motion.div
              key="content-list"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <WfNewContentListPage
                kind={contentListKind}
                groups={homeContent[({ word: 'words', book: 'books', subtitle: 'subtitles', library: 'libraries', document: 'documents' } as const)[contentListKind]]}
                theme={activeTheme}
                trans={trans}
                onOpen={openHomeGroup}
                fetchPage={fetchContentListPageBound}
              />
            </motion.div>
          )}

          {/* ====== VOCABULARY LIBRARY WORD-BROWSER (paginated, URL-routed) ====== */}
          {activeTab === 'library' && libraryRoute && (
            <motion.div
              key="library"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <WfNewLibraryPage
                libraryId={libraryRoute.id}
                title={libraryRoute.title}
                language={libraryRoute.language}
                page={libraryRoute.page}
                view={libraryRoute.view}
                theme={activeTheme}
                trans={trans}
                onChangePage={(p) => setLibraryRoute((r) => (r ? { ...r, page: p } : r))}
                onChangeView={(v) => setLibraryRoute((r) => (r ? { ...r, view: v } : r))}
              />
            </motion.div>
          )}

          {/* ====== COURSE SHELF TAB ====== */}
          {activeTab === 'shelf' && (
            <motion.div
              key="shelf"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="space-y-6"
            >
              {!selectedCourse ? (
                <>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight">{trans('library.title')}</h2>
                    <p className="text-zinc-500 text-xs mt-1">{trans('library.subtitle')}</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {gGroups.map(g => (
                      <CourseBlockCard
                        key={g.id}
                        group={g}
                        theme={activeTheme}
                        onClick={() => selectBookCourse(g)}
                        lang={shellLang}
                        trans={trans}
                      />
                    ))}
                  </div>
                </>
              ) : (
                /* Interactive Course deep-dive panel */
                <div className="space-y-6">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setSelectedCourse(null);
                        setCourseWords([]);
                      }}
                      className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-xl font-bold tracking-tight">{selectedCourse.name}</h2>
                      <p className="text-zinc-500 text-xs">{trans('home.examineSub')}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Course Overview */}
                    <div className="space-y-4">
                      <div className={`p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded">
                          {trans('detail.syllabus')}
                        </span>
                        
                        <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                          {selectedCourse.description || trans('home.courseDescFallback')}
                        </p>

                        <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-3 text-center">
                          <div className="p-3 bg-white/5 rounded-xl">
                            <p className="text-xl font-bold font-mono">{selectedCourse.count}</p>
                            <span className="text-[9px] uppercase font-mono text-zinc-500">Lexemes</span>
                          </div>
                          <div className="p-3 bg-white/5 rounded-xl">
                            <p className="text-xl font-bold font-mono">~4 days</p>
                            <span className="text-[9px] uppercase font-mono text-zinc-500">Repetitions</span>
                          </div>
                        </div>

                        {/* Controls */}
                        <div className="space-y-2 pt-2">
                          <button
                            onClick={() => {
                              setSelectedPracticeGroup(selectedCourse);
                              setActiveTab('practice');
                              startModePractice('study');
                            }}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-mono uppercase tracking-widest py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg"
                          >
                            <GraduationCap className="w-4 h-4" />
                            {trans('detail.learn')}
                          </button>
                          
                          <button
                            onClick={() => {
                              setSelectedPracticeGroup(selectedCourse);
                              setActiveTab('practice');
                              startModePractice('quiz');
                            }}
                            className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono uppercase tracking-widest py-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 border border-white/5"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {trans('detail.quiz')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Word row lists (2 Columns wide) */}
                    <div className="lg:col-span-2 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">
                          {trans('detail.vocab')} ({courseWords.length})
                        </h3>
                      </div>

                      <div className="grid grid-cols-1 gap-2 max-h-[550px] overflow-y-auto pr-1 no-scrollbar">
                        {courseWords.map(word => (
                          <WordRowItem
                            key={word.id}
                            word={word}
                            isFav={favorites.some(f => f.id === word.id)}
                            onToggleFav={() => handleToggleFavorite(word)}
                            onPlayAudio={() => playPhoneticSpeech(word)}
                            onClick={() => setSelectedWordDetail(word)}
                            theme={activeTheme}
                            trans={trans}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ====== PRACTICE ARENA TAB ====== */}
          {activeTab === 'practice' && (
            <motion.div
              key="practice"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6"
            >
              {!practiceMode ? (
                <div className="max-w-2xl mx-auto text-center py-16 space-y-8">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black">{trans('practice.select')}</h2>
                    <p className="text-zinc-500 text-xs font-mono">{trans('practice.selectSub')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gGroups.map(g => (
                      <button
                        key={g.id}
                        onClick={() => { void startGroupPractice(g, 'study'); }}
                        className={`p-5 rounded-2xl text-left border transition-all ${
                          selectedPracticeGroup?.id === g.id
                            ? 'border-indigo-500 bg-indigo-500/5'
                            : 'border-white/5 bg-slate-900/20 hover:bg-slate-900/40'
                        }`}
                      >
                        <h4 className="font-bold text-sm">{g.name}</h4>
                        <span className="text-[10px] font-mono text-zinc-500 mt-2 block">{g.count} Words total</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* ACTIVE PLAY MODES */
                <div className="space-y-6 max-w-3xl mx-auto">
                  
                  {/* Mode header */}
                  <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/5">
                    <button
                      onClick={() => setPracticeMode(null)}
                      className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-white"
                    >
                      <ArrowLeft className="w-4 h-4" /> Exit Session
                    </button>

                    <div className="flex gap-2">
                      {([
                        { id: 'study', label: 'Cards' },
                        { id: 'quiz', label: 'Arena' },
                        { id: 'listening', label: 'Sound' },
                        { id: 'reading', label: 'Synthesized' }
                      ] as const).map(m => (
                        <button
                          key={m.id}
                          onClick={() => startModePractice(m.id)}
                          className={`text-[10px] font-mono uppercase px-3 py-1.5 rounded-lg border transition-all ${
                            practiceMode === m.id
                              ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300'
                              : 'bg-transparent border-transparent text-zinc-500 hover:text-white'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* SUBMODE INTERFACES */}
                  {practiceMode === 'study' && courseWords[practiceIndex] && (
                    <div className="flex flex-col items-center gap-6 py-6">
                      
                      {/* Perspective Card item */}
                      <div 
                        onClick={() => setIsFlipped(!isFlipped)}
                        className="w-full max-w-md h-72 cursor-pointer perspective"
                      >
                        <motion.div
                          animate={{ rotateY: isFlipped ? 180 : 0 }}
                          transition={{ duration: 0.6, ease: 'easeInOut' }}
                          className="w-full h-full relative transform-style-3d shadow-2xl rounded-3xl"
                        >
                          {/* Front Side */}
                          <div className={`absolute inset-0 backface-hidden flex flex-col justify-between p-8 rounded-3xl border border-indigo-500/20 bg-slate-900/80 text-center ${
                            activeTheme.id === 'nordic' ? 'bg-white text-slate-800' : ''
                          }`}>
                            <div className="self-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playPhoneticSpeech(courseWords[practiceIndex]);
                                }}
                                className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                                title={trans('tip.speak')}
                              >
                                <Volume2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-2">
                              <h3 className="text-4xl font-black tracking-tight">{courseWords[practiceIndex].text}</h3>
                              <p className="text-sm font-mono text-zinc-400">{courseWords[practiceIndex].phonetic}</p>
                            </div>

                            <p className="text-[10px] uppercase font-mono text-zinc-600">{trans('card.flip')}</p>
                          </div>

                          {/* Back Side */}
                          <div className={`absolute inset-0 backface-hidden rotate-y-180 flex flex-col justify-between p-8 rounded-3xl border border-indigo-500/20 bg-indigo-950/90 text-center ${
                            activeTheme.id === 'nordic' ? 'bg-slate-50 text-slate-900' : ''
                          }`}>
                            <span className="text-[10px] font-mono font-bold text-zinc-500">Definition Map</span>

                            <div className="space-y-4">
                              <p className="text-xl font-bold text-indigo-400">{courseWords[practiceIndex].translation}</p>
                              <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                                {courseWords[practiceIndex].definition || 'Definition description placeholder'}
                              </p>
                              {courseWords[practiceIndex].example && (
                                <p className="text-[11px] italic font-mono text-zinc-500">
                                  &ldquo;{courseWords[practiceIndex].example}&rdquo;
                                </p>
                              )}
                            </div>

                            <div className="text-[10px] font-mono text-zinc-500">Mastery Dial: {courseWords[practiceIndex].masteryLevel || 70}%</div>
                          </div>
                        </motion.div>
                      </div>

                      {/* Control keys */}
                      <div className="flex gap-4 w-full max-w-md">
                        <button
                          onClick={() => {
                            addToast(trans('toast.removed'), 'warning');
                            setIsFlipped(false);
                            setPracticeIndex(prev => (prev + 1) % courseWords.length);
                          }}
                          className="flex-1 py-3.5 bg-white/5 hover:bg-white/10 text-zinc-400 rounded-2xl text-xs font-mono font-bold border border-white/5"
                        >
                          {trans('practice.forgot')}
                        </button>

                        <button
                          onClick={() => {
                            addToast(trans('toast.added'), 'star');
                            setIsFlipped(false);
                            setUserStats(prev => ({ ...prev, dailyProgress: Math.min(prev.dailyProgress + 1, prev.dailyGoal) }));
                            setPracticeIndex(prev => (prev + 1) % courseWords.length);
                          }}
                          className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-mono font-bold"
                        >
                          {trans('practice.mastered')}
                        </button>
                      </div>
                    </div>
                  )}

                  {practiceMode === 'quiz' && courseWords[practiceIndex] && (
                    <div className="p-6 rounded-3xl bg-slate-900/35 border border-white/5 space-y-6">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono text-zinc-500">
                          Progress index: {practiceIndex + 1} / {courseWords.length}
                        </span>

                        <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded font-mono font-bold">
                          {trans('practice.quizStreak')}: {quizStreak}
                        </span>
                      </div>

                      <div className="space-y-2 text-center py-4">
                        <h3 className="text-3xl font-black text-white">{courseWords[practiceIndex].text}</h3>
                        <p className="text-xs font-mono text-indigo-400">{courseWords[practiceIndex].phonetic}</p>
                      </div>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {activeQuizOptions.map(option => {
                          const isSelected = selectedQuizOption === option;
                          const isCorrect = option === courseWords[practiceIndex].translation;
                          
                          let btnClass = 'border-white/5 bg-slate-900/20 text-zinc-300 hover:bg-white/5';
                          if (quizAnswered) {
                            if (isCorrect) btnClass = 'border-emerald-500 bg-emerald-500/15 text-emerald-400';
                            else if (isSelected) btnClass = 'border-rose-500 bg-rose-500/15 text-rose-400';
                          }

                          return (
                            <button
                              key={option}
                              onClick={() => handleQuizAnswer(option)}
                              disabled={quizAnswered}
                              className={`p-4 rounded-2xl border text-left text-xs font-medium font-mono transition-all flex justify-between items-center ${btnClass}`}
                            >
                              <span>{option}</span>
                              {quizAnswered && isCorrect && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      {quizAnswered && (
                        <div className="pt-4 border-t border-white/5 flex justify-between items-center">
                          <p className={`text-xs font-mono font-bold ${quizFeedback === 'correct' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {quizFeedback === 'correct' ? trans('correct') : trans('incorrect')}
                          </p>

                          <button
                            onClick={proceedQuizNext}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5"
                          >
                            <span>{trans('practice.quizNext')}</span>
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {practiceMode === 'listening' && (
                    <div className="p-8 rounded-3xl bg-slate-900/20 border border-white/5 flex flex-col items-center text-center gap-6 py-12">
                      <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                        <Volume2 className="w-8 h-8 animate-pulse" />
                      </div>

                      <div className="space-y-2 max-w-md">
                        <h4 className="font-extrabold text-lg text-slate-100">
                          {trans('playlist.loop')}
                        </h4>
                        <p className="text-xs text-zinc-500 font-mono leading-relaxed">
                          {trans('practice.listeningDesc')}
                        </p>
                      </div>

                      {courseWords[practiceIndex] && (
                        <div className="p-5 bg-white/5 rounded-2xl min-w-[240px] text-center border border-white/5 space-y-1">
                          <p className="text-2xl font-black text-indigo-300">{courseWords[practiceIndex].text}</p>
                          <p className="text-xs text-zinc-500 font-mono">{courseWords[practiceIndex].phonetic}</p>
                          <p className="text-sm font-semibold text-zinc-400 pt-1.5 border-t border-white/5">{courseWords[practiceIndex].translation}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setPracticeIndex(prev => (prev - 1 + courseWords.length) % courseWords.length);
                            playPhoneticSpeech(courseWords[(practiceIndex - 1 + courseWords.length) % courseWords.length]);
                          }}
                          className="p-3 bg-white/5 rounded-full text-zinc-300 hover:bg-white/10"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => setIsListeningPlaying(!isListeningPlaying)}
                          className="p-4 bg-indigo-600 rounded-full hover:bg-indigo-500 text-white"
                        >
                          {isListeningPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                        </button>

                        <button
                          onClick={() => {
                            setPracticeIndex(prev => (prev + 1) % courseWords.length);
                            playPhoneticSpeech(courseWords[(practiceIndex + 1) % courseWords.length]);
                          }}
                          className="p-3 bg-white/5 rounded-full text-zinc-300 hover:bg-white/10"
                        >
                          <SkipForward className="w-4 h-4" />
                        </button>
                      </div>

                      {isListeningPlaying && (
                        <p className="text-[10px] text-emerald-400 font-mono animate-pulse">{trans('practice.listeningActive')}</p>
                      )}
                    </div>
                  )}

                  {practiceMode === 'reading' && (
                    <div className="p-6 rounded-3xl bg-slate-900/35 border border-white/5 space-y-6">
                      <div className="space-y-1">
                        <h4 className="text-sm font-extrabold uppercase font-mono tracking-wider text-indigo-400">Context Flow Synthesis</h4>
                        <p className="text-[10px] text-zinc-500 font-mono">{trans('practice.readDesc')}</p>
                      </div>

                      {/* Generated reading block */}
                      <p className="text-sm text-zinc-300 leading-8 font-serif px-2 border-l-2 border-indigo-500/30">
                        {readParagraph.split(' ').map((word, i) => {
                          const clean = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
                          const isTarget = courseWords.some(cw => cw.text.toLowerCase() === clean.toLowerCase());
                          
                          if (isTarget) {
                            const exactWord = courseWords.find(cw => cw.text.toLowerCase() === clean.toLowerCase())!;
                            return (
                              <span 
                                key={i}
                                onClick={() => {
                                  setSelectedWordDetail(exactWord);
                                  playPhoneticSpeech(exactWord);
                                }}
                                className="text-indigo-400 font-black cursor-pointer hover:bg-indigo-500/15 duration-200 px-1 py-0.5 rounded leading-none border-b border-indigo-400/40 mr-1 inline-block"
                              >
                                {word}
                              </span>
                            );
                          }
                          return <span key={i} className="mr-1">{word}</span>;
                        })}
                      </p>
                    </div>
                  )}

                </div>
              )}
            </motion.div>
          )}

          {/* ====== AI COGNITIVE LAB ====== */}
          {activeTab === 'labs' && (
            <motion.div
              key="labs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 max-w-3xl mx-auto"
            >
              <div className="text-center py-2">
                <h2 className="text-2xl font-black">{trans('lab.title')}</h2>
                <p className="text-zinc-500 text-xs font-mono">{trans('lab.sub')}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Forge Form */}
                <div className={`md:col-span-2 p-6 rounded-3xl ${activeTheme.cardClass} space-y-4`}>
                  <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-indigo-400">
                    {trans('lab.addWord')}
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordText')}</label>
                      <input
                        type="text"
                        placeholder={trans('lab.phWord')}
                        value={newWordText}
                        onChange={(e) => setNewWordText(e.target.value)}
                        className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordTransl')}</label>
                      <input
                        type="text"
                        placeholder={trans('lab.phTransl')}
                        value={newWordTransl}
                        onChange={(e) => setNewWordTransl(e.target.value)}
                        className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordPhon')}</label>
                    <input
                      type="text"
                      placeholder={trans('lab.phPhon')}
                      value={newWordPhon}
                      onChange={(e) => setNewWordPhon(e.target.value)}
                      className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none ${activeTheme.inputClass}`}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase font-mono text-zinc-500">{trans('lab.wordDef')}</label>
                    <textarea
                      rows={3}
                      placeholder={trans('lab.phDef')}
                      value={newWordDef}
                      onChange={(e) => setNewWordDef(e.target.value)}
                      className={`w-full py-2.5 px-3.5 text-xs font-mono rounded-xl outline-none resize-none ${activeTheme.inputClass}`}
                    />
                  </div>

                  <button
                    onClick={handleForgeCustomWord}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3.5 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider"
                  >
                    {trans('lab.btn')}
                  </button>
                </div>

                {/* Forged lists */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold font-mono uppercase tracking-widest text-zinc-500">Live Active Injectors</h4>
                  
                  <div className="space-y-2 max-h-[380px] overflow-y-auto no-scrollbar">
                    {courseWords.filter(w => w.id.startsWith('custom')).map(word => (
                      <div key={word.id} className="p-3.5 rounded-xl bg-white/5 border border-white/5 flex justify-between items-center">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-bold text-indigo-400">{word.text}</p>
                          <p className="text-[10px] text-zinc-500 truncate mt-1">{word.translation}</p>
                        </div>
                        <button
                          onClick={() => {
                            setCourseWords(prev => prev.filter(w => w.id !== word.id));
                            addToast(trans('toast.wipedForge'), 'warning');
                          }}
                          className="p-1.5 bg-white/5 rounded-lg text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {courseWords.filter(w => w.id.startsWith('custom')).length === 0 && (
                      <div className="text-center py-12 text-xs font-mono text-zinc-600">
                        No forged words in current live catalog. Add one to see it here!
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ====== SETTINGS PAGE TAB ====== */}
          {activeTab === 'settings' && (
            <WfNewSettings
              activeTheme={activeTheme}
              saveThemeChoice={(id) => { setActiveThemeId(id); wfNewSettings.setField('themeId', id); }}
              lang={shellLang}
              setLang={setShellLang}
              dark={dark}
              toggleDark={toggleDark}
              userStats={userStats}
              setUserStats={setUserStats}
              nickname={nickname}
              setNickname={setNickname}
              avatarUrl={avatarUrl}
              setAvatarUrl={setAvatarUrl}
              speechRate={speechRate}
              setSpeechRate={setSpeechRate}
              onClearCache={handleClearEverything}
              onOpenLanguages={() => setActiveTab('languages')}
              onOpenLearningModel={() => setActiveTab('learning-model')}
              onOpenPlaybackSettings={() => setActiveTab('playback')}
              onOpenLabs={() => setActiveTab('labs')}
              onOpenAbout={() => setActiveTab('about')}
              isLoggedIn={currentUser.isLoggedIn}
              trans={trans}
            />
          )}

          {/* ====== ABOUT TAB ====== */}
          {activeTab === 'about' && (
            <motion.div
              key="about"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <WfNewAbout activeTheme={activeTheme} trans={trans} />
            </motion.div>
          )}

          {/* ====== LEARNING LANGUAGES TAB (native + multi-target) ====== */}
          {activeTab === 'languages' && (
            <motion.div
              key="languages"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <WfNewLanguages
                activeTheme={activeTheme}
                trans={trans}
                addToast={addToast}
                onSaved={(sel) => {
                  wfNewSettings.setField('settingNativeLang', sel.native_language);
                  if (sel.learning_languages[0]) {
                    wfNewSettings.setField('settingTargetLang', sel.learning_languages[0]);
                  }
                }}
              />
            </motion.div>
          )}

          {/* ====== LEARNING MODEL (memorization mode + walkman params) ====== */}
          {activeTab === 'learning-model' && (
            <motion.div key="learning-model" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <WfNewLearningModel
                activeTheme={activeTheme}
                trans={trans}
                onOpenReview={() => setActiveTab('review-settings')}
              />
            </motion.div>
          )}

          {/* ====== REVIEW SETTINGS (sub-page of Learning Model) ====== */}
          {activeTab === 'review-settings' && (
            <motion.div key="review-settings" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <WfNewReviewSettings activeTheme={activeTheme} trans={trans} />
            </motion.div>
          )}

          {/* ====== PLAYBACK SETTINGS (subtitle player prefs, sub-page of Settings) ====== */}
          {activeTab === 'playback' && (
            <motion.div key="playback" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
              <WfNewPlaybackSettings activeTheme={activeTheme} trans={trans} />
            </motion.div>
          )}

          {/* ====== CYBERNETIC WALKMAN RECITAL TAB ====== */}
          {activeTab === 'walkman' && (
            <motion.div
              key="walkman"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <WfNewWalkman
                activeTheme={activeTheme} 
                courseWords={courseWords} 
                addToast={addToast}
                trans={trans}
                lang={shellLang}
              />
            </motion.div>
          )}

          {/* ====== INTERACTIVE SUBTITLES TRACK VIEW ====== */}
          {activeTab === 'subtitles' && (
            <motion.div
              key="subtitles"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <WfNewSubtitles
                activeTheme={activeTheme}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                addToast={addToast}
                sourceKey={selectedSubtitleKey}
                onOpenPlaybackSettings={() => setActiveTab('playback')}
                trans={trans}
              />
            </motion.div>
          )}

          {/* ====== BILINGUAL COSMOS RECITAL VIEW ====== */}
          {activeTab === 'bilingual' && (
            <motion.div
              key="bilingual"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <WfNewBilingual
                activeTheme={activeTheme} 
                addToast={addToast}
                trans={trans}
                dark={dark}
              />
            </motion.div>
          )}

          {/* ====== BOOK READER (book -> chapter -> bilingual verses) ====== */}
          {activeTab === 'book-reader' && bookReader && (
            <motion.div
              key="book-reader"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <WfNewBookReader
                sourceKey={bookReader.sourceKey}
                title={bookReader.title}
                activeTheme={activeTheme}
                trans={trans}
                dark={dark}
                addToast={addToast}
              />
            </motion.div>
          )}

          {/* ====== SOCIAL COOPERATIVE CORRIDOR VIEW ====== */}
          {activeTab === 'social' && (
            <motion.div
              key="social"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-6"
            >
              <WfNewSocial
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                currentUser={currentUser}
                onRequireAuth={() => setActiveTab('auth')}
              />
            </motion.div>
          )}

          {/* ====== COGNITIVE PROFILE DASHBOARD ====== */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <WfNewProfile
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
                onAvatarUpdated={(url) => {
                  // The upload already persisted to the backend — reflect it
                  // immediately everywhere (top-right chip + big avatar + store)
                  // without needing a separate profile Save.
                  setAvatarUrl(url);
                  wfNewSettings.setField('avatar', url);
                  setCurrentUser(prev => ({ ...prev, avatar: url }));
                }}
                onLogin={() => setActiveTab('auth')}
                onLogout={handleLogout}
                learnedWordsCount={courseWords.length || 72}
              />
            </motion.div>
          )}

          {/* ====== MOCK AUTHENTICATION PORTAL ====== */}
          {activeTab === 'auth' && (
            <motion.div
              key="auth"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              className="space-y-6"
            >
              <WfNewAuth
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
                lang={shellLang}
                currentUser={currentUser}
                onLoginSuccess={handleLoginSuccess}
                onLogout={handleLogout}
              />
            </motion.div>
          )}

          {/* ====== PRECISION STATISTICS & RETENTION CHART TAB ====== */}
          {activeTab === 'stats' && (
            <motion.div
              key="stats"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              <WfNewAnalytics
                activeTheme={activeTheme}
                addToast={addToast}
                trans={trans}
              />
            </motion.div>
          )}

        </AnimatePresence>
      </main>

      {/* Floating high-end search overlay dialog */}
      <WfNewSearchOverlay
        isOpen={isSearchOverlayOpen}
        onClose={() => setIsSearchOverlayOpen(false)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        searching={searching}
        favorites={favorites}
        onToggleFavorite={handleToggleFavorite}
        onSelectWord={(word) => {
          setSelectedWordDetail(word);
          setIsSearchOverlayOpen(false);
        }}
        onPlayAudio={playPhoneticSpeech}
        trans={trans}
        activeTheme={activeTheme}
        dark={dark}
      />

      {/* Detailed Word modal popup */}
      <AnimatePresence>
        {selectedWordDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedWordDetail(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`w-full max-w-md p-6 rounded-3xl border border-white/10 shadow-2xl relative z-10 space-y-4 ${
                activeTheme.id === 'nordic' 
                  ? 'bg-white text-slate-800' 
                  : 'bg-slate-900 text-white'
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded font-bold">Lexicon index</span>
                <button
                  onClick={() => handleToggleFavorite(selectedWordDetail)}
                  className="p-1 rounded hover:bg-white/10"
                >
                  <Star className={`w-4 h-4 ${favorites.some(f => f.id === selectedWordDetail.id) ? 'fill-amber-400 text-amber-400' : 'text-zinc-400'}`} />
                </button>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-3xl font-black text-indigo-300">{selectedWordDetail.text}</h3>
                  <button
                    onClick={() => playPhoneticSpeech(selectedWordDetail)}
                    className="p-2 bg-white/5 rounded-full hover:bg-white/10"
                  >
                    <Volume2 className="w-4 h-4 text-zinc-300" />
                  </button>
                </div>
                <p className="text-xs font-mono text-zinc-500">{selectedWordDetail.phonetic}</p>
              </div>

              <p className="text-sm font-bold text-zinc-300 border-t border-b border-white/5 py-3">{selectedWordDetail.translation}</p>

              {selectedWordDetail.definition && (
                <div className="space-y-1">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">En Definition</span>
                  <p className="text-xs text-zinc-400 leading-relaxed font-sans">{selectedWordDetail.definition}</p>
                </div>
              )}

              {selectedWordDetail.example && (
                <div className="space-y-1 pt-1.5">
                  <span className="text-[10px] font-mono text-zinc-500 uppercase block">Practical Example</span>
                  <p className="text-xs font-mono italic text-zinc-400 leading-relaxed">&ldquo;{selectedWordDetail.example}&rdquo;</p>
                </div>
              )}

              <button
                onClick={() => setSelectedWordDetail(null)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-xs font-mono text-zinc-400 rounded-xl mt-2"
              >
                Close details
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Bottom Navigator dock */}
      <WfNewBottomDock
        activeTab={activeTab}
        setActiveTab={(tab) => {
          // Dock Home is a direct "go home" (clears history); other dock tabs are
          // forward navigations that push onto the stack.
          if (tab === 'home') goHome();
          else setActiveTab(tab as WfTab);
          setSelectedCourse(null);
          setPracticeMode(null);
        }}
        trans={trans}
        activeTheme={activeTheme}
        dark={dark}
      />

      {/* Dynamic 3-Step Startup Onboarding Wizard */}
      <AnimatePresence>
        {showOnboarding && (
          <WfNewOnboarding
            onComplete={handleOnboardingComplete}
            trans={trans}
            activeTheme={activeTheme}
            onSelectTheme={(themeId) => {
              setActiveThemeId(themeId);
              wfNewSettings.setField('themeId', themeId);
              // Roam the theme choice in the backend's opaque app_settings blob.
              void wfNewApi.updatePreferences({ app_settings: { themeId } }).catch(() => {});
            }}
            onSetGoal={(goal) => {
              setUserStats(prev => ({ ...prev, dailyGoal: goal }));
              wfNewSettings.setField('dailyGoal', goal);
              // Roam the daily goal in the backend preferences.
              void wfNewApi.updatePreferences({ daily_goal: goal }).catch(() => {});
            }}
          />
        )}
      </AnimatePresence>

      {/* Premium Notification Toasters */}
      <WfNewToast toasts={toasts} onDismiss={wfNewNotify.dismiss} />

      </div>
    </div>
  );
};

export default WfNewApp;
