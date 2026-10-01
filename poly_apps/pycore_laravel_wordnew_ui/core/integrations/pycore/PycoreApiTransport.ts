/**
 * Shared HTTP controller helpers for pycore API domain modules.
 */

import { buildPycoreHttpUrl, normalizePycorePath } from './pycoreEndpoints';
import { directPycoreHost, rewritePycoreEndpoint } from './pycoreTarget';
import {
  requestPycoreHttp,
  requestPycoreHttpText,
  requestPycoreHttpUpload,
  requestPycoreHttpBinary,
  requestPycoreHttpBinaryPost,
  pycoreDirectRequest,
  type PycoreHttpBinaryResult,
  requestPycoreStatus,
} from './PycoreHttp';
import { isHttpConnected } from './PycoreEventClient';
import { PYCORE_HTTP_ROUTES } from './PycoreHttpRoutes';

async function fileToBase64(file: File): Promise<string> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < buffer.length; index += chunkSize) {
    binary += String.fromCharCode(...buffer.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * Engine tests cold-start isolated venvs and load multi-GB models (qwen3tts
 * health wait alone allows 180s server-side), so the default 30s HTTP deadline
 * is guaranteed to fire. Live engine tests get a 10-minute budget.
 */
const ENGINE_TEST_TIMEOUT_MS = 10 * 60_000;

/** Drops undefined, null and empty-string entries so optional request fields are omitted, not sent blank. */
function compactPycoreParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

export {
  ENGINE_TEST_TIMEOUT_MS,
  compactPycoreParams,
  fileToBase64,
  requestPycoreHttp,
  requestPycoreHttpText,
  requestPycoreHttpUpload,
  requestPycoreHttpBinary,
  requestPycoreHttpBinaryPost,
  pycoreDirectRequest,
  type PycoreHttpBinaryResult,
  requestPycoreStatus,
  isHttpConnected,
  PYCORE_HTTP_ROUTES,
  rewritePycoreEndpoint,
  directPycoreHost,
  buildPycoreHttpUrl,
  normalizePycorePath,
};
