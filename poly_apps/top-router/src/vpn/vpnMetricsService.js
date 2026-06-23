'use strict'

const { EventEmitter } = require('events')

class VpnMetricsService extends EventEmitter {
  constructor(options = {}) {
    super()
    this.config = options.config || {}
    this.interval = null
    this.statsProvider = options.statsProvider
    this.logger = options.logger
  }

  start() {
    if (this.interval || this.config.enabled === false) {
      return
    }

    const intervalMs = this.config.interval || 5000
    this.interval = setInterval(() => this.collect(), intervalMs)
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  collect() {
    if (!this.statsProvider) {
      return
    }

    try {
      const stats = this.statsProvider()
      this.emit('metrics', stats)
      if (this.logger) {
        this.logger.debug('VPN metrics snapshot', stats)
      }
    } catch (error) {
      if (this.logger) {
        this.logger.warn('Failed to collect VPN metrics', { error: error.message })
      }
    }
  }
}

module.exports = VpnMetricsService
