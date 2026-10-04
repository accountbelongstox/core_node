/**
 * Content-addressed clip access of the pycore audio caches: which word /
 * sentence clips pycore already holds, and their bytes. The same central caches
 * back pycore's own orchestration, so a client resolves from them first.
 *   - bundle (fastest): many clips in one framed binary response
 *     (contract transfer.pycore_bundle_frame);
 *   - file: one clip raw (static delivery, ETag);
 *   - lookup + chunk: the JSON / base64 path of older pycore builds.
 */
import { AUDIO_ORCH_TRANSFER } from '../../contracts/AudioOrchestrationContract';
import {
  requestPycoreHttp,
  requestPycoreHttpBinary,
  requestPycoreHttpBinaryPost,
  PYCORE_HTTP_ROUTES,
} from './PycoreApiTransport';
import {
  orchReadChunkedFile,
  type OrchFetchedFile,
  type OrchFetchFileOptions,
  type OrchTaskFileChunk,
} from './PycoreApiOrchestrationFiles';

/** Largest lookup batch pycore accepts. */
export const ORCH_RESOURCE_LOOKUP_MAX_ITEMS = 500;

const CHUNK_BYTES = 1024 * 1024;
const LOOKUP_TIMEOUT_MS = 60_000;
const CHUNK_TIMEOUT_MS = 60_000;
const BUNDLE_TIMEOUT_MS = 120_000;
const FRAME_HEADER_BYTES = 4;
/** Status of a route this pycore build does not have. */
const ROUTE_MISSING = 404;

export type OrchResourceKind = 'word' | 'sentence';

export interface OrchResourceRef {
  kind: OrchResourceKind;
  language: string;
  text: string;
}

export interface OrchResourceLookupItem {
  /** pycore resource id (sha256 of kind, language and normalized text). */
  key: string;
  hit: boolean;
  bytes: number;
  /** Where pycore holds the clip, relative to its WWW base with forward slashes
   *  (host-independent: the same on Windows and Linux); '' on a miss. */
  path: string;
  /** Short Chinese gloss of an English word ('' otherwise). */
  meaning: string;
}

export interface OrchResourceLookupResponse {
  success: boolean;
  error?: string;
  items?: OrchResourceLookupItem[];
}

/** One frame of a clip bundle, in request order. */
export interface OrchResourceBundleEntry {
  index: number;
  key: string;
  hit: boolean;
  /** Clip size (the payload size when sent). */
  bytes: number;
  /** False for a hit past the byte budget: ask it again. */
  sent: boolean;
  meaning: string;
  /** Content version the server reported (Laravel frames); null when the frame carries none. */
  version: number | null;
  /** The clip bytes when sent. */
  data: Uint8Array | null;
}

export interface OrchResourceBundleResult {
  /** False when this pycore has no bundle route (use lookup + chunk). */
  supported: boolean;
  entries: OrchResourceBundleEntry[];
}

/** Split a bundle body into its frames (contract transfer.pycore_bundle_frame). */
export function parseOrchResourceBundle(body: Uint8Array): OrchResourceBundleEntry[] {
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const decoder = new TextDecoder();
  const entries: OrchResourceBundleEntry[] = [];
  let offset = 0;
  while (offset + FRAME_HEADER_BYTES <= body.byteLength) {
    const headerLength = view.getUint32(offset);
    offset += FRAME_HEADER_BYTES;
    const header = JSON.parse(decoder.decode(body.subarray(offset, offset + headerLength)));
    offset += headerLength;
    const sent = header.sent === true;
    const bytes = Number(header.bytes) || 0;
    entries.push({
      index: Number(header.index),
      key: String(header.key || ''),
      hit: header.hit === true,
      bytes,
      sent,
      meaning: String(header.meaning || ''),
      version: Number.isFinite(Number(header.version)) && Number(header.version) > 0 ? Number(header.version) : null,
      data: sent ? body.slice(offset, offset + bytes) : null,
    });
    if (sent) offset += bytes;
  }
  return entries;
}

export const ORCH_RESOURCE_BUNDLE_MAX_ITEMS: number = AUDIO_ORCH_TRANSFER.bundleMaxItems;

export const pycoreApiOrchestrationResources = {
  /** Many cached clips in one response (at most ORCH_RESOURCE_BUNDLE_MAX_ITEMS). */
  orchResourceBundle: async (items: OrchResourceRef[], signal?: AbortSignal): Promise<OrchResourceBundleResult> => {
    const answer = await requestPycoreHttpBinaryPost(PYCORE_HTTP_ROUTES.audioOrchResourceBundle, { items }, BUNDLE_TIMEOUT_MS, signal);
    if (answer.status === ROUTE_MISSING) return { supported: false, entries: [] };
    if (answer.status !== 200 || !answer.bytes) throw new Error(`ORCH_RESOURCE_BUNDLE_HTTP_${answer.status}`);
    return { supported: true, entries: parseOrchResourceBundle(answer.bytes) };
  },


  orchResourceLookup: (items: OrchResourceRef[]) =>
    requestPycoreHttp(
      PYCORE_HTTP_ROUTES.audioOrchResourceLookup,
      { items },
      LOOKUP_TIMEOUT_MS,
    ) as Promise<OrchResourceLookupResponse>,

  orchResourceChunk: (resource: OrchResourceRef, offset: number, length = CHUNK_BYTES) =>
    requestPycoreHttp(
      PYCORE_HTTP_ROUTES.audioOrchResourceChunk,
      { ...resource, offset, length },
      CHUNK_TIMEOUT_MS,
    ) as Promise<OrchTaskFileChunk>,

  /** One cached clip as a Blob; rejects with a `{ success: false, error }` failure. */
  orchFetchResource: (resource: OrchResourceRef, options: OrchFetchFileOptions = {}): Promise<OrchFetchedFile> =>
    orchReadChunkedFile(
      resource.text,
      (offset) => pycoreApiOrchestrationResources.orchResourceChunk(resource, offset),
      options,
    ),
};
