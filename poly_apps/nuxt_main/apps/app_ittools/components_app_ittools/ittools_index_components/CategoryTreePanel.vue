<template>
  <div class="category-tree-panel">
    <!-- Root category header -->
    <div 
      v-if="tree.root"
      class="root-category"
      @click="$emit('toggle-root')"
    >
      <div class="flex items-center justify-between w-full">
        <div class="flex items-center space-x-2">
          <i class="fas fa-layer-group text-indigo-500"></i>
          <span class="font-semibold text-gray-800">{{ tree.root.name }}</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="tool-count">{{ tree.root.count }}</span>
          <i :class="['fas transition-transform duration-200', rootExpanded ? 'fa-chevron-down' : 'fa-chevron-right']"></i>
        </div>
      </div>
    </div>

    <!-- Category list -->
    <transition name="expand">
      <div v-if="rootExpanded" class="categories-list">
        <div
          v-for="category in tree.children"
          :key="category.id"
          class="category-item"
        >
          <button
            class="category-header"
            :class="{ 'active': selectedCategory === category.id }"
            @click="$emit('toggle-category', category.id)"
          >
            <div class="flex items-center space-x-2">
              <i :class="['fas', getCategoryIcon(category.id)]" :style="{ color: getCategoryColor(category.id) }"></i>
              <span>{{ category.name }}</span>
            </div>
            <div class="flex items-center space-x-2">
              <span class="tool-count-small">{{ category.count }}</span>
              <i :class="['fas fa-chevron-right transition-transform duration-200', expandedCategories.includes(category.id) && 'rotate-90']"></i>
            </div>
          </button>

          <!-- Tools list -->
          <transition name="slide">
            <div 
              v-if="expandedCategories.includes(category.id)"
              class="tools-list"
            >
              <button
                v-for="tool in (toolsByCategory[category.id] || [])"
                :key="tool.id"
                class="tool-item"
                :class="{ 
                  'active': openToolIds.includes(tool.id),
                  'favorited': favorites.includes(tool.id)
                }"
                @click="$emit('select-tool', tool)"
              >
                <i :class="['fas', `fa-${tool.icon || 'wrench'}`]" class="tool-icon"></i>
                <span class="tool-name">{{ tool.name }}</span>
                <i v-if="favorites.includes(tool.id)" class="fas fa-star favorite-star"></i>
              </button>
            </div>
          </transition>
        </div>
      </div>
    </transition>

    <!-- Empty state -->
    <div v-if="!tree.root && !tree.children.length" class="empty-state">
      <i class="fas fa-folder-open text-4xl text-gray-300 mb-3"></i>
      <p class="text-gray-500">No categories available</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '@/apps/app_ittools/types_app_ittools';

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  count: number;
}

const props = defineProps<{
  tree: { root?: CategoryInfo; children: CategoryInfo[] };
  rootExpanded: boolean;
  expandedCategories: string[];
  selectedCategory: string;
  toolsByCategory: Record<string, Tool[]>;
  openToolIds: string[];
  favorites: string[];
  totalTools: number;
}>();

defineEmits(['toggle-root', 'toggle-category', 'select-tool']);

const getCategoryIcon = (categoryId: string): string => {
  const icons: Record<string, string> = {
    crypto: 'fa-lock',
    converter: 'fa-exchange-alt',
    web: 'fa-globe',
    text: 'fa-font',
    math: 'fa-calculator',
    network: 'fa-network-wired',
    media: 'fa-photo-video',
    development: 'fa-code',
    measurement: 'fa-ruler',
    data: 'fa-database'
  };
  return icons[categoryId] || 'fa-folder';
};

const getCategoryColor = (categoryId: string): string => {
  const colors: Record<string, string> = {
    crypto: '#8b5cf6',
    converter: '#06b6d4',
    web: '#3b82f6',
    text: '#10b981',
    math: '#f59e0b',
    network: '#ef4444',
    media: '#ec4899',
    development: '#6366f1',
    measurement: '#14b8a6',
    data: '#f97316'
  };
  return colors[categoryId] || '#6b7280';
};
</script>

<style scoped>
.category-tree-panel {
  padding: 0.5rem;
}

.root-category {
  display: flex;
  align-items: center;
  padding: 0.875rem 1rem;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
  border-radius: 12px;
  cursor: pointer;
  margin-bottom: 0.75rem;
  transition: all 0.2s ease;
  border: 1px solid rgba(99, 102, 241, 0.12);
}

.root-category:hover {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(139, 92, 246, 0.12) 100%);
  transform: translateY(-1px);
}

.tool-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 22px;
  padding: 0 8px;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  border-radius: 11px;
  font-size: 0.75rem;
  font-weight: 600;
}

.tool-count-small {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  background: rgba(107, 114, 128, 0.1);
  color: #6b7280;
  border-radius: 9px;
  font-size: 0.7rem;
  font-weight: 500;
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.category-item {
  border-radius: 10px;
  overflow: hidden;
}

.category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0.75rem 0.875rem;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(229, 231, 235, 0.6);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.875rem;
  color: #374151;
}

.category-header:hover {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(99, 102, 241, 0.2);
  transform: translateX(2px);
}

.category-header.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border-color: rgba(99, 102, 241, 0.3);
  color: #4f46e5;
}

.tools-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0.5rem 0 0.5rem 1rem;
  margin-left: 0.5rem;
  border-left: 2px solid rgba(99, 102, 241, 0.15);
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 0.8125rem;
  color: #4b5563;
  background: transparent;
  border: none;
  width: 100%;
  text-align: left;
}

.tool-item:hover {
  background: rgba(99, 102, 241, 0.08);
  color: #4f46e5;
  transform: translateX(2px);
}

.tool-item.active {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  color: #4f46e5;
  font-weight: 500;
}

.tool-item.favorited .tool-name {
  color: #f59e0b;
}

.tool-icon {
  width: 14px;
  font-size: 0.75rem;
  opacity: 0.7;
}

.tool-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.favorite-star {
  color: #f59e0b;
  font-size: 0.625rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

/* Transitions */
.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
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
  max-height: 2000px;
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.rotate-90 {
  transform: rotate(90deg);
}
</style>
