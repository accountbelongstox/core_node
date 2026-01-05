<template>
  <div class="space-y-2">
    <div
      class="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200"
    >
      <label>
        {{ label }}
        <span v-if="required" class="ml-1 text-red-500">*</span>
      </label>
      <span v-if="hint" class="text-xs font-normal text-slate-400 dark:text-slate-500">
        {{ hint }}
      </span>
    </div>
    <div>
      <slot />
    </div>
    <p v-if="description" class="text-xs text-slate-500 dark:text-slate-400">{{ description }}</p>
    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
  </div>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    required: true
  },
  required: {
    type: Boolean,
    default: false
  },
  hint: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    default: ''
  },
  error: {
    type: String,
    default: ''
  }
})
</script>
