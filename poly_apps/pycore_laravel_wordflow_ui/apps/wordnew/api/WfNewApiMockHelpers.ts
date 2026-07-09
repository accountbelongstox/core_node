/** WfNewApiMockHelpers - mock data stores + read/write helpers (localStorage-backed)
 * extracted from WfNewApiMock so the mock impl stays under the 800-line modular
 * limit. The mock methods import these. */
import type {
  WfNewAuthUser, WfNewPreferences, WfNewLanguageSelection, WfNewFriend,
  WfNewLeaderboardEntry, WfNewActivity, WfNewUserSearchResult,
  WfNewConversation, WfNewMessage, WfNewFriendRequest, WfNewNotification,
} from './WfNewApiTypes';

export const delay = <T>(value: T, ms = 180): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

/**
 * Per-word call counter for the mock getWordMedia: it models the file-first
 * enqueue → ready flow. The FIRST resolve for a word returns 'pending' (just
 * enqueued); the SECOND+ poll returns 'ready' with media urls — so a polling UI
 * exercises the pending → ready swap fully offline.
 */
export const MOCK_WORD_MEDIA_CALLS = new Map<string, number>();
export const mockMd5 = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `mock_${h.toString(16).padStart(8, '0')}`;
};

// --- mock auth registry ----------------------------------------------------- #
// A self-contained, localStorage-backed account store so register → login →
// session works fully offline and BEHAVES like the backend (validates the
// password, rejects bad creds, surfaces 'Username already exists'). Aligned with
// the AppQyV1 user shape returned by /login and /register.

export const MOCK_AUTH_USERS_KEY = 'wfnew_auth_mock_users';

export interface MockAuthRecord extends WfNewAuthUser {
  password: string;
}

/** Default seeded account so login works out of the box: demo / demo123. */
export const SEED_AUTH_USERS: MockAuthRecord[] = [
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

export function readAuthUsers(): MockAuthRecord[] {
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

export function writeAuthUsers(users: MockAuthRecord[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_AUTH_USERS_KEY, JSON.stringify(users));
  } catch {
    /* best-effort */
  }
}

/** Strip the password before handing a record back as a WfNewAuthUser. */
export function publicUser(rec: MockAuthRecord): WfNewAuthUser {
  const { password: _pw, ...user } = rec;
  return user;
}

/** Error shaped like the HTTP impl's (carries .status for callers). */
export function mockAuthError(message: string, status: number): Error & { status: number } {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

// --- mock preferences store ------------------------------------------------- #
// localStorage-backed roaming preferences, defaults aligned with the backend's
// AppQyV1ProfileController::getPreferences (theme/language/daily_goal/app_settings).

export const MOCK_PREFS_KEY = 'wfnew_prefs_mock';

export const DEFAULT_PREFS: WfNewPreferences = {
  theme: 'dark',
  language: 'en',
  daily_goal: 20,
  app_settings: null,
  favorites: [],
  recentTools: [],
};

export function readMockPreferences(): WfNewPreferences {
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

export function writeMockPreferences(prefs: WfNewPreferences): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* best-effort */
  }
}

// --- mock learning-language selection --------------------------------------- #

export const MOCK_LANGS_KEY = 'wfnew_langs_mock';

export function readMockLanguages(): WfNewLanguageSelection {
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

export function writeMockLanguages(selection: WfNewLanguageSelection): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_LANGS_KEY, JSON.stringify(selection));
  } catch {
    /* best-effort */
  }
}

// --- mock social datasets --------------------------------------------------- #

export const MOCK_FRIENDS_KEY = 'wfnew_friends_mock';

/** A pool of users that search/follow draw from (backend search-result shape). */
export const MOCK_SOCIAL_DIRECTORY: WfNewUserSearchResult[] = [
  { id: 101, username: 'nova_lex', name: 'Nova Lex', avatar_url: '🦊', status: 'studying', is_following: false },
  { id: 102, username: 'quill', name: 'Quill Ortega', avatar_url: '🦉', status: 'online', is_following: false },
  { id: 103, username: 'sora', name: 'Sora Kim', avatar_url: '🐼', status: 'offline', is_following: false },
  { id: 104, username: 'mara', name: 'Mara Vance', avatar_url: '🐯', status: 'online', is_following: false },
  { id: 105, username: 'iggy', name: 'Iggy Stone', avatar_url: '👾', status: 'studying', is_following: false },
];

export const SEED_FRIENDS: WfNewFriend[] = [
  { id: 101, username: 'nova_lex', name: 'Nova Lex', avatar_url: '🦊', status: 'studying', followed_at: null, stats: { learned: 820, mastered: 410, streak: 12 } },
  { id: 103, username: 'sora', name: 'Sora Kim', avatar_url: '🐼', status: 'offline', followed_at: null, stats: { learned: 540, mastered: 230, streak: 4 } },
];

export const MOCK_LEADERBOARD: WfNewLeaderboardEntry[] = [
  { user_id: 101, username: 'nova_lex', name: 'Nova Lex', avatar_url: '🦊', xp: 12480, rank: 1, is_current_user: false, learned: 820, mastered: 410 },
  { user_id: 1, username: 'demo', name: 'Demo Cadet', avatar_url: '🦁', xp: 9650, rank: 2, is_current_user: true, learned: 640, mastered: 320 },
  { user_id: 104, username: 'mara', name: 'Mara Vance', avatar_url: '🐯', xp: 8120, rank: 3, is_current_user: false, learned: 510, mastered: 260 },
  { user_id: 103, username: 'sora', name: 'Sora Kim', avatar_url: '🐼', xp: 6300, rank: 4, is_current_user: false, learned: 540, mastered: 230 },
];

export const MOCK_ACTIVITIES: WfNewActivity[] = [
  { id: 'progress_101_a', user_id: 101, user_name: 'Nova Lex', avatar_url: '🦊', action: 'mastered 12 words', learned_count: 30, mastered_count: 12, time: '2026-06-19T08:20:00Z' },
  { id: 'progress_103_b', user_id: 103, user_name: 'Sora Kim', avatar_url: '🐼', action: 'learned 18 words', learned_count: 18, mastered_count: 0, time: '2026-06-19T06:05:00Z' },
];

export function readMockFriends(): WfNewFriend[] {
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

export function writeMockFriends(friends: WfNewFriend[]): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MOCK_FRIENDS_KEY, JSON.stringify(friends));
  } catch {
    /* best-effort */
  }
}

// --- mock social v2 (discover / requests / chat / presence / notifications) -- #
// localStorage-backed so chat/requests survive a reload offline; shapes mirror the
// backend (SOCIAL_FEATURE_SPECIFICATION.md §3) so the page works the same live.

export const MOCK_CONVOS_KEY = 'wfnew_convos_mock';
export const MOCK_MESSAGES_KEY = 'wfnew_messages_mock';
export const MOCK_REQUESTS_KEY = 'wfnew_requests_mock';
export const MOCK_NOTIFS_KEY = 'wfnew_notifs_mock';

/** The mock "current user" id (matches the seeded demo account / leaderboard). */
export const MOCK_SELF_ID = 1;

/** A richer directory for language discovery (adds languages to the search pool). */
export interface MockDirEntry extends WfNewUserSearchResult {
  nickname: string;
  native_language: string;
  learning_languages: string[];
}
export const MOCK_DISCOVER_DIRECTORY: MockDirEntry[] = [
  { id: 101, username: 'nova_lex', nickname: 'Nova Lex', name: 'Nova Lex', avatar_url: '🦊', status: 'studying', is_following: false, native_language: 'en', learning_languages: ['zh', 'ja'] },
  { id: 102, username: 'quill', nickname: 'Quill Ortega', name: 'Quill Ortega', avatar_url: '🦉', status: 'online', is_following: false, native_language: 'es', learning_languages: ['en'] },
  { id: 103, username: 'sora', nickname: 'Sora Kim', name: 'Sora Kim', avatar_url: '🐼', status: 'offline', is_following: false, native_language: 'ko', learning_languages: ['en', 'zh'] },
  { id: 104, username: 'mara', nickname: 'Mara Vance', name: 'Mara Vance', avatar_url: '🐯', status: 'online', is_following: false, native_language: 'en', learning_languages: ['fr'] },
  { id: 105, username: 'iggy', nickname: 'Iggy Stone', name: 'Iggy Stone', avatar_url: '👾', status: 'studying', is_following: false, native_language: 'zh', learning_languages: ['en'] },
  { id: 106, username: 'lin', nickname: 'Lin Hua', name: 'Lin Hua', avatar_url: '🐲', status: 'online', is_following: false, native_language: 'zh', learning_languages: ['en', 'ja'] },
];

export function readJson<T>(key: string, seed: T): T {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) { const parsed = JSON.parse(raw); if (parsed != null) return parsed as T; }
  } catch { /* fall through */ }
  return seed;
}
export function writeJson(key: string, val: any): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val)); } catch { /* best-effort */ }
}

export const SEED_CONVOS: WfNewConversation[] = [
  { id: 1, type: 'direct', peer: { id: 101, nickname: 'Nova Lex', avatar: '🦊', presence: 'studying' }, last_message: 'See you in the next session!', unread_count: 1, last_message_at: '2026-06-19T08:30:00Z' },
  { id: 2, type: 'direct', peer: { id: 103, nickname: 'Sora Kim', avatar: '🐼', presence: 'offline' }, last_message: 'Thanks for the tip 🙏', unread_count: 0, last_message_at: '2026-06-18T20:10:00Z' },
];
export const SEED_MESSAGES: Record<number, WfNewMessage[]> = {
  1: [
    { id: 11, conversation_id: 1, sender_id: 101, body: 'Hey! Ready to practice?', type: 'text', metadata: null, created_at: '2026-06-19T08:20:00Z' },
    { id: 12, conversation_id: 1, sender_id: MOCK_SELF_ID, body: 'Yes — let’s do 20 words.', type: 'text', metadata: null, created_at: '2026-06-19T08:25:00Z' },
    { id: 13, conversation_id: 1, sender_id: 101, body: 'See you in the next session!', type: 'text', metadata: null, created_at: '2026-06-19T08:30:00Z' },
  ],
  2: [
    { id: 21, conversation_id: 2, sender_id: MOCK_SELF_ID, body: 'Try the Leitner deck for review.', type: 'text', metadata: null, created_at: '2026-06-18T20:05:00Z' },
    { id: 22, conversation_id: 2, sender_id: 103, body: 'Thanks for the tip 🙏', type: 'text', metadata: null, created_at: '2026-06-18T20:10:00Z' },
  ],
};
export const SEED_REQUESTS: WfNewFriendRequest[] = [
  { id: 1, requester_id: 104, addressee_id: MOCK_SELF_ID, status: 'pending', username: 'mara', name: 'Mara Vance', avatar_url: '🐯', created_at: '2026-06-19T07:00:00Z' },
];
export const SEED_NOTIFS: WfNewNotification[] = [
  { id: 1, type: 'friend_request', payload: { from: 'Mara Vance', user_id: 104 }, read_at: null, created_at: '2026-06-19T07:00:00Z' },
  { id: 2, type: 'new_message', payload: { from: 'Nova Lex', conversation_id: 1 }, read_at: null, created_at: '2026-06-19T08:30:00Z' },
];

export function readConvos(): WfNewConversation[] { return readJson(MOCK_CONVOS_KEY, SEED_CONVOS.map((c) => ({ ...c }))); }
export function readMessages(): Record<number, WfNewMessage[]> { return readJson(MOCK_MESSAGES_KEY, JSON.parse(JSON.stringify(SEED_MESSAGES))); }
export function readRequests(): WfNewFriendRequest[] { return readJson(MOCK_REQUESTS_KEY, SEED_REQUESTS.map((r) => ({ ...r }))); }
export function readNotifs(): WfNewNotification[] { return readJson(MOCK_NOTIFS_KEY, SEED_NOTIFS.map((n) => ({ ...n }))); }

// --- mock Social Center (posts / comments / live) --------------------------- #
// localStorage-backed so posts/likes/comments/live-chat survive a reload offline;
// shapes mirror the backend so the page behaves the same live.

export const MOCK_POSTS_KEY = 'wfnew_posts_mock';
export const MOCK_COMMENTS_KEY = 'wfnew_comments_mock';
export const MOCK_LIVE_KEY = 'wfnew_live_mock';
export const MOCK_LIVE_CHAT_KEY = 'wfnew_live_chat_mock';

export const SEED_POSTS: WfNewPost[] = [
  {
    id: 1,
    author: { id: 101, name: 'Nova Lex', avatar_url: '🦊' },
    content: 'Just hit a 30-day streak! Sharing my favorite idiom of the week 🌟',
    post_type: 'text',
    images: [],
    video_url: null, external_url: null, cover_url: null,
    like_count: 12, comment_count: 2, liked_by_me: false, visibility: 'public',
    created_at: '2026-06-20T08:30:00Z',
  },
  {
    id: 2,
    author: { id: 103, name: 'Sora Kim', avatar_url: '🐼' },
    content: 'Snapshots from my vocabulary wall 📚',
    post_type: 'images',
    images: [
      { id: 1, url: 'https://picsum.photos/seed/wfn-a/600/400', caption: 'Verbs', sequence: 0 },
      { id: 2, url: 'https://picsum.photos/seed/wfn-b/600/400', caption: 'Idioms', sequence: 1 },
      { id: 3, url: 'https://picsum.photos/seed/wfn-c/600/400', caption: 'Phrases', sequence: 2 },
    ],
    video_url: null, external_url: null, cover_url: null,
    like_count: 24, comment_count: 1, liked_by_me: true, visibility: 'public',
    created_at: '2026-06-20T07:10:00Z',
  },
  {
    id: 3,
    author: { id: 104, name: 'Mara Vance', avatar_url: '🐯' },
    content: 'A short clip explaining the subjunctive — hope it helps!',
    post_type: 'video',
    images: [],
    video_url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
    external_url: null,
    cover_url: 'https://picsum.photos/seed/wfn-vid/600/340',
    like_count: 8, comment_count: 0, liked_by_me: false, visibility: 'public',
    created_at: '2026-06-19T22:00:00Z',
  },
  {
    id: 4,
    author: { id: 102, name: 'Quill Ortega', avatar_url: '🦉' },
    content: 'Great grammar explainer I found:',
    post_type: 'video',
    images: [],
    video_url: null,
    external_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    cover_url: null,
    like_count: 5, comment_count: 0, liked_by_me: false, visibility: 'public',
    created_at: '2026-06-19T18:45:00Z',
  },
];

export const SEED_COMMENTS: Record<number, WfNewPostComment[]> = {
  1: [
    { id: 1, post_id: 1, parent_id: null, author: { id: 103, name: 'Sora Kim', avatar_url: '🐼' }, body: 'Congrats! Keep it up 🔥', created_at: '2026-06-20T08:35:00Z' },
    { id: 2, post_id: 1, parent_id: null, author: { id: 1, name: 'Demo Cadet', avatar_url: '🦁' }, body: 'Inspiring!', created_at: '2026-06-20T08:40:00Z' },
  ],
  2: [
    { id: 3, post_id: 2, parent_id: null, author: { id: 101, name: 'Nova Lex', avatar_url: '🦊' }, body: 'Love this layout.', created_at: '2026-06-20T07:20:00Z' },
  ],
};

export const SEED_LIVE: WfNewLive[] = [
  {
    id: 1,
    host: { id: 101, name: 'Nova Lex', avatar_url: '🦊' },
    title: 'Live: 20 idioms in 20 minutes',
    description: 'Interactive idiom drill — bring your questions!',
    status: 'live',
    external_url: 'https://www.youtube.com/embed/jNQXAC9IVRw',
    cover_url: 'https://picsum.photos/seed/wfn-live1/600/340',
    viewer_count: 42,
    started_at: '2026-06-20T09:00:00Z',
  },
  {
    id: 2,
    host: { id: 104, name: 'Mara Vance', avatar_url: '🐯' },
    title: 'Pronunciation clinic',
    description: 'Open mic accent coaching.',
    status: 'live',
    external_url: 'https://player.bilibili.com/player.html?bvid=BV1GJ411x7h7',
    cover_url: null,
    viewer_count: 17,
    started_at: '2026-06-20T08:30:00Z',
  },
];

export const SEED_LIVE_CHAT: Record<number, WfNewLiveMsg[]> = {
  1: [
    { id: 1, user: { id: 103, name: 'Sora Kim', avatar_url: '🐼' }, body: 'Hi everyone!', created_at: '2026-06-20T09:02:00Z' },
    { id: 2, user: { id: 102, name: 'Quill Ortega', avatar_url: '🦉' }, body: 'Can you repeat the last one?', created_at: '2026-06-20T09:05:00Z' },
  ],
};

export function readPosts(): WfNewPost[] { return readJson(MOCK_POSTS_KEY, SEED_POSTS.map((p) => ({ ...p }))); }
export function readComments(): Record<number, WfNewPostComment[]> { return readJson(MOCK_COMMENTS_KEY, JSON.parse(JSON.stringify(SEED_COMMENTS))); }
export function readLive(): WfNewLive[] { return readJson(MOCK_LIVE_KEY, SEED_LIVE.map((l) => ({ ...l }))); }
export function readLiveChat(): Record<number, WfNewLiveMsg[]> { return readJson(MOCK_LIVE_CHAT_KEY, JSON.parse(JSON.stringify(SEED_LIVE_CHAT))); }

/** Read a File into a base64 data URL (mock image/video upload preview). */
export function mockFileToUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Read a File into a base64 data URL (mock avatar upload). */
export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/** Generic dictionary pool used for search + unknown-group fallback. */
export const DEFAULT_WORD_POOL: Word[] = [
  { id: 'all-1', text: 'Aesthetics', phonetic: '/esˈθet.ɪks/', translation: '美学，审美', definition: 'Concerned with the appreciation of beauty.', example: 'The grid displays classical aesthetics.', masteryLevel: 80, tags: ['Aesthetics'] },
  { id: 'all-2', text: 'Glow', phonetic: '/ɡləʊ/', translation: '发光', definition: 'Produce a steady radiant light without flame.', example: 'The aurora produced a glowing halo.', masteryLevel: 95, tags: ['Cosmic'] },
  { id: 'all-3', text: 'Cognition', phonetic: '/kɒɡˈnɪʃ.ən/', translation: '认知', definition: 'The mental action of acquiring knowledge.', example: 'AI models replicate parts of human cognition.', masteryLevel: 72, tags: ['Psychology'] },
  { id: 'all-4', text: 'Nebula', phonetic: '/ˈneb.jə.lə/', translation: '星云', definition: 'A vast cloud of gas in outer space.', example: 'The telescope captured a nebula.', masteryLevel: 65, tags: ['Cosmic'] },
  { id: 'all-5', text: 'Ephemeral', phonetic: '/ɪˈfem.ər.əl/', translation: '短暂的', definition: 'Lasting for a very short time.', example: 'Auroras are ephemeral spectacles.', masteryLevel: 58, tags: ['Literature'] },
  { id: 'all-6', text: 'Symmetrical', phonetic: '/sɪˈmet.rɪ.kəl/', translation: '对称的', definition: 'Made of mirror-like identical components.', example: 'Symmetrical layouts feel restful.', masteryLevel: 90, tags: ['Design'] },
];

/** Every mock vocabulary word, flattened — the search corpus. */
export const ALL_MOCK_WORDS: Word[] = [
  ...DEFAULT_WORD_POOL,
  ...Object.values(MOCK_VOCABULARY_MAP).flat(),
  ...MOCK_WALKMAN_WORDS,
];
