import path from 'node:path';
import type { onRequestAsyncHookHandler, preParsingAsyncHookHandler } from 'fastify';
import type { ClientKeySignResult } from 'chrome-mcp-shared';
import { NCORE_MODULES } from './constant';

export interface NcoreClientKeyAuth {
  signRequest(request: Record<string, unknown>): ClientKeySignResult;
}

export interface NcoreFastifyGuard {
  onRequest: onRequestAsyncHookHandler;
  preParsing: preParsingAsyncHookHandler;
}

export interface NcoreLocalRpcGuard {
  createFastifyGuard(options: { allowedOrigins: string[]; allowLoopbackOrigins: boolean }): NcoreFastifyGuard;
}

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

// Set before the ncore modules load: their logger must never write to stdout.
process.env[NCORE_MODULES.STDIO_LOG_ENV] = NCORE_MODULES.STDIO_LOG_MODE;

export const clientKeyAuth: NcoreClientKeyAuth = require(path.join(REPO_ROOT, NCORE_MODULES.CLIENT_KEY_AUTH));
export const localRpcGuard: NcoreLocalRpcGuard = require(path.join(REPO_ROOT, NCORE_MODULES.LOCAL_RPC_GUARD));
