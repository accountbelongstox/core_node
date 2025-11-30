<template>
  <div class="grid gap-3 md:grid-cols-3">
    <BasePanel v-for="stat in stats" :key="stat.label">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs uppercase text-gray-400 tracking-wide">{{ stat.label }}</p>
          <p class="text-2xl font-semibold text-gray-900 mt-1">{{ stat.value }}</p>
        </div>
        <span class="text-gray-300">{{ stat.icon }}</span>
      </div>
    </BasePanel>
  </div>
</template>

<script setup lang="ts">
import BasePanel from '@/common/components/ui/BasePanel.vue';

defineProps<{
  stats: { label: string; value: string | number; icon?: string }[];
}>();
</script>
