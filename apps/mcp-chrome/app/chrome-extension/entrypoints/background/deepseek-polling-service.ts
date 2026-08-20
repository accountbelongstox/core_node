/**
 * DeepSeek Polling Service
 * Monitors DeepSeek tasks and detects completion
 */

import {
  getTaskQueueManager,
  TaskStatus,
  type DeepSeekTask,
  type DeepSeekTaskResult,
} from '@/utils/deepseek-task-queue';
import { AsyncOperationController } from '@/utils/async';
import { toErrorMessage } from '@/utils/errors';

/**
 * DeepSeek UI selectors
 */
const DEEPSEEK_SELECTORS = {
  // Text input area (supports both Chinese and English interfaces)
  INPUT: 'textarea[placeholder*="输入"], textarea[placeholder*="Ask"], textarea[data-id="chat-input"]',

  // Send button
  SEND_BUTTON: 'button[type="submit"], button[aria-label*="Send"]',

  // Stop generating button (indicates response is being generated, supports Chinese and English).
  // Only the valid CSS clause is kept; :has-text() is a Playwright-only pseudo-selector that is
  // invalid in native querySelector (throws SyntaxError, fails the whole selector list), so text
  // matching for "Stop"/"停止" is done in JS (see checkTaskStatus).
  STOP_BUTTON: 'button[aria-label*="Stop"]',

  // Response container
  RESPONSE: '.ds-markdown, [class*="markdown"], [class*="message-content"]',

  // Last message from assistant
  LAST_MESSAGE: '.ds-markdown:last-of-type, [class*="markdown"]:last-of-type, [class*="assistant-message"]:last-of-type',

  // Error indicators
  ERROR: '[class*="error"], [class*="failed"], [role="alert"]',

  // Loading/thinking indicators
  LOADING: '[class*="loading"], [class*="thinking"], [class*="generating"]',
};

/**
 * Polling state for a task
 */
interface PollingState {
  taskId: string;
  intervalId?: number;
  retries: number;
  lastCheck: number;
  currentBackoff: number;
  // True once the stop/generating button has been observed at least once.
  // Prevents the very first poll(s) from declaring "complete" on a stale
  // response that was already on screen before the new prompt was submitted.
  sawGenerating: boolean;
}

/**
 * DeepSeek Polling Service
 * Monitors DeepSeek UI for task completion
 */
export class DeepSeekPollingService {
  private pollingStates: Map<string, PollingState> = new Map();
  // Tasks awaiting a free polling slot; drained by promoteNextQueuedTask() when
  // stopPolling() frees a slot. Rebuilt from persisted PENDING/GENERATING tasks on
  // every initialize(), so it does not need separate persistence.
  private overflowQueue: string[] = [];
  private taskQueueManager = getTaskQueueManager();
  private initialized = false;
  private readonly initialization = new AsyncOperationController<void>();

  /**
   * Initialize the polling service
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    return this.initialization.run(() => this._doInitialize());
  }

  private async _doInitialize(): Promise<void> {
    if (this.initialized) return;

    // Initialize task queue manager
    await this.taskQueueManager.initialize();

    // Resume polling for any pending/generating tasks
    const { tasks } = await this.taskQueueManager.listTasks({
      status: [TaskStatus.PENDING, TaskStatus.GENERATING],
    });

    console.log(`Found ${tasks.length} tasks to resume polling`);
    for (const task of tasks) {
      if (task.tabId) {
        this.startPolling(task.id);
      } else {
        // Task has no tab ID, mark as failed
        await this.taskQueueManager.updateTask(task.id, {
          status: TaskStatus.FAILED,
          error: 'Tab not found for polling',
        });
      }
    }

    this.initialized = true;
    console.log('DeepSeekPollingService initialized');
  }

  /**
   * Start polling a task
   */
  startPolling(taskId: string): void {
    // Check if already polling
    if (this.pollingStates.has(taskId)) {
      console.warn(`Already polling task ${taskId}`);
      return;
    }

    const maxConcurrent = this.taskQueueManager.getConfig().maxConcurrentPolling;

    // Check concurrent polling limit; queue overflow tasks instead of dropping them.
    // Previously this logged "queueing" but returned without queuing, leaving tasks
    // PENDING forever with no self-healing. The overflow queue is drained by
    // promoteNextQueuedTask() whenever stopPolling() frees a slot.
    if (this.pollingStates.size >= maxConcurrent) {
      if (!this.overflowQueue.includes(taskId)) {
        this.overflowQueue.push(taskId);
        console.log(`Max concurrent polling limit reached (${maxConcurrent}), queued task ${taskId} (queue depth: ${this.overflowQueue.length})`);
      }
      return;
    }

    const state: PollingState = {
      taskId,
      retries: 0,
      lastCheck: Date.now(),
      currentBackoff: 1000, // Start with 1 second
      sawGenerating: false,
    };

    this.pollingStates.set(taskId, state);
    this.scheduleNextPoll(taskId);
    console.log(`Started polling task ${taskId}`);
  }

  /**
   * Stop polling a task
   */
  stopPolling(taskId: string): void {
    const state = this.pollingStates.get(taskId);
    if (state) {
      if (state.intervalId) {
        clearTimeout(state.intervalId);
      }
      this.pollingStates.delete(taskId);
      console.log(`Stopped polling task ${taskId}`);
    } else {
      // Task may be sitting in the overflow queue; remove it so it is not
      // promoted after it has already reached a final state.
      this.overflowQueue = this.overflowQueue.filter((id) => id !== taskId);
    }

    // A slot freed up (or the task was dequeued); promote the next queued task.
    this.promoteNextQueuedTask();
  }

  /**
   * Promote queued tasks into free polling slots
   */
  private promoteNextQueuedTask(): void {
    if (this.overflowQueue.length === 0) return;
    const maxConcurrent = this.taskQueueManager.getConfig().maxConcurrentPolling;
    while (this.pollingStates.size < maxConcurrent && this.overflowQueue.length > 0) {
      const nextTaskId = this.overflowQueue.shift()!;
      // startPolling re-checks the limit; since we just verified size < maxConcurrent
      // synchronously it will start the task rather than re-queue it.
      this.startPolling(nextTaskId);
    }
  }

  /**
   * Schedule next poll with backoff
   */
  private scheduleNextPoll(taskId: string): void {
    const state = this.pollingStates.get(taskId);
    if (!state) return;

    const config = this.taskQueueManager.getConfig();

    // Check if max retries reached
    if (state.retries >= config.maxRetries) {
      this.handleTimeout(taskId);
      return;
    }

    // Schedule next check with exponential backoff (capped at 10 seconds)
    const nextBackoff = Math.min(state.currentBackoff * 1.5, 10000);

    state.intervalId = setTimeout(async () => {
      await this.pollTask(taskId);
    }, state.currentBackoff) as unknown as number;

    state.currentBackoff = nextBackoff;
    state.retries++;
  }

  /**
   * Poll a task for completion
   */
  private async pollTask(taskId: string): Promise<void> {
    const state = this.pollingStates.get(taskId);
    if (!state) return;

    try {
      const task = await this.taskQueueManager.getTask(taskId);
      if (!task) {
        console.error(`Task ${taskId} not found`);
        this.stopPolling(taskId);
        return;
      }

      // Check if task is in cancellable state
      if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)) {
        console.log(`Task ${taskId} is already in final state: ${task.status}`);
        this.stopPolling(taskId);
        return;
      }

      if (!task.tabId) {
        await this.handleError(taskId, 'Tab ID not found');
        return;
      }

      // Check if tab still exists
      try {
        await chrome.tabs.get(task.tabId);
      } catch (error) {
        await this.handleError(taskId, 'Tab closed');
        return;
      }

      // Check task status
      const status = await this.checkTaskStatus(task);

      // Track whether we have observed the generating state at least once.
      // A "completed" signal before we ever see generating means the page
      // still shows a previous response — ignore it and keep polling.
      if (status.isGenerating) {
        state.sawGenerating = true;
      }

      if (status.isCompleted && (state.sawGenerating || task.responseBaseline !== undefined)) {
        await this.handleCompletion(taskId, status.result!);
      } else if (status.isError) {
        await this.handleError(taskId, status.error || 'Unknown error');
      } else if (status.isGenerating || status.isCompleted) {
        // isCompleted without sawGenerating: treat as still pending (stale
        // response from a prior conversation turn).
        // Update status to generating if not already
        if (task.status !== TaskStatus.GENERATING) {
          await this.taskQueueManager.updateTask(taskId, {
            status: TaskStatus.GENERATING,
          });
        }
        // Schedule next poll
        this.scheduleNextPoll(taskId);
      } else {
        // Still pending
        this.scheduleNextPoll(taskId);
      }

      state.lastCheck = Date.now();
    } catch (error) {
      console.error(`Error polling task ${taskId}:`, error);
      const msg = toErrorMessage(error);
      // Tab-gone errors are permanent: fail immediately instead of burning
      // every remaining retry on a tab that will never come back.
      if (/no such tab|tab.*closed|cannot.*tab|invalid tab/i.test(msg)) {
        try {
          await this.handleError(taskId, msg);
        } catch (handleErr) {
          console.error(`handleError also failed for ${taskId}:`, handleErr);
          this.pollingStates.delete(taskId);
        }
      } else {
        // Transient error — continue polling
        this.scheduleNextPoll(taskId);
      }
    }
  }

  /**
   * Check task status by inspecting DeepSeek UI
   */
  private async checkTaskStatus(task: DeepSeekTask): Promise<{
    isCompleted: boolean;
    isGenerating: boolean;
    isError: boolean;
    result?: DeepSeekTaskResult;
    error?: string;
  }> {
    if (!task.tabId) {
      return { isCompleted: false, isGenerating: false, isError: true, error: 'No tab ID' };
    }

    try {
      // Execute script in tab to check UI state
      const results = await chrome.scripting.executeScript({
        target: { tabId: task.tabId },
        func: () => {
          // Stop button indicates generating. :has-text() is a Playwright-only pseudo-selector
          // that is invalid in native querySelector (it throws SyntaxError and fails the whole
          // non-forgiving selector list), so query the valid CSS clause and fall back to in-JS
          // text matching for "Stop"/"停止".
          let stopButton = document.querySelector('button[aria-label*="Stop"]');
          if (!stopButton) {
            stopButton =
              Array.from(document.querySelectorAll('button')).find(
                (b) => /Stop|停止/.test(b.textContent || '')
              ) || null;
          }
          const isGenerating = stopButton !== null && !stopButton.hasAttribute('disabled');

          // Check for error
          const errorElement = document.querySelector('[class*="error"], [class*="failed"], [role="alert"]');
          const hasError = errorElement !== null;
          const errorText = errorElement?.textContent || '';

          const messageElements = document.querySelectorAll('.ds-markdown, [class*="markdown"], [class*="message-content"]');
          const lastMessage = messageElements[messageElements.length - 1];
          const lastMessageText = lastMessage?.textContent || '';
          const lastMessageHTML = lastMessage?.innerHTML || '';

          // Check if response is complete (no stop button and has content)
          const isCompleted = !isGenerating && lastMessageText.length > 0;

          return {
            isGenerating,
            hasError,
            errorText,
            isCompleted,
            lastMessageText,
            lastMessageHTML,
            messageCount: messageElements.length,
            conversationUrl: window.location.href,
          };
        },
      });

      if (!results || results.length === 0) {
        return { isCompleted: false, isGenerating: false, isError: true, error: 'Failed to execute script' };
      }

      const result = results[0].result;

      if (!result) {
        return { isCompleted: false, isGenerating: false, isError: true, error: 'Empty script result' };
      }

      if (result.hasError) {
        return {
          isCompleted: false,
          isGenerating: false,
          isError: true,
          error: result.errorText || 'Unknown error from DeepSeek',
        };
      }

      const hasNewResponse = typeof task.responseBaseline === 'number'
        ? result.messageCount > task.responseBaseline
        : result.isCompleted;

      if (result.isCompleted && hasNewResponse) {
        return {
          isCompleted: true,
          isGenerating: false,
          isError: false,
          result: {
            content: result.lastMessageText,
            conversationUrl: result.conversationUrl,
            extractedAt: Date.now(),
          },
        };
      }

      return {
        isCompleted: false,
        isGenerating: result.isGenerating,
        isError: false,
      };
    } catch (error) {
      console.error(`Error checking task status for ${task.id}:`, error);
      return {
        isCompleted: false,
        isGenerating: false,
        isError: true,
        error: toErrorMessage(error),
      };
    }
  }

  /**
   * Handle task completion
   */
  private async handleCompletion(taskId: string, result: DeepSeekTaskResult): Promise<void> {
    console.log(`Task ${taskId} completed`);

    await this.taskQueueManager.updateTask(taskId, {
      status: TaskStatus.COMPLETED,
      result,
    });

    this.stopPolling(taskId);
  }

  /**
   * Handle task error
   */
  private async handleError(taskId: string, error: string): Promise<void> {
    console.error(`Task ${taskId} failed:`, error);

    await this.taskQueueManager.updateTask(taskId, {
      status: TaskStatus.FAILED,
      error,
    });

    this.stopPolling(taskId);
  }

  /**
   * Handle task timeout
   */
  private async handleTimeout(taskId: string): Promise<void> {
    console.warn(`Task ${taskId} timed out`);

    await this.taskQueueManager.updateTask(taskId, {
      status: TaskStatus.FAILED,
      error: 'Polling timeout exceeded',
    });

    this.stopPolling(taskId);
  }

  /**
   * Get polling statistics
   */
  getPollingStatistics(): {
    activePolling: number;
    pollingTasks: string[];
  } {
    return {
      activePolling: this.pollingStates.size,
      pollingTasks: Array.from(this.pollingStates.keys()),
    };
  }
}

// Singleton instance
let pollingServiceInstance: DeepSeekPollingService | null = null;

/**
 * Get the singleton DeepSeekPollingService instance
 */
export function getDeepSeekPollingService(): DeepSeekPollingService {
  if (!pollingServiceInstance) {
    pollingServiceInstance = new DeepSeekPollingService();
  }
  return pollingServiceInstance;
}
