import { PYCORE_HTTP_ROUTES } from './PycoreApiTransport';
import { primaryPycoreHttp, type PycoreHttpApi } from './PycoreHttp';

/** Automatic gitsync of the pycore machine and its unresolved-merge-conflict alert. */
export interface GitSyncState {
  success: boolean;
  error_code?: string | null;
  /** Paused until pycore restarts. */
  paused: boolean;
  running: boolean;
  scheduler_active: boolean;
  interval_minutes: number;
  reminder_seconds: number;
  last_run_at: number | null;
  last_result: '' | 'ok' | 'conflict';
  /** Gitsync runs pycore has started on this machine (all time). */
  run_count?: number;
  conflict: boolean;
  conflict_doc: string;
  conflict_files: string[];
  ai_prompt: string;
}

export interface GitSyncRun {
  started_at: number;
  duration_seconds: number;
  trigger: 'schedule' | 'manual';
  result: 'ok' | 'conflict';
  exit_code: number | null;
  conflict_files: number;
}

/** One page of the recorded runs, newest first; `recorded` is how many are kept, `total` how many ever ran. */
export interface GitSyncHistoryPage {
  success: boolean;
  error_code?: string | null;
  total: number;
  recorded: number;
  offset: number;
  limit: number;
  runs: GitSyncRun[];
}

export interface GitSyncControl {
  paused?: boolean;
  interval_minutes?: number;
  reminder_seconds?: number;
  run_now?: boolean;
}

/** Gitsync of one pycore node; the node tabs pick which machine the top-bar status shows. */
export function createPycoreApiGitSync(http: PycoreHttpApi) {
  const { requestPycoreHttp } = http;
  return {
    getGitSyncState: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.gitsyncState, {}) as Promise<GitSyncState>,
    getGitSyncHistory: (offset: number, limit: number) => requestPycoreHttp(PYCORE_HTTP_ROUTES.gitsyncHistory, {
      offset,
      limit,
    }) as Promise<GitSyncHistoryPage>,
    controlGitSync: (control: GitSyncControl) => requestPycoreHttp(PYCORE_HTTP_ROUTES.gitsyncControl, {
      paused: control.paused === undefined ? undefined : (control.paused ? '1' : '0'),
      interval_minutes: control.interval_minutes,
      reminder_seconds: control.reminder_seconds,
      run_now: control.run_now ? '1' : undefined,
    }) as Promise<GitSyncState>,
  };
}

export type PycoreGitSyncApi = ReturnType<typeof createPycoreApiGitSync>;

export const pycoreApiGitSync = createPycoreApiGitSync(primaryPycoreHttp);
