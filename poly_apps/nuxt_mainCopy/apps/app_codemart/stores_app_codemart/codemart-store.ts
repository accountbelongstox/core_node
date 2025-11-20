import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createBaseStore } from '@/common/stores/base-store';
import { codemartTheme } from '@/app_codemart/theme_app_codemart/codemart-theme';
import { CODEMART_USER_ROLES, type CodemartUserRole } from '@/app_codemart/constants_app_codemart/codemart-constants';
import type { BaseUser } from '@/common/stores/base-store';

export interface CodemartUser extends BaseUser {
  role: CodemartUserRole;
  credits: number;
  projects: number;
}

export const useCodemartBaseStore = createBaseStore('codemart-base', codemartTheme.getConfig());

export const useCodemartStore = defineStore('codemart', () => {
  const baseStore = useCodemartBaseStore();

  const currentRole = ref<CodemartUserRole>(CODEMART_USER_ROLES.CLIENT);
  const credits = ref(0);
  const totalBalance = ref(0);
  const projects = ref<any[]>([]);
  const selectedProjectId = ref<string | null>(null);

  const codemartUser = computed(() => baseStore.user as CodemartUser | null);
  const isClient = computed(() => currentRole.value === CODEMART_USER_ROLES.CLIENT);
  const isDeveloper = computed(() => currentRole.value === CODEMART_USER_ROLES.DEVELOPER);
  const isArchitect = computed(() => currentRole.value === CODEMART_USER_ROLES.ARCHITECT);
  const isReviewer = computed(() => currentRole.value === CODEMART_USER_ROLES.REVIEWER);
  const isAdmin = computed(() => currentRole.value === CODEMART_USER_ROLES.ADMIN);
  const selectedProject = computed(() =>
    projects.value.find(p => p.id === selectedProjectId.value)
  );

  function setRole(role: CodemartUserRole) {
    currentRole.value = role;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('codemart_user_role', role);
    }
  }

  function setCredits(amount: number) {
    credits.value = amount;
  }

  function setTotalBalance(amount: number) {
    totalBalance.value = amount;
  }

  function setProjects(projectList: any[]) {
    projects.value = projectList;
  }

  function selectProject(projectId: string) {
    selectedProjectId.value = projectId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('codemart_selected_project', projectId);
    }
  }

  async function login(credentials: { username: string; password: string }): Promise<boolean> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/codemart/auth/login', {
        method: 'POST',
        body: credentials,
      });

      if (response && response.user) {
        baseStore.setUser(response.user);
        setRole(response.user.role);
        setCredits(response.user.credits);
        return true;
      }

      return false;
    } catch (err) {
      baseStore.setError(err instanceof Error ? err.message : 'Login failed');
      return false;
    } finally {
      baseStore.setLoading(false);
    }
  }

  async function fetchProjects(): Promise<void> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/codemart/projects');
      if (response && Array.isArray(response.projects)) {
        setProjects(response.projects);
      }
    } catch (err) {
      baseStore.setError(err instanceof Error ? err.message : 'Failed to fetch projects');
    } finally {
      baseStore.setLoading(false);
    }
  }

  async function purchaseCredits(amount: number): Promise<boolean> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/codemart/credits/purchase', {
        method: 'POST',
        body: { amount },
      });

      if (response && response.success) {
        setCredits(response.newBalance);
        return true;
      }

      return false;
    } catch (err) {
      baseStore.setError(err instanceof Error ? err.message : 'Purchase failed');
      return false;
    } finally {
      baseStore.setLoading(false);
    }
  }

  function initializeFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedRole = localStorage.getItem('codemart_user_role') as CodemartUserRole;
      if (savedRole && Object.values(CODEMART_USER_ROLES).includes(savedRole)) {
        currentRole.value = savedRole;
      }

      const savedProjectId = localStorage.getItem('codemart_selected_project');
      if (savedProjectId) {
        selectedProjectId.value = savedProjectId;
      }
    }
  }

  function reset() {
    baseStore.reset();
    currentRole.value = CODEMART_USER_ROLES.CLIENT;
    credits.value = 0;
    totalBalance.value = 0;
    projects.value = [];
    selectedProjectId.value = null;
  }

  return {
    ...baseStore,
    currentRole,
    credits,
    totalBalance,
    projects,
    selectedProjectId,
    codemartUser,
    isClient,
    isDeveloper,
    isArchitect,
    isReviewer,
    isAdmin,
    selectedProject,
    setRole,
    setCredits,
    setTotalBalance,
    setProjects,
    selectProject,
    login,
    fetchProjects,
    purchaseCredits,
    initializeFromStorage,
    reset,
  };
});
