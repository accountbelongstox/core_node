'use strict'

const datastore = require('../../models/datastore')
const logger = require('../../utils/logger')
const config = require('../../../config/config')

// 简易内存 + datastore 持久化的统计服务
class TunnelStatsService {
  constructor() {
    this.stats = new Map()
    this.maxEvents = 50
    const ttlSeconds = Number(config.vpn?.stats?.ttlSeconds) || Number(config.vpn?.statsTtlSeconds)
    this.ttlSeconds =
      Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 7 * 24 * 60 * 60 // 默认 7 天
  }

  async initializeTunnel(tunnelId) {
    // 从持久化中尝试恢复
    const persisted = await this._load(tunnelId)
    const record = this._withDefaults(persisted || {})
    record.lastUpdatedAt = record.lastUpdatedAt || Date.now()
    this.stats.set(tunnelId, record)
    await this._persist(tunnelId, record)
    return record
  }

  async recordData(tunnelId, { bytesIn = 0, bytesOut = 0, errors = 0, latencyMs = 0 } = {}) {
    const rec = await this._getOrInit(tunnelId)
    rec.totalBytesIn += bytesIn
    rec.totalBytesOut += bytesOut
    rec.totalErrors += errors
    if (latencyMs > 0) {
      rec.latencySum += latencyMs
      rec.latencySamples += 1
    }
    rec.lastUpdatedAt = Date.now()
    await this._persist(tunnelId, rec)
    return rec
  }

  async updateActive(tunnelId, delta) {
    const rec = await this._getOrInit(tunnelId)
    rec.activeConnections = Math.max(0, rec.activeConnections + delta)
    rec.totalConnections += delta > 0 ? delta : 0
    rec.lastUpdatedAt = Date.now()
    await this._persist(tunnelId, rec)
    return rec
  }

  async recordHandshake(tunnelId, { success, latencyMs = 0, errorCode = null, message = null } = {}) {
    const rec = await this._getOrInit(tunnelId)
    const now = Date.now()
    rec.lastHandshakeAt = now
    if (success) {
      rec.handshakeSuccesses += 1
    } else {
      rec.handshakeFailures += 1
      rec.totalErrors += 1
      rec.lastErrorCode = errorCode || rec.lastErrorCode || 'UNKNOWN_ERROR'
      rec.lastErrorMessage = message || rec.lastErrorMessage
      rec.lastErrorAt = now
    }
    if (latencyMs > 0) {
      rec.latencySum += latencyMs
      rec.latencySamples += 1
    }
    rec.lastUpdatedAt = now
    await this._persist(tunnelId, rec)
    await this._appendEvent(tunnelId, {
      type: 'handshake',
      success: Boolean(success),
      errorCode: success ? null : errorCode || 'UNKNOWN_ERROR',
      message: message || null,
      at: now,
      latencyMs: latencyMs || null
    })
    return rec
  }

  async recordError(tunnelId, { errorCode = null, message = null } = {}) {
    const rec = await this._getOrInit(tunnelId)
    const now = Date.now()
    rec.totalErrors += 1
    rec.lastErrorCode = errorCode || rec.lastErrorCode || 'UNKNOWN_ERROR'
    rec.lastErrorMessage = message || rec.lastErrorMessage
    rec.lastErrorAt = now
    rec.lastUpdatedAt = now
    await this._persist(tunnelId, rec)
    await this._appendEvent(tunnelId, {
      type: 'error',
      errorCode: errorCode || 'UNKNOWN_ERROR',
      message: message || null,
      at: now
    })
    return rec
  }

  getStats(tunnelId) {
    return this.stats.get(tunnelId) || null
  }

  async getEvents(tunnelId, limit = 20) {
    try {
      const raw = await datastore.lrange(`vpn:events:${tunnelId}`, 0, Math.max(0, limit - 1))
      if (!raw || raw.length === 0) {
        return []
      }
      return raw
        .map((entry) => {
          try {
            return JSON.parse(entry)
          } catch (_) {
            return null
          }
        })
        .filter(Boolean)
    } catch (err) {
      logger.warn('⚠️ Failed to load vpn events', { tunnelId, error: err.message })
      return []
    }
  }

  async clear(tunnelId) {
    this.stats.delete(tunnelId)
    try {
      await datastore.del(`vpn:stats:${tunnelId}`)
    } catch (_) {}
    try {
      await datastore.del(`vpn:events:${tunnelId}`)
    } catch (_) {}
    return true
  }

  async _persist(tunnelId, rec) {
    try {
      await datastore.set(`vpn:stats:${tunnelId}`, JSON.stringify(rec))
      if (typeof datastore.expire === 'function') {
        await datastore.expire(`vpn:stats:${tunnelId}`, this.ttlSeconds)
      }
    } catch (err) {
      logger.warn('⚠️ Failed to persist vpn stats', { tunnelId, error: err.message })
    }
  }

  async _load(tunnelId) {
    try {
      const raw = await datastore.get(`vpn:stats:${tunnelId}`)
      return raw ? JSON.parse(raw) : null
    } catch (err) {
      return null
    }
  }

  async _getOrInit(tunnelId) {
    const cached = this.stats.get(tunnelId)
    if (cached) {
      return this._withDefaults(cached)
    }
    const persisted = await this._load(tunnelId)
    if (persisted) {
      const normalized = this._withDefaults(persisted)
      this.stats.set(tunnelId, normalized)
      return normalized
    }
    return this.initializeTunnel(tunnelId)
  }

  _withDefaults(rec = {}) {
    const defaults = {
      activeConnections: 0,
      totalConnections: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      totalErrors: 0,
      latencySum: 0,
      latencySamples: 0,
      handshakeSuccesses: 0,
      handshakeFailures: 0,
      lastHandshakeAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastErrorAt: null,
      lastUpdatedAt: null
    }
    for (const [key, value] of Object.entries(defaults)) {
      if (rec[key] === undefined) {
        rec[key] = value
      }
    }
    return rec
  }

  async _appendEvent(tunnelId, event) {
    try {
      await datastore.lpush(`vpn:events:${tunnelId}`, JSON.stringify(event))
      await datastore.ltrim(`vpn:events:${tunnelId}`, 0, Math.max(0, this.maxEvents - 1))
      if (typeof datastore.expire === 'function') {
        await datastore.expire(`vpn:events:${tunnelId}`, this.ttlSeconds)
      }
    } catch (err) {
      logger.debug('Failed to append vpn event', { tunnelId, error: err.message })
    }
  }
}

module.exports = new TunnelStatsService()
