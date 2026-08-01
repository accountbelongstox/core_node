/** methods/social - the social method group (friends / posts / comments / live /
 * conversations / presence / notifications) extracted from WfNewApiHttp so the
 * composer stays under the 800-line modular limit. Spread into wfNewApiHttp. */
import { wfNewEndpoints } from '../WfNewEndpoints';
import { WfNewApiPaths } from '../WfNewApiPaths';
import {
  getJSON, authedGetJSON, postJSON, queryPostJSON, postMultipart, deleteJSON, authToken, unwrapEnvelope,
} from '../WfNewApiTransport';
import {
  toPost, toComment, toLive, toLiveMsg, toMessage, toNotification,
  absUrl, asArray, decorate, toWord, fetchGroups, logContentFallback, normPresence,
} from '../WfNewApiMappers';
import type {
  WfNewFriend, WfNewUserSearchResult, WfNewLeaderboardEntry, WfNewActivity,
  WfNewDiscoverUser, WfNewFriendRequest, WfNewPublicUserProfile, WfNewConversation, WfNewMessage,
  WfNewMessagePage, WfNewPresenceStatus, WfNewPresenceInfo, WfNewNotificationPage,
  WfNewPostFilter, WfNewPostPage, WfNewPost, WfNewCreatePostPayload,
  WfNewPostLikeResult, WfNewPostCommentPage, WfNewPostComment, WfNewLive,
  WfNewCreateLivePayload, WfNewLiveMsg, WfNewLiveMsgPage, WfNewStatistics,
  BentoGroup, WordGroup, Word, WordPage, UserProfile, UserStats, SubtitleCourse,
  AnalyticsStats, BilingualSentence,
} from '../WfNewApiTypes';
import {
  MOCK_SUBTITLE_COURSES, MOCK_ANALYTICS_STATS, MOCK_BILINGUAL_SENTENCES,
} from '../../WfNewMockDb';

export const socialMethods = {
  // ---- Social (all auth-required) ----
  async getFriends(): Promise<WfNewFriend[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialFriends, null);
    return Array.isArray(res?.friends) ? res.friends : Array.isArray(res) ? res : [];
  },

  async searchUsers(query: string, opts: { native?: string; target?: string } = {}): Promise<WfNewUserSearchResult[]> {
    const q = query.trim();
    // A language-filtered search may run with an empty q (browse by language).
    if (!q && !opts.native && !opts.target) return [];
    const res = await authedGetJSON<any>(WfNewApiPaths.socialSearch(q, opts), null);
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

  // ---- Social v2: discover / friend-requests / chat / presence / notifications ----
  async discoverByLanguage(opts: { native?: string; target?: string; q?: string; limit?: number } = {}): Promise<WfNewDiscoverUser[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialDiscover(opts), null);
    const rows = Array.isArray(res?.users) ? res.users : Array.isArray(res) ? res : [];
    return rows.map((u: any) => ({
      id: Number(u?.id ?? 0),
      nickname: u?.nickname ?? u?.name ?? u?.username ?? '',
      avatar: u?.avatar ?? u?.avatar_url ?? '',
      native_language: u?.native_language ?? '',
      learning_languages: Array.isArray(u?.learning_languages) ? u.learning_languages : [],
      is_following: !!u?.is_following,
      is_friend: !!u?.is_friend,
      match: (u?.match === 'exchange' || u?.match === 'native' || u?.match === 'target') ? u.match : 'target',
      presence: normPresence(u?.presence ?? u?.presence_status ?? u?.status),
      stats: u?.stats && typeof u.stats === 'object' ? u.stats : undefined,
    }));
  },

  async sendFriendRequest(userId: number): Promise<void> {
    await postJSON(WfNewApiPaths.socialFriendRequest, { user_id: userId });
  },

  async respondFriendRequest(requestId: number, action: 'accept' | 'reject'): Promise<void> {
    await postJSON(WfNewApiPaths.socialFriendRespond, { request_id: requestId, action });
  },

  async getFriendRequests(direction: 'incoming' | 'outgoing' = 'incoming'): Promise<WfNewFriendRequest[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialFriendRequests(direction), null);
    const rows = Array.isArray(res?.requests) ? res.requests : Array.isArray(res) ? res : [];
    // The backend rows are { request_id, direction, status, user:{id,nickname,avatar}, created_at };
    // map onto the FLAT WfNewFriendRequest the page + mock use (id === request_id, so
    // respondFriendRequest(req.id) targets the right row). The OTHER party is `user`.
    return rows.map((r: any): WfNewFriendRequest => {
      const rid = Number(r?.request_id ?? r?.id ?? 0);
      const otherId = Number(r?.user?.id ?? r?.requester_id ?? r?.addressee_id ?? 0);
      const incoming = (r?.direction ?? direction) !== 'outgoing';
      return {
        id: rid,
        requester_id: r?.requester_id != null ? Number(r.requester_id) : (incoming ? otherId : 0),
        addressee_id: r?.addressee_id != null ? Number(r.addressee_id) : (incoming ? 0 : otherId),
        status: (r?.status === 'accepted' || r?.status === 'rejected' || r?.status === 'blocked') ? r.status : 'pending',
        username: r?.user?.username ?? r?.username ?? undefined,
        name: r?.user?.nickname ?? r?.user?.name ?? r?.name ?? undefined,
        avatar_url: absUrl(r?.user?.avatar ?? r?.user?.avatar_url ?? r?.avatar_url) ?? (r?.user?.avatar ?? undefined),
        created_at: r?.created_at ?? undefined,
      };
    });
  },

  async blockUser(userId: number): Promise<void> {
    await postJSON(WfNewApiPaths.socialBlock, { user_id: userId });
  },

  async getPublicUserProfile(userId: number): Promise<WfNewPublicUserProfile> {
    // GET /social/users/{id} → data.user (custom.authenticate). Do NOT confuse
    // with the self getUserProfile() (/user/profile), which reads the CURRENT
    // user's own profile. authedGetJSON returns null without a token → surface an
    // empty profile shell so the modal shows a "sign in" state instead of throwing.
    const res = await authedGetJSON<any>(WfNewApiPaths.socialUser(userId), null);
    const u = res?.user ?? res ?? {};
    const presence = u?.presence && typeof u.presence === 'object' ? u.presence : null;
    return {
      id: Number(u?.id ?? userId) || userId,
      name: u?.name ?? u?.nickname ?? u?.username ?? '',
      avatar_url: absUrl(u?.avatar_url ?? u?.avatar) ?? null,
      native_language: u?.native_language ?? null,
      learning_languages: Array.isArray(u?.learning_languages) ? u.learning_languages : [],
      bio: u?.bio ?? null,
      post_count: Number(u?.post_count ?? 0) || 0,
      follower_count: Number(u?.follower_count ?? 0) || 0,
      following_count: Number(u?.following_count ?? 0) || 0,
      is_following: !!u?.is_following,
      is_friend: !!u?.is_friend,
      presence: {
        status: normPresence(presence?.status ?? u?.presence),
        last_seen_at: presence?.last_seen_at ?? null,
      },
    };
  },

  async getConversations(): Promise<WfNewConversation[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialConversations, null);
    const rows = Array.isArray(res?.conversations) ? res.conversations : Array.isArray(res) ? res : [];
    return rows.map((c: any) => ({
      id: Number(c?.id ?? 0),
      type: c?.type === 'group' ? 'group' : 'direct',
      peer: {
        id: Number(c?.peer?.id ?? 0),
        nickname: c?.peer?.nickname ?? c?.peer?.name ?? c?.peer?.username ?? '',
        avatar: absUrl(c?.peer?.avatar ?? c?.peer?.avatar_url) ?? (c?.peer?.avatar ?? ''),
        presence: normPresence(c?.peer?.presence),
      },
      last_message: c?.last_message ?? null,
      unread_count: Number(c?.unread_count ?? 0) || 0,
      last_message_at: c?.last_message_at ?? null,
    }));
  },

  async openConversation(userId: number): Promise<WfNewConversation> {
    const res = await postJSON<any>(WfNewApiPaths.socialConversations, { user_id: userId });
    const c = unwrapEnvelope(res) ?? {};
    return {
      id: Number(c?.id ?? 0),
      type: c?.type === 'group' ? 'group' : 'direct',
      peer: {
        id: Number(c?.peer?.id ?? userId),
        nickname: c?.peer?.nickname ?? c?.peer?.name ?? c?.peer?.username ?? '',
        avatar: absUrl(c?.peer?.avatar ?? c?.peer?.avatar_url) ?? (c?.peer?.avatar ?? ''),
        presence: normPresence(c?.peer?.presence),
      },
      last_message: c?.last_message ?? null,
      unread_count: Number(c?.unread_count ?? 0) || 0,
      last_message_at: c?.last_message_at ?? null,
    };
  },

  async updateSocialLocation(location: { latitude: number; longitude: number; accuracy?: number; visible?: boolean }): Promise<void> {
    await postJSON<any>(WfNewApiPaths.socialLocation, {
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      visible: location.visible ?? true,
    });
  },

  async disableSocialLocation(): Promise<void> {
    await postJSON<any>(WfNewApiPaths.socialLocation, { visible: false });
  },

  async getNearbyUsers(radiusKm = 50, limit = 50): Promise<import('../types/social').WfNewNearbyUser[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialNearby(radiusKm, limit), null);
    const rows = Array.isArray(res?.users) ? res.users : [];
    return rows.map((user: any) => ({
      id: Number(user?.id ?? 0),
      nickname: user?.nickname ?? '',
      avatar: user?.avatar ?? '',
      native_language: user?.native_language ?? '',
      learning_languages: Array.isArray(user?.learning_languages) ? user.learning_languages : [],
      distance_km: Number(user?.distance_km ?? 0),
    }));
  },

  async getMessages(conversationId: number, cursor?: number | null): Promise<WfNewMessagePage> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialConversationMessages(conversationId, cursor), null);
    const rows = Array.isArray(res?.messages) ? res.messages : Array.isArray(res) ? res : [];
    return {
      messages: rows.map(toMessage),
      next_cursor: res?.next_cursor != null ? Number(res.next_cursor) : null,
    };
  },

  async sendMessage(conversationId: number, body: string, type: 'text' | 'image' | 'voice' = 'text', metadata?: Record<string, any>): Promise<WfNewMessage> {
    const res = await postJSON<any>(WfNewApiPaths.socialConversationSend(conversationId), { body, type, metadata });
    return toMessage(unwrapEnvelope(res) ?? {});
  },

  async markConversationRead(conversationId: number, messageId: number): Promise<void> {
    await postJSON(WfNewApiPaths.socialConversationRead(conversationId), { message_id: messageId });
  },

  async presenceHeartbeat(status?: WfNewPresenceStatus): Promise<void> {
    if (!authToken) return; // no session → nothing to heartbeat
    await postJSON(WfNewApiPaths.socialPresenceHeartbeat, status ? { status } : {});
  },

  async getPresence(userIds: number[]): Promise<Record<number, WfNewPresenceInfo>> {
    if (!userIds.length) return {};
    const res = await authedGetJSON<any>(WfNewApiPaths.socialPresence(userIds), null);
    const map = (res && typeof res === 'object') ? (res.presence ?? res) : {};
    const out: Record<number, WfNewPresenceInfo> = {};
    for (const [k, v] of Object.entries<any>(map)) {
      const id = Number(k);
      if (!Number.isFinite(id)) continue;
      out[id] = { status: normPresence(v?.status), last_seen_at: v?.last_seen_at ?? null };
    }
    return out;
  },

  async getNotifications(cursor?: number | null, unreadOnly?: boolean): Promise<WfNewNotificationPage> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialNotifications(cursor, unreadOnly), null);
    const rows = Array.isArray(res?.notifications) ? res.notifications : Array.isArray(res) ? res : [];
    return {
      notifications: rows.map(toNotification),
      next_cursor: res?.next_cursor != null ? Number(res.next_cursor) : null,
    };
  },

  async getUnreadCount(): Promise<number> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialNotificationsUnreadCount, null);
    return Number(res?.count ?? 0) || 0;
  },

  async markNotificationRead(idOrAll: number | 'all'): Promise<void> {
    await postJSON(WfNewApiPaths.socialNotificationRead, idOrAll === 'all' ? { all: true } : { id: idOrAll });
  },

  // ---- Social Center: posts / comments / live ----
  async getPosts(opts: { cursor?: number | null; limit?: number; filter?: WfNewPostFilter; author?: number } = {}): Promise<WfNewPostPage> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialPosts(opts), null);
    const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    let items: WfNewPost[] = rows.map(toPost);
    if (opts.author != null) items = items.filter(p => p.author.id === opts.author);
    return { items, next_cursor: res?.next_cursor != null ? Number(res.next_cursor) : null };
  },

  async getPost(postId: number): Promise<WfNewPost> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialPost(postId), null);
    return toPost(unwrapEnvelope(res) ?? res ?? {});
  },

  async createPost(payload: WfNewCreatePostPayload): Promise<WfNewPost> {
    const res = await postJSON<any>(WfNewApiPaths.socialPostsCreate, {
      content: payload.content,
      post_type: payload.post_type,
      external_url: payload.external_url,
      visibility: payload.visibility,
    });
    return toPost(unwrapEnvelope(res) ?? {});
  },

  async deletePost(postId: number): Promise<void> {
    await deleteJSON(WfNewApiPaths.socialPost(postId));
  },

  async likePost(postId: number): Promise<WfNewPostLikeResult> {
    const res = await postJSON<any>(WfNewApiPaths.socialPostLike(postId), {});
    const d = unwrapEnvelope(res) ?? {};
    return { like_count: Number(d?.like_count ?? 0) || 0, liked_by_me: d?.liked_by_me !== false };
  },

  async unlikePost(postId: number): Promise<WfNewPostLikeResult> {
    const res = await postJSON<any>(WfNewApiPaths.socialPostUnlike(postId), {});
    const d = unwrapEnvelope(res) ?? {};
    return { like_count: Number(d?.like_count ?? 0) || 0, liked_by_me: !!d?.liked_by_me };
  },

  async getComments(postId: number, cursor?: number | null): Promise<WfNewPostCommentPage> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialPostComments(postId, cursor), null);
    const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    return { items: rows.map(toComment), next_cursor: res?.next_cursor != null ? Number(res.next_cursor) : null };
  },

  async addComment(postId: number, body: string, parentId?: number): Promise<WfNewPostComment> {
    const res = await postJSON<any>(WfNewApiPaths.socialPostComments(postId), { body, parent_id: parentId });
    return toComment(unwrapEnvelope(res) ?? {});
  },

  async deleteComment(postId: number, commentId: number): Promise<void> {
    await deleteJSON(WfNewApiPaths.socialPostComment(postId, commentId));
  },

  async uploadPostImages(postId: number, files: File[]): Promise<WfNewPost> {
    const form = new FormData();
    for (const f of files) form.append('images[]', f);
    const res = await postMultipart<any>(WfNewApiPaths.socialPostImages(postId), form);
    return toPost(unwrapEnvelope(res) ?? {});
  },

  async uploadPostVideo(postId: number, file: File): Promise<WfNewPost> {
    const form = new FormData();
    form.append('video', file);
    const res = await postMultipart<any>(WfNewApiPaths.socialPostVideo(postId), form);
    return toPost(unwrapEnvelope(res) ?? {});
  },

  async getLiveSessions(status: 'live' | 'all' = 'live'): Promise<WfNewLive[]> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialLive(status), null);
    const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    return rows.map(toLive);
  },

  async createLive(payload: WfNewCreateLivePayload): Promise<WfNewLive> {
    const res = await postJSON<any>(WfNewApiPaths.socialLiveCreate, {
      title: payload.title,
      description: payload.description,
      external_url: payload.external_url,
    });
    return toLive(unwrapEnvelope(res) ?? {});
  },

  async endLive(liveId: number): Promise<void> {
    await postJSON(WfNewApiPaths.socialLiveEnd(liveId), {});
  },

  async liveHeartbeat(liveId: number): Promise<number> {
    const res = await postJSON<any>(WfNewApiPaths.socialLiveHeartbeat(liveId), {});
    const d = unwrapEnvelope(res) ?? {};
    return Number(d?.viewer_count ?? 0) || 0;
  },

  async getLiveChat(liveId: number, cursor?: number | null): Promise<WfNewLiveMsgPage> {
    const res = await authedGetJSON<any>(WfNewApiPaths.socialLiveChat(liveId, cursor), null);
    const rows = Array.isArray(res?.items) ? res.items : Array.isArray(res) ? res : [];
    return { items: rows.map(toLiveMsg), next_cursor: res?.next_cursor != null ? Number(res.next_cursor) : null };
  },

  async sendLiveChat(liveId: number, body: string): Promise<WfNewLiveMsg> {
    const res = await postJSON<any>(WfNewApiPaths.socialLiveChatSend(liveId), { body });
    return toLiveMsg(unwrapEnvelope(res) ?? {});
  },

  async getBentoGroups(): Promise<BentoGroup[]> {
    const groups = await fetchGroups();
    return groups.map((g, i) => decorate(g, i));
  },

  getWordGroups(): Promise<WordGroup[]> {
    return fetchGroups();
  },

  async getVocabulary(groupId: string): Promise<Word[]> {
    // A group's words live in TWO stores: the progress-map (group_word_progress,
    // filled by add_library and the Default Vocabulary Group) and the legacy
    // `gwords` column. UNION both so this returns real words for progress-map
    // groups AND legacy groups. Neither sub-fetch may throw — each is guarded so
    // one source still populates the list if the other fails.
    const PER_PAGE = 100;
    const MAX_WORDS = 1000; // cap loaded words to protect render/network on huge groups

    // 1) Progress-map words via POST /group/get_words (enriched text/translation/
    //    phonetic/audio_url/definition). Page until covered or the cap is hit.
    let progressWords: Word[] = [];
    try {
      let page = 1;
      let total = 0;
      let more = true;
      while (more && progressWords.length < MAX_WORDS) {
        const res = await this.getGroupWordsPage(groupId, page, PER_PAGE, true);
        total = res.total || total;
        if (!res.words.length) break;
        progressWords = progressWords.concat(res.words);
        more = page * PER_PAGE < total;
        page++;
      }
      if (progressWords.length > MAX_WORDS) progressWords = progressWords.slice(0, MAX_WORDS);
      if (progressWords.length >= MAX_WORDS && total > progressWords.length) {
        // Explicit note — no silent truncation of very large groups.
        console.info(`[getVocabulary] group ${groupId}: loaded ${progressWords.length} of ${total} words (cap ${MAX_WORDS}).`);
      }
    } catch {
      // ignore — the legacy gwords source below may still populate the list
    }

    // 2) Legacy gwords via GET /query_gwords (empty for progress-map groups).
    let legacyWords: Word[] = [];
    try {
      const res = await authedGetJSON<any>(WfNewApiPaths.queryGroupWords(groupId), null);
      legacyWords = asArray(res, 'gwords', 'words').map(toWord);
    } catch {
      // ignore — progress-map words above may already cover the group
    }

    // 3) Concatenate (enriched progress words first so they win) and dedupe by
    //    word id, with lowercased text as a secondary key.
    const out: Word[] = [];
    const seenIds = new Set<string>();
    const seenText = new Set<string>();
    for (const w of [...progressWords, ...legacyWords]) {
      const id = w.id;
      const textKey = (w.text || '').trim().toLowerCase();
      if (id && seenIds.has(id)) continue;
      if (textKey && seenText.has(textKey)) continue;
      if (id) seenIds.add(id);
      if (textKey) seenText.add(textKey);
      out.push(w);
    }
    return out;
  },

  async getGroupWordsPage(
    gid: string,
    page: number,
    perPage: number,
    withProgress?: boolean,
    opts?: { unread_only?: boolean; limit?: number },
  ): Promise<WordPage> {
    const perPageCapped = Math.min(perPage, 100);
    // Cross-stack contract (§5.7): unread_only + limit are added to the POST
    // /group/get_words body when present. unread_only filters to rc==0 words
    // before paging; limit caps the returned count (shelf passes daily_goal).
    const body: Record<string, any> = {
      gid, page, per_page: perPageCapped, with_progress: !!withProgress,
    };
    if (opts?.unread_only) body.unread_only = true;
    if (opts?.limit != null && opts.limit > 0) body.limit = opts.limit;
    const res = await queryPostJSON<any>(WfNewApiPaths.groupGetWords, body);
    const data = unwrapEnvelope(res) ?? {};
    return {
      words: asArray(data, 'words').map(toWord),
      total: Number(data?.total_words ?? 0) || 0,
      page: Number(data?.page ?? page) || page,
      perPage: Number(data?.per_page ?? perPageCapped) || perPageCapped,
    };
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

  async getTtsVoices(): Promise<{ id: string; label: string; lang: string }[]> {
    try {
      // GET /ai_tools/tts/voices → data.voices = { lang: voice_id } (the Laravel
      // audio library). Flatten to the picker shape; never throw → [] on failure so
      // the Voice selector falls back to the browser's Web-Speech voice list.
      const res = await getJSON<any>(WfNewApiPaths.ttsVoices);
      const map = (res && typeof res === 'object') ? (res.voices ?? res) : null;
      if (!map || typeof map !== 'object') return [];
      return Object.entries<any>(map)
        .map(([lang, voiceId]) => ({ id: String(voiceId ?? ''), label: String(voiceId ?? ''), lang: String(lang) }))
        .filter((v) => v.id);
    } catch {
      return [];
    }
  },
};
