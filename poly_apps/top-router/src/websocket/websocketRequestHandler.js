'use strict'

const logger = require('../utils/logger')
const { StreamConverter } = require('./streamConverter')
const { callModelApi, callLocalApi } = require('./requestByApi')

/**
 * WebSocket 请求处理器
 *
 * 统一通过本地 HTTP 接口处理：
 * - 大模型请求（流式/非流式）
 * - 本地 JSON 请求（OAuth/账户管理等）
 * 其他消息类型（ping/register/vpn等）由上层 WebSocket 客户端/服务单独处理。
 */
class WebSocketRequestHandler {
  constructor(websocketClient, config, concurrencyManager, monitorService) {
    this.websocketClient = websocketClient
    this.config = config
    this.concurrencyManager = concurrencyManager
    this.monitorService = monitorService
    this.clientApiKey = config.websocketClient?.clientApiKey || ''
    this.clientApiKeyData = { id: 'local-api-key' }
  }

  /**
   * 处理 WS 下发的请求
   */
  async handleRequest(wsMessage) {
    const { data } = wsMessage
    const {
      apiKey,
      requestId,
      endpoint = '/v1/chat/completions',
      method = 'POST',
      headers = {},
      body = {},
      options = {}
    } = data || {}

    const isLocal = options?.local === true || data?.kind === 'local'
    const isLocalStream = isLocal && options?.stream === true
    const isStreaming = body?.stream !== false && !options?.forceNonStream
    const startTime = Date.now()

    // API Key 校验
    if (apiKey && apiKey !== this.clientApiKey) {
      await this.sendError(requestId, new Error('Invalid API Key in request'), null)
      return
    }

    await this.sendAck(requestId)
    await this.concurrencyManager.acquire(requestId, { endpoint, method, isStreaming })

    try {
      if (isLocalStream) {
        await this.handleLocalStreamingRequest(requestId, { endpoint, method, headers, body })
      } else if (isLocal) {
        await this.handleLocalRequest(requestId, { endpoint, method, headers, body })
      } else if (isStreaming) {
        await this.handleStreamingRequest(requestId, { endpoint, method, headers, body })
      } else {
        await this.handleNonStreamingRequest(
          requestId,
          { endpoint, method, headers, body },
          options
        )
      }

      if (this.monitorService?.recordRequest) {
        await this.monitorService.recordRequest({
          requestId,
          service: options?.service || 'model',
          accountType: 'local-api',
          success: true,
          processingTime: Date.now() - startTime
        })
      }
    } catch (error) {
      logger.error(`Request ${requestId} failed:`, error)
      await this.sendError(requestId, error, { type: 'local-api', id: 'local-api' })
      if (this.monitorService?.recordRequest) {
        await this.monitorService.recordRequest({
          requestId,
          service: options?.service || 'model',
          accountType: 'local-api',
          success: false,
          processingTime: Date.now() - startTime
        })
      }
    } finally {
      this.concurrencyManager.release(requestId)
    }
  }

  /**
   * 处理流式模型请求
   */
  async handleStreamingRequest(requestId, { endpoint, method, headers, body }) {
    const streamConverter = new StreamConverter(requestId, this.websocketClient)
    try {
      const resp = await callModelApi({ endpoint, method, headers, body, stream: true })
      if (resp.type === 'stream') {
        await new Promise((resolve, reject) => {
          resp.response.data.on('data', (chunk) => {
            try {
              streamConverter.handleChunk(chunk)
            } catch (err) {
              reject(err)
            }
          })
          resp.response.data.on('end', resolve)
          resp.response.data.on('error', reject)
        })
      }

      await streamConverter.handleEnd({
        accountId: 'local-api',
        accountType: 'local-api',
        statusCode: 200
      })
    } catch (error) {
      await streamConverter.handleError(error)
      throw error
    }
  }

  /**
   * 处理非流式模型请求
   */
  async handleNonStreamingRequest(requestId, { endpoint, method, headers, body }, options = {}) {
    const resp = await callModelApi({ endpoint, method, headers, body, stream: false })

    const finalBody =
      options?.compactFormat && resp.body && typeof resp.body === 'object'
        ? {
            id: resp.body.id || null,
            model: resp.body.model || body?.model || null,
            content: resp.body.content || resp.body.choices?.[0]?.message?.content || null,
            usage: resp.usage || resp.body.usage || null
          }
        : resp.body

    await this.websocketClient.sendMessage({
      type: 'response',
      id: requestId,
      timestamp: Date.now(),
      data: {
        requestId,
        statusCode: resp.statusCode || 200,
        headers: resp.headers || {},
        body: finalBody,
        usage: resp.usage || resp.body?.usage || null
      }
    })
  }

  /**
   * 处理本地 JSON 请求（OAuth/账户管理等）
   */
  async handleLocalRequest(requestId, { endpoint, method, headers, body }) {
    const nextHeaders = this._withInternalHeader(endpoint, headers)
    const resp = await callLocalApi({ endpoint, method, headers: nextHeaders, body })
    await this.websocketClient.sendMessage({
      type: 'response',
      id: requestId,
      timestamp: Date.now(),
      data: {
        requestId,
        statusCode: resp.statusCode || 200,
        headers: resp.headers || {},
        body: resp.body
      }
    })
  }

  async handleLocalStreamingRequest(requestId, { endpoint, method, headers, body }) {
    const nextHeaders = this._withInternalHeader(endpoint, headers)
    const streamConverter = new StreamConverter(requestId, this.websocketClient)
    try {
      const resp = await callLocalApi({
        endpoint,
        method,
        headers: nextHeaders,
        body,
        stream: true
      })

      if (resp.type === 'stream') {
        await new Promise((resolve, reject) => {
          resp.response.data.on('data', (chunk) => {
            try {
              streamConverter.handleChunk(chunk)
            } catch (err) {
              reject(err)
            }
          })
          resp.response.data.on('end', resolve)
          resp.response.data.on('error', reject)
        })
      }

      await streamConverter.handleEnd({
        accountId: 'local-api',
        accountType: 'local-api',
        statusCode: resp.response?.status || 200
      })
    } catch (error) {
      await streamConverter.handleError(error)
      throw error
    }
  }

  _withInternalHeader(endpoint, headers = {}) {
    const normalizedEndpoint = typeof endpoint === 'string' ? endpoint : ''
    if (!normalizedEndpoint.startsWith('/admin')) {
      return headers
    }
    const internalHeaderKey = 'x-ws-internal-key'
    const apiHeaderKey = 'x-api-key'
    const lowerKeys = Object.keys(headers).map((key) => key.toLowerCase())
    const hasInternal = lowerKeys.includes(internalHeaderKey)
    const hasApiKey = lowerKeys.includes(apiHeaderKey)
    if (!this.clientApiKey) {
      throw new Error('WS internal key is not configured for local admin request')
    }
    if (hasApiKey) {
      return headers
    }
    return {
      ...headers,
      ...(hasInternal ? {} : { [internalHeaderKey]: this.clientApiKey }),
      [apiHeaderKey]: this.clientApiKey
    }
  }

  async sendAck(requestId) {
    await this.websocketClient.sendMessage({
      type: 'request_ack',
      data: { requestId, status: 'accepted', message: 'Request accepted' }
    })
  }

  async sendError(requestId, error, account = null) {
    const errorCode = error.code || 'REQUEST_PROCESSING_ERROR'
    const errorType = this.classifyError(error)
    await this.websocketClient.sendMessage({
      type: 'error',
      data: {
        requestId,
        errorCode,
        errorType,
        message: error.message || 'Request processing failed',
        retryable: false,
        account
      }
    })
  }

  classifyError(error) {
    if (!error || typeof error !== 'object') {
      return 'unknown_error'
    }
    const msg = (error.message || '').toLowerCase()
    if (msg.includes('timeout')) {
      return 'timeout'
    }
    if (msg.includes('auth')) {
      return 'authentication_error'
    }
    return 'request_error'
  }
}

module.exports = WebSocketRequestHandler
