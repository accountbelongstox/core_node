import i18n from '../../../../core/i18n/UiI18n';
import { orchEn } from '../../pc-locales/OrchLocales';
import type { OrchGenerationPhase, OrchPatternStepType } from '@/apps/pycore-manager/api';
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
/** Message params whose values are codes or enumerated ids (never free text such as `text`). */
const ORCH_CODED_PARAMS = new Set(['status', 'kind', 'lane', 'source', 'error']);

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
  get done() { return ORCH_L.phaseDone; },
} satisfies Record<OrchGenerationPhase | 'done', string>;

/** minutes:seconds for plan/preview estimates. */
export function formatDuration(seconds: number | undefined | null): string {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function newOrchTaskName(book: { title?: string; source_key: string }): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').replace('Z', '');
  return `${book.title || book.source_key}_${timestamp}_${crypto.randomUUID().slice(0, 8)}`;
}
