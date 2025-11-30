<template>
  <div class="grid gap-4 lg:grid-cols-12">
    <div class="lg:col-span-8">
      <label class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Search Tools</label>
      <div class="relative mt-2">
        <input
          :value="modelValue"
          @input="$emit('update:modelValue', $event.target.value)"
          @focus="$emit('focus')"
          @blur="$emit('blur')"
          type="text"
          class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Search by tool name, category, or keyword..."
        >
        <button
          v-if="modelValue"
          @mousedown.prevent="$emit('clear')"
          class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <i class="fas fa-times"></i>
        </button>
        <Transition name="fade">
          <div
            v-if="showResults && searchResults.length"
            class="absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-20"
          >
            <button
              v-for="tool in searchResults"
              :key="`search-${tool.id}`"
              @mousedown.prevent="$emit('select-result', tool)"
              class="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 flex items-center justify-between"
            >
              <span class="font-medium text-gray-800">{{ tool.name }}</span>
              <span class="text-xs text-gray-500">{{ tool.category }}</span>
            </button>
          </div>
        </Transition>
      </div>
      <div
        v-if="lastUsedTool && (!activeTool || activeTool.id !== lastUsedTool.id)"
        class="mt-3 flex items-center space-x-2 text-xs text-gray-500"
      >
        <span>Last used:</span>
        <button
          @click="$emit('open-last')"
          class="px-3 py-1.5 rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
        >
          {{ lastUsedTool.name }}
        </button>
      </div>
    </div>
    <div class="lg:col-span-4">
      <div class="bg-white border border-gray-200 rounded-2xl p-4 h-full">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-sm font-semibold text-gray-800">Recent Tools</h3>
          <span class="text-xs text-gray-400">Last 10</span>
        </div>
        <div v-if="recentTools.length" class="flex flex-wrap gap-2">
          <button
            v-for="tool in recentTools"
            :key="`recent-${tool.id}`"
            @click="$emit('select-recent', tool)"
            class="px-3 py-1.5 rounded-full border border-gray-200 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition"
          >
            {{ tool.name }}
          </button>
        </div>
        <div v-else class="text-xs text-gray-400">
          Recently opened tools will appear here.
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Tool } from '@/app_ittools_pages/types';

const props = defineProps<{
  modelValue: string;
  searchResults: Tool[];
  showResults: boolean;
  recentTools: Tool[];
  lastUsedTool: Tool | null;
  activeTool: Tool | null;
}>();

defineEmits(['update:modelValue', 'focus', 'blur', 'clear', 'select-result', 'select-recent', 'open-last']);
</script>
