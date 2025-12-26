<template>
  <div class="laravel-web-panel">
    <!-- Sidebar -->
    <AppSidebar />

    <!-- Main Content Area -->
    <div class="main-container" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
      <!-- Top Bar -->
      <AppTopBar />

      <!-- Content Area -->
      <AppContentArea />
    </div>

    <!-- Mobile Menu Overlay -->
    <transition name="fade">
      <div
        v-if="mobileMenuOpen"
        class="mobile-overlay"
        @click="toggleMobileMenu"
      ></div>
    </transition>
  </div>
</template>

<script setup lang="ts">
// Import components from ittools_index_components
import AppSidebar from '../ittools_index_components/AppSidebar.vue'
import AppTopBar from '../ittools_index_components/AppTopBar.vue'
import AppContentArea from '../ittools_index_components/AppContentArea.vue'

// Import composables (explicit import for app-specific composables)
import { useAppState } from '@/apps/app_ittools/composables_app_ittools/useAppState'

// Use unified composables
const { sidebarCollapsed, mobileMenuOpen, toggleMobileMenu } = useAppState()
</script>

<style scoped>
.laravel-web-panel {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: #f9fafb;
}

.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 260px;
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 0;
}

.main-container.sidebar-collapsed {
  margin-left: 70px;
}

.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .main-container {
    margin-left: 0;
  }

  .main-container.sidebar-collapsed {
    margin-left: 0;
  }
}
</style>
