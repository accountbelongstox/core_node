/**
 * Shared Queue Center section + panel contracts (used by PcQueueCenterPage and
 * the section body panels).
 *
 * FE ↔ BE endpoint map (pycore-manager Queue Center):
 *   hub          GET /api/local/task-center          → PcTaskCenterResponse
 *   overview     GET /api/local/queue/overview       → PcQueueOverview
 *   tasks        GET /voice-subtitle/tasks           → local TaskManager list
 *   translation  GET /api/local/translation/queue    → cached monitor snapshot
 *   sentence     GET /api/local/sentence-audio/queue → SentenceAudioQueueSnapshot
 *   recent       GET /api/local/tasks/recent         → PcTaskRecentResponse
 *   assist strip GET /api/local/assist/status         → AssistStatus
 *   manager      GET /voice-subtitle/queue           → voice-subtitle queue
 */
import type React from 'react';
import {
  LayoutGrid, Layers, ListChecks, Languages, AudioLines, MessageSquareText, History,
} from 'lucide-react';

/** Single-page section keys. Legacy ?tab= values map 1:1 onto these anchors. */
export type QcSection = 'overview' | 'manager' | 'tasks' | 'translation' | 'wordAudio' | 'sentence' | 'recent';

export interface PanelMeta {
  count: number | null;
  loading: boolean;
}

/** Props shared by every Queue Center section body panel. */
export interface QueueCenterPanelProps {
  refreshTick?: number;
  onMeta?: (meta: PanelMeta) => void;
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
  { key: 'manager', Icon: Layers },
  { key: 'tasks', Icon: ListChecks },
  { key: 'translation', Icon: Languages },
  { key: 'wordAudio', Icon: AudioLines },
  { key: 'sentence', Icon: MessageSquareText },
  { key: 'recent', Icon: History },
];

/** Accepts both section keys and the legacy ?tab= values (identical except wordAudio). */
export function isQcSection(v: string | null): v is QcSection {
  return v === 'overview' || v === 'manager' || v === 'tasks' || v === 'translation' ||
    v === 'wordAudio' || v === 'sentence' || v === 'recent';
}
