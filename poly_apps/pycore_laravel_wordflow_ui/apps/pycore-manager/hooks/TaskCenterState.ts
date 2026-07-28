import { useEffect, useState } from 'react';
import { pycoreApi } from '../../../core/api-libs/pycore';
import type { PcTaskRecord, PycoreGlobalTaskDetail } from '../../../core/api-libs/pycore';
import {
    GLOBAL_TASK_HISTORY_BUCKETS,
    normalizeGlobalTaskHistoryType,
} from '../../../core/api-libs/pycore/QueueCenterContract';

export type CanonicalCompletedTaskType = (typeof GLOBAL_TASK_HISTORY_BUCKETS)[number];
export type CompletedTaskType = 'all' | CanonicalCompletedTaskType;

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

class Emitter<M> {
    private map = new Map<keyof M, Set<(p: any) => void>>();
    on<K extends keyof M>(e: K, fn: (p: M[K]) => void): () => void {
        let s = this.map.get(e);
        if (!s) {
            s = new Set();
            this.map.set(e, s);
        }
        s.add(fn as any);
        return () => this.off(e, fn);
    }
    off<K extends keyof M>(e: K, fn: (p: M[K]) => void): void {
        this.map.get(e)?.delete(fn as any);
    }
    emit<K extends keyof M>(e: K, p: M[K]): void {
        const s = this.map.get(e);
        if (!s) return;
        for (const fn of Array.from(s)) {
            try {
                fn(p);
            } catch (err) {
                console.error('[TaskCenterState] listener error', err);
            }
        }
    }
    clear(): void {
        this.map.clear();
    }
}

export class TaskCenterStateService {
    private readonly emitter = new Emitter<TaskCenterStateEventMap>();

    // --- Recent Tasks State ---
    public recentRecords: PcTaskRecord[] = [];
    public recentTypes: Record<CanonicalCompletedTaskType, number> = toCanonicalCounts(undefined);
    public recentResourceCount = 0;
    public recentLastSyncAt: string | null = null;
    public recentNextOffset: number | null = null;
    public recentLoading = false;
    public recentSyncing = false;
    public recentErr: string | null = null;
    private initialSyncStarted = false;

    // --- Translation Queue State ---
    public translationBusyTask: string | null = null;
    public translationNotice: string | null = null;
    public translationStacking = false;
    public translationDetailLoading = false;
    public translationTaskDetail: PycoreGlobalTaskDetail | null = null;

    // --- Sentence Queue State ---
    public sentenceBusy = false;
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
        if (data.types && typeof data.types === 'object' && !Array.isArray(data.types)) {
            this.recentTypes = toCanonicalCounts(data.types as Record<string, number>);
        }
        this.recentResourceCount = data.resource_count ?? 0;
        this.recentLastSyncAt = data.last_sync_at ?? null;
        if (this.recentRecords.length <= fetched.length) {
            this.recentNextOffset = data.next_offset ?? null;
        }
        this.emit();
    }

    async initialSync(refreshHub: () => Promise<void>) {
        if (this.initialSyncStarted) return;
        this.initialSyncStarted = true;
        try {
            const syncResult = await pycoreApi.syncCompletedTasks();
            if (!syncResult.success) {
                this.recentErr = syncResult.error || 'Resource synchronization failed; showing the local archive';
            } else if (syncResult.partial) {
                this.recentErr = `Local archive synchronized; Laravel source unavailable: ${syncResult.laravel_error || 'unknown error'}`;
            }
            await refreshHub();
        } catch (syncError: any) {
            this.recentErr = syncError?.message || 'Resource synchronization failed; showing the local archive';
        }
        this.emit();
    }

    async syncArchive(refreshHub: () => Promise<void>) {
        if (this.recentSyncing) return;
        this.recentSyncing = true;
        this.recentErr = null;
        this.emit();
        try {
            const result = await pycoreApi.syncCompletedTasks();
            if (!result.success) throw new Error(result.error || 'Completed-task synchronization failed');
            if (result.partial) {
                this.recentErr = `Local archive synchronized; Laravel source unavailable: ${result.laravel_error || 'unknown error'}`;
            }
            await refreshHub();
        } catch (e: any) {
            this.recentErr = e?.message || 'Completed-task synchronization failed';
        } finally {
            this.recentSyncing = false;
            this.emit();
        }
    }

    async loadMoreArchive() {
        if (this.recentLoading || this.recentNextOffset == null) return;
        this.recentLoading = true;
        this.recentErr = null;
        this.emit();
        try {
            const data = await pycoreApi.getCompletedTasks({
                limit: 200,
                offset: this.recentNextOffset,
            });
            const fetched = data.records ?? [];
            const byId = new Map(this.recentRecords.map((record) => [record.archive_id || record.task_id, record]));
            for (const record of fetched) {
                byId.set(record.archive_id || record.task_id, record);
            }
            this.recentRecords = Array.from(byId.values());
            if (data.types && typeof data.types === 'object' && !Array.isArray(data.types)) {
                this.recentTypes = toCanonicalCounts(data.types as Record<string, number>);
            }
            this.recentNextOffset = data.next_offset ?? null;
        } catch (e: any) {
            this.recentErr = e?.message || 'Completed-task archive unavailable';
        } finally {
            this.recentLoading = false;
            this.emit();
        }
    }

    // --- Translation Queue Methods ---
    async fetchTranslationQueue(refresh: boolean, refreshHub: () => Promise<void>) {
        try {
            if (refresh) await pycoreApi.queueTranslation(true);
        } finally {
            await refreshHub();
        }
    }

    async changeTranslationPriority(taskId: string, next: number, refreshHub: () => Promise<void>) {
        this.translationBusyTask = taskId;
        this.emit();
        try {
            const r = await pycoreApi.setQueuePriority(taskId, next);
            if (r?.success === false) throw new Error(r?.error || 'Action failed');
            this.translationNotice = 'Priority updated';
            await this.fetchTranslationQueue(true, refreshHub);
        } catch (e: any) {
            this.translationNotice = `Action failed: ${e?.message || ''}`.trim();
        } finally {
            this.translationBusyTask = null;
            this.emit();
        }
    }

    async submitTranslationStack(words: string[], lang: string, target: string, refreshHub: () => Promise<void>) {
        if (words.length === 0) {
            this.translationNotice = 'Enter at least one word';
            this.emit();
            return;
        }
        this.translationStacking = true;
        this.emit();
        try {
            const r = await pycoreApi.stackQueue(words, lang.trim() || 'en', target.trim() || 'zh');
            if (r?.success === false) throw new Error(r?.error || 'Action failed');
            this.translationNotice = 'Words stacked at high priority';
            await this.fetchTranslationQueue(true, refreshHub);
        } catch (e: any) {
            this.translationNotice = `Action failed: ${e?.message || ''}`.trim();
        } finally {
            this.translationStacking = false;
            this.emit();
        }
    }

    async openTranslationTaskDetail(taskId: string, initialTaskDetail: PycoreGlobalTaskDetail) {
        this.translationDetailLoading = true;
        this.translationTaskDetail = initialTaskDetail;
        this.emit();
        try {
            const r = await pycoreApi.getTranslationTaskDetail(taskId);
            if (r?.success && r.task) {
                this.translationTaskDetail = r.task;
            }
        } catch {
            // Keep list-row snapshot.
        } finally {
            this.translationDetailLoading = false;
            this.emit();
        }
    }

    closeTranslationTaskDetail() {
        this.translationTaskDetail = null;
        this.translationDetailLoading = false;
        this.emit();
    }

    clearTranslationNotice() {
        this.translationNotice = null;
        this.emit();
    }

    // --- Sentence Queue Methods ---
    async runSentenceAudioOnce(refreshHub: () => Promise<void>) {
        this.sentenceBusy = true;
        this.sentenceActionErr = null;
        this.emit();
        try {
            const result = await pycoreApi.runSentenceAudioOnce();
            if (!result?.ok) throw new Error(result?.error || 'run-once rejected');
            await refreshHub();
        } catch (e: any) {
            this.sentenceActionErr = e?.message || 'run-once failed';
        } finally {
            this.sentenceBusy = false;
            this.emit();
        }
    }

    async setSentenceAudioConcurrency(raw: string, autoStart: boolean, refreshHub: () => Promise<void>) {
        localStorage.setItem('pc_sentence_worker_concurrency', raw);
        const n = Math.min(8, Math.max(0, parseInt(raw, 10) || 0));
        this.sentenceActionErr = null;
        this.emit();
        try {
            await pycoreApi.setSentenceAudioConcurrency(n, autoStart);
            await refreshHub();
        } catch (e: any) {
            this.sentenceActionErr = e?.message || 'concurrency save failed';
            this.emit();
        }
    }
}

export const taskCenterState = new TaskCenterStateService();

export function useTaskCenterState(): TaskCenterStateService {
    const [, setTick] = useState(0);
    useEffect(() => {
        return taskCenterState.on(() => setTick((t) => t + 1));
    }, []);
    return taskCenterState;
}
