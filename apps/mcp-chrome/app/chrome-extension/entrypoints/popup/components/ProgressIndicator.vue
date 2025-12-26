<template>
  <div v-if="visible" class="p-4 bg-blue-50 border border-blue-200 rounded-lg">
    <div class="flex items-center gap-3">
      <div class="w-5 h-5 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" v-if="showSpinner"></div>
      <span class="text-sm font-medium text-blue-800">{{ text }}</span>
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

