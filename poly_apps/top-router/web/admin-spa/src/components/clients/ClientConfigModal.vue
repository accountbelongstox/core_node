<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
    @click.self="handleClose"
  >
    <div
      class="relative w-full max-w-3xl rounded-lg bg-white shadow-2xl dark:bg-gray-800 md:max-h-[90vh] md:overflow-hidden"
    >
      <!-- Header -->
      <div
        class="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600"
          >
            <i class="fas fa-cog text-lg text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">配置 Client</h3>
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

      <!-- Content -->
      <div class="max-h-[calc(90vh-140px)] overflow-y-auto p-6">
        <form class="space-y-6" @submit.prevent="saveConfig">
          <!-- 连接配置 -->
          <section class="space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-500 to-green-600"
              >
                <i class="fas fa-plug text-sm text-white" />
              </div>
              <h4 class="text-base font-semibold text-gray-900 dark:text-white">连接配置</h4>
            </div>
            <div
              class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  心跳间隔 (秒)
                </label>
                <input
                  v-model.number="config.heartbeatInterval"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="10"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  建议值：30-60秒，过小会增加网络开销
                </p>
              </div>
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  重连延迟 (毫秒)
                </label>
                <input
                  v-model.number="config.reconnectDelay"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="100"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">建议值：1000-5000毫秒</p>
              </div>
            </div>
          </section>

          <!-- 代理配置 -->
          <section class="space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600"
              >
                <i class="fas fa-network-wired text-sm text-white" />
              </div>
              <h4 class="text-base font-semibold text-gray-900 dark:text-white">代理配置</h4>
            </div>
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <ProxyConfig v-model="config.proxy" />
            </div>
          </section>

          <!-- 性能配置 -->
          <section class="space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600"
              >
                <i class="fas fa-tachometer-alt text-sm text-white" />
              </div>
              <h4 class="text-base font-semibold text-gray-900 dark:text-white">性能配置</h4>
            </div>
            <div
              class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  最大并发数
                </label>
                <input
                  v-model.number="config.maxConcurrency"
                  class="form-input w-full border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                  min="1"
                  type="number"
                />
                <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  同时处理的最大请求数，建议值：5-20
                </p>
              </div>
            </div>
          </section>
          <!-- 变更说明 -->
          <section class="space-y-4">
            <div class="flex items-center gap-3">
              <div
                class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-600"
              >
                <i class="fas fa-shield-alt text-sm text-white" />
              </div>
              <h4 class="text-base font-semibold text-gray-900 dark:text-white">安全说明</h4>
            </div>
            <div
              class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900"
            >
              <label class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                变更摘要
              </label>
              <textarea
                v-model="changeSummary"
                class="form-textarea w-full border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
                maxlength="200"
                placeholder="记录此次配置调整的原因，便于历史追踪"
                rows="3"
              ></textarea>
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">选填，最多200字符</p>
            </div>
          </section>
        </form>
      </div>

      <!-- Footer -->
      <div
        class="sticky bottom-0 flex flex-col gap-3 border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-800 sm:flex-row sm:justify-end"
      >
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          type="button"
          @click="handleClose"
        >
          <i class="fas fa-times mr-2" />
          取消
        </button>
        <button
          class="rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-blue-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="saving"
          type="button"
          @click="saveConfig"
        >
          <i v-if="!saving" class="fas fa-save mr-2" />
          <i v-else class="fas fa-spinner fa-spin mr-2" />
          {{ saving ? '保存中...' : '保存并应用' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import ProxyConfig from '@/components/accounts/ProxyConfig.vue'
import { apiClient } from '@/config/api'

const props = defineProps({
  client: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['close', 'saved'])

const saving = ref(false)
const changeSummary = ref('')
const config = reactive({
  heartbeatInterval: 30,
  reconnectDelay: 1000,
  proxy: {
    enabled: false,
    type: 'socks5',
    host: '',
    port: '',
    auth: {
      enabled: false,
      username: '',
      password: ''
    }
  },
  maxConcurrency: 10
})

// 加载当前配置
onMounted(async () => {
  try {
    const response = await apiClient.get(`/admin/clients/${props.client.id}/config`)
    if (response.success && response.data.appliedConfig) {
      Object.assign(config, response.data.appliedConfig)
    }
  } catch (error) {
    console.error('Failed to load config:', error)
  }
})

const saveConfig = async () => {
  saving.value = true
  try {
    const payload = {
      config: config,
      applyImmediately: true
    }
    const trimmedSummary = changeSummary.value.trim()
    if (trimmedSummary) {
      payload.summary = trimmedSummary
    }

    const response = await apiClient.post(`/admin/clients/${props.client.id}/config`, payload)

    if (response.success) {
      changeSummary.value = ''
      emit('saved', response.data)
      emit('close')
    }
  } catch (error) {
    console.error('Failed to save config:', error)
    alert(`配置保存失败: ${error.message || '未知错误'}`)
  } finally {
    saving.value = false
  }
}

const handleClose = () => {
  if (!saving.value) {
    emit('close')
  }
}
</script>
