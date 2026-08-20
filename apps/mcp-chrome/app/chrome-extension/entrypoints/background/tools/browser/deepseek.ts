/**
 * DeepSeek Tools
 * Tools for automated interaction with DeepSeek Chat
 */

import { createErrorResponse, createJsonResponse, toErrorMessage, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { ERROR_MESSAGES } from '@/common/constants';
import { AsyncMutex, delay as waitForDelay } from '@/utils/async';
import {
  getTaskQueueManager,
  TaskStatus,
  type DeepSeekTask,
  type DeepSeekOptions,
  type TaskFilter,
} from '@/utils/deepseek-task-queue';
import { getDeepSeekPollingService } from '../../deepseek-polling-service';
import { tabController } from '../../services/tab-controller';
import { inspectDeepSeekPage, type DeepSeekPageObservation } from '@/utils/deepseek-page';

const DEEPSEEK_URL = 'https://chat.deepseek.com/';
const deepSeekConversationMutex = new AsyncMutex();

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
    await waitForDelay(1000);
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

    const releaseConversation = await deepSeekConversationMutex.acquire();
    let ownsConversation = true;

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
        // Reuse existing tab in the BACKGROUND — do NOT foreground it. Prompt
        // injection + result capture run via executeScript, which works on an
        // inactive tab, so the user's focus is never stolen.
        tab = existingTabs[0];
      } else {
        // Create the worker tab in the BACKGROUND (active:false) — no focus steal.
        tab = await tabController.openBackgroundTab(DEEPSEEK_URL);
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
      await waitForDelay(3000);

      // Update status to sending
      await taskManager.updateTask(task.id, { status: TaskStatus.SENDING });

      // Send the prompt
      try {
        const baselineResult = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: inspectDeepSeekPage,
        });
        const baseline = baselineResult[0]?.result as DeepSeekPageObservation | undefined;
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          // Runs in the page. Kept resilient to DeepSeek UI drift: broad input
          // selectors (textarea OR contenteditable), a React-safe value set, a
          // short settle so the send button can enable, and an Enter-key
          // fallback when no send button is present. Returns a structured
          // {success, reason?} instead of throwing so the caller can report a
          // clean message.
          func: async (promptText: string) => {
            const isVisible = (el: any): boolean => {
              if (!el) return false;
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            };
            const pick = (selectors: string[], extra?: (el: any) => boolean): any => {
              for (const sel of selectors) {
                const list = Array.from(document.querySelectorAll(sel)).filter(
                  (el) => isVisible(el) && (!extra || extra(el)),
                );
                if (list.length) return list[list.length - 1];
              }
              return null;
            };

            const input: any = pick([
              '#chat-input',
              'textarea[placeholder]',
              'textarea',
              'div[contenteditable="true"]',
              '[role="textbox"]',
            ]);
            if (!input) return { success: false, reason: 'input control not found' };
            const tag = input.tagName;
            if (tag === 'TEXTAREA' || tag === 'INPUT') {
              // React overrides the value setter — go through the native one so
              // the framework registers the change and enables the send button.
              const proto =
                tag === 'TEXTAREA'
                  ? window.HTMLTextAreaElement.prototype
                  : window.HTMLInputElement.prototype;
              const desc = Object.getOwnPropertyDescriptor(proto, 'value');
              if (desc && desc.set) desc.set.call(input, promptText);
              else input.value = promptText;
            } else {
              input.focus();
              input.textContent = promptText;
            }
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));

            // Let the framework react (enable the send button) before sending.
            await new Promise((resolve) => window.setTimeout(resolve, 200));

            const sendBtn: any = pick(
              [
                'button[type="submit"]',
                'button[data-testid*="send" i]',
                '[data-testid*="send-button" i]',
                'button[aria-label*="Send" i]',
                'button[aria-label*="发送"]',
                'div[role="button"][aria-label*="Send" i]',
              ],
              (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true',
            );
            const inputContainer = input.closest('form') || input.parentElement?.parentElement;
            const containerButtons = inputContainer
              ? Array.from(inputContainer.querySelectorAll('button,[role="button"]')).filter(
                  (el: any) => isVisible(el)
                    && !el.disabled
                    && el.getAttribute('aria-disabled') !== 'true',
                )
              : [];
            const resolvedSendBtn: any = sendBtn || containerButtons[containerButtons.length - 1] || null;
            if (resolvedSendBtn) {
              resolvedSendBtn.click();
            } else {
              const opts: any = {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true,
              };
              input.dispatchEvent(new KeyboardEvent('keydown', opts));
              input.dispatchEvent(new KeyboardEvent('keypress', opts));
              input.dispatchEvent(new KeyboardEvent('keyup', opts));
            }

            await new Promise((resolve) => window.setTimeout(resolve, 400));
            const remainingValue = tag === 'TEXTAREA' || tag === 'INPUT'
              ? String(input.value || '').trim()
              : String(input.textContent || '').trim();
            if (remainingValue === promptText.trim()) {
              return { success: false, reason: 'send action did not submit the prompt' };
            }

            return {
              success: true,
              conversationUrl: window.location.href,
              sentVia: resolvedSendBtn ? 'button' : 'enter',
            };
          },
          args: [prompt],
        });

        // executeScript returns result[0].result = null when the injected func
        // threw/failed. The func returns {success:false, reason} for a missing
        // control. The OUTER catch prefixes "Failed to send prompt:" — so the
        // message thrown here must NOT include that prefix (avoids doubling).
        const frame = result && result.length > 0 ? result[0] : null;
        const injected = frame
          ? (frame.result as {
              success?: boolean;
              conversationUrl?: string;
              reason?: string;
            } | null)
          : null;
        if (!injected || !injected.success) {
          const reason = injected && injected.reason ? injected.reason : 'input/send controls not found';
          throw new Error(`DeepSeek ${reason} — open chat.deepseek.com and sign in, then retry`);
        }

        const conversationUrl = injected.conversationUrl;

        // Update task status to pending
        await taskManager.updateTask(task.id, {
          status: TaskStatus.PENDING,
          conversationId: conversationUrl,
          responseBaseline: baseline?.assistantMessageCount ?? 0,
          responseBaselineKey: baseline?.lastResponseKey ?? '',
        });

        // Start polling
        pollingService.startPolling(task.id);

        // If waitForCompletion, wait for result
        if (waitForCompletion) {
          const completedTask = await waitForTaskCompletion(task.id, timeout);
          releaseConversation();
          ownsConversation = false;

          return createJsonResponse({
            taskId: completedTask.id,
            status: completedTask.status,
            conversationUrl: completedTask.conversationId,
            result: completedTask.result,
          });
        }

        void waitForTaskCompletion(task.id, timeout)
          .catch(() => undefined)
          .finally(releaseConversation);
        ownsConversation = false;

        // Return task ID immediately
        return createJsonResponse({
          taskId: task.id,
          status: task.status,
          conversationUrl,
        });
      } catch (error) {
        await taskManager.updateTask(task.id, {
          status: TaskStatus.FAILED,
          error: toErrorMessage(error),
        });
        throw error;
      }
    } catch (error) {
      console.error('Error in deepseek_send_prompt:', error);
      return createErrorResponse(
        `Failed to send prompt: ${toErrorMessage(error)}`
      );
    } finally {
      if (ownsConversation) releaseConversation();
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
      const pollingService = getDeepSeekPollingService();
      await taskManager.initialize();
      await pollingService.pollNow(taskId);

      const task = await taskManager.getTask(taskId);
      const observation = task ? await pollingService.inspectTask(taskId) : null;

      if (!task) {
        return createErrorResponse(`Task ${taskId} not found`);
      }

      return createJsonResponse({ task, observation });
    } catch (error) {
      console.error('Error in deepseek_get_task_status:', error);
      return createErrorResponse(
        `Failed to get task status: ${toErrorMessage(error)}`
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

      return createJsonResponse({
        taskId: task.id,
        status: task.status,
        result: task.result,
        error: task.error,
      });
    } catch (error) {
      console.error('Error in deepseek_get_result:', error);
      return createErrorResponse(
        `Failed to get result: ${toErrorMessage(error)}`
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

      return createJsonResponse(result);
    } catch (error) {
      console.error('Error in deepseek_list_tasks:', error);
      return createErrorResponse(
        `Failed to list tasks: ${toErrorMessage(error)}`
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

      return createJsonResponse({
        taskId,
        status: updatedTask?.status,
        cancelled: updatedTask?.status === TaskStatus.CANCELLED,
      });
    } catch (error) {
      console.error('Error in deepseek_cancel_task:', error);
      return createErrorResponse(
        `Failed to cancel task: ${toErrorMessage(error)}`
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
