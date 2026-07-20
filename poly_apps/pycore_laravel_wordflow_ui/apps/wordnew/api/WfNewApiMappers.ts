/** WfNewApiMappers - pure response mappers + the absUrl media resolver,
 * extracted from WfNewApiHttp so the http impl stays under the 800-line modular
 * limit. Each function maps a raw backend row to a normalized app type; absUrl
 * rebases a backend-relative media path onto the current endpoint base. */
import { wfNewEndpoints } from './WfNewEndpoints';
import { authedGetJSON } from './WfNewApiTransport';
import { WfNewApiPaths } from './WfNewApiPaths';
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
import type { Word, WordGroup, BentoGroup, WfNewContentGroup, WfNewContentKind } from './WfNewApiTypes';
import { primaryCoverUrl, resolveCoverUrls } from '../constants/coverPlayback';

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
      const files = Array.isArray(v?.audio_files)
        ? v.audio_files.map((f: any) => ({
          variantKey: f?.variant_key ?? '',
          accent: f?.accent ?? undefined,
          gender: f?.gender ?? undefined,
          source: f?.source ?? undefined,
          voiceType: f?.voice_type ?? undefined,
          provider: f?.provider ?? undefined,
          path: f?.path ?? undefined,
          hasFile: f?.has_file != null ? !!f.has_file : undefined,
          url: absUrl(f?.url) ?? undefined,
        }))
        : undefined;
      const hasFileReady = !!(files?.some((f) => f.hasFile && f.url));
      languages[lang] = {
        text: v?.text ?? null,
        audio,
        hasAudio: v?.has_audio != null ? !!v.has_audio : !!(audio || hasFileReady),
        ttsStatus: v?.tts_status ?? null,
        audioFiles: files,
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

// --- mappers --------------------------------------------------------------- #

/** Normalize a backend word record into the shared Word shape. */
export function toWord(raw: any, i = 0): Word {
  return {
    id: String(raw?.id ?? raw?.word_id ?? raw?.word ?? `w-${i}`),
    text: raw?.text ?? raw?.word ?? '',
    phonetic: raw?.phonetic ?? raw?.phonetics ?? '',
    translation: raw?.translation ?? raw?.meaning ?? raw?.definition_zh ?? '',
    definition: raw?.definition ?? undefined,
    example: raw?.example ?? raw?.example_sentence ?? undefined,
    exampleTranslation: raw?.exampleTranslation ?? raw?.example_translation ?? undefined,
    masteryLevel: typeof raw?.masteryLevel === 'number' ? raw.masteryLevel
      : typeof raw?.mastery_level === 'number' ? raw.mastery_level : undefined,
    wordType: raw?.wordType ?? raw?.word_type ?? raw?.pos ?? undefined,
    tags: Array.isArray(raw?.tags) ? raw.tags : undefined,
    // ABSOLUTE-ize the primary audio path (rebased onto the current endpoint) so a
    // real MP3 plays instead of the speechSynthesis fallback. Same for each variant.
    audioUrl: absUrl(raw?.audioUrl ?? raw?.audio_url) ?? undefined,
    audioFiles: Array.isArray(raw?.audio_files)
      ? raw.audio_files.map((f: any) => ({ url: absUrl(f?.url), voice: f?.voice ?? '', lang: f?.lang ?? '' }))
      : undefined,
    audioCount: Number(raw?.audio_count ?? (raw?.audio_files?.length ?? 0)) || 0,
    hasTranslation: raw?.has_translation != null
      ? !!raw.has_translation
      : !!(raw?.translation ?? raw?.meaning ?? raw?.definition_zh),
  };
}

/** Normalize a backend group record into the shared WordGroup shape. */
export function toGroup(raw: any, i = 0): WordGroup {
  return {
    id: String(raw?.id ?? raw?.gid ?? `g-${i}`),
    name: raw?.name ?? raw?.gname ?? 'Untitled',
    count: Number(raw?.count ?? raw?.total_words ?? 0) || 0,
    progress: Number(raw?.progress ?? 0) || 0,
    type: raw?.type ?? undefined,
    language: raw?.language ?? 'en',
    description: raw?.description ?? undefined,
  };
}

/** Decorative carousel applied to live groups so the bento grid still varies. */
export const BENTO_DECOR: Array<Pick<BentoGroup,
  'gridSpan' | 'bgGradient' | 'bgGradientDark' | 'decorColor' | 'decorativeSvg'>> = [
  { gridSpan: 'md:col-span-2 md:row-span-2 h-[340px]', bgGradient: 'from-purple-100/70 via-indigo-50/50 to-indigo-100/70', bgGradientDark: 'from-violet-950/20 via-slate-900/40 to-indigo-950/20', decorColor: 'text-indigo-400 dark:text-purple-400', decorativeSvg: 'nebula' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-emerald-50/70 to-teal-100/70', bgGradientDark: 'from-emerald-950/15 to-slate-900/40', decorColor: 'text-teal-400 dark:text-emerald-400', decorativeSvg: 'matrix' },
  { gridSpan: 'md:col-span-1 md:row-span-2 h-[345px]', bgGradient: 'from-rose-100/70 via-pink-50/50 to-orange-100/70', bgGradientDark: 'from-rose-950/15 via-slate-900/40 to-amber-950/15', decorColor: 'text-rose-400 dark:text-orange-400', decorativeSvg: 'stars' },
  { gridSpan: 'md:col-span-2 md:row-span-1 h-[160px]', bgGradient: 'from-blue-50/70 to-indigo-100/70', bgGradientDark: 'from-blue-950/15 to-slate-900/40', decorColor: 'text-blue-400 dark:text-sky-400', decorativeSvg: 'waves' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-amber-50/70 to-orange-100/70', bgGradientDark: 'from-orange-950/15 to-slate-900/40', decorColor: 'text-yellow-500 dark:text-amber-400', decorativeSvg: 'rings' },
  { gridSpan: 'md:col-span-1 md:row-span-1 h-[160px]', bgGradient: 'from-violet-50/70 to-fuchsia-100/70', bgGradientDark: 'from-fuchsia-950/15 to-slate-900/40', decorColor: 'text-fuchsia-400', decorativeSvg: 'bars' },
];

export function decorate(g: WordGroup, i: number): BentoGroup {
  const d = BENTO_DECOR[i % BENTO_DECOR.length];
  return { ...g, badge: g.type ? `★ ${g.type}` : '★ Pack', statsLabel: 'Synaptic Link Active', ...d };
}

/** Unwrap the various list shapes the backend returns. */
export function asArray(res: any, ...keys: string[]): any[] {
  if (Array.isArray(res)) return res;
  for (const k of keys) if (Array.isArray(res?.[k])) return res[k];
  return [];
}

export let contentFallbackLogged = false;
export function logContentFallback(): void {
  if (!contentFallbackLogged) {
    contentFallbackLogged = true;
    console.info('[WfNewApiHttp] search / subtitles / bilingual / analytics have no backend endpoint yet — using local content.');
  }
}

// --- home content-group mappers -------------------------------------------- #
// Normalize the THREE distinct backend list shapes (word groups / media sources /
// vocabulary libraries) into the single WfNewContentGroup the home widget renders.

/** Resolve a possibly-relative backend cover path to an absolute URL (host = current endpoint). */
export function toAbsoluteUrl(url?: string | null): string | undefined {
  if (!url || typeof url !== 'string') return undefined;
  if (/^(https?:|data:)/i.test(url)) return url;          // already absolute
  const base = wfNewEndpoints.getCurrentBaseUrl();          // e.g. http://host:9000
  if (!base) return url;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

/** query_all_groups row → WfNewContentGroup (kind 'word'; carries the group cover when present). */
export function wordRowToContentGroup(raw: any, i = 0): WfNewContentGroup {
  const absUrls = resolveCoverUrls(
    absUrl(raw?.cover_url ?? raw?.thumbnail_url ?? raw?.cover_image),
    Array.isArray(raw?.cover_urls) ? raw.cover_urls.map((u: string) => absUrl(u) || u) : undefined,
  );
  return {
    id: String(raw?.gid ?? raw?.id ?? `word-${i}`),
    kind: 'word',
    title: raw?.gname ?? raw?.name ?? 'Untitled',
    count: Number(raw?.total_words ?? raw?.count ?? 0) || 0,
    countUnit: 'words',
    language: raw?.language ?? 'en',
    imageUrl: primaryCoverUrl(absUrls),
    imageUrls: absUrls.length ? absUrls : undefined,
    category: raw?.cover_category ?? raw?.type ?? undefined,
    description: raw?.description ?? undefined,
  };
}

/** /media/{books|subtitles} row → WfNewContentGroup. `count` follows the kind. */
export function mediaRowToContentGroup(raw: any, kind: 'book' | 'subtitle', i = 0): WfNewContentGroup {
  const count = kind === 'subtitle'
    ? Number(raw?.subtitle_count ?? raw?.sentence_count ?? 0) || 0
    : Number(raw?.sentence_count ?? 0) || 0;
  const absUrls = resolveCoverUrls(
    absUrl(raw?.image_url),
    Array.isArray(raw?.image_urls) ? raw.image_urls.map((u: string) => absUrl(u) || u) : undefined,
  );
  return {
    id: String(raw?.id ?? raw?.source_key ?? `${kind}-${i}`),
    kind,
    title: raw?.title ?? raw?.original_name ?? raw?.ascii_name ?? 'Untitled',
    count,
    countUnit: kind === 'subtitle' ? 'subtitles' : 'sentences',
    language: raw?.language ?? undefined,
    imageUrl: primaryCoverUrl(absUrls),
    imageUrls: absUrls.length ? absUrls : undefined,
    sourceKey: raw?.source_key ? String(raw.source_key) : undefined,
    description: undefined,
  };
}

/** /vocabulary/libraries row → WfNewContentGroup (kind 'library' — a public word library). */
export function libraryRowToContentGroup(raw: any, i = 0): WfNewContentGroup {
  return {
    id: String(raw?.id ?? `lib-${i}`),
    kind: 'library',
    title: raw?.name ?? 'Untitled',
    count: Number(raw?.word_count ?? 0) || 0,
    countUnit: 'words',
    language: raw?.language ?? undefined,
    imageUrl: toAbsoluteUrl(raw?.image_url),
    category: raw?.category ?? raw?.difficulty ?? undefined,
    description: raw?.description ?? undefined,
  };
}

/** /media/documents row → WfNewContentGroup (kind 'document' — the user's own upload). */
export function documentRowToContentGroup(raw: any, i = 0): WfNewContentGroup {
  return {
    id: String(raw?.id ?? `doc-${i}`),
    kind: 'document',
    title: raw?.title ?? raw?.original_name ?? 'Untitled',
    count: Number(raw?.word_count ?? 0) || 0,
    countUnit: 'words',
    language: raw?.language ?? undefined,
    category: undefined,
    description: undefined,
  };
}


/** Fetch user's word groups (auth-required, no token -> []). Moved from WfNewApiHttp. */
export async function fetchGroups(): Promise<any[]> {
  const res = await authedGetJSON<any>(WfNewApiPaths.queryAllGroups, null);
  return asArray(res, 'groups').map(toGroup);
}
