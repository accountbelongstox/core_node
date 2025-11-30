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
  <div class="mainsite-dashboard">
    <div class="panel">
      <div class="flex items-center justify-between mb-5">
        <h5 class="font-semibold text-lg dark:text-white-light">Main Site Dashboard</h5>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <!-- Stats Cards -->
        <div class="panel bg-gradient-to-r from-blue-500 to-blue-600 text-white">
          <div class="flex justify-between">
            <div class="ltr:mr-1 rtl:ml-1 text-md font-semibold">Total Users</div>
            <div class="dropdown">
              <svg class="w-5 h-5 opacity-70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="5" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/>
                <circle opacity="0.5" cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="19" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/>
              </svg>
            </div>
          </div>
          <div class="flex items-center mt-5">
            <div class="text-3xl font-bold ltr:mr-3 rtl:ml-3">{{ stats.totalUsers }}</div>
          </div>
        </div>

        <div class="panel bg-gradient-to-r from-green-500 to-green-600 text-white">
          <div class="flex justify-between">
            <div class="ltr:mr-1 rtl:ml-1 text-md font-semibold">Active Sessions</div>
          </div>
          <div class="flex items-center mt-5">
            <div class="text-3xl font-bold ltr:mr-3 rtl:ml-3">{{ stats.activeSessions }}</div>
          </div>
        </div>

        <div class="panel bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <div class="flex justify-between">
            <div class="ltr:mr-1 rtl:ml-1 text-md font-semibold">System Load</div>
          </div>
          <div class="flex items-center mt-5">
            <div class="text-3xl font-bold ltr:mr-3 rtl:ml-3">{{ stats.systemLoad }}%</div>
          </div>
        </div>

        <div class="panel bg-gradient-to-r from-purple-500 to-purple-600 text-white">
          <div class="flex justify-between">
            <div class="ltr:mr-1 rtl:ml-1 text-md font-semibold">Data Sources</div>
          </div>
          <div class="flex items-center mt-5">
            <div class="text-3xl font-bold ltr:mr-3 rtl:ml-3">{{ stats.dataSources }}</div>
          </div>
        </div>
      </div>

      <!-- Recent Activity -->
      <div class="panel">
        <div class="flex items-center justify-between mb-5">
          <h5 class="font-semibold text-lg dark:text-white-light">Recent Activity</h5>
        </div>
        <div class="space-y-4">
          <div v-for="activity in recentActivities" :key="activity.id" class="flex items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div class="flex-1">
              <div class="font-medium">{{ activity.title }}</div>
              <div class="text-sm text-gray-500">{{ activity.description }}</div>
            </div>
            <div class="text-sm text-gray-400">{{ formatTime(activity.timestamp) }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import mainSiteConfig from '@/configs/mainsite.config';

// Page metadata
definePageMeta({
  title: 'Main Dashboard',
  layout: 'default',
  namespace: 'mainsite'
});

// Reactive data
const stats = ref({
  totalUsers: 0,
  activeSessions: 0,
  systemLoad: 0,
  dataSources: 0
});

const recentActivities = ref([
  {
    id: 1,
    title: 'System Update',
    description: 'Core system updated to version 2.1.0',
    timestamp: new Date()
  },
  {
    id: 2,
    title: 'New User Registration',
    description: '5 new users registered today',
    timestamp: new Date(Date.now() - 3600000)
  }
]);

// Methods
const formatTime = (timestamp: Date) => {
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.floor((timestamp.getTime() - Date.now()) / 60000),
    'minute'
  );
};

const loadStats = async () => {
  // Simulate API call
  stats.value = {
    totalUsers: 1250,
    activeSessions: 89,
    systemLoad: 45,
    dataSources: 12
  };
};

// Lifecycle
onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.mainsite-dashboard {
  padding: 1rem;
}
</style>
