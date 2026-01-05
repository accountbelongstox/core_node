'use strict'

const express = require('express')
const router = express.Router()
const clientService = require('../../services/clientService')
const { authenticateAdmin } = require('../../middleware/auth')
const ws = require('../../websocket')
const logger = require('../../utils/logger')
const { buildAccountOperationRequest } = require('../../utils/accountRequestMapper')

function getWsServer() {
  return ws.getServer ? ws.getServer() : null
}

const ACCOUNT_TYPE_MAP = {
  'claude-accounts': 'claude-official',
  'claude-console-accounts': 'claude-console',
  'bedrock-accounts': 'bedrock',
  'gemini-accounts': 'gemini',
  'openai-accounts': 'openai',
  'azure-openai-accounts': 'azure-openai',
  'openai-responses-accounts': 'openai-responses',
  'droid-accounts': 'droid',
  'gemini-api-accounts': 'gemini-api',
  'ccr-accounts': 'ccr'
}

function resolveAccountType(segment) {
  return ACCOUNT_TYPE_MAP[segment] || segment.replace(/-accounts$/, '')
}

function ensureWsServer(res) {
  const server = getWsServer()
  if (!server) {
    res.status(400).json({ success: false, error: 'WS_SERVER_DISABLED' })
    return null
  }
  return server
}

async function sendClientLocalRequest(req, res, endpoint, method = 'POST', body = {}, timeout = 30000) {
  const server = ensureWsServer(res)
  if (!server) {
    return
  }
  const client = await ensureClientOnline(req.params.clientId, res)
  if (!client) {
    return
  }
  try {
    const data = await server.sendLocalRequest(
      req.params.clientId,
      { endpoint, method, body },
      timeout
    )
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to proxy local request for client ${req.params.clientId}:`, error)
    res.status(400).json({
      success: false,
      error: 'Client local request failed',
      message: error.message
    })
  }
}

async function sendClientLocalStreamRequest(
  req,
  res,
  endpoint,
  method = 'POST',
  body = {},
  timeout = 30000
) {
  const server = ensureWsServer(res)
  if (!server) {
    return
  }
  const client = await ensureClientOnline(req.params.clientId, res)
  if (!client) {
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders()
  }

  try {
    await server.sendLocalStreamRequest(
      req.params.clientId,
      { endpoint, method, body },
      ({ chunk }) => {
        if (!res.writableEnded) {
          res.write(chunk)
        }
      },
      timeout
    )

    if (!res.writableEnded) {
      res.end()
    }
  } catch (error) {
    logger.error(`Failed to proxy local stream request for client ${req.params.clientId}:`, error)
    if (!res.headersSent) {
      res.status(400).json({
        success: false,
        error: 'Client local stream request failed',
        message: error.message
      })
      return
    }
    if (!res.writableEnded) {
      const payload = { type: 'error', error: error.message || 'Stream request failed' }
      res.write(`data: ${JSON.stringify(payload)}\n\n`)
      res.end()
    }
  }
}

function buildAdminEndpoint(segment, suffix = '', accountId = null) {
  let endpoint = `/admin/${segment}`
  if (accountId) {
    endpoint += `/${accountId}`
  }
  if (suffix) {
    endpoint += `/${suffix}`
  }
  return endpoint
}

function appendQuery(endpoint, query) {
  const queryString = new URLSearchParams(query || {}).toString()
  return queryString ? `${endpoint}?${queryString}` : endpoint
}

async function ensureClientOnline(clientId, res) {
  const client = await clientService.getClientById(clientId)
  if (!client) {
    res.status(404).json({ success: false, error: 'Client not found' })
    return null
  }
  if ((client.status || '').toLowerCase() !== 'online') {
    res
      .status(400)
      .json({ success: false, error: 'Client not connected', message: 'Client is offline' })
    return null
  }
  return client
}

async function handleAccountLocalRequest(req, res, operation, payload, timeout = 30000) {
  let request
  try {
    request = buildAccountOperationRequest(operation, payload || {})
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
    return
  }
  await sendClientLocalRequest(req, res, request.endpoint, request.method, request.body, timeout)
}

async function handleAccountCommandLegacy(req, res, operation, payload, timeout = 30000) {
  const server = ensureWsServer(res)
  if (!server) {
    return
  }
  const client = await ensureClientOnline(req.params.clientId, res)
  if (!client) {
    return
  }
  try {
    const data = await server.sendAccountCommand(req.params.clientId, operation, payload, timeout)
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to ${operation} for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: `Failed to ${operation}`, message: error.message })
  }
}

function resolveSupportedClients() {
  const fromConfig = ws?.config?.supportedClients || []
  if (Array.isArray(fromConfig) && fromConfig.length > 0) {
    return fromConfig
  }
  return []
}

async function attachLiveInfo(client) {
  const server = getWsServer()
  const connectionMap = server?.connectionMap || new Map()
  const liveConnected = connectionMap.has(client.id)
  const currentConcurrency = await clientService.getCurrentConcurrency(client.id)
  const maxConcurrency = Number(client.maxConcurrency) || 10
  const availableSlots = Math.max(0, maxConcurrency - currentConcurrency)
  return {
    ...client,
    liveConnected,
    connectionStatus: liveConnected ? 'connected' : client.connectionStatus || 'disconnected',
    status: liveConnected ? 'online' : client.status,
    currentConcurrency,
    availableSlots
  }
}

// 支持的客户端清单（用于前端下拉）
router.get('/supported-clients', authenticateAdmin, async (_req, res) => {
  try {
    const clients = resolveSupportedClients()
    res.json({ success: true, data: clients })
  } catch (error) {
    logger.error('Failed to get supported clients:', error)
    res.status(500).json({ success: false, error: 'Failed to get supported clients' })
  }
})

// 客户端列表
router.get('/clients', authenticateAdmin, async (_req, res) => {
  try {
    const clients = await clientService.getAllClients()
    const enriched = await Promise.all(clients.map((c) => attachLiveInfo(c)))
    res.json({ success: true, data: enriched })
  } catch (error) {
    logger.error('Failed to get clients:', error)
    res.status(500).json({ success: false, error: 'Failed to get clients', message: error.message })
  }
})

// 创建 Client API key
router.post('/clients', authenticateAdmin, async (req, res) => {
  try {
    const {
      apiKey,
      name,
      description,
      supportedPlatforms,
      supportedAccountTypes,
      supportedModels,
      maxConcurrency,
      accountType,
      priority,
      schedulable,
      isActive,
      tags
    } = req.body || {}

    if (!apiKey) {
      return res.status(400).json({ success: false, error: 'API Key is required' })
    }

    const record = await clientService.addClientApiKey({
      apiKey,
      name,
      description,
      supportedPlatforms,
      supportedAccountTypes,
      supportedModels,
      maxConcurrency,
      accountType,
      priority,
      schedulable,
      isActive,
      tags
    })
    const enriched = await attachLiveInfo(record)
    res.json({ success: true, data: enriched })
  } catch (error) {
    logger.error('Failed to create client:', error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to create client', message: error.message })
  }
})

// 获取单个
router.get('/clients/:id', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.id)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const enriched = await attachLiveInfo(client)
    res.json({ success: true, data: enriched })
  } catch (error) {
    logger.error(`Failed to get client ${req.params.id}:`, error)
    res.status(500).json({ success: false, error: 'Failed to get client', message: error.message })
  }
})

// 更新
router.put('/clients/:id', authenticateAdmin, async (req, res) => {
  try {
    const updated = await clientService.updateClient(req.params.id, req.body || {})
    const enriched = await attachLiveInfo(updated)
    res.json({ success: true, data: enriched })
  } catch (error) {
    logger.error(`Failed to update client ${req.params.id}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to update client', message: error.message })
  }
})

// 切换可调度
router.put('/clients/:id/toggle-schedulable', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.id)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const next = !client.schedulable
    const updated = await clientService.updateClient(req.params.id, { schedulable: next })
    const enriched = await attachLiveInfo(updated)
    res.json({ success: true, data: enriched })
  } catch (error) {
    logger.error(`Failed to toggle schedulable for client ${req.params.id}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to toggle schedulable', message: error.message })
  }
})

// 删除
router.delete('/clients/:id', authenticateAdmin, async (req, res) => {
  try {
    await clientService.deleteClient(req.params.id)
    res.json({ success: true })
  } catch (error) {
    logger.error(`Failed to delete client ${req.params.id}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to delete client', message: error.message })
  }
})

// 断开
router.post('/clients/:id/disconnect', authenticateAdmin, async (req, res) => {
  try {
    const server = getWsServer()
    if (!server) {
      return res.status(400).json({ success: false, error: 'WS_SERVER_DISABLED' })
    }
    server.disconnectClient(req.params.id, req.body?.reason || 'admin_disconnect')
    res.json({ success: true })
  } catch (error) {
    logger.error(`Failed to disconnect client ${req.params.id}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to disconnect client', message: error.message })
  }
})

// 配置下发
router.post('/clients/:clientId/config', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.clientId)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const server = getWsServer()
    if (!server) {
      return res.status(400).json({ success: false, error: 'WS_SERVER_DISABLED' })
    }
    if (client.status !== 'online') {
      return res
        .status(400)
        .json({ success: false, error: 'Client not connected', message: 'Client is offline' })
    }
    const data = await server.sendConfigUpdate(req.params.clientId, req.body?.config || {}, {
      applyImmediately: req.body?.applyImmediately !== false,
      summary: req.body?.summary,
      operator: req.user?.username || 'admin'
    })
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to send config to client ${req.params.clientId}:`, error)
    res.status(400).json({ success: false, error: 'Failed to send config', message: error.message })
  }
})

// 当前配置
router.get('/clients/:clientId/config', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.clientId)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const data = await clientService.getClientConfig(req.params.clientId)
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to get config for client ${req.params.clientId}:`, error)
    res.status(400).json({ success: false, error: 'Failed to get config', message: error.message })
  }
})

// 配置历史
router.get('/clients/:clientId/config/history', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.clientId)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50
    const data = await clientService.getClientConfigHistory(req.params.clientId, limit)
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to get config history for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to get config history', message: error.message })
  }
})

// 系统健康
router.get('/clients/:clientId/system-health', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.clientId)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const server = getWsServer()
    if (!server) {
      return res.status(400).json({ success: false, error: 'WS_SERVER_DISABLED' })
    }
    const data = await server.queryClientSystemHealth(req.params.clientId, 15000)
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to query system health for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to query system health', message: error.message })
  }
})

// 账户操作
router.get('/clients/:clientId/accounts', authenticateAdmin, async (req, res) => {
  try {
    const server = ensureWsServer(res)
    if (!server) {
      return
    }
    const client = await ensureClientOnline(req.params.clientId, res)
    if (!client) {
      return
    }

    const query = new URLSearchParams(req.query || {}).toString()
    const segments = Array.from(
      new Set([...Object.keys(ACCOUNT_TYPE_MAP), 'ccr-accounts'])
    )
    const responses = await Promise.all(
      segments.map((segment) => {
        const endpoint = query ? `/admin/${segment}?${query}` : `/admin/${segment}`
        return server.sendLocalRequest(req.params.clientId, { endpoint, method: 'GET' }, 30000)
      })
    )
    const accounts = []
    responses.forEach((response) => {
      if (Array.isArray(response)) {
        accounts.push(...response)
        return
      }
      if (Array.isArray(response?.data)) {
        accounts.push(...response.data)
        return
      }
      if (Array.isArray(response?.accounts)) {
        accounts.push(...response.accounts)
      }
    })
    res.json({ success: true, data: { accounts } })
  } catch (error) {
    logger.error(`Failed to query accounts for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to query accounts', message: error.message })
  }
})

router.post('/clients/:clientId/accounts', authenticateAdmin, async (req, res) => {
  try {
    const { operation, data } = req.body || {}
    await handleAccountLocalRequest(req, res, operation, data, 30000)
  } catch (error) {
    logger.error(`Failed to operate account for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to operate account', message: error.message })
  }
})

// OAuth
router.post('/clients/:clientId/generate-oauth-url', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.clientId)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const server = getWsServer()
    if (!server) {
      return res.status(400).json({ success: false, error: 'WS_SERVER_DISABLED' })
    }
    const data = await server.sendGenerateOAuthUrl(
      req.params.clientId,
      req.body?.accountType,
      req.body?.proxy,
      30000
    )
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to generate OAuth URL for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to generate OAuth URL', message: error.message })
  }
})

router.post('/clients/:clientId/exchange-oauth-code', authenticateAdmin, async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.clientId)
    if (!client) {
      return res.status(404).json({ success: false, error: 'Client not found' })
    }
    const server = getWsServer()
    if (!server) {
      return res.status(400).json({ success: false, error: 'WS_SERVER_DISABLED' })
    }
    const accountData = { ...(req.body?.accountData || {}) }
    if (req.body?.accountType && !accountData.accountType) {
      accountData.accountType = req.body.accountType
    }
    const data = await server.sendExchangeOAuthCode(
      req.params.clientId,
      req.body?.sessionId,
      req.body?.code,
      accountData,
      60000
    )
    res.json({ success: true, data })
  } catch (error) {
    logger.error(`Failed to exchange OAuth code for client ${req.params.clientId}:`, error)
    res
      .status(400)
      .json({ success: false, error: 'Failed to exchange OAuth code', message: error.message })
  }
})

// ====== Client 账户管理（前端 accounts store 对齐）======
const accountSegments = Object.keys(ACCOUNT_TYPE_MAP)

// 列表
router.get('/clients/:clientId/:segment', authenticateAdmin, async (req, res, next) => {
  if (!accountSegments.includes(req.params.segment)) {
    return next()
  }
  const query = new URLSearchParams(req.query || {}).toString()
  const endpoint = query
    ? `/admin/${req.params.segment}?${query}`
    : `/admin/${req.params.segment}`
  await sendClientLocalRequest(req, res, endpoint, 'GET')
})

// 创建
router.post('/clients/:clientId/:segment', authenticateAdmin, async (req, res, next) => {
  if (!accountSegments.includes(req.params.segment)) {
    return next()
  }
  const accountType = resolveAccountType(req.params.segment)
  const payload = { accountType, accountData: req.body || {} }
  await handleAccountLocalRequest(req, res, 'add_account', payload)
})

// 更新
router.put('/clients/:clientId/:segment/:accountId', authenticateAdmin, async (req, res, next) => {
  if (!accountSegments.includes(req.params.segment)) {
    return next()
  }
  const accountType = resolveAccountType(req.params.segment)
  const updates = req.body || {}
  const payload = { accountId: req.params.accountId, accountType, updates }
  await handleAccountLocalRequest(req, res, 'update_account', payload)
})

// 删除
router.delete(
  '/clients/:clientId/:segment/:accountId',
  authenticateAdmin,
  async (req, res, next) => {
    if (!accountSegments.includes(req.params.segment)) {
      return next()
    }
    const accountType = resolveAccountType(req.params.segment)
    const payload = { accountId: req.params.accountId, accountType }
    await handleAccountLocalRequest(req, res, 'delete_account', payload)
  }
)

// 切换/启用禁用
router.put(
  '/clients/:clientId/:segment/:accountId/toggle',
  authenticateAdmin,
  async (req, res, next) => {
    if (!accountSegments.includes(req.params.segment)) {
      return next()
    }
    const accountType = resolveAccountType(req.params.segment)
    const updates = {}
    if (typeof req.body?.enabled === 'boolean') {
      updates.enabled = req.body.enabled
    } else {
      updates.toggle = true
    }
    const payload = { accountId: req.params.accountId, accountType, updates }
    await handleAccountCommandLegacy(req, res, 'update_account', payload)
  }
)

// Token 刷新（Claude）
router.post(
  '/clients/:clientId/claude-accounts/:accountId/refresh',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint(
      'claude-accounts',
      'refresh',
      req.params.accountId
    )
    await sendClientLocalRequest(req, res, endpoint, 'POST', {}, 30000)
  }
)

// 生成/交换 OAuth/Setup Token（Claude、Gemini、OpenAI、Droid）
router.post(
  '/clients/:clientId/:segment/generate-auth-url',
  authenticateAdmin,
  async (req, res, next) => {
    if (!accountSegments.includes(req.params.segment)) {
      return next()
    }
    const endpoint = buildAdminEndpoint(req.params.segment, 'generate-auth-url')
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 30000)
  }
)

router.post(
  '/clients/:clientId/:segment/exchange-code',
  authenticateAdmin,
  async (req, res, next) => {
    if (!accountSegments.includes(req.params.segment)) {
      return next()
    }
    const endpoint = buildAdminEndpoint(req.params.segment, 'exchange-code')
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 60000)
  }
)

router.post(
  '/clients/:clientId/claude-accounts/generate-setup-token-url',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint('claude-accounts', 'generate-setup-token-url')
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 30000)
  }
)

router.post(
  '/clients/:clientId/claude-accounts/exchange-setup-token-code',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint('claude-accounts', 'exchange-setup-token-code')
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 60000)
  }
)

router.post(
  '/clients/:clientId/claude-accounts/oauth-with-cookie',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint('claude-accounts', 'oauth-with-cookie')
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 60000)
  }
)

router.post(
  '/clients/:clientId/claude-accounts/setup-token-with-cookie',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint('claude-accounts', 'setup-token-with-cookie')
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 60000)
  }
)

// ====== 账户管理扩展能力透传 ======
router.get('/clients/:clientId/accounts/:accountId/usage-history', authenticateAdmin, async (req, res) => {
  const endpoint = appendQuery(
    `/admin/accounts/${req.params.accountId}/usage-history`,
    req.query
  )
  await sendClientLocalRequest(req, res, endpoint, 'GET')
})

router.get('/clients/:clientId/accounts/:accountId/balance', authenticateAdmin, async (req, res) => {
  const endpoint = appendQuery(`/admin/accounts/${req.params.accountId}/balance`, req.query)
  await sendClientLocalRequest(req, res, endpoint, 'GET')
})

router.post(
  '/clients/:clientId/accounts/:accountId/balance/refresh',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = `/admin/accounts/${req.params.accountId}/balance/refresh`
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 30000)
  }
)

router.get(
  '/clients/:clientId/accounts/balance/platform/:platform',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = appendQuery(
      `/admin/accounts/balance/platform/${req.params.platform}`,
      req.query
    )
    await sendClientLocalRequest(req, res, endpoint, 'GET')
  }
)

router.get('/clients/:clientId/accounts/binding-counts', authenticateAdmin, async (req, res) => {
  await sendClientLocalRequest(req, res, '/admin/accounts/binding-counts', 'GET')
})

router.get('/clients/:clientId/accounts/:accountId/balance/script', authenticateAdmin, async (req, res) => {
  const endpoint = appendQuery(
    `/admin/accounts/${req.params.accountId}/balance/script`,
    req.query
  )
  await sendClientLocalRequest(req, res, endpoint, 'GET')
})

router.put('/clients/:clientId/accounts/:accountId/balance/script', authenticateAdmin, async (req, res) => {
  const endpoint = appendQuery(
    `/admin/accounts/${req.params.accountId}/balance/script`,
    req.query
  )
  await sendClientLocalRequest(req, res, endpoint, 'PUT', req.body || {}, 30000)
})

router.post(
  '/clients/:clientId/accounts/:accountId/balance/script/test',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = appendQuery(
      `/admin/accounts/${req.params.accountId}/balance/script/test`,
      req.query
    )
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 30000)
  }
)

router.get('/clients/:clientId/api-keys', authenticateAdmin, async (req, res) => {
  const endpoint = appendQuery('/admin/api-keys', req.query)
  await sendClientLocalRequest(req, res, endpoint, 'GET')
})

router.get('/clients/:clientId/account-groups', authenticateAdmin, async (req, res) => {
  const endpoint = appendQuery('/admin/account-groups', req.query)
  await sendClientLocalRequest(req, res, endpoint, 'GET')
})

router.post('/clients/:clientId/account-groups', authenticateAdmin, async (req, res) => {
  await sendClientLocalRequest(req, res, '/admin/account-groups', 'POST', req.body || {}, 30000)
})

router.put('/clients/:clientId/account-groups/:groupId', authenticateAdmin, async (req, res) => {
  const endpoint = `/admin/account-groups/${req.params.groupId}`
  await sendClientLocalRequest(req, res, endpoint, 'PUT', req.body || {}, 30000)
})

router.delete('/clients/:clientId/account-groups/:groupId', authenticateAdmin, async (req, res) => {
  const endpoint = `/admin/account-groups/${req.params.groupId}`
  await sendClientLocalRequest(req, res, endpoint, 'DELETE')
})

router.get(
  '/clients/:clientId/account-groups/:groupId/members',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = appendQuery(
      `/admin/account-groups/${req.params.groupId}/members`,
      req.query
    )
    await sendClientLocalRequest(req, res, endpoint, 'GET')
  }
)

router.get('/clients/:clientId/claude-accounts/usage', authenticateAdmin, async (req, res) => {
  await sendClientLocalRequest(req, res, '/admin/claude-accounts/usage', 'GET')
})

router.get(
  '/clients/:clientId/claude-console-accounts/:accountId/usage',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = `/admin/claude-console-accounts/${req.params.accountId}/usage`
    await sendClientLocalRequest(req, res, endpoint, 'GET')
  }
)

router.get(
  '/clients/:clientId/openai-responses-accounts/auto-recovery-configs',
  authenticateAdmin,
  async (req, res) => {
    await sendClientLocalRequest(
      req,
      res,
      '/admin/openai-responses-accounts/auto-recovery-configs',
      'GET'
    )
  }
)

router.get('/clients/:clientId/claude-code-version', authenticateAdmin, async (req, res) => {
  await sendClientLocalRequest(req, res, '/admin/claude-code-version', 'GET')
})

router.post(
  '/clients/:clientId/claude-code-version/clear',
  authenticateAdmin,
  async (req, res) => {
    await sendClientLocalRequest(req, res, '/admin/claude-code-version/clear', 'POST', {})
  }
)

router.post(
  '/clients/:clientId/:segment/:accountId/reset-status',
  authenticateAdmin,
  async (req, res, next) => {
    if (!accountSegments.includes(req.params.segment)) {
      return next()
    }
    const endpoint = buildAdminEndpoint(req.params.segment, 'reset-status', req.params.accountId)
    await sendClientLocalRequest(req, res, endpoint, 'POST', req.body || {}, 30000)
  }
)

router.put(
  '/clients/:clientId/:segment/:accountId/toggle-schedulable',
  authenticateAdmin,
  async (req, res, next) => {
    if (!accountSegments.includes(req.params.segment)) {
      return next()
    }
    const endpoint = buildAdminEndpoint(
      req.params.segment,
      'toggle-schedulable',
      req.params.accountId
    )
    await sendClientLocalRequest(req, res, endpoint, 'PUT', req.body || {}, 30000)
  }
)

router.post(
  '/clients/:clientId/claude-accounts/:accountId/test',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint('claude-accounts', 'test', req.params.accountId)
    await sendClientLocalStreamRequest(req, res, endpoint, 'POST', req.body || {}, 60000)
  }
)

router.post(
  '/clients/:clientId/claude-console-accounts/:accountId/test',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = buildAdminEndpoint('claude-console-accounts', 'test', req.params.accountId)
    await sendClientLocalStreamRequest(req, res, endpoint, 'POST', req.body || {}, 60000)
  }
)

router.get(
  '/clients/:clientId/claude-accounts/:accountId/test-config',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = `/admin/claude-accounts/${req.params.accountId}/test-config`
    await sendClientLocalRequest(req, res, endpoint, 'GET')
  }
)

router.put(
  '/clients/:clientId/claude-accounts/:accountId/test-config',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = `/admin/claude-accounts/${req.params.accountId}/test-config`
    await sendClientLocalRequest(req, res, endpoint, 'PUT', req.body || {}, 30000)
  }
)

router.get(
  '/clients/:clientId/claude-accounts/:accountId/test-history',
  authenticateAdmin,
  async (req, res) => {
    const endpoint = `/admin/claude-accounts/${req.params.accountId}/test-history`
    await sendClientLocalRequest(req, res, endpoint, 'GET')
  }
)

module.exports = router
