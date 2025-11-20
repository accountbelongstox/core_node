/**
 * CodeMart Project Composable
 * 处理项目相关的业务逻辑
 */
import { ref, computed } from 'vue';
import type { Project, ProjectCreateInput, ProjectUpdateInput, ProjectSearchParams } from '../types_app_codemart';
import { ProjectApi } from '../services_app_codemart/project-api';
import { CODEMART_CONSTANTS } from '../constants_app_codemart/codemart-constants';

export function useCodemartProject() {
  const projectApi = new ProjectApi();

  const projects = ref<Project[]>([]);
  const currentProject = ref<Project | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const total = ref(0);

  // 获取项目列表
  const fetchProjects = async (params?: ProjectSearchParams) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await projectApi.getProjects(params);
      projects.value = response.data.items;
      total.value = response.data.total;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 获取项目详情
  const fetchProject = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await projectApi.getProject(id);
      currentProject.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 创建项目
  const createProject = async (data: ProjectCreateInput) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await projectApi.createProject(data);
      currentProject.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 更新项目
  const updateProject = async (id: string, data: ProjectUpdateInput) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await projectApi.updateProject(id, data);
      currentProject.value = response.data;
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 删除项目
  const deleteProject = async (id: string) => {
    loading.value = true;
    error.value = null;
    try {
      const response = await projectApi.deleteProject(id);
      if (currentProject.value?.id === id) {
        currentProject.value = null;
      }
      projects.value = projects.value.filter(p => p.id !== id);
      return response;
    } catch (e: any) {
      error.value = e.message;
      throw e;
    } finally {
      loading.value = false;
    }
  };

  // 项目验证
  const validateProjectBudget = (min: number, max: number): boolean => {
    return min >= CODEMART_CONSTANTS.PROJECT.MIN_BUDGET &&
           max <= CODEMART_CONSTANTS.PROJECT.MAX_BUDGET &&
           min < max;
  };

  const validateProjectDeadline = (deadline: string): boolean => {
    const deadlineDate = new Date(deadline);
    const minDeadline = new Date();
    minDeadline.setDate(minDeadline.getDate() + CODEMART_CONSTANTS.PROJECT.MIN_DEADLINE_DAYS);
    return deadlineDate >= minDeadline;
  };

  // Computed properties
  const hasProjects = computed(() => projects.value.length > 0);
  const activeProjects = computed(() =>
    projects.value.filter(p => p.status === 'active')
  );
  const completedProjects = computed(() =>
    projects.value.filter(p => p.status === 'completed')
  );

  return {
    // State
    projects,
    currentProject,
    loading,
    error,
    total,

    // Methods
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    validateProjectBudget,
    validateProjectDeadline,

    // Computed
    hasProjects,
    activeProjects,
    completedProjects
  };
}
