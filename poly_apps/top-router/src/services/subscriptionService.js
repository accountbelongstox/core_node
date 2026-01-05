'use strict'

const { v4: uuidv4 } = require('uuid')
const datastore = require('../models/datastore')
const { getMysqlPool } = require('../models/mysqlPool')
const paymentService = require('./paymentService')
const alipayService = require('./alipayService')
const wechatPayService = require('./wechatPayService')
const userService = require('./userService')
const config = require('../../config/config')
const logger = require('../utils/logger')

const ORDER_KEY_PREFIX = 'sub:order:'
const USER_ORDERS_PREFIX = 'sub:user:orders:'
const SUBSCRIPTION_KEY_PREFIX = 'sub:subscription:'
const PLANS_KEY = 'sub:plans'

const ORDER_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
  FAILED: 'failed',
  REFUNDED: 'refunded'
}

// 简单内置套餐（可按需改为配置/数据库）
const PLANS = [
  { id: 'basic', name: 'Basic', amount: 29, currency: 'CNY', cycle: 'monthly' },
  { id: 'pro', name: 'Pro', amount: 59, currency: 'CNY', cycle: 'monthly' }
]

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
  if (!value) {
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

function normalizePlanRow(row) {
  const data = safeJsonParse(row.data, {})
  const amount = Number(data.amount ?? data.price ?? row.price ?? 0)
  const currency = row.currency || data.currency || 'CNY'
  return {
    ...data,
    id: row.id,
    name: row.name || data.name || row.id,
    description: row.description ?? data.description ?? '',
    currency,
    amount,
    price: amount
  }
}

function normalizeOrderRow(row) {
  const data = safeJsonParse(row.data, {})
  return {
    ...data,
    id: row.id,
    userId: row.user_id ?? data.userId ?? null,
    subscriptionId: row.subscription_id ?? data.subscriptionId ?? null,
    planId: row.plan_id ?? data.planId ?? null,
    status: row.status || data.status,
    createdAt: toIsoString(row.created_at) || data.createdAt || null,
    updatedAt: toIsoString(row.updated_at) || data.updatedAt || null
  }
}

function normalizeSubscriptionRow(row) {
  const data = safeJsonParse(row.data, {})
  return {
    ...data,
    id: row.id,
    userId: row.user_id ?? data.userId ?? null,
    status: row.status || data.status || 'active',
    planId: row.plan_id ?? data.planId ?? null,
    billingCycle: row.billing_cycle || data.billingCycle || 'monthly',
    createdAt: toIsoString(row.created_at) || data.createdAt || null,
    updatedAt: toIsoString(row.updated_at) || data.updatedAt || null
  }
}

async function getPlansFromMysql() {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM plans ORDER BY created_at DESC')
  return rows.map(normalizePlanRow)
}

async function upsertPlanMysql(plan) {
  const pool = getMysqlPool()
  const createdAt = toDate(plan.createdAt) || new Date()
  const updatedAt = toDate(plan.updatedAt) || new Date()
  const amount = Number(plan.amount ?? plan.price ?? 0)
  const payload = {
    ...plan,
    id: plan.id,
    name: plan.name || plan.id,
    description: plan.description || '',
    currency: plan.currency || 'CNY',
    amount,
    price: amount,
    createdAt: plan.createdAt || createdAt.toISOString(),
    updatedAt: plan.updatedAt || updatedAt.toISOString()
  }
  await pool.execute(
    `INSERT INTO plans (id, name, description, currency, price, data, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       name=VALUES(name),
       description=VALUES(description),
       currency=VALUES(currency),
       price=VALUES(price),
       data=VALUES(data),
       updated_at=VALUES(updated_at)`,
    [
      payload.id,
      payload.name,
      payload.description || null,
      payload.currency,
      amount,
      JSON.stringify(payload),
      createdAt,
      updatedAt
    ]
  )
}

async function getOrderMysql(orderId) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM orders WHERE id = ?', [orderId])
  if (!rows.length) {
    return null
  }
  return normalizeOrderRow(rows[0])
}

async function upsertOrderMysql(order) {
  const pool = getMysqlPool()
  const createdAt = toDate(order.createdAt) || new Date()
  const updatedAt = toDate(order.updatedAt) || new Date()
  const payload = {
    ...order,
    id: order.id,
    createdAt: order.createdAt || createdAt.toISOString(),
    updatedAt: order.updatedAt || updatedAt.toISOString()
  }
  await pool.execute(
    `INSERT INTO orders (
      id, user_id, subscription_id, plan_id, status, data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id=VALUES(user_id),
      subscription_id=VALUES(subscription_id),
      plan_id=VALUES(plan_id),
      status=VALUES(status),
      data=VALUES(data),
      updated_at=VALUES(updated_at)`,
    [
      payload.id,
      payload.userId || null,
      payload.subscriptionId || null,
      payload.planId || null,
      payload.status || ORDER_STATUS.PENDING,
      JSON.stringify(payload),
      createdAt,
      updatedAt
    ]
  )
}

async function getSubscriptionMysql(subscriptionId) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId])
  if (!rows.length) {
    return null
  }
  return normalizeSubscriptionRow(rows[0])
}

async function upsertSubscriptionMysql(subscription) {
  const pool = getMysqlPool()
  const createdAt = toDate(subscription.createdAt || subscription.startedAt) || new Date()
  const updatedAt = toDate(subscription.updatedAt || subscription.startedAt) || new Date()
  const payload = {
    ...subscription,
    id: subscription.id,
    createdAt: subscription.createdAt || createdAt.toISOString(),
    updatedAt: subscription.updatedAt || updatedAt.toISOString()
  }
  await pool.execute(
    `INSERT INTO subscriptions (
      id, user_id, status, plan_id, billing_cycle, data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id=VALUES(user_id),
      status=VALUES(status),
      plan_id=VALUES(plan_id),
      billing_cycle=VALUES(billing_cycle),
      data=VALUES(data),
      updated_at=VALUES(updated_at)`,
    [
      payload.id,
      payload.userId || null,
      payload.status || 'active',
      payload.planId || null,
      payload.billingCycle || 'monthly',
      JSON.stringify(payload),
      createdAt,
      updatedAt
    ]
  )
}

async function getPlans() {
  if (useMysql()) {
    const plans = await getPlansFromMysql()
    return plans.length ? plans : PLANS
  }
  const raw = await datastore.get(PLANS_KEY)
  if (raw) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    } catch (_) {
      // ignore
    }
  }
  return PLANS
}

async function setPlans(plans) {
  if (!Array.isArray(plans)) {
    throw new Error('plans must be an array')
  }
  if (useMysql()) {
    const pool = getMysqlPool()
    const ids = plans.map((plan) => plan?.id).filter(Boolean)
    const [rows] = await pool.execute('SELECT id FROM plans')
    const existing = new Set(rows.map((row) => row.id))
    const incoming = new Set(ids)
    const toDelete = [...existing].filter((id) => !incoming.has(id))
    if (toDelete.length) {
      const placeholders = toDelete.map(() => '?').join(',')
      await pool.execute(`DELETE FROM plans WHERE id IN (${placeholders})`, toDelete)
    }
    for (const plan of plans) {
      if (!plan || !plan.id) {
        throw new Error('plan id is required')
      }
      await upsertPlanMysql(plan)
    }
    return
  }
  await datastore.set(PLANS_KEY, JSON.stringify(plans))
}

async function getPlan(planId) {
  const plans = await getPlans()
  return plans.find((p) => p.id === planId) || null
}

function generateOrderId() {
  return `order_${uuidv4()}`
}

async function _cacheOrder(order) {
  if (useMysql()) {
    await upsertOrderMysql(order)
    return
  }
  await datastore.set(`${ORDER_KEY_PREFIX}${order.id}`, JSON.stringify(order))
}

async function _getOrder(orderId) {
  if (useMysql()) {
    return getOrderMysql(orderId)
  }
  const raw = await datastore.get(`${ORDER_KEY_PREFIX}${orderId}`)
  return raw ? JSON.parse(raw) : null
}

async function _setOrder(order) {
  if (useMysql()) {
    await upsertOrderMysql(order)
    return
  }
  await datastore.set(`${ORDER_KEY_PREFIX}${order.id}`, JSON.stringify(order))
}

async function _getSubscriptionForOrder(order) {
  if (!order || !order.subscriptionId) {
    return null
  }
  if (useMysql()) {
    return getSubscriptionMysql(order.subscriptionId)
  }
  const raw = await datastore.get(`${SUBSCRIPTION_KEY_PREFIX}${order.subscriptionId}`)
  return raw ? JSON.parse(raw) : null
}

async function _pushUserOrder(userId, orderId) {
  if (useMysql()) {
    return
  }
  await datastore.lpush(`${USER_ORDERS_PREFIX}${userId}`, orderId)
  await datastore.ltrim(`${USER_ORDERS_PREFIX}${userId}`, 0, 49)
}

async function createOrder({
  userId,
  planId,
  provider = 'alipay',
  method = 'web',
  clientIp,
  openId
}) {
  const plan = await getPlan(planId)
  if (!plan) {
    const err = new Error('Invalid planId')
    err.code = 'INVALID_PLAN'
    throw err
  }
  const order = {
    id: generateOrderId(),
    userId,
    planId,
    planName: plan.name,
    amount: plan.amount,
    currency: plan.currency,
    billingCycle: plan.cycle,
    method,
    status: ORDER_STATUS.PENDING,
    provider,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expiresAt: (() => {
      const minutes = Number(config.payment?.orderExpiryMinutes || 0)
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return null
      }
      return new Date(Date.now() + minutes * 60 * 1000).toISOString()
    })(),
    paymentId: null,
    subscriptionId: null
  }

  let paymentPayload = {}
  if (provider === 'alipay') {
    paymentPayload = await alipayService.createPayment(order, method)
  } else if (provider === 'wechat') {
    paymentPayload = await wechatPayService.createPayment(order, method, { clientIp, openId })
  } else {
    const err = new Error(`Unsupported payment provider: ${provider}`)
    err.code = 'UNSUPPORTED_PROVIDER'
    throw err
  }

  const payment = await paymentService.createPaymentRecord({
    order,
    method,
    provider,
    paymentPayload,
    deviceType: method
  })

  order.paymentId = payment.id
  await _setOrder(order)
  await _pushUserOrder(userId, order.id)

  return { order, payment }
}

async function markPaid(orderId, context = {}) {
  const order = await _getOrder(orderId)
  if (!order) {
    return null
  }
  if (order.status === ORDER_STATUS.PAID) {
    const subscription = await _getSubscriptionForOrder(order)
    if (subscription) {
      logger.info(`Payment already marked paid for order ${orderId}`)
      return { order, subscription }
    }
    logger.warn(`Order ${orderId} is paid but subscription is missing; creating subscription`)
  }

  const terminalStatuses = [
    ORDER_STATUS.REFUNDED,
    ORDER_STATUS.CANCELLED,
    ORDER_STATUS.EXPIRED,
    ORDER_STATUS.FAILED
  ]
  if (terminalStatuses.includes(order.status)) {
    logger.warn(`Ignoring payment success for order ${orderId} with status ${order.status}`)
    const subscription = await _getSubscriptionForOrder(order)
    return { order, subscription }
  }

  const wasPaid = order.status === ORDER_STATUS.PAID
  if (!wasPaid) {
    order.status = ORDER_STATUS.PAID
    order.updatedAt = new Date().toISOString()
    await _setOrder(order)
    await paymentService.markOrderPaymentSucceeded(orderId, context)
  }

  let subscription = await _getSubscriptionForOrder(order)
  if (!subscription) {
    const now = new Date()
    const nowIso = now.toISOString()
    const cycleDays = order.billingCycle === 'yearly' ? 365 : 30
    const expiresAt = new Date(now.getTime() + cycleDays * 24 * 3600 * 1000).toISOString()
    subscription = {
      id: `sub_${uuidv4()}`,
      userId: order.userId,
      planId: order.planId,
      planName: order.planName,
      status: 'active',
      startedAt: nowIso,
      currentPeriodStart: nowIso,
      currentPeriodEnd: expiresAt,
      expiresAt,
      billingCycle: order.billingCycle || 'monthly',
      autoRenew: false
    }
    if (useMysql()) {
      await upsertSubscriptionMysql(subscription)
    } else {
      await datastore.set(
        `${SUBSCRIPTION_KEY_PREFIX}${subscription.id}`,
        JSON.stringify(subscription)
      )
    }
    order.subscriptionId = subscription.id
    order.updatedAt = new Date().toISOString()
    await _setOrder(order)
  }

  if (order.userId && order.subscriptionId) {
    await userService.updateUserSubscription(order.userId, order.subscriptionId).catch(() => null)
  }

  return { order, subscription }
}

async function markRefunded(orderId, context = {}) {
  const order = await _getOrder(orderId)
  if (!order) {
    return null
  }
  if (order.status === ORDER_STATUS.REFUNDED) {
    logger.info(`Payment already marked refunded for order ${orderId}`)
    const subscription = await _getSubscriptionForOrder(order)
    return { order, subscription }
  }
  if (order.status !== ORDER_STATUS.PAID) {
    logger.warn(`Refund received for order ${orderId} with status ${order.status}`)
  }

  order.status = ORDER_STATUS.REFUNDED
  order.updatedAt = new Date().toISOString()
  await _setOrder(order)
  await paymentService.markOrderPaymentRefunded(orderId, context)

  let subscription = await _getSubscriptionForOrder(order)
  if (subscription) {
    const now = new Date().toISOString()
    const updates = {
      status: 'refunded',
      refundedAt: now
    }
    if (subscription.expiresAt && new Date(subscription.expiresAt) > new Date(now)) {
      updates.expiresAt = now
    }
    subscription = await updateSubscription(subscription.id, updates)
  }

  if (order.userId && order.subscriptionId) {
    const user = await userService.getUserById(order.userId, false).catch(() => null)
    if (user && user.subscriptionId === order.subscriptionId) {
      await userService.updateUserSubscription(order.userId, null).catch(() => null)
    }
  }

  return { order, subscription }
}

async function updateOrderStatus(orderId, status) {
  const order = await _getOrder(orderId)
  if (!order) {
    return null
  }
  order.status = status
  order.updatedAt = new Date().toISOString()
  await _setOrder(order)
  return order
}

async function getOrder(orderId) {
  return _getOrder(orderId)
}

async function getUserOrders(userId) {
  if (useMysql()) {
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    )
    return rows.map(normalizeOrderRow)
  }
  const ids = (await datastore.lrange(`${USER_ORDERS_PREFIX}${userId}`, 0, 49)) || []
  const orders = []
  for (const id of ids) {
    const o = await _getOrder(id)
    if (o) {
      orders.push(o)
    }
  }
  return orders
}

async function listOrders() {
  if (useMysql()) {
    const pool = getMysqlPool()
    const [rows] = await pool.execute('SELECT * FROM orders ORDER BY created_at DESC')
    return rows.map(normalizeOrderRow)
  }
  const keys = (await datastore.keys(`${ORDER_KEY_PREFIX}*`)) || []
  const orders = []
  for (const key of keys) {
    const raw = await datastore.get(key)
    if (!raw) {
      continue
    }
    try {
      orders.push(JSON.parse(raw))
    } catch (_) {
      // ignore
    }
  }
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return orders
}

async function getSubscription(subscriptionId) {
  if (useMysql()) {
    return getSubscriptionMysql(subscriptionId)
  }
  const raw = await datastore.get(`${SUBSCRIPTION_KEY_PREFIX}${subscriptionId}`)
  return raw ? JSON.parse(raw) : null
}

async function listSubscriptions() {
  if (useMysql()) {
    const pool = getMysqlPool()
    const [rows] = await pool.execute('SELECT * FROM subscriptions ORDER BY updated_at DESC')
    return rows.map(normalizeSubscriptionRow)
  }
  const keys = (await datastore.keys(`${SUBSCRIPTION_KEY_PREFIX}*`)) || []
  const subscriptions = []
  for (const key of keys) {
    const raw = await datastore.get(key)
    if (!raw) {
      continue
    }
    try {
      subscriptions.push(JSON.parse(raw))
    } catch (_) {
      // ignore
    }
  }
  subscriptions.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0))
  return subscriptions
}

async function updateSubscription(subscriptionId, updates = {}) {
  const current = await getSubscription(subscriptionId)
  if (!current) {
    return null
  }
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  if (useMysql()) {
    await upsertSubscriptionMysql(next)
    return next
  }
  await datastore.set(`${SUBSCRIPTION_KEY_PREFIX}${subscriptionId}`, JSON.stringify(next))
  return next
}

async function addPlan(plan) {
  if (!plan || !plan.id) {
    throw new Error('plan id is required')
  }
  if (useMysql()) {
    const existing = await getPlan(plan.id)
    if (existing) {
      throw new Error('plan id already exists')
    }
    await upsertPlanMysql(plan)
    return plan
  }
  const plans = await getPlans()
  if (plans.some((p) => p.id === plan.id)) {
    throw new Error('plan id already exists')
  }
  plans.push(plan)
  await setPlans(plans)
  return plan
}

async function updatePlan(planId, updates = {}) {
  if (useMysql()) {
    const current = await getPlan(planId)
    if (!current) {
      return null
    }
    const next = { ...current, ...updates, id: planId, updatedAt: new Date().toISOString() }
    await upsertPlanMysql(next)
    return next
  }
  const plans = await getPlans()
  const index = plans.findIndex((p) => p.id === planId)
  if (index === -1) {
    return null
  }
  plans[index] = { ...plans[index], ...updates, id: planId }
  await setPlans(plans)
  return plans[index]
}

async function deletePlan(planId) {
  if (useMysql()) {
    const pool = getMysqlPool()
    await pool.execute('DELETE FROM plans WHERE id = ?', [planId])
    return getPlans()
  }
  const plans = await getPlans()
  const next = plans.filter((p) => p.id !== planId)
  await setPlans(next)
  return next
}

module.exports = {
  PLANS,
  ORDER_STATUS,
  getPlans,
  addPlan,
  updatePlan,
  deletePlan,
  createOrder,
  markPaid,
  markRefunded,
  updateOrderStatus,
  getOrder,
  getUserOrders,
  listOrders,
  getSubscription,
  listSubscriptions,
  updateSubscription
}
