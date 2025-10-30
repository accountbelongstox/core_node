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
  <div class="dashboard-app-index">
    <div class="app-header">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-4xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p class="text-xl text-gray-600 mt-2">Welcome to the Data Analytics Platform</p>
          <div class="flex items-center mt-4 space-x-4">
            <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              App Entry: Dashboard
            </span>
            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              Namespace: {{ appConfig.namespace }}
            </span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-6xl">📊</div>
          <p class="text-sm text-gray-500 mt-2">Dashboard App</p>
        </div>
      </div>
    </div>

    <!-- Quick Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Analytics Overview</h3>
            <p class="text-gray-600">View key metrics and KPIs</p>
          </div>
        </div>
      </div>

      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Reports</h3>
            <p class="text-gray-600">Generate detailed reports</p>
          </div>
        </div>
      </div>

      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Real-time Data</h3>
            <p class="text-gray-600">Monitor live data streams</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Users</p>
            <p class="text-2xl font-semibold text-gray-900">24.5K</p>
            <p class="text-xs text-green-600">+12% from last month</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Revenue</p>
            <p class="text-2xl font-semibold text-gray-900">$142.8K</p>
            <p class="text-xs text-green-600">+8.2% from last month</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Conversion Rate</p>
            <p class="text-2xl font-semibold text-gray-900">3.24%</p>
            <p class="text-xs text-red-600">-0.5% from last month</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Avg. Session</p>
            <p class="text-2xl font-semibold text-gray-900">4m 32s</p>
            <p class="text-xs text-green-600">+15s from last month</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Chart Placeholder -->
    <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">Analytics Overview</h2>
      <div class="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
        <div class="text-center">
          <svg class="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
          </svg>
          <p class="text-gray-500">Interactive charts and visualizations will be displayed here</p>
        </div>
      </div>
    </div>

    <!-- Data Sources -->
    <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">Data Sources</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="border rounded-lg p-4">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-green-100 rounded-lg">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">Primary Database</h3>
              <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Connected</span>
            </div>
          </div>
          <p class="text-sm text-gray-600">Main application database with user and transaction data</p>
        </div>

        <div class="border rounded-lg p-4">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-blue-100 rounded-lg">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">Analytics API</h3>
              <span class="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Connected</span>
            </div>
          </div>
          <p class="text-sm text-gray-600">Real-time analytics data from external services</p>
        </div>

        <div class="border rounded-lg p-4">
          <div class="flex items-center mb-3">
            <div class="p-2 bg-yellow-100 rounded-lg">
              <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="font-semibold text-gray-900">Log Files</h3>
              <span class="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Processing</span>
            </div>
          </div>
          <p class="text-sm text-gray-600">System logs and application event data</p>
        </div>
      </div>
    </div>

    <!-- App Switching Info -->
    <div class="bg-indigo-50 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Application Switching</h2>
      <p class="text-gray-700 mb-4">
        To switch between applications, use the command line scripts:
      </p>
      <div class="bg-white rounded-lg p-4 font-mono text-sm">
        <div class="space-y-2">
          <div><span class="text-blue-600">yarn dev:example</span> - Switch to Example App</div>
          <div><span class="text-green-600">yarn dev:codemart</span> - Switch to CodeMart App</div>
          <div><span class="text-purple-600">yarn dev:dev</span> - Switch to Dev Tools App</div>
          <div><span class="text-red-600">yarn dev:admin</span> - Switch to Admin App</div>
          <div><span class="text-indigo-600">yarn dev:dashboard</span> - Switch to Dashboard App (current)</div>
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
  title: 'Analytics Dashboard Home',
  layout: 'dashboard',
  namespace: 'dashboard'
});

// App configuration
const appConfig = ref(getAppEntryConfig('dashboard'));



// Lifecycle
onMounted(() => {
  console.log('Dashboard App Index loaded', appConfig.value);
});
</script>

<style scoped>
.dashboard-app-index {
  padding: 2rem;
  background-color: #f9fafb;
  min-height: 100vh;
}

.app-header {
  margin-bottom: 2rem;
}
</style>
