/**
 * Local Task Queue - Message Handler (Background)
 * 处理来自 Popup 的消息
 */

import { getLocalTaskQueueService } from './LocalTaskQueueService';
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
 * 消息处理器
 * 在 Background Service Worker 中处理来自 Popup 的命令
 */
export class QueueMessageHandler {
  private service = getLocalTaskQueueService();

  /**
   * 处理消息
   */
  async handleMessage(
    message: CommandMessage,
    sender: chrome.runtime.MessageSender,
  ): Promise<MessageResponse> {
    console.log(`[QueueMessageHandler] Handling message: ${message.type}`);

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
   * 处理添加任务
   */
  private async handleTaskAdd(message: any): Promise<TaskAddResponse> {
    const added = await this.service.addTask(message.task);
    return {
      success: true,
      data: { added },
    };
  }

  /**
   * 处理取消任务
   */
  private async handleTaskCancel(message: any): Promise<TaskCancelResponse> {
    const cancelled = await this.service.cancelTask(message.taskId);
    return {
      success: true,
      data: { cancelled },
    };
  }

  /**
   * 处理启动队列
   */
  private async handleQueueStart(): Promise<MessageResponse> {
    await this.service.start();
    return { success: true };
  }

  /**
   * 处理停止队列
   */
  private async handleQueueStop(): Promise<MessageResponse> {
    this.service.stop();
    return { success: true };
  }

  /**
   * 处理获取统计
   */
  private async handleGetStats(): Promise<QueueStatsResponse> {
    const stats = this.service.getStats();
    return {
      success: true,
      data: { stats },
    };
  }

  /**
   * 处理获取所有任务
   */
  private async handleGetTasks(): Promise<QueueTasksResponse> {
    const tasks = this.service.getAllTasks();
    return {
      success: true,
      data: { tasks },
    };
  }

  /**
   * 处理获取单个任务
   */
  private async handleGetTask(message: any): Promise<QueueTaskResponse> {
    const task = this.service.getTask(message.taskId);
    return {
      success: true,
      data: { task },
    };
  }

  /**
   * 处理按状态获取任务
   */
  private async handleGetTasksByStatus(message: any): Promise<QueueTasksResponse> {
    const tasks = this.service.getTasksByStatus(message.status);
    return {
      success: true,
      data: { tasks },
    };
  }

  /**
   * 处理按类型获取任务
   */
  private async handleGetTasksByType(message: any): Promise<QueueTasksResponse> {
    const tasks = this.service.getTasksByType(message.taskType);
    return {
      success: true,
      data: { tasks },
    };
  }

  /**
   * 处理清除已完成任务
   */
  private async handleClearCompleted(): Promise<MessageResponse> {
    this.service.clearCompleted();
    return { success: true };
  }

  /**
   * 处理检查队列运行状态
   */
  private async handleIsRunning(): Promise<QueueRunningResponse> {
    const isRunning = this.service.isRunning();
    return {
      success: true,
      data: { isRunning },
    };
  }
}

// 导出单例实例
const messageHandler = new QueueMessageHandler();

/**
 * 设置消息监听器
 * 在 Background 启动时调用
 */
export function setupQueueMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 仅处理队列相关消息
    if (!isCommandMessage(message)) {
      return false;
    }

    console.log('[QueueMessageHandler] Received message:', message.type);

    // 异步处理消息
    messageHandler
      .handleMessage(message, sender)
      .then(response => {
        sendResponse(response);
      })
      .catch(error => {
        console.error('[QueueMessageHandler] Error:', error);
        sendResponse({
          success: false,
          error: error.message || String(error),
        });
      });

    // 返回 true 表示异步响应
    return true;
  });

  console.log('[QueueMessageHandler] Message listener registered');
}
