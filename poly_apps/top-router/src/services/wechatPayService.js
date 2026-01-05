'use strict'

const fs = require('fs')
const path = require('path')
const { v4: uuidv4 } = require('uuid')
const WechatpayLib = require('wechatpay-node-v3')
const config = require('../../config/config')
const logger = require('../utils/logger')

const Wechatpay = WechatpayLib.default || WechatpayLib

function getWechatConfig() {
  return config.payment?.wechat || {}
}

function resolveFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return ''
  }
  return path.resolve(filePath)
}

let wechatpayClient = null
let initAttempted = false

function initWechatpayClient() {
  const cfg = getWechatConfig()
  if (!cfg.appId || !cfg.mchId || !cfg.apiV3Key) {
    logger.warn('⚠️ WeChat Pay SDK not initialized: missing appId/mchId/apiV3Key')
    return null
  }
  if (!cfg.certPath || !cfg.keyPath) {
    logger.warn('⚠️ WeChat Pay SDK not initialized: missing certPath/keyPath')
    return null
  }

  const certPath = resolveFilePath(cfg.certPath)
  const keyPath = resolveFilePath(cfg.keyPath)

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    logger.warn('⚠️ WeChat Pay SDK not initialized: certificate files not found', {
      certPath,
      keyPath
    })
    return null
  }

  try {
    const client = new Wechatpay({
      appid: cfg.appId,
      mchid: cfg.mchId,
      publicKey: fs.readFileSync(certPath),
      privateKey: fs.readFileSync(keyPath),
      serial_no: cfg.serialNo || undefined,
      key: cfg.apiV3Key
    })
    logger.info('✅ WeChat Pay SDK initialized')
    return client
  } catch (error) {
    logger.error('❌ Failed to initialize WeChat Pay SDK', {
      message: error.message
    })
    return null
  }
}

function getWechatpayClient() {
  if (!initAttempted) {
    initAttempted = true
    wechatpayClient = initWechatpayClient()
  }
  return wechatpayClient
}

function ensureWechatpayClient() {
  const client = getWechatpayClient()
  if (!client) {
    throw new Error('WeChat Pay SDK not initialized')
  }
  return client
}

function toCents(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) {
    throw new Error('Invalid amount')
  }
  return Math.round(num * 100)
}

function mapTradeState(tradeState) {
  const state = (tradeState || '').toUpperCase()
  if (state === 'SUCCESS') {
    return 'paid'
  }
  if (state === 'REFUND') {
    return 'refunded'
  }
  if (state === 'NOTPAY' || state === 'USERPAYING' || state === 'ACCEPT') {
    return 'pending'
  }
  if (state === 'CLOSED' || state === 'REVOKED') {
    return 'cancelled'
  }
  if (state === 'PAYERROR') {
    return 'failed'
  }
  return 'failed'
}

function mapRefundStatus(status) {
  const state = (status || '').toUpperCase()
  if (state === 'SUCCESS') {
    return 'refunded'
  }
  if (state === 'PROCESSING') {
    return 'pending'
  }
  if (state === 'CLOSED' || state === 'ABNORMAL') {
    return 'failed'
  }
  return 'failed'
}

function parseNotify(body = {}, decrypted = null) {
  let source = decrypted || body
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch (_) {
      source = {}
    }
  }
  const orderId = source.out_trade_no
  const transactionId = source.transaction_id
  const tradeState = source.trade_state || source.trade_status || source.result_code
  return { orderId, transactionId, tradeState }
}

async function handleNotify(req) {
  const cfg = getWechatConfig()
  const headers = req.headers || {}
  const signature = headers['wechatpay-signature']
  const timestamp = headers['wechatpay-timestamp']
  const nonce = headers['wechatpay-nonce']
  const serial = headers['wechatpay-serial']
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {})

  let valid = false
  let decrypted = null

  if (signature && timestamp && nonce && serial) {
    try {
      const client = ensureWechatpayClient()
      valid = await client.verifySign({
        timestamp,
        nonce,
        serial,
        signature,
        body: rawBody,
        apiSecret: cfg.apiV3Key
      })

      if (valid && req.body?.resource?.ciphertext) {
        decrypted = client.decipher_gcm(
          req.body.resource.ciphertext,
          req.body.resource.associated_data,
          req.body.resource.nonce,
          cfg.apiV3Key
        )
      }
    } catch (error) {
      logger.warn(`⚠️ WeChat notify verification failed: ${error.message}`)
      valid = false
    }
  } else {
    logger.warn('⚠️ WeChat notify missing signature headers')
  }

  const parsed = parseNotify(req.body || {}, decrypted)
  const success = ['SUCCESS', 'TRADE_SUCCESS'].includes(parsed.tradeState)
  return { valid, success, ...parsed, decrypted }
}

async function createPayment(order, method = 'native', options = {}) {
  const cfg = getWechatConfig()
  if (!cfg.appId || !cfg.mchId) {
    throw new Error('WeChat appId/mchId is required')
  }
  if (!cfg.notifyUrl) {
    throw new Error('WeChat notifyUrl is required')
  }

  const client = ensureWechatpayClient()
  const mode = (method || 'native').toLowerCase()

  const payload = {
    appid: cfg.appId,
    mchid: cfg.mchId,
    description: order.planName || order.id,
    out_trade_no: order.id,
    notify_url: cfg.notifyUrl,
    amount: {
      total: toCents(order.amount),
      currency: order.currency || 'CNY'
    }
  }

  const expiryMinutes = config.payment?.orderExpiryMinutes
  if (expiryMinutes && Number.isFinite(expiryMinutes)) {
    payload.time_expire = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString()
  }

  if (mode === 'h5' || mode === 'wap') {
    payload.scene_info = {
      payer_client_ip: options.clientIp || '127.0.0.1',
      h5_info: { type: 'Wap' }
    }
  }

  if (mode === 'jsapi') {
    if (!options.openId) {
      throw new Error('WeChat openId is required for jsapi')
    }
    payload.payer = { openid: options.openId }
  }

  let result
  if (mode === 'h5' || mode === 'wap') {
    result = await client.transactions_h5(payload)
  } else if (mode === 'jsapi') {
    result = await client.transactions_jsapi(payload)
  } else {
    result = await client.transactions_native(payload)
  }

  const data = result?.data || result

  return {
    provider: 'wechat',
    method: mode,
    codeUrl: data?.code_url || null,
    h5Url: data?.h5_url || null,
    prepayId: data?.prepay_id || null,
    raw: data
  }
}

async function queryOrder(orderId) {
  const cfg = getWechatConfig()
  if (!cfg.mchId) {
    throw new Error('WeChat mchId is required')
  }
  const client = ensureWechatpayClient()
  const result = await client.query({ out_trade_no: orderId, mchid: cfg.mchId })
  const data = result?.data || result
  const tradeState = data?.trade_state
  return {
    orderId: data?.out_trade_no || orderId,
    transactionId: data?.transaction_id || null,
    tradeState,
    status: mapTradeState(tradeState),
    raw: data
  }
}

async function refundOrder(order, refundAmount, reason = '') {
  const refundId = `refund_${uuidv4().slice(0, 12)}`
  const total = toCents(order.amount)
  const refund = toCents(refundAmount || order.amount)
  const client = ensureWechatpayClient()

  const payload = {
    out_trade_no: order.id,
    out_refund_no: refundId,
    reason: reason || undefined,
    amount: {
      refund,
      total,
      currency: order.currency || 'CNY'
    }
  }

  const result = await client.refunds(payload)
  const data = result?.data || result

  return {
    orderId: data?.out_trade_no || order.id,
    transactionId: data?.transaction_id || null,
    refundId: data?.refund_id || refundId,
    status: mapRefundStatus(data?.status),
    raw: data
  }
}

module.exports = {
  createPayment,
  handleNotify,
  queryOrder,
  refundOrder,
  mapTradeState
}
