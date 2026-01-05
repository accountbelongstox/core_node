'use strict'

const net = require('net')
const { EventEmitter } = require('events')
const { v4: uuidv4 } = require('uuid')
const logger = require('../utils/logger')
const { buildFrame } = require('./binaryCodec')
const { FRAME_TYPES, MESSAGE_TYPES } = require('./constants')

class VpnSessionController extends EventEmitter {
  constructor(options = {}) {
    super()

    this.websocketClient = options.websocketClient
    this.config = options.config || {}
    this.bufferPool = options.bufferPool
    this.storage = options.storage

    this.sendControlMessage = async () => {}
    this.sendBinaryFrame = async () => {}

    this.sessions = new Map()
    this.activeSessions = 0
  }

  setControlSender(fn) {
    if (typeof fn === 'function') {
      this.sendControlMessage = fn
    }
  }

  setBinarySender(fn) {
    if (typeof fn === 'function') {
      this.sendBinaryFrame = fn
    }
  }

  async initialize() {}

  async createSession(context = {}) {
    const limit = this.config.maxConcurrentSessions
    if (limit && this.activeSessions >= limit) {
      throw new Error('Max concurrent VPN sessions reached')
    }

    const sessionId = context.sessionId || uuidv4()
    const { targetHost, targetPort } = context
    const messageNamespace = context.messageNamespace || 'legacy'

    if (!targetHost || !targetPort) {
      throw new Error('Target host and port are required')
    }

    const socket = new net.Socket()
    const connectionTimeout = this.config.connectionTimeout || 30000

    const connectionPromise = new Promise((resolve, reject) => {
      const cleanup = () => {
        socket.removeListener('error', onError)
        socket.removeListener('connect', onConnect)
        socket.removeListener('timeout', onTimeout)
      }

      const onError = (error) => {
        cleanup()
        reject(error)
      }

      const onConnect = () => {
        cleanup()
        resolve()
      }

      const onTimeout = () => {
        cleanup()
        const timeoutError = new Error('Target connection timeout')
        timeoutError.code = 'ETIMEDOUT'
        reject(timeoutError)
      }

      socket.once('error', onError)
      socket.once('connect', onConnect)

      if (connectionTimeout > 0) {
        socket.setTimeout(connectionTimeout, onTimeout)
      }

      socket.connect(targetPort, targetHost)
    })

    try {
      await connectionPromise
    } catch (error) {
      socket.destroy()
      throw error
    }

    socket.setTimeout(0)
    socket.setKeepAlive(true)
    socket.setNoDelay(true)

    const sessionState = {
      sessionId,
      socket,
      targetHost,
      targetPort,
      messageNamespace,
      sequence: 0,
      bytesOut: 0,
      bytesIn: 0,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      idleTimer: null,
      dataTimer: null
    }

    this.sessions.set(sessionId, sessionState)
    this.activeSessions += 1

    this.refreshActivity(sessionState)

    socket.on('data', (chunk) => {
      this.handleUpstreamData(sessionId, chunk).catch((err) => {
        logger.error('Failed to handle upstream data', { error: err.message, sessionId })
        this.closeSession(sessionId, 'upstream_error').catch(() => {})
      })
    })

    socket.on('close', () => {
      this.closeSession(sessionId, 'target_socket_closed').catch(() => {})
    })

    socket.on('error', (error) => {
      logger.warn('Target socket error', { error: error.message, sessionId })
      this.closeSession(sessionId, 'socket_error').catch(() => {})
    })

    await this.recordSession(sessionState)
    return {
      sessionId,
      targetHost,
      targetPort,
      localAddress: socket.localAddress,
      localPort: socket.localPort
    }
  }

  async closeSession(sessionId, reason = 'unknown', options = {}) {
    const { notifyRemote = true } = options
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }

    if (session.socket && !session.socket.destroyed) {
      try {
        session.socket.end()
      } catch (error) {
        // 仅记录调试信息，不中断关闭流程
        this.emit('socketError', { sessionId, error })
      }
      session.socket.destroy()
    }

    if (session.idleTimer) {
      clearTimeout(session.idleTimer)
      session.idleTimer = null
    }

    if (session.dataTimer) {
      clearTimeout(session.dataTimer)
      session.dataTimer = null
    }

    this.sessions.delete(sessionId)
    this.activeSessions = Math.max(0, this.activeSessions - 1)

    if (this.storage?.deleteSession) {
      await this.storage.deleteSession(sessionId)
    }

    if (notifyRemote) {
      const messageType =
        session.messageNamespace === 'tunnel'
          ? MESSAGE_TYPES.TUNNEL_DISCONNECT
          : MESSAGE_TYPES.SESSION_CLOSE

      await this.sendControlMessage({
        type: messageType,
        data: {
          sessionId,
          reason
        }
      })
    }

    this.emit('sessionClosed', { sessionId, reason })
  }

  async handleUpstreamData(sessionId, data) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    if (!Buffer.isBuffer(data) || data.length === 0) {
      return
    }

    this.refreshActivity(session)

    const sequence = session.sequence++
    const frame = buildFrame({
      type: FRAME_TYPES.DATA,
      sessionId,
      sequence,
      payload: data
    })

    await this.sendBinaryFrame(frame)

    session.bytesOut += data.length
  }

  async handleDownstreamFrame(frame) {
    if (!frame || !frame.sessionId) {
      return
    }

    const session = this.sessions.get(frame.sessionId)
    if (!session || !session.socket) {
      logger.warn('Downstream frame received for unknown session', {
        sessionId: frame.sessionId
      })
      return
    }

    const payload = frame.payload || Buffer.alloc(0)
    if (payload.length === 0) {
      return
    }

    this.refreshActivity(session)

    const writable = session.socket.write(payload)
    session.bytesIn += payload.length

    if (!writable) {
      session.socket.once('drain', () => {
        this.emit('sessionDrain', { sessionId: frame.sessionId })
      })
    }
  }

  refreshActivity(session) {
    session.lastActivityAt = Date.now()

    const { idleTimeout, dataTimeout } = this.config

    if (idleTimeout > 0) {
      if (session.idleTimer) {
        clearTimeout(session.idleTimer)
      }
      session.idleTimer = setTimeout(() => {
        this.closeSession(session.sessionId, 'idle_timeout').catch(() => {})
      }, idleTimeout)
    }

    if (dataTimeout > 0) {
      if (session.dataTimer) {
        clearTimeout(session.dataTimer)
      }
      session.dataTimer = setTimeout(() => {
        this.closeSession(session.sessionId, 'data_timeout').catch(() => {})
      }, dataTimeout)
    }

    if (session.socket && this.config.connectionTimeout > 0) {
      session.socket.setTimeout(this.config.connectionTimeout)
    }
  }

  async recordSession(sessionState) {
    if (!this.storage?.recordSession) {
      return
    }

    await this.storage.recordSession(sessionState.sessionId, {
      sessionId: sessionState.sessionId,
      targetHost: sessionState.targetHost,
      targetPort: sessionState.targetPort,
      createdAt: sessionState.createdAt,
      lastActivityAt: sessionState.lastActivityAt
    })
  }
}

module.exports = VpnSessionController
