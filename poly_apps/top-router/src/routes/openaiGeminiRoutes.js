const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const { authenticateApiKey } = require('../middleware/auth')
const geminiAccountService = require('../services/geminiAccountService')
const unifiedGeminiScheduler = require('../services/unifiedGeminiScheduler')
const { getAvailableModels } = require('../services/geminiRelayService')
const clientRelayService = require('../services/clientRelayService')
const ccrAccountService = require('../services/ccrAccountService')
const crypto = require('crypto')
const axios = require('axios')
const ProxyHelper = require('../utils/proxyHelper')
const translationService = require('../translation/translationService')
const { parseVendorPrefixedModel } = require('../utils/modelHelper')
const apiKeyService = require('../services/apiKeyService')

// 生成会话哈希
function generateSessionHash(req) {
  const authSource =
    req.headers['authorization'] || req.headers['x-api-key'] || req.headers['x-goog-api-key']

  const sessionData = [req.headers['user-agent'], req.ip, authSource?.substring(0, 20)]
    .filter(Boolean)
    .join(':')

  return crypto.createHash('sha256').update(sessionData).digest('hex')
}

function ensureAntigravityProjectId(account) {
  if (account.projectId) {
    return account.projectId
  }
  if (account.tempProjectId) {
    return account.tempProjectId
  }
  return `ag-${crypto.randomBytes(8).toString('hex')}`
}

// 检查 API Key 权限
function checkPermissions(apiKeyData, requiredPermission = 'gemini') {
  return apiKeyService.hasPermission(apiKeyData?.permissions, requiredPermission)
}

function getTranslationOptions(req) {
  const target = String(
    req.headers['x-translation-target'] || req.query.translation_target || ''
  ).trim()
  if (!target) {
    return null
  }
  const source = String(
    req.headers['x-translation-source'] || req.query.translation_source || ''
  ).trim()
  return {
    targetLang: target,
    sourceLang: source || undefined
  }
}

function isOpenAIMessages(messages) {
  if (!Array.isArray(messages)) {
    return false
  }
  return messages.every(
    (item) => item && typeof item === 'object' && 'role' in item && 'content' in item
  )
}

function isGeminiContents(contents) {
  if (!Array.isArray(contents)) {
    return false
  }
  return contents.every((item) => item && typeof item === 'object' && Array.isArray(item.parts))
}

function normalizeSystemInstruction(systemInstruction) {
  if (!systemInstruction) {
    return null
  }
  if (typeof systemInstruction === 'string') {
    return { parts: [{ text: systemInstruction }] }
  }
  if (typeof systemInstruction === 'object') {
    if (Array.isArray(systemInstruction.parts)) {
      return systemInstruction
    }
    if (systemInstruction.text) {
      return { parts: [{ text: systemInstruction.text }] }
    }
  }
  return { parts: [{ text: String(systemInstruction) }] }
}

// 转换 OpenAI 消息格式到 Gemini 格式
function convertMessagesToGemini(messages) {
  const contents = []
  let systemInstruction = ''

  // 辅助函数：提取文本内容
  function extractTextContent(content) {
    // 处理 null 或 undefined
    if (content === null || content === undefined) {
      return ''
    }

    // 处理字符串
    if (typeof content === 'string') {
      return content
    }

    // 处理数组格式的内容
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (item === null || item === undefined) {
            return ''
          }
          if (typeof item === 'string') {
            return item
          }
          if (typeof item === 'object') {
            // 处理 {type: 'text', text: '...'} 格式
            if (item.type === 'text' && item.text) {
              return item.text
            }
            // 处理 {text: '...'} 格式
            if (item.text) {
              return item.text
            }
            // 处理嵌套的对象或数组
            if (item.content) {
              return extractTextContent(item.content)
            }
          }
          return ''
        })
        .join('')
    }

    // 处理对象格式的内容
    if (typeof content === 'object') {
      // 处理 {text: '...'} 格式
      if (content.text) {
        return content.text
      }
      // 处理 {content: '...'} 格式
      if (content.content) {
        return extractTextContent(content.content)
      }
      // 处理 {parts: [{text: '...'}]} 格式
      if (content.parts && Array.isArray(content.parts)) {
        return content.parts
          .map((part) => {
            if (part && part.text) {
              return part.text
            }
            return ''
          })
          .join('')
      }
    }

    // 最后的后备选项：只有在内容确实不为空且有意义时才转换为字符串
    if (
      content !== undefined &&
      content !== null &&
      content !== '' &&
      typeof content !== 'object'
    ) {
      return String(content)
    }

    return ''
  }

  for (const message of messages) {
    const textContent = extractTextContent(message.content)

    if (message.role === 'system') {
      systemInstruction += (systemInstruction ? '\n\n' : '') + textContent
    } else if (message.role === 'user') {
      contents.push({
        role: 'user',
        parts: [{ text: textContent }]
      })
    } else if (message.role === 'assistant') {
      contents.push({
        role: 'model',
        parts: [{ text: textContent }]
      })
    }
  }

  return { contents, systemInstruction }
}

// 转换 Gemini 响应到 OpenAI 格式
function convertGeminiResponseToOpenAI(geminiResponse, model, stream = false) {
  if (stream) {
    // 处理流式响应 - 原样返回 SSE 数据
    return geminiResponse
  } else {
    // 非流式响应转换
    // 处理嵌套的 response 结构
    const actualResponse = geminiResponse.response || geminiResponse

    if (actualResponse.candidates && actualResponse.candidates.length > 0) {
      const candidate = actualResponse.candidates[0]
      const content = candidate.content?.parts?.[0]?.text || ''
      const finishReason = candidate.finishReason?.toLowerCase() || 'stop'

      // 计算 token 使用量
      const usage = actualResponse.usageMetadata || {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      }

      return {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content
            },
            finish_reason: finishReason
          }
        ],
        usage: {
          prompt_tokens: usage.promptTokenCount,
          completion_tokens: usage.candidatesTokenCount,
          total_tokens: usage.totalTokenCount
        }
      }
    } else {
      throw new Error('No response from Gemini')
    }
  }
}

function buildGeminiApiUrl(baseUrl, model, action, apiKey, options = {}) {
  const { stream = false, listModels = false } = options
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '')
  const isNewFormat = normalizedBaseUrl.endsWith('/models')

  let url
  if (listModels) {
    if (isNewFormat) {
      url = `${normalizedBaseUrl}?key=${apiKey}`
    } else {
      url = `${normalizedBaseUrl}/v1beta/models?key=${apiKey}`
    }
  } else {
    const streamParam = stream ? '&alt=sse' : ''
    if (isNewFormat) {
      url = `${normalizedBaseUrl}/${model}:${action}?key=${apiKey}${streamParam}`
    } else {
      url = `${normalizedBaseUrl}/v1beta/models/${model}:${action}?key=${apiKey}${streamParam}`
    }
  }

  return url
}

function mapCcrModel(account, requestedModel) {
  if (
    account &&
    account.supportedModels &&
    typeof account.supportedModels === 'object' &&
    !Array.isArray(account.supportedModels)
  ) {
    return ccrAccountService.getMappedModel(account.supportedModels, requestedModel)
  }
  return requestedModel
}

// OpenAI 兼容的聊天完成端点
router.post('/v1/chat/completions', authenticateApiKey, async (req, res) => {
  const startTime = Date.now()
  let abortController = null
  let account = null // Declare account outside try block for error handling
  let accountSelection = null // Declare accountSelection for error handling
  let sessionHash = null // Declare sessionHash for error handling
  let isCcrAccount = false

  try {
    const apiKeyData = req.apiKey

    // 检查权限
    if (!checkPermissions(apiKeyData, 'gemini')) {
      return res.status(403).json({
        error: {
          message: 'This API key does not have permission to access Gemini',
          type: 'permission_denied',
          code: 'permission_denied'
        }
      })
    }
    // 处理请求体结构 - 支持多种格式
    let requestBody = req.body

    // 如果请求体被包装在 body 字段中，解包它
    if (req.body.body && typeof req.body.body === 'object') {
      requestBody = req.body.body
    }

    // 从 URL 路径中提取模型信息（如果存在）
    let urlModel = null
    const urlPath = req.body?.config?.url || req.originalUrl || req.url
    const modelMatch = urlPath.match(/\/([^/]+):(?:stream)?[Gg]enerateContent/)
    if (modelMatch) {
      urlModel = modelMatch[1]
      logger.debug(`Extracted model from URL: ${urlModel}`)
    }

    // 提取请求参数
    const {
      messages: requestMessages,
      contents: requestContents,
      model: bodyModel = 'gemini-2.0-flash-exp',
      temperature = 0.7,
      max_tokens = 4096,
      stream = false
    } = requestBody

    // 检查URL中是否包含stream标识
    const isStreamFromUrl = urlPath && urlPath.includes('streamGenerateContent')
    const actualStream = stream || isStreamFromUrl

    // 优先使用 URL 中的模型，其次是请求体中的模型
    let model = urlModel || bodyModel
    const { vendor, baseModel } = parseVendorPrefixedModel(model || '')
    if (vendor === 'ccr') {
      model = baseModel
    }

    const hasMessages = Array.isArray(requestMessages) && requestMessages.length > 0
    const hasContents = Array.isArray(requestContents) && requestContents.length > 0
    const contentsAreGemini = hasContents && isGeminiContents(requestContents)

    // 验证必需参数
    if (!hasMessages && !hasContents) {
      return res.status(400).json({
        error: {
          message: 'Messages or contents array is required',
          type: 'invalid_request_error',
          code: 'invalid_request'
        }
      })
    }

    const translationOptions = getTranslationOptions(req)
    let messages = null
    if (!contentsAreGemini) {
      messages = hasMessages ? requestMessages : requestContents
    }
    if (translationOptions && messages && isOpenAIMessages(messages)) {
      try {
        messages = await translationService.translateMessages(messages, {
          ...translationOptions,
          keyId: apiKeyData?.id
        })
      } catch (error) {
        logger.warn('Translation failed; proceeding with original messages', {
          error: error.message
        })
      }
    }

    // 检查模型限制
    if (apiKeyData.enableModelRestriction && apiKeyData.restrictedModels.length > 0) {
      if (!apiKeyData.restrictedModels.includes(model)) {
        return res.status(403).json({
          error: {
            message: `Model ${model} is not allowed for this API key`,
            type: 'invalid_request_error',
            code: 'model_not_allowed'
          }
        })
      }
    }

    let geminiContents = null
    let systemInstruction = null
    if (contentsAreGemini) {
      geminiContents = requestContents
      systemInstruction = requestBody.systemInstruction || requestBody.system_instruction || null
    } else {
      const converted = convertMessagesToGemini(messages)
      geminiContents = converted.contents
      systemInstruction = converted.systemInstruction
    }

    // 构建 Gemini 请求体
    const geminiRequestBody = {
      contents: geminiContents,
      generationConfig: {
        temperature,
        maxOutputTokens: max_tokens,
        candidateCount: 1
      }
    }

    const normalizedSystemInstruction = normalizeSystemInstruction(systemInstruction)
    if (normalizedSystemInstruction) {
      geminiRequestBody.systemInstruction = normalizedSystemInstruction
    }

    // 生成会话哈希用于粘性会话
    sessionHash = generateSessionHash(req)

    // 选择可用的 Gemini 账户
    try {
      accountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
        apiKeyData,
        sessionHash,
        model
      )

      if (accountSelection.accountType === 'client') {
        logger.info(`🔀 Using WS client relay for Gemini account: ${accountSelection.accountId}`)
        if (actualStream) {
          return await clientRelayService.relayStreamRequestWithUsageCapture(
            req,
            res,
            accountSelection.accountId,
            sessionHash,
            model,
            'gemini'
          )
        }
        return await clientRelayService.relayNonStreamRequest(
          req,
          res,
          accountSelection.accountId,
          sessionHash,
          model,
          'gemini'
        )
      }

      if (accountSelection.accountType === 'ccr') {
        account = await ccrAccountService.getAccount(accountSelection.accountId)
        isCcrAccount = true
      } else {
        account = await geminiAccountService.getAccount(accountSelection.accountId)
      }
    } catch (error) {
      logger.error('Failed to select Gemini account:', error)
      account = null
    }

    if (!account) {
      return res.status(503).json({
        error: {
          message: 'No available Gemini accounts',
          type: 'service_unavailable',
          code: 'service_unavailable'
        }
      })
    }

    if (isCcrAccount) {
      logger.info(`Using CCR account: ${account.id} for API key: ${apiKeyData.id}`)
      await ccrAccountService.markAccountUsed(account.id)
    } else {
      logger.info(`Using Gemini account: ${account.id} for API key: ${apiKeyData.id}`)
      await geminiAccountService.markAccountUsed(account.id)
    }

    // 解析账户的代理配置
    let proxyConfig = null
    if (account.proxy) {
      try {
        proxyConfig = typeof account.proxy === 'string' ? JSON.parse(account.proxy) : account.proxy
      } catch (e) {
        logger.warn('Failed to parse proxy configuration:', e)
      }
    }

    // 创建中止控制器
    abortController = new AbortController()

    // 处理客户端断开连接
    req.on('close', () => {
      if (abortController && !abortController.signal.aborted) {
        logger.info('Client disconnected, aborting Gemini request')
        abortController.abort()
      }
    })

    const upstreamModel = isCcrAccount ? mapCcrModel(account, model) : model

    // 获取OAuth客户端
    const client = isCcrAccount
      ? null
      : await geminiAccountService.getOauthClient(
          account.accessToken,
          account.refreshToken,
          proxyConfig,
          account.oauthProvider
        )
    if (actualStream) {
      // 流式响应
      const oauthProvider = account.oauthProvider || 'gemini-cli'
      let { projectId } = account

      if (oauthProvider === 'antigravity') {
        projectId = ensureAntigravityProjectId(account)
        if (!account.projectId && account.tempProjectId !== projectId) {
          await geminiAccountService.updateTempProjectId(account.id, projectId)
          account.tempProjectId = projectId
        }
      }

      logger.info('StreamGenerateContent request', {
        model: upstreamModel,
        projectId: isCcrAccount ? undefined : projectId,
        apiKeyId: apiKeyData.id
      })

      let streamResponse
      if (isCcrAccount) {
        const modelName = upstreamModel.startsWith('models/')
          ? upstreamModel.replace('models/', '')
          : upstreamModel
        const apiUrl = buildGeminiApiUrl(
          account.apiUrl,
          modelName,
          'streamGenerateContent',
          account.apiKey,
          { stream: true }
        )
        const axiosConfig = {
          method: 'POST',
          url: apiUrl,
          data: geminiRequestBody,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': account.apiKey,
            'x-goog-api-key': account.apiKey
          },
          responseType: 'stream',
          signal: abortController.signal
        }

        if (proxyConfig) {
          const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
          axiosConfig.httpsAgent = proxyAgent
          axiosConfig.httpAgent = proxyAgent
        }

        const apiResponse = await axios(axiosConfig)
        streamResponse = apiResponse.data
      } else {
        streamResponse =
          oauthProvider === 'antigravity'
            ? await geminiAccountService.generateContentStreamAntigravity(
                client,
                { model: upstreamModel, request: geminiRequestBody },
                null, // user_prompt_id
                projectId,
                apiKeyData.id, // 使用 API Key ID 作为 session ID
                abortController.signal, // 传递中止信号
                proxyConfig // 传递代理配置
              )
            : await geminiAccountService.generateContentStream(
                client,
                { model: upstreamModel, request: geminiRequestBody },
                null, // user_prompt_id
                projectId, // 使用有权限的项目ID
                apiKeyData.id, // 使用 API Key ID 作为 session ID
                abortController.signal, // 传递中止信号
                proxyConfig // 传递代理配置
              )
      }

      // 设置流式响应头
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')

      // 处理流式响应，转换为 OpenAI 格式
      let buffer = ''

      // 发送初始的空消息，符合 OpenAI 流式格式
      const initialChunk = {
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            delta: { role: 'assistant' },
            finish_reason: null
          }
        ]
      }
      res.write(`data: ${JSON.stringify(initialChunk)}\n\n`)

      // 用于收集usage数据
      let totalUsage = {
        promptTokenCount: 0,
        candidatesTokenCount: 0,
        totalTokenCount: 0
      }
      let usageReported = false // 修复：改为 let 以便后续修改

      streamResponse.on('data', (chunk) => {
        try {
          const chunkStr = chunk.toString()

          if (!chunkStr.trim()) {
            return
          }

          buffer += chunkStr
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // 保留最后一个不完整的行

          for (const line of lines) {
            if (!line.trim()) {
              continue
            }

            // 处理 SSE 格式
            let jsonData = line
            if (line.startsWith('data: ')) {
              jsonData = line.substring(6).trim()
            }

            if (!jsonData || jsonData === '[DONE]') {
              continue
            }

            try {
              const data = JSON.parse(jsonData)
              const responsePayload =
                data && typeof data.response === 'object' ? data.response : data

              // 捕获usage数据
              let usageMetadata = responsePayload?.usageMetadata || data.usageMetadata
              if (!usageMetadata && data.usage) {
                const promptTokens = data.usage.prompt_tokens ?? data.usage.input_tokens ?? 0
                const completionTokens =
                  data.usage.completion_tokens ?? data.usage.output_tokens ?? 0
                const totalTokens =
                  data.usage.total_tokens ?? Number(promptTokens) + Number(completionTokens)
                usageMetadata = {
                  promptTokenCount: Number(promptTokens) || 0,
                  candidatesTokenCount: Number(completionTokens) || 0,
                  totalTokenCount: Number(totalTokens) || 0
                }
              }
              if (usageMetadata) {
                totalUsage = usageMetadata
                logger.debug('📊 Captured Gemini usage data:', totalUsage)
              }

              // 转换为 OpenAI 流式格式
              if (responsePayload?.candidates && responsePayload.candidates.length > 0) {
                const candidate = responsePayload.candidates[0]
                const content = candidate.content?.parts?.[0]?.text || ''
                const finishReason =
                  typeof candidate.finishReason === 'string' ? candidate.finishReason : null
                const finishReasonNormalized = finishReason?.toLowerCase() || ''

                // 只有当有内容或者是结束标记时才发送数据
                if (content || finishReasonNormalized === 'stop') {
                  const openaiChunk = {
                    id: `chatcmpl-${Date.now()}`,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model,
                    choices: [
                      {
                        index: 0,
                        delta: content ? { content } : {},
                        finish_reason: finishReasonNormalized === 'stop' ? 'stop' : null
                      }
                    ]
                  }

                  res.write(`data: ${JSON.stringify(openaiChunk)}\n\n`)

                  // 如果结束了，添加 usage 信息并发送最终的 [DONE]
                  if (finishReasonNormalized === 'stop') {
                    // 如果有 usage 数据，添加到最后一个 chunk
                    if (usageMetadata) {
                      const usageChunk = {
                        id: `chatcmpl-${Date.now()}`,
                        object: 'chat.completion.chunk',
                        created: Math.floor(Date.now() / 1000),
                        model,
                        choices: [
                          {
                            index: 0,
                            delta: {},
                            finish_reason: 'stop'
                          }
                        ],
                        usage: {
                          prompt_tokens: usageMetadata.promptTokenCount || 0,
                          completion_tokens: usageMetadata.candidatesTokenCount || 0,
                          total_tokens: usageMetadata.totalTokenCount || 0
                        }
                      }
                      res.write(`data: ${JSON.stringify(usageChunk)}\n\n`)
                    }
                    res.write('data: [DONE]\n\n')
                  }
                }
              }
            } catch (e) {
              logger.debug('Error parsing JSON line:', e.message)
            }
          }
        } catch (error) {
          logger.error('Stream processing error:', error)
          if (!res.headersSent) {
            res.status(500).json({
              error: {
                message: error.message || 'Stream error',
                type: 'api_error'
              }
            })
          }
        }
      })

      streamResponse.on('end', async () => {
        logger.info('Stream completed successfully')

        // 记录使用统计
        if (!usageReported && totalUsage.totalTokenCount > 0) {
          try {
            await apiKeyService.recordUsage(
              apiKeyData.id,
              totalUsage.promptTokenCount || 0,
              totalUsage.candidatesTokenCount || 0,
              0, // cacheCreateTokens
              0, // cacheReadTokens
              model,
              account.id
            )
            logger.info(
              `📊 Recorded Gemini stream usage - Input: ${totalUsage.promptTokenCount}, Output: ${totalUsage.candidatesTokenCount}, Total: ${totalUsage.totalTokenCount}`
            )

            // 修复：标记 usage 已上报，避免重复上报
            usageReported = true
          } catch (error) {
            logger.error('Failed to record Gemini usage:', error)
          }
        }

        if (!res.headersSent) {
          res.write('data: [DONE]\n\n')
        }
        res.end()
      })

      streamResponse.on('error', (error) => {
        logger.error('Stream error:', error)
        if (!res.headersSent) {
          res.status(500).json({
            error: {
              message: error.message || 'Stream error',
              type: 'api_error'
            }
          })
        } else {
          // 如果已经开始发送流数据，发送错误事件
          // 修复：使用 JSON.stringify 避免字符串插值导致的格式错误
          if (!res.destroyed) {
            try {
              res.write(
                `data: ${JSON.stringify({
                  error: {
                    message: error.message || 'Stream error',
                    type: 'stream_error',
                    code: error.code
                  }
                })}\n\n`
              )
              res.write('data: [DONE]\n\n')
            } catch (writeError) {
              logger.error('Error sending error event:', writeError)
            }
          }
          res.end()
        }
      })
    } else {
      // 非流式响应
      const oauthProvider = account.oauthProvider || 'gemini-cli'
      let { projectId } = account

      if (oauthProvider === 'antigravity') {
        projectId = ensureAntigravityProjectId(account)
        if (!account.projectId && account.tempProjectId !== projectId) {
          await geminiAccountService.updateTempProjectId(account.id, projectId)
          account.tempProjectId = projectId
        }
      }

      logger.info('GenerateContent request', {
        model: upstreamModel,
        projectId: isCcrAccount ? undefined : projectId,
        apiKeyId: apiKeyData.id
      })

      let response
      if (isCcrAccount) {
        const modelName = upstreamModel.startsWith('models/')
          ? upstreamModel.replace('models/', '')
          : upstreamModel
        const apiUrl = buildGeminiApiUrl(
          account.apiUrl,
          modelName,
          'generateContent',
          account.apiKey
        )
        const axiosConfig = {
          method: 'POST',
          url: apiUrl,
          data: geminiRequestBody,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': account.apiKey,
            'x-goog-api-key': account.apiKey
          },
          signal: abortController.signal
        }

        if (proxyConfig) {
          const proxyAgent = ProxyHelper.createProxyAgent(proxyConfig)
          axiosConfig.httpsAgent = proxyAgent
          axiosConfig.httpAgent = proxyAgent
        }

        const apiResponse = await axios(axiosConfig)
        response = apiResponse.data
      } else {
        response =
          oauthProvider === 'antigravity'
            ? await geminiAccountService.generateContentAntigravity(
                client,
                { model: upstreamModel, request: geminiRequestBody },
                null, // user_prompt_id
                projectId,
                apiKeyData.id, // 使用 API Key ID 作为 session ID
                proxyConfig // 传递代理配置
              )
            : await geminiAccountService.generateContent(
                client,
                { model: upstreamModel, request: geminiRequestBody },
                null, // user_prompt_id
                projectId, // 使用有权限的项目ID
                apiKeyData.id, // 使用 API Key ID 作为 session ID
                proxyConfig // 传递代理配置
              )
      }

      // 转换为 OpenAI 格式并返回
      const openaiResponse = convertGeminiResponseToOpenAI(response, model, false)

      // 记录使用统计
      if (openaiResponse.usage) {
        try {
          await apiKeyService.recordUsage(
            apiKeyData.id,
            openaiResponse.usage.prompt_tokens || 0,
            openaiResponse.usage.completion_tokens || 0,
            0, // cacheCreateTokens
            0, // cacheReadTokens
            model,
            account.id
          )
          logger.info(
            `📊 Recorded Gemini usage - Input: ${openaiResponse.usage.prompt_tokens}, Output: ${openaiResponse.usage.completion_tokens}, Total: ${openaiResponse.usage.total_tokens}`
          )
        } catch (error) {
          logger.error('Failed to record Gemini usage:', error)
        }
      }

      res.json(openaiResponse)
    }

    const duration = Date.now() - startTime
    logger.info(`OpenAI-Gemini request completed in ${duration}ms`)
  } catch (error) {
    // 客户端主动断开连接是正常情况，使用 INFO 级别
    if (error.message === 'Client disconnected') {
      logger.info('🔌 OpenAI-Gemini stream ended: Client disconnected')
    } else {
      const statusForLog = error?.status || error?.response?.status
      logger.error('OpenAI-Gemini request error', {
        message: error?.message,
        status: statusForLog,
        code: error?.code,
        requestUrl: error?.config?.url,
        requestMethod: error?.config?.method,
        upstreamTraceId: error?.response?.headers?.['x-cloudaicompanion-trace-id']
      })
    }

    // 处理速率限制
    if (error.status === 429) {
      if (req.apiKey && account && accountSelection) {
        if (accountSelection.accountType === 'ccr') {
          await ccrAccountService.markAccountRateLimited(account.id)
        } else {
          await unifiedGeminiScheduler.markAccountRateLimited(
            account.id,
            accountSelection.accountType || 'gemini',
            sessionHash
          )
        }
      }
    }

    // 检查响应是否已发送（流式响应场景），避免 ERR_HTTP_HEADERS_SENT
    if (!res.headersSent) {
      // 客户端断开使用 499 状态码 (Client Closed Request)
      if (error.message === 'Client disconnected') {
        res.status(499).end()
      } else {
        // 返回 OpenAI 格式的错误响应
        const status = error.status || 500
        const errorResponse = {
          error: error.error || {
            message: error.message || 'Internal server error',
            type: 'server_error',
            code: 'internal_error'
          }
        }
        res.status(status).json(errorResponse)
      }
    }
  } finally {
    // 清理资源
    if (abortController) {
      abortController = null
    }
  }
  return undefined
})

// OpenAI 兼容的模型列表端点
router.get('/v1/models', authenticateApiKey, async (req, res) => {
  try {
    const apiKeyData = req.apiKey

    // 检查权限
    if (!checkPermissions(apiKeyData, 'gemini')) {
      return res.status(403).json({
        error: {
          message: 'This API key does not have permission to access Gemini',
          type: 'permission_denied',
          code: 'permission_denied'
        }
      })
    }

    // 选择账户获取模型列表
    let account = null
    try {
      const accountSelection = await unifiedGeminiScheduler.selectAccountForApiKey(
        apiKeyData,
        null,
        null
      )
      if (accountSelection.accountType === 'client') {
        account = null
      } else {
        account = await geminiAccountService.getAccount(accountSelection.accountId)
      }
    } catch (error) {
      logger.warn('Failed to select Gemini account for models endpoint:', error)
    }

    let models = []

    if (account) {
      // 获取实际的模型列表（失败时回退到默认列表，避免影响 /v1/models 可用性）
      try {
        const oauthProvider = account.oauthProvider || 'gemini-cli'
        models =
          oauthProvider === 'antigravity'
            ? await geminiAccountService.fetchAvailableModelsAntigravity(
                account.accessToken,
                account.proxy,
                account.refreshToken
              )
            : await getAvailableModels(account.accessToken, account.proxy)
      } catch (error) {
        logger.warn('Failed to get Gemini models list from upstream, fallback to default:', error)
        models = []
      }
    } else {
      // 返回默认模型列表
      models = [
        {
          id: 'gemini-2.0-flash-exp',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'google'
        }
      ]
    }

    if (!models || models.length === 0) {
      models = [
        {
          id: 'gemini-2.0-flash-exp',
          object: 'model',
          created: Math.floor(Date.now() / 1000),
          owned_by: 'google'
        }
      ]
    }

    // 如果启用了模型限制，过滤模型列表
    if (apiKeyData.enableModelRestriction && apiKeyData.restrictedModels.length > 0) {
      models = models.filter((model) => apiKeyData.restrictedModels.includes(model.id))
    }

    res.json({
      object: 'list',
      data: models
    })
  } catch (error) {
    logger.error('Failed to get OpenAI-Gemini models:', error)
    res.status(500).json({
      error: {
        message: 'Failed to retrieve models',
        type: 'server_error',
        code: 'internal_error'
      }
    })
  }
  return undefined
})

// OpenAI 兼容的模型详情端点
router.get('/v1/models/:model', authenticateApiKey, async (req, res) => {
  try {
    const apiKeyData = req.apiKey
    const modelId = req.params.model

    // 检查权限
    if (!checkPermissions(apiKeyData, 'gemini')) {
      return res.status(403).json({
        error: {
          message: 'This API key does not have permission to access Gemini',
          type: 'permission_denied',
          code: 'permission_denied'
        }
      })
    }

    // 检查模型限制
    if (apiKeyData.enableModelRestriction && apiKeyData.restrictedModels.length > 0) {
      if (!apiKeyData.restrictedModels.includes(modelId)) {
        return res.status(404).json({
          error: {
            message: `Model '${modelId}' not found`,
            type: 'invalid_request_error',
            code: 'model_not_found'
          }
        })
      }
    }

    // 返回模型信息
    res.json({
      id: modelId,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'google',
      permission: [],
      root: modelId,
      parent: null
    })
  } catch (error) {
    logger.error('Failed to get model details:', error)
    res.status(500).json({
      error: {
        message: 'Failed to retrieve model details',
        type: 'server_error',
        code: 'internal_error'
      }
    })
  }
  return undefined
})

module.exports = router
