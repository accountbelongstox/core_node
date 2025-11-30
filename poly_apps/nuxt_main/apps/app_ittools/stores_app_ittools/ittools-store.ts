// IT Tools Pinia Store
// Centralized state management for IT Tools application

import { defineStore } from 'pinia';
import type { Tool } from '../types_app_ittools';
import { ALL_TOOLS, getToolsByCategory, searchTools, TOOLS_BY_CATEGORY, type ToolCategory } from '../constants_app_ittools/complete-tools';

export interface ItToolsState {
  // Tools data
  allTools: Tool[];
  filteredTools: Tool[];
  selectedTool: Tool | null;
  openedToolIds: string[];
  activeToolId: string | null;

  // Search and filters
  searchQuery: string;
  selectedCategory: string;

  // User preferences
  favorites: string[];
  history: Array<{
    toolId: string;
    timestamp: number;
    input?: Record<string, any>;
    output?: any;
  }>;

  // UI state
  showSettings: boolean;
  theme: 'light' | 'dark';

  // API configuration
  apiBaseUrl: string;

  // Loading and error state
  loading: boolean;
  error: string | null;
}

export const useItToolsStore = defineStore('ittools', {
  state: (): ItToolsState => ({
    // Tools data
    allTools: ALL_TOOLS,
    filteredTools: ALL_TOOLS,
    selectedTool: null,
    openedToolIds: [],
    activeToolId: null,

    // Search and filters
    searchQuery: '',
    selectedCategory: 'all',

    // User preferences
    favorites: [],
    history: [],

    // UI state
    showSettings: false,
    theme: 'light',

    // API configuration
    apiBaseUrl: '/api/ittools',

    // Loading and error state
    loading: false,
    error: null
  }),

  getters: {
    /**
     * Get tools by category
     */
    toolsByCategory: (state) => (category: string) => {
      if (category === 'all') {
        return state.filteredTools;
      }
      return state.filteredTools.filter(tool => tool.category === category);
    },

    /**
     * Get favorite tools
     */
    favoriteTools: (state) => {
      return state.allTools.filter(tool => state.favorites.includes(tool.id));
    },

    /**
     * Get opened tools in tab order
     */
    openedTools: (state) => {
      return state.openedToolIds
        .map(id => state.allTools.find(tool => tool.id === id))
        .filter(Boolean) as Tool[];
    },

    /**
     * Currently active tool tab
     */
    activeTool: (state) => {
      if (!state.activeToolId) {
        return null;
      }
      return state.allTools.find(tool => tool.id === state.activeToolId) || null;
    },

    /**
     * Get recent tools from history
     */
    recentTools: (state) => {
      return state.history
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 10)
        .map(item => state.allTools.find(tool => tool.id === item.toolId))
        .filter(Boolean) as Tool[];
    },

    /**
     * Get categories with tool counts
     */
    categoriesWithCounts: (state) => {
      const categories = [
        { id: 'all', name: 'All Tools', icon: 'fas fa-tools' },
        { id: 'crypto', name: 'Crypto & Security', icon: 'fas fa-lock' },
        { id: 'converter', name: 'Converters', icon: 'fas fa-exchange-alt' },
        { id: 'web', name: 'Web Dev', icon: 'fas fa-globe' },
        { id: 'text', name: 'Text Processing', icon: 'fas fa-font' },
        { id: 'math', name: 'Math', icon: 'fas fa-calculator' },
        { id: 'network', name: 'Network', icon: 'fas fa-network-wired' },
        { id: 'media', name: 'Media', icon: 'fas fa-photo-video' },
        { id: 'development', name: 'Development', icon: 'fas fa-code' },
        { id: 'measurement', name: 'Measurement', icon: 'fas fa-ruler' },
        { id: 'data', name: 'Data', icon: 'fas fa-database' }
      ];

      return categories.map(cat => ({
        ...cat,
        count: cat.id === 'all'
          ? state.allTools.length
          : state.allTools.filter(t => t.category === cat.id).length
      }));
    },

    /**
     * Check if tool is favorited
     */
    isFavorited: (state) => (toolId: string) => {
      return state.favorites.includes(toolId);
    },

    /**
     * Get history entries for a specific tool
     */
    toolHistory: (state) => (toolId: string) => {
      return state.history
        .filter(entry => entry.toolId === toolId)
        .sort((a, b) => b.timestamp - a.timestamp);
    }
  },

  actions: {
    /**
     * Filter tools by search query and category
     */
    filterTools(): void {
      let filtered = this.allTools;

      // Filter by category
      if (this.selectedCategory !== 'all') {
        filtered = getToolsByCategory(this.selectedCategory as ToolCategory);
      }

      // Filter by search query
      if (this.searchQuery.trim()) {
        filtered = searchTools(this.searchQuery);
        if (this.selectedCategory !== 'all') {
          filtered = filtered.filter(tool => tool.category === this.selectedCategory);
        }
      }

      this.filteredTools = filtered;
    },

    /**
     * Set search query and filter
     */
    setSearchQuery(query: string): void {
      this.searchQuery = query;
      this.filterTools();
    },

    /**
     * Set selected category and filter
     */
    setSelectedCategory(category: string): void {
      this.selectedCategory = category;
      this.filterTools();
    },

    /**
     * Select a tool
     */
    selectTool(tool: Tool): void {
      this.selectedTool = tool;
      this.activeToolId = tool.id;
      if (!this.openedToolIds.includes(tool.id)) {
        this.openedToolIds.push(tool.id);
      }
    },

    /**
     * Clear selected tool
     */
    clearSelectedTool(): void {
      this.selectedTool = null;
      this.activeToolId = null;
    },

    /**
     * Close an opened tool tab
     */
    closeTool(toolId: string): void {
      const index = this.openedToolIds.indexOf(toolId);
      if (index > -1) {
        this.openedToolIds.splice(index, 1);
      }

      if (this.activeToolId === toolId) {
        const nextId = this.openedToolIds[index] || this.openedToolIds[index - 1] || null;
        this.activeToolId = nextId || null;
        this.selectedTool = nextId
          ? (this.allTools.find(tool => tool.id === nextId) || null)
          : null;
      }

      if (this.selectedTool?.id === toolId && this.activeToolId !== toolId) {
        this.selectedTool = this.activeToolId
          ? (this.allTools.find(tool => tool.id === this.activeToolId) || null)
          : null;
      }
    },

    /**
     * Set an opened tool tab as active
     */
    setActiveTool(toolId: string): void {
      if (!this.openedToolIds.includes(toolId)) {
        this.openedToolIds.push(toolId);
      }

      const tool = this.allTools.find(t => t.id === toolId) || null;
      this.selectedTool = tool;
      this.activeToolId = tool ? tool.id : null;
    },

    /**
     * Add tool to favorites
     */
    addToFavorites(toolId: string): void {
      if (!this.favorites.includes(toolId)) {
        this.favorites.push(toolId);
        this.saveFavorites();
      }
    },

    /**
     * Remove tool from favorites
     */
    removeFromFavorites(toolId: string): void {
      const index = this.favorites.indexOf(toolId);
      if (index > -1) {
        this.favorites.splice(index, 1);
        this.saveFavorites();
      }
    },

    /**
     * Toggle favorite status
     */
    toggleFavorite(toolId: string): void {
      if (this.favorites.includes(toolId)) {
        this.removeFromFavorites(toolId);
      } else {
        this.addToFavorites(toolId);
      }
    },

    /**
     * Add entry to history
     */
    addToHistory(toolId: string, input?: Record<string, any>, output?: any): void {
      this.history.push({
        toolId,
        timestamp: Date.now(),
        input,
        output
      });

      // Keep only last 100 entries
      if (this.history.length > 100) {
        this.history = this.history.slice(-100);
      }

      this.saveHistory();
    },

    /**
     * Clear history
     */
    clearHistory(): void {
      this.history = [];
      this.saveHistory();
    },

    /**
     * Set API base URL
     */
    setApiBaseUrl(url: string): void {
      this.apiBaseUrl = url;
      this.saveApiBaseUrl();
    },

    /**
     * Toggle settings visibility
     */
    toggleSettings(): void {
      this.showSettings = !this.showSettings;
    },

    /**
     * Toggle theme
     */
    toggleTheme(): void {
      this.theme = this.theme === 'light' ? 'dark' : 'light';
      this.saveTheme();
    },

    /**
     * Set loading state
     */
    setLoading(loading: boolean): void {
      this.loading = loading;
    },

    /**
     * Set error message
     */
    setError(error: string | null): void {
      this.error = error;
    },

    /**
     * Load preferences from localStorage
     */
    loadPreferences(): void {
      try {
        const savedFavorites = localStorage.getItem('ittools_favorites');
        if (savedFavorites) {
          this.favorites = JSON.parse(savedFavorites);
        }

        const savedHistory = localStorage.getItem('ittools_history');
        if (savedHistory) {
          this.history = JSON.parse(savedHistory);
        }

        const savedApiUrl = localStorage.getItem('ittools_api_base_url');
        if (savedApiUrl) {
          this.apiBaseUrl = savedApiUrl;
        }

        const savedTheme = localStorage.getItem('ittools_theme') as 'light' | 'dark';
        if (savedTheme) {
          this.theme = savedTheme;
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      }
    },

    /**
     * Save favorites to localStorage
     */
    saveFavorites(): void {
      try {
        localStorage.setItem('ittools_favorites', JSON.stringify(this.favorites));
      } catch (error) {
        console.error('Error saving favorites:', error);
      }
    },

    /**
     * Save history to localStorage
     */
    saveHistory(): void {
      try {
        localStorage.setItem('ittools_history', JSON.stringify(this.history));
      } catch (error) {
        console.error('Error saving history:', error);
      }
    },

    /**
     * Save API base URL to localStorage
     */
    saveApiBaseUrl(): void {
      try {
        localStorage.setItem('ittools_api_base_url', this.apiBaseUrl);
      } catch (error) {
        console.error('Error saving API URL:', error);
      }
    },

    /**
     * Save theme to localStorage
     */
    saveTheme(): void {
      try {
        localStorage.setItem('ittools_theme', this.theme);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    }
  }
});
