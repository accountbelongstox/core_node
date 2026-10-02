/**
 * Parallel pycore nodes: one client per backend URL, so a page can work with
 * several pycores at once (e.g. the terminal page's node tabs). A null URL is
 * the selected pycore target, whose client every other page uses.
 */
import { PycoreMasterClient } from './PycoreClient';
import { createPycoreHttp } from './PycoreHttp';
import { createPycoreApiTerminal, pycoreApiTerminal, type PycoreTerminalApi } from './PycoreApiTerminal';

const nodeTerminalApis = new Map<string, PycoreTerminalApi>();

export function pycoreNodeTerminalApi(backendUrl: string | null): PycoreTerminalApi {
  if (!backendUrl) return pycoreApiTerminal;
  const key = backendUrl.replace(/\/+$/, '');
  let api = nodeTerminalApis.get(key);
  if (!api) {
    api = createPycoreApiTerminal(createPycoreHttp(new PycoreMasterClient(key)));
    nodeTerminalApis.set(key, api);
  }
  return api;
}
