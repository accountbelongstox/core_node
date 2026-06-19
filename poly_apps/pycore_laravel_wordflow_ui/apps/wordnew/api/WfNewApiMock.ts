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
  WfNewAuthResult, WfNewAuthUser, WfNewRegisterPayload, WfNewPreferences,
  WfNewLanguage, WfNewLanguageSelection, WfNewAvatarResult,
  WfNewFriend, WfNewUserSearchResult, WfNewLeaderboardEntry, WfNewActivity,
  WfNewContentGroup, WfNewHomeContent, WfNewStatistics,
  WfNewBookChapters, WfNewBookChapter, WfNewBookVersesPage, WfNewBookVerse,
} from './WfNewApiTypes';
import { WFNEW_BUILTIN_LANGUAGES, WFNEW_BUILTIN_PRESET_AVATARS } from './WfNewApiDefaults';
import {
  MOCK_BENTO_GROUPS, MOCK_VOCABULARY_MAP, MOCK_WALKMAN_WORDS,
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
  MOCK_BOOK_GROUPS, MOCK_SUBTITLE_GROUPS, MOCK_LIBRARY_GROUPS, MOCK_DOCUMENT_GROUPS,
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

// --- mock preferences store ------------------------------------------------- #
// localStorage-backed roaming preferences, defaults aligned with the backend's
// AppQyV1ProfileController::getPreferences (theme/language/daily_goal/app_settings).

const MOCK_PREFS_KEY = 'wfnew_prefs_mock';

const DEFAULT_PREFS: WfNewPreferences = {
  theme: 'dark',
  language: 'en',
  daily_goal: 20,
  app_settings: null,
  favorites: [],
  recentTools: [],
};

function readMockPreferences(): WfNewPreferences {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_PREFS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return { ...DEFAULT_PREFS, ...parsed };
    }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_PREFS };
}

function writeMockPreferences(prefs: WfNewPreferences): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort */
  }
}

// --- mock learning-language selection --------------------------------------- #

const MOCK_LANGS_KEY = 'wfnew_langs_mock';

function readMockLanguages(): WfNewLanguageSelection {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_LANGS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.learning_languages)) {
        return {
          native_language: typeof parsed.native_language === 'string' ? parsed.native_language : 'zh',
          learning_languages: parsed.learning_languages.length ? parsed.learning_languages : ['en'],
        };
      }
    }
  } catch {
    /* fall through to defaults */
  }
  return { native_language: 'zh', learning_languages: ['en'] };
}

function writeMockLanguages(selection: WfNewLanguageSelection): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_LANGS_KEY, JSON.stringify(selection));
  } catch {
    /* best-effort */
  }
}

// --- mock social datasets --------------------------------------------------- #

const MOCK_FRIENDS_KEY = 'wfnew_friends_mock';

/** A pool of users that search/follow draw from (backend search-result shape). */
const MOCK_SOCIAL_DIRECTORY: WfNewUserSearchResult[] = [
  { id: 101, username: 'nova_lex', name: 'Nova Lex', avatar_url: '🦊', status: 'studying', is_following: false },
  { id: 102, username: 'quill', name: 'Quill Ortega', avatar_url: '🦉', status: 'online', is_following: false },
  { id: 103, username: 'sora', name: 'Sora Kim', avatar_url: '🐼', status: 'offline', is_following: false },
  { id: 104, username: 'mara', name: 'Mara Vance', avatar_url: '🐯', status: 'online', is_following: false },
  { id: 105, username: 'iggy', name: 'Iggy Stone', avatar_url: '👾', status: 'studying', is_following: false },
];

const SEED_FRIENDS: WfNewFriend[] = [
  { id: 101, username: 'nova_lex', name: 'Nova Lex', avatar_url: '🦊', status: 'studying', followed_at: null, stats: { learned: 820, mastered: 410, streak: 12 } },
  { id: 103, username: 'sora', name: 'Sora Kim', avatar_url: '🐼', status: 'offline', followed_at: null, stats: { learned: 540, mastered: 230, streak: 4 } },
];

const MOCK_LEADERBOARD: WfNewLeaderboardEntry[] = [
  { user_id: 101, username: 'nova_lex', name: 'Nova Lex', avatar_url: '🦊', xp: 12480, rank: 1, is_current_user: false, learned: 820, mastered: 410 },
  { user_id: 1, username: 'demo', name: 'Demo Cadet', avatar_url: '🦁', xp: 9650, rank: 2, is_current_user: true, learned: 640, mastered: 320 },
  { user_id: 104, username: 'mara', name: 'Mara Vance', avatar_url: '🐯', xp: 8120, rank: 3, is_current_user: false, learned: 510, mastered: 260 },
  { user_id: 103, username: 'sora', name: 'Sora Kim', avatar_url: '🐼', xp: 6300, rank: 4, is_current_user: false, learned: 540, mastered: 230 },
];

const MOCK_ACTIVITIES: WfNewActivity[] = [
  { id: 'progress_101_a', user_id: 101, user_name: 'Nova Lex', avatar_url: '🦊', action: 'mastered 12 words', learned_count: 30, mastered_count: 12, time: '2026-06-19T08:20:00Z' },
  { id: 'progress_103_b', user_id: 103, user_name: 'Sora Kim', avatar_url: '🐼', action: 'learned 18 words', learned_count: 18, mastered_count: 0, time: '2026-06-19T06:05:00Z' },
];

function readMockFriends(): WfNewFriend[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(MOCK_FRIENDS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as WfNewFriend[];
    }
  } catch {
    /* fall through to seed */
  }
  writeMockFriends(SEED_FRIENDS);
  return SEED_FRIENDS.map((f) => ({ ...f }));
}

function writeMockFriends(friends: WfNewFriend[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_FRIENDS_KEY, JSON.stringify(friends));
  } catch {
    /* best-effort */
  }
}

/** Read a File into a base64 data URL (mock avatar upload). */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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
  // ---- Session ----
  // Offline mock is always "authenticated" (no real token needed); nothing ever
  // expires, so the auth-expired subscription is a no-op.
  isAuthenticated: () => true,
  onAuthExpired: () => () => {},

  // ---- Auth ----
  async login(identifier: string, password: string): Promise<WfNewAuthResult> {
    await delay(null, 220);
    const id = identifier.trim().toLowerCase();
    if (!id || !password) throw mockAuthError('Username and password are required', 422);
    const users = readAuthUsers();
    const match = users.find(
      (u) => (u.username || '').toLowerCase() === id || (u.email || '').toLowerCase() === id
    );
    // Granular errors aligned with the backend login controller's messages.
    if (!match) throw mockAuthError('Account does not exist', 422);
    if (match.password !== password) throw mockAuthError('Incorrect password', 422);
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
      // Avatar is auto-generated — the backend creates an image server-side and
      // the wordnew UI derives a deterministic emoji from the username, so no
      // avatar is stored or chosen at registration.
      avatar: '',
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

  async getPreferences(): Promise<WfNewPreferences> {
    return delay(readMockPreferences());
  },

  async updatePreferences(patch: WfNewPreferences): Promise<WfNewPreferences> {
    const merged = { ...readMockPreferences(), ...patch };
    writeMockPreferences(merged);
    return delay(merged);
  },

  async getSupportedLanguages(): Promise<WfNewLanguage[]> {
    return delay([...WFNEW_BUILTIN_LANGUAGES]);
  },

  async getLearningLanguages(): Promise<WfNewLanguageSelection> {
    return delay(readMockLanguages());
  },

  async setLearningLanguages(selection: WfNewLanguageSelection): Promise<WfNewLanguageSelection> {
    const next: WfNewLanguageSelection = {
      native_language: selection.native_language || 'zh',
      learning_languages: selection.learning_languages.length ? selection.learning_languages : ['en'],
    };
    writeMockLanguages(next);
    return delay(next);
  },

  async uploadAvatar(file: File): Promise<WfNewAvatarResult> {
    // Offline: read the file into a data URL and use it as both path + URL.
    const dataUrl = await fileToDataUrl(file);
    return { avatar: dataUrl, avatar_url: dataUrl };
  },

  async getPresetAvatars(): Promise<string[]> {
    return delay([...WFNEW_BUILTIN_PRESET_AVATARS]);
  },

  // ---- Social (backend-aligned mock datasets; follow/unfollow mutate them) ----
  async getFriends(): Promise<WfNewFriend[]> {
    return delay(readMockFriends());
  },

  async searchUsers(query: string): Promise<WfNewUserSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q) return delay<WfNewUserSearchResult[]>([]);
    const followedIds = new Set(readMockFriends().map((f) => f.id));
    return delay(
      MOCK_SOCIAL_DIRECTORY
        .filter((u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
        .map((u) => ({ ...u, is_following: followedIds.has(u.id) }))
    );
  },

  async followUser(userId: number): Promise<void> {
    const friends = readMockFriends();
    if (!friends.some((f) => f.id === userId)) {
      const dir = MOCK_SOCIAL_DIRECTORY.find((u) => u.id === userId);
      if (dir) {
        friends.push({
          id: dir.id, username: dir.username, name: dir.name, avatar_url: dir.avatar_url,
          status: dir.status, followed_at: null, stats: { learned: 0, mastered: 0, streak: 0 },
        });
        writeMockFriends(friends);
      }
    }
    await delay(null, 120);
  },

  async unfollowUser(userId: number): Promise<void> {
    writeMockFriends(readMockFriends().filter((f) => f.id !== userId));
    await delay(null, 120);
  },

  async getLeaderboard(_period: 'week' | 'all' = 'all'): Promise<WfNewLeaderboardEntry[]> {
    return delay(MOCK_LEADERBOARD.map((e) => ({ ...e })));
  },

  async getActivities(): Promise<WfNewActivity[]> {
    return delay(MOCK_ACTIVITIES.map((a) => ({ ...a })));
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

  getUserStatistics: (): Promise<WfNewStatistics | null> =>
    delay({
      totalWordsLearned: 432, totalWords: 540, newWords: 108, learningWords: 96,
      masteredWords: 336, weakWords: 24, needsReview: 50, currentStreak: 8,
      longestStreak: 14, averageAccuracy: 87, dailyAverage: 18, studyDays: 23,
      weeklyProgress: [12, 20, 8, 24, 16, 22, 12], todayProgress: 12, dailyGoal: 20,
      completionRate: 62,
    }),

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

  // ---- Home content groups (words derived from bento; rest curated) ----
  getWordContentGroups: (): Promise<WfNewContentGroup[]> =>
    delay(
      MOCK_BENTO_GROUPS.map<WfNewContentGroup>((g) => ({
        id: g.id, kind: 'word', title: g.name, count: g.count, countUnit: 'words',
        language: g.language, category: g.type, description: g.description,
      })),
    ),

  getBookGroups: (): Promise<WfNewContentGroup[]> => delay(MOCK_BOOK_GROUPS.map((g) => ({ ...g }))),

  getSubtitleGroups: (): Promise<WfNewContentGroup[]> => delay(MOCK_SUBTITLE_GROUPS.map((g) => ({ ...g }))),

  getLibraryGroups: (): Promise<WfNewContentGroup[]> => delay(MOCK_LIBRARY_GROUPS.map((g) => ({ ...g }))),

  getDocumentGroups: (): Promise<WfNewContentGroup[]> => delay(MOCK_DOCUMENT_GROUPS.map((g) => ({ ...g }))),

  async getHomeContent(): Promise<WfNewHomeContent> {
    const [words, books, subtitles, libraries, documents] = await Promise.all([
      this.getWordContentGroups(), this.getBookGroups(), this.getSubtitleGroups(),
      this.getLibraryGroups(), this.getDocumentGroups(),
    ]);
    return { words, books, subtitles, libraries, documents };
  },

  // ---- Book reading (book -> chapter -> verses) ----
  // Offline placeholders: 3 chapters x 4 verses; zh text is an ASCII placeholder
  // (the real bilingual content comes from the backend). Keeps mock ⇄ real in sync.
  async getBookChapters(sourceKey: string): Promise<WfNewBookChapters> {
    const chapters: WfNewBookChapter[] = Array.from({ length: 3 }, (_, i) => ({
      chapterIndex: i,
      sentenceCount: 4,
      titles: { en: `Chapter ${i + 1}`, zh: null },
    }));
    return delay({ sourceKey, languages: ['en', 'zh'], chapterCount: chapters.length, chapters });
  },

  async getBookVerses(
    sourceKey: string,
    opts: { chapterIndex?: number; page?: number; perPage?: number; grain?: string } = {},
  ): Promise<WfNewBookVersesPage> {
    const ci = opts.chapterIndex ?? 0;
    const items: WfNewBookVerse[] = Array.from({ length: 4 }, (_, i) => {
      const en = `Chapter ${ci + 1}, verse ${i + 1} — sample English text.`;
      const zh = `[zh] chapter ${ci + 1} verse ${i + 1} translation placeholder`;
      return {
        grain: 'sentence',
        seq: ci * 4 + i,
        chapterIndex: ci,
        text: en,
        language: 'en',
        audio: null,
        languages: { en: { text: en, audio: null }, zh: { text: zh, audio: null } },
      };
    });
    return delay({ items, total: items.length, perPage: items.length, currentPage: 1, lastPage: 1 });
  },
};
