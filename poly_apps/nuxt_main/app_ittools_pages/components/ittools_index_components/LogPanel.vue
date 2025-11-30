<template>
  <div class="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:w-1/3 z-50">
    <div
      class="bg-white/95 backdrop-blur border border-gray-200 rounded-2xl shadow-2xl overflow-hidden"
      :style="panelStyle"
    >
      <div class="flex items-center justify-between px-4 py-2 bg-gray-900 text-white">
        <div class="flex items-center space-x-2 text-sm font-semibold">
          <i class="fas fa-terminal"></i>
          <span>Activity Log</span>
        </div>
        <button
          @click="$emit('toggle')"
          class="text-white/80 hover:text-white"
        >
          <i :class="['fas', open ? 'fa-chevron-down' : 'fa-chevron-up']"></i>
        </button>
      </div>
      <div v-show="open" class="max-h-[calc(30vh-48px)] overflow-y-auto bg-white divide-y divide-gray-100">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ open: boolean }>();
const panelStyle = computed(() => ({
  maxHeight: props.open ? '30vh' : '48px'
}));
</script>
