import type {
  QueueCenterOverviewResponse,
  QueueCenterReceiptsResponse,
  QueueCenterWorkerPresence,
  QueueDeliveryStage,
  QueueTaskDeliveryReceipt,
} from '../../../../core/contracts/QueueCenterContract';

export interface QueueDeliveryTrackedReceipt<Resource extends string> {
  key: string;
  resource: Resource;
  taskId: string;
  stage: QueueDeliveryStage;
  status: string | null;
  workerId: string | null;
  workerKind: string | null;
  queuePosition: number | null;
  headAction: string | null;
  progress: number | null;
  estimatedWaitSeconds: number | null;
}

export interface QueueDeliveryRuntimeSnapshot<Resource extends string> {
  laravelOnline: boolean;
  workers: QueueCenterWorkerPresence[];
  receipts: ReadonlyMap<string, QueueDeliveryTrackedReceipt<Resource>>;
  version: number;
}

export interface QueueDeliveryRuntimeTransport {
  loadOverview: () => Promise<QueueCenterOverviewResponse>;
  loadReceipts: (taskIds: string[]) => Promise<QueueCenterReceiptsResponse>;
}

export interface QueueDeliveryRuntimeOptions {
  receiptLimit: number;
  queryLimit: number;
  lifecycle?: QueueDeliveryRuntimeLifecycleOptions;
}

export interface QueueDeliveryRuntimeLifecycleOptions {
  receiptRefreshMs: number;
  presenceFallbackRefreshMs: number;
  subscribePresence?: (handler: () => void) => () => void;
}

export const selectQueueWorkersByKind = (
  workers: QueueCenterWorkerPresence[],
  kind: string,
): QueueCenterWorkerPresence[] => workers.filter((worker) => worker.kind === kind);

export const isQueueWorkerKindOnline = (
  workers: QueueCenterWorkerPresence[],
  kind: string,
): boolean => selectQueueWorkersByKind(workers, kind).some((worker) => worker.online);

export abstract class WordNewQueueDeliveryRuntime<Resource extends string> {
  private readonly listeners = new Set<() => void>();
  private readonly receiptLimit: number;
  private readonly queryLimit: number;
  private readonly tracked = new Map<string, QueueDeliveryTrackedReceipt<Resource>>();
  private readonly transport: QueueDeliveryRuntimeTransport;
  private readonly lifecycle: QueueDeliveryRuntimeLifecycleOptions | null;
  private lifecycleConsumers = 0;
  private presenceRefreshInFlight: Promise<void> | null = null;
  private presenceRefreshQueued = false;
  private presenceTimer: ReturnType<typeof setInterval> | null = null;
  private receiptTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribePresence: (() => void) | null = null;
  private refreshInFlight: Promise<void> | null = null;
  private receiptOffset = 0;
  private snapshot: QueueDeliveryRuntimeSnapshot<Resource> = {
    laravelOnline: false,
    workers: [],
    receipts: new Map(),
    version: 0,
  };

  protected constructor(transport: QueueDeliveryRuntimeTransport, options: QueueDeliveryRuntimeOptions) {
    this.transport = transport;
    this.receiptLimit = Math.max(1, Math.floor(options.receiptLimit));
    this.queryLimit = Math.max(1, Math.min(this.receiptLimit, Math.floor(options.queryLimit)));
    this.lifecycle = options.lifecycle || null;
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getSnapshot = (): QueueDeliveryRuntimeSnapshot<Resource> => this.snapshot;

  readonly start = (): (() => void) => {
    let released = false;
    this.lifecycleConsumers += 1;
    if (this.lifecycleConsumers === 1) this.startLifecycle();
    return () => {
      if (released) return;
      released = true;
      this.lifecycleConsumers = Math.max(0, this.lifecycleConsumers - 1);
      if (this.lifecycleConsumers === 0) this.stopLifecycle();
    };
  };

  markWaiting(key: string, resource: Resource): void {
    const current = this.tracked.get(key);
    if (current && current.stage !== 'failed' && current.stage !== 'completed') return;
    this.setReceipt(key, resource, 'waiting');
  }

  markLaravelReceived(
    key: string,
    resource: Resource,
    taskId?: string | null,
    queuePosition?: number | null,
    headAction?: string | null,
  ): void {
    const current = this.tracked.get(key);
    this.setReceipt(
      key,
      resource,
      'laravel_received',
      taskId || current?.taskId || '',
      queuePosition,
      headAction,
    );
  }

  markReady(key: string, resource: Resource): void {
    const current = this.tracked.get(key);
    this.setReceipt(key, resource, 'completed', current?.taskId || '');
  }

  markFailed(key: string, resource: Resource): void {
    const current = this.tracked.get(key);
    this.setReceipt(key, resource, 'failed', current?.taskId || '');
  }

  refreshPresence(): Promise<void> {
    if (this.presenceRefreshInFlight) {
      this.presenceRefreshQueued = true;
      return this.presenceRefreshInFlight;
    }
    const pending = this.loadPresence().finally(() => {
      if (this.presenceRefreshInFlight !== pending) return;
      this.presenceRefreshInFlight = null;
      if (!this.presenceRefreshQueued) return;
      this.presenceRefreshQueued = false;
      void this.refreshPresence();
    });
    this.presenceRefreshInFlight = pending;
    return pending;
  }

  private async loadPresence(): Promise<void> {
    try {
      const response = await this.transport.loadOverview();
      this.replaceWorkers(Array.isArray(response?.workers) ? response.workers : [], true);
    } catch {
      this.replaceWorkers([], false);
    }
  }

  refreshReceipts(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const allTaskIds = Array.from(new Set(
      Array.from(this.tracked.values()).map((receipt) => receipt.taskId).filter(Boolean),
    )).slice(0, this.receiptLimit);
    if (allTaskIds.length === 0) return Promise.resolve();
    const start = this.receiptOffset % allTaskIds.length;
    const taskIds = [...allTaskIds.slice(start), ...allTaskIds.slice(0, start)]
      .slice(0, this.queryLimit);
    this.receiptOffset = (start + taskIds.length) % allTaskIds.length;
    const pending = this.loadReceiptSegment(taskIds).finally(() => {
      if (this.refreshInFlight === pending) this.refreshInFlight = null;
    });
    this.refreshInFlight = pending;
    return pending;
  }

  private startLifecycle(): void {
    if (!this.lifecycle) return;
    void this.refreshPresence();
    void this.refreshReceipts();
    this.unsubscribePresence = this.lifecycle.subscribePresence?.(() => {
      void this.refreshPresence();
    }) || null;
    this.presenceTimer = setInterval(() => {
      void this.refreshPresence();
    }, Math.max(1, this.lifecycle.presenceFallbackRefreshMs));
    this.receiptTimer = setInterval(() => {
      void this.refreshReceipts();
    }, Math.max(1, this.lifecycle.receiptRefreshMs));
  }

  private stopLifecycle(): void {
    if (this.presenceTimer) clearInterval(this.presenceTimer);
    if (this.receiptTimer) clearInterval(this.receiptTimer);
    this.presenceTimer = null;
    this.receiptTimer = null;
    this.unsubscribePresence?.();
    this.unsubscribePresence = null;
  }

  private async loadReceiptSegment(taskIds: string[]): Promise<void> {
    try {
      const response = await this.transport.loadReceipts(taskIds);
      const receipts: QueueTaskDeliveryReceipt[] = Array.isArray(response?.receipts)
        ? response.receipts
        : [];
      const byTaskId = new Map(receipts.map((receipt) => [String(receipt.task_id || ''), receipt]));
      this.tracked.forEach((current, key) => {
        const wire = byTaskId.get(current.taskId);
        if (!wire?.stage) return;
        this.tracked.set(key, {
          ...current,
          stage: wire.stage,
          status: wire.task_status ?? null,
          workerId: wire.worker?.id ?? null,
          workerKind: wire.worker?.kind ?? null,
          queuePosition: wire.queue_position ?? current.queuePosition,
          progress: wire.progress ?? current.progress,
          estimatedWaitSeconds: wire.estimated_wait_seconds ?? null,
        });
      });
      this.replaceWorkers(Array.isArray(response?.workers) ? response.workers : [], true);
    } catch {
      this.replaceWorkers(this.snapshot.workers, false);
    }
  }

  private replaceWorkers(workers: QueueCenterWorkerPresence[], laravelOnline: boolean): void {
    this.snapshot = {
      laravelOnline,
      workers,
      receipts: new Map(this.tracked),
      version: this.snapshot.version + 1,
    };
    this.emit();
  }

  private setReceipt(
    key: string,
    resource: Resource,
    stage: QueueDeliveryStage,
    taskId = '',
    queuePosition?: number | null,
    headAction?: string | null,
  ): void {
    if (this.tracked.size >= this.receiptLimit && !this.tracked.has(key)) {
      const oldestKey = this.tracked.keys().next().value as string | undefined;
      if (oldestKey) this.tracked.delete(oldestKey);
    }
    const current = this.tracked.get(key);
    this.tracked.delete(key);
    this.tracked.set(key, {
      key,
      resource,
      taskId: taskId || current?.taskId || '',
      stage,
      status: current?.status ?? null,
      workerId: current?.workerId ?? null,
      workerKind: current?.workerKind ?? null,
      queuePosition: queuePosition ?? current?.queuePosition ?? null,
      headAction: headAction ?? current?.headAction ?? null,
      progress: current?.progress ?? null,
      estimatedWaitSeconds: current?.estimatedWaitSeconds ?? null,
    });
    this.publish();
  }

  private publish(): void {
    this.snapshot = {
      ...this.snapshot,
      receipts: new Map(this.tracked),
      version: this.snapshot.version + 1,
    };
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }
}
