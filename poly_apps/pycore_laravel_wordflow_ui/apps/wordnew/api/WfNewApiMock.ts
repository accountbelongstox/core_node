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
  WfNewDiscoverUser, WfNewFriendRequest, WfNewConversation, WfNewMessage,
  WfNewMessagePage, WfNewNotification, WfNewNotificationPage, WfNewPresenceInfo,
  WfNewPresenceStatus,
  WfNewPost, WfNewPostPage, WfNewPostComment, WfNewPostCommentPage, WfNewPostLikeResult,
  WfNewCreatePostPayload, WfNewPostFilter, WfNewLive, WfNewCreateLivePayload,
  WfNewLiveMsg, WfNewLiveMsgPage,
  WfNewContentGroup, WfNewHomeContent, WfNewStatistics,
  WfNewBookChapters, WfNewBookChapter, WfNewBookVersesPage, WfNewBookVerse,
  WfNewSubtitleDetail, WfNewSubtitleSegment, WfNewSubtitleSentence, WfNewDictWord, WfNewWordPage,
  WfNewLibraryWord, WfNewLibraryWordsPage, WfNewWordMedia, WfNewWordAccent,
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

/**
 * Per-word call counter for the mock getWordMedia: it models the file-first
 * enqueue → ready flow. The FIRST resolve for a word returns 'pending' (just
 * enqueued); the SECOND+ poll returns 'ready' with media urls — so a polling UI
 * exercises the pending → ready swap fully offline.
 */
const MOCK_WORD_MEDIA_CALLS = new Map<string, number>();
const mockMd5 = (s: string): string => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return `mock_${h.toString(16).padStart(8, '0')}`;
};

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

// --- mock social v2 (discover / requests / chat / presence / notifications) -- #
// localStorage-backed so chat/requests survive a reload offline; shapes mirror the
// backend (SOCIAL_FEATURE_SPECIFICATION.md §3) so the page works the same live.

const MOCK_CONVOS_KEY = 'wfnew_convos_mock';
const MOCK_MESSAGES_KEY = 'wfnew_messages_mock';
const MOCK_REQUESTS_KEY = 'wfnew_requests_mock';
const MOCK_NOTIFS_KEY = 'wfnew_notifs_mock';

/** The mock "current user" id (matches the seeded demo account / leaderboard). */
const MOCK_SELF_ID = 1;

/** A richer directory for language discovery (adds languages to the search pool). */
interface MockDirEntry extends WfNewUserSearchResult {
  nickname: string;
  native_language: string;
  learning_languages: string[];
}
const MOCK_DISCOVER_DIRECTORY: MockDirEntry[] = [
  { id: 101, username: 'nova_lex', nickname: 'Nova Lex', name: 'Nova Lex', avatar_url: '🦊', status: 'studying', is_following: false, native_language: 'en', learning_languages: ['zh', 'ja'] },
  { id: 102, username: 'quill', nickname: 'Quill Ortega', name: 'Quill Ortega', avatar_url: '🦉', status: 'online', is_following: false, native_language: 'es', learning_languages: ['en'] },
  { id: 103, username: 'sora', nickname: 'Sora Kim', name: 'Sora Kim', avatar_url: '🐼', status: 'offline', is_following: false, native_language: 'ko', learning_languages: ['en', 'zh'] },
  { id: 104, username: 'mara', nickname: 'Mara Vance', name: 'Mara Vance', avatar_url: '🐯', status: 'online', is_following: false, native_language: 'en', learning_languages: ['fr'] },
  { id: 105, username: 'iggy', nickname: 'Iggy Stone', name: 'Iggy Stone', avatar_url: '👾', status: 'studying', is_following: false, native_language: 'zh', learning_languages: ['en'] },
  { id: 106, username: 'lin', nickname: 'Lin Hua', name: 'Lin Hua', avatar_url: '🐲', status: 'online', is_following: false, native_language: 'zh', learning_languages: ['en', 'ja'] },
];

function readJson<T>(key: string, seed: T): T {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    if (raw) { const parsed = JSON.parse(raw); if (parsed != null) return parsed as T; }
  } catch { /* fall through */ }
  return seed;
}
function writeJson(key: string, val: any): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(val)); } catch { /* best-effort */ }
}

const SEED_CONVOS: WfNewConversation[] = [
  { id: 1, type: 'direct', peer: { id: 101, nickname: 'Nova Lex', avatar: '🦊', presence: 'studying' }, last_message: 'See you in the next session!', unread_count: 1, last_message_at: '2026-06-19T08:30:00Z' },
  { id: 2, type: 'direct', peer: { id: 103, nickname: 'Sora Kim', avatar: '🐼', presence: 'offline' }, last_message: 'Thanks for the tip 🙏', unread_count: 0, last_message_at: '2026-06-18T20:10:00Z' },
];
const SEED_MESSAGES: Record<number, WfNewMessage[]> = {
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
const SEED_REQUESTS: WfNewFriendRequest[] = [
  { id: 1, requester_id: 104, addressee_id: MOCK_SELF_ID, status: 'pending', username: 'mara', name: 'Mara Vance', avatar_url: '🐯', created_at: '2026-06-19T07:00:00Z' },
];
const SEED_NOTIFS: WfNewNotification[] = [
  { id: 1, type: 'friend_request', payload: { from: 'Mara Vance', user_id: 104 }, read_at: null, created_at: '2026-06-19T07:00:00Z' },
  { id: 2, type: 'new_message', payload: { from: 'Nova Lex', conversation_id: 1 }, read_at: null, created_at: '2026-06-19T08:30:00Z' },
];

function readConvos(): WfNewConversation[] { return readJson(MOCK_CONVOS_KEY, SEED_CONVOS.map((c) => ({ ...c }))); }
function readMessages(): Record<number, WfNewMessage[]> { return readJson(MOCK_MESSAGES_KEY, JSON.parse(JSON.stringify(SEED_MESSAGES))); }
function readRequests(): WfNewFriendRequest[] { return readJson(MOCK_REQUESTS_KEY, SEED_REQUESTS.map((r) => ({ ...r }))); }
function readNotifs(): WfNewNotification[] { return readJson(MOCK_NOTIFS_KEY, SEED_NOTIFS.map((n) => ({ ...n }))); }

// --- mock Social Center (posts / comments / live) --------------------------- #
// localStorage-backed so posts/likes/comments/live-chat survive a reload offline;
// shapes mirror the backend so the page behaves the same live.

const MOCK_POSTS_KEY = 'wfnew_posts_mock';
const MOCK_COMMENTS_KEY = 'wfnew_comments_mock';
const MOCK_LIVE_KEY = 'wfnew_live_mock';
const MOCK_LIVE_CHAT_KEY = 'wfnew_live_chat_mock';

const SEED_POSTS: WfNewPost[] = [
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

const SEED_COMMENTS: Record<number, WfNewPostComment[]> = {
  1: [
    { id: 1, post_id: 1, parent_id: null, author: { id: 103, name: 'Sora Kim', avatar_url: '🐼' }, body: 'Congrats! Keep it up 🔥', created_at: '2026-06-20T08:35:00Z' },
    { id: 2, post_id: 1, parent_id: null, author: { id: 1, name: 'Demo Cadet', avatar_url: '🦁' }, body: 'Inspiring!', created_at: '2026-06-20T08:40:00Z' },
  ],
  2: [
    { id: 3, post_id: 2, parent_id: null, author: { id: 101, name: 'Nova Lex', avatar_url: '🦊' }, body: 'Love this layout.', created_at: '2026-06-20T07:20:00Z' },
  ],
};

const SEED_LIVE: WfNewLive[] = [
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

const SEED_LIVE_CHAT: Record<number, WfNewLiveMsg[]> = {
  1: [
    { id: 1, user: { id: 103, name: 'Sora Kim', avatar_url: '🐼' }, body: 'Hi everyone!', created_at: '2026-06-20T09:02:00Z' },
    { id: 2, user: { id: 102, name: 'Quill Ortega', avatar_url: '🦉' }, body: 'Can you repeat the last one?', created_at: '2026-06-20T09:05:00Z' },
  ],
};

function readPosts(): WfNewPost[] { return readJson(MOCK_POSTS_KEY, SEED_POSTS.map((p) => ({ ...p }))); }
function readComments(): Record<number, WfNewPostComment[]> { return readJson(MOCK_COMMENTS_KEY, JSON.parse(JSON.stringify(SEED_COMMENTS))); }
function readLive(): WfNewLive[] { return readJson(MOCK_LIVE_KEY, SEED_LIVE.map((l) => ({ ...l }))); }
function readLiveChat(): Record<number, WfNewLiveMsg[]> { return readJson(MOCK_LIVE_CHAT_KEY, JSON.parse(JSON.stringify(SEED_LIVE_CHAT))); }

/** Read a File into a base64 data URL (mock image/video upload preview). */
function mockFileToUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
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

  // ---- Social login + account management (mock) ----
  async socialLogin(cred): Promise<WfNewAuthResult> {
    await delay(null, 260);
    const provider = cred.provider;
    const username = `${provider}_demo`;
    const users = readAuthUsers();
    let match = users.find((u) => (u.username || '').toLowerCase() === username);
    if (!match) {
      const nextId = String(users.reduce((max, u) => Math.max(max, Number(u.id) || 0), 0) + 1);
      match = {
        id: nextId,
        username,
        nickname: provider === 'google' ? 'Google User' : 'GitHub User',
        name: provider === 'google' ? 'Google User' : 'GitHub User',
        email: `${username}@wordflow.test`,
        avatar: '',
        native_language: 'zh',
        learning_languages: ['en'],
        member_type: 'free',
        bio: `Signed in with ${provider}`,
        password: `__oauth_${provider}__`,
      };
      writeAuthUsers([...users, match]);
    }
    return { token: `mock_token_${match.id}_${Date.now()}`, user: publicUser(match) };
  },

  async bindProvider(_cred): Promise<void> {
    await delay(null, 120); // offline: nothing to link
  },

  async unbindProvider(_provider): Promise<void> {
    await delay(null, 120);
  },

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await delay(null, 160);
    if (!oldPassword || !newPassword) throw mockAuthError('Both passwords are required', 422);
    if (newPassword.length < 6) throw mockAuthError('New password is too short', 422);
    // Offline mock has no single "current user"; accept the change.
  },

  async updateProfile(patch): Promise<WfNewAuthUser> {
    await delay(null, 160);
    return {
      nickname: patch.nickname,
      name: patch.name,
      bio: patch.bio,
      email: patch.email,
    };
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

  async searchUsers(query: string, opts: { native?: string; target?: string } = {}): Promise<WfNewUserSearchResult[]> {
    const q = query.trim().toLowerCase();
    if (!q && !opts.native && !opts.target) return delay<WfNewUserSearchResult[]>([]);
    const followedIds = new Set(readMockFriends().map((f) => f.id));
    return delay(
      MOCK_DISCOVER_DIRECTORY
        .filter((u) => !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
        .filter((u) => !opts.native || u.native_language === opts.native)
        .filter((u) => !opts.target || u.learning_languages.includes(opts.target))
        .map((u) => ({
          id: u.id, username: u.username, name: u.name, avatar_url: u.avatar_url,
          status: u.status, is_following: followedIds.has(u.id),
        }))
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

  // ---- Social v2 (localStorage-backed; backend-aligned shapes) ----
  async discoverByLanguage(opts: { native?: string; target?: string; q?: string; limit?: number } = {}): Promise<WfNewDiscoverUser[]> {
    const q = (opts.q || '').trim().toLowerCase();
    const friendIds = new Set(readMockFriends().map((f) => f.id));
    const self = readMockLanguages(); // my native + targets, for exchange ranking
    const rows = MOCK_DISCOVER_DIRECTORY
      .filter((u) => u.id !== MOCK_SELF_ID)
      .filter((u) => !q || u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .filter((u) => !opts.native || u.native_language === opts.native)
      .filter((u) => !opts.target || u.learning_languages.includes(opts.target))
      .map<WfNewDiscoverUser>((u) => {
        const exchange = u.learning_languages.includes(self.native_language)
          && self.learning_languages.includes(u.native_language);
        const match: WfNewDiscoverUser['match'] = exchange ? 'exchange'
          : (opts.native && u.native_language === opts.native) ? 'native' : 'target';
        const presence: WfNewPresenceStatus = (u.status === 'online' || u.status === 'away' || u.status === 'studying' || u.status === 'offline') ? u.status : 'offline';
        return {
          id: u.id, nickname: u.nickname, avatar: u.avatar_url,
          native_language: u.native_language, learning_languages: u.learning_languages,
          is_following: friendIds.has(u.id), is_friend: friendIds.has(u.id), match,
          presence,
          stats: { learned: 200 + u.id, mastered: 80 + u.id, streak: u.id % 10 },
        };
      });
    // Best matches first (exchange > native > target).
    const rank = { exchange: 0, native: 1, target: 2 } as const;
    rows.sort((a, b) => rank[a.match] - rank[b.match]);
    return delay(opts.limit ? rows.slice(0, opts.limit) : rows);
  },

  async sendFriendRequest(userId: number): Promise<void> {
    const reqs = readRequests();
    if (!reqs.some((r) => r.addressee_id === userId && r.requester_id === MOCK_SELF_ID)) {
      const dir = MOCK_DISCOVER_DIRECTORY.find((u) => u.id === userId);
      reqs.push({
        id: reqs.reduce((m, r) => Math.max(m, r.id), 0) + 1,
        requester_id: MOCK_SELF_ID, addressee_id: userId, status: 'pending',
        username: dir?.username, name: dir?.name, avatar_url: dir?.avatar_url,
        created_at: new Date().toISOString(),
      });
      writeJson(MOCK_REQUESTS_KEY, reqs);
    }
    await delay(null, 120);
  },

  async respondFriendRequest(requestId: number, action: 'accept' | 'reject'): Promise<void> {
    const reqs = readRequests();
    const r = reqs.find((x) => x.id === requestId);
    if (r) {
      r.status = action === 'accept' ? 'accepted' : 'rejected';
      writeJson(MOCK_REQUESTS_KEY, reqs);
      if (action === 'accept') {
        // Accepting follows the requester (mirrors the backend ensure-friendship).
        const friends = readMockFriends();
        const dir = MOCK_DISCOVER_DIRECTORY.find((u) => u.id === r.requester_id);
        if (dir && !friends.some((f) => f.id === dir.id)) {
          friends.push({ id: dir.id, username: dir.username, name: dir.name, avatar_url: dir.avatar_url, status: dir.status, followed_at: null, stats: { learned: 0, mastered: 0, streak: 0 } });
          writeMockFriends(friends);
        }
      }
    }
    await delay(null, 120);
  },

  async getFriendRequests(direction: 'incoming' | 'outgoing' = 'incoming'): Promise<WfNewFriendRequest[]> {
    const reqs = readRequests().filter((r) => r.status === 'pending');
    return delay(reqs.filter((r) => direction === 'incoming' ? r.addressee_id === MOCK_SELF_ID : r.requester_id === MOCK_SELF_ID));
  },

  async blockUser(userId: number): Promise<void> {
    writeMockFriends(readMockFriends().filter((f) => f.id !== userId));
    await delay(null, 120);
  },

  async getConversations(): Promise<WfNewConversation[]> {
    return delay(readConvos());
  },

  async openConversation(userId: number): Promise<WfNewConversation> {
    const convos = readConvos();
    let convo = convos.find((c) => c.peer.id === userId);
    if (!convo) {
      const dir = MOCK_DISCOVER_DIRECTORY.find((u) => u.id === userId);
      convo = {
        id: convos.reduce((m, c) => Math.max(m, c.id), 0) + 1,
        type: 'direct',
        peer: { id: userId, nickname: dir?.nickname ?? `User ${userId}`, avatar: dir?.avatar_url ?? '🙂', presence: 'offline' },
        last_message: null, unread_count: 0, last_message_at: null,
      };
      convos.push(convo);
      writeJson(MOCK_CONVOS_KEY, convos);
    }
    return delay(convo);
  },

  async getMessages(conversationId: number, _cursor?: number | null): Promise<WfNewMessagePage> {
    const all = readMessages();
    return delay({ messages: (all[conversationId] ?? []).map((m) => ({ ...m })), next_cursor: null });
  },

  async sendMessage(conversationId: number, body: string, type: 'text' | 'image' | 'voice' = 'text', metadata?: Record<string, any>): Promise<WfNewMessage> {
    const all = readMessages();
    const list = all[conversationId] ?? [];
    const msg: WfNewMessage = {
      id: list.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      conversation_id: conversationId, sender_id: MOCK_SELF_ID, body,
      type, metadata: metadata ?? null, created_at: new Date().toISOString(),
    };
    all[conversationId] = [...list, msg];
    writeJson(MOCK_MESSAGES_KEY, all);
    // Bump the conversation's last message.
    const convos = readConvos();
    const c = convos.find((x) => x.id === conversationId);
    if (c) { c.last_message = body; c.last_message_at = msg.created_at; writeJson(MOCK_CONVOS_KEY, convos); }
    return delay(msg, 80);
  },

  async markConversationRead(conversationId: number, _messageId: number): Promise<void> {
    const convos = readConvos();
    const c = convos.find((x) => x.id === conversationId);
    if (c) { c.unread_count = 0; writeJson(MOCK_CONVOS_KEY, convos); }
    await delay(null, 60);
  },

  async presenceHeartbeat(_status?: WfNewPresenceStatus): Promise<void> {
    await delay(null, 40);
  },

  async getPresence(userIds: number[]): Promise<Record<number, WfNewPresenceInfo>> {
    const out: Record<number, WfNewPresenceInfo> = {};
    for (const id of userIds) {
      const dir = MOCK_DISCOVER_DIRECTORY.find((u) => u.id === id);
      const status = (dir?.status as WfNewPresenceStatus) || 'offline';
      out[id] = { status: (status === 'online' || status === 'away' || status === 'studying' || status === 'offline') ? status : 'offline', last_seen_at: new Date().toISOString() };
    }
    return delay(out);
  },

  async getNotifications(_cursor?: number | null, unreadOnly?: boolean): Promise<WfNewNotificationPage> {
    let list = readNotifs().slice().sort((a, b) => b.id - a.id);
    if (unreadOnly) list = list.filter((n) => !n.read_at);
    return delay({ notifications: list, next_cursor: null });
  },

  async getUnreadCount(): Promise<number> {
    return delay(readNotifs().filter((n) => !n.read_at).length, 60);
  },

  async markNotificationRead(idOrAll: number | 'all'): Promise<void> {
    const list = readNotifs();
    const now = new Date().toISOString();
    for (const n of list) {
      if (idOrAll === 'all' || n.id === idOrAll) n.read_at = n.read_at || now;
    }
    writeJson(MOCK_NOTIFS_KEY, list);
    await delay(null, 60);
  },

  // ---- Social Center: posts / comments / live (localStorage-backed) ----
  async getPosts(opts: { cursor?: number | null; limit?: number; filter?: WfNewPostFilter; author?: number } = {}): Promise<WfNewPostPage> {
    let list = readPosts().slice().sort((a, b) => b.id - a.id);
    if (opts.filter === 'images') list = list.filter((p) => p.post_type === 'images' && p.images.length > 0);
    else if (opts.filter === 'videos') list = list.filter((p) => p.post_type === 'video' && (!!p.video_url || !!p.external_url));
    // 'following' offline → show all (no follow graph in the mock plaza).
    if (opts.author != null) list = list.filter((p) => p.author.id === opts.author);
    return delay({ items: list, next_cursor: null });
  },

  async getPost(postId: number): Promise<WfNewPost> {
    const found = readPosts().find((p) => p.id === postId);
    if (!found) throw mockAuthError('Post not found', 404);
    return delay({ ...found });
  },

  async createPost(payload: WfNewCreatePostPayload): Promise<WfNewPost> {
    const list = readPosts();
    const post: WfNewPost = {
      id: list.reduce((m, p) => Math.max(m, p.id), 0) + 1,
      author: { id: MOCK_SELF_ID, name: 'Demo Cadet', avatar_url: '🦁' },
      content: payload.content ?? '',
      post_type: payload.post_type,
      images: [],
      video_url: null,
      external_url: payload.external_url ?? null,
      cover_url: null,
      like_count: 0, comment_count: 0, liked_by_me: false,
      visibility: payload.visibility ?? 'public',
      created_at: new Date().toISOString(),
    };
    writeJson(MOCK_POSTS_KEY, [post, ...list]);
    return delay(post, 120);
  },

  async deletePost(postId: number): Promise<void> {
    writeJson(MOCK_POSTS_KEY, readPosts().filter((p) => p.id !== postId));
    await delay(null, 80);
  },

  async likePost(postId: number): Promise<WfNewPostLikeResult> {
    const list = readPosts();
    const p = list.find((x) => x.id === postId);
    if (p && !p.liked_by_me) { p.liked_by_me = true; p.like_count += 1; writeJson(MOCK_POSTS_KEY, list); }
    return delay({ like_count: p?.like_count ?? 0, liked_by_me: true }, 80);
  },

  async unlikePost(postId: number): Promise<WfNewPostLikeResult> {
    const list = readPosts();
    const p = list.find((x) => x.id === postId);
    if (p && p.liked_by_me) { p.liked_by_me = false; p.like_count = Math.max(0, p.like_count - 1); writeJson(MOCK_POSTS_KEY, list); }
    return delay({ like_count: p?.like_count ?? 0, liked_by_me: false }, 80);
  },

  async getComments(postId: number, _cursor?: number | null): Promise<WfNewPostCommentPage> {
    const all = readComments();
    return delay({ items: (all[postId] ?? []).map((c) => ({ ...c })), next_cursor: null });
  },

  async addComment(postId: number, body: string, parentId?: number): Promise<WfNewPostComment> {
    const all = readComments();
    const list = all[postId] ?? [];
    const allIds = Object.values(all).flat();
    const comment: WfNewPostComment = {
      id: allIds.reduce((m, c) => Math.max(m, c.id), 0) + 1,
      post_id: postId,
      parent_id: parentId ?? null,
      author: { id: MOCK_SELF_ID, name: 'Demo Cadet', avatar_url: '🦁' },
      body,
      created_at: new Date().toISOString(),
    };
    all[postId] = [...list, comment];
    writeJson(MOCK_COMMENTS_KEY, all);
    // Bump the post's comment_count.
    const posts = readPosts();
    const p = posts.find((x) => x.id === postId);
    if (p) { p.comment_count += 1; writeJson(MOCK_POSTS_KEY, posts); }
    return delay(comment, 100);
  },

  async deleteComment(postId: number, commentId: number): Promise<void> {
    const all = readComments();
    all[postId] = (all[postId] ?? []).filter((c) => c.id !== commentId);
    writeJson(MOCK_COMMENTS_KEY, all);
    const posts = readPosts();
    const p = posts.find((x) => x.id === postId);
    if (p) { p.comment_count = Math.max(0, p.comment_count - 1); writeJson(MOCK_POSTS_KEY, posts); }
    await delay(null, 80);
  },

  async uploadPostImages(postId: number, files: File[]): Promise<WfNewPost> {
    const urls = await Promise.all(files.map(mockFileToUrl));
    const posts = readPosts();
    const p = posts.find((x) => x.id === postId);
    if (!p) throw mockAuthError('Post not found', 404);
    const base = p.images.length;
    p.images = [
      ...p.images,
      ...urls.map((url, i) => ({ id: base + i + 1, url, caption: null, sequence: base + i })),
    ];
    p.post_type = 'images';
    writeJson(MOCK_POSTS_KEY, posts);
    return delay({ ...p }, 150);
  },

  async uploadPostVideo(postId: number, file: File): Promise<WfNewPost> {
    const url = await mockFileToUrl(file);
    const posts = readPosts();
    const p = posts.find((x) => x.id === postId);
    if (!p) throw mockAuthError('Post not found', 404);
    p.video_url = url;
    p.post_type = 'video';
    writeJson(MOCK_POSTS_KEY, posts);
    return delay({ ...p }, 150);
  },

  async getLiveSessions(status: 'live' | 'all' = 'live'): Promise<WfNewLive[]> {
    let list = readLive();
    if (status === 'live') list = list.filter((l) => l.status === 'live');
    return delay(list.map((l) => ({ ...l })));
  },

  async createLive(payload: WfNewCreateLivePayload): Promise<WfNewLive> {
    const list = readLive();
    const live: WfNewLive = {
      id: list.reduce((m, l) => Math.max(m, l.id), 0) + 1,
      host: { id: MOCK_SELF_ID, name: 'Demo Cadet', avatar_url: '🦁' },
      title: payload.title,
      description: payload.description ?? null,
      status: 'live',
      external_url: payload.external_url ?? null,
      cover_url: null,
      viewer_count: 1,
      started_at: new Date().toISOString(),
    };
    writeJson(MOCK_LIVE_KEY, [live, ...list]);
    return delay(live, 120);
  },

  async endLive(liveId: number): Promise<void> {
    const list = readLive();
    const l = list.find((x) => x.id === liveId);
    if (l) { l.status = 'ended'; writeJson(MOCK_LIVE_KEY, list); }
    await delay(null, 80);
  },

  async liveHeartbeat(liveId: number): Promise<number> {
    const l = readLive().find((x) => x.id === liveId);
    return delay(l?.viewer_count ?? 0, 40);
  },

  async getLiveChat(liveId: number, _cursor?: number | null): Promise<WfNewLiveMsgPage> {
    const all = readLiveChat();
    return delay({ items: (all[liveId] ?? []).map((m) => ({ ...m })), next_cursor: null });
  },

  async sendLiveChat(liveId: number, body: string): Promise<WfNewLiveMsg> {
    const all = readLiveChat();
    const list = all[liveId] ?? [];
    const allIds = Object.values(all).flat();
    const msg: WfNewLiveMsg = {
      id: allIds.reduce((m, x) => Math.max(m, x.id), 0) + 1,
      user: { id: MOCK_SELF_ID, name: 'Demo Cadet', avatar_url: '🦁' },
      body,
      created_at: new Date().toISOString(),
    };
    all[liveId] = [...list, msg];
    writeJson(MOCK_LIVE_CHAT_KEY, all);
    return delay(msg, 80);
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

  // Mock data is a single page; page>1 returns [] (exhausted) so load-more stops.
  getBookGroups: (page = 1, perPage = 24): Promise<WfNewContentGroup[]> =>
    delay(MOCK_BOOK_GROUPS.slice((page - 1) * perPage, page * perPage).map((g) => ({ ...g }))),

  getSubtitleGroups: (page = 1, perPage = 24): Promise<WfNewContentGroup[]> =>
    delay(MOCK_SUBTITLE_GROUPS.slice((page - 1) * perPage, page * perPage).map((g) => ({ ...g }))),

  getLibraryGroups: (page = 1, perPage = 24): Promise<WfNewContentGroup[]> =>
    delay(MOCK_LIBRARY_GROUPS.slice((page - 1) * perPage, page * perPage).map((g) => ({ ...g }))),

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
        ref: `${ci + 1}:${i + 1}`,
        book: `Book ${ci + 1}`,
        text: en,
        language: 'en',
        audio: null,
        corrId: `mock-${ci}-${i}`,
        languages: {
          en: { text: en, audio: null, hasAudio: false, explanation: null },
          zh: { text: zh, audio: null, hasAudio: false, explanation: null },
        },
      };
    });
    return delay({ items, total: items.length, perPage: items.length, currentPage: 1, lastPage: 1, hasMore: false });
  },

  // ---- Subtitle playback + word stats ----
  async getSubtitleDetail(
    sourceKey: string,
    _opts: { page?: number; perPage?: number; grain?: string } = {},
  ): Promise<WfNewSubtitleDetail> {
    // Derive a playable mock from the first curated subtitle course.
    const course = MOCK_SUBTITLE_COURSES[0];
    const items: WfNewSubtitleSentence[] = (course?.subtitles ?? []).map((l, i) => ({
      grain: 'sentence', seq: i, segIndex: i, startSec: l.startTime, endSec: l.endTime,
      text: l.text, language: 'en', audio: null,
      languages: { en: { text: l.text, audio: null }, zh: { text: l.translation, audio: null } },
    }));
    const segments: WfNewSubtitleSegment[] = (course?.subtitles ?? []).map((l, i) => ({
      segIndex: i, startSec: l.startTime, endSec: l.endTime, subtitleCount: 1, mp3Url: null, mp4Url: null, fullMp4Url: null,
    }));
    return delay({
      sourceKey, title: course?.title ?? sourceKey, language: 'en', durationSec: items[items.length - 1]?.endSec ?? 60,
      segments, sentences: { items, total: items.length, perPage: items.length, currentPage: 1, lastPage: 1 },
    });
  },

  async getDictionaryWords(
    opts: { language?: string; start?: number; limit?: number; filter?: string } = {},
  ): Promise<WfNewWordPage> {
    const start = opts.start ?? 0;
    const limit = opts.limit ?? 30;
    const slice = ALL_MOCK_WORDS.slice(start, start + limit);
    const words: WfNewDictWord[] = slice.map((w) => ({
      content: w.text, md5: w.id, phonetic: w.phonetic, usPhonetic: w.phonetic, ukPhonetic: w.phonetic,
      translation: w.translation, hasTranslation: !!w.translation, audioUrl: w.audioUrl ?? null, ttsStatus: 'ready',
    }));
    return delay({ words, total: ALL_MOCK_WORDS.length, start, limit, language: opts.language ?? 'english' });
  },

  async getLibraryWords(
    libraryId: string,
    opts: { page?: number; perPage?: number } = {},
  ): Promise<WfNewLibraryWordsPage> {
    const page = Math.max(1, opts.page ?? 1);
    const perPage = Math.min(2000, Math.max(1, opts.perPage ?? 100));
    const total = Math.max(ALL_MOCK_WORDS.length, 120);
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const offset = (page - 1) * perPage;
    const words: WfNewLibraryWord[] = Array.from({ length: Math.min(perPage, Math.max(0, total - offset)) }, (_, i) => {
      const seed = ALL_MOCK_WORDS[(offset + i) % ALL_MOCK_WORDS.length];
      return {
        index: offset + i + 1,
        word: seed?.text ?? `word${offset + i + 1}`,
        md5: seed?.id ?? `md5_${offset + i + 1}`,
        phonetic: seed?.phonetic, usPhonetic: seed?.phonetic, ukPhonetic: seed?.phonetic,
        explanation: seed?.translation ? `Definition of ${seed.text}` : undefined,
        translations: seed?.translation ? [seed.translation] : [],
        images: [], audioUrl: seed?.audioUrl ?? null,
        hasTranslation: !!seed?.translation, hasAudio: !!seed?.audioUrl, hasImage: false, isValid: true,
      };
    });
    return delay({
      library: { id: libraryId, name: `Library ${libraryId}`, totalWords: total, language: 'english' },
      words,
      stats: {
        total,
        translated: words.filter((w) => w.hasTranslation).length,
        withAudio: words.filter((w) => w.hasAudio).length,
        withImage: 0, invalid: 0,
      },
      pagination: { currentPage: page, perPage, total, lastPage, hasMore: page < lastPage },
    });
  },

  async getWordMedia(
    language: string,
    word: string,
    opts: { accent?: WfNewWordAccent } = {},
  ): Promise<WfNewWordMedia> {
    const key = `${language}/${word}`;
    const n = (MOCK_WORD_MEDIA_CALLS.get(key) ?? 0) + 1;
    MOCK_WORD_MEDIA_CALLS.set(key, n);
    // First call = freshly enqueued (pending); subsequent polls report ready.
    const ready = n > 1;
    const enc = encodeURIComponent(word);
    // Echo the requested accent (contract C1); mock never accent-falls-back.
    const accent: WfNewWordAccent = opts.accent === 'uk' ? 'uk' : 'us';
    const audioUrl = ready ? `https://example.test/mock-audio/${accent}/${enc}.mp3` : null;
    return delay({
      word,
      md5: mockMd5(key),
      language,
      imageUrl: ready ? `https://picsum.photos/seed/${enc}/200` : null,
      audioUrl,
      imageStatus: ready ? 'ready' : 'pending',
      audioStatus: ready ? 'ready' : 'pending',
      audioAccent: ready ? accent : null,
      accentFallback: false,
      audioVariants: [{ accent, url: audioUrl, status: ready ? 'ready' : 'pending' }],
      translations: [`释义 ${word}`],
      explanation: `Mock explanation for ${word}.`,
      phonetic: undefined,
      usPhonetic: undefined,
      ukPhonetic: undefined,
    });
  },
};
