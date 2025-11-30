/**
 * CodeMart Task Composable
 * 处理任务相关的业务逻辑
 */
import { ref, computed } from 'vue';
import type { Task, TaskCreateInput, TaskUpdateInput } from '../types_app_codemart';
import { TaskApi } from '../services_app_codemart/task-api';

export function useCodemartTask() {
  const taskApi = new TaskApi();

  const tasks = ref<Task[]>([]);
  const currentTask = ref<Task | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // 获取任务列表
  const fetchTasks = async (projectId?: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.getTasks(projectId);
      tasks.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取任务详情
  const fetchTask = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.getTask(id);
      currentTask.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 创建任务
  const createTask = async (data: TaskCreateInput) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.createTask(data);
      currentTask.value = response.data;
      tasks.value.push(response.data);
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 更新任务
  const updateTask = async (id: string, data: TaskUpdateInput) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.updateTask(id, data);
      currentTask.value = response.data;
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 删除任务
  const deleteTask = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.deleteTask(id);
      if (currentTask.value?.id === id) {
        currentTask.value = null;
      }
      tasks.value = tasks.value.filter(t => t.id !== id);
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 提交任务
  const submitTask = async (id: string, deliverables: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.submitTask(id, deliverables);
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
      if (currentTask.value?.id === id) {
        currentTask.value = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 接受任务
  const acceptTask = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.acceptTask(id);
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
      if (currentTask.value?.id === id) {
        currentTask.value = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 拒绝任务
  const rejectTask = async (id: string, reason: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await taskApi.rejectTask(id, reason);
      const index = tasks.value.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks.value[index] = response.data;
      }
      if (currentTask.value?.id === id) {
        currentTask.value = response.data;
      }
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // Computed properties
  const hasTasks = computed(() => tasks.value.length > 0);
  const pendingTasks = computed(() =>
    tasks.value.filter(t => t.status === 'pending')
  );
  const inProgressTasks = computed(() =>
    tasks.value.filter(t => t.status === 'in_progress')
  );
  const completedTasks = computed(() =>
    tasks.value.filter(t => t.status === 'completed')
  );

  return {
    // State
    tasks,
    currentTask,
    loading,
    error,

    // Methods
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    submitTask,
    acceptTask,
    rejectTask,

    // Computed
    hasTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks
  };
}
