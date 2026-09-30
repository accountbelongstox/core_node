/**
 * One identity for an orchestration clip on every end, and the path forms it
 * has there. The identities are the ones pycore and Laravel already compute:
 *
 *   contentId  = md5(collapse_ws(lower(strip P/S categories)))       sentences
 *                (pycore `media_content_id`, Laravel `MediaIngestService`)
 *   resourceId = sha256("<kind>:<language>:<content>")                 pycore `resource_id`
 *                content = contentId (sentence) | trimmed lower-case word
 *
 * The device store names a clip by its resourceId, so a clip copied between
 * pycore, Laravel and a phone keeps one name, and the same composition code
 * finds it wherever it runs.
 */
import { md5Hex, sha256Hex } from '../../core/utils/contentHash';
import {
  APPQYV1_AI_TOOLS_ROUTES,
  APPQYV1_API_BASE,
  APPQYV1_WORD_MEDIA_ROUTES,
} from '../../core/contracts/AppQyV1AiToolsContract';
import { PYCORE_HTTP_ROUTES } from '../../core/integrations/pycore/PycoreHttpRoutes';
import type { OrchResourceKind } from '../../core/integrations/pycore';

const PUNCTUATION_RE = /[\p{P}\p{S}]/gu;
const WHITESPACE_RE = /\s+/g;

/** Directory of the clip store inside any storage root (same on every end). */
export const ORCH_CLIP_DIR = 'orch-clips';
export const ORCH_CLIP_EXTENSION = '.mp3';

export interface OrchClipIdentity {
  kind: OrchResourceKind;
  language: string;
  text: string;
  /** md5 content id (sentences); the normalized word for words. */
  contentId: string;
  /** pycore resource id: the store key on every end. */
  resourceId: string;
}

/** pycore / Laravel `media_content_id`. */
export function orchContentId(text: string): string {
  return md5Hex(text.replace(PUNCTUATION_RE, ' ').toLowerCase().replace(WHITESPACE_RE, ' ').trim());
}

export function orchClipIdentity(kind: OrchResourceKind, language: string, text: string): OrchClipIdentity {
  const contentId = kind === 'sentence' ? orchContentId(text) : text.trim().toLowerCase();
  return { kind, language, text, contentId, resourceId: sha256Hex(`${kind}:${language}:${contentId}`) };
}

export interface OrchClipLocations {
  /** pycore: the content-addressed lookup / chunk routes and their parameters. */
  pycore: { lookupRoute: string; chunkRoute: string; params: { kind: OrchResourceKind; language: string; text: string } };
  /** Laravel: the passive (read-only) audio route, relative to the API origin. */
  laravel: { path: string };
  /** Any end's clip store: path relative to its storage root. */
  store: { path: string };
}

/** Every path form of one clip; a caller joins them with its own origin / root. */
export function orchClipLocations(identity: OrchClipIdentity): OrchClipLocations {
  const { kind, language, text } = identity;
  const laravelPath = kind === 'sentence'
    ? `${APPQYV1_API_BASE}${APPQYV1_AI_TOOLS_ROUTES.ttsSentenceAudio}?${new URLSearchParams({ text, language, passive: '1' })}`
    : `${APPQYV1_API_BASE}${APPQYV1_WORD_MEDIA_ROUTES.wordAudio(language, identity.contentId)}?passive=1`;
  return {
    pycore: {
      lookupRoute: PYCORE_HTTP_ROUTES.audioOrchResourceLookup,
      chunkRoute: PYCORE_HTTP_ROUTES.audioOrchResourceChunk,
      params: { kind, language, text },
    },
    laravel: { path: laravelPath },
    store: { path: `${ORCH_CLIP_DIR}/${identity.resourceId}${ORCH_CLIP_EXTENSION}` },
  };
}
