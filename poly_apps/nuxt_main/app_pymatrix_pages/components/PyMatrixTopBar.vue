<template>
  <header class="pm-topbar pm-aurora-panel">
    <div class="pm-topbar__left">
      <div class="pm-topbar__logo pm-glow-ring" aria-label="星灿传媒云矩阵">
        <span class="pm-topbar__logo-icon" aria-hidden="true">🌌</span>
        <h1 class="pm-topbar__logo-title">
          星灿传媒云矩阵
          <span class="pm-topbar__logo-reg" aria-hidden="true">®</span>
        </h1>
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
  --pm-topbar-chip-bg: rgba(12, 18, 40, 0.45);
  --pm-topbar-chip-border: rgba(148, 163, 184, 0.3);
  --pm-topbar-chip-hover: rgba(18, 26, 60, 0.92);
  --pm-topbar-logo-bg: rgba(12, 20, 40, 0.85);
  --pm-topbar-logo-border: rgba(124, 92, 255, 0.35);
  --pm-topbar-btn-bg: linear-gradient(145deg, rgba(16, 21, 44, 0.75), rgba(44, 36, 78, 0.72));
  --pm-topbar-btn-border: rgba(148, 163, 184, 0.28);
  --pm-topbar-btn-color: var(--pm-text-default);
  --pm-topbar-btn-hover-bg: linear-gradient(145deg, rgba(28, 35, 74, 0.95), rgba(88, 65, 124, 0.85));
  --pm-topbar-btn-hover-color: var(--pm-text-strong);
  --pm-topbar-btn-hover-border: rgba(124, 92, 255, 0.55);
  --pm-topbar-btn-active-bg: rgba(124, 92, 255, 0.16);
  --pm-topbar-btn-active-border: rgba(124, 92, 255, 0.45);
  --pm-topbar-btn-primary: linear-gradient(135deg, #5b5fe2 0%, #7c5cff 55%, #a855f7 100%);
  --pm-topbar-btn-primary-hover: linear-gradient(135deg, #6f6eea 0%, #8f7dff 60%, #c084fc 100%);
  --pm-topbar-btn-primary-shadow: 0 10px 30px rgba(124, 92, 255, 0.35);
  --pm-topbar-btn-primary-shadow-hover: 0 16px 38px rgba(124, 92, 255, 0.45);
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
  gap: var(--pm-space-md);
  padding: var(--pm-space-sm) var(--pm-space-lg);
  border-radius: var(--pm-radius-pill);
  background: var(--pm-topbar-logo-bg);
  border: 1px solid var(--pm-topbar-logo-border);
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
  font-size: 30px;
  filter: drop-shadow(0 0 6px rgba(124, 92, 255, 0.5));
}

.pm-topbar__logo-title {
  margin: 0;
  font-size: var(--pm-font-size-lg);
  color: var(--pm-text-strong);
  display: inline-flex;
  align-items: baseline;
  gap: var(--pm-space-2xs);
  letter-spacing: 0.12em;
}

.pm-topbar__logo-reg {
  font-size: 0.55em;
  color: var(--pm-text-muted);
  vertical-align: top;
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
  border: 1px solid var(--pm-topbar-chip-border);
  background: var(--pm-topbar-chip-bg);
  font-size: var(--pm-font-size-sm);
  font-weight: 600;
  color: var(--pm-text-default);
  transition: var(--pm-transition-fast);
  box-shadow: var(--pm-shadow-xs);
  position: relative;
  overflow: hidden;
}

.pm-topbar__status:hover {
  border-color: var(--pm-topbar-btn-hover-border);
  background: var(--pm-topbar-chip-hover);
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
  background: var(--pm-topbar-btn-bg);
  border: 1px solid var(--pm-topbar-btn-border);
  color: var(--pm-topbar-btn-color);
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
  background: var(--pm-topbar-btn-hover-bg);
  color: var(--pm-topbar-btn-hover-color);
  border-color: var(--pm-topbar-btn-hover-border);
  transform: translateY(-1px);
}

.pm-topbar__action-btn:hover::after {
  opacity: 1;
}

.pm-topbar__action-btn--primary {
  background: var(--pm-topbar-btn-primary);
  color: var(--pm-text-strong);
  border-color: transparent;
  box-shadow: var(--pm-topbar-btn-primary-shadow);
  isolation: isolate;
}

.pm-topbar__action-btn--primary:hover {
  transform: translateY(-1px);
  background: var(--pm-topbar-btn-primary-hover);
  box-shadow: var(--pm-topbar-btn-primary-shadow-hover);
}

.pm-topbar__action-btn--active {
  background: var(--pm-topbar-btn-active-bg);
  color: var(--pm-topbar-btn-hover-color);
  border-color: var(--pm-topbar-btn-active-border);
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

:global([data-pm-theme='light'] .pm-topbar) {
  --pm-topbar-chip-bg: rgba(255, 255, 255, 0.9);
  --pm-topbar-chip-border: rgba(15, 23, 42, 0.1);
  --pm-topbar-chip-hover: rgba(255, 255, 255, 1);
  --pm-topbar-logo-bg: rgba(255, 255, 255, 0.95);
  --pm-topbar-logo-border: rgba(93, 53, 246, 0.25);
  --pm-topbar-btn-bg: linear-gradient(145deg, rgba(255, 255, 255, 0.98), rgba(238, 241, 255, 0.85));
  --pm-topbar-btn-border: rgba(93, 53, 246, 0.2);
  --pm-topbar-btn-color: var(--pm-text-default);
  --pm-topbar-btn-hover-bg: linear-gradient(145deg, rgba(255, 255, 255, 1), rgba(227, 232, 255, 0.95));
  --pm-topbar-btn-hover-color: var(--pm-text-strong);
  --pm-topbar-btn-hover-border: rgba(91, 191, 146, 0.45);
  --pm-topbar-btn-active-bg: rgba(93, 53, 246, 0.14);
  --pm-topbar-btn-active-border: rgba(93, 53, 246, 0.45);
  --pm-topbar-btn-primary: linear-gradient(135deg, #7c3aed 0%, #9d5bff 55%, #c084fc 100%);
  --pm-topbar-btn-primary-hover: linear-gradient(135deg, #8b5cf6 0%, #b277ff 65%, #d8b4fe 100%);
  --pm-topbar-btn-primary-shadow: 0 12px 28px rgba(93, 53, 246, 0.25);
  --pm-topbar-btn-primary-shadow-hover: 0 16px 34px rgba(93, 53, 246, 0.35);
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
