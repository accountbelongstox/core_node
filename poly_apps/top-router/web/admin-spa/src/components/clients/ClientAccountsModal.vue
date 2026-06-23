<template>
  <div
    class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4"
    @click.self="handleClose"
  >
    <div
      class="relative flex h-[calc(100vh-2rem)] w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-gray-800"
    >
      <!-- Header -->
      <div
        class="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600"
          >
            <i class="fas fa-users text-lg text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">账户管理</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ client.name }}</p>
          </div>
        </div>
        <button
          class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          @click="handleClose"
        >
          <i class="fas fa-times text-xl" />
        </button>
      </div>

      <!-- Content - 嵌入 AccountsView 组件 -->
      <div class="min-h-0 flex-1 overflow-y-auto">
        <AccountsView :client-id="client.id" :embedded="true" />
      </div>

      <!-- Footer -->
      <div
        class="sticky bottom-0 flex shrink-0 justify-end border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          @click="handleClose"
        >
          关闭
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import AccountsView from '@/views/AccountsView.vue'

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  client: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close'])

const handleClose = () => {
  emit('close')
}
</script>
