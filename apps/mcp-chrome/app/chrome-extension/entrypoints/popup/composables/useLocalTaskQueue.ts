/**
 * Local Task Queue Composable
 * Vue composable for managing the unified local task queue
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
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
} from '@/entrypoints/background/services/local-task-queue';

// Singleton queue instance
let queueInstance: LocalTaskQueue | null = null;

function getQueueInstance(): LocalTaskQueue {
  if (!queueInstance) {
    queueInstance = new LocalTaskQueue({
      maxConcurrent: 1, // Serial processing
      autoStart: true, // Auto-start when task added
      enableDeduplication: true, // Prevent duplicates
      taskTimeout: 300000, // 5 minutes
      maxRetries: 3,
    });

    // Register handlers
    queueInstance.registerHandler(new BingDictionaryHandler());
    queueInstance.registerHandler(new DeepSeekHandler());

    console.log('[useLocalTaskQueue] Queue initialized');
  }

  return queueInstance;
}

export function useLocalTaskQueue() {
  const queue = getQueueInstance();

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

  // Update stats and tasks
  const updateState = () => {
    stats.value = queue.getStats();
    tasks.value = queue.getAllTasks();
    isRunning.value = queue.isQueueRunning();
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

    const added = await queue.addTask(task);
    updateState();
    return added;
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

    const added = await queue.addTask(task);
    updateState();
    return added;
  };

  // Start queue
  const start = async () => {
    await queue.start();
    updateState();
  };

  // Stop queue
  const stop = () => {
    queue.stop();
    updateState();
  };

  // Cancel task
  const cancelTask = async (taskId: string) => {
    await queue.cancelTask(taskId);
    updateState();
  };

  // Clear completed tasks
  const clearCompleted = () => {
    queue.clearCompletedTasks();
    updateState();
  };

  // Get tasks by status
  const getTasksByStatus = (status: TaskStatus): Task[] => {
    return queue.getTasksByStatus(status);
  };

  // Get tasks by type
  const getTasksByType = (type: TaskType): Task[] => {
    return queue.getTasksByType(type);
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

  // Subscribe to events
  let unsubscribers: Array<() => void> = [];

  onMounted(() => {
    // Subscribe to all task events
    unsubscribers.push(
      queue.on(TaskEventType.ADDED, () => updateState()),
      queue.on(TaskEventType.STARTED, () => updateState()),
      queue.on(TaskEventType.PROGRESS, () => updateState()),
      queue.on(TaskEventType.COMPLETED, () => updateState()),
      queue.on(TaskEventType.FAILED, () => updateState()),
      queue.on(TaskEventType.CANCELLED, () => updateState()),
      queue.on(TaskEventType.QUEUE_EMPTY, () => updateState()),
    );

    // Initial state update
    updateState();

    // Periodic state update
    const interval = setInterval(updateState, 1000);

    onUnmounted(() => {
      clearInterval(interval);
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];
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
