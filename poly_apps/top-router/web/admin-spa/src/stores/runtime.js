import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { apiClient } from '@/config/api'

const DEFAULT_WS = {
  mode: 'client',
  clientEnabled: false,
  serverEnabled: false,
  wsClientOnly: false
}

export const useRuntimeStore = defineStore('runtime', () => {
  const uiMode = ref('full')
  const ws = ref({ ...DEFAULT_WS })
  const vpn = ref({ mode: 'client', enabled: false })
  const wsClientStatus = ref(null)
  const vpnClientStatus = ref(null)
  const publicLoaded = ref(false)
  const adminLoaded = ref(false)
  const loading = ref(false)
  const adminLoading = ref(false)
  const error = ref(null)
  const adminError = ref(null)
  const lastFetchedAt = ref(null)
  const adminFetchedAt = ref(null)

  const isWsClientOnly = computed(() => uiMode.value === 'client' || ws.value.wsClientOnly)

  const updatePublicState = (data = {}) => {
    uiMode.value = data.uiMode || 'full'
    ws.value = { ...DEFAULT_WS, ...(data.ws || {}) }
    vpn.value = { ...(data.vpn || vpn.value) }
    publicLoaded.value = true
    lastFetchedAt.value = Date.now()
  }

  const updateAdminState = (data = {}) => {
    wsClientStatus.value = data.wsClientStatus || null
    vpnClientStatus.value = data.vpnClientStatus || null
    adminLoaded.value = true
    adminFetchedAt.value = Date.now()
  }

  const fetchRuntimeInfo = async (force = false) => {
    if (publicLoaded.value && !force) {
      return
    }
    loading.value = true
    error.value = null
    try {
      const res = await apiClient.get('/web/runtime-info')
      if (res.success) {
        updatePublicState(res.data)
      } else {
        throw new Error(res.error || res.message || 'Failed to load runtime info')
      }
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchAdminRuntimeInfo = async (force = false) => {
    if (adminLoaded.value && !force) {
      return
    }
    adminLoading.value = true
    adminError.value = null
    try {
      const res = await apiClient.get('/admin/runtime-info')
      if (res.success) {
        updateAdminState(res.data)
      } else {
        throw new Error(res.error || res.message || 'Failed to load admin runtime info')
      }
    } catch (err) {
      adminError.value = err.message
      throw err
    } finally {
      adminLoading.value = false
    }
  }

  return {
    uiMode,
    ws,
    vpn,
    wsClientStatus,
    vpnClientStatus,
    publicLoaded,
    adminLoaded,
    loading,
    adminLoading,
    error,
    adminError,
    lastFetchedAt,
    adminFetchedAt,
    isWsClientOnly,
    fetchRuntimeInfo,
    fetchAdminRuntimeInfo
  }
})
