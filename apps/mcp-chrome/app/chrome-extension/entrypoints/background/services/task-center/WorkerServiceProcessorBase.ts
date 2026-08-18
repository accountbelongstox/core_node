/**
 * One ITaskProcessor adapter for every SimpleWorkerBase-backed service.
 *
 * Laravel task values come from config/queue_center_contract.json through
 * utils/queue-center-contract.ts. Concrete registrations provide only their
 * extension-local UI key/name, service instance, and central task keys. This
 * removes the former duplicated start/stop/status/canHandle implementations.
 */

import type { ITaskProcessor, ProcessorConfig, ProcessorStatus } from './ITaskProcessor';
import type { WorkerCapability } from '../../api/WorkerApiClient';

export interface WorkerServiceProcessorOptions {
  processorType: string;
  processorName: string;
  workerName: string;
  service: any;
  taskTypes?: string[];
  processorTypes?: string[];
  capabilities?: WorkerCapability[];
  concurrency?: number;
  batchSize?: number;
  start?: (config: ProcessorConfig) => Promise<void>;
}

export class WorkerServiceProcessorBase implements ITaskProcessor {
  readonly processorType: string;
  readonly processorName: string;
  readonly processorTypes: string[];
  readonly capabilities: WorkerCapability[];
  readonly concurrency: number;

  private readonly workerName: string;
  private readonly service: any;
  private readonly taskTypes: Set<string> | null;
  private readonly batchSize: number;
  private readonly customStart: ((config: ProcessorConfig) => Promise<void>) | null;

  constructor(options: WorkerServiceProcessorOptions) {
    this.processorType = options.processorType;
    this.processorName = options.processorName;
    this.processorTypes = options.processorTypes ?? [];
    this.capabilities = options.capabilities ?? [];
    this.concurrency = options.concurrency ?? 1;
    this.workerName = options.workerName;
    this.service = options.service;
    this.taskTypes = options.taskTypes ? new Set(options.taskTypes) : null;
    this.batchSize = options.batchSize ?? 1;
    this.customStart = options.start ?? null;
  }

  async start(config: ProcessorConfig): Promise<void> {
    if (this.customStart) {
      await this.customStart(config);
      return;
    }
    await this.service.start({
      apiUrl: config.apiUrl,
      workerName: config.workerName || this.workerName,
      pollWait: config.pollWait,
      heartbeatInterval: config.heartbeatInterval,
      batchSize: config.batchSize ?? this.batchSize,
    });
  }

  stop(): void {
    this.service.stop();
  }

  getStatus(): ProcessorStatus {
    const status = this.service.getStatus();
    return {
      isRunning: status.isRunning,
      stats: {
        ...status.stats,
        queueTotal: status.stats.pending ?? 0,
        newTasks: status.stats.newTasks ?? 0,
        duplicateTasks: status.stats.duplicateTasks ?? 0,
      },
    } as ProcessorStatus;
  }

  canHandle(taskType: string): boolean {
    if (typeof this.service.canHandleTaskType === 'function') {
      return this.service.canHandleTaskType(taskType);
    }
    return this.taskTypes?.has(taskType) ?? false;
  }
}
