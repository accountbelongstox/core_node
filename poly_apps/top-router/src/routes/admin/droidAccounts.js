const express = require('express')
const crypto = require('crypto')
const droidAccountService = require('../../services/droidAccountService')
const accountGroupService = require('../../services/accountGroupService')
const redis = require('../../models/datastore')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const {
  startDeviceAuthorization,
  pollDeviceAuthorization,
  WorkOSDeviceAuthError
} = require('../../utils/workosOAuthHelper')
const webhookNotifier = require('../../utils/webhookNotifier')
const { formatAccountExpiry, mapExpiryField } = require('./utils')

const router = express.Router()

// ==================== Droid 账户管理 API ====================

// 生成 Droid 设备码授权信息
router.post('/droid-accounts/generate-auth-url', authenticateAdmin, async (req, res) => {
  try {
    const { proxy } = req.body || {}
    const deviceAuth = await startDeviceAuthorization(proxy || null)

    const sessionId = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + deviceAuth.expiresIn * 1000).toISOString()

    await redis.setOAuthSession(sessionId, {
      deviceCode: deviceAuth.deviceCode,
      userCode: deviceAuth.userCode,
      verificationUri: deviceAuth.verificationUri,
      verificationUriComplete: deviceAuth.verificationUriComplete,
      interval: deviceAuth.interval,
      proxy: proxy || null,
      createdAt: new Date().toISOString(),
      expiresAt
    })

    logger.success('🤖 生成 Droid 设备码授权信息成功', { sessionId })
    return res.json({
      success: true,
      data: {
        sessionId,
        userCode: deviceAuth.userCode,
        verificationUri: deviceAuth.verificationUri,
        verificationUriComplete: deviceAuth.verificationUriComplete,
        expiresIn: deviceAuth.expiresIn,
        interval: deviceAuth.interval,
        instructions: [
          '1. 使用下方验证码进入授权页面并确认访问权限。',
          '2. 在授权页面登录 Factory / Droid 账户并点击允许。',
          '3. 回到此处点击"完成授权"完成凭证获取。'
        ]
      }
    })
  } catch (error) {
    const message =
      error instanceof WorkOSDeviceAuthError ? error.message : error.message || '未知错误'
    logger.error('❌ 生成 Droid 设备码授权失败:', message)
    return res.status(500).json({ error: 'Failed to start Droid device authorization', message })
  }
})

// 交换 Droid 授权码
router.post('/droid-accounts/exchange-code', authenticateAdmin, async (req, res) => {
  const { sessionId, proxy } = req.body || {}
  try {
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' })
    }

    const oauthSession = await redis.getOAuthSession(sessionId)
    if (!oauthSession) {
      return res.status(400).json({ error: 'Invalid or expired OAuth session' })
    }

    if (oauthSession.expiresAt && new Date() > new Date(oauthSession.expiresAt)) {
      await redis.deleteOAuthSession(sessionId)
      return res
        .status(400)
        .json({ error: 'OAuth session has expired, please generate a new authorization URL' })
    }

    if (!oauthSession.deviceCode) {
      await redis.deleteOAuthSession(sessionId)
      return res.status(400).json({ error: 'OAuth session missing device code, please retry' })
    }

    const proxyConfig = proxy || oauthSession.proxy || null
    const tokens = await pollDeviceAuthorization(oauthSession.deviceCode, proxyConfig)

    await redis.deleteOAuthSession(sessionId)

    logger.success('🤖 成功获取 Droid 访问令牌', { sessionId })
    return res.json({ success: true, data: { tokens } })
  } catch (error) {
    if (error instanceof WorkOSDeviceAuthError) {
      if (error.code === 'authorization_pending' || error.code === 'slow_down') {
        const oauthSession = await redis.getOAuthSession(sessionId)
        const expiresAt = oauthSession?.expiresAt ? new Date(oauthSession.expiresAt) : null
        const remainingSeconds =
          expiresAt instanceof Date && !Number.isNaN(expiresAt.getTime())
            ? Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))
            : null

        return res.json({
          success: false,
          pending: true,
          error: error.code,
          message: error.message,
          retryAfter: error.retryAfter || Number(oauthSession?.interval) || 5,
          expiresIn: remainingSeconds
        })
      }

      if (error.code === 'expired_token') {
        await redis.deleteOAuthSession(sessionId)
        return res.status(400).json({
          error: 'Device code expired',
          message: '授权已过期，请重新生成设备码并再次授权'
        })
      }

      logger.error('❌ Droid 授权失败:', error.message)
      return res.status(500).json({
        error: 'Failed to exchange Droid authorization code',
        message: error.message,
        errorCode: error.code
      })
    }

    logger.error('❌ 交换 Droid 授权码失败:', error)
    return res.status(500).json({
      error: 'Failed to exchange Droid authorization code',
      message: error.message
    })
  }
})

// 获取所有 Droid 账户
router.get('/droid-accounts', authenticateAdmin, async (req, res) => {
  try {
    const accounts = await droidAccountService.getAllAccounts()
    const allApiKeys = await redis.getAllApiKeys()

    // 添加使用统计
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        try {
          const usageStats = await redis.getAccountUsageStats(account.id, 'droid')
          let groupInfos = []
          try {
            groupInfos = await accountGroupService.getAccountGroups(account.id)
          } catch (groupError) {
            logger.debug(`Failed to get group infos for Droid account ${account.id}:`, groupError)
            groupInfos = []
          }

          const groupIds = groupInfos.map((group) => group.id)
          const boundApiKeysCount = allApiKeys.reduce((count, key) => {
            const binding = key.droidAccountId
            if (!binding) {
              return count
            }
            if (binding === account.id) {
              return count + 1
            }
            if (binding.startsWith('group:')) {
              const groupId = binding.substring('group:'.length)
              if (groupIds.includes(groupId)) {
                return count + 1
              }
            }
            return count
          }, 0)

          const formattedAccount = formatAccountExpiry(account)
          return {
            ...formattedAccount,
            schedulable: account.schedulable === 'true',
            boundApiKeysCount,
            groupInfos,
            usage: {
              daily: usageStats.daily,
              total: usageStats.total,
              averages: usageStats.averages
            }
          }
        } catch (error) {
          logger.warn(`Failed to get stats for Droid account ${account.id}:`, error.message)
          const formattedAccount = formatAccountExpiry(account)
          return {
            ...formattedAccount,
            boundApiKeysCount: 0,
            groupInfos: [],
            usage: {
              daily: { tokens: 0, requests: 0 },
              total: { tokens: 0, requests: 0 },
              averages: { rpm: 0, tpm: 0 }
            }
          }
        }
      })
    )

    return res.json({ success: true, data: accountsWithStats })
  } catch (error) {
    logger.error('Failed to get Droid accounts:', error)
    return res.status(500).json({ error: 'Failed to get Droid accounts', message: error.message })
  }
})

// 创建 Droid 账户
router.post('/droid-accounts', authenticateAdmin, async (req, res) => {
  try {
    const { accountType: rawAccountType = 'shared', groupId, groupIds } = req.body

    const normalizedAccountType = rawAccountType || 'shared'

    if (!['shared', 'dedicated', 'group'].includes(normalizedAccountType)) {
      return res.status(400).json({ error: '账户类型必须是 shared、dedicated 或 group' })
    }

    const normalizedGroupIds = Array.isArray(groupIds)
      ? groupIds.filter((id) => typeof id === 'string' && id.trim())
      : []

    if (
      normalizedAccountType === 'group' &&
      normalizedGroupIds.length === 0 &&
      (!groupId || typeof groupId !== 'string' || !groupId.trim())
    ) {
      return res.status(400).json({ error: '分组调度账户必须至少选择一个分组' })
    }

    const accountPayload = {
      ...req.body,
      accountType: normalizedAccountType
    }

    delete accountPayload.groupId
    delete accountPayload.groupIds

    const account = await droidAccountService.createAccount(accountPayload)

    if (normalizedAccountType === 'group') {
      try {
        if (normalizedGroupIds.length > 0) {
          await accountGroupService.setAccountGroups(account.id, normalizedGroupIds, 'droid')
        } else if (typeof groupId === 'string' && groupId.trim()) {
          await accountGroupService.addAccountToGroup(account.id, groupId, 'droid')
        }
      } catch (groupError) {
        logger.error(`Failed to attach Droid account ${account.id} to groups:`, groupError)
        return res.status(500).json({
          error: 'Failed to bind Droid account to groups',
          message: groupError.message
        })
      }
    }

    logger.success(`Created Droid account: ${account.name} (${account.id})`)
    const formattedAccount = formatAccountExpiry(account)
    return res.json({ success: true, data: formattedAccount })
  } catch (error) {
    logger.error('Failed to create Droid account:', error)
    return res.status(500).json({ error: 'Failed to create Droid account', message: error.message })
  }
})

// 更新 Droid 账户
router.put('/droid-accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = { ...req.body }

    // ✅ 【新增】映射字段名：前端的 expiresAt -> 后端的 subscriptionExpiresAt
    const mappedUpdates = mapExpiryField(updates, 'Droid', id)

    const { accountType: rawAccountType, groupId, groupIds } = mappedUpdates

    if (rawAccountType && !['shared', 'dedicated', 'group'].includes(rawAccountType)) {
      return res.status(400).json({ error: '账户类型必须是 shared、dedicated 或 group' })
    }

    if (
      rawAccountType === 'group' &&
      (!groupId || typeof groupId !== 'string' || !groupId.trim()) &&
      (!Array.isArray(groupIds) || groupIds.length === 0)
    ) {
      return res.status(400).json({ error: '分组调度账户必须至少选择一个分组' })
    }

    const currentAccount = await droidAccountService.getAccount(id)
    if (!currentAccount) {
      return res.status(404).json({ error: 'Droid account not found' })
    }

    const normalizedGroupIds = Array.isArray(groupIds)
      ? groupIds.filter((gid) => typeof gid === 'string' && gid.trim())
      : []
    const hasGroupIdsField = Object.prototype.hasOwnProperty.call(mappedUpdates, 'groupIds')
    const hasGroupIdField = Object.prototype.hasOwnProperty.call(mappedUpdates, 'groupId')
    const targetAccountType = rawAccountType || currentAccount.accountType || 'shared'

    delete mappedUpdates.groupId
    delete mappedUpdates.groupIds

    if (rawAccountType) {
      mappedUpdates.accountType = targetAccountType
    }

    const account = await droidAccountService.updateAccount(id, mappedUpdates)

    try {
      if (currentAccount.accountType === 'group' && targetAccountType !== 'group') {
        await accountGroupService.removeAccountFromAllGroups(id)
      } else if (targetAccountType === 'group') {
        if (hasGroupIdsField) {
          if (normalizedGroupIds.length > 0) {
            await accountGroupService.setAccountGroups(id, normalizedGroupIds, 'droid')
          } else {
            await accountGroupService.removeAccountFromAllGroups(id)
          }
        } else if (hasGroupIdField && typeof groupId === 'string' && groupId.trim()) {
          await accountGroupService.setAccountGroups(id, [groupId], 'droid')
        }
      }
    } catch (groupError) {
      logger.error(`Failed to update Droid account ${id} groups:`, groupError)
      return res.status(500).json({
        error: 'Failed to update Droid account groups',
        message: groupError.message
      })
    }

    if (targetAccountType === 'group') {
      try {
        account.groupInfos = await accountGroupService.getAccountGroups(id)
      } catch (groupFetchError) {
        logger.debug(`Failed to fetch group infos for Droid account ${id}:`, groupFetchError)
      }
    }

    return res.json({ success: true, data: account })
  } catch (error) {
    logger.error(`Failed to update Droid account ${req.params.id}:`, error)
    return res.status(500).json({ error: 'Failed to update Droid account', message: error.message })
  }
})

// 切换 Droid 账户调度状态
router.put('/droid-accounts/:id/toggle-schedulable', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const account = await droidAccountService.getAccount(id)
    if (!account) {
      return res.status(404).json({ error: 'Droid account not found' })
    }

    const currentSchedulable = account.schedulable === true || account.schedulable === 'true'
    const newSchedulable = !currentSchedulable

    await droidAccountService.updateAccount(id, { schedulable: newSchedulable ? 'true' : 'false' })

    const updatedAccount = await droidAccountService.getAccount(id)
    const actualSchedulable = updatedAccount
      ? updatedAccount.schedulable === true || updatedAccount.schedulable === 'true'
      : newSchedulable

    if (!actualSchedulable) {
      await webhookNotifier.sendAccountAnomalyNotification({
        accountId: account.id,
        accountName: account.name || 'Droid Account',
        platform: 'droid',
        status: 'disabled',
        errorCode: 'DROID_MANUALLY_DISABLED',
        reason: '账号已被管理员手动禁用调度',
        timestamp: new Date().toISOString()
      })
    }

    logger.success(
      `🔄 Admin toggled Droid account schedulable status: ${id} -> ${
        actualSchedulable ? 'schedulable' : 'not schedulable'
      }`
    )

    return res.json({ success: true, schedulable: actualSchedulable })
  } catch (error) {
    logger.error('❌ Failed to toggle Droid account schedulable status:', error)
    return res
      .status(500)
      .json({ error: 'Failed to toggle schedulable status', message: error.message })
  }
})

// 获取单个 Droid 账户详细信息
router.get('/droid-accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    // 获取账户基本信息
    const account = await droidAccountService.getAccount(id)
    if (!account) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Droid account not found'
      })
    }

    // 获取使用统计信息
    let usageStats
    try {
      usageStats = await redis.getAccountUsageStats(account.id, 'droid')
    } catch (error) {
      logger.debug(`Failed to get usage stats for Droid account ${account.id}:`, error)
      usageStats = {
        daily: { tokens: 0, requests: 0, allTokens: 0 },
        total: { tokens: 0, requests: 0, allTokens: 0 },
        averages: { rpm: 0, tpm: 0 }
      }
    }

    // 获取分组信息
    let groupInfos = []
    try {
      groupInfos = await accountGroupService.getAccountGroups(account.id)
    } catch (error) {
      logger.debug(`Failed to get group infos for Droid account ${account.id}:`, error)
      groupInfos = []
    }

    // 获取绑定的 API Key 数量
    const allApiKeys = await redis.getAllApiKeys()
    const groupIds = groupInfos.map((group) => group.id)
    const boundApiKeysCount = allApiKeys.reduce((count, key) => {
      const binding = key.droidAccountId
      if (!binding) {
        return count
      }
      if (binding === account.id) {
        return count + 1
      }
      if (binding.startsWith('group:')) {
        const groupId = binding.substring('group:'.length)
        if (groupIds.includes(groupId)) {
          return count + 1
        }
      }
      return count
    }, 0)

    // 获取解密的 API Keys（用于管理界面）
    let decryptedApiKeys = []
    try {
      decryptedApiKeys = await droidAccountService.getDecryptedApiKeyEntries(id)
    } catch (error) {
      logger.debug(`Failed to get decrypted API keys for Droid account ${account.id}:`, error)
      decryptedApiKeys = []
    }

    // 返回完整的账户信息，包含实际的 API Keys
    const accountDetails = {
      ...account,
      // 映射字段：使用 subscriptionExpiresAt 作为前端显示的 expiresAt
      expiresAt: account.subscriptionExpiresAt || null,
      schedulable: account.schedulable === 'true',
      boundApiKeysCount,
      groupInfos,
      // 包含实际的 API Keys（用于管理界面）
      apiKeys: decryptedApiKeys.map((entry) => ({
        key: entry.key,
        id: entry.id,
        usageCount: entry.usageCount || 0,
        lastUsedAt: entry.lastUsedAt || null,
        status: entry.status || 'active', // 使用实际的状态，默认为 active
        errorMessage: entry.errorMessage || '', // 包含错误信息
        createdAt: entry.createdAt || null
      })),
      usage: {
        daily: usageStats.daily,
        total: usageStats.total,
        averages: usageStats.averages
      }
    }

    return res.json({
      success: true,
      data: accountDetails
    })
  } catch (error) {
    logger.error(`Failed to get Droid account ${req.params.id}:`, error)
    return res.status(500).json({
      error: 'Failed to get Droid account',
      message: error.message
    })
  }
})

// 删除 Droid 账户
router.delete('/droid-accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    await droidAccountService.deleteAccount(id)
    return res.json({ success: true, message: 'Droid account deleted successfully' })
  } catch (error) {
    logger.error(`Failed to delete Droid account ${req.params.id}:`, error)
    return res.status(500).json({ error: 'Failed to delete Droid account', message: error.message })
  }
})

// 刷新 Droid 账户 token
router.post('/droid-accounts/:id/refresh-token', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const result = await droidAccountService.refreshAccessToken(id)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error(`Failed to refresh Droid account token ${req.params.id}:`, error)
    return res.status(500).json({ error: 'Failed to refresh token', message: error.message })
  }
})

module.exports = router
