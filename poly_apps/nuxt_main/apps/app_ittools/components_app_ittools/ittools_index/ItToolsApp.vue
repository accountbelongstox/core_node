<!-- AI WARNING (NOT CODE): Edit pages/index.ittools.vue per NUXT multi-app guide -->
<template>
  <div class="flex flex-col min-h-screen bg-gray-50">
    <ItToolsTopBar
      :tabs="mainTabs"
      :active-tab="activeMainTab"
      :connection="connectionStatus"
      @toggle-sidebar="toggleSidebar"
      @switch-tab="switchTab"
    />

    <div class="flex flex-1 overflow-hidden">
      <ItToolsSidebar :sidebar-title="getCurrentSidebarTitle()">
        <template #quick-nav>
          <QuickNavDropdown
            :categories="quickNavCategories"
            :open="quickNavOpen"
            :expanded="quickNavExpanded"
            :tools-by-category="toolsByCategoryMap"
            @toggle="toggleQuickNav"
            @toggle-section="toggleQuickNavSection"
            @jump-to-tool="jumpToTool"
          />
        </template>

        <template v-if="activeMainTab === 'ittools'">
          <CategoryTreePanel
            :tree="categoryTree"
            :root-expanded="expandedRootCategories.includes('all')"
            :expanded-categories="expandedCategories"
            :selected-category="selectedCategory"
            :tools-by-category="toolsByCategoryMap"
            :open-tool-ids="itToolsStore.openedToolIds"
            :favorites="favoriteIds"
            :total-tools="itToolsStore.allTools.length"
            @toggle-root="toggleRootCategory"
            @toggle-category="toggleCategory"
            @select-tool="selectToolAndOpen"
          />
        </template>

        <template v-else-if="activeMainTab === 'browser'">
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

        <template v-else-if="activeMainTab === 'windows'">
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
      </ItToolsSidebar>

      <main class="flex-1 overflow-y-auto bg-gray-50">
        <div class="p-6">
          <div v-if="activeMainTab === 'ittools'" class="space-y-6">
            <ItToolsQuickStats :stats="quickStats" />
            <ItToolsSearchPanel
              v-model="searchQuery"
              :search-results="searchResults"
              :show-results="showSearchResults"
              :recent-tools="recentlyUsedTools"
              :last-used-tool="lastUsedTool"
              :active-tool="activeTool"
              @focus="showSearchResults = !!searchResults.length"
              @blur="handleSearchBlur"
              @clear="clearSearch"
              @select-result="selectSearchResult"
              @select-recent="selectToolAndOpen"
              @open-last="openLastUsedTool"
            />

            <ItToolsActiveCard
              v-if="activeTool"
              :tool="activeTool"
              :category-label="getCategoryLabel(activeTool.category)"
            />

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

          <div v-else-if="activeMainTab === 'browser'" class="space-y-6">
            <BrowserAutomationPanel />
          </div>

          <div v-else-if="activeMainTab === 'windows'" class="space-y-6">
            <WindowsOperationsPanel />
          </div>
        </div>
      </main>
    </div>

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

    <ItToolsLogPanel :open="logPanelOpen" @toggle="toggleLogPanel">
      <div v-if="!logEntries.length" class="px-4 py-3 text-xs text-gray-400">
        No log entries yet.
      </div>
      <div
        v-for="entry in logEntries"
        :key="entry.id"
        class="px-4 py-3 text-sm flex space-x-3"
      >
        <div class="w-12 text-xs font-semibold uppercase" :class="logLevelClasses[entry.level]">
          {{ entry.level }}
        </div>
        <div class="flex-1">
          <p class="text-gray-800">{{ entry.message }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ formatLogTime(entry.timestamp) }}</p>
        </div>
      </div>
    </ItToolsLogPanel>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useItToolsStore } from '@/apps/app_ittools/stores_app_ittools/ittools-store';
import type { Tool } from '@/apps/app_ittools/types_app_ittools';
import ToolExecutionPanel from '@/apps/app_ittools/components_app_ittools/ToolExecutionPanel.vue';
import BrowserAutomationPanel from '@/apps/app_ittools/components_app_ittools/BrowserAutomationPanel.vue';
import WindowsOperationsPanel from '@/apps/app_ittools/components_app_ittools/WindowsOperationsPanel.vue';
import { useApiClient } from '@/apps/app_ittools/composables_app_ittools/useApiClient';
import { appLogger, type LogEntry, type LogLevel } from '@/apps/app_ittools/services_app_ittools/logger';
import ItToolsTopBar from '@/apps/app_ittools/components_app_ittools/ittools_index_components/ItToolsTopBar.vue';
import ItToolsSidebar from '@/apps/app_ittools/components_app_ittools/ittools_index_components/ItToolsSidebar.vue';
import QuickNavDropdown from '@/apps/app_ittools/components_app_ittools/ittools_index_components/QuickNavDropdown.vue';
import CategoryTreePanel from '@/apps/app_ittools/components_app_ittools/ittools_index_components/CategoryTreePanel.vue';
import ItToolsSearchPanel from '@/apps/app_ittools/components_app_ittools/ittools_index_components/ItToolsSearchPanel.vue';
import ItToolsActiveCard from '@/apps/app_ittools/components_app_ittools/ittools_index_components/ItToolsActiveCard.vue';
import ItToolsLogPanel from '@/apps/app_ittools/components_app_ittools/ittools_index_components/LogPanel.vue';
import ItToolsQuickStats from '@/apps/app_ittools/components_app_ittools/ittools_index_components/ItToolsQuickStats.vue';

const mainTabs = [
  { id: 'ittools', name: 'IT Tools', icon: 'fas fa-tools', badge: '88+' },
  { id: 'browser', name: 'Browser Automation', icon: 'fas fa-globe' },
  { id: 'windows', name: 'Windows Operations', icon: 'fas fa-windows' }
];

const browserSidebarItems = [
  { id: 'quick-actions', name: 'Quick Actions', icon: 'fas fa-bolt' },
  { id: 'page-operations', name: 'Page Operations', icon: 'fas fa-file' },
  { id: 'element-interaction', name: 'Element Interaction', icon: 'fas fa-mouse-pointer' },
  { id: 'javascript', name: 'JavaScript', icon: 'fas fa-code' },
  { id: 'browser-status', name: 'Browser Status', icon: 'fas fa-info-circle' }
];

const windowsSidebarItems = [
  { id: 'system-info', name: 'System Information', icon: 'fas fa-desktop' },
  { id: 'installed-apps', name: 'Installed Apps', icon: 'fas fa-apps' },
  { id: 'admin-tools', name: 'Admin Tools', icon: 'fas fa-user-shield' },
  { id: 'process-management', name: 'Process Management', icon: 'fas fa-tasks' },
  { id: 'network', name: 'Network Tools', icon: 'fas fa-network-wired' },
  { id: 'shortcuts', name: 'Shortcuts', icon: 'fas fa-link' }
];

const pythonSidebarItems = [
  { id: 'installation', name: 'Installation Check', icon: 'fas fa-check-circle' },
  { id: 'environments', name: 'Virtual Environments', icon: 'fas fa-cube' },
  { id: 'package-manager', name: 'Package Manager', icon: 'fas fa-box' },
  { id: 'script-runner', name: 'Script Runner', icon: 'fas fa-play' },
  { id: 'environment-manager', name: 'Environment Manager', icon: 'fas fa-cogs' }
];

const itToolsStore = useItToolsStore();
const apiClient = useApiClient();
const route = useRoute();
const router = useRouter();

const activeMainTab = ref('ittools');
const activeBrowserSection = ref('quick-actions');
const activeWindowsSection = ref('system-info');
const activePythonSection = ref('installation');

const expandedRootCategories = ref<string[]>(['all']);
const expandedCategories = ref<string[]>(['all']);
const selectedCategory = ref('all');
const quickNavOpen = ref(false);
const quickNavExpanded = ref<string[]>([]);
const searchQuery = ref('');
const showSearchResults = ref(false);
const logPanelOpen = ref(false);
const logEntries = ref<LogEntry[]>(appLogger.getEntries());
let unsubscribeLogger: (() => void) | null = null;
let searchBlurTimeout: ReturnType<typeof setTimeout> | null = null;

const favoriteIds = computed(() => itToolsStore.favorites);
const quickStats = computed(() => [
  { label: 'Total tools', value: itToolsStore.allTools.length, icon: '🧰' },
  { label: 'Categories', value: categoryTree.value.children.length, icon: '🗂️' },
  { label: 'Favorites', value: favoriteIds.value.length, icon: '⭐' }
]);
const activeTool = computed(() => itToolsStore.activeTool);
const recentlyUsedTools = computed(() => itToolsStore.recentlyOpenedTools);
const lastUsedTool = computed(() => itToolsStore.lastUsedTool);

const connectionStatus = computed(() => ({
  text: apiClient.statusText,
  connected: Boolean(apiClient.isFullyConnected)
}));

const categoryTree = computed(() => {
  const allCategory = itToolsStore.categoriesWithCounts.find(c => c.id === 'all');
  const childCategories = itToolsStore.categoriesWithCounts.filter(c => c.id !== 'all');
  return {
    root: allCategory,
    children: childCategories
  };
});

const quickNavCategories = computed(() => categoryTree.value.children || []);

const toolsByCategoryMap = computed<Record<string, Tool[]>>(() => {
  const source = itToolsStore.searchQuery.trim()
    ? itToolsStore.filteredTools
    : itToolsStore.allTools;
  const map: Record<string, Tool[]> = { all: source };
  for (const tool of source) {
    if (!map[tool.category]) {
      map[tool.category] = [];
    }
    map[tool.category].push(tool);
  }
  return map;
});

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) {
    return [] as Tool[];
  }
  return itToolsStore.allTools
    .filter(tool => (
      tool.name.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query) ||
      (tool.keywords || []).some(keyword => keyword.toLowerCase().includes(query))
    ))
    .slice(0, 8);
});

onMounted(() => {
  itToolsStore.loadPreferences();
  itToolsStore.filterTools();
  searchQuery.value = itToolsStore.searchQuery;
  initializeToolFromRoute();
  loadToolsFromBackend();

  unsubscribeLogger = appLogger.subscribe(entries => {
    logEntries.value = entries;
  });
});

onBeforeUnmount(() => {
  if (unsubscribeLogger) {
    unsubscribeLogger();
  }
});

watch(searchQuery, (value) => {
  itToolsStore.setSearchQuery(value);
  showSearchResults.value = !!value.trim() && searchResults.value.length > 0;
});

watch(searchResults, (results) => {
  if (searchQuery.value.trim()) {
    showSearchResults.value = results.length > 0;
  }
});

watch(activeTool, (tool) => {
  if (tool) {
    ensureCategoryVisibility(tool);
    syncRouteWithActiveTool(tool.id);
  } else {
    syncRouteWithActiveTool(null);
  }
});

watch(() => route.query.tool, (toolParam) => {
  if (typeof toolParam !== 'string') {
    return;
  }
  if (activeTool.value && activeTool.value.id === toolParam) {
    return;
  }
  const target = itToolsStore.allTools.find(tool => tool.id === toolParam);
  if (target) {
    selectToolAndOpen(target);
  }
});

const loadToolsFromBackend = async () => {
  if (!apiClient.isFullyConnected) {
    return;
  }
  try {
    const response = await apiClient.apiClient.getAllTools();
    if (response.success && response.data) {
      itToolsStore.allTools = response.data;
      itToolsStore.filterTools();
    }
  } catch (error) {
    console.error('Failed to load tools from backend:', error);
  }
};

const selectToolAndOpen = (tool: Tool) => {
  appLogger.info(`Switched to ${tool.name}`);
  itToolsStore.setActiveTool(tool.id);
  ensureCategoryVisibility(tool);
};

const jumpToTool = (tool: Tool) => {
  selectToolAndOpen(tool);
  quickNavOpen.value = false;
  showSearchResults.value = false;
};

const toggleSidebar = () => {
  const sidebar = document.querySelector('aside');
  if (sidebar) {
    sidebar.classList.toggle('hidden');
  }
};

const switchTab = (tabId: string) => {
  activeMainTab.value = tabId;
  if (tabId === 'browser') {
    activeBrowserSection.value = 'quick-actions';
  } else if (tabId === 'windows') {
    activeWindowsSection.value = 'system-info';
    activePythonSection.value = 'installation';
  }
};

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

const toggleQuickNav = () => {
  quickNavOpen.value = !quickNavOpen.value;
  if (!quickNavOpen.value) {
    quickNavExpanded.value = [];
  }
};

const toggleQuickNavSection = (categoryId: string) => {
  const index = quickNavExpanded.value.indexOf(categoryId);
  if (index > -1) {
    quickNavExpanded.value.splice(index, 1);
  } else {
    quickNavExpanded.value.push(categoryId);
  }
};

const clearSearch = () => {
  searchQuery.value = '';
  showSearchResults.value = false;
};

const handleSearchBlur = () => {
  if (searchBlurTimeout) {
    clearTimeout(searchBlurTimeout);
  }
  searchBlurTimeout = setTimeout(() => {
    showSearchResults.value = false;
  }, 120);
};

const selectSearchResult = (tool: Tool) => {
  if (searchBlurTimeout) {
    clearTimeout(searchBlurTimeout);
    searchBlurTimeout = null;
  }
  selectToolAndOpen(tool);
  showSearchResults.value = false;
};

const openLastUsedTool = () => {
  if (lastUsedTool.value) {
    selectToolAndOpen(lastUsedTool.value);
  }
};

const toggleRootCategory = () => {
  const index = expandedRootCategories.value.indexOf('all');
  if (index > -1) {
    expandedRootCategories.value.splice(index, 1);
  } else {
    expandedRootCategories.value.push('all');
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

const getToolIdFromRoute = (): string | null => {
  const queryTool = route.query.tool;
  return typeof queryTool === 'string' ? queryTool : null;
};

const initializeToolFromRoute = () => {
  const routeToolId = getToolIdFromRoute();
  if (!routeToolId) {
    return;
  }
  const target = itToolsStore.allTools.find(tool => tool.id === routeToolId);
  if (target) {
    selectToolAndOpen(target);
  }
};

const syncRouteWithActiveTool = (toolId: string | null) => {
  const currentId = getToolIdFromRoute();
  if (toolId === currentId) {
    return;
  }
  const newQuery = { ...route.query } as Record<string, any>;
  if (toolId) {
    newQuery.tool = toolId;
  } else {
    delete newQuery.tool;
  }
  router.replace({ query: newQuery });
};

const isCategoryExpanded = (categoryId: string) => expandedCategories.value.includes(categoryId);

const ensureCategoryVisibility = (tool: Tool) => {
  if (!expandedRootCategories.value.includes('all')) {
    expandedRootCategories.value.push('all');
  }
  if (!isCategoryExpanded(tool.category)) {
    expandedCategories.value.push(tool.category);
  }
  selectedCategory.value = tool.category;
};

const getCategoryLabel = (categoryId: string) => {
  const category = itToolsStore.categoriesWithCounts.find(c => c.id === categoryId);
  return category?.name || categoryId;
};

const handleActiveToolClose = () => {
  if (activeTool.value) {
    appLogger.warning(`Closed ${activeTool.value.name}`);
    itToolsStore.closeTool(activeTool.value.id);
  }
};

const handleToolExecuted = (result: any) => {
  if (activeTool.value) {
    itToolsStore.addToHistory(activeTool.value.id, {}, result);
  }
};

const logLevelClasses: Record<LogLevel, string> = {
  info: 'text-blue-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  error: 'text-red-600'
};

const toggleLogPanel = () => {
  logPanelOpen.value = !logPanelOpen.value;
};

const formatLogTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString();
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.expand-enter-active,
.expand-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 999px;
  opacity: 1;
}
</style>

<style src="@/apps/app_ittools/styles_app_ittools/sidebar.css"></style>
