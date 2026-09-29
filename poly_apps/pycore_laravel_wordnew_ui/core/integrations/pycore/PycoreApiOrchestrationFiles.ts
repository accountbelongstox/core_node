/**
 * Generated-file transfer of audio-orchestration tasks
 * (`ui/audio_orch/task/file_chunk`): a segment mp3 / mp4 is read chunk by chunk
 * (base64, at most 1 MiB each) into one Blob so the UI can play or save it.
 */
import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';

/** Larger files are never buffered in the browser (the UI offers "Open folder" only). */
export const ORCH_FILE_MAX_BUFFER_BYTES = 300 * 1024 * 1024;
export const ORCH_FILE_TOO_LARGE_CODE = 'ORCH_FILE_TOO_LARGE';
export const ORCH_FILE_ABORTED_CODE = 'ORCH_FILE_ABORTED';

const CHUNK_BYTES = 1024 * 1024;
const CHUNK_TIMEOUT_MS = 60_000;
const CODE_REQUEST_FAILED = 'PYCORE_REQUEST_FAILED';

export interface OrchTaskFileChunk {
  success: boolean;
  error?: string;
  name?: string;
  media_type?: 'audio/mpeg' | 'video/mp4';
  /** Total file size. */
  bytes?: number;
  offset?: number;
  length?: number;
  eof?: boolean;
  content_base64?: string;
}

export interface OrchFetchedFile {
  name: string;
  mediaType: string;
  bytes: number;
  blob: Blob;
}

export interface OrchFetchFileOptions {
  /** Called after every chunk with the bytes received so far and the file size. */
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

const failure = (error: string) => ({ success: false, error });

export const pycoreApiOrchestrationFiles = {
  orchTaskFileChunk: (taskId: string, name: string, offset: number, length = CHUNK_BYTES) =>
    requestPycoreHttp(
      PYCORE_HTTP_ROUTES.audioOrchTaskFileChunk,
      { task_id: taskId, name, offset, length },
      CHUNK_TIMEOUT_MS,
    ) as Promise<OrchTaskFileChunk>,

  /** Reads every chunk of one generated file into a Blob; rejects with a `{ success: false, error }` failure. */
  orchFetchTaskFile: async (taskId: string, name: string, options: OrchFetchFileOptions = {}): Promise<OrchFetchedFile> => {
    const parts: Uint8Array[] = [];
    let offset = 0;
    let total = 0;
    let mediaType = '';
    for (;;) {
      if (options.signal?.aborted) throw failure(ORCH_FILE_ABORTED_CODE);
      const chunk = await pycoreApiOrchestrationFiles.orchTaskFileChunk(taskId, name, offset);
      if (!chunk.success || typeof chunk.content_base64 !== 'string') throw chunk.error ? chunk : failure(CODE_REQUEST_FAILED);
      total = Number(chunk.bytes) || 0;
      if (total > ORCH_FILE_MAX_BUFFER_BYTES) throw failure(ORCH_FILE_TOO_LARGE_CODE);
      mediaType = chunk.media_type || mediaType;
      const bytes = decodeBase64(chunk.content_base64);
      if (bytes.length === 0 && !chunk.eof) throw failure(CODE_REQUEST_FAILED);
      parts.push(bytes);
      offset += bytes.length;
      options.onProgress?.(offset, total);
      if (chunk.eof) break;
    }
    return { name, mediaType, bytes: total, blob: new Blob(parts as BlobPart[], { type: mediaType }) };
  },
};
