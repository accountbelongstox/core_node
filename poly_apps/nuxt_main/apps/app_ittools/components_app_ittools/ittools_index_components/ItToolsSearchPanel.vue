<template>
  <div class="search-panel">
    <div class="search-section">
      <label class="search-label">Search Tools</label>
      <div class="search-input-wrapper">
        <i class="fas fa-search search-icon"></i>
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
          @focus="$emit('focus')"
          @blur="$emit('blur')"
          type="text"
          class="search-input"
          placeholder="Search by tool name, category, or keyword..."
        >
        <button
          v-if="modelValue"
          @mousedown.prevent="$emit('clear')"
          class="clear-btn"
        >
          <i class="fas fa-times"></i>
        </button>
        <Transition name="results">
          <div
            v-if="showResults && searchResults.length"
            class="search-results"
          >
            <button
              v-for="tool in searchResults"
              :key="`search-${tool.id}`"
              @mousedown.prevent="$emit('select-result', tool)"
              class="result-item"
            >
              <div class="result-main">
                <i :class="['fas', `fa-${tool.icon || 'wrench'}`]" class="result-icon"></i>
                <span class="result-name">{{ tool.name }}</span>
              </div>
              <span class="result-category">{{ tool.category }}</span>
            </button>
          </div>
        </Transition>
      </div>
      <Transition name="fade">
        <div
          v-if="lastUsedTool && (!activeTool || activeTool.id !== lastUsedTool.id)"
          class="last-used"
        >
          <span>Last used:</span>
          <button
            @click="$emit('open-last')"
            class="last-used-btn"
          >
            <i :class="['fas', `fa-${lastUsedTool.icon || 'wrench'}`]"></i>
            {{ lastUsedTool.name }}
          </button>
        </div>
      </Transition>
    </div>
    <div class="recent-section">
      <div class="recent-card">
        <div class="recent-header">
          <h3 class="recent-title">Recent Tools</h3>
          <span class="recent-count">Last 10</span>
        </div>
        <div v-if="recentTools.length" class="recent-list">
          <button
            v-for="tool in recentTools"
            :key="`recent-${tool.id}`"
            @click="$emit('select-recent', tool)"
            class="recent-item"
          >
            <i :class="['fas', `fa-${tool.icon || 'wrench'}`]" class="recent-icon"></i>
            {{ tool.name }}
          </button>
        </div>
        <div v-else class="recent-empty">
          <i class="fas fa-clock empty-icon"></i>
          <span>Recently opened tools will appear here.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '@/apps/app_ittools/types_app_ittools';

const props = defineProps<{
  modelValue: string;
  searchResults: Tool[];
  showResults: boolean;
  recentTools: Tool[];
  lastUsedTool: Tool | null;
  activeTool: Tool | null;
}>();

defineEmits(['update:modelValue', 'focus', 'blur', 'clear', 'select-result', 'select-recent', 'open-last']);
</script>

<style scoped>
.search-panel {
  display: grid;
  gap: 1.5rem;
  grid-template-columns: 1fr;
}

@media (min-width: 1024px) {
  .search-panel {
    grid-template-columns: 2fr 1fr;
  }
}

.search-section {
  display: flex;
  flex-direction: column;
}

.search-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #6366f1;
  margin-bottom: 0.625rem;
}

.search-input-wrapper {
  position: relative;
}

.search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  color: #9ca3af;
  font-size: 0.875rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.875rem 2.75rem 0.875rem 2.75rem;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 14px;
  font-size: 0.875rem;
  color: #1f2937;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.04);
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-input:focus {
  outline: none;
  border-color: rgba(99, 102, 241, 0.4);
  box-shadow: 
    0 0 0 3px rgba(99, 102, 241, 0.1),
    0 4px 12px rgba(99, 102, 241, 0.08);
}

.clear-btn {
  position: absolute;
  right: 1rem;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(107, 114, 128, 0.1);
  border: none;
  border-radius: 6px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.search-results {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 8px);
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 14px;
  box-shadow: 
    0 20px 50px rgba(99, 102, 241, 0.1),
    0 8px 24px rgba(0, 0, 0, 0.05);
  max-height: 280px;
  overflow-y: auto;
  z-index: 50;
}

.result-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(229, 231, 235, 0.5);
  cursor: pointer;
  transition: all 0.15s ease;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.06) 0%, rgba(139, 92, 246, 0.06) 100%);
}

.result-main {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.result-icon {
  width: 16px;
  font-size: 0.75rem;
  color: #6366f1;
}

.result-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: #1f2937;
}

.result-category {
  font-size: 0.75rem;
  color: #9ca3af;
  padding: 0.25rem 0.5rem;
  background: rgba(107, 114, 128, 0.08);
  border-radius: 6px;
}

.last-used {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  margin-top: 0.875rem;
  font-size: 0.8125rem;
  color: #6b7280;
}

.last-used-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(229, 231, 235, 0.8);
  border-radius: 20px;
  font-size: 0.8125rem;
  color: #4f46e5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.last-used-btn:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-color: rgba(99, 102, 241, 0.3);
  transform: translateY(-1px);
}

.recent-section {
  height: 100%;
}

.recent-card {
  height: 100%;
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 18px;
  padding: 1.25rem;
  box-shadow: 
    0 4px 20px rgba(99, 102, 241, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.recent-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.recent-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0;
}

.recent-count {
  font-size: 0.7rem;
  color: #9ca3af;
  padding: 0.25rem 0.5rem;
  background: rgba(107, 114, 128, 0.08);
  border-radius: 6px;
}

.recent-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.recent-item {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 20px;
  font-size: 0.75rem;
  color: #4b5563;
  cursor: pointer;
  transition: all 0.2s ease;
}

.recent-item:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
  border-color: rgba(99, 102, 241, 0.25);
  color: #4f46e5;
  transform: translateY(-1px);
}

.recent-icon {
  font-size: 0.625rem;
  opacity: 0.7;
}

.recent-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  text-align: center;
}

.empty-icon {
  font-size: 1.5rem;
  color: #d1d5db;
}

.recent-empty span {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* Transitions */
.results-enter-active,
.results-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top;
}

.results-enter-from,
.results-leave-to {
  opacity: 0;
  transform: scaleY(0.95) translateY(-4px);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
