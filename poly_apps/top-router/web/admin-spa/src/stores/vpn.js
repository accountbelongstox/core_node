import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiClient } from '@/config/api'

export const useVpnStore = defineStore('vpn', () => {
  const tunnels = ref([])
  const loading = ref(false)
  const error = ref(null)
  const lastFetchAt = ref(null)
  const sessions = ref({})
  const sessionsLoading = ref(false)
  const events = ref({})
  const eventsLoading = ref(false)

  const activeCount = computed(
    () => tunnels.value.filter((t) => (t.status || '').toLowerCase() === 'active').length
  )

  const failingCount = computed(
    () =>
      tunnels.value.filter(
        (t) => t?.stats?.handshakeFailures > 0 || t?.stats?.lastErrorCode || t?.status === 'error'
      ).length
  )

  const totalActiveConnections = computed(() =>
    tunnels.value.reduce((sum, t) => sum + (t?.stats?.activeConnections || 0), 0)
  )

  const lastUpdatedAt = computed(() => {
    const stats = tunnels.value
      .map((t) => t?.stats?.lastUpdatedAt || t?.updatedAt || t?.createdAt)
      .filter(Boolean)
    const maxStat = stats.length > 0 ? Math.max(...stats) : null
    return maxStat || lastFetchAt.value
  })

  const fetchTunnels = async () => {
    loading.value = true
    error.value = null
    try {
      const response = await apiClient.get('/admin/vpn/tunnels')
      if (response.success) {
        tunnels.value = Array.isArray(response.data) ? response.data : []
        lastFetchAt.value = Date.now()
      } else {
        throw new Error(response.error || response.message || '加载 VPN 隧道失败')
      }
    } catch (err) {
      error.value = err.message || '加载 VPN 隧道失败'
      throw err
    } finally {
      loading.value = false
    }
  }

  const fetchSessions = async (tunnelId) => {
    if (!tunnelId) return []
    sessionsLoading.value = true
    try {
      const response = await apiClient.get(`/admin/vpn/tunnels/${tunnelId}/sessions`)
      if (response.success) {
        sessions.value[tunnelId] = Array.isArray(response.data) ? response.data : []
      } else {
        throw new Error(response.error || response.message || '加载会话失败')
      }
    } finally {
      sessionsLoading.value = false
    }
    return sessions.value[tunnelId] || []
  }

  const fetchEvents = async (tunnelId, limit = 20) => {
    if (!tunnelId) return []
    eventsLoading.value = true
    try {
      const response = await apiClient.get(`/admin/vpn/tunnels/${tunnelId}/events`, {
        params: { limit }
      })
      if (response.success) {
        events.value[tunnelId] = Array.isArray(response.data) ? response.data : []
      } else {
        throw new Error(response.error || response.message || '加载事件失败')
      }
    } finally {
      eventsLoading.value = false
    }
    return events.value[tunnelId] || []
  }

  const createTunnel = async (payload) => {
    await apiClient.post('/admin/vpn/tunnels', payload)
    return fetchTunnels()
  }

  const updateTunnel = async (tunnelId, payload) => {
    await apiClient.patch(`/admin/vpn/tunnels/${tunnelId}`, payload)
    return fetchTunnels()
  }

  const deleteTunnel = async (tunnelId) => {
    await apiClient.delete(`/admin/vpn/tunnels/${tunnelId}`)
    return fetchTunnels()
  }

  const purgeExpired = async () => {
    await apiClient.post('/admin/vpn/tunnels/purge')
    return fetchTunnels()
  }

  const resetTunnelStats = async (tunnelId) => {
    await apiClient.post(`/admin/vpn/tunnels/${tunnelId}/reset`)
    return fetchTunnels()
  }

  return {
    tunnels,
    loading,
    error,
    activeCount,
    failingCount,
    totalActiveConnections,
    lastUpdatedAt,
    lastFetchAt,
    sessions,
    sessionsLoading,
    events,
    eventsLoading,
    fetchTunnels,
    fetchSessions,
    fetchEvents,
    createTunnel,
    updateTunnel,
    deleteTunnel,
    purgeExpired,
    resetTunnelStats
  }
})
