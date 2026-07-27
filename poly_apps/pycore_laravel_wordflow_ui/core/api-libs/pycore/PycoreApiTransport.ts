/**

 * Shared WS transport helpers for pycoreApi domain modules.

 *

 * UI JSON traffic uses named ``callRpc(PYCORE_RPC_ROUTES.*)`` only.

 * ``pycore.router.invoke`` remains registered on the server for non-UI callers;

 * this module no longer exposes getJSON/postJSON bridge helpers to the manager UI.

 */

import { buildPycoreHttpUrl, buildPycoreWsUrl, normalizePycorePath } from './pycoreEndpoints';

import { rewritePycoreEndpoint, pycoreWsUrlOverride, directPycoreHost } from './pycoreTarget';

import { callRpc, isWsConnected } from './PycoreWs';

import { PYCORE_RPC_ROUTES } from './PycoreRpcRoutes';

import { getPycoreHealth } from './PycoreHealth';



/** Read-only guard for known-offline states before issuing a new outbound call. */

const PYCORE_OFFLINE_ERROR = 'pycore is known to be offline (check :59000 host and service).';



/**

 * If local health is already down and there is no WS channel, fail fast and avoid

 * noisy ECONNREFUSED attempts on every polling interval.

 */

function guardPycoreReachability(): void {

  const health = getPycoreHealth();

  if (!isWsConnected() && health.up !== true) {

    const err = new Error(PYCORE_OFFLINE_ERROR);

    (err as unknown as { name: string }).name = 'PycoreOffline';

    throw err;

  }

}



/** Encode a File to base64, chunked so String.fromCharCode never stack-overflows

 *  on a large binary (used for base64-over-WS uploads). */

async function fileToBase64(file: File): Promise<string> {

  const buf = new Uint8Array(await file.arrayBuffer());

  let binary = '';

  const CHUNK = 0x8000; // 32KB

  for (let i = 0; i < buf.length; i += CHUNK) {

    binary += String.fromCharCode(...buf.subarray(i, i + CHUNK));

  }

  return btoa(binary);

}



export {

  guardPycoreReachability,

  fileToBase64,

};



export {

  callRpc,

  isWsConnected,

  PYCORE_RPC_ROUTES,

  rewritePycoreEndpoint,

  pycoreWsUrlOverride,

  directPycoreHost,

  buildPycoreHttpUrl,

  buildPycoreWsUrl,

  normalizePycorePath,

  getPycoreHealth,

};


