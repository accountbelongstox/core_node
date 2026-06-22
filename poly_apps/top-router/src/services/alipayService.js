'use strict'

const crypto = require('crypto')
const axios = require('axios')
const config = require('../../config/config')
const logger = require('../utils/logger')

function getAlipayConfig() {
  return config.payment?.alipay || {}
}

function normalizeKey(key) {
  if (!key || typeof key !== 'string') {
    return key
  }
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key
}

function formatAmount(amount) {
  const num = Number(amount)
  if (!Number.isFinite(num)) {
    throw new Error('Invalid amount')
  }
  return num.toFixed(2)
}

function formatTimestamp(date) {
  const pad = (val) => String(val).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function buildSignContent(params) {
  return Object.keys(params)
    .filter((key) => key !== 'sign' && key !== 'sign_type' && params[key] !== undefined)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&')
}

function verifySignature(params) {
  const alipayCfg = getAlipayConfig()
  const { sign } = params
  if (!sign || !alipayCfg.alipayPublicKey) {
    return false
  }
  const content = buildSignContent(params)
  try {
    const verifier = crypto.createVerify('RSA-SHA256')
    verifier.update(content, 'utf8')
    verifier.end()
    return verifier.verify(alipayCfg.alipayPublicKey, sign, 'base64')
  } catch (error) {
    logger.warn(`⚠️ Alipay verify error: ${error.message}`)
    return false
  }
}

function parseNotify(body = {}) {
  const outTradeNo = body.out_trade_no
  const tradeNo = body.trade_no
  const tradeStatus = body.trade_status
  return { orderId: outTradeNo, transactionId: tradeNo, tradeStatus }
}

function signParams(params, privateKey) {
  const content = buildSignContent(params)
  const signer = crypto.createSign('RSA-SHA256')
  signer.update(content, 'utf8')
  signer.end()
  return signer.sign(privateKey, 'base64')
}

function buildPagePayParams(order, method = 'web') {
  const cfg = getAlipayConfig()
  if (!cfg.appId || !cfg.privateKey) {
    throw new Error('Alipay config missing appId/privateKey')
  }
  const apiMethod =
    method === 'h5' || method === 'wap' ? 'alipay.trade.wap.pay' : 'alipay.trade.page.pay'
  const productCode =
    apiMethod === 'alipay.trade.wap.pay' ? 'QUICK_WAP_WAY' : 'FAST_INSTANT_TRADE_PAY'
  const notifyUrl = cfg.notifyUrl || ''
  if (!notifyUrl) {
    throw new Error('Alipay notifyUrl is required')
  }
  const bizContent = {
    out_trade_no: order.id,
    product_code: productCode,
    total_amount: formatAmount(order.amount),
    subject: order.planName || order.id
  }
  const params = {
    app_id: cfg.appId,
    method: apiMethod,
    format: 'JSON',
    charset: cfg.charset || 'utf-8',
    sign_type: cfg.signType || 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: cfg.version || '1.0',
    notify_url: notifyUrl,
    return_url: cfg.returnUrl || '',
    biz_content: JSON.stringify(bizContent)
  }
  const privateKey = normalizeKey(cfg.privateKey)
  const sign = signParams(params, privateKey)
  return { params, sign }
}

function buildPaymentUrl(params, sign) {
  const cfg = getAlipayConfig()
  const gateway = cfg.isSandbox ? cfg.sandboxGateway : cfg.gateway
  const query = new URLSearchParams({ ...params, sign }).toString()
  return `${gateway}?${query}`
}

function resolveGateway() {
  const cfg = getAlipayConfig()
  return cfg.isSandbox ? cfg.sandboxGateway : cfg.gateway
}

function buildCommonParams(method) {
  const cfg = getAlipayConfig()
  if (!cfg.appId || !cfg.privateKey) {
    throw new Error('Alipay config missing appId/privateKey')
  }
  return {
    app_id: cfg.appId,
    method,
    format: 'JSON',
    charset: cfg.charset || 'utf-8',
    sign_type: cfg.signType || 'RSA2',
    timestamp: formatTimestamp(new Date()),
    version: cfg.version || '1.0'
  }
}

async function callAlipayApi(method, bizContent) {
  const params = {
    ...buildCommonParams(method),
    biz_content: JSON.stringify(bizContent || {})
  }
  const privateKey = normalizeKey(getAlipayConfig().privateKey)
  const sign = signParams(params, privateKey)
  const payload = new URLSearchParams({ ...params, sign }).toString()
  try {
    const resp = await axios.post(resolveGateway(), payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 30000
    })
    return resp.data || {}
  } catch (error) {
    const msg = error.response?.data?.error_response?.sub_msg || error.message
    logger.error('Alipay API call failed', { method, error: msg })
    throw new Error(msg || 'Alipay API request failed')
  }
}

function mapTradeStatus(tradeStatus) {
  const status = (tradeStatus || '').toUpperCase()
  if (status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED') {
    return 'paid'
  }
  if (status === 'WAIT_BUYER_PAY') {
    return 'pending'
  }
  if (status === 'TRADE_CLOSED') {
    return 'cancelled'
  }
  return 'failed'
}

async function createPayment(order, method = 'web') {
  const { params, sign } = buildPagePayParams(order, method)
  return {
    paymentUrl: buildPaymentUrl(params, sign),
    method,
    provider: 'alipay'
  }
}

async function handleNotify(body = {}) {
  const valid = verifySignature(body)
  const parsed = parseNotify(body)
  const success = ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(parsed.tradeStatus)
  return { valid, success, ...parsed }
}

async function queryOrder(orderId) {
  const data = await callAlipayApi('alipay.trade.query', { out_trade_no: orderId })
  const response = data.alipay_trade_query_response || {}
  if (response.code && response.code !== '10000') {
    throw new Error(response.sub_msg || response.msg || 'Alipay trade query failed')
  }
  const tradeStatus = response.trade_status
  return {
    orderId: response.out_trade_no || orderId,
    transactionId: response.trade_no || null,
    tradeStatus,
    status: mapTradeStatus(tradeStatus),
    raw: response
  }
}

async function refundOrder(order, refundAmount, reason = '') {
  const amount = refundAmount || order.amount
  const data = await callAlipayApi('alipay.trade.refund', {
    out_trade_no: order.id,
    refund_amount: formatAmount(amount),
    refund_reason: reason || undefined
  })
  const response = data.alipay_trade_refund_response || {}
  if (response.code && response.code !== '10000') {
    throw new Error(response.sub_msg || response.msg || 'Alipay refund failed')
  }
  return {
    orderId: response.out_trade_no || order.id,
    transactionId: response.trade_no || null,
    refundId: response.out_request_no || null,
    status: 'refunded',
    raw: response
  }
}

module.exports = {
  createPayment,
  handleNotify,
  queryOrder,
  refundOrder,
  mapTradeStatus
}
