/**
 * WebSocket 流式转换工具
 *
 * 功能:
 * - SSE (Server-Sent Events) 到 WebSocket 消息转换
 * - 维护消息序列号
 * - 捕获 usage 数据
 * - 处理流结束事件
 */

const logger = require('../utils/logger')

class StreamConverter {
  /**
   * @param {string} requestId - 请求ID
   * @param {Object} websocketClient - WebSocket 客户端实例
   */
  constructor(requestId, websocketClient) {
    this.requestId = requestId
    this.websocketClient = websocketClient
    this.sequence = 0
    this.capturedUsage = null
    this.totalBytes = 0
    this.startTime = Date.now()
  }

  /**
   * 处理 SSE 数据块
   * @param {string|Buffer} sseChunk - SSE 数据块
   * @returns {Promise<void>}
   */
  async handleChunk(sseChunk) {
    this.sequence++
    const chunkStr = sseChunk.toString('utf-8')
    this.totalBytes += Buffer.byteLength(chunkStr, 'utf-8')

    // 发送分片消息
    await this.websocketClient.sendMessage({
      type: 'response_chunk',
      data: {
        requestId: this.requestId,
        sequence: this.sequence,
        chunk: chunkStr,
        encoding: 'utf-8'
      }
    })

    // 尝试捕获 usage 数据
    const usage = this.extractUsage(chunkStr)
    if (usage) {
      this.capturedUsage = usage
      logger.debug(`Usage captured for request ${this.requestId}:`, usage)
    }
  }

  /**
   * 从 SSE 数据块中提取 usage 信息
   * @param {string} sseChunk - SSE 数据块
   * @returns {Object|null} usage 对象，未找到返回 null
   */
  extractUsage(sseChunk) {
    try {
      const lines = sseChunk.split('\n')
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.substring(6).trim()
          if (!dataStr || dataStr === '[DONE]') {
            continue
          }

          try {
            const data = JSON.parse(dataStr)

            // Claude API 格式：message_delta 事件包含 usage
            if (data.type === 'message_delta' && data.usage) {
              return this.normalizeUsage(data.usage)
            }

            // Claude API 格式：message_stop 之前的 usage
            if (data.type === 'message_stop' && data.usage) {
              return this.normalizeUsage(data.usage)
            }

            // OpenAI Responses 格式：response.usage
            if (data.response && data.response.usage) {
              return this.normalizeUsage(data.response.usage)
            }

            // OpenAI 格式：usage 字段
            if (data.usage) {
              return this.normalizeUsage(data.usage)
            }
          } catch (parseError) {
            // 单行解析失败，继续处理其他行
            continue
          }
        }
      }
    } catch (error) {
      logger.debug(`Failed to extract usage from SSE chunk:`, error.message)
    }
    return null
  }

  /**
   * 标准化不同 API 格式的 usage 数据
   * @param {Object} usage - 原始 usage 对象
   * @returns {Object} 标准化的 usage 对象
   */
  normalizeUsage(usage) {
    return {
      input_tokens:
        usage.input_tokens || usage.prompt_tokens || usage.promptTokens || usage.inputTokens || 0,
      output_tokens:
        usage.output_tokens ||
        usage.completion_tokens ||
        usage.completionTokens ||
        usage.outputTokens ||
        0,
      cache_creation_input_tokens:
        usage.cache_creation_input_tokens ||
        usage.cache_creation_tokens ||
        usage.cacheCreateTokens ||
        0,
      cache_read_input_tokens:
        usage.cache_read_input_tokens ||
        usage.cache_read_tokens ||
        usage.cached_tokens ||
        usage.input_tokens_details?.cached_tokens ||
        0,
      // 总计（某些API可能提供）
      total_tokens: usage.total_tokens || usage.totalTokens || 0
    }
  }

  /**
   * 处理流结束
   * @param {Object} metadata - 元数据（账户信息等）
   * @returns {Promise<void>}
   */
  async handleEnd(metadata = {}, options = {}) {
    const duration = Date.now() - this.startTime
    const finalUsage = options?.usageOverride || this.capturedUsage
    const finalCost = options?.costSummary || null
    const finalStatus = options?.status || 'success'

    // 发送流结束消息
    await this.websocketClient.sendMessage({
      type: 'response_end',
      data: {
        requestId: this.requestId,
        status: finalStatus,
        totalChunks: this.sequence,
        totalBytes: this.totalBytes,
        usage: finalUsage,
        cost: finalCost,
        metadata: {
          ...metadata,
          duration,
          totalBytes: this.totalBytes,
          usage: finalUsage,
          cost: finalCost
        }
      }
    })

    logger.debug(
      `Stream ended for request ${this.requestId}: ${this.sequence} chunks, ${this.totalBytes} bytes, ${duration}ms`
    )
  }

  /**
   * 处理流错误
   * @param {Error} error - 错误对象
   * @returns {Promise<void>}
   */
  async handleError(error) {
    logger.error(`Stream error for request ${this.requestId}:`, error)

    // 发送错误消息
    await this.websocketClient.sendMessage({
      type: 'error',
      data: {
        requestId: this.requestId,
        errorCode: error.code || 'STREAM_ERROR',
        errorType: 'stream_error',
        message: error.message,
        details: {
          sequence: this.sequence,
          totalBytes: this.totalBytes
        }
      }
    })
  }

  /**
   * 获取当前序列号
   * @returns {number}
   */
  getSequence() {
    return this.sequence
  }

  /**
   * 获取捕获的 usage 数据
   * @returns {Object|null}
   */
  getCapturedUsage() {
    return this.capturedUsage
  }

  /**
   * 获取流统计信息
   * @returns {Object}
   */
  getStats() {
    return {
      requestId: this.requestId,
      sequence: this.sequence,
      totalBytes: this.totalBytes,
      duration: Date.now() - this.startTime,
      hasUsage: !!this.capturedUsage,
      usage: this.capturedUsage
    }
  }

  /**
   * 重置转换器状态（用于重用）
   * @param {string} newRequestId - 新的请求ID
   */
  reset(newRequestId) {
    this.requestId = newRequestId
    this.sequence = 0
    this.capturedUsage = null
    this.totalBytes = 0
    this.startTime = Date.now()
    logger.debug(`StreamConverter reset for new request: ${newRequestId}`)
  }
}

/**
 * 背压处理器
 * 用于控制 SSE 流读取速度，防止 WebSocket 发送缓冲区积压
 */
class BackpressureHandler {
  /**
   * @param {Stream} sseStream - SSE 数据流
   * @param {WebSocket} websocket - WebSocket 连接
   * @param {number} threshold - 缓冲区阈值（字节）
   */
  constructor(sseStream, websocket, threshold = 1024 * 1024) {
    this.sseStream = sseStream
    this.websocket = websocket
    this.threshold = threshold
    this.isPaused = false
    this.checkInterval = null
  }

  /**
   * 开始监控背压
   * @param {number} intervalMs - 检查间隔（毫秒）
   */
  startMonitoring(intervalMs = 100) {
    this.checkInterval = setInterval(() => {
      this.checkBackpressure()
    }, intervalMs)
    logger.debug('Backpressure monitoring started')
  }

  /**
   * 停止监控背压
   */
  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
      logger.debug('Backpressure monitoring stopped')
    }
  }

  /**
   * 检查背压并调整流速度
   */
  checkBackpressure() {
    if (!this.websocket || this.websocket.readyState !== 1) {
      // WebSocket 未连接，暂停流
      if (!this.isPaused) {
        this.pauseStream()
      }
      return
    }

    const bufferSize = this.websocket.bufferedAmount || 0

    if (bufferSize > this.threshold && !this.isPaused) {
      this.pauseStream()
      logger.debug(
        `SSE stream paused due to backpressure, buffer size: ${bufferSize} bytes (threshold: ${this.threshold})`
      )
    } else if (bufferSize < this.threshold / 2 && this.isPaused) {
      this.resumeStream()
      logger.debug(
        `SSE stream resumed, buffer size reduced to: ${bufferSize} bytes (threshold: ${this.threshold})`
      )
    }
  }

  /**
   * 暂停 SSE 流
   */
  pauseStream() {
    if (this.sseStream && typeof this.sseStream.pause === 'function') {
      this.sseStream.pause()
      this.isPaused = true
    }
  }

  /**
   * 恢复 SSE 流
   */
  resumeStream() {
    if (this.sseStream && typeof this.sseStream.resume === 'function') {
      this.sseStream.resume()
      this.isPaused = false
    }
  }

  /**
   * 获取当前缓冲区大小
   * @returns {number}
   */
  getBufferSize() {
    return this.websocket?.bufferedAmount || 0
  }

  /**
   * 检查是否正在背压状态
   * @returns {boolean}
   */
  isUnderBackpressure() {
    return this.isPaused
  }
}

module.exports = { StreamConverter, BackpressureHandler }
