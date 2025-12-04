<template>
  <aside class="ittools-sidebar">
    <div class="ittools-sidebar__body">
      <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">
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
