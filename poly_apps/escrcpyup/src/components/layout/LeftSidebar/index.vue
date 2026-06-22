<template>
  <!--
    ================================================================
    LEFT SIDEBAR - Navigation Panel
    ================================================================
    This is a NEW component for the left navigation sidebar.

    ✏️ FULLY CUSTOMIZABLE by another AI - Fill with:
    - Navigation menu items
    - Device groups/filters
    - Quick access buttons
    - Collapse toggle
    - User avatar/settings

    ⚠️ DO NOT MODIFY:
    - Props interface (collapsed)
    - Events interface (toggle)
    - These must remain for wrapper layout integration
    ================================================================
  -->
  <div class="left-sidebar" :class="{ collapsed }">
    <!--
      ✏️ HEADER SECTION
      ================================================================
      TO BE FILLED: Logo, app name, collapse button
      ================================================================
    -->
    <div class="sidebar-header">
      <div v-if="!collapsed" class="sidebar-logo">
        <!-- TODO: Add your logo/branding here -->
        <div class="logo-placeholder">
          <span class="text-2xl">📱</span>
        </div>
        <div class="logo-text">
          <div class="font-bold text-base">Escrcpy</div>
          <div class="text-xs text-gray-400">Extended UI</div>
        </div>
      </div>

      <!-- Collapse Toggle Button -->
      <button
        class="collapse-btn"
        :title="collapsed ? 'Expand' : 'Collapse'"
        @click="$emit('toggle')"
      >
        <span v-if="collapsed">→</span>
        <span v-else>←</span>
      </button>
    </div>

    <!--
      ✏️ NAVIGATION MENU
      ================================================================
      TO BE FILLED: Main navigation items
      Suggested items:
      - Dashboard
      - Device Matrix
      - File Manager
      - Scripts
      - Settings
      ================================================================
    -->
    <div class="sidebar-nav">
      <nav v-if="!collapsed" class="nav-menu">
        <!--
          TODO: Replace with actual navigation
          Example structure:
          <a href="#dashboard" class="nav-item">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
          </a>
        -->
        <div class="nav-section">
          <div class="nav-section-title">WORKSPACE</div>
          <a href="#" class="nav-item active">
            <span class="nav-icon">📊</span>
            <span class="nav-label">Dashboard</span>
          </a>
          <a href="#" class="nav-item">
            <span class="nav-icon">🎬</span>
            <span class="nav-label">Device Matrix</span>
          </a>
          <a href="#" class="nav-item">
            <span class="nav-icon">📁</span>
            <span class="nav-label">File Manager</span>
          </a>
          <a href="#" class="nav-item">
            <span class="nav-icon">⚡</span>
            <span class="nav-label">Scripts</span>
          </a>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">DEVICE GROUPS</div>
          <!--
            TODO: Add device groups dynamically
            These could come from the device store
          -->
          <a href="#" class="nav-item">
            <span class="nav-icon">📱</span>
            <span class="nav-label">All Devices</span>
            <span class="nav-badge">12</span>
          </a>
          <a href="#" class="nav-item">
            <span class="nav-icon">🟢</span>
            <span class="nav-label">Online</span>
            <span class="nav-badge">8</span>
          </a>
          <a href="#" class="nav-item">
            <span class="nav-icon">🔴</span>
            <span class="nav-label">Offline</span>
            <span class="nav-badge">4</span>
          </a>
        </div>
      </nav>

      <!-- Collapsed state - show icons only -->
      <nav v-else class="nav-menu-collapsed">
        <button class="nav-icon-btn" title="Dashboard">📊</button>
        <button class="nav-icon-btn" title="Device Matrix">🎬</button>
        <button class="nav-icon-btn" title="File Manager">📁</button>
        <button class="nav-icon-btn" title="Scripts">⚡</button>
      </nav>
    </div>

    <!--
      ✏️ FOOTER SECTION
      ================================================================
      TO BE FILLED: Status, user profile, quick actions
      ================================================================
    -->
    <div v-if="!collapsed" class="sidebar-footer">
      <!-- TODO: Add footer content (status, user menu, etc.) -->
      <div class="footer-status">
        <span class="status-dot status-online"></span>
        <span class="text-xs">Connected</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/*
  ================================================================
  PROPS & EMITS - DO NOT MODIFY THESE INTERFACES
  ================================================================
  These are required by the wrapper layout
*/
const props = defineProps({
  collapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle'])

/*
  ================================================================
  ✏️ YOUR CUSTOM LOGIC GOES HERE
  ================================================================
  Add:
  - Navigation state management
  - Active route tracking
  - Device group data fetching
  - User interaction handlers
  - Animations and transitions

  You can access device store:
  import { useDeviceStore } from '@/store/device'
  const deviceStore = useDeviceStore()
  ================================================================
*/

// TODO: Add your custom logic here
// Example:
// import { useDeviceStore } from '@/store/device'
// const deviceStore = useDeviceStore()
// const deviceCount = computed(() => deviceStore.list.length)
</script>

<style scoped>
/*
  ================================================================
  LEFT SIDEBAR STYLES
  ================================================================
  ✏️ FULLY CUSTOMIZABLE - Modify colors, spacing, animations
  ================================================================
*/

.left-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: #e5e7eb;
  transition: all 0.3s ease;
}

/* HEADER */
.sidebar-header {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-placeholder {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
}

.logo-text {
  flex: 1;
  min-width: 0;
}

.collapse-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 6px;
  color: #e5e7eb;
  cursor: pointer;
  transition: all 0.2s ease;
}

.collapse-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  transform: scale(1.05);
}

/* NAVIGATION */
.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 1rem 0;
}

.nav-menu {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0 0.75rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-section-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  padding: 0.5rem 0.75rem;
  letter-spacing: 0.05em;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 8px;
  color: #d1d5db;
  text-decoration: none;
  transition: all 0.2s ease;
  font-size: 0.875rem;
}

.nav-item:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #ffffff;
  transform: translateX(4px);
}

.nav-item.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3));
  color: #ffffff;
  font-weight: 500;
}

.nav-icon {
  flex: none;
  width: 24px;
  text-align: center;
  font-size: 1.25rem;
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-badge {
  flex: none;
  background-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
  padding: 0.125rem 0.5rem;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Collapsed Navigation */
.nav-menu-collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
}

.nav-icon-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nav-icon-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
  transform: scale(1.1);
}

/* FOOTER */
.sidebar-footer {
  flex: none;
  padding: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #9ca3af;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  animation: pulse 2s infinite;
}

.status-online {
  background-color: #10b981;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Scrollbar Styling */
.sidebar-nav::-webkit-scrollbar {
  width: 6px;
}

.sidebar-nav::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.sidebar-nav::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/*
  ✏️ ADD YOUR CUSTOM STYLES BELOW
  ================================================================
*/
</style>
