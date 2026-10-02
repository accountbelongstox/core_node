/**
 * AI hub (manifest catalog, test, history, boot) and model live-monitor HTTP surface for pycoreApi.
 */
import type {
  AiHubBootStatusData,
  AiHubCatalogData,
  AiHubEntry,
  AiHubEnvelope,
  AiHubFailure,
  AiHubHistoryData,
  AiHubHistoryQuery,
  AiHubTestResult,
  ModelLiveSnapshot,
} from './PycoreAiHubTypes';
import {
  requestPycoreHttp, compactPycoreParams, ENGINE_TEST_TIMEOUT_MS, PYCORE_HTTP_ROUTES,
} from './PycoreApiTransport';

const CATALOG_TIMEOUT_MS = 15_000;

/** Globally unique entry key: ids are unique per category only ("tts:azure" vs "stt:azure"). */
export function aiHubEntryKey(entry: Pick<AiHubEntry, 'id' | 'category' | 'key'>): string {
  return entry.key || `${entry.category}:${entry.id}`;
}

/** Payload of a `{success, data}` hub answer; flat answers (topic payloads) pass through. */
export function aiHubData<T>(answer: AiHubEnvelope<T> | T | null | undefined): T | null {
  if (!answer || typeof answer !== 'object') return null;
  const envelope = answer as AiHubEnvelope<T>;
  if (envelope.success === false) return null;
  return (envelope.data !== undefined ? envelope.data : answer) as T;
}

/** Pycore failure code of a hub answer (`error.code`, or a code-valued string `error`). */
export function aiHubFailureCode(answer: AiHubEnvelope<unknown> | null | undefined): string | null {
  const error = answer?.error;
  if (!error) return null;
  return typeof error === 'string' ? error : (error as AiHubFailure).code || null;
}

export const pycoreApiAiHub = {
  getAiHubCatalog: (): Promise<AiHubEnvelope<AiHubCatalogData>> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.aiHubCatalog, {}, CATALOG_TIMEOUT_MS),

  runAiHubTest: (
    entry: Pick<AiHubEntry, 'id' | 'category' | 'key'>,
    params: Record<string, unknown>,
  ): Promise<AiHubEnvelope<AiHubTestResult>> =>
    requestPycoreHttp(
      PYCORE_HTTP_ROUTES.aiHubTest,
      { key: aiHubEntryKey(entry), category: entry.category, params: compactPycoreParams(params) },
      ENGINE_TEST_TIMEOUT_MS,
    ),

  getAiHubHistory: (query: AiHubHistoryQuery = {}): Promise<AiHubHistoryData & { success?: boolean; error?: AiHubFailure | string }> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.aiHubHistory, compactPycoreParams({ ...query })),
  deleteAiHubHistory: (recordId: string): Promise<AiHubEnvelope<unknown>> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.aiHubHistoryDelete, { record_id: recordId }),
  clearAiHubHistory: (scope: { key?: string; category?: string } = {}): Promise<AiHubEnvelope<unknown>> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.aiHubHistoryClear, compactPycoreParams({ ...scope })),

  retryAiHubBoot: (entry?: Pick<AiHubEntry, 'id' | 'category' | 'key'>): Promise<AiHubEnvelope<unknown>> =>
    requestPycoreHttp(
      PYCORE_HTTP_ROUTES.aiHubBootRetry,
      entry ? { key: aiHubEntryKey(entry), category: entry.category } : {},
    ),

  getModelLiveSnapshot: (): Promise<AiHubEnvelope<ModelLiveSnapshot>> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.modelLiveSnapshot, {}),
  watchModelLive: (active: boolean, ttlSeconds?: number): Promise<AiHubEnvelope<unknown>> =>
    requestPycoreHttp(PYCORE_HTTP_ROUTES.modelLiveWatch, compactPycoreParams({ active, ttl_s: ttlSeconds })),
};
