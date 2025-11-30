<!-- IT Tools Main Application with Holographic Bento Box Layout -->
<template>
  <div class="ittools-root">
    <!-- Holographic Background -->
    <div class="holo-background">
      <div class="holo-orb holo-orb-1"></div>
      <div class="holo-orb holo-orb-2"></div>
      <div class="holo-orb holo-orb-3"></div>
    </div>

    <!-- Main Container -->
    <div class="app-container">
      <!-- Header -->
      <header class="app-header glass-strong">
        <div class="header-left">
          <div class="logo">
            <i class="fas fa-rocket"></i>
          </div>
          <div class="brand">
            <h1 class="text-gradient">{{ APP_CONFIG.name }}</h1>
            <p>{{ APP_CONFIG.tagline }}</p>
          </div>
        </div>
        <div class="header-center">
          <nav class="main-tabs">
            <button
              v-for="tab in MAIN_TABS"
              :key="tab.id"
              @click="switchTab(tab.id)"
              class="tab-btn"
              :class="{ active: activeMainTab === tab.id }"
            >
              <i :class="tab.icon"></i>
              <span>{{ tab.name }}</span>
              <span v-if="tab.badge" class="tab-badge">{{ tab.badge }}</span>
            </button>
          </nav>
        </div>
        <div class="header-right">
          <div class="connection-status" :class="{ connected: connectionStatus.connected }">
            <span class="status-dot"></span>
            <span>{{ connectionStatus.text }}</span>
          </div>
          <button class="icon-btn">
            <i class="fas fa-user-circle"></i>
          </button>
        </div>
      </header>

      <!-- Category Dropdown Menu Bar (Like Laravel) -->
      <div v-if="activeMainTab === 'ittools'" class="category-menu-bar glass">
        <div class="category-menu-row">
          <div
            v-for="cat in CATEGORY_MENU_ROW_1"
            :key="cat.id"
            class="category-menu-item"
            :class="{ active: activeDropdown === cat.id }"
            @mouseenter="openDropdown(cat.id)"
            @mouseleave="closeDropdown"
          >
            <button class="category-menu-btn">
              <i :class="cat.icon"></i>
              <span>{{ cat.name }}</span>
              <i class="fas fa-chevron-down dropdown-arrow"></i>
            </button>
            <!-- Dropdown -->
            <transition name="dropdown">
              <div v-if="activeDropdown === cat.id && getToolsForCategory(cat.id).length" class="category-dropdown glass-strong">
                <button
                  v-for="tool in getToolsForCategory(cat.id)"
                  :key="tool.id"
                  class="dropdown-tool-item"
                  @click="selectToolAndOpen(tool); closeDropdown()"
                >
                  <i :class="['fas', `fa-${tool.icon || 'wrench'}`]"></i>
                  <span>{{ tool.name }}</span>
                </button>
              </div>
            </transition>
          </div>
        </div>
        <div class="category-menu-row">
          <div
            v-for="cat in CATEGORY_MENU_ROW_2"
            :key="cat.id"
            class="category-menu-item"
            :class="{ active: activeDropdown === cat.id }"
            @mouseenter="openDropdown(cat.id)"
            @mouseleave="closeDropdown"
          >
            <button class="category-menu-btn">
              <i :class="cat.icon"></i>
              <span>{{ cat.name }}</span>
              <i class="fas fa-chevron-down dropdown-arrow"></i>
            </button>
            <!-- Dropdown -->
            <transition name="dropdown">
              <div v-if="activeDropdown === cat.id && getToolsForCategory(cat.id).length" class="category-dropdown glass-strong">
                <button
                  v-for="tool in getToolsForCategory(cat.id)"
                  :key="tool.id"
                  class="dropdown-tool-item"
                  @click="selectToolAndOpen(tool); closeDropdown()"
                >
                  <i :class="['fas', `fa-${tool.icon || 'wrench'}`]"></i>
                  <span>{{ tool.name }}</span>
                </button>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-layout">
        <!-- Left Sidebar (Collapsible) -->
        <aside v-if="activeMainTab === 'ittools'" class="sidebar-panel glass-strong glass-scroll" :class="{ collapsed: sidebarCollapsed }">
          <div class="sidebar-header">
            <span v-if="!sidebarCollapsed" class="label-glass">Categories</span>
            <button class="collapse-btn" @click="toggleSidebar" :title="sidebarCollapsed ? 'Expand' : 'Collapse'">
              <i :class="['fas', sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left']"></i>
            </button>
          </div>
          
          <div v-if="!sidebarCollapsed" class="sidebar-content">
            <!-- Quick Jump -->
            <div class="quick-jump">
              <button class="quick-jump-btn" @click="toggleQuickNav">
                <i class="fas fa-compass"></i>
                <span>Quick Jump</span>
                <i :class="['fas', quickNavOpen ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
              </button>
              <transition name="slide">
                <div v-if="quickNavOpen" class="quick-jump-panel">
                  <button
                    v-for="category in quickNavCategories"
                    :key="category.id"
                    @click="jumpToCategory(category.id)"
                    class="menu-item"
                  >
                    <i :class="getCategoryIcon(category.id)" class="menu-item-icon"></i>
                    <span>{{ category.name }}</span>
                    <span class="tag-glass">{{ category.count }}</span>
                  </button>
                </div>
              </transition>
            </div>

            <!-- Categories Tree -->
            <div class="categories-tree">
              <div class="tree-root" @click="toggleRootCategory">
                <div class="tree-root-header">
                  <i class="fas fa-layer-group"></i>
                  <span>All Tools</span>
                  <span class="count-badge">{{ itToolsStore.allTools.length }}</span>
                </div>
                <i :class="['fas', expandedRootCategories.includes('all') ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
              </div>

              <transition name="expand">
                <div v-if="expandedRootCategories.includes('all')" class="tree-children">
                  <div
                    v-for="category in categoryTree.children"
                    :key="category.id"
                    class="tree-category"
                  >
                    <button
                      class="category-btn"
                      :class="{ expanded: expandedCategories.includes(category.id) }"
                      @click="toggleCategory(category.id)"
                    >
                      <i :class="getCategoryIcon(category.id)" :style="{ color: getCategoryColor(category.id) }"></i>
                      <span>{{ category.name }}</span>
                      <span class="category-count">{{ category.count }}</span>
                      <i :class="['fas fa-chevron-right expand-icon', expandedCategories.includes(category.id) && 'rotated']"></i>
                    </button>

                    <transition name="slide">
                      <div v-if="expandedCategories.includes(category.id)" class="tools-list">
                        <button
                          v-for="tool in (toolsByCategoryMap[category.id] || [])"
                          :key="tool.id"
                          class="tool-btn"
                          :class="{ active: activeTool?.id === tool.id }"
                          @click="selectToolAndOpen(tool)"
                        >
                          <i :class="['fas', `fa-${tool.icon || 'wrench'}`]"></i>
                          <span>{{ tool.name }}</span>
                          <i v-if="favoriteIds.includes(tool.id)" class="fas fa-star star-icon"></i>
                        </button>
                      </div>
                    </transition>
                  </div>
                </div>
              </transition>
            </div>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content" :class="{ 'full-width': activeMainTab !== 'ittools' }">
          <!-- IT Tools Content -->
          <template v-if="activeMainTab === 'ittools'">
            <!-- Search Card -->
            <div class="bento-card search-card">
              <div class="search-wrapper">
                <i class="fas fa-search search-icon"></i>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="search-input"
                  placeholder="Search tools by name, category, or keyword..."
                  @focus="showSearchResults = !!searchResults.length"
                  @blur="handleSearchBlur"
                >
                <button v-if="searchQuery" class="clear-btn" @click="clearSearch">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <transition name="fade">
                <div v-if="showSearchResults && searchResults.length" class="search-results glass-strong">
                  <button
                    v-for="tool in searchResults"
                    :key="`search-${tool.id}`"
                    class="result-item"
                    @mousedown.prevent="selectSearchResult(tool)"
                  >
                    <i :class="['fas', `fa-${tool.icon || 'wrench'}`]"></i>
                    <span class="result-name">{{ tool.name }}</span>
                    <span class="result-cat">{{ tool.category }}</span>
                  </button>
                </div>
              </transition>
            </div>

            <!-- Stats Row -->
            <div class="stats-row">
              <div class="bento-card stat-card">
                <span class="stat-icon">{{ STAT_ICONS.totalTools }}</span>
                <div class="stat-info">
                  <span class="stat-value">{{ itToolsStore.allTools.length }}</span>
                  <span class="stat-label">Total Tools</span>
                </div>
              </div>
              <div class="bento-card stat-card">
                <span class="stat-icon">{{ STAT_ICONS.categories }}</span>
                <div class="stat-info">
                  <span class="stat-value">{{ categoryTree.children.length }}</span>
                  <span class="stat-label">Categories</span>
                </div>
              </div>
              <div class="bento-card stat-card">
                <span class="stat-icon">{{ STAT_ICONS.favorites }}</span>
                <div class="stat-info">
                  <span class="stat-value">{{ favoriteIds.length }}</span>
                  <span class="stat-label">Favorites</span>
                </div>
              </div>
            </div>

            <!-- Active Tool Card -->
            <div class="bento-card tool-card">
              <div v-if="activeTool" class="tool-header">
                <div class="tool-title">
                  <i :class="['fas', `fa-${activeTool.icon || 'wrench'}`]" class="tool-main-icon"></i>
                  <div>
                    <h2>{{ activeTool.name }}</h2>
                    <p>{{ activeTool.description }}</p>
                  </div>
                </div>
                <button class="btn-glass" @click="handleActiveToolClose">
                  <i class="fas fa-times"></i>
                </button>
              </div>
              <div class="tool-content">
                <ToolExecutionPanel
                  v-if="activeTool"
                  :tool="activeTool"
                  @close="handleActiveToolClose"
                  @executed="handleToolExecuted"
                />
                <div v-else class="empty-state">
                  <i class="fas fa-tools"></i>
                  <h3>Select a Tool</h3>
                  <p>Choose a utility from the left sidebar or top menu to start working</p>
                </div>
              </div>
            </div>

            <!-- Recent Tools Bar (Bottom) -->
            <div v-if="recentlyUsedTools.length" class="recent-tools-bar glass">
              <div class="recent-header">
                <i class="fas fa-clock"></i>
                <span>Recent Tools</span>
              </div>
              <div class="recent-tools-list">
                <button
                  v-for="tool in recentlyUsedTools"
                  :key="`recent-${tool.id}`"
                  class="recent-tool-chip"
                  @click="selectToolAndOpen(tool)"
                >
                  <i :class="['fas', `fa-${tool.icon || 'wrench'}`]"></i>
                  <span>{{ tool.name }}</span>
                </button>
              </div>
            </div>
          </template>

          <!-- Browser Automation Content -->
          <template v-else-if="activeMainTab === 'browser'">
            <BrowserAutomationPanel />
          </template>

          <!-- Windows Operations Content -->
          <template v-else-if="activeMainTab === 'windows'">
            <WindowsOperationsPanel />
          </template>

          <!-- Nginx Management Content -->
          <template v-else-if="activeMainTab === 'nginx'">
            <NginxManagementPanel />
          </template>
        </main>
      </div>

      <!-- Footer -->
      <footer class="app-footer glass">
        <span>&copy; {{ APP_CONFIG.copyright }}. Built with {{ APP_CONFIG.framework }}</span>
        <div class="footer-links">
          <a href="#">Documentation</a>
          <a href="#">Support</a>
          <a href="#">API</a>
        </div>
      </footer>
    </div>

    <!-- Log Panel -->
    <div class="log-panel glass-strong" :class="{ open: logPanelOpen }">
      <button class="log-toggle" @click="toggleLogPanel">
        <i class="fas fa-terminal"></i>
        <span>Activity Log</span>
      </button>
      <div v-if="logPanelOpen" class="log-content glass-scroll">
        <div v-if="!logEntries.length" class="log-empty">No log entries yet.</div>
        <div v-for="entry in logEntries" :key="entry.id" class="log-entry">
          <span :class="['log-level', entry.level]">{{ entry.level }}</span>
          <span class="log-message">{{ entry.message }}</span>
          <span class="log-time">{{ formatLogTime(entry.timestamp) }}</span>
        </div>
      </div>
    </div>
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
import NginxManagementPanel from '@/apps/app_ittools/components_app_ittools/NginxManagementPanel.vue';
import { useApiClient } from '@/apps/app_ittools/composables_app_ittools/useApiClient';
import { appLogger, type LogEntry } from '@/apps/app_ittools/services_app_ittools/logger';

// Import centralized configuration
import {
  MAIN_TABS,
  CATEGORY_MENU_ROW_1,
  CATEGORY_MENU_ROW_2,
  DEFAULT_EXPANDED_CATEGORIES,
  STAT_ICONS,
  APP_CONFIG,
  getCategoryIcon,
  getCategoryColor
} from '@/apps/app_ittools/constants_app_ittools/ui-config';

const itToolsStore = useItToolsStore();
const apiClient = useApiClient();
const route = useRoute();
const router = useRouter();

// State
const activeMainTab = ref('ittools');
const sidebarCollapsed = ref(false);
const expandedRootCategories = ref<string[]>(['all']);
const expandedCategories = ref<string[]>([...DEFAULT_EXPANDED_CATEGORIES]);
const quickNavOpen = ref(false);
const searchQuery = ref('');
const showSearchResults = ref(false);
const logPanelOpen = ref(false);
const logEntries = ref<LogEntry[]>(appLogger.getEntries());
const activeDropdown = ref<string | null>(null);
let dropdownTimeout: ReturnType<typeof setTimeout> | null = null;
let unsubscribeLogger: (() => void) | null = null;
let searchBlurTimeout: ReturnType<typeof setTimeout> | null = null;

// Computed
const favoriteIds = computed(() => itToolsStore.favorites);
const activeTool = computed(() => itToolsStore.activeTool);
const recentlyUsedTools = computed(() => itToolsStore.recentlyOpenedTools);

const connectionStatus = computed(() => ({
  text: apiClient.statusText,
  connected: Boolean(apiClient.isFullyConnected)
}));

const categoryTree = computed(() => {
  const allCategory = itToolsStore.categoriesWithCounts.find(c => c.id === 'all');
  const childCategories = itToolsStore.categoriesWithCounts.filter(c => c.id !== 'all');
  return { root: allCategory, children: childCategories };
});

const quickNavCategories = computed(() => categoryTree.value.children || []);

const toolsByCategoryMap = computed<Record<string, Tool[]>>(() => {
  const source = itToolsStore.searchQuery.trim() ? itToolsStore.filteredTools : itToolsStore.allTools;
  const map: Record<string, Tool[]> = { all: source };
  for (const tool of source) {
    if (!map[tool.category]) map[tool.category] = [];
    map[tool.category].push(tool);
  }
  return map;
});

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return [] as Tool[];
  return itToolsStore.allTools
    .filter(tool => (
      tool.name.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query) ||
      (tool.keywords || []).some(k => k.toLowerCase().includes(query))
    ))
    .slice(0, 8);
});

// Methods
const getToolsForCategory = (categoryId: string): Tool[] => {
  return toolsByCategoryMap.value[categoryId] || [];
};

const openDropdown = (categoryId: string) => {
  if (dropdownTimeout) {
    clearTimeout(dropdownTimeout);
    dropdownTimeout = null;
  }
  activeDropdown.value = categoryId;
};

const closeDropdown = () => {
  dropdownTimeout = setTimeout(() => {
    activeDropdown.value = null;
  }, 150);
};

const switchTab = (tabId: string) => { 
  activeMainTab.value = tabId; 
  appLogger.info(`Switched to ${tabId} tab`);
};

const toggleSidebar = () => { sidebarCollapsed.value = !sidebarCollapsed.value; };
const toggleQuickNav = () => { quickNavOpen.value = !quickNavOpen.value; };
const toggleRootCategory = () => {
  const idx = expandedRootCategories.value.indexOf('all');
  if (idx > -1) expandedRootCategories.value.splice(idx, 1);
  else expandedRootCategories.value.push('all');
};

const toggleCategory = (categoryId: string) => {
  const idx = expandedCategories.value.indexOf(categoryId);
  if (idx > -1) expandedCategories.value.splice(idx, 1);
  else expandedCategories.value.push(categoryId);
};

const jumpToCategory = (categoryId: string) => {
  if (!expandedCategories.value.includes(categoryId)) {
    expandedCategories.value.push(categoryId);
  }
  quickNavOpen.value = false;
};

const selectToolAndOpen = (tool: Tool) => {
  appLogger.info(`Switched to ${tool.name}`);
  itToolsStore.setActiveTool(tool.id);
  if (!expandedCategories.value.includes(tool.category)) {
    expandedCategories.value.push(tool.category);
  }
};

const clearSearch = () => { searchQuery.value = ''; showSearchResults.value = false; };

const handleSearchBlur = () => {
  if (searchBlurTimeout) clearTimeout(searchBlurTimeout);
  searchBlurTimeout = setTimeout(() => { showSearchResults.value = false; }, 120);
};

const selectSearchResult = (tool: Tool) => {
  if (searchBlurTimeout) { clearTimeout(searchBlurTimeout); searchBlurTimeout = null; }
  selectToolAndOpen(tool);
  showSearchResults.value = false;
};

const handleActiveToolClose = () => {
  if (activeTool.value) {
    appLogger.warning(`Closed ${activeTool.value.name}`);
    itToolsStore.closeTool(activeTool.value.id);
  }
};

const handleToolExecuted = (result: any) => {
  if (activeTool.value) itToolsStore.addToHistory(activeTool.value.id, {}, result);
};

const toggleLogPanel = () => { logPanelOpen.value = !logPanelOpen.value; };
const formatLogTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

// Lifecycle
onMounted(() => {
  itToolsStore.loadPreferences();
  itToolsStore.filterTools();
  searchQuery.value = itToolsStore.searchQuery;
  
  const routeToolId = route.query.tool;
  if (typeof routeToolId === 'string') {
    const target = itToolsStore.allTools.find(t => t.id === routeToolId);
    if (target) selectToolAndOpen(target);
  }

  unsubscribeLogger = appLogger.subscribe(entries => { logEntries.value = entries; });
});

onBeforeUnmount(() => { if (unsubscribeLogger) unsubscribeLogger(); });

watch(searchQuery, (value) => {
  itToolsStore.setSearchQuery(value);
  showSearchResults.value = !!value.trim() && searchResults.value.length > 0;
});

watch(searchResults, (results) => {
  if (searchQuery.value.trim()) showSearchResults.value = results.length > 0;
});

watch(activeTool, (tool) => {
  if (tool) {
    const newQuery = { ...route.query, tool: tool.id } as Record<string, any>;
    router.replace({ query: newQuery });
  } else {
    const newQuery = { ...route.query } as Record<string, any>;
    delete newQuery.tool;
    router.replace({ query: newQuery });
  }
});
</script>

<style src="@/apps/app_ittools/styles_app_ittools/holographic.css"></style>

<style scoped>
.ittools-root {
  min-height: 100vh;
  position: relative;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.app-container {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Header */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  margin: var(--space-bento);
  margin-bottom: 0;
  border-radius: var(--radius-xl);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logo {
  width: 44px;
  height: 44px;
  background: var(--gradient-primary);
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.125rem;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.35);
}

.brand h1 {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0;
}

.brand p {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin: 0;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.main-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  background: var(--gradient-hover);
  color: var(--color-primary-dark);
}

.tab-btn.active {
  background: var(--gradient-active);
  border-color: rgba(99, 102, 241, 0.25);
  color: var(--color-primary-dark);
}

.tab-badge {
  padding: 0.125rem 0.5rem;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 10px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.connection-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.875rem;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-error);
}

.connection-status.connected {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.2);
  color: var(--color-success);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: var(--color-error);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.connected .status-dot {
  background: var(--color-success);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.icon-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.icon-btn:hover {
  background: var(--gradient-hover);
  border-color: rgba(99, 102, 241, 0.2);
  color: var(--color-primary-dark);
}

/* Category Menu Bar */
.category-menu-bar {
  margin: 0 var(--space-bento);
  margin-top: var(--space-bento);
  padding: 0.5rem;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-menu-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.category-menu-item {
  position: relative;
}

.category-menu-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.category-menu-btn:hover {
  background: var(--gradient-hover);
  color: var(--color-primary-dark);
}

.category-menu-item.active .category-menu-btn {
  background: var(--gradient-active);
  color: var(--color-primary-dark);
}

.dropdown-arrow {
  font-size: 0.625rem;
  opacity: 0.6;
  transition: transform var(--transition-fast);
}

.category-menu-item.active .dropdown-arrow {
  transform: rotate(180deg);
}

.category-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  min-width: 220px;
  max-height: 320px;
  overflow-y: auto;
  padding: 0.5rem;
  border-radius: var(--radius-md);
  z-index: 100;
  margin-top: 4px;
}

.dropdown-tool-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.dropdown-tool-item:hover {
  background: var(--gradient-hover);
  color: var(--color-primary-dark);
}

.dropdown-tool-item i {
  width: 16px;
  color: var(--color-primary);
  opacity: 0.7;
}

/* Main Layout */
.main-layout {
  flex: 1;
  display: flex;
  gap: var(--space-bento);
  padding: var(--space-bento);
  overflow: hidden;
}

/* Sidebar */
.sidebar-panel {
  width: 280px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: all var(--transition-slow);
}

.sidebar-panel.collapsed {
  width: 50px;
  min-width: 50px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
}

.collapse-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-hover);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.collapse-btn:hover {
  background: var(--gradient-active);
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

/* Quick Jump */
.quick-jump {
  margin-bottom: 0.75rem;
}

.quick-jump-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background: var(--gradient-hover);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-primary-dark);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.quick-jump-btn:hover {
  background: var(--gradient-active);
}

.quick-jump-btn i:first-child {
  margin-right: 0.5rem;
}

.quick-jump-panel {
  margin-top: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

/* Categories Tree */
.categories-tree {
  flex: 1;
}

.tree-root {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  background: var(--gradient-hover);
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.tree-root-header {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.count-badge {
  padding: 0.125rem 0.5rem;
  background: var(--gradient-primary);
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: 10px;
}

.tree-children {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.tree-category {
  margin-left: 0.5rem;
}

.category-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.625rem 0.875rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.category-btn:hover {
  background: var(--gradient-hover);
}

.category-btn.expanded {
  background: var(--gradient-hover);
  color: var(--color-primary-dark);
}

.category-btn i:first-child {
  width: 18px;
  margin-right: 0.625rem;
}

.category-btn span:first-of-type {
  flex: 1;
}

.category-count {
  padding: 0.125rem 0.375rem;
  background: rgba(107, 114, 128, 0.1);
  font-size: 0.7rem;
  border-radius: 6px;
  margin-right: 0.5rem;
}

.expand-icon {
  font-size: 0.625rem;
  transition: transform var(--transition-fast);
}

.expand-icon.rotated {
  transform: rotate(90deg);
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0.375rem 0 0.375rem 1.5rem;
  padding-left: 0.75rem;
  border-left: 2px solid rgba(99, 102, 241, 0.15);
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.tool-btn:hover {
  background: var(--gradient-hover);
  color: var(--color-primary-dark);
}

.tool-btn.active {
  background: var(--gradient-active);
  color: var(--color-primary-dark);
  font-weight: 500;
}

.tool-btn i:first-child {
  width: 14px;
  opacity: 0.7;
}

.tool-btn span {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.star-icon {
  color: var(--color-warning);
  font-size: 0.625rem;
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-bento);
  overflow-y: auto;
  padding-right: 4px;
}

.main-content.full-width {
  max-width: 100%;
}

/* Search Card */
.search-card {
  padding: 1rem 1.25rem;
  position: relative;
}

.search-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-light);
}

.search-input {
  width: 100%;
  padding: 0.875rem 2.5rem;
  background: var(--glass-bg);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  transition: all var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.clear-btn {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(107, 114, 128, 0.1);
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.search-results {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin-top: 0.5rem;
  border-radius: var(--radius-md);
  overflow: hidden;
  z-index: 50;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
  cursor: pointer;
  transition: background var(--transition-fast);
  text-align: left;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: var(--gradient-hover);
}

.result-item i {
  color: var(--color-primary);
}

.result-name {
  flex: 1;
  font-weight: 500;
  color: var(--color-text);
}

.result-cat {
  font-size: 0.75rem;
  color: var(--color-text-light);
  padding: 0.125rem 0.5rem;
  background: rgba(107, 114, 128, 0.08);
  border-radius: 6px;
}

/* Stats Row */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-bento);
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}

.stat-icon {
  font-size: 2rem;
}

.stat-info {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Tool Card */
.tool-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 400px;
}

.tool-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 1.25rem;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
}

.tool-title {
  display: flex;
  gap: 1rem;
}

.tool-main-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  border-radius: var(--radius-md);
  font-size: 1.25rem;
}

.tool-title h2 {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.tool-title p {
  font-size: 0.8125rem;
  color: var(--color-text-muted);
  margin: 0.25rem 0 0;
}

.tool-content {
  flex: 1;
  padding: 1.25rem;
  overflow-y: auto;
}

/* Recent Tools Bar */
.recent-tools-bar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  border-radius: var(--radius-lg);
}

.recent-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
}

.recent-tools-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  flex: 1;
}

.recent-tool-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 16px;
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.recent-tool-chip:hover {
  background: var(--gradient-hover);
  border-color: rgba(99, 102, 241, 0.2);
  color: var(--color-primary-dark);
}

.recent-tool-chip i {
  font-size: 0.625rem;
  opacity: 0.7;
}

/* Footer */
.app-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  margin: 0 var(--space-bento) var(--space-bento);
  border-radius: var(--radius-xl);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.footer-links {
  display: flex;
  gap: 1.5rem;
}

.footer-links a {
  color: var(--color-text-muted);
  text-decoration: none;
  transition: color var(--transition-fast);
}

.footer-links a:hover {
  color: var(--color-primary-dark);
}

/* Log Panel */
.log-panel {
  position: fixed;
  bottom: var(--space-bento);
  right: var(--space-bento);
  width: 400px;
  border-radius: var(--radius-xl);
  overflow: hidden;
  z-index: 100;
}

.log-toggle {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.875rem 1.25rem;
  background: var(--gradient-primary);
  border: none;
  color: white;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

.log-content {
  max-height: 300px;
  overflow-y: auto;
}

.log-empty {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-light);
  font-size: 0.8125rem;
}

.log-entry {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid rgba(229, 231, 235, 0.3);
  font-size: 0.8125rem;
}

.log-level {
  padding: 0.125rem 0.5rem;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
}

.log-level.info { background: rgba(59, 130, 246, 0.1); color: var(--color-info); }
.log-level.success { background: rgba(34, 197, 94, 0.1); color: var(--color-success); }
.log-level.warning { background: rgba(245, 158, 11, 0.1); color: var(--color-warning); }
.log-level.error { background: rgba(239, 68, 68, 0.1); color: var(--color-error); }

.log-message {
  flex: 1;
  color: var(--color-text-secondary);
}

.log-time {
  color: var(--color-text-light);
  font-size: 0.75rem;
}

/* Transitions */
.slide-enter-active, .slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-enter-to, .slide-leave-from {
  opacity: 1;
  max-height: 1000px;
}

.expand-enter-active, .expand-leave-active {
  transition: all var(--transition-slow);
  overflow: hidden;
}
.expand-enter-from, .expand-leave-to {
  opacity: 0;
  max-height: 0;
}
.expand-enter-to, .expand-leave-from {
  opacity: 1;
  max-height: 2000px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity var(--transition-normal);
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.dropdown-enter-active, .dropdown-leave-active {
  transition: all var(--transition-normal);
  transform-origin: top;
}
.dropdown-enter-from, .dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.9) translateY(-4px);
}
</style>
