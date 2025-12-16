/**
 * Local Task Queue Service (Background)
 * 在 Background Service Worker 中运行的任务队列服务
 * 负责持久化、事件广播、Service Worker 生命周期管理
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
} from './index';

/**
 * 任务队列服务（单例）
 * 管理队列生命周期、持久化、事件广播
 */
class LocalTaskQueueService {
  private queue: LocalTaskQueue | null = null;
  private isInitialized = false;
  private keepAliveInterval: number | null = null;

  /**
   * 初始化队列服务
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('[LocalTaskQueueService] Already initialized');
      return;
    }

    console.log('[LocalTaskQueueService] Initializing...');

    // 创建队列实例
    this.queue = new LocalTaskQueue({
      maxConcurrent: 1,
      autoStart: true,
      enableDeduplication: true,
      taskTimeout: 300000, // 5 minutes
      maxRetries: 3,
    });

    // 注册 handlers
    this.queue.registerHandler(new BingDictionaryHandler());
    this.queue.registerHandler(new DeepSeekHandler());

    // 从存储恢复任务
    await this.restoreTasks();

    // 订阅队列事件
    this.subscribeToQueueEvents();

    // 设置 Service Worker keep-alive
    this.setupKeepAlive();

    this.isInitialized = true;
    console.log('[LocalTaskQueueService] Initialized successfully');
  }

  /**
   * 从 chrome.storage 恢复任务
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

        console.log(`[LocalTaskQueueService] Restoring ${tasks.length} tasks from storage`);

        // 恢复未完成的任务
        for (const task of tasks) {
          // 只恢复 PENDING 和 PROCESSING 状态的任务
          if (task.status === TaskStatus.PENDING || task.status === TaskStatus.PROCESSING) {
            // 将 PROCESSING 重置为 PENDING（因为 Service Worker 可能中断了）
            if (task.status === TaskStatus.PROCESSING) {
              task.status = TaskStatus.PENDING;
              task.startedAt = undefined;
              console.log(`[LocalTaskQueueService] Reset task ${task.id} from PROCESSING to PENDING`);
            }

            await this.queue!.addTask(task);
          }
        }

        console.log('[LocalTaskQueueService] Tasks restored successfully');
      }
    } catch (error) {
      console.error('[LocalTaskQueueService] Failed to restore tasks:', error);
    }
  }

  /**
   * 持久化任务到 chrome.storage
   */
  private async persistTasks(): Promise<void> {
    if (!this.queue) return;

    try {
      const tasks = this.queue.getAllTasks();
      const taskOrder = tasks.map(t => t.id);

      await chrome.storage.local.set({
        'localTaskQueue.tasks': tasks,
        'localTaskQueue.taskOrder': taskOrder,
      });

      // 仅在开发环境打印
      // console.log(`[LocalTaskQueueService] Persisted ${tasks.length} tasks`);
    } catch (error) {
      console.error('[LocalTaskQueueService] Failed to persist tasks:', error);
    }
  }

  /**
   * 订阅队列事件并广播到 popup
   */
  private subscribeToQueueEvents(): void {
    if (!this.queue) return;

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
   * 启动 keep-alive
   */
  private startKeepAlive(): void {
    if (this.keepAliveInterval) return;

    console.log('[LocalTaskQueueService] Starting keep-alive');

    // 每 20 秒发送一次心跳，防止 Service Worker 休眠
    this.keepAliveInterval = setInterval(() => {
      // 空操作，仅用于保持活跃
      chrome.runtime.getPlatformInfo();
    }, 20000) as any;
  }

  /**
   * 停止 keep-alive
   */
  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      console.log('[LocalTaskQueueService] Stopping keep-alive');
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  /**
   * 添加任务
   */
  async addTask<T = any>(task: Task<T>): Promise<boolean> {
    if (!this.queue) {
      await this.initialize();
    }

    return await this.queue!.addTask(task);
  }

  /**
   * 取消任务
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
