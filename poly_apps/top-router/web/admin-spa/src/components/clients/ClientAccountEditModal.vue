<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="handleClose"
  >
    <div
      class="relative w-full max-w-2xl rounded-xl bg-white shadow-2xl dark:bg-gray-800"
      @click.stop
    >
      <!-- Header -->
      <div
        class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
      >
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600"
          >
            <i class="fas fa-edit text-white" />
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">编辑账户</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">{{ account.name }}</p>
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
      <div class="max-h-[calc(100vh-200px)] overflow-y-auto p-6">
        <form class="space-y-6" @submit.prevent="handleSubmit">
          <!-- 基本信息 -->
          <div class="space-y-4">
            <h4
              class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              <i class="fas fa-info-circle text-blue-500" />
              基本信息
            </h4>

            <!-- 账户名称 -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                账户名称
                <span class="text-red-500">*</span>
              </label>
              <input
                v-model="form.name"
                class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="请输入账户名称"
                required
                type="text"
              />
            </div>

            <!-- 账户描述 -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                账户描述
              </label>
              <textarea
                v-model="form.description"
                class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="请输入账户描述（可选）"
                rows="3"
              />
            </div>

            <!-- 账户状态 -->
            <div
              class="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-700"
            >
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  启用状态
                </label>
                <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  禁用后该账户将不会被使用
                </p>
              </div>
              <button
                :class="[
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  form.enabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-600'
                ]"
                type="button"
                @click="form.enabled = !form.enabled"
              >
                <span
                  :class="[
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    form.enabled ? 'translate-x-6' : 'translate-x-1'
                  ]"
                />
              </button>
            </div>
          </div>

          <!-- Gemini 特定字段 -->
          <div v-if="account.platform === 'gemini'" class="space-y-4">
            <h4
              class="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300"
            >
              <i class="fas fa-gem text-purple-500" />
              Gemini 配置
            </h4>

            <!-- Project ID -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                项目 ID (Project ID)
              </label>
              <input
                v-model="form.projectId"
                class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                placeholder="例如: verdant-wares-464411-k9"
                type="text"
              />
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                部分 Google Cloud/Workspace 的 Gemini API 需要提供项目 ID
              </p>
            </div>

            <!-- Location -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                区域 (Location)
              </label>
              <select
                v-model="form.location"
                class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="us-central1">us-central1</option>
                <option value="us-east1">us-east1</option>
                <option value="us-west1">us-west1</option>
                <option value="europe-west1">europe-west1</option>
                <option value="asia-east1">asia-east1</option>
              </select>
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                调度优先级 (1-100)，数值越低优先级越高
              </p>
            </div>

            <!-- 优先级 -->
            <div>
              <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                调度优先级
              </label>
              <input
                v-model.number="form.priority"
                class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                max="100"
                min="1"
                placeholder="50"
                type="number"
              />
              <p class="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                数字越小优先级越高，建议范围: 1-100
              </p>
            </div>
          </div>

          <!-- Token 更新提示 -->
          <div
            v-if="account.platform === 'gemini' || account.platform === 'claude-official'"
            class="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800/50 dark:bg-yellow-900/20"
          >
            <div class="flex gap-3">
              <i class="fas fa-info-circle mt-0.5 text-yellow-600 dark:text-yellow-500" />
              <div class="flex-1">
                <h5 class="font-medium text-yellow-800 dark:text-yellow-400">更新 Token</h5>
                <p class="mt-1 text-sm text-yellow-700 dark:text-yellow-500">
                  可以更新 Access Token 和 Refresh Token，为了安全起见，不会显示当前的 Token 值。
                </p>
                <p class="mt-1 text-xs text-yellow-600 dark:text-yellow-600">
                  留空表示不更新当前 Token
                </p>
              </div>
            </div>

            <div class="mt-4 space-y-3">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  新的 Access Token
                </label>
                <input
                  v-model="form.accessToken"
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="留空表示不更新..."
                  type="password"
                />
              </div>

              <div>
                <label class="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  新的 Refresh Token
                </label>
                <input
                  v-model="form.refreshToken"
                  class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                  placeholder="留空表示不更新..."
                  type="password"
                />
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
        <button
          class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          :disabled="loading"
          type="button"
          @click="handleClose"
        >
          取消
        </button>
        <button
          class="flex items-center gap-2 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:from-blue-600 hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="loading"
          type="button"
          @click="handleSubmit"
        >
          <i v-if="loading" class="fas fa-spinner fa-spin" />
          <i v-else class="fas fa-save" />
          {{ loading ? '保存中...' : '保存更改' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { showToast } from '@/utils/toast'

const props = defineProps({
  account: {
    type: Object,
    required: true
  },
  clientId: {
    type: String,
    required: true
  },
  updateFunction: {
    type: Function,
    required: true
  }
})

const emit = defineEmits(['close', 'success'])

const loading = ref(false)

const computeEnabledState = (account) => {
  if (!account) return true
  if (account.enabled !== undefined) {
    return account.enabled !== false
  }
  const isActive = account.isActive !== false && account.isActive !== 'false'
  const schedulable = account.schedulable !== false && account.schedulable !== 'false'
  return isActive && schedulable
}

const form = reactive({
  name: props.account.name || '',
  description: props.account.description || '',
  enabled: computeEnabledState(props.account),
  projectId: props.account.projectId || '',
  location: props.account.location || 'us-central1',
  priority: props.account.priority ?? 50,
  accessToken: '',
  refreshToken: ''
})

const handleSubmit = async () => {
  if (!form.name.trim()) {
    showToast('请输入账户名称', 'error')
    return
  }

  loading.value = true
  try {
    const updates = {
      name: form.name.trim(),
      description: form.description.trim(),
      enabled: form.enabled
    }

    // Gemini 特定字段
    if (props.account.platform === 'gemini') {
      updates.projectId = form.projectId.trim()
      updates.location = form.location
      updates.priority = form.priority
    }

    // Token 更新（仅当提供了新值时）
    if (form.accessToken.trim()) {
      updates.accessToken = form.accessToken.trim()
    }
    if (form.refreshToken.trim()) {
      updates.refreshToken = form.refreshToken.trim()
    }

    await props.updateFunction(props.account.id, updates)
    emit('success')
  } catch (error) {
    console.error('Failed to update account:', error)
    showToast(error.message || '更新失败', 'error')
  } finally {
    loading.value = false
  }
}

const handleClose = () => {
  if (!loading.value) {
    emit('close')
  }
}
</script>
