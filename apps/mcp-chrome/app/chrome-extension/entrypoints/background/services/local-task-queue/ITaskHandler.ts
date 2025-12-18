/**
 * Local Task Queue - Task Handler Interface
 * Each task type implements this interface
 */

import type { Task, TaskType } from './types';
import { queueLogger } from './logger';

/**
 * Task handler interface
 * Each task type (Bing, DeepSeek, Translation, etc.) implements this
 */
export interface ITaskHandler<T = any> {
  /**
   * Task type this handler processes
   */
  readonly type: TaskType;

  /**
   * Handler name for logging
   */
  readonly name: string;

  /**
   * Execute the task
   * @param task Task to process
   * @param onProgress Progress callback (0-100)
   */
  execute(task: Task<T>, onProgress?: (progress: number) => void): Promise<void>;

  /**
   * Cancel a running task (optional)
   * @param taskId Task ID to cancel
   */
  cancel?(taskId: string): Promise<void>;

  /**
   * Validate task details before execution (optional)
   * @param details Task details to validate
   * @returns true if valid, error message if invalid
   */
  validate?(details: T): true | string;

  /**
   * Check if handler is ready to process tasks (optional)
   * @returns true if ready, false if not
   */
  isReady?(): Promise<boolean>;
}

/**
 * Task handler registry
 * Manages all registered task handlers
 */
export class TaskHandlerRegistry {
  private handlers = new Map<TaskType, ITaskHandler>();

  /**
   * Register a task handler
   */
  register(handler: ITaskHandler): void {
    if (this.handlers.has(handler.type)) {
      queueLogger.warn('TaskHandlerRegistry', `Handler for type "${handler.type}" already registered, overwriting`);
    }

    this.handlers.set(handler.type, handler);
    queueLogger.info('TaskHandlerRegistry', `Registered handler: ${handler.name}`, { type: handler.type });
  }

  /**
   * Unregister a task handler
   */
  unregister(type: TaskType): void {
    if (this.handlers.delete(type)) {
      queueLogger.info('TaskHandlerRegistry', `Unregistered handler: ${type}`);
    }
  }

  /**
   * Get handler for a task type
   */
  get(type: TaskType): ITaskHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Check if handler exists for a task type
   */
  has(type: TaskType): boolean {
    return this.handlers.has(type);
  }

  /**
   * Get all registered task types
   */
  getRegisteredTypes(): TaskType[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get all registered handlers
   */
  getAll(): ITaskHandler[] {
    return Array.from(this.handlers.values());
  }

  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
    queueLogger.info('TaskHandlerRegistry', 'All handlers cleared');
  }
}
