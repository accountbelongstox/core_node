<template>
  <div class="quick-nav-dropdown">
    <button
      @click="$emit('toggle')"
      class="quick-nav-trigger"
      :class="{ 'active': open }"
    >
      <span class="trigger-content">
        <i class="fas fa-compass trigger-icon"></i>
        <span>Quick Jump</span>
      </span>
      <i :class="['fas transition-transform duration-200', open ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
    </button>
    <Transition name="dropdown">
      <div v-if="open" class="dropdown-panel">
        <div class="dropdown-inner">
          <div
            v-for="category in categories"
            :key="category.id"
            class="category-section"
          >
            <button
              @click="$emit('toggle-section', category.id)"
              class="section-header"
            >
              <span class="header-content">
                <i :class="category.icon" class="section-icon"></i>
                <span>{{ category.name }}</span>
              </span>
              <i :class="['fas fa-chevron-right transition-transform duration-200', expanded.includes(category.id) && 'rotate-90']"></i>
            </button>
            <Transition name="expand">
              <div
                v-if="expanded.includes(category.id)"
                class="tools-panel"
              >
                <button
                  v-for="tool in (toolsByCategory[category.id] || [])"
                  :key="`${category.id}-${tool.id}`"
                  @click="$emit('jump-to-tool', tool)"
                  class="tool-btn"
                >
                  <i :class="['fas', `fa-${tool.icon || 'wrench'}`]" class="tool-icon"></i>
                  {{ tool.name }}
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '@/apps/app_ittools/types_app_ittools';

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
}

defineProps<{
  categories: CategoryInfo[];
  open: boolean;
  expanded: string[];
  toolsByCategory: Record<string, Tool[]>;
}>();

defineEmits(['toggle', 'toggle-section', 'jump-to-tool']);
</script>

<style scoped>
.quick-nav-dropdown {
  margin-bottom: 1rem;
}

.quick-nav-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 1rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 600;
  color: #4f46e5;
  cursor: pointer;
  transition: all 0.2s ease;
}

.quick-nav-trigger:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  border-color: rgba(99, 102, 241, 0.35);
  transform: translateY(-1px);
}

.quick-nav-trigger.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(139, 92, 246, 0.18) 100%);
  border-color: rgba(99, 102, 241, 0.4);
}

.trigger-content {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}

.trigger-icon {
  font-size: 0.875rem;
}

.dropdown-panel {
  margin-top: 0.75rem;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.15);
  box-shadow: 
    0 10px 40px rgba(99, 102, 241, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.04);
  overflow: hidden;
}

.dropdown-inner {
  max-height: 320px;
  overflow-y: auto;
  padding: 0.75rem;
}

.dropdown-inner::-webkit-scrollbar {
  width: 4px;
}

.dropdown-inner::-webkit-scrollbar-track {
  background: transparent;
}

.dropdown-inner::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.2);
  border-radius: 2px;
}

.category-section {
  margin-bottom: 0.375rem;
}

.category-section:last-child {
  margin-bottom: 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.625rem 0.875rem;
  border-radius: 10px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #374151;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.section-header:hover {
  background: rgba(99, 102, 241, 0.06);
  color: #4f46e5;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.section-icon {
  width: 16px;
  font-size: 0.75rem;
  color: #6366f1;
}

.tools-panel {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0 0.5rem 1.75rem;
}

.tool-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
  color: #4b5563;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: left;
}

.tool-btn:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
  border-color: rgba(99, 102, 241, 0.15);
  color: #4f46e5;
  transform: translateX(2px);
}

.tool-icon {
  width: 12px;
  font-size: 0.625rem;
  opacity: 0.6;
}

/* Transitions */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  transform-origin: top;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.95) translateY(-8px);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
}

.expand-enter-to,
.expand-leave-from {
  opacity: 1;
  max-height: 500px;
}

.rotate-90 {
  transform: rotate(90deg);
}
</style>
