'use strict'

const VpnRuntime = require('./vpnRuntime')
const datastore = require('../models/datastore')
const logger = require('../utils/logger')
const config = require('../../config/config')
const VpnTunnelService = require('./server/vpnTunnelService')

let vpnServerService = null
let vpnClientRuntime = null

function createVpnRuntime(options = {}) {
  const runtimeConfig = options.config || require('../../config/config').vpn || {}

  return new VpnRuntime({
    config: runtimeConfig,
    websocketClient: options.websocketClient || null,
    datastore: options.datastore || datastore
  })
}

module.exports = {
  createVpnRuntime,
  VpnRuntime,
  async startClient() {
    const mode = (config.vpn?.mode || 'client').toLowerCase()
    if (mode === 'off' || mode === 'server') {
      logger.info(`VPN client skipped (mode=${mode})`)
      return null
    }
    const runtime = createVpnRuntime({ config: config.vpn })
    await runtime.start()
    vpnClientRuntime = runtime
    return runtime
  },
  async startServer({ wsServer } = {}) {
    const mode = (config.vpn?.mode || 'client').toLowerCase()
    if (mode === 'off' || mode === 'client') {
      logger.info(`VPN server skipped (mode=${mode})`)
      return null
    }
    if (!vpnServerService) {
      vpnServerService = new VpnTunnelService()
      await vpnServerService.initialize(wsServer)
    } else {
      // 重绑 WS server
      await vpnServerService.initialize(wsServer)
    }

    // 如配置了默认端口/密码，则启动一个默认隧道
    const socksPort = config.vpn?.socks?.port || 0
    const configuredToken = (config.vpn?.socks?.auth?.token || '').trim()
    if (socksPort && configuredToken) {
      await vpnServerService.createTunnel({
        clientId: 'default',
        port: socksPort,
        password: configuredToken
      })
      logger.info('VPN server (SOCKS5) started', { port: socksPort })
    } else {
      logger.warn('VPN server initialized but no default tunnel started (missing port or token)')
    }
    return vpnServerService
  },

  getServerService() {
    return vpnServerService
  },

  getClientRuntime() {
    return vpnClientRuntime
  }
}
