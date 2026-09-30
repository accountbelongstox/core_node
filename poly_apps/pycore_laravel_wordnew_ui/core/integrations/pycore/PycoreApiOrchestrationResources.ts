/**
 * Content-addressed clip access of the pycore audio caches
 * (`ui/audio_orch/resource/lookup`, `ui/audio_orch/resource/chunk`): which
 * word / sentence clips pycore already holds, and their bytes. The same central
 * caches back pycore's own orchestration, so a client resolves from them first.
 */
import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';
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

export const pycoreApiOrchestrationResources = {
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
