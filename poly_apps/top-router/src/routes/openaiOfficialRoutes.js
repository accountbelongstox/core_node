const express = require('express')
const axios = require('axios')
const { authenticateApiKey } = require('../middleware/auth')
const apiKeyService = require('../services/apiKeyService')
const config = require('../../config/config')
const logger = require('../utils/logger')
const ProxyHelper = require('../utils/proxyHelper')

const router = express.Router()

function getBaseUrl() {
  const base = config.openaiOfficial?.baseUrl || 'https://api.openai.com'
  return base.replace(/\/+$/, '')
}

function hasOpenAIPermission(apiKeyData = {}) {
  return apiKeyService.hasPermission(apiKeyData?.permissions, 'openai')
}

function buildHeaders(req, apiKey) {
  const isStream = req.body?.stream === true
  const incoming = req.headers || {}
  const headers = {
    authorization: `Bearer ${apiKey}`,
    'content-type': 'application/json',
    accept: isStream ? 'text/event-stream' : 'application/json'
  }

  // 环境变量指定的 org/project 优先
  if (config.openaiOfficial?.organization) {
    headers['openai-organization'] = config.openaiOfficial.organization
  }
  if (config.openaiOfficial?.project) {
    headers['openai-project'] = config.openaiOfficial.project
  }

  // 允许透传少量安全头
  const passThroughKeys = [
    'openai-organization',
    'openai-project',
    'openai-version',
    'x-request-id'
  ]
  for (const key of passThroughKeys) {
    if (incoming[key]) {
      headers[key] = incoming[key]
    }
  }

  return headers
}

function createProxyAgent() {
  // 如需专门代理可在 config.proxy 中新增配置对象并在此读取
  return ProxyHelper.createProxyAgent(config.proxy?.openaiOfficial || null)
}

async function handleUpstream(req, res, endpointPath) {
  const apiKey = config.openaiOfficial?.apiKey || ''
  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: 'OPENAI_API_KEY is not configured for official OpenAI routing',
        type: 'configuration_error',
        code: 'missing_openai_api_key'
      }
    })
  }

  if (!hasOpenAIPermission(req.apiKey)) {
    return res.status(403).json({
      error: {
        message: 'This API key does not have permission to access OpenAI',
        type: 'permission_denied',
        code: 'permission_denied'
      }
    })
  }

  const baseUrl = getBaseUrl()
  const targetUrl = `${baseUrl}${endpointPath}`
  const isStream = req.body?.stream === true
  const headers = buildHeaders(req, apiKey)
  const timeout = config.openaiOfficial?.timeoutMs || config.requestTimeout || 120000
  const proxyAgent = createProxyAgent()

  const axiosConfig = {
    headers,
    timeout,
    validateStatus: () => true
  }

  if (proxyAgent) {
    axiosConfig.httpAgent = proxyAgent
    axiosConfig.httpsAgent = proxyAgent
    axiosConfig.proxy = false
    logger.info('🌐 Using proxy agent for official OpenAI request')
  }

  try {
    if (!isStream) {
      const upstream = await axios.post(targetUrl, req.body, axiosConfig)
      res.status(upstream.status)

      // 透传诊断头
      const passHeaders = ['x-request-id', 'openai-processing-ms', 'openai-version']
      passHeaders.forEach((key) => {
        if (upstream.headers?.[key]) {
          res.setHeader(key, upstream.headers[key])
        }
      })

      // 记录用量
      const usage = upstream.data?.usage
      const model = upstream.data?.model || req.body?.model || 'openai'
      if (usage && req.apiKey?.id) {
        try {
          await apiKeyService.recordUsage(
            req.apiKey.id,
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            0,
            0,
            model,
            'openai-official'
          )
        } catch (err) {
          logger.error('Failed to record OpenAI official usage:', err)
        }
      }

      return res.json(upstream.data)
    }

    // 流式响应
    const upstream = await axios.post(targetUrl, req.body, {
      ...axiosConfig,
      responseType: 'stream'
    })

    if (upstream.status >= 400) {
      // 将错误流收集成文本/JSON 返回
      const chunks = []
      await new Promise((resolve) => {
        upstream.data.on('data', (c) => chunks.push(c))
        upstream.data.on('end', resolve)
        upstream.data.on('error', resolve)
        setTimeout(resolve, 5000)
      })
      const raw = Buffer.concat(chunks).toString()
      let payload = raw
      try {
        payload = JSON.parse(raw)
      } catch (_) {
        payload = { error: { message: raw || 'Upstream error' } }
      }
      return res.status(upstream.status).json(payload)
    }

    res.status(upstream.status)
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders()
    }

    const passHeaders = ['x-request-id', 'openai-processing-ms', 'openai-version']
    passHeaders.forEach((key) => {
      if (upstream.headers?.[key]) {
        res.setHeader(key, upstream.headers[key])
      }
    })

    let buffered = ''
    let usage = null
    let model = req.body?.model || 'openai'

    const parseEvent = (eventChunk) => {
      const trimmed = eventChunk.trim()
      if (!trimmed || trimmed === 'data: [DONE]') {
        return
      }
      const lines = trimmed.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data:')) {
          continue
        }
        const payload = line.slice(5).trim()
        if (!payload) {
          continue
        }
        try {
          const data = JSON.parse(payload)
          const { model: detectedModel, usage: detectedUsage } = data
          if (detectedModel) {
            model = detectedModel
          }
          if (detectedUsage) {
            usage = detectedUsage
          }
        } catch (_) {
          // ignore parse errors for partial chunks
        }
      }
    }

    upstream.data.on('data', (chunk) => {
      if (!res.destroyed) {
        res.write(chunk)
      }
      buffered += chunk.toString()

      if (buffered.includes('\n\n')) {
        const events = buffered.split('\n\n')
        buffered = events.pop() || ''
        events.forEach(parseEvent)
      }
    })

    upstream.data.on('end', async () => {
      if (buffered.trim()) {
        parseEvent(buffered)
      }

      if (usage && req.apiKey?.id) {
        try {
          await apiKeyService.recordUsage(
            req.apiKey.id,
            usage.prompt_tokens || 0,
            usage.completion_tokens || 0,
            0,
            0,
            model,
            'openai-official'
          )
        } catch (err) {
          logger.error('Failed to record OpenAI official streaming usage:', err)
        }
      }

      res.end()
    })

    upstream.data.on('error', (err) => {
      logger.error('OpenAI official stream error:', err)
      if (!res.headersSent) {
        res.status(502).json({ error: { message: 'Upstream stream error' } })
      } else {
        res.end()
      }
    })

    const cleanup = () => {
      try {
        upstream.data?.unpipe?.(res)
        upstream.data?.destroy?.()
      } catch (_) {
        // ignore
      }
    }
    req.on('close', cleanup)
    req.on('aborted', cleanup)
  } catch (error) {
    logger.error('Official OpenAI proxy failed:', error)
    const status = error.response?.status || error.statusCode || 500
    let payload = error.response?.data || { error: { message: error.message || 'Internal error' } }
    if (typeof payload === 'string') {
      payload = { error: { message: payload } }
    }
    if (!res.headersSent) {
      res.status(status).json(payload)
    }
  }
}

router.post('/v1/chat/completions', authenticateApiKey, async (req, res) => {
  await handleUpstream(req, res, '/v1/chat/completions')
})

router.post('/v1/completions', authenticateApiKey, async (req, res) => {
  await handleUpstream(req, res, '/v1/completions')
})

module.exports = router
