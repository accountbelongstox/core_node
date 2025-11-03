<template>
  <div class="shortcuts-help-overlay" v-if="show" @click="emit('close')">
    <div class="shortcuts-help-panel" @click.stop>
      <div class="panel-header">
        <h2 class="panel-title">⌨️ Keyboard Shortcuts</h2>
        <button class="close-btn" @click="emit('close')" title="Close (Esc)">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
          </svg>
        </button>
      </div>

      <!-- Search Bar -->
      <div class="search-container">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="🔍 Search shortcuts..."
          @keydown.esc="searchQuery = ''"
        />
        <span v-if="searchQuery" class="search-clear" @click="searchQuery = ''">✕</span>
      </div>

      <!-- Category Tabs -->
      <div class="category-tabs">
        <button
          v-for="cat in availableCategories"
          :key="cat"
          class="category-tab"
          :class="{ active: selectedCategory === cat }"
          @click="selectedCategory = cat"
        >
          {{ getCategoryIcon(cat) }} {{ cat }}
          <span class="category-count">{{ getCategoryCount(cat) }}</span>
        </button>
      </div>

      <div class="panel-content">
        <div v-if="filteredShortcuts.length === 0" class="no-results">
          <div class="no-results-icon">🔍</div>
          <p class="no-results-text">No shortcuts found</p>
          <p class="no-results-hint">Try different search terms or select another category</p>
        </div>

        <div v-else class="shortcuts-grid">
          <div
            v-for="(shortcut, index) in filteredShortcuts"
            :key="index"
            class="shortcut-item"
          >
            <div class="shortcut-keys">
              <kbd v-if="shortcut.ctrl" class="key">Ctrl</kbd>
              <kbd v-if="shortcut.shift" class="key">Shift</kbd>
              <kbd v-if="shortcut.alt" class="key">Alt</kbd>
              <kbd class="key primary">{{ formatKey(shortcut.key) }}</kbd>
            </div>
            <div class="shortcut-info">
              <div class="shortcut-description">{{ shortcut.description }}</div>
              <div v-if="shortcut.category" class="shortcut-category">
                {{ getCategoryIcon(shortcut.category) }} {{ shortcut.category }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="panel-footer">
        <p class="footer-hint">
          Press <kbd class="key-inline">?</kbd> to toggle this help panel
        </p>
        <p class="footer-stats">
          Showing {{ filteredShortcuts.length }} of {{ shortcuts.length }} shortcuts
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { KeyboardShortcut } from '../composables_app_pymatrix/useKeyboardShortcuts';

interface Props {
  show?: boolean;
  shortcuts: KeyboardShortcut[];
}

interface Emits {
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  show: false
});

const emit = defineEmits<Emits>();

const searchQuery = ref('');
const selectedCategory = ref('All');

const availableCategories = computed(() => {
  const categories = new Set<string>(['All']);
  props.shortcuts.forEach(s => {
    if (s.category) categories.add(s.category);
  });
  return Array.from(categories);
});

const filteredShortcuts = computed(() => {
  let filtered = props.shortcuts;

  // Filter by category
  if (selectedCategory.value !== 'All') {
    filtered = filtered.filter(s => s.category === selectedCategory.value);
  }

  // Filter by search query
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(s =>
      s.description.toLowerCase().includes(query) ||
      s.key.toLowerCase().includes(query) ||
      (s.category?.toLowerCase().includes(query))
    );
  }

  return filtered;
});

function getCategoryCount(category: string): number {
  if (category === 'All') return props.shortcuts.length;
  return props.shortcuts.filter(s => s.category === category).length;
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'All': '📋',
    'Device': '📱',
    'Video': '🎬',
    'Control': '🎮',
    'File': '📁',
    'Group': '👥',
    'Navigation': '🧭',
    'System': '⚙️',
    'Recording': '⏺️',
    'Screen': '📺'
  };
  return icons[category] || '⭐';
}

function formatKey(key: string): string {
  const keyMap: Record<string, string> = {
    ' ': 'Space',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'Enter': '⏎',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Tab': '⇥',
    '/': '?'
  };

  return keyMap[key] || key.toUpperCase();
}
</script>

<style scoped>
.shortcuts-help-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.shortcuts-help-panel {
  width: 90%;
  max-width: 800px;
  max-height: 85vh;
  background: rgba(30, 30, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    transform: translateY(30px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.panel-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: white;
  letter-spacing: -0.5px;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  color: white;
  transform: scale(1.05);
}

/* Search Container */
.search-container {
  position: relative;
  padding: 16px 28px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.search-input {
  width: 100%;
  padding: 12px 40px 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  outline: none;
  transition: all 0.2s ease;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.4);
}

.search-input:focus {
  background: rgba(255, 255, 255, 0.08);
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.search-clear {
  position: absolute;
  right: 40px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.search-clear:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 8px;
  padding: 16px 28px;
  overflow-x: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  scrollbar-width: none;
}

.category-tabs::-webkit-scrollbar {
  display: none;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.category-tab:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.9);
}

.category-tab.active {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border-color: #3b82f6;
  color: white;
}

.category-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 28px;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.shortcut-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  transition: all 0.2s ease;
}

.shortcut-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateX(4px);
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 180px;
  flex-shrink: 0;
  margin-top: 2px;
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 10px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.08) 100%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.key.primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-color: #60a5fa;
  color: white;
}

.shortcut-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shortcut-description {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  line-height: 1.5;
  font-weight: 500;
}

.shortcut-category {
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-weight: 600;
}

/* No Results */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.no-results-icon {
  font-size: 64px;
  opacity: 0.3;
  margin-bottom: 16px;
}

.no-results-text {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.no-results-hint {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.4);
}

.panel-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 28px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
}

.footer-hint {
  margin: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 13px;
}

.footer-stats {
  margin: 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: 12px;
  font-weight: 600;
}

.key-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
}

/* Scrollbar styling */
.panel-content::-webkit-scrollbar {
  width: 8px;
}

.panel-content::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

.panel-content::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Responsive design */
@media (max-width: 768px) {
  .shortcuts-help-panel {
    width: 95%;
    max-height: 90vh;
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .shortcut-keys {
    min-width: auto;
  }

  .panel-footer {
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
  }

  .category-tabs {
    padding: 12px 20px;
  }

  .search-container {
    padding: 12px 20px;
  }
}
</style>
