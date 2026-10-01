import queueCenterContract from '../../../../config/queue_center_contract.json';

export interface QueueProgressCounts {
  total: number;
  done: number;
  failed: number;
  pending: number;
}

/** The contract `progress_template`: the one progress shape of every queue and lane. */
export interface QueueProgress extends QueueProgressCounts {
  cursor: number | null;
  updated_at: string;
  languages?: Record<string, QueueProgressCounts>;
}

export type QueueAssistDevice = 'gpu' | 'cpu';
export type QueueAssistRunState = 'running' | 'idle' | 'blocked';

/** Where this node's assist work runs; GPU first, CPU when no GPU engine is usable. */
export interface QueueAssistState {
  device: QueueAssistDevice | null;
  engine: string;
  state: QueueAssistRunState;
  reason_code?: string | null;
}

/** Tasks the lane left out on purpose, grouped by the code that says why. */
export interface QueueSkippedGroup {
  reason_code: string;
  count: number;
}

/** Progress, assist state and skipped tasks of one queue or lane, as pycore reports them. */
export interface QueueLaneReport {
  /** The contract template as pycore sends it; `{}` until the first intake, so read it with `readQueueProgress`. */
  progress?: unknown;
  assist?: QueueAssistState | null;
  skipped?: QueueSkippedGroup[] | null;
}

const COUNT_FIELDS = queueCenterContract.progress_template.count_fields;

function readCounts(raw: unknown): QueueProgressCounts | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const counts: Record<string, number> = {};
  for (const field of COUNT_FIELDS) {
    const value = Number(source[field]);
    if (!Number.isFinite(value) || value < 0) return null;
    counts[field] = value;
  }
  return counts as unknown as QueueProgressCounts;
}

/** Validates one progress object against the contract template; null when it does not match. */
export function readQueueProgress(raw: unknown): QueueProgress | null {
  const counts = readCounts(raw);
  if (!counts) return null;
  const source = raw as Record<string, unknown>;
  const progress: QueueProgress = {
    ...counts,
    cursor: Number.isFinite(Number(source.cursor)) && source.cursor !== null ? Number(source.cursor) : null,
    updated_at: typeof source.updated_at === 'string' ? source.updated_at : '',
  };
  if (source.languages && typeof source.languages === 'object') {
    const languages: Record<string, QueueProgressCounts> = {};
    for (const [language, row] of Object.entries(source.languages as Record<string, unknown>)) {
      const parsed = readCounts(row);
      if (parsed) languages[language] = parsed;
    }
    if (Object.keys(languages).length) progress.languages = languages;
  }
  return progress;
}

export function queueProgressPercent(counts: QueueProgressCounts): number {
  return counts.total > 0 ? Math.round((counts.done / counts.total) * 100) : 100;
}
