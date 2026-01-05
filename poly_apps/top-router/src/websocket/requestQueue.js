/**
 * WebSocket 客户端请求队列管理器
 *
 * 功能:
 * - 实现 FIFO（先进先出）请求队列
 * - 管理请求排队和处理
 * - 提供队列统计信息
 */

const logger = require('../utils/logger')

class RequestQueue {
  constructor() {
    this.queue = []
    this.processing = false
    this.processedCount = 0
    this.failedCount = 0
  }

  /**
   * 将请求加入队列
   * @param {Object} request - WebSocket 请求对象
   * @param {Function} handler - 请求处理函数
   * @returns {Promise<void>}
   */
  enqueue(request, handler) {
    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        handler,
        resolve,
        reject,
        enqueueTime: Date.now()
      })

      logger.debug(`Request ${request.id} enqueued, queue size: ${this.queue.length}`)

      // 触发处理
      this.process()
    })
  }

  /**
   * 处理队列中的请求
   */
  async process() {
    // 如果已经在处理或队列为空，则返回
    if (this.processing || this.queue.length === 0) {
      return
    }

    this.processing = true
    logger.debug(`Started processing queue, size: ${this.queue.length}`)

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      const { request, handler, resolve, reject, enqueueTime } = item
      const waitTime = Date.now() - enqueueTime

      try {
        logger.debug(
          `Processing request ${request.id}, waited: ${waitTime}ms, remaining: ${this.queue.length}`
        )

        // 调用处理函数
        const result = await handler(request)

        this.processedCount++
        resolve(result)

        logger.debug(`Request ${request.id} processed successfully`)
      } catch (error) {
        this.failedCount++
        logger.error(`Request ${request.id} processing failed:`, error)
        reject(error)
      }
    }

    this.processing = false
    logger.debug('Queue processing finished')
  }

  /**
   * 获取队列长度
   * @returns {number}
   */
  getQueueSize() {
    return this.queue.length
  }

  /**
   * 检查队列是否为空
   * @returns {boolean}
   */
  isEmpty() {
    return this.queue.length === 0
  }

  /**
   * 检查队列是否正在处理
   * @returns {boolean}
   */
  isProcessing() {
    return this.processing
  }

  /**
   * 获取队列统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      queueSize: this.queue.length,
      processing: this.processing,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
      successRate:
        this.processedCount + this.failedCount > 0
          ? ((this.processedCount / (this.processedCount + this.failedCount)) * 100).toFixed(2)
          : 0
    }
  }

  /**
   * 获取队列中等待时间最长的请求信息
   * @returns {Object|null}
   */
  getOldestRequest() {
    if (this.queue.length === 0) {
      return null
    }

    const oldest = this.queue[0]
    return {
      requestId: oldest.request.id,
      waitTime: Date.now() - oldest.enqueueTime,
      position: 0
    }
  }

  /**
   * 获取队列中所有请求的概览
   * @returns {Array<Object>}
   */
  getQueueOverview() {
    return this.queue.map((item, index) => ({
      requestId: item.request.id,
      service: item.request.data?.service,
      waitTime: Date.now() - item.enqueueTime,
      position: index
    }))
  }

  /**
   * 清空队列（拒绝所有等待的请求）
   * @param {Error} error - 拒绝原因
   */
  clearQueue(error = new Error('Queue cleared')) {
    const count = this.queue.length

    while (this.queue.length > 0) {
      const item = this.queue.shift()
      item.reject(error)
    }

    logger.info(`Queue cleared, ${count} requests rejected`)
  }

  /**
   * 重置统计计数器
   */
  resetStats() {
    this.processedCount = 0
    this.failedCount = 0
    logger.info('Queue statistics reset')
  }

  /**
   * 查找特定请求在队列中的位置
   * @param {string} requestId - 请求ID
   * @returns {number} 位置索引，未找到返回 -1
   */
  findRequest(requestId) {
    return this.queue.findIndex((item) => item.request.id === requestId)
  }

  /**
   * 移除队列中的特定请求
   * @param {string} requestId - 请求ID
   * @returns {boolean} 是否成功移除
   */
  removeRequest(requestId) {
    const index = this.findRequest(requestId)
    if (index === -1) {
      return false
    }

    const item = this.queue.splice(index, 1)[0]
    item.reject(new Error('Request removed from queue'))

    logger.debug(`Request ${requestId} removed from queue`)
    return true
  }

  /**
   * 获取队列中等待时间超过阈值的请求数
   * @param {number} thresholdMs - 等待时间阈值（毫秒）
   * @returns {number}
   */
  getStaleRequestsCount(thresholdMs = 60000) {
    const now = Date.now()
    return this.queue.filter((item) => now - item.enqueueTime > thresholdMs).length
  }

  /**
   * 清理等待时间过长的请求
   * @param {number} thresholdMs - 等待时间阈值（毫秒）
   * @returns {number} 清理的请求数量
   */
  cleanStaleRequests(thresholdMs = 60000) {
    const now = Date.now()
    let cleanedCount = 0

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i]
      if (now - item.enqueueTime > thresholdMs) {
        this.queue.splice(i, 1)
        item.reject(new Error(`Request timeout: waited ${(now - item.enqueueTime) / 1000}s`))
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} stale requests from queue`)
    }

    return cleanedCount
  }
}

module.exports = RequestQueue
