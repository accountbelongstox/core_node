<template>
  <div class="pm-modal-backdrop" v-if="show" @click="emit('close')">
    <div class="pm-modal shortcuts-modal" @click.stop>
      <div class="pm-modal__header">
        <h2>⌨️ Keyboard Shortcuts</h2>
        <button @click="emit('close')" title="Close (Esc)">
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
          <span class="pm-badge pm-badge--info">{{ getCategoryCount(cat) }}</span>
        </button>
      </div>

      <div class="pm-modal__body">
        <div v-if="filteredShortcuts.length === 0" class="no-results">
          <div class="no-results-icon">🔍</div>
          <p class="no-results-text">No shortcuts found</p>
          <p class="no-results-hint">Try different search terms or select another category</p>
        </div>

        <div v-else class="shortcuts-grid">
          <div
            v-for="(shortcut, index) in filteredShortcuts"
            :key="index"
            class="pm-card shortcut-item"
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

      <div class="pm-modal__footer">
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
/* KeyboardShortcutsHelp Styles with NFTMax Theme */

/* Modal Backdrop */
.pm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--pm-space-lg);
  animation: pm-fadeIn 0.3s ease;
}

/* Modal Container */
.pm-modal {
  background: var(--pm-color-surface);
  border-radius: var(--pm-radius-xl);
  box-shadow: var(--pm-shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: pm-scaleUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.shortcuts-modal {
  max-width: 850px;
  width: 90%;
  max-height: 85vh;
}

/* Modal Header */
.pm-modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--pm-space-xl);
  border-bottom: 1px solid var(--pm-color-border-soft);
  background: linear-gradient(135deg, rgba(83, 86, 251, 0.03) 0%, rgba(243, 57, 248, 0.03) 100%);
}

.pm-modal__header h2 {
  margin: 0;
  font-size: var(--pm-font-size-xl);
  font-weight: 700;
  background: var(--pm-gradient-main);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.pm-modal__header button {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(235, 87, 87, 0.1);
  border: 1px solid rgba(235, 87, 87, 0.2);
  border-radius: 50%;
  color: var(--pm-color-danger);
  cursor: pointer;
  transition: var(--pm-transition-fast);
}

.pm-modal__header button:hover {
  background: var(--pm-color-danger);
  color: #ffffff;
  border-color: var(--pm-color-danger);
  transform: rotate(90deg) scale(1.1);
  box-shadow: 0 4px 16px rgba(235, 87, 87, 0.4);
}

/* Search Container */
.search-container {
  position: relative;
  padding: var(--pm-space-lg);
  border-bottom: 1px solid var(--pm-color-border-soft);
  background: var(--pm-color-surface);
}

.search-input {
  width: 100%;
  height: 48px;
  padding: 0 48px 0 20px;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-default);
  background: #ffffff;
  border: 1.5px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-xl);
  outline: none;
  transition: var(--pm-transition-fast);
}

.search-input::placeholder {
  color: var(--pm-text-muted);
}

.search-input:hover {
  border-color: var(--pm-color-primary);
}

.search-input:focus {
  border-color: var(--pm-color-primary);
  box-shadow: 0 0 0 3px rgba(83, 86, 251, 0.1);
  background: #ffffff;
}

.search-clear {
  position: absolute;
  right: 32px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pm-color-border-soft);
  border-radius: 50%;
  color: var(--pm-text-muted);
  cursor: pointer;
  font-size: 14px;
  transition: var(--pm-transition-fast);
}

.search-clear:hover {
  background: var(--pm-color-danger);
  color: #ffffff;
  transform: translateY(-50%) scale(1.1);
}

/* Category Tabs */
.category-tabs {
  display: flex;
  gap: 10px;
  padding: var(--pm-space-lg);
  overflow-x: auto;
  border-bottom: 1px solid var(--pm-color-border-soft);
  background: var(--pm-color-surface);
  scrollbar-width: thin;
}

.category-tabs::-webkit-scrollbar {
  height: 6px;
}

.category-tabs::-webkit-scrollbar-track {
  background: var(--pm-color-surface);
}

.category-tabs::-webkit-scrollbar-thumb {
  background: var(--pm-color-border-soft);
  border-radius: 10px;
}

.category-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: #ffffff;
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-pill);
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  cursor: pointer;
  transition: var(--pm-transition-fast);
  white-space: nowrap;
  position: relative;
  overflow: hidden;
}

.category-tab::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--pm-gradient-main);
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.category-tab:hover {
  border-color: var(--pm-color-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.2);
}

.category-tab.active {
  background: var(--pm-gradient-main);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 4px 16px rgba(243, 57, 248, 0.4);
}

.category-tab.active .pm-badge {
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
}

/* Badge */
.pm-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  border-radius: var(--pm-radius-pill);
  transition: var(--pm-transition-fast);
}

.pm-badge--info {
  background: rgba(83, 86, 251, 0.1);
  color: var(--pm-color-primary);
}

/* Modal Body */
.pm-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--pm-space-lg);
}

/* Shortcuts Grid */
.shortcuts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

/* Card */
.pm-card {
  background: var(--pm-color-surface);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-lg);
  transition: var(--pm-transition-fast);
  animation: pm-fadeIn 0.3s ease;
}

.pm-card:hover {
  border-color: var(--pm-color-primary);
  box-shadow: var(--pm-shadow-md);
}

/* Shortcut Item */
.shortcut-item {
  display: flex;
  align-items: flex-start;
  gap: var(--pm-space-md);
  padding: var(--pm-space-md);
}

.shortcut-item:hover {
  transform: translateX(4px);
}

/* Shortcut Keys */
.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
  flex-shrink: 0;
  margin-top: 2px;
}

.key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 12px;
  background: #ffffff;
  border: 1.5px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-md);
  color: var(--pm-text-default);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05), inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  transition: var(--pm-transition-fast);
}

.key:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.key.primary {
  background: var(--pm-gradient-main);
  border-color: transparent;
  color: #ffffff;
  box-shadow: 0 2px 8px rgba(243, 57, 248, 0.4);
  animation: pm-pulse 2s ease-in-out infinite;
}

/* Shortcut Info */
.shortcut-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.shortcut-description {
  color: var(--pm-text-default);
  font-size: var(--pm-font-size-sm);
  line-height: 1.5;
  font-weight: 500;
}

.shortcut-category {
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* No Results */
.no-results {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 40px;
  text-align: center;
}

.no-results-icon {
  font-size: 64px;
  opacity: 0.3;
  margin-bottom: 16px;
  animation: pm-pulse 2s ease-in-out infinite;
}

.no-results-text {
  margin: 0 0 8px 0;
  font-size: var(--pm-font-size-lg);
  font-weight: 600;
  color: var(--pm-text-muted);
}

.no-results-hint {
  margin: 0;
  font-size: var(--pm-font-size-sm);
  color: var(--pm-text-muted);
}

/* Modal Footer */
.pm-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: var(--pm-space-lg) var(--pm-space-xl);
  border-top: 1px solid var(--pm-color-border-soft);
  background: var(--pm-color-surface);
  flex-wrap: wrap;
}

.footer-hint {
  margin: 0;
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-sm);
  display: flex;
  align-items: center;
  gap: 4px;
}

.footer-stats {
  margin: 0;
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
}

.key-inline {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  height: 26px;
  padding: 0 8px;
  margin: 0 4px;
  background: var(--pm-gradient-main);
  border-radius: var(--pm-radius-sm);
  color: #ffffff;
  font-size: var(--pm-font-size-xs);
  font-weight: 600;
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  box-shadow: 0 2px 4px rgba(243, 57, 248, 0.3);
}

/* Animations */
@keyframes pm-fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes pm-scaleUp {
  from {
    transform: scale(0.9);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes pm-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.02);
  }
}

/* Scrollbar Styling */
.pm-modal__body::-webkit-scrollbar {
  width: 8px;
}

.pm-modal__body::-webkit-scrollbar-track {
  background: var(--pm-color-surface);
  border-radius: 10px;
}

.pm-modal__body::-webkit-scrollbar-thumb {
  background: var(--pm-color-border-soft);
  border-radius: 10px;
  transition: var(--pm-transition-fast);
}

.pm-modal__body::-webkit-scrollbar-thumb:hover {
  background: var(--pm-color-primary);
}

/* Responsive */
@media (max-width: 768px) {
  .pm-modal-backdrop {
    padding: var(--pm-space-md);
  }

  .shortcuts-modal {
    width: 95%;
    max-height: 90vh;
  }

  .pm-modal__header,
  .pm-modal__footer {
    padding: var(--pm-space-md);
  }

  .search-container,
  .category-tabs,
  .pm-modal__body {
    padding: var(--pm-space-md);
  }

  .shortcut-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .shortcut-keys {
    min-width: auto;
    flex-wrap: wrap;
  }

  .pm-modal__footer {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
