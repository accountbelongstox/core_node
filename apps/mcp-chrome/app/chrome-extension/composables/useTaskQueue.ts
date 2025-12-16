/**
 * 本地任务队列管理
 * Local task queue management for API requests
 */

import { ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useAppStore } from './useAppStore';

// ============================================================
// 类型定义
// ============================================================

export interface Task {
  id: string;
  type: string;
  payload: any;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  result?: any;
  error?: string;
  retryCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface TaskStats {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  cancelled: number;
}

// ============================================================
// 全局队列状态
// ============================================================

const tasks: Ref<Task[]> = ref([]);
const runningTasks: Ref<Set<string>> = ref(new Set());

// ============================================================
// Task Queue Hook
// ============================================================

export function useTaskQueue() {
  const appStore = useAppStore();

  // ============================================================
  // 添加任务
  // ============================================================

  const addTask = (type: string, payload: any): string => {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const task: Task = {
      id: taskId,
      type,
      payload,
      status: 'pending',
      retryCount: 0,
      createdAt: Date.now(),
    };

    tasks.value.push(task);
    console.log(`[TaskQueue] Added task ${taskId} (${type})`);

    // 自动执行
    if (appStore.canExecuteTasks.value) {
      processNextTask();
    }

    return taskId;
  };

  // ============================================================
  // 处理任务
  // ============================================================

  const processNextTask = async () => {
    // 检查是否可以执行
    if (!appStore.canExecuteTasks.value) {
      console.log('[TaskQueue] Cannot execute: queue paused or server not running');
      return;
    }

    // 检查并发数
    const maxConcurrent = appStore.settings.value.taskQueue.maxConcurrent;
    if (runningTasks.value.size >= maxConcurrent) {
      console.log(`[TaskQueue] Max concurrent limit reached (${maxConcurrent})`);
      return;
    }

    // 查找下一个待执行任务
    const nextTask = tasks.value.find(t => t.status === 'pending');
    if (!nextTask) {
      return;
    }

    // 执行任务
    await executeTask(nextTask);

    // 继续处理下一个
    if (appStore.canExecuteTasks.value && runningTasks.value.size < maxConcurrent) {
      processNextTask();
    }
  };

  // ============================================================
  // 执行单个任务
  // ============================================================

  const executeTask = async (task: Task) => {
    task.status = 'running';
    task.startedAt = Date.now();
    runningTasks.value.add(task.id);

    console.log(`[TaskQueue] Executing task ${task.id} (${task.type})`);

    const taskHandler = getTaskHandler(task.type);
    if (!taskHandler) {
      task.status = 'failed';
      task.error = `Unknown task type: ${task.type}`;
      task.completedAt = Date.now();
      runningTasks.value.delete(task.id);
      return;
    }

    const maxRetries = appStore.settings.value.taskQueue.retryAttempts;

    while (task.retryCount <= maxRetries) {
      const result = await taskHandler(task.payload);

      if (result.success) {
        task.status = 'completed';
        task.result = result.data;
        task.completedAt = Date.now();
        runningTasks.value.delete(task.id);
        console.log(`[TaskQueue] Task ${task.id} completed successfully`);
        return;
      }

      task.retryCount++;

      if (task.retryCount <= maxRetries) {
        console.log(`[TaskQueue] Task ${task.id} failed, retry ${task.retryCount}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 1000 * task.retryCount));
      } else {
        task.status = 'failed';
        task.error = result.error || 'Task execution failed';
        task.completedAt = Date.now();
        runningTasks.value.delete(task.id);
        console.error(`[TaskQueue] Task ${task.id} failed after ${maxRetries} retries:`, task.error);
      }
    }
  };

  // ============================================================
  // 任务处理器注册表
  // ============================================================

  const taskHandlers = new Map<string, (payload: any) => Promise<{ success: boolean; data?: any; error?: string }>>();

  const registerTaskHandler = (type: string, handler: (payload: any) => Promise<{ success: boolean; data?: any; error?: string }>) => {
    taskHandlers.set(type, handler);
    console.log(`[TaskQueue] Registered handler for task type: ${type}`);
  };

  const getTaskHandler = (type: string) => {
    return taskHandlers.get(type);
  };

  // ============================================================
  // 任务控制
  // ============================================================

  const cancelTask = (taskId: string) => {
    const task = tasks.value.find(t => t.id === taskId);
    if (task && (task.status === 'pending' || task.status === 'running')) {
      task.status = 'cancelled';
      task.completedAt = Date.now();
      runningTasks.value.delete(taskId);
      console.log(`[TaskQueue] Task ${taskId} cancelled`);
    }
  };

  const clearCompletedTasks = () => {
    const beforeCount = tasks.value.length;
    tasks.value = tasks.value.filter(
      t => t.status === 'pending' || t.status === 'running'
    );
    const removed = beforeCount - tasks.value.length;
    console.log(`[TaskQueue] Cleared ${removed} completed tasks`);
  };

  const clearAllTasks = () => {
    tasks.value = [];
    runningTasks.value.clear();
    console.log('[TaskQueue] Cleared all tasks');
  };

  // ============================================================
  // 统计信息
  // ============================================================

  const getStats = (): TaskStats => {
    return {
      total: tasks.value.length,
      pending: tasks.value.filter(t => t.status === 'pending').length,
      running: tasks.value.filter(t => t.status === 'running').length,
      completed: tasks.value.filter(t => t.status === 'completed').length,
      failed: tasks.value.filter(t => t.status === 'failed').length,
      cancelled: tasks.value.filter(t => t.status === 'cancelled').length,
    };
  };

  // ============================================================
  // 监听设置变化
  // ============================================================

  watch(() => appStore.settings.value.taskQueue.paused, (paused) => {
    if (!paused && appStore.canExecuteTasks.value) {
      console.log('[TaskQueue] Resumed, processing pending tasks');
      processNextTask();
    } else if (paused) {
      console.log('[TaskQueue] Paused');
    }
  });

  watch(() => appStore.serverStatus.value.isRunning, (isRunning) => {
    if (isRunning && appStore.canExecuteTasks.value) {
      console.log('[TaskQueue] Server connected, processing pending tasks');
      processNextTask();
    }
  });

  // ============================================================
  // 返回
  // ============================================================

  return {
    // 状态
    tasks,
    runningTasks,

    // 任务管理
    addTask,
    cancelTask,
    clearCompletedTasks,
    clearAllTasks,

    // 任务处理器
    registerTaskHandler,

    // 统计
    getStats,

    // 手动触发
    processNextTask,
  };
}
