<template>
  <aside 
    class="right-side-panel"
    :class="{ 'is-visible': isVisible }"
  >
    <div class="panel-header">
      <h3>Quick Access</h3>
      <button @click="$emit('close')" class="close-btn">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <div class="panel-content">
      <!-- Recent Tools Section -->
      <div class="panel-section">
        <div class="section-header" @click="toggleSection('recent')">
          <span><i class="fas fa-history"></i> Recent Tools</span>
          <i :class="['fas', expandedSections.includes('recent') ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
        </div>
        <Transition name="expand">
          <div v-if="expandedSections.includes('recent')" class="section-content">
            <div v-if="recentTools.length === 0" class="empty-state">
              No recent tools
            </div>
            <button
              v-for="tool in recentTools"
              :key="tool.id"
              @click="$emit('select-tool', tool)"
              class="tool-item"
            >
              <i :class="tool.icon"></i>
              <span>{{ tool.name }}</span>
            </button>
          </div>
        </Transition>
      </div>

      <!-- Favorites Section -->
      <div class="panel-section">
        <div class="section-header" @click="toggleSection('favorites')">
          <span><i class="fas fa-star"></i> Favorites</span>
          <i :class="['fas', expandedSections.includes('favorites') ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
        </div>
        <Transition name="expand">
          <div v-if="expandedSections.includes('favorites')" class="section-content">
            <div v-if="favoriteTools.length === 0" class="empty-state">
              No favorite tools yet
            </div>
            <button
              v-for="tool in favoriteTools"
              :key="tool.id"
              @click="$emit('select-tool', tool)"
              class="tool-item"
            >
              <i :class="tool.icon"></i>
              <span>{{ tool.name }}</span>
              <i class="fas fa-star star-icon"></i>
            </button>
          </div>
        </Transition>
      </div>

      <!-- Quick Tools by Category -->
      <div class="panel-section">
        <div class="section-header" @click="toggleSection('categories')">
          <span><i class="fas fa-th-large"></i> Browse by Category</span>
          <i :class="['fas', expandedSections.includes('categories') ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
        </div>
        <Transition name="expand">
          <div v-if="expandedSections.includes('categories')" class="section-content">
            <div 
              v-for="category in categories" 
              :key="category.id"
              class="category-group"
            >
              <button 
                @click="toggleCategory(category.id)"
                class="category-header"
              >
                <span>
                  <i :class="category.icon"></i>
                  {{ category.name }}
                </span>
                <span class="category-count">{{ category.count }}</span>
              </button>
              <Transition name="expand">
                <div v-if="expandedCategories.includes(category.id)" class="category-tools">
                  <button
                    v-for="tool in getToolsByCategory(category.id)"
                    :key="tool.id"
                    @click="$emit('select-tool', tool)"
                    class="tool-item small"
                  >
                    {{ tool.name }}
                  </button>
                </div>
              </Transition>
            </div>
          </div>
        </Transition>
      </div>

      <!-- Auth Required Tools Notice -->
      <div v-if="!isAuthenticated" class="auth-notice">
        <i class="fas fa-lock"></i>
        <p>Some tools require login to use</p>
        <button @click="$emit('login')" class="login-btn">
          Sign In
        </button>
      </div>
    </div>

    <div class="panel-footer">
      <button @click="$emit('toggle-theme')" class="footer-btn">
        <i :class="['fas', theme === 'dark' ? 'fa-sun' : 'fa-moon']"></i>
        {{ theme === 'dark' ? 'Light Mode' : 'Dark Mode' }}
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Tool } from '@/apps/app_ittools/types_app_ittools';

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  count: number;
}

const props = defineProps<{
  isVisible: boolean;
  recentTools: Tool[];
  favoriteTools: Tool[];
  categories: CategoryInfo[];
  allTools: Tool[];
  theme: 'light' | 'dark';
  isAuthenticated: boolean;
}>();

defineEmits(['close', 'select-tool', 'toggle-theme', 'login']);

const expandedSections = ref<string[]>(['recent', 'favorites']);
const expandedCategories = ref<string[]>([]);

const toggleSection = (section: string) => {
  const index = expandedSections.value.indexOf(section);
  if (index > -1) {
    expandedSections.value.splice(index, 1);
  } else {
    expandedSections.value.push(section);
  }
};

const toggleCategory = (categoryId: string) => {
  const index = expandedCategories.value.indexOf(categoryId);
  if (index > -1) {
    expandedCategories.value.splice(index, 1);
  } else {
    expandedCategories.value.push(categoryId);
  }
};

const getToolsByCategory = (categoryId: string): Tool[] => {
  return props.allTools.filter(t => t.category === categoryId).slice(0, 5);
};
</script>

<style scoped>
.right-side-panel {
  position: fixed;
  top: 0;
  right: -320px;
  width: 320px;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  display: flex;
  flex-direction: column;
  transition: right 0.3s ease;
}

.right-side-panel.is-visible {
  right: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e2e8f0;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.close-btn {
  padding: 8px;
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  border-radius: 6px;
}

.close-btn:hover {
  background: #f1f5f9;
  color: #334155;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.panel-section {
  margin-bottom: 16px;
  background: #f8fafc;
  border-radius: 12px;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 500;
  color: #334155;
  transition: background 0.2s;
}

.section-header:hover {
  background: #e2e8f0;
}

.section-header i:first-child {
  margin-right: 8px;
  color: #667eea;
}

.section-content {
  padding: 8px;
}

.tool-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  background: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  color: #334155;
  transition: all 0.2s;
  margin-bottom: 4px;
}

.tool-item:last-child {
  margin-bottom: 0;
}

.tool-item:hover {
  background: #667eea;
  color: white;
}

.tool-item i {
  width: 20px;
  text-align: center;
}

.tool-item .star-icon {
  margin-left: auto;
  color: #fbbf24;
}

.tool-item.small {
  padding: 8px 12px;
  font-size: 12px;
}

.empty-state {
  padding: 16px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.category-group {
  margin-bottom: 4px;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  background: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #334155;
}

.category-header:hover {
  background: #e2e8f0;
}

.category-header i {
  margin-right: 8px;
  color: #667eea;
}

.category-count {
  background: #e2e8f0;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #64748b;
}

.category-tools {
  padding: 8px 0 8px 24px;
}

.auth-notice {
  margin-top: 20px;
  padding: 20px;
  background: #fef3c7;
  border-radius: 12px;
  text-align: center;
}

.auth-notice i {
  font-size: 24px;
  color: #f59e0b;
  margin-bottom: 8px;
}

.auth-notice p {
  margin: 0 0 12px;
  font-size: 13px;
  color: #92400e;
}

.login-btn {
  padding: 8px 20px;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
}

.panel-footer {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.footer-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  background: #f1f5f9;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #334155;
}

.footer-btn:hover {
  background: #e2e8f0;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
}
</style>

