/**
 * The active machine of the pycore-manager: the node picked in the terminal node tabs
 * (null URL = the selected pycore target). Header widgets read it here so they query,
 * name and cache per machine exactly like the terminal view.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  getPycoreTarget,
  listPycoreEndpoints,
  pycoreNodeClient,
  subscribePycoreProbes,
  type PycoreNodeClient,
} from '@/apps/pycore-manager/api';
import { PRIMARY_NODE_KEY } from '../components/terminal/PcTerminalApiContext';
import {
  readPcUiSessionTerminalNodeUrl,
  subscribePcUiSessionTerminalNodeUrl,
} from '../persistence/PcUiSessionStore';

export interface SelectedPycoreNode {
  /** Backend URL of the picked node; null is the selected pycore target. */
  url: string | null;
  /** Storage / cache namespace of the machine. */
  key: string;
  client: PycoreNodeClient;
  /** Computer name shown to the user; empty while unknown. */
  label: string;
}

function labelOf(url: string | null): string {
  const wanted = url ?? getPycoreTarget().url;
  return listPycoreEndpoints().find((endpoint) => endpoint.url === wanted)?.label || '';
}

export function useSelectedPycoreNode(): SelectedPycoreNode {
  const url = useSyncExternalStore(subscribePcUiSessionTerminalNodeUrl, readPcUiSessionTerminalNodeUrl);
  const [, setProbeVersion] = useState(0);
  useEffect(() => subscribePycoreProbes(() => setProbeVersion((value) => value + 1)), []);
  return { url, key: url ?? PRIMARY_NODE_KEY, client: pycoreNodeClient(url), label: labelOf(url) };
}
