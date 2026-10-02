/**
 * The pycore node a terminal view operates on. Every terminal component (and the
 * machine-send dock) reads its APIs and storage namespace here, so the same code
 * drives this machine (selected pycore target, nodeUrl null) or another online pycore.
 */
import React, { createContext, useContext, useMemo } from 'react';
import {
  pycoreNodeClient,
  type PycoreHttpApi,
  type PycoreMachineSendApi,
  type PycoreTerminalApi,
} from '@/apps/pycore-manager/api';

export const PRIMARY_NODE_KEY = 'primary';

interface PcTerminalNode {
  /** Backend URL of a parallel node; null is the selected pycore target. */
  nodeUrl: string | null;
  /** Storage namespace of the node's browser-side data. */
  nodeKey: string;
  isPrimary: boolean;
  api: PycoreTerminalApi;
  machineSendApi: PycoreMachineSendApi;
  http: PycoreHttpApi;
}

function nodeValue(nodeUrl: string | null): PcTerminalNode {
  const client = pycoreNodeClient(nodeUrl);
  return {
    nodeUrl,
    nodeKey: nodeUrl ?? PRIMARY_NODE_KEY,
    isPrimary: nodeUrl === null,
    api: client.terminal,
    machineSendApi: client.machineSend,
    http: client.http,
  };
}

const PcTerminalNodeContext = createContext<PcTerminalNode>(nodeValue(null));

export const PcTerminalApiProvider: React.FC<{ nodeUrl: string | null; children: React.ReactNode }> = ({ nodeUrl, children }) => {
  const value = useMemo(() => nodeValue(nodeUrl), [nodeUrl]);
  return <PcTerminalNodeContext.Provider value={value}>{children}</PcTerminalNodeContext.Provider>;
};

export function usePcTerminalNode(): PcTerminalNode {
  return useContext(PcTerminalNodeContext);
}

export function usePcTerminalApi(): PycoreTerminalApi {
  return useContext(PcTerminalNodeContext).api;
}
