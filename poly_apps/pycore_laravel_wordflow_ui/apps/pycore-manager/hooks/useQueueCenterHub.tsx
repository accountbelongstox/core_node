/**
 * Queue Center shared state.
 *
 * A single snapshot drives all Queue Center panels and controls.
 * Raw API payloads remain exposed for existing panel components, but
 * section counts / lifecycle / toggles are derived from `sectionContracts`.
 */
import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { pycoreApi, PYCORE_LARAVEL_API_CHANGED_EVENT } from '../../../core/api-libs/pycore';
import { getPycoreHealth } from '../../../core/api-libs/pycore/PycoreHealth';
import { isWsConnected } from '../../../core/api-libs/pycore/PycoreWs';
import type {
  QueueCenterSnapshot,
  AssistStatus,
  HeartbeatWorkersStatus,
  PcQueueOverview,
  PcTaskCenterResponse,
  PcTaskRecentResponse,
  QueueCenterControlName,
  QueueCenterControlState,
  SentenceAudioAutoStatus,
  SentenceAudioQueueSnapshot,
  TranslationQueueResponse,
  TtsStatus,
  WordTtsAutoStatus,
} from '../../../core/api-libs/pycore';
import type {
  QcSectionContracts,
  QcSectionScope,
  QueueSectionLifecycle,
} from '../utils/pcQueueCenterTypes';
import {
  QC_AUTO_KEY,
  QC_SCOPE_LABELS,
  buildDefaultSectionContracts,
} from '../utils/pcQueueCenterTypes';
import { taskCenterState } from './TaskCenterState';

const HUB_POLL_MS = 5000;

/*
 * [gpt-5.3-codex-spark:LEGACY-START]
 * Old mappings only accepted legacy controls (`assist`, `translation`) and relied
 * on aliases to normalize to `assist_translation`.
 * The map now also accepts direct `assist_translation` for canonical control paths.
 * [gpt-5.3-codex-spark:LEGACY-END]
 */
const CONTROL_SCOPE_BY_NAME: Record<QueueCenterControlName, QcSectionScope> = {
  assist_translation: 'assist_translation',
  word_audio: 'word_audio',
  sentence_audio: 'sentence_audio',
};

interface ControlIntent {
  requested_by: 'user' | 'system';
  enabled: boolean;
  graceful_stop: boolean;
  at: number;
}

type ControlIntentByScope = Partial<Record<QcSectionScope, ControlIntent>>;

interface WorkerHeartbeatLike {
  heartbeat_enabled?: unknown;
  cycle_running?: unknown;
  last_tick?: unknown;
  last_cycle?: unknown;
  last_seen?: unknown;
  total_claimed?: unknown;
  total_succeeded?: unknown;
  total_failed?: unknown;
}

interface ContractToggleState {
  requestedBy: string;
  enabled: boolean;
  pausedByUser: boolean;
  reason: string | null;
  lifecycle: QueueSectionLifecycle;
  gracefulStop: boolean;
  errorCode: string | null;
}

const toBool = (value: unknown): boolean => {
  if (value === true || value === false) return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }
  return false;
};

const toErrorCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.split(':')[0]?.trim().toLowerCase().replace(/\s+/g, '_') || trimmed;
};

const toNum = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return 0;
};

const safeDate = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return new Date(value * 1000).toISOString();
  if (value && typeof value === 'object' && typeof (value as { at?: unknown }).at !== 'undefined') {
    return safeDate((value as { at?: unknown }).at);
  }
  return null;
};

const isMediaCategory = (categoryKey: string, categoryLabel?: string): boolean => {
  const text = `${categoryKey} ${categoryLabel ?? ''}`.toLowerCase();
  return text.includes('image')
    || text.includes('cover')
    || text.includes('poster')
    || text.includes('screenshot')
    || text.includes('book')
    || text.includes('media');
};

const isMediaWorker = (processors: string[] | undefined): boolean => {
  const raw = processors ?? [];
  return raw.some((processor) => {
    const key = String(processor).toLowerCase();
    return key.includes('image')
      || key.includes('cover')
      || key.includes('poster')
      || key.includes('media')
      || key.includes('book');
  });
};

const sumByCategoryField = (rows: Array<{ [key: string]: unknown }>, field: string): number => (
  rows.reduce((acc, row) => acc + toNum(row?.[field]), 0)
);

const isValidScope = (scope: unknown): scope is QcSectionScope => (
  scope === 'heartbeat'
  || scope === 'assist_translation'
  || scope === 'word_audio'
  || scope === 'sentence_audio'
  || scope === 'media_image'
);

const normalizeScope = (value: unknown): QcSectionScope | null => {
  if (typeof value !== 'string') return null;
  return isValidScope(value) ? value : null;
};

const parseBackendToggle = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return {
      requested_by: null,
      paused_by_user: false,
      enabled: false,
      reason: null,
      graceful_stop: false,
    };
  }
  const input = value as {
    requested_by?: unknown;
    paused_by_user?: unknown;
    enabled?: unknown;
    reason?: unknown;
    graceful_stop?: unknown;
  };
  return {
    requested_by: typeof input.requested_by === 'string' ? input.requested_by : null,
    paused_by_user: toBool(input.paused_by_user),
    enabled: toBool(input.enabled),
    reason: typeof input.reason === 'string' && input.reason ? input.reason : null,
    graceful_stop: toBool(input.graceful_stop),
  };
};

const parseBackendContract = (snapshot: QueueCenterSnapshot): QcSectionContracts | null => {
  const rawContracts = snapshot.section_contracts;
  if (!rawContracts || typeof rawContracts !== 'object') return null;
  const base = buildDefaultSectionContracts(snapshot.generated_at);
  let applied = false;

  Object.entries(rawContracts).forEach(([scopeKey, rawValue]) => {
    const scope = normalizeScope(scopeKey);
    if (!scope || !rawValue || typeof rawValue !== 'object') return;
    const raw = rawValue as {
      type?: unknown;
      category?: unknown;
      queue?: unknown;
      worker?: unknown;
      toggle?: unknown;
      lifecycle?: unknown;
      error_code?: unknown;
      last_error?: unknown;
      updated_at?: unknown;
    };
    const rawQueue = (typeof raw.queue === 'object' && raw.queue !== null) ? raw.queue as Record<string, unknown> : {};
    const rawWorker = (typeof raw.worker === 'object' && raw.worker !== null) ? raw.worker as Record<string, unknown> : {};
    const rawToggle = parseBackendToggle(raw.toggle);
    base[scope] = {
      type: scope,
      category: typeof raw.category === 'string' ? raw.category : base[scope].category,
      queue: {
        pending: toNum(rawQueue.pending),
        processing: toNum(rawQueue.processing),
        leased: toNum(rawQueue.leased),
        total: toNum(rawQueue.total),
      },
      worker: {
        online: toBool(rawWorker.online),
        claimed: toNum(rawWorker.claimed),
        ok: rawWorker.ok == null ? null : toNum(rawWorker.ok),
        fail: rawWorker.fail == null ? null : toNum(rawWorker.fail),
        last_heartbeat: safeDate(rawWorker.last_heartbeat),
      },
      toggle: rawToggle,
      lifecycle: raw.lifecycle === 'on' || raw.lifecycle === 'off' || raw.lifecycle === 'starting' || raw.lifecycle === 'error'
        ? raw.lifecycle
        : 'off',
      error_code: toErrorCode(raw.error_code),
      last_error: typeof raw.last_error === 'string' ? raw.last_error : null,
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : snapshot.generated_at,
    };
    applied = true;
  });

  return applied ? base : null;
};

const buildWorkerStatus = (raw: WorkerHeartbeatLike | undefined | null): {
  claimed: number;
  ok: number | null;
  fail: number | null;
  last_heartbeat: string | null;
  online: boolean;
} => ({
  claimed: toNum(raw?.total_claimed),
  ok: raw?.total_succeeded == null ? null : toNum(raw.total_succeeded),
  fail: raw?.total_failed == null ? null : toNum(raw.total_failed),
  last_heartbeat: safeDate(raw?.last_seen) ?? safeDate(raw?.last_cycle) ?? safeDate(raw?.last_tick),
  online: toBool(raw?.heartbeat_enabled) || toBool(raw?.cycle_running),
});

const resolveSectionControl = (
  scope: QcSectionScope,
  control: QueueCenterControlState | undefined,
  intent: ControlIntentByScope,
  errorCode: string | null,
  hasWorkerSignal: boolean,
  hasHeartbeat: boolean,
): ContractToggleState => {
  const requested = intent[scope];
  const configured = toBool(control?.configured);
  const running = toBool(control?.running);
  const requestedEnabled = requested?.enabled;
  const effectiveEnabled = requestedEnabled === undefined ? configured : requestedEnabled;
  const requestedBy = requested?.requested_by || control?.owner || 'system';
  const gracefulStop = requested?.graceful_stop ?? false;
  const requestedByUser = requested?.requested_by === 'user';
  const pausedByUser = requestedByUser && requestedEnabled === false;

  let lifecycle: QueueSectionLifecycle = 'off';
  if (errorCode) {
    lifecycle = 'error';
  } else if (requestedEnabled === false) {
    lifecycle = (running || hasWorkerSignal || hasHeartbeat) ? 'starting' : 'off';
  } else if (requestedEnabled === true) {
    lifecycle = (running || hasWorkerSignal || hasHeartbeat) ? 'on' : 'starting';
  } else if (configured) {
    lifecycle = (running || hasWorkerSignal || hasHeartbeat) ? 'on' : 'starting';
  } else {
    lifecycle = 'off';
  }

  const effectiveGracefulStop = requestedEnabled === false && (running || hasWorkerSignal || hasHeartbeat);

  return {
    requestedBy,
    enabled: effectiveEnabled,
    pausedByUser,
    reason: errorCode ? 'control_error' : null,
    lifecycle,
    gracefulStop: effectiveGracefulStop || gracefulStop,
    errorCode,
  };
};

/*
 * [gpt-5.3-codex-spark:LEGACY-START]
 * Previously this function only compared simple `hasError`, `running`, and
 * `configured` flags and did not persist explicit lifecycle transitions
 * (`starting`, `on`, `off`) or the graceful-stop intent signal.
 * The current implementation keeps the same input contract while tightening
 * the transition state and preserving requested intent.
 * [gpt-5.3-codex-spark:LEGACY-END]
 */

const buildSectionContracts = (
  snapshot: QueueCenterSnapshot,
  intent: ControlIntentByScope,
): QcSectionContracts => {
  const backendContracts = parseBackendContract(snapshot);
  if (backendContracts) {
    return backendContracts;
  }

  const updatedAt = snapshot.generated_at;
  const base = buildDefaultSectionContracts(updatedAt);
  const data = snapshot.data;
  const errors = snapshot.errors ?? {};
  const overview = data.overview;
  const categories = Array.isArray(overview?.categories) ? overview.categories : [];
  const callbackRows = Array.isArray(data.workers?.callbacks) ? data.workers.callbacks : [];
  const workerRows = Array.isArray(overview?.workers) ? overview.workers : [];
  const translation = data.translation;
  const translationSummary = translation?.summary;
  const assist = data.assist;
  const word = data.word_audio;
  const sentence = data.sentence_audio;
  const sentenceQueue = data.sentence_queue;
  const mediaRows = categories.filter((row) => isMediaCategory(String(row?.key), String(row?.label || '')));

  const heartbeatRowsSum = callbackRows.length;
  const heartbeatProcessing = callbackRows.reduce((acc, item) => acc + toNum((item as { run_count?: unknown }).run_count), 0);
  const heartbeatClaimed = workerRows.reduce((acc, item) => acc + toNum((item as { claimed?: unknown }).claimed), 0);
  const heartbeatLastHeartbeat = workerRows
    .map((item) => safeDate((item as { last_seen?: unknown }).last_seen))
    .filter((value): value is string => value != null)
    .sort()
    .at(-1) ?? null;

  const mediaWorkerRows = workerRows.filter((worker) => isMediaWorker((worker as { processor_types?: string[] }).processor_types));
  const mediaWorkerClaimed = mediaWorkerRows.reduce((acc, row) => acc + toNum((row as { claimed?: unknown }).claimed), 0);
  const mediaWorkerLast = mediaWorkerRows
    .map((item) => safeDate((item as { last_seen?: unknown }).last_seen))
    .filter((value): value is string => value != null)
    .sort()
    .at(-1) ?? null;

  const mediaPending = sumByCategoryField(mediaRows, 'pending');
  const mediaProcessing = sumByCategoryField(mediaRows, 'processing');
  const mediaLeased = sumByCategoryField(mediaRows, 'leased');
  const mediaTotal = sumByCategoryField(mediaRows, 'total');

  const wordSummary = word?.laravel ?? {};
  const assistLaravel = assist?.laravel_status;
  const sentenceQueueTotals = sentenceQueue?.queue;
  const sentenceLaravel = sentence?.laravel;

  const assistControl: QueueCenterControlState = {
    configured: toBool(data?.assist?.running) || toBool(snapshot.controls?.assist_translation?.configured),
    owner: snapshot.controls?.assist_translation?.owner || 'system',
    running: toBool(data?.assist?.running) || toBool(snapshot.controls?.assist_translation?.running),
    requested: toBool(snapshot.controls?.assist_translation?.requested),
  };

  const assistError = errors.assist || errors.translation;
  const translationError = errors.translation || errors.assist;
  const wordError = errors.word_audio || errors.word;
  const sentenceError = errors.sentence_audio || errors.sentence;
  const mediaError = errors.image || errors.poster || errors.media_image;
  const heartbeatError = errors.heartbeat;

  const heartbeatToggle: ContractToggleState = {
    requestedBy: 'system',
    enabled: heartbeatRowsSum > 0 || workerRows.some((item) => toBool((item as { online?: unknown }).online)),
    lifecycle: heartbeatRowsSum > 0 ? 'on' : 'off',
    reason: heartbeatError ? 'control_error' : null,
    gracefulStop: false,
    pausedByUser: false,
    errorCode: toErrorCode(heartbeatError),
  };

  const assistWorkerSignal = toBool(assist?.running);
  const wordWorkerSignal = toBool(word?.heartbeat_enabled);
  const sentenceWorkerSignal = toBool(sentence?.heartbeat_enabled);

  const assistToggle = resolveSectionControl(
    'assist_translation',
    assistControl,
    intent,
    toErrorCode(assistError || translationError),
    assistWorkerSignal,
    toBool(assist?.running),
  );
  const wordToggle = resolveSectionControl(
    'word_audio',
    snapshot.controls?.word_audio,
    intent,
    toErrorCode(wordError),
    wordWorkerSignal,
    toBool(word?.heartbeat_enabled),
  );
  const sentenceToggle = resolveSectionControl(
    'sentence_audio',
    snapshot.controls?.sentence_audio,
    intent,
    toErrorCode(sentenceError),
    sentenceWorkerSignal,
    toBool(sentence?.heartbeat_enabled),
  );
  const mediaToggle: ContractToggleState = {
    requestedBy: 'system',
    enabled: mediaWorkerRows.length > 0 && mediaWorkerRows.some((item) => toBool((item as { online?: unknown }).online)),
    lifecycle: mediaError ? 'error' : (mediaWorkerRows.some((item) => toBool((item as { online?: unknown }).online)) ? 'on' : 'off'),
    reason: mediaError ? 'control_error' : null,
    gracefulStop: false,
    pausedByUser: false,
    errorCode: toErrorCode(mediaError),
  };

  const heartbeatWorker = {
    online: workerRows.some((item) => (item as { online?: unknown }).online),
    claimed: heartbeatClaimed,
    ok: null as number | null,
    fail: null as number | null,
    last_heartbeat: heartbeatLastHeartbeat,
  };
  const wordWorker = buildWorkerStatus(word?.worker as WorkerHeartbeatLike | undefined);
  const sentenceWorker = buildWorkerStatus(sentence?.worker as WorkerHeartbeatLike | undefined);
  const assistWorker = buildWorkerStatus({
    heartbeat_enabled: assist?.running,
    last_cycle_at: assist?.last_cycle_at,
    total_claimed: assist?.counters?.claimed,
    total_succeeded: assist?.counters?.submitted,
    total_failed: assist?.counters?.failures,
  });

  const assistQueuePending = toNum(translationSummary?.pending)
    + toNum(assistLaravel?.tts?.pending)
    + toNum(assistLaravel?.cover?.pending)
    + toNum(assistLaravel?.poster?.pending);
  const assistQueueProcessing = toNum(translationSummary?.processing)
    + toNum(assistLaravel?.tts?.processing)
    + toNum(assistLaravel?.cover?.processing);
  const assistQueueLeased = toNum(assistLaravel?.tts?.leased) + toNum(assistLaravel?.cover?.leased);
  const assistQueueTotal = toNum(translationSummary?.total)
    + toNum(assistLaravel?.tts?.total)
    + toNum(assistLaravel?.cover?.total)
    + toNum(assistLaravel?.poster?.total);

  const mediaContract = {
    ...base.media_image,
    category: QC_SCOPE_LABELS.media_image,
    queue: {
      pending: mediaPending,
      processing: mediaProcessing,
      leased: mediaLeased,
      total: mediaTotal,
    },
    worker: {
      ...buildWorkerStatus({ total_claimed: mediaWorkerClaimed, last_seen: mediaWorkerLast }),
      online: mediaWorkerRows.some((item) => toBool((item as { online?: unknown }).online)),
      last_heartbeat: mediaWorkerLast,
    },
    toggle: {
      requested_by: mediaToggle.requestedBy,
      paused_by_user: mediaToggle.pausedByUser,
      enabled: mediaToggle.enabled,
      reason: mediaToggle.reason,
      graceful_stop: mediaToggle.gracefulStop,
    },
    lifecycle: mediaToggle.lifecycle,
    error_code: mediaToggle.errorCode,
    last_error: mediaError ? String(mediaError) : null,
    updated_at: updatedAt,
  };

  const heartbeatContract = {
    ...base.heartbeat,
    category: QC_SCOPE_LABELS.heartbeat,
    queue: {
      pending: heartbeatRowsSum,
      processing: heartbeatProcessing,
      leased: 0,
      total: heartbeatRowsSum,
    },
    worker: heartbeatWorker,
    toggle: {
      requested_by: heartbeatToggle.requestedBy,
      paused_by_user: heartbeatToggle.pausedByUser,
      enabled: heartbeatToggle.enabled,
      reason: heartbeatToggle.reason,
      graceful_stop: heartbeatToggle.gracefulStop,
    },
    lifecycle: heartbeatError ? 'error' : heartbeatToggle.lifecycle,
    error_code: heartbeatToggle.errorCode,
    last_error: heartbeatError ? String(heartbeatError) : null,
    updated_at: updatedAt,
  };

  const wordContract = {
    ...base.word_audio,
    category: QC_SCOPE_LABELS.word_audio,
    queue: {
      pending: toNum(wordSummary.pending),
      processing: 0,
      leased: toNum(wordSummary.leased),
      total: toNum(wordSummary.pending) + toNum(wordSummary.leased),
    },
    worker: {
      ...wordWorker,
      online: toBool(word?.worker?.heartbeat_enabled) || toBool(word?.heartbeat_enabled),
    },
    toggle: {
      requested_by: wordToggle.requestedBy,
      paused_by_user: wordToggle.pausedByUser,
      enabled: wordToggle.enabled,
      reason: wordToggle.reason,
      graceful_stop: wordToggle.gracefulStop,
    },
    lifecycle: wordToggle.lifecycle,
    error_code: wordToggle.errorCode,
    last_error: wordError ? String(wordError) : null,
    updated_at: updatedAt,
  };

  const sentenceQueuePending = toNum(sentenceQueueTotals?.items?.length) || toNum(sentenceLaravel?.pending);
  const sentenceQueueProcessing = toNum(sentence?.worker?.processing);
  const sentenceQueueLeased = toNum(sentenceLaravel?.leased);
  const sentenceQueueTotal = toNum(sentenceQueueTotals?.total) || sentenceQueuePending;

  const sentenceContract = {
    ...base.sentence_audio,
    category: QC_SCOPE_LABELS.sentence_audio,
    queue: {
      pending: sentenceQueuePending,
      processing: sentenceQueueProcessing,
      leased: sentenceQueueLeased,
      total: sentenceQueueTotal,
    },
    worker: {
      ...sentenceWorker,
      online: toBool(sentence?.worker?.heartbeat_enabled) || sentenceToggle.enabled,
    },
    toggle: {
      requested_by: sentenceToggle.requestedBy,
      paused_by_user: sentenceToggle.pausedByUser,
      enabled: sentenceToggle.enabled,
      reason: sentenceToggle.reason,
      graceful_stop: sentenceToggle.gracefulStop,
    },
    lifecycle: sentenceToggle.lifecycle,
    error_code: sentenceToggle.errorCode,
    last_error: sentenceError ? String(sentenceError) : null,
    updated_at: updatedAt,
  };

  const assistContract = {
    ...base.assist_translation,
    category: QC_SCOPE_LABELS.assist_translation,
    queue: {
      pending: assistQueuePending,
      processing: assistQueueProcessing,
      leased: assistQueueLeased,
      total: assistQueueTotal,
    },
    worker: {
      ...assistWorker,
      online: toBool(assist?.running),
      claimed: toNum(assist?.counters?.claimed),
      ok: toNum(assist?.counters?.submitted) || null,
      fail: toNum(assist?.counters?.failures) || null,
    },
    toggle: {
      requested_by: assistToggle.requestedBy,
      paused_by_user: assistToggle.pausedByUser,
      enabled: assistToggle.enabled,
      reason: assistToggle.reason,
      graceful_stop: assistToggle.gracefulStop,
    },
    lifecycle: assistToggle.lifecycle,
    error_code: assistToggle.errorCode,
    last_error: assistError ? String(assistError) : null,
    updated_at: updatedAt,
  };

  const normalized: QcSectionContracts = {
    heartbeat: heartbeatContract,
    assist_translation: assistContract,
    word_audio: wordContract,
    sentence_audio: sentenceContract,
    media_image: mediaContract,
  };

  return normalized;
};

const defaultSectionContracts = buildDefaultSectionContracts(null);

export type QueueCenterHubLifecycle = 'idle' | 'loading' | 'ready' | 'stale' | 'degraded' | 'error';

export interface QueueCenterHubState {
  hubState: QueueCenterHubLifecycle;
  diagnostics: Record<string, any> | null;
  pycoreReachable: boolean;
  laravelReachable: boolean | null;
  laravelStoredEndpoint: string | null;
  laravelActiveEndpoint: string | null;
  /** Translation worker's current api_url (may lag after endpoint switch). */
  workerApiUrl: string | null;
  laravelSnapshotAgeS: number | null;
  translationPending: number | null;
  voiceWord: WordTtsAutoStatus | null;
  voiceSentence: SentenceAudioAutoStatus | null;
  workers: HeartbeatWorkersStatus | null;
  assist: AssistStatus | null;
  tts: TtsStatus | null;
  overview: PcQueueOverview | null;
  sentenceQueue: SentenceAudioQueueSnapshot | null;
  recent: PcTaskRecentResponse | null;
  taskCenter: PcTaskCenterResponse | null;
  translationQueue: TranslationQueueResponse | null;
  controls: Partial<Record<QueueCenterControlName, QueueCenterControlState>>;
  sliceErrors: Record<string, string>;
  timestamp: string | null;
  loading: boolean;
  error: string | null;
  sectionContracts: QcSectionContracts;
  refreshHub: () => Promise<void>;
  setControl: (name: QueueCenterControlName, enabled: boolean) => Promise<void>;
  /** Live auto-poll toggle (persisted via QC_AUTO_KEY). */
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}

const defaultHub: QueueCenterHubState = {
  hubState: 'idle',
  diagnostics: null,
  pycoreReachable: true,
  laravelReachable: null,
  laravelStoredEndpoint: null,
  laravelActiveEndpoint: null,
  workerApiUrl: null,
  laravelSnapshotAgeS: null,
  translationPending: null,
  voiceWord: null,
  voiceSentence: null,
  workers: null,
  assist: null,
  tts: null,
  overview: null,
  sentenceQueue: null,
  recent: null,
  taskCenter: null,
  translationQueue: null,
  controls: {},
  sliceErrors: {},
  timestamp: null,
  loading: true,
  error: null,
  sectionContracts: defaultSectionContracts,
  refreshHub: async () => { },
  setControl: async () => { },
  autoRefresh: true,
  setAutoRefresh: () => { },
};

const QueueCenterHubContext = createContext<QueueCenterHubState>(defaultHub);

function readAutoRefreshPref(): boolean {
  try {
    return localStorage.getItem(QC_AUTO_KEY) === '1';
  } catch {
    return true;
  }
}

/** App-wide hub — mount once in PcProviders so setControl works on every page. */
export const QueueCenterHubProvider: React.FC<{ children: React.ReactNode }> = (
  { children },
) => {
  const [autoRefresh, setAutoRefreshState] = useState<boolean>(() => readAutoRefreshPref());
  const setAutoRefresh = useCallback((enabled: boolean) => {
    setAutoRefreshState(enabled);
    try {
      localStorage.setItem(QC_AUTO_KEY, enabled ? '1' : '0');
    } catch { /* ignore */ }
  }, []);
  const [hub, setHub] = useState<Omit<QueueCenterHubState, 'refreshHub' | 'setControl' | 'autoRefresh' | 'setAutoRefresh'>>(() => {
    const {
      refreshHub: _refreshHub,
      setControl: _setControl,
      autoRefresh: _auto,
      setAutoRefresh: _setAuto,
      ...state
    } = defaultHub;
    return state;
  });
  const [controlIntent, setControlIntent] = useState<ControlIntentByScope>({});
  const requestId = useRef(0);
  const offlineRetryAtRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const poll = useCallback(async (silent = false) => {
    const currentRequest = ++requestId.current;
    const now = Date.now();
    const pycoreHealth = getPycoreHealth();
    if (!isWsConnected()) {
      if (!silent) {
        if (pycoreHealth.up === false) {
          setHub((previous) => ({ ...previous, loading: false, pycoreReachable: false, hubState: 'error' }));
        } else {
          setHub((previous) => ({ ...previous, loading: false }));
        }
      }
      return;
    }
    if (now < offlineRetryAtRef.current) {
      if (!silent) {
        setHub((previous) => ({ ...previous, loading: false }));
      }
      return;
    }
    if (!silent) {
      setHub((previous) => ({ ...previous, loading: true, hubState: previous.hubState === 'idle' ? 'loading' : previous.hubState }));
    }
    try {
      const snapshot = await pycoreApi.getQueueCenterSnapshot();
      if (!mounted.current || currentRequest !== requestId.current) return;
      const sectionContracts = buildSectionContracts(snapshot, controlIntent);
      const errorMessage = Object.entries(snapshot.errors ?? {})
        .map(([name, value]) => `${name}: ${value}`)
        .join('; ');
      consecutiveFailuresRef.current = 0;
      offlineRetryAtRef.current = 0;
      const workerApiUrl = snapshot.data.task_center?.remote_queue?.worker?.api_url ?? null;

      let hubState: QueueCenterHubLifecycle = 'ready';
      if (snapshot.data.overview?.degraded) {
        hubState = snapshot.data.overview?.source === 'pycore_fallback_stale_cache' ? 'stale' : 'degraded';
      }

      setHub({
        hubState,
        diagnostics: snapshot.data.overview?.diagnostics ?? null,
        pycoreReachable: true,
        laravelReachable: snapshot.source.laravel_reachable,
        laravelStoredEndpoint: snapshot.source.laravel_stored_endpoint,
        laravelActiveEndpoint: snapshot.source.laravel_active_endpoint,
        workerApiUrl: typeof workerApiUrl === 'string' && workerApiUrl ? workerApiUrl : null,
        laravelSnapshotAgeS: snapshot.source.laravel_snapshot_age_s,
        translationPending: snapshot.data.translation?.summary?.pending ?? null,
        voiceWord: snapshot.data.word_audio,
        voiceSentence: snapshot.data.sentence_audio,
        workers: snapshot.data.workers,
        assist: snapshot.data.assist,
        tts: snapshot.data.tts,
        overview: snapshot.data.overview,
        sentenceQueue: snapshot.data.sentence_queue,
        recent: snapshot.data.recent,
        taskCenter: snapshot.data.task_center,
        translationQueue: snapshot.data.translation,
        controls: snapshot.controls,
        sliceErrors: snapshot.errors,
        timestamp: snapshot.generated_at,
        loading: false,
        error: errorMessage || null,
        sectionContracts,
      });

      // Ingest recent tasks into the shared state
      if (snapshot.data.recent) {
        taskCenterState.ingestRecent(snapshot.data.recent);
      }
    } catch (error: any) {
      if (!mounted.current || currentRequest !== requestId.current) return;
      const failures = consecutiveFailuresRef.current + 1;
      consecutiveFailuresRef.current = failures;
      offlineRetryAtRef.current = Date.now() + Math.min(30_000, 2 ** Math.min(10, failures) * 1_000);
      // Preserve endpoint fields from the last successful snapshot so the UI
      // keeps showing the stored/active endpoint even when a poll fails.
      // Only flip pycoreReachable to false after >=2 consecutive failures so a
      // single RPC timeout does not trigger the 'pycore offline' banner.
      setHub((previous) => ({
        ...previous,
        pycoreReachable: failures >= 2 ? false : previous.pycoreReachable,
        loading: false,
        hubState: 'error',
        error: error?.message || 'Queue Center unavailable',
      }));
    }
  }, [controlIntent]);

  useEffect(() => {
    void poll(false);
  }, [poll]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void poll(true);
    }, HUB_POLL_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, poll]);

  const refreshHub = useCallback(async () => {
    await poll(false);
  }, [poll]);

  // ---- Endpoint switch listener ----
  // When the user selects a new Laravel endpoint in the pycore-manager UI the
  // backend (LaravelEndpointManager.select) dispatches this event. We clear
  // the stale endpoint fields immediately and force a fresh snapshot poll so
  // the Queue Center reflects the new selection without waiting 5 s.
  useEffect(() => {
    const handleEndpointChanged = () => {
      setHub((previous) => ({
        ...previous,
        laravelActiveEndpoint: null,
        laravelStoredEndpoint: null,
        workerApiUrl: null,
        laravelReachable: null,
        laravelSnapshotAgeS: null,
      }));
      void poll(false);
    };
    window.addEventListener(PYCORE_LARAVEL_API_CHANGED_EVENT, handleEndpointChanged);
    return () => window.removeEventListener(PYCORE_LARAVEL_API_CHANGED_EVENT, handleEndpointChanged);
  }, [poll]);

  const setControl = useCallback(async (name: QueueCenterControlName, enabled: boolean) => {
    const scope = CONTROL_SCOPE_BY_NAME[name];
    setControlIntent((current) => ({
      ...current,
      [scope]: {
        requested_by: 'user',
        enabled,
        graceful_stop: !enabled,
        at: Date.now(),
      },
    }));
    try {
      const response = await pycoreApi.setQueueCenterControl(name, enabled, {
        requested_by: 'user',
        reason: 'ui_toggle',
        graceful_stop: !enabled,
        timeoutMs: 8_000,
      });
      if (!response?.success) {
        throw new Error(response?.error || `Could not update ${name}`);
      }
      await poll(false);
    } catch (err) {
      // Re-sync from server so the toggle does not stick on a stale intent.
      try { await poll(false); } catch { /* ignore */ }
      throw err;
    } finally {
      setControlIntent((current) => {
        if (!current[scope]) return current;
        const next = { ...current };
        delete next[scope];
        return next;
      });
    }
  }, [poll]);

  const value = useMemo<QueueCenterHubState>(
    () => ({ ...hub, refreshHub, setControl, autoRefresh, setAutoRefresh }),
    [hub, refreshHub, setControl, autoRefresh, setAutoRefresh],
  );

  return (
    <QueueCenterHubContext.Provider value={value}>
      {children}
    </QueueCenterHubContext.Provider>
  );
};

export function useQueueCenterHub(): QueueCenterHubState {
  return useContext(QueueCenterHubContext);
}

export function laravelLiveSyncOffline(hub: QueueCenterHubState): boolean {
  return hub.pycoreReachable && hub.laravelReachable === false;
}

export function laravelEndpointMismatch(hub: QueueCenterHubState): boolean {
  const stored = hub.laravelStoredEndpoint?.replace(/\/$/, '');
  const active = hub.laravelActiveEndpoint?.replace(/\/$/, '');
  return !!(stored && active && stored !== active);
}

/** True when the translation worker still points at a different URL than the active endpoint. */
export function workerEndpointMismatch(hub: QueueCenterHubState): boolean {
  const worker = hub.workerApiUrl?.replace(/\/$/, '');
  const active = hub.laravelActiveEndpoint?.replace(/\/$/, '');
  return !!(worker && active && worker !== active);
}
