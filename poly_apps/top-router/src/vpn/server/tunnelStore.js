'use strict'

const datastore = require('../../models/datastore')
const logger = require('../../utils/logger')

const LIST_KEY = 'vpn:tunnels:list'

class TunnelStore {
  constructor() {
    this.tunnels = new Map()
    this.clientTunnels = new Map()
    this.initialized = false
  }

  async init() {
    if (this.initialized) return
    try {
      const listRaw = await datastore.get(LIST_KEY)
      const ids = listRaw ? JSON.parse(listRaw) : []
      for (const id of ids) {
        const raw = await datastore.get(`vpn:tunnel:${id}`)
        if (!raw) continue
        try {
          const record = JSON.parse(raw)
          this._cache(record)
        } catch (err) {
          logger.warn('⚠️ Failed to parse tunnel record', { id, error: err.message })
        }
      }
    } catch (err) {
      logger.warn('⚠️ TunnelStore init failed, falling back to empty store', { error: err.message })
    }
    this.initialized = true
  }

  async saveTunnel(tunnel) {
    await this.init()
    const record = {
      tunnelId: tunnel.tunnelId,
      clientId: tunnel.clientId,
      passwordHash: tunnel.passwordHash || null,
      createdAt: tunnel.createdAt || Date.now(),
      expiresAt: tunnel.expiresAt || null,
      status: tunnel.status || 'active',
      notes: tunnel.notes || '',
      socks5Port: tunnel.socks5Port || null,
      maxConnections: tunnel.maxConnections || 100,
      idleTimeout: tunnel.idleTimeout || 300000,
      dataTimeout: tunnel.dataTimeout || 60000,
      maxSessions: tunnel.maxSessions || null,
      bandwidthLimit: tunnel.bandwidthLimit || null,
      updatedAt: Date.now()
    }
    this._cache(record)
    await this._persist(record)
    return record
  }

  async removeTunnel(tunnelId) {
    this.tunnels.delete(tunnelId)
    for (const set of this.clientTunnels.values()) {
      set.delete(tunnelId)
    }
    await this._removePersisted(tunnelId)
  }

  getTunnel(tunnelId) {
    return this.tunnels.get(tunnelId) || null
  }

  listClientTunnels(clientId) {
    const ids = this.clientTunnels.get(clientId)
    if (!ids) return []
    return [...ids].map((id) => this.tunnels.get(id)).filter(Boolean)
  }

  _cache(record) {
    this.tunnels.set(record.tunnelId, record)
    if (record.clientId) {
      if (!this.clientTunnels.has(record.clientId)) {
        this.clientTunnels.set(record.clientId, new Set())
      }
      this.clientTunnels.get(record.clientId).add(record.tunnelId)
    }
  }

  async _persist(record) {
    try {
      await datastore.set(`vpn:tunnel:${record.tunnelId}`, JSON.stringify(record))
      await datastore.set(LIST_KEY, JSON.stringify([...this.tunnels.keys()]))
    } catch (err) {
      logger.warn('⚠️ Failed to persist tunnel record', { tunnelId: record.tunnelId, error: err.message })
    }
  }

  async _removePersisted(tunnelId) {
    try {
      await datastore.del(`vpn:tunnel:${tunnelId}`)
      await datastore.set(LIST_KEY, JSON.stringify([...this.tunnels.keys()]))
    } catch (err) {
      logger.warn('⚠️ Failed to remove tunnel record', { tunnelId, error: err.message })
    }
  }
}

module.exports = new TunnelStore()
