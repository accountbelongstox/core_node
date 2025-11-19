<template>
  <Teleport to="body">
    <Transition name="panel-fade">
      <div v-if="modelValue" class="base-panel-overlay" @click="handleOverlayClick">
        <Transition name="panel-slide">
          <div
            v-if="modelValue"
            class="base-panel"
            :class="[
              `panel-${size}`,
              `panel-${variant}`,
              { 'panel-no-header': !showHeader }
            ]"
            :style="panelStyle"
            @click.stop
          >
            <!-- Header -->
            <div v-if="showHeader" class="panel-header" :style="headerStyle">
              <div class="panel-header-content">
                <slot name="header-icon">
                  <div v-if="headerIcon" class="panel-header-icon">{{ headerIcon }}</div>
                </slot>
                <h3 class="panel-title">
                  <slot name="title">{{ title }}</slot>
                </h3>
              </div>
              <button
                v-if="closable"
                class="panel-close-btn"
                @click="handleClose"
                :title="closeText"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="panel-body" :style="bodyStyle">
              <slot />
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="panel-footer" :style="footerStyle">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';

type PanelSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';
type PanelVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

interface Props {
  modelValue: boolean;
  title?: string;
  headerIcon?: string;
  size?: PanelSize;
  variant?: PanelVariant;
  closable?: boolean;
  closeText?: string;
  closeOnOverlay?: boolean;
  showHeader?: boolean;
  customHeaderColor?: string;
  customWidth?: string;
  customHeight?: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'close'): void;
  (e: 'opened'): void;
  (e: 'closed'): void;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  variant: 'default',
  closable: true,
  closeText: 'Close',
  closeOnOverlay: true,
  showHeader: true
});

const emit = defineEmits<Emits>();

const panelStyle = computed(() => {
  const styles: Record<string, string> = {};
  if (props.customWidth) styles.width = props.customWidth;
  if (props.customHeight) styles.height = props.customHeight;
  return styles;
});

const headerStyle = computed(() => {
  const styles: Record<string, string> = {};
  if (props.customHeaderColor) {
    styles.background = props.customHeaderColor;
  }
  return styles;
});

const bodyStyle = computed(() => ({}));
const footerStyle = computed(() => ({}));

function handleClose() {
  emit('update:modelValue', false);
  emit('close');
}

function handleOverlayClick() {
  if (props.closeOnOverlay) {
    handleClose();
  }
}

watch(() => props.modelValue, (newVal, oldVal) => {
  if (newVal && !oldVal) {
    emit('opened');
    document.body.style.overflow = 'hidden';
  } else if (!newVal && oldVal) {
    emit('closed');
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
.base-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.base-panel {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  max-height: 90vh;
}

/* Size Variants */
.panel-sm {
  width: 360px;
  max-width: 90vw;
}

.panel-md {
  width: 480px;
  max-width: 90vw;
}

.panel-lg {
  width: 640px;
  max-width: 90vw;
}

.panel-xl {
  width: 800px;
  max-width: 90vw;
}

.panel-full {
  width: 95vw;
  height: 95vh;
  max-height: 95vh;
}

/* Header */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: white;
  flex-shrink: 0;
}

.panel-header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.panel-header-icon {
  font-size: 20px;
  line-height: 1;
}

.panel-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
}

.panel-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  color: white;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.panel-close-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Body */
.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.panel-body::-webkit-scrollbar {
  width: 8px;
}

.panel-body::-webkit-scrollbar-track {
  background: #f3f4f6;
  border-radius: 4px;
}

.panel-body::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 4px;
}

.panel-body::-webkit-scrollbar-thumb:hover {
  background: #9ca3af;
}

/* Footer */
.panel-footer {
  flex-shrink: 0;
  padding: 16px 20px;
  background: #f9fafb;
  border-top: 1px solid #e5e7eb;
}

/* Variant Styles */
.panel-primary .panel-header {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

.panel-success .panel-header {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.panel-warning .panel-header {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
}

.panel-danger .panel-header {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
}

.panel-info .panel-header {
  background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
}

/* No Header */
.panel-no-header {
  padding-top: 20px;
}

/* Transitions */
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.3s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.3s ease;
}

.panel-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.panel-slide-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.95);
}
</style>
