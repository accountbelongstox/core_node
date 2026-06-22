'use strict'

const WebSocket = require('ws')
const { WebSocketServer: WsServer } = require('ws')
const { v4: uuidv4 } = require('uuid')
const clientService = require('../services/clientService')
const logger = require('../utils/logger')
const config = require('../../config/config')
const { parseBinaryFrame } = require('./binaryProtocol')

const MIN_VPN_BUFFER_BYTES = 2 * 1024 * 1024

function resolveVpnBufferLimit() {
  const bufferConfig = config.vpn?.buffer || {}
  const explicitLimit = Number(bufferConfig.maxBufferedBytes)
  if (Number.isFinite(explicitLimit) && explicitLimit > 0) {
    return Math.max(explicitLimit, MIN_VPN_BUFFER_BYTES)
  }
  const poolSize = Number(bufferConfig.poolSize) || 0
  const chunkSize = Number(bufferConfig.chunkSize) || 0
  const derivedLimit = poolSize > 0 && chunkSize > 0 ? poolSize * chunkSize : 0
  return Math.max(derivedLimit, MIN_VPN_BUFFER_BYTES)
}

function resolveVpnBufferDrainTimeout() {
  const bufferConfig = config.vpn?.buffer || {}
  const timeout = Number(bufferConfig.drainTimeout)
  return Number.isFinite(timeout) && timeout > 0 ? timeout : 10000
}

/**
 * WebSocket Server - 管理与 Client 的 WebSocket 连接
 *
 * 功能：
 * - Client 连接认证
 * - 连接生命周期管理
 * - 心跳检测（ping/pong）
 * - 消息路由（register、heartbeat、request、response、error、status_update）
 * - 请求/响应配对
 */
class WebSocketServer {
  constructor(server) {
    this.wss = null
    this.server = server
    this.path = config.websocketServer?.path || config.client?.wsServer?.path || '/ws/client'
    this.heartbeatInterval =
      config.websocketServer?.heartbeatInterval ||
      config.client?.wsServer?.heartbeatInterval ||
      30000
    this.connectionTimeout =
      config.websocketServer?.connectionTimeout ||
      config.client?.wsServer?.connectionTimeout ||
      30000

    this.connectionMap = new Map()
    this.pendingRequests = new Map()
    this.heartbeatTimer = null
    this.tunnelBridge = null
    this.maxVpnBufferedBytes = resolveVpnBufferLimit()
    this.wsBufferDrainTimeout = resolveVpnBufferDrainTimeout()
    this.oauthSessions = new Map()

    logger.info(`📡 WebSocket Server initialized on path: ${this.path}`)
  }

  async start() {
    this.wss = new WsServer({
      server: this.server,
      path: this.path
    })

    this.wss.on('connection', (ws, req) => this._handleConnection(ws, req))
    this._startHeartbeatChecker()
    await this._cleanupStaleClientConnections()
    logger.success(`✅ WebSocket Server started on ${this.path}`)
  }

  async _cleanupStaleClientConnections() {
    try {
      const clients = await clientService.getAllClients({ status: 'online' })
      if (clients.length > 0) {
        logger.info(
          `🧹 Cleaning up ${clients.length} stale client connections from previous session`
        )
        for (const client of clients) {
          await clientService.markClientOffline(client.id, 'server_restarted')
          logger.debug(`🧹 Marked client ${client.name || client.id} as offline`)
        }
        logger.success(`✅ Cleaned up ${clients.length} stale client connections`)
      } else {
        logger.debug('🧹 No stale client connections to clean up')
      }
    } catch (error) {
      logger.error('❌ Failed to cleanup stale client connections:', error)
    }
  }

  setTunnelBridge(tunnelBridge) {
    this.tunnelBridge = tunnelBridge
  }

  stop() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
    if (this.wss) {
      this.wss.close(() => logger.info('📡 WebSocket Server stopped'))
    }
  }

  async _handleConnection(ws, req) {
    const wsId = uuidv4()
    const { remoteAddress } = req.socket
    logger.info(`🔌 New WebSocket connection: ${wsId} from ${remoteAddress}`)

    ws.clientId = null
    ws.wsId = wsId
    ws.isAlive = true
    ws.authenticated = false

    const authTimeout = setTimeout(() => {
      if (!ws.authenticated) {
        logger.warn(`⏰ Connection ${wsId} authentication timeout, closing`)
        ws.close(1008, 'Authentication timeout')
      }
    }, this.connectionTimeout)

    ws.on('message', async (data, isBinary) => {
      try {
        if (isBinary) {
          await this._handleBinaryData(ws, data)
        } else {
          await this._handleJsonMessage(ws, data, authTimeout)
        }
      } catch (error) {
        logger.error(`❌ Error handling message from ${wsId}:`, error)
        this._sendError(ws, null, 'MESSAGE_HANDLING_ERROR', error.message)
      }
    })

    ws.on('close', (code, reason) => {
      clearTimeout(authTimeout)
      this._handleClose(ws, code, reason)
    })

    ws.on('error', (error) => {
      logger.error(`❌ WebSocket error from ${wsId}:`, error)
    })

    ws.on('pong', () => {
      ws.isAlive = true
    })
  }

  async _handleJsonMessage(ws, data, authTimeout) {
    let message
    try {
      message = JSON.parse(data.toString())
    } catch (error) {
      logger.error('❌ Invalid JSON message:', error)
      this._sendError(ws, null, 'INVALID_JSON', 'Invalid JSON format')
      return
    }

    const { type, id, timestamp, data: payload } = message

    logger.debug(`📨 Received message type: ${type} from ${ws.wsId}`)

    switch (type) {
      case 'register':
        await this._handleRegistration(ws, payload, authTimeout, id, timestamp)
        break
      case 'pong':
        await this._handlePong(ws, payload, id, timestamp)
        break
      case 'response':
        this._handleResponse(ws, payload)
        break
      case 'response_chunk':
        this._handleResponseChunk(ws, payload)
        break
      case 'response_end':
        this._handleResponseEnd(ws, payload)
        break
      case 'error':
        this._handleErrorMessage(ws, payload)
        break
      case 'status_update':
        await this._handleStatusUpdate(ws, payload, id, timestamp)
        break
      case 'capability_update':
        await this._handleCapabilityUpdate(ws, payload, id, timestamp)
        break
      case 'request_ack':
        this._handleRequestAck(ws, payload)
        break
      case 'tunnel_connect_ack':
        if (this.tunnelBridge) {
          this.tunnelBridge.handleConnectAck(ws.clientId, payload)
        }
        break
      case 'tunnel_disconnect':
        if (this.tunnelBridge) {
          this.tunnelBridge.handleClientDisconnect(ws.clientId, payload)
        }
        break
      case 'tunnel_error':
        logger.warn('⚠️ Tunnel error reported by client', { clientId: ws.clientId, payload })
        if (this.tunnelBridge) {
          this.tunnelBridge.handleClientDisconnect(ws.clientId, payload)
        }
        break
      case 'config_ack':
        await this._handleConfigAck(ws, payload, id, timestamp)
        break
      case 'account_operation_result':
        await this._handleAccountOperationResult(ws, payload, id, timestamp)
        break
      case 'system_health_info':
        await this._handleSystemHealthInfo(ws, payload, id, timestamp)
        break
      case 'oauth_url_result':
        await this._handleOAuthUrlResult(ws, payload, id, timestamp)
        break
      case 'oauth_exchange_result':
        await this._handleOAuthExchangeResult(ws, payload, id, timestamp)
        break
      default:
        logger.warn(`⚠️ Unknown message type: ${type} from ${ws.wsId}`)
    }
  }

  async _handleBinaryData(ws, data) {
    if (!this.tunnelBridge) {
      logger.warn('⚠️ Received binary data but tunnel bridge is not configured')
      return
    }
    if (!ws.clientId) {
      logger.warn('⚠️ Received binary data from unauthenticated client')
      return
    }
    try {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
      const frame = parseBinaryFrame(buffer)
      await this.tunnelBridge.handleBinaryData(ws.clientId, frame)
    } catch (error) {
      logger.error('❌ Failed to process binary frame', {
        clientId: ws.clientId,
        error: error.message
      })
    }
  }

  async _handleRegistration(ws, payload, authTimeout) {
    try {
      const { apiKey, version, capabilities, resources, metadata } = payload
      if (!apiKey) {
        throw new Error('API Key is required')
      }
      const clientData = await clientService.authenticateClientApiKey(apiKey)
      clearTimeout(authTimeout)
      ws.clientId = clientData.id
      ws.authenticated = true
      this.connectionMap.set(clientData.id, ws)

      await clientService.updateClientConnection(clientData.id, {
        wsId: ws.wsId,
        remoteAddress: ws._socket?.remoteAddress,
        version: version || 'unknown',
        clientInfo: metadata || {}
      })

      if (capabilities || resources) {
        await clientService.updateClientStatus(clientData.id, {
          capabilities,
          resources
        })
      }

      this._sendMessage(ws, {
        type: 'register_ack',
        id: uuidv4(),
        timestamp: Date.now(),
        data: { clientId: clientData.id, status: 'success', message: 'Registration successful' }
      })
      logger.success(`✅ Client registered: ${clientData.name || clientData.id}`)
    } catch (error) {
      logger.error('❌ Registration failed:', error)
      this._sendMessage(ws, {
        type: 'register_error',
        id: uuidv4(),
        timestamp: Date.now(),
        data: {
          errorCode: 'AUTH_FAILED',
          errorType: 'authentication_error',
          message: error.message,
          details: {}
        }
      })
      setTimeout(() => {
        ws.close(1008, 'Authentication failed')
      }, 100)
    }
  }

  async _handlePong(ws, payload) {
    if (!ws.clientId) {
      return
    }
    ws.isAlive = true
    const latency = payload.requestTime ? Date.now() - payload.requestTime : 0
    await clientService.updateHeartbeat(ws.clientId, { latency, stats: payload.stats || {} })
    logger.debug(`💓 Heartbeat from ${ws.clientId}, latency: ${latency}ms`)
  }

  async _handleStatusUpdate(ws, payload) {
    if (!ws.clientId) {
      logger.warn('⚠️ Status update from unauthenticated client')
      return
    }
    try {
      await clientService.updateClientStatus(ws.clientId, payload)
      this._sendMessage(ws, {
        type: 'status_update_ack',
        id: uuidv4(),
        timestamp: Date.now(),
        data: { status: 'success', message: 'Status update received and processed' }
      })
      logger.debug(`📊 Status update from ${ws.clientId}`)
    } catch (error) {
      logger.error(`❌ Failed to update client ${ws.clientId} status:`, error)
      this._sendError(ws, null, 'STATUS_UPDATE_FAILED', error.message, true)
    }
  }

  async _handleCapabilityUpdate(ws, payload) {
    if (!ws.clientId) {
      logger.warn('⚠️ Capability update from unauthenticated client')
      return
    }
    try {
      const { capabilities, resources, status } = payload || {}
      await clientService.updateClientStatus(ws.clientId, {
        capabilities: capabilities || {},
        resources: resources || {},
        status
      })
      logger.debug(`🧩 Capability update from ${ws.clientId}`)
    } catch (error) {
      logger.error(`❌ Failed to update client ${ws.clientId} capabilities:`, error)
    }
  }

  _handleRequestAck(ws, payload) {
    const { requestId, status, message } = payload
    logger.debug(`✅ Request ${requestId} acknowledged: ${status} - ${message}`)
  }

  _handleResponse(ws, payload) {
    const { requestId, statusCode, headers, body, usage } = payload
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve({ statusCode, headers, body, usage })
      this.pendingRequests.delete(requestId)
      logger.debug(`📦 Response received for request ${requestId}`)
    } else {
      logger.warn(`⚠️ Received response for unknown request: ${requestId}`)
    }
  }

  _handleResponseChunk(ws, payload) {
    const { requestId, sequence, chunk, encoding } = payload
    const pending = this.pendingRequests.get(requestId)
    if (pending && pending.onChunk) {
      pending.onChunk({ sequence, chunk, encoding })
      logger.debug(`📊 Response chunk ${sequence} for request ${requestId}`)
    } else {
      logger.warn(`⚠️ Received chunk for unknown request: ${requestId}`)
    }
  }

  _handleResponseEnd(ws, payload) {
    const { requestId, usage } = payload
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve({ usage })
      this.pendingRequests.delete(requestId)
      logger.debug(`✅ Response end for request ${requestId}`, { usage })
    } else {
      logger.warn(`⚠️ Received response_end for unknown request: ${requestId}`)
    }
  }

  _handleErrorMessage(ws, payload) {
    const { requestId, errorCode, errorType, message, details, retryable } = payload
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      const error = new Error(message)
      error.code = errorCode
      error.type = errorType
      error.details = details
      error.retryable = retryable
      error.statusCode = details?.statusCode
      pending.reject(error)
      this.pendingRequests.delete(requestId)
      logger.warn(`⚠️ Request ${requestId} failed: ${message}`)
    } else {
      logger.warn(`⚠️ Received error for unknown request: ${requestId}`)
    }
  }

  _handleClose(ws, code, reason) {
    if (ws.clientId) {
      const current = this.connectionMap.get(ws.clientId)
      if (current === ws) {
        this.connectionMap.delete(ws.clientId)
        clientService.markClientOffline(ws.clientId, reason.toString() || 'connection_closed')
      }
    }
    logger.info(`🔌 Connection closed: ${ws.wsId} (code=${code}, reason=${reason})`)
  }

  _startHeartbeatChecker() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
    }
    this.heartbeatTimer = setInterval(() => {
      this.wss?.clients.forEach((ws) => {
        if (!ws.isAlive) {
          logger.warn(`⏰ Connection ${ws.wsId} is dead, terminating`)
          ws.terminate()
          if (ws.clientId) {
            const current = this.connectionMap.get(ws.clientId)
            if (current === ws) {
              this.connectionMap.delete(ws.clientId)
              clientService.markClientOffline(ws.clientId, 'heartbeat_timeout')
            }
          }
          return
        }
        ws.isAlive = false
        this._sendMessage(ws, {
          type: 'ping',
          id: uuidv4(),
          timestamp: Date.now(),
          data: {}
        })
      })
    }, this.heartbeatInterval)

    logger.info(`💓 Heartbeat checker started (interval: ${this.heartbeatInterval}ms)`)
  }

  async _handleConfigAck(ws, payload, messageId) {
    if (!ws.clientId) {
      logger.warn('⚠️ Config ack from unauthenticated client')
      return
    }

    const { success, appliedConfig, requiresRestart, errors } = payload

    logger.info(`⚙️ Config ack from ${ws.clientId}: ${success ? '✅ success' : '❌ failed'}`, {
      requiresRestart,
      errors: errors || []
    })

    const pending = this.pendingRequests.get(messageId)
    const metadata = pending?.metadata || {}
    if (pending) {
      clearTimeout(pending.timeout)
      if (success) {
        pending.resolve({ success, appliedConfig, requiresRestart })
      } else {
        const error = new Error('Configuration failed')
        error.details = { errors }
        error.retryable = false
        pending.reject(error)
      }
      this.pendingRequests.delete(messageId)
    }

    if (success && appliedConfig) {
      try {
        await clientService.updateClientConfig(ws.clientId, {
          lastConfigUpdate: new Date().toISOString(),
          appliedConfig,
          requiresRestart,
          operator: metadata.operator || 'system',
          summary: metadata.summary || null
        })
      } catch (error) {
        logger.error(`❌ Failed to save config update for ${ws.clientId}:`, error)
      }
    }
  }

  async _handleAccountOperationResult(ws, payload, messageId) {
    if (!ws.clientId) {
      logger.warn('⚠️ Account operation result from unauthenticated client')
      return
    }

    const { success, operation, accountId, message, errors } = payload

    logger.info(
      `🔄 Account operation result from ${ws.clientId}: ${operation} - ${success ? '✅ success' : '❌ failed'}`,
      { accountId, message, errors: errors || [] }
    )

    const pending = this.pendingRequests.get(messageId)
    if (pending) {
      clearTimeout(pending.timeout)
      if (success) {
        pending.resolve({ success, operation, accountId, message })
      } else {
        const error = new Error(message || 'Account operation failed')
        error.operation = operation
        error.accountId = accountId
        error.details = { errors }
        error.retryable = false
        pending.reject(error)
      }
      this.pendingRequests.delete(messageId)
    } else {
      logger.warn(`⚠️ Received account_operation_result for unknown request: ${messageId}`)
    }
  }

  async _handleSystemHealthInfo(ws, payload, messageId) {
    if (!ws.clientId) {
      logger.warn('⚠️ System health info from unauthenticated client')
      return
    }
    const pending = this.pendingRequests.get(messageId)
    if (pending) {
      clearTimeout(pending.timeout)
      pending.resolve(payload)
      this.pendingRequests.delete(messageId)
      logger.info(`🩺 System health info received from ${ws.clientId}`)
    } else {
      logger.warn(`⚠️ Received system_health_info for unknown request: ${messageId}`)
    }
  }

  async _handleOAuthUrlResult(ws, payload, messageId) {
    if (!ws.clientId) {
      logger.warn('⚠️ OAuth URL result from unauthenticated client')
      return
    }

    const { success, authUrl, sessionId, redirectUri, state, error } = payload
    logger.info(
      `🔑 OAuth URL result from ${ws.clientId}: ${success ? '✅ success' : '❌ failed'}`,
      {
        sessionId,
        authUrl: authUrl ? `${authUrl.substring(0, 50)}...` : null,
        error: error || null
      }
    )

    const pending = this.pendingRequests.get(messageId)
    if (pending) {
      clearTimeout(pending.timeout)
      if (success) {
        pending.resolve({ success, authUrl, sessionId, redirectUri, state })
      } else {
        const err = new Error(error || 'Failed to generate OAuth URL')
        err.retryable = false
        pending.reject(err)
      }
      this.pendingRequests.delete(messageId)
    } else {
      logger.warn(`⚠️ Received oauth_url_result for unknown request: ${messageId}`)
    }
  }

  async _handleOAuthExchangeResult(ws, payload, messageId) {
    if (!ws.clientId) {
      logger.warn('⚠️ OAuth exchange result from unauthenticated client')
      return
    }

    const { success, accountId, accountType, message, errors } = payload
    logger.info(
      `🔐 OAuth exchange result from ${ws.clientId}: ${success ? '✅ success' : '❌ failed'}`,
      { accountId, accountType, message }
    )

    const pending = this.pendingRequests.get(messageId)
    if (pending) {
      clearTimeout(pending.timeout)
      if (success) {
        pending.resolve({ success, accountId, accountType })
      } else {
        const err = new Error(message || 'OAuth exchange failed')
        err.details = { errors }
        err.retryable = false
        pending.reject(err)
      }
      this.pendingRequests.delete(messageId)
    } else {
      logger.warn(`⚠️ Received oauth_exchange_result for unknown request: ${messageId}`)
    }
  }

  async _waitForWebSocketBuffer(ws, clientId) {
    if (!ws || typeof ws.bufferedAmount !== 'number') {
      return
    }
    if (!this.maxVpnBufferedBytes || ws.bufferedAmount <= this.maxVpnBufferedBytes) {
      return
    }
    logger.debug('⏳ VPN WebSocket backpressure engaged', {
      clientId,
      bufferedAmount: ws.bufferedAmount,
      limit: this.maxVpnBufferedBytes
    })

    await new Promise((resolve, reject) => {
      const socket = ws._socket
      let settled = false
      let pollInterval = null

      const cleanup = () => {
        if (settled) {
          return
        }
        settled = true
        if (socket && typeof socket.off === 'function') {
          socket.off('drain', handleDrain)
        } else if (socket && typeof socket.removeListener === 'function') {
          socket.removeListener('drain', handleDrain)
        }
        if (typeof ws.off === 'function') {
          ws.off('close', handleClose)
          ws.off('error', handleClose)
        } else {
          ws.removeListener('close', handleClose)
          ws.removeListener('error', handleClose)
        }
        clearTimeout(timeout)
        if (pollInterval) {
          clearInterval(pollInterval)
        }
      }

      const handleDrain = () => {
        if (ws.bufferedAmount <= this.maxVpnBufferedBytes) {
          cleanup()
          resolve()
        }
      }

      const handleClose = (error) => {
        cleanup()
        if (error instanceof Error) {
          reject(error)
        } else {
          reject(new Error('Client disconnected while draining VPN buffer'))
        }
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `WebSocket buffer did not drain within ${this.wsBufferDrainTimeout}ms (buffered=${ws.bufferedAmount})`
          )
        )
      }, this.wsBufferDrainTimeout)
      if (typeof timeout.unref === 'function') {
        timeout.unref()
      }

      if (socket && typeof socket.on === 'function') {
        socket.on('drain', handleDrain)
      } else {
        pollInterval = setInterval(() => {
          if (ws.bufferedAmount <= this.maxVpnBufferedBytes) {
            cleanup()
            resolve()
          }
        }, 50)
        if (typeof pollInterval.unref === 'function') {
          pollInterval.unref()
        }
      }

      ws.once('close', handleClose)
      ws.once('error', handleClose)

      if (ws.bufferedAmount <= this.maxVpnBufferedBytes) {
        cleanup()
        resolve()
      }
    })
  }

  _sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message))
    }
  }

  _sendError(ws, requestId, errorCode, message, retryable = false) {
    this._sendMessage(ws, {
      type: 'error',
      id: uuidv4(),
      timestamp: Date.now(),
      data: {
        requestId,
        errorCode,
        errorType: 'service_error',
        message,
        details: {},
        retryable
      }
    })
  }

  disconnectClient(clientId, reason = 'server_initiated') {
    const ws = this.connectionMap.get(clientId)
    if (ws) {
      this._sendMessage(ws, {
        type: 'disconnect',
        id: uuidv4(),
        timestamp: Date.now(),
        data: { reason, message: `Server disconnecting client: ${reason}` }
      })
      setTimeout(() => {
        ws.close(1000, reason)
      }, 100)
      logger.info(`🔌 Manually disconnected client ${clientId}: ${reason}`)
    } else {
      logger.warn(`⚠️ Cannot disconnect client ${clientId}: not connected`)
    }
  }

  getStats() {
    return {
      totalConnections: this.wss?.clients.size || 0,
      authenticatedConnections: this.connectionMap.size,
      pendingRequests: this.pendingRequests.size
    }
  }

  sendTunnelControlMessage(clientId, type, data) {
    const ws = this.connectionMap.get(clientId)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} is not connected`)
    }
    this._sendMessage(ws, { type, id: uuidv4(), timestamp: Date.now(), data })
  }

  async sendTunnelBinaryFrame(clientId, buffer) {
    const ws = this.connectionMap.get(clientId)
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Client ${clientId} is not connected`)
    }
    await this._waitForWebSocketBuffer(ws, clientId)
    await new Promise((resolve, reject) => {
      ws.send(buffer, { binary: true }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  async _withRetry(action, { retries = 2, delayMs = 300, backoffFactor = 2 } = {}) {
    let attempt = 0
    let currentDelay = delayMs
    let lastError
    while (attempt <= retries) {
      try {
        return await action()
      } catch (error) {
        lastError = error
        const shouldRetry = attempt < retries && error?.retryable !== false
        if (!shouldRetry) {
          throw lastError
        }
        const waitMs = Math.max(currentDelay, 50)
        await new Promise((resolve) => setTimeout(resolve, waitMs))
        currentDelay *= backoffFactor
        attempt += 1
        logger.warn(
          `Retrying WebSocket action after failure (attempt ${attempt}/${retries}):`,
          error.message
        )
      }
    }
    throw lastError
  }

  async sendConfigUpdate(clientId, configPayload, options = {}) {
    const mergedOptions = {
      applyImmediately: options?.applyImmediately ?? true,
      timeout: options?.timeout ?? 30000,
      operator: options?.operator || 'system',
      summary: options?.summary || null
    }
    return this._withRetry(() => this._sendConfigUpdateOnce(clientId, configPayload, mergedOptions))
  }

  async _sendConfigUpdateOnce(clientId, configPayload, options = {}) {
    const {
      applyImmediately = true,
      timeout = 30000,
      operator = 'system',
      summary = null
    } = options
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      const error = new Error(`Client ${clientId} is not connected`)
      error.retryable = false
      throw error
    }
    const messageId = uuidv4()
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId)
        reject(new Error('Configuration update timeout'))
      }, timeout)

      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        clientId,
        metadata: { operator, summary }
      })

      this._sendMessage(ws, {
        type: 'config_update',
        id: messageId,
        timestamp: Date.now(),
        data: { config: configPayload, applyImmediately, summary }
      })

      logger.info(`⚙️ Sent config update to client ${clientId}`)
    })
  }

  async queryClientSystemHealth(clientId, timeout = 15000) {
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      const error = new Error(`Client ${clientId} is not connected`)
      error.retryable = false
      throw error
    }

    const messageId = uuidv4()
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId)
        reject(new Error('System health query timeout'))
      }, timeout)

      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        clientId
      })

      this._sendMessage(ws, {
        type: 'query_system_health',
        id: messageId,
        timestamp: Date.now(),
        data: {}
      })

      logger.info(`🩺 Querying system health from client ${clientId}`)
    })
  }

  async sendAccountCommand(clientId, operation, data, timeout = 30000) {
    return this._withRetry(() => this._sendAccountCommandOnce(clientId, operation, data, timeout))
  }

  async _sendAccountCommandOnce(clientId, operation, data, timeout) {
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      const error = new Error(`Client ${clientId} is not connected`)
      error.retryable = false
      throw error
    }

    const validOperations = ['add_account', 'update_account', 'delete_account']
    if (!validOperations.includes(operation)) {
      const error = new Error(`Invalid operation: ${operation}`)
      error.retryable = false
      throw error
    }

    const messageId = uuidv4()
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId)
        reject(new Error(`Account ${operation} timeout`))
      }, timeout)

      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        clientId
      })

      this._sendMessage(ws, {
        type: operation,
        id: messageId,
        timestamp: Date.now(),
        data
      })

      logger.info(`🔄 Sent ${operation} command to client ${clientId}`)
    })
  }

  async sendGenerateOAuthUrl(clientId, accountType, proxy = null, timeout = 30000) {
    const normalizedAccountType = this._normalizeAccountType(accountType)
    const endpoint = this._resolveOAuthEndpoint(normalizedAccountType, 'generate')
    const body = { proxy: proxy || null }
    logger.info(`🔑 Forwarding OAuth URL generation to client ${clientId}`, {
      accountType: normalizedAccountType
    })
    const result = await this.sendLocalRequest(
      clientId,
      { endpoint, method: 'POST', body },
      timeout
    )
    if (result?.sessionId) {
      this._cacheOAuthSession(clientId, result.sessionId, normalizedAccountType)
    }
    return result
  }

  async sendExchangeOAuthCode(clientId, sessionId, code, accountData, timeout = 60000) {
    const cachedType = sessionId ? this._getCachedOAuthAccountType(clientId, sessionId) : null
    const normalizedAccountType = this._normalizeAccountType(accountData?.accountType || cachedType)
    const endpoint = this._resolveOAuthEndpoint(normalizedAccountType, 'exchange')
    const body = this._buildOAuthExchangeBody(normalizedAccountType, {
      sessionId,
      code,
      accountData: accountData || {}
    })
    logger.info(`🔐 Forwarding OAuth exchange to client ${clientId}`, {
      accountType: normalizedAccountType
    })
    const result = await this.sendLocalRequest(
      clientId,
      { endpoint, method: 'POST', body },
      timeout
    )
    if (sessionId) {
      this._clearCachedOAuthSession(clientId, sessionId)
    }
    return result
  }

  _normalizeAccountType(accountType) {
    const t = (accountType || '').toLowerCase()
    if (['claude', 'claude-official', 'claude_console', 'claude-console'].includes(t)) {
      return 'claude'
    }
    if (t === 'gemini' || t === 'gemini-api') {
      return 'gemini'
    }
    if (t === 'openai' || t === 'openai-responses' || t === 'azure-openai') {
      return 'openai'
    }
    if (t === 'droid') {
      return 'droid'
    }
    return t
  }

  _resolveOAuthEndpoint(accountType, action) {
    const segmentMap = {
      claude: 'claude-accounts',
      gemini: 'gemini-accounts',
      openai: 'openai-accounts',
      droid: 'droid-accounts'
    }
    const segment = segmentMap[accountType]
    if (!segment) {
      throw new Error(`Unsupported OAuth account type: ${accountType || 'unknown'}`)
    }
    if (action === 'generate') {
      return `/admin/${segment}/generate-auth-url`
    }
    if (action === 'exchange') {
      return `/admin/${segment}/exchange-code`
    }
    throw new Error(`Unsupported OAuth action: ${action}`)
  }

  _buildOAuthExchangeBody(accountType, payload) {
    const { sessionId, code, accountData } = payload
    const base = { sessionId }
    if (accountType === 'claude') {
      const trimmed = typeof code === 'string' ? code.trim() : ''
      if (trimmed && trimmed.startsWith('http')) {
        return { ...base, callbackUrl: trimmed }
      }
      return { ...base, callbackUrl: trimmed }
    }
    if (accountType === 'droid') {
      return { ...base, proxy: accountData?.proxy || null }
    }
    return {
      ...base,
      code: typeof code === 'string' ? code.trim() : code,
      proxy: accountData?.proxy || null
    }
  }

  _cacheOAuthSession(clientId, sessionId, accountType) {
    if (!sessionId) {
      return
    }
    this.oauthSessions.set(sessionId, {
      clientId,
      accountType,
      createdAt: Date.now()
    })
  }

  _getCachedOAuthAccountType(clientId, sessionId) {
    const entry = this.oauthSessions.get(sessionId)
    if (!entry) {
      return null
    }
    if (entry.clientId && entry.clientId !== clientId) {
      return null
    }
    return entry.accountType || null
  }

  _clearCachedOAuthSession(clientId, sessionId) {
    const entry = this.oauthSessions.get(sessionId)
    if (!entry) {
      return
    }
    if (!entry.clientId || entry.clientId === clientId) {
      this.oauthSessions.delete(sessionId)
    }
  }

  async sendLocalRequest(clientId, payload, timeout = 30000) {
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      const error = new Error(`Client ${clientId} is not connected`)
      error.retryable = false
      throw error
    }

    const apiKey = await clientService.getDecryptedApiKey(clientId)
    const requestId = `req-${uuidv4()}`
    const headers = {
      ...(payload.headers || {}),
      'x-ws-internal-key': apiKey,
      'x-api-key': apiKey
    }
    const service = payload.service || payload.options?.service || 'admin'

    const requestPayload = {
      apiKey,
      requestId,
      service,
      endpoint: payload.endpoint,
      method: payload.method || 'POST',
      headers,
      body: payload.body || {},
      options: { ...(payload.options || {}), local: true, service }
    }

    const result = await this.sendNonStreamRequest(clientId, requestPayload, timeout)
    return this._unwrapLocalResponse(result)
  }

  async sendLocalStreamRequest(clientId, payload, onChunk, timeout = 30000) {
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      const error = new Error(`Client ${clientId} is not connected`)
      error.retryable = false
      throw error
    }

    const apiKey = await clientService.getDecryptedApiKey(clientId)
    const requestId = `req-${uuidv4()}`
    const headers = {
      ...(payload.headers || {}),
      'x-ws-internal-key': apiKey,
      'x-api-key': apiKey
    }
    const service = payload.service || payload.options?.service || 'admin'

    const requestPayload = {
      apiKey,
      requestId,
      service,
      endpoint: payload.endpoint,
      method: payload.method || 'POST',
      headers,
      body: payload.body || {},
      options: { ...(payload.options || {}), local: true, service, stream: true }
    }

    return await this.sendStreamRequest(clientId, requestPayload, onChunk, timeout)
  }

  _unwrapLocalResponse(result) {
    const body = result?.body !== undefined ? result.body : result
    if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'success')) {
      if (body.success === false) {
        const message = body.message || body.error || 'Local API request failed'
        const error = new Error(message)
        error.details = body
        throw error
      }
      return body.data !== undefined ? body.data : body
    }
    return body
  }

  async sendNonStreamRequest(clientId, requestPayload, timeout = 600000) {
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      throw new Error(`Client ${clientId} is not connected`)
    }
    const { requestId } = requestPayload
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, timeout)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        clientId,
        onChunk: null
      })

      this._sendMessage(ws, {
        type: 'request',
        id: uuidv4(),
        timestamp: Date.now(),
        data: requestPayload
      })

      logger.debug(`📤 Sent non-stream request ${requestId} to client ${clientId}`)
    })
  }

  async sendStreamRequest(clientId, requestPayload, onChunk, timeout = 600000) {
    const ws = this.connectionMap.get(clientId)
    if (!ws) {
      throw new Error(`Client ${clientId} is not connected`)
    }

    const { requestId } = requestPayload
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Request timeout'))
      }, timeout)

      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        clientId,
        onChunk
      })

      this._sendMessage(ws, {
        type: 'request',
        id: uuidv4(),
        timestamp: Date.now(),
        data: requestPayload
      })

      logger.debug(`📤 Sent stream request ${requestId} to client ${clientId}`)
    })
  }
}

module.exports = WebSocketServer
