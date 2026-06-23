'use strict'

const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const datastore = require('../models/datastore')
const { getMysqlPool } = require('../models/mysqlPool')
const config = require('../../config/config')

const CLIENT_KEY_PREFIX = 'ws_client:status:'
const API_KEY_HASH_PREFIX = 'ws_client:apikey:'
const CLIENT_SECRET_PREFIX = 'ws_client:secret:'

function useMysql() {
  return String(datastore.driver || '').toLowerCase() === 'mysql'
}

function toIsoString(value) {
  if (!value) {
    return null
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}

function toDate(value) {
  if (value === undefined || value === null) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function toTimestamp(value) {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value === 'number') {
    return value
  }
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.getTime()
}

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) {
    return defaultValue
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'true') {
      return true
    }
    if (trimmed === 'false') {
      return false
    }
  }
  return Boolean(value)
}

function parseArray(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed
      }
    } catch (_) {
      // ignore parse error
    }
  }
  return fallback
}

function parseObject(value, fallback = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') {
        return parsed
      }
    } catch (_) {
      // ignore parse error
    }
  }
  return fallback
}

function safeJsonParse(raw, fallback = {}) {
  if (!raw) {
    return fallback
  }
  if (typeof raw === 'object') {
    return raw
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch (_) {
    return fallback
  }
  return fallback
}

function isInvalidClientId(clientId) {
  if (!clientId) {
    return true
  }
  const value = String(clientId)
  return value.includes(':')
}

function normalizeClientRow(row) {
  const data = safeJsonParse(row.data, {})
  const merged = {
    ...data,
    id: row.id,
    name: row.name || data.name || row.id,
    status: row.status || data.status || data.connectionStatus || 'offline',
    isActive:
      row.is_active !== null && row.is_active !== undefined ? !!row.is_active : data.isActive
  }
  if (!merged.updatedAt && row.updated_at) {
    merged.updatedAt = toTimestamp(row.updated_at)
  }
  if (!merged.createdAt && row.created_at) {
    merged.createdAt = toTimestamp(row.created_at)
  }
  return normalizeClientRecord(row.id, merged)
}

async function getClientMysql(clientId) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM clients WHERE id = ?', [clientId])
  if (!rows.length) {
    return null
  }
  return normalizeClientRow(rows[0])
}

async function upsertClientMysql(record) {
  const pool = getMysqlPool()
  const createdAt = toDate(record.createdAt) || toDate(record.lastConnectedAt) || new Date()
  const updatedAt = toDate(record.updatedAt) || toDate(record.lastHeartbeatAt) || new Date()
  const status = record.status || record.connectionStatus || null
  const isActive = record.isActive !== undefined ? record.isActive : true
  const payload = { ...record, id: record.id }
  await pool.execute(
    `INSERT INTO clients (id, name, status, is_active, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name),
       status=VALUES(status),
       is_active=VALUES(is_active),
       data=VALUES(data),
       updated_at=VALUES(updated_at)`,
    [
      record.id,
      record.name || record.id,
      status,
      isActive ? 1 : 0,
      JSON.stringify(payload),
      createdAt,
      updatedAt
    ]
  )
}

async function listClientsMysql({ status } = {}) {
  const pool = getMysqlPool()
  let sql = 'SELECT * FROM clients'
  const params = []
  if (status) {
    sql += ' WHERE status = ?'
    params.push(String(status).toLowerCase())
  }
  sql += ' ORDER BY updated_at DESC'
  const [rows] = await pool.execute(sql, params)
  return rows.map(normalizeClientRow)
}

async function deleteClientMysql(clientId) {
  const pool = getMysqlPool()
  await pool.execute('DELETE FROM client_config_history WHERE client_id = ?', [clientId])
  await pool.execute('DELETE FROM clients WHERE id = ?', [clientId])
}

function normalizeConfigRow(row) {
  const appliedConfig = safeJsonParse(row.encrypted_applied_config, {})
  const changes = row.encrypted_changes ? safeJsonParse(row.encrypted_changes, {}) : null
  const entry = {
    version: row.version,
    appliedAt: toIsoString(row.applied_at),
    requiresRestart: !!row.requires_restart,
    summary: row.summary || null,
    operator: row.operator || 'system',
    appliedConfig
  }
  if (changes) {
    entry.changes = changes
  }
  return entry
}

async function getClientConfigHistoryMysql(clientId, limit = 20) {
  const pool = getMysqlPool()
  const safeLimit = Math.max(1, Number(limit) || 20)
  const [rows] = await pool.query(
    `SELECT * FROM client_config_history WHERE client_id = ? ORDER BY applied_at DESC LIMIT ${safeLimit}`,
    [clientId]
  )
  return rows.map(normalizeConfigRow)
}

async function getClientConfigSummaryMysql(clientId) {
  const pool = getMysqlPool()
  const [latestRows] = await pool.execute(
    'SELECT * FROM client_config_history WHERE client_id = ? ORDER BY applied_at DESC LIMIT 1',
    [clientId]
  )
  const [countRows] = await pool.execute(
    'SELECT COUNT(*) as c FROM client_config_history WHERE client_id = ?',
    [clientId]
  )
  const latest = latestRows.length ? normalizeConfigRow(latestRows[0]) : null
  const count = countRows.length ? countRows[0].c : 0
  return { latest, count }
}

async function insertClientConfigHistoryMysql(clientId, entry) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute(
    'SELECT MAX(version) as v FROM client_config_history WHERE client_id = ?',
    [clientId]
  )
  const version = (rows[0]?.v || 0) + 1
  const appliedAt = toDate(entry.appliedAt) || new Date()
  await pool.execute(
    `INSERT INTO client_config_history (
      id, client_id, version, applied_at, operator, requires_restart, summary,
      encrypted_applied_config, encrypted_changes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `cfg_${uuidv4()}`,
      clientId,
      version,
      appliedAt,
      entry.operator || 'system',
      entry.requiresRestart ? 1 : 0,
      entry.summary || null,
      JSON.stringify(entry.appliedConfig || {}),
      entry.changes ? JSON.stringify(entry.changes) : null,
      appliedAt
    ]
  )
  return { ...entry, version, appliedAt: appliedAt.toISOString() }
}

async function persistClientRecord(record) {
  if (useMysql()) {
    await upsertClientMysql(record)
    return
  }
  await datastore.set(`${CLIENT_KEY_PREFIX}${record.id}`, JSON.stringify(record))
}

function normalizeClientRecord(clientId, overrides = {}) {
  const resolvedStatus =
    overrides.status || (overrides.connectionStatus === 'connected' ? 'online' : 'offline')
  const resolvedConnectionStatus =
    overrides.connectionStatus ||
    (resolvedStatus === 'online' || resolvedStatus === 'connected' ? 'connected' : 'disconnected')
  return {
    id: clientId,
    name: overrides.name || clientId,
    description: overrides.description || '',
    accountType: overrides.accountType || 'client',
    status: resolvedStatus,
    connectionStatus: resolvedConnectionStatus,
    wsId: overrides.wsId || null,
    version: overrides.version || 'unknown',
    capabilities: parseObject(overrides.capabilities, {}),
    resources: {
      activeAccounts: parseObject(overrides.resources?.activeAccounts, {}),
      totalAccounts: Number(overrides.resources?.totalAccounts || 0),
      availableSlots: Number(overrides.resources?.availableSlots || overrides.maxConcurrency || 0),
      maxConcurrency: Number(overrides.resources?.maxConcurrency || overrides.maxConcurrency || 10)
    },
    clientInfo: parseObject(overrides.clientInfo, {}),
    features: parseObject(overrides.features, {}),
    supportedPlatforms: parseArray(overrides.supportedPlatforms, []),
    supportedAccountTypes: parseArray(overrides.supportedAccountTypes, []),
    supportedModels: parseObject(overrides.supportedModels, {}),
    tags: parseArray(overrides.tags, []),
    maxConcurrency: Number(overrides.maxConcurrency || 10),
    priority: Number(overrides.priority || 50),
    schedulable: toBool(overrides.schedulable, true),
    isActive: toBool(overrides.isActive, true),
    latency: Number(overrides.latency || 0),
    heartbeatStats: parseObject(overrides.heartbeatStats, {}),
    clientStats: parseObject(overrides.clientStats, {}),
    lastHeartbeatAt: overrides.lastHeartbeatAt || null,
    lastStatusUpdateAt: overrides.lastStatusUpdateAt || null,
    lastConnectedAt: overrides.lastConnectedAt || null,
    lastConfigUpdate: overrides.lastConfigUpdate || null,
    configHistory: Array.isArray(overrides.configHistory) ? overrides.configHistory : [],
    updatedAt: overrides.updatedAt || Date.now()
  }
}

function getAllowedKeys() {
  const keys = config.websocketServer?.apiKeys
  if (Array.isArray(keys) && keys.length > 0) {
    return keys
  }
  return []
}

async function authenticateClient(clientId, clientKey) {
  const allowedKeys = getAllowedKeys()
  if (allowedKeys.length > 0) {
    if (!clientKey || !allowedKeys.includes(clientKey)) {
      return null
    }
  }
  return { id: clientId }
}

async function addClientApiKey(options = {}) {
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
  } = options

  if (!apiKey) {
    throw new Error('API Key is required')
  }

  const clientId = options.clientId || `client-${uuidv4().slice(0, 8)}`
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')

  await datastore.set(`${API_KEY_HASH_PREFIX}${hash}`, clientId)

  const record = normalizeClientRecord(clientId, {
    name: name || clientId,
    description: description || '',
    supportedPlatforms: supportedPlatforms || [],
    supportedAccountTypes: supportedAccountTypes || [],
    supportedModels: supportedModels || {},
    maxConcurrency: maxConcurrency || 10,
    accountType: accountType || 'client',
    priority: priority !== undefined ? priority : 50,
    schedulable: schedulable !== false,
    isActive: isActive !== false,
    tags: tags || [],
    status: 'offline',
    connectionStatus: 'disconnected'
  })

  await persistClientRecord(record)
  await datastore.set(`${CLIENT_SECRET_PREFIX}${clientId}`, apiKey)

  return record
}

async function markClientOnline(clientId, wsId, capabilities = {}) {
  const record = normalizeClientRecord(clientId, {
    status: 'online',
    wsId,
    capabilities: capabilities || {},
    connectionStatus: 'connected',
    lastConnectedAt: Date.now(),
    updatedAt: Date.now()
  })
  await persistClientRecord(record)
  return record
}

async function markClientOffline(clientId, reason = 'offline') {
  const existing = await getClient(clientId)
  const record = normalizeClientRecord(clientId, {
    ...(existing || {}),
    status: 'offline',
    connectionStatus: 'disconnected',
    wsId: null,
    reason,
    updatedAt: Date.now()
  })
  await persistClientRecord(record)
  return record
}

async function updateClientStatus(clientId, status = {}) {
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  const merged = {
    ...existing,
    capabilities: {
      ...(existing.capabilities || {}),
      ...(status.capabilities || {})
    },
    resources: {
      ...(existing.resources || {}),
      ...(status.resources || {}),
      activeAccounts: parseObject(
        status.resources?.activeAccounts,
        existing.resources?.activeAccounts || {}
      ),
      totalAccounts:
        status.resources?.totalAccounts !== undefined
          ? Number(status.resources.totalAccounts)
          : existing.resources?.totalAccounts || 0,
      availableSlots:
        status.resources?.availableSlots !== undefined
          ? Number(status.resources.availableSlots)
          : existing.resources?.availableSlots || existing.maxConcurrency || 0,
      maxConcurrency:
        status.resources?.maxConcurrency !== undefined
          ? Number(status.resources.maxConcurrency)
          : Number(existing.resources?.maxConcurrency || existing.maxConcurrency || 10)
    },
    status: status.status || existing.status || 'online',
    lastStatusUpdateAt: Date.now(),
    updatedAt: Date.now()
  }
  await persistClientRecord(merged)
  return merged
}

async function updateClientConnection(clientId, data = {}) {
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  const merged = {
    ...existing,
    wsId: data.wsId || existing.wsId,
    remoteAddress: data.remoteAddress || existing.remoteAddress,
    version: data.version || existing.version,
    clientInfo: data.clientInfo || existing.clientInfo || {},
    status: data.status || 'online',
    connectionStatus: 'connected',
    lastConnectedAt: Date.now(),
    updatedAt: Date.now()
  }
  await persistClientRecord(merged)
  return merged
}

async function updateClient(id, updates = {}) {
  const existing = (await getClient(id)) || normalizeClientRecord(id)
  const merged = normalizeClientRecord(id, { ...existing, ...updates, updatedAt: Date.now() })
  await persistClientRecord(merged)
  return merged
}

async function deleteClient(id) {
  if (useMysql()) {
    await deleteClientMysql(id)
  } else {
    await datastore.del(`${CLIENT_KEY_PREFIX}${id}`)
  }
  await datastore.del(`${CLIENT_SECRET_PREFIX}${id}`)
  await datastore.del(`${API_KEY_HASH_PREFIX}${id}`)
  return true
}

async function getClientById(id) {
  return getClient(id)
}

async function updateHeartbeat(clientId, payload = {}) {
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  const merged = {
    ...existing,
    lastHeartbeatAt: Date.now(),
    latency: payload.latency || existing.latency || 0,
    heartbeatStats: payload.stats || existing.heartbeatStats || {},
    updatedAt: Date.now(),
    status: existing.status || 'online',
    connectionStatus: 'connected'
  }
  await persistClientRecord(merged)
  return merged
}

async function updateClientConfig(clientId, data = {}) {
  const entry = {
    appliedAt: data.lastConfigUpdate || new Date().toISOString(),
    requiresRestart: data.requiresRestart || false,
    summary: data.summary || null,
    operator: data.operator || 'system',
    appliedConfig: data.appliedConfig || {}
  }
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  if (useMysql()) {
    const stored = await insertClientConfigHistoryMysql(clientId, entry)
    const merged = {
      ...existing,
      lastConfigUpdate: stored.appliedAt,
      updatedAt: Date.now()
    }
    await persistClientRecord(merged)
    return merged
  }
  const history = Array.isArray(existing.configHistory) ? existing.configHistory : []
  const nextHistory = [entry, ...history].slice(0, 50)
  const merged = {
    ...existing,
    configHistory: nextHistory,
    lastConfigUpdate: entry.appliedAt,
    updatedAt: Date.now()
  }
  await persistClientRecord(merged)
  return merged
}

async function getClientConfig(clientId) {
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  if (useMysql()) {
    const { latest, count } = await getClientConfigSummaryMysql(clientId)
    return {
      appliedConfig: latest?.appliedConfig || existing.appliedConfig || {},
      lastConfigUpdate: latest?.appliedAt || existing.lastConfigUpdate || null,
      requiresRestart: latest?.requiresRestart || existing.requiresRestart || false,
      configVersion: count || 0
    }
  }
  const latest = Array.isArray(existing.configHistory) ? existing.configHistory[0] : null
  return {
    appliedConfig: latest?.appliedConfig || existing.appliedConfig || {},
    lastConfigUpdate: latest?.appliedAt || existing.lastConfigUpdate || null,
    requiresRestart: latest?.requiresRestart || existing.requiresRestart || false,
    configVersion: existing.configHistory?.length || 0
  }
}

async function getClientConfigHistory(clientId, limit = 20) {
  if (useMysql()) {
    return getClientConfigHistoryMysql(clientId, limit)
  }
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  const history = Array.isArray(existing.configHistory) ? existing.configHistory : []
  return history.slice(0, limit)
}

async function authenticateClientApiKey(apiKey) {
  const allowedKeys = getAllowedKeys()
  if (allowedKeys.length > 0 && !allowedKeys.includes(apiKey)) {
    const error = new Error('Invalid client API key')
    error.code = 'AUTH_FAILED'
    throw error
  }
  const hash = crypto.createHash('sha256').update(apiKey).digest('hex')
  let clientId = await datastore.get(`${API_KEY_HASH_PREFIX}${hash}`)
  if (clientId && isInvalidClientId(clientId)) {
    await datastore.del(`${API_KEY_HASH_PREFIX}${hash}`)
    clientId = null
  }
  if (!clientId) {
    clientId = `client-${hash.slice(0, 8)}`
    await datastore.set(`${API_KEY_HASH_PREFIX}${hash}`, clientId)
  }

  // Default capability metadata
  const defaults = {
    accountType: 'client',
    maxConcurrency: 10,
    schedulable: true,
    isActive: true,
    priority: 50,
    supportedPlatforms: [],
    supportedAccountTypes: [],
    supportedModels: {},
    features: {}
  }
  let existing = await getClient(clientId)
  if (!existing) {
    existing = normalizeClientRecord(clientId, {
      status: 'online',
      connectionStatus: 'connected',
      lastConnectedAt: Date.now(),
      ...defaults
    })
    await persistClientRecord(existing)
  } else {
    // Backfill defaults for existing records
    const merged = normalizeClientRecord(clientId, { ...defaults, ...existing })
    existing = merged
    await persistClientRecord(merged)
  }

  // Cache the raw API key so downstream relay services can authenticate requests to the client
  await datastore.set(`${CLIENT_SECRET_PREFIX}${clientId}`, apiKey)

  // Cleanup malformed status keys if they were created by bad clientId values.
  await datastore.del(`ws_client:status:apikey:${hash}`)
  await datastore.del(`ws_client:status:secret:${clientId}`)

  return { id: clientId, name: existing.name || clientId }
}

async function getClient(clientId) {
  if (useMysql()) {
    return getClientMysql(clientId)
  }
  const raw = await datastore.get(`${CLIENT_KEY_PREFIX}${clientId}`)
  if (!raw) {
    return null
  }
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    return normalizeClientRecord(parsed.id || clientId, parsed)
  } catch (_) {
    return normalizeClientRecord(clientId, {})
  }
}

async function getDecryptedApiKey(clientId) {
  const apiKey = await datastore.get(`${CLIENT_SECRET_PREFIX}${clientId}`)
  if (apiKey) {
    return apiKey
  }

  const allowedKeys = getAllowedKeys()
  if (allowedKeys.length === 1) {
    return allowedKeys[0]
  }

  throw new Error(`Client API key not found for ${clientId}`)
}

async function markClientError(clientId, error, statusCode) {
  const existing = (await getClient(clientId)) || normalizeClientRecord(clientId)
  const record = {
    ...existing,
    status: 'error',
    connectionStatus: 'connected',
    lastError: {
      message: error?.message || 'client_error',
      code: statusCode || error?.code || null,
      at: Date.now()
    },
    updatedAt: Date.now()
  }
  await persistClientRecord(record)
  return record
}

async function getCurrentConcurrency(clientId) {
  const client = datastore.getClient()
  if (!client || typeof client.zremrangebyscore !== 'function') {
    return 0
  }
  const key = `concurrency:client:${clientId}`
  try {
    const now = Date.now()
    // 清理过期的槽位，再取 zcard
    await client.zremrangebyscore(key, 0, now)
    const count = await client.zcard(key)
    return Number.isFinite(count) ? count : 0
  } catch (error) {
    return 0
  }
}

async function getAllClients({ status } = {}) {
  if (useMysql()) {
    return listClientsMysql({ status })
  }
  const keys = await datastore.keys(`${CLIENT_KEY_PREFIX}*`)
  const ids = new Set()
  ;(keys || []).forEach((key) => ids.add(key.replace(CLIENT_KEY_PREFIX, '')))
  if (ids.size === 0) {
    return []
  }
  const records = []
  for (const id of ids) {
    const record = await getClient(id)
    if (record) {
      records.push(record)
    }
  }
  if (status) {
    const target = String(status).toLowerCase()
    return records.filter((r) => (r.status || '').toLowerCase() === target)
  }
  return records
}

module.exports = {
  authenticateClient,
  authenticateClientApiKey,
  getDecryptedApiKey,
  markClientOnline,
  markClientOffline,
  updateClientStatus,
  updateClientConnection,
  updateHeartbeat,
  updateClientConfig,
  getClientConfig,
  getClientConfigHistory,
  markClientError,
  getCurrentConcurrency,
  normalizeClientRecord,
  getClient,
  getClientById,
  updateClient,
  deleteClient,
  getAllClients,
  addClientApiKey,
  _getCurrentConcurrency: getCurrentConcurrency
}
