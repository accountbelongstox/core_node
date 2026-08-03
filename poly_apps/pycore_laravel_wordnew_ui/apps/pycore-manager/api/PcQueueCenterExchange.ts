import { pycoreApi } from '../../../core/api-libs/pycore';
import {
  buildDefaultQueueCenterSections,
  QUEUE_CENTER_CONTRACT,
} from '../../../core/contracts/QueueCenterContract';
import type {
  AssistStatus,
  PcQueueOverview,
  PcTaskRecentResponse,
  QueueCenterSectionContract,
  QueueCenterOverviewResponse,
  QueueCenterScope,
  SentenceAudioAutoStatus,
  SentenceAudioQueueSnapshot,
  TranslationQueueResponse,
  TtsStatus,
  WordTtsAutoStatus,
} from '../../../core/api-libs/pycore';
import { laravelApi } from '../../../core/api-libs/laravel';
import {
  ensurePycoreCapabilities,
  getPycoreCapabilityState,
} from './PycoreCapabilityStore';

export interface QueueCenterExchangeResult {
  generatedAt: string;
  pycoreReachable: boolean;
  laravelReachable: boolean;
  overview: PcQueueOverview | null;
  translation: TranslationQueueResponse | null;
  sentenceQueue: SentenceAudioQueueSnapshot | null;
  wordAudio: WordTtsAutoStatus | null;
  sentenceAudio: SentenceAudioAutoStatus | null;
  assist: AssistStatus | null;
  tts: TtsStatus | null;
  recent: PcTaskRecentResponse | null;
  workerApiUrl: string | null;
  sectionContracts: Record<QueueCenterScope, QueueCenterSectionContract>;
  errors: Record<string, string>;
}

function valueOf<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

function errorOf(result: PromiseSettledResult<unknown>, fallback: string): string {
  if (result.status === 'fulfilled') return '';
  return result.reason instanceof Error && result.reason.message
    ? result.reason.message
    : fallback;
}

function queueMetrics(
  overview: PcQueueOverview | null,
  scope: QueueCenterScope,
): QueueCenterSectionContract['queue'] {
  const keys = QUEUE_CENTER_CONTRACT.section_scopes[scope].category_keys;
  const categories = (overview?.categories ?? []).filter((category) => keys.includes(category.key));
  return categories.reduce(
    (totals, category) => ({
      pending: totals.pending + Number(category.pending || 0),
      processing: totals.processing + Number(category.processing || 0),
      leased: totals.leased + Number(category.leased || 0),
      total: totals.total + Number(category.total || 0),
    }),
    { pending: 0, processing: 0, leased: 0, total: 0 },
  );
}

function composeSections(
  generatedAt: string,
  overview: PcQueueOverview | null,
  queueOverview: QueueCenterOverviewResponse | null,
  assist: AssistStatus | null,
  wordAudio: WordTtsAutoStatus | null,
  sentenceAudio: SentenceAudioAutoStatus | null,
): Record<QueueCenterScope, QueueCenterSectionContract> {
  const sections = buildDefaultQueueCenterSections(generatedAt);
  const assistEnabled = assist?.processor_enabled
    ?? !!(assist?.enabled && assist.capabilities?.translation);
  const wordEnabled = wordAudio?.processor_enabled ?? wordAudio?.auto_start ?? false;
  const sentenceEnabled = sentenceAudio?.processor_enabled
    ?? sentenceAudio?.auto_start
    ?? false;
  Object.keys(sections).forEach((scopeKey) => {
    const scope = scopeKey as QueueCenterScope;
    sections[scope].queue = queueMetrics(overview, scope);
  });
  (['word_audio', 'sentence_audio'] as const).forEach((scope) => {
    const metrics = queueOverview?.queues?.[scope];
    if (!metrics) return;
    const pending = Number(metrics.pending || 0);
    const processing = Number(metrics.processing || 0);
    const leased = Number(metrics.assigned || 0);
    sections[scope].queue = {
      pending,
      processing,
      leased,
      total: pending + leased + processing,
    };
  });

  sections.assist_translation.worker = {
    online: assistEnabled,
    claimed: Number(assist?.counters?.claimed || 0),
    ok: assist ? Number(assist.counters.submitted || 0) : null,
    fail: assist ? Number(assist.counters.failures || 0) : null,
    last_heartbeat: assist?.last_cycle_at ?? null,
  };
  sections.assist_translation.toggle.enabled = assistEnabled;
  sections.assist_translation.lifecycle = assist?.last_error
    ? 'error'
    : assistEnabled ? 'on' : 'off';
  sections.assist_translation.last_error = assist?.last_error ?? null;

  sections.word_audio.worker = {
    online: wordEnabled,
    claimed: Number(wordAudio?.worker?.total_claimed || 0),
    ok: wordAudio ? Number(wordAudio.worker?.total_succeeded || 0) : null,
    fail: wordAudio ? Number(wordAudio.worker?.total_failed || 0) : null,
    last_heartbeat: null,
  };
  sections.word_audio.toggle.enabled = wordEnabled;
  sections.word_audio.lifecycle = wordEnabled ? 'on' : 'off';

  sections.sentence_audio.worker = {
    online: sentenceEnabled,
    claimed: Number(sentenceAudio?.worker?.total_claimed || 0),
    ok: sentenceAudio ? Number(sentenceAudio.worker?.total_succeeded || 0) : null,
    fail: sentenceAudio ? Number(sentenceAudio.worker?.total_failed || 0) : null,
    last_heartbeat: null,
  };
  sections.sentence_audio.toggle.enabled = sentenceEnabled;
  sections.sentence_audio.lifecycle = sentenceEnabled ? 'on' : 'off';

  sections.media_image.worker.online = (overview?.workers ?? []).some((worker) => worker.online);
  sections.media_image.lifecycle = sections.media_image.worker.online ? 'on' : 'off';
  return sections;
}

export class QueueCenterExchangeAPI {
  async read(): Promise<QueueCenterExchangeResult> {
    const results = await Promise.allSettled([
      laravelApi.getQueueOverview(),
      laravelApi.getQueueCenterOverview(),
      laravelApi.getTranslationQueue(),
      laravelApi.getSentenceAudioQueue(),
      pycoreApi.getWordTtsAutoStatus(),
      pycoreApi.getSentenceAudioAutoStatus(),
      pycoreApi.getAssistStatus(),
      ensurePycoreCapabilities(),
    ]);
    const [
      overviewResult,
      queueOverviewResult,
      translationResult,
      sentenceQueueResult,
      wordAudioResult,
      sentenceAudioResult,
      assistResult,
      capabilityResult,
    ] = results;
    const generatedAt = new Date().toISOString();
    const queueOverview = valueOf(queueOverviewResult) as QueueCenterOverviewResponse | null;
    const overviewPayload = valueOf(overviewResult) as PcQueueOverview | null;
    const overview = overviewPayload
      ? {
          ...overviewPayload,
          laravel_reachable: true,
          laravel_snapshot_age_s: 0,
          source: 'laravel',
          degraded: false,
          engines: overviewPayload.engines ?? {},
        }
      : null;
    const translation = valueOf(translationResult) as TranslationQueueResponse | null;
    const wordAudio = valueOf(wordAudioResult) as WordTtsAutoStatus | null;
    const sentenceAudio = valueOf(sentenceAudioResult) as SentenceAudioAutoStatus | null;
    const assist = valueOf(assistResult) as AssistStatus | null;
    const tts = getPycoreCapabilityState().tts;
    const queuePayload = valueOf(sentenceQueueResult) as SentenceAudioQueueSnapshot | null;
    const sentenceQueue = queuePayload
      ? { ...queuePayload, worker: sentenceAudio?.worker }
      : null;
    const laravelReachable = results.slice(0, 4).some((result) => result.status === 'fulfilled');
    const pycoreReachable = results.slice(4, 7).some((result) => result.status === 'fulfilled')
      || (capabilityResult.status === 'fulfilled' && tts !== null);
    const errors: Record<string, string> = {};

    if (overviewResult.status === 'rejected') {
      errors.overview = errorOf(overviewResult, 'LARAVEL_OVERVIEW_UNAVAILABLE');
    }
    if (queueOverviewResult.status === 'rejected') {
      errors.queue_metrics = errorOf(queueOverviewResult, 'LARAVEL_QUEUE_METRICS_UNAVAILABLE');
    }
    if (translationResult.status === 'rejected') {
      errors.translation = errorOf(translationResult, 'LARAVEL_TRANSLATION_QUEUE_UNAVAILABLE');
    }
    if (sentenceQueueResult.status === 'rejected') {
      errors.sentence_queue = errorOf(sentenceQueueResult, 'LARAVEL_SENTENCE_QUEUE_UNAVAILABLE');
    }
    if (!pycoreReachable) {
      errors.pycore = errorOf(wordAudioResult, 'PYCORE_RUNTIME_UNAVAILABLE');
    }

    return {
      generatedAt,
      pycoreReachable,
      laravelReachable,
      overview,
      translation,
      sentenceQueue,
      wordAudio,
      sentenceAudio,
      assist,
      tts,
      recent: null,
      workerApiUrl: assist?.endpoint?.base_url ?? null,
      sectionContracts: composeSections(
        generatedAt,
        overview,
        queueOverview,
        assist,
        wordAudio,
        sentenceAudio,
      ),
      errors,
    };
  }
}

export const queueCenterExchangeApi = new QueueCenterExchangeAPI();
