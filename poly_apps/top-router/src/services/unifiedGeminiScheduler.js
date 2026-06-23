const geminiAccountService = require('./geminiAccountService')
const geminiApiAccountService = require('./geminiApiAccountService')
const ccrAccountService = require('./ccrAccountService')
const accountGroupService = require('./accountGroupService')
const clientService = require('./clientService')
const redis = require('../models/datastore')
const logger = require('../utils/logger')
const { parseVendorPrefixedModel } = require('../utils/modelHelper')
const config = require('../../config/config')

const OAUTH_PROVIDER_GEMINI_CLI = 'gemini-cli'
const OAUTH_PROVIDER_ANTIGRAVITY = 'antigravity'
const KNOWN_OAUTH_PROVIDERS = [OAUTH_PROVIDER_GEMINI_CLI, OAUTH_PROVIDER_ANTIGRAVITY]

function normalizeOauthProvider(oauthProvider) {
  if (!oauthProvider) {
    return OAUTH_PROVIDER_GEMINI_CLI
  }
  return oauthProvider === OAUTH_PROVIDER_ANTIGRAVITY
    ? OAUTH_PROVIDER_ANTIGRAVITY
    : OAUTH_PROVIDER_GEMINI_CLI
}

class UnifiedGeminiScheduler {
  constructor() {
    this.SESSION_MAPPING_PREFIX = 'unified_gemini_session_mapping:'
  }

  _getSessionMappingKey(sessionHash, oauthProvider = null) {
    if (!sessionHash) {
      return null
    }
    if (!oauthProvider) {
      return `${this.SESSION_MAPPING_PREFIX}${sessionHash}`
    }
    const normalized = normalizeOauthProvider(oauthProvider)
    return `${this.SESSION_MAPPING_PREFIX}${normalized}:${sessionHash}`
  }

  // 🔧 辅助方法：检查账户是否可调度（兼容字符串和布尔值）
  _isSchedulable(schedulable) {
    // 如果是 undefined 或 null，默认为可调度
    if (schedulable === undefined || schedulable === null) {
      return true
    }
    // 明确设置为 false（布尔值）或 'false'（字符串）时不可调度
    return schedulable !== false && schedulable !== 'false'
  }

  // 🔧 辅助方法：检查账户是否激活（兼容字符串和布尔值）
  _isActive(isActive) {
    // 兼容布尔值 true 和字符串 'true'
    return isActive === true || isActive === 'true'
  }

  // 🎯 统一调度Gemini账号
  async selectAccountForApiKey(
    apiKeyData,
    sessionHash = null,
    requestedModel = null,
    options = {}
  ) {
    const { allowApiAccounts = false, oauthProvider = null } = options
    const normalizedOauthProvider = oauthProvider ? normalizeOauthProvider(oauthProvider) : null

    try {
      const { vendor, baseModel } = parseVendorPrefixedModel(requestedModel)
      const effectiveModel = vendor === 'ccr' ? baseModel : requestedModel
      const ccrPoolMode = this._getCcrPoolMode()

      if (vendor === 'ccr') {
        logger.info('🎯 CCR vendor prefix detected, routing to CCR accounts only')
        return await this._selectCcrAccount(apiKeyData, sessionHash, effectiveModel)
      }

      // 如果API Key绑定了专属账户或分组，优先使用
      if (apiKeyData.geminiAccountId) {
        // 检查是否是 Gemini API 账户（api: 前缀）
        if (apiKeyData.geminiAccountId.startsWith('api:')) {
          const accountId = apiKeyData.geminiAccountId.replace('api:', '')
          const boundAccount = await geminiApiAccountService.getAccount(accountId)
          if (
            boundAccount &&
            this._isActive(boundAccount.isActive) &&
            boundAccount.status !== 'error'
          ) {
            logger.info(
              `🎯 Using bound Gemini-API account: ${boundAccount.name} (${accountId}) for API key ${apiKeyData.name}`
            )
            // 更新账户的最后使用时间
            await geminiApiAccountService.markAccountUsed(accountId)
            return {
              accountId,
              accountType: 'gemini-api'
            }
          } else {
            // 提供详细的不可用原因
            const reason = !boundAccount
              ? 'account not found'
              : boundAccount.isActive !== 'true'
                ? `isActive=${boundAccount.isActive}`
                : `status=${boundAccount.status}`
            logger.warn(
              `⚠️ Bound Gemini-API account ${accountId} is not available (${reason}), falling back to pool`
            )
          }
        }
        // 检查是否是分组
        else if (apiKeyData.geminiAccountId.startsWith('group:')) {
          const groupId = apiKeyData.geminiAccountId.replace('group:', '')
          logger.info(
            `🎯 API key ${apiKeyData.name} is bound to group ${groupId}, selecting from group`
          )
          return await this.selectAccountFromGroup(groupId, sessionHash, effectiveModel, apiKeyData)
        }
        // 普通 Gemini OAuth 专属账户
        else {
          const boundAccount = await geminiAccountService.getAccount(apiKeyData.geminiAccountId)
          if (
            boundAccount &&
            this._isActive(boundAccount.isActive) &&
            boundAccount.status !== 'error'
          ) {
            if (
              normalizedOauthProvider &&
              normalizeOauthProvider(boundAccount.oauthProvider) !== normalizedOauthProvider
            ) {
              logger.warn(
                `⚠️ Bound Gemini OAuth account ${boundAccount.name} oauthProvider=${normalizeOauthProvider(boundAccount.oauthProvider)} does not match requested oauthProvider=${normalizedOauthProvider}, falling back to pool`
              )
            } else {
              logger.info(
                `🎯 Using bound dedicated Gemini account: ${boundAccount.name} (${apiKeyData.geminiAccountId}) for API key ${apiKeyData.name}`
              )
              // 更新账户的最后使用时间
              await geminiAccountService.markAccountUsed(apiKeyData.geminiAccountId)
              return {
                accountId: apiKeyData.geminiAccountId,
                accountType: 'gemini'
              }
            }
          } else {
            logger.warn(
              `⚠️ Bound Gemini account ${apiKeyData.geminiAccountId} is not available, falling back to pool`
            )
          }
        }
      }

      // 如果有会话哈希，检查是否有已映射的账户
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash, normalizedOauthProvider)
        if (mappedAccount) {
          // 验证映射的账户是否仍然可用
          const isAvailable = await this._isAccountAvailable(
            mappedAccount.accountId,
            mappedAccount.accountType,
            effectiveModel
          )
          if (isAvailable) {
            // 🚀 智能会话续期（续期 unified 映射键，按配置）
            await this._extendSessionMappingTTL(sessionHash, normalizedOauthProvider)
            logger.info(
              `🎯 Using sticky session account: ${mappedAccount.accountId} (${mappedAccount.accountType}) for session ${sessionHash}`
            )
            // 更新账户的最后使用时间（根据账户类型调用正确的服务）
            if (mappedAccount.accountType === 'gemini-api') {
              await geminiApiAccountService.markAccountUsed(mappedAccount.accountId)
            } else if (mappedAccount.accountType === 'ccr') {
              await ccrAccountService.markAccountUsed(mappedAccount.accountId)
            } else {
              await geminiAccountService.markAccountUsed(mappedAccount.accountId)
            }
            return mappedAccount
          } else {
            logger.warn(
              `⚠️ Mapped account ${mappedAccount.accountId} is no longer available, selecting new account`
            )
            await this._deleteSessionMapping(sessionHash)
          }
        }
      }

      const includeCcrInPool = ccrPoolMode === 'include'
      // 获取所有可用账户
      let availableAccounts = await this._getAllAvailableAccounts(apiKeyData, effectiveModel, {
        allowApiAccounts,
        oauthProvider: normalizedOauthProvider,
        includeCcr: includeCcrInPool
      })

      if (!includeCcrInPool && ccrPoolMode === 'fallback' && availableAccounts.length === 0) {
        logger.info('🔁 No standard Gemini accounts available, including CCR pool as fallback')
        availableAccounts = await this._getAllAvailableAccounts(apiKeyData, effectiveModel, {
          allowApiAccounts,
          oauthProvider: normalizedOauthProvider,
          includeCcr: true
        })
      }

      if (availableAccounts.length === 0) {
        // 提供更详细的错误信息
        if (effectiveModel) {
          throw new Error(
            `No available Gemini accounts support the requested model: ${effectiveModel}`
          )
        } else {
          throw new Error('No available Gemini accounts')
        }
      }

      // 按优先级和最后使用时间排序
      const sortedAccounts = this._sortAccountsByPriority(availableAccounts)

      // 选择第一个账户
      const selectedAccount = sortedAccounts[0]

      // 如果有会话哈希，建立新的映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType,
          normalizedOauthProvider
        )
        logger.info(
          `🎯 Created new sticky session mapping: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected account: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) with priority ${selectedAccount.priority} for API key ${apiKeyData.name}`
      )

      // 更新账户的最后使用时间（根据账户类型调用正确的服务）
      if (selectedAccount.accountType === 'gemini-api') {
        await geminiApiAccountService.markAccountUsed(selectedAccount.accountId)
      } else if (selectedAccount.accountType === 'ccr') {
        await ccrAccountService.markAccountUsed(selectedAccount.accountId)
      } else {
        await geminiAccountService.markAccountUsed(selectedAccount.accountId)
      }

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error('❌ Failed to select account for API key:', error)
      throw error
    }
  }

  // 📋 获取所有可用账户
  async _getAllAvailableAccounts(
    apiKeyData,
    requestedModel = null,
    allowApiAccountsOrOptions = false
  ) {
    const options =
      allowApiAccountsOrOptions && typeof allowApiAccountsOrOptions === 'object'
        ? allowApiAccountsOrOptions
        : { allowApiAccounts: allowApiAccountsOrOptions }
    const { allowApiAccounts = false, oauthProvider = null, includeCcr = false } = options
    const normalizedOauthProvider = oauthProvider ? normalizeOauthProvider(oauthProvider) : null

    const availableAccounts = []

    // 如果API Key绑定了专属账户，优先返回
    if (apiKeyData.geminiAccountId) {
      // 检查是否是 Gemini API 账户（api: 前缀）
      if (apiKeyData.geminiAccountId.startsWith('api:')) {
        const accountId = apiKeyData.geminiAccountId.replace('api:', '')
        const boundAccount = await geminiApiAccountService.getAccount(accountId)
        if (
          boundAccount &&
          this._isActive(boundAccount.isActive) &&
          boundAccount.status !== 'error'
        ) {
          const isRateLimited = await this.isAccountRateLimited(accountId)
          if (!isRateLimited) {
            // 检查模型支持
            if (
              requestedModel &&
              boundAccount.supportedModels &&
              boundAccount.supportedModels.length > 0
            ) {
              const normalizedModel = requestedModel.replace('models/', '')
              const modelSupported = boundAccount.supportedModels.some(
                (model) => model.replace('models/', '') === normalizedModel
              )
              if (!modelSupported) {
                logger.warn(
                  `⚠️ Bound Gemini-API account ${boundAccount.name} does not support model ${requestedModel}`
                )
                return availableAccounts
              }
            }

            logger.info(`🎯 Using bound Gemini-API account: ${boundAccount.name} (${accountId})`)
            return [
              {
                ...boundAccount,
                accountId,
                accountType: 'gemini-api',
                priority: parseInt(boundAccount.priority) || 50,
                lastUsedAt: boundAccount.lastUsedAt || '0'
              }
            ]
          }
        } else {
          // 提供详细的不可用原因
          const reason = !boundAccount
            ? 'account not found'
            : boundAccount.isActive !== 'true'
              ? `isActive=${boundAccount.isActive}`
              : `status=${boundAccount.status}`
          logger.warn(
            `⚠️ Bound Gemini-API account ${accountId} is not available in _getAllAvailableAccounts (${reason})`
          )
        }
      }
      // 普通 Gemini OAuth 账户
      else if (!apiKeyData.geminiAccountId.startsWith('group:')) {
        const boundAccount = await geminiAccountService.getAccount(apiKeyData.geminiAccountId)
        if (
          boundAccount &&
          this._isActive(boundAccount.isActive) &&
          boundAccount.status !== 'error'
        ) {
          if (
            normalizedOauthProvider &&
            normalizeOauthProvider(boundAccount.oauthProvider) !== normalizedOauthProvider
          ) {
            return availableAccounts
          }
          const isRateLimited = await this.isAccountRateLimited(boundAccount.id)
          if (!isRateLimited) {
            // 检查模型支持
            if (
              requestedModel &&
              boundAccount.supportedModels &&
              boundAccount.supportedModels.length > 0
            ) {
              // 处理可能带有 models/ 前缀的模型名
              const normalizedModel = requestedModel.replace('models/', '')
              const modelSupported = boundAccount.supportedModels.some(
                (model) => model.replace('models/', '') === normalizedModel
              )
              if (!modelSupported) {
                logger.warn(
                  `⚠️ Bound Gemini account ${boundAccount.name} does not support model ${requestedModel}`
                )
                return availableAccounts
              }
            }

            logger.info(
              `🎯 Using bound dedicated Gemini account: ${boundAccount.name} (${apiKeyData.geminiAccountId})`
            )
            return [
              {
                ...boundAccount,
                accountId: boundAccount.id,
                accountType: 'gemini',
                priority: parseInt(boundAccount.priority) || 50,
                lastUsedAt: boundAccount.lastUsedAt || '0'
              }
            ]
          }
        } else {
          logger.warn(`⚠️ Bound Gemini account ${apiKeyData.geminiAccountId} is not available`)
        }
      }
    }

    // 获取所有Gemini OAuth账户（共享池）
    const geminiAccounts = await geminiAccountService.getAllAccounts()
    for (const account of geminiAccounts) {
      if (
        this._isActive(account.isActive) &&
        account.status !== 'error' &&
        (account.accountType === 'shared' || !account.accountType) && // 兼容旧数据
        this._isSchedulable(account.schedulable)
      ) {
        if (
          normalizedOauthProvider &&
          normalizeOauthProvider(account.oauthProvider) !== normalizedOauthProvider
        ) {
          continue
        }
        // 检查是否可调度

        // 检查token是否过期
        const isExpired = geminiAccountService.isTokenExpired(account)
        if (isExpired && !account.refreshToken) {
          logger.warn(
            `⚠️ Gemini account ${account.name} token expired and no refresh token available`
          )
          continue
        }

        // 检查模型支持
        if (requestedModel && account.supportedModels && account.supportedModels.length > 0) {
          // 处理可能带有 models/ 前缀的模型名
          const normalizedModel = requestedModel.replace('models/', '')
          const modelSupported = account.supportedModels.some(
            (model) => model.replace('models/', '') === normalizedModel
          )
          if (!modelSupported) {
            logger.debug(
              `⏭️ Skipping Gemini account ${account.name} - doesn't support model ${requestedModel}`
            )
            continue
          }
        }

        // 检查是否被限流
        const isRateLimited = await this.isAccountRateLimited(account.id)
        if (!isRateLimited) {
          availableAccounts.push({
            ...account,
            accountId: account.id,
            accountType: 'gemini',
            priority: parseInt(account.priority) || 50, // 默认优先级50
            lastUsedAt: account.lastUsedAt || '0'
          })
        }
      }
    }

    // 如果允许调度 Gemini API 账户，则添加到可用列表
    if (allowApiAccounts) {
      const geminiApiAccounts = await geminiApiAccountService.getAllAccounts()
      for (const account of geminiApiAccounts) {
        if (
          this._isActive(account.isActive) &&
          account.status !== 'error' &&
          (account.accountType === 'shared' || !account.accountType) &&
          this._isSchedulable(account.schedulable)
        ) {
          // 检查模型支持
          if (requestedModel && account.supportedModels && account.supportedModels.length > 0) {
            const normalizedModel = requestedModel.replace('models/', '')
            const modelSupported = account.supportedModels.some(
              (model) => model.replace('models/', '') === normalizedModel
            )
            if (!modelSupported) {
              logger.debug(
                `⏭️ Skipping Gemini-API account ${account.name} - doesn't support model ${requestedModel}`
              )
              continue
            }
          }

          // 检查是否被限流
          const isRateLimited = await this.isAccountRateLimited(account.id)
          if (!isRateLimited) {
            availableAccounts.push({
              ...account,
              accountId: account.id,
              accountType: 'gemini-api',
              priority: parseInt(account.priority) || 50,
              lastUsedAt: account.lastUsedAt || '0'
            })
          }
        }
      }
    }

    // 获取 WS Client 账户（通过 WS 转发）
    const clientAccounts = await clientService.getAllClients()
    for (const account of clientAccounts) {
      const accountType = account.accountType || 'client'
      const connectionStatus = (account.connectionStatus || '').toLowerCase()
      const status = (account.status || '').toLowerCase()
      const isOnline = status === 'online' || status === 'connected'
      if (
        accountType !== 'client' ||
        !isOnline ||
        (connectionStatus && connectionStatus !== 'connected')
      ) {
        continue
      }

      if (requestedModel && account.supportedModels && account.supportedModels.length > 0) {
        const normalizedModel = requestedModel.replace('models/', '')
        const modelSupported = account.supportedModels.some(
          (model) => model.replace('models/', '') === normalizedModel
        )
        if (!modelSupported) {
          continue
        }
      }

      const maxConcurrency = Number(account.maxConcurrency) || 10
      if (maxConcurrency > 0) {
        const current = await clientService.getCurrentConcurrency(account.id)
        if (current >= maxConcurrency) {
          logger.debug(
            `⏭️ Skipping Client ${account.name || account.id} - concurrency ${current}/${maxConcurrency}`
          )
          continue
        }
      }

      const schedulable =
        account.schedulable === undefined
          ? true
          : String(account.schedulable).toLowerCase() !== 'false'
      if (!schedulable) {
        continue
      }

      availableAccounts.push({
        ...account,
        accountId: account.id,
        accountType: 'client',
        priority: parseInt(account.priority) || 50,
        lastUsedAt: account.lastUsedAt || '0'
      })
    }

    if (includeCcr) {
      const ccrAccounts = await this._getAvailableCcrAccounts(requestedModel)
      availableAccounts.push(...ccrAccounts)
    }

    logger.info(
      `📊 Total available accounts: ${availableAccounts.length} (Gemini OAuth + ${allowApiAccounts ? 'Gemini API' : 'no API accounts'} + Client:${availableAccounts.filter((a) => a.accountType === 'client').length})`
    )
    return availableAccounts
  }

  // 🔢 按优先级和最后使用时间排序账户
  _sortAccountsByPriority(accounts) {
    return accounts.sort((a, b) => {
      // 首先按优先级排序（数字越小优先级越高）
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }

      // 优先级相同时，按最后使用时间排序（最久未使用的优先）
      const aLastUsed = new Date(a.lastUsedAt || 0).getTime()
      const bLastUsed = new Date(b.lastUsedAt || 0).getTime()
      return aLastUsed - bLastUsed
    })
  }

  // 🔍 检查账户是否可用
  async _isAccountAvailable(accountId, accountType, requestedModel = null) {
    try {
      if (accountType === 'gemini') {
        const account = await geminiAccountService.getAccount(accountId)
        if (!account || !this._isActive(account.isActive) || account.status === 'error') {
          return false
        }
        // 检查是否可调度
        if (!this._isSchedulable(account.schedulable)) {
          logger.info(`🚫 Gemini account ${accountId} is not schedulable`)
          return false
        }
        return !(await this.isAccountRateLimited(accountId))
      } else if (accountType === 'gemini-api') {
        const account = await geminiApiAccountService.getAccount(accountId)
        if (!account || !this._isActive(account.isActive) || account.status === 'error') {
          return false
        }
        // 检查是否可调度
        if (!this._isSchedulable(account.schedulable)) {
          logger.info(`🚫 Gemini-API account ${accountId} is not schedulable`)
          return false
        }
        return !(await this.isAccountRateLimited(accountId))
      } else if (accountType === 'ccr') {
        const account = await ccrAccountService.getAccount(accountId)
        if (
          !account ||
          account.isActive !== true ||
          account.status !== 'active' ||
          account.accountType !== 'shared' ||
          !this._isSchedulable(account.schedulable)
        ) {
          return false
        }

        if (!this._isCcrModelSupported(account, requestedModel)) {
          return false
        }

        if (ccrAccountService.isSubscriptionExpired(account)) {
          logger.info(`🚫 CCR account ${accountId} subscription expired`)
          return false
        }

        const isRateLimited = await ccrAccountService.isAccountRateLimited(accountId)
        const isQuotaExceeded = await ccrAccountService.isAccountQuotaExceeded(accountId)
        const isOverloaded = await ccrAccountService.isAccountOverloaded(accountId)
        return !isRateLimited && !isQuotaExceeded && !isOverloaded
      }
      return false
    } catch (error) {
      logger.warn(`⚠️ Failed to check account availability: ${accountId}`, error)
      return false
    }
  }

  // 🔗 获取会话映射
  async _getSessionMapping(sessionHash, oauthProvider = null) {
    const client = redis.getClientSafe()
    const key = this._getSessionMappingKey(sessionHash, oauthProvider)
    const mappingData = key ? await client.get(key) : null

    if (mappingData) {
      try {
        return JSON.parse(mappingData)
      } catch (error) {
        logger.warn('⚠️ Failed to parse session mapping:', error)
        return null
      }
    }

    return null
  }

  // 💾 设置会话映射
  async _setSessionMapping(sessionHash, accountId, accountType, oauthProvider = null) {
    const client = redis.getClientSafe()
    const mappingData = JSON.stringify({ accountId, accountType })
    // 依据配置设置TTL（小时）
    const appConfig = require('../../config/config')
    const ttlHours = appConfig.session?.stickyTtlHours || 1
    const ttlSeconds = Math.max(1, Math.floor(ttlHours * 60 * 60))
    const key = this._getSessionMappingKey(sessionHash, oauthProvider)
    if (!key) {
      return
    }
    await client.setex(key, ttlSeconds, mappingData)
  }

  // 🗑️ 删除会话映射
  async _deleteSessionMapping(sessionHash) {
    const client = redis.getClientSafe()
    if (!sessionHash) {
      return
    }

    const keys = [this._getSessionMappingKey(sessionHash)]
    for (const provider of KNOWN_OAUTH_PROVIDERS) {
      keys.push(this._getSessionMappingKey(sessionHash, provider))
    }
    await client.del(keys.filter(Boolean))
  }

  // 🔁 续期统一调度会话映射TTL（针对 unified_gemini_session_mapping:* 键），遵循会话配置
  async _extendSessionMappingTTL(sessionHash, oauthProvider = null) {
    try {
      const client = redis.getClientSafe()
      const key = this._getSessionMappingKey(sessionHash, oauthProvider)
      if (!key) {
        return false
      }
      const remainingTTL = await client.ttl(key)

      if (remainingTTL === -2) {
        return false
      }
      if (remainingTTL === -1) {
        return true
      }

      const appConfig = require('../../config/config')
      const ttlHours = appConfig.session?.stickyTtlHours || 1
      const renewalThresholdMinutes = appConfig.session?.renewalThresholdMinutes || 0
      if (!renewalThresholdMinutes) {
        return true
      }

      const fullTTL = Math.max(1, Math.floor(ttlHours * 60 * 60))
      const threshold = Math.max(0, Math.floor(renewalThresholdMinutes * 60))

      if (remainingTTL < threshold) {
        await client.expire(key, fullTTL)
        logger.debug(
          `🔄 Renewed unified Gemini session TTL: ${sessionHash} (was ${Math.round(remainingTTL / 60)}m, renewed to ${ttlHours}h)`
        )
      } else {
        logger.debug(
          `✅ Unified Gemini session TTL sufficient: ${sessionHash} (remaining ${Math.round(remainingTTL / 60)}m)`
        )
      }
      return true
    } catch (error) {
      logger.error('❌ Failed to extend unified Gemini session TTL:', error)
      return false
    }
  }

  // 🚫 标记账户为限流状态
  async markAccountRateLimited(accountId, accountType, sessionHash = null) {
    try {
      if (accountType === 'gemini') {
        await geminiAccountService.setAccountRateLimited(accountId, true)
      } else if (accountType === 'gemini-api') {
        await geminiApiAccountService.setAccountRateLimited(accountId, true)
      } else if (accountType === 'ccr') {
        await ccrAccountService.markAccountRateLimited(accountId)
      }

      // 删除会话映射
      if (sessionHash) {
        await this._deleteSessionMapping(sessionHash)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to mark account as rate limited: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // ✅ 移除账户的限流状态
  async removeAccountRateLimit(accountId, accountType) {
    try {
      if (accountType === 'gemini') {
        await geminiAccountService.setAccountRateLimited(accountId, false)
      } else if (accountType === 'gemini-api') {
        await geminiApiAccountService.setAccountRateLimited(accountId, false)
      } else if (accountType === 'ccr') {
        await ccrAccountService.removeAccountRateLimit(accountId)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to remove rate limit for account: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // 🔍 检查账户是否处于限流状态
  async isAccountRateLimited(accountId, accountType = null) {
    try {
      let account = null

      // 如果指定了账户类型，直接使用对应服务
      if (accountType === 'gemini-api') {
        account = await geminiApiAccountService.getAccount(accountId)
      } else if (accountType === 'gemini') {
        account = await geminiAccountService.getAccount(accountId)
      } else if (accountType === 'ccr') {
        return await ccrAccountService.isAccountRateLimited(accountId)
      } else {
        // 未指定类型，先尝试 gemini，再尝试 gemini-api
        account = await geminiAccountService.getAccount(accountId)
        if (!account) {
          account = await geminiApiAccountService.getAccount(accountId)
        }
      }

      if (!account) {
        return false
      }

      if (account.rateLimitStatus === 'limited' && account.rateLimitedAt) {
        const limitedAt = new Date(account.rateLimitedAt).getTime()
        const now = Date.now()
        // 使用账户配置的限流时长，默认1小时
        const rateLimitDuration = parseInt(account.rateLimitDuration) || 60
        const limitDuration = rateLimitDuration * 60 * 1000

        return now < limitedAt + limitDuration
      }
      return false
    } catch (error) {
      logger.error(`❌ Failed to check rate limit status: ${accountId}`, error)
      return false
    }
  }

  // 👥 从分组中选择账户（支持 Gemini OAuth 和 Gemini API 两种账户类型）
  async selectAccountFromGroup(groupId, sessionHash = null, requestedModel = null) {
    try {
      // 获取分组信息
      const group = await accountGroupService.getGroup(groupId)
      if (!group) {
        throw new Error(`Group ${groupId} not found`)
      }

      if (group.platform !== 'gemini') {
        throw new Error(`Group ${group.name} is not a Gemini group`)
      }

      logger.info(`👥 Selecting account from Gemini group: ${group.name}`)

      // 如果有会话哈希，检查是否有已映射的账户
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount) {
          // 验证映射的账户是否属于这个分组
          const memberIds = await accountGroupService.getGroupMembers(groupId)
          if (memberIds.includes(mappedAccount.accountId)) {
            const isAvailable = await this._isAccountAvailable(
              mappedAccount.accountId,
              mappedAccount.accountType,
              requestedModel
            )
            if (isAvailable) {
              // 🚀 智能会话续期（续期 unified 映射键，按配置）
              await this._extendSessionMappingTTL(sessionHash)
              logger.info(
                `🎯 Using sticky session account from group: ${mappedAccount.accountId} (${mappedAccount.accountType}) for session ${sessionHash}`
              )
              // 更新账户的最后使用时间（根据账户类型调用正确的服务）
              if (mappedAccount.accountType === 'gemini-api') {
                await geminiApiAccountService.markAccountUsed(mappedAccount.accountId)
              } else if (mappedAccount.accountType === 'ccr') {
                await ccrAccountService.markAccountUsed(mappedAccount.accountId)
              } else {
                await geminiAccountService.markAccountUsed(mappedAccount.accountId)
              }
              return mappedAccount
            }
          }
          // 如果映射的账户不可用或不在分组中，删除映射
          await this._deleteSessionMapping(sessionHash)
        }
      }

      // 获取分组内的所有账户
      const memberIds = await accountGroupService.getGroupMembers(groupId)
      if (memberIds.length === 0) {
        throw new Error(`Group ${group.name} has no members`)
      }

      const availableAccounts = []

      // 获取所有成员账户的详细信息（支持 Gemini OAuth 和 Gemini API 两种类型）
      for (const memberId of memberIds) {
        // 首先尝试从 Gemini OAuth 账户服务获取
        let account = await geminiAccountService.getAccount(memberId)
        let accountType = 'gemini'

        // 如果 Gemini OAuth 账户不存在，尝试从 Gemini API 账户服务获取
        if (!account) {
          account = await geminiApiAccountService.getAccount(memberId)
          accountType = 'gemini-api'
        }

        if (!account) {
          logger.warn(`⚠️ Gemini account ${memberId} not found in group ${group.name}`)
          continue
        }

        // 检查账户是否可用
        if (
          this._isActive(account.isActive) &&
          account.status !== 'error' &&
          this._isSchedulable(account.schedulable)
        ) {
          // 对于 Gemini OAuth 账户，检查 token 是否过期
          if (accountType === 'gemini') {
            const isExpired = geminiAccountService.isTokenExpired(account)
            if (isExpired && !account.refreshToken) {
              logger.warn(
                `⚠️ Gemini account ${account.name} in group token expired and no refresh token available`
              )
              continue
            }
          }

          // 检查模型支持
          if (requestedModel && account.supportedModels && account.supportedModels.length > 0) {
            // 处理可能带有 models/ 前缀的模型名
            const normalizedModel = requestedModel.replace('models/', '')
            const modelSupported = account.supportedModels.some(
              (model) => model.replace('models/', '') === normalizedModel
            )
            if (!modelSupported) {
              logger.debug(
                `⏭️ Skipping ${accountType} account ${account.name} in group - doesn't support model ${requestedModel}`
              )
              continue
            }
          }

          // 检查是否被限流
          const isRateLimited = await this.isAccountRateLimited(account.id, accountType)
          if (!isRateLimited) {
            availableAccounts.push({
              ...account,
              accountId: account.id,
              accountType,
              priority: parseInt(account.priority) || 50,
              lastUsedAt: account.lastUsedAt || '0'
            })
          }
        }
      }

      if (availableAccounts.length === 0) {
        throw new Error(`No available accounts in Gemini group ${group.name}`)
      }

      // 使用现有的优先级排序逻辑
      const sortedAccounts = this._sortAccountsByPriority(availableAccounts)

      // 选择第一个账户
      const selectedAccount = sortedAccounts[0]

      // 如果有会话哈希，建立新的映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky session mapping in group: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected account from Gemini group ${group.name}: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) with priority ${selectedAccount.priority}`
      )

      // 更新账户的最后使用时间（根据账户类型调用正确的服务）
      if (selectedAccount.accountType === 'gemini-api') {
        await geminiApiAccountService.markAccountUsed(selectedAccount.accountId)
      } else if (selectedAccount.accountType === 'ccr') {
        await ccrAccountService.markAccountUsed(selectedAccount.accountId)
      } else {
        await geminiAccountService.markAccountUsed(selectedAccount.accountId)
      }

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error(`❌ Failed to select account from Gemini group ${groupId}:`, error)
      throw error
    }
  }

  // 🧭 CCR 调度模式
  _getCcrPoolMode() {
    const mode = String(config?.ccr?.poolMode || 'fallback').toLowerCase()
    return ['disabled', 'fallback', 'include'].includes(mode) ? mode : 'fallback'
  }

  // 🔍 CCR 模型支持检查
  _isCcrModelSupported(account, requestedModel) {
    if (!requestedModel) {
      return true
    }

    if (!account || !account.supportedModels) {
      return true
    }

    if (Array.isArray(account.supportedModels)) {
      if (account.supportedModels.length === 0) {
        return true
      }
      return account.supportedModels.includes(requestedModel)
    }

    if (typeof account.supportedModels === 'object') {
      if (Object.keys(account.supportedModels).length === 0) {
        return true
      }
      return ccrAccountService.isModelSupported(account.supportedModels, requestedModel)
    }

    return true
  }

  // 🎯 专门选择CCR账户（仅限CCR前缀路由使用）
  async _selectCcrAccount(apiKeyData, sessionHash = null, requestedModel = null) {
    try {
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount && mappedAccount.accountType === 'ccr') {
          const isAvailable = await this._isAccountAvailable(
            mappedAccount.accountId,
            mappedAccount.accountType,
            requestedModel
          )
          if (isAvailable) {
            await this._extendSessionMappingTTL(sessionHash)
            logger.info(
              `🎯 Using sticky CCR session account: ${mappedAccount.accountId} for session ${sessionHash}`
            )
            return mappedAccount
          }
          logger.warn(
            `⚠️ Mapped CCR account ${mappedAccount.accountId} is no longer available, selecting new account`
          )
          await this._deleteSessionMapping(sessionHash)
        }
      }

      const availableCcrAccounts = await this._getAvailableCcrAccounts(requestedModel)

      if (availableCcrAccounts.length === 0) {
        throw new Error(
          `No available CCR accounts support the requested model: ${requestedModel || 'unspecified'}`
        )
      }

      const sortedAccounts = this._sortAccountsByPriority(availableCcrAccounts)
      const selectedAccount = sortedAccounts[0]

      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky CCR session mapping: ${selectedAccount.name} (${selectedAccount.accountId}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected CCR account: ${selectedAccount.name} (${selectedAccount.accountId}) with priority ${selectedAccount.priority} for API key ${apiKeyData.name}`
      )

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error('❌ Failed to select CCR account:', error)
      throw error
    }
  }

  // 📋 获取所有可用的CCR账户
  async _getAvailableCcrAccounts(requestedModel = null) {
    const availableAccounts = []
    const ccrAccounts = await ccrAccountService.getAllAccounts()
    logger.info(`📋 Found ${ccrAccounts.length} total CCR accounts for Gemini selection`)

    for (const account of ccrAccounts) {
      logger.info(
        `🔍 Checking CCR account: ${account.name} - isActive: ${account.isActive}, status: ${account.status}, accountType: ${account.accountType}, schedulable: ${account.schedulable}`
      )

      if (
        account.isActive === true &&
        account.status === 'active' &&
        account.accountType === 'shared' &&
        this._isSchedulable(account.schedulable)
      ) {
        if (!this._isCcrModelSupported(account, requestedModel)) {
          continue
        }

        if (ccrAccountService.isSubscriptionExpired(account)) {
          logger.debug(
            `⏰ CCR account ${account.name} (${account.id}) expired at ${account.subscriptionExpiresAt}`
          )
          continue
        }

        const isRateLimited = await ccrAccountService.isAccountRateLimited(account.id)
        const isQuotaExceeded = await ccrAccountService.isAccountQuotaExceeded(account.id)
        const isOverloaded = await ccrAccountService.isAccountOverloaded(account.id)

        if (!isRateLimited && !isQuotaExceeded && !isOverloaded) {
          availableAccounts.push({
            ...account,
            accountId: account.id,
            accountType: 'ccr',
            priority: parseInt(account.priority) || 50,
            lastUsedAt: account.lastUsedAt || '0'
          })
          logger.info(
            `✅ Added CCR account to available Gemini pool: ${account.name} (priority: ${account.priority})`
          )
        } else {
          logger.debug(
            `❌ CCR account ${account.name} not available - rateLimited: ${isRateLimited}, quotaExceeded: ${isQuotaExceeded}, overloaded: ${isOverloaded}`
          )
        }
      }
    }

    return availableAccounts
  }
}

module.exports = new UnifiedGeminiScheduler()
