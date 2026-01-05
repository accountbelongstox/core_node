'use strict'

const datastore = require('../models/datastore')
class VpnStorageService {
  constructor(options = {}) {
    const ds = options.datastore || datastore
    // 获取实际的客户端（支持 Redis 和 SQLite datastore）
    this.client = typeof ds.getClient === 'function' ? ds.getClient() : ds.client || ds
  }

  async recordSession(sessionId, metadata = {}) {
    const key = `vpn_session:${sessionId}`
    const tunnelKey = `vpn_tunnel_sessions:default`

    await this.client.hset(key, {
      ...metadata,
      sessionId
    })

    await this.client.sadd(tunnelKey, sessionId)
  }

  async deleteSession(sessionId) {
    const key = `vpn_session:${sessionId}`
    const tunnelKey = `vpn_tunnel_sessions:default`

    await this.client.del(key)
    await this.client.srem(tunnelKey, sessionId)
  }

  async getSession(sessionId) {
    const key = `vpn_session:${sessionId}`
    const result = await this.client.hgetall(key)
    return Object.keys(result).length > 0 ? result : null
  }

  async listActiveSessionIds() {
    const tunnelKey = `vpn_tunnel_sessions:default`
    return await this.client.smembers(tunnelKey)
  }
}

module.exports = VpnStorageService
