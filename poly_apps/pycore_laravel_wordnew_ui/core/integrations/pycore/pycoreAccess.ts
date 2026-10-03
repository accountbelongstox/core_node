/**
 * pycoreAccess - why a browser page cannot use pycore (K7 local RPC gate,
 * client-key rejections, relay-only pages), shared by every UI end. Each end
 * keeps its own wording per kind.
 */
import { CLIENT_KEY_ERROR_CODES, LOCAL_RPC_ERROR_CODES } from '../../contracts/ServiceContract';
import { PycoreHttpError } from './PycoreClient';
import {
  isPycoreDashboardOrigin,
  isPycoreDirectAccessAllowed,
  isPycorePageHostTarget,
  isPycoreProxyMode,
  isPycoreRelayMode,
  pageHostBackendUrl,
  pycoreDashboardOriginPorts,
} from './pycoreTarget';

/** Local RPC rejection kinds are the keys of client_key_auth.local_rpc.error_codes. */
type LocalRpcRejection = keyof typeof LOCAL_RPC_ERROR_CODES;
const LOCAL_RPC_REJECTIONS = Object.keys(LOCAL_RPC_ERROR_CODES) as LocalRpcRejection[];

export type PycoreAccess =
  | { kind: LocalRpcRejection | 'client_key_rejected'; code: string }
  | { kind: 'relay_only' }
  | { kind: 'lan_page'; url: string }
  | { kind: 'origin_not_allowed'; ports: string[] }
  | { kind: 'unreachable' };

function pageAccessIssue(): PycoreAccess | null {
  if (isPycoreRelayMode() || isPycoreProxyMode()) return null;
  if (!isPycoreDirectAccessAllowed()) return { kind: 'relay_only' };
  const pageHost = pageHostBackendUrl();
  if (pageHost) return { kind: 'lan_page', url: pageHost };
  if (!isPycoreDashboardOrigin()) return { kind: 'origin_not_allowed', ports: pycoreDashboardOriginPorts() };
  return null;
}

/**
 * Classify a failed pycore request, or (without an error) the page itself.
 * A pycore rejection code wins; otherwise a page pycore never serves directly
 * (relay only, or an origin off the dashboard ports); otherwise a plain
 * network failure. Returns null only for a page check with no issue.
 */
export function classifyPycoreAccess(error?: unknown): PycoreAccess | null {
  const code = error instanceof PycoreHttpError ? error.code : '';
  const localRpcKind = code ? LOCAL_RPC_REJECTIONS.find((kind) => LOCAL_RPC_ERROR_CODES[kind] === code) : undefined;
  if (localRpcKind) return { kind: localRpcKind, code };
  if (code && CLIENT_KEY_ERROR_CODES.includes(code)) {
    const pageHost = pageHostBackendUrl();
    return pageHost && isPycorePageHostTarget() ? { kind: 'lan_page', url: pageHost } : { kind: 'client_key_rejected', code };
  }
  const pageIssue = pageAccessIssue();
  if (pageIssue) return pageIssue;
  return error === undefined ? null : { kind: 'unreachable' };
}
