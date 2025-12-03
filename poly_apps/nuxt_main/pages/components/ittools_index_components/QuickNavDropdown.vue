<template>
  <div class="mb-4">
    <button
      @click="$emit('toggle')"
      class="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg border border-blue-100 text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
    >
      <span class="flex items-center space-x-2">
        <i class="fas fa-compass"></i>
        <span>Quick Jump</span>
      </span>
      <i :class="['fas', open ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
    </button>
    <Transition name="fade">
      <div
        v-if="open"
        class="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-100 max-h-72 overflow-y-auto"
      >
        <div
          v-for="category in categories"
          :key="category.id"
          class="mb-2 last:mb-0"
        >
          <button
            @click="$emit('toggle-section', category.id)"
            class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-blue-800 hover:bg-white transition"
          >
            <span class="flex items-center space-x-2">
              <i :class="category.icon"></i>
              <span>{{ category.name }}</span>
            </span>
            <i :class="['fas', expanded.includes(category.id) ? 'fa-chevron-up' : 'fa-chevron-down']"></i>
          </button>
          <Transition name="expand">
            <div
              v-if="expanded.includes(category.id)"
              class="mt-2 pl-3 space-y-1"
            >
              <button
                v-for="tool in (toolsByCategory[category.id] || [])"
                :key="`${category.id}-${tool.id}`"
                @click="$emit('jump-to-tool', tool)"
                class="w-full text-left text-xs px-3 py-1.5 rounded-lg text-blue-700 bg-white hover:bg-blue-100"
              >
                {{ tool.name }}
              </button>
            </div>
          </Transition>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '@/app_ittools_pages/types';

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
}

defineProps<{
  categories: CategoryInfo[];
  open: boolean;
  expanded: string[];
  toolsByCategory: Record<string, Tool[]>;
}>();

defineEmits(['toggle', 'toggle-section', 'jump-to-tool']);
</script>
