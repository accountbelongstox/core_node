'use strict'

const config = require('../../config/config')
const logger = require('../utils/logger')
const WebSocketClientService = require('./websocketClientService')
const WebSocketServer = require('./wsServer')
const clientRelayService = require('../services/clientRelayService')

let clientInstance = null
let serverInstance = null

function resolveWsMode() {
  const rawMode = (config.websocket?.mode || 'client').toLowerCase()
  const wantsServer = config.websocketServer?.enabled === true
  const wantsClient = config.websocketClient?.enabled === true
  if (rawMode !== 'both') {
    return { mode: rawMode, wantsServer, wantsClient, rawMode }
  }
  let mode = 'off'
  if (wantsServer && !wantsClient) {
    mode = 'server'
  } else if (wantsClient && !wantsServer) {
    mode = 'client'
  } else if (wantsServer && wantsClient) {
    mode = 'server'
  }
  logger.warn(`⚠️ WS_MODE=both is not supported; using mode=${mode}`)
  return { mode, wantsServer, wantsClient, rawMode }
}

async function startClient() {
  if (clientInstance) {
    return clientInstance
  }
  const { mode, wantsClient } = resolveWsMode()
  if (mode !== 'client') {
    logger.info(`WebSocket client skipped (mode=${mode})`)
    return null
  }
  const wsConfig = config.websocketClient || {}
  if (!wsConfig.enabled) {
    logger.info('WebSocket client skipped (disabled)')
    return null
  }
  if (!wantsClient) {
    logger.warn('⚠️ WebSocket client mode requested but WS_CLIENT_ENABLED is false')
    return null
  }
  clientInstance = new WebSocketClientService(config)
  try {
    await clientInstance.start()
  } catch (error) {
    logger.warn(`⚠️ WebSocket client failed to start: ${error.message}`)
    clientInstance = null
    throw error
  }
  return clientInstance
}

async function startServer({ app } = {}) {
  if (serverInstance) {
    return serverInstance
  }
  const { mode, wantsServer } = resolveWsMode()
  if (mode !== 'server') {
    logger.info(`WebSocket server skipped (mode=${mode})`)
    return null
  }
  if (!wantsServer) {
    logger.warn('⚠️ WebSocket server mode requested but WS_SERVER_ENABLED is false')
    return null
  }
  if (!config.websocketServer?.enabled) {
    logger.info('WebSocket server skipped (disabled)')
    return null
  }
  if (!app || !app.listen) {
    logger.warn('WebSocket server requires an HTTP server; skipping start')
    return null
  }
  // attachServer 将通过 HTTP server 实例启动
  return null
}

function attachServer(httpServer, { tunnelBridge } = {}) {
  if (serverInstance || !httpServer) {
    return serverInstance
  }
  const { mode, wantsServer } = resolveWsMode()
  if (mode !== 'server') {
    logger.info(`WebSocket server skipped (mode=${mode})`)
    return null
  }
  if (!wantsServer || !config.websocketServer?.enabled) {
    logger.info('WebSocket server skipped (disabled)')
    return null
  }
  serverInstance = new WebSocketServer(httpServer)
  if (tunnelBridge) {
    serverInstance.setTunnelBridge(tunnelBridge)
  }
  if (clientRelayService && typeof clientRelayService.setWsServer === 'function') {
    clientRelayService.setWsServer(serverInstance)
  }
  serverInstance.start().catch((err) => {
    logger.warn(`⚠️ WebSocket server failed to start: ${err.message}`)
  })
  return serverInstance
}

module.exports = {
  startClient,
  startServer,
  attachServer,
  getClient: () => clientInstance,
  getServer: () => serverInstance
}
