import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';

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
  conflict: boolean;
  conflict_doc: string;
  conflict_files: string[];
  ai_prompt: string;
}

export interface GitSyncControl {
  paused?: boolean;
  interval_minutes?: number;
  reminder_seconds?: number;
  run_now?: boolean;
}

export const pycoreApiGitSync = {
  getGitSyncState: () => requestPycoreHttp(PYCORE_HTTP_ROUTES.gitsyncState, {}) as Promise<GitSyncState>,
  controlGitSync: (control: GitSyncControl) => requestPycoreHttp(PYCORE_HTTP_ROUTES.gitsyncControl, {
    paused: control.paused === undefined ? undefined : (control.paused ? '1' : '0'),
    interval_minutes: control.interval_minutes,
    reminder_seconds: control.reminder_seconds,
    run_now: control.run_now ? '1' : undefined,
  }) as Promise<GitSyncState>,
};
