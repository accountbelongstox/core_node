import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createBaseStore } from '@/common/stores/base-store';
import { adminTheme } from '@/app_admin/theme_app_admin/admin-theme';
import { ADMIN_PERMISSIONS, type AdminPermission } from '@/app_admin/constants_app_admin/admin-constants';
import type { BaseUser } from '@/common/stores/base-store';

export interface AdminUser extends BaseUser {
  permissions: AdminPermission[];
  isSuperAdmin: boolean;
}

export const useAdminBaseStore = createBaseStore('admin-base', adminTheme.getConfig());

export const useAdminStore = defineStore('admin', () => {
  const baseStore = useAdminBaseStore();

  const permissions = ref<AdminPermission[]>([]);
  const datasources = ref<any[]>([]);
  const selectedDatasourceId = ref<string | null>(null);
  const users = ref<any[]>([]);
  const systemSettings = ref<Record<string, any>>({});

  const adminUser = computed(() => baseStore.user as AdminUser | null);
  const isSuperAdmin = computed(() => adminUser.value?.isSuperAdmin ?? false);
  const canManageUsers = computed(() =>
    permissions.value.includes(ADMIN_PERMISSIONS.MANAGE_USERS) || isSuperAdmin.value
  );
  const canManageRoles = computed(() =>
    permissions.value.includes(ADMIN_PERMISSIONS.MANAGE_ROLES) || isSuperAdmin.value
  );
  const canManageDatasources = computed(() =>
    permissions.value.includes(ADMIN_PERMISSIONS.MANAGE_DATASOURCES) || isSuperAdmin.value
  );
  const canViewLogs = computed(() =>
    permissions.value.includes(ADMIN_PERMISSIONS.VIEW_LOGS) || isSuperAdmin.value
  );
  const selectedDatasource = computed(() =>
    datasources.value.find(d => d.id === selectedDatasourceId.value)
  );

  function setPermissions(perms: AdminPermission[]) {
    permissions.value = perms;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('admin_permissions', JSON.stringify(perms));
    }
  }

  function setDatasources(dsList: any[]) {
    datasources.value = dsList;
  }

  function selectDatasource(datasourceId: string) {
    selectedDatasourceId.value = datasourceId;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('admin_selected_datasource', datasourceId);
    }
  }

  function setUsers(userList: any[]) {
    users.value = userList;
  }

  function setSystemSettings(settings: Record<string, any>) {
    systemSettings.value = settings;
  }

  async function login(credentials: { username: string; password: string }): Promise<boolean> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/admin/auth/login', {
        method: 'POST',
        body: credentials,
      });

      if (response && response.user) {
        baseStore.setUser(response.user);
        setPermissions(response.user.permissions || []);
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

  async function fetchDatasources(): Promise<void> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/admin/datasources');
      if (response && Array.isArray(response.datasources)) {
        setDatasources(response.datasources);
      }
    } catch (err) {
      baseStore.setError(err instanceof Error ? err.message : 'Failed to fetch datasources');
    } finally {
      baseStore.setLoading(false);
    }
  }

  async function fetchUsers(): Promise<void> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/admin/users');
      if (response && Array.isArray(response.users)) {
        setUsers(response.users);
      }
    } catch (err) {
      baseStore.setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      baseStore.setLoading(false);
    }
  }

  async function fetchSystemSettings(): Promise<void> {
    baseStore.setLoading(true);
    baseStore.clearError();

    try {
      const response = await $fetch('/api/admin/settings');
      if (response && response.settings) {
        setSystemSettings(response.settings);
      }
    } catch (err) {
      baseStore.setError(err instanceof Error ? err.message : 'Failed to fetch settings');
    } finally {
      baseStore.setLoading(false);
    }
  }

  function initializeFromStorage() {
    if (typeof localStorage !== 'undefined') {
      const savedPermissions = localStorage.getItem('admin_permissions');
      if (savedPermissions) {
        try {
          permissions.value = JSON.parse(savedPermissions);
        } catch (e) {
          console.error('Failed to parse stored permissions');
        }
      }

      const savedDatasourceId = localStorage.getItem('admin_selected_datasource');
      if (savedDatasourceId) {
        selectedDatasourceId.value = savedDatasourceId;
      }
    }
  }

  function reset() {
    baseStore.reset();
    permissions.value = [];
    datasources.value = [];
    selectedDatasourceId.value = null;
    users.value = [];
    systemSettings.value = {};
  }

  return {
    ...baseStore,
    permissions,
    datasources,
    selectedDatasourceId,
    users,
    systemSettings,
    adminUser,
    isSuperAdmin,
    canManageUsers,
    canManageRoles,
    canManageDatasources,
    canViewLogs,
    selectedDatasource,
    setPermissions,
    setDatasources,
    selectDatasource,
    setUsers,
    setSystemSettings,
    login,
    fetchDatasources,
    fetchUsers,
    fetchSystemSettings,
    initializeFromStorage,
    reset,
  };
});
