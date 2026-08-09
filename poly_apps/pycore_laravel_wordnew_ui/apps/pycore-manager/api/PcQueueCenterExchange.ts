import { pycoreApi } from '../../../core/api-libs/pycore';
import { buildDefaultQueueCenterSections } from '../../../core/contracts/QueueCenterContract';
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
} from '../../../core/api-libs/pycore';

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
    const response = await pycoreApi.getQueueCenterSnapshot(refresh);
    if (!response?.success || !response.data) {
      throw new Error(response?.error || 'PYCORE_QUEUE_CENTER_SNAPSHOT_UNAVAILABLE');
    }
    const snapshot = response.data as QueueCenterSnapshotPayload;
    const generatedAt = String(snapshot.generatedAt || new Date().toISOString());
    const sectionContracts = {
      ...buildDefaultQueueCenterSections(generatedAt),
      ...(snapshot.sectionContracts || {}),
    } as Record<QueueCenterScope, QueueCenterSectionContract>;

    return {
      generatedAt,
      pycoreReachable: snapshot.pycoreReachable !== false,
      laravelReachable: snapshot.laravelReachable === true,
      overview: snapshot.overview ?? null,
      translation: snapshot.translation ?? null,
      sentenceQueue: snapshot.sentenceQueue ?? null,
      wordAudio: snapshot.wordAudio ?? null,
      sentenceAudio: snapshot.sentenceAudio ?? null,
      assist: snapshot.assist ?? null,
      tts: snapshot.tts ?? null,
      recent: snapshot.recent ?? null,
      workerApiUrl: typeof snapshot.workerApiUrl === 'string' ? snapshot.workerApiUrl : null,
      laravelActiveEndpoint: typeof snapshot.laravelActiveEndpoint === 'string'
        ? snapshot.laravelActiveEndpoint
        : null,
      laravelSnapshotAgeS: typeof snapshot.laravelSnapshotAgeS === 'number'
        ? snapshot.laravelSnapshotAgeS
        : null,
      sectionContracts,
      errors: snapshot.errors && typeof snapshot.errors === 'object' ? snapshot.errors : {},
      cache: snapshot.cache && typeof snapshot.cache === 'object' ? snapshot.cache : {},
    };
  }
}

export const queueCenterExchangeApi = new QueueCenterExchangeAPI();
