'use strict'

const net = require('net')
const { EventEmitter } = require('events')
const logger = require('../utils/logger')

const SOCKS_VERSION = 0x05
const AUTH_METHOD = {
  NO_AUTH: 0x00,
  USERNAME_PASSWORD: 0x02,
  NO_ACCEPTABLE: 0xff
}

const COMMAND = {
  CONNECT: 0x01
}

const ADDRESS_TYPE = {
  IPV4: 0x01,
  DOMAIN: 0x03,
  IPV6: 0x04
}

class SocksConnection {
  constructor(socket, options = {}) {
    this.socket = socket
    this.options = options
    this.buffer = Buffer.alloc(0)
    this.state = 'greeting'

    this.socket.on('data', (chunk) => this.handleData(chunk))
    this.socket.once('close', () => this.cleanup())
    this.socket.once('error', () => this.cleanup())
  }

  cleanup() {
    this.state = 'closed'
    this.socket.removeAllListeners('data')
  }

  handleData(chunk) {
    if (this.state === 'closed') {
      return
    }

    this.buffer = Buffer.concat([this.buffer, chunk])

    try {
      while (this.buffer.length > 0 && this.processState()) {
        // loop until state machine waits for more data
      }
    } catch (error) {
      logger.warn('SOCKS5 handshake error', { message: error.message })
      this.socket.destroy()
    }
  }

  processState() {
    switch (this.state) {
      case 'greeting':
        return this.processGreeting()
      case 'auth':
        return this.processAuth()
      case 'request':
        return this.processRequest()
      case 'established':
      default:
        return false
    }
  }

  processGreeting() {
    if (this.buffer.length < 2) {
      return false
    }

    const version = this.buffer.readUInt8(0)
    if (version !== SOCKS_VERSION) {
      throw new Error('Unsupported SOCKS version')
    }

    const methodCount = this.buffer.readUInt8(1)
    const totalLength = 2 + methodCount
    if (this.buffer.length < totalLength) {
      return false
    }

    const methods = this.buffer.slice(2, totalLength)
    this.buffer = this.buffer.slice(totalLength)

    const requireAuth = this.options.auth?.username && this.options.auth?.password
    const preferredMethod = requireAuth ? AUTH_METHOD.USERNAME_PASSWORD : AUTH_METHOD.NO_AUTH

    const methodAccepted = methods.includes(preferredMethod)
      ? preferredMethod
      : methods.includes(AUTH_METHOD.NO_AUTH) && !requireAuth
        ? AUTH_METHOD.NO_AUTH
        : AUTH_METHOD.NO_ACCEPTABLE

    this.socket.write(Buffer.from([SOCKS_VERSION, methodAccepted]))

    if (methodAccepted === AUTH_METHOD.NO_ACCEPTABLE) {
      throw new Error('No acceptable authentication methods')
    }

    this.state = methodAccepted === AUTH_METHOD.USERNAME_PASSWORD ? 'auth' : 'request'
    return true
  }

  processAuth() {
    if (this.buffer.length < 2) {
      return false
    }

    const version = this.buffer.readUInt8(0)
    if (version !== 0x01) {
      throw new Error('Unsupported auth version')
    }

    const usernameLength = this.buffer.readUInt8(1)
    if (this.buffer.length < 2 + usernameLength + 1) {
      return false
    }

    const username = this.buffer.slice(2, 2 + usernameLength).toString('utf8')
    const passwordLengthOffset = 2 + usernameLength
    const passwordLength = this.buffer.readUInt8(passwordLengthOffset)
    const totalLength = passwordLengthOffset + 1 + passwordLength

    if (this.buffer.length < totalLength) {
      return false
    }

    const password = this.buffer
      .slice(passwordLengthOffset + 1, passwordLengthOffset + 1 + passwordLength)
      .toString('utf8')

    this.buffer = this.buffer.slice(totalLength)

    const expectedUsername = this.options.auth?.username || ''
    const expectedPassword = this.options.auth?.password || ''

    if (username !== expectedUsername || password !== expectedPassword) {
      this.socket.write(Buffer.from([0x01, 0x01]))
      throw new Error('Invalid SOCKS5 credentials')
    }

    this.socket.write(Buffer.from([0x01, 0x00]))
    this.state = 'request'
    return true
  }

  processRequest() {
    if (this.buffer.length < 4) {
      return false
    }

    const version = this.buffer.readUInt8(0)
    const command = this.buffer.readUInt8(1)
    const addrType = this.buffer.readUInt8(3)

    if (version !== SOCKS_VERSION) {
      throw new Error('Invalid request version')
    }

    if (command !== COMMAND.CONNECT) {
      this.replyFailure(0x07) // Command not supported
      throw new Error(`Unsupported SOCKS command: ${command}`)
    }

    let address
    let offset = 4

    if (addrType === ADDRESS_TYPE.IPV4) {
      if (this.buffer.length < offset + 4 + 2) {
        return false
      }
      address = Array.from(this.buffer.slice(offset, offset + 4)).join('.')
      offset += 4
    } else if (addrType === ADDRESS_TYPE.DOMAIN) {
      if (this.buffer.length < offset + 1) {
        return false
      }
      const domainLength = this.buffer.readUInt8(offset)
      offset += 1
      if (this.buffer.length < offset + domainLength + 2) {
        return false
      }
      address = this.buffer.toString('utf8', offset, offset + domainLength)
      offset += domainLength
    } else if (addrType === ADDRESS_TYPE.IPV6) {
      if (this.buffer.length < offset + 16 + 2) {
        return false
      }
      const raw = this.buffer.slice(offset, offset + 16)
      address = raw
        .toString('hex')
        .match(/.{1,4}/g)
        .join(':')
      offset += 16
    } else {
      this.replyFailure(0x08) // Address type not supported
      throw new Error(`Unsupported address type: ${addrType}`)
    }

    const port = this.buffer.readUInt16BE(offset)
    offset += 2

    this.buffer = this.buffer.slice(offset)

    this.replySuccess()

    this.state = 'established'

    if (this.buffer.length > 0) {
      this.socket.unshift(this.buffer)
      this.buffer = Buffer.alloc(0)
    }

    this.socket.removeAllListeners('data')
    this.cleanup()

    if (typeof this.options.onRequest === 'function') {
      this.options.onRequest({
        socket: this.socket,
        address,
        port,
        command,
        addressType: addrType
      })
    }

    return false
  }

  replySuccess() {
    const response = Buffer.from([SOCKS_VERSION, 0x00, 0x00, ADDRESS_TYPE.IPV4, 0, 0, 0, 0, 0, 0])
    this.socket.write(response)
  }

  replyFailure(code) {
    const response = Buffer.from([SOCKS_VERSION, code, 0x00, ADDRESS_TYPE.IPV4, 0, 0, 0, 0, 0, 0])
    this.socket.write(response)
  }
}

class SocksGateway extends EventEmitter {
  constructor(options = {}) {
    super()

    this.config = options.config || {}
    this.server = null
    this.isRunning = false
    this.connections = new Set()
  }

  async start() {
    if (this.isRunning) {
      return
    }

    const { host = '127.0.0.1', port = 0, backlog = 128 } = this.config

    this.server = net.createServer((socket) => this.handleConnection(socket))

    await new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen({ host, port, backlog }, () => {
        this.server.off('error', reject)
        resolve()
      })
    })

    this.isRunning = true

    const address = this.server.address()
    logger.info('SOCKS5 gateway listening', address)

    this.emit('ready', address)
  }

  async stop() {
    if (!this.isRunning || !this.server) {
      return
    }

    await new Promise((resolve) => this.server.close(resolve))
    this.server = null
    this.isRunning = false

    for (const connection of this.connections) {
      try {
        connection.socket.destroy()
      } catch (error) {
        logger.debug('Failed to destroy SOCKS5 connection socket', { error: error.message })
      }
    }
    this.connections.clear()
    logger.info('SOCKS5 gateway stopped')
  }

  handleConnection(socket) {
    socket.on('error', (err) => {
      logger.warn('SOCKS5 client socket error', { error: err.message })
    })

    const connection = new SocksConnection(socket, {
      auth: this.config.auth,
      onRequest: ({ socket: clientSocket, address, port, command, addressType }) => {
        this.emit('connectRequest', {
          socket: clientSocket,
          address,
          port,
          command,
          addressType
        })
      }
    })

    this.connections.add(connection)

    const cleanup = () => {
      this.connections.delete(connection)
    }

    socket.once('close', cleanup)
    socket.once('error', cleanup)
  }
}

module.exports = SocksGateway
