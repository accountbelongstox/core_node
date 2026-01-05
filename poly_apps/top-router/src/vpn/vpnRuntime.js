'use strict'

const { EventEmitter } = require('events')
const logger = require('../utils/logger')
const datastore = require('../models/datastore')
const BufferPool = require('./bufferPool')
const VpnSessionController = require('./vpnSessionController')
const VpnStorageService = require('./vpnStorageService')
const VpnMetricsService = require('./vpnMetricsService')
const { parseFrame } = require('./binaryCodec')
const { MESSAGE_TYPES } = require('./constants')
const {
  STATUS,
  ERROR_CODES,
  normalizeControlPayload,
  normalizeErrorCode
} = require('./messageContract')

class VpnRuntime extends EventEmitter {
  constructor(options = {}) {
    super()

    this.config = options.config || {}
    this.enabled = Boolean(this.config.enabled)

    this.websocketClient = options.websocketClient || null
    this.datastore = options.datastore || datastore

    this.state = {
      initialized: false,
      running: false,
      startTimestamp: null
    }

    this.components = {
      sessionController: null,
      bufferPool: null,
      metrics: null,
      storage: null
    }
  }

  isEnabled() {
    return this.enabled
  }

  isRunning() {
    return this.state.running
  }

  attachWebSocketClient(websocketClient) {
    this.websocketClient = websocketClient
  }

  async initialize() {
    if (!this.isEnabled()) {
      logger.info('VPN runtime is disabled by configuration')
      return
    }

    if (this.state.initialized) {
      return
    }

    logger.info('Initializing VPN runtime scaffolding')

    this.components.bufferPool = new BufferPool({
      highWaterMark: this.config.buffers?.highWaterMark,
      poolSize: this.config.buffers?.poolSize
    })

    this.components.storage = new VpnStorageService({ datastore: this.datastore })

    this.components.sessionController = new VpnSessionController({
      websocketClient: this.websocketClient,
      config: this.config.tunnel,
      bufferPool: this.components.bufferPool,
      storage: this.components.storage
    })

    this.components.sessionController.setControlSender(async (message) => {
      logger.debug('Sending VPN control message', { type: message?.type })
      await this.sendControlMessage(message)
    })

    this.components.sessionController.setBinarySender(async (buffer) => {
      await this.sendBinaryFrame(buffer)
    })

    this.components.sessionController.on('sessionClosed', (payload) => {
      this.emit('sessionClosed', payload)
    })

    this.components.metrics = new VpnMetricsService({
      config: this.config.metrics,
      statsProvider: () => this.getRuntimeStats(),
      logger
    })

    this.state.initialized = true
  }

  async start() {
    if (!this.isEnabled()) {
      logger.debug('VPN runtime start skipped (disabled)')
      return
    }

    if (!this.state.initialized) {
      await this.initialize()
    }

    if (this.state.running) {
      logger.debug('VPN runtime already running')
      return
    }

    logger.info('Starting VPN runtime (egress mode)')

    if (this.components.sessionController?.initialize) {
      await this.components.sessionController.initialize()
    }

    if (this.components.metrics) {
      this.components.metrics.start()
    }

    await this.recoverSessions()

    this.state.running = true
    this.state.startTimestamp = Date.now()
  }

  async stop({ reason = 'shutdown' } = {}) {
    if (!this.state.running) {
      return
    }

    logger.info('Stopping VPN runtime', { reason })

    if (this.components.metrics) {
      this.components.metrics.stop()
    }

    if (this.components.sessionController) {
      const sessions = Array.from(this.components.sessionController.sessions.keys())
      await Promise.all(
        sessions.map((id) =>
          this.components.sessionController.closeSession(id, 'shutdown', { notifyRemote: true })
        )
      )
    }

    this.state.running = false
  }

  async handleControlMessage(message) {
    if (!this.isEnabled()) {
      return
    }

    const { type } = message || {}
    const payload = normalizeControlPayload(message)

    switch (type) {
      case MESSAGE_TYPES.SESSION_OPEN:
      case MESSAGE_TYPES.TUNNEL_CONNECT:
        await this.handleSessionOpenRequest(payload, { requestType: type })
        break
      case MESSAGE_TYPES.SESSION_CLOSE:
      case MESSAGE_TYPES.TUNNEL_DISCONNECT:
        if (payload?.sessionId) {
          logger.debug('Server requested VPN session close', payload)
          await this.components.sessionController.closeSession(payload.sessionId, payload.reason, {
            notifyRemote: false
          })
        }
        break
      case MESSAGE_TYPES.SESSION_ERROR:
        logger.warn('VPN session error reported by server', payload)
        break
      case MESSAGE_TYPES.TUNNEL_STATS:
        this.emit('stats', payload)
        break
      default:
        logger.debug('Unhandled VPN control message', { type })
    }
  }

  async handleSessionOpenRequest(payload = {}, options = {}) {
    if (!this.components.sessionController) {
      logger.warn('Session controller not ready, cannot open VPN session')
      return
    }

    const { requestType } = options
    const isTunnelProtocol = requestType === MESSAGE_TYPES.TUNNEL_CONNECT
    const responseType = isTunnelProtocol
      ? MESSAGE_TYPES.TUNNEL_CONNECT_ACK
      : MESSAGE_TYPES.SESSION_OPEN_ACK

    const { sessionId, targetHost, targetPort } = payload

    if (!sessionId || !targetHost || !targetPort) {
      logger.warn('Invalid session open request received', payload)
      await this.sendControlMessage({
        type: responseType,
        data: {
          sessionId: sessionId || null,
          status: STATUS.ERROR,
          success: false,
          errorCode: ERROR_CODES.INVALID_REQUEST,
          message: 'sessionId, targetHost, and targetPort are required'
        }
      })
      return
    }

    try {
      const sessionInfo = await this.components.sessionController.createSession({
        sessionId,
        targetHost,
        targetPort,
        metadata: payload,
        messageNamespace: isTunnelProtocol ? 'tunnel' : 'legacy'
      })

      await this.sendControlMessage({
        type: responseType,
        data: {
          sessionId,
          status: STATUS.SUCCESS,
          success: true,
          targetHost: sessionInfo.targetHost,
          targetPort: sessionInfo.targetPort,
          assignedAddress: sessionInfo.localAddress,
          assignedPort: sessionInfo.localPort
        }
      })
    } catch (error) {
      const normalizedErrorCode =
        normalizeErrorCode(error) || normalizeErrorCode(error?.code) || ERROR_CODES.CONNECT_FAILED
      logger.error('Failed to open VPN session on client', {
        sessionId,
        error: error.message,
        errorCode: normalizedErrorCode
      })

      await this.sendControlMessage({
        type: responseType,
        data: {
          sessionId,
          status: STATUS.ERROR,
          success: false,
          errorCode: normalizedErrorCode,
          message: error.message || 'Failed to connect to target host',
          targetHost,
          targetPort
        }
      })
    }
  }

  async handleBinaryFrame(buffer) {
    if (!this.isEnabled()) {
      return
    }

    try {
      const frame = parseFrame(buffer)
      await this.components.sessionController.handleDownstreamFrame(frame)
    } catch (error) {
      const errorDetails = error.details || {}
      logger.error('Failed to parse VPN binary frame', {
        error: error.message,
        ...errorDetails
      })
    }
  }

  getStatus() {
    return {
      enabled: this.isEnabled(),
      running: this.isRunning(),
      initialized: this.state.initialized,
      uptime:
        this.state.running && this.state.startTimestamp
          ? Date.now() - this.state.startTimestamp
          : 0,
      components: {
        sessionController: Boolean(this.components.sessionController),
        bufferPool: Boolean(this.components.bufferPool),
        metrics: Boolean(this.components.metrics)
      }
    }
  }

  getRuntimeStats() {
    const sessionCount = this.components.sessionController
      ? this.components.sessionController.sessions.size
      : 0

    return {
      sessionCount
    }
  }

  registerEventHandlers() {}

  async handleConnectRequest() {
    logger.debug('handleConnectRequest is deprecated in egress mode')
  }

  async recoverSessions() {
    if (!this.components.storage?.listActiveSessionIds) {
      return
    }

    const sessionIds = await this.components.storage.listActiveSessionIds()
    if (!sessionIds || sessionIds.length === 0) {
      return
    }

    logger.info('Clearing stale VPN session metadata after reconnect', { count: sessionIds.length })

    for (const sessionId of sessionIds) {
      await this.components.storage.deleteSession(sessionId)
      this.components.sessionController.sessions.delete(sessionId)
    }
  }

  async sendControlMessage(message) {
    if (!this.websocketClient) {
      throw new Error('WebSocket client not available for VPN control messages')
    }

    await this.websocketClient.sendMessage(message)
  }

  async sendBinaryFrame(buffer) {
    if (!this.websocketClient) {
      throw new Error('WebSocket client not available for VPN binary frames')
    }

    logger.debug('Sending VPN binary frame', { length: buffer?.length || 0 })
    await this.websocketClient.sendBinary(buffer)
  }
}

module.exports = VpnRuntime
