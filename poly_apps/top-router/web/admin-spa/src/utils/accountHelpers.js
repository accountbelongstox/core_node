export const getClaudeAccountType = (account) => {
  if (account?.subscriptionInfo) {
    try {
      const info =
        typeof account.subscriptionInfo === 'string'
          ? JSON.parse(account.subscriptionInfo)
          : account.subscriptionInfo

      if (info.hasClaudeMax === true) {
        return 'Claude Max'
      }
      if (info.hasClaudePro === true) {
        return 'Claude Pro'
      }
      return 'Claude Free'
    } catch (error) {
      return 'Claude'
    }
  }
  return 'Claude'
}

export const getClaudeAuthType = (account) => {
  if (!account?.lastRefreshAt) {
    return 'Setup'
  }
  return 'OAuth'
}

export const getGeminiAuthType = (account = {}) => {
  if (account?.platform === 'gemini-api') {
    return 'API Key'
  }
  return 'OAuth'
}

export const getOpenAIAuthType = () => 'OAuth'

export const getDroidAuthType = (account = {}) => {
  const apiKeyModeFlag =
    account.isApiKeyMode ?? account.is_api_key_mode ?? account.apiKeyMode ?? account.api_key_mode

  if (
    apiKeyModeFlag === true ||
    apiKeyModeFlag === 'true' ||
    apiKeyModeFlag === 1 ||
    apiKeyModeFlag === '1'
  ) {
    return 'API Key'
  }

  const candidate =
    account.authenticationMethod ||
    account.authMethod ||
    account.authentication_mode ||
    account.authenticationMode ||
    account.authentication_method ||
    account.auth_type ||
    account.authType ||
    account.authentication_type ||
    account.authenticationType ||
    account.droidAuthType ||
    account.droidAuthenticationMethod ||
    account.method ||
    account.auth ||
    ''

  if (typeof candidate === 'string') {
    const normalized = candidate
      .trim()
      .toLowerCase()
      .replace(/[\s_-]/g, '')
    if (normalized === 'apikey') {
      return 'API Key'
    }
  }

  return 'OAuth'
}

export const isDroidApiKeyMode = (account) => getDroidAuthType(account) === 'API Key'

export const getDroidApiKeyCount = (account = {}) => {
  if (Array.isArray(account.apiKeys)) {
    return account.apiKeys.filter((apiKey) => apiKey.status !== 'error').length
  }

  if (typeof account.apiKeys === 'string' && account.apiKeys.trim()) {
    try {
      const parsed = JSON.parse(account.apiKeys)
      if (Array.isArray(parsed)) {
        return parsed.filter((apiKey) => apiKey.status !== 'error').length
      }
    } catch (error) {
      // ignore parse errors
    }
  }

  const candidates = [
    account.apiKeyCount,
    account.api_key_count,
    account.apiKeysCount,
    account.api_keys_count,
    account.keyCount,
    account.keysCount
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && !Number.isNaN(candidate)) {
      return candidate
    }
  }

  return 0
}

export const getDroidApiKeyBadgeClasses = (account) => {
  const count = getDroidApiKeyCount(account)
  if (count === 0) {
    return 'inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600'
  }
  if (count <= 5) {
    return 'inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800'
  }
  if (count <= 10) {
    return 'inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800'
  }
  return 'inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800'
}

export const formatRateLimitTime = (minutes) => {
  if (!minutes || minutes <= 0) {
    return '0分钟'
  }

  if (minutes < 60) {
    return `${minutes}分钟`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  if (remainingMinutes === 0) {
    return `${hours}小时`
  }

  return `${hours}小时${remainingMinutes}分钟`
}

export const getSchedulableReason = (account) => {
  if (!account || account.schedulable !== false) return null

  if (account.platform === 'claude-console') {
    if (account.status === 'unauthorized') {
      return 'API Key 无效或已过期'
    }
    if (account.overloadStatus === 'overloaded') {
      return '服务过载'
    }
    if (account.rateLimitStatus === 'limited') {
      return '触发限流'
    }
    if (account.status === 'blocked' && account.errorMessage) {
      return account.errorMessage
    }
  }

  if (account.platform === 'claude') {
    if (account.status === 'unauthorized') {
      return '认证失败'
    }
    if (account.status === 'temp_error' && account.errorMessage) {
      return account.errorMessage
    }
  }

  if (account.errorMessage) {
    return account.errorMessage
  }

  return '管理员禁用调度'
}

export const formatProxyDisplay = (proxy) => {
  if (!proxy) return ''
  const normalized = typeof proxy === 'string' ? proxy : JSON.stringify(proxy)
  if (normalized.length <= 60) {
    return normalized
  }
  return `${normalized.slice(0, 60)}...`
}

export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  const number = Number(num)
  if (number >= 1000000) {
    return (number / 1000000).toFixed(2)
  }
  if (number >= 1000) {
    return (number / 1000000).toFixed(4)
  }
  return (number / 1000000).toFixed(6)
}

export const formatCost = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '0.00'
  }
  return Number(value).toFixed(2)
}
export const formatSessionWindow = (start, end) => {
  if (!start || !end) {
    return '窗口信息暂缺'
  }
  const startDate = new Date(start)
  const endDate = new Date(end)
  const startStr = startDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  const endStr = endDate.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  return `${startStr} - ${endStr}`
}

export const formatRemainingTime = (minutes) => {
  if (!minutes || minutes <= 0) {
    return '即将重置'
  }
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  if (hours === 0) {
    return `${remainingMinutes} 分钟`
  }
  if (remainingMinutes === 0) {
    return `${hours} 小时`
  }
  return `${hours} 小时 ${remainingMinutes} 分钟`
}

export const getSessionProgressBarClass = (status) => {
  switch (status) {
    case 'warning':
      return 'bg-gradient-to-r from-yellow-500 to-orange-500'
    case 'critical':
      return 'bg-gradient-to-r from-red-500 to-red-600'
    default:
      return 'bg-gradient-to-r from-blue-500 to-indigo-600'
  }
}

export const formatRate = (value) => {
  if (!value || Number.isNaN(value)) return '--'
  return `${value.toFixed(2)}`
}

export const getQuotaUsagePercent = (account = {}) => {
  if (!account.dailyQuota || Number(account.dailyQuota) <= 0) {
    return 0
  }
  const used = Number(account.usage?.daily?.cost || 0)
  const total = Number(account.dailyQuota)
  return Math.min(100, (used / total) * 100)
}

export const getQuotaBarClass = (percent) => {
  if (percent >= 90) {
    return 'bg-gradient-to-r from-red-500 to-red-600'
  }
  if (percent >= 70) {
    return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  }
  return 'bg-gradient-to-r from-green-500 to-emerald-500'
}

export const formatRemainingQuota = (account = {}) => {
  if (!account.dailyQuota || Number(account.dailyQuota) <= 0) {
    return '0.00'
  }
  const used = Number(account.usage?.daily?.cost || 0)
  const remaining = Math.max(0, Number(account.dailyQuota) - used)
  return remaining.toFixed(2)
}

export const getConsoleConcurrencyPercent = (account = {}) => {
  const max = Number(account.maxConcurrentTasks || 0)
  const active = Number(account.activeTaskCount || 0)
  if (max <= 0) return 0
  return Math.min(100, (active / max) * 100)
}

export const getConcurrencyBarClass = (percent) => {
  if (percent >= 90) {
    return 'bg-gradient-to-r from-red-500 to-red-600'
  }
  if (percent >= 70) {
    return 'bg-gradient-to-r from-yellow-500 to-orange-500'
  }
  return 'bg-gradient-to-r from-green-500 to-emerald-500'
}

export const getConcurrencyLabelClass = (account = {}) => {
  const percent = getConsoleConcurrencyPercent(account)
  if (percent >= 90) {
    return 'text-red-600'
  }
  if (percent >= 70) {
    return 'text-yellow-600'
  }
  return 'text-green-600'
}

export const calculateDailyCost = (account = {}) => {
  const cost = account.usage?.daily?.cost
  if (cost === null || cost === undefined || Number.isNaN(cost)) {
    return '0.00'
  }
  return Number(cost).toFixed(2)
}
