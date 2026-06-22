/**
 * wordflowAuthMock — offline MOCK backend for the wordflow AUTH surface.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SWITCH MOCK ⇄ REAL HERE — flip the single WF_AUTH_USE_MOCK constant.     │
 * │                                                                           │
 * │  • false (default): auth hits the real Laravel API (:9000).               │
 * │  • true:  /login, /register, /user/profile, /forgot-password and          │
 * │    /reset-password are served entirely from this file — NO network. Lets  │
 * │    another AI build/iterate the auth UI with zero backend running.        │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * WHY this shape: WordflowApiService.request() is the ONE choke point every
 * auth call flows through (login()/register()/getUserProfile() all call it, and
 * the forgot/reset pages call request() directly). So the switch only needs to
 * intercept request() once — see WordflowApi.ts. handle() returns the SAME
 * already-unwrapped `data` object the real request() yields after unwrapping the
 * { success, data, message } envelope, and throws an Error carrying `.status` +
 * `.body` exactly like the real path, so EVERY downstream normalizer
 * (login()'s login_token read, the WfAuthLoginPage error-code branches, …) runs
 * unchanged against mock data.
 *
 * KEEP IN SYNC WITH THE BACKEND — verified shapes this mock mirrors:
 *   /login, /register  (AppQyV1AuthenticationLoginController::login +
 *                        CommonAuthService::createLoginResponse, and the
 *                        RegistrationController) → data: {
 *                          user, login_token (Sanctum Bearer), user_token,
 *                          user_token_expires_at, token_type:'Bearer',
 *                          login_by, expiration, multi_device_enabled }
 *   /user/profile       (AppQyV1ProfileController::getProfile) → data: { user }
 *   /forgot-password, /reset-password → { success, message } (body ignored by UI)
 * The login/register user object is the User model row enriched with
 * learning_languages / native_language / learning_stats / avatar_url and the
 * flattened total_/learned_/mastered_words counters (see the controllers).
 * If you add/rename a backend auth field, update buildLoginUser/buildProfileUser
 * below so mock and real stay aligned.
 */

import type { User } from './wordflowTypes';
import {
  WF_SUPPORTED_LANGUAGES,
  filterSupportedLanguageCodes,
  WF_SUPPORTED_LANGUAGE_CODES,
} from './wordflowLanguages';

// ═══════════════════════════════════════════════════════════════════════════
//  THE SWITCH — hardcoded. Set to `true` to run the auth UI fully offline.
// ═══════════════════════════════════════════════════════════════════════════
export const WF_AUTH_USE_MOCK = false;

/** Sentinel returned by handles() callers; not exported on purpose. */
const LS_USERS_KEY = 'wf_auth_mock_users';
const LS_SESSION_KEY = 'wf_auth_mock_session';

/** Persisted mock account record (the canonical source both shapes project from). */
interface MockUserRecord {
  id: number;
  username: string;
  nickname: string | null;
  name: string | null;
  email: string;
  phone?: string | null;
  password: string;
  avatar: string;
  avatar_url: string;
  member_type: string;
  bio: string | null;
  location: string | null;
  native_language: string;
  learning_languages: string[];
  vip_points: number;
  total_words: number;
  learned_words: number;
  mastered_words: number;
  streak_days: number;
}

/** Default seeded account so the login form works out-of-the-box: demo / demo123. */
const SEED_USERS: MockUserRecord[] = [
  {
    id: 1,
    username: 'demo',
    nickname: 'Demo User',
    name: 'Demo User',
    email: 'demo@wordflow.test',
    phone: null,
    password: 'demo123',
    avatar: '',
    avatar_url: 'https://ui-avatars.com/api/?name=Demo+User&background=3b82f6&color=fff&size=200',
    member_type: 'free',
    bio: 'Offline mock account — switch WF_AUTH_USE_MOCK to false for the real API.',
    location: 'Localhost',
    native_language: 'zh',
    learning_languages: ['en'],
    vip_points: 0,
    total_words: 1280,
    learned_words: 640,
    mastered_words: 320,
    streak_days: 7,
  },
];

/** An Error shaped like the one WordflowApiService.request() throws. */
function mockApiError(message: string, status: number): Error & { status: number; body: any } {
  const err = new Error(message) as Error & { status: number; body: any };
  err.status = status;
  err.body = { success: false, message };
  return err;
}

// ---- localStorage-backed account + session store --------------------------

function readUsers(): MockUserRecord[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_USERS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed as MockUserRecord[];
    }
  } catch {
    /* corrupt / denied storage — fall through to the seed */
  }
  writeUsers(SEED_USERS);
  return SEED_USERS.map((u) => ({ ...u }));
}

function writeUsers(users: MockUserRecord[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_USERS_KEY, JSON.stringify(users));
    }
  } catch {
    /* best-effort persistence only */
  }
}

function setSession(userId: number): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LS_SESSION_KEY, String(userId));
  } catch {
    /* ignore */
  }
}

function getSessionUser(users: MockUserRecord[]): MockUserRecord | undefined {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LS_SESSION_KEY) : null;
    if (raw) {
      const id = Number(raw);
      const found = users.find((u) => u.id === id);
      if (found) return found;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

function clearSession(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(LS_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

// ---- backend-aligned shape projection -------------------------------------

/** The learning_stats object (AppQyV1UserLearningProgressModel::getUserStats). */
function buildLearningStats(rec: MockUserRecord) {
  return {
    total_words: rec.total_words,
    new_words: Math.max(0, rec.total_words - rec.learned_words),
    learning_words: Math.max(0, rec.learned_words - rec.mastered_words),
    mastered_words: rec.mastered_words,
    needs_review: Math.max(0, Math.round(rec.learned_words * 0.1)),
  };
}

/**
 * The user object the login/register controllers return: the model row plus the
 * enrichment fields. Cast to User — the real path casts the same way (the
 * backend sends snake_case fields the frontend User type also carries as
 * optionals, and the UI reads them defensively via WfUserCenter).
 */
function buildLoginUser(rec: MockUserRecord): User {
  return {
    id: String(rec.id),
    username: rec.username,
    nickname: rec.nickname ?? undefined,
    name: rec.name ?? rec.nickname ?? rec.username,
    email: rec.email,
    avatar: rec.avatar,
    avatar_url: rec.avatar_url,
    member_type: rec.member_type,
    bio: rec.bio,
    location: rec.location,
    native_language: rec.native_language,
    learning_languages: rec.learning_languages,
    learningLanguages: rec.learning_languages,
    selectedLanguage: rec.learning_languages[0] ?? 'en',
    learning_stats: buildLearningStats(rec),
    total_words: rec.total_words,
    learned_words: rec.learned_words,
    mastered_words: rec.mastered_words,
    vip_points: rec.vip_points,
    // Frontend-convenience camelCase fields (the real backend omits these; the
    // UI defaults them — included here so a mock session renders fully).
    dailyGoal: 20,
    dailyProgress: 0,
    streak: rec.streak_days,
    totalLearned: rec.learned_words,
    isPro: rec.member_type !== 'free' && rec.member_type !== '',
  } as unknown as User;
}

/** The slimmer object AppQyV1ProfileController::getProfile returns under `user`. */
function buildProfileUser(rec: MockUserRecord): User {
  return {
    id: String(rec.id),
    username: rec.username,
    nickname: rec.nickname ?? undefined,
    name: rec.name ?? undefined,
    email: rec.email,
    avatar: rec.avatar,
    avatar_url: rec.avatar_url,
    learning_languages: rec.learning_languages,
    learningLanguages: rec.learning_languages,
    native_language: rec.native_language,
    bio: rec.bio,
    location: rec.location,
    member_type: rec.member_type,
    vip_points: rec.vip_points,
    is_active: 1,
  } as unknown as User;
}

/** The shared { token, … } login envelope (already unwrapped from `data`). */
function buildAuthEnvelope(rec: MockUserRecord) {
  const token = `mock_login_token_${rec.id}_${Date.now()}`;
  return {
    user: buildLoginUser(rec),
    login_token: token,
    user_token: `mock_user_token_${rec.id}`,
    user_token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    token_type: 'Bearer',
    login_by: 'password',
    expiration: 60 * 24 * 365,
    multi_device_enabled: false,
  };
}

// ---- request body + endpoint helpers --------------------------------------

function parseBody(options: { body?: any }): Record<string, any> {
  const { body } = options;
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const out: Record<string, any> = {};
    body.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (typeof body === 'object') return body as Record<string, any>;
  return {};
}

/** Strip any query string and trailing slash so matching is path-only. */
function normalizePath(endpoint: string): string {
  const path = endpoint.split('?')[0].replace(/\/+$/, '');
  return path.startsWith('/') ? path : `/${path}`;
}

const HANDLED_PATHS = new Set([
  '/login',
  '/register',
  '/user/profile',
  '/forgot-password',
  '/reset-password',
  '/logout',
  // Needed by the register form's learning-language multi-select so it renders
  // offline. Served from the backend-aligned WF_SUPPORTED_LANGUAGES catalog.
  '/system/supported-languages',
]);

// ---- public surface -------------------------------------------------------

export const wordflowAuthMock = {
  /** True when this endpoint is served by the mock (cheap sync guard). */
  handles(endpoint: string): boolean {
    return HANDLED_PATHS.has(normalizePath(endpoint));
  },

  /**
   * Serve a mocked auth endpoint. Returns the already-unwrapped `data` object
   * (matching WordflowApiService.request()'s return), or throws a status-bearing
   * Error for failures. Async to mirror a real network call (and let callers
   * `await` uniformly).
   */
  async handle<T>(endpoint: string, options: { method?: string; body?: any } = {}): Promise<T> {
    // Tiny latency so loading spinners actually render in the offline UI.
    await new Promise((r) => setTimeout(r, 200));

    const path = normalizePath(endpoint);
    const body = parseBody(options);
    const users = readUsers();

    switch (path) {
      case '/login':
        return this.login(users, body) as T;
      case '/register':
        return this.register(users, body) as T;
      case '/user/profile':
        return this.profile(users) as T;
      case '/forgot-password':
        return this.forgotPassword(users, body) as T;
      case '/reset-password':
        return this.resetPassword(users, body) as T;
      case '/logout':
        clearSession();
        return { success: true, message: 'Logged out' } as T;
      case '/system/supported-languages':
        // Backend returns the row array directly under `data`; request() unwraps
        // the envelope, so we return the array itself (matching the real shape).
        return WF_SUPPORTED_LANGUAGES.map((l) => ({ ...l })) as T;
      default:
        throw mockApiError(`Mock auth has no handler for ${path}`, 404);
    }
  },

  /** POST /login — the controller authenticates the typed value as username OR email OR phone. */
  login(users: MockUserRecord[], body: Record<string, any>) {
    const identifier = String(body.username ?? body.email ?? '').trim();
    const password = String(body.password ?? '');
    if (!identifier || !password) {
      throw mockApiError('Username and password are required', 422);
    }
    const lower = identifier.toLowerCase();
    const match = users.find(
      (u) =>
        u.username.toLowerCase() === lower ||
        u.email.toLowerCase() === lower ||
        (u.phone && String(u.phone).toLowerCase() === lower)
    );
    // Backend returns 422 with a generic credential message on any mismatch.
    if (!match || match.password !== password) {
      throw mockApiError('The provided credentials are incorrect.', 422);
    }
    setSession(match.id);
    return buildAuthEnvelope(match);
  },

  /** POST /register — username + password required; email / invite_code optional. */
  register(users: MockUserRecord[], body: Record<string, any>) {
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const email = body.email ? String(body.email).trim() : '';
    if (!username || !password) {
      throw mockApiError('Username and password are required', 422);
    }
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      throw mockApiError('Username already exists', 400);
    }
    if (email && users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      throw mockApiError('Email already exists', 400);
    }
    // invite_code is accepted as-is in mock mode (any code is treated valid). The
    // backend's 'Invalid invite code' / 'is expired or already used' branches are
    // exercised against the real API — the UI already localizes those messages.

    // Learning languages (multi-select): keep only catalog-recognized codes,
    // default to ['en'] when none is supplied — mirrors the backend's default.
    const learningLanguages = filterSupportedLanguageCodes(body.learning_languages);
    const finalLearning = learningLanguages.length ? learningLanguages : ['en'];
    const nativeLanguage =
      typeof body.native_language === 'string' && WF_SUPPORTED_LANGUAGE_CODES.has(body.native_language)
        ? body.native_language
        : 'zh';

    const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
    const rec: MockUserRecord = {
      id: nextId,
      username,
      // Server auto-generates a Haikunator nickname; mirror with a friendly default.
      nickname: body.nickname ? String(body.nickname) : username,
      name: body.nickname ? String(body.nickname) : username,
      email: email || `${username}@wordflow.test`,
      phone: null,
      password,
      avatar: '',
      avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=6366f1&color=fff&size=200`,
      member_type: 'free',
      bio: null,
      location: null,
      native_language: nativeLanguage,
      learning_languages: finalLearning,
      vip_points: 0,
      total_words: 0,
      learned_words: 0,
      mastered_words: 0,
      streak_days: 0,
    };
    const next = [...users, rec];
    writeUsers(next);
    setSession(rec.id);
    return buildAuthEnvelope(rec);
  },

  /** GET /user/profile — returns the logged-in mock user, else 401. */
  profile(users: MockUserRecord[]) {
    const session = getSessionUser(users);
    if (!session) {
      throw mockApiError('Unauthorized', 401);
    }
    return { user: buildProfileUser(session) };
  },

  /** POST /forgot-password — always succeeds (the real flow never reveals whether the email exists). */
  forgotPassword(_users: MockUserRecord[], body: Record<string, any>) {
    const email = String(body.email ?? '').trim();
    if (!email) {
      throw mockApiError('Email is required', 422);
    }
    return { success: true, message: 'Password reset link sent (mock).' };
  },

  /** POST /reset-password — validates the basic field set, then succeeds. */
  resetPassword(users: MockUserRecord[], body: Record<string, any>) {
    const email = String(body.email ?? '').trim();
    const token = String(body.token ?? '');
    const password = String(body.password ?? '');
    if (!email || !token || !password) {
      throw mockApiError('Invalid or missing reset fields', 422);
    }
    const match = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (match) {
      match.password = password;
      writeUsers(users);
    }
    return { success: true, message: 'Password has been reset (mock).' };
  },
};
