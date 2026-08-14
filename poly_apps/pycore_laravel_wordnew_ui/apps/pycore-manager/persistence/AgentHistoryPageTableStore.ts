import { pycoreRouteRecoveryStore } from '../../../core/integrations/pycore/PycoreRouteRecoveryStore';

const RECOVERY_ROUTE = 'ui/agent_history/page_table';
const MAX_TABLE_ITEMS = 100;

export type AgentHistoryPageTable<T> = {
  revision: string;
  total: number;
  items: T[];
  meta?: Record<string, unknown>;
  updatedAt: number;
};

/**
 * Persistent ID page-table cache for the agent-history DIFF read surface.
 * Mirrors the DiffQueueContext pattern: the table (IDs + status metadata
 * only) is restored from local storage on start and aligned by revision —
 * an unchanged revision reuses the local table instead of a cold full pull.
 */
class AgentHistoryPageTableStore {
  read<T>(scope: string): AgentHistoryPageTable<T> | null {
    const recovered = pycoreRouteRecoveryStore.read<AgentHistoryPageTable<T>>(
      RECOVERY_ROUTE,
      { scope },
    );
    const table = recovered?.data;
    return table && Array.isArray(table.items) ? table : null;
  }

  write<T>(scope: string, table: Omit<AgentHistoryPageTable<T>, 'updatedAt'>): void {
    const stored = {
      ...table,
      items: table.items.slice(0, MAX_TABLE_ITEMS),
      updatedAt: Date.now(),
    } as AgentHistoryPageTable<T>;
    pycoreRouteRecoveryStore.write(
      RECOVERY_ROUTE,
      { scope },
      stored,
      { revision: table.revision },
    );
  }
}

export const agentHistoryPageTableStore = new AgentHistoryPageTableStore();
