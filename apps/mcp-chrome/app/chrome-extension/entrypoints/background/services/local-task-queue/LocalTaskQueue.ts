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
import { TaskStatus as TaskStatusEnum, TaskEventType as TaskEventTypeEnum } from './types';
import type { ITaskHandler } from './ITaskHandler';
import { TaskHandlerRegistry } from './ITaskHandler';

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
    };

    this.handlerRegistry = new TaskHandlerRegistry();

    console.log('[LocalTaskQueue] Initialized', this.config);
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
    // Deduplication check
    if (this.config.enableDeduplication) {
      const cacheKey = this.generateCacheKey(task);
      if (this.taskCache.has(cacheKey)) {
        console.log(`[LocalTaskQueue] Task already exists: ${task.id} (${task.type})`);
        return false;
      }
      this.taskCache.add(cacheKey);
    }

    // Check if handler exists
    if (!this.handlerRegistry.has(task.type)) {
      console.error(`[LocalTaskQueue] No handler registered for task type: ${task.type}`);
      return false;
    }

    // Add to queue
    this.tasks.set(task.id, task);
    this.taskOrder.push(task.id);

    console.log(`[LocalTaskQueue] Task added: ${task.id} (${task.type}) - Queue: ${this.taskOrder.length}`);

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
      console.log('[LocalTaskQueue] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[LocalTaskQueue] Started');

    // Start processing loop
    await this.processNext();
  }

  /**
   * Stop processing tasks
   */
  stop(): void {
    this.isRunning = false;
    console.log('[LocalTaskQueue] Stopped');
  }

  /**
   * Process next task (recursive serial processing)
   */
  private async processNext(): Promise<void> {
    // Check if should continue
    if (!this.isRunning) {
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
        console.log('[LocalTaskQueue] Queue empty, stopping');
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

    console.log(`[LocalTaskQueue] Processing task: ${task.id} (${task.type})`);

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
      console.error(`[LocalTaskQueue] Task failed: ${task.id}`, error);

      // Check if should retry
      const retryCount = task.metadata?.retryCount ?? 0;
      const maxRetries = task.metadata?.maxRetries ?? this.config.maxRetries;

      if (retryCount < maxRetries) {
        // Retry task
        task.metadata = {
          ...task.metadata,
          retryCount: retryCount + 1,
        };
        task.status = TaskStatusEnum.PENDING;
        task.startedAt = undefined;
        task.updatedAt = Date.now();
        this.processingTaskIds.delete(nextTaskId);

        console.log(`[LocalTaskQueue] Task retry ${retryCount + 1}/${maxRetries}: ${task.id}`);
      } else {
        // Max retries reached, fail task
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

    console.log(`[LocalTaskQueue] Task completed: ${task.id} (${task.type})`);

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

    console.log(`[LocalTaskQueue] Task cancelled: ${taskId}`);

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
   */
  private generateCacheKey(task: Task): string {
    // Simple: type + JSON of details
    // Can be customized per task type if needed
    return `${task.type}:${JSON.stringify(task.details)}`;
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

    console.log(`[LocalTaskQueue] Cleared ${completedIds.length} completed tasks`);
  }

  /**
   * Clear all tasks (dangerous!)
   */
  clearAllTasks(): void {
    this.tasks.clear();
    this.taskOrder = [];
    this.taskCache.clear();
    this.processingTaskIds.clear();
    console.log('[LocalTaskQueue] All tasks cleared');
  }
}
