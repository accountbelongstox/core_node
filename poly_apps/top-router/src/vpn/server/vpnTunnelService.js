'use strict'

const { v4: uuidv4 } = require('uuid')
const config = require('../../../config/config')
const logger = require('../../utils/logger')
const tunnelStore = require('./tunnelStore')
const tunnelStatsService = require('./tunnelStatsService')
const tunnelAuthService = require('./tunnelAuthService')
const portAllocator = require('./portAllocator')
const Socks5Server = require('./socks5Server')
const TunnelBridge = require('./tunnelBridge')

/**
 * VPN 服务端隧道管理（简化版）：
 * - 创建/删除隧道（分配端口、生成密码、持久化）
 * - 启动 Socks5 server，并通过 TunnelBridge 转发到 WS 客户端
 * - 记录基础统计（内存）
 */
class VpnTunnelService {
  constructor() {
    this.bridge = new TunnelBridge({ vpnService: this })
    this.socksServers = new Map() // tunnelId -> socks server instance
  }

  async initialize(wsServer) {
    await tunnelStore.init()
    await portAllocator.initialize()
    if (wsServer && typeof wsServer.setTunnelBridge === 'function') {
      wsServer.setTunnelBridge(this.bridge)
    }
    this.bridge.setWsServer(wsServer)

    // 标记已占用端口并重启已存在的隧道
    for (const tunnel of this._allTunnels()) {
      if (tunnel.socks5Port) {
        portAllocator.markUsed(Number(tunnel.socks5Port))
        try {
          const socksServer = await this._startSocksServer(tunnel)
          this.socksServers.set(tunnel.tunnelId, socksServer)
        } catch (err) {
          logger.warn('⚠️ Failed to restore tunnel on startup', {
            tunnelId: tunnel.tunnelId,
            error: err.message
          })
        }
      }
    }
  }

  async createTunnel({
    clientId,
    adminId = 'system',
    port,
    password,
    notes,
    expiresAt,
    maxConnections,
    idleTimeout,
    dataTimeout,
    maxSessions,
    bandwidthLimit
  }) {
    const tunnelId = uuidv4()
    const socks5Port = port || (await this._allocatePort(tunnelId))
    const pwd =
      password || (config.vpn?.socks?.auth?.token || '').trim() || tunnelAuthService.generatePassword()
    const passwordHash = await tunnelAuthService.hashPassword(pwd)

    const record = await tunnelStore.saveTunnel({
      tunnelId,
      clientId: clientId || 'default',
      passwordHash,
      createdAt: Date.now(),
      socks5Port,
      notes: notes || '',
      status: 'active',
      expiresAt: expiresAt || null,
      maxConnections: maxConnections || config.vpn?.defaultMaxConnections || 100,
      idleTimeout: idleTimeout || config.vpn?.defaultIdleTimeout || 300000,
      dataTimeout: dataTimeout || config.vpn?.defaultDataTimeout || 60000,
      maxSessions: maxSessions || null,
      bandwidthLimit: bandwidthLimit || null
    })

    const socksServer = await this._startSocksServer(record)
    this.socksServers.set(tunnelId, socksServer)
    tunnelStatsService.initializeTunnel(tunnelId)

    return { ...record, password: pwd }
  }

  async deleteTunnel(tunnelId, reason = 'deleted') {
    const server = this.socksServers.get(tunnelId)
    if (server) {
      await server.stop({ graceful: true }).catch((err) => {
        logger.warn('⚠️ Stop socks server failed', { tunnelId, error: err.message })
      })
      this.socksServers.delete(tunnelId)
    }
    const record = tunnelStore.getTunnel(tunnelId)
    if (record?.socks5Port) {
      await portAllocator.releasePort(Number(record.socks5Port))
    }
    await tunnelStore.removeTunnel(tunnelId)
    tunnelStatsService.updateActive(tunnelId, -1)
    logger.info('🛑 Tunnel removed', { tunnelId, reason })
  }

  async purgeExpired(now = Date.now()) {
    const removed = []
    for (const tunnel of this._allTunnels()) {
      if (tunnel.expiresAt && now >= Number(tunnel.expiresAt)) {
        await this.deleteTunnel(tunnel.tunnelId, 'expired')
        removed.push(tunnel.tunnelId)
      }
    }
    return removed
  }

  async updateTunnel(tunnelId, updates = {}) {
    const record = await tunnelStore.getTunnel(tunnelId)
    if (!record) {
      throw new Error('TUNNEL_NOT_FOUND')
    }
    const merged = {
      ...record,
      ...updates,
      updatedAt: Date.now()
    }
    if (updates.password) {
      merged.passwordHash = await tunnelAuthService.hashPassword(updates.password)
    }
    await tunnelStore.saveTunnel(merged)
    // 重启 Socks5 server 如果端口/限制变更
    const server = this.socksServers.get(tunnelId)
    if (server) {
      await server.stop({ graceful: true }).catch(() => {})
      this.socksServers.delete(tunnelId)
    }
    if (merged.socks5Port) {
      portAllocator.markUsed(Number(merged.socks5Port))
      const socksServer = await this._startSocksServer(merged)
      this.socksServers.set(tunnelId, socksServer)
    }
    return merged
  }

  async getTunnel(tunnelId) {
    return tunnelStore.getTunnel(tunnelId)
  }

  listTunnels(clientId) {
    if (clientId) {
      return tunnelStore.listClientTunnels(clientId)
    }
    return this._allTunnels()
  }

  getTunnelStats(tunnelId) {
    return tunnelStatsService.getStats(tunnelId)
  }

  async getTunnelEvents(tunnelId, limit = 20) {
    return tunnelStatsService.getEvents(tunnelId, limit)
  }

  listSessions(tunnelId) {
    if (this.bridge && typeof this.bridge.getSessionsForTunnel === 'function') {
      return this.bridge.getSessionsForTunnel(tunnelId)
    }
    return []
  }

  async clearStats(tunnelId) {
    await tunnelStatsService.clear(tunnelId)
    return { tunnelId, cleared: true }
  }

  async _startSocksServer(tunnel) {
    const socksServer = new Socks5Server({
      tunnelId: tunnel.tunnelId,
      clientId: tunnel.clientId,
      vpnService: this,
      bridge: this.bridge
    })
    await socksServer.start({
      port: tunnel.socks5Port,
      maxConnections: config.vpn?.defaultMaxConnections || 100,
      idleTimeout: config.vpn?.defaultIdleTimeout || 300000,
      dataTimeout: config.vpn?.defaultDataTimeout || 60000
    })
    return socksServer
  }

  async _allocatePort(tunnelId) {
    const allocation = await portAllocator.allocatePort(tunnelId, { purpose: 'vpn_tunnel' })
    return allocation.port
  }

  _allTunnels() {
    return Array.from(tunnelStore.tunnels.values())
  }
}

module.exports = VpnTunnelService
