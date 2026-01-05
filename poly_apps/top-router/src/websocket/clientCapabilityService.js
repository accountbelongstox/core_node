/**
 * WebSocket 客户端能力收集服务
 *
 * 功能:
 * - 动态收集客户端支持的平台和账户类型
 * - 统计活跃账户数量
 * - 收集支持的模型列表
 * - 生成完整的注册数据
 */

const logger = require('../utils/logger')
const os = require('os')

// 导入所有账户服务
const claudeAccountService = require('../services/claudeAccountService')
const claudeConsoleAccountService = require('../services/claudeConsoleAccountService')
const geminiAccountService = require('../services/geminiAccountService')
const openaiAccountService = require('../services/openaiAccountService')
const openaiResponsesAccountService = require('../services/openaiResponsesAccountService')
const bedrockAccountService = require('../services/bedrockAccountService')
const azureOpenaiAccountService = require('../services/azureOpenaiAccountService')
const droidAccountService = require('../services/droidAccountService')
const ccrAccountService = require('../services/ccrAccountService')

class ClientCapabilityService {
  constructor() {
    // 平台定义：基于 WebSocket 方案和统一调度器路由表
    this.PLATFORM_DEFINITIONS = {
      claude: {
        accountTypes: ['claude-official', 'claude-console', 'bedrock', 'ccr'],
        services: {
          'claude-official': claudeAccountService,
          'claude-console': claudeConsoleAccountService,
          bedrock: bedrockAccountService,
          ccr: ccrAccountService
        }
      },
      gemini: {
        accountTypes: ['gemini'],
        services: {
          gemini: geminiAccountService
        }
      },
      openai: {
        accountTypes: ['openai', 'openai-responses', 'azure-openai'],
        services: {
          openai: openaiAccountService,
          'openai-responses': openaiResponsesAccountService,
          'azure-openai': azureOpenaiAccountService
        }
      },
      droid: {
        accountTypes: ['droid'],
        services: {
          droid: droidAccountService
        }
      }
    }

    // 常见模型定义（用于没有具体模型配置的账户类型）
    this.COMMON_MODELS = {
      'claude-official': [
        'claude-opus-4-5-20251101',
        'claude-haiku-4-5-20251001',
        'claude-sonnet-4-5-20250929',
        'claude-sonnet-4-5',
        'claude-sonnet-4-20250514',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-haiku-20241022',
        'claude-3-5-sonnet-20241022',
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
        'claude-opus-4-20250514',
        'claude-opus-4-1-20250805'
      ],
      bedrock: [
        'us.anthropic.claude-sonnet-4-20250514-v1:0',
        'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
        'anthropic.claude-3-5-sonnet-20241022-v2:0',
        'anthropic.claude-3-opus-20240229-v1:0',
        'anthropic.claude-3-sonnet-20240229-v1:0',
        'anthropic.claude-3-haiku-20240307-v1:0'
      ],
      gemini: [
        'gemini-3-pro-preview',
        'gemini-2.5-pro',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-pro-latest',
        'gemini-1.5-flash',
        'gemini-1.5-flash-8b'
      ],
      openai: [
        'gpt-5-nano',
        'gpt-5-mini',
        'gpt-5.1-codex-mini',
        'gpt-5.1-codex-max',
        'gpt-5.1-codex',
        'gpt-5.1',
        'gpt-5-codex',
        'gpt-5',
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4-turbo-preview',
        'gpt-4',
        'gpt-3.5-turbo',
        'o1',
        'o1-mini',
        'o1-preview'
      ],
      'openai-responses': ['gpt-4', 'gpt-4-turbo', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'],
      droid: ['claude-3-5-sonnet-20241022', 'gpt-4']
    }

    logger.info('ClientCapabilityService initialized')
  }

  /**
   * 收集客户端能力信息
   * @returns {Promise<Object>} 能力数据
   */
  async collectCapabilities() {
    const supportedPlatforms = []
    const supportedAccountTypes = []
    const activeAccounts = {}

    // 遍历所有平台定义
    for (const [platform, definition] of Object.entries(this.PLATFORM_DEFINITIONS)) {
      let platformHasActiveAccounts = false

      // 遍历该平台下的所有账户类型
      for (const [accountType, service] of Object.entries(definition.services)) {
        try {
          // 获取该类型的所有账户
          const rawAccounts = await service.getAllAccounts()
          const accounts = this._normalizeAccountList(rawAccounts, accountType)

          // 统计活跃账户（isActive='true' 或 true（布尔值） 且 status!='error'）
          const activeCount = accounts.filter(
            (acc) => (acc.isActive === 'true' || acc.isActive === true) && acc.status !== 'error'
          ).length

          if (activeCount > 0) {
            // 记录该账户类型
            supportedAccountTypes.push(accountType)
            activeAccounts[accountType] = activeCount
            platformHasActiveAccounts = true

            logger.debug(`Found ${activeCount} active ${accountType} accounts`)
          }
        } catch (error) {
          logger.warn(`Failed to get accounts for ${accountType}:`, error)
        }
      }

      // 如果该平台下有任何活跃账户，添加到支持的平台列表
      if (platformHasActiveAccounts) {
        supportedPlatforms.push(platform)
      }
    }

    logger.info('Capability collection completed:', {
      platforms: supportedPlatforms.length,
      accountTypes: supportedAccountTypes.length,
      totalAccounts: Object.values(activeAccounts).reduce((a, b) => a + b, 0)
    })

    return {
      supportedPlatforms, // ['claude', 'gemini', 'openai']
      supportedAccountTypes, // ['claude-official', 'gemini', 'openai-responses']
      activeAccounts // { 'claude-official': 5, 'gemini': 2 }
    }
  }

  /**
   * 收集支持的模型列表
   * 策略：优先从账户配置读取 supportedModels，如果所有活跃账户都没有配置，才使用 COMMON_MODELS 作为回退
   * @returns {Promise<Object>} 模型映射表 { 'model-name': true }
   */
  async collectSupportedModels() {
    const models = {}

    /**
     * 辅助函数：从账户的 supportedModels 字段添加模型
     * @param {Object} account - 账户对象
     * @returns {boolean} 是否成功添加了模型
     */
    const addModelsFromAccount = (account) => {
      if (account.supportedModels) {
        if (Array.isArray(account.supportedModels)) {
          // 数组格式：直接添加所有模型
          if (account.supportedModels.length > 0) {
            account.supportedModels.forEach((m) => (models[m] = true))
            return true
          }
        } else if (typeof account.supportedModels === 'object') {
          // 对象映射表格式：添加所有键（客户端请求的模型名）
          const keys = Object.keys(account.supportedModels)
          if (keys.length > 0) {
            keys.forEach((m) => (models[m] = true))
            return true
          }
        }
      }
      return false
    }

    /**
     * 辅助函数：检查账户是否活跃
     * @param {Object} account - 账户对象
     * @returns {boolean}
     */
    const isActiveAccount = (account) =>
      (account.isActive === 'true' || account.isActive === true) && account.status !== 'error'

    try {
      // 1. Claude 官方账户
      const claudeAccounts = this._normalizeAccountList(
        await claudeAccountService.getAllAccounts(),
        'claude-official'
      )
      const activeClaudeAccounts = claudeAccounts.filter(isActiveAccount)
      let hasClaudeModelsConfigured = false

      for (const account of activeClaudeAccounts) {
        if (addModelsFromAccount(account)) {
          hasClaudeModelsConfigured = true
        }
      }

      // 如果没有任何账户配置了模型，使用默认值
      if (!hasClaudeModelsConfigured && activeClaudeAccounts.length > 0) {
        this.COMMON_MODELS['claude-official'].forEach((m) => (models[m] = true))
        logger.debug(
          `Using default models for claude-official (${activeClaudeAccounts.length} accounts)`
        )
      }

      // 2. Claude Console 账户
      const claudeConsoleAccounts = this._normalizeAccountList(
        await claudeConsoleAccountService.getAllAccounts(),
        'claude-console'
      )
      const activeConsoleAccounts = claudeConsoleAccounts.filter(isActiveAccount)
      let hasConsoleModelsConfigured = false

      for (const account of activeConsoleAccounts) {
        if (addModelsFromAccount(account)) {
          hasConsoleModelsConfigured = true
        }
      }

      // Claude Console 通常需要明确配置 supportedModels，没有默认值
      if (hasConsoleModelsConfigured) {
        logger.debug(
          `Collected models from ${activeConsoleAccounts.length} Claude Console accounts`
        )
      }

      // 3. Bedrock 账户
      const bedrockAccounts = this._normalizeAccountList(
        await bedrockAccountService.getAllAccounts(),
        'bedrock'
      )
      const activeBedrockAccounts = bedrockAccounts.filter(isActiveAccount)
      let hasBedrockModelsConfigured = false

      for (const account of activeBedrockAccounts) {
        if (addModelsFromAccount(account)) {
          hasBedrockModelsConfigured = true
        }
      }

      // 如果没有任何账户配置了模型，使用默认值
      if (!hasBedrockModelsConfigured && activeBedrockAccounts.length > 0) {
        this.COMMON_MODELS['bedrock'].forEach((m) => (models[m] = true))
        logger.debug(`Using default models for bedrock (${activeBedrockAccounts.length} accounts)`)
      }

      // 4. CCR 账户
      const ccrAccounts = this._normalizeAccountList(
        await ccrAccountService.getAllAccounts(),
        'ccr'
      )
      const activeCcrAccounts = ccrAccounts.filter(isActiveAccount)
      let hasCcrModelsConfigured = false

      for (const account of activeCcrAccounts) {
        if (addModelsFromAccount(account)) {
          hasCcrModelsConfigured = true
        }
      }

      // CCR 通常需要明确配置 supportedModels，没有默认值
      if (hasCcrModelsConfigured) {
        logger.debug(`Collected models from ${activeCcrAccounts.length} CCR accounts`)
      }

      // 5. Gemini 账户
      const geminiAccounts = this._normalizeAccountList(
        await geminiAccountService.getAllAccounts(),
        'gemini'
      )
      const activeGeminiAccounts = geminiAccounts.filter(isActiveAccount)
      let hasGeminiModelsConfigured = false

      for (const account of activeGeminiAccounts) {
        if (addModelsFromAccount(account)) {
          hasGeminiModelsConfigured = true
        }
      }

      // 如果没有任何账户配置了模型，使用默认值
      if (!hasGeminiModelsConfigured && activeGeminiAccounts.length > 0) {
        this.COMMON_MODELS['gemini'].forEach((m) => (models[m] = true))
        logger.debug(`Using default models for gemini (${activeGeminiAccounts.length} accounts)`)
      }

      // 6. OpenAI 账户（OAuth认证）
      const openaiAccounts = this._normalizeAccountList(
        await openaiAccountService.getAllAccounts(),
        'openai'
      )
      const activeStandardOpenAIAccounts = openaiAccounts.filter(isActiveAccount)
      let hasStandardOpenAIModelsConfigured = false

      for (const account of activeStandardOpenAIAccounts) {
        if (addModelsFromAccount(account)) {
          hasStandardOpenAIModelsConfigured = true
        }
      }

      // 如果没有任何账户配置了模型，使用默认值
      if (!hasStandardOpenAIModelsConfigured && activeStandardOpenAIAccounts.length > 0) {
        this.COMMON_MODELS['openai'].forEach((m) => (models[m] = true))
        logger.debug(
          `Using default models for openai (${activeStandardOpenAIAccounts.length} accounts)`
        )
      }

      // 7. OpenAI Responses 账户
      const openaiResponsesAccounts = this._normalizeAccountList(
        await openaiResponsesAccountService.getAllAccounts(),
        'openai-responses'
      )
      const activeOpenAIAccounts = openaiResponsesAccounts.filter(isActiveAccount)
      let hasOpenAIModelsConfigured = false

      for (const account of activeOpenAIAccounts) {
        if (addModelsFromAccount(account)) {
          hasOpenAIModelsConfigured = true
        }
      }

      // 如果没有任何账户配置了模型，使用默认值
      if (!hasOpenAIModelsConfigured && activeOpenAIAccounts.length > 0) {
        this.COMMON_MODELS['openai-responses'].forEach((m) => (models[m] = true))
        logger.debug(
          `Using default models for openai-responses (${activeOpenAIAccounts.length} accounts)`
        )
      }

      // 8. Azure OpenAI 账户：从配置的部署中读取
      const azureAccounts = this._normalizeAccountList(
        await azureOpenaiAccountService.getAllAccounts(),
        'azure-openai'
      )
      for (const account of azureAccounts) {
        if (isActiveAccount(account) && account.deployments) {
          try {
            const deployments =
              typeof account.deployments === 'string'
                ? JSON.parse(account.deployments)
                : account.deployments

            if (Array.isArray(deployments)) {
              deployments.forEach((d) => {
                if (d.modelName) {
                  models[d.modelName] = true
                }
              })
            }
          } catch (e) {
            logger.debug(`Failed to parse deployments for Azure account ${account.id}`)
          }
        }
      }

      // 9. Droid 账户
      const droidAccounts = this._normalizeAccountList(
        await droidAccountService.getAllAccounts(),
        'droid'
      )
      const activeDroidAccounts = droidAccounts.filter(isActiveAccount)
      let hasDroidModelsConfigured = false

      for (const account of activeDroidAccounts) {
        if (addModelsFromAccount(account)) {
          hasDroidModelsConfigured = true
        }
      }

      // 如果没有任何账户配置了模型，使用默认值
      if (!hasDroidModelsConfigured && activeDroidAccounts.length > 0) {
        this.COMMON_MODELS['droid'].forEach((m) => (models[m] = true))
        logger.debug(`Using default models for droid (${activeDroidAccounts.length} accounts)`)
      }

      logger.debug(`Collected ${Object.keys(models).length} supported models`)
    } catch (error) {
      logger.error('Error collecting supported models:', error)
    }

    return models
  }

  /**
   * 收集完整的注册数据
   * @param {Object} concurrencyManager - 并发管理器实例（可选）
   * @returns {Promise<Object>} 完整的客户端注册信息
   */
  async collectRegistrationData(concurrencyManager = null) {
    try {
      const capabilities = await this.collectCapabilities()
      const supportedModels = await this.collectSupportedModels()

      // 读取配置
      const config = require('../../config/config')
      const vpnConfig = config.vpn || {}
      const vpnEnabled = vpnConfig.enabled === true
      let packageVersion = '1.1.182'

      try {
        const packageJson = require('../../package.json')
        packageVersion = packageJson.version
      } catch (e) {
        logger.debug('Could not read package.json version')
      }

      // 计算当前负载
      const currentLoad = concurrencyManager ? concurrencyManager.getActiveCount() : 0
      const totalAccounts = Object.values(capabilities.activeAccounts).reduce((a, b) => a + b, 0)

      const registrationData = {
        apiKey: config.websocketClient?.clientApiKey || '',
        version: packageVersion,
        capabilities: {
          supportedPlatforms: capabilities.supportedPlatforms,
          supportedAccountTypes: capabilities.supportedAccountTypes,
          supportedModels,
          features: {
            streaming: true,
            promptCaching: true,
            thinkingMode: true,
            toolUse: true,
            vpnTunnel: vpnEnabled
          }
        },
        resources: {
          activeAccounts: capabilities.activeAccounts,
          totalAccounts,
          availableSlots: Math.max(0, totalAccounts - currentLoad),
          maxConcurrency: config.websocketClient?.maxConcurrentRequests || 10
        },
        status: {
          uptime: Math.floor(process.uptime() * 1000), // 毫秒
          currentLoad,
          healthStatus: 'healthy'
        },
        metadata: {
          hostname: os.hostname(),
          platform: os.platform(),
          nodeVersion: process.version,
          region: process.env.CLIENT_REGION || 'unknown'
        }
      }

      if (vpnEnabled) {
        registrationData.capabilities.vpn = {
          mode: 'egress',
          maxConcurrentSessions: vpnConfig.tunnel?.maxConcurrentSessions || 0,
          connectionTimeout: vpnConfig.tunnel?.connectionTimeout || 0,
          idleTimeout: vpnConfig.tunnel?.idleTimeout || 0,
          dataTimeout: vpnConfig.tunnel?.dataTimeout || 0,
          bufferHighWaterMark: vpnConfig.buffers?.highWaterMark || 0,
          bufferPoolSize: vpnConfig.buffers?.poolSize || 0,
          metricsEnabled: vpnConfig.metrics?.enabled !== false
        }

        registrationData.resources.vpn = {
          maxConcurrentSessions: vpnConfig.tunnel?.maxConcurrentSessions || 0,
          reconnectGracePeriod: vpnConfig.tunnel?.reconnectGracePeriod || 0
        }
      }

      logger.info('Registration data collected successfully')
      return registrationData
    } catch (error) {
      logger.error('Error collecting registration data:', error)
      throw error
    }
  }

  /**
   * 统一处理不同账户服务返回的数据结构
   * @param {Array|Object|null} rawResult - 账户服务返回值
   * @param {string} accountType - 当前处理的账户类型
   * @returns {Array} 账户列表
   */
  _normalizeAccountList(rawResult, accountType = 'unknown') {
    if (Array.isArray(rawResult)) {
      return rawResult
    }

    if (rawResult && typeof rawResult === 'object') {
      if (rawResult.success === false && rawResult.error) {
        logger.warn(
          `Account service ${accountType} returned unsuccessful result: ${rawResult.error}`
        )
      }

      if (Array.isArray(rawResult.data)) {
        return rawResult.data
      }

      if (Array.isArray(rawResult.accounts)) {
        return rawResult.accounts
      }
    }

    if (rawResult === null) {
      return []
    }

    const details =
      typeof rawResult === 'object'
        ? Object.keys(rawResult).join(',') || 'object'
        : typeof rawResult

    logger.warn(
      `Account service ${accountType} returned unexpected response format (${details}), defaulting to empty list`
    )
    return []
  }

  /**
   * 计算可用插槽数（总账户数 - 当前活跃请求数）
   * @param {Object} activeAccounts - 活跃账户统计
   * @param {number} currentLoad - 当前负载
   * @returns {number}
   */
  calculateAvailableSlots(activeAccounts, currentLoad = 0) {
    const totalAccounts = Object.values(activeAccounts).reduce((a, b) => a + b, 0)
    return Math.max(0, totalAccounts - currentLoad)
  }

  /**
   * 生成状态更新消息数据
   * @param {string} clientId - 客户端ID
   * @param {Object} concurrencyManager - 并发管理器实例
   * @returns {Promise<Object>} 状态更新数据
   */
  async collectStatusUpdate(clientId, concurrencyManager = null) {
    try {
      const capabilities = await this.collectCapabilities()
      const currentLoad = concurrencyManager ? concurrencyManager.getActiveCount() : 0
      const totalAccounts = Object.values(capabilities.activeAccounts).reduce((a, b) => a + b, 0)

      return {
        clientId,
        timestamp: Date.now(),
        resources: {
          activeAccounts: capabilities.activeAccounts,
          totalAccounts,
          availableSlots: Math.max(0, totalAccounts - currentLoad),
          currentLoad,
          healthStatus: 'healthy'
        }
      }
    } catch (error) {
      logger.error('Error collecting status update:', error)
      return {
        clientId,
        timestamp: Date.now(),
        resources: {
          activeAccounts: {},
          totalAccounts: 0,
          availableSlots: 0,
          currentLoad: 0,
          healthStatus: 'error'
        }
      }
    }
  }
}

// 创建单例实例
const clientCapabilityService = new ClientCapabilityService()

module.exports = clientCapabilityService
