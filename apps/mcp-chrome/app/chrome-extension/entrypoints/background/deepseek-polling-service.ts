/**
 * DeepSeek Polling Service
 * Monitors DeepSeek tasks and detects completion
 */

import { getTaskQueueManager, TaskStatus, type DeepSeekTask, type TaskResult } from '@/utils/deepseek-task-queue';

/**
 * DeepSeek UI selectors
 */
const DEEPSEEK_SELECTORS = {
  // Text input area
  INPUT: 'textarea[placeholder*="输入"], textarea[placeholder*="Ask"], textarea[data-id="chat-input"]',

  // Send button
  SEND_BUTTON: 'button[type="submit"], button[aria-label*="Send"]',

  // Stop generating button (indicates generating)
  STOP_BUTTON: 'button:has-text("停止"), button:has-text("Stop"), button[aria-label*="Stop"]',

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
}

/**
 * DeepSeek Polling Service
 * Monitors DeepSeek UI for task completion
 */
export class DeepSeekPollingService {
  private pollingStates: Map<string, PollingState> = new Map();
  private taskQueueManager = getTaskQueueManager();
  private maxConcurrentPolling = 5;
  private initialized = false;

  /**
   * Initialize the polling service
   */
  async initialize(): Promise<void> {
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

    // Check concurrent polling limit
    if (this.pollingStates.size >= this.maxConcurrentPolling) {
      console.warn(`Max concurrent polling limit reached (${this.maxConcurrentPolling}), queueing task ${taskId}`);
      // TODO: Implement queuing for polling
      return;
    }

    const state: PollingState = {
      taskId,
      retries: 0,
      lastCheck: Date.now(),
      currentBackoff: 1000, // Start with 1 second
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
    if (!state) return;

    if (state.intervalId) {
      clearTimeout(state.intervalId);
    }

    this.pollingStates.delete(taskId);
    console.log(`Stopped polling task ${taskId}`);
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

      if (status.isCompleted) {
        await this.handleCompletion(taskId, status.result!);
      } else if (status.isError) {
        await this.handleError(taskId, status.error || 'Unknown error');
      } else if (status.isGenerating) {
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
      // Continue polling on error
      this.scheduleNextPoll(taskId);
    }
  }

  /**
   * Check task status by inspecting DeepSeek UI
   */
  private async checkTaskStatus(task: DeepSeekTask): Promise<{
    isCompleted: boolean;
    isGenerating: boolean;
    isError: boolean;
    result?: TaskResult;
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
          // Check for stop button (indicates generating)
          const stopButton = document.querySelector('button[aria-label*="Stop"], button:has-text("Stop"), button:has-text("停止")');
          const isGenerating = stopButton !== null && !stopButton.hasAttribute('disabled');

          // Check for error
          const errorElement = document.querySelector('[class*="error"], [class*="failed"], [role="alert"]');
          const hasError = errorElement !== null;
          const errorText = errorElement?.textContent || '';

          // Get last message
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
            conversationUrl: window.location.href,
          };
        },
      });

      if (!results || results.length === 0) {
        return { isCompleted: false, isGenerating: false, isError: true, error: 'Failed to execute script' };
      }

      const result = results[0].result;

      if (result.hasError) {
        return {
          isCompleted: false,
          isGenerating: false,
          isError: true,
          error: result.errorText || 'Unknown error from DeepSeek',
        };
      }

      if (result.isCompleted) {
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
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Handle task completion
   */
  private async handleCompletion(taskId: string, result: TaskResult): Promise<void> {
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
