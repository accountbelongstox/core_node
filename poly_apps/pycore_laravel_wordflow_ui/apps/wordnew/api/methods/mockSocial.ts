/** methods/mockSocial - the Social Center method group (posts / comments / live)
 * extracted from WfNewApiMock so the composer stays under the 800-line modular
 * limit. Spread into wfNewApiMock. */
import type { WfNewPost, WfNewPostComment, WfNewLive } from '../WfNewApiTypes';
import {
  delay,
  mockAuthError,
  MOCK_SELF_ID,
  writeJson,
  MOCK_POSTS_KEY,
  MOCK_COMMENTS_KEY,
  MOCK_LIVE_KEY,
  MOCK_LIVE_CHAT_KEY,
  readPosts,
  readComments,
  readLive,
  readLiveChat,
  mockFileToUrl,
  DEFAULT_WORD_POOL,
  ALL_MOCK_WORDS,
} from '../WfNewApiMockHelpers';

export const mockSocialMethods = {
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
};
