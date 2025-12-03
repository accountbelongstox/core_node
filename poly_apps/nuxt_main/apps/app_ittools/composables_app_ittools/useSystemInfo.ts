// System Information composable - fetches real backend data
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/api_info
import type { SystemInfoResponse } from '../types_app_ittools/api-types'

export const useSystemInfo = () => {
  const api = useApi()
  const { t } = useI18n()

  // State
  const systemInfo = useState<SystemInfoResponse | null>('system-info', () => null)
  const isLoading = useState('system-info-loading', () => false)
  const error = useState<string | null>('system-info-error', () => null)

  // Fetch system information from real backend
  const fetchSystemInfo = async () => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.get('API_INFO')

      if (response.success && response.data?.public_info?.SystemInfoService) {
        systemInfo.value = response.data.public_info.SystemInfoService
      } else {
        throw new Error(t('errors.unknownError'))
      }
    } catch (err: any) {
      error.value = err.message || t('errors.networkError')
      console.error('Failed to fetch system info:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Parse CPU usage from string
  const parseCpuUsage = computed(() => {
    if (!systemInfo.value?.system_resources?.cpu_usage) return null

    const match = systemInfo.value.system_resources.cpu_usage.match(/(\d+\.?\d*)%/)
    return match ? parseFloat(match[1]) : null
  })

  // Parse memory usage
  const parseMemoryUsage = computed(() => {
    if (!systemInfo.value?.system_resources?.memory_usage) return null

    const match = systemInfo.value.system_resources.memory_usage.match(/([\d.]+)\s+GB\s+\/\s+([\d.]+)\s+GB\s+\(([\d.]+)%\)/)
    if (match) {
      return {
        used: parseFloat(match[1]),
        total: parseFloat(match[2]),
        percentage: parseFloat(match[3])
      }
    }
    return null
  })

  // Parse disk usage
  const parseDiskUsage = computed(() => {
    if (!systemInfo.value?.system_resources?.disk_usage) return null

    const match = systemInfo.value.system_resources.disk_usage.match(/([\d.]+)\s+GB\s+\/\s+([\d.]+)\s+GB\s+\(([\d.]+)%\)/)
    if (match) {
      return {
        used: parseFloat(match[1]),
        total: parseFloat(match[2]),
        percentage: parseFloat(match[3])
      }
    }
    return null
  })

  // Parse load average
  const parseLoadAverage = computed(() => {
    if (!systemInfo.value?.system_resources?.load_average) return null

    const parts = systemInfo.value.system_resources.load_average.split(', ')
    return {
      oneMin: parseFloat(parts[0]) || 0,
      fiveMin: parseFloat(parts[1]) || 0,
      fifteenMin: parseFloat(parts[2]) || 0
    }
  })

  return {
    // State
    systemInfo: readonly(systemInfo),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Parsed computed values
    cpuUsage: parseCpuUsage,
    memoryUsage: parseMemoryUsage,
    diskUsage: parseDiskUsage,
    loadAverage: parseLoadAverage,

    // Methods
    fetchSystemInfo
  }
}
