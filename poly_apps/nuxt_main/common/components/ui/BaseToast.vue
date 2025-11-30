<template>
  <Transition name="toast-slide">
    <div
      v-if="show"
      class="base-toast"
      :class="[`toast-${type}`, { 'toast-dismissible': dismissible }]"
      @mouseenter="pauseTimer"
      @mouseleave="resumeTimer"
    >
      <div class="toast-content">
        <div v-if="icon" class="toast-icon">{{ icon }}</div>
        <div class="toast-body">
          <div v-if="title" class="toast-title">{{ title }}</div>
          <div class="toast-message">{{ message }}</div>
        </div>
      </div>
      <button
        v-if="dismissible"
        class="toast-close"
        @click="handleClose"
        aria-label="Close"
      >
        ×
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

export interface Props {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
  icon?: string;
  show?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
  dismissible: true,
  show: true
});

const emit = defineEmits<{
  close: [];
}>();

let timerId: ReturnType<typeof setTimeout> | null = null;
let remainingTime = ref(props.duration);
let pausedAt = ref<number | null>(null);

function startTimer() {
  if (props.duration && props.duration > 0) {
    timerId = setTimeout(() => {
      handleClose();
    }, remainingTime.value);
  }
}

function pauseTimer() {
  if (timerId && !pausedAt.value) {
    clearTimeout(timerId);
    pausedAt.value = Date.now();
  }
}

function resumeTimer() {
  if (pausedAt.value) {
    const elapsed = Date.now() - pausedAt.value;
    remainingTime.value = Math.max(0, remainingTime.value - elapsed);
    pausedAt.value = null;
    startTimer();
  }
}

function handleClose() {
  if (timerId) {
    clearTimeout(timerId);
  }
  emit('close');
}

onMounted(() => {
  startTimer();
});

onUnmounted(() => {
  if (timerId) {
    clearTimeout(timerId);
  }
});
</script>

<style scoped>
.base-toast {
  display: flex;
  align-items: flex-start;
  min-width: 300px;
  max-width: 500px;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 12px;
  transition: all 0.3s ease;
}

.base-toast:hover {
  transform: translateX(-4px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
}

.toast-content {
  display: flex;
  align-items: flex-start;
  flex: 1;
  gap: 12px;
}

.toast-icon {
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
}

.toast-body {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  color: white;
}

.toast-message {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.9);
  word-wrap: break-word;
}

.toast-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  margin-left: 12px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.toast-close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

/* Toast Type Variants */
.toast-success {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(34, 197, 94, 0.7) 100%);
  border-color: rgba(34, 197, 94, 0.3);
}

.toast-error {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.7) 100%);
  border-color: rgba(239, 68, 68, 0.3);
}

.toast-warning {
  background: linear-gradient(135deg, rgba(251, 146, 60, 0.9) 0%, rgba(251, 146, 60, 0.7) 100%);
  border-color: rgba(251, 146, 60, 0.3);
}

.toast-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(59, 130, 246, 0.7) 100%);
  border-color: rgba(59, 130, 246, 0.3);
}

/* Animations */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}

.toast-slide-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-slide-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.8);
}
</style>
