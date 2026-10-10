/**
 * Terminals of every node tab, kept as light records (number, name, online) so UI outside the terminal view
 * (the share picker, sharing shortcuts) can list them. The shown node and the polled nodes feed it; the picker
 * refreshes it on open.
 */
import { createPcExternalStore, getBrowserId, pycoreNodeClient, type TerminalWindowInfo } from '@/apps/pycore-manager/api';
import { PRIMARY_NODE_KEY } from '@/apps/pycore-manager/components/terminal/PcTerminalApiContext';
import type { PcOsKind } from '@/apps/pycore-manager/components/terminal/PcOsIcon';
import { listTerminalTabNodes } from '@/apps/pycore-manager/components/terminal/PcTerminalNodeTabs';
import { terminalName } from '@/apps/pycore-manager/components/terminal/terminalAgentDoneNotices';

const VIEWER_SUFFIX = ':share-picker';

export interface CatalogTerminal {
  number: number;
  name: string;
  online: boolean;
}

export interface CatalogNode {
  nodeUrl: string | null;
  label: string;
  os: PcOsKind;
  terminals: CatalogTerminal[];
  /** False once the last refresh of this node failed; the terminals are then the last known ones. */
  reachable: boolean;
}

export interface CatalogSource {
  nodeUrl: string | null;
  nodeLabel: string;
  os: PcOsKind;
  untitled: string;
}

export const terminalCatalog = createPcExternalStore<Record<string, CatalogNode>>({});

const nodeKeyOf = (nodeUrl: string | null) => nodeUrl ?? PRIMARY_NODE_KEY;

export function catalogNodeKey(nodeUrl: string | null): string {
  return nodeKeyOf(nodeUrl);
}

export function recordTerminalCatalog(source: CatalogSource, windows: TerminalWindowInfo[]): void {
  const node: CatalogNode = {
    nodeUrl: source.nodeUrl,
    label: source.nodeLabel,
    os: source.os,
    reachable: true,
    terminals: windows.map((windowInfo) => ({
      number: windowInfo.terminal_number,
      name: terminalName(windowInfo, source.untitled),
      online: windowInfo.online,
    })),
  };
  terminalCatalog.set((previous) => ({ ...previous, [nodeKeyOf(source.nodeUrl)]: node }));
}

/** Asks every node tab for its terminals; an unreachable node keeps its last known list and is marked. */
export async function refreshTerminalCatalog(activeUrl: string | null, thisMachineLabel: string, untitled: string): Promise<void> {
  const viewerId = `${getBrowserId()}${VIEWER_SUFFIX}`;
  await Promise.all(listTerminalTabNodes(activeUrl, thisMachineLabel).map(async (node) => {
    try {
      const snapshot = await pycoreNodeClient(node.url).terminal.getTerminalWindows(viewerId, []);
      recordTerminalCatalog({ nodeUrl: node.url, nodeLabel: node.label, os: node.os, untitled }, snapshot.windows);
    } catch {
      terminalCatalog.set((previous) => {
        const known = previous[nodeKeyOf(node.url)];
        return {
          ...previous,
          [nodeKeyOf(node.url)]: { nodeUrl: node.url, label: node.label, os: node.os, terminals: known?.terminals ?? [], reachable: false },
        };
      });
    }
  }));
}
