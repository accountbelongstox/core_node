/**
 * Shared HTTP controller helpers for pycore API domain modules.
 */

import { buildPycoreHttpUrl, normalizePycorePath } from './pycoreEndpoints';
import { directPycoreHost, rewritePycoreEndpoint } from './pycoreTarget';
import { requestPycoreHttp, requestPycoreStatus, isHttpConnected } from './PycoreHttp';
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

export {
  fileToBase64,
  requestPycoreHttp,
  requestPycoreStatus,
  isHttpConnected,
  PYCORE_HTTP_ROUTES,
  rewritePycoreEndpoint,
  directPycoreHost,
  buildPycoreHttpUrl,
  normalizePycorePath,
};
