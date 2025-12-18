/**
 * Local Task Queue Service (Background)
 * Runs in Background Service Worker
 * Handles persistence, event broadcasting, Service Worker lifecycle management
 */

import {
  LocalTaskQueue,
  BingDictionaryHandler,
  DeepSeekHandler,
  TaskType,
  TaskStatus,
  TaskEventType,
  type Task,
  type TaskQueueStats,
  type BingDictionaryTaskDetails,
  type DeepSeekTaskDetails,
  queueLogger,
} from './index';

/**
 * Task queue service (singleton)
 * Manages queue lifecycle, persistence, event broadcasting
 */
class LocalTaskQueueService {
  private queue: LocalTaskQueue | null = null;
  private isInitialized = false;
  private keepAliveInterval: number | null = null;

  /**
   * Initialize queue service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      queueLogger.debug('LocalTaskQueueService', 'Already initialized');
      return;
    }

    queueLogger.info('LocalTaskQueueService', 'Initializing queue service');

    // Create queue instance
    this.queue = new LocalTaskQueue({
      maxConcurrent: 1,
      autoStart: true,
      enableDeduplication: true,
      taskTimeout: 300000, // 5 minutes
      maxRetries: 3,
    });

    // Register handlers
    this.queue.registerHandler(new BingDictionaryHandler());
    this.queue.registerHandler(new DeepSeekHandler());

    // Restore tasks from storage
    await this.restoreTasks();

    // Subscribe to queue events
    this.subscribeToQueueEvents();

    // Setup Service Worker keep-alive
    this.setupKeepAlive();

    this.isInitialized = true;
    queueLogger.info('LocalTaskQueueService', 'Queue service initialized successfully');
  }

  /**
   * Restore tasks from chrome.storage
   */
  private async restoreTasks(): Promise<void> {
    try {
      const data = await chrome.storage.local.get([
        'localTaskQueue.tasks',
        'localTaskQueue.taskOrder',
      ]);

      if (data['localTaskQueue.tasks'] && Array.isArray(data['localTaskQueue.tasks'])) {
        const tasks: Task[] = data['localTaskQueue.tasks'];
        const taskOrder: string[] = data['localTaskQueue.taskOrder'] || [];

        queueLogger.info('LocalTaskQueueService', `Restoring ${tasks.length} tasks from storage`);

        // Restore incomplete tasks
        for (const task of tasks) {
          // Only restore PENDING and PROCESSING tasks
          if (task.status === TaskStatus.PENDING || task.status === TaskStatus.PROCESSING) {
            // Reset PROCESSING to PENDING (Service Worker may have been interrupted)
            if (task.status === TaskStatus.PROCESSING) {
              task.status = TaskStatus.PENDING;
              task.startedAt = undefined;
              queueLogger.debug('LocalTaskQueueService', `Reset task ${task.id} from PROCESSING to PENDING`);
            }

            await this.queue!.addTask(task);
          }
        }

        queueLogger.info('LocalTaskQueueService', 'Tasks restored successfully', {
          taskCount: tasks.length,
        });
      }
    } catch (error) {
      queueLogger.error('LocalTaskQueueService', 'Failed to restore tasks', { error });
    }
  }

  /**
   * Persist tasks to chrome.storage
   * Handles storage limits (chrome.storage.local has 10MB limit)
   */
  private async persistTasks(): Promise<void> {
    if (!this.queue) return;

    try {
      const tasks = this.queue.getAllTasks();

      // Only persist incomplete tasks (save space)
      const incompleteTasks = tasks.filter(
        t =>
          t.status === TaskStatus.PENDING ||
          t.status === TaskStatus.PROCESSING,
      );

      // Check data size (rough estimate)
      const dataString = JSON.stringify(incompleteTasks);
      const dataSize = new Blob([dataString]).size;
      const maxSize = 5 * 1024 * 1024; // 5MB limit (leave half space for other data)

      queueLogger.debug('LocalTaskQueueService', `Persisting ${incompleteTasks.length} tasks`, {
        sizeKB: (dataSize / 1024).toFixed(2),
      });

      if (dataSize > maxSize) {
        queueLogger.warn('LocalTaskQueueService', 'Task data too large, truncating', {
          sizeBytes: dataSize,
          maxSize,
        });

        // Sort by priority and creation time, keep most important tasks
        incompleteTasks.sort((a, b) => {
          const priorityA = a.metadata?.priority ?? 0;
          const priorityB = b.metadata?.priority ?? 0;
          if (priorityA !== priorityB) return priorityB - priorityA;
          return b.createdAt - a.createdAt; // Newer first
        });

        // Gradually truncate until size fits
        let truncated = incompleteTasks;
        while (
          truncated.length > 0 &&
          new Blob([JSON.stringify(truncated)]).size > maxSize
        ) {
          truncated = truncated.slice(0, Math.floor(truncated.length * 0.8));
        }

        queueLogger.warn('LocalTaskQueueService', `Truncated to ${truncated.length} tasks`, {
          original: incompleteTasks.length,
          truncated: truncated.length,
        });

        await chrome.storage.local.set({
          'localTaskQueue.tasks': truncated,
          'localTaskQueue.taskOrder': truncated.map(t => t.id),
          'localTaskQueue.truncated': true,
          'localTaskQueue.truncatedAt': Date.now(),
        });
      } else {
        await chrome.storage.local.set({
          'localTaskQueue.tasks': incompleteTasks,
          'localTaskQueue.taskOrder': incompleteTasks.map(t => t.id),
          'localTaskQueue.truncated': false,
        });
      }
    } catch (error: any) {
      queueLogger.error('LocalTaskQueueService', 'Failed to persist tasks', { error });

      // If QUOTA_EXCEEDED error, try to clean up
      if (error.message && error.message.includes('QUOTA_EXCEEDED')) {
        queueLogger.warn('LocalTaskQueueService', 'Storage quota exceeded, clearing old tasks');
        await this.clearOldTasks();
      }
    }
  }

  /**
   * Clear old tasks (completed tasks older than 1 day)
   */
  private async clearOldTasks(): Promise<void> {
    if (!this.queue) return;

    const oneDayAgo = Date.now() - 86400000;
    const tasks = this.queue.getAllTasks();

    // Keep only incomplete tasks and recently completed tasks (within 1 day)
    const recentTasks = tasks.filter(t => {
      if (
        t.status === TaskStatus.COMPLETED ||
        t.status === TaskStatus.FAILED ||
        t.status === TaskStatus.CANCELLED
      ) {
        return (t.completedAt || t.createdAt) > oneDayAgo;
      }
      return true; // Keep all incomplete tasks
    });

    queueLogger.info('LocalTaskQueueService', `Cleared ${tasks.length - recentTasks.length} old tasks`, {
      total: tasks.length,
      remaining: recentTasks.length,
    });

    try {
      await chrome.storage.local.set({
        'localTaskQueue.tasks': recentTasks,
        'localTaskQueue.taskOrder': recentTasks.map(t => t.id),
        'localTaskQueue.lastCleanup': Date.now(),
      });
    } catch (error) {
      queueLogger.error('LocalTaskQueueService', 'Failed to clear old tasks', { error });

      // If still fails, delete all completed tasks
      const pendingOnly = recentTasks.filter(
        t => t.status === TaskStatus.PENDING || t.status === TaskStatus.PROCESSING,
      );

      await chrome.storage.local.set({
        'localTaskQueue.tasks': pendingOnly,
        'localTaskQueue.taskOrder': pendingOnly.map(t => t.id),
        'localTaskQueue.emergencyClear': true,
      });
    }
  }

  /**
   * 订阅队列事件并广播到 popup
   */
  private subscribeToQueueEvents(): void {
    if (!this.queue) return;

    // 进度更新节流
    const progressThrottleMap = new Map<string, number>();
    const progressThrottleMs = 200; // 最多每 200ms 广播一次进度

    // 监听所有队列事件
    const eventTypes = [
      TaskEventType.ADDED,
      TaskEventType.STARTED,
      TaskEventType.PROGRESS,
      TaskEventType.COMPLETED,
      TaskEventType.FAILED,
      TaskEventType.CANCELLED,
      TaskEventType.QUEUE_EMPTY,
    ];

    eventTypes.forEach(eventType => {
      this.queue!.on(eventType, async event => {
        // 进度更新节流
        if (eventType === TaskEventType.PROGRESS) {
          const now = Date.now();
          const lastBroadcast = progressThrottleMap.get(event.task.id) || 0;

          // 跳过节流期内的进度更新（除非进度达到 100%）
          if (now - lastBroadcast < progressThrottleMs && event.task.progress !== 100) {
            return; // 跳过广播
          }

          progressThrottleMap.set(event.task.id, now);
        }

        // 持久化（节流：仅在关键事件时持久化）
        if (
          eventType === TaskEventType.ADDED ||
          eventType === TaskEventType.STARTED ||
          eventType === TaskEventType.COMPLETED ||
          eventType === TaskEventType.FAILED ||
          eventType === TaskEventType.CANCELLED
        ) {
          await this.persistTasks();
        }

        // 广播事件到所有 popup 和 content scripts
        try {
          chrome.runtime.sendMessage({
            type: 'QUEUE_EVENT',
            eventType,
            task: event.task,
            timestamp: event.timestamp,
          });
        } catch (error) {
          // No receivers, ignore
        }

        // 清理已完成任务的节流记录
        if (
          eventType === TaskEventType.COMPLETED ||
          eventType === TaskEventType.FAILED ||
          eventType === TaskEventType.CANCELLED
        ) {
          progressThrottleMap.delete(event.task.id);
        }
      });
    });
  }

  /**
   * 设置 Service Worker keep-alive
   * 在处理任务时保持 Service Worker 活跃
   */
  private setupKeepAlive(): void {
    if (!this.queue) return;

    // 监听队列状态变化
    this.queue.on(TaskEventType.STARTED, () => {
      this.startKeepAlive();
    });

    this.queue.on(TaskEventType.QUEUE_EMPTY, () => {
      this.stopKeepAlive();
    });
  }

  /**
   * Start keep-alive
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) return;

    queueLogger.debug('LocalTaskQueueService', 'Starting keep-alive mechanism');

    // Send heartbeat every 20 seconds to prevent Service Worker from sleeping
    this.keepAliveInterval = setInterval(() => {
      // Empty operation, just to keep active
      chrome.runtime.getPlatformInfo();
    }, 20000) as any;
  }

  /**
   * Stop keep-alive
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      queueLogger.debug('LocalTaskQueueService', 'Stopping keep-alive mechanism');
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * Add task
   */
  async addTask<T = any>(task: Task<T>): Promise<boolean> {
    if (!this.queue) {
      await this.initialize();
    }

    return await this.queue!.addTask(task);
  }

  /**
   * Cancel task
   */
  async cancelTask(taskId: string): Promise<boolean> {
    if (!this.queue) return false;
    return await this.queue.cancelTask(taskId);
  }

  /**
   * 启动队列
   */
  async start(): Promise<void> {
    if (!this.queue) {
      await this.initialize();
    }
    await this.queue!.start();
  }

  /**
   * 停止队列
   */
  stop(): void {
    if (!this.queue) return;
    this.queue.stop();
  }

  /**
   * 获取队列统计
   */
  getStats(): TaskQueueStats {
    if (!this.queue) {
      return {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        byType: {} as Record<TaskType, number>,
      };
    }

    return this.queue.getStats();
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    if (!this.queue) return [];
    return this.queue.getAllTasks();
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    if (!this.queue) return undefined;
    return this.queue.getTask(taskId);
  }

  /**
   * 按状态获取任务
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    if (!this.queue) return [];
    return this.queue.getTasksByStatus(status);
  }

  /**
   * 按类型获取任务
   */
  getTasksByType(type: TaskType): Task[] {
    if (!this.queue) return [];
    return this.queue.getTasksByType(type);
  }

  /**
   * 清除已完成任务
   */
  clearCompleted(): void {
    if (!this.queue) return;
    this.queue.clearCompletedTasks();
    this.persistTasks(); // 立即持久化
  }

  /**
   * 检查队列是否运行
   */
  isRunning(): boolean {
    if (!this.queue) return false;
    return this.queue.isQueueRunning();
  }
}

// 导出单例实例
const localTaskQueueService = new LocalTaskQueueService();

/**
 * 获取队列服务实例
 */
export function getLocalTaskQueueService(): LocalTaskQueueService {
  return localTaskQueueService;
}
