import i18n from '../../../../core/i18n/UiI18n';
import { formatClock } from '../../../../core/utils/formatters';
import { orchEn } from '../../pc-locales/OrchLocales';
import type {
  OrchGenerationPhase,
  OrchPatternStepType,
  OrchQueueInfo,
  OrchQueueReason,
  OrchQueueWait,
  OrchVideoStatus,
} from '@/apps/pycore-manager/api';
import {
  pcCodeText,
  pcErrorCodeMessage,
  pcFailureCode,
  pcFailureMessage,
  type PcCodeParams,
  type PcFailureFields,
} from '../../utils/pcErrorCodes';

type OrchLabels = { [K in keyof typeof orchEn]: string };

const ORCH_MESSAGE_PREFIX = 'audioOrchestration.messages';
const ORCH_MESSAGE_VALUE_PREFIX = 'audioOrchestration.messageValues';
/** One poll cadence for every orchestration surface (workspace, listing, detail). */
export const ORCH_POLL_MS = 3000;
/** Message params whose values are codes or enumerated ids (never free text such as `text`). */
const ORCH_CODED_PARAMS = new Set(['status', 'kind', 'lane', 'source', 'error', 'reason']);
/** Message params carrying several codes joined by a comma (queue prerequisites). */
const ORCH_CODE_LIST_PARAMS = new Set(['waiting']);
const ORCH_CODE_LIST_SEPARATOR = ',';
const ORCH_WAIT_DISPLAY_SEPARATOR = ' / ';

export const ORCH_L = Object.defineProperties({}, Object.fromEntries(
  Object.keys(orchEn).map((key) => [key, {
    enumerable: true, get: () => String(i18n.t(`audioOrchestration.${key}`, { ns: 'pc' })),
  }]),
)) as OrchLabels;

export const ORCH_STEP_LABELS = {
  get words() { return ORCH_L.wordModeAll; },
  get words_new() { return ORCH_L.wordsOnlyNew; },
  get words_all() { return ORCH_L.wordModeAll; },
  get sentence_en() { return ORCH_L.patternEn; },
  get sentence_zh() { return ORCH_L.patternZh; },
} satisfies Record<OrchPatternStepType, string>;

/** Localized text of a failure (a code, a pycore answer or a thrown error); raw text never passes. */
export function orchErrorMessage(error: unknown, fallback: string = ORCH_L.actionFailed): string {
  const failure = error as { status?: number; message?: string; path?: string } | null;
  const code = typeof error === 'string'
    ? error
    : pcFailureCode(error as PcFailureFields | null) || failure?.message || '';
  const accountRequest = failure?.path === '/login' || failure?.path?.startsWith('/api/app_qy_v1/') === true;
  if (code === 'QY_ACCOUNT_AUTH_REQUIRED') return ORCH_L.accountExpired;
  if (code === 'BOOK_SENTENCES_SYNC_PENDING') return ORCH_L.sentenceSyncPending;
  if (!accountRequest && (failure?.status === 401 || failure?.status === 403)) return ORCH_L.relayConnectionFailed;
  if (code === 'QY_ACCOUNT_MACHINE_SYNC_PENDING') return ORCH_L.machineSyncPending;
  if (code === 'QY_ACCOUNT_LOGOUT_PENDING') return ORCH_L.logoutPending;
  if (code === 'QY_ACCOUNT_LOGOUT_TARGET_CHANGED') return ORCH_L.logoutTargetChanged;
  return pcErrorCodeMessage(code) || fallback;
}

function orchParamValue(name: string, value: unknown): unknown {
  if (typeof value === 'string' && ORCH_CODE_LIST_PARAMS.has(name)) {
    return value.split(ORCH_CODE_LIST_SEPARATOR)
      .map((code) => pcCodeText(ORCH_MESSAGE_VALUE_PREFIX, code.trim()) || code.trim())
      .join(ORCH_WAIT_DISPLAY_SEPARATOR);
  }
  if (typeof value !== 'string' || !ORCH_CODED_PARAMS.has(name)) return value;
  return pcCodeText(ORCH_MESSAGE_PREFIX, value)
    || pcCodeText(ORCH_MESSAGE_VALUE_PREFIX, value)
    || pcErrorCodeMessage(value)
    || value;
}

/**
 * Localized task log / progress line of one pycore `orch_messages` code
 * (`message_code` + `message_params`, or an event's `code` + `params`). The
 * fallback is pycore's English rendering of the same line, kept for rows
 * stored before the codes existed.
 */
export function orchCodedMessage(code: string | null | undefined, params: PcCodeParams, fallback = ''): string {
  const localizedParams = Object.fromEntries(
    Object.entries(params || {}).map(([name, value]) => [name, orchParamValue(name, value)]),
  );
  return pcCodeText(ORCH_MESSAGE_PREFIX, code, localizedParams) || fallback;
}

/** Localized message of one persisted sync attempt failure ({error_code, detail}). */
export function orchSyncFailureMessage(state: PcFailureFields | null | undefined): string {
  return pcFailureMessage(state, ORCH_L.loadFailed);
}

/** Localized label of a generation phase (progress.phase). */
export const ORCH_PHASE_LABELS = {
  get sync() { return ORCH_L.syncing; },
  get manifest() { return ORCH_L.phaseManifest; },
  get resources() { return ORCH_L.phaseResources; },
  get assemble() { return ORCH_L.phaseAssemble; },
  get video() { return ORCH_L.phaseVideo; },
  get done() { return ORCH_L.phaseDone; },
} satisfies Record<OrchGenerationPhase | 'done', string>;

/** Localized label of one segment's video render state. */
export const ORCH_VIDEO_STATUS_LABELS = {
  get rendering() { return ORCH_L.videoStatusRendering; },
  get done() { return ORCH_L.videoStatusDone; },
  get failed() { return ORCH_L.videoStatusFailed; },
  get skipped() { return ORCH_L.videoStatusSkipped; },
} satisfies Record<OrchVideoStatus, string>;

const ORCH_QUEUE_WAIT_LABELS = {
  get ffmpeg() { return ORCH_L.waitFfmpeg; },
  get sentences() { return ORCH_L.waitSentences; },
} satisfies Record<OrchQueueWait, string>;

const ORCH_QUEUE_REASON_LABELS = {
  get new() { return ORCH_L.reasonNew; },
  get interrupted() { return ORCH_L.reasonInterrupted; },
  get videos() { return ORCH_L.reasonVideos; },
  get rerender() { return ORCH_L.reasonRerender; },
  get retry() { return ORCH_L.reasonRetry; },
} satisfies Record<OrchQueueReason, string>;

/** Localized text of a task's automatic-generation state; '' while idle. */
export function orchQueueText(queue: OrchQueueInfo | undefined): string {
  if (!queue) return '';
  if (queue.state === 'queued') return ORCH_L.queueQueued;
  if (queue.state === 'running') return ORCH_L.queueRunning;
  if (queue.state !== 'waiting') return '';
  const waiting = (queue.waiting || []).map((item) => ORCH_QUEUE_WAIT_LABELS[item] || item);
  return `${ORCH_L.queueWaiting}: ${waiting.join(ORCH_WAIT_DISPLAY_SEPARATOR)}`;
}

/** Localized reason the queue picked a task ('' when unknown). */
export function orchQueueReasonText(queue: OrchQueueInfo | undefined): string {
  return queue?.reason ? ORCH_QUEUE_REASON_LABELS[queue.reason] || '' : '';
}

/** Localized text of a stored video failure code (segment `video_error`). */
export function orchVideoErrorText(code: string | null | undefined): string {
  return code ? orchErrorMessage(code, ORCH_L.videoStatusFailed) : '';
}

/** minutes:seconds for plan/preview estimates. */
export function formatDuration(seconds: number | undefined | null): string {
  return formatClock(seconds, { padMinutes: false });
}

export function newOrchTaskName(book: { title?: string; source_key: string }): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').replace('Z', '');
  return `${book.title || book.source_key}_${timestamp}_${crypto.randomUUID().slice(0, 8)}`;
}
