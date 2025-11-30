<template>
  <button
    :type="type"
    :disabled="disabled || loading"
    :class="buttonClasses"
    @click="handleClick"
  >
    <span v-if="loading" class="button-spinner"></span>
    <span v-if="icon && !loading" class="button-icon" :class="{ 'icon-right': iconPosition === 'right' }">
      <slot name="icon">{{ icon }}</slot>
    </span>
    <span v-if="$slots.default" class="button-content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

type ButtonType = 'button' | 'submit' | 'reset';
type ButtonVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'ghost' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type IconPosition = 'left' | 'right';

interface Props {
  type?: ButtonType;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  rounded?: boolean;
  icon?: string;
  iconPosition?: IconPosition;
}

interface Emits {
  (e: 'click', event: MouseEvent): void;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'button',
  variant: 'default',
  size: 'md',
  disabled: false,
  loading: false,
  block: false,
  rounded: false,
  iconPosition: 'left'
});

const emit = defineEmits<Emits>();

const buttonClasses = computed(() => {
  return [
    'base-button',
    `button-${props.variant}`,
    `button-${props.size}`,
    {
      'button-block': props.block,
      'button-rounded': props.rounded,
      'button-disabled': props.disabled,
      'button-loading': props.loading,
      'button-icon-only': props.icon && !props.$slots.default
    }
  ];
});

function handleClick(event: MouseEvent) {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
}
</script>

<style scoped>
.base-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-family: inherit;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  outline: none;
  position: relative;
  user-select: none;
}

.base-button:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}

/* Size Variants */
.button-xs {
  padding: 4px 8px;
  font-size: 11px;
  border-radius: 4px;
  gap: 4px;
}

.button-sm {
  padding: 6px 12px;
  font-size: 12px;
  border-radius: 6px;
  gap: 6px;
}

.button-md {
  padding: 10px 16px;
  font-size: 14px;
  border-radius: 8px;
}

.button-lg {
  padding: 12px 20px;
  font-size: 16px;
  border-radius: 8px;
  gap: 10px;
}

.button-xl {
  padding: 14px 24px;
  font-size: 18px;
  border-radius: 10px;
  gap: 12px;
}

/* Color Variants */
.button-default {
  color: #374151;
  background: #f9fafb;
  border: 2px solid #e5e7eb;
}

.button-default:hover:not(.button-disabled) {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateY(-1px);
}

.button-default:active:not(.button-disabled) {
  transform: translateY(0);
}

.button-primary {
  color: white;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
}

.button-primary:hover:not(.button-disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.button-primary:active:not(.button-disabled) {
  transform: translateY(0);
}

.button-success {
  color: white;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border: none;
}

.button-success:hover:not(.button-disabled) {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
}

.button-warning {
  color: white;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: none;
}

.button-warning:hover:not(.button-disabled) {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
}

.button-danger {
  color: white;
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  border: none;
}

.button-danger:hover:not(.button-disabled) {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
}

.button-info {
  color: white;
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
  border: none;
}

.button-info:hover:not(.button-disabled) {
  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.button-ghost {
  color: #6b7280;
  background: transparent;
  border: none;
}

.button-ghost:hover:not(.button-disabled) {
  background: #f3f4f6;
  color: #374151;
}

.button-outline {
  background: transparent;
  border: 2px solid currentColor;
}

.button-outline:hover:not(.button-disabled) {
  background: currentColor;
  color: white;
}

/* State Modifiers */
.button-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none !important;
}

.button-loading {
  cursor: wait;
}

.button-block {
  width: 100%;
  display: flex;
}

.button-rounded {
  border-radius: 9999px;
}

.button-icon-only {
  padding: 10px;
}

.button-icon-only.button-xs {
  padding: 4px;
}

.button-icon-only.button-sm {
  padding: 6px;
}

.button-icon-only.button-md {
  padding: 10px;
}

.button-icon-only.button-lg {
  padding: 12px;
}

.button-icon-only.button-xl {
  padding: 14px;
}

/* Icon */
.button-icon {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

.button-icon.icon-right {
  order: 2;
}

.button-content {
  line-height: 1.4;
}

/* Loading Spinner */
.button-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.button-default .button-spinner {
  border-color: rgba(55, 65, 81, 0.3);
  border-top-color: #374151;
}

.button-ghost .button-spinner {
  border-color: rgba(107, 114, 128, 0.3);
  border-top-color: #6b7280;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
