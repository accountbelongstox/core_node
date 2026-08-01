/** types/api.ts - the WfNewApi interface (method contract shared by WfNewApiHttp + WfNewApiMock). (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
import type { Word, WordGroup, BentoGroup, UserStats, WfNewStatistics, UserProfile, WfNewContentKind, WfNewContentGroup, WfNewHomeContent, WfNewLanguage, WfNewLanguageSelection } from './core';
import type { WfNewBookChapter, WfNewBookChapters, WfNewAgentArticle, WfNewBookVerseLang, WfNewBookVerse, WfNewBookVersesPage, WfNewSubtitleSegment, WfNewSubtitleSentence, WfNewSubtitleDetail, WfNewDictWord, WfNewWordPage, WfNewLibraryWord, WfNewLibraryWordsPage, WfNewWordAccent, WfNewWordAudioVariant, WfNewWordMedia, WordNewAudioFileVariant, SubtitleWord, SubtitleLine, SubtitleCourse, BilingualWord, BilingualSentence } from './media';
import type { WfNewAuthUser, WfNewAuthResult, WfNewPreferences, WfNewRegisterPayload, WfNewSocialCredential, WfNewProfileUpdate, WfNewAvatarResult, WfNewSocialStats } from './user';
import type { WfNewFriend, WfNewUserSearchResult, WfNewLeaderboardEntry, WfNewActivity, WfNewPresenceStatus, WfNewDiscoverUser, WfNewNearbyUser, WfNewFriendRequest, WfNewConversation, WfNewMessage, WfNewMessagePage, WfNewNotification, WfNewNotificationPage, WfNewPresenceInfo, WfNewPublicUserProfile, WfNewSocialActor, WfNewPostImage, WfNewPostType, WfNewPostVisibility, WfNewPostFilter, WfNewPost, WfNewPostPage, WfNewPostComment, WfNewPostCommentPage, WfNewPostLikeResult, WfNewCreatePostPayload, WfNewLiveStatus, WfNewLive, WfNewCreateLivePayload, WfNewLiveMsg, WfNewLiveMsgPage } from './social';
import type { WeeklyActivity, CategoryScore, StudiedTimelineItem, AnalyticsStats } from './analytics';
import type { WfNewEndpointKind, WfNewEndpoint, WfNewEndpointHealth, WfNewEndpointSnapshot } from './endpoints';
import type { WfNewBookReadingProgress } from './bookProgress';
import type { WfNewClientDeviceSettings, WfNewReaderSettingsBlob } from './readerSettings';
import type {
  WordNewGroupProgressBlob, WordNewGroupProgressPayload,
  WordNewRecitationLogPayload, WordNewRecitationLogResult,
  WordNewRecitationTodayPlan, WordNewRecitationSummary, WordNewRecitationStreak,
} from './learning';

/**
 * Every data access the /wordnew app needs, in one interface. Both
 * WfNewApiMock and WfNewApiHttp implement THIS — keep them in lock-step.
 */
export interface WfNewApi {
  // ---- Session ----
  /** True when a usable session token is held (always true in mock mode). */
  isAuthenticated(): boolean;
  /** Subscribe to "session expired" (a 401 from any authed call). Returns an unsubscribe fn. */
  onAuthExpired(cb: () => void): () => void;

  // ---- Auth ----
  /** Authenticate by username/email/phone + password. Rejects on bad creds. */
  login(identifier: string, password: string): Promise<WfNewAuthResult>;
  /** Create an account (immediately logged in). Rejects with a backend message on failure. */
  register(payload: WfNewRegisterPayload): Promise<WfNewAuthResult>;
  /** Clear the current session token (best-effort; always resolves). */
  logout(): Promise<void>;
  /**
   * One-click social login/register (Google / GitHub). Pass the credential from
   * CapSocialAuth; the backend verifies it and returns a real session (creating
   * the account on first sign-in). POST /auth/social.
   */
  socialLogin(cred: WfNewSocialCredential): Promise<WfNewAuthResult>;
  /** Link a social provider to the CURRENT account (auth). POST /user/social/bind. */
  bindProvider(cred: WfNewSocialCredential): Promise<void>;
  /** Unlink a social provider from the current account (auth). POST /user/social/unbind. */
  unbindProvider(provider: 'google' | 'github'): Promise<void>;
  /** Change password for the current account (auth). POST /user/change-password. */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;
  /** Update editable profile fields (auth). POST /user/profile. */
  updateProfile(patch: WfNewProfileUpdate): Promise<WfNewAuthUser>;
  /** Read the roaming account preferences (defaults applied server-side). */
  getPreferences(): Promise<WfNewPreferences>;
  /** Merge-update preferences; resolves to the full updated set. */
  updatePreferences(patch: WfNewPreferences): Promise<WfNewPreferences>;

  /** Selectable learning languages (live catalog, falls back to the built-in list). */
  getSupportedLanguages(): Promise<WfNewLanguage[]>;
  /** The user's native + learning-target selection. */
  getLearningLanguages(): Promise<WfNewLanguageSelection>;
  /** Persist the native + learning-target selection; resolves to the saved set. */
  setLearningLanguages(selection: WfNewLanguageSelection): Promise<WfNewLanguageSelection>;

  /** Upload a new avatar image; resolves to the stored path + absolute URL. */
  uploadAvatar(file: File): Promise<WfNewAvatarResult>;

  // ---- Social ----
  /** Users the current account follows (with presence + learning stats). */
  getFriends(): Promise<WfNewFriend[]>;
  /** Search users by username/nickname/name (excludes self). Optional language
   *  filters narrow by native / target (GET /social/friends/search?q=&native=&target=). */
  searchUsers(query: string, opts?: { native?: string; target?: string }): Promise<WfNewUserSearchResult[]>;
  /** Follow a user by id. */
  followUser(userId: number): Promise<void>;
  /** Unfollow a user by id. */
  unfollowUser(userId: number): Promise<void>;
  /** Global XP leaderboard ('week' or 'all'). */
  getLeaderboard(period?: 'week' | 'all'): Promise<WfNewLeaderboardEntry[]>;
  /** Recent learning activity of followed users. */
  getActivities(): Promise<WfNewActivity[]>;

  // ---- Social v2: discover / friend-requests / chat / presence / notifications ----
  /** Find language partners (GET /social/discover). Matches by native/target; the
   *  page derives native/target from the current user's languages. */
  discoverByLanguage(opts?: { native?: string; target?: string; q?: string; limit?: number }): Promise<WfNewDiscoverUser[]>;
  updateSocialLocation(location: { latitude: number; longitude: number; accuracy?: number; visible?: boolean }): Promise<void>;
  disableSocialLocation(): Promise<void>;
  getNearbyUsers(radiusKm?: number, limit?: number): Promise<WfNewNearbyUser[]>;
  /** Send a friend request to a user (POST /social/friends/request). */
  sendFriendRequest(userId: number): Promise<void>;
  /** Accept or reject an incoming friend request (POST /social/friends/respond). */
  respondFriendRequest(requestId: number, action: 'accept' | 'reject'): Promise<void>;
  /** Pending friend requests in a direction (GET /social/friends/requests). */
  getFriendRequests(direction?: 'incoming' | 'outgoing'): Promise<WfNewFriendRequest[]>;
  /** Block a user (POST /social/friends/block). */
  blockUser(userId: number): Promise<void>;

  /** Public profile of another user by id (GET /social/users/{id}). Powers the
   *  read-only profile modal opened from partner cards / chat peer headers —
   *  distinct from getUserProfile() which reads the CURRENT user's own profile. */
  getPublicUserProfile(userId: number): Promise<WfNewPublicUserProfile>;

  /** My conversations (GET /social/conversations). */
  getConversations(): Promise<WfNewConversation[]>;
  /** Get-or-create a direct conversation with a user (POST /social/conversations). */
  openConversation(userId: number): Promise<WfNewConversation>;
  /** A page of a conversation's messages, id-ASC after `cursor` (GET …/messages). */
  getMessages(conversationId: number, cursor?: number | null): Promise<WfNewMessagePage>;
  /** Send a message into a conversation (POST …/messages). */
  sendMessage(conversationId: number, body: string, type?: 'text' | 'image' | 'voice', metadata?: Record<string, any>): Promise<WfNewMessage>;
  /** Mark a conversation read up to a message id (POST …/read). */
  markConversationRead(conversationId: number, messageId: number): Promise<void>;

  /** Heartbeat my presence (POST /social/presence/heartbeat); ~30s while active. */
  presenceHeartbeat(status?: WfNewPresenceStatus): Promise<void>;
  /** Batch presence for users (GET /social/presence?user_ids=). */
  getPresence(userIds: number[]): Promise<Record<number, WfNewPresenceInfo>>;

  /** A page of my notifications (GET /social/notifications). */
  getNotifications(cursor?: number | null, unreadOnly?: boolean): Promise<WfNewNotificationPage>;
  /** Unread notification count (GET /social/notifications/unread-count). */
  getUnreadCount(): Promise<number>;
  /** Mark one notification (by id) or ALL ('all') read (POST /social/notifications/read). */
  markNotificationRead(idOrAll: number | 'all'): Promise<void>;

  // ---- Social Center: posts / comments / live ----
  /** A page of plaza posts (GET /social/posts). PUBLIC read (no token needed);
   *  `following` filter falls back to public when logged out. `author` scopes the
   *  feed to one user's posts (user-profile page) — see WfNewApiPaths note: the
   *  backend may not yet support author scoping; the http impl passes it through
   *  and the page tolerates an unfiltered result. */
  getPosts(opts?: { cursor?: number | null; limit?: number; filter?: WfNewPostFilter; author?: number }): Promise<WfNewPostPage>;
  /** One post by id (GET /social/posts/{id}). */
  getPost(postId: number): Promise<WfNewPost>;
  /** Create a post (POST /social/posts). Auth-required. */
  createPost(payload: WfNewCreatePostPayload): Promise<WfNewPost>;
  /** Delete a post (DELETE /social/posts/{id}). Auth-required. */
  deletePost(postId: number): Promise<void>;
  /** Like / unlike a post (POST /social/posts/{id}/like|unlike). Auth-required. */
  likePost(postId: number): Promise<WfNewPostLikeResult>;
  unlikePost(postId: number): Promise<WfNewPostLikeResult>;
  /** A page of a post's comments (GET /social/posts/{id}/comments). PUBLIC read. */
  getComments(postId: number, cursor?: number | null): Promise<WfNewPostCommentPage>;
  /** Add a comment (POST /social/posts/{id}/comments). Auth-required. */
  addComment(postId: number, body: string, parentId?: number): Promise<WfNewPostComment>;
  /** Delete a comment (DELETE /social/posts/{id}/comments/{cid}). Auth-required. */
  deleteComment(postId: number, commentId: number): Promise<void>;
  /** Attach images to a post (multipart images[]). Auth-required. */
  uploadPostImages(postId: number, files: File[]): Promise<WfNewPost>;
  /** Attach a short clip to a post (multipart video). Auth-required. */
  uploadPostVideo(postId: number, file: File): Promise<WfNewPost>;

  /** Live sessions (GET /social/live?status=). PUBLIC read. */
  getLiveSessions(status?: 'live' | 'all'): Promise<WfNewLive[]>;
  /** Start a live session (POST /social/live). Auth-required. */
  createLive(payload: WfNewCreateLivePayload): Promise<WfNewLive>;
  /** End a live session you host (POST /social/live/{id}/end). Auth-required. */
  endLive(liveId: number): Promise<void>;
  /** Viewer heartbeat → current viewer_count (POST /social/live/{id}/heartbeat). */
  liveHeartbeat(liveId: number): Promise<number>;
  /** A page of a live room's chat (GET /social/live/{id}/chat). PUBLIC read. */
  getLiveChat(liveId: number, cursor?: number | null): Promise<WfNewLiveMsgPage>;
  /** Send a live-chat message (POST /social/live/{id}/chat). Auth-required. */
  sendLiveChat(liveId: number, body: string): Promise<WfNewLiveMsg>;
  /**
   * Preset avatar choices (emoji strings or image URLs). Tries the backend first,
   * falls back to the built-in set so the picker is never empty offline.
   */
  getPresetAvatars(): Promise<string[]>;

  /** Decorated home-grid groups (bento layout). */
  getBentoGroups(): Promise<BentoGroup[]>;
  /** Plain learning groups for the library shelf. */
  getWordGroups(): Promise<WordGroup[]>;
  /** Words inside one group/course. */
  getVocabulary(groupId: string): Promise<Word[]>;
  /** A page of one group's words (POST /group/get_words, per_page capped at 100).
   *  Reads the Default Vocabulary Group's words from group_word_progress (which
   *  getVocabulary/query_gwords misses) with enriched text/translation/phonetic/
   *  audio/definition. Pass withProgress to also load the SRS/read-count fields.
   *  opts.unread_only filters to never-read words (rc==0) BEFORE paging - used by
   *  the shelf daily-goal flow on the Default Vocabulary Group. opts.limit caps the
   *  total returned word count (0 / undefined = no cap; the shelf passes daily_goal). */
  getGroupWordsPage(gid: string, page: number, perPage: number, withProgress?: boolean, opts?: WfNewGroupWordsOpts): Promise<WordPage>;
  /** Current user's profile, or null when unauthenticated/offline. */
  getUserProfile(): Promise<UserProfile | null>;
  /** Home dashboard counters (derived from the profile when real). */
  getUserStats(): Promise<UserStats>;
  /** Rich learning statistics for the dashboard (GET /user/statistics). Null when unauthenticated/offline. */
  getUserStatistics(): Promise<WfNewStatistics | null>;
  /** Dictionary / fuzzy search for the global search overlay. */
  searchDictionary(text: string): Promise<Word[]>;
  /** Cassette playlist for the Cyber Walkman page. */
  getWalkmanWords(): Promise<Word[]>;
  /** Interactive subtitle courses. */
  getSubtitleCourses(): Promise<SubtitleCourse[]>;
  /** Learning analytics for the stats board. */
  getAnalytics(): Promise<AnalyticsStats>;
  /** Bilingual recital sentence pairs. */
  getBilingualSentences(): Promise<BilingualSentence[]>;
  /** Available TTS voices from the Laravel audio library (GET /ai_tools/tts/voices),
   *  flattened from the backend { lang: voice_id } map. Never throws → [] on failure,
   *  so the Voice selector can fall back to the browser voice list when empty. */
  getTtsVoices(): Promise<{ id: string; label: string; lang: string }[]>;

  // ---- Home content groups (words / books / subtitles / libraries / documents) ----
  /** User word/vocabulary groups as normalized home cards (GET /query_all_groups, auth). */
  getWordContentGroups(): Promise<WfNewContentGroup[]>;
  /** Ingested book sources as home cards (GET /media/books). Paged (default p1) so
   *  "load more" can fetch only the next fragment; an empty result = exhausted. */
  getBookGroups(page?: number, perPage?: number): Promise<WfNewContentGroup[]>;
  /** Ingested subtitle/movie sources as home cards (GET /media/subtitles). Paged. */
  getSubtitleGroups(page?: number, perPage?: number): Promise<WfNewContentGroup[]>;
  /** PUBLIC vocabulary/word libraries as home cards (GET /vocabulary/libraries). Paged. */
  getLibraryGroups(page?: number, perPage?: number): Promise<WfNewContentGroup[]>;
  /** The user's OWN uploaded documents as home cards (GET /media/documents; empty if unauthed). */
  getDocumentGroups(): Promise<WfNewContentGroup[]>;
  /** All five home categories at once (parallel; partial-tolerant — a failed category resolves to []). */
  getHomeContent(): Promise<WfNewHomeContent>;
  getRecentAgentArticles(limit?: number): Promise<WfNewAgentArticle[]>;

  // ---- Book reading (book -> chapter -> verses) ----
  /** Ordered chapter list for a book (GET /media/books/{key}/chapters). */
  getBookChapters(sourceKey: string): Promise<WfNewBookChapters>;
  /** A page of a book's verses; pass chapterIndex to scope to one chapter. */
  getBookVerses(
    sourceKey: string,
    opts?: { chapterIndex?: number; page?: number; perPage?: number; grain?: string },
  ): Promise<WfNewBookVersesPage>;

  // ---- Subtitle playback + word stats ----
  /** Full detail for one subtitle source (segments + a page of lines) for the player. */
  getSubtitleDetail(
    sourceKey: string,
    opts?: { page?: number; perPage?: number; grain?: string },
  ): Promise<WfNewSubtitleDetail>;
  /** A page of dictionary words (audio + translation) for the word-stats sidebar. */
  getDictionaryWords(
    opts?: { language?: string; start?: number; limit?: number; filter?: string },
  ): Promise<WfNewWordPage>;
  /** A page of one vocabulary library's words (GET /vocabulary/libraries/{id}/words). */
  getLibraryWords(
    libraryId: string,
    opts?: { page?: number; perPage?: number },
  ): Promise<WfNewLibraryWordsPage>;

  // ---- Word media on-demand ----
  /**
   * Resolve (and, file-first, ENQUEUE+prioritize) a word's image/audio + dictionary
   * detail (GET /word/{lang}/{word}/media). Simply calling this triggers backend
   * generation for any missing file; poll it until imageStatus/audioStatus flip to
   * 'ready' and the urls appear. Optional `opts.accent` requests a specific
   * accent rendition ('us' | 'uk', contract D1/C1).
   */
  getWordMedia(
    language: string,
    word: string,
    opts?: { accent?: WfNewWordAccent },
  ): Promise<WfNewWordMedia>;

  /** Resolve sentence-library audio (file-first). On miss, backend bumps priority.
   *  `variantKey` requests a specific accent/voice variant; the response carries
   *  `tts_status` (pending|processing|completed|failed) + `audio_files` variants. */
  resolveSentenceAudio(
    text: string,
    language: string,
    variantKey?: string,
  ): Promise<{ exists: boolean; url?: string | null; queued?: boolean; content_id?: string; hash?: string; tts_status?: string | null; audio_files?: WordNewAudioFileVariant[] }>;

  // ---- Audio prioritization (Laravel owns the queue + worker notification) ----
  /** Raise TTS priority for ONE sentence by content id (POST /ai_tools/tts/sentence/bump). */
  bumpSentenceAudio(
    contentId: string,
    language: string,
  ): Promise<{ success: boolean; priority?: number; error?: string }>;
  /** Raise TTS priority for a batch of visible sentences (POST /ai_tools/tts/sentence/bump-batch). */
  bumpSentenceAudioBatch(
    items: Array<{ text: string; language: string }>,
  ): Promise<{ success: boolean; queued?: number; total?: number; error?: string }>;
  /** Enqueue + prioritize word-audio generation by word text
   *  (POST /ai_tools/tts/queue/batch/add, interactive → front of the audio queue). */
  prioritizeWordAudio(
    words: string[],
    language: string,
  ): Promise<{ success: boolean; queued?: number; error?: string }>;

  // ---- Book reading progress (server-side, auth:sanctum) ----
  getBookReadingProgress(sourceKey: string): Promise<WfNewBookReadingProgress | null>;
  saveBookReadingProgress(
    sourceKey: string,
    payload: { chapterIndex?: number | null; verseSeq: number; grain?: string; page?: number },
  ): Promise<WfNewBookReadingProgress | null>;
  listBookReadingProgress(limit?: number): Promise<WfNewBookReadingProgress[]>;

  /** Guest device reader settings (PUBLIC, fingerprint client_key). */
  getClientDeviceSettings(clientKey: string): Promise<WfNewClientDeviceSettings | null>;
  saveClientDeviceSettings(
    clientKey: string,
    reader: WfNewReaderSettingsBlob,
    updatedAt?: string,
  ): Promise<WfNewClientDeviceSettings | null>;

  /** Add a vocabulary library to the user's Default Vocabulary Group (auth required).
   *  Internally resolves the default group gid via /query_all_groups, then POST /group/add_library.
   *  Returns already_linked: true (with no error) if the library is already in the group. */
  addLibraryToDefaultGroup(libraryId: string | number): Promise<AddLibraryToDefaultGroupResult>;

  /** Non-mutating preview of adding a library to the Default Vocabulary Group:
   *  words already in the group, new words to add, duplicates, and the group's
   *  current read / memorized / due-for-review breakdown. Does not write. */
  previewAddLibraryToDefaultGroup(libraryId: string | number): Promise<PreviewAddLibraryResult>;

  // ---- Learning progress and daily recitation ----
  getGroupProgressBlob(gid: string): Promise<WordNewGroupProgressBlob>;
  updateGroupProgress(payload: WordNewGroupProgressPayload): Promise<any>;
  recitationLog(payload: WordNewRecitationLogPayload): Promise<WordNewRecitationLogResult>;
  recitationTodayPlan(params?: { language?: string; limit?: number }): Promise<WordNewRecitationTodayPlan>;
  recitationSummary(date?: string): Promise<WordNewRecitationSummary>;
  recitationStreak(): Promise<WordNewRecitationStreak>;
}

/** A page of a group's words (page/perPage pagination, with the grand total). */
export interface WordPage {
  words: Word[];
  total: number;
  page: number;
  perPage: number;
}

/**
 * Optional parameters for getGroupWordsPage (POST /group/get_words).
 *   - unread_only: filter to never-read words (rc==0) before paging/slicing.
 *   - limit: cap the returned word count (0 = no cap; shelf passes daily_goal).
 * Cross-stack contract (§5.7): both are included in the POST body when present.
 */
export interface WfNewGroupWordsOpts {
  unread_only?: boolean;
  limit?: number;
}

export interface AddLibraryToDefaultGroupResult {
  gid: string;
  library_id: number;
  library_name: string;
  already_linked: boolean;
  words_added: number;
  total_words_in_library: number;
}

export interface PreviewAddLibraryResult {
  gid: string;
  library_id: number;
  library_name: string;
  already_linked: boolean;
  current_in_group: number;
  library_total: number;
  to_add: number;
  projected_total: number;
  duplicates: Array<{ word_id: number; word: string }>;
  duplicates_count: number;
  language_match: boolean;
  status_breakdown: { read: number; memorized: number; due: number; total: number };
}
