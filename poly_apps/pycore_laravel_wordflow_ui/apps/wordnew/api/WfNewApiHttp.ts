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
  WfNewAuthResult, WfNewAuthUser, WfNewRegisterPayload,
} from './WfNewApiTypes';
import { wfNewEndpoints } from './WfNewEndpoints';
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

/** Merge the Bearer header in when a session token is present. */
function authHeaders(base: Record<string, string>): Record<string, string> {
  if (authToken) return { ...base, Authorization: `Bearer ${authToken}` };
  return base;
}

// --- transport ------------------------------------------------------------- #

/** GET <currentEndpoint>/path as JSON. Waits for endpoint detection first. */
async function getJSON<T>(path: string): Promise<T> {
  await wfNewEndpoints.whenReady();
  const res = await fetch(wfNewEndpoints.buildUrl(path), {
    method: 'GET',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
  return (await res.json()) as T;
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

// --- implementation -------------------------------------------------------- #

async function fetchGroups(): Promise<WordGroup[]> {
  const res = await getJSON<any>('/query_all_groups');
  return asArray(res, 'groups').map(toGroup);
}

export const wfNewApiHttp: WfNewApi = {
  // ---- Auth ----
  async login(identifier: string, password: string): Promise<WfNewAuthResult> {
    // The AppQyV1 login controller authenticates by `username`, but
    // CommonAuthService matches it against username OR email OR phone — so the
    // raw identifier the user typed is sent as `username`.
    const res = await postJSON<any>('/login', { username: identifier, password });
    const result = toAuthResult(res);
    if (result.token) setToken(result.token);
    return result;
  },

  async register(payload: WfNewRegisterPayload): Promise<WfNewAuthResult> {
    // avatar is UI-only (emoji) — the backend does not persist it, so it is not
    // sent. Everything else maps straight onto the registration controller.
    const res = await postJSON<any>('/register', {
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
      if (authToken) await postJSON('/logout', {});
    } catch {
      /* ignore — clearing the local token below is what matters */
    }
    setToken(null);
  },

  async getBentoGroups(): Promise<BentoGroup[]> {
    const groups = await fetchGroups();
    return groups.map((g, i) => decorate(g, i));
  },

  getWordGroups(): Promise<WordGroup[]> {
    return fetchGroups();
  },

  async getVocabulary(groupId: string): Promise<Word[]> {
    const res = await getJSON<any>(`/query_gwords?gid=${encodeURIComponent(groupId)}`);
    return asArray(res, 'gwords', 'words').map(toWord);
  },

  async getUserProfile(): Promise<UserProfile | null> {
    try {
      const res = await getJSON<any>('/user/profile');
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

  async searchDictionary(text: string): Promise<Word[]> {
    // No stable public dictionary-search endpoint yet — the caller fuzzy-filters
    // its loaded word pool when this returns empty.
    if (!text.trim()) return [];
    logContentFallback();
    return [];
  },

  async getWalkmanWords(): Promise<Word[]> {
    const res = await getJSON<any>('/words/daily?count=40');
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
};
