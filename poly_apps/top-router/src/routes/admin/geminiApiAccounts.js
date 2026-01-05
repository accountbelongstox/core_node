const express = require('express')
const geminiApiAccountService = require('../../services/geminiApiAccountService')
const apiKeyService = require('../../services/apiKeyService')
const accountGroupService = require('../../services/accountGroupService')
const redis = require('../../models/datastore')
const { authenticateAdmin } = require('../../middleware/auth')
const logger = require('../../utils/logger')
const webhookNotifier = require('../../utils/webhookNotifier')

const router = express.Router()

// 获取所有 Gemini-API 账户
router.get('/gemini-api-accounts', authenticateAdmin, async (req, res) => {
  try {
    const { platform, groupId } = req.query
    let accounts = await geminiApiAccountService.getAllAccounts(true)

    // 根据查询参数进行筛选
    if (platform && platform !== 'gemini-api') {
      accounts = []
    }

    // 根据分组ID筛选
    if (groupId) {
      const group = await accountGroupService.getGroup(groupId)
      if (group && group.platform === 'gemini') {
        const groupMembers = await accountGroupService.getGroupMembers(groupId)
        accounts = accounts.filter((account) => groupMembers.includes(account.id))
      } else {
        accounts = []
      }
    }

    // 处理使用统计和绑定的 API Key 数量
    const accountsWithStats = await Promise.all(
      accounts.map(async (account) => {
        // 检查并清除过期的限流状态
        await geminiApiAccountService.checkAndClearRateLimit(account.id)

        // 获取使用统计信息
        let usageStats
        try {
          usageStats = await redis.getAccountUsageStats(account.id, 'gemini-api')
        } catch (error) {
          logger.debug(`Failed to get usage stats for Gemini-API account ${account.id}:`, error)
          usageStats = {
            daily: { requests: 0, tokens: 0, allTokens: 0 },
            total: { requests: 0, tokens: 0, allTokens: 0 },
            monthly: { requests: 0, tokens: 0, allTokens: 0 }
          }
        }

        // 计算绑定的API Key数量（支持 api: 前缀）
        const allKeys = await redis.getAllApiKeys()
        let boundCount = 0

        for (const key of allKeys) {
          if (key.geminiAccountId) {
            // 检查是否绑定了此 Gemini-API 账户（支持 api: 前缀）
            if (key.geminiAccountId === `api:${account.id}`) {
              boundCount++
            }
          }
        }

        // 获取分组信息
        const groupInfos = await accountGroupService.getAccountGroups(account.id)

        return {
          ...account,
          groupInfos,
          usage: {
            daily: usageStats.daily,
            total: usageStats.total,
            averages: usageStats.averages || usageStats.monthly
          },
          boundApiKeys: boundCount
        }
      })
    )

    res.json({ success: true, data: accountsWithStats })
  } catch (error) {
    logger.error('Failed to get Gemini-API accounts:', error)
    res.status(500).json({ success: false, message: error.message })
  }
})

// 创建 Gemini-API 账户
router.post('/gemini-api-accounts', authenticateAdmin, async (req, res) => {
  try {
    const { accountType, groupId, groupIds } = req.body

    // 验证accountType的有效性
    if (accountType && !['shared', 'dedicated', 'group'].includes(accountType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account type. Must be "shared", "dedicated" or "group"'
      })
    }

    // 如果是分组类型，验证groupId或groupIds
    if (accountType === 'group' && !groupId && (!groupIds || groupIds.length === 0)) {
      return res.status(400).json({
        success: false,
        error: 'Group ID or Group IDs are required for group type accounts'
      })
    }

    const account = await geminiApiAccountService.createAccount(req.body)

    // 如果是分组类型，将账户添加到分组
    if (accountType === 'group') {
      if (groupIds && groupIds.length > 0) {
        // 使用多分组设置
        await accountGroupService.setAccountGroups(account.id, groupIds, 'gemini')
      } else if (groupId) {
        // 兼容单分组模式
        await accountGroupService.addAccountToGroup(account.id, groupId, 'gemini')
      }
    }

    logger.success(
      `🏢 Admin created new Gemini-API account: ${account.name} (${accountType || 'shared'})`
    )

    res.json({ success: true, data: account })
  } catch (error) {
    logger.error('Failed to create Gemini-API account:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 获取单个 Gemini-API 账户
router.get('/gemini-api-accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const account = await geminiApiAccountService.getAccount(id)

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    // 隐藏敏感信息
    account.apiKey = '***'

    res.json({ success: true, data: account })
  } catch (error) {
    logger.error('Failed to get Gemini-API account:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 更新 Gemini-API 账户
router.put('/gemini-api-accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const updates = req.body

    // 验证priority的有效性（1-100）
    if (updates.priority !== undefined) {
      const priority = parseInt(updates.priority)
      if (isNaN(priority) || priority < 1 || priority > 100) {
        return res.status(400).json({
          success: false,
          message: 'Priority must be a number between 1 and 100'
        })
      }
    }

    // 验证accountType的有效性
    if (updates.accountType && !['shared', 'dedicated', 'group'].includes(updates.accountType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid account type. Must be "shared", "dedicated" or "group"'
      })
    }

    // 如果更新为分组类型，验证groupId或groupIds
    if (
      updates.accountType === 'group' &&
      !updates.groupId &&
      (!updates.groupIds || updates.groupIds.length === 0)
    ) {
      return res.status(400).json({
        success: false,
        error: 'Group ID or Group IDs are required for group type accounts'
      })
    }

    // 获取账户当前信息以处理分组变更
    const currentAccount = await geminiApiAccountService.getAccount(id)
    if (!currentAccount) {
      return res.status(404).json({
        success: false,
        error: 'Account not found'
      })
    }

    // 处理分组的变更
    if (updates.accountType !== undefined) {
      // 如果之前是分组类型，需要从所有分组中移除
      if (currentAccount.accountType === 'group') {
        await accountGroupService.removeAccountFromAllGroups(id)
      }

      // 如果新类型是分组，添加到新分组
      if (updates.accountType === 'group') {
        // 处理多分组/单分组的兼容性
        if (Object.prototype.hasOwnProperty.call(updates, 'groupIds')) {
          if (updates.groupIds && updates.groupIds.length > 0) {
            // 使用多分组设置
            await accountGroupService.setAccountGroups(id, updates.groupIds, 'gemini')
          }
        } else if (updates.groupId) {
          // 兼容单分组模式
          await accountGroupService.addAccountToGroup(id, updates.groupId, 'gemini')
        }
      }
    }

    const result = await geminiApiAccountService.updateAccount(id, updates)

    if (!result.success) {
      return res.status(400).json(result)
    }

    logger.success(`📝 Admin updated Gemini-API account: ${currentAccount.name}`)

    res.json({ success: true, ...result })
  } catch (error) {
    logger.error('Failed to update Gemini-API account:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 删除 Gemini-API 账户
router.delete('/gemini-api-accounts/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const account = await geminiApiAccountService.getAccount(id)
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    // 自动解绑所有绑定的 API Keys（支持 api: 前缀）
    const unboundCount = await apiKeyService.unbindAccountFromAllKeys(id, 'gemini-api')

    // 从所有分组中移除此账户
    if (account.accountType === 'group') {
      await accountGroupService.removeAccountFromAllGroups(id)
      logger.info(`Removed Gemini-API account ${id} from all groups`)
    }

    const result = await geminiApiAccountService.deleteAccount(id)

    let message = 'Gemini-API账号已成功删除'
    if (unboundCount > 0) {
      message += `，${unboundCount} 个 API Key 已切换为共享池模式`
    }

    logger.success(`✅ ${message}`)

    res.json({
      success: true,
      ...result,
      message,
      unboundKeys: unboundCount
    })
  } catch (error) {
    logger.error('Failed to delete Gemini-API account:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 切换 Gemini-API 账户调度状态
router.put('/gemini-api-accounts/:id/toggle-schedulable', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const result = await geminiApiAccountService.toggleSchedulable(id)

    if (!result.success) {
      return res.status(400).json(result)
    }

    // 仅在停止调度时发送通知
    if (!result.schedulable) {
      await webhookNotifier.sendAccountEvent('account.status_changed', {
        accountId: id,
        platform: 'gemini-api',
        schedulable: result.schedulable,
        changedBy: 'admin',
        action: 'stopped_scheduling'
      })
    }

    res.json(result)
  } catch (error) {
    logger.error('Failed to toggle Gemini-API account schedulable status:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 切换 Gemini-API 账户激活状态
router.put('/gemini-api-accounts/:id/toggle', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const account = await geminiApiAccountService.getAccount(id)
    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Account not found'
      })
    }

    const newActiveStatus = account.isActive === 'true' ? 'false' : 'true'
    await geminiApiAccountService.updateAccount(id, {
      isActive: newActiveStatus
    })

    res.json({
      success: true,
      isActive: newActiveStatus === 'true'
    })
  } catch (error) {
    logger.error('Failed to toggle Gemini-API account status:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 重置 Gemini-API 账户限流状态
router.post('/gemini-api-accounts/:id/reset-rate-limit', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    await geminiApiAccountService.updateAccount(id, {
      rateLimitedAt: '',
      rateLimitStatus: '',
      status: 'active',
      errorMessage: ''
    })

    logger.info(`🔄 Admin manually reset rate limit for Gemini-API account ${id}`)

    res.json({
      success: true,
      message: 'Rate limit reset successfully'
    })
  } catch (error) {
    logger.error('Failed to reset Gemini-API account rate limit:', error)
    res.status(500).json({
      success: false,
      error: error.message
    })
  }
})

// 重置 Gemini-API 账户状态（清除所有异常状态）
router.post('/gemini-api-accounts/:id/reset-status', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params

    const result = await geminiApiAccountService.resetAccountStatus(id)

    logger.success(`✅ Admin reset status for Gemini-API account: ${id}`)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('❌ Failed to reset Gemini-API account status:', error)
    return res.status(500).json({ error: 'Failed to reset status', message: error.message })
  }
})

module.exports = router
