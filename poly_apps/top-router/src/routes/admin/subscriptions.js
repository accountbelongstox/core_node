'use strict'

const express = require('express')
const router = express.Router()
const { authenticateAdmin } = require('../../middleware/auth')
const subscriptionService = require('../../services/subscriptionService')
const paymentService = require('../../services/paymentService')
const alipayService = require('../../services/alipayService')
const wechatPayService = require('../../services/wechatPayService')
const logger = require('../../utils/logger')

// Plans
router.get('/subscriptions/plans', authenticateAdmin, async (_req, res) => {
  const plans = await subscriptionService.getPlans()
  res.json({ success: true, plans })
})

router.post('/subscriptions/plans', authenticateAdmin, async (req, res) => {
  try {
    const plan = await subscriptionService.addPlan(req.body || {})
    res.json({ success: true, plan })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.put('/subscriptions/plans/:planId', authenticateAdmin, async (req, res) => {
  try {
    const plan = await subscriptionService.updatePlan(req.params.planId, req.body || {})
    if (!plan) {
      return res.status(404).json({ success: false, error: 'Plan not found' })
    }
    res.json({ success: true, plan })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.delete('/subscriptions/plans/:planId', authenticateAdmin, async (req, res) => {
  try {
    const plans = await subscriptionService.deletePlan(req.params.planId)
    res.json({ success: true, plans })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})

// Orders
router.get('/subscriptions/orders', authenticateAdmin, async (req, res) => {
  try {
    const orders = await subscriptionService.listOrders()
    const { userId, status } = req.query || {}
    const filtered = orders.filter((order) => {
      if (userId && order.userId !== userId) {
        return false
      }
      if (status && order.status !== status) {
        return false
      }
      return true
    })
    res.json({ success: true, orders: filtered })
  } catch (error) {
    logger.error('Failed to list orders:', error)
    res.status(500).json({ success: false, error: 'Failed to list orders' })
  }
})

router.get('/subscriptions/orders/:orderId', authenticateAdmin, async (req, res) => {
  try {
    const order = await subscriptionService.getOrder(req.params.orderId)
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
    }
    const payment = await paymentService.findLatestPaymentForOrder(req.params.orderId)
    res.json({ success: true, order, payment })
  } catch (error) {
    logger.error('Failed to get order:', error)
    res.status(500).json({ success: false, error: 'Failed to get order' })
  }
})

router.post('/subscriptions/orders/:orderId/refund', authenticateAdmin, async (req, res) => {
  try {
    const order = await subscriptionService.getOrder(req.params.orderId)
    if (!order) {
      return res.status(404).json({ success: false, error: 'Order not found' })
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
      await subscriptionService.markRefunded(order.id, {
        transactionId: refundResult.transactionId,
        rawPayload: refundResult.raw
      })
    }
    const latest = await subscriptionService.getOrder(order.id)
    res.json({ success: true, order: latest, refund: refundResult })
  } catch (error) {
    logger.error('Failed to refund order:', error)
    res.status(500).json({ success: false, error: error.message || 'Refund failed' })
  }
})

// Subscriptions
router.get('/subscriptions', authenticateAdmin, async (_req, res) => {
  try {
    const subscriptions = await subscriptionService.listSubscriptions()
    res.json({ success: true, subscriptions })
  } catch (error) {
    logger.error('Failed to list subscriptions:', error)
    res.status(500).json({ success: false, error: 'Failed to list subscriptions' })
  }
})

router.get('/subscriptions/:subscriptionId', authenticateAdmin, async (req, res) => {
  try {
    const subscription = await subscriptionService.getSubscription(req.params.subscriptionId)
    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' })
    }
    res.json({ success: true, subscription })
  } catch (error) {
    logger.error('Failed to get subscription:', error)
    res.status(500).json({ success: false, error: 'Failed to get subscription' })
  }
})

router.put('/subscriptions/:subscriptionId', authenticateAdmin, async (req, res) => {
  try {
    const updated = await subscriptionService.updateSubscription(
      req.params.subscriptionId,
      req.body || {}
    )
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Subscription not found' })
    }
    res.json({ success: true, subscription: updated })
  } catch (error) {
    logger.error('Failed to update subscription:', error)
    res.status(500).json({ success: false, error: 'Failed to update subscription' })
  }
})

module.exports = router
