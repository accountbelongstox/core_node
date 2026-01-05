'use strict'

const { v4: uuidv4 } = require('uuid')
const logger = require('../../utils/logger')
const { buildVpnDataFrame } = require('../../websocket/websocketRequestHandler')
const tunnelStore = require('./tunnelStore')
const tunnelStatsService = require('./tunnelStatsService')
const { STATUS, ERROR_CODES, normalizeAckPayload, normalizeErrorCode } = require('../messageContract')

// Minimal bridge to connect Socks5 server with WebSocket tunnel messages.
// Keeps state per session and forwards data/control between TCP sockets and WS clients.
class TunnelBridge {
  constructor({ vpnService } = {}) {
    this.vpnService = vpnService
    this.wsServer = null
    this.sessions = new Map()
    this.pendingConnects = new Map()
    this.downstreamBufferLimit = 2 * 1024 * 1024
    this.socketDrainTimeout = 10000
  }

  setVpnService(vpnService) {
    this.vpnService = vpnService
    return this
  }

  setWsServer(wsServer) {
    this.wsServer = wsServer
    if (wsServer && typeof wsServer.setTunnelBridge === 'function') {
      wsServer.setTunnelBridge(this)
    }
    return this
  }

  async createSession(tunnel, socket, connectInfo) {
    if (!this.wsServer) {
      throw new Error('Tunnel bridge not initialized with WebSocket server')
    }

    const { clientId } = tunnel
    const storedTunnel =
      tunnelStore.getTunnel(tunnel.tunnelId) ||
      (await tunnelStore.saveTunnel({
        tunnelId: tunnel.tunnelId || tunnel.id || tunnel.tunnelID || 'unknown',
        clientId,
        passwordHash: tunnel.passwordHash
      }))
    const sessionId = uuidv4()

    const sessionContext = {
      sessionId,
      tunnelId: storedTunnel.tunnelId,
      clientId,
      socket,
      targetHost: connectInfo.targetHost,
      targetPort: connectInfo.targetPort,
      sourceIp: connectInfo.sourceIp,
      sourcePort: connectInfo.sourcePort,
      status: 'connecting',
      createdAt: Date.now(),
      sequenceUp: 0,
      bytesUp: 0,
      bytesDown: 0,
      _downstreamState: null
    }

    this.sessions.set(sessionId, sessionContext)

    const connectRequest = {
      tunnelId: sessionContext.tunnelId,
      sessionId,
      targetHost: connectInfo.targetHost,
      targetPort: connectInfo.targetPort,
      sourceIp: connectInfo.sourceIp,
      sourcePort: connectInfo.sourcePort
    }

    const pending = this._createPendingPromise(sessionId)
    const startedAt = pending.startedAt

    try {
      if (typeof this.wsServer.sendTunnelControlMessage === 'function') {
        this.wsServer.sendTunnelControlMessage(clientId, 'tunnel_connect', connectRequest)
      } else if (typeof this.wsServer._handleVpnData === 'function') {
        // fallback: not ideal, but keep compatibility with current client handler signature
        this.wsServer._handleVpnData({ clientId }, connectRequest)
      } else {
        throw new Error('wsServer missing tunnel control sender')
      }
    } catch (error) {
      this.pendingConnects.delete(sessionId)
      clearTimeout(pending.timeout)
      this.sessions.delete(sessionId)
      const errorCode = normalizeErrorCode(error) || ERROR_CODES.CONNECT_FAILED
      await tunnelStatsService.recordHandshake(sessionContext.tunnelId, {
        success: false,
        latencyMs: startedAt ? Date.now() - startedAt : 0,
        errorCode,
        message: error.message
      })
      throw error
    }

    const rawResult = await pending.promise
    const normalized = normalizeAckPayload({ sessionId, ...rawResult })
    const latencyMs = startedAt ? Date.now() - startedAt : 0

    const isSuccess = normalized.success !== false && normalized.status !== STATUS.ERROR
    const errorCode = isSuccess ? null : normalized.errorCode || ERROR_CODES.CLIENT_CONNECT_FAILED

    await tunnelStatsService.recordHandshake(sessionContext.tunnelId, {
      success: isSuccess,
      latencyMs,
      errorCode,
      message: normalized.message || rawResult?.message || rawResult?.error
    })

    if (!isSuccess) {
      this.sessions.delete(sessionId)
      const errorMessage =
        normalized.message || rawResult?.error || errorCode || 'CLIENT_CONNECT_FAILED'
      throw new Error(errorMessage)
    }

    sessionContext.status = 'active'
    sessionContext.assignedAddress = normalized.assignedAddress
    sessionContext.assignedPort = normalized.assignedPort
    tunnelStatsService.updateActive(sessionContext.tunnelId, 1)
    return sessionContext
  }

  handleConnectAck(clientId, payload) {
    const { sessionId } = payload || {}
    const pending = this.pendingConnects.get(sessionId)
    if (!pending) {
      logger.warn('⚠️ 收到未知的 tunnel_connect_ack', { sessionId })
      return
    }
    clearTimeout(pending.timeout)
    const normalized = normalizeAckPayload(payload || {})
    if (normalized.success) {
      pending.resolve(normalized)
    } else {
      pending.resolve({
        ...normalized,
        error: normalized.message || normalized.errorCode || 'CLIENT_FAILED_TO_CONNECT'
      })
    }
    this.pendingConnects.delete(sessionId)
  }

  async handleClientDisconnect(clientId, payload) {
    const { sessionId, reason } = payload
    const session = this.sessions.get(sessionId)
    if (!session) return
    logger.info('🔌 客户端请求关闭会话', { sessionId, reason })
    await this._closeSessionInternal(sessionId, reason || 'client_closed')
  }

  async handleBinaryData(clientId, frame) {
    const session = this.sessions.get(frame.sessionId)
    if (!session) {
      logger.warn('⚠️ 收到未知会话的二进制数据', { sessionId: frame.sessionId })
      return
    }
    if (!session.socket || session.socket.destroyed) {
      logger.warn('⚠️ Socket 已关闭，忽略下行数据', { sessionId: frame.sessionId })
      return
    }
    try {
      session.bytesDown += frame.payload.length
      await this._enqueueDownstreamPayload(session, frame.payload)
      tunnelStatsService.recordData(session.tunnelId, { bytesOut: frame.payload.length })
    } catch (error) {
      logger.warn('⚠️ 下行数据写入失败', {
        sessionId: frame.sessionId,
        error: error.message
      })
      await tunnelStatsService.recordError(session.tunnelId, {
        errorCode: normalizeErrorCode(error),
        message: error.message
      })
      await this._closeSessionInternal(session.sessionId, 'downstream_error')
    }
  }

  async forwardData(sessionId, buffer) {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error('SESSION_NOT_FOUND')
    }
    session.sequenceUp += 1
    session.bytesUp += buffer.length
    const frame = buildVpnDataFrame(sessionId, buffer)
    try {
      if (typeof this.wsServer.sendTunnelBinaryFrame === 'function') {
        await this.wsServer.sendTunnelBinaryFrame(session.clientId, frame)
      } else if (typeof this.wsServer._handleVpnData === 'function') {
        await this.wsServer._handleVpnData({ clientId: session.clientId }, frame)
      } else {
        throw new Error('WS_SERVER_SEND_FAILED')
      }
      tunnelStatsService.recordData(session.tunnelId, { bytesIn: buffer.length })
    } catch (error) {
      await tunnelStatsService.recordError(session.tunnelId, {
        errorCode: normalizeErrorCode(error),
        message: error.message
      })
      throw error
    }
  }

  async closeSession(sessionId, reason = 'server_closed') {
    await this._closeSessionInternal(sessionId, reason)
  }

  getSessionsForTunnel(tunnelId) {
    const sessions = []
    for (const session of this.sessions.values()) {
      if (session.tunnelId === tunnelId) {
        sessions.push({
          sessionId: session.sessionId,
          tunnelId: session.tunnelId,
          clientId: session.clientId,
          sourceIp: session.sourceIp,
          sourcePort: session.sourcePort,
          targetHost: session.targetHost,
          targetPort: session.targetPort,
          createdAt: session.createdAt,
          bytesUp: session.bytesUp,
          bytesDown: session.bytesDown,
          status: session.status
        })
      }
    }
    return sessions
  }

  _createPendingPromise(sessionId) {
    const pending = { startedAt: Date.now() }
    pending.promise = new Promise((resolve, reject) => {
      pending.resolve = resolve
      pending.reject = reject
    })
    pending.timeout = setTimeout(() => {
      if (this.pendingConnects.has(sessionId)) {
        this.pendingConnects.delete(sessionId)
        pending.resolve({
          success: false,
          status: STATUS.ERROR,
          errorCode: ERROR_CODES.CLIENT_CONNECT_TIMEOUT,
          message: 'Client connect ack timeout'
        })
      }
    }, 15000)
    if (typeof pending.timeout.unref === 'function') {
      pending.timeout.unref()
    }
    this.pendingConnects.set(sessionId, pending)
    return pending
  }

  async _closeSessionInternal(sessionId, reason) {
    const session = this.sessions.get(sessionId)
    if (!session) return

    this._clearDownstreamQueue(session, reason)
    this.sessions.delete(sessionId)

    if (session.socket && !session.socket.destroyed) {
      try {
        session.socket.end()
      } catch (error) {
        logger.warn('⚠️ 关闭 socket 时出错', { sessionId, error: error.message })
      }
    }

    if (this.wsServer) {
      try {
        if (typeof this.wsServer.sendTunnelControlMessage === 'function') {
          this.wsServer.sendTunnelControlMessage(session.clientId, 'tunnel_disconnect', {
            sessionId,
            reason
          })
        }
      } catch (error) {
        logger.warn('⚠️ 通知客户端断开失败', { sessionId, error: error.message })
      }
    }
    if (session.tunnelId) {
      await tunnelStatsService.updateActive(session.tunnelId, -1)
    }
  }

  async _enqueueDownstreamPayload(session, payload) {
    if (!session.socket || session.socket.destroyed) {
      const error = new Error('Socket is closed')
      error.code = 'socket_closed'
      throw error
    }

    if (!session._downstreamState) {
      session._downstreamState = { queue: [], queuedBytes: 0, flushPromise: null }
    }
    const state = session._downstreamState
    let resolveEntry
    let rejectEntry
    const entryPromise = new Promise((resolve, reject) => {
      resolveEntry = resolve
      rejectEntry = reject
    })

    state.queue.push({ payload, resolve: resolveEntry, reject: rejectEntry })
    state.queuedBytes += payload.length

    if (this.downstreamBufferLimit > 0 && state.queuedBytes > this.downstreamBufferLimit) {
      state.queue.pop()
      state.queuedBytes -= payload.length
      const error = new Error('DOWNSTREAM_BUFFER_LIMIT_EXCEEDED')
      error.code = 'downstream_overflow'
      rejectEntry(error)
      throw error
    }

    if (!state.flushPromise) {
      state.flushPromise = this._flushDownstreamQueue(session, state).catch((error) => {
        while (state.queue.length > 0) {
          const pending = state.queue.shift()
          state.queuedBytes -= pending.payload.length
          pending.reject(error)
        }
        session._downstreamState = null
        throw error
      })
    }

    return entryPromise
  }

  async _flushDownstreamQueue(session, state) {
    try {
      while (state.queue.length > 0) {
        if (!session.socket || session.socket.destroyed) {
          const error = new Error('Socket is closed')
          error.code = 'socket_closed'
          throw error
        }

        const entry = state.queue.shift()
        state.queuedBytes -= entry.payload.length

        let writable = true
        try {
          writable = session.socket.write(entry.payload)
        } catch (error) {
          entry.reject(error)
          throw error
        }

        entry.resolve()

        if (!writable) {
          await this._waitForSocketDrain(session.socket)
        }
      }
    } finally {
      state.flushPromise = null
      if (!state.queue.length) {
        session._downstreamState = null
      }
    }
  }

  _waitForSocketDrain(socket) {
    return new Promise((resolve, reject) => {
      let settled = false
      const cleanup = () => {
        if (settled) return
        settled = true
        if (typeof socket.off === 'function') {
          socket.off('drain', handleDrain)
          socket.off('error', handleError)
          socket.off('close', handleClose)
        } else {
          socket.removeListener('drain', handleDrain)
          socket.removeListener('error', handleError)
          socket.removeListener('close', handleClose)
        }
        clearTimeout(timeout)
      }

      const handleDrain = () => {
        cleanup()
        resolve()
      }
      const handleError = (error) => {
        cleanup()
        reject(error)
      }
      const handleClose = () => {
        const error = new Error('Socket closed during drain')
        error.code = 'socket_closed'
        cleanup()
        reject(error)
      }

      const timeout = setTimeout(() => {
        const error = new Error('Socket drain timeout')
        error.code = 'downstream_drain_timeout'
        cleanup()
        reject(error)
      }, this.socketDrainTimeout)
      if (typeof timeout.unref === 'function') {
        timeout.unref()
      }

      if (typeof socket.once === 'function') {
        socket.once('drain', handleDrain)
        socket.once('error', handleError)
        socket.once('close', handleClose)
      } else {
        cleanup()
        reject(new Error('Socket does not support backpressure events'))
      }
    })
  }

  _clearDownstreamQueue(session, reason = 'session_closed') {
    if (!session || !session._downstreamState || !session._downstreamState.queue) {
      return
    }
    const error = new Error(reason)
    error.code = reason
    while (session._downstreamState.queue.length > 0) {
      const pending = session._downstreamState.queue.shift()
      session._downstreamState.queuedBytes -= pending.payload.length
      pending.reject(error)
    }
    session._downstreamState = null
  }
}

module.exports = TunnelBridge
