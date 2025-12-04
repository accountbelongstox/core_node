// Backend Connection Status Management
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/api_info

export const useBackendStatus = () => {
  const api = useApi()
  const { t } = useI18n()

  // Connection state
  const isConnected = useState('backend-connected', () => false)
  const isChecking = useState('backend-checking', () => false)
  const lastChecked = useState<Date | null>('backend-last-checked', () => null)
  const errorMessage = useState<string | null>('backend-error', () => null)
  const backendInfo = useState<any>('backend-info', () => null)

  // Check backend connection
  const checkConnection = async (): Promise<boolean> => {
    isChecking.value = true
    errorMessage.value = null

    try {
      const response = await api.get('API_INFO')

      if (response.success && response.data) {
        isConnected.value = true
        backendInfo.value = response.data
        lastChecked.value = new Date()
        return true
      } else {
        throw new Error(response.error || 'Connection failed')
      }
    } catch (err: any) {
      isConnected.value = false
      errorMessage.value = err.message || t('errors.connectionFailed')
      lastChecked.value = new Date()
      return false
    } finally {
      isChecking.value = false
    }
  }

  // Auto-check connection on interval
  const startHealthCheck = (intervalMs: number = 30000) => {
    // Initial check
    checkConnection()

    // Periodic check
    if (process.client) {
      const intervalId = setInterval(() => {
        checkConnection()
      }, intervalMs)

      // Cleanup on unmount
      onUnmounted(() => {
        clearInterval(intervalId)
      })

      return intervalId
    }
  }

  // Connection status text
  const statusText = computed(() => {
    if (isChecking.value) return t('common.checking')
    if (isConnected.value) return t('common.connected')
    return t('common.disconnected')
  })

  // Connection status color
  const statusColor = computed(() => {
    if (isChecking.value) return '#f59e0b' // Orange
    if (isConnected.value) return '#10b981' // Green
    return '#ef4444' // Red
  })

  // Backend version info
  const backendVersion = computed(() => {
    if (!backendInfo.value?.public_info?.SystemInfoService) return null

    const sysInfo = backendInfo.value.public_info.SystemInfoService
    return {
      php: sysInfo.core_information?.php_version,
      laravel: sysInfo.core_information?.laravel_version,
      environment: sysInfo.core_information?.environment
    }
  })

  return {
    // State
    isConnected: readonly(isConnected),
    isChecking: readonly(isChecking),
    lastChecked: readonly(lastChecked),
    errorMessage: readonly(errorMessage),
    backendInfo: readonly(backendInfo),

    // Computed
    statusText,
    statusColor,
    backendVersion,

    // Methods
    checkConnection,
    startHealthCheck
  }
}
