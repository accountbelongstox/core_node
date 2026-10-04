import { requestPycoreHttp, PYCORE_HTTP_ROUTES } from './PycoreApiTransport';

/** One LAN pycore as announced by its gitsync turn claim/release (pushed to this pycore, never polled). */
export interface GitSyncLanPeer {
  machine: string;
  hostname: string;
  running: boolean;
  seen_at: number;
  result?: '' | 'ok' | 'conflict';
  finished_at?: number;
  head?: string;
  branch?: string;
  pushed?: number;
  pulled?: number;
}

export interface GitSyncPush {
  finished_at: number;
  head: string;
  branch: string;
  pushed: number;
  commits: string[];
}

/** Automatic gitsync of the pycore machine and its unresolved-merge-conflict alert. */
export interface GitSyncState {
  success: boolean;
  error_code?: string | null;
  /** Bumped on every change; sent back as known_revision, an unchanged state replies with the revision only. */
  revision: number;
  unchanged?: boolean;
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
  /** Filled only while a conflict is open. */
  ai_prompt: string;
  /** Waiting for the LAN turn; turn_holder is the LAN machine holding it ('' = unknown). */
  waiting_for_turn: boolean;
  turn_holder: string;
  last_push: GitSyncPush | Record<string, never>;
  lan: GitSyncLanPeer[];
}

export interface GitSyncRun {
  started_at: number;
  duration_seconds: number;
  waited_seconds?: number;
  trigger: 'schedule' | 'manual' | 'peer';
  result: 'ok' | 'conflict';
  exit_code: number | null;
  conflict_files: number;
  pushed?: number;
  pulled?: number;
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

export const pycoreApiGitSync = {
  getGitSyncState: (knownRevision?: number) => requestPycoreHttp(PYCORE_HTTP_ROUTES.gitsyncState, {
    known_revision: knownRevision,
  }) as Promise<GitSyncState>,
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
