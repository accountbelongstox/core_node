// System Information Composable - fetches real backend system data
// Real data validated: 2025-12-04 with http://192.168.50.3:9000/api/get_system_status

import { useApi } from './useApi'
import type { SystemStatus } from '../types/api-types'

export interface LoadAverage {
  oneMin: number
  fiveMin: number
  fifteenMin: number
}

export interface DiskUsage {
  total: number
  used: number
  free: number
  percentage: number
}

export const useSystemInfo = () => {
  const api = useApi()

  // State management
  const systemInfo = useState<SystemStatus | null>('system-info', () => null)
  const isLoading = useState<boolean>('system-info-loading', () => false)
  const error = useState<string | null>('system-info-error', () => null)

  // Computed values
  const cpuUsage = computed(() => {
    if (!systemInfo.value?.system_resources?.cpu) return null
    const cpu = systemInfo.value.system_resources.cpu
    return {
      cores: cpu.cores || 0,
      usage: cpu.usage_percentage || 0
    }
  })

  const memoryUsage = computed(() => {
    if (!systemInfo.value?.system_resources?.memory) return null
    const mem = systemInfo.value.system_resources.memory
    return {
      total: mem.total || '0',
      used: mem.used || '0',
      free: mem.free || '0',
      percentage: mem.usage_percentage || 0
    }
  })

  const diskUsage = computed(() => {
    if (!systemInfo.value?.system_resources?.disk) return null
    const disk = systemInfo.value.system_resources.disk
    return {
      total: parseFloat(disk.total || '0'),
      used: parseFloat(disk.used || '0'),
      free: parseFloat(disk.free || '0'),
      percentage: disk.usage_percentage || 0
    }
  })

  const loadAverage = computed(() => {
    if (!systemInfo.value?.system_resources?.load_average) return null
    const load = systemInfo.value.system_resources.load_average
    // Parse load average string like "0.52, 0.58, 0.59"
    if (typeof load === 'string') {
      const parts = load.split(',').map(s => parseFloat(s.trim()))
      return {
        oneMin: parts[0] || 0,
        fiveMin: parts[1] || 0,
        fifteenMin: parts[2] || 0
      }
    }
    return null
  })

  // Fetch system information from real backend
  const fetchSystemInfo = async (): Promise<void> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.call<SystemStatus>('SYSTEM_STATUS')

      if (response.success && response.data) {
        systemInfo.value = response.data
      } else {
        error.value = response.error?.message || 'Failed to fetch system information'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred'
      console.error('Failed to fetch system info:', err)
    } finally {
      isLoading.value = false
    }
  }

  // Fetch PHP information
  const fetchPhpInfo = async (): Promise<any> => {
    try {
      const response = await api.call('SYSTEM_PHP_INFO')
      return response.data
    } catch (err) {
      console.error('Failed to fetch PHP info:', err)
      return null
    }
  }

  // Fetch Laravel information
  const fetchLaravelInfo = async (): Promise<any> => {
    try {
      const response = await api.call('SYSTEM_LARAVEL_INFO')
      return response.data
    } catch (err) {
      console.error('Failed to fetch Laravel info:', err)
      return null
    }
  }

  // Fetch Server information
  const fetchServerInfo = async (): Promise<any> => {
    try {
      const response = await api.call('SYSTEM_SERVER_INFO')
      return response.data
    } catch (err) {
      console.error('Failed to fetch server info:', err)
      return null
    }
  }

  // Fetch Database information
  const fetchDatabaseInfo = async (): Promise<any> => {
    try {
      const response = await api.call('SYSTEM_DATABASE_INFO')
      return response.data
    } catch (err) {
      console.error('Failed to fetch database info:', err)
      return null
    }
  }

  return {
    // State
    systemInfo,
    isLoading,
    error,

    // Computed values
    cpuUsage,
    memoryUsage,
    diskUsage,
    loadAverage,

    // Actions
    fetchSystemInfo,
    fetchPhpInfo,
    fetchLaravelInfo,
    fetchServerInfo,
    fetchDatabaseInfo
  }
}
