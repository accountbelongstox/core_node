import { laravelApi } from '../../../core/integrations/laravel';
import { pycoreApi } from '../../../core/integrations/pycore';
import {
  QUEUE_CENTER_QUEUE_POSITION_CONTROLS,
  buildDefaultQueueCenterSections,
} from '../../../core/contracts/QueueCenterContract';
import type {
  AssistOverviewResponse,
} from '../../../core/integrations/laravel';
import type {
  AssistStatus,
  PcQueueOverview,
  PcTaskRecentResponse,
  QueueCenterSectionContract,
  QueueCenterScope,
  SentenceAudioAutoStatus,
  SentenceAudioQueueSnapshot,
  TranslationQueueResponse,
  TtsStatus,
  WordTtsAutoStatus,
} from '../../../core/integrations/pycore';

export interface QueueCenterCacheMeta {
  warm?: boolean;
  revision?: number;
  stream_cursor?: number;
  realtime_connected?: boolean;
  last_remote_refresh_at?: number;
  last_refresh_attempt_at?: number;
  source?: string;
}

interface QueueCenterSnapshotPayload {
  generatedAt?: string;
  pycoreReachable?: boolean;
  laravelReachable?: boolean;
  overview?: PcQueueOverview | null;
  translation?: TranslationQueueResponse | null;
  sentenceQueue?: SentenceAudioQueueSnapshot | null;
  wordAudio?: WordTtsAutoStatus | null;
  sentenceAudio?: SentenceAudioAutoStatus | null;
  assist?: AssistStatus | null;
  tts?: TtsStatus | null;
  recent?: PcTaskRecentResponse | null;
  workerApiUrl?: string | null;
  laravelActiveEndpoint?: string | null;
  laravelSnapshotAgeS?: number | null;
  sectionContracts?: Partial<Record<QueueCenterScope, QueueCenterSectionContract>>;
  errors?: Record<string, string>;
  cache?: QueueCenterCacheMeta;
}

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
  laravelActiveEndpoint: string | null;
  laravelSnapshotAgeS: number | null;
  sectionContracts: Record<QueueCenterScope, QueueCenterSectionContract>;
  errors: Record<string, string>;
  cache: QueueCenterCacheMeta;
}

export class QueueCenterExchangeAPI {
  async read(refresh = false): Promise<QueueCenterExchangeResult> {
    // Architecture v3: browser reads Laravel-owned queue data directly;
    // pycore only supplies its own worker/control state. This removes the
    // pycore-side Laravel mirror that competed for HTTP workers and caused
    // the "pycore connected -> wordnew times out" mutual blocking.
    const [
      localResult,
      overviewResult,
      translationResult,
      sentenceResult,
      queueCenterResult,
    ] = await Promise.allSettled([
      pycoreApi.getQueueCenterSnapshot(refresh),
      laravelApi.getAssistOverview(),
      laravelApi.getTranslationQueue(),
      laravelApi.getSentenceAudioQueue(),
      laravelApi.getQueueCenterOverview(),
    ]);

    const errors: Record<string, string> = {};

    const localSnapshot = this._unwrapLocal(localResult, errors);
    let overview = this._unwrapOverview(overviewResult, errors);
    const translation = this._unwrapTranslation(translationResult, errors);
    const sentenceQueue = this._unwrapSentenceQueue(sentenceResult, errors);
    const queueCenterOverview = queueCenterResult.status === 'fulfilled'
      ? queueCenterResult.value
      : null;
    if (queueCenterResult.status === 'rejected') {
      errors.queue_metrics = String(queueCenterResult.reason || 'queue_metrics_unavailable');
    }

    const generatedAt = String(localSnapshot?.generatedAt || new Date().toISOString());
    const sectionContracts = {
      ...buildDefaultQueueCenterSections(generatedAt),
      ...(localSnapshot?.sectionContracts || {}),
    } as Record<QueueCenterScope, QueueCenterSectionContract>;

    // pycore no longer mirrors Laravel queue rows, so its sectionContracts
    // carry no queue metrics. Patch them from the queue-center overview the
    // browser fetched directly.
    if (queueCenterOverview !== null) {
      const queues = queueCenterOverview.queues || {};
      if (overview !== null) {
        overview = {
          ...overview,
          workers: Array.isArray(queueCenterOverview.workers)
            ? queueCenterOverview.workers
            : overview.workers,
          categories: (overview.categories || []).map((category) => {
            const stats = queues[category.key];
            if (!stats) return category;
            const pending = Number(stats.pending || 0);
            const leased = Number(stats.assigned || 0);
            const processing = Number(stats.processing || 0);
            return {
              ...category,
              pending,
              leased,
              processing,
              total: Number(stats.total ?? pending + leased + processing),
            };
          }),
        };
      }
      for (const scope of QUEUE_CENTER_QUEUE_POSITION_CONTROLS) {
        const stats = queues[scope];
        if (!stats || !sectionContracts[scope]) {
          continue;
        }
        const pending = Number(stats.pending || 0);
        const leased = Number(stats.assigned || 0);
        const processing = Number(stats.processing || 0);
        sectionContracts[scope] = {
          ...sectionContracts[scope],
          queue: { pending, leased, processing, total: pending + leased + processing },
        };
      }
    }

    const laravelReachable = overview !== null
      || translation !== null
      || sentenceQueue !== null
      || queueCenterOverview !== null;

    return {
      generatedAt,
      pycoreReachable: localSnapshot?.pycoreReachable !== false,
      laravelReachable,
      overview,
      translation,
      sentenceQueue,
      wordAudio: localSnapshot?.wordAudio ?? null,
      sentenceAudio: localSnapshot?.sentenceAudio ?? null,
      assist: localSnapshot?.assist ?? null,
      tts: localSnapshot?.tts ?? null,
      recent: localSnapshot?.recent ?? null,
      workerApiUrl: typeof localSnapshot?.workerApiUrl === 'string'
        ? localSnapshot.workerApiUrl
        : null,
      laravelActiveEndpoint: typeof localSnapshot?.laravelActiveEndpoint === 'string'
        ? localSnapshot.laravelActiveEndpoint
        : null,
      laravelSnapshotAgeS: typeof localSnapshot?.laravelSnapshotAgeS === 'number'
        ? localSnapshot.laravelSnapshotAgeS
        : null,
      sectionContracts,
      errors,
      cache: localSnapshot?.cache && typeof localSnapshot.cache === 'object'
        ? localSnapshot.cache
        : {},
    };
  }

  private _unwrapLocal(
    result: PromiseSettledResult<{ success?: boolean; data?: Record<string, unknown>; error?: string }>,
    errors: Record<string, string>,
  ): QueueCenterSnapshotPayload | null {
    if (result.status === 'rejected' || !result.value?.success || !result.value.data) {
      errors.pycore = result.status === 'rejected'
        ? String(result.reason || 'pycore snapshot rejected')
        : result.value?.error || 'pycore snapshot unavailable';
      return null;
    }
    return result.value.data as QueueCenterSnapshotPayload;
  }

  private _unwrapOverview(
    result: PromiseSettledResult<AssistOverviewResponse>,
    errors: Record<string, string>,
  ): PcQueueOverview | null {
    if (result.status === 'rejected' || !result.value?.success) {
      errors.overview = result.status === 'rejected'
        ? String(result.reason || 'overview rejected')
        : result.value?.error || 'overview unavailable';
      return null;
    }
    return (result.value as unknown) as PcQueueOverview;
  }

  private _unwrapTranslation(
    result: PromiseSettledResult<TranslationQueueResponse>,
    errors: Record<string, string>,
  ): TranslationQueueResponse | null {
    if (result.status === 'rejected') {
      errors.translation = String(result.reason || 'translation queue rejected');
      return null;
    }
    return result.value;
  }

  private _unwrapSentenceQueue(
    result: PromiseSettledResult<SentenceAudioQueueSnapshot>,
    errors: Record<string, string>,
  ): SentenceAudioQueueSnapshot | null {
    if (result.status === 'rejected') {
      errors.sentence_queue = String(result.reason || 'sentence queue rejected');
      return null;
    }
    return result.value;
  }
}

export const queueCenterExchangeApi = new QueueCenterExchangeAPI();
