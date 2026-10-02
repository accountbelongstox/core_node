import { useEffect, useState } from 'react';
import { laravelApi, pycoreApi } from '@/apps/pycore-manager/api';
import type { PcTaskRecord } from '@/apps/pycore-manager/api';
import { TypedEventEmitter } from '../../../core/events/TypedEventEmitter';
import {
    GLOBAL_TASK_HISTORY_BUCKETS,
    GLOBAL_TASK_LIMITS,
    normalizeGlobalTaskHistoryType,
} from '@/apps/pycore-manager/api';
import { StorageManager } from '../../../core/persistence';
import { PycoreManagerStorageKeys as StorageKeys } from '../persistence/PycoreManagerStorageKeys';
import { QUEUE_CENTER_DIFF_DELIVERY } from '../../../core/contracts/QueueCenterContract';
import { pcCaughtErrorMessage, pcFailureMessage, pcLaravelErrorMessage } from '../utils/pcErrorCodes';
import { pcT } from '../utils/pcI18n';

export type CanonicalCompletedTaskType = (typeof GLOBAL_TASK_HISTORY_BUCKETS)[number];
export type CompletedTaskType = 'all' | CanonicalCompletedTaskType;

const SENTENCE_CONCURRENCY_LIMIT = QUEUE_CENTER_DIFF_DELIVERY.consumer_batch_limits.sentence_audio;

const recentErrorText = (key: string): string => pcT(`queueCenter.recent.errors.${key}`);

const normalizeCompletedTaskType = (rawType: string): CanonicalCompletedTaskType => {
    return normalizeGlobalTaskHistoryType(rawType);
};

const toCanonicalCounts = (raw: Record<string, number> | undefined): Record<CanonicalCompletedTaskType, number> => {
    const out = Object.fromEntries(
        GLOBAL_TASK_HISTORY_BUCKETS.map((bucket) => [bucket, 0]),
    ) as Record<CanonicalCompletedTaskType, number>;
    if (!raw) return out;
    Object.entries(raw).forEach(([taskType, count]) => {
        const n = typeof count === 'number' && Number.isFinite(count) ? count : 0;
        out[normalizeCompletedTaskType(taskType)] += n;
    });
    return out;
};

export interface TaskCenterStateEventMap {
    change: void;
}

export class PycoreTaskCenterStateService {
    private readonly emitter = new TypedEventEmitter<TaskCenterStateEventMap>('TaskCenterState');

    // --- Recent Tasks State ---
    public recentRecords: PcTaskRecord[] = [];
    /** Position of each record in `recentRecords` by archive / task id (kept, not rebuilt per page). */
    private recentIndex = new Map<string, number>();
    public recentTypes: Record<CanonicalCompletedTaskType, number> = toCanonicalCounts(undefined);
    public recentResourceCount = 0;
    public recentLastSyncAt: string | null = null;
    public recentNextCursorId: number | null = null;
    public recentLoading = false;
    public recentSyncing = false;
    public recentErr: string | null = null;
    private initialSyncStarted = false;

    public sentenceActionErr: string | null = null;

    on(fn: () => void): () => void {
        return this.emitter.on('change', fn);
    }

    private emit() {
        this.emitter.emit('change', undefined);
    }

    ingestRecent(data: any) {
        if (!data) return;
        const fetched = data.records ?? [];
        const newRecords = [...fetched];
        const fetchedIds = new Set(fetched.map((r: any) => r.archive_id || r.task_id));
        for (const record of this.recentRecords) {
            if (!fetchedIds.has(record.archive_id || record.task_id)) {
                newRecords.push(record);
            }
        }
        this.recentRecords = newRecords;
        this.recentIndex = new Map(newRecords.map((record, index) => [record.archive_id || record.task_id, index]));
        if (data.types && typeof data.types === 'object' && !Array.isArray(data.types)) {
            this.recentTypes = toCanonicalCounts(data.types as Record<string, number>);
        }
        this.recentResourceCount = data.resource_count ?? 0;
        this.recentLastSyncAt = data.last_sync_at ?? null;
        if (Object.prototype.hasOwnProperty.call(data, 'next_cursor_id')) {
            this.recentNextCursorId = data.next_cursor_id ?? null;
        }
        this.emit();
    }

    async initialSync() {
        if (this.initialSyncStarted) return;
        this.initialSyncStarted = true;
        this.recentLoading = true;
        this.emit();
        try {
            const results = await Promise.allSettled([
                laravelApi.getCompletedTaskHistory({
                    limit: GLOBAL_TASK_LIMITS.history_records,
                    cursor_id: 0,
                    include_types: true,
                }),
                pycoreApi.getRecentTasks({ limit: GLOBAL_TASK_LIMITS.history_records }),
            ]);
            const laravelResult = results[0];
            const localResult = results[1];
            if (laravelResult.status === 'rejected' && localResult.status === 'rejected') {
                throw laravelResult.reason;
            }
            const laravelValue = laravelResult.status === 'fulfilled' ? laravelResult.value : null;
            const localItems = localResult.status === 'fulfilled' ? localResult.value.items ?? [] : [];
            const localValue = localResult.status === 'fulfilled' ? localResult.value : null;
            const syncResult = laravelValue
                ? { ...laravelValue, records: [...(laravelValue.records ?? []), ...localItems] }
                : localValue ? { ...localValue, records: localItems } : null;
            if (!syncResult) return;
            this.ingestRecent(syncResult);
            if (laravelResult.status === 'rejected') {
                this.recentErr = pcLaravelErrorMessage(laravelResult.reason, recentErrorText('laravelUnavailable'));
            }
        } catch (syncError: unknown) {
            this.recentErr = pcLaravelErrorMessage(syncError, recentErrorText('syncFailed'));
        } finally {
            this.recentLoading = false;
        }
        this.emit();
    }

    async syncArchive() {
        if (this.recentSyncing) return;
        this.recentSyncing = true;
        this.recentErr = null;
        this.emit();
        try {
            const result = await laravelApi.getCompletedTaskHistory({
                limit: GLOBAL_TASK_LIMITS.history_records,
                cursor_id: 0,
                include_types: true,
            });
            this.ingestRecent(result);
        } catch (e: unknown) {
            this.recentErr = pcLaravelErrorMessage(e, recentErrorText('archiveSyncFailed'));
        } finally {
            this.recentSyncing = false;
            this.emit();
        }
    }

    async loadMoreArchive() {
        if (this.recentLoading || this.recentNextCursorId == null) return;
        this.recentLoading = true;
        this.recentErr = null;
        this.emit();
        try {
            const data = await laravelApi.getCompletedTaskHistory({
                limit: GLOBAL_TASK_LIMITS.history_records,
                cursor_id: this.recentNextCursorId,
            });
            const fetched = data.records ?? [];
            const records = this.recentRecords.slice();
            for (const record of fetched) {
                const id = record.archive_id || record.task_id;
                const at = this.recentIndex.get(id);
                if (at === undefined) {
                    this.recentIndex.set(id, records.length);
                    records.push(record);
                } else {
                    records[at] = record;
                }
            }
            this.recentRecords = records;
            if (data.types && typeof data.types === 'object' && !Array.isArray(data.types)) {
                this.recentTypes = toCanonicalCounts(data.types as Record<string, number>);
            }
            this.recentNextCursorId = data.next_cursor_id ?? null;
        } catch (e: unknown) {
            this.recentErr = pcLaravelErrorMessage(e, recentErrorText('archiveUnavailable'));
        } finally {
            this.recentLoading = false;
            this.emit();
        }
    }

    async setSentenceAudioConcurrency(
        raw: string,
        autoStart: boolean,
        refreshHub: () => Promise<void>,
        fallbackError: string,
    ) {
        StorageManager.set(StorageKeys.PYCORE_SENTENCE_WORKER_CONCURRENCY, raw);
        const n = Math.min(SENTENCE_CONCURRENCY_LIMIT, Math.max(0, parseInt(raw, 10) || 0));
        this.sentenceActionErr = null;
        this.emit();
        try {
            const response = await pycoreApi.setSentenceAudioConfig({ auto_start: autoStart, concurrency: n });
            if (response?.success === false) {
                this.sentenceActionErr = pcFailureMessage(response, fallbackError);
                this.emit();
                return;
            }
            await refreshHub();
        } catch (e: unknown) {
            this.sentenceActionErr = pcCaughtErrorMessage(e, fallbackError);
            this.emit();
        }
    }

    async setSentenceAudioSpeaker(
        speaker: string,
        autoStart: boolean,
        concurrencyRaw: string,
        refreshHub: () => Promise<void>,
        fallbackError: string,
    ) {
        StorageManager.set(StorageKeys.PYCORE_SENTENCE_QWEN_SPEAKER, speaker);
        const concurrency = Math.min(
            SENTENCE_CONCURRENCY_LIMIT,
            Math.max(0, parseInt(concurrencyRaw, 10) || 0),
        );
        this.sentenceActionErr = null;
        this.emit();
        try {
            const response = await pycoreApi.setSentenceAudioConfig({
                auto_start: autoStart,
                concurrency,
                speaker,
            });
            if (response?.success === false) {
                this.sentenceActionErr = pcFailureMessage(response, fallbackError);
                this.emit();
                return;
            }
            await refreshHub();
        } catch (e: unknown) {
            this.sentenceActionErr = pcCaughtErrorMessage(e, fallbackError);
            this.emit();
        }
    }
}

export const pycoreTaskCenterState = new PycoreTaskCenterStateService();

export function usePycoreTaskCenterState(): PycoreTaskCenterStateService {
    const [, setTick] = useState(0);
    useEffect(() => {
        return pycoreTaskCenterState.on(() => setTick((t) => t + 1));
    }, []);
    return pycoreTaskCenterState;
}
