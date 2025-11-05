<template>
  <div class="h-screen relative flex flex-col bg-gray-50">
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
              @click="toggleFavoritesPanel"
              :class="[
                'p-2 rounded-lg transition',
                showFavoritesPanel
                  ? 'text-yellow-500 bg-yellow-50'
                  : 'text-gray-600 hover:text-yellow-500 hover:bg-gray-50'
              ]"
              title="Favorites"
            >
              <i class="fas fa-star"></i>
            </button>
            <button
              @click="toggleHistoryPanel"
              :class="[
                'p-2 rounded-lg transition',
                showHistoryPanel
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

    <!-- Favorites Panel -->
    <div
      v-if="showFavoritesPanel"
      class="absolute top-24 right-8 z-30 w-80 bg-white border border-gray-200 rounded-xl shadow-xl"
    >
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-800">Favorite Tools</h3>
        <button
          @click="toggleFavoritesPanel"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div v-if="favorites.length > 0" class="max-h-80 overflow-y-auto">
        <button
          v-for="tool in favorites"
          :key="tool.id"
          @click="selectToolFromMenu(tool)"
          class="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition flex items-center justify-between"
        >
          <span class="flex-1 truncate">{{ tool.name }}</span>
          <i class="fas fa-chevron-right text-xs text-gray-400"></i>
        </button>
      </div>
      <div v-else class="p-4 text-sm text-gray-500 text-center">
        No favorites yet. Star tools to pin them here.
      </div>
    </div>

    <!-- History Panel -->
    <div
      v-if="showHistoryPanel"
      class="absolute top-24 right-8 z-30 w-80 bg-white border border-gray-200 rounded-xl shadow-xl"
    >
      <div class="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 class="text-sm font-semibold text-gray-800">Recent Tools</h3>
        <button
          @click="toggleHistoryPanel"
          class="text-gray-400 hover:text-gray-600 transition"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div v-if="recentTools.length > 0" class="max-h-80 overflow-y-auto">
        <button
          v-for="tool in recentTools"
          :key="tool.id"
          @click="selectToolFromMenu(tool)"
          class="w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition flex items-center justify-between"
        >
          <div class="flex flex-col">
            <span class="truncate font-medium text-gray-800">{{ tool.name }}</span>
            <span class="text-xs text-gray-500">{{ getCategoryName(tool.category) }}</span>
          </div>
          <i class="fas fa-chevron-right text-xs text-gray-400"></i>
        </button>
      </div>
      <div v-else class="p-4 text-sm text-gray-500 text-center">
        Execute tools to build up your recent history.
      </div>
    </div>

    <!-- Main Content: Left-Right Layout -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Sidebar: Expandable Category Menu -->
      <div class="ittools-sidebar">
        <div class="ittools-sidebar__header">
          <div class="ittools-sidebar__header-inner">
            <div class="ittools-sidebar__title">
              <p class="ittools-sidebar__eyebrow">Categories</p>
              <h2 class="ittools-sidebar__heading">Browse Workspace</h2>
            </div>
            <div class="ittools-sidebar__meta">
              <p class="ittools-sidebar__meta-primary">{{ itToolsStore.allTools.length }} tools</p>
              <p class="ittools-sidebar__meta-secondary">{{ itToolsStore.categoriesWithCounts.length - 1 }} collections</p>
            </div>
          </div>
        </div>

        <div class="ittools-sidebar__body">
          <nav class="category-tree" role="tree" aria-label="Tool Categories">
            <div v-if="categoryTree.root" class="category-tree__root">
              <button
                @click="toggleRootCategory('all')"
                :class="[
                  'category-tree__root-toggle',
                  { 'is-expanded': expandedRootCategories.includes('all') }
                ]"
                role="treeitem"
                :aria-expanded="expandedRootCategories.includes('all')"
              >
                <div class="category-tree__root-main">
                  <div class="category-tree__root-icon">
                    <i :class="categoryTree.root.icon"></i>
                  </div>
                  <div class="category-tree__root-text">
                    <span class="category-tree__root-eyebrow">All Tools</span>
                    <span class="category-tree__root-title">{{ categoryTree.root.count }} utilities</span>
                  </div>
                </div>
                <div class="category-tree__root-meta">
                  <span class="category-tree__badge">{{ categoryTree.children.length }} categories</span>
                  <i
                    :class="[
                      'fas fa-chevron-right',
                      { 'is-rotated': expandedRootCategories.includes('all') }
                    ]"
                  ></i>
                </div>
              </button>

              <div
                v-if="expandedRootCategories.includes('all')"
                class="category-tree__root-panel"
                role="group"
              >
                <div class="category-tree__banner">
                  <p class="category-tree__banner-title">IT Tools Collection</p>
                  <p class="category-tree__banner-text">
                    {{ itToolsStore.allTools.length }}+ developer-first utilities curated into themed categories. Pick a collection to reveal the tools inside.
                  </p>
                </div>

                <div
                  v-for="category in categoryTree.children"
                  :key="category.id"
                  class="category-tree__category"
                >
                  <button
                    @click="toggleCategory(category.id)"
                    :class="[
                      'category-tree__category-toggle',
                      { 'is-active': selectedCategory === category.id }
                    ]"
                    role="treeitem"
                    :aria-expanded="expandedCategories.includes(category.id)"
                  >
                    <div class="category-tree__category-main">
                      <div class="category-tree__category-icon">
                        <i :class="category.icon"></i>
                      </div>
                      <div class="category-tree__category-text">
                        <span class="category-tree__category-name">{{ category.name }}</span>
                        <span class="category-tree__category-count">{{ category.count }} tools</span>
                      </div>
                    </div>
                    <div class="category-tree__category-meta">
                      <span class="category-tree__link">Explore</span>
                      <i
                        :class="[
                          'fas fa-chevron-right',
                          { 'is-rotated': expandedCategories.includes(category.id) }
                        ]"
                      ></i>
                    </div>
                  </button>

                  <div
                    v-if="expandedCategories.includes(category.id)"
                    class="category-tree__tool-list"
                    role="group"
                  >
                    <button
                      v-for="tool in getToolsByCategory(category.id)"
                      :key="tool.id"
                      @click="selectToolFromMenu(tool)"
                      :class="[
                        'category-tree__tool',
                        {
                          'is-active': activeTool?.id === tool.id,
                          'is-open': itToolsStore.openedToolIds.includes(tool.id)
                        }
                      ]"
                      role="treeitem"
                    >
                      <span
                        class="category-tree__tool-indicator"
                        :class="{
                          'is-active': activeTool?.id === tool.id,
                          'is-open': itToolsStore.openedToolIds.includes(tool.id)
                        }"
                      ></span>
                      <div class="category-tree__tool-content">
                        <div class="category-tree__tool-header">
                          <span class="category-tree__tool-name">{{ tool.name }}</span>
                          <span
                            v-if="tool.isNew"
                            class="category-tree__chip category-tree__chip--new"
                          >New</span>
                        </div>
                        <p class="category-tree__tool-description">
                          {{ tool.description }}
                        </p>
                        <div
                          v-if="tool.tags && tool.tags.length"
                          class="category-tree__tool-tags"
                        >
                          <span
                            v-for="tag in tool.tags"
                            :key="tag"
                            class="category-tree__chip"
                          >
                            #{{ tag }}
                          </span>
                        </div>
                      </div>
                      <div class="category-tree__tool-status">
                        <i
                          v-if="itToolsStore.isFavorited(tool.id)"
                          class="fas fa-star"
                        ></i>
                        <i
                          v-if="isToolCompleted(tool.id)"
                          class="fas fa-check-circle"
                        ></i>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </nav>
        </div>
      </div>
      <!-- Right Panel: Tool Workspace -->
      <div class="flex-1 overflow-hidden bg-gray-50 flex flex-col">
        <div class="bg-white border-b border-gray-200">
          <div class="flex items-center px-4 py-2 space-x-2 overflow-x-auto">
            <div
              v-if="openedTools.length === 0"
              class="flex items-center text-sm text-gray-500 py-1"
            >
              <i class="fas fa-arrow-left mr-2"></i>
              Select a tool from the left menu to get started.
            </div>
            <button
              v-for="tool in openedTools"
              :key="tool.id"
              @click="setActiveToolFromTab(tool.id)"
              :class="[
                'group inline-flex items-center space-x-2 px-3 py-1.5 rounded-lg border transition whitespace-nowrap',
                activeTool?.id === tool.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-sm'
                  : 'border-transparent text-gray-600 hover:bg-gray-100'
              ]"
            >
              <i :class="['fas', 'fa-circle', 'text-[8px]', activeTool?.id === tool.id ? 'text-blue-500' : 'text-gray-300']"></i>
              <span class="text-sm font-medium truncate max-w-[160px]">{{ tool.name }}</span>
              <i
                class="fas fa-times text-xs text-gray-400 hover:text-gray-600 transition"
                @click.stop="closeToolTab(tool.id)"
              ></i>
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-hidden">
          <ToolExecutionPanel
            v-if="activeTool"
            :key="activeTool.id"
            :tool="activeTool"
            @close="closeActiveTool"
            @executed="handleToolExecuted"
          />
          <div
            v-else
            class="h-full flex flex-col items-center justify-center text-gray-500 space-y-4"
          >
            <div class="text-4xl">
              <i class="fas fa-tools"></i>
            </div>
            <div class="text-center">
              <p class="text-lg font-semibold text-gray-700">Welcome to IT Tools</p>
              <p class="text-sm text-gray-500 mt-1">
                Choose a tool from the category menu to open it here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useItToolsStore } from '../stores_app_ittools/ittools-store';
import type { Tool } from '../types_app_ittools';
import ToolExecutionPanel from '../components_app_ittools/ToolExecutionPanel.vue';
import { isToolCompleted } from '../config_app_ittools/completed-tools';

definePageMeta({
  layout: 'default',
  middleware: []
});

const itToolsStore = useItToolsStore();
const selectedCategory = ref('all');
const expandedCategories = ref<string[]>([]);
const expandedRootCategories = ref<string[]>([]);
const showFavoritesPanel = ref(false);
const showHistoryPanel = ref(false);

const favorites = computed(() => itToolsStore.favoriteTools);
const recentTools = computed(() => itToolsStore.recentTools);
const openedTools = computed(() => itToolsStore.openedTools);
const activeTool = computed(() => itToolsStore.activeTool);

// Compute tree structure with "All Tools" as root containing child categories
const categoryTree = computed(() => {
  const allCategory = itToolsStore.categoriesWithCounts.find(c => c.id === 'all');
  const childCategories = itToolsStore.categoriesWithCounts.filter(c => c.id !== 'all');

  return {
    root: allCategory,
    children: childCategories
  };
});

onMounted(() => {
  itToolsStore.loadPreferences();
  itToolsStore.filterTools();
  expandedRootCategories.value = ['all'];
});

const toggleRootCategory = (categoryId: string) => {
  const index = expandedRootCategories.value.indexOf(categoryId);
  if (index > -1) {
    expandedRootCategories.value.splice(index, 1);
  } else {
    expandedRootCategories.value.push(categoryId);
  }
};

const toggleCategory = (categoryId: string) => {
  const index = expandedCategories.value.indexOf(categoryId);
  if (index > -1) {
    expandedCategories.value.splice(index, 1);
  } else {
    expandedCategories.value.push(categoryId);
  }

  selectedCategory.value = categoryId;
};

const getToolsByCategory = (categoryId: string) => {
  const sourceTools = itToolsStore.searchQuery.trim()
    ? itToolsStore.filteredTools
    : itToolsStore.allTools;

  if (categoryId === 'all') {
    return sourceTools;
  }
  return sourceTools.filter(tool => tool.category === categoryId);
};

const selectToolFromMenu = (tool: Tool) => {
  showFavoritesPanel.value = false;
  showHistoryPanel.value = false;
  selectedCategory.value = tool.category;

  // Ensure root "All Tools" is expanded
  if (!expandedRootCategories.value.includes('all')) {
    expandedRootCategories.value.push('all');
  }

  // Ensure the tool's category is expanded
  if (!expandedCategories.value.includes(tool.category)) {
    expandedCategories.value.push(tool.category);
  }

  itToolsStore.setActiveTool(tool.id);
};

const closeActiveTool = () => {
  if (activeTool.value) {
    itToolsStore.closeTool(activeTool.value.id);
  }
};

const handleToolExecuted = (result: any) => {
  if (activeTool.value) {
    itToolsStore.addToHistory(activeTool.value.id, {}, result);
  }
};

const getCategoryName = (categoryId: string): string => {
  const category = itToolsStore.categoriesWithCounts.find(c => c.id === categoryId);
  return category?.name || categoryId;
};

const setActiveToolFromTab = (toolId: string) => {
  itToolsStore.setActiveTool(toolId);
};

const closeToolTab = (toolId: string) => {
  itToolsStore.closeTool(toolId);
};

const toggleFavoritesPanel = () => {
  showFavoritesPanel.value = !showFavoritesPanel.value;
  if (showFavoritesPanel.value) {
    showHistoryPanel.value = false;
  }
};

const toggleHistoryPanel = () => {
  showHistoryPanel.value = !showHistoryPanel.value;
  if (showHistoryPanel.value) {
    showFavoritesPanel.value = false;
  }
};

watch(activeTool, (tool) => {
  if (tool) {
    selectedCategory.value = tool.category;

    // Ensure root "All Tools" is expanded
    if (!expandedRootCategories.value.includes('all')) {
      expandedRootCategories.value.push('all');
    }

    // Ensure the tool's category is expanded
    if (!expandedCategories.value.includes(tool.category)) {
      expandedCategories.value.push(tool.category);
    }
  } else {
    selectedCategory.value = 'all';
  }
});
</script>

<style scoped src="../styles_app_ittools/sidebar.css"></style>
