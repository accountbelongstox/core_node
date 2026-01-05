/**
 * WebSocket 客户端并发控制管理器
 *
 * 功能:
 * - 管理并发请求数量限制
 * - 实现 acquire/release 机制
 * - 提供等待槽位功能
 * - 提供实时并发统计
 */

const logger = require('../utils/logger')

class ConcurrencyManager {
  /**
   * @param {number} maxConcurrent - 最大并发请求数
   */
  constructor(maxConcurrent = 10) {
    this.maxConcurrent = maxConcurrent
    this.activeRequests = new Map() // requestId -> { startTime, metadata }
    this.waitingQueue = [] // 等待获取槽位的 Promise resolve 函数队列

    logger.info(`ConcurrencyManager initialized with max concurrent: ${maxConcurrent}`)
  }

  /**
   * 获取并发槽位
   * @param {string} requestId - 请求ID
   * @param {Object} metadata - 请求元数据（可选）
   * @returns {Promise<void>}
   */
  async acquire(requestId, metadata = {}) {
    logger.debug(`Attempting to acquire slot for request: ${requestId}`)

    // 如果当前并发数未达到上限，直接获取
    if (this.activeRequests.size < this.maxConcurrent) {
      this.activeRequests.set(requestId, {
        startTime: Date.now(),
        metadata
      })
      logger.debug(
        `Slot acquired for request: ${requestId}, active: ${this.activeRequests.size}/${this.maxConcurrent}`
      )
      return
    }

    // 如果已达上限，等待槽位释放
    logger.debug(
      `Max concurrent reached (${this.maxConcurrent}), request ${requestId} waiting for slot`
    )
    await this.waitForSlot()

    // 获取槽位
    this.activeRequests.set(requestId, {
      startTime: Date.now(),
      metadata
    })
    logger.debug(
      `Slot acquired for request: ${requestId} after waiting, active: ${this.activeRequests.size}/${this.maxConcurrent}`
    )
  }

  /**
   * 释放并发槽位
   * @param {string} requestId - 请求ID
   */
  release(requestId) {
    if (!this.activeRequests.has(requestId)) {
      logger.warn(`Attempted to release non-existent request: ${requestId}`)
      return
    }

    const requestInfo = this.activeRequests.get(requestId)
    const duration = Date.now() - requestInfo.startTime
    this.activeRequests.delete(requestId)

    logger.debug(
      `Slot released for request: ${requestId}, duration: ${duration}ms, active: ${this.activeRequests.size}/${this.maxConcurrent}`
    )

    // 如果有等待的请求，通知第一个
    if (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift()
      resolve()
    }
  }

  /**
   * 等待槽位可用
   * @returns {Promise<void>}
   */
  waitForSlot() {
    return new Promise((resolve) => {
      this.waitingQueue.push(resolve)
    })
  }

  /**
   * 获取当前活跃请求数
   * @returns {number}
   */
  getActiveCount() {
    return this.activeRequests.size
  }

  /**
   * 获取可用槽位数
   * @returns {number}
   */
  getAvailableSlots() {
    return Math.max(0, this.maxConcurrent - this.activeRequests.size)
  }

  /**
   * 获取等待队列长度
   * @returns {number}
   */
  getWaitingCount() {
    return this.waitingQueue.length
  }

  /**
   * 获取活跃请求列表
   * @returns {Array<Object>}
   */
  getActiveRequests() {
    const requests = []
    for (const [requestId, info] of this.activeRequests.entries()) {
      requests.push({
        requestId,
        duration: Date.now() - info.startTime,
        startTime: info.startTime,
        metadata: info.metadata
      })
    }
    return requests
  }

  /**
   * 获取并发统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      maxConcurrent: this.maxConcurrent,
      activeRequests: this.activeRequests.size,
      availableSlots: this.getAvailableSlots(),
      waitingQueue: this.waitingQueue.length,
      utilizationRate: (this.activeRequests.size / this.maxConcurrent) * 100
    }
  }

  /**
   * 清理所有活跃请求（用于重置或关闭）
   */
  clearAll() {
    const count = this.activeRequests.size
    this.activeRequests.clear()

    // 拒绝所有等待的请求
    while (this.waitingQueue.length > 0) {
      const resolve = this.waitingQueue.shift()
      resolve() // 让它们继续执行，但会在下一步失败
    }

    logger.info(`ConcurrencyManager cleared all ${count} active requests`)
  }

  /**
   * 更新最大并发数
   * @param {number} newMax - 新的最大并发数
   */
  setMaxConcurrent(newMax) {
    if (newMax < 1) {
      logger.warn(`Invalid maxConcurrent value: ${newMax}, keeping current: ${this.maxConcurrent}`)
      return
    }

    const oldMax = this.maxConcurrent
    this.maxConcurrent = newMax

    logger.info(`MaxConcurrent updated from ${oldMax} to ${newMax}`)

    // 如果新的上限更大，释放一些等待的请求
    if (newMax > oldMax) {
      const slotsToRelease = Math.min(newMax - oldMax, this.waitingQueue.length)
      for (let i = 0; i < slotsToRelease; i++) {
        if (this.waitingQueue.length > 0) {
          const resolve = this.waitingQueue.shift()
          resolve()
        }
      }
    }
  }

  /**
   * 检查请求是否正在处理中
   * @param {string} requestId - 请求ID
   * @returns {boolean}
   */
  isActive(requestId) {
    return this.activeRequests.has(requestId)
  }

  /**
   * 获取请求的处理时长
   * @param {string} requestId - 请求ID
   * @returns {number|null} 时长（毫秒），如果请求不存在返回 null
   */
  getRequestDuration(requestId) {
    if (!this.activeRequests.has(requestId)) {
      return null
    }
    const requestInfo = this.activeRequests.get(requestId)
    return Date.now() - requestInfo.startTime
  }
}

module.exports = ConcurrencyManager
