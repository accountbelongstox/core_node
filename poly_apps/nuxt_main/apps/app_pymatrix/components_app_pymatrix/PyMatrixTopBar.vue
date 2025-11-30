<template>
  <header class="pm-topbar pm-aurora-panel">
    <div class="pm-topbar__left">
      <div class="pm-topbar__logo pm-glow-ring">
        <span class="pm-topbar__logo-icon">📱</span>
        <h1 class="pm-topbar__logo-title">pyMatrix</h1>
      </div>
    </div>

    <div class="pm-topbar__center pm-floating">
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

      <button
        class="pm-topbar__action-btn"
        :title="themeMode === 'light' ? 'Switch to dark mode' : 'Switch to light mode'"
        @click="$emit('toggle-theme')"
      >
        <span>{{ themeMode === 'light' ? '🌞' : '🌙' }}</span>
        <span>{{ themeMode === 'light' ? 'Light' : 'Dark' }}</span>
      </button>

      <div class="pm-topbar__user pm-glow-ring">
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
  themeMode?: 'dark' | 'light';
}

interface Emits {
  (e: 'connect-device'): void;
  (e: 'toggle-group'): void;
  (e: 'open-settings'): void;
  (e: 'show-help'): void;
  (e: 'show-history'): void;
  (e: 'toggle-theme'): void;
}

const props = withDefaults(defineProps<Props>(), {
  themeMode: 'dark'
});
const emit = defineEmits<Emits>();
</script>

<style scoped>
.pm-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--pm-space-xl);
  min-height: 86px;
  padding: var(--pm-space-md) var(--pm-space-xl);
  background: var(--pm-color-surface-raised);
  border: 1px solid var(--pm-color-border-soft);
  border-radius: var(--pm-radius-xl);
  box-shadow: var(--pm-shadow-sm);
  backdrop-filter: var(--pm-backdrop);
  position: sticky;
  top: 0;
  z-index: 120;
  overflow: hidden;
}

.pm-topbar::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  border: 1px solid rgba(124, 92, 255, 0.18);
  pointer-events: none;
}

.pm-topbar__left {
  display: flex;
  align-items: center;
  gap: var(--pm-space-md);
}

.pm-topbar__logo {
  display: inline-flex;
  align-items: center;
  gap: var(--pm-space-sm);
  padding: var(--pm-space-sm) var(--pm-space-lg);
  border-radius: var(--pm-radius-pill);
  background: rgba(12, 20, 40, 0.85);
  border: 1px solid rgba(124, 92, 255, 0.35);
  color: var(--pm-text-strong);
  font-weight: 700;
  letter-spacing: 0.4px;
  transition: var(--pm-transition-fast);
  cursor: pointer;
}

.pm-topbar__logo:hover {
  background: rgba(124, 92, 255, 0.2);
  border-color: var(--pm-color-border);
  transform: translateY(-1px);
}

.pm-topbar__logo-icon {
  font-size: 28px;
}

.pm-topbar__logo-title {
  margin: 0;
  font-size: var(--pm-font-size-lg);
  color: var(--pm-text-strong);
}

.pm-topbar__center {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--pm-space-lg);
  flex: 1;
}

.pm-topbar__status {
  display: inline-flex;
  align-items: center;
  gap: var(--pm-space-sm);
  padding: var(--pm-space-sm) var(--pm-space-lg);
  border-radius: var(--pm-radius-pill);
  border: 1px solid rgba(148, 163, 184, 0.18);
  background: rgba(12, 18, 40, 0.45);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  color: var(--pm-text-default);
  transition: var(--pm-transition-fast);
  box-shadow: var(--pm-shadow-xs);
  position: relative;
  overflow: hidden;
}

.pm-topbar__status:hover {
  border-color: var(--pm-color-border);
  background: rgba(12, 18, 40, 0.95);
}

.pm-topbar__status::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(120deg, rgba(124, 92, 255, 0.25), transparent 60%);
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.pm-topbar__status:hover::after {
  opacity: 1;
}

.pm-topbar__status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pm-text-low);
  position: relative;
  overflow: hidden;
}

.pm-topbar__status-dot.active {
  background: var(--pm-color-success);
  box-shadow: 0 0 12px rgba(45, 212, 191, 0.65);
  animation: pm-glow 3s linear infinite;
}

.pm-topbar__status--group {
  background: rgba(124, 92, 255, 0.22);
  border-color: rgba(124, 92, 255, 0.35);
  color: var(--pm-text-strong);
}

.pm-topbar__right {
  display: flex;
  align-items: center;
  gap: var(--pm-space-sm);
}

.pm-topbar__action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--pm-space-xs);
  padding: var(--pm-space-sm) var(--pm-space-lg);
  border-radius: var(--pm-radius-pill);
  background: rgba(16, 21, 44, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.16);
  color: var(--pm-text-muted);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  transition: var(--pm-transition-fast);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.pm-topbar__action-btn span:first-child {
  font-size: var(--pm-font-size-md);
}

.pm-topbar__action-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(124, 92, 255, 0.35), rgba(236, 72, 153, 0.35));
  opacity: 0;
  transition: var(--pm-transition-fast);
}

.pm-topbar__action-btn:hover {
  background: rgba(16, 21, 44, 0.85);
  color: var(--pm-text-default);
  border-color: var(--pm-color-border);
  transform: translateY(-1px);
}

.pm-topbar__action-btn:hover::after {
  opacity: 1;
}

.pm-topbar__action-btn--primary {
  background: var(--pm-gradient-main);
  color: var(--pm-text-strong);
  border-color: transparent;
  box-shadow: 0 8px 26px rgba(124, 92, 255, 0.32);
  isolation: isolate;
}

.pm-topbar__action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 34px rgba(124, 92, 255, 0.4);
}

.pm-topbar__action-btn--active {
  background: rgba(124, 92, 255, 0.22);
  color: var(--pm-text-strong);
  border-color: rgba(124, 92, 255, 0.4);
}

.pm-topbar__user {
  display: inline-flex;
  align-items: center;
  gap: var(--pm-space-sm);
  padding: var(--pm-space-sm) var(--pm-space-md);
  border-radius: var(--pm-radius-pill);
  background: rgba(12, 18, 40, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: var(--pm-text-default);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
}

.pm-topbar__user-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: var(--pm-gradient-main);
  display: grid;
  place-items: center;
  color: var(--pm-text-strong);
  font-size: var(--pm-font-size-md);
}

.pm-topbar__user-name {
  color: inherit;
}

@media (max-width: 1100px) {
  .pm-topbar {
    flex-wrap: wrap;
    gap: var(--pm-space-md);
  }

  .pm-topbar__center {
    order: 3;
    width: 100%;
  }

  .pm-topbar__right {
    flex-wrap: wrap;
    justify-content: flex-end;
    width: 100%;
  }

  .pm-topbar__action-btn span:last-child {
    display: none;
  }
}

@media (max-width: 768px) {
  .pm-topbar {
    padding: var(--pm-space-sm) var(--pm-space-md);
  }

  .pm-topbar__center {
    display: none;
  }

  .pm-topbar__right {
    justify-content: space-between;
  }
}
</style>
