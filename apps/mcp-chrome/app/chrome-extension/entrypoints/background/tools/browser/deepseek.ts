/**
 * DeepSeek Tools
 * Tools for automated interaction with DeepSeek Chat
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { ERROR_MESSAGES } from '@/common/constants';
import {
  getTaskQueueManager,
  TaskStatus,
  type DeepSeekTask,
  type DeepSeekOptions,
  type TaskFilter,
} from '@/utils/deepseek-task-queue';
import { getDeepSeekPollingService } from '../../deepseek-polling-service';
import { tabController } from '../../services/tab-controller';

const DEEPSEEK_URL = 'https://chat.deepseek.com/';

/**
 * Helper to wait for task completion
 */
async function waitForTaskCompletion(
  taskId: string,
  timeout: number = 300000
): Promise<DeepSeekTask> {
  const taskManager = getTaskQueueManager();
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const task = await taskManager.getTask(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (task.status === TaskStatus.COMPLETED) {
      return task;
    }

    if (task.status === TaskStatus.FAILED) {
      throw new Error(task.error || 'Task failed');
    }

    if (task.status === TaskStatus.CANCELLED) {
      throw new Error('Task was cancelled');
    }

    // Wait 1 second before checking again
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Task completion timeout');
}

/**
 * Send Prompt Tool
 * Sends a prompt to DeepSeek and optionally waits for completion
 */
class DeepSeekSendPromptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.DEEPSEEK.SEND_PROMPT;

  async execute(args: {
    prompt: string;
    attachments?: string[];
    waitForCompletion?: boolean;
    timeout?: number;
    autoRetry?: boolean;
  }): Promise<ToolResult> {
    const {
      prompt,
      attachments,
      waitForCompletion = false,
      timeout = 300000,
      autoRetry = true,
    } = args;

    if (!prompt || prompt.trim().length === 0) {
      return createErrorResponse('Prompt is required');
    }

    try {
      const taskManager = getTaskQueueManager();
      const pollingService = getDeepSeekPollingService();

      // Initialize services
      await taskManager.initialize();
      await pollingService.initialize();

      // Create task
      const options: DeepSeekOptions = {
        waitForCompletion,
        timeout,
        autoRetry,
        attachFiles: (attachments && attachments.length > 0) || false,
      };

      const task = await taskManager.createTask(prompt, options);

      // Open DeepSeek in a new tab or reuse existing
      let tab: chrome.tabs.Tab;
      const existingTabs = await chrome.tabs.query({ url: DEEPSEEK_URL + '*' });

      if (existingTabs.length > 0 && existingTabs[0].id) {
        // Reuse existing tab — activate via TabController so this programmatic
        // switch is recorded and never mis-counted as human tab activity.
        tab = existingTabs[0];
        await tabController.activate(tab.id);
      } else {
        // Create new tab (active) and record the activation we just caused.
        tab = await chrome.tabs.create({ url: DEEPSEEK_URL, active: true });
        tabController.recordActivation(tab.id ?? -1);
      }

      if (!tab.id) {
        await taskManager.updateTask(task.id, {
          status: TaskStatus.FAILED,
          error: 'Failed to create or get tab',
        });
        return createErrorResponse('Failed to create or get tab');
      }

      // Update task with tab ID
      await taskManager.updateTask(task.id, { tabId: tab.id });

      // Wait for page to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Update status to sending
      await taskManager.updateTask(task.id, { status: TaskStatus.SENDING });

      // Send the prompt
      try {
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (promptText: string) => {
            // Find input textarea (supports both Chinese and English interfaces)
            const input = document.querySelector(
              'textarea[placeholder*="输入"], textarea[placeholder*="Ask"], textarea[data-id="chat-input"]'
            ) as HTMLTextAreaElement;

            if (!input) {
              throw new Error('Input textarea not found');
            }

            // Set the value
            input.value = promptText;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Find and click send button
            const sendButton = document.querySelector(
              'button[type="submit"], button[aria-label*="Send"]'
            ) as HTMLButtonElement;

            if (!sendButton) {
              throw new Error('Send button not found');
            }

            sendButton.click();

            return {
              success: true,
              conversationUrl: window.location.href,
            };
          },
          args: [prompt],
        });

        if (!result || result.length === 0 || !result[0].result.success) {
          throw new Error('Failed to send prompt');
        }

        const conversationUrl = result[0].result.conversationUrl;

        // Update task status to pending
        await taskManager.updateTask(task.id, {
          status: TaskStatus.PENDING,
          conversationId: conversationUrl,
        });

        // Start polling
        pollingService.startPolling(task.id);

        // If waitForCompletion, wait for result
        if (waitForCompletion) {
          const completedTask = await waitForTaskCompletion(task.id, timeout);

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  taskId: completedTask.id,
                  status: completedTask.status,
                  conversationUrl: completedTask.conversationId,
                  result: completedTask.result,
                }),
              },
            ],
            isError: false,
          };
        }

        // Return task ID immediately
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                taskId: task.id,
                status: task.status,
                conversationUrl,
              }),
            },
          ],
          isError: false,
        };
      } catch (error) {
        await taskManager.updateTask(task.id, {
          status: TaskStatus.FAILED,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    } catch (error) {
      console.error('Error in deepseek_send_prompt:', error);
      return createErrorResponse(
        `Failed to send prompt: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Get Task Status Tool
 * Gets the current status of a task
 */
class DeepSeekGetTaskStatusTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.DEEPSEEK.GET_TASK_STATUS;

  async execute(args: { taskId: string }): Promise<ToolResult> {
    const { taskId } = args;

    if (!taskId) {
      return createErrorResponse('Task ID is required');
    }

    try {
      const taskManager = getTaskQueueManager();
      await taskManager.initialize();

      const task = await taskManager.getTask(taskId);

      if (!task) {
        return createErrorResponse(`Task ${taskId} not found`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ task }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in deepseek_get_task_status:', error);
      return createErrorResponse(
        `Failed to get task status: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Get Result Tool
 * Gets the result of a completed task
 */
class DeepSeekGetResultTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.DEEPSEEK.GET_RESULT;

  async execute(args: {
    taskId: string;
    waitForCompletion?: boolean;
    timeout?: number;
  }): Promise<ToolResult> {
    const { taskId, waitForCompletion = false, timeout = 60000 } = args;

    if (!taskId) {
      return createErrorResponse('Task ID is required');
    }

    try {
      const taskManager = getTaskQueueManager();
      await taskManager.initialize();

      let task = await taskManager.getTask(taskId);

      if (!task) {
        return createErrorResponse(`Task ${taskId} not found`);
      }

      // If waitForCompletion and task is not complete, wait
      if (waitForCompletion && ![TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)) {
        task = await waitForTaskCompletion(taskId, timeout);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              taskId: task.id,
              status: task.status,
              result: task.result,
              error: task.error,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in deepseek_get_result:', error);
      return createErrorResponse(
        `Failed to get result: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * List Tasks Tool
 * Lists all tasks with optional filtering
 */
class DeepSeekListTasksTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.DEEPSEEK.LIST_TASKS;

  async execute(args: {
    status?: TaskStatus | TaskStatus[];
    limit?: number;
    offset?: number;
  }): Promise<ToolResult> {
    try {
      const taskManager = getTaskQueueManager();
      await taskManager.initialize();

      const filter: TaskFilter = {
        status: args.status,
        limit: args.limit,
        offset: args.offset,
      };

      const result = await taskManager.listTasks(filter);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in deepseek_list_tasks:', error);
      return createErrorResponse(
        `Failed to list tasks: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Cancel Task Tool
 * Cancels a pending or running task
 */
class DeepSeekCancelTaskTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.DEEPSEEK.CANCEL_TASK;

  async execute(args: { taskId: string }): Promise<ToolResult> {
    const { taskId } = args;

    if (!taskId) {
      return createErrorResponse('Task ID is required');
    }

    try {
      const taskManager = getTaskQueueManager();
      const pollingService = getDeepSeekPollingService();

      await taskManager.initialize();

      const task = await taskManager.getTask(taskId);

      if (!task) {
        return createErrorResponse(`Task ${taskId} not found`);
      }

      // Stop polling
      pollingService.stopPolling(taskId);

      // Cancel the task
      await taskManager.cancelTask(taskId);

      const updatedTask = await taskManager.getTask(taskId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              taskId,
              status: updatedTask?.status,
              cancelled: updatedTask?.status === TaskStatus.CANCELLED,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in deepseek_cancel_task:', error);
      return createErrorResponse(
        `Failed to cancel task: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

// Export tool instances
export const deepseekSendPromptTool = new DeepSeekSendPromptTool();
export const deepseekGetTaskStatusTool = new DeepSeekGetTaskStatusTool();
export const deepseekGetResultTool = new DeepSeekGetResultTool();
export const deepseekListTasksTool = new DeepSeekListTasksTool();
export const deepseekCancelTaskTool = new DeepSeekCancelTaskTool();
