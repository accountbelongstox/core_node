/**
 * Shared Queue Center section + panel contracts (used by PcQueueCenterPage and
 * the section body panels).
 *
 * All UI traffic uses HTTP API. The canonical structure and runtime defaults are
 * in the Pycore Manager API boundary, backed by
 * config/queue_center_contract.json.
 */
import type React from 'react';
import { LayoutGrid, Languages, AudioLines, MessageSquareText, History } from 'lucide-react';
import type {
  QueueCenterScope,
  QueueCenterSectionContract,
  QueueCenterSectionLifecycle,
  QueueCenterControlMetrics,
  QueueCenterWorkerMetrics,
} from '@/apps/pycore-manager/api';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';

/** Single-page section keys. Legacy ?tab= values map 1:1 onto these anchors. */
export type QcSection = 'overview' | 'translation' | 'wordAudio' | 'sentence' | 'recent';

export type QcSectionScope = QueueCenterScope;

export type QueueSectionLifecycle = QueueCenterSectionLifecycle;

export type QcQueueMetrics = QueueCenterControlMetrics;
export type QcWorkerMetrics = QueueCenterWorkerMetrics;
export type QcSectionContract = QueueCenterSectionContract;

export type QcSectionContracts = Record<QcSectionScope, QcSectionContract>;

/** Props shared by every Queue Center section body panel. */
export interface QueueCenterPanelProps {
  refreshTick?: number;
}

export const QC_AUTO_KEY = StorageKeys.PYCORE_QUEUE_CENTER_AUTO;
export const QC_DRAWER_KEY = StorageKeys.PYCORE_QUEUE_CENTER_DRAWER;

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
