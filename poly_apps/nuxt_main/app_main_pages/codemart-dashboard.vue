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
  <div class="codemart-dashboard">
    <div class="dashboard-header">
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">CodeMart Dashboard</h1>
          <p class="text-gray-600">Welcome to the code marketplace platform</p>
        </div>
        <div class="flex space-x-4">
          <button class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
            Publish Project
          </button>
          <button class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Browse Marketplace
          </button>
        </div>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Projects</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.totalProjects }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-blue-100 rounded-lg">
            <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Active Authors</p>
            <p class="text-2xl font-semibold text-gray-900">{{ stats.totalAuthors }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-purple-100 rounded-lg">
            <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Downloads</p>
            <p class="text-2xl font-semibold text-gray-900">{{ formatNumber(stats.totalDownloads) }}</p>
          </div>
        </div>
      </div>

      <div class="bg-white p-6 rounded-lg shadow-sm border">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"/>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Revenue</p>
            <p class="text-2xl font-semibold text-gray-900">${{ formatNumber(stats.totalRevenue) }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Featured Projects -->
    <div class="bg-white rounded-lg shadow-sm border mb-8">
      <div class="p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Featured Projects</h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="project in featuredProjects" :key="project.id" class="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div class="flex items-start justify-between mb-3">
              <h3 class="font-semibold text-gray-900">{{ project.name }}</h3>
              <span class="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">${{ project.price }}</span>
            </div>
            <p class="text-sm text-gray-600 mb-3">{{ project.description }}</p>
            <div class="flex items-center justify-between text-sm text-gray-500">
              <span>{{ project.language }}</span>
              <div class="flex items-center space-x-2">
                <span>⭐ {{ project.author.rating }}</span>
                <span>📥 {{ formatNumber(project.stats.downloads) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Categories -->
    <div class="bg-white rounded-lg shadow-sm border">
      <div class="p-6 border-b">
        <h2 class="text-xl font-semibold text-gray-900">Popular Categories</h2>
      </div>
      <div class="p-6">
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div v-for="category in categories" :key="category.id" class="text-center p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
            <div class="text-2xl mb-2">📁</div>
            <h3 class="font-medium text-gray-900">{{ category.name }}</h3>
            <p class="text-sm text-gray-500">{{ category.count }} projects</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { codeMartProjectsAPI } from '@/services/api/codemart/codemart-projects-api';

// Page metadata
definePageMeta({
  title: 'CodeMart Dashboard',
  layout: 'default',
  namespace: 'codemart'
});

// Reactive data
const stats = ref({
  totalProjects: 0,
  totalAuthors: 0,
  totalDownloads: 0,
  totalRevenue: 0
});

const featuredProjects = ref([]);
const categories = ref([]);

// Methods
const formatNumber = (num: number) => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
};

const loadDashboardData = async () => {
  try {
    // Load marketplace statistics
    const marketplaceStats = await codeMartProjectsAPI.getMarketplaceStats();
    stats.value = {
      totalProjects: marketplaceStats.totalProjects,
      totalAuthors: marketplaceStats.totalAuthors,
      totalDownloads: marketplaceStats.totalDownloads,
      totalRevenue: marketplaceStats.totalRevenue
    };

    // Load featured projects
    featuredProjects.value = await codeMartProjectsAPI.getFeaturedProjects(6);

    // Load categories
    categories.value = await codeMartProjectsAPI.getCategories();
  } catch (error) {
    console.error('Failed to load CodeMart dashboard data:', error);
  }
};

// Lifecycle
onMounted(() => {
  loadDashboardData();
});
</script>

<style scoped>
.codemart-dashboard {
  padding: 2rem;
  background-color: #f9fafb;
  min-height: 100vh;
}

.dashboard-header {
  margin-bottom: 2rem;
}
</style>
