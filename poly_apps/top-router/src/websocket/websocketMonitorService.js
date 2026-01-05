/**
 * WebSocket 客户端监控服务
 *
 * 功能:
 * - 连接状态监控和管理
 * - 消息收发统计
 * - 请求处理统计
 * - 性能指标跟踪
 */

const logger = require('../utils/logger')
const datastore = require('../models/datastore')

const MONITOR_KEY_PREFIX = 'ws_client:monitor:'

class WebSocketMonitorService {
  constructor() {
    this.clientId = null
    this.requestStats = {
      total: 0,
      successful: 0,
      failed: 0,
      byService: {},
      byAccountType: {}
    }
  }

  /**
   * 设置客户端ID
   * @param {string} clientId - 客户端ID
   */
  setClientId(clientId) {
    this.clientId = clientId
    logger.info(`WebSocketMonitor: Client ID set to ${clientId}`)
  }

  /**
   * 更新连接状态
   * @param {string} clientId - 客户端ID
   * @param {string} status - 状态 (connected/disconnected/reconnecting)
   * @param {Object} metadata - 额外元数据
   * @returns {Promise<void>}
   */
  async updateConnectionStatus(clientId, status, metadata = {}) {
    try {
      const key = `${MONITOR_KEY_PREFIX}${clientId}`
      const data = {
        status,
        updatedAt: Date.now(),
        ...metadata
      }

      // 如果是连接状态，保存连接时间
      if (status === 'connected' && !metadata.connectedAt) {
        data.connectedAt = Date.now()
      }

      await datastore.set(key, JSON.stringify(data), 'EX', 3600) // 1小时过期

      logger.debug(`Connection status updated: ${clientId} - ${status}`)
    } catch (error) {
      logger.error('Error updating connection status:', error)
    }
  }

  async clearTempClientStatus() {
    try {
      await datastore.del(`${MONITOR_KEY_PREFIX}temp-client`)
    } catch (error) {
      logger.error('Error clearing temp client status:', error)
    }
  }

  /**
   * 获取连接状态
   * @param {string} clientId - 客户端ID
   * @returns {Promise<Object|null>}
   */
  async getConnectionStatus(clientId) {
    try {
      const key = `${MONITOR_KEY_PREFIX}${clientId}`
      const data = await datastore.get(key)
      return data ? JSON.parse(data) : null
    } catch (error) {
      logger.error('Error getting connection status:', error)
      return null
    }
  }

  /**
   * 增加消息计数
   * @param {string} clientId - 客户端ID
   * @param {string} direction - 方向 (sent/received)
   * @returns {Promise<void>}
   */
  async incrementMessageCount(clientId, direction) {
    try {
      const key = `${MONITOR_KEY_PREFIX}${clientId}`
      const data = await this.getConnectionStatus(clientId)

      if (data) {
        if (direction === 'sent') {
          data.messagesSent = (data.messagesSent || 0) + 1
        } else if (direction === 'received') {
          data.messagesReceived = (data.messagesReceived || 0) + 1
        }

        data.lastMessageAt = Date.now()
        await datastore.set(key, JSON.stringify(data), 'EX', 3600)
      }
    } catch (error) {
      logger.error('Error incrementing message count:', error)
    }
  }

  /**
   * 更新心跳时间
   * @param {string} clientId - 客户端ID
   * @returns {Promise<void>}
   */
  async updateHeartbeat(clientId, requestTime) {
    try {
      const key = `${MONITOR_KEY_PREFIX}${clientId}`
      const data = await this.getConnectionStatus(clientId)

      if (data) {
        const now = Date.now()
        data.lastHeartbeat = now
        data.heartbeatLatency = now - requestTime
        await datastore.set(key, JSON.stringify(data), 'EX', 3600)
      }
    } catch (error) {
      logger.error('Error updating heartbeat:', error)
    }
  }

  /**
   * 记录请求统计
   * @param {Object} requestInfo - 请求信息
   * @returns {Promise<void>}
   */
  async recordRequest(requestInfo) {
    const { requestId, service, accountType, success, processingTime, error } = requestInfo

    try {
      // 更新内存统计
      this.requestStats.total++

      if (success) {
        this.requestStats.successful++
      } else {
        this.requestStats.failed++
      }

      // 按服务类型统计
      if (!this.requestStats.byService[service]) {
        this.requestStats.byService[service] = { total: 0, successful: 0, failed: 0 }
      }
      this.requestStats.byService[service].total++
      if (success) {
        this.requestStats.byService[service].successful++
      } else {
        this.requestStats.byService[service].failed++
      }

      // 按账户类型统计
      if (accountType) {
        if (!this.requestStats.byAccountType[accountType]) {
          this.requestStats.byAccountType[accountType] = { total: 0, successful: 0, failed: 0 }
        }
        this.requestStats.byAccountType[accountType].total++
        if (success) {
          this.requestStats.byAccountType[accountType].successful++
        } else {
          this.requestStats.byAccountType[accountType].failed++
        }
      }

      // 保存到 Redis（用于持久化和跨实例统计）
      if (this.clientId) {
        const key = `ws_client:request:${this.clientId}:${requestId}`
        const data = {
          requestId,
          service,
          accountType,
          success,
          processingTime,
          error: error ? error.message : null,
          timestamp: Date.now()
        }
        await datastore.set(key, JSON.stringify(data), 'EX', 86400) // 24小时过期
      }

      logger.debug(
        `Request recorded: ${requestId}, service: ${service}, success: ${success}, time: ${processingTime}ms`
      )
    } catch (err) {
      logger.error('Error recording request:', err)
    }
  }

  /**
   * 获取请求统计
   * @returns {Object}
   */
  getRequestStats() {
    const successRate =
      this.requestStats.total > 0
        ? ((this.requestStats.successful / this.requestStats.total) * 100).toFixed(2)
        : 0

    return {
      totalRequests: this.requestStats.total,
      successfulRequests: this.requestStats.successful,
      failedRequests: this.requestStats.failed,
      successRate: parseFloat(successRate),
      requestsByService: this.requestStats.byService,
      requestsByAccountType: this.requestStats.byAccountType
    }
  }

  /**
   * 重置统计数据
   */
  resetStats() {
    this.requestStats = {
      total: 0,
      successful: 0,
      failed: 0,
      byService: {},
      byAccountType: {}
    }
    logger.info('Request statistics reset')
  }

  /**
   * 获取最近的请求记录
   * @param {string} clientId - 客户端ID
   * @param {number} limit - 返回数量限制
   * @returns {Promise<Array>}
   */
  async getRecentRequests(clientId, limit = 100) {
    try {
      const pattern = `ws_client:request:${clientId}:*`
      const keys = await datastore.keys(pattern)

      if (keys.length === 0) {
        return []
      }

      // 限制返回数量
      const limitedKeys = keys.slice(0, limit)
      const requests = []

      for (const key of limitedKeys) {
        const data = await datastore.get(key)
        if (data) {
          requests.push(JSON.parse(data))
        }
      }

      // 按时间戳降序排序
      requests.sort((a, b) => b.timestamp - a.timestamp)

      return requests
    } catch (error) {
      logger.error('Error getting recent requests:', error)
      return []
    }
  }

  /**
   * 清理过期的请求记录
   * @param {string} clientId - 客户端ID
   * @param {number} olderThanMs - 清理早于指定时间的记录（毫秒）
   * @returns {Promise<number>} 清理的记录数量
   */
  async cleanOldRequests(clientId, olderThanMs = 86400000) {
    try {
      const pattern = `ws_client:request:${clientId}:*`
      const keys = await datastore.keys(pattern)

      if (keys.length === 0) {
        return 0
      }

      const now = Date.now()
      let cleanedCount = 0

      for (const key of keys) {
        const data = await datastore.get(key)
        if (data) {
          const request = JSON.parse(data)
          if (now - request.timestamp > olderThanMs) {
            await datastore.del(key)
            cleanedCount++
          }
        }
      }

      if (cleanedCount > 0) {
        logger.info(`Cleaned ${cleanedCount} old request records for client ${clientId}`)
      }

      return cleanedCount
    } catch (error) {
      logger.error('Error cleaning old requests:', error)
      return 0
    }
  }

  /**
   * 获取客户端的完整状态信息
   * @param {string} clientId - 客户端ID
   * @returns {Promise<Object>}
   */
  async getFullStatus(clientId) {
    try {
      const connectionStatus = await this.getConnectionStatus(clientId)
      const requestStats = this.getRequestStats()

      return {
        clientId,
        connection: connectionStatus,
        requests: requestStats,
        uptime:
          connectionStatus && connectionStatus.connectedAt
            ? Date.now() - connectionStatus.connectedAt
            : 0,
        timestamp: Date.now()
      }
    } catch (error) {
      logger.error('Error getting full status:', error)
      return {
        clientId,
        connection: null,
        requests: {},
        uptime: 0,
        timestamp: Date.now(),
        error: error.message
      }
    }
  }

  /**
   * 记录重连事件
   * @param {string} clientId - 客户端ID
   * @param {number} attempt - 重连尝试次数
   * @param {boolean} success - 是否成功
   * @returns {Promise<void>}
   */
  async recordReconnect(clientId, attempt, success) {
    try {
      const key = `ws_client:reconnect:${clientId}`
      const history = await datastore.get(key)
      const reconnects = history ? JSON.parse(history) : []

      reconnects.push({
        attempt,
        success,
        timestamp: Date.now()
      })

      // 只保留最近50次重连记录
      if (reconnects.length > 50) {
        reconnects.splice(0, reconnects.length - 50)
      }

      await datastore.set(key, JSON.stringify(reconnects), 'EX', 86400) // 24小时过期

      logger.info(`Reconnect recorded: attempt ${attempt}, success: ${success}`)
    } catch (error) {
      logger.error('Error recording reconnect:', error)
    }
  }

  /**
   * 获取重连历史
   * @param {string} clientId - 客户端ID
   * @returns {Promise<Array>}
   */
  async getReconnectHistory(clientId) {
    try {
      const key = `ws_client:reconnect:${clientId}`
      const history = await datastore.get(key)
      return history ? JSON.parse(history) : []
    } catch (error) {
      logger.error('Error getting reconnect history:', error)
      return []
    }
  }
}

// 创建单例实例
const websocketMonitorService = new WebSocketMonitorService()

module.exports = websocketMonitorService
