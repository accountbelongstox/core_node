'use strict'

class BufferPool {
  constructor({ highWaterMark = 65536, poolSize = 64 } = {}) {
    this.highWaterMark = highWaterMark
    this.poolSize = poolSize
    this.pool = []
  }

  acquire(size = this.highWaterMark) {
    const adjustedSize = Math.max(size, this.highWaterMark)

    while (this.pool.length > 0) {
      const candidate = this.pool.pop()
      if (candidate.length >= adjustedSize) {
        return candidate
      }
    }

    return Buffer.allocUnsafe(adjustedSize)
  }

  release(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      return
    }

    if (this.pool.length >= this.poolSize) {
      return
    }

    this.pool.push(buffer)
  }
}

module.exports = BufferPool
