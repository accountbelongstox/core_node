<template>
  <Teleport to="body">
    <Transition name="context-menu-fade">
      <div
        v-if="show"
        ref="menuRef"
        class="base-context-menu"
        :style="menuStyle"
        @click.stop
        @contextmenu.prevent
      >
        <div v-if="title" class="context-menu-title">
          <span v-if="titleIcon" class="title-icon">{{ titleIcon }}</span>
          <span class="title-text">{{ title }}</span>
        </div>

        <div class="context-menu-items">
          <div
            v-for="(item, index) in items"
            :key="index"
            class="context-menu-item"
            :class="{
              'is-divider': item.type === 'divider',
              'is-disabled': item.disabled,
              'is-danger': item.danger
            }"
            @click="handleItemClick(item)"
          >
            <template v-if="item.type === 'divider'">
              <div class="divider-line" />
            </template>
            <template v-else>
              <span v-if="item.icon" class="item-icon">{{ item.icon }}</span>
              <span class="item-label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="item-shortcut">{{ item.shortcut }}</span>
              <span v-if="item.badge" class="item-badge" :class="`badge-${item.badgeType || 'default'}`">
                {{ item.badge }}
              </span>
            </template>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Overlay to capture clicks outside menu -->
    <Transition name="overlay-fade">
      <div
        v-if="show"
        class="context-menu-overlay"
        @click="handleClose"
        @contextmenu.prevent="handleClose"
      />
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

export interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  badge?: string;
  badgeType?: 'default' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
  danger?: boolean;
  type?: 'item' | 'divider';
  action?: () => void;
}

export interface Props {
  show?: boolean;
  x?: number;
  y?: number;
  title?: string;
  titleIcon?: string;
  items: ContextMenuItem[];
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  x: 0,
  y: 0
});

const emit = defineEmits<{
  close: [];
  select: [item: ContextMenuItem];
}>();

const menuRef = ref<HTMLElement | null>(null);

const menuStyle = computed(() => {
  return {
    left: `${props.x}px`,
    top: `${props.y}px`
  };
});

function handleItemClick(item: ContextMenuItem) {
  if (item.disabled || item.type === 'divider') return;

  emit('select', item);
  if (item.action) {
    item.action();
  }
  handleClose();
}

function handleClose() {
  emit('close');
}

// Close on Escape key
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.show) {
    handleClose();
  }
}

// Adjust position if menu overflows viewport
watch(() => props.show, (newShow) => {
  if (newShow) {
    requestAnimationFrame(() => {
      if (!menuRef.value) return;

      const menu = menuRef.value;
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Adjust horizontal position
      if (rect.right > viewportWidth) {
        menu.style.left = `${viewportWidth - rect.width - 10}px`;
      }

      // Adjust vertical position
      if (rect.bottom > viewportHeight) {
        menu.style.top = `${viewportHeight - rect.height - 10}px`;
      }
    });
  }
});

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<style scoped>
.base-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 200px;
  background: linear-gradient(135deg, rgba(20, 20, 20, 0.98) 0%, rgba(30, 30, 30, 0.98) 100%);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6),
              0 2px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  padding: 4px;
  color: white;
}

.context-menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 9999;
}

.context-menu-title {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 4px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.title-icon {
  font-size: 16px;
}

.title-text {
  flex: 1;
}

.context-menu-items {
  padding: 0;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  border-radius: 4px;
  margin: 2px 0;
  transition: all 0.15s ease;
  user-select: none;
}

.context-menu-item:not(.is-divider):not(.is-disabled):hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu-item.is-disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.context-menu-item.is-danger {
  color: #ef4444;
}

.context-menu-item.is-danger:hover {
  background: rgba(239, 68, 68, 0.15);
}

.context-menu-item.is-divider {
  padding: 0;
  margin: 4px 0;
  cursor: default;
}

.divider-line {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 8px;
}

.item-icon {
  font-size: 16px;
  width: 20px;
  text-align: center;
  flex-shrink: 0;
}

.item-label {
  flex: 1;
  white-space: nowrap;
}

.item-shortcut {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
  flex-shrink: 0;
}

.item-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.item-badge.badge-default {
  background: rgba(100, 100, 100, 0.3);
  color: rgba(255, 255, 255, 0.8);
}

.item-badge.badge-success {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.item-badge.badge-warning {
  background: rgba(251, 146, 60, 0.2);
  color: #fb923c;
}

.item-badge.badge-danger {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

/* Transitions */
.context-menu-fade-enter-active,
.context-menu-fade-leave-active {
  transition: all 0.15s ease;
}

.context-menu-fade-enter-from,
.context-menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.15s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
