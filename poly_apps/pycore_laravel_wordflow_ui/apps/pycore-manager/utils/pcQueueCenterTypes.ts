/**
 * Shared Queue Center section + panel contracts (used by PcQueueCenterPage and
 * the section body panels).
 *
 * FE ↔ BE endpoint map (pycore-manager Queue Center):
 *   hub          GET /api/local/task-center/snapshot → QueueCenterSnapshot
 *   overview     GET /api/local/queue/overview       → PcQueueOverview
 *   translation  GET /api/local/translation/queue    → cached monitor snapshot
 *   sentence     GET /api/local/sentence-audio/queue → SentenceAudioQueueSnapshot
 *   recent       GET /api/local/tasks/recent         → PcTaskRecentResponse
 *   assist strip GET /api/local/assist/status         → AssistStatus
 */
import type React from 'react';
import { LayoutGrid, Languages, AudioLines, MessageSquareText, History } from 'lucide-react';
import type {
  QueueCenterScope,
  QueueCenterSectionContract,
  QueueCenterSectionLifecycle,
  QueueCenterControlMetrics,
  QueueCenterWorkerMetrics,
} from '../../../core/api-libs/pycore/pycoreTypes';

/** Single-page section keys. Legacy ?tab= values map 1:1 onto these anchors. */
export type QcSection = 'overview' | 'translation' | 'wordAudio' | 'sentence' | 'recent';

export type QcSectionScope = QueueCenterScope;

export type QueueSectionLifecycle = QueueCenterSectionLifecycle;

export type QcQueueMetrics = QueueCenterControlMetrics;
export type QcWorkerMetrics = QueueCenterWorkerMetrics;
export type QcSectionContract = QueueCenterSectionContract;

export type QcSectionContracts = Record<QcSectionScope, QcSectionContract>;

export const QUEUE_SECTION_SCOPE_MAP: Record<string, QcSectionScope> = {
  assist: 'assist_translation',
  translation: 'assist_translation',
  heartbeat: 'heartbeat',
  heartbeat_workers: 'heartbeat',
  word_audio: 'word_audio',
  wordTts: 'word_audio',
  sentence_audio: 'sentence_audio',
  sentenceAudio: 'sentence_audio',
  media_image: 'media_image',
  image: 'media_image',
  cover: 'media_image',
};

export const QC_SCOPE_LABELS: Record<QcSectionScope, string> = {
  heartbeat: 'heartbeat',
  assist_translation: 'assist_translation',
  word_audio: 'word_audio',
  sentence_audio: 'sentence_audio',
  media_image: 'media_image',
};

export function buildEmptyQueueContract(updatedAt: string | null): QcSectionContract {
  return {
    type: 'media_image',
    category: 'fallback',
    queue: { pending: 0, processing: 0, leased: 0, total: 0 },
    worker: { online: false, claimed: 0, ok: 0, fail: 0, last_heartbeat: null },
    toggle: { requested_by: null, paused_by_user: null, enabled: false, reason: null, graceful_stop: false },
    error_code: null,
    last_error: null,
    updated_at: updatedAt,
    lifecycle: 'off',
  };
}

export function buildDefaultSectionContracts(updatedAt: string | null = null): QcSectionContracts {
  const contract: QcSectionContracts = {
    heartbeat: {
      ...buildEmptyQueueContract(updatedAt),
      type: 'heartbeat',
      category: 'heartbeat_workers',
      worker: { ...buildEmptyQueueContract(updatedAt).worker, online: false },
      toggle: {
        ...buildEmptyQueueContract(updatedAt).toggle,
        enabled: false,
        requested_by: 'system',
      },
      lifecycle: 'off',
    },
    assist_translation: {
      ...buildEmptyQueueContract(updatedAt),
      type: 'assist_translation',
      category: 'assist_translation',
      toggle: {
        ...buildEmptyQueueContract(updatedAt).toggle,
        enabled: false,
        requested_by: 'system',
      },
      lifecycle: 'off',
    },
    word_audio: {
      ...buildEmptyQueueContract(updatedAt),
      type: 'word_audio',
      category: 'word_audio',
      toggle: {
        ...buildEmptyQueueContract(updatedAt).toggle,
        enabled: false,
        requested_by: 'system',
      },
      lifecycle: 'off',
    },
    sentence_audio: {
      ...buildEmptyQueueContract(updatedAt),
      type: 'sentence_audio',
      category: 'sentence_audio',
      toggle: {
        ...buildEmptyQueueContract(updatedAt).toggle,
        enabled: false,
        requested_by: 'system',
      },
      lifecycle: 'off',
    },
    media_image: {
      ...buildEmptyQueueContract(updatedAt),
      type: 'media_image',
      category: 'media_image',
      toggle: {
        ...buildEmptyQueueContract(updatedAt).toggle,
        enabled: false,
        requested_by: 'system',
      },
      lifecycle: 'off',
    },
  };
  return contract;
}

/** Props shared by every Queue Center section body panel. */
export interface QueueCenterPanelProps {
  refreshTick?: number;
}

export const QC_AUTO_KEY = 'pc_qc_auto';
export const QC_DRAWER_KEY = 'pc_qc_drawer';
export const QC_AUTO_REFRESH_MS = 5000;
export const QC_ASSIST_POLL_MS = 15000;
export const QC_TTS_POLL_MS = 8000;

/** DOM anchor id for a section (legacy ?tab= links scroll here). */
export const qcSectionAnchor = (key: QcSection): string => `qc-section-${key}`;

export const QC_SECTION_DEFS: { key: QcSection; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', Icon: LayoutGrid },
  { key: 'translation', Icon: Languages },
  { key: 'wordAudio', Icon: AudioLines },
  { key: 'sentence', Icon: MessageSquareText },
  { key: 'recent', Icon: History },
];

/** Accepts both section keys and the legacy ?tab= values (identical except wordAudio). */
export function isQcSection(v: string | null): v is QcSection {
  return v === 'overview' || v === 'translation' ||
    v === 'wordAudio' || v === 'sentence' || v === 'recent';
}
