'use strict'

const express = require('express')
const router = express.Router()
const subscriptionService = require('../services/subscriptionService')
const alipayService = require('../services/alipayService')
const wechatPayService = require('../services/wechatPayService')
const paymentService = require('../services/paymentService')
const webhookService = require('../services/webhookService')
const { authenticateUser } = require('../middleware/auth')
const logger = require('../utils/logger')
const { extractPaymentContext, sanitizePaymentPayload } = require('../utils/paymentLogHelper')

async function notifyPaymentFailure(provider, reason, payload, extra = {}) {
  const context = extractPaymentContext(provider, payload)
  const sanitizedPayload = sanitizePaymentPayload(payload)
  const data = {
    ...context,
    reason,
    timestamp: new Date().toISOString(),
    payload: sanitizedPayload,
    ...extra
  }
  try {
    await webhookService.sendNotification('paymentNotifyFailed', data)
  } catch (error) {
    logger.warn(`⚠️ Failed to send payment webhook alert: ${error.message}`)
  }
}

// 列出可用套餐
router.get('/plans', async (_req, res) => {
  const plans = await subscriptionService.getPlans()
  res.json({ success: true, plans })
})

// 创建订单并返回支付信息（占位支付）
router.post('/orders', authenticateUser, async (req, res) => {
  try {
    const { planId, provider = 'alipay', method = 'web' } = req.body || {}
    const { user } = req
    const result = await subscriptionService.createOrder({
      userId: user.id,
      planId,
      provider,
      method,
      clientIp: req.ip,
      openId: req.body?.openId
    })
    res.json({ success: true, order: result.order, payment: result.payment })
  } catch (error) {
    logger.error('❌ Create subscription order failed:', error)
    const status = ['INVALID_PLAN', 'UNSUPPORTED_PROVIDER'].includes(error.code) ? 400 : 500
    res.status(status).json({
      success: false,
      error: error.message || 'Failed to create order'
    })
  }
})

// 支付回调：按 provider 验签后标记支付成功
router.post('/notify/:provider', async (req, res) => {
  try {
    const { provider } = req.params

    if (provider === 'alipay') {
      const payload = req.body || {}
      const notifyResult = await alipayService.handleNotify(payload)
      if (!notifyResult.valid) {
        const context = extractPaymentContext('alipay', payload)
        logger.warn('⚠️ Invalid Alipay signature', {
          ...context,
          payload: sanitizePaymentPayload(payload)
        })
        await notifyPaymentFailure('alipay', 'invalid_signature', payload)
        return res.status(400).json({ success: false, error: 'invalid alipay signature' })
      }
      if (!notifyResult.success) {
        return res.send('success')
      }
      const { orderId, transactionId } = notifyResult
      if (!orderId) {
        await notifyPaymentFailure('alipay', 'missing_order_id', payload)
        return res.status(400).json({ success: false, error: 'orderId required' })
      }
      const result = await subscriptionService.markPaid(orderId, {
        transactionId,
        rawPayload: payload
      })
      if (!result) {
        await notifyPaymentFailure('alipay', 'order_not_found', payload)
        return res.status(404).json({ success: false, error: 'Order not found' })
      }
      return res.send('success')
    }

    if (provider === 'wechat') {
      const notifyResult = await wechatPayService.handleNotify(req)
      const payload = notifyResult.decrypted || req.body || {}
      if (!notifyResult.valid) {
        const context = extractPaymentContext('wechat', payload)
        logger.warn('⚠️ Invalid WeChat signature', {
          ...context,
          payload: sanitizePaymentPayload(payload)
        })
        await notifyPaymentFailure('wechat', 'invalid_signature', payload)
        return res.status(400).json({ success: false, error: 'invalid wechat signature' })
      }
      if (!notifyResult.success) {
        const isV3 = Boolean(req.headers['wechatpay-signature'])
        if (isV3) {
          return res.json({ code: 'SUCCESS', message: 'OK' })
        }
        return res.send('<xml><return_code>SUCCESS</return_code></xml>')
      }
      const { orderId, transactionId } = notifyResult
      if (!orderId) {
        await notifyPaymentFailure('wechat', 'missing_order_id', payload)
        return res.status(400).json({ success: false, error: 'orderId required' })
      }
      const result = await subscriptionService.markPaid(orderId, {
        transactionId,
        rawPayload: payload
      })
      if (!result) {
        await notifyPaymentFailure('wechat', 'order_not_found', payload)
        return res.status(404).json({ success: false, error: 'Order not found' })
      }
      const isV3 = Boolean(req.headers['wechatpay-signature'])
      if (isV3) {
        return res.json({ code: 'SUCCESS', message: 'OK' })
      }
      return res.send('<xml><return_code>SUCCESS</return_code></xml>')
    }

    return res.status(400).json({ success: false, error: 'unsupported provider' })
  } catch (error) {
    logger.error('❌ Payment notify handling failed:', {
      provider: req.params?.provider,
      message: error.message
    })
    await notifyPaymentFailure(
      req.params?.provider || 'unknown',
      'notify_exception',
      req.body || {},
      { error: error.message }
    )
    res.status(500).json({ success: false, error: 'Notify handling failed' })
  }
})

// 查询订单（可选刷新支付状态）
router.get('/orders/:orderId', authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params
    const order = await subscriptionService.getOrder(orderId)
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }

    const refresh = String(req.query.refresh || '').toLowerCase() === 'true'
    let providerStatus = null

    if (refresh && order.status !== subscriptionService.ORDER_STATUS.PAID) {
      if (order.provider === 'alipay') {
        providerStatus = await alipayService.queryOrder(orderId)
      } else if (order.provider === 'wechat') {
        providerStatus = await wechatPayService.queryOrder(orderId)
      }

      if (providerStatus?.status === 'paid') {
        await subscriptionService.markPaid(orderId, {
          transactionId: providerStatus.transactionId,
          rawPayload: providerStatus.raw
        })
      } else if (providerStatus?.status === 'refunded') {
        await subscriptionService.markRefunded(orderId, {
          transactionId: providerStatus.transactionId,
          rawPayload: providerStatus.raw
        })
      } else if (providerStatus?.status) {
        await subscriptionService.updateOrderStatus(orderId, providerStatus.status)
      }
    }

    const latestOrder = await subscriptionService.getOrder(orderId)
    const payment = await paymentService.findLatestPaymentForOrder(orderId)
    res.json({ success: true, order: latestOrder, payment, providerStatus })
  } catch (error) {
    logger.error('❌ Query order failed:', error)
    res.status(500).json({ success: false, error: 'Failed to query order' })
  }
})

// 退款
router.post('/orders/:orderId/refund', authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params
    const order = await subscriptionService.getOrder(orderId)
    if (!order || order.userId !== req.user.id) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }
    if (order.status !== subscriptionService.ORDER_STATUS.PAID) {
      return res.status(400).json({ success: false, error: 'Order is not paid' })
    }

    const { amount, reason } = req.body || {}
    let refundResult = null

    if (order.provider === 'alipay') {
      refundResult = await alipayService.refundOrder(order, amount, reason)
    } else if (order.provider === 'wechat') {
      refundResult = await wechatPayService.refundOrder(order, amount, reason)
    } else {
      return res.status(400).json({ success: false, error: 'unsupported provider' })
    }

    if (refundResult?.status === 'refunded') {
      await subscriptionService.markRefunded(orderId, {
        transactionId: refundResult.transactionId,
        rawPayload: refundResult.raw
      })
    }

    const latestOrder = await subscriptionService.getOrder(orderId)
    res.json({ success: true, order: latestOrder, refund: refundResult })
  } catch (error) {
    logger.error('❌ Refund order failed:', error)
    res.status(500).json({ success: false, error: error.message || 'Refund failed' })
  }
})

// 用户订单列表
router.get('/orders', authenticateUser, async (req, res) => {
  try {
    const orders = await subscriptionService.getUserOrders(req.user.id)
    res.json({ success: true, orders })
  } catch (error) {
    logger.error('❌ List orders failed:', error)
    res.status(500).json({ success: false, error: 'Failed to list orders' })
  }
})

module.exports = router
