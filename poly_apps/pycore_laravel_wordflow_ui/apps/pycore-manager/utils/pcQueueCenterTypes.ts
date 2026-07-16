/**
 * Shared Queue Center tab + panel contracts (used by PcQueueCenterPage and tab panels).
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
  LayoutGrid, Layers, ListChecks, Languages, MessageSquareText, History,
} from 'lucide-react';

export type QcTab = 'overview' | 'manager' | 'tasks' | 'translation' | 'sentence' | 'recent';

export interface PanelMeta {
  count: number | null;
  loading: boolean;
}

/** Props shared by every Queue Center tab body panel. */
export interface QueueCenterPanelProps {
  refreshTick?: number;
  onMeta?: (meta: PanelMeta) => void;
}

export const QC_TAB_KEY = 'pc_qc_tab';
export const QC_AUTO_KEY = 'pc_qc_auto';
export const QC_DRAWER_KEY = 'pc_qc_drawer';
export const QC_AUTO_REFRESH_MS = 5000;
export const QC_ASSIST_POLL_MS = 15000;
export const QC_TTS_POLL_MS = 8000;

export const QC_TAB_DEFS: { key: QcTab; Icon: React.FC<{ className?: string }> }[] = [
  { key: 'overview', Icon: LayoutGrid },
  { key: 'manager', Icon: Layers },
  { key: 'tasks', Icon: ListChecks },
  { key: 'translation', Icon: Languages },
  { key: 'sentence', Icon: MessageSquareText },
  { key: 'recent', Icon: History },
];

export function isQcTab(v: string | null): v is QcTab {
  return v === 'overview' || v === 'manager' || v === 'tasks' ||
    v === 'translation' || v === 'sentence' || v === 'recent';
}
