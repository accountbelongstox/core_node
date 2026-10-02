/**
 * Schedule sync of a parallel pycore node: pycore runs scheduled sends from the
 * schedule key of its own UI-state document, so the node's browser queue is
 * merged into that document (other keys kept) before the runtime sync.
 */
import { PYCORE_HTTP_ROUTES, type PycoreHttpApi, type PycoreTerminalApi } from '../../../core/integrations/pycore';
import { StorageManager, type RevisionedStorageDocument } from '../../../core/persistence';
import { terminalScheduleStorageKey } from '../api/TerminalScheduleStore';
import { PycoreManagerUiStorageKeys } from './PycoreManagerStorageKeys';
import { pycoreManagerUiStateSync } from './PycoreManagerUiStateSync';

const STATE_READ_CEILING_MS = 10_000;
const PUSH_ATTEMPTS = 2;

export interface TerminalScheduleSync {
  synchronizeTerminalSchedules: (terminalNumber?: number) => ReturnType<PycoreTerminalApi['synchronizeTerminalSchedules']>;
  clearTerminalSchedules: () => ReturnType<PycoreTerminalApi['clearTerminalScheduleEntries']>;
  pushTerminalScheduleJson: () => Promise<void>;
}

export const primaryTerminalScheduleSync: TerminalScheduleSync = pycoreManagerUiStateSync;

export function createNodeTerminalScheduleSync(
  http: PycoreHttpApi,
  api: PycoreTerminalApi,
  scope: string,
): TerminalScheduleSync {
  const push = async (): Promise<void> => {
    const raw = StorageManager.getRaw(terminalScheduleStorageKey(scope));
    if (raw === null) return;
    for (let attempt = 0; attempt < PUSH_ATTEMPTS; attempt += 1) {
      const read = await http.requestPycoreHttp(PYCORE_HTTP_ROUTES.pycoreManagerStateGet, {}, STATE_READ_CEILING_MS);
      const current = (read?.data ?? null) as RevisionedStorageDocument | null;
      const saved = await http.requestPycoreHttp(PYCORE_HTTP_ROUTES.pycoreManagerStatePut, {
        values: { ...(current?.values ?? {}), [PycoreManagerUiStorageKeys.PYCORE_TERMINAL_SCHEDULES]: raw },
        base_revision: Number(current?.revision || 0),
        initialize_only: false,
      });
      if (saved?.success && !saved.data?.conflict) return;
    }
  };
  return {
    async synchronizeTerminalSchedules(terminalNumber = 0) {
      await push();
      return api.synchronizeTerminalSchedules(terminalNumber);
    },
    async clearTerminalSchedules() {
      await push();
      return api.clearTerminalScheduleEntries();
    },
    pushTerminalScheduleJson: push,
  };
}
