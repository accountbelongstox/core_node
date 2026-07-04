/**
 * Firefox-only helpers for the file upload tool.
 *
 * Firefox has no chrome.debugger, so CDP DOM.setFileInputFiles is unavailable
 * and an extension cannot construct a File object directly from a disk path.
 * Instead the file content is materialized in the background context:
 *   - filePath:   read through the native messaging host in base64 chunks
 *                 (native messaging caps host -> extension messages at 1 MB)
 *   - fileUrl:    fetched directly (host_permissions covers <all_urls>)
 *   - base64Data: decoded in place
 * The caller then transfers the bytes to an ISOLATED-world content script via
 * structured clone (ArrayBuffer is supported by Firefox runtime messaging)
 * which builds File objects and assigns them to the <input type="file">.
 */
import { getNativePort } from '../../native-host';

// Hard cap for a single upload materialized in extension memory.
export const MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024;
// Raw bytes per native read chunk; base64 expansion (~4/3) plus JSON framing
// must stay safely under the 1 MB native messaging message limit.
const NATIVE_READ_CHUNK_BYTES = 512 * 1024;
const NATIVE_REQUEST_TIMEOUT_MS = 15000;
const URL_FETCH_TIMEOUT_MS = 30000;
const DEFAULT_FILE_NAME = 'uploaded-file';
const DEFAULT_MIME_TYPE = 'application/octet-stream';
const EXTENSION_MIME_TYPES: Record<string, string> = {
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  xml: 'application/xml',
  html: 'text/html',
  css: 'text/css',
  js: 'text/javascript',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  mp4: 'video/mp4',
  webm: 'video/webm',
  zip: 'application/zip',
};

export interface FirefoxUploadSource {
  filePath?: string;
  fileUrl?: string;
  base64Data?: string;
  fileName?: string;
}

export interface FirefoxUploadFile {
  name: string;
  type: string;
  bytes: ArrayBuffer;
  size: number;
}

function guessMimeType(name: string): string {
  const dot = name.lastIndexOf('.');
  if (dot < 0) return DEFAULT_MIME_TYPE;
  return EXTENSION_MIME_TYPES[name.slice(dot + 1).toLowerCase()] || DEFAULT_MIME_TYPE;
}

function baseName(pathOrUrl: string): string {
  return pathOrUrl.split(/[\\/]/).pop() || DEFAULT_FILE_NAME;
}

function assertWithinSizeLimit(size: number): void {
  if (size > MAX_UPLOAD_FILE_BYTES) {
    throw new Error(
      `File is too large for Firefox upload: ${size} bytes (limit ${MAX_UPLOAD_FILE_BYTES} bytes / 50 MB)`,
    );
  }
}

function base64ToBytes(base64: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    throw new Error('Invalid base64 data');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Send a file_operation request over the existing native messaging port and
 * wait for the matching file_operation_response. A dedicated port listener is
 * used because on Firefox the background context never receives its own
 * runtime.sendMessage broadcasts (the Chrome-path relay relies on that).
 */
function sendFileOperationRequest(
  payload: Record<string, unknown>,
  timeoutMs: number = NATIVE_REQUEST_TIMEOUT_MS,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const port = getNativePort();
    if (!port) {
      reject(
        new Error(
          'Native messaging host is not connected; local file paths require the native host on Firefox',
        ),
      );
      return;
    }

    const requestId = `firefox-file-upload-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const onMessage = (message: any) => {
      if (message?.type !== 'file_operation_response' || message.responseToRequestId !== requestId) {
        return;
      }
      clearTimeout(timer);
      port.onMessage.removeListener(onMessage);
      if (message.error) {
        reject(new Error(String(message.error)));
      } else {
        resolve(message.payload);
      }
    };

    const timer = setTimeout(() => {
      port.onMessage.removeListener(onMessage);
      reject(new Error(`Native file operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    port.onMessage.addListener(onMessage);
    port.postMessage({
      type: 'file_operation',
      requestId,
      payload,
    });
  });
}

/**
 * Read a local file through the native host in base64 chunks.
 */
async function readFileViaNativeHost(filePath: string, fileName?: string): Promise<FirefoxUploadFile> {
  let received = 0;
  let total = -1;
  let bytes: Uint8Array | null = null;
  let resolvedName = fileName || baseName(filePath);

  while (total < 0 || received < total) {
    const chunk = await sendFileOperationRequest({
      action: 'readFileChunk',
      filePath,
      offset: received,
      length: NATIVE_READ_CHUNK_BYTES,
    });

    if (!chunk || chunk.success !== true) {
      throw new Error(chunk?.error ? String(chunk.error) : 'Native host failed to read the file');
    }

    if (total < 0) {
      total = Number(chunk.size) || 0;
      assertWithinSizeLimit(total);
      bytes = new Uint8Array(total);
      if (!fileName && chunk.fileName) {
        resolvedName = String(chunk.fileName);
      }
    }
    if (total === 0) break;

    const part = base64ToBytes(String(chunk.base64Data || ''));
    if (part.length === 0) {
      throw new Error('Native host returned an empty file chunk before end of file');
    }
    bytes!.set(part.subarray(0, Math.min(part.length, total - received)), received);
    received += part.length;
    if (chunk.eof) break;
  }

  if (bytes === null) {
    bytes = new Uint8Array(0);
    total = 0;
  }
  if (total > 0 && received < total) {
    throw new Error(`File read incomplete: got ${received} of ${total} bytes`);
  }

  return {
    name: resolvedName,
    type: guessMimeType(resolvedName),
    bytes: bytes.buffer as ArrayBuffer,
    size: bytes.length,
  };
}

/**
 * Download a file in the background context (host_permissions <all_urls>
 * exempts extension fetches from CORS on Firefox).
 */
async function fetchFileFromUrl(fileUrl: string, fileName?: string): Promise<FirefoxUploadFile> {
  const response = await fetch(fileUrl, { signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const declaredSize = Number(response.headers.get('content-length') || 0);
  assertWithinSizeLimit(declaredSize);

  const buffer = await response.arrayBuffer();
  assertWithinSizeLimit(buffer.byteLength);

  let name = fileName || '';
  if (!name) {
    try {
      name = baseName(new URL(fileUrl).pathname);
    } catch {
      name = DEFAULT_FILE_NAME;
    }
  }

  const headerType = (response.headers.get('content-type') || '').split(';')[0].trim();
  return {
    name,
    type: headerType || guessMimeType(name),
    bytes: buffer,
    size: buffer.byteLength,
  };
}

/**
 * Decode inline base64 data (optionally a data: URL) into upload bytes.
 */
function decodeBase64File(base64Data: string, fileName?: string): FirefoxUploadFile {
  let mimeType = '';
  let content = base64Data;

  const dataUrlMatch = /^data:([^;,]*);base64,/.exec(base64Data);
  if (dataUrlMatch) {
    mimeType = dataUrlMatch[1] || '';
    content = base64Data.slice(dataUrlMatch[0].length);
  }

  const bytes = base64ToBytes(content.replace(/\s+/g, ''));
  assertWithinSizeLimit(bytes.length);

  const name = fileName || DEFAULT_FILE_NAME;
  return {
    name,
    type: mimeType || guessMimeType(name),
    bytes: bytes.buffer as ArrayBuffer,
    size: bytes.length,
  };
}

/**
 * Materialize the requested upload source as in-memory bytes plus metadata.
 */
export async function prepareFirefoxUploadFile(
  source: FirefoxUploadSource,
): Promise<FirefoxUploadFile> {
  const { filePath, fileUrl, base64Data, fileName } = source;
  if (filePath) return readFileViaNativeHost(filePath, fileName);
  if (fileUrl) return fetchFileFromUrl(fileUrl, fileName);
  if (base64Data) return decodeBase64File(base64Data, fileName);
  throw new Error('One of filePath, fileUrl, or base64Data must be provided');
}
