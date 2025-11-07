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
  <div class="admin-app-index">
    <div class="app-header">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-4xl font-bold text-gray-900">Admin Panel</h1>
          <p class="text-xl text-gray-600 mt-2">Welcome to the Administration Center</p>
          <div class="flex items-center mt-4 space-x-4">
            <span class="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
              App Entry: Admin
            </span>
            <span class="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
              Namespace: {{ appConfig.namespace }}
            </span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-6xl">⚙️</div>
          <p class="text-sm text-gray-500 mt-2">Admin App</p>
        </div>
      </div>
    </div>

    <!-- Quick Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <NuxtLink 
        to="/datasources-admin" 
        class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
      >
        <div class="flex items-center">
          <div class="p-3 bg-red-100 rounded-lg">
            <svg class="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Data Sources</h3>
            <p class="text-gray-600">Manage system data sources</p>
          </div>
        </div>
      </NuxtLink>

      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">User Management</h3>
            <p class="text-gray-600">Manage users and permissions</p>
          </div>
        </div>
      </div>

      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">System Settings</h3>
            <p class="text-gray-600">Configure system parameters</p>
          </div>
        </div>
      </div>
    </div>

    <!-- System Overview -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Users</p>
            <p class="text-2xl font-semibold text-gray-900">1,247</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Data Sources</p>
            <p class="text-2xl font-semibold text-gray-900">23</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active Alerts</p>
            <p class="text-2xl font-semibold text-gray-900">3</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">System Load</p>
            <p class="text-2xl font-semibold text-gray-900">67%</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Admin Functions -->
    <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">Administrative Functions</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-red-100 rounded-lg">
              <svg class="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">User Management</h3>
            </div>
          </div>
          <p class="text-sm text-gray-600">Create, edit, and manage user accounts and permissions</p>
        </div>

        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">Data Source Admin</h3>
            </div>
          </div>
          <p class="text-sm text-gray-600">Configure and monitor system data sources</p>
        </div>

        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-blue-100 rounded-lg">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">System Configuration</h3>
            </div>
          </div>
          <p class="text-sm text-gray-600">Manage system settings and configurations</p>
        </div>

        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-purple-100 rounded-lg">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">System Monitoring</h3>
            </div>
          </div>
          <p class="text-sm text-gray-600">Monitor system performance and health</p>
        </div>

        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-yellow-100 rounded-lg">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">Security & Alerts</h3>
            </div>
          </div>
          <p class="text-sm text-gray-600">Manage security settings and system alerts</p>
        </div>

        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-gray-100 rounded-lg">
              <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">Audit Logs</h3>
            </div>
          </div>
          <p class="text-sm text-gray-600">View and analyze system audit logs</p>
        </div>
      </div>
    </div>

    <!-- App Switching Info -->
    <div class="bg-red-50 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Application Switching</h2>
      <p class="text-gray-700 mb-4">
        To switch between applications, use the command line scripts:
      </p>
      <div class="bg-white rounded-lg p-4 font-mono text-sm">
        <div class="space-y-2">
          <div><span class="text-blue-600">yarn dev:example</span> - Switch to Example App</div>
          <div><span class="text-green-600">yarn dev:codemart</span> - Switch to CodeMart App</div>
          <div><span class="text-purple-600">yarn dev:dev</span> - Switch to Dev Tools App</div>
          <div><span class="text-red-600">yarn dev:admin</span> - Switch to Admin App (current)</div>
          <div><span class="text-indigo-600">yarn dev:dashboard</span> - Switch to Dashboard App</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAppEntryConfig } from '@/app-entry';

// Page metadata
definePageMeta({
  title: 'Admin Panel Home',
  layout: 'admin',
  namespace: 'admin'
});

// App configuration
const appConfig = ref(getAppEntryConfig('admin'));



// Lifecycle
onMounted(() => {
  console.log('Admin App Index loaded', appConfig.value);
});
</script>

<style scoped>
.admin-app-index {
  padding: 2rem;
  background-color: #f9fafb;
  min-height: 100vh;
}

.app-header {
  margin-bottom: 2rem;
}
</style>
