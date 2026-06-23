#!/usr/bin/env node

// Redis → MySQL 数据迁移/对账脚本（覆盖核心模块）
// Usage:
//   node scripts/migrate-redis-to-mysql.js migrate [types] [--dry-run]
//   node scripts/migrate-redis-to-mysql.js reconcile
//
// 说明：
// - 默认迁移 providers/account_groups/plans/subscriptions/orders/payments/clients/users/api_keys/usage。
// - --dry-run 只读取 Redis，不写入 MySQL（用于预检）。
// - 脚本总是从 Redis 读取（driver=redis），写入单独的 MySQL 连接（driver=mysql）。

const crypto = require('crypto')
const { createDataStore } = require('../src/models/datastore')
const logger = require('../src/utils/logger')

const redisStore = createDataStore({ driver: 'redis' })
const mysqlStore = createDataStore({ driver: 'mysql' })

const SUPPORTED_TYPES = [
  'providers',
  'account_groups',
  'plans',
  'subscriptions',
  'orders',
  'payments',
  'clients',
  'users',
  'api_keys',
  'usage'
]

const PROVIDER_SOURCES = [
  { type: 'claude', prefix: 'claude:account:' },
  { type: 'claude_console', prefix: 'claude_console_account:' },
  { type: 'openai', prefix: 'openai:account:' },
  { type: 'openai_responses', prefix: 'openai_responses_account:' },
  { type: 'azure_openai', prefix: 'azure_openai:account:' },
  { type: 'gemini_api', prefix: 'gemini_api_account:' },
  { type: 'ccr', prefix: 'ccr_account:' },
  { type: 'droid', prefix: 'droid:account:' },
  { type: 'bedrock', prefix: 'bedrock_account:' }
]

async function ensureRedis(store) {
  if (typeof store.connect === 'function' && !store.isConnected) {
    await store.connect()
  }
}

function toMysqlDatetime(value) {
  if (!value && value !== 0) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
  return date.toISOString().slice(0, 19).replace('T', ' ')
}

function parseNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }
  if (typeof value === 'boolean') {
    return value
  }
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true') {
    return true
  }
  if (normalized === 'false') {
    return false
  }
  return Boolean(value)
}

async function readObject(key) {
  const client = typeof redisStore.getClientSafe === 'function' ? redisStore.getClientSafe() : null
  if (client && typeof client.hgetall === 'function') {
    try {
      const hash = await client.hgetall(key)
      if (hash && Object.keys(hash).length > 0) {
        return hash
      }
    } catch (_) {
      // ignore hash errors, fall back to get
    }
  }
  try {
    const raw =
      client && typeof client.get === 'function' ? await client.get(key) : await redisStore.get(key)
    if (!raw) {
      return null
    }
    try {
      return JSON.parse(raw)
    } catch (_) {
      return { value: raw }
    }
  } catch (error) {
    if (error && String(error.message || '').includes('WRONGTYPE')) {
      return null
    }
    throw error
  }
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {})
  } catch (_) {
    return JSON.stringify({})
  }
}

function requireMysqlPool() {
  if (mysqlStore.driver !== 'mysql' || typeof mysqlStore.getMysqlPool !== 'function') {
    throw new Error('MySQL datastore not initialized. Set DATASTORE_PROVIDER=mysql and retry.')
  }
  return mysqlStore.getMysqlPool()
}

async function migrateApiKeys(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating api_keys from Redis → MySQL ...')
  const keys = await redisStore.keys('apikey:*')
  if (!keys.length) {
    logger.info('ℹ️  No apikey:* keys found, skip.')
    return { migrated: 0 }
  }
  let migrated = 0
  for (const key of keys) {
    if (key === 'apikey:hash_map') {
      continue
    }
    try {
      const client =
        typeof redisStore.getClientSafe === 'function' ? redisStore.getClientSafe() : null
      const data = client && typeof client.hgetall === 'function' ? await client.hgetall(key) : null
      if (!data || Object.keys(data).length === 0) {
        continue
      }
      const record = normalizeApiKeyRecord(key, data)
      if (dryRun) {
        logger.info(`[dry-run] would upsert api_key ${record.id}`)
      } else {
        await pool.execute(
          `INSERT INTO api_keys (id, hashed_key, user_id, status, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE hashed_key=VALUES(hashed_key), user_id=VALUES(user_id), status=VALUES(status), data=VALUES(data), updated_at=VALUES(updated_at)`,
          [
            record.id,
            record.hashedKey,
            record.userId,
            record.status,
            record.data,
            record.createdAt,
            record.updatedAt
          ]
        )
      }
      migrated += 1
    } catch (error) {
      logger.warn(`⚠️  apiKey ${key} migrate failed: ${error.message}`)
    }
  }
  logger.info(`✅ api_keys processed: ${migrated} ${dryRun ? '(dry-run, no writes)' : ''}`)
  return { migrated }
}

function normalizeApiKeyRecord(key, data = {}) {
  const id = data.id || key.replace('apikey:', '')
  const isActive = parseBool(data.isActive, true)
  return {
    id,
    userId: data.userId || data.user_id || null,
    hashedKey: data.apiKey || data.hashedKey || data.hashed_api_key || null,
    status: data.status || (isActive ? 'active' : 'inactive'),
    data: safeJson({ ...data, id }),
    createdAt: toMysqlDatetime(data.createdAt),
    updatedAt: toMysqlDatetime(data.updatedAt || data.createdAt)
  }
}

async function migrateUsage(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating usage (daily/monthly) from Redis → MySQL ...')
  const dailyKeys = await redisStore.keys('usage:daily:*')
  const monthlyKeys = await redisStore.keys('usage:monthly:*')
  let migrated = 0

  for (const key of dailyKeys) {
    const [, , apiKeyId, date] = key.split(':')
    if (!apiKeyId || !date || apiKeyId === 'undefined' || apiKeyId === 'null') {
      continue
    }
    const payload = await readObject(key)
    const record = normalizeUsageRecord(payload)
    if (dryRun) {
      logger.info(`[dry-run] daily usage ${apiKeyId} ${date}`)
    } else {
      await pool.execute(
        `INSERT INTO api_key_usage_daily (
          api_key_id, usage_date, requests, tokens, input_tokens, output_tokens,
          cache_create_tokens, cache_read_tokens, all_tokens, ephemeral5m_tokens,
          ephemeral1h_tokens, long_context_input_tokens, long_context_output_tokens,
          long_context_requests, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          requests=VALUES(requests),
          tokens=VALUES(tokens),
          input_tokens=VALUES(input_tokens),
          output_tokens=VALUES(output_tokens),
          cache_create_tokens=VALUES(cache_create_tokens),
          cache_read_tokens=VALUES(cache_read_tokens),
          all_tokens=VALUES(all_tokens),
          ephemeral5m_tokens=VALUES(ephemeral5m_tokens),
          ephemeral1h_tokens=VALUES(ephemeral1h_tokens),
          long_context_input_tokens=VALUES(long_context_input_tokens),
          long_context_output_tokens=VALUES(long_context_output_tokens),
          long_context_requests=VALUES(long_context_requests),
          updated_at=VALUES(updated_at)`,
        [
          apiKeyId,
          date,
          record.requests,
          record.tokens,
          record.inputTokens,
          record.outputTokens,
          record.cacheCreateTokens,
          record.cacheReadTokens,
          record.allTokens,
          record.ephemeral5mTokens,
          record.ephemeral1hTokens,
          record.longContextInputTokens,
          record.longContextOutputTokens,
          record.longContextRequests,
          record.createdAt,
          record.updatedAt
        ]
      )
    }
    migrated += 1
  }

  for (const key of monthlyKeys) {
    const [, , apiKeyId, month] = key.split(':')
    if (!apiKeyId || !month || apiKeyId === 'undefined' || apiKeyId === 'null') {
      continue
    }
    const payload = await readObject(key)
    const record = normalizeUsageRecord(payload)
    if (dryRun) {
      logger.info(`[dry-run] monthly usage ${apiKeyId} ${month}`)
    } else {
      await pool.execute(
        `INSERT INTO api_key_usage_monthly (
          api_key_id, usage_month, requests, tokens, input_tokens, output_tokens,
          cache_create_tokens, cache_read_tokens, all_tokens, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          requests=VALUES(requests),
          tokens=VALUES(tokens),
          input_tokens=VALUES(input_tokens),
          output_tokens=VALUES(output_tokens),
          cache_create_tokens=VALUES(cache_create_tokens),
          cache_read_tokens=VALUES(cache_read_tokens),
          all_tokens=VALUES(all_tokens),
          updated_at=VALUES(updated_at)`,
        [
          apiKeyId,
          month,
          record.requests,
          record.tokens,
          record.inputTokens,
          record.outputTokens,
          record.cacheCreateTokens,
          record.cacheReadTokens,
          record.allTokens,
          record.createdAt,
          record.updatedAt
        ]
      )
    }
    migrated += 1
  }

  logger.info(`✅ usage processed: ${migrated} ${dryRun ? '(dry-run, no writes)' : ''}`)
  return { migrated }
}

function normalizeUsageRecord(payload = {}) {
  return {
    requests: parseNumber(payload.requests),
    tokens: parseNumber(payload.tokens),
    inputTokens: parseNumber(payload.inputTokens),
    outputTokens: parseNumber(payload.outputTokens),
    cacheCreateTokens: parseNumber(payload.cacheCreateTokens),
    cacheReadTokens: parseNumber(payload.cacheReadTokens),
    allTokens: parseNumber(payload.allTokens),
    ephemeral5mTokens: parseNumber(payload.ephemeral5mTokens),
    ephemeral1hTokens: parseNumber(payload.ephemeral1hTokens),
    longContextInputTokens: parseNumber(payload.longContextInputTokens),
    longContextOutputTokens: parseNumber(payload.longContextOutputTokens),
    longContextRequests: parseNumber(payload.longContextRequests),
    createdAt: toMysqlDatetime(payload.createdAt),
    updatedAt: toMysqlDatetime(payload.updatedAt || payload.createdAt)
  }
}

async function migrateProviders(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating provider accounts from Redis → MySQL ...')
  let migrated = 0

  for (const source of PROVIDER_SOURCES) {
    const keys = await redisStore.keys(`${source.prefix}*`)
    if (!keys.length) {
      continue
    }
    for (const key of keys) {
      const accountId = key.replace(source.prefix, '')
      const payload = await readObject(key)
      if (!payload || Object.keys(payload).length === 0) {
        continue
      }
      const data = { id: accountId, ...payload }
      const status = payload.status || payload.state || null
      const createdAt = toMysqlDatetime(payload.createdAt || payload.created_at)
      const updatedAt = toMysqlDatetime(
        payload.updatedAt || payload.updated_at || payload.createdAt
      )

      if (dryRun) {
        logger.info(`[dry-run] provider ${source.type} ${accountId}`)
      } else {
        await pool.execute(
          `INSERT INTO provider_accounts (id, provider_type, status, data, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE status=VALUES(status), data=VALUES(data), updated_at=VALUES(updated_at)`,
          [accountId, source.type, status, safeJson(data), createdAt, updatedAt]
        )
      }
      migrated += 1
    }
  }

  logger.info(`✅ provider accounts processed: ${migrated} ${dryRun ? '(dry-run)' : ''}`)
  return { migrated }
}

async function migrateAccountGroups(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating account groups from Redis → MySQL ...')
  const client = typeof redisStore.getClientSafe === 'function' ? redisStore.getClientSafe() : null
  const groupIds =
    client && typeof client.smembers === 'function' ? await client.smembers('account_groups') : []
  let groupsMigrated = 0
  let membersMigrated = 0

  for (const groupId of groupIds) {
    const groupKey = `account_group:${groupId}`
    const group = await readObject(groupKey)
    if (!group || Object.keys(group).length === 0) {
      continue
    }
    const providerType = group.platform || group.providerType || null
    if (!providerType) {
      logger.warn(`⚠️  Skip account_group ${groupId}: missing platform`)
      continue
    }
    const createdAt = toMysqlDatetime(group.createdAt)
    const updatedAt = toMysqlDatetime(group.updatedAt || group.createdAt)
    const config = { description: group.description || '', ...group }

    if (dryRun) {
      logger.info(`[dry-run] account_group ${groupId}`)
    } else {
      await pool.execute(
        `INSERT INTO provider_account_groups (id, provider_type, name, strategy, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), strategy=VALUES(strategy), config=VALUES(config), updated_at=VALUES(updated_at)`,
        [
          groupId,
          providerType,
          group.name || groupId,
          group.strategy || 'round_robin',
          safeJson(config),
          createdAt,
          updatedAt
        ]
      )
    }
    groupsMigrated += 1

    const members =
      client && typeof client.smembers === 'function'
        ? await client.smembers(`account_group_members:${groupId}`)
        : []
    for (const accountId of members) {
      if (dryRun) {
        logger.info(`[dry-run] group_member ${groupId} -> ${accountId}`)
      } else {
        await pool.execute(
          `INSERT INTO provider_group_members (group_id, provider_account_id, provider_type, weight, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE weight=VALUES(weight), updated_at=VALUES(updated_at)`,
          [groupId, accountId, providerType, 1, updatedAt, updatedAt]
        )
      }
      membersMigrated += 1
    }
  }

  logger.info(
    `✅ account groups processed: ${groupsMigrated} groups, ${membersMigrated} members ${dryRun ? '(dry-run)' : ''}`
  )
  return { groups: groupsMigrated, members: membersMigrated }
}

async function migratePlans(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating plans from Redis → MySQL ...')
  const raw = await redisStore.get('sub:plans')
  if (!raw) {
    logger.info('ℹ️  No sub:plans found, skip.')
    return { migrated: 0 }
  }
  let plans = []
  try {
    plans = JSON.parse(raw)
  } catch (error) {
    logger.warn(`⚠️  Failed to parse sub:plans: ${error.message}`)
    return { migrated: 0 }
  }

  let migrated = 0
  for (const plan of plans) {
    if (!plan || !plan.id) {
      continue
    }
    const createdAt = toMysqlDatetime(plan.createdAt)
    const updatedAt = toMysqlDatetime(plan.updatedAt || plan.createdAt)
    if (dryRun) {
      logger.info(`[dry-run] plan ${plan.id}`)
    } else {
      await pool.execute(
        `INSERT INTO plans (id, name, description, currency, price, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), currency=VALUES(currency), price=VALUES(price), data=VALUES(data), updated_at=VALUES(updated_at)`,
        [
          plan.id,
          plan.name || plan.id,
          plan.description || null,
          plan.currency || 'CNY',
          parseNumber(plan.amount || plan.price),
          safeJson(plan),
          createdAt,
          updatedAt
        ]
      )
    }
    migrated += 1
  }

  logger.info(`✅ plans processed: ${migrated} ${dryRun ? '(dry-run)' : ''}`)
  return { migrated }
}

async function migrateSubscriptions(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating subscriptions from Redis → MySQL ...')
  const keys = await redisStore.keys('sub:subscription:*')
  let migrated = 0

  for (const key of keys) {
    const payload = await readObject(key)
    if (!payload || Object.keys(payload).length === 0) {
      continue
    }
    const id = payload.id || key.replace('sub:subscription:', '')
    const createdAt = toMysqlDatetime(payload.createdAt || payload.created_at)
    const updatedAt = toMysqlDatetime(payload.updatedAt || payload.updated_at || payload.createdAt)
    if (dryRun) {
      logger.info(`[dry-run] subscription ${id}`)
    } else {
      const billingCycle =
        payload.billingCycle ||
        payload.billing_cycle ||
        payload.cycle ||
        payload.planCycle ||
        'monthly'
      await pool.execute(
        `INSERT INTO subscriptions (id, user_id, status, plan_id, billing_cycle, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), plan_id=VALUES(plan_id), billing_cycle=VALUES(billing_cycle), data=VALUES(data), updated_at=VALUES(updated_at)`,
        [
          id,
          payload.userId || payload.user_id || null,
          payload.status || 'active',
          payload.planId || payload.plan_id || null,
          billingCycle,
          safeJson({ id, ...payload }),
          createdAt,
          updatedAt
        ]
      )
    }
    migrated += 1
  }

  logger.info(`✅ subscriptions processed: ${migrated} ${dryRun ? '(dry-run)' : ''}`)
  return { migrated }
}

async function migrateOrders(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating orders from Redis → MySQL ...')
  const keys = await redisStore.keys('sub:order:*')
  let migrated = 0

  for (const key of keys) {
    const payload = await readObject(key)
    if (!payload || Object.keys(payload).length === 0) {
      continue
    }
    const id = payload.id || key.replace('sub:order:', '')
    const createdAt = toMysqlDatetime(payload.createdAt || payload.created_at)
    const updatedAt = toMysqlDatetime(payload.updatedAt || payload.updated_at || payload.createdAt)
    if (dryRun) {
      logger.info(`[dry-run] order ${id}`)
    } else {
      await pool.execute(
        `INSERT INTO orders (id, user_id, subscription_id, plan_id, status, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE status=VALUES(status), subscription_id=VALUES(subscription_id), plan_id=VALUES(plan_id), data=VALUES(data), updated_at=VALUES(updated_at)`,
        [
          id,
          payload.userId || payload.user_id || null,
          payload.subscriptionId || payload.subscription_id || null,
          payload.planId || payload.plan_id || null,
          payload.status || 'pending',
          safeJson({ id, ...payload }),
          createdAt,
          updatedAt
        ]
      )
    }
    migrated += 1
  }

  logger.info(`✅ orders processed: ${migrated} ${dryRun ? '(dry-run)' : ''}`)
  return { migrated }
}

async function migratePayments(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating payments from Redis → MySQL ...')
  const keys = await redisStore.keys('payment:*')
  let migrated = 0

  for (const key of keys) {
    if (key === 'payment:session' || key.includes('payment_session')) {
      continue
    }
    const payload = await readObject(key)
    if (!payload || Object.keys(payload).length === 0) {
      continue
    }
    const id = payload.id || key.replace('payment:', '')
    const createdAt = toMysqlDatetime(payload.createdAt || payload.created_at)
    const updatedAt = toMysqlDatetime(payload.updatedAt || payload.updated_at || payload.createdAt)
    const completedAt = payload.completedAt || payload.paidAt || null

    if (dryRun) {
      logger.info(`[dry-run] payment ${id}`)
    } else {
      await pool.execute(
        `INSERT INTO payments (
          id, order_id, user_id, subscription_id, provider, method, status,
          amount, currency, provider_transaction_id, buyer_id, open_id, device_type,
          data, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          status=VALUES(status),
          provider_transaction_id=VALUES(provider_transaction_id),
          buyer_id=VALUES(buyer_id),
          open_id=VALUES(open_id),
          device_type=VALUES(device_type),
          data=VALUES(data),
          updated_at=VALUES(updated_at),
          completed_at=VALUES(completed_at)`,
        [
          id,
          payload.orderId || payload.order_id || null,
          payload.userId || payload.user_id || null,
          payload.subscriptionId || payload.subscription_id || null,
          payload.provider || payload.paymentProvider || 'unknown',
          payload.method || payload.paymentMethod || payload.provider || 'unknown',
          payload.status || payload.paymentStatus || 'pending',
          parseNumber(payload.amount || payload.price),
          payload.currency || 'CNY',
          payload.providerTransactionId || payload.tradeNo || payload.transactionId || null,
          payload.buyerId || null,
          payload.openId || payload.openid || null,
          payload.deviceType || null,
          safeJson({ id, ...payload }),
          createdAt,
          updatedAt,
          completedAt ? toMysqlDatetime(completedAt) : null
        ]
      )
    }
    migrated += 1
  }

  logger.info(`✅ payments processed: ${migrated} ${dryRun ? '(dry-run)' : ''}`)
  return { migrated }
}

async function migrateClients(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating WS clients from Redis → MySQL ...')
  const keys = await redisStore.keys('ws_client:status:*')
  let migrated = 0
  let historyMigrated = 0

  for (const key of keys) {
    const raw = await redisStore.get(key)
    if (!raw) {
      continue
    }
    let payload = null
    try {
      payload = JSON.parse(raw)
    } catch (error) {
      logger.warn(`⚠️  Failed to parse client payload ${key}: ${error.message}`)
      continue
    }
    const id = key.replace('ws_client:status:', '')
    const createdAt = toMysqlDatetime(
      payload.lastConnectedAt || payload.createdAt || payload.updatedAt
    )
    const updatedAt = toMysqlDatetime(
      payload.updatedAt || payload.lastHeartbeatAt || payload.lastConnectedAt
    )
    const status = payload.status || payload.connectionStatus || null
    const isActive = parseBool(payload.isActive, true)
    const data = safeJson({ id, ...payload })

    if (dryRun) {
      logger.info(`[dry-run] client ${id}`)
    } else {
      await pool.execute(
        `INSERT INTO clients (id, name, status, is_active, data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), status=VALUES(status), is_active=VALUES(is_active), data=VALUES(data), updated_at=VALUES(updated_at)`,
        [id, payload.name || id, status, isActive ? 1 : 0, data, createdAt, updatedAt]
      )
    }
    migrated += 1

    const history = Array.isArray(payload.configHistory) ? payload.configHistory : []
    for (let idx = 0; idx < history.length; idx += 1) {
      const entry = history[idx]
      if (!entry) {
        continue
      }
      const historyId = buildHistoryId(id, entry)
      const appliedAt = toMysqlDatetime(entry.appliedAt)
      const version = Math.max(1, history.length - idx)
      if (dryRun) {
        logger.info(`[dry-run] client_config ${id} ${historyId}`)
      } else {
        await pool.execute(
          `INSERT INTO client_config_history (
            id, client_id, version, applied_at, operator, requires_restart, summary,
            encrypted_applied_config, encrypted_changes, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            version=VALUES(version),
            applied_at=VALUES(applied_at),
            operator=VALUES(operator),
            requires_restart=VALUES(requires_restart),
            summary=VALUES(summary),
            encrypted_applied_config=VALUES(encrypted_applied_config),
            encrypted_changes=VALUES(encrypted_changes)`,
          [
            historyId,
            id,
            version,
            appliedAt,
            entry.operator || 'system',
            entry.requiresRestart ? 1 : 0,
            entry.summary || null,
            safeJson(entry.appliedConfig || {}),
            entry.changes ? safeJson(entry.changes) : null,
            appliedAt
          ]
        )
      }
      historyMigrated += 1
    }
  }

  logger.info(
    `✅ clients processed: ${migrated}, config history: ${historyMigrated} ${dryRun ? '(dry-run)' : ''}`
  )
  return { migrated, history: historyMigrated }
}

function normalizeUserRecord(key, data = {}) {
  const id = data.id || key.replace('user:', '')
  const email = data.email && String(data.email).trim() ? String(data.email).trim() : null
  const subscriptionId =
    data.subscriptionId && String(data.subscriptionId).trim()
      ? String(data.subscriptionId).trim()
      : null
  const {
    username,
    displayName,
    firstName,
    lastName,
    role,
    passwordHash,
    registrationMethod,
    ...rest
  } = data

  const extra = { ...rest }
  delete extra.id
  delete extra.username
  delete extra.email
  delete extra.displayName
  delete extra.firstName
  delete extra.lastName
  delete extra.role
  delete extra.isActive
  delete extra.passwordHash
  delete extra.emailVerified
  delete extra.registrationMethod
  delete extra.subscriptionId
  delete extra.lastLoginAt
  delete extra.deletedAt
  delete extra.createdAt
  delete extra.updatedAt
  delete extra.totalUsage
  delete extra.apiKeyCount

  return {
    id,
    username: username || null,
    email,
    displayName: displayName || null,
    firstName: firstName || null,
    lastName: lastName || null,
    role: role || 'user',
    isActive: parseBool(data.isActive, true),
    passwordHash: passwordHash || null,
    emailVerified: parseBool(data.emailVerified, false),
    registrationMethod: registrationMethod || 'local',
    subscriptionId,
    lastLoginAt: data.lastLoginAt ? toMysqlDatetime(data.lastLoginAt) : null,
    deletedAt: data.deletedAt ? toMysqlDatetime(data.deletedAt) : null,
    createdAt: toMysqlDatetime(data.createdAt),
    updatedAt: toMysqlDatetime(data.updatedAt || data.createdAt),
    data: Object.keys(extra).length ? safeJson(extra) : null
  }
}

async function migrateUsers(pool, { dryRun = false } = {}) {
  logger.info('🔄 Migrating users from Redis → MySQL ...')
  const keys = await redisStore.keys('user:*')
  if (!keys.length) {
    logger.info('ℹ️  No user records found, skip.')
    return { migrated: 0 }
  }

  let migrated = 0
  for (const key of keys) {
    try {
      const data = await readObject(key)
      if (!data || !data.username) {
        continue
      }
      const record = normalizeUserRecord(key, data)
      if (dryRun) {
        logger.info(`[dry-run] would upsert user ${record.username} (${record.id})`)
      } else {
        await pool.execute(
          `INSERT INTO users (
            id, username, email, display_name, first_name, last_name, role, is_active,
            password_hash, email_verified, registration_method, subscription_id,
            last_login_at, deleted_at, created_at, updated_at, data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            username=VALUES(username),
            email=VALUES(email),
            display_name=VALUES(display_name),
            first_name=VALUES(first_name),
            last_name=VALUES(last_name),
            role=VALUES(role),
            is_active=VALUES(is_active),
            password_hash=VALUES(password_hash),
            email_verified=VALUES(email_verified),
            registration_method=VALUES(registration_method),
            subscription_id=VALUES(subscription_id),
            last_login_at=VALUES(last_login_at),
            deleted_at=VALUES(deleted_at),
            updated_at=VALUES(updated_at),
            data=VALUES(data)`,
          [
            record.id,
            record.username,
            record.email,
            record.displayName,
            record.firstName,
            record.lastName,
            record.role,
            record.isActive ? 1 : 0,
            record.passwordHash,
            record.emailVerified ? 1 : 0,
            record.registrationMethod,
            record.subscriptionId,
            record.lastLoginAt,
            record.deletedAt,
            record.createdAt,
            record.updatedAt,
            record.data
          ]
        )
      }
      migrated += 1
    } catch (error) {
      logger.warn(`⚠️  user ${key} migrate failed: ${error.message}`)
    }
  }

  logger.info(`✅ users processed: ${migrated} ${dryRun ? '(dry-run, no writes)' : ''}`)
  return { migrated }
}

function buildHistoryId(clientId, entry) {
  const seed = `${clientId}:${entry?.appliedAt || ''}:${entry?.summary || ''}:${entry?.operator || ''}`
  return crypto.createHash('sha256').update(seed).digest('hex')
}

async function reconcile(pool) {
  logger.info('🔍 Reconciling counts Redis vs MySQL ...')
  const [mysqlApiKeys] = await pool.execute('SELECT COUNT(*) as c FROM api_keys')
  const redisApiKeys = (await redisStore.keys('apikey:*')).filter(
    (key) => key !== 'apikey:hash_map'
  ).length
  logger.info(`📊 api_keys: redis=${redisApiKeys} mysql=${mysqlApiKeys[0].c}`)

  const [mysqlUsers] = await pool.execute('SELECT COUNT(*) as c FROM users')
  const redisUsers = (await redisStore.keys('user:*')).length
  logger.info(`📊 users: redis=${redisUsers} mysql=${mysqlUsers[0].c}`)

  const [mysqlDaily] = await pool.execute('SELECT COUNT(*) as c FROM api_key_usage_daily')
  const redisDaily = (await redisStore.keys('usage:daily:*')).length
  logger.info(`📊 usage:daily: redis=${redisDaily} mysql=${mysqlDaily[0].c}`)

  const [mysqlMonthly] = await pool.execute('SELECT COUNT(*) as c FROM api_key_usage_monthly')
  const redisMonthly = (await redisStore.keys('usage:monthly:*')).length
  logger.info(`📊 usage:monthly: redis=${redisMonthly} mysql=${mysqlMonthly[0].c}`)

  const [mysqlPlans] = await pool.execute('SELECT COUNT(*) as c FROM plans')
  const plansRaw = await redisStore.get('sub:plans')
  let redisPlans = 0
  if (plansRaw) {
    try {
      const parsed = JSON.parse(plansRaw)
      redisPlans = Array.isArray(parsed) ? parsed.length : 0
    } catch (_) {
      redisPlans = 0
    }
  }
  logger.info(`📊 plans: redis=${redisPlans} mysql=${mysqlPlans[0].c}`)

  const [mysqlSubscriptions] = await pool.execute('SELECT COUNT(*) as c FROM subscriptions')
  const redisSubscriptions = (await redisStore.keys('sub:subscription:*')).length
  logger.info(`📊 subscriptions: redis=${redisSubscriptions} mysql=${mysqlSubscriptions[0].c}`)

  const [mysqlOrders] = await pool.execute('SELECT COUNT(*) as c FROM orders')
  const redisOrders = (await redisStore.keys('sub:order:*')).length
  logger.info(`📊 orders: redis=${redisOrders} mysql=${mysqlOrders[0].c}`)

  const [mysqlPayments] = await pool.execute('SELECT COUNT(*) as c FROM payments')
  const redisPayments = (await redisStore.keys('payment:*')).filter(
    (key) => key !== 'payment:session' && !key.includes('payment_session')
  ).length
  logger.info(`📊 payments: redis=${redisPayments} mysql=${mysqlPayments[0].c}`)

  const [mysqlClients] = await pool.execute('SELECT COUNT(*) as c FROM clients')
  const redisClients = (await redisStore.keys('ws_client:status:*')).length
  logger.info(`📊 clients: redis=${redisClients} mysql=${mysqlClients[0].c}`)

  const [mysqlClientConfig] = await pool.execute('SELECT COUNT(*) as c FROM client_config_history')
  logger.info(`📊 client_config_history: mysql=${mysqlClientConfig[0].c}`)

  const [mysqlGroups] = await pool.execute('SELECT COUNT(*) as c FROM provider_account_groups')
  const redisClient =
    typeof redisStore.getClientSafe === 'function' ? redisStore.getClientSafe() : redisStore
  const redisGroups = redisClient?.smembers
    ? (await redisClient.smembers('account_groups')).length
    : 0
  logger.info(`📊 provider_account_groups: redis=${redisGroups} mysql=${mysqlGroups[0].c}`)

  const [mysqlProviders] = await pool.execute('SELECT COUNT(*) as c FROM provider_accounts')
  let redisProviders = 0
  for (const source of PROVIDER_SOURCES) {
    const keys = await redisStore.keys(`${source.prefix}*`)
    redisProviders += keys.length
  }
  logger.info(`📊 provider_accounts: redis=${redisProviders} mysql=${mysqlProviders[0].c}`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  const typesArg = args[1] && !args[1].startsWith('--') ? args[1] : null
  const flags = args.filter((a) => a.startsWith('--'))
  let types = typesArg ? typesArg.split(',').map((s) => s.trim()) : SUPPORTED_TYPES
  if (types.includes('all')) {
    types = SUPPORTED_TYPES
  }
  const dryRun = flags.includes('--dry-run')
  return { cmd, types, dryRun }
}

async function main() {
  const { cmd, types, dryRun } = parseArgs()

  if (!cmd || !['migrate', 'reconcile'].includes(cmd)) {
    logger.error(
      'Usage: node scripts/migrate-redis-to-mysql.js migrate|reconcile [types] [--dry-run]'
    )
    process.exit(1)
  }

  await ensureRedis(redisStore)
  const pool = await requireMysqlPool()
  if (typeof mysqlStore.ensureSchema === 'function') {
    await mysqlStore.ensureSchema()
  }

  if (cmd === 'reconcile') {
    await reconcile(pool)
    process.exit(0)
  }

  if (types.includes('providers')) {
    await migrateProviders(pool, { dryRun })
  }
  if (types.includes('account_groups')) {
    await migrateAccountGroups(pool, { dryRun })
  }
  if (types.includes('plans')) {
    await migratePlans(pool, { dryRun })
  }
  if (types.includes('subscriptions')) {
    await migrateSubscriptions(pool, { dryRun })
  }
  if (types.includes('orders')) {
    await migrateOrders(pool, { dryRun })
  }
  if (types.includes('payments')) {
    await migratePayments(pool, { dryRun })
  }
  if (types.includes('clients')) {
    await migrateClients(pool, { dryRun })
  }
  if (types.includes('users')) {
    await migrateUsers(pool, { dryRun })
  }
  if (types.includes('api_keys')) {
    await migrateApiKeys(pool, { dryRun })
  }
  if (types.includes('usage')) {
    await migrateUsage(pool, { dryRun })
  }

  logger.info(
    `✅ Migration finished${dryRun ? ' (dry-run, no writes)' : ''}. You can run reconcile to verify counts.`
  )
  process.exit(0)
}

main().catch((err) => {
  logger.error('❌ Migration failed:', err)
  process.exit(1)
})
