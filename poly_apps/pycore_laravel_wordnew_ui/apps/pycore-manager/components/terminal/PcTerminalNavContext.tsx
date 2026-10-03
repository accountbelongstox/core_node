import { createContext, useContext } from 'react';

export interface PcTerminalNavActions {
  /** Open a finished terminal's operation view (clears its finished mark, keeps the previous one in history). */
  openFinished?: (terminalNumber: number) => void;
}

const PcTerminalNavActionsContext = createContext<PcTerminalNavActions>({});

export const PcTerminalNavActionsProvider = PcTerminalNavActionsContext.Provider;

export function usePcTerminalNavActions(): PcTerminalNavActions {
  return useContext(PcTerminalNavActionsContext);
}
