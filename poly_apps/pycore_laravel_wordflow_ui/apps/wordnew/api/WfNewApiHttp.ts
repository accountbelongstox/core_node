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
  WfNewContentGroup, WfNewHomeContent, WfNewStatistics,
  WfNewBookChapters, WfNewBookChapter, WfNewBookVersesPage, WfNewBookVerse,
} from './WfNewApiTypes';
import { wfNewEndpoints } from './WfNewEndpoints';
import { WfNewApiPaths } from './WfNewApiPaths';
import { WFNEW_BUILTIN_LANGUAGES, WFNEW_BUILTIN_PRESET_AVATARS } from './WfNewApiDefaults';
import {
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
} from '../WfNewMockDb';

// --- auth token ------------------------------------------------------------ #

/** localStorage key for the persisted Sanctum Bearer token. */
const AUTH_TOKEN_KEY = 'wfnew_auth_token';

function loadToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

let authToken: string | null = loadToken();

function setToken(token: string | null): void {
  authToken = token;
  // A fresh, real token re-arms the one-shot expiry notifier for the new session.
  if (token) expiredNotified = false;
  try {
    if (typeof localStorage === 'undefined') return;
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* best-effort persistence */
  }
}

/** Backend success/error bodies can carry repeated UTF-8 BOMs — strip them all. */
function stripBom(text: string): string {
  return text.replace(/^(﻿|ï»¿)+/, '');
}

/** Merge the Bearer header in when a session token is present. CustomAuthenticate
 *  and auth:sanctum both read this Bearer token, so it covers every authed route. */
function authHeaders(base: Record<string, string>): Record<string, string> {
  if (authToken) return { ...base, Authorization: `Bearer ${authToken}` };
  return base;
}

// --- auth-expiry self-heal -------------------------------------------------- #
// A 401 from any authed call means the session is dead (expired / missing token).
// We drop the local token and notify subscribers (WfNewApp) so the UI can flip to
// logged-out and route to the login screen — one handler fixes EVERY endpoint.

const authExpiredSubs = new Set<() => void>();

/**
 * One-shot guard so a burst of concurrent 401s (a page fires profile + friends +
 * leaderboard + activities at once) produces a SINGLE "session expired" + logout,
 * not one per request. Re-armed by setToken() on the next successful login.
 */
let expiredNotified = false;

function notifyAuthExpired(): void {
  for (const cb of authExpiredSubs) {
    try { cb(); } catch { /* ignore subscriber errors */ }
  }
}

/** If a response is a 401, clear the token and notify ONCE. Returns the status' 401-ness.
 *  Only a token that JUST expired flips the UI to logged-out + toast — a 401 with NO
 *  token present must never trigger a spurious "session expired" (there was no session). */
function handleMaybe401(status: number): boolean {
  if (status !== 401) return false;
  const hadToken = !!authToken;
  if (hadToken) setToken(null);
  if (hadToken && !expiredNotified) {
    expiredNotified = true;
    notifyAuthExpired();
  }
  return true;
}

/**
 * Unwrap the AppQyV1 `{ success, message, data }` envelope to its `data` payload
 * (the data mappers read groups/words/user off `data`). Raw (non-enveloped)
 * bodies pass through untouched.
 */
function unwrapEnvelope(body: any): any {
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return body.data;
  }
  return body;
}

/** Resolve a backend-relative media/cover path to an absolute URL on the current endpoint. */
function absUrl(u?: string): string | undefined {
  if (!u || typeof u !== 'string') return undefined;
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  return wfNewEndpoints.buildUrl(u.startsWith('/') ? u : `/${u}`);
}

/** Map a backend bookDetail sentence row to a normalized WfNewBookVerse. */
function toBookVerse(s: any): WfNewBookVerse {
  const languages: Record<string, { text: string | null; audio: string | null }> = {};
  if (s && s.languages && typeof s.languages === 'object') {
    for (const [lang, v] of Object.entries<any>(s.languages)) {
      languages[lang] = { text: v?.text ?? null, audio: absUrl(v?.audio) ?? null };
    }
  }
  return {
    grain: String(s?.grain ?? 'sentence'),
    seq: Number(s?.seq ?? 0),
    chapterIndex: s?.chapter_index !== undefined && s?.chapter_index !== null ? Number(s.chapter_index) : undefined,
    text: s?.text ?? null,
    language: s?.language ?? null,
    audio: absUrl(s?.audio) ?? null,
    languages: Object.keys(languages).length ? languages : undefined,
  };
}

// --- transport ------------------------------------------------------------- #

/** GET <currentEndpoint>/path as JSON (envelope-unwrapped). Waits for detection. */
async function getJSON<T>(path: string): Promise<T> {
  await wfNewEndpoints.whenReady();
  const res = await fetch(wfNewEndpoints.buildUrl(path), {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) {
    handleMaybe401(res.status);
    throw new Error(`HTTP ${res.status} for ${path}`);
  }
  return unwrapEnvelope(await res.json()) as T;
}

/**
 * GET an AUTH-REQUIRED endpoint. With NO session token it short-circuits to
 * `fallback` WITHOUT issuing the request — so no auth-only call ever fires (and
 * 401s) before login. This is THE single gate every authed reader goes through;
 * public endpoints keep calling getJSON directly. Centralizing it here keeps the
 * "never hit protected APIs while logged out" rule in exactly one place.
 */
async function authedGetJSON<T>(path: string, fallback: T): Promise<T> {
  if (!authToken) return fallback;
  return getJSON<T>(path);
}

/**
 * POST <currentEndpoint>/path with a JSON body. BOM-tolerant parse; on a non-2xx
 * it throws an Error carrying the backend's `message` (Laravel validation / auth
 * errors) plus `.status`, so callers can branch on it.
 */
async function postJSON<T>(path: string, body: Record<string, any>): Promise<T> {
  await wfNewEndpoints.whenReady();
  const res = await fetch(wfNewEndpoints.buildUrl(path), {
    method: 'POST',
    headers: authHeaders({ Accept: 'application/json', 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  const rawText = stripBom(await res.text());
  let parsed: any = null;
  if (rawText) {
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = null;
    }
  }
  if (!res.ok) {
    handleMaybe401(res.status);
    let message = `HTTP ${res.status} for ${path}`;
    if (parsed && typeof parsed.message === 'string' && parsed.message) message = parsed.message;
    else if (parsed && typeof parsed.error === 'string' && parsed.error) message = parsed.error;
    const err = new Error(message) as Error & { status: number; body: any };
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed as T;
}

/**
 * Normalize the AppQyV1 login/register envelope into a WfNewAuthResult. The
 * backend wraps the payload as { success, message, data: { user, login_token,
 * ... } } (with a legacy top-level `token`); tolerate both unwrapped and raw
 * shapes and read the Bearer token from login_token first.
 */
function toAuthResult(res: any): WfNewAuthResult {
  const data = res && res.data ? res.data : res;
  const token: string =
    (data && data.login_token) ||
    (res && res.token) ||
    (data && data.token) ||
    (data && data.user_token) ||
    '';
  const rawUser = data ? data.user : undefined;
  const user: WfNewAuthUser = rawUser && typeof rawUser === 'object' ? rawUser : {};
  return { token, user };
}

// --- mappers --------------------------------------------------------------- #

/** Normalize a backend word record into the shared Word shape. */
function toWord(raw: any, i = 0): Word {
  return {
    id: String(raw?.id ?? raw?.word_id ?? raw?.word ?? `w-${i}`),
    text: raw?.text ?? raw?.word ?? '',
    phonetic: raw?.phonetic ?? raw?.phonetics ?? '',
    translation: raw?.translation ?? raw?.meaning ?? raw?.definition_zh ?? '',
    definition: raw?.definition ?? undefined,
    example: raw?.example ?? raw?.example_sentence ?? undefined,
    exampleTranslation: raw?.exampleTranslation ?? raw?.example_translation ?? undefined,
    masteryLevel: typeof raw?.masteryLevel === 'number' ? raw.masteryLevel
      : typeof raw?.mastery_level === 'number' ? raw.mastery_level : undefined,
    wordType: raw?.wordType ?? raw?.word_type ?? raw?.pos ?? undefined,
    tags: Array.isArray(raw?.tags) ? raw.tags : undefined,
    audioUrl: raw?.audioUrl ?? raw?.audio_url ?? undefined,
  };
}

/** Normalize a backend group record into the shared WordGroup shape. */
function toGroup(raw: any, i = 0): WordGroup {
  return {
    id: String(raw?.id ?? raw?.gid ?? `g-${i}`),
    name: raw?.name ?? raw?.gname ?? 'Untitled',
    count: Number(raw?.count ?? raw?.total_words ?? 0) || 0,
    progress: Number(raw?.progress ?? 0) || 0,
    type: raw?.type ?? undefined,
    language: raw?.language ?? 'en',
    description: raw?.description ?? undefined,
  };
}

/** Decorative carousel applied to live groups so the bento grid still varies. */
const BENTO_DECOR: Array<Pick<BentoGroup,
  'gridSpan' | 'bgGradient' | 'bgGradientDark' | 'decorColor' | 'decorativeSvg'>> = [
  { gridSpan: 'md:col-span-2 md:row-span-2 h-[340px]', bgGradient: 'from-purple-100/70 via-indigo-50/50 to-indigo-100/70', bgGradientDark: 'from-violet-950/20 via-slate-900/40 to-indigo-950/20', decorColor: 'text-indigo-400 dark:text-purple-400', decorativeSvg: 'nebula' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-emerald-50/70 to-teal-100/70', bgGradientDark: 'from-emerald-950/15 to-slate-900/40', decorColor: 'text-teal-400 dark:text-emerald-400', decorativeSvg: 'matrix' },
  { gridSpan: 'md:col-span-1 md:row-span-2 h-[345px]', bgGradient: 'from-rose-100/70 via-pink-50/50 to-orange-100/70', bgGradientDark: 'from-rose-950/15 via-slate-900/40 to-amber-950/15', decorColor: 'text-rose-400 dark:text-orange-400', decorativeSvg: 'stars' },
  { gridSpan: 'md:col-span-2 md:row-span-1 h-[160px]', bgGradient: 'from-blue-50/70 to-indigo-100/70', bgGradientDark: 'from-blue-950/15 to-slate-900/40', decorColor: 'text-blue-400 dark:text-sky-400', decorativeSvg: 'waves' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-amber-50/70 to-orange-100/70', bgGradientDark: 'from-orange-950/15 to-slate-900/40', decorColor: 'text-yellow-500 dark:text-amber-400', decorativeSvg: 'rings' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-violet-50/70 to-fuchsia-100/70', bgGradientDark: 'from-fuchsia-950/15 to-slate-900/40', decorColor: 'text-fuchsia-400', decorativeSvg: 'bars' },
];

function decorate(g: WordGroup, i: number): BentoGroup {
  const d = BENTO_DECOR[i % BENTO_DECOR.length];
  return { ...g, badge: g.type ? `★ ${g.type}` : '★ Pack', statsLabel: 'Synaptic Link Active', ...d };
}

/** Unwrap the various list shapes the backend returns. */
function asArray(res: any, ...keys: string[]): any[] {
  if (Array.isArray(res)) return res;
  for (const k of keys) if (Array.isArray(res?.[k])) return res[k];
  return [];
}

let contentFallbackLogged = false;
function logContentFallback(): void {
  if (!contentFallbackLogged) {
    contentFallbackLogged = true;
    console.info('[WfNewApiHttp] search / subtitles / bilingual / analytics have no backend endpoint yet — using local content.');
  }
}

// --- home content-group mappers -------------------------------------------- #
// Normalize the THREE distinct backend list shapes (word groups / media sources /
// vocabulary libraries) into the single WfNewContentGroup the home widget renders.

/** Resolve a possibly-relative backend cover path to an absolute URL (host = current endpoint). */
function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  if (/^(https?:|data:)/i.test(url)) return url;          // already absolute
  const base = wfNewEndpoints.getCurrentBaseUrl();          // e.g. http://host:9000
  if (!base) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** query_all_groups row → WfNewContentGroup (kind 'word'; carries the group cover when present). */
function wordRowToContentGroup(raw: any, i = 0): WfNewContentGroup {
  return {
    id: String(raw?.gid ?? raw?.id ?? `word-${i}`),
    kind: 'word',
    title: raw?.gname ?? raw?.name ?? 'Untitled',
    count: Number(raw?.total_words ?? raw?.count ?? 0) || 0,
    countUnit: 'words',
    language: raw?.language ?? 'en',
    imageUrl: toAbsoluteUrl(raw?.cover_url ?? raw?.thumbnail_url),
    category: raw?.cover_category ?? raw?.type ?? undefined,
    description: raw?.description ?? undefined,
  };
}

/** /media/{books|subtitles} row → WfNewContentGroup. `count` follows the kind. */
function mediaRowToContentGroup(raw: any, kind: 'book' | 'subtitle', i = 0): WfNewContentGroup {
  const count = kind === 'subtitle'
    ? Number(raw?.subtitle_count ?? raw?.sentence_count ?? 0) || 0
    : Number(raw?.sentence_count ?? 0) || 0;
  return {
    id: String(raw?.id ?? raw?.source_key ?? `${kind}-${i}`),
    kind,
    title: raw?.title ?? raw?.original_name ?? raw?.ascii_name ?? 'Untitled',
    count,
    countUnit: kind === 'subtitle' ? 'subtitles' : 'sentences',
    language: raw?.language ?? undefined,
    imageUrl: toAbsoluteUrl(raw?.image_url),
    sourceKey: raw?.source_key ? String(raw.source_key) : undefined,
    description: undefined,
  };
}

/** /vocabulary/libraries row → WfNewContentGroup (kind 'library' — a public word library). */
function libraryRowToContentGroup(raw: any, i = 0): WfNewContentGroup {
  return {
    id: String(raw?.id ?? `lib-${i}`),
    kind: 'library',
    title: raw?.name ?? 'Untitled',
    count: Number(raw?.word_count ?? 0) || 0,
    countUnit: 'words',
    language: raw?.language ?? undefined,
    imageUrl: toAbsoluteUrl(raw?.image_url),
    category: raw?.category ?? raw?.difficulty ?? undefined,
    description: raw?.description ?? undefined,
  };
}

/** /media/documents row → WfNewContentGroup (kind 'document' — the user's own upload). */
function documentRowToContentGroup(raw: any, i = 0): WfNewContentGroup {
  return {
    id: String(raw?.id ?? `doc-${i}`),
    kind: 'document',
    title: raw?.title ?? raw?.original_name ?? 'Untitled',
    count: Number(raw?.word_count ?? 0) || 0,
    countUnit: 'words',
    language: raw?.language ?? undefined,
    category: undefined,
    description: undefined,
  };
}

// --- implementation -------------------------------------------------------- #

async function fetchGroups(): Promise<WordGroup[]> {
  // Auth-required (user's word groups) — no token -> [] without a request.
  const res = await authedGetJSON<any>(WfNewApiPaths.queryAllGroups, null);
  return asArray(res, 'groups').map(toGroup);
}

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
    await wfNewEndpoints.whenReady();
    const form = new FormData();
    form.append('avatar', file);
    // No explicit Content-Type — the browser sets the multipart boundary itself.
    const res = await fetch(wfNewEndpoints.buildUrl(WfNewApiPaths.userAvatar), {
      method: 'POST',
      headers: authHeaders({ Accept: 'application/json' }),
      body: form,
    });
    const rawText = stripBom(await res.text());
    let body: any = null;
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }
    }
    if (!res.ok) {
      handleMaybe401(res.status);
      throw new Error(body?.message || `HTTP ${res.status} for avatar upload`);
    }
    const data = unwrapEnvelope(body) || {};
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

  // ---- Social (all auth-required) ----
  async getFriends(): Promise<WfNewFriend[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialFriends, null);
    return Array.isArray(res?.friends) ? res.friends : Array.isArray(res) ? res : [];
  },

  async searchUsers(query: string): Promise<WfNewUserSearchResult[]> {
    if (!query.trim()) return [];
    const res = await authedGetJSON<any>(WfNewApiPaths.socialSearch(query.trim()), null);
    return Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
  },

  async followUser(userId: number): Promise<void> {
    await postJSON(WfNewApiPaths.socialFollow, { user_id: userId });
  },

  async unfollowUser(userId: number): Promise<void> {
    await postJSON(WfNewApiPaths.socialUnfollow, { user_id: userId });
  },

  async getLeaderboard(period: 'week' | 'all' = 'all'): Promise<WfNewLeaderboardEntry[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialLeaderboard(period), null);
    return Array.isArray(res?.leaderboard) ? res.leaderboard : Array.isArray(res) ? res : [];
  },

  async getActivities(): Promise<WfNewActivity[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialActivities, null);
    return Array.isArray(res?.activities) ? res.activities : Array.isArray(res) ? res : [];
  },

  async getBentoGroups(): Promise<BentoGroup[]> {
    const groups = await fetchGroups();
    return groups.map((g, i) => decorate(g, i));
  },

  getWordGroups(): Promise<WordGroup[]> {
    return fetchGroups();
  },

  async getVocabulary(groupId: string): Promise<Word[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.queryGroupWords(groupId), null);
    return asArray(res, 'gwords', 'words').map(toWord);
  },

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.userProfile, null);
      const p = res?.user ?? res;
      if (!p || typeof p !== 'object') return null;
      return {
        nickname: p.nickname ?? p.name,
        name: p.name,
        email: p.email,
        avatar: p.avatar ?? p.avatar_url,
        learned_words: p.learned_words ?? p.totalLearned,
        totalLearned: p.totalLearned ?? p.learned_words,
        streak: p.streak,
        dailyProgress: p.dailyProgress,
        dailyGoal: p.dailyGoal,
      };
    } catch {
      return null;
    }
  },

  async getUserStats(): Promise<UserStats> {
    const p = await this.getUserProfile();
    return {
      learned: p?.learned_words ?? p?.totalLearned ?? 0,
      streak: p?.streak ?? 0,
      dailyGoal: p?.dailyGoal ?? 20,
      dailyProgress: p?.dailyProgress ?? 0,
    };
  },

  async getUserStatistics(): Promise<WfNewStatistics | null> {
    try {
      // Auth-only — authedGetJSON returns null (no request) when logged out, so the
      // dashboard never 401s just to render; null/empty -> no stats.
      const s = await authedGetJSON<any>(WfNewApiPaths.userStatistics, null);
      if (!s) return null;
      const weekly = Array.isArray(s?.weekly_progress) ? s.weekly_progress.map((n: any) => Number(n) || 0) : [];
      return {
        totalWordsLearned: Number(s?.total_words_learned ?? s?.learned_count ?? 0) || 0,
        totalWords: Number(s?.total_words ?? 0) || 0,
        newWords: Number(s?.new_words ?? 0) || 0,
        learningWords: Number(s?.learning_words ?? s?.studying_count ?? 0) || 0,
        masteredWords: Number(s?.mastered_words ?? 0) || 0,
        weakWords: Number(s?.weak_words ?? 0) || 0,
        needsReview: Number(s?.needs_review ?? s?.review_count ?? s?.review_due ?? 0) || 0,
        currentStreak: Number(s?.current_streak ?? 0) || 0,
        longestStreak: Number(s?.longest_streak ?? 0) || 0,
        averageAccuracy: Number(s?.average_accuracy ?? 0) || 0,
        dailyAverage: Number(s?.daily_average ?? 0) || 0,
        studyDays: Number(s?.study_days ?? 0) || 0,
        weeklyProgress: weekly,
        todayProgress: Number(s?.today_progress ?? 0) || 0,
        dailyGoal: Number(s?.daily_goal ?? 20) || 20,
        completionRate: Number(s?.completion_rate ?? s?.daily_goal_progress ?? s?.completionRate ?? 0) || 0,
      };
    } catch {
      return null;
    }
  },

  async searchDictionary(text: string): Promise<Word[]> {
    // No stable public dictionary-search endpoint yet — the caller fuzzy-filters
    // its loaded word pool when this returns empty.
    if (!text.trim()) return [];
    logContentFallback();
    return [];
  },

  async getWalkmanWords(): Promise<Word[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.dailyWords(40), null);
    return asArray(res, 'words').map(toWord);
  },

  async getSubtitleCourses(): Promise<SubtitleCourse[]> {
    logContentFallback();
    return [...MOCK_SUBTITLE_COURSES];
  },

  async getAnalytics(): Promise<AnalyticsStats> {
    logContentFallback();
    return { ...MOCK_ANALYTICS_STATS };
  },

  async getBilingualSentences(): Promise<BilingualSentence[]> {
    logContentFallback();
    return [...MOCK_BILINGUAL_SENTENCES];
  },

  // ---- Home content groups (words / books / subtitles / documents) ----

  async getWordContentGroups(): Promise<WfNewContentGroup[]> {
    // Auth-required — no token -> [] without a request (home browse works logged out).
    const res = await authedGetJSON<any>(WfNewApiPaths.queryAllGroups, null);
    return asArray(res, 'groups').map(wordRowToContentGroup);
  },

  async getBookGroups(): Promise<WfNewContentGroup[]> {
    const res = await getJSON<any>(WfNewApiPaths.mediaBooks());
    return asArray(res, 'items').map((r, i) => mediaRowToContentGroup(r, 'book', i));
  },

  async getSubtitleGroups(): Promise<WfNewContentGroup[]> {
    const res = await getJSON<any>(WfNewApiPaths.mediaSubtitles());
    return asArray(res, 'items').map((r, i) => mediaRowToContentGroup(r, 'subtitle', i));
  },

  async getLibraryGroups(): Promise<WfNewContentGroup[]> {
    // Public word-library list (e.g. "English Coca 60000") — word collections, not docs.
    const res = await getJSON<any>(WfNewApiPaths.vocabularyLibraries());
    return asArray(res, 'libraries').map(libraryRowToContentGroup);
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
    return {
      items,
      total: Number(page?.total ?? items.length),
      perPage: Number(page?.per_page ?? items.length),
      currentPage: Number(page?.current_page ?? 1),
      lastPage: Number(page?.last_page ?? 1),
    };
  },
};
