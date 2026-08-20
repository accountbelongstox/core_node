/**
 * DeepSeek Task Queue Manager
 * Manages tasks for automated DeepSeek interactions
 */

import { STORAGE_KEYS as SK } from './storage-keys';

/**
 * Task status enum
 */
export enum TaskStatus {
  QUEUED = 'queued', // Task created, waiting to send
  SENDING = 'sending', // Sending prompt to DeepSeek
  PENDING = 'pending', // Sent, waiting for response
  GENERATING = 'generating', // DeepSeek is generating response
  COMPLETED = 'completed', // Response received
  FAILED = 'failed', // Error occurred
  CANCELLED = 'cancelled', // Task cancelled by user
}

/**
 * Task result interface
 */
export interface DeepSeekTaskResult {
  content: string; // The AI response text
  conversationUrl: string; // URL to the conversation
  extractedAt: number; // Timestamp when result was extracted
  tokens?: {
    input?: number;
    output?: number;
  };
}

/**
 * DeepSeek options
 */
export interface DeepSeekOptions {
  model?: string; // Model selection (if available)
  attachFiles?: boolean; // Whether to attach files
  waitForCompletion?: boolean; // Auto-wait or return task ID
  timeout?: number; // Timeout in ms
  autoRetry?: boolean; // Auto-retry on failure
}

/**
 * DeepSeek task interface
 */
export interface DeepSeekTask {
  id: string; // Unique task ID (UUID)
  prompt: string; // The prompt sent to DeepSeek
  status: TaskStatus; // Current task status
  createdAt: number; // Timestamp (ms)
  updatedAt: number; // Timestamp (ms)
  tabId?: number; // Chrome tab ID where task is running
  conversationId?: string; // DeepSeek conversation ID
  responseBaseline?: number; // Assistant response count before this prompt
  responseBaselineKey?: string; // Last assistant response fingerprint before this prompt
  result?: DeepSeekTaskResult; // Result data when completed
  error?: string; // Error message if failed
  metadata?: {
    attachments?: string[]; // File paths/URLs of attachments
    options?: DeepSeekOptions; // Additional options
  };
}

/**
 * Task filter interface
 */
export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  limit?: number;
  offset?: number;
}

/**
 * Task event type
 */
export type TaskEventType = 'created' | 'updated' | 'completed' | 'failed' | 'cancelled';

/**
 * Task event listener
 */
export type TaskEventListener = (task: DeepSeekTask, eventType: TaskEventType) => void;

/**
 * Storage keys
 */
const DEEPSEEK_STORAGE_KEYS = {
  TASKS: SK.DEEPSEEK_TASKS,
  CONFIG: SK.DEEPSEEK_CONFIG,
} as const;

/**
 * Default configuration
 */
const DEFAULT_CONFIG = {
  pollingInterval: 2000, // 2 seconds
  maxRetries: 150, // 5 minutes with 2s interval
  defaultTimeout: 300000, // 5 minutes
  maxConcurrentPolling: 5, // Max concurrent polling tasks
  cleanupAfterHours: 24, // Clean up old tasks after 24 hours
};

/**
 * Task Queue Manager
 * Manages the task queue, storage, and event handling
 */
export class TaskQueueManager {
  private tasks: Map<string, DeepSeekTask> = new Map();
  private listeners: TaskEventListener[] = [];
  private initialized = false;
  private config = DEFAULT_CONFIG;

  /**
   * Initialize the task queue manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load tasks from storage
    const result = await chrome.storage.local.get(DEEPSEEK_STORAGE_KEYS.TASKS);
    const storedTasks = result[DEEPSEEK_STORAGE_KEYS.TASKS] as Record<string, DeepSeekTask> | undefined;
    if (storedTasks) {
      Object.entries(storedTasks).forEach(([id, task]) => {
        this.tasks.set(id, task);
      });
    }

    // Load configuration
    const configResult = await chrome.storage.local.get(DEEPSEEK_STORAGE_KEYS.CONFIG);
    const storedConfig = configResult[DEEPSEEK_STORAGE_KEYS.CONFIG] as typeof DEFAULT_CONFIG | undefined;
    if (storedConfig) {
      this.config = { ...DEFAULT_CONFIG, ...storedConfig };
    }

    // Mark initialized BEFORE cleanup so cleanupOldTasks()'s ensureInitialized()
    // guard does not re-enter initialize() (previously this caused an infinite
    // async recursion: initialize → cleanupOldTasks → ensureInitialized → initialize).
    this.initialized = true;

    // Clean up old tasks
    await this.cleanupOldTasks();

    console.log(`TaskQueueManager initialized with ${this.tasks.size} tasks`);
  }

  /**
   * Ensure initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save tasks to storage
   */
  private async saveTasks(): Promise<void> {
    const tasksObject: Record<string, DeepSeekTask> = {};
    this.tasks.forEach((task, id) => {
      tasksObject[id] = task;
    });
    await chrome.storage.local.set({ [DEEPSEEK_STORAGE_KEYS.TASKS]: tasksObject });
  }

  /**
   * Emit task event
   */
  private emitEvent(task: DeepSeekTask, eventType: TaskEventType): void {
    this.listeners.forEach((listener) => {
      try {
        listener(task, eventType);
      } catch (error) {
        console.error('Error in task event listener:', error);
      }
    });
  }

  /**
   * Add event listener
   */
  addEventListener(listener: TaskEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: TaskEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Create a new task
   */
  async createTask(prompt: string, options?: DeepSeekOptions): Promise<DeepSeekTask> {
    await this.ensureInitialized();

    const task: DeepSeekTask = {
      id: this.generateTaskId(),
      prompt,
      status: TaskStatus.QUEUED,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        options,
      },
    };

    this.tasks.set(task.id, task);
    await this.saveTasks();
    this.emitEvent(task, 'created');

    console.log(`Created task ${task.id}`);
    return task;
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<DeepSeekTask | null> {
    await this.ensureInitialized();
    return this.tasks.get(taskId) || null;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<DeepSeekTask>): Promise<void> {
    await this.ensureInitialized();

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Don't allow updating certain fields
    delete (updates as any).id;
    delete (updates as any).createdAt;

    // Update the task
    const updatedTask: DeepSeekTask = {
      ...task,
      ...updates,
      updatedAt: Date.now(),
    };

    this.tasks.set(taskId, updatedTask);
    await this.saveTasks();

    // Emit appropriate event
    let eventType: TaskEventType = 'updated';
    if (updates.status === TaskStatus.COMPLETED) {
      eventType = 'completed';
    } else if (updates.status === TaskStatus.FAILED) {
      eventType = 'failed';
    } else if (updates.status === TaskStatus.CANCELLED) {
      eventType = 'cancelled';
    }

    this.emitEvent(updatedTask, eventType);
    console.log(`Updated task ${taskId}, status: ${updatedTask.status}`);
  }

  /**
   * List tasks with optional filtering
   */
  async listTasks(filter?: TaskFilter): Promise<{ tasks: DeepSeekTask[]; total: number; hasMore: boolean }> {
    await this.ensureInitialized();

    let tasks = Array.from(this.tasks.values());

    // Apply status filter
    if (filter?.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      tasks = tasks.filter((task) => statuses.includes(task.status));
    }

    // Sort by createdAt descending (newest first)
    tasks.sort((a, b) => b.createdAt - a.createdAt);

    const total = tasks.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;

    // Apply pagination
    const paginatedTasks = tasks.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    return {
      tasks: paginatedTasks,
      total,
      hasMore,
    };
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    await this.ensureInitialized();

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    // Only cancel tasks that are not already in final state
    if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)) {
      console.warn(`Task ${taskId} is already in final state: ${task.status}`);
      return;
    }

    await this.updateTask(taskId, {
      status: TaskStatus.CANCELLED,
    });
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.ensureInitialized();

    if (!this.tasks.has(taskId)) {
      throw new Error(`Task ${taskId} not found`);
    }

    this.tasks.delete(taskId);
    await this.saveTasks();
    console.log(`Deleted task ${taskId}`);
  }

  /**
   * Clean up old tasks
   */
  async cleanupOldTasks(): Promise<void> {
    await this.ensureInitialized();

    const cutoffTime = Date.now() - this.config.cleanupAfterHours * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const [id, task] of this.tasks.entries()) {
      // Delete old completed/failed/cancelled tasks
      if (
        task.updatedAt < cutoffTime &&
        [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)
      ) {
        this.tasks.delete(id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      await this.saveTasks();
      console.log(`Cleaned up ${deletedCount} old tasks`);
    }
  }

  /**
   * Get configuration
   */
  getConfig(): typeof DEFAULT_CONFIG {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(config: Partial<typeof DEFAULT_CONFIG>): Promise<void> {
    this.config = { ...this.config, ...config };
    await chrome.storage.local.set({ [DEEPSEEK_STORAGE_KEYS.CONFIG]: this.config });
    console.log('Updated configuration:', this.config);
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: Record<TaskStatus, number>;
  }> {
    await this.ensureInitialized();

    const stats = {
      total: this.tasks.size,
      byStatus: {
        [TaskStatus.QUEUED]: 0,
        [TaskStatus.SENDING]: 0,
        [TaskStatus.PENDING]: 0,
        [TaskStatus.GENERATING]: 0,
        [TaskStatus.COMPLETED]: 0,
        [TaskStatus.FAILED]: 0,
        [TaskStatus.CANCELLED]: 0,
      },
    };

    for (const task of this.tasks.values()) {
      stats.byStatus[task.status]++;
    }

    return stats;
  }
}

// Singleton instance
let taskQueueManagerInstance: TaskQueueManager | null = null;

/**
 * Get the singleton TaskQueueManager instance
 */
export function getTaskQueueManager(): TaskQueueManager {
  if (!taskQueueManagerInstance) {
    taskQueueManagerInstance = new TaskQueueManager();
  }
  return taskQueueManagerInstance;
}
