'use strict'

const SENSITIVE_KEYS = new Set([
  'sign',
  'sign_type',
  'signature',
  'auth_code',
  'buyer_id',
  'buyer_logon_id',
  'openid',
  'open_id',
  'payer',
  'payer_client_ip',
  'nonce',
  'nonce_str',
  'ciphertext',
  'api_key',
  'apikey',
  'access_key',
  'accesskey',
  'secret',
  'secret_key',
  'app_id',
  'mch_id',
  'serial_no'
])

function maskValue(value) {
  if (value === null || value === undefined) {
    return value
  }
  const str = String(value)
  if (str.length <= 4) {
    return '***'
  }
  return `${str.slice(0, 3)}***${str.slice(-2)}`
}

function sanitizePaymentPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload
  }
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizePaymentPayload(item))
  }
  const sanitized = {}
  for (const [key, value] of Object.entries(payload)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.has(lowerKey)) {
      sanitized[key] = maskValue(value)
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizePaymentPayload(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function extractPaymentContext(provider, payload) {
  const source = payload || {}
  const orderId =
    source.out_trade_no || source.order_id || source.orderId || source.outTradeNo || null
  const transactionId =
    source.trade_no || source.transaction_id || source.transactionId || source.tradeNo || null
  const status =
    source.trade_status || source.trade_state || source.result_code || source.status || null
  return {
    provider,
    orderId,
    transactionId,
    status
  }
}

module.exports = {
  extractPaymentContext,
  sanitizePaymentPayload
}
