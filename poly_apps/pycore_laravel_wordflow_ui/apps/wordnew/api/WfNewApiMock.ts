/**
 * WfNewApiMock — offline mock implementation of the WfNewApi contract.
 *
 * Serves the curated datasets from ../WfNewMockDb so the /wordnew app runs with
 * ZERO network access (e.g. inside AI Studio, or any sandbox with no backend).
 * It implements the exact same `WfNewApi` interface as WfNewApiHttp and uses the
 * exact same types from ./WfNewApiTypes — when you change one, change both.
 *
 * Selected via ./index.ts (swap the single import line there). See ./README.md.
 */
import type {
  WfNewApi, Word, WordGroup, BentoGroup, UserProfile, UserStats,
  SubtitleCourse, BilingualSentence, AnalyticsStats,
  WfNewAuthResult, WfNewAuthUser, WfNewRegisterPayload,
} from './WfNewApiTypes';
import {
  MOCK_BENTO_GROUPS, MOCK_VOCABULARY_MAP, MOCK_WALKMAN_WORDS,
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
} from '../WfNewMockDb';

/** Simulate a little network latency so loading states are exercised. */
const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// --- mock auth registry ----------------------------------------------------- #
// A self-contained, localStorage-backed account store so register → login →
// session works fully offline and BEHAVES like the backend (validates the
// password, rejects bad creds, surfaces 'Username already exists'). Aligned with
// the AppQyV1 user shape returned by /login and /register.

const MOCK_AUTH_USERS_KEY = 'wfnew_auth_mock_users';

interface MockAuthRecord extends WfNewAuthUser {
  password: string;
}

/** Default seeded account so login works out of the box: demo / demo123. */
const SEED_AUTH_USERS: MockAuthRecord[] = [
  {
    id: '1',
    username: 'demo',
    nickname: 'Demo Cadet',
    name: 'Demo Cadet',
    email: 'demo@wordflow.test',
    avatar: '',
    native_language: 'zh',
    learning_languages: ['en'],
    member_type: 'free',
    bio: 'Offline mock cadet — swap the api/index.ts import to go live.',
    password: 'demo123',
  },
];

function readAuthUsers(): MockAuthRecord[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_AUTH_USERS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed as MockAuthRecord[];
    }
  } catch {
    /* corrupt / denied — fall back to the seed */
  }
  writeAuthUsers(SEED_AUTH_USERS);
  return SEED_AUTH_USERS.map((u) => ({ ...u }));
}

function writeAuthUsers(users: MockAuthRecord[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    /* best-effort */
  }
}

/** Strip the password before handing a record back as a WfNewAuthUser. */
function publicUser(rec: MockAuthRecord): WfNewAuthUser {
  const { password: _pw, ...user } = rec;
  return user;
}

/** Error shaped like the HTTP impl's (carries .status for callers). */
function mockAuthError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

/** Generic dictionary pool used for search + unknown-group fallback. */
const DEFAULT_WORD_POOL: Word[] = [
  { id: 'all-1', text: 'Aesthetics', phonetic: '/esˈθet.ɪks/', translation: '美学，审美', definition: 'Concerned with the appreciation of beauty.', example: 'The grid displays classical aesthetics.', masteryLevel: 80, tags: ['Aesthetics'] },
  { id: 'all-2', text: 'Glow', phonetic: '/ɡləʊ/', translation: '发光', definition: 'Produce a steady radiant light without flame.', example: 'The aurora produced a glowing halo.', masteryLevel: 95, tags: ['Cosmic'] },
  { id: 'all-3', text: 'Cognition', phonetic: '/kɒɡˈnɪʃ.ən/', translation: '认知', definition: 'The mental action of acquiring knowledge.', example: 'AI models replicate parts of human cognition.', masteryLevel: 72, tags: ['Psychology'] },
  { id: 'all-4', text: 'Nebula', phonetic: '/ˈneb.jə.lə/', translation: '星云', definition: 'A vast cloud of gas in outer space.', example: 'The telescope captured a nebula.', masteryLevel: 65, tags: ['Cosmic'] },
  { id: 'all-5', text: 'Ephemeral', phonetic: '/ɪˈfem.ər.əl/', translation: '短暂的', definition: 'Lasting for a very short time.', example: 'Auroras are ephemeral spectacles.', masteryLevel: 58, tags: ['Literature'] },
  { id: 'all-6', text: 'Symmetrical', phonetic: '/sɪˈmet.rɪ.kəl/', translation: '对称的', definition: 'Made of mirror-like identical components.', example: 'Symmetrical layouts feel restful.', masteryLevel: 90, tags: ['Design'] },
];

/** Every mock vocabulary word, flattened — the search corpus. */
const ALL_MOCK_WORDS: Word[] = [
  ...DEFAULT_WORD_POOL,
  ...Object.values(MOCK_VOCABULARY_MAP).flat(),
  ...MOCK_WALKMAN_WORDS,
];

export const wfNewApiMock: WfNewApi = {
  // ---- Auth ----
  async login(identifier: string, password: string): Promise<WfNewAuthResult> {
    await delay(null, 220);
    const id = identifier.trim().toLowerCase();
    if (!id || !password) throw mockAuthError('Username and password are required', 422);
    const users = readAuthUsers();
    const match = users.find(
      (u) => (u.username || '').toLowerCase() === id || (u.email || '').toLowerCase() === id
    );
    // Mirror the backend's generic 422 on any credential mismatch.
    if (!match || match.password !== password) {
      throw mockAuthError('The provided credentials are incorrect.', 422);
    }
    return { token: `mock_token_${match.id}_${Date.now()}`, user: publicUser(match) };
  },

  async register(payload: WfNewRegisterPayload): Promise<WfNewAuthResult> {
    await delay(null, 220);
    const username = (payload.username || '').trim();
    const password = payload.password || '';
    const email = payload.email ? payload.email.trim() : '';
    if (!username || !password) throw mockAuthError('Username and password are required', 422);
    const users = readAuthUsers();
    if (users.some((u) => (u.username || '').toLowerCase() === username.toLowerCase())) {
      throw mockAuthError('Username already exists', 400);
    }
    if (email && users.some((u) => (u.email || '').toLowerCase() === email.toLowerCase())) {
      throw mockAuthError('Email already exists', 400);
    }
    const nextId = String(
      users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1
    );
    const learning = Array.isArray(payload.learning_languages) && payload.learning_languages.length
      ? payload.learning_languages
      : ['en'];
    const rec: MockAuthRecord = {
      id: nextId,
      username,
      nickname: payload.nickname || username,
      name: payload.nickname || username,
      email: email || `${username}@wordflow.test`,
      avatar: payload.avatar || '',
      native_language: payload.native_language || 'zh',
      learning_languages: learning,
      member_type: 'free',
      bio: payload.bio || '',
      password,
    };
    writeAuthUsers([...users, rec]);
    return { token: `mock_token_${rec.id}_${Date.now()}`, user: publicUser(rec) };
  },

  async logout(): Promise<void> {
    // Stateless in mock mode — the session lives in the app's settings store.
    await delay(null, 60);
  },

  getBentoGroups: () => delay([...MOCK_BENTO_GROUPS] as BentoGroup[]),

  getWordGroups: () =>
    delay(
      MOCK_BENTO_GROUPS.map<WordGroup>((g) => ({
        id: g.id, name: g.name, language: g.language,
        count: g.count, progress: g.progress, type: g.type, description: g.description,
      })),
    ),

  getVocabulary: (groupId: string) =>
    delay(MOCK_VOCABULARY_MAP[groupId] ?? DEFAULT_WORD_POOL),

  getUserProfile: (): Promise<UserProfile | null> =>
    delay({
      nickname: 'WordFlow Commander',
      learned_words: 432,
      streak: 8,
      dailyProgress: 12,
      dailyGoal: 20,
    }),

  getUserStats: (): Promise<UserStats> =>
    delay({ learned: 432, streak: 8, dailyGoal: 20, dailyProgress: 12 }),

  searchDictionary: (text: string) => {
    const q = (text || '').trim();
    if (!q) return delay<Word[]>([]);
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    return delay(ALL_MOCK_WORDS.filter((w) => re.test(w.text) || re.test(w.translation)));
  },

  getWalkmanWords: () => delay([...MOCK_WALKMAN_WORDS]),

  getSubtitleCourses: (): Promise<SubtitleCourse[]> => delay([...MOCK_SUBTITLE_COURSES]),

  getAnalytics: (): Promise<AnalyticsStats> => delay({ ...MOCK_ANALYTICS_STATS }),

  getBilingualSentences: (): Promise<BilingualSentence[]> => delay([...MOCK_BILINGUAL_SENTENCES]),
};
