<template>
  <header class="pm-topbar">
    <div class="pm-topbar__left">
      <div class="pm-topbar__logo">
        <span class="pm-topbar__logo-icon">📱</span>
        <h1 class="pm-topbar__logo-title">pyMatrix</h1>
      </div>
    </div>

    <div class="pm-topbar__center">
      <div class="pm-topbar__status">
        <span class="pm-topbar__status-dot" :class="{ active: deviceCount > 0 }"></span>
        <span>{{ deviceCount }} Device{{ deviceCount !== 1 ? 's' : '' }}</span>
      </div>

      <div v-if="groupEnabled" class="pm-topbar__status pm-topbar__status--group">
        <span>👥</span>
        <span>Group Control Active</span>
      </div>
    </div>

    <div class="pm-topbar__right">
      <button class="pm-topbar__action-btn pm-topbar__action-btn--primary" @click="$emit('connect-device')">
        <span>+</span>
        <span>Connect Device</span>
      </button>

      <button
        class="pm-topbar__action-btn"
        :class="{ 'pm-topbar__action-btn--active': groupEnabled }"
        @click="$emit('toggle-group')"
        :title="groupEnabled ? 'Disable Group Control' : 'Enable Group Control'"
      >
        <span>👥</span>
        <span>{{ groupEnabled ? 'Group ON' : 'Group OFF' }}</span>
      </button>

      <button class="pm-topbar__action-btn" @click="$emit('open-settings')">
        <span>⚙️</span>
        <span>Settings</span>
      </button>

      <button class="pm-topbar__action-btn" @click="$emit('show-history')" title="Connection history (Ctrl+H)">
        <span>📜</span>
        <span>History</span>
      </button>

      <button class="pm-topbar__action-btn" @click="$emit('show-help')" title="Show keyboard shortcuts (Press /)">
        <span>⌨️</span>
        <span>Shortcuts</span>
      </button>

      <div class="pm-topbar__user">
        <div class="pm-topbar__user-avatar">👤</div>
        <span class="pm-topbar__user-name">User</span>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
interface Props {
  deviceCount: number;
  groupEnabled: boolean;
}

interface Emits {
  (e: 'connect-device'): void;
  (e: 'toggle-group'): void;
  (e: 'open-settings'): void;
  (e: 'show-help'): void;
  (e: 'show-history'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
</script>

<style scoped>
/* TopBar Styles with NFTMax Theme */
.pm-topbar {
  position: sticky;
  top: 0;
  z-index: 5000;
  background: var(--pm-bg-purple-lighter);
  backdrop-filter: blur(4px);
  border-bottom: 1px solid var(--pm-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-lg);
  height: 100px;
  padding: 0 var(--pm-space-lg);
  transition: var(--pm-transition-fast);
}

/* Left Section - Logo */
.pm-topbar__left {
  display: flex;
  align-items: center;
  gap: var(--pm-space-md);
}

.pm-topbar__logo {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  padding: 8px 16px;
  border-radius: var(--pm-radius-md);
  transition: var(--pm-transition-fast);
}

.pm-topbar__logo:hover {
  background: rgba(83, 86, 251, 0.1);
}

.pm-topbar__logo-icon {
  font-size: 32px;
  animation: pm-fadeIn 0.5s ease;
}

.pm-topbar__logo-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
  background: var(--pm-gradient-primary);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

/* Center Section - Status */
.pm-topbar__center {
  display: flex;
  align-items: center;
  gap: var(--pm-space-lg);
  flex: 1;
  justify-content: center;
}

.pm-topbar__status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  background: #ffffff;
  border-radius: var(--pm-radius-full);
  font-size: var(--pm-font-size-base);
  font-weight: 500;
  color: var(--pm-text-primary);
  box-shadow: var(--pm-shadow-sm);
  transition: var(--pm-transition-fast);
}

.pm-topbar__status:hover {
  box-shadow: var(--pm-shadow-md);
  transform: translateY(-2px);
}

.pm-topbar__status-dot {
  width: 10px;
  height: 10px;
  border-radius: var(--pm-radius-circle);
  background: var(--pm-text-muted);
  transition: var(--pm-transition-fast);
}

.pm-topbar__status-dot.active {
  background: var(--pm-success);
  box-shadow: 0 0 12px rgba(39, 174, 96, 0.5);
  animation: pm-pulse 2s ease-in-out infinite;
}

@keyframes pm-pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.pm-topbar__status--group {
  background: var(--pm-gradient-primary);
  color: #ffffff;
}

/* Right Section - Actions */
.pm-topbar__right {
  display: flex;
  align-items: center;
  gap: var(--pm-space-md);
}

.pm-topbar__action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  font-size: var(--pm-font-size-sm);
  font-weight: 500;
  color: var(--pm-text-primary);
  background: #ffffff;
  border: 1px solid var(--pm-border);
  border-radius: var(--pm-radius-full);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  outline: none;
  white-space: nowrap;
}

.pm-topbar__action-btn:hover {
  border-color: var(--pm-primary);
  color: var(--pm-primary);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.2);
}

.pm-topbar__action-btn--primary {
  background: var(--pm-primary);
  color: #ffffff;
  border-color: var(--pm-primary);
  font-weight: 600;
}

.pm-topbar__action-btn--primary:hover {
  background: var(--pm-secondary);
  border-color: var(--pm-secondary);
  box-shadow: 0 4px 16px rgba(243, 57, 248, 0.4);
}

.pm-topbar__action-btn--active {
  background: var(--pm-gradient-primary);
  color: #ffffff;
  border-color: transparent;
}

.pm-topbar__action-btn--active:hover {
  background: var(--pm-gradient-primary-reverse);
  transform: translateY(-2px) scale(1.02);
}

/* User Section */
.pm-topbar__user {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #ffffff;
  border-radius: var(--pm-radius-full);
  cursor: pointer;
  transition: var(--pm-transition-fast);
  border: 1px solid var(--pm-border);
}

.pm-topbar__user:hover {
  border-color: var(--pm-primary);
  box-shadow: 0 4px 12px rgba(83, 86, 251, 0.2);
  transform: translateY(-2px);
}

.pm-topbar__user-avatar {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--pm-bg-light);
  border-radius: var(--pm-radius-circle);
  font-size: 20px;
  transition: var(--pm-transition-fast);
}

.pm-topbar__user:hover .pm-topbar__user-avatar {
  background: var(--pm-primary);
  color: #ffffff;
  transform: scale(1.1);
}

.pm-topbar__user-name {
  font-size: var(--pm-font-size-base);
  font-weight: 500;
  color: var(--pm-text-primary);
}

/* Responsive */
@media (max-width: 1278px) {
  .pm-topbar {
    height: 70px;
    padding: 0 var(--pm-space-md);
  }

  .pm-topbar__action-btn span:last-child {
    display: none;
  }

  .pm-topbar__action-btn {
    width: 44px;
    height: 44px;
    padding: 0;
    font-size: 20px;
  }

  .pm-topbar__logo-title {
    font-size: 22px;
  }
}

@media (max-width: 767px) {
  .pm-topbar__center {
    display: none;
  }

  .pm-topbar__user-name {
    display: none;
  }
}
</style>
