/**
 * The pycore node a terminal view operates on. Every terminal component reads
 * its API here, so the same code drives this machine's terminals (selected
 * pycore target, nodeUrl null) or another online pycore's (fixed backend URL).
 */
import React, { createContext, useContext, useMemo } from 'react';
import { pycoreNodeTerminalApi, type PycoreTerminalApi } from '@/apps/pycore-manager/api';

interface PcTerminalNode {
  /** Backend URL of a parallel node; null is the selected pycore target. */
  nodeUrl: string | null;
  isPrimary: boolean;
  api: PycoreTerminalApi;
}

const PcTerminalNodeContext = createContext<PcTerminalNode>({
  nodeUrl: null,
  isPrimary: true,
  api: pycoreNodeTerminalApi(null),
});

export const PcTerminalApiProvider: React.FC<{ nodeUrl: string | null; children: React.ReactNode }> = ({ nodeUrl, children }) => {
  const value = useMemo<PcTerminalNode>(() => ({
    nodeUrl,
    isPrimary: nodeUrl === null,
    api: pycoreNodeTerminalApi(nodeUrl),
  }), [nodeUrl]);
  return <PcTerminalNodeContext.Provider value={value}>{children}</PcTerminalNodeContext.Provider>;
};

export function usePcTerminalNode(): PcTerminalNode {
  return useContext(PcTerminalNodeContext);
}

export function usePcTerminalApi(): PycoreTerminalApi {
  return useContext(PcTerminalNodeContext).api;
}
