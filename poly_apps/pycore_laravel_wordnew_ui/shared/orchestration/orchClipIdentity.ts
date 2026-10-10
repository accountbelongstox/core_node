/**
 * One identity for an orchestration clip on every end, and the path forms it
 * has there. The identities are the ones pycore and Laravel already compute:
 *
 *   contentId  = md5(collapse_ws(lower(strip P/S categories)))       sentences, phrases
 *                (pycore `media_content_id`, Laravel `MediaIngestService`)
 *   resourceId = sha256("<kind>:<language>:<content>")                 pycore `resource_id`
 *                content = contentId (sentence, phrase) | trimmed lower-case word
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
/** Laravel's public sentence file `<language>/<content id>.mp3` (the default voice; a `_variant` file is another audio). */
const SENTENCE_FILE_RE = /\/static\/app_qy_v1\/sentence_sounds\/([A-Za-z0-9-]+)\/([0-9a-f]{32})\.mp3$/i;
/** Laravel's public phrase file `<language>/<content id>.mp3`. */
const PHRASE_FILE_RE = /\/static\/app_qy_v1\/phrase_sounds\/([A-Za-z0-9-]+)\/([0-9a-f]{32})\.mp3$/i;
/** Kinds whose content is the md5 content id of their text. */
const HASHED_KINDS: readonly OrchResourceKind[] = ['sentence', 'phrase'];

/** Directory of the clip store inside any storage root (same on every end). */
export const ORCH_CLIP_DIR = 'orch-clips';
export const ORCH_CLIP_EXTENSION = '.mp3';

export interface OrchClipIdentity {
  kind: OrchResourceKind;
  language: string;
  text: string;
  /** md5 content id (sentences, phrases); the normalized word for words. */
  contentId: string;
  /** pycore resource id: the store key on every end. */
  resourceId: string;
}

/** pycore / Laravel `media_content_id`. */
export function orchContentId(text: string): string {
  return md5Hex(text.replace(PUNCTUATION_RE, ' ').toLowerCase().replace(WHITESPACE_RE, ' ').trim());
}

export function orchClipIdentity(kind: OrchResourceKind, language: string, text: string): OrchClipIdentity {
  const contentId = HASHED_KINDS.includes(kind) ? orchContentId(text) : text.trim().toLowerCase();
  return { kind, language, text, contentId, resourceId: sha256Hex(`${kind}:${language}:${contentId}`) };
}

/** What a caller knows about a clip (its kind, language and text); the identity follows from it. */
export type OrchClipRef = Pick<OrchClipIdentity, 'kind' | 'language' | 'text'>;

/** Whether the ref can name a clip (a clip without text or language has no identity). */
export const orchClipRefUsable = (ref: OrchClipRef | null | undefined): ref is OrchClipRef =>
  !!ref && ref.text.trim() !== '' && ref.language.trim() !== '';

export const orchClipRefIdentity = (ref: OrchClipRef): OrchClipIdentity => orchClipIdentity(ref.kind, ref.language, ref.text.trim());

/**
 * The identity a clip URL proves by itself: a Laravel sentence / phrase file URL names its language and content id,
 * so the resource id follows without the text (the identity text stays empty). Word file URLs carry a voice hash,
 * not the word, and accent / quality variants are other audio than the orchestration clip: those give null.
 */
export function orchClipIdentityOfUrl(url: string): OrchClipIdentity | null {
  const path = url.split(/[?#]/, 1)[0];
  const sentence = SENTENCE_FILE_RE.exec(path);
  const phrase = sentence ? null : PHRASE_FILE_RE.exec(path);
  const match = sentence ?? phrase;
  if (!match) return null;
  const kind: OrchResourceKind = sentence ? 'sentence' : 'phrase';
  const language = match[1].toLowerCase();
  const contentId = match[2].toLowerCase();
  return { kind, language, text: '', contentId, resourceId: sha256Hex(`${kind}:${language}:${contentId}`) };
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
  const textRoute = kind === 'sentence' ? APPQYV1_AI_TOOLS_ROUTES.ttsSentenceAudio : kind === 'phrase' ? APPQYV1_AI_TOOLS_ROUTES.ttsPhraseAudio : null;
  const laravelPath = textRoute
    ? `${APPQYV1_API_BASE}${textRoute}?${new URLSearchParams({ text, language, passive: '1' })}`
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
