<template>
  <aside
    class="app-sidebar"
    :class="{ 'collapsed': sidebarCollapsed }"
  >
    <!-- Sidebar Header -->
    <div class="sidebar-header">
      <div class="logo">
        <i class="fas fa-layer-group"></i>
        <transition name="fade">
          <span v-if="!sidebarCollapsed" class="logo-text">{{ t('app.name') }}</span>
        </transition>
      </div>
      <button
        class="toggle-btn"
        @click="toggleSidebar"
        :title="sidebarCollapsed ? t('sidebar.expand') : t('sidebar.collapse')"
      >
        <i class="fas" :class="sidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
      </button>
    </div>

    <!-- Menu Items -->
    <nav class="sidebar-nav">
      <ul class="menu-list">
        <li
          v-for="item in menuItems"
          :key="item.id"
          class="menu-item"
          :class="{ 'active': activeModule === item.id }"
        >
          <button
            class="menu-btn"
            @click="setActiveModule(item.id)"
            :title="sidebarCollapsed ? item.label : ''"
          >
            <i class="fas" :class="`fa-${item.icon}`"></i>
            <transition name="fade">
              <span v-if="!sidebarCollapsed" class="menu-label">{{ item.label }}</span>
            </transition>
            <span v-if="item.badge && !sidebarCollapsed" class="menu-badge">{{ item.badge }}</span>
          </button>

          <!-- Sub-menu (for Dev Tools) -->
          <transition name="slide-down">
            <ul
              v-if="item.children && activeModule === item.id && !sidebarCollapsed"
              class="sub-menu"
            >
              <li
                v-for="child in item.children"
                :key="child.id"
                class="sub-menu-item"
              >
                <button class="sub-menu-btn">
                  <i v-if="child.icon" class="fas" :class="`fa-${child.icon}`"></i>
                  <span>{{ child.label }}</span>
                </button>
              </li>
            </ul>
          </transition>
        </li>
      </ul>
    </nav>

    <!-- Sidebar Footer (Optional) -->
    <div v-if="!sidebarCollapsed" class="sidebar-footer">
      <div class="footer-info">
        <small>{{ t('app.title') }}</small>
        <small class="text-muted">v1.0.0</small>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
// Import composables
import { useAppNavigation } from '@/apps/app_ittools/composables_app_ittools/useAppNavigation'
import { useI18n } from '@/apps/app_ittools/composables_app_ittools/useI18n'

// Use unified composables
const {
  activeModule,
  sidebarCollapsed,
  menuItems,
  setActiveModule,
  toggleSidebar
} = useAppNavigation()

const { t } = useI18n()
</script>

<style scoped>
.app-sidebar {
  position: fixed;
  left: 0;
  top: 0;
  height: 100vh;
  width: 260px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1000;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.1);
}

.app-sidebar.collapsed {
  width: 70px;
}

/* Header */
.sidebar-header {
  padding: 1.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.logo-text {
  white-space: nowrap;
}

.toggle-btn {
  background: rgba(255, 255, 255, 0.1);
  border: none;
  color: white;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: scale(1.1);
}

/* Navigation */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 0;
}

.sidebar-nav::-webkit-scrollbar {
  width: 4px;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.menu-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.menu-item {
  margin: 0.25rem 0.5rem;
}

.menu-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.8);
  cursor: pointer;
  border-radius: 0.5rem;
  transition: all 0.2s;
  font-size: 0.95rem;
  position: relative;
}

.menu-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.menu-item.active .menu-btn {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  font-weight: 500;
}

.menu-btn i:first-child {
  font-size: 1.1rem;
  width: 20px;
  text-align: center;
}

.menu-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
}

.menu-badge {
  background: #ef4444;
  color: white;
  font-size: 0.7rem;
  padding: 0.15rem 0.5rem;
  border-radius: 1rem;
  font-weight: 600;
}

/* Sub-menu */
.sub-menu {
  list-style: none;
  padding: 0.5rem 0 0 0;
  margin: 0;
}

.sub-menu-item {
  margin: 0.25rem 0;
}

.sub-menu-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem 0.5rem 2.5rem;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.sub-menu-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Footer */
.sidebar-footer {
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  opacity: 0.7;
  font-size: 0.8rem;
}

.text-muted {
  opacity: 0.6;
}

/* Transitions */
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
  max-height: 500px;
  overflow: hidden;
}

.slide-down-enter-from, .slide-down-leave-to {
  max-height: 0;
  opacity: 0;
}

/* Collapsed state adjustments */
.app-sidebar.collapsed .menu-btn {
  justify-content: center;
  padding: 0.75rem;
}

.app-sidebar.collapsed .sidebar-header {
  justify-content: center;
  padding: 1.5rem 0.5rem;
}

.app-sidebar.collapsed .toggle-btn {
  position: absolute;
  right: -16px;
  top: 50%;
  transform: translateY(-50%);
}
</style>
