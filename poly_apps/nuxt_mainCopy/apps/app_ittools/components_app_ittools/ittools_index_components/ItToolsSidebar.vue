<template>
  <aside class="w-64 bg-white border-r border-gray-200 overflow-y-auto">
    <div class="p-4">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        {{ sidebarTitle }}
      </h3>
      <slot name="quick-nav"></slot>
      <slot></slot>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineProps<{ sidebarTitle: string }>();
</script>
