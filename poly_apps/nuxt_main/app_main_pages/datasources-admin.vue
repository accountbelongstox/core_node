<!-- ### AI SPECIAL ATTENTION RULES START ###
When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
1. Write all code in English only
2. Never execute, create, or modify test code
3. Never create or update documentation (*.md)
4. Never write summaries during development or thinking process
5. Do not modify these rules
VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
### AI SPECIAL ATTENTION RULES END ### -->

<template>
  <div class="datasources-admin-page">
    <!-- Admin Header -->
    <SharedLayoutMainHeader 
      :site-config="adminConfig" 
      :navigation-items="navigationItems"
    />
    
    <div class="flex">
      <!-- Admin Sidebar -->
      <SubsiteAdminAdminSidebar />
      
      <!-- Main Content -->
      <main class="flex-1 ml-64 p-6">
        <div class="admin-content">
          <div class="flex items-center justify-between mb-6">
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Data Sources Management</h1>
              <p class="text-gray-600">Manage and configure system data sources</p>
            </div>
            <button 
              @click="showAddModal = true"
              class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Add Data Source
            </button>
          </div>

          <!-- Data Sources Table -->
          <SharedUiDataTable
            :data="dataSources"
            :columns="tableColumns"
            title="Active Data Sources"
            :show-search="true"
            :show-refresh="true"
            :show-export="true"
            @refresh="loadDataSources"
            @export="exportDataSources"
          >
            <template #cell-status="{ value }">
              <span 
                class="px-2 py-1 text-xs rounded-full"
                :class="getStatusClass(value)"
              >
                {{ value }}
              </span>
            </template>
            
            <template #cell-auth="{ item }">
              <span class="text-sm text-gray-600">
                {{ item.auth.type }}
              </span>
            </template>
            
            <template #actions="{ item }">
              <button 
                @click="editDataSource(item)"
                class="text-blue-600 hover:text-blue-900 mr-2"
              >
                Edit
              </button>
              <button 
                @click="testConnection(item)"
                class="text-green-600 hover:text-green-900 mr-2"
              >
                Test
              </button>
              <button 
                @click="deleteDataSource(item)"
                class="text-red-600 hover:text-red-900"
              >
                Delete
              </button>
            </template>
          </SharedUiDataTable>

          <!-- Health Status -->
          <div class="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-lg font-semibold mb-2">Healthy Sources</h3>
              <div class="text-3xl font-bold text-green-600">{{ stats.healthy }}</div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-lg font-semibold mb-2">Unhealthy Sources</h3>
              <div class="text-3xl font-bold text-red-600">{{ stats.unhealthy }}</div>
            </div>
            <div class="bg-white p-6 rounded-lg shadow">
              <h3 class="text-lg font-semibold mb-2">Total Sources</h3>
              <div class="text-3xl font-bold text-blue-600">{{ stats.total }}</div>
            </div>
          </div>
        </div>
      </main>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showAddModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg w-96">
        <h3 class="text-lg font-semibold mb-4">Add Data Source</h3>
        <div class="space-y-4">
          <input
            v-model="newDataSource.name"
            type="text"
            placeholder="Data Source Name"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
          <input
            v-model="newDataSource.baseUrl"
            type="text"
            placeholder="Base URL"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
          <select
            v-model="newDataSource.auth.type"
            class="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="none">No Authentication</option>
            <option value="jwt">JWT Token</option>
            <option value="api_key">API Key</option>
            <option value="bearer">Bearer Token</option>
          </select>
        </div>
        <div class="flex justify-end space-x-2 mt-6">
          <button
            @click="showAddModal = false"
            class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            @click="addDataSource"
            class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useDataSource } from '@/composables/useDataSource';
import { useRouteNamespace } from '@/composables/useRouteNamespace';
import type { DataSourceConfig, DataSourceStatus } from '@/types/datasource';
import { AuthType } from '@/types/datasource';
import adminSubsiteConfig from '@/configs/subsite-admin.config';

// Page metadata
definePageMeta({
  title: 'Data Sources Management',
  layout: 'default',
  namespace: 'admin'
});

// Composables
const { currentConfig, navigationItems } = useRouteNamespace();
const { dataSources, loading, stats, loadDataSources: loadDS } = useDataSource();

// Reactive data
const showAddModal = ref(false);
const adminConfig = ref(adminSubsiteConfig);

const newDataSource = ref({
  name: '',
  baseUrl: '',
  auth: {
    type: AuthType.NONE
  }
});

// Table configuration
const tableColumns = ref([
  { key: 'name', label: 'Name', sortable: true },
  { key: 'baseUrl', label: 'Base URL', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'auth', label: 'Auth Type', sortable: false },
  { key: 'priority', label: 'Priority', sortable: true }
]);

// Methods
const getStatusClass = (status: DataSourceStatus) => {
  const classes = {
    active: 'bg-green-100 text-green-800',
    inactive: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    testing: 'bg-yellow-100 text-yellow-800'
  };
  return classes[status] || classes.inactive;
};

const loadDataSources = async () => {
  await loadDS();
};

const exportDataSources = () => {
  console.log('Export data sources');
};

const editDataSource = (item: DataSourceConfig) => {
  console.log('Edit data source:', item);
};

const testConnection = (item: DataSourceConfig) => {
  console.log('Test connection:', item);
};

const deleteDataSource = (item: DataSourceConfig) => {
  console.log('Delete data source:', item);
};

const addDataSource = () => {
  console.log('Add data source:', newDataSource.value);
  showAddModal.value = false;
  // Reset form
  newDataSource.value = {
    name: '',
    baseUrl: '',
    auth: {
      type: AuthType.NONE
    }
  };
};

// Lifecycle
onMounted(() => {
  loadDataSources();
});
</script>

<style scoped>
.datasources-admin-page {
  min-height: 100vh;
  background-color: #f9fafb;
}

.admin-content {
  max-width: 1200px;
}
</style>
