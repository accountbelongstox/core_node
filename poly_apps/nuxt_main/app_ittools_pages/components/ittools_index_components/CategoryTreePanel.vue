<template>
  <BasePanel v-if="tree.root" class="space-y-3">
    <template #header>
      <div class="flex items-center justify-between">
        <span>{{ tree.root.name }}</span>
        <span class="text-xs text-gray-500">{{ tree.root.count }} tools</span>
      </div>
    </template>

    <div class="space-y-3">
      <div
        v-for="category in tree.children"
        :key="category.id"
        class="rounded border border-gray-100 p-3"
      >
        <button
          class="w-full flex items-center justify-between text-sm font-semibold"
          @click="$emit('toggle-category', category.id)"
        >
          <span>{{ category.name }}</span>
          <span class="text-xs text-gray-400">{{ category.count }} tools</span>
        </button>
        <div
          v-if="expandedCategories.includes(category.id)"
          class="mt-2 space-y-1"
        >
          <Button
            v-for="tool in (toolsByCategory[category.id] || [])"
            :key="tool.id"
            variant="ghost"
            class="w-full justify-start text-xs"
            @click="$emit('select-tool', tool)"
          >
            {{ tool.name }}
          </Button>
        </div>
      </div>
    </div>
  </BasePanel>
  <div v-else class="text-sm text-gray-500">No categories available.</div>
</template>

<script setup lang="ts">
import type { Tool } from '@/app_ittools_pages/types';
import BasePanel from '@/common/components/ui/BasePanel.vue';
import Button from '@/common/components/ui/BaseButton.vue';

interface CategoryInfo {
  id: string;
  name: string;
  icon: string;
  count: number;
}

const props = defineProps<{
  tree: { root?: CategoryInfo; children: CategoryInfo[] };
  rootExpanded: boolean;
  expandedCategories: string[];
  selectedCategory: string;
  toolsByCategory: Record<string, Tool[]>;
  openToolIds: string[];
  favorites: string[];
  totalTools: number;
}>();

defineEmits(['toggle-root', 'toggle-category', 'select-tool']);
</script>
