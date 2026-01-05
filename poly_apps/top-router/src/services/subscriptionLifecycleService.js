'use strict'

const subscriptionService = require('./subscriptionService')
const userService = require('./userService')
const logger = require('../utils/logger')
const config = require('../../config/config')

const DEFAULT_INTERVAL_MINUTES = 10

class SubscriptionLifecycleService {
  constructor() {
    this.timer = null
    this.running = false
  }

  _isEnabled() {
    return config.subscription?.lifecycleEnabled === true
  }

  _getIntervalMs() {
    const minutes = parseInt(config.subscription?.lifecycleIntervalMinutes, 10)
    const normalized = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_INTERVAL_MINUTES
    return normalized * 60 * 1000
  }

  start() {
    if (!this._isEnabled()) {
      logger.info('🔔 Subscription lifecycle service disabled')
      return
    }
    if (this.timer) {
      return
    }
    const intervalMs = this._getIntervalMs()
    this.timer = setInterval(() => {
      this.runOnce().catch((error) => {
        logger.error('❌ Subscription lifecycle task failed:', error)
      })
    }, intervalMs)

    logger.info(
      `🔔 Subscription lifecycle service started (every ${Math.round(intervalMs / 60000)} minutes)`
    )
    this.runOnce().catch((error) => {
      logger.error('❌ Subscription lifecycle initial run failed:', error)
    })
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      logger.info('🔔 Subscription lifecycle service stopped')
    }
  }

  async runOnce() {
    if (this.running) {
      logger.debug('🔔 Subscription lifecycle task already running, skipping')
      return
    }
    this.running = true
    try {
      const expiredOrders = await this._expirePendingOrders()
      const result = await this._processSubscriptions()
      if (expiredOrders > 0 || result.changed > 0) {
        logger.info(
          `🔔 Subscription lifecycle: orders expired ${expiredOrders}, subscriptions changed ${result.changed} (renewed ${result.renewed}, expired ${result.expired}, cancelled ${result.cancelled})`
        )
      }
    } finally {
      this.running = false
    }
  }

  async _expirePendingOrders() {
    const orders = await subscriptionService.listOrders()
    const now = Date.now()
    let expiredCount = 0
    for (const order of orders) {
      if (order.status !== subscriptionService.ORDER_STATUS.PENDING) {
        continue
      }
      if (!order.expiresAt) {
        continue
      }
      const expiresAt = new Date(order.expiresAt).getTime()
      if (Number.isNaN(expiresAt) || expiresAt > now) {
        continue
      }
      await subscriptionService.updateOrderStatus(
        order.id,
        subscriptionService.ORDER_STATUS.EXPIRED
      )
      expiredCount += 1
    }
    return expiredCount
  }

  async _processSubscriptions() {
    const subscriptions = await subscriptionService.listSubscriptions()
    const now = Date.now()
    let expired = 0
    let cancelled = 0
    let renewed = 0

    for (const subscription of subscriptions) {
      if (subscription.status !== 'active') {
        continue
      }

      const expiresAtMs = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : null
      const cancelAtMs = subscription.cancelAt ? new Date(subscription.cancelAt).getTime() : null

      if (cancelAtMs && cancelAtMs <= now) {
        await this._markSubscriptionCancelled(subscription, 'cancel_at')
        cancelled += 1
        continue
      }

      if (subscription.cancelAtPeriodEnd && expiresAtMs && expiresAtMs <= now) {
        await this._markSubscriptionCancelled(subscription, 'cancel_at_period_end')
        cancelled += 1
        continue
      }

      if (expiresAtMs && expiresAtMs <= now) {
        if (subscription.autoRenew === true) {
          await this._renewSubscription(subscription)
          renewed += 1
        } else {
          await this._markSubscriptionExpired(subscription)
          expired += 1
        }
      }
    }

    return {
      changed: expired + cancelled + renewed,
      expired,
      cancelled,
      renewed
    }
  }

  _getCycleDays(subscription) {
    const cycle = String(subscription.billingCycle || subscription.cycle || 'monthly').toLowerCase()
    if (cycle === 'yearly' || cycle === 'annual') {
      return 365
    }
    if (cycle === 'weekly') {
      return 7
    }
    return 30
  }

  async _renewSubscription(subscription) {
    const now = Date.now()
    const base = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : now
    const startAt = Math.max(base, now)
    const cycleDays = this._getCycleDays(subscription)
    const endAt = startAt + cycleDays * 24 * 60 * 60 * 1000
    const updates = {
      currentPeriodStart: new Date(startAt).toISOString(),
      currentPeriodEnd: new Date(endAt).toISOString(),
      expiresAt: new Date(endAt).toISOString(),
      status: 'active',
      renewedAt: new Date().toISOString()
    }
    await subscriptionService.updateSubscription(subscription.id, updates)
  }

  async _markSubscriptionExpired(subscription) {
    const nowIso = new Date().toISOString()
    await subscriptionService.updateSubscription(subscription.id, {
      status: 'expired',
      expiredAt: nowIso,
      updatedAt: nowIso
    })
    await this._clearUserSubscription(subscription.userId, subscription.id)
  }

  async _markSubscriptionCancelled(subscription, reason) {
    const nowIso = new Date().toISOString()
    await subscriptionService.updateSubscription(subscription.id, {
      status: 'cancelled',
      cancelledAt: nowIso,
      cancelReason: reason,
      updatedAt: nowIso
    })
    await this._clearUserSubscription(subscription.userId, subscription.id)
  }

  async _clearUserSubscription(userId, subscriptionId) {
    if (!userId || !subscriptionId) {
      return
    }
    const user = await userService.getUserById(userId, false).catch(() => null)
    if (user && user.subscriptionId === subscriptionId) {
      await userService.updateUserSubscription(userId, null).catch(() => null)
    }
  }
}

const subscriptionLifecycleService = new SubscriptionLifecycleService()

module.exports = subscriptionLifecycleService
