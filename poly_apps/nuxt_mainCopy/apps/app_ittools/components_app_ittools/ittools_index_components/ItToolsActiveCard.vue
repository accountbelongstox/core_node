<template>
  <div v-if="tool" class="bg-white border border-gray-200 rounded-2xl shadow-sm p-6">
    <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
      <div>
        <p class="text-xs font-semibold text-blue-500 uppercase tracking-widest mb-2">Active Utility</p>
        <div class="flex items-center space-x-3">
          <div class="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center text-xl">
            <i class="fas fa-hashtag"></i>
          </div>
          <div>
            <h2 class="text-2xl font-bold text-gray-900">{{ tool.name }}</h2>
            <p class="text-sm text-gray-600 mt-1 max-w-2xl">{{ tool.description }}</p>
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <span class="px-3 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-100">
          {{ categoryLabel }}
        </span>
        <span class="px-3 py-1 text-xs font-semibold rounded-full bg-gray-50 text-gray-700 border border-gray-200">
          Endpoint: {{ tool.endpoint }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '@/apps/app_ittools/types_app_ittools';

const props = defineProps<{ tool: Tool | null; categoryLabel: string }>();
</script>
