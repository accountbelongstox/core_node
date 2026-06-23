'use strict'

const net = require('net')
const logger = require('../../utils/logger')
const config = require('../../../config/config')

const AUTH_USERNAME = 'vpn'
const DEFAULT_HANDSHAKE_LIMIT = 64 * 1024
const DEFAULT_SHUTDOWN_TIMEOUT = 5000

class Socks5Server {
  constructor({ tunnelId, clientId, vpnService, bridge }) {
    this.tunnelId = tunnelId
    this.clientId = clientId
    this.vpnService = vpnService
    this.bridge = bridge
    this.server = null
    this.connections = new Map()
    const handshakeLimit =
      Number(config.vpn?.buffer?.handshakeMaxBytes) > 0
        ? Number(config.vpn.buffer.handshakeMaxBytes)
        : DEFAULT_HANDSHAKE_LIMIT

    const shutdownTimeoutConfig =
      Number(config.vpn?.serverShutdownTimeout) > 0
        ? Number(config.vpn.serverShutdownTimeout)
        : Number(config.vpn?.buffer?.shutdownTimeout)
    this.shutdownTimeout =
      Number.isFinite(shutdownTimeoutConfig) && shutdownTimeoutConfig > 0
        ? shutdownTimeoutConfig
        : DEFAULT_SHUTDOWN_TIMEOUT

    this.config = {
      maxConnections: 100,
      idleTimeout: 300000,
      dataTimeout: 60000,
      handshakeMaxBytes: handshakeLimit
    }
  }

  async start(options = {}) {
    if (this.server) {
      throw new Error('SOCKS5_SERVER_ALREADY_STARTED')
    }

    this.config = {
      ...this.config,
      ...options
    }

    const { port } = this.config
    if (!port) {
      throw new Error('SOCKS5_PORT_REQUIRED')
    }

    await new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => this._handleConnection(socket))

      const handleError = (error) => {
        logger.error('❌ SOCKS5 服务器启动失败', { tunnelId: this.tunnelId, error: error.message })
        reject(error)
      }

      this.server.once('error', handleError)

      this.server.listen(port, '0.0.0.0', () => {
        this.server.removeListener('error', handleError)
        logger.info('✅ SOCKS5 服务器已启动', { tunnelId: this.tunnelId, port })
        resolve()
      })
    })
  }

  async stop({ graceful = true } = {}) {
    if (!this.server) {
      return
    }

    logger.info('🛑 停止 SOCKS5 服务器', { tunnelId: this.tunnelId })

    for (const [sessionId, connection] of this.connections.entries()) {
      try {
        connection.closing = true
        connection.socket.end()
        connection.socket.destroy()
      } catch (error) {
        logger.debug('关闭连接失败', { sessionId, error: error.message })
      }
      this.connections.delete(sessionId)
    }

    await new Promise((resolve) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        resolve()
      }

      const timeout = setTimeout(() => {
        settled = true
        logger.warn('⚠️ SOCKS5 服务器关闭超时，强制结束', {
          tunnelId: this.tunnelId,
          timeoutMs: this.shutdownTimeout
        })
        resolve()
      }, this.shutdownTimeout)
      if (typeof timeout.unref === 'function') {
        timeout.unref()
      }

      this.server.close(() => finish())
      if (!graceful) {
        this.server.emit('close')
      }
    }).catch((error) => {
      logger.warn('⚠️ SOCKS5 服务器关闭异常', {
        tunnelId: this.tunnelId,
        error: error.message
      })
    })

    this.server = null
  }

  async _handleConnection(socket) {
    if (this.connections.size >= this.config.maxConnections) {
      logger.warn('⚠️ SOCKS5 连接数已达上限，拒绝新连接', {
        tunnelId: this.tunnelId,
        max: this.config.maxConnections
      })
      this._sendMethodSelection(socket, 0xff)
      socket.destroy()
      return
    }

    socket.setNoDelay(true)
    socket._vpnBuffer = Buffer.alloc(0)

    const remoteAddress = `${socket.remoteAddress || ''}:${socket.remotePort || ''}`

    try {
      await this._negotiateMethod(socket)
      const access = await this._authenticate(socket, remoteAddress)
      if (!access.success) {
        throw this._createSocksError(access.reason || 'AUTH_FAILED', 0x01)
      }

      const request = await this._parseConnectRequest(socket)

      const sessionContext = await this.bridge.createSession(
        {
          tunnelId: this.tunnelId,
          clientId: this.clientId,
          socks5Port: this.config.port
        },
        socket,
        {
          targetHost: request.host,
          targetPort: request.port,
          sourceIp: socket.remoteAddress,
          sourcePort: socket.remotePort
        }
      )

      await this._sendConnectSuccess(socket)
      this._flushHandshakeBuffer(socket)
      this._registerConnection(sessionContext.sessionId, socket, request)
      logger.info('🔗 SOCKS5 会话建立成功', {
        tunnelId: this.tunnelId,
        sessionId: sessionContext.sessionId,
        target: `${request.host}:${request.port}`,
        remote: remoteAddress
      })
    } catch (error) {
      const code = error.socksCode || 0x01
      logger.warn('❌ SOCKS5 握手失败', {
        tunnelId: this.tunnelId,
        error: error.message,
        remote: remoteAddress,
        code
      })
      try {
        await this._sendConnectFailure(socket, code)
      } catch (_) {
        // ignore
      }
      socket.destroy()
    }
  }

  async _negotiateMethod(socket) {
    const header = await this._readBytes(socket, 2)
    const version = header[0]
    const methodCount = header[1]
    if (version !== 0x05) {
      throw this._createSocksError('UNSUPPORTED_VERSION', 0x01)
    }
    const methods = await this._readBytes(socket, methodCount)
    const noAuthSupported = methods.includes(0x00)
    const userPassSupported = methods.includes(0x02)
    if (!noAuthSupported && !userPassSupported) {
      this._sendMethodSelection(socket, 0xff)
      throw this._createSocksError('NO_ACCEPTABLE_AUTH_METHODS', 0x01)
    }
    if (userPassSupported) {
      this._sendMethodSelection(socket, 0x02)
    } else {
      this._sendMethodSelection(socket, 0x00)
    }
  }

  async _authenticate(socket, remoteAddress) {
    const header = await this._readBytes(socket, 2)
    const version = header[0]
    const usernameLength = header[1]
    const username = (await this._readBytes(socket, usernameLength)).toString()
    const passwordLength = (await this._readBytes(socket, 1))[0]
    const password = (await this._readBytes(socket, passwordLength)).toString()

    if (version !== 0x01) {
      this._sendAuthResponse(socket, 0x01)
      return { success: false, reason: 'INVALID_AUTH_VERSION' }
    }

    const tunnel = await this.vpnService.getTunnel(this.tunnelId)
    if (!tunnel) {
      this._sendAuthResponse(socket, 0x01)
      return { success: false, reason: 'TUNNEL_NOT_FOUND' }
    }

    const isValid =
      username === AUTH_USERNAME &&
      typeof password === 'string' &&
      tunnel.passwordHash &&
      (await require('./tunnelAuthService').verifyPassword(password, tunnel.passwordHash))

    if (!isValid) {
      logger.warn('❌ SOCKS5 认证失败', { remoteAddress, clientId: this.clientId, tunnelId: this.tunnelId })
      this._sendAuthResponse(socket, 0x01)
      return { success: false, reason: 'INVALID_CREDENTIALS' }
    }

    this._sendAuthResponse(socket, 0x00)
    return { success: true }
  }

  async _parseConnectRequest(socket) {
    const header = await this._readBytes(socket, 4)
    const version = header[0]
    const command = header[1]
    const addressType = header[3]

    if (version !== 0x05 || command !== 0x01) {
      throw this._createSocksError('UNSUPPORTED_COMMAND', 0x07)
    }

    let host = ''
    if (addressType === 0x01) {
      const addr = await this._readBytes(socket, 4)
      host = Array.from(addr).join('.')
    } else if (addressType === 0x03) {
      const len = (await this._readBytes(socket, 1))[0]
      const domain = await this._readBytes(socket, len)
      host = domain.toString()
    } else if (addressType === 0x04) {
      const addr = await this._readBytes(socket, 16)
      host = addr.toString('hex').match(/.{1,4}/g).join(':')
    } else {
      throw this._createSocksError('INVALID_ADDRESS_TYPE', 0x08)
    }

    const portBuf = await this._readBytes(socket, 2)
    const port = portBuf.readUInt16BE(0)

    return { host, port }
  }

  _registerConnection(sessionId, socket, request) {
    this.connections.set(sessionId, {
      socket,
      request,
      closing: false
    })

    socket.on('data', (chunk) => this._handleData(sessionId, chunk))

    socket.on('close', () => {
      this.bridge.closeSession(sessionId, { reason: 'socket_closed' }).catch((err) => {
        logger.warn('⚠️ 关闭会话时出错', { sessionId, error: err.message })
      })
      this.connections.delete(sessionId)
    })

    socket.on('error', (error) => {
      logger.warn('⚠️ SOCKS5 连接错误', { sessionId, error: error.message })
      this.bridge.closeSession(sessionId, { reason: 'socket_error' }).catch((err) => {
        logger.warn('⚠️ 关闭会话时出错', { sessionId, error: err.message })
      })
      this.connections.delete(sessionId)
    })

    socket.setTimeout(this.config.idleTimeout, () => {
      logger.warn('⚠️ SOCKS5 连接空闲超时', { sessionId })
      socket.destroy()
      this.connections.delete(sessionId)
    })
  }

  _handleData(sessionId, chunk) {
    const conn = this.connections.get(sessionId)
    if (!conn || conn.closing) return

    conn.socket._vpnBuffer = Buffer.concat([conn.socket._vpnBuffer, chunk])

    // 如果 buffer 超过限制，触发回压（简单断开）
    if (conn.socket._vpnBuffer.length > this.maxVpnBufferedBytes) {
      logger.warn('⚠️ SOCKS5 buffer 超过限制，断开连接', {
        sessionId,
        size: conn.socket._vpnBuffer.length,
        limit: this.maxVpnBufferedBytes
      })
      conn.socket.destroy()
      this.connections.delete(sessionId)
      return
    }

    this.bridge.forwardData(sessionId, conn.socket._vpnBuffer)
    conn.socket._vpnBuffer = Buffer.alloc(0)
  }

  _flushHandshakeBuffer(socket) {
    if (socket._vpnBuffer && socket._vpnBuffer.length > 0) {
      this.bridge.forwardData('handshake', socket._vpnBuffer)
      socket._vpnBuffer = Buffer.alloc(0)
    }
  }

  _sendMethodSelection(socket, method) {
    const response = Buffer.from([0x05, method])
    socket.write(response)
  }

  _sendAuthResponse(socket, status) {
    const response = Buffer.from([0x01, status])
    socket.write(response)
  }

  async _sendConnectSuccess(socket) {
    const response = Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    await this._safeWrite(socket, response)
  }

  async _sendConnectFailure(socket, code) {
    const response = Buffer.from([0x05, code, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    await this._safeWrite(socket, response)
  }

  async _safeWrite(socket, buffer) {
    return new Promise((resolve, reject) => {
      socket.write(buffer, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  _createSocksError(message, socksCode = 0x01) {
    const err = new Error(message)
    err.socksCode = socksCode
    return err
  }

  _readBytes(socket, length) {
    return new Promise((resolve, reject) => {
      const onData = (chunk) => {
        socket.pause()
        socket.removeListener('data', onData)
        socket._vpnBuffer = Buffer.concat([socket._vpnBuffer, chunk])
        const buf = socket._vpnBuffer
        if (buf.length < length) {
          socket.resume()
          socket.on('data', onData)
          return
        }
        const result = buf.slice(0, length)
        socket._vpnBuffer = buf.slice(length)
        resolve(result)
      }

      socket.on('data', onData)
      socket.on('error', (err) => reject(err))
      socket.on('close', () => reject(new Error('Socket closed before reading bytes')))
    })
  }
}

module.exports = Socks5Server
