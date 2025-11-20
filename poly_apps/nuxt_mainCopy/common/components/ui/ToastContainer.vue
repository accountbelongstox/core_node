<template>
  <Teleport to="body">
    <div class="toast-container" :class="`toast-position-${position}`">
      <TransitionGroup name="toast-list">
        <BaseToast
          v-for="toast in toasts"
          :key="toast.id"
          :type="toast.type"
          :title="toast.title"
          :message="toast.message"
          :duration="toast.duration"
          :dismissible="toast.dismissible"
          :icon="toast.icon"
          @close="handleClose(toast.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useToastStore } from '~/apps/app_pymatrix/stores_app_pymatrix/toastStore';
import BaseToast from './BaseToast.vue';

export interface Props {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const props = withDefaults(defineProps<Props>(), {
  position: 'top-right'
});

const toastStore = useToastStore();

const toasts = computed(() => toastStore.toasts);

function handleClose(id: string) {
  toastStore.removeToast(id);
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  z-index: 9999;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.toast-container > * {
  pointer-events: auto;
}

/* Position Variants */
.toast-position-top-right {
  top: 20px;
  right: 20px;
  align-items: flex-end;
}

.toast-position-top-left {
  top: 20px;
  left: 20px;
  align-items: flex-start;
}

.toast-position-bottom-right {
  bottom: 20px;
  right: 20px;
  align-items: flex-end;
  flex-direction: column-reverse;
}

.toast-position-bottom-left {
  bottom: 20px;
  left: 20px;
  align-items: flex-start;
  flex-direction: column-reverse;
}

.toast-position-top-center {
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
}

.toast-position-bottom-center {
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  align-items: center;
  flex-direction: column-reverse;
}

/* List Transition */
.toast-list-move {
  transition: transform 0.3s ease;
}
</style>
