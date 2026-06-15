<template>
  <div v-if="visible" class="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-md">
    <div class="flex items-center gap-2">
      <div class="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" v-if="showSpinner"></div>
      <span class="text-[10px] font-medium text-indigo-300">{{ text }}</span>
    </div>
  </div>
</template>

<script lang="ts" setup>
interface Props {
  visible?: boolean;
  text: string;
  showSpinner?: boolean;
}

withDefaults(defineProps<Props>(), {
  visible: true,
  showSpinner: true,
});
</script>

