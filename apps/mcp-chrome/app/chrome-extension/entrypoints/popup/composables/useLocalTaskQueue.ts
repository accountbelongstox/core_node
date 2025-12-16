/**
 * Local Task Queue Composable (Popup)
 * 通过消息通信与 Background 中的队列交互
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import {
  MessageType,
  TaskType,
  TaskStatus,
  type Task,
  type TaskQueueStats,
  type BingDictionaryTaskDetails,
  type DeepSeekTaskDetails,
  type MessageResponse,
  type QueueEventMessage,
  isEventMessage,
} from '@/entrypoints/background/services/local-task-queue';

/**
 * 发送消息到 Background
 */
async function sendMessage<T = any>(message: any): Promise<MessageResponse<T>> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: MessageResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error('No response from background'));
      } else if (!response.success) {
        reject(new Error(response.error || 'Unknown error'));
      } else {
        resolve(response);
      }
    });
  });
}

export function useLocalTaskQueue() {
  // Reactive state
  const stats = ref<TaskQueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    byType: {} as Record<TaskType, number>,
  });

  const tasks = ref<Task[]>([]);
  const isRunning = ref(false);

  // Computed
  const hasPendingTasks = computed(() => stats.value.pending > 0);
  const hasProcessingTasks = computed(() => stats.value.processing > 0);
  const isActive = computed(() => isRunning.value || hasProcessingTasks.value);

  // Update state from background
  const updateState = async () => {
    try {
      // Get stats
      const statsResponse = await sendMessage<{ stats: TaskQueueStats }>({
        type: MessageType.QUEUE_GET_STATS,
      });

      if (statsResponse.data) {
        stats.value = statsResponse.data.stats;
      }

      // Get tasks
      const tasksResponse = await sendMessage<{ tasks: Task[] }>({
        type: MessageType.QUEUE_GET_TASKS,
      });

      if (tasksResponse.data) {
        tasks.value = tasksResponse.data.tasks;
      }

      // Get running status
      const runningResponse = await sendMessage<{ isRunning: boolean }>({
        type: MessageType.QUEUE_IS_RUNNING,
      });

      if (runningResponse.data) {
        isRunning.value = runningResponse.data.isRunning;
      }
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to update state:', error);
    }
  };

  // Add Bing Dictionary task
  const addBingDictionaryTask = async (
    words: Array<{ word: string; md5?: string }>,
    options: {
      language?: string;
      batchSize?: number;
      priority?: number;
    } = {},
  ): Promise<boolean> => {
    try {
      const taskDetails: BingDictionaryTaskDetails = {
        words,
        language: options.language || 'english',
        batchSize: options.batchSize || 1,
        provider: 'bing',
      };

      const task: Task<BingDictionaryTaskDetails> = {
        id: `bing-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: TaskType.BING_DICTIONARY,
        status: TaskStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        details: taskDetails,
        metadata: {
          priority: options.priority || 0,
        },
      };

      const response = await sendMessage<{ added: boolean }>({
        type: MessageType.TASK_ADD,
        task,
      });

      // Update state after adding
      await updateState();

      return response.data?.added || false;
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to add Bing task:', error);
      return false;
    }
  };

  // Add DeepSeek task
  const addDeepSeekTask = async (
    prompt: string,
    options: {
      conversationId?: string;
      model?: string;
      attachments?: Array<{ name: string; url: string; type: string }>;
      temperature?: number;
      maxTokens?: number;
      priority?: number;
    } = {},
  ): Promise<boolean> => {
    try {
      const taskDetails: DeepSeekTaskDetails = {
        prompt,
        conversationId: options.conversationId,
        model: options.model,
        attachments: options.attachments,
        options: {
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        },
      };

      const task: Task<DeepSeekTaskDetails> = {
        id: `deepseek-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        type: TaskType.DEEPSEEK_CHAT,
        status: TaskStatus.PENDING,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        details: taskDetails,
        metadata: {
          priority: options.priority || 0,
        },
      };

      const response = await sendMessage<{ added: boolean }>({
        type: MessageType.TASK_ADD,
        task,
      });

      // Update state after adding
      await updateState();

      return response.data?.added || false;
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to add DeepSeek task:', error);
      return false;
    }
  };

  // Start queue
  const start = async () => {
    try {
      await sendMessage({
        type: MessageType.QUEUE_START,
      });

      await updateState();
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to start queue:', error);
    }
  };

  // Stop queue
  const stop = async () => {
    try {
      await sendMessage({
        type: MessageType.QUEUE_STOP,
      });

      await updateState();
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to stop queue:', error);
    }
  };

  // Cancel task
  const cancelTask = async (taskId: string) => {
    try {
      await sendMessage({
        type: MessageType.TASK_CANCEL,
        taskId,
      });

      await updateState();
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to cancel task:', error);
    }
  };

  // Clear completed tasks
  const clearCompleted = async () => {
    try {
      await sendMessage({
        type: MessageType.QUEUE_CLEAR_COMPLETED,
      });

      await updateState();
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to clear completed tasks:', error);
    }
  };

  // Get tasks by status
  const getTasksByStatus = async (status: TaskStatus): Promise<Task[]> => {
    try {
      const response = await sendMessage<{ tasks: Task[] }>({
        type: MessageType.QUEUE_GET_TASKS_BY_STATUS,
        status,
      });

      return response.data?.tasks || [];
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to get tasks by status:', error);
      return [];
    }
  };

  // Get tasks by type
  const getTasksByType = async (type: TaskType): Promise<Task[]> => {
    try {
      const response = await sendMessage<{ tasks: Task[] }>({
        type: MessageType.QUEUE_GET_TASKS_BY_TYPE,
        taskType: type,
      });

      return response.data?.tasks || [];
    } catch (error) {
      console.error('[useLocalTaskQueue] Failed to get tasks by type:', error);
      return [];
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) {
      // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) {
      // Less than 1 hour
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    } else if (diff < 86400000) {
      // Less than 1 day
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    } else {
      // Format as date
      return date.toLocaleString();
    }
  };

  // Format task type name
  const formatTaskType = (type: TaskType): string => {
    const names: Record<TaskType, string> = {
      [TaskType.BING_DICTIONARY]: 'Bing Dictionary',
      [TaskType.DEEPSEEK_CHAT]: 'DeepSeek Chat',
      [TaskType.TRANSLATION]: 'Translation',
      [TaskType.TTS]: 'Text-to-Speech',
      [TaskType.WEB_SCRAPING]: 'Web Scraping',
    };
    return names[type] || type;
  };

  // Listen for events from background
  const handleBackgroundEvent = (message: any) => {
    if (isEventMessage(message)) {
      // Queue event received, update state
      updateState();
    }
  };

  // Setup and cleanup
  onMounted(() => {
    // Listen to background events
    chrome.runtime.onMessage.addListener(handleBackgroundEvent);

    // Initial state update
    updateState();

    // Periodic state update (fallback)
    const interval = setInterval(updateState, 2000);

    onUnmounted(() => {
      clearInterval(interval);
      chrome.runtime.onMessage.removeListener(handleBackgroundEvent);
    });
  });

  return {
    // State
    stats,
    tasks,
    isRunning,
    isActive,
    hasPendingTasks,
    hasProcessingTasks,

    // Methods
    addBingDictionaryTask,
    addDeepSeekTask,
    start,
    stop,
    cancelTask,
    clearCompleted,
    getTasksByStatus,
    getTasksByType,
    formatTimestamp,
    formatTaskType,
    updateState,
  };
}
