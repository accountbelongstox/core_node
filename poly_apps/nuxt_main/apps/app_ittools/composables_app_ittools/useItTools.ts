// IT Tools Composable
// Provides reactive helpers and utilities for IT Tools application

import { ref, computed, onMounted } from 'vue';
import { useItToolsStore } from '../stores_app_ittools/ittools-store';
import { ItToolsMainAPI } from '../services_app_ittools/ittools-main-api';
import type { Tool } from '../constants_app_ittools/tools';

export function useItTools() {
  const store = useItToolsStore();
  const api = new ItToolsMainAPI();

  // Local state
  const toolResult = ref<any>(null);
  const toolLoading = ref(false);
  const toolError = ref<string | null>(null);
  const executionTime = ref(0);

  // Computed properties
  const favorites = computed(() => store.favoriteTools);
  const recent = computed(() => store.recentTools);
  const categories = computed(() => store.categoriesWithCounts);
  const currentTool = computed(() => store.selectedTool);

  /**
   * Execute a tool
   */
  const executeTool = async (tool: Tool, params: Record<string, any>): Promise<any> => {
    toolLoading.value = true;
    toolError.value = null;
    const startTime = performance.now();

    try {
      const response = await api.executeTool(tool.endpoint, tool.method, params);

      const endTime = performance.now();
      executionTime.value = Math.round(endTime - startTime);

      if (response.success) {
        toolResult.value = response.data;
        store.addToHistory(tool.id, params, response.data);
        return response.data;
      } else {
        throw new Error(response.error || 'Tool execution failed');
      }
    } catch (error: any) {
      toolError.value = error.message || 'An error occurred';
      toolResult.value = null;
      console.error('Tool execution error:', error);
      throw error;
    } finally {
      toolLoading.value = false;
    }
  };

  /**
   * Copy result to clipboard
   */
  const copyResult = async (value: any): Promise<boolean> => {
    try {
      const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  };

  /**
   * Download result as file
   */
  const downloadResult = (value: any, filename: string = 'result.json'): void => {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  /**
   * Clear all results
   */
  const clearResults = (): void => {
    toolResult.value = null;
    toolError.value = null;
    executionTime.value = 0;
  };

  /**
   * Set API base URL
   */
  const setApiUrl = (url: string): void => {
    api.setBaseUrl(url);
    store.setApiBaseUrl(url);
  };

  /**
   * Initialize the store
   */
  const initialize = (): void => {
    store.loadPreferences();
    if (store.apiBaseUrl !== api.getBaseUrl()) {
      api.setBaseUrl(store.apiBaseUrl);
    }
  };

  // Auto-initialize on mount
  onMounted(() => {
    initialize();
  });

  return {
    // State
    toolResult,
    toolLoading,
    toolError,
    executionTime,

    // Computed
    favorites,
    recent,
    categories,
    currentTool,

    // Store actions
    selectTool: store.selectTool,
    clearSelectedTool: store.clearSelectedTool,
    addToFavorites: store.addToFavorites,
    removeFromFavorites: store.removeFromFavorites,
    toggleFavorite: store.toggleFavorite,
    setSearchQuery: store.setSearchQuery,
    setSelectedCategory: store.setSelectedCategory,
    toggleTheme: store.toggleTheme,

    // Methods
    executeTool,
    copyResult,
    downloadResult,
    clearResults,
    setApiUrl,
    initialize
  };
}
