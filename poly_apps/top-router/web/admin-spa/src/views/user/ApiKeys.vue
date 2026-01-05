<template>
  <section class="space-y-6">
    <header class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">API 密钥</h1>
        <p class="text-sm text-slate-500">生成、禁用和轮换您的 API 访问密钥</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
        :disabled="loading"
        @click="createKey"
      >
        <i class="fas fa-plus" /> 新建密钥
      </button>
    </header>

    <div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div v-if="loading" class="flex items-center justify-center py-12 text-slate-500">
        <div
          class="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600"
        />
        正在加载密钥...
      </div>

      <div v-else-if="apiKeys.length === 0" class="py-12 text-center text-slate-500">
        <div class="mb-3">
          <i class="fas fa-key text-4xl text-slate-300"></i>
        </div>
        <p class="text-base font-medium text-slate-900">暂无密钥</p>
        <p class="mt-1 text-sm text-slate-500">点击右上角“新建密钥”即可立即生成</p>
      </div>

      <ul v-else class="space-y-4">
        <li
          v-for="key in apiKeys"
          :key="key.id"
          class="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <div class="flex items-center gap-3">
              <p class="text-sm font-semibold text-slate-900">{{ key.name }}</p>
              <span
                :class="[
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  key.status === 'active'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-slate-100 text-slate-600'
                ]"
              >
                {{ key.status === 'active' ? '启用' : '禁用' }}
              </span>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <code class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600">{{
                key.apiKey
              }}</code>
              <button class="text-slate-400 transition-colors hover:text-indigo-600" title="复制">
                <i class="fas fa-copy text-xs"></i>
              </button>
            </div>
            <p class="mt-1 text-xs text-slate-500">创建于 {{ formatDate(key.createdAt) }}</p>
          </div>
          <div class="flex items-center gap-3">
            <button
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
              @click="revokeKey(key.id)"
            >
              删除
            </button>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { showToast } from '@/utils/toast'

const userStore = useUserStore()
const apiKeys = ref([])
const loading = ref(false)

const loadApiKeys = async () => {
  loading.value = true
  try {
    apiKeys.value = await userStore.getUserApiKeys()
  } catch (error) {
    showToast(error.message || '加载用户密钥失败', 'error')
  } finally {
    loading.value = false
  }
}

const createKey = async () => {
  try {
    const result = await userStore.createApiKey({ name: `Key-${Date.now()}` })
    if (result.success) {
      showToast('密钥创建成功', 'success')
      await loadApiKeys()
    }
  } catch (error) {
    showToast(error.message || '创建密钥失败', 'error')
  }
}

const revokeKey = async (id) => {
  if (!confirm('确定删除该密钥？')) return
  try {
    await userStore.deleteApiKey(id)
    showToast('密钥已删除', 'success')
    apiKeys.value = apiKeys.value.filter((key) => key.id !== id)
  } catch (error) {
    showToast(error.message || '删除失败', 'error')
  }
}

const formatDate = (value) => {
  if (!value) return '--'
  return new Date(value).toLocaleString()
}

onMounted(loadApiKeys)
</script>
