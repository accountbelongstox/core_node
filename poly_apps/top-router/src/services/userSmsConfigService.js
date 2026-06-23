'use strict'

const config = require('../../config/config')
const datastore = require('../models/datastore')
const smsService = require('./smsService')
const logger = require('../utils/logger')

const DEFAULT_NOTIFICATION_PREFERENCES = {
  quotaWarning: true,
  subscriptionExpiring: true,
  apiKeyExpiring: true,
  securityAlert: true,
  dailySummary: false
}

class UserSmsConfigService {
  constructor() {
    this.configKeyPrefix = 'user:sms:config:'
    this.verificationKeyPrefix = 'user:sms:verification:'
    this.quotaWarningKeyPrefix = 'user:sms:quota-warning:'
    this.verificationCodeTtlSeconds = 5 * 60
    this.verificationCooldownSeconds = 60
    this.verificationAttemptLimit = 5
    this.quotaWarningCooldownSeconds = 6 * 3600
  }

  async getUserSmsConfig(userId) {
    const key = this._configKey(userId)
    const cached = await datastore.get(key)
    if (!cached) {
      const fresh = this._buildDefaultConfig(userId)
      await this._persistConfig(userId, fresh)
      return fresh
    }

    try {
      const parsed = JSON.parse(cached)
      return this._normalizeConfig(userId, parsed)
    } catch (error) {
      logger.warn(`⚠️ Failed to parse SMS config for user ${userId}: ${error.message}`)
      const fallback = this._buildDefaultConfig(userId)
      await this._persistConfig(userId, fallback)
      return fallback
    }
  }

  async sendVerificationCode(userId, rawPhoneNumber) {
    if (!config.sms?.enabled) {
      return { success: false, error: 'SMS service is not enabled' }
    }

    const phoneNumber = rawPhoneNumber?.trim()
    const validation = smsService.validatePhoneNumber(phoneNumber)
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid phone number' }
    }

    const smsConfig = await this.getUserSmsConfig(userId)
    if (smsConfig.phoneVerified && smsConfig.phoneNumber === phoneNumber) {
      return { success: false, error: 'Phone number already verified' }
    }

    const verificationState = await this._getVerificationState(userId)
    if (
      verificationState &&
      Date.now() - verificationState.sentAt < this.verificationCooldownSeconds * 1000
    ) {
      const retryAfter =
        this.verificationCooldownSeconds -
        Math.floor((Date.now() - verificationState.sentAt) / 1000)
      return {
        success: false,
        error: 'Verification code sent too frequently',
        retryAfter: Math.max(1, retryAfter)
      }
    }

    const code = this._generateVerificationCode()
    const sendResult = await smsService.sendVerificationCode(phoneNumber, userId, code)
    if (!sendResult.success) {
      return {
        success: false,
        error: sendResult.error || 'Failed to send verification code'
      }
    }

    const state = {
      phoneNumber,
      code,
      attempts: 0,
      sentAt: Date.now(),
      expiresAt: Date.now() + this.verificationCodeTtlSeconds * 1000
    }
    await this._saveVerificationState(userId, state)

    return {
      success: true,
      expiresIn: this.verificationCodeTtlSeconds
    }
  }

  async bindPhoneNumber(userId, rawPhoneNumber, verificationCode) {
    if (!config.sms?.enabled) {
      return { success: false, error: 'SMS service is not enabled' }
    }

    const phoneNumber = rawPhoneNumber?.trim()
    const validation = smsService.validatePhoneNumber(phoneNumber)
    if (!validation.valid) {
      return { success: false, error: validation.error || 'Invalid phone number' }
    }

    const state = await this._getVerificationState(userId)
    if (!state || Date.now() > state.expiresAt) {
      await this._clearVerificationState(userId)
      return { success: false, error: 'Verification code expired, please request a new one' }
    }

    if (state.phoneNumber !== phoneNumber) {
      return { success: false, error: 'Phone number mismatch, please request a new code' }
    }

    if (state.code !== verificationCode) {
      const attempts = state.attempts + 1
      if (attempts >= this.verificationAttemptLimit) {
        await this._clearVerificationState(userId)
        return { success: false, error: 'Too many incorrect attempts, please request a new code' }
      }
      await this._saveVerificationState(userId, { ...state, attempts })
      return { success: false, error: 'Invalid verification code' }
    }

    const smsConfig = await this.getUserSmsConfig(userId)
    const updatedConfig = {
      ...smsConfig,
      phoneNumber,
      phoneVerified: true,
      updatedAt: new Date().toISOString()
    }

    await this._persistConfig(userId, updatedConfig)
    await this._clearVerificationState(userId)

    return { success: true, config: updatedConfig }
  }

  async unbindPhoneNumber(userId) {
    if (!config.sms?.enabled) {
      return { success: false, error: 'SMS service is not enabled' }
    }

    const smsConfig = await this.getUserSmsConfig(userId)
    if (!smsConfig.phoneNumber) {
      return { success: false, error: 'No phone number bound to this account' }
    }

    const updatedConfig = {
      ...smsConfig,
      phoneNumber: null,
      phoneVerified: false,
      updatedAt: new Date().toISOString()
    }

    await this._persistConfig(userId, updatedConfig)
    await this._clearVerificationState(userId)

    return { success: true, config: updatedConfig }
  }

  async updateNotificationPreferences(userId, preferences) {
    if (!config.sms?.enabled) {
      return { success: false, error: 'SMS service is not enabled' }
    }

    const normalized = this._normalizePreferences(preferences)
    if (!normalized) {
      return { success: false, error: 'Invalid notification preferences' }
    }

    const smsConfig = await this.getUserSmsConfig(userId)
    const updatedConfig = {
      ...smsConfig,
      notificationPreferences: {
        ...smsConfig.notificationPreferences,
        ...normalized
      },
      updatedAt: new Date().toISOString()
    }

    await this._persistConfig(userId, updatedConfig)

    return {
      success: true,
      preferences: updatedConfig.notificationPreferences
    }
  }

  async sendQuotaWarningNotification(userId, quotaInfo) {
    if (!config.sms?.enabled) {
      return { success: false }
    }

    const smsConfig = await this.getUserSmsConfig(userId)
    if (!smsConfig.phoneNumber || !smsConfig.phoneVerified) {
      return { success: false }
    }

    if (!smsConfig.notificationPreferences.quotaWarning) {
      return { success: true }
    }

    const quotaType = quotaInfo?.quotaType || 'default'
    const quotaLevel = quotaInfo?.percentage || 0
    const cooldownKey = this._quotaWarningKey(userId, quotaType, quotaLevel)
    const recentlySent = await datastore.get(cooldownKey)
    if (recentlySent) {
      return { success: true }
    }

    const sendResult = await smsService.sendQuotaWarning(
      smsConfig.phoneNumber,
      userId,
      quotaInfo || {}
    )

    if (sendResult.success) {
      await datastore.set(
        cooldownKey,
        new Date().toISOString(),
        'EX',
        this.quotaWarningCooldownSeconds
      )
      return { success: true }
    }

    logger.warn(
      `⚠️ Failed to send quota warning SMS to user ${userId}: ${sendResult.error || 'unknown error'}`
    )
    return { success: false }
  }

  _configKey(userId) {
    return `${this.configKeyPrefix}${userId}`
  }

  _verificationKey(userId) {
    return `${this.verificationKeyPrefix}${userId}`
  }

  _quotaWarningKey(userId, quotaType, quotaLevel) {
    return `${this.quotaWarningKeyPrefix}${userId}:${quotaType}:${quotaLevel}`
  }

  _buildDefaultConfig(userId) {
    const now = new Date().toISOString()
    return {
      userId,
      phoneNumber: null,
      phoneVerified: false,
      notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
      createdAt: now,
      updatedAt: now
    }
  }

  _normalizeConfig(userId, raw) {
    if (!raw) {
      return this._buildDefaultConfig(userId)
    }
    const base = this._buildDefaultConfig(userId)
    return {
      userId,
      phoneNumber: raw.phoneNumber || base.phoneNumber,
      phoneVerified: Boolean(raw.phoneVerified),
      notificationPreferences:
        this._normalizePreferences(raw.notificationPreferences) || base.notificationPreferences,
      createdAt: raw.createdAt || base.createdAt,
      updatedAt: raw.updatedAt || base.updatedAt
    }
  }

  _normalizePreferences(preferences) {
    if (!preferences || typeof preferences !== 'object') {
      return null
    }

    const normalized = { ...DEFAULT_NOTIFICATION_PREFERENCES }
    for (const key of Object.keys(DEFAULT_NOTIFICATION_PREFERENCES)) {
      if (key in preferences) {
        normalized[key] = Boolean(preferences[key])
      }
    }
    return normalized
  }

  _generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  async _persistConfig(userId, configRecord) {
    await datastore.set(this._configKey(userId), JSON.stringify(configRecord))
  }

  async _getVerificationState(userId) {
    const cached = await datastore.get(this._verificationKey(userId))
    if (!cached) {
      return null
    }
    try {
      return JSON.parse(cached)
    } catch (error) {
      logger.warn(`⚠️ Failed to parse verification state for user ${userId}: ${error.message}`)
      await this._clearVerificationState(userId)
      return null
    }
  }

  async _saveVerificationState(userId, state) {
    const ttlSeconds = Math.max(1, Math.floor((state.expiresAt - Date.now()) / 1000))
    await datastore.set(this._verificationKey(userId), JSON.stringify(state), 'EX', ttlSeconds)
  }

  async _clearVerificationState(userId) {
    await datastore.del(this._verificationKey(userId))
  }
}

const userSmsConfigService = new UserSmsConfigService()

module.exports = userSmsConfigService
module.exports.default = userSmsConfigService
