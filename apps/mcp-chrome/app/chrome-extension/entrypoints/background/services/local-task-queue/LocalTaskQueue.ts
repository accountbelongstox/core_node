/**
 * Local Task Queue - Unified Task Queue
 * Manages all task types with serial processing
 */

import type {
  Task,
  TaskType,
  TaskStatus,
  TaskEvent,
  TaskEventType,
  TaskQueueStats,
} from './types';
import { TaskStatus as TaskStatusEnum, TaskEventType as TaskEventTypeEnum, TaskError, ErrorType } from './types';
import type { ITaskHandler } from './ITaskHandler';
import { TaskHandlerRegistry } from './ITaskHandler';
import { queueLogger } from './logger';

/**
 * Task queue configuration
 */
export interface TaskQueueConfig {
  /**
   * Maximum concurrent tasks (default: 1 for serial processing)
   */
  maxConcurrent?: number;

  /**
   * Auto-start processing when task is added (default: true)
   */
  autoStart?: boolean;

  /**
   * Enable task deduplication (default: true)
   */
  enableDeduplication?: boolean;

  /**
   * Task timeout in milliseconds (default: 300000 = 5 minutes)
   */
  taskTimeout?: number;

  /**
   * Maximum retries for failed tasks (default: 3)
   */
  maxRetries?: number;

  /**
   * Maximum queue size (default: 1000)
   */
  maxQueueSize?: number;
}

/**
 * Local Task Queue
 * Unified task queue with serial processing, deduplication, and auto-start/stop
 */
export class LocalTaskQueue {
  private tasks = new Map<string, Task>();
  private taskOrder: string[] = [];
  private processingTaskIds = new Set<string>();
  private taskCache = new Set<string>();
  private isRunning = false;
  private isPaused = false;
  private handlerRegistry: TaskHandlerRegistry;
  private eventListeners = new Map<TaskEventType, Set<(event: TaskEvent) => void>>();
  private config: Required<TaskQueueConfig>;

  constructor(config: TaskQueueConfig = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 1,
      autoStart: config.autoStart ?? true,
      enableDeduplication: config.enableDeduplication ?? true,
      taskTimeout: config.taskTimeout ?? 300000,
      maxRetries: config.maxRetries ?? 3,
      maxQueueSize: config.maxQueueSize ?? 1000,
    };

    this.handlerRegistry = new TaskHandlerRegistry();

    queueLogger.info('LocalTaskQueue', 'Queue initialized', this.config);
  }

  /**
   * Register a task handler
   */
  registerHandler(handler: ITaskHandler): void {
    this.handlerRegistry.register(handler);
  }

  /**
   * Unregister a task handler
   */
  unregisterHandler(type: TaskType): void {
    this.handlerRegistry.unregister(type);
  }

  /**
   * Add a task to the queue
   * Auto-deduplicates and auto-starts if configured
   */
  async addTask<T = any>(task: Task<T>): Promise<boolean> {
    // Check queue size limit
    if (this.tasks.size >= this.config.maxQueueSize) {
      console.error(
        `[LocalTaskQueue] Queue is full (${this.tasks.size}/${this.config.maxQueueSize})`,
      );
      return false;
    }

    // Deduplication check
    if (this.config.enableDeduplication) {
      const cacheKey = this.generateCacheKey(task);
      if (this.taskCache.has(cacheKey)) {
        queueLogger.debug('LocalTaskQueue', `Task already exists: ${task.id}`, { taskType: task.type });
        return false;
      }
      this.taskCache.add(cacheKey);
    }

    // Check if handler exists
    if (!this.handlerRegistry.has(task.type)) {
      queueLogger.error('LocalTaskQueue', `No handler registered for task type: ${task.type}`, { taskId: task.id });
      return false;
    }

    // Add to queue
    this.tasks.set(task.id, task);
    this.taskOrder.push(task.id);

    queueLogger.info('LocalTaskQueue', `Task added: ${task.id}`, {
      taskType: task.type,
      queueSize: this.taskOrder.length,
      maxSize: this.config.maxQueueSize,
    });

    // Emit ADDED event
    this.emitEvent(TaskEventTypeEnum.ADDED, task);

    // Auto-start if configured
    if (this.config.autoStart && !this.isRunning) {
      await this.start();
    }

    return true;
  }

  /**
   * Start processing tasks
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      queueLogger.debug('LocalTaskQueue', 'Queue already running');
      return;
    }

    this.isRunning = true;
    queueLogger.info('LocalTaskQueue', 'Queue started');

    // Start processing loop
    await this.processNext();
  }

  /**
   * Stop processing tasks
   */
  stop(): void {
    this.isRunning = false;
    this.isPaused = false;
    queueLogger.info('LocalTaskQueue', 'Queue stopped');
  }

  /**
   * Pause processing tasks
   */
  pause(): void {
    if (!this.isRunning) {
      queueLogger.debug('LocalTaskQueue', 'Cannot pause: queue not running');
      return;
    }

    this.isPaused = true;
    queueLogger.info('LocalTaskQueue', 'Queue paused');
  }

  /**
   * Resume processing tasks
   */
  async resume(): Promise<void> {
    if (!this.isRunning) {
      queueLogger.debug('LocalTaskQueue', 'Cannot resume: queue not running');
      return;
    }

    if (!this.isPaused) {
      queueLogger.debug('LocalTaskQueue', 'Queue not paused');
      return;
    }

    this.isPaused = false;
    queueLogger.info('LocalTaskQueue', 'Queue resumed');

    // Continue processing
    await this.processNext();
  }

  /**
   * Process next task (recursive serial processing)
   */
  private async processNext(): Promise<void> {
    // Check if should continue
    if (!this.isRunning || this.isPaused) {
      return;
    }

    // Check concurrent limit
    if (this.processingTaskIds.size >= this.config.maxConcurrent) {
      return;
    }

    // Get next pending task
    const nextTaskId = this.getNextPendingTaskId();
    if (!nextTaskId) {
      // No more tasks - emit QUEUE_EMPTY and stop
      if (this.processingTaskIds.size === 0) {
        queueLogger.info('LocalTaskQueue', 'Queue empty, stopping');
        this.isRunning = false;
        this.emitEvent(TaskEventTypeEnum.QUEUE_EMPTY, null as any);
      }
      return;
    }

    const task = this.tasks.get(nextTaskId);
    if (!task) {
      return;
    }

    // Mark as processing
    this.processingTaskIds.add(nextTaskId);
    task.status = TaskStatusEnum.PROCESSING;
    task.startedAt = Date.now();
    task.updatedAt = Date.now();

    queueLogger.info('LocalTaskQueue', `Processing task: ${task.id}`, { taskType: task.type });

    // Emit STARTED event
    this.emitEvent(TaskEventTypeEnum.STARTED, task);

    // Get handler
    const handler = this.handlerRegistry.get(task.type);
    if (!handler) {
      await this.failTask(task, `No handler registered for type: ${task.type}`);
      this.processingTaskIds.delete(nextTaskId);
      await this.processNext();
      return;
    }

    // Validate task details (if handler supports validation)
    if (handler.validate) {
      const validationResult = handler.validate(task.details);
      if (validationResult !== true) {
        await this.failTask(task, `Validation failed: ${validationResult}`);
        this.processingTaskIds.delete(nextTaskId);
        await this.processNext();
        return;
      }
    }

    // Check if handler is ready (if handler supports readiness check)
    if (handler.isReady) {
      const isReady = await handler.isReady();
      if (!isReady) {
        await this.failTask(task, 'Handler not ready');
        this.processingTaskIds.delete(nextTaskId);
        await this.processNext();
        return;
      }
    }

    // Execute task with timeout
    try {
      await Promise.race([
        handler.execute(task, (progress) => {
          task.progress = progress;
          task.updatedAt = Date.now();
          this.emitEvent(TaskEventTypeEnum.PROGRESS, task);
        }),
        this.createTimeoutPromise(this.config.taskTimeout),
      ]);

      // Task completed successfully
      await this.completeTask(task);
    } catch (error: any) {
      queueLogger.error('LocalTaskQueue', `Task failed: ${task.id}`, { error: error.message });

      // Determine if error is retriable
      const isRetriable = error instanceof TaskError
        ? error.isRetriable()
        : true; // Unknown errors default to retriable

      // Check if should retry
      const retryCount = task.metadata?.retryCount ?? 0;
      const maxRetries = task.metadata?.maxRetries ?? this.config.maxRetries;

      if (isRetriable && retryCount < maxRetries) {
        // Retry task
        task.metadata = {
          ...task.metadata,
          retryCount: retryCount + 1,
        };
        task.status = TaskStatusEnum.PENDING;
        task.startedAt = undefined;
        task.updatedAt = Date.now();
        this.processingTaskIds.delete(nextTaskId);

        const errorType = error instanceof TaskError ? error.type : 'unknown';
        queueLogger.warn('LocalTaskQueue', `Task retry ${retryCount + 1}/${maxRetries}: ${task.id}`, { errorType });
      } else {
        // Max retries reached or non-retriable error, fail task
        const reason = !isRetriable
          ? 'Non-retriable error'
          : 'Max retries reached';
        queueLogger.error('LocalTaskQueue', `Task failed permanently: ${task.id}`, { reason });

        await this.failTask(task, error.message || String(error));
      }
    } finally {
      this.processingTaskIds.delete(nextTaskId);
    }

    // Recursive: process next task
    await this.processNext();
  }

  /**
   * Complete a task
   */
  private async completeTask(task: Task): Promise<void> {
    task.status = TaskStatusEnum.COMPLETED;
    task.completedAt = Date.now();
    task.updatedAt = Date.now();
    task.progress = 100;

    queueLogger.info('LocalTaskQueue', `Task completed: ${task.id}`, { taskType: task.type });

    // Remove from order
    const index = this.taskOrder.indexOf(task.id);
    if (index > -1) {
      this.taskOrder.splice(index, 1);
    }

    // Emit COMPLETED event
    this.emitEvent(TaskEventTypeEnum.COMPLETED, task);

    // Remove from cache (allow re-adding same task in future)
    if (this.config.enableDeduplication) {
      const cacheKey = this.generateCacheKey(task);
      this.taskCache.delete(cacheKey);
    }
  }

  /**
   * Fail a task
   */
  private async failTask(task: Task, error: string): Promise<void> {
    task.status = TaskStatusEnum.FAILED;
    task.error = error;
    task.completedAt = Date.now();
    task.updatedAt = Date.now();

    console.error(`[LocalTaskQueue] Task failed: ${task.id} - ${error}`);

    // Remove from order
    const index = this.taskOrder.indexOf(task.id);
    if (index > -1) {
      this.taskOrder.splice(index, 1);
    }

    // Emit FAILED event
    this.emitEvent(TaskEventTypeEnum.FAILED, task);

    // Remove from cache
    if (this.config.enableDeduplication) {
      const cacheKey = this.generateCacheKey(task);
      this.taskCache.delete(cacheKey);
    }
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) {
      return false;
    }

    // If processing, try to cancel via handler
    if (task.status === TaskStatusEnum.PROCESSING) {
      const handler = this.handlerRegistry.get(task.type);
      if (handler?.cancel) {
        try {
          await handler.cancel(taskId);
        } catch (error) {
          console.error(`[LocalTaskQueue] Cancel failed: ${taskId}`, error);
        }
      }
      this.processingTaskIds.delete(taskId);
    }

    // Update task status
    task.status = TaskStatusEnum.CANCELLED;
    task.completedAt = Date.now();
    task.updatedAt = Date.now();

    // Remove from order
    const index = this.taskOrder.indexOf(taskId);
    if (index > -1) {
      this.taskOrder.splice(index, 1);
    }

    queueLogger.info('LocalTaskQueue', `Task cancelled: ${taskId}`);

    // Emit CANCELLED event
    this.emitEvent(TaskEventTypeEnum.CANCELLED, task);

    // Remove from cache
    if (this.config.enableDeduplication) {
      const cacheKey = this.generateCacheKey(task);
      this.taskCache.delete(cacheKey);
    }

    return true;
  }

  /**
   * Get next pending task ID
   */
  private getNextPendingTaskId(): string | null {
    // Sort by priority (higher first), then by createdAt (older first)
    const sortedIds = [...this.taskOrder].sort((a, b) => {
      const taskA = this.tasks.get(a);
      const taskB = this.tasks.get(b);

      if (!taskA || !taskB) return 0;

      // Only consider pending tasks
      if (taskA.status !== TaskStatusEnum.PENDING) return 1;
      if (taskB.status !== TaskStatusEnum.PENDING) return -1;

      // Priority first (higher first)
      const priorityA = taskA.metadata?.priority ?? 0;
      const priorityB = taskB.metadata?.priority ?? 0;
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      // CreatedAt second (older first)
      return taskA.createdAt - taskB.createdAt;
    });

    // Find first pending task
    for (const id of sortedIds) {
      const task = this.tasks.get(id);
      if (task?.status === TaskStatusEnum.PENDING) {
        return id;
      }
    }

    return null;
  }

  /**
   * Generate cache key for deduplication
   * 使用稳定的 key 生成，避免 JSON.stringify 的属性顺序问题
   */
  private generateCacheKey(task: Task): string {
    // 基于任务类型的自定义 key 生成
    switch (task.type) {
      case TaskType.BING_DICTIONARY: {
        const details = task.details as any;
        const words = (details.words || [])
          .map((w: any) => w.word)
          .sort()
          .join(',');
        const language = details.language || 'english';
        return `bing:${language}:${words}`;
      }

      case TaskType.DEEPSEEK_CHAT: {
        const details = task.details as any;
        // DeepSeek 任务按 prompt 去重
        return `deepseek:${details.prompt}`;
      }

      case TaskType.TRANSLATION: {
        const details = task.details as any;
        return `translation:${details.sourceLanguage}:${details.targetLanguage}:${details.text}`;
      }

      case TaskType.TTS: {
        const details = task.details as any;
        return `tts:${details.language}:${details.text}`;
      }

      case TaskType.WEB_SCRAPING: {
        const details = task.details as any;
        return `scraping:${details.url}:${details.selector || ''}`;
      }

      default:
        // 默认：排序 keys 后 stringify
        return `${task.type}:${JSON.stringify(this.sortObjectKeys(task.details))}`;
    }
  }

  /**
   * 排序对象的 keys，确保 JSON.stringify 的稳定性
   */
  private sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObjectKeys(item));

    return Object.keys(obj)
      .sort()
      .reduce((result, key) => {
        result[key] = this.sortObjectKeys(obj[key]);
        return result;
      }, {} as any);
  }

  /**
   * Create timeout promise
   */
  private createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Task timeout after ${timeout}ms`)), timeout);
    });
  }

  /**
   * Emit task event
   */
  private emitEvent(type: TaskEventType, task: Task): void {
    const event: TaskEvent = {
      type,
      task,
      timestamp: Date.now(),
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`[LocalTaskQueue] Event listener error: ${type}`, error);
        }
      });
    }
  }

  /**
   * Subscribe to task events
   */
  on(eventType: TaskEventType, listener: (event: TaskEvent) => void): () => void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }

    this.eventListeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.eventListeners.get(eventType)?.delete(listener);
    };
  }

  /**
   * Get queue statistics
   */
  getStats(): TaskQueueStats {
    const tasks = Array.from(this.tasks.values());

    const stats: TaskQueueStats = {
      total: tasks.length,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
      byType: {} as Record<TaskType, number>,
    };

    tasks.forEach(task => {
      // Count by status
      switch (task.status) {
        case TaskStatusEnum.PENDING:
          stats.pending++;
          break;
        case TaskStatusEnum.PROCESSING:
          stats.processing++;
          break;
        case TaskStatusEnum.COMPLETED:
          stats.completed++;
          break;
        case TaskStatusEnum.FAILED:
          stats.failed++;
          break;
        case TaskStatusEnum.CANCELLED:
          stats.cancelled++;
          break;
      }

      // Count by type
      if (!stats.byType[task.type]) {
        stats.byType[task.type] = 0;
      }
      stats.byType[task.type]++;
    });

    return stats;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get tasks by type
   */
  getTasksByType(type: TaskType): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.type === type);
  }

  /**
   * Check if queue is running
   */
  isQueueRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Clear completed/failed/cancelled tasks
   */
  clearCompletedTasks(): void {
    const completedIds: string[] = [];

    this.tasks.forEach((task, id) => {
      if (
        task.status === TaskStatusEnum.COMPLETED ||
        task.status === TaskStatusEnum.FAILED ||
        task.status === TaskStatusEnum.CANCELLED
      ) {
        completedIds.push(id);
      }
    });

    completedIds.forEach(id => {
      this.tasks.delete(id);
    });

    queueLogger.info('LocalTaskQueue', `Cleared ${completedIds.length} completed tasks`);
  }

  /**
   * Clear all tasks (dangerous!)
   */
  clearAllTasks(): void {
    this.tasks.clear();
    this.taskOrder = [];
    this.taskCache.clear();
    this.processingTaskIds.clear();
    queueLogger.warn('LocalTaskQueue', 'All tasks cleared');
  }

  /**
   * Get running status
   */
  getRunningStatus(): { isRunning: boolean; isPaused: boolean } {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
    };
  }
}
