'use strict'

const net = require('net')
const config = require('../../../config/config')

class PortAllocator {
  constructor() {
    this.usedPorts = new Set()
    this.initialized = false
  }

  async initialize() {
    if (this.initialized) return
    this.initialized = true
  }

  async allocatePort(tunnelId, { purpose = 'vpn_tunnel' } = {}) {
    const start = Number(config.vpn?.portRange?.start) || 10000
    const end = Number(config.vpn?.portRange?.end) || 20000
    for (let port = start; port <= end; port++) {
      if (this.usedPorts.has(port)) continue
      const available = await this._checkPortAvailable(port)
      if (available) {
        this.usedPorts.add(port)
        return { port, tunnelId, purpose }
      }
    }
    throw new Error('NO_AVAILABLE_PORT')
  }

  async releasePort(port) {
    this.usedPorts.delete(port)
  }

  markUsed(port) {
    if (Number.isFinite(port)) {
      this.usedPorts.add(port)
    }
  }

  _checkPortAvailable(port) {
    return new Promise((resolve) => {
      const tester = net.createServer()
      tester.once('error', () => {
        resolve(false)
      })
      tester.once('listening', () => {
        tester.close(() => resolve(true))
      })
      tester.listen(port, '0.0.0.0')
    })
  }
}

module.exports = new PortAllocator()
