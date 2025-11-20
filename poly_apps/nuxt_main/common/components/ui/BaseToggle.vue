<template>
  <div class="base-toggle" :class="{ 'toggle-disabled': disabled }">
    <label class="toggle-wrapper">
      <input
        type="checkbox"
        :checked="modelValue"
        :disabled="disabled"
        class="toggle-input"
        @change="handleChange"
      />
      <div
        class="toggle-switch"
        :class="[
          `toggle-${size}`,
          `toggle-${variant}`,
          { 'toggle-checked': modelValue }
        ]"
      >
        <div class="toggle-thumb">
          <span v-if="showIcons" class="toggle-icon">
            <slot name="icon-on" v-if="modelValue">✓</slot>
            <slot name="icon-off" v-else>✕</slot>
          </span>
        </div>
      </div>
      <div v-if="label || $slots.default" class="toggle-label-content">
        <div class="toggle-label">
          <slot name="label">
            <span v-if="labelIcon" class="label-icon">{{ labelIcon }}</span>
            <span class="label-text">{{ label }}</span>
          </slot>
        </div>
        <div v-if="description || $slots.description" class="toggle-description">
          <slot name="description">{{ description }}</slot>
        </div>
      </div>
    </label>
  </div>
</template>

<script setup lang="ts">
type ToggleSize = 'sm' | 'md' | 'lg';
type ToggleVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  modelValue: boolean;
  label?: string;
  labelIcon?: string;
  description?: string;
  disabled?: boolean;
  size?: ToggleSize;
  variant?: ToggleVariant;
  showIcons?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'change', value: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'md',
  variant: 'default',
  showIcons: false
});

const emit = defineEmits<Emits>();

function handleChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = target.checked;
  emit('update:modelValue', value);
  emit('change', value);
}
</script>

<style scoped>
.base-toggle {
  display: inline-block;
}

.toggle-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.toggle-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  user-select: none;
}

.toggle-input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  flex-shrink: 0;
  border-radius: 9999px;
  transition: all 0.3s ease;
  background: #d1d5db;
}

.toggle-switch:hover {
  background: #9ca3af;
}

/* Size Variants */
.toggle-sm {
  width: 36px;
  height: 20px;
}

.toggle-md {
  width: 44px;
  height: 24px;
}

.toggle-lg {
  width: 52px;
  height: 28px;
}

/* Toggle Thumb */
.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toggle-sm .toggle-thumb {
  width: 16px;
  height: 16px;
}

.toggle-md .toggle-thumb {
  width: 20px;
  height: 20px;
}

.toggle-lg .toggle-thumb {
  width: 24px;
  height: 24px;
}

/* Checked State */
.toggle-checked {
  background: #3b82f6;
}

.toggle-checked:hover {
  background: #2563eb;
}

.toggle-sm.toggle-checked .toggle-thumb {
  transform: translateX(16px);
}

.toggle-md.toggle-checked .toggle-thumb {
  transform: translateX(20px);
}

.toggle-lg.toggle-checked .toggle-thumb {
  transform: translateX(24px);
}

/* Color Variants */
.toggle-primary.toggle-checked {
  background: #3b82f6;
}

.toggle-primary.toggle-checked:hover {
  background: #2563eb;
}

.toggle-success.toggle-checked {
  background: #10b981;
}

.toggle-success.toggle-checked:hover {
  background: #059669;
}

.toggle-warning.toggle-checked {
  background: #f59e0b;
}

.toggle-warning.toggle-checked:hover {
  background: #d97706;
}

.toggle-danger.toggle-checked {
  background: #ef4444;
}

.toggle-danger.toggle-checked:hover {
  background: #dc2626;
}

.toggle-info.toggle-checked {
  background: #06b6d4;
}

.toggle-info.toggle-checked:hover {
  background: #0891b2;
}

/* Icon */
.toggle-icon {
  font-size: 10px;
  color: #6b7280;
  font-weight: 700;
}

.toggle-checked .toggle-icon {
  color: #3b82f6;
}

/* Label Content */
.toggle-label-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #374151;
}

.label-icon {
  font-size: 18px;
  line-height: 1;
}

.label-text {
  line-height: 1.4;
}

.toggle-description {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}

/* Focus State */
.toggle-input:focus-visible + .toggle-switch {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
