/**
 * Local Task Queue - Message Handler (Background)
 * Handles messages from Popup
 */

import { getLocalTaskQueueService } from './LocalTaskQueueService';
import { queueLogger } from './logger';
import {
  MessageType,
  type CommandMessage,
  type MessageResponse,
  type TaskAddResponse,
  type TaskCancelResponse,
  type QueueStatsResponse,
  type QueueTasksResponse,
  type QueueTaskResponse,
  type QueueRunningResponse,
  isCommandMessage,
} from './messages';

/**
 * Message handler
 * Handles commands from Popup in Background Service Worker
 */
export class QueueMessageHandler {
  private service = getLocalTaskQueueService();

  /**
   * Handle message
   */
  async handleMessage(
    message: CommandMessage,
    sender: chrome.runtime.MessageSender,
  ): Promise<MessageResponse> {
    queueLogger.debug('QueueMessageHandler', `Handling message: ${message.type}`);

    try {
      switch (message.type) {
        case MessageType.TASK_ADD:
          return await this.handleTaskAdd(message);

        case MessageType.TASK_CANCEL:
          return await this.handleTaskCancel(message);

        case MessageType.QUEUE_START:
          return await this.handleQueueStart();

        case MessageType.QUEUE_STOP:
          return await this.handleQueueStop();

        case MessageType.QUEUE_PAUSE:
          return await this.handleQueuePause();

        case MessageType.QUEUE_RESUME:
          return await this.handleQueueResume();

        case MessageType.QUEUE_GET_STATS:
          return await this.handleGetStats();

        case MessageType.QUEUE_GET_TASKS:
          return await this.handleGetTasks();

        case MessageType.QUEUE_GET_TASK:
          return await this.handleGetTask(message);

        case MessageType.QUEUE_GET_TASKS_BY_STATUS:
          return await this.handleGetTasksByStatus(message);

        case MessageType.QUEUE_GET_TASKS_BY_TYPE:
          return await this.handleGetTasksByType(message);

        case MessageType.QUEUE_CLEAR_COMPLETED:
          return await this.handleClearCompleted();

        case MessageType.QUEUE_IS_RUNNING:
          return await this.handleIsRunning();

        case MessageType.QUEUE_LOG_GET_ALL:
          return await this.handleGetLogs();

        case MessageType.QUEUE_LOG_CLEAR:
          return await this.handleClearLogs();

        default:
          return {
            success: false,
            error: `Unknown message type: ${(message as any).type}`,
          };
      }
    } catch (error: any) {
      console.error('[QueueMessageHandler] Error handling message:', error);
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * Handle add task
   */
  private async handleTaskAdd(message: any): Promise<TaskAddResponse> {
    const added = await this.service.addTask(message.task);
    return {
      success: true,
      data: { added },
    };
  }

  /**
   * Handle cancel task
   */
  private async handleTaskCancel(message: any): Promise<TaskCancelResponse> {
    const cancelled = await this.service.cancelTask(message.taskId);
    return {
      success: true,
      data: { cancelled },
    };
  }

  /**
   * Handle start queue
   */
  private async handleQueueStart(): Promise<MessageResponse> {
    await this.service.start();
    return { success: true };
  }

  /**
   * Handle stop queue
   */
  private async handleQueueStop(): Promise<MessageResponse> {
    this.service.stop();
    return { success: true };
  }

  /**
   * Handle pause queue
   */
  private async handleQueuePause(): Promise<MessageResponse> {
    this.service.pause();
    return { success: true };
  }

  /**
   * Handle resume queue
   */
  private async handleQueueResume(): Promise<MessageResponse> {
    await this.service.resume();
    return { success: true };
  }

  /**
   * Handle get stats
   */
  private async handleGetStats(): Promise<QueueStatsResponse> {
    const stats = this.service.getStats();
    return {
      success: true,
      data: { stats },
    };
  }

  /**
   * Handle get all tasks
   */
  private async handleGetTasks(): Promise<QueueTasksResponse> {
    const tasks = this.service.getAllTasks();
    return {
      success: true,
      data: { tasks },
    };
  }

  /**
   * Handle get single task
   */
  private async handleGetTask(message: any): Promise<QueueTaskResponse> {
    const task = this.service.getTask(message.taskId);
    return {
      success: true,
      data: { task },
    };
  }

  /**
   * Handle get tasks by status
   */
  private async handleGetTasksByStatus(message: any): Promise<QueueTasksResponse> {
    const tasks = this.service.getTasksByStatus(message.status);
    return {
      success: true,
      data: { tasks },
    };
  }

  /**
   * Handle get tasks by type
   */
  private async handleGetTasksByType(message: any): Promise<QueueTasksResponse> {
    const tasks = this.service.getTasksByType(message.taskType);
    return {
      success: true,
      data: { tasks },
    };
  }

  /**
   * Handle clear completed tasks
   */
  private async handleClearCompleted(): Promise<MessageResponse> {
    this.service.clearCompleted();
    return { success: true };
  }

  /**
   * Handle check queue running status
   */
  private async handleIsRunning(): Promise<QueueRunningResponse> {
    const status = this.service.getRunningStatus();
    return {
      success: true,
      data: { isRunning: status.isRunning, isPaused: status.isPaused },
    };
  }

  /**
   * Handle get all logs
   */
  private async handleGetLogs(): Promise<MessageResponse> {
    const logs = queueLogger.getLogs();
    return {
      success: true,
      data: { logs },
    };
  }

  /**
   * Handle clear logs
   */
  private async handleClearLogs(): Promise<MessageResponse> {
    queueLogger.clearLogs();
    return { success: true };
  }
}

// Export singleton instance
const messageHandler = new QueueMessageHandler();

/**
 * Setup message listener
 * Called when Background starts
 */
export function setupQueueMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only handle queue-related messages
    if (!isCommandMessage(message)) {
      return false;
    }

    queueLogger.debug('QueueMessageHandler', `Received message: ${message.type}`);

    // Handle message asynchronously
    messageHandler
      .handleMessage(message, sender)
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        queueLogger.error('QueueMessageHandler', 'Error handling message', { error: error.message });
        sendResponse({
          success: false,
          error: error.message || String(error),
        });
      });

    // Return true for async response
    return true;
  });

  queueLogger.info('QueueMessageHandler', 'Message listener registered');
}
