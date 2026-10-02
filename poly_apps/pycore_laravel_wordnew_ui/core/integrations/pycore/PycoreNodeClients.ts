/**
 * Parallel pycore nodes: one client bundle per backend URL, so a page can work
 * with several pycores at once (e.g. the terminal page's node tabs). A null URL
 * is the selected pycore target, whose client every other page uses.
 */
import { PycoreMasterClient } from './PycoreClient';
import { createPycoreHttp, primaryPycoreHttp, type PycoreHttpApi } from './PycoreHttp';
import { createPycoreApiTerminal, pycoreApiTerminal, type PycoreTerminalApi } from './PycoreApiTerminal';
import { createPycoreApiMachineSend, pycoreApiMachineSend, type PycoreMachineSendApi } from './PycoreApiMachineSend';

export interface PycoreNodeClient {
  http: PycoreHttpApi;
  terminal: PycoreTerminalApi;
  machineSend: PycoreMachineSendApi;
}

const PRIMARY_NODE: PycoreNodeClient = {
  http: primaryPycoreHttp,
  terminal: pycoreApiTerminal,
  machineSend: pycoreApiMachineSend,
};
const nodeClients = new Map<string, PycoreNodeClient>();

export function pycoreNodeClient(backendUrl: string | null): PycoreNodeClient {
  if (!backendUrl) return PRIMARY_NODE;
  const key = backendUrl.replace(/\/+$/, '');
  let client = nodeClients.get(key);
  if (!client) {
    const http = createPycoreHttp(new PycoreMasterClient(key));
    client = { http, terminal: createPycoreApiTerminal(http), machineSend: createPycoreApiMachineSend(http) };
    nodeClients.set(key, client);
  }
  return client;
}

export function pycoreNodeTerminalApi(backendUrl: string | null): PycoreTerminalApi {
  return pycoreNodeClient(backendUrl).terminal;
}
