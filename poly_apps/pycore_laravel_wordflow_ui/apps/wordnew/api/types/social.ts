/** types/social.ts - social center types: friends, posts, comments, live, conversations, notifications, presence. (extracted from WfNewApiTypes to keep each
 * source file under the 800-line modular limit; re-exported by the barrel). */
/** A followed user (GET /social/friends → data.friends). */
export interface WfNewFriend {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  /** presenceStatus: e.g. 'online' | 'studying' | 'offline'. */
  status: string;
  followed_at?: string | null;
  stats?: WfNewSocialStats;
}

/** A user-search hit (GET /social/friends/search → data.users). */
export interface WfNewUserSearchResult {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  status: string;
  is_following: boolean;
}

/** A leaderboard row (GET /social/leaderboard → data.leaderboard; stats merged in). */
export interface WfNewLeaderboardEntry {
  user_id: number;
  username: string;
  name: string;
  avatar_url: string;
  xp: number;
  rank: number;
  is_current_user: boolean;
  [k: string]: any;
}

/** A followed user's recent activity (GET /social/activities → data.activities). */
export interface WfNewActivity {
  id: string;
  user_id: number;
  user_name: string;
  avatar_url: string;
  action?: string;
  learned_count?: number;
  mastered_count?: number;
  time?: string;
  [k: string]: any;
}

// ---- Social v2: discover / friend-requests / chat / presence / notifications ----
// Backend-aligned shapes (SOCIAL_FEATURE_SPECIFICATION.md §3). Every list endpoint
// wraps its rows under data.{users|requests|conversations|messages|notifications}.

/** Effective presence status (user_presence; >60s since last_seen ⇒ 'offline'). */
export type WfNewPresenceStatus = 'online' | 'away' | 'studying' | 'offline';

/** A language-match candidate (GET /social/discover → data.users). `match` ranks
 *  the language fit: 'exchange' (mutual native↔target) > 'native' > 'target'. */
export interface WfNewDiscoverUser {
  id: number;
  nickname: string;
  avatar: string;
  native_language: string;
  learning_languages: string[];
  is_following: boolean;
  is_friend: boolean;
  match: 'exchange' | 'native' | 'target';
  /** Effective presence at discovery time (seeds the partner-card dot). */
  presence?: WfNewPresenceStatus;
  stats?: WfNewSocialStats;
}

/** A pending friend request (GET /social/friends/requests → data.requests). */
export interface WfNewFriendRequest {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  /** The OTHER party's display fields (backend joins the user row). */
  username?: string;
  name?: string;
  avatar_url?: string;
  created_at?: string;
}

/** A 1:1 (or group) conversation (GET /social/conversations → data.conversations). */
export interface WfNewConversation {
  id: number;
  type: 'direct' | 'group';
  /** The other participant for a direct conversation. */
  peer: {
    id: number;
    nickname: string;
    avatar: string;
    /** Effective presence of the peer. */
    presence: WfNewPresenceStatus;
  };
  last_message?: string | null;
  unread_count: number;
  last_message_at?: string | null;
}

/** One chat message (GET /social/conversations/{id}/messages → data.messages). */
export interface WfNewMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  type: 'text' | 'image' | 'voice';
  metadata?: Record<string, any> | null;
  created_at: string;
}

/** A page of messages (id-ASC after cursor). */
export interface WfNewMessagePage {
  messages: WfNewMessage[];
  /** Pass back as `cursor` to fetch the next (older→newer) page; null when caught up. */
  next_cursor: number | null;
}

/** A per-user notification (GET /social/notifications → data.notifications). */
export interface WfNewNotification {
  id: number;
  type: string;
  payload?: Record<string, any> | null;
  read_at?: string | null;
  created_at: string;
}

/** A page of notifications (id-DESC, cursor-paginated). */
export interface WfNewNotificationPage {
  notifications: WfNewNotification[];
  next_cursor: number | null;
}

/** Batch presence read (GET /social/presence?user_ids=). */
export interface WfNewPresenceInfo {
  status: WfNewPresenceStatus;
  last_seen_at?: string | null;
}

// ---- Social Center: posts / comments / live ------------------------------- #
// Backend-aligned shapes (AppQyV1 /social/posts + /social/live). Image/video/cover
// urls are ROOT-RELATIVE ('/static/...') from the backend — always wrap with
// mediaUrl() before rendering. The author/host/user blocks carry the same
// {id,name,avatar_url} shape; avatar_url may be an emoji or a relative path.

/** A post author / live host / live-chat sender. */
export interface WfNewSocialActor {
  id: number;
  name: string;
  /** Emoji OR a (possibly root-relative) avatar URL — mediaUrl() it before rendering. */
  avatar_url: string;
}

/** One image attached to a post (root-relative url; mediaUrl() before render). */
export interface WfNewPostImage {
  id: number;
  url: string;
  caption?: string | null;
  sequence: number;
}

/** What kind of post this is (drives which media block renders). */
export type WfNewPostType = 'text' | 'images' | 'video' | 'live';

/** Plaza-feed visibility. */
export type WfNewPostVisibility = 'public' | 'friends' | 'private';

/** Feed filter (Plaza / Gallery / Video reuse this). */
export type WfNewPostFilter = 'all' | 'images' | 'videos' | 'following';

/** One timeline post (GET /social/posts → data.items[]). */
export interface WfNewPost {
  id: number;
  author: WfNewSocialActor;
  content: string;
  post_type: WfNewPostType;
  images: WfNewPostImage[];
  /** Root-relative uploaded clip url (video posts); mediaUrl() before render. */
  video_url?: string | null;
  /** External embed url (youtube/bilibili/vimeo or a live stream). */
  external_url?: string | null;
  /** Root-relative cover/poster; mediaUrl() before render. */
  cover_url?: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  visibility: WfNewPostVisibility;
  created_at: string;
}

/** A page of posts (cursor-paginated; next_cursor null when caught up). */
export interface WfNewPostPage {
  items: WfNewPost[];
  next_cursor: number | null;
}

/** One post comment (GET /social/posts/{id}/comments → data.items[]). */
export interface WfNewPostComment {
  id: number;
  post_id: number;
  parent_id?: number | null;
  author: WfNewSocialActor;
  body: string;
  created_at: string;
}

/** A page of comments (cursor-paginated). */
export interface WfNewPostCommentPage {
  items: WfNewPostComment[];
  next_cursor: number | null;
}

/** Result of a like / unlike toggle. */
export interface WfNewPostLikeResult {
  like_count: number;
  liked_by_me: boolean;
}

/** Create-post payload (text/images/video/live). */
export interface WfNewCreatePostPayload {
  content?: string;
  post_type: WfNewPostType;
  external_url?: string;
  visibility?: WfNewPostVisibility;
}

/** A live session (GET /social/live → data.items[]). */
export type WfNewLiveStatus = 'live' | 'ended' | 'scheduled';

export interface WfNewLive {
  id: number;
  host: WfNewSocialActor;
  title: string;
  description?: string | null;
  status: WfNewLiveStatus;
  /** External stream embed url (youtube/bilibili/vimeo/...) — iframe it. */
  external_url?: string | null;
  /** Root-relative cover; mediaUrl() before render. */
  cover_url?: string | null;
  viewer_count: number;
  started_at?: string | null;
}

/** Create-live payload. */
export interface WfNewCreateLivePayload {
  title: string;
  description?: string;
  external_url?: string;
}

/** One live-room chat message (GET /social/live/{id}/chat → data.items[]). */
export interface WfNewLiveMsg {
  id: number;
  user: WfNewSocialActor;
  body: string;
  created_at: string;
}

/** A page of live-chat messages (cursor-paginated, id-ASC after cursor). */
export interface WfNewLiveMsgPage {
  items: WfNewLiveMsg[];
  next_cursor: number | null;
}

// ---- Interactive subtitles ------------------------------------------------
