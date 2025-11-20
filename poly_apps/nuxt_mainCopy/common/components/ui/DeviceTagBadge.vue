<template>
  <span
    :class="[
      'device-tag-badge',
      `tag-size-${size}`,
      { 'tag-removable': removable, 'tag-clickable': clickable }
    ]"
    :style="{ '--tag-color': color, '--tag-hover-color': hoverColor }"
    @click="handleClick"
  >
    <span class="tag-content">
      {{ label }}
    </span>
    <button
      v-if="removable"
      class="tag-remove-btn"
      @click.stop="handleRemove"
      :aria-label="`Remove ${label} tag`"
    >
      <svg class="tag-remove-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
      </svg>
    </button>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  label: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  removable?: boolean;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  color: '#3b82f6',
  size: 'sm',
  removable: false,
  clickable: false
});

const emit = defineEmits<{
  click: [];
  remove: [];
}>();

/**
 * Calculate hover color (slightly darker)
 */
const hoverColor = computed(() => {
  // Simple darkening: reduce lightness
  const hex = props.color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const factor = 0.8;
  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);

  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
});

function handleClick() {
  if (props.clickable) {
    emit('click');
  }
}

function handleRemove() {
  emit('remove');
}
</script>

<style scoped>
.device-tag-badge {
  --tag-color: #3b82f6;
  --tag-hover-color: #2563eb;

  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  border-radius: 9999px;
  white-space: nowrap;
  transition: all 0.2s ease;
  background-color: var(--tag-color);
  color: white;
  border: none;
}

/* Size variants */
.tag-size-xs {
  padding: 2px 8px;
  font-size: 10px;
  line-height: 1.4;
}

.tag-size-sm {
  padding: 3px 10px;
  font-size: 11px;
  line-height: 1.4;
}

.tag-size-md {
  padding: 4px 12px;
  font-size: 12px;
  line-height: 1.5;
}

.tag-size-lg {
  padding: 6px 14px;
  font-size: 13px;
  line-height: 1.5;
}

/* Clickable state */
.tag-clickable {
  cursor: pointer;
}

.tag-clickable:hover {
  background-color: var(--tag-hover-color);
  transform: scale(1.05);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

/* Removable state */
.tag-removable {
  padding-right: 4px;
}

.tag-content {
  user-select: none;
}

.tag-remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
  border-radius: 50%;
}

.tag-remove-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.tag-remove-icon {
  width: 12px;
  height: 12px;
}

/* Dark mode adjustments */
@media (prefers-color-scheme: dark) {
  .device-tag-badge {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
}
</style>
