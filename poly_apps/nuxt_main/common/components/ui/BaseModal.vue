<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="modelValue"
        class="base-modal-overlay"
        :class="{ 'overlay-stacked': isStacked }"
        :style="{ zIndex: zIndex }"
        @click="handleOverlayClick"
        @keydown.esc="handleEscapeKey"
      >
        <Transition :name="transitionName">
          <div
            v-if="modelValue"
            ref="modalRef"
            class="base-modal"
            :class="[
              `modal-${size}`,
              `modal-${variant}`,
              {
                'modal-no-header': !showHeader,
                'modal-fullscreen': fullscreen,
                'modal-centered': centered
              }
            ]"
            :style="modalStyle"
            role="dialog"
            :aria-modal="true"
            :aria-labelledby="titleId"
            @click.stop
          >
            <!-- Header -->
            <div v-if="showHeader" class="modal-header" :style="headerStyle">
              <div class="modal-header-content">
                <slot name="header-icon">
                  <div v-if="headerIcon" class="modal-header-icon">{{ headerIcon }}</div>
                </slot>
                <h3 :id="titleId" class="modal-title">
                  <slot name="title">{{ title }}</slot>
                </h3>
              </div>
              <button
                v-if="closable"
                class="modal-close-btn"
                @click="handleClose"
                :title="closeText"
                :aria-label="closeText"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
              </button>
            </div>

            <!-- Body -->
            <div class="modal-body" :style="bodyStyle">
              <slot />
            </div>

            <!-- Footer -->
            <div v-if="$slots.footer" class="modal-footer" :style="footerStyle">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';

type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
type ModalVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
type TransitionType = 'fade' | 'slide' | 'zoom' | 'bounce';

interface Props {
  modelValue: boolean;
  title?: string;
  headerIcon?: string;
  size?: ModalSize;
  variant?: ModalVariant;
  closable?: boolean;
  closeText?: string;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  showHeader?: boolean;
  customHeaderColor?: string;
  customWidth?: string;
  customHeight?: string;
  fullscreen?: boolean;
  centered?: boolean;
  zIndex?: number;
  transition?: TransitionType;
  trapFocus?: boolean;
  preventScroll?: boolean;
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
  closeOnEscape: true,
  showHeader: true,
  centered: true,
  zIndex: 1000,
  transition: 'zoom',
  trapFocus: true,
  preventScroll: true
});

const emit = defineEmits<Emits>();

const modalRef = ref<HTMLElement | null>(null);
const previousActiveElement = ref<HTMLElement | null>(null);
const titleId = `modal-title-${Math.random().toString(36).substr(2, 9)}`;

// Track if this modal is part of a stack
const isStacked = computed(() => {
  // Check if there are other modals with lower z-index
  return props.zIndex > 1000;
});

const transitionName = computed(() => {
  switch (props.transition) {
    case 'fade': return 'modal-fade';
    case 'slide': return 'modal-slide';
    case 'zoom': return 'modal-zoom';
    case 'bounce': return 'modal-bounce';
    default: return 'modal-zoom';
  }
});

const modalStyle = computed(() => {
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

function handleEscapeKey(event: KeyboardEvent) {
  if (props.closeOnEscape) {
    event.preventDefault();
    handleClose();
  }
}

// Focus trap functionality
function trapFocusInModal() {
  if (!props.trapFocus || !modalRef.value) return;

  const focusableElements = modalRef.value.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  function handleTabKey(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    }
  }

  modalRef.value.addEventListener('keydown', handleTabKey);

  // Focus first element
  nextTick(() => {
    firstElement?.focus();
  });

  return () => {
    modalRef.value?.removeEventListener('keydown', handleTabKey);
  };
}

watch(() => props.modelValue, async (newVal, oldVal) => {
  if (newVal && !oldVal) {
    // Opening
    previousActiveElement.value = document.activeElement as HTMLElement;
    emit('opened');

    if (props.preventScroll) {
      document.body.style.overflow = 'hidden';
    }

    await nextTick();
    const cleanup = trapFocusInModal();

    // Store cleanup function for later
    if (cleanup) {
      onUnmounted(cleanup);
    }
  } else if (!newVal && oldVal) {
    // Closing
    emit('closed');

    if (props.preventScroll) {
      document.body.style.overflow = '';
    }

    // Restore focus to previous element
    if (previousActiveElement.value) {
      previousActiveElement.value.focus();
    }
  }
});

// Clean up on unmount
onUnmounted(() => {
  if (props.modelValue && props.preventScroll) {
    document.body.style.overflow = '';
  }
});
</script>

<style scoped>
/* Overlay */
.base-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(2px);
  padding: 1rem;
}

.overlay-stacked {
  background: rgba(0, 0, 0, 0.3);
}

/* Modal Container */
.base-modal {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  max-width: 90vw;
  max-height: 90vh;
  overflow: hidden;
}

.modal-centered {
  margin: auto;
}

.modal-fullscreen {
  width: 100vw !important;
  height: 100vh !important;
  max-width: 100vw;
  max-height: 100vh;
  border-radius: 0;
}

/* Sizes */
.modal-xs {
  width: 320px;
}

.modal-sm {
  width: 400px;
}

.modal-md {
  width: 600px;
}

.modal-lg {
  width: 800px;
}

.modal-xl {
  width: 1000px;
}

.modal-full {
  width: 95vw;
  height: 95vh;
}

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.modal-header-content {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.modal-header-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.modal-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #111827;
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: none;
  background: transparent;
  color: #6b7280;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: #f3f4f6;
  color: #111827;
}

/* Body */
.modal-body {
  flex: 1;
  padding: 1.25rem;
  overflow-y: auto;
  color: #374151;
}

/* Footer */
.modal-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e7eb;
  background: #f9fafb;
}

/* Variants */
.modal-primary .modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.modal-primary .modal-title {
  color: white;
}

.modal-primary .modal-close-btn {
  color: white;
}

.modal-primary .modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-success .modal-header {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.modal-success .modal-title {
  color: white;
}

.modal-success .modal-close-btn {
  color: white;
}

.modal-success .modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-warning .modal-header {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.modal-warning .modal-title {
  color: white;
}

.modal-warning .modal-close-btn {
  color: white;
}

.modal-warning .modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-danger .modal-header {
  background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.modal-danger .modal-title {
  color: white;
}

.modal-danger .modal-close-btn {
  color: white;
}

.modal-danger .modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-info .modal-header {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  border-bottom-color: rgba(255, 255, 255, 0.2);
}

.modal-info .modal-title {
  color: white;
}

.modal-info .modal-close-btn {
  color: white;
}

.modal-info .modal-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* Transitions */
.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.25s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

.modal-zoom-enter-active,
.modal-zoom-leave-active {
  transition: all 0.3s ease;
}

.modal-zoom-enter-from,
.modal-zoom-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.modal-slide-enter-active,
.modal-slide-leave-active {
  transition: all 0.3s ease;
}

.modal-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.modal-slide-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.modal-bounce-enter-active {
  animation: modal-bounce-in 0.5s;
}

.modal-bounce-leave-active {
  animation: modal-bounce-out 0.3s;
}

@keyframes modal-bounce-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
  70% {
    transform: scale(0.9);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes modal-bounce-out {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.05);
  }
  100% {
    opacity: 0;
    transform: scale(0.5);
  }
}

/* Responsive */
@media (max-width: 768px) {
  .modal-xs,
  .modal-sm,
  .modal-md,
  .modal-lg,
  .modal-xl {
    width: 95vw;
  }

  .base-modal {
    max-height: 85vh;
  }
}

/* Scrollbar styling */
.modal-body::-webkit-scrollbar {
  width: 8px;
}

.modal-body::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.modal-body::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
