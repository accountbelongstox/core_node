import type { ClientKeySignRequest, ClientKeySignResult } from 'chrome-mcp-shared';
import { CLIENT_KEY_SIGNING } from './constant';
import { clientKeyAuth } from './ncore';

const REQUEST_FIELDS = ['method', 'url', 'contentType', 'contentSha256'] as const;

function isSignRequest(payload: unknown): payload is ClientKeySignRequest {
  if (!payload || typeof payload !== 'object') return false;
  const fields = payload as Record<string, unknown>;
  return REQUEST_FIELDS.every((field) => typeof fields[field] === 'string');
}

/**
 * Sign one extension Laravel request with the shared client key (K3) through
 * the ncore signer, which validates the digest. Only headers or an error code
 * are returned; the key and the canonical string stay in this process.
 */
export function signClientRequest(payload: unknown): ClientKeySignResult {
  if (!isSignRequest(payload)) {
    return { ok: false, code: CLIENT_KEY_SIGNING.PROTOCOL_INVALID_CODE };
  }
  const result = clientKeyAuth.signRequest({
    client: CLIENT_KEY_SIGNING.CLIENT,
    method: payload.method,
    url: payload.url,
    contentType: payload.contentType,
    contentSha256: payload.contentSha256,
  });
  return result.ok ? { ok: true, headers: result.headers } : { ok: false, code: result.code };
}
