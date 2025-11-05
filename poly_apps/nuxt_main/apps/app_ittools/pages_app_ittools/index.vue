<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <header class="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
      <div class="px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <h1 class="text-2xl font-bold text-gray-900">
              <i class="fas fa-tools text-blue-600 mr-2"></i>IT Tools
            </h1>
            <span class="text-sm text-gray-500 bg-blue-50 px-3 py-1 rounded-full">
              88+ Utilities
            </span>
          </div>

          <!-- Search Bar -->
          <div class="flex-1 max-w-xl mx-8">
            <div class="relative">
              <input
                v-model="itToolsStore.searchQuery"
                @input="itToolsStore.filterTools()"
                type="text"
                placeholder="Search tools... (e.g., hash, convert, json)"
                class="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
              <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
            </div>
          </div>

          <!-- Actions -->
          <div class="flex items-center space-x-3">
            <button
              @click="activeTab = activeTab === 'favorites' ? 'tools' : 'favorites'"
              :class="[
                'p-2 rounded-lg transition',
                activeTab === 'favorites'
                  ? 'text-yellow-500 bg-yellow-50'
                  : 'text-gray-600 hover:text-yellow-500 hover:bg-gray-50'
              ]"
              title="Favorites"
            >
              <i class="fas fa-star"></i>
            </button>
            <button
              @click="activeTab = activeTab === 'history' ? 'tools' : 'history'"
              :class="[
                'p-2 rounded-lg transition',
                activeTab === 'history'
                  ? 'text-blue-500 bg-blue-50'
                  : 'text-gray-600 hover:text-blue-500 hover:bg-gray-50'
              ]"
              title="History"
            >
              <i class="fas fa-history"></i>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content: Left-Right Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar: Expandable Category Menu -->
      <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div class="p-4 border-b border-gray-200">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Categories</h2>
        </div>

        <!-- Category Tree Menu -->
        <div class="flex-1 overflow-y-auto">
          <div class="p-2">
            <div
              v-for="category in itToolsStore.categoriesWithCounts"
              :key="category.id"
              class="mb-1"
            >
              <!-- Category Header -->
              <button
                @click="toggleCategory(category.id)"
                :class="[
                  'w-full px-3 py-2.5 rounded-lg text-left transition flex items-center justify-between',
                  selectedCategory === category.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                ]"
              >
                <div class="flex items-center space-x-2">
                  <i :class="category.icon" class="w-5 text-sm"></i>
                  <span class="text-sm font-medium">{{ category.name }}</span>
                  <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {{ category.count }}
                  </span>
                </div>
                <i
                  :class="[
                    'fas fa-chevron-right text-xs transition-transform',
                    expandedCategories.includes(category.id) ? 'rotate-90' : ''
                  ]"
                ></i>
              </button>

              <!-- Subcategory Tools List (Expandable) -->
              <div
                v-if="expandedCategories.includes(category.id)"
                class="ml-4 mt-1 space-y-0.5"
              >
                <button
                  v-for="tool in getToolsByCategory(category.id)"
                  :key="tool.id"
                  @click="selectToolFromMenu(tool)"
                  :class="[
                    'w-full px-3 py-2 rounded text-left text-sm transition flex items-center justify-between',
                    selectedTool?.id === tool.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  ]"
                >
                  <span class="truncate">{{ tool.name }}</span>
                  <i
                    v-if="isToolCompleted(tool.id)"
                    class="fas fa-check-circle text-green-500 text-xs ml-2 flex-shrink-0"
                  ></i>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Tools Table View -->
      <div class="flex-1 overflow-hidden bg-gray-50">
        <!-- Tabs Header -->
        <div class="bg-white border-b border-gray-200">
          <div class="flex items-center space-x-1 px-4 py-2">
            <button
              @click="activeTab = 'tools'"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition',
                activeTab === 'tools'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              ]"
            >
              <i class="fas fa-th-list mr-2"></i>All Tools
            </button>
            <button
              @click="activeTab = 'favorites'"
              :class="[
                'px-4 py-2 text-sm font-medium rounded-lg transition',
                activeTab === 'favorites'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'text-gray-600 hover:bg-gray-100'
              ]"
            >
              <i class="fas fa-star mr-2"></i>Favorites
            </button>
            <button
              @click="activeTab === 'execution' ? activeTab = 'tools' : null"
              v-if="selectedTool && activeTab === 'execution'"
              class="px-4 py-2 text-sm font-medium rounded-lg bg-green-100 text-green-700"
            >
              <i class="fas fa-play mr-2"></i>{{ selectedTool.name }}
            </button>
          </div>
        </div>

        <!-- Tools Table -->
        <div v-if="activeTab === 'tools'" class="h-full overflow-auto p-6">
          <div class="bg-white rounded-lg shadow overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tool Name
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="tool in displayedTools"
                  :key="tool.id"
                  :class="[
                    'hover:bg-gray-50 transition cursor-pointer',
                    selectedTool?.id === tool.id ? 'bg-blue-50' : ''
                  ]"
                  @click="selectToolFromTable(tool)"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="text-sm font-medium text-gray-900">{{ tool.name }}</div>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-600 line-clamp-2">{{ tool.description }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {{ getCategoryName(tool.category) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span
                      v-if="isToolCompleted(tool.id)"
                      class="px-2 py-1 text-xs rounded-full bg-green-100 text-green-700 flex items-center w-fit"
                    >
                      <i class="fas fa-check-circle mr-1"></i>Ready
                    </span>
                    <span v-else class="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                      Pending
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex items-center space-x-2">
                      <button
                        @click.stop="executeToolDirectly(tool)"
                        class="text-blue-600 hover:text-blue-800 transition"
                        title="Execute"
                      >
                        <i class="fas fa-play"></i>
                      </button>
                      <button
                        @click.stop="itToolsStore.toggleFavorite(tool.id)"
                        :class="[
                          'transition',
                          itToolsStore.favorites.includes(tool.id)
                            ? 'text-yellow-500 hover:text-yellow-600'
                            : 'text-gray-400 hover:text-yellow-500'
                        ]"
                        title="Toggle Favorite"
                      >
                        <i class="fas fa-star"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Favorites Table -->
        <div v-else-if="activeTab === 'favorites'" class="h-full overflow-auto p-6">
          <div v-if="favorites.length === 0" class="h-full flex items-center justify-center">
            <div class="text-center">
              <i class="fas fa-star text-6xl text-gray-300 mb-4"></i>
              <h3 class="text-xl font-semibold text-gray-700 mb-2">No Favorites Yet</h3>
              <p class="text-gray-500">Click the star icon to add tools to favorites</p>
            </div>
          </div>
          <div v-else class="bg-white rounded-lg shadow overflow-hidden">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tool Name
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="tool in favorites"
                  :key="tool.id"
                  class="hover:bg-gray-50 transition cursor-pointer"
                  @click="selectToolFromTable(tool)"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">{{ tool.name }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-gray-600">{{ tool.description }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
                      {{ getCategoryName(tool.category) }}
                    </span>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <div class="flex items-center space-x-2">
                      <button
                        @click.stop="executeToolDirectly(tool)"
                        class="text-blue-600 hover:text-blue-800 transition"
                      >
                        <i class="fas fa-play"></i>
                      </button>
                      <button
                        @click.stop="itToolsStore.toggleFavorite(tool.id)"
                        class="text-yellow-500 hover:text-yellow-600 transition"
                      >
                        <i class="fas fa-star"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tool Execution Panel -->
        <div v-else-if="activeTab === 'execution' && selectedTool" class="h-full overflow-auto">
          <ToolExecutionPanel
            :tool="selectedTool"
            @close="closeExecutionPanel"
            @executed="handleToolExecuted"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useItToolsStore } from '../stores_app_ittools/ittools-store';
import type { Tool } from '../types_app_ittools';
import ToolExecutionPanel from '../components_app_ittools/ToolExecutionPanel.vue';
import { isToolCompleted } from '../config_app_ittools/completed-tools';

definePageMeta({
  layout: 'default',
  middleware: []
});

const itToolsStore = useItToolsStore();
const activeTab = ref('tools');
const selectedTool = ref<Tool | null>(null);
const selectedCategory = ref('all');
const expandedCategories = ref<string[]>([]);

const favorites = computed(() => itToolsStore.favoriteTools);

const displayedTools = computed(() => {
  if (selectedCategory.value === 'all') {
    return itToolsStore.filteredTools;
  }
  return itToolsStore.filteredTools.filter(tool => tool.category === selectedCategory.value);
});

onMounted(() => {
  itToolsStore.loadPreferences();
  itToolsStore.filterTools();
  expandedCategories.value = ['all'];
});

const toggleCategory = (categoryId: string) => {
  selectedCategory.value = categoryId;
  itToolsStore.setSelectedCategory(categoryId);

  const index = expandedCategories.value.indexOf(categoryId);
  if (index > -1) {
    expandedCategories.value.splice(index, 1);
  } else {
    expandedCategories.value.push(categoryId);
  }
};

const getToolsByCategory = (categoryId: string) => {
  if (categoryId === 'all') {
    return itToolsStore.allTools;
  }
  return itToolsStore.allTools.filter(tool => tool.category === categoryId);
};

const selectToolFromMenu = (tool: Tool) => {
  selectedTool.value = tool;
  itToolsStore.selectTool(tool);
  activeTab.value = 'execution';
};

const selectToolFromTable = (tool: Tool) => {
  selectedTool.value = tool;
  itToolsStore.selectTool(tool);
  activeTab.value = 'execution';
};

const executeToolDirectly = (tool: Tool) => {
  selectedTool.value = tool;
  itToolsStore.selectTool(tool);
  activeTab.value = 'execution';
};

const closeExecutionPanel = () => {
  activeTab.value = 'tools';
  selectedTool.value = null;
};

const handleToolExecuted = (result: any) => {
  if (selectedTool.value) {
    itToolsStore.addToHistory(selectedTool.value.id, {}, result);
  }
};

const getCategoryName = (categoryId: string): string => {
  const category = itToolsStore.categoriesWithCounts.find(c => c.id === categoryId);
  return category?.name || categoryId;
};
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
