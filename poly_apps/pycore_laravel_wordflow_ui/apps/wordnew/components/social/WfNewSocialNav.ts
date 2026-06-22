/**
 * WfNewSocialNav — the shared route model for the Social Center sub-router.
 *
 * The Social Center is a self-contained nested router living inside the `social`
 * dock tab. WfNewSocial.tsx owns the active route + a back-stack and syncs it to
 * the hash (`#/social`, `#/social/<page>`, `#/social/<page>/<param>`) via
 * history.replaceState. WfNewApp's hash parser maps `#/social/...` → activeTab
 * 'social' and passes the remaining segments here as the initial route.
 */

/** Every page in the social sub-router. Detail pages carry a `param` (an id). */
export type WfNewSocialPage =
  | 'hub'
  | 'plaza'
  | 'post'          // post detail (param = post id)
  | 'compose'
  | 'gallery'
  | 'video'         // clip/embed feed
  | 'video-player'  // dedicated player (param = post id)
  | 'live'          // live session list
  | 'live-room'     // live viewer (param = live id)
  | 'chat'          // conversation list
  | 'chat-room'     // 1:1 thread (param = conversation id)
  | 'partners'
  | 'leaderboard'
  | 'notifications'
  | 'user';         // user profile (param = user id)

/** A resolved social route: the page + an optional string param (an id). */
export interface WfNewSocialRoute {
  page: WfNewSocialPage;
  param?: string;
}

/** The set of page tokens that are valid as the FIRST hash segment after social. */
const PAGE_TOKENS: WfNewSocialPage[] = [
  'hub', 'plaza', 'post', 'compose', 'gallery', 'video', 'live', 'chat',
  'partners', 'leaderboard', 'notifications', 'user',
];

/**
 * Parse the hash segments AFTER `social` into a route. Examples:
 *   []                 → { page: 'hub' }
 *   ['plaza']          → { page: 'plaza' }
 *   ['post','12']      → { page: 'post', param: '12' }
 *   ['video','12']     → { page: 'video-player', param: '12' }  (param promotes to detail)
 *   ['live','3']       → { page: 'live-room', param: '3' }
 *   ['chat','5']       → { page: 'chat-room', param: '5' }
 *   ['user','9']       → { page: 'user', param: '9' }
 */
export function parseSocialSegments(segments: string[]): WfNewSocialRoute {
  const [rawPage, rawParam] = segments;
  if (!rawPage) return { page: 'hub' };
  const token = PAGE_TOKENS.includes(rawPage as WfNewSocialPage) ? (rawPage as WfNewSocialPage) : 'hub';
  const param = rawParam ? decodeURIComponent(rawParam) : undefined;
  // A trailing id promotes list pages to their detail variant.
  if (param) {
    if (token === 'video') return { page: 'video-player', param };
    if (token === 'live') return { page: 'live-room', param };
    if (token === 'chat') return { page: 'chat-room', param };
    if (token === 'post' || token === 'user') return { page: token, param };
  }
  return { page: token };
}

/** Serialize a route back into a hash STRING (without the `#/social` prefix). */
export function socialRouteToHashTail(route: WfNewSocialRoute): string {
  const { page, param } = route;
  if (page === 'hub') return '';
  // Detail pages collapse back to their list token + id.
  if (page === 'video-player') return param ? `/video/${encodeURIComponent(param)}` : '/video';
  if (page === 'live-room') return param ? `/live/${encodeURIComponent(param)}` : '/live';
  if (page === 'chat-room') return param ? `/chat/${encodeURIComponent(param)}` : '/chat';
  if ((page === 'post' || page === 'user') && param) return `/${page}/${encodeURIComponent(param)}`;
  return `/${page}`;
}

/** True when two routes are the same page + param (avoid redundant history writes). */
export function sameSocialRoute(a: WfNewSocialRoute, b: WfNewSocialRoute): boolean {
  return a.page === b.page && (a.param ?? '') === (b.param ?? '');
}
