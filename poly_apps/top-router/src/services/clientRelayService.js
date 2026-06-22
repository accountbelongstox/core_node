'use strict'

const { v4: uuidv4 } = require('uuid')
const config = require('../../config/config')
const datastore = require('../models/datastore')
const logger = require('../utils/logger')
const { updateRateLimitCounters } = require('../utils/rateLimitHelper')
const { prepareStreamResponse, sendSseEvent } = require('../utils/responseAdapter')
const apiKeyService = require('./apiKeyService')
const clientService = require('./clientService')

/**
 * Client Relay Service - 将 HTTP 请求通过 WebSocket 转发到 Claude-Relay-Client
 * 支持流式/非流式、Usage 捕获以及基础限流计数。
 */
class ClientRelayService {
  constructor(wsServer = null) {
    this.wsServer = wsServer
    this.requestTimeout =
      config.client?.request?.timeout || config.request?.timeout || config.requestTimeout || 600000
  }

  /**
   * 设置 WebSocket server 实例（在 attachServer 后调用）
   */
  setWsServer(wsServer) {
    this.wsServer = wsServer
    logger.info('✅ WebSocket server instance set for ClientRelayService')
  }

  /**
   * 转换 OpenAI SSE 格式为 Gemini SSE 格式（最小兼容转换）
   */
  _convertOpenAIToGeminiSSE(openaiChunk) {
    try {
      const lines = openaiChunk.trim().split('\n')
      const geminiChunks = []

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.substring(6)
          if (jsonStr === '[DONE]') {
            continue
          }

          try {
            const openaiData = JSON.parse(jsonStr)
            if (openaiData.choices && openaiData.choices[0]) {
              const choice = openaiData.choices[0]
              const delta = choice.delta || {}

              const geminiData = {
                candidates: [
                  {
                    content: {
                      parts: delta.content ? [{ text: delta.content }] : [],
                      role: 'model'
                    },
                    finishReason: choice.finish_reason || null,
                    index: choice.index || 0
                  }
                ]
              }

              if (openaiData.usage) {
                geminiData.usageMetadata = {
                  promptTokenCount: openaiData.usage.prompt_tokens || 0,
                  candidatesTokenCount: openaiData.usage.completion_tokens || 0,
                  totalTokenCount: openaiData.usage.total_tokens || 0
                }
              }

              geminiChunks.push(`data: ${JSON.stringify(geminiData)}\n\n`)
            }
          } catch (e) {
            geminiChunks.push(`${line}\n`)
          }
        } else if (line === '') {
          geminiChunks.push('\n')
        } else {
          geminiChunks.push(`${line}\n`)
        }
      }

      return geminiChunks.join('')
    } catch (error) {
      logger.warn('⚠️ Failed to convert OpenAI SSE to Gemini format:', error)
      return openaiChunk
    }
  }

  /**
   * 将 OpenAI 非流式响应转换为 Gemini 格式
   */
  _convertOpenAIToGeminiResponse(openaiResponse) {
    try {
      if (!openaiResponse.choices || !openaiResponse.choices[0]) {
        return openaiResponse
      }

      const choice = openaiResponse.choices[0]
      const message = choice.message || {}

      const finishReasonMap = {
        stop: 'STOP',
        length: 'MAX_TOKENS',
        content_filter: 'SAFETY',
        tool_calls: 'STOP'
      }
      const finishReason = finishReasonMap[choice.finish_reason] || 'STOP'

      const geminiResponse = {
        candidates: [
          {
            content: {
              parts: message.content ? [{ text: message.content }] : [],
              role: 'model'
            },
            finishReason,
            safetyRatings: []
          }
        ],
        promptFeedback: {
          safetyRatings: []
        }
      }

      if (openaiResponse.model) {
        geminiResponse.modelVersion = openaiResponse.model
      }

      if (openaiResponse.usage) {
        geminiResponse.usageMetadata = {
          promptTokenCount: openaiResponse.usage.prompt_tokens || 0,
          candidatesTokenCount: openaiResponse.usage.completion_tokens || 0,
          totalTokenCount: openaiResponse.usage.total_tokens || 0
        }
      }

      return geminiResponse
    } catch (error) {
      logger.warn('⚠️ Failed to convert OpenAI response to Gemini format:', error)
      return openaiResponse
    }
  }

  /**
   * 转发流式请求并捕获 Usage
   */
  async relayStreamRequestWithUsageCapture(req, res, clientId, sessionHash, model, accountType) {
    if (!this.wsServer) {
      throw new Error('WebSocket server not initialized')
    }

    const requestId = `req-${uuidv4()}`
    const usageSummary = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }

    const disposeStream = prepareStreamResponse(res)

    try {
      const apiKey = await clientService.getDecryptedApiKey(clientId)
      const codexUpstream = this._getCodexUpstreamTarget(req)

      const requestPayload = {
        apiKey,
        requestId,
        service: this._getServiceType(req.originalUrl || req.path),
        accountType,
        endpoint: req.originalUrl || req.path,
        method: req.method,
        headers: this._prepareHeaders(req.headers, apiKey),
        body: req.body,
        options: {
          timeout: this.requestTimeout,
          sessionHash,
          codexRoute: req.codexRoute || 'standard',
          accountSelection: {
            model: model || req.body.model,
            stream: req.body.stream !== false
          }
        }
      }

      if (codexUpstream) {
        requestPayload.upstream = codexUpstream
      }

      await this._incrementConcurrency(clientId, requestId)

      logger.info(`🚀 Relaying stream request ${requestId} to client ${clientId}`)

      if (typeof res.flushHeaders === 'function' && !res.headersSent) {
        res.flushHeaders()
        logger.info(`📤 Response headers flushed for request ${requestId}`)
      }

      let chunkCount = 0
      let totalBytes = 0
      const result = await this.wsServer.sendStreamRequest(
        clientId,
        requestPayload,
        (chunkData = {}) => {
          const rawChunk = chunkData.chunk || ''
          const encoding = chunkData.encoding || 'utf8'
          const chunkStr =
            typeof rawChunk === 'string' ? rawChunk : Buffer.from(rawChunk, encoding).toString()
          chunkCount++
          totalBytes += chunkStr.length

          const isGeminiService =
            accountType === 'gemini' ||
            this._getServiceType(req.originalUrl || req.path) === 'gemini'
          let processedChunk = chunkStr
          if (isGeminiService && chunkStr.includes('"object":"chat.completion.chunk"')) {
            processedChunk = this._convertOpenAIToGeminiSSE(chunkStr)
            if (chunkCount === 1) {
              logger.info(`🔄 Converting OpenAI SSE to Gemini format for request ${requestId}`)
            }
          }

          if (!res.destroyed && !res.writableEnded) {
            const written = res.write(processedChunk, 'utf8')
            if (!written) {
              logger.warn(`⚠️ Write buffer full for request ${requestId}, backpressure applied`)
            }
          } else {
            logger.warn(
              `⚠️ Response stream closed for request ${requestId}, chunk ${chunkCount} discarded`
            )
          }

          if (processedChunk.includes('event: message_stop')) {
            try {
              const match = processedChunk.match(/data: ({.*})/)
              if (match) {
                const data = JSON.parse(match[1])
                if (data.usage) {
                  Object.assign(usageSummary, data.usage)
                  logger.debug('📊 Captured usage from message_stop:', usageSummary)
                }
              }
            } catch (_) {
              // ignore parse errors
            }
          }
        },
        this.requestTimeout
      )

      logger.info(
        `📊 Streamed ${chunkCount} chunks (${totalBytes} bytes) for request ${requestId}`
      )

      if (result.usage) {
        Object.assign(usageSummary, result.usage)
        logger.info(`✅ Stream request ${requestId} completed with usage:`, usageSummary)
      }

      res.end()

      const modelToRecord = usageSummary.model || result.usage?.model || model || req.body.model
      await this._recordUsage(
        req.apiKeyId,
        usageSummary,
        modelToRecord,
        clientId,
        'client',
        req.rateLimitInfo
      )

      if (typeof datastore.hset === 'function') {
        try {
          await datastore.hset(`client:${clientId}`, {
            lastUsedAt: new Date().toISOString()
          })
        } catch (error) {
          logger.warn('⚠️ Failed to update client lastUsedAt:', error)
        }
      } else {
        logger.warn('⚠️ datastore.hset is not available; skip updating client lastUsedAt')
      }
    } catch (error) {
      logger.error(`❌ Stream relay failed for request ${requestId}:`, error)
      await clientService.markClientError(clientId, error, error.statusCode)

      sendSseEvent(res, 'error', {
        type: 'error',
        error: {
          type: 'api_error',
          message: error.message || 'Request failed'
        }
      })
      res.end()

      if (usageSummary.input_tokens > 0 || usageSummary.output_tokens > 0) {
        await this._recordUsage(
          req.apiKeyId,
          usageSummary,
          model || req.body.model,
          clientId,
          'client',
          req.rateLimitInfo
        )
      }
    } finally {
      await this._decrementConcurrency(clientId, requestId)
      disposeStream?.()
    }
  }

  /**
   * 转发非流式请求
   */
  async relayNonStreamRequest(req, res, clientId, sessionHash, model, accountType) {
    if (!this.wsServer) {
      throw new Error('WebSocket server not initialized')
    }

    const requestId = `req-${uuidv4()}`
    const usageSummary = {
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0
    }

    try {
      const apiKey = await clientService.getDecryptedApiKey(clientId)
      const codexUpstream = this._getCodexUpstreamTarget(req)

      const requestPayload = {
        apiKey,
        requestId,
        service: this._getServiceType(req.originalUrl || req.path),
        accountType,
        endpoint: req.originalUrl || req.path,
        method: req.method,
        headers: this._prepareHeaders(req.headers, apiKey),
        body: req.body,
        options: {
          timeout: this.requestTimeout,
          sessionHash,
          codexRoute: req.codexRoute || 'standard',
          accountSelection: {
            model: model || req.body.model,
            stream: req.body?.stream !== false
          }
        }
      }

      if (codexUpstream) {
        requestPayload.upstream = codexUpstream
      }

      await this._incrementConcurrency(clientId, requestId)
      logger.info(`🚀 Relaying non-stream request ${requestId} to client ${clientId}`)

      const result = await this.wsServer.sendNonStreamRequest(
        clientId,
        requestPayload,
        this.requestTimeout
      )

      const { statusCode, headers, body } = result
      const isGeminiService =
        accountType === 'gemini' || this._getServiceType(req.originalUrl || req.path) === 'gemini'
      let processedBody = body
      if (isGeminiService && body && body.choices) {
        processedBody = this._convertOpenAIToGeminiResponse(body)
        logger.info(
          `🔄 Converted non-stream response from OpenAI to Gemini format for request ${requestId}`
        )
      }

      let actualModel = null
      if (processedBody && typeof processedBody === 'object') {
        actualModel =
          processedBody.model ||
          processedBody.modelVersion ||
          (processedBody.metadata && processedBody.metadata.model) ||
          null

        const usage = processedBody.usageMetadata || processedBody.usage
        if (usage) {
          if (usage.promptTokenCount !== undefined) {
            usageSummary.input_tokens = usage.promptTokenCount
            usageSummary.output_tokens = usage.candidatesTokenCount || 0
          } else if (usage.prompt_tokens !== undefined) {
            usageSummary.input_tokens = usage.prompt_tokens
            usageSummary.output_tokens = usage.completion_tokens || 0
          }
          logger.info(`✅ Non-stream request ${requestId} completed with usage:`, usageSummary)
        }
      }

      res.status(statusCode)
      if (headers) {
        Object.keys(headers).forEach((key) => {
          res.setHeader(key, headers[key])
        })
      }
      res.json(processedBody)

      const modelToRecord = actualModel || model || req.body.model
      await this._recordUsage(
        req.apiKeyId,
        usageSummary,
        modelToRecord,
        clientId,
        'client',
        req.rateLimitInfo
      )

      if (typeof datastore.hset === 'function') {
        try {
          await datastore.hset(`client:${clientId}`, {
            lastUsedAt: new Date().toISOString()
          })
        } catch (error) {
          logger.warn('⚠️ Failed to update client lastUsedAt:', error)
        }
      } else {
        logger.warn('⚠️ datastore.hset is not available; skip updating client lastUsedAt')
      }
    } catch (error) {
      logger.error(`❌ Non-stream relay failed for request ${requestId}:`, error)
      await clientService.markClientError(clientId, error, error.statusCode)

      res.status(error.statusCode || 500).json({
        error: {
          type: 'api_error',
          message: error.message || 'Request failed'
        }
      })

      if (usageSummary.input_tokens > 0 || usageSummary.output_tokens > 0) {
        await this._recordUsage(
          req.apiKeyId,
          usageSummary,
          model || req.body.model,
          clientId,
          'client',
          req.rateLimitInfo
        )
      }
    } finally {
      await this._decrementConcurrency(clientId, requestId)
    }
  }

  _prepareHeaders(headers = {}, clientApiKey = '') {
    const preparedHeaders = { ...headers }
    delete preparedHeaders.host
    delete preparedHeaders.connection
    delete preparedHeaders['x-api-key']
    delete preparedHeaders.authorization
    delete preparedHeaders['x-goog-api-key']
    delete preparedHeaders['api-key']
    if (clientApiKey) {
      preparedHeaders['api-key'] = clientApiKey
    }
    return preparedHeaders
  }

  _getServiceType(path = '') {
    const normalized = String(path || '').toLowerCase()
    if (normalized.includes('/gemini/')) {
      return 'gemini'
    }
    if (normalized.includes('/openai/')) {
      return 'openai'
    }
    if (normalized.includes('/droid/')) {
      return 'droid'
    }
    return 'claude'
  }

  _getCodexUpstreamTarget(req) {
    if (!req) {
      return null
    }

    const normalizedPath = (req.path || '').toLowerCase()
    const normalizedOriginal = (req.originalUrl || '').toLowerCase()
    const matchesResponsesPath =
      normalizedPath.startsWith('/responses') || normalizedPath.startsWith('/v1/responses')
    const isOpenaiRoute =
      normalizedOriginal.includes('/openai/responses') ||
      normalizedOriginal.includes('/openai/v1/responses') ||
      normalizedOriginal === normalizedPath

    if (!matchesResponsesPath || !isOpenaiRoute) {
      return null
    }

    const codexRoute = req.codexRoute === 'compact' ? 'compact' : 'standard'
    const baseUrl = 'https://chatgpt.com/backend-api/codex/responses'
    const url = codexRoute === 'compact' ? `${baseUrl}/compact` : baseUrl

    return {
      type: 'openai-codex',
      url,
      route: codexRoute
    }
  }

  async _recordUsage(keyId, usage, model, accountId, accountType, rateLimitInfo = null) {
    try {
      await apiKeyService.recordUsageWithDetails(keyId, usage, model, accountId, accountType)
      logger.debug(`📊 Usage recorded for key ${keyId}:`, usage)

      if (rateLimitInfo) {
        const inputTokens = usage.input_tokens || 0
        const outputTokens = usage.output_tokens || 0
        const cacheCreateTokens = usage.cache_creation_input_tokens || 0
        const cacheReadTokens = usage.cache_read_input_tokens || 0

        const { totalTokens, totalCost } = await updateRateLimitCounters(
          rateLimitInfo,
          {
            inputTokens,
            outputTokens,
            cacheCreateTokens,
            cacheReadTokens
          },
          model
        )

        if (totalTokens > 0) {
          logger.api(`📊 Updated rate limit token count (client): +${totalTokens} tokens`)
        }
        if (typeof totalCost === 'number' && totalCost > 0) {
          logger.api(`💰 Updated rate limit cost count (client): +$${totalCost.toFixed(6)}`)
        }
      }
    } catch (error) {
      logger.error(`❌ Failed to record usage for key ${keyId}:`, error)
    }
  }

  async _incrementConcurrency(clientId, requestId) {
    try {
      const expireAt = Date.now() + this.requestTimeout
      await datastore.zadd(`concurrency:client:${clientId}`, expireAt, requestId)
      logger.debug(`➕ Incremented concurrency for client ${clientId}`)
    } catch (error) {
      logger.error('❌ Failed to increment concurrency:', error)
    }
  }

  async _decrementConcurrency(clientId, requestId) {
    try {
      await datastore.zrem(`concurrency:client:${clientId}`, requestId)
      logger.debug(`➖ Decremented concurrency for client ${clientId}`)
    } catch (error) {
      logger.error('❌ Failed to decrement concurrency:', error)
    }
  }
}

module.exports = new ClientRelayService()
