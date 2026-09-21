import i18n from '../../../../../core/i18n/UiI18n';
import { orchEn } from '../../../pc-locales/OrchLocales';
import type { OrchPatternStepType } from '@/apps/pycore-manager/api';

type OrchLabels = { [K in keyof typeof orchEn]: string };

export const ORCH_L = Object.defineProperties({}, Object.fromEntries(
  Object.keys(orchEn).map((key) => [key, {
    enumerable: true, get: () => String(i18n.t(`vocabularyPage.orchestration.${key}`, { ns: 'pc' })),
  }]),
)) as OrchLabels;

export const ORCH_STEP_LABELS = {
  get words() { return ORCH_L.wordModeAll; },
  get words_new() { return ORCH_L.wordsOnlyNew; },
  get words_all() { return ORCH_L.wordModeAll; },
  get sentence_en() { return ORCH_L.patternEn; },
  get sentence_zh() { return ORCH_L.patternZh; },
} satisfies Record<OrchPatternStepType, string>;

export function orchErrorMessage(error: unknown, fallback: string = ORCH_L.actionFailed): string {
  const failure = error as { status?: number; message?: string; path?: string } | null;
  const message = failure?.message || (typeof error === 'string' ? error : '');
  const accountRequest = failure?.path === '/login' || failure?.path?.startsWith('/api/app_qy_v1/') === true;
  if (message === 'QY_ACCOUNT_AUTH_REQUIRED') return ORCH_L.accountExpired;
  if (message === 'BOOK_SENTENCES_SYNC_PENDING') return ORCH_L.sentenceSyncPending;
  if (!accountRequest && (failure?.status === 401 || failure?.status === 403)) return ORCH_L.relayConnectionFailed;
  if (message === 'QY_ACCOUNT_MACHINE_SYNC_PENDING') return ORCH_L.machineSyncPending;
  if (message === 'QY_ACCOUNT_LOGOUT_PENDING') return ORCH_L.logoutPending;
  if (message === 'QY_ACCOUNT_LOGOUT_TARGET_CHANGED') return ORCH_L.logoutTargetChanged;
  return message || fallback;
}

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
