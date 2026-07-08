/** WfNewApiMappers - pure response mappers + the absUrl media resolver,
 * extracted from WfNewApiHttp so the http impl stays under the 800-line modular
 * limit. Each function maps a raw backend row to a normalized app type; absUrl
 * rebases a backend-relative media path onto the current endpoint base. */
import { wfNewEndpoints } from './WfNewEndpoints';
import type {
  WfNewBookVerse,
  WfNewBookVerseLang,
  WfNewPresenceStatus,
  WfNewMessage,
  WfNewNotification,
  WfNewSocialActor,
  WfNewPostImage,
  WfNewPost,
  WfNewPostType,
  WfNewPostVisibility,
  WfNewPostComment,
  WfNewLive,
  WfNewLiveStatus,
  WfNewLiveMsg,
} from './WfNewApiTypes';

/** Resolve a backend-relative media/cover path to an absolute URL on the current endpoint. */
export function absUrl(u?: string): string | undefined {
  if (!u || typeof u !== 'string') return undefined;
  if (/^https?:\/\//i.test(u) || u.startsWith('data:')) return u;
  return wfNewEndpoints.buildUrl(u.startsWith('/') ? u : `/${u}`);
}

/** Map a backend bookDetail sentence row to a normalized WfNewBookVerse. Each
 *  per-language cell carries text + audio + the has_audio flag + optional
 *  explanation (audio is filled over time by the pycore sentence-TTS worker). */
export function toBookVerse(s: any): WfNewBookVerse {
  const languages: Record<string, WfNewBookVerseLang> = {};
  if (s && s.languages && typeof s.languages === 'object') {
    for (const [lang, v] of Object.entries<any>(s.languages)) {
      const audio = absUrl(v?.audio) ?? null;
      languages[lang] = {
        text: v?.text ?? null,
        audio,
        hasAudio: v?.has_audio != null ? !!v.has_audio : !!audio,
        explanation: v?.explanation ?? null,
      };
    }
  }
  return {
    grain: String(s?.grain ?? 'sentence'),
    seq: Number(s?.seq ?? 0),
    chapterIndex: s?.chapter_index !== undefined && s?.chapter_index !== null ? Number(s.chapter_index) : undefined,
    ref: s?.ref ?? null,
    book: s?.book ?? null,
    text: s?.text ?? null,
    language: s?.language ?? null,
    audio: absUrl(s?.audio) ?? null,
    corrId: s?.corr_id ?? undefined,
    languages: Object.keys(languages).length ? languages : undefined,
  };
}

/** Clamp any backend presence string to the 4 allowed values (default offline). */
export function normPresence(s: any): WfNewPresenceStatus {
  return (s === 'online' || s === 'away' || s === 'studying' || s === 'offline') ? s : 'offline';
}

/** Map a backend message row → WfNewMessage. */
export function toMessage(m: any): WfNewMessage {
  return {
    id: Number(m?.id ?? 0),
    conversation_id: Number(m?.conversation_id ?? 0),
    sender_id: Number(m?.sender_id ?? 0),
    body: m?.body ?? '',
    type: (m?.type === 'image' || m?.type === 'voice') ? m.type : 'text',
    metadata: m?.metadata && typeof m.metadata === 'object' ? m.metadata : null,
    created_at: m?.created_at ?? new Date().toISOString(),
  };
}

/** Map a backend notification row → WfNewNotification. */
export function toNotification(n: any): WfNewNotification {
  return {
    id: Number(n?.id ?? 0),
    type: n?.type ?? '',
    payload: n?.payload && typeof n.payload === 'object' ? n.payload : null,
    read_at: n?.read_at ?? null,
    created_at: n?.created_at ?? new Date().toISOString(),
  };
}

// --- Social Center mappers (posts / comments / live) ----------------------- #
// Image/video/cover urls are ROOT-RELATIVE from the backend — absUrl() them here
// so components can render directly (mediaUrl() in the UI is then a no-op).

/** Map a backend actor block → WfNewSocialActor. avatar_url is left as-is for
 *  emoji avatars; mediaUrl() in the UI rebases a root-relative path. */
export function toActor(a: any): WfNewSocialActor {
  return {
    id: Number(a?.id ?? 0),
    name: a?.name ?? a?.nickname ?? a?.username ?? '',
    avatar_url: a?.avatar_url ?? a?.avatar ?? '',
  };
}

export function toPostImage(im: any, i = 0): WfNewPostImage {
  return {
    id: Number(im?.id ?? i),
    url: absUrl(im?.url) ?? (im?.url ?? ''),
    caption: im?.caption ?? null,
    sequence: Number(im?.sequence ?? i),
  };
}

/** Map a backend post row → WfNewPost (media urls resolved to absolute). */
export function toPost(raw: any, i = 0): WfNewPost {
  const post_type: WfNewPostType =
    (raw?.post_type === 'images' || raw?.post_type === 'video' || raw?.post_type === 'live')
      ? raw.post_type : 'text';
  const visibility: WfNewPostVisibility =
    (raw?.visibility === 'friends' || raw?.visibility === 'private') ? raw.visibility : 'public';
  const images = Array.isArray(raw?.images) ? raw.images.map(toPostImage) : [];
  return {
    id: Number(raw?.id ?? i),
    author: toActor(raw?.author ?? {}),
    content: raw?.content ?? '',
    post_type,
    images,
    video_url: absUrl(raw?.video_url) ?? (raw?.video_url ?? null),
    external_url: raw?.external_url ?? null,
    cover_url: absUrl(raw?.cover_url) ?? (raw?.cover_url ?? null),
    like_count: Number(raw?.like_count ?? 0) || 0,
    comment_count: Number(raw?.comment_count ?? 0) || 0,
    liked_by_me: !!raw?.liked_by_me,
    visibility,
    created_at: raw?.created_at ?? new Date().toISOString(),
  };
}

export function toComment(raw: any, i = 0): WfNewPostComment {
  return {
    id: Number(raw?.id ?? i),
    post_id: Number(raw?.post_id ?? 0),
    parent_id: raw?.parent_id != null ? Number(raw.parent_id) : null,
    author: toActor(raw?.author ?? {}),
    body: raw?.body ?? '',
    created_at: raw?.created_at ?? new Date().toISOString(),
  };
}

export function toLive(raw: any, i = 0): WfNewLive {
  const status: WfNewLiveStatus =
    (raw?.status === 'ended' || raw?.status === 'scheduled') ? raw.status : 'live';
  return {
    id: Number(raw?.id ?? i),
    host: toActor(raw?.host ?? {}),
    title: raw?.title ?? '',
    description: raw?.description ?? null,
    status,
    external_url: raw?.external_url ?? null,
    cover_url: absUrl(raw?.cover_url) ?? (raw?.cover_url ?? null),
    viewer_count: Number(raw?.viewer_count ?? 0) || 0,
    started_at: raw?.started_at ?? null,
  };
}

export function toLiveMsg(raw: any, i = 0): WfNewLiveMsg {
  return {
    id: Number(raw?.id ?? i),
    user: toActor(raw?.user ?? {}),
    body: raw?.body ?? '',
    created_at: raw?.created_at ?? new Date().toISOString(),
  };
}
