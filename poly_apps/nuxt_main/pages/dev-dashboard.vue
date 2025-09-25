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
  <div class="dev-dashboard">
    <div class="dashboard-header">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">Development Tools Dashboard</h1>
          <p class="text-gray-600">Your development environment and tools</p>
        </div>
        <div class="flex space-x-4">
          <button class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            New Environment
          </button>
          <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Launch Editor
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">CPU Usage</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.cpuUsage.toFixed(2) }}%</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Memory Usage</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.memoryUsage.toFixed(2) }}%</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Uptime</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.uptime }}</p>
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
            <p class="text-sm font-medium text-gray-600">Active Tools</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.activeTools }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow-sm border mb-8">
      <div class="p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Quick Actions</h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button class="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-center">
            <div class="text-2xl mb-2">💻</div>
            <div class="font-medium">Code Editor</div>
            <div class="text-sm text-gray-500">Launch IDE</div>
          </button>
          <button class="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-center">
            <div class="text-2xl mb-2">🐛</div>
            <div class="font-medium">Debugger</div>
            <div class="text-sm text-gray-500">Debug code</div>
          </button>
          <button class="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-center">
            <div class="text-2xl mb-2">🧪</div>
            <div class="font-medium">Testing</div>
            <div class="text-sm text-gray-500">Run tests</div>
          </button>
          <button class="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-center">
            <div class="text-2xl mb-2">🚀</div>
            <div class="font-medium">Deploy</div>
            <div class="text-sm text-gray-500">Deploy app</div>
          </button>
        </div>
      </div>
    </div>

    <!-- Recent Tools -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div class="bg-white rounded-lg shadow-sm border">
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold text-gray-900">Recent Tools</h2>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div v-for="tool in recentTools" :key="tool.id" class="flex items-center justify-between p-3 border rounded-lg">
              <div class="flex items-center">
                <div class="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                  <span class="text-lg">{{ getToolIcon(tool.category) }}</span>
                </div>
                <div>
                  <div class="font-medium text-gray-900">{{ tool.name }}</div>
                  <div class="text-sm text-gray-500">{{ tool.category }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium text-gray-900">{{ formatTime(tool.usage.totalTime) }}</div>
                <div class="text-xs text-gray-500">{{ tool.usage.totalSessions }} sessions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-sm border">
        <div class="p-6 border-b">
          <h2 class="text-xl font-semibold text-gray-900">Development Environments</h2>
        </div>
        <div class="p-6">
          <div class="space-y-4">
            <div v-for="env in environments" :key="env.id" class="flex items-center justify-between p-3 border rounded-lg">
              <div class="flex items-center">
                <div class="w-3 h-3 rounded-full mr-3" :class="getStatusColor(env.status)"></div>
                <div>
                  <div class="font-medium text-gray-900">{{ env.name }}</div>
                  <div class="text-sm text-gray-500">{{ env.type }}</div>
                </div>
              </div>
              <div class="text-right">
                <div class="text-sm font-medium" :class="getStatusTextColor(env.status)">{{ env.status }}</div>
                <div class="text-xs text-gray-500">{{ env.resources.cpu }}% CPU</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { devOpsIntegrationAPI } from '@/services/api/dev/dev-devops-integration-api';

// Page metadata
definePageMeta({
  title: 'Development Dashboard',
  layout: 'default',
  namespace: 'dev'
});

// Reactive data
const stats = ref({
  totalTools: 0,
  activeTools: 0,
  totalEnvironments: 0,
  runningEnvironments: 0,
  totalSessions: 0,
  averageSessionTime: 0,
  cpuUsage: 0,
  memoryUsage: 0,
  uptime: '0',
});

const recentTools = ref([]);
const environments = ref([]);

// Methods
const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const getToolIcon = (category: string) => {
  const icons = {
    editor: '💻',
    debugger: '🐛',
    testing: '🧪',
    deployment: '🚀',
    monitoring: '📊',
    utility: '🔧'
  };
  return icons[category] || '🔧';
};

const getStatusColor = (status: string) => {
  const colors = {
    running: 'bg-green-500',
    stopped: 'bg-gray-400',
    error: 'bg-red-500'
  };
  return colors[status] || 'bg-gray-400';
};

const getStatusTextColor = (status: string) => {
  const colors = {
    running: 'text-green-600',
    stopped: 'text-gray-600',
    error: 'text-red-600'
  };
  return colors[status] || 'text-gray-600';
};

const loadDashboardData = async () => {
  try {
    // Load system metrics
    const metrics = await devOpsIntegrationAPI.getSystemMetrics();
    if (metrics) {
      stats.value = {
        ...stats.value,
        cpuUsage: metrics.cpu.usage,
        memoryUsage: (metrics.memory.used / metrics.memory.total) * 100,
        uptime: metrics.uptime,
      };
    }

    // Load development statistics
    const devStats = await devOpsIntegrationAPI.getDevToolStats();
    stats.value = {
      ...stats.value,
      totalTools: devStats.totalTools,
      activeTools: devStats.activeTools,
      totalSessions: devStats.totalSessions,
      averageSessionTime: devStats.averageSessionTime
    };

    // Load recent tools
    recentTools.value = await devOpsIntegrationAPI.getDevTools();

    // Load environments
    environments.value = await devOpsIntegrationAPI.getDevEnvironments();

    // Update environment stats
    stats.value.totalEnvironments = environments.value.length;
    stats.value.runningEnvironments = environments.value.filter(env => env.status === 'running').length;
  } catch (error) {
    console.error('Failed to load development dashboard data:', error);
  }
};

// Real-time data updates
let updateInterval: NodeJS.Timeout | null = null;

const startRealTimeUpdates = () => {
  updateInterval = setInterval(async () => {
    try {
      // Update system metrics and environment status
      const metrics = await devOpsIntegrationAPI.getSystemMetrics();
      if (metrics) {
        stats.value = {
          ...stats.value,
          cpuUsage: metrics.cpu.usage,
          memoryUsage: (metrics.memory.used / metrics.memory.total) * 100,
          uptime: metrics.uptime,
        };
      }

      const updatedEnvironments = await devOpsIntegrationAPI.getDevEnvironments();
      environments.value = updatedEnvironments;

      // Update running environments count
      stats.value.runningEnvironments = updatedEnvironments.filter(env => env.status === 'running').length;
    } catch (error) {
      console.error('Failed to update real-time data:', error);
    }
  }, 5000); // Update every 5 seconds
};

const stopRealTimeUpdates = () => {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
};

// Lifecycle
onMounted(() => {
  loadDashboardData();
  startRealTimeUpdates();
});

onUnmounted(() => {
  stopRealTimeUpdates();
});
</script>

<style scoped>
.dev-dashboard {
  padding: 2rem;
  background-color: #f9fafb;
  min-height: 100vh;
}

.dashboard-header {
  margin-bottom: 2rem;
}
</style>
