'use strict'

const config = require('../../config/config')
const datastore = require('../models/datastore')
const logger = require('../utils/logger')

const DEFAULT_RATE_LIMIT = {
  perMinute: 1,
  perHour: 2,
  perDay: 5,
  minInterval: 60
}

class SmsService {
  constructor() {
    this.enabled = config.sms?.enabled === true
    this.provider = config.sms?.provider || 'aliyun'
    this.testMode = config.sms?.testMode === true
    this.smsLogPrefix = 'sms_log:'
    this.rateLimitPrefix = 'sms_rate_limit:'
    this.client = null
    this.initializationPromise = null

    if (this.enabled && !this.testMode) {
      this.initializationPromise = this._initializeClient()
    }
  }

  sanitizeTemplateParams(templateType, params) {
    if (!params || typeof params !== 'object') {
      return params
    }

    const sanitized = { ...params }
    const sensitiveKeys = new Set([
      'code',
      'verificationCode',
      'verification_code',
      'otp',
      'smsCode'
    ])

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.has(key)) {
        sanitized[key] = '******'
      }
    }

    if (templateType === 'verificationCode') {
      for (const key of Object.keys(sanitized)) {
        sanitized[key] = '******'
      }
    }

    return sanitized
  }

  getRetryConfig() {
    const retryConfig = config.sms?.retry || {}
    const maxRetries = Number.isFinite(retryConfig.maxRetries)
      ? retryConfig.maxRetries
      : parseInt(retryConfig.maxRetries, 10) || 0
    const delaySeconds = Number.isFinite(retryConfig.delaySeconds)
      ? retryConfig.delaySeconds
      : parseInt(retryConfig.delaySeconds, 10) || 60

    return {
      enabled: retryConfig.enabled === true,
      maxRetries: Math.max(0, maxRetries),
      delaySeconds: Math.max(0, delaySeconds)
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  isRetryableError(result) {
    if (!result || result.success) {
      return false
    }

    const retryableCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      'EAI_AGAIN',
      'ENOTFOUND',
      'ESOCKETTIMEDOUT'
    ]

    if (result.errorCode && retryableCodes.includes(result.errorCode)) {
      return true
    }

    const message = String(result.error || '').toLowerCase()
    return (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('socket hang up') ||
      retryableCodes.some((code) => message.includes(code.toLowerCase()))
    )
  }

  async ensureInitialized() {
    if (!this.initializationPromise) {
      return
    }

    try {
      await this.initializationPromise
    } finally {
      this.initializationPromise = null
    }
  }

  async _initializeClient() {
    try {
      if (this.provider === 'aliyun') {
        const CoreModule = require('@alicloud/pop-core')
        const Core = CoreModule.default || CoreModule
        const aliyunConfig = config.sms?.aliyun || {}
        if (!aliyunConfig.accessKeyId || !aliyunConfig.accessKeySecret) {
          logger.warn('⚠️ Aliyun SMS credentials not configured, SMS service disabled')
          this.enabled = false
          return
        }
        this.client = new Core({
          accessKeyId: aliyunConfig.accessKeyId,
          accessKeySecret: aliyunConfig.accessKeySecret,
          endpoint: 'https://dysmsapi.aliyuncs.com',
          apiVersion: '2017-05-25'
        })
        logger.info('✅ Aliyun SMS client initialized')
      } else if (this.provider === 'tencent') {
        const tencentModule = require('tencentcloud-sdk-nodejs')
        const tencentcloud = tencentModule.default || tencentModule
        const SmsClient = tencentcloud.sms.v20210111.Client
        const tencentConfig = config.sms?.tencent || {}
        if (!tencentConfig.secretId || !tencentConfig.secretKey) {
          logger.warn('⚠️ Tencent SMS credentials not configured, SMS service disabled')
          this.enabled = false
          return
        }
        this.client = new SmsClient({
          credential: {
            secretId: tencentConfig.secretId,
            secretKey: tencentConfig.secretKey
          },
          region: 'ap-guangzhou',
          profile: {
            httpProfile: {
              endpoint: 'sms.tencentcloudapi.com'
            }
          }
        })
        logger.info('✅ Tencent SMS client initialized')
      } else {
        logger.warn(`⚠️ Unsupported SMS provider: ${this.provider}, SMS service disabled`)
        this.enabled = false
      }
    } catch (error) {
      logger.error('❌ Failed to initialize SMS client:', error)
      this.enabled = false
    }
  }

  validatePhoneNumber(phoneNumber) {
    if (!phoneNumber) {
      return { valid: false, error: '手机号不能为空' }
    }
    const phoneRegex = /^1[3-9]\d{9}$/
    if (!phoneRegex.test(phoneNumber)) {
      return { valid: false, error: '手机号格式不正确' }
    }
    return { valid: true }
  }

  maskPhoneNumber(phoneNumber) {
    if (!phoneNumber || phoneNumber.length < 11) {
      return phoneNumber
    }
    return `${phoneNumber.substring(0, 3)}****${phoneNumber.substring(7)}`
  }

  async checkRateLimit(phoneNumber) {
    try {
      const now = Date.now()
      const rateLimitConfig = config.sms?.rateLimit || DEFAULT_RATE_LIMIT

      const lastSendKey = `${this.rateLimitPrefix}last:${phoneNumber}`
      const lastSendTime = await datastore.get(lastSendKey)
      if (lastSendTime) {
        const elapsed = Math.floor((now - parseInt(lastSendTime, 10)) / 1000)
        if (elapsed < rateLimitConfig.minInterval) {
          return {
            allowed: false,
            error: `发送过于频繁，请在 ${rateLimitConfig.minInterval - elapsed} 秒后重试`,
            retryAfter: rateLimitConfig.minInterval - elapsed
          }
        }
      }

      const perMinuteKey = `${this.rateLimitPrefix}minute:${phoneNumber}:${Math.floor(now / 60000)}`
      const minuteCount = parseInt((await datastore.get(perMinuteKey)) || '0', 10)
      if (minuteCount >= rateLimitConfig.perMinute) {
        return {
          allowed: false,
          error: '发送过于频繁，请稍后再试',
          retryAfter: 60
        }
      }

      const perHourKey = `${this.rateLimitPrefix}hour:${phoneNumber}:${Math.floor(now / 3600000)}`
      const hourCount = parseInt((await datastore.get(perHourKey)) || '0', 10)
      if (hourCount >= rateLimitConfig.perHour) {
        return {
          allowed: false,
          error: '今日发送次数过多，请明天再试',
          retryAfter: 3600
        }
      }

      const today = new Date().toISOString().split('T')[0]
      const perDayKey = `${this.rateLimitPrefix}day:${phoneNumber}:${today}`
      const dayCount = parseInt((await datastore.get(perDayKey)) || '0', 10)
      if (dayCount >= rateLimitConfig.perDay) {
        return {
          allowed: false,
          error: '今日发送次数已达上限',
          retryAfter: 86400
        }
      }

      return { allowed: true }
    } catch (error) {
      logger.error('❌ Error checking SMS rate limit:', error)
      return { allowed: true }
    }
  }

  async updateRateLimit(phoneNumber) {
    try {
      const now = Date.now()

      const lastSendKey = `${this.rateLimitPrefix}last:${phoneNumber}`
      await datastore.set(lastSendKey, now.toString())
      await datastore.expire(lastSendKey, 3600)

      const perMinuteKey = `${this.rateLimitPrefix}minute:${phoneNumber}:${Math.floor(now / 60000)}`
      await datastore.incr(perMinuteKey)
      await datastore.expire(perMinuteKey, 60)

      const perHourKey = `${this.rateLimitPrefix}hour:${phoneNumber}:${Math.floor(now / 3600000)}`
      await datastore.incr(perHourKey)
      await datastore.expire(perHourKey, 3600)

      const today = new Date().toISOString().split('T')[0]
      const perDayKey = `${this.rateLimitPrefix}day:${phoneNumber}:${today}`
      await datastore.incr(perDayKey)
      await datastore.expire(perDayKey, 86400)
    } catch (error) {
      logger.error('❌ Error updating SMS rate limit:', error)
    }
  }

  async logSmsSend(phoneNumber, userId, templateType, params, result) {
    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        phoneNumber: this.maskPhoneNumber(phoneNumber),
        userId,
        templateType,
        params: this.sanitizeTemplateParams(templateType, params),
        provider: this.provider,
        testMode: this.testMode,
        success: result.success,
        error: result.error || null,
        errorCode: result.errorCode || null,
        attempts: result.attempts || 1,
        retryEnabled: result.retryEnabled === true,
        retryable: result.retryable === true,
        messageId: result.messageId || null
      }

      const logKey = `${this.smsLogPrefix}${userId || phoneNumber}:${Date.now()}`
      await datastore.set(logKey, JSON.stringify(logEntry))
      await datastore.expire(logKey, 7 * 86400)

      if (result.success) {
        logger.info(
          `📱 SMS sent successfully: ${this.maskPhoneNumber(phoneNumber)} - ${templateType}${
            this.testMode ? ' (TEST MODE)' : ''
          }`
        )
      } else {
        logger.error(
          `❌ SMS send failed: ${this.maskPhoneNumber(phoneNumber)} - ${templateType}`,
          result.error
        )
      }
    } catch (error) {
      logger.error('❌ Error logging SMS:', error)
    }
  }

  async sendSms(phoneNumber, userId, templateType, templateParams) {
    if (!this.enabled) {
      return { success: false, error: 'SMS service is not enabled' }
    }

    await this.ensureInitialized()

    const rateLimitCheck = await this.checkRateLimit(phoneNumber)
    if (!rateLimitCheck.allowed) {
      return {
        success: false,
        error: rateLimitCheck.error,
        retryAfter: rateLimitCheck.retryAfter
      }
    }

    const templateCode = config.sms?.templates?.[templateType]
    if (!templateCode) {
      return {
        success: false,
        error: `Unknown template type: ${templateType}`
      }
    }

    const retryConfig = this.getRetryConfig()
    const maxAttempts = retryConfig.enabled ? Math.max(1, retryConfig.maxRetries + 1) : 1
    let result = null
    let attempts = 0

    while (attempts < maxAttempts) {
      attempts += 1
      result = await this._sendSmsOnce(phoneNumber, templateType, templateCode, templateParams)

      if (result.success) {
        break
      }

      const retryable = retryConfig.enabled && this.isRetryableError(result)
      if (!retryable || attempts >= maxAttempts) {
        break
      }

      await this.sleep(retryConfig.delaySeconds * 1000)
    }

    result.attempts = attempts
    result.retryEnabled = retryConfig.enabled
    result.retryable = !result.success && this.isRetryableError(result)

    if (result.success) {
      await this.updateRateLimit(phoneNumber)
    }

    await this.logSmsSend(phoneNumber, userId, templateType, templateParams, result)
    return result
  }

  async _sendSmsOnce(phoneNumber, templateType, templateCode, templateParams) {
    if (this.testMode || !this.client) {
      logger.info(
        `📱 [TEST MODE] Would send SMS to ${this.maskPhoneNumber(phoneNumber)}: ${templateType}`,
        this.sanitizeTemplateParams(templateType, templateParams)
      )
      return {
        success: true,
        messageId: `test_${Date.now()}`,
        testMode: true
      }
    }

    if (this.provider === 'aliyun') {
      return this._sendAliyunSms(phoneNumber, templateCode, templateParams)
    }

    if (this.provider === 'tencent') {
      return this._sendTencentSms(phoneNumber, templateCode, templateParams)
    }

    return {
      success: false,
      error: `Unsupported provider: ${this.provider}`,
      errorCode: 'UNSUPPORTED_PROVIDER'
    }
  }

  async _sendAliyunSms(phoneNumber, templateCode, templateParams) {
    try {
      const aliyunConfig = config.sms?.aliyun || {}
      const params = {
        RegionId: aliyunConfig.regionId,
        PhoneNumbers: phoneNumber,
        SignName: aliyunConfig.signName,
        TemplateCode: templateCode,
        TemplateParam: JSON.stringify(templateParams)
      }

      const requestOption = {
        method: 'POST'
      }

      const response = await this.client.request('SendSms', params, requestOption)

      if (response.Code === 'OK') {
        return {
          success: true,
          messageId: response.BizId
        }
      }

      return {
        success: false,
        error: response.Message || 'Unknown error',
        errorCode: response.Code || null
      }
    } catch (error) {
      logger.error('❌ Aliyun SMS send failed:', error)
      return {
        success: false,
        error: error.message,
        errorCode: error.code || null
      }
    }
  }

  async _sendTencentSms(phoneNumber, templateCode, templateParams) {
    try {
      const tencentConfig = config.sms?.tencent || {}
      const params = {
        PhoneNumberSet: [`+86${phoneNumber}`],
        TemplateId: templateCode,
        SmsSdkAppId: tencentConfig.sdkAppId,
        SignName: tencentConfig.signName,
        TemplateParamSet: Object.values(templateParams || {}).map((value) => String(value))
      }

      const response = await this.client.SendSms(params)
      if (response.SendStatusSet?.[0]?.Code === 'Ok') {
        return {
          success: true,
          messageId: response.SendStatusSet[0].SerialNo
        }
      }

      return {
        success: false,
        error: response.SendStatusSet?.[0]?.Message || 'Unknown error',
        errorCode: response.SendStatusSet?.[0]?.Code || null
      }
    } catch (error) {
      logger.error('❌ Tencent SMS send failed:', error)
      return {
        success: false,
        error: error.message,
        errorCode: error.code || null
      }
    }
  }

  async sendVerificationCode(phoneNumber, userId, code) {
    return this.sendSms(phoneNumber, userId, 'verificationCode', { code })
  }

  async sendQuotaWarning(phoneNumber, userId, quotaInfo) {
    const { percentage, planName, quotaType, resetTime } = quotaInfo
    return this.sendSms(phoneNumber, userId, 'quotaWarning', {
      percentage: percentage.toString(),
      planName,
      quotaType,
      resetTime
    })
  }

  async sendSubscriptionExpiring(phoneNumber, userId, expiryInfo) {
    const { daysLeft, planName, expiryDate } = expiryInfo
    return this.sendSms(phoneNumber, userId, 'subscriptionExpiring', {
      daysLeft: daysLeft.toString(),
      planName,
      expiryDate
    })
  }

  async sendApiKeyExpiring(phoneNumber, userId, keyInfo) {
    const { keyName, daysLeft, expiryDate } = keyInfo
    return this.sendSms(phoneNumber, userId, 'apiKeyExpiring', {
      keyName,
      daysLeft: daysLeft.toString(),
      expiryDate
    })
  }

  async sendSecurityAlert(phoneNumber, userId, alertInfo) {
    const { alertType, ipAddress, timestamp } = alertInfo
    return this.sendSms(phoneNumber, userId, 'securityAlert', {
      alertType,
      ipAddress,
      timestamp
    })
  }

  async sendDailySummary(phoneNumber, userId, summaryInfo) {
    const { requests, cost, quotaUsage } = summaryInfo
    return this.sendSms(phoneNumber, userId, 'dailySummary', {
      requests: requests.toString(),
      cost: cost.toFixed(2),
      quotaUsage: quotaUsage.toString()
    })
  }

  async getUserSmsLogs(userId, limit = 20) {
    try {
      const pattern = `${this.smsLogPrefix}${userId}:*`
      const keys = await datastore.keys(pattern)

      const logs = []
      for (const key of keys.slice(0, limit)) {
        const logData = await datastore.get(key)
        if (logData) {
          logs.push(JSON.parse(logData))
        }
      }

      return logs
    } catch (error) {
      logger.error('❌ Error getting SMS logs:', error)
      return []
    }
  }

  async getRateLimitStatus(phoneNumber) {
    try {
      if (!phoneNumber) {
        return null
      }

      const now = Date.now()
      const today = new Date().toISOString().split('T')[0]

      const perMinuteKey = `${this.rateLimitPrefix}minute:${phoneNumber}:${Math.floor(now / 60000)}`
      const perHourKey = `${this.rateLimitPrefix}hour:${phoneNumber}:${Math.floor(now / 3600000)}`
      const perDayKey = `${this.rateLimitPrefix}day:${phoneNumber}:${today}`

      const [minuteCount, hourCount, dayCount] = await Promise.all([
        datastore.get(perMinuteKey),
        datastore.get(perHourKey),
        datastore.get(perDayKey)
      ])

      const rateLimitConfig = config.sms?.rateLimit || DEFAULT_RATE_LIMIT

      return {
        perMinute: {
          current: parseInt(minuteCount || '0', 10),
          limit: rateLimitConfig.perMinute,
          remaining: Math.max(0, rateLimitConfig.perMinute - parseInt(minuteCount || '0', 10))
        },
        perHour: {
          current: parseInt(hourCount || '0', 10),
          limit: rateLimitConfig.perHour,
          remaining: Math.max(0, rateLimitConfig.perHour - parseInt(hourCount || '0', 10))
        },
        perDay: {
          current: parseInt(dayCount || '0', 10),
          limit: rateLimitConfig.perDay,
          remaining: Math.max(0, rateLimitConfig.perDay - parseInt(dayCount || '0', 10))
        }
      }
    } catch (error) {
      logger.error('❌ Error getting rate limit status:', error)
      return null
    }
  }
}

const smsService = new SmsService()

module.exports = smsService
module.exports.default = smsService
