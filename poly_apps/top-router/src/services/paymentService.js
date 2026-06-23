'use strict'

/**
 * Minimal payment service stub to mirror fork interfaces without wiring external providers.
 * Stores records in datastore for compatibility; can be swapped with real provider later.
 */

const { v4: uuidv4 } = require('uuid')
const datastore = require('../models/datastore')
const { getMysqlPool } = require('../models/mysqlPool')
const logger = require('../utils/logger')

const PAYMENT_KEY_PREFIX = 'payment:'
const USER_PAYMENTS_PREFIX = 'user_payments:'
const ORDER_PAYMENTS_PREFIX = 'order_payments:'
const USER_HISTORY_LIMIT = 50
const ORDER_HISTORY_LIMIT = 10

function generatePaymentId() {
  return `pay_${uuidv4()}`
}

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

function normalizePaymentRow(row) {
  const data = safeJsonParse(row.data, {})
  return {
    ...data,
    id: row.id,
    orderId: row.order_id ?? data.orderId,
    userId: row.user_id ?? data.userId,
    subscriptionId: row.subscription_id ?? data.subscriptionId ?? null,
    provider: row.provider ?? data.provider,
    method: row.method ?? data.method,
    status: row.status ?? data.status,
    amount: Number(row.amount ?? data.amount ?? 0),
    currency: row.currency ?? data.currency ?? 'CNY',
    providerTransactionId: row.provider_transaction_id ?? data.providerTransactionId ?? null,
    buyerId: row.buyer_id ?? data.buyerId ?? null,
    openId: row.open_id ?? data.openId ?? data.openid ?? null,
    deviceType: row.device_type ?? data.deviceType ?? null,
    createdAt: toIsoString(row.created_at) || data.createdAt || null,
    updatedAt: toIsoString(row.updated_at) || data.updatedAt || null,
    completedAt: toIsoString(row.completed_at) || data.completedAt || null
  }
}

async function upsertPaymentMysql(payment) {
  const pool = getMysqlPool()
  const createdAt = toDate(payment.createdAt) || new Date()
  const updatedAt = toDate(payment.updatedAt) || new Date()
  const completedAt = toDate(payment.completedAt)
  const amount = Number(payment.amount ?? 0)
  const payload = {
    ...payment,
    id: payment.id,
    createdAt: payment.createdAt || createdAt.toISOString(),
    updatedAt: payment.updatedAt || updatedAt.toISOString(),
    completedAt: payment.completedAt || (completedAt ? completedAt.toISOString() : null)
  }
  await pool.execute(
    `INSERT INTO payments (
      id, order_id, user_id, subscription_id, provider, method, status,
      amount, currency, provider_transaction_id, buyer_id, open_id, device_type,
      data, created_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      order_id=VALUES(order_id),
      user_id=VALUES(user_id),
      subscription_id=VALUES(subscription_id),
      provider=VALUES(provider),
      method=VALUES(method),
      status=VALUES(status),
      amount=VALUES(amount),
      currency=VALUES(currency),
      provider_transaction_id=VALUES(provider_transaction_id),
      buyer_id=VALUES(buyer_id),
      open_id=VALUES(open_id),
      device_type=VALUES(device_type),
      data=VALUES(data),
      updated_at=VALUES(updated_at),
      completed_at=VALUES(completed_at)`,
    [
      payload.id,
      payload.orderId,
      payload.userId,
      payload.subscriptionId || null,
      payload.provider,
      payload.method,
      payload.status,
      amount,
      payload.currency || 'CNY',
      payload.providerTransactionId || null,
      payload.buyerId || null,
      payload.openId || null,
      payload.deviceType || null,
      JSON.stringify(payload),
      createdAt,
      updatedAt,
      completedAt || null
    ]
  )
}

async function _cache(key, value, ttlSeconds = 3600) {
  if (useMysql()) {
    return
  }
  try {
    await datastore.setex(key, ttlSeconds, JSON.stringify(value))
  } catch (error) {
    logger.debug(`Payment cache failed: ${error.message}`)
  }
}

async function _get(key) {
  if (useMysql()) {
    return null
  }
  try {
    const raw = await datastore.get(key)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    logger.debug(`Payment cache read failed: ${error.message}`)
    return null
  }
}

async function _pushList(key, value, limit) {
  if (useMysql()) {
    return
  }
  try {
    await datastore.lpush(key, value)
    await datastore.ltrim(key, 0, limit - 1)
  } catch (error) {
    logger.debug(`Payment history push failed: ${error.message}`)
  }
}

async function createPaymentRecord({ order, method, provider, paymentPayload = {}, deviceType }) {
  const now = new Date().toISOString()
  const payment = {
    id: generatePaymentId(),
    orderId: order.id,
    userId: order.userId,
    subscriptionId: order.subscriptionId || null,
    amount: order.amount,
    currency: order.currency || 'CNY',
    provider,
    method,
    status: 'pending',
    paymentUrl: paymentPayload.paymentUrl || paymentPayload.h5Url || null,
    codeUrl: paymentPayload.codeUrl || null,
    qrCode: paymentPayload.qrCode || null,
    providerTransactionId: null,
    buyerId: null,
    openId: null,
    metadata: {
      planId: order.planId,
      planName: order.planName,
      billingCycle: order.billingCycle || null
    },
    providerPayload: paymentPayload || null,
    deviceType: deviceType || 'web',
    createdAt: now,
    updatedAt: now,
    completedAt: null
  }

  if (useMysql()) {
    await upsertPaymentMysql(payment)
  } else {
    await _cache(`${PAYMENT_KEY_PREFIX}${payment.id}`, payment)
    await _pushList(`${USER_PAYMENTS_PREFIX}${order.userId}`, payment.id, USER_HISTORY_LIMIT)
    await _pushList(`${ORDER_PAYMENTS_PREFIX}${order.id}`, payment.id, ORDER_HISTORY_LIMIT)
  }
  return payment
}

async function updatePayment(paymentId, updates) {
  const current = await getPaymentById(paymentId)
  if (!current) {
    return null
  }
  const next = {
    ...current,
    ...updates,
    updatedAt: updates.updatedAt || new Date().toISOString()
  }
  if (useMysql()) {
    await upsertPaymentMysql(next)
  } else {
    await _cache(`${PAYMENT_KEY_PREFIX}${paymentId}`, next)
  }
  return next
}

async function getPaymentById(paymentId) {
  if (useMysql()) {
    const pool = getMysqlPool()
    const [rows] = await pool.execute('SELECT * FROM payments WHERE id = ?', [paymentId])
    if (!rows.length) {
      return null
    }
    return normalizePaymentRow(rows[0])
  }
  return _get(`${PAYMENT_KEY_PREFIX}${paymentId}`)
}

async function findLatestPaymentForOrder(orderId) {
  if (useMysql()) {
    const pool = getMysqlPool()
    const [rows] = await pool.execute(
      'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1',
      [orderId]
    )
    if (!rows.length) {
      return null
    }
    return normalizePaymentRow(rows[0])
  }
  const [latestId] = (await datastore.lrange(`${ORDER_PAYMENTS_PREFIX}${orderId}`, 0, 0)) || []
  if (latestId) {
    return getPaymentById(latestId)
  }
  return null
}

async function markOrderPaymentSucceeded(orderId, context = {}) {
  const payment = await findLatestPaymentForOrder(orderId)
  if (!payment) {
    logger.warn(`⚠️ No payment record found for order ${orderId}`)
    return null
  }
  return updatePayment(payment.id, {
    status: 'succeeded',
    providerTransactionId: context.transactionId || context.tradeNo || null,
    buyerId: context.buyerId || null,
    openId: context.openId || context.openid || null,
    providerPayload: context.rawPayload || context,
    completedAt: new Date().toISOString()
  })
}

async function markOrderPaymentRefunded(orderId, context = {}) {
  const payment = await findLatestPaymentForOrder(orderId)
  if (!payment) {
    logger.warn(`⚠️ No payment record found for order ${orderId}`)
    return null
  }
  return updatePayment(payment.id, {
    status: 'refunded',
    providerTransactionId:
      context.transactionId || context.tradeNo || payment.providerTransactionId,
    providerPayload: context.rawPayload || context,
    refundedAt: new Date().toISOString()
  })
}

module.exports = {
  createPaymentRecord,
  updatePayment,
  getPaymentById,
  findLatestPaymentForOrder,
  markOrderPaymentSucceeded,
  markOrderPaymentRefunded
}
