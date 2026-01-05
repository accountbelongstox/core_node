<template>
  <div class="flex flex-col gap-1">
    <span :class="statusClass">
      <span :class="statusDotClass" />
      {{ statusText }}
    </span>

    <span
      v-if="isRateLimited"
      class="inline-flex items-center rounded-full bg-yellow-100 px-3 py-1 text-xs font-semibold text-yellow-800"
    >
      <i class="fas fa-exclamation-triangle mr-1" />限流中
      <span v-if="rateLimitCountdown">({{ rateLimitCountdown }})</span>
    </span>

    <span
      v-if="!account.schedulable"
      class="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700"
    >
      <i class="fas fa-pause-circle mr-1" />不可调度
      <el-tooltip
        v-if="schedulableReason"
        :content="schedulableReason"
        effect="dark"
        placement="top"
      >
        <i class="fas fa-question-circle ml-1 cursor-help text-gray-500" />
      </el-tooltip>
    </span>

    <span
      v-if="account.status === 'blocked' && account.errorMessage"
      class="mt-1 max-w-xs truncate text-xs text-gray-500 dark:text-gray-400"
      :title="account.errorMessage"
    >
      {{ account.errorMessage }}
    </span>

    <span
      v-if="account.accountType === 'dedicated'"
      class="text-xs text-gray-500 dark:text-gray-400"
    >
      绑定: {{ account.boundApiKeysCount || 0 }} 个API Key
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatRateLimitTime, getSchedulableReason } from '@/utils/accountHelpers'

const props = defineProps({
  account: {
    type: Object,
    required: true
  }
})

const statusClass = computed(() => {
  const base = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold'
  const { account } = props
  if (!account) return `${base} bg-gray-100 text-gray-600`

  if (account.status === 'blocked') {
    return `${base} bg-orange-100 text-orange-800`
  }
  if (account.status === 'unauthorized') {
    return `${base} bg-red-100 text-red-800`
  }
  if (account.status === 'temp_error') {
    return `${base} bg-orange-100 text-orange-800`
  }
  if (account.isActive) {
    return `${base} bg-green-100 text-green-800`
  }
  return `${base} bg-red-100 text-red-800`
})

const statusDotClass = computed(() => {
  const base = 'mr-2 h-2 w-2 rounded-full'
  const { account } = props
  if (!account) return base

  if (account.status === 'blocked') {
    return `${base} bg-orange-500`
  }
  if (account.status === 'unauthorized') {
    return `${base} bg-red-500`
  }
  if (account.status === 'temp_error') {
    return `${base} bg-orange-500`
  }
  if (account.isActive) {
    return `${base} bg-green-500`
  }
  return `${base} bg-red-500`
})

const statusText = computed(() => {
  const { account } = props
  if (!account) return '未知'
  if (account.status === 'blocked') return '已封锁'
  if (account.status === 'unauthorized') return '异常'
  if (account.status === 'temp_error') return '临时异常'
  return account.isActive ? '正常' : '异常'
})

const isRateLimited = computed(() => {
  const status = props.account?.rateLimitStatus
  if (!status) return false
  if (typeof status === 'object') {
    return status.isRateLimited
  }
  return status === 'limited'
})

const rateLimitCountdown = computed(() => {
  const status = props.account?.rateLimitStatus
  if (typeof status === 'object' && status.minutesRemaining > 0) {
    return formatRateLimitTime(status.minutesRemaining)
  }
  return ''
})

const schedulableReason = computed(() => getSchedulableReason(props.account))
</script>
