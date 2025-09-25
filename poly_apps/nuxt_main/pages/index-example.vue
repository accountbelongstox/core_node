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
  <div class="example-app-index">
    <div class="app-header">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-4xl font-bold text-gray-900">Core Node Examples</h1>
          <p class="text-xl text-gray-600 mt-2">Welcome to the Example Application</p>
          <div class="flex items-center mt-4 space-x-4">
            <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
              App Entry: Example
            </span>
            <span class="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              Namespace: {{ appConfig.namespace }}
            </span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-6xl">🎯</div>
          <p class="text-sm text-gray-500 mt-2">Example App</p>
        </div>
      </div>
    </div>

    <!-- Quick Navigation -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <NuxtLink 
        to="/mainsite-dashboard" 
        class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
      >
        <div class="flex items-center">
          <div class="p-3 bg-blue-100 rounded-lg">
            <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Main Dashboard</h3>
            <p class="text-gray-600">View main application dashboard</p>
          </div>
        </div>
      </NuxtLink>

      <NuxtLink 
        to="/datasources-admin" 
        class="block p-6 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
      >
        <div class="flex items-center">
          <div class="p-3 bg-green-100 rounded-lg">
            <svg class="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Data Sources</h3>
            <p class="text-gray-600">Manage data source connections</p>
          </div>
        </div>
      </NuxtLink>

      <div class="p-6 bg-white rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-3 bg-purple-100 rounded-lg">
            <svg class="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">Components Demo</h3>
            <p class="text-gray-600">Explore UI components</p>
          </div>
        </div>
      </div>
    </div>

    <!-- App Features -->
    <div class="bg-white rounded-lg shadow-sm border p-6 mb-8">
      <h2 class="text-2xl font-semibold text-gray-900 mb-6">Example App Features</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-4">
          <div class="flex items-start">
            <div class="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-1">
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Data Source Management</h3>
              <p class="text-gray-600">Demonstrate data source configuration and management</p>
            </div>
          </div>
          
          <div class="flex items-start">
            <div class="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-1">
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Analytics Dashboard</h3>
              <p class="text-gray-600">Show analytics and reporting capabilities</p>
            </div>
          </div>
          
          <div class="flex items-start">
            <div class="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-1">
              <svg class="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Component Library</h3>
              <p class="text-gray-600">Showcase reusable UI components</p>
            </div>
          </div>
        </div>
        
        <div class="space-y-4">
          <div class="flex items-start">
            <div class="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-1">
              <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Mock Data Support</h3>
              <p class="text-gray-600">Built-in mock data for development and testing</p>
            </div>
          </div>
          
          <div class="flex items-start">
            <div class="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-1">
              <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">Theme System</h3>
              <p class="text-gray-600">Demonstrate theme switching and customization</p>
            </div>
          </div>
          
          <div class="flex items-start">
            <div class="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-1">
              <svg class="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-lg font-medium text-gray-900">API Integration</h3>
              <p class="text-gray-600">Example API calls and data handling</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- App Switcher -->
    <div class="bg-gray-50 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-gray-900 mb-4">Switch to Other Apps</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <button 
          @click="switchApp('codemart')"
          class="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow text-center"
        >
          <div class="text-2xl mb-2">🛒</div>
          <div class="text-sm font-medium">CodeMart</div>
        </button>
        
        <button 
          @click="switchApp('dev')"
          class="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow text-center"
        >
          <div class="text-2xl mb-2">⚡</div>
          <div class="text-sm font-medium">Dev Tools</div>
        </button>
        
        <button 
          @click="switchApp('admin')"
          class="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow text-center"
        >
          <div class="text-2xl mb-2">⚙️</div>
          <div class="text-sm font-medium">Admin</div>
        </button>
        
        <button 
          @click="switchApp('dashboard')"
          class="p-4 bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow text-center"
        >
          <div class="text-2xl mb-2">📊</div>
          <div class="text-sm font-medium">Dashboard</div>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getAppEntryConfig } from '@/app-entry';

// Page metadata
definePageMeta({
  title: 'Example App Home',
  layout: 'default',
  namespace: 'example'
});

// App configuration
const appConfig = ref(getAppEntryConfig('example'));

// Methods
const switchApp = (appName: string) => {
  // This would trigger a full page reload with the new app entry
  window.location.href = `/?app=${appName}`;
};

// Lifecycle
onMounted(() => {
  console.log('Example App Index loaded', appConfig.value);
});
</script>

<style scoped>
.example-app-index {
  padding: 2rem;
  background-color: #f9fafb;
  min-height: 100vh;
}

.app-header {
  margin-bottom: 2rem;
}
</style>
