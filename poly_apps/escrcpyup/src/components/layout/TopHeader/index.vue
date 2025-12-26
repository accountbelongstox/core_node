<template>
  <!--
    ================================================================
    TOP HEADER - Application Title Bar
    ================================================================
    This is the top header bar of the application.

    ✏️ FULLY CUSTOMIZABLE by another AI - Fill with:
    - Logo and branding
    - Application title
    - Global search
    - User menu/avatar
    - Notifications
    - Settings access
    - Sidebar toggle buttons

    ⚠️ DO NOT MODIFY:
    - Props interface (leftCollapsed, rightCollapsed)
    - Events interface (toggle-left, toggle-right)
    - These must remain for wrapper layout integration
    ================================================================
  -->
  <div class="top-header">
    <!--
      ✏️ LEFT SECTION
      ================================================================
      TO BE FILLED: Logo, app name, sidebar toggle
      ================================================================
    -->
    <div class="header-left">
      <!-- Left Sidebar Toggle -->
      <button
        class="header-btn"
        :title="leftCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
        @click="$emit('toggle-left')"
      >
        <span v-if="leftCollapsed">☰</span>
        <span v-else>✕</span>
      </button>

      <!-- Logo & App Name -->
      <div class="header-logo">
        <!-- TODO: Replace with your logo -->
        <div class="logo-icon">
          <span class="text-2xl">📱</span>
        </div>
        <div class="logo-text">
          <span class="app-name">Escrcpy Extended</span>
          <span class="app-version">v2.0.0</span>
        </div>
      </div>
    </div>

    <!--
      ✏️ CENTER SECTION
      ================================================================
      TO BE FILLED: Search bar, navigation tabs, status info
      ================================================================
    -->
    <div class="header-center">
      <!-- TODO: Add global search or navigation here -->
      <div class="search-bar">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          class="search-input"
          placeholder="Search devices, scripts, files..."
        >
      </div>
    </div>

    <!--
      ✏️ RIGHT SECTION
      ================================================================
      TO BE FILLED: Actions, notifications, user menu, right sidebar toggle
      ================================================================
    -->
    <div class="header-right">
      <!-- TODO: Add notification bell, settings, user avatar -->

      <!-- Notification Button -->
      <button class="header-btn" title="Notifications">
        <span class="notification-icon">🔔</span>
        <span class="notification-badge">3</span>
      </button>

      <!-- Settings Button -->
      <button class="header-btn" title="Settings">
        <span>⚙️</span>
      </button>

      <!-- User Avatar -->
      <button class="header-btn user-avatar" title="User Profile">
        <span>👤</span>
      </button>

      <!-- Divider -->
      <div class="header-divider"></div>

      <!-- Right Sidebar (Original UI) Toggle -->
      <button
        class="header-btn"
        :class="{ active: !rightCollapsed }"
        :title="rightCollapsed ? 'Show Control Panel' : 'Hide Control Panel'"
        @click="$emit('toggle-right')"
      >
        <span>🎛️</span>
        <span class="toggle-label">Tools</span>
      </button>
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
  leftCollapsed: {
    type: Boolean,
    default: false,
  },
  rightCollapsed: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['toggle-left', 'toggle-right'])

/*
  ================================================================
  ✏️ YOUR CUSTOM LOGIC GOES HERE
  ================================================================
  Add:
  - Search functionality
  - Notification handling
  - User menu dropdown
  - Theme switching
  - Keyboard shortcuts
  - Connection status display

  You can access stores:
  import { useThemeStore } from '@/store/theme'
  import { useDeviceStore } from '@/store/device'
  ================================================================
*/

// TODO: Add your custom logic here
// Example:
// import { useThemeStore } from '@/store/theme'
// const themeStore = useThemeStore()
// const isDark = computed(() => themeStore.isDark)
</script>

<style scoped>
/*
  ================================================================
  TOP HEADER STYLES
  ================================================================
  ✏️ FULLY CUSTOMIZABLE - Modify colors, spacing, effects
  ================================================================
*/

.top-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 1.5rem;
  background: linear-gradient(135deg, rgba(17, 24, 39, 0.98), rgba(31, 41, 55, 0.95));
  backdrop-filter: blur(12px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  color: #e5e7eb;
}

/* LEFT SECTION */
.header-left {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

.header-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
}

.logo-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.app-name {
  font-size: 1.125rem;
  font-weight: 700;
  white-space: nowrap;
}

.app-version {
  font-size: 0.75rem;
  color: #9ca3af;
}

/* CENTER SECTION */
.header-center {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 2;
  max-width: 600px;
}

.search-bar {
  position: relative;
  width: 100%;
  max-width: 400px;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1rem;
  pointer-events: none;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem 0.5rem 2.5rem;
  background-color: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  color: #e5e7eb;
  font-size: 0.875rem;
  outline: none;
  transition: all 0.2s ease;
}

.search-input::placeholder {
  color: #9ca3af;
}

.search-input:focus {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
}

/* RIGHT SECTION */
.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  justify-content: flex-end;
}

.header-divider {
  width: 1px;
  height: 24px;
  background-color: rgba(255, 255, 255, 0.2);
  margin: 0 0.5rem;
}

/* HEADER BUTTONS */
.header-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #e5e7eb;
  font-size: 1.125rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background-color: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.header-btn.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.3), rgba(118, 75, 162, 0.3));
  border-color: #667eea;
}

.toggle-label {
  font-size: 0.875rem;
  font-weight: 600;
}

/* Notification Badge */
.notification-icon {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #ef4444;
  border-radius: 9px;
  font-size: 0.65rem;
  font-weight: 700;
  padding: 0 4px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

/* User Avatar */
.user-avatar {
  width: 36px;
  height: 36px;
  padding: 0;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.user-avatar:hover {
  transform: translateY(-1px);
  border-color: rgba(255, 255, 255, 0.4);
}

/* Responsive Design */
@media (max-width: 768px) {
  .header-left,
  .header-right {
    flex: 0;
  }

  .header-center {
    flex: 1;
  }

  .app-version,
  .toggle-label {
    display: none;
  }

  .search-bar {
    max-width: 200px;
  }
}

/*
  ✏️ ADD YOUR CUSTOM STYLES BELOW
  ================================================================
  Feel free to add:
  - Dropdown menus
  - Tooltips
  - Animations
  - Glassmorphism effects
  - Theme variants
  ================================================================
*/
</style>
