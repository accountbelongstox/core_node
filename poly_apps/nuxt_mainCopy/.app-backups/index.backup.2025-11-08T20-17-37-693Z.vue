<!-- AI WARNING: Edit pages/index.ittools.vue (this file is generated) -->
<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <!-- Top Menu Bar -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <!-- Left Side - Empty or Logo -->
          <div class="flex items-center">
            <div class="text-xl font-bold text-gray-900">
              Developer Hub
            </div>
          </div>

          <!-- Right Side - Menu Items -->
          <div class="flex items-center space-x-4">
            <!-- Connection Status -->
            <div class="flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium"
                 :class="apiClient.isFullyConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'">
              <div class="w-2 h-2 rounded-full" :class="apiClient.isFullyConnected ? 'bg-green-500' : 'bg-red-500'"></div>
              <span>{{ apiClient.statusText }}</span>
            </div>

            <!-- Toggle Sidebar -->
            <button
              @click="toggleSidebar"
              class="p-2 text-gray-600 hover:text-gray-900 transition rounded-lg hover:bg-gray-100"
            >
              <i class="fas fa-bars text-xl"></i>
            </button>

            <!-- Profile -->
            <button class="p-2 text-gray-600 hover:text-gray-900 transition rounded-lg hover:bg-gray-100">
              <i class="fas fa-user-circle text-xl"></i>
            </button>
          </div>
        </div>
      </div>
    </header>

    <!-- Middle Section with Logo and Main Navigation -->
    <div class="bg-white border-b border-gray-200">
      <div class="px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex items-center justify-between">
          <!-- Logo and Title -->
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <i class="fas fa-rocket text-white text-lg"></i>
            </div>
            <div>
              <h1 class="text-2xl font-bold text-gray-900">Developer Hub</h1>
              <p class="text-sm text-gray-500">Web Automation & Developer Tools</p>
            </div>
          </div>

          <!-- Main Navigation -->
          <nav class="hidden md:flex space-x-1">
            <button
              v-for="tab in mainTabs"
              :key="tab.id"
              @click.stop="switchTab(tab.id)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer',
                activeMainTab === tab.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
              ]"
            >
              <i :class="tab.icon" class="mr-2"></i>
              {{ tab.name }}
              <span v-if="tab.badge" class="ml-2 bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">
                {{ tab.badge }}
              </span>
            </button>
          </nav>

          <!-- Mobile Menu Button -->
          <button class="md:hidden p-2 text-gray-600 hover:text-gray-900">
            <i class="fas fa-bars text-xl"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area with Sidebar -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left Sidebar -->
      <aside class="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div class="p-4">
          <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            {{ getCurrentSidebarTitle() }}
          </h3>

          <!-- Sidebar Content based on active main tab -->
          <div class="space-y-1">
            <!-- IT Tools Sidebar - Tree Structure -->
            <template v-if="activeMainTab === 'ittools'">
              <!-- Root: All Tools -->
              <div v-if="categoryTree.root">
                <!-- Root Category Button -->
                <button
                  @click="toggleCategory('all')"
                  class="w-full text-left px-3 py-2.5 rounded-lg text-sm transition flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 font-semibold text-blue-700"
                >
                  <div class="flex items-center">
                    <i :class="categoryTree.root.icon" class="mr-3"></i>
                    <span>{{ categoryTree.root.name }}</span>
                  </div>
                  <div class="flex items-center space-x-2">
                    <span class="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                      {{ categoryTree.root.count }}
                    </span>
                    <i
                      :class="[
                        'fas fa-chevron-right text-xs transition-transform',
                        isCategoryExpanded('all') ? 'rotate-90' : ''
                      ]"
                    ></i>
                  </div>
                </button>

                <!-- Child Categories under All Tools -->
                <div v-if="isCategoryExpanded('all')" class="ml-4 mt-1 space-y-1">
                  <!-- Info Banner -->
                  <div class="px-3 py-2 rounded-lg bg-blue-50 border border-blue-100 text-left">
                    <p class="text-[10px] font-semibold uppercase tracking-wide text-blue-500">IT Tools Collection</p>
                    <p class="text-xs text-blue-700 mt-0.5">
                      {{ itToolsStore.allTools.length }}+ utilities in {{ categoryTree.children.length }} categories
                    </p>
                  </div>

                  <!-- Child Categories -->
                  <div
                    v-for="category in categoryTree.children"
                    :key="category.id"
                  >
                    <!-- Child Category Button -->
                    <button
                      @click="toggleCategory(category.id)"
                      :class="[
                        'w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center justify-between',
                        itToolsStore.selectedCategory === category.id
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-50'
                      ]"
                    >
                      <div class="flex items-center">
                        <i :class="category.icon" class="mr-2 text-sm"></i>
                        <span>{{ category.name }}</span>
                      </div>
                      <div class="flex items-center space-x-2">
                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {{ category.count }}
                        </span>
                        <i
                          :class="[
                            'fas fa-chevron-right text-xs transition-transform',
                            isCategoryExpanded(category.id) ? 'rotate-90' : ''
                          ]"
                        ></i>
                      </div>
                    </button>

                    <!-- Tools under this Category -->
                    <div
                      v-if="isCategoryExpanded(category.id)"
                      class="ml-4 mt-1 space-y-0.5 max-h-64 overflow-y-auto"
                    >
                      <button
                        v-for="tool in getToolsByCategory(category.id)"
                        :key="tool.id"
                        @click="selectToolAndOpen(tool)"
                        class="w-full text-left px-3 py-1.5 rounded-lg text-xs transition text-gray-600 hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between"
                      >
                        <span class="truncate">{{ tool.name }}</span>
                        <i class="fas fa-chevron-right text-[10px]"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Browser Automation Sidebar -->
            <template v-if="activeMainTab === 'browser'">
              <button
                v-for="item in browserSidebarItems"
                :key="item.id"
                @click="activeBrowserSection = item.id"
                :class="[
                  'w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center',
                  activeBrowserSection === item.id
                    ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                ]"
              >
                <i :class="item.icon" class="mr-3"></i>
                <span>{{ item.name }}</span>
              </button>
            </template>

            <!-- Windows Operations Sidebar -->
            <template v-if="activeMainTab === 'windows'">
              <div class="space-y-3">
                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Windows Tools
                </h4>
                <button
                  v-for="item in windowsSidebarItems"
                  :key="item.id"
                  @click="activeWindowsSection = item.id"
                  :class="[
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center',
                    activeWindowsSection === item.id
                      ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  ]"
                >
                  <i :class="item.icon" class="mr-3"></i>
                  <span>{{ item.name }}</span>
                </button>

                <h4 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4">
                  Python Operations
                </h4>
                <button
                  v-for="item in pythonSidebarItems"
                  :key="item.id"
                  @click="activePythonSection = item.id"
                  :class="[
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition flex items-center',
                    activePythonSection === item.id
                      ? 'bg-green-50 text-green-700 border-l-4 border-green-500'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  ]"
                >
                  <i :class="item.icon" class="mr-3"></i>
                  <span>{{ item.name }}</span>
                </button>
              </div>
            </template>

                      </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto bg-gray-50">
        <div class="p-6">
          <!-- IT Tools Content -->
          <div v-if="activeMainTab === 'ittools'" class="space-y-6">
            <div v-if="activeTool" class="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
              <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                <div>
                  <p class="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">Active Utility</p>
                  <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
                      <i class="fas fa-hashtag"></i>
                    </div>
                    <div>
                      <h2 class="text-2xl font-bold text-gray-900">{{ activeTool.name }}</h2>
                      <p class="text-sm text-gray-600 mt-1 max-w-2xl">{{ activeTool.description }}</p>
                    </div>
                  </div>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <span class="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    {{ getCategoryLabel(activeTool.category) }}
                  </span>
                  <span class="px-3 py-1 text-xs font-semibold rounded-full bg-gray-50 text-gray-700 border border-gray-200">
                    Endpoint: {{ activeTool.endpoint }}
                  </span>
                </div>
              </div>
            </div>

            <div class="bg-white border border-gray-200 rounded-2xl shadow-sm">
              <ToolExecutionPanel
                v-if="activeTool"
                :tool="activeTool"
                @close="handleActiveToolClose"
                @executed="handleToolExecuted"
              />
              <div v-else class="p-12 flex flex-col items-center justify-center text-gray-500 space-y-3">
                <i class="fas fa-tools text-3xl"></i>
                <div class="text-center">
                  <p class="text-base font-semibold text-gray-700">Select a tool</p>
                  <p class="text-sm text-gray-500">Choose a utility from the left to start working.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Browser Automation Content -->
          <div v-if="activeMainTab === 'browser'" class="space-y-6">
            <BrowserAutomationPanel />
          </div>

          <!-- Windows Operations Content -->
          <div v-if="activeMainTab === 'windows'" class="space-y-6">
            <WindowsOperationsPanel />
          </div>

                  </div>
      </main>
    </div>

    <!-- Bottom Footer -->
    <footer class="bg-white border-t border-gray-200">
      <div class="px-4 sm:px-6 lg:px-8 py-4">
        <div class="flex justify-between items-center text-sm text-gray-500">
          <div>
            © 2025 Developer Hub. Built with Nuxt.js 3 & Vue.js 3
          </div>
          <div class="flex space-x-4">
            <a href="#" class="hover:text-gray-700">Documentation</a>
            <a href="#" class="hover:text-gray-700">Support</a>
            <a href="#" class="hover:text-gray-700">API</a>
          </div>
        </div>
      </div>
    </footer>

    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useItToolsStore } from '@/apps/app_ittools/stores_app_ittools/ittools-store';
import type { Tool } from '@/apps/app_ittools/types_app_ittools';
import ToolExecutionPanel from '@/apps/app_ittools/components_app_ittools/ToolExecutionPanel.vue';
import BrowserAutomationPanel from '@/apps/app_ittools/components_app_ittools/BrowserAutomationPanel.vue';
import WindowsOperationsPanel from '@/apps/app_ittools/components_app_ittools/WindowsOperationsPanel.vue';
import { useApiClient } from '@/apps/app_ittools/composables_app_ittools/useApiClient';

definePageMeta({
  title: 'Developer Hub - IT Tools & Automation',
  layout: 'default',
  namespace: 'ittools'
});

// Main Navigation Tabs
const mainTabs = [
  { id: 'ittools', name: 'IT Tools', icon: 'fas fa-tools', badge: '88+' },
  { id: 'browser', name: 'Browser Automation', icon: 'fas fa-globe' },
  { id: 'windows', name: 'Windows Operations', icon: 'fas fa-windows' }
];

// Browser Sidebar Items
const browserSidebarItems = [
  { id: 'quick-actions', name: 'Quick Actions', icon: 'fas fa-bolt' },
  { id: 'page-operations', name: 'Page Operations', icon: 'fas fa-file' },
  { id: 'element-interaction', name: 'Element Interaction', icon: 'fas fa-mouse-pointer' },
  { id: 'javascript', name: 'JavaScript', icon: 'fas fa-code' },
  { id: 'browser-status', name: 'Browser Status', icon: 'fas fa-info-circle' }
];

// Windows Sidebar Items
const windowsSidebarItems = [
  { id: 'system-info', name: 'System Information', icon: 'fas fa-desktop' },
  { id: 'installed-apps', name: 'Installed Apps', icon: 'fas fa-apps' },
  { id: 'admin-tools', name: 'Admin Tools', icon: 'fas fa-user-shield' },
  { id: 'process-management', name: 'Process Management', icon: 'fas fa-tasks' },
  { id: 'network', name: 'Network Tools', icon: 'fas fa-network-wired' },
  { id: 'shortcuts', name: 'Shortcuts', icon: 'fas fa-link' }
];

// Python Sidebar Items
const pythonSidebarItems = [
  { id: 'installation', name: 'Installation Check', icon: 'fas fa-check-circle' },
  { id: 'environments', name: 'Virtual Environments', icon: 'fas fa-cube' },
  { id: 'package-manager', name: 'Package Manager', icon: 'fas fa-box' },
  { id: 'script-runner', name: 'Script Runner', icon: 'fas fa-play' },
  { id: 'environment-manager', name: 'Environment Manager', icon: 'fas fa-cogs' }
];


const DEFAULT_TOOL_ID = 'hash_text';

const itToolsStore = useItToolsStore();
const apiClient = useApiClient();
const activeMainTab = ref('ittools');
const activeBrowserSection = ref('quick-actions');
const activeWindowsSection = ref('system-info');
const activePythonSection = ref('installation');

// Tree structure state
const expandedCategories = ref<string[]>(['all']);

const favorites = computed(() => itToolsStore.favoriteTools);
const activeTool = computed(() => itToolsStore.activeTool);

onMounted(() => {
  itToolsStore.loadPreferences();
  itToolsStore.filterTools();
  setDefaultActiveTool();

  // Load tools from backend if connected
  loadToolsFromBackend();
});

const loadToolsFromBackend = async () => {
  if (!apiClient.isFullyConnected.value) {
    console.log('Backend not connected, using local tools');
    return;
  }

  try {
    const response = await apiClient.apiClient.getAllTools();
    if (response.success && response.data) {
      // Update store with backend tools
      itToolsStore.allTools = response.data;
      itToolsStore.filterTools();
      setDefaultActiveTool();
      console.log('Loaded tools from backend:', response.data.length);
    }
  } catch (error) {
    console.error('Failed to load tools from backend:', error);
  }
};

const selectToolAndOpen = (tool: Tool) => {
  itToolsStore.setActiveTool(tool.id);
  ensureCategoryVisibility(tool);
};

// Toggle sidebar visibility
const toggleSidebar = () => {
  // This will toggle the sidebar - implementation depends on your design
  const sidebar = document.querySelector('aside');
  if (sidebar) {
    sidebar.classList.toggle('hidden');
  }
};

// Switch main tab with proper state management
const switchTab = (tabId: string) => {
  console.log('Switching tab to:', tabId, 'Current:', activeMainTab.value);
  activeMainTab.value = tabId;

  // Reset sub-tab states when switching main tabs
  if (tabId === 'browser') {
    activeBrowserSection.value = 'quick-actions';
  } else if (tabId === 'windows') {
    activeWindowsSection.value = 'system-info';
    activePythonSection.value = 'installation';
  }
};

// Get current sidebar title based on active main tab
const getCurrentSidebarTitle = () => {
  switch (activeMainTab.value) {
    case 'ittools':
      return 'Categories';
    case 'browser':
      return 'Browser Operations';
    case 'windows':
      return 'Windows & Python';
    default:
      return 'Navigation';
  }
};

// Toggle category expansion
const toggleCategory = (categoryId: string) => {
  const index = expandedCategories.value.indexOf(categoryId);
  if (index > -1) {
    expandedCategories.value.splice(index, 1);
  } else {
    expandedCategories.value.push(categoryId);
  }
};

// Check if category is expanded
const isCategoryExpanded = (categoryId: string) => {
  return expandedCategories.value.includes(categoryId);
};

// Get tools by category for tree display
const getToolsByCategory = (categoryId: string) => {
  if (categoryId === 'all') {
    return itToolsStore.filteredTools;
  }
  return itToolsStore.toolsByCategory(categoryId);
};

// Computed property for tree structure
const categoryTree = computed(() => {
  const allCategory = itToolsStore.categoriesWithCounts.find(c => c.id === 'all');
  const childCategories = itToolsStore.categoriesWithCounts.filter(c => c.id !== 'all');

  return {
    root: allCategory,
    children: childCategories
  };
});

const ensureCategoryVisibility = (tool: Tool) => {
  if (!isCategoryExpanded('all')) {
    expandedCategories.value.push('all');
  }

  if (!isCategoryExpanded(tool.category)) {
    expandedCategories.value.push(tool.category);
  }

  itToolsStore.setSelectedCategory(tool.category);
};

const setDefaultActiveTool = () => {
  if (itToolsStore.activeTool) {
    return;
  }

  const defaultTool = itToolsStore.allTools.find(tool => tool.id === DEFAULT_TOOL_ID);
  if (defaultTool) {
    itToolsStore.setActiveTool(defaultTool.id);
    ensureCategoryVisibility(defaultTool);
  }
};

const handleActiveToolClose = () => {
  if (activeTool.value) {
    itToolsStore.closeTool(activeTool.value.id);
  }
};

const handleToolExecuted = (result: any) => {
  if (activeTool.value) {
    itToolsStore.addToHistory(activeTool.value.id, {}, result);
  }
};

const getCategoryLabel = (categoryId: string) => {
  const category = itToolsStore.categoriesWithCounts.find(c => c.id === categoryId);
  return category?.name || categoryId;
};

watch(activeTool, (tool) => {
  if (tool) {
    ensureCategoryVisibility(tool);
  }
});
</script>

<!-- NO <style> tag - All styles defined in theme files -->
