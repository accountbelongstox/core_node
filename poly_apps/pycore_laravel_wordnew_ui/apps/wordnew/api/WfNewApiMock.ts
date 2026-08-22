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
  WfNewWordMediaOptions,
} from './WfNewApiTypes';
import { WFNEW_BUILTIN_LANGUAGES, WFNEW_BUILTIN_PRESET_AVATARS } from './WfNewApiDefaults';
import {
  MOCK_BENTO_GROUPS, MOCK_VOCABULARY_MAP, MOCK_WALKMAN_WORDS,
  MOCK_SUBTITLE_COURSES, MOCK_BILINGUAL_SENTENCES, MOCK_ANALYTICS_STATS,
  MOCK_BOOK_GROUPS, MOCK_SUBTITLE_GROUPS, MOCK_LIBRARY_GROUPS, MOCK_DOCUMENT_GROUPS,
} from '../WfNewMockDb';

/** Simulate a little network latency so loading states are exercised. */

// Mock data stores + helpers extracted (see WfNewApiMockHelpers).
import {
  delay,
  MOCK_WORD_MEDIA_CALLS,
  mockMd5,
  MOCK_AUTH_USERS_KEY,
  MockAuthRecord,
  SEED_AUTH_USERS,
  readAuthUsers,
  writeAuthUsers,
  publicUser,
  mockAuthError,
  MOCK_PREFS_KEY,
  DEFAULT_PREFS,
  readMockPreferences,
  writeMockPreferences,
  MOCK_LANGS_KEY,
  readMockLanguages,
  writeMockLanguages,
  MOCK_FRIENDS_KEY,
  MOCK_SOCIAL_DIRECTORY,
  SEED_FRIENDS,
  MOCK_LEADERBOARD,
  MOCK_ACTIVITIES,
  readMockFriends,
  writeMockFriends,
  MOCK_CONVOS_KEY,
  MOCK_MESSAGES_KEY,
  MOCK_REQUESTS_KEY,
  MOCK_NOTIFS_KEY,
  MOCK_SELF_ID,
  MockDirEntry,
  MOCK_DISCOVER_DIRECTORY,
  readJson,
  writeJson,
  SEED_CONVOS,
  SEED_MESSAGES,
  SEED_REQUESTS,
  SEED_NOTIFS,
  readConvos,
  readMessages,
  readRequests,
  readNotifs,
  MOCK_POSTS_KEY,
  MOCK_COMMENTS_KEY,
  MOCK_LIVE_KEY,
  MOCK_LIVE_CHAT_KEY,
  SEED_POSTS,
  SEED_COMMENTS,
  SEED_LIVE,
  SEED_LIVE_CHAT,
  readPosts,
  readComments,
  readLive,
  readLiveChat,
  mockFileToUrl,
  fileToDataUrl,
  DEFAULT_WORD_POOL,
  ALL_MOCK_WORDS
} from './WfNewApiMockHelpers';
import { mockSocialMethods } from './methods/mockSocial';

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
      email: email || `${username}@wordnew.test`,
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
        email: `${username}@wordnew.test`,
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
    const current = readMockPreferences();
    const merged: WfNewPreferences = { ...current, ...patch };
    if (patch.app_settings && typeof patch.app_settings === 'object') {
      const base = (current.app_settings && typeof current.app_settings === 'object')
        ? current.app_settings
        : {};
      const incoming = patch.app_settings;
      const nextApp = { ...base, ...incoming };
      if (incoming.reader && typeof incoming.reader === 'object') {
        const existingReader = (base as any).reader && typeof (base as any).reader === 'object'
          ? (base as any).reader
          : {};
        nextApp.reader = { ...existingReader, ...incoming.reader };
      }
      merged.app_settings = nextApp;
    }
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

  async updateSocialLocation(_location: { latitude: number; longitude: number; accuracy?: number; visible?: boolean }): Promise<void> {
    await delay(null, 40);
  },

  async disableSocialLocation(): Promise<void> {
    await delay(null, 40);
  },

  async getNearbyUsers(_radiusKm = 50, limit = 50): Promise<import('./types/social').WfNewNearbyUser[]> {
    const rows = MOCK_DISCOVER_DIRECTORY
      .filter((user) => user.id !== MOCK_SELF_ID)
      .slice(0, limit)
      .map((user, index) => ({
        id: user.id,
        nickname: user.name || user.username,
        avatar: user.avatar_url,
        native_language: user.native_language,
        learning_languages: user.learning_languages,
        distance_km: Number((1.5 + index * 3.7).toFixed(1)),
      }));
    return delay(rows);
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

  ...mockSocialMethods,

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

  getAgentArticlesPage: (limit = 100, offset = 0): Promise<import('./WfNewApiTypes').WfNewAgentArticlePage> =>
    delay({ items: [], total: 0, limit, offset }),

  getRecentAgentArticles: (): Promise<import('./WfNewApiTypes').WfNewAgentArticle[]> => delay([]),

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
    opts: WfNewWordMediaOptions = {},
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

  async resolveSentenceAudio(text: string, language: string, _variantKey?: string, _passive = false) {
    const key = `${language}:${text.slice(0, 32)}`;
    const n = (MOCK_WORD_MEDIA_CALLS.get(key) ?? 0) + 1;
    MOCK_WORD_MEDIA_CALLS.set(key, n);
    const ready = n > 2;
    const url = ready
      ? `https://example.test/mock-sentence/${encodeURIComponent(language)}.mp3`
      : null;
    return delay({
      exists: ready,
      url,
      queued: !ready,
      content_id: mockMd5(text),
      hash: mockMd5(text),
      tts_status: ready ? 'completed' : 'pending',
      audio_files: ready
        ? [
            {
              variant_key: '',
              accent: 'us',
              gender: 'female',
              source: 'tts',
              voice_type: 'neural',
              provider: 'qwen3tts',
              path: `${language}/${mockMd5(text)}.mp3`,
              has_file: true,
              url,
            },
          ]
        : [],
    });
  },

  async moveSentenceAudioToHead(items: Array<{ text: string; language: string }>) {
    return delay({
      success: true,
      queued: 0,
      total: items.length,
      items: items.map((item) => ({
        ...item,
        success: true,
        status: 'already_available',
        task_id: null,
      })),
      error: undefined,
    });
  },

  async getWordAudio(
    language: string,
    word: string,
    opts: WfNewWordMediaOptions = {},
  ): Promise<WfNewWordMedia> {
    const key = `audio:${language}/${word}`;
    const calls = (MOCK_WORD_MEDIA_CALLS.get(key) ?? 0) + 1;
    MOCK_WORD_MEDIA_CALLS.set(key, calls);
    const ready = calls > 1;
    const accent: WfNewWordAccent = opts.accent === 'uk' ? 'uk' : 'us';
    const audioUrl = ready
      ? `https://example.test/mock-audio/${accent}/${encodeURIComponent(word)}.mp3`
      : null;
    return delay({
      word,
      md5: mockMd5(`${language}/${word}`),
      language,
      imageUrl: null,
      audioUrl,
      imageStatus: 'pending',
      audioStatus: ready ? 'ready' : 'pending',
      audioAccent: ready ? accent : null,
      accentFallback: false,
      audioVariants: [{ accent, url: audioUrl, status: ready ? 'ready' : 'pending' }],
      translations: [],
    });
  },

  async moveWordAudioToHead(words: string[], _language: string) {
    return delay({
      success: true,
      queued: 0,
      total: words.length,
      results: words.map((content) => ({
        content,
        language: _language,
        success: true,
        status: 'already_available',
        queue_task_id: null,
        queue_position: null,
      })),
      error: undefined,
    });
  },

  async getBookReadingProgress(sourceKey: string) {
    return delay(null);
  },

  async saveBookReadingProgress(sourceKey: string, payload: { chapterIndex?: number | null; verseSeq: number; grain?: string; page?: number }) {
    return delay({
      sourceKey,
      chapterIndex: payload.chapterIndex ?? null,
      verseSeq: payload.verseSeq,
      grain: payload.grain ?? 'sentence',
      page: payload.page ?? 1,
      updatedAt: new Date().toISOString(),
    });
  },

  async listBookReadingProgress(_limit = 100) {
    return delay([]);
  },

  async getDailyReadingProgress() {
    return delay(null);
  },

  async saveDailyReadingProgress(articleId, selectionMode = 'latest') {
    return delay({
      articleId,
      selectionMode,
      updatedAt: new Date().toISOString(),
    });
  },

  async getClientDeviceSettings(clientKey: string) {
    const { readMockDeviceSettings } = await import('./WfNewApiMockHelpers');
    return delay(readMockDeviceSettings(clientKey));
  },

  async saveClientDeviceSettings(clientKey: string, reader, updatedAt?: string) {
    const { writeMockDeviceSettings } = await import('./WfNewApiMockHelpers');
    const ts = updatedAt ?? new Date().toISOString();
    return delay(writeMockDeviceSettings(clientKey, reader, ts));
  },

  async addLibraryToDefaultGroup(libraryId) {
    return delay({
      gid: 'mock-default-group',
      library_id: Number(libraryId),
      library_name: 'Mock Library',
      already_linked: false,
      words_added: 0,
      total_words_in_library: 0,
    });
  },

  async previewAddLibraryToDefaultGroup(libraryId) {
    return delay({
      gid: 'mock-default-group',
      library_id: Number(libraryId),
      library_name: 'Mock Library',
      already_linked: false,
      current_in_group: 120,
      library_total: 500,
      to_add: 480,
      projected_total: 600,
      duplicates: [],
      duplicates_count: 20,
      language_match: true,
      status_breakdown: { read: 60, memorized: 25, due: 15, total: 120 },
    });
  },

  async getGroupProgressBlob(gid) {
    return delay({
      gid,
      gname: 'Mock Group',
      language_code: 'en',
      total_words: 0,
      legend: {},
      words: {},
    });
  },

  async updateGroupProgress(_payload) {
    return delay({ success: true });
  },

  async recitationLog(payload) {
    return delay({
      logged: payload.words.length,
      date: new Date().toISOString().slice(0, 10),
      today: { unique_words: payload.words.length, actions: payload.words.length, goal: 20, goal_met: false },
    });
  },

  async recitationTodayPlan() {
    return delay({ date: new Date().toISOString().slice(0, 10), goal: 20, done_today: 0, words: [] });
  },

  async recitationSummary(date) {
    return delay({ date: date ?? new Date().toISOString().slice(0, 10), unique_words: 0, actions: 0, goal: 20, goal_met: false, words: [] });
  },

  async recitationStreak() {
    return delay({ current_streak: 0, longest_streak: 0, days: [] });
  },
};
