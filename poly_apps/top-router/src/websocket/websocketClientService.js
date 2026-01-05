/**
 * WebSocket 客户端服务（核心）
 *
 * 功能:
 * - WebSocket 连接管理
 * - 断线重连（指数退避算法）
 * - 心跳保活（响应 PING，发送 PONG）
 * - 客户端注册
 * - 消息处理和路由
 * - 状态管理和监控
 */

const WebSocket = require('ws')
const { v4: uuidv4 } = require('uuid')
const { SocksProxyAgent } = require('socks-proxy-agent')
const { HttpsProxyAgent } = require('https-proxy-agent')
const logger = require('../utils/logger')
const { callLocalApi } = require('./requestByApi')
const ConcurrencyManager = require('./concurrencyManager')
const RequestQueue = require('./requestQueue')
const clientCapabilityService = require('./clientCapabilityService')
const websocketMonitorService = require('./websocketMonitorService')
const WebSocketRequestHandler = require('./websocketRequestHandler')
const translationStatsService = require('../translation/translationStatsService')
const { getSystemHealth } = require('./systemHealth')

class WebSocketClientService {
  constructor(config) {
    this.config = config
    this.wsConfig = config.websocketClient

    this.ws = null
    this.clientId = null
    this.reconnectAttempts = 0
    this.reconnectTimer = null
    this.reconnectDelayOverride = null
    this.heartbeatTimer = null
    this.heartbeatTimeout = null
    this.periodicConnectTimer = null
    this.isConnecting = false
    this.shouldReconnect = true
    this.isRegistered = false
    this.wasConnected = false
    this.connectionErrorCount = 0
    this.lastConnectionErrorAt = 0
    this.errorLogThrottleMs = this.config?.logging?.websocket?.errorThrottleMs || 60000
    this.vpnRuntime = null
    this.concurrencyManager = null
    this.requestQueue = null
    this.requestHandler = null
    this.oauthSessions = new Map() // 存储 OAuth 会话数据 (sessionId -> { codeVerifier, redirectUri, accountType, proxy })

    // 检查是否启用
    if (!this.wsConfig?.enabled) {
      logger.info('WebSocket client is disabled')
      return
    }

    // 检查必需配置
    if (!this.wsConfig.clientApiKey) {
      logger.error('WebSocket client API key is not configured. Please set WS_CLIENT_API_KEY.')
      this.wsConfig.enabled = false
      return
    }

    // 初始化管理器
    this.concurrencyManager = new ConcurrencyManager(this.wsConfig.maxConcurrentRequests)
    this.requestQueue = new RequestQueue()
    this.requestHandler = new WebSocketRequestHandler(
      this,
      config,
      this.concurrencyManager,
      websocketMonitorService
    )

    logger.info('WebSocketClientService initialized', {
      serverUrl: this.wsConfig.serverUrl,
      maxConcurrent: this.wsConfig.maxConcurrentRequests
    })
  }

  /**
   * 启动 WebSocket 客户端
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.wsConfig?.enabled) {
      logger.info('WebSocket client is disabled, skipping start')
      return
    }

    if (!this.wsConfig.clientApiKey) {
      logger.warn('WebSocket client API key not configured, cannot start')
      return
    }

    logger.info('Starting WebSocket client...')
    await this.connect()

    // 启动定期连接检查
    this.startPeriodicConnectionCheck()
  }

  /**
   * 建立 WebSocket 连接
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      logger.debug('Already connecting or connected')
      return
    }

    this.isConnecting = true

    try {
      const wsOptions = {
        handshakeTimeout: 10000
      }

      // 配置代理
      if (this.wsConfig.proxy?.enabled) {
        wsOptions.agent = this.createProxyAgent()
      }

      logger.debug(`Connecting to WebSocket server: ${this.wsConfig.serverUrl}`)

      this.ws = new WebSocket(this.wsConfig.serverUrl, wsOptions)

      this.ws.on('open', () => this.handleOpen())
      this.ws.on('message', (data) => this.handleMessage(data))
      this.ws.on('error', (error) => this.handleError(error))
      this.ws.on('close', (code, reason) => this.handleClose(code, reason))
    } catch (error) {
      logger.error('Failed to create WebSocket connection:', error)
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  /**
   * 创建代理代理
   * @returns {Agent}
   */
  createProxyAgent() {
    const { host, port, auth } = this.wsConfig.proxy
    const proxyUrl = `socks5://${auth ? `${auth}@` : ''}${host}:${port}`

    logger.debug(`Creating proxy agent: ${proxyUrl}`)

    try {
      return new SocksProxyAgent(proxyUrl)
    } catch (error) {
      logger.warn('Failed to create SOCKS proxy, trying HTTP proxy:', error)
      const httpProxyUrl = `http://${auth ? `${auth}@` : ''}${host}:${port}`
      return new HttpsProxyAgent(httpProxyUrl)
    }
  }

  /**
   * 处理连接打开事件
   */
  async handleOpen() {
    logger.info('WebSocket connected')
    this.isConnecting = false
    this.reconnectAttempts = 0
    this.isRegistered = false
    this.wasConnected = true
    this.connectionErrorCount = 0
    this.lastConnectionErrorAt = 0

    // 更新监控状态
    await websocketMonitorService.updateConnectionStatus('temp-client', 'connected', {
      connectedAt: Date.now(),
      reconnectCount: 0
    })

    // 发送注册消息
    await this.sendRegistration()
  }

  /**
   * 处理接收到的消息
   * @param {Buffer|String} data - 消息数据
   */
  async handleMessage(data) {
    try {
      // 尝试将数据解析为 JSON 文本消息
      let message
      let isBinary = false

      if (Buffer.isBuffer(data)) {
        // 尝试解析为 JSON（文本消息）
        try {
          const text = data.toString('utf8')
          message = JSON.parse(text)
          // 成功解析为 JSON，说明是文本消息
        } catch (parseError) {
          // 解析失败，说明是真正的二进制帧（VPN 帧）
          isBinary = true
        }
      } else if (typeof data === 'string') {
        // 字符串类型，直接解析
        message = JSON.parse(data)
        isBinary = false
      } else {
        // 其他类型，尝试转换为字符串后解析
        message = JSON.parse(data.toString())
        isBinary = false
      }

      // 如果是二进制帧，走二进制处理流程
      if (isBinary) {
        await this.handleBinaryMessage(data)
        return
      }

      logger.debug(`Received message type: ${message.type}`)

      // 增加接收消息计数
      if (this.clientId) {
        await websocketMonitorService.incrementMessageCount(this.clientId, 'received')
      }

      const isVpnControlMessage =
        typeof message?.type === 'string' &&
        (message.type.startsWith('vpn_') || message.type.startsWith('tunnel_'))

      if (isVpnControlMessage) {
        if (this.vpnRuntime) {
          await this.vpnRuntime.handleControlMessage(message)
        } else {
          logger.warn(`Received VPN message (${message.type}) but VPN runtime is not configured`)
        }
        return
      }

      // 路由消息处理
      switch (message.type) {
        case 'ping':
          await this.handlePing(message)
          break

        case 'register_ack':
          await this.handleRegisterAck(message)
          break

        case 'register_error':
          await this.handleRegisterError(message)
          break

        case 'request':
          await this.handleRequest(message)
          break

        case 'disconnect':
          await this.handleDisconnectRequest(message)
          break

        // 配置管理消息
        case 'config_update':
          await this.handleConfigUpdate(message)
          break

        // 账户管理消息
        case 'add_account':
          await this.handleAddAccount(message)
          break

        case 'update_account':
          await this.handleUpdateAccount(message)
          break

        case 'delete_account':
          await this.handleDeleteAccount(message)
          break

        // OAuth 管理消息
        case 'generate_oauth_url':
          await this.handleGenerateOAuthUrl(message)
          break

        case 'exchange_oauth_code':
          await this.handleExchangeOAuthCode(message)
          break

        // 系统健康查询消息
        case 'query_system_health':
          await this.handleQuerySystemHealth(message)
          break

        default:
          logger.warn(`Unknown message type: ${message.type}`)
      }
    } catch (error) {
      logger.error('Error handling message:', error)
    }
  }

  async handleBinaryMessage(buffer) {
    try {
      if (this.vpnRuntime) {
        await this.vpnRuntime.handleBinaryFrame(buffer)
      } else {
        logger.warn('Received binary frame but VPN runtime is not configured')
      }
    } catch (error) {
      logger.error('Error handling binary message:', error)
    }
  }

  /**
   * 处理 PING 消息
   * @param {Object} message - PING 消息
   */
  async handlePing(message) {
    logger.debug('Received PING, sending PONG')

    // 构造 PONG 响应（包含负载数据）
    const stats = this.concurrencyManager.getStats()

    await this.sendMessage({
      type: 'pong',
      data: {
        requestTime: message.timestamp,
        stats: {
          activeRequests: stats.activeRequests,
          queueLength: this.requestQueue.getQueueSize(),
          memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024), // MB
          uptime: Math.floor(process.uptime())
        }
      }
    })

    // 更新心跳时间
    if (this.clientId) {
      await websocketMonitorService.updateHeartbeat(this.clientId, message.timestamp)
    }
  }

  /**
   * 处理注册成功响应
   * @param {Object} message - 注册响应消息
   */
  async handleRegisterAck(message) {
    this.clientId = message.data.clientId
    this.isRegistered = true

    logger.info(`Registration successful, client ID: ${this.clientId}`)

    // 设置监控服务的 client ID
    websocketMonitorService.setClientId(this.clientId)

    // 更新连接状态
    await websocketMonitorService.updateConnectionStatus(this.clientId, 'connected', {
      connectedAt: Date.now(),
      registrationTime: message.timestamp,
      serverVersion: message.data.serverVersion
    })
    await websocketMonitorService.clearTempClientStatus()

    // 启动翻译统计报告（如果启用）
    if (this.config.translation?.enabled) {
      const reportInterval = this.config.translation.statsReportInterval || 5
      translationStatsService.startPeriodicReport(this, reportInterval)
      logger.info(`Translation stats reporting enabled (interval: ${reportInterval}min)`)
    }
  }

  /**
   * 处理注册失败响应
   * @param {Object} message - 注册错误消息
   */
  async handleRegisterError(message) {
    const { errorCode, message: errorMessage } = message.data
    logger.error(`Registration failed: ${errorCode} - ${errorMessage}`)

    // 认证失败，不再重连
    if (errorCode === 'AUTH_FAILED' || errorCode === 'INVALID_API_KEY') {
      this.shouldReconnect = false
      logger.error('Authentication failed, stopping reconnection attempts')
      this.disconnect({ allowReconnect: false })
    }
  }

  /**
   * 处理请求消息
   * @param {Object} message - 请求消息
   */
  async handleRequest(message) {
    const { requestId } = message.data
    logger.info(`Received request: ${requestId}, service: ${message.data.service}`)

    // 将请求加入队列处理
    this.requestQueue
      .enqueue(message, async (msg) => {
        await this.requestHandler.handleRequest(msg)
      })
      .catch((error) => {
        logger.error(`Failed to process request ${requestId}:`, error)
      })
  }

  /**
   * 处理断开连接请求
   * @param {Object} message - 断开请求消息
   */
  async handleDisconnectRequest(message = {}) {
    const { data = {} } = message
    const { reason = 'server_request', allowReconnect = true, retryAfter } = data
    const normalizedRetryAfter =
      typeof retryAfter === 'number' && retryAfter >= 0 ? retryAfter : null

    logger.info('Received disconnect request from server', {
      reason,
      allowReconnect,
      retryAfter: normalizedRetryAfter
    })

    if (allowReconnect && normalizedRetryAfter !== null) {
      // 重置退避参数并使用服务端提供的延迟
      this.reconnectAttempts = 0
      this.reconnectDelayOverride = normalizedRetryAfter
    }

    this.disconnect({ allowReconnect })
  }

  /**
   * 处理错误事件
   * @param {Error} error - 错误对象
   */
  handleError(error) {
    this.connectionErrorCount += 1
    const now = Date.now()
    const shouldLog =
      this.connectionErrorCount === 1 || now - this.lastConnectionErrorAt >= this.errorLogThrottleMs
    const level = shouldLog ? 'warn' : 'debug'
    const message = error?.message ? `WebSocket error: ${error.message}` : 'WebSocket error'
    const details = {
      code: error?.code,
      errno: error?.errno,
      syscall: error?.syscall,
      address: error?.address,
      port: error?.port
    }

    logger[level](message, details)

    if (shouldLog) {
      this.lastConnectionErrorAt = now
    }
  }

  /**
   * 处理连接关闭事件
   * @param {number} code - 关闭代码
   * @param {string} reason - 关闭原因
   */
  async handleClose(code, reason) {
    const logLevel = this.wasConnected ? 'info' : 'debug'
    logger[logLevel](`WebSocket closed: code=${code}, reason=${reason}`)

    this.isConnecting = false
    this.isRegistered = false
    this.wasConnected = false

    // 更新监控状态
    if (this.clientId) {
      await websocketMonitorService.updateConnectionStatus(this.clientId, 'disconnected', {
        closeCode: code,
        closeReason: reason.toString()
      })
    }

    // 清理定时器
    this.clearTimers()

    // 如果应该重连，则安排重连
    if (this.shouldReconnect) {
      this.scheduleReconnect()
    }
  }

  /**
   * 安排重连
   * @param {Object} options - 可选重连参数
   * @param {boolean} options.resetAttempts - 是否重置退避计数
   * @param {number|null} options.customDelay - 指定自定义延迟（毫秒）
   */
  scheduleReconnect(options = {}) {
    if (this.reconnectTimer) {
      return
    }

    const { resetAttempts = false, customDelay = null } = options
    const reconnectConfig = this.wsConfig.reconnect || {}
    const {
      maxRetries = -1,
      initialDelay = 1000,
      maxDelay = 60000,
      backoffMultiplier = 1.5
    } = reconnectConfig

    if (resetAttempts) {
      this.reconnectAttempts = 0
    }

    // 检查是否达到最大重试次数（-1 表示无限重试）
    if (maxRetries !== -1 && this.reconnectAttempts >= maxRetries) {
      logger.error(`Max reconnect attempts (${maxRetries}) reached, stopping`)
      this.shouldReconnect = false
      return
    }

    let delay = customDelay

    if (delay === null && typeof this.reconnectDelayOverride === 'number') {
      delay = this.reconnectDelayOverride
      this.reconnectDelayOverride = null
    }

    if (delay === null) {
      delay = Math.min(initialDelay * Math.pow(backoffMultiplier, this.reconnectAttempts), maxDelay)
    }

    const attempt = this.reconnectAttempts + 1
    const logLevel = attempt === 1 ? 'info' : 'debug'
    logger[logLevel](`Scheduling reconnect attempt ${attempt} in ${delay}ms`)

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null
      this.reconnectAttempts++

      // 记录重连事件
      if (this.clientId) {
        await websocketMonitorService.recordReconnect(this.clientId, this.reconnectAttempts, false)
      }

      await this.connect()
    }, delay)
  }

  /**
   * 发送注册消息
   */
  async sendRegistration() {
    try {
      logger.info('Sending registration message...')

      // 收集注册数据
      const registrationData = await clientCapabilityService.collectRegistrationData(
        this.concurrencyManager
      )

      await this.sendMessage({
        type: 'register',
        data: registrationData
      })

      logger.debug('Registration message sent')
    } catch (error) {
      logger.error('Failed to send registration:', error)
      this.disconnect({ allowReconnect: true })
      this.scheduleReconnect({ resetAttempts: true })
    }
  }

  /**
   * 发送消息
   * @param {Object} message - 消息对象
   * @returns {Promise<void>}
   */
  async sendMessage(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    // 添加消息ID和时间戳（如果没有）
    if (!message.id) {
      message.id = uuidv4()
    }
    if (!message.timestamp) {
      message.timestamp = Date.now()
    }

    const messageStr = JSON.stringify(message)
    this.ws.send(messageStr)

    // 增加发送消息计数
    if (this.clientId) {
      await websocketMonitorService.incrementMessageCount(this.clientId, 'sent')
    }

    logger.debug(`Sent message type: ${message.type}, id: ${message.id}`)
  }

  async sendBinary(buffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket is not connected')
    }

    if (!Buffer.isBuffer(buffer)) {
      throw new TypeError('Binary payload must be a Buffer')
    }

    await new Promise((resolve, reject) => {
      this.ws.send(buffer, { binary: true }, (error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })

    if (this.clientId) {
      await websocketMonitorService.incrementMessageCount(this.clientId, 'sent')
    }
  }

  /**
   * 断开连接
   * @param {Object} options - 断开参数
   * @param {boolean} options.allowReconnect - 是否允许断开后继续重连
   */
  disconnect(options = {}) {
    const { allowReconnect = false } = options

    logger.info('Disconnecting WebSocket...', { allowReconnect })

    this.shouldReconnect = allowReconnect
    this.clearTimers()

    // 停止翻译统计报告（如果启用）
    if (this.config.translation?.enabled) {
      translationStatsService.stopPeriodicReport()
    }

    if (this.ws) {
      this.ws.close()
      this.ws = null
    }

    this.isConnecting = false
    this.isRegistered = false
  }

  /**
   * 手动重连
   */
  async reconnect() {
    logger.info('Manual reconnect requested')

    this.shouldReconnect = true
    this.reconnectAttempts = 0

    if (this.ws) {
      this.disconnect({ allowReconnect: true })
    }

    await this.connect()
  }

  /**
   * 启动定期连接检查
   */
  startPeriodicConnectionCheck() {
    // 获取配置的检查间隔，默认30秒
    const checkInterval = this.wsConfig.periodicConnectInterval || 30000

    if (this.periodicConnectTimer) {
      clearInterval(this.periodicConnectTimer)
    }

    logger.debug(`Starting periodic connection check (interval: ${checkInterval}ms)`)

    this.periodicConnectTimer = setInterval(async () => {
      // 检查条件：启用状态 && 有API Key && 应该重连 && 未连接 && 未正在连接
      if (
        this.wsConfig?.enabled &&
        this.wsConfig.clientApiKey &&
        this.shouldReconnect &&
        (!this.ws || this.ws.readyState !== WebSocket.OPEN) &&
        !this.isConnecting &&
        !this.reconnectTimer
      ) {
        logger.debug('Periodic connection check: WebSocket not connected, attempting to connect...')
        try {
          await this.connect()
        } catch (error) {
          logger.debug('Periodic connection check failed:', { message: error?.message })
        }
      }
    }, checkInterval)
  }

  /**
   * 停止定期连接检查
   */
  stopPeriodicConnectionCheck() {
    if (this.periodicConnectTimer) {
      clearInterval(this.periodicConnectTimer)
      this.periodicConnectTimer = null
      logger.debug('Periodic connection check stopped')
    }
  }

  /**
   * 清理定时器
   */
  clearTimers() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout)
      this.heartbeatTimeout = null
    }

    if (this.periodicConnectTimer) {
      clearInterval(this.periodicConnectTimer)
      this.periodicConnectTimer = null
    }
  }

  /**
   * 处理配置更新消息
   * @param {Object} message - 配置更新消息
   */
  async handleConfigUpdate(message) {
    const payload = message?.data || {}
    const config = payload.config || {}
    const { applyImmediately } = payload

    logger.info('Received config update from Service', {
      applyImmediately,
      configKeys: Object.keys(config)
    })

    try {
      const errorMessage = 'Dynamic config updates are disabled on this client'
      await this.sendMessage({
        type: 'config_ack',
        id: uuidv4(),
        timestamp: Date.now(),
        data: {
          success: false,
          appliedConfig: null,
          requiresRestart: false,
          errors: [errorMessage]
        }
      })
    } catch (error) {
      logger.error('Failed to respond to config update:', error)

      await this.sendMessage({
        type: 'config_ack',
        id: uuidv4(),
        timestamp: Date.now(),
        data: {
          success: false,
          requiresRestart: false,
          errors: [error.message]
        }
      })
    }
  }

  /**
   * 处理添加账户消息
   * @param {Object} message - 添加账户消息
   */
  async handleAddAccount(message) {
    const { accountType, accountData } = message.data

    logger.info('Received add_account request', { accountType, name: accountData.name })

    try {
      // 获取对应的账户服务
      const accountService = this.getAccountService(accountType)

      // 调用账户服务创建账户
      const newAccount = await accountService.createAccount(accountData)

      // 发送操作结果
      await this.sendMessage({
        type: 'account_operation_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          operation: 'add_account',
          success: true,
          accountId: newAccount.id,
          message: `账户 ${accountData.name} 添加成功`,
          errors: []
        }
      })

      logger.info('Account added successfully via WebSocket', {
        accountType,
        accountId: newAccount.id
      })

      // 🔄 账户创建后，立即发送能力更新通知给 Service 端
      await this.sendCapabilityUpdate()
    } catch (error) {
      logger.error('Failed to add account:', error)

      // 发送错误响应
      await this.sendMessage({
        type: 'account_operation_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          operation: 'add_account',
          success: false,
          message: '账户添加失败',
          errors: [error.message]
        }
      })
    }
  }

  /**
   * 处理更新账户消息
   * @param {Object} message - 更新账户消息
   */
  async handleUpdateAccount(message) {
    const { accountId, accountType, updates } = message.data

    logger.info('Received update_account request', { accountType, accountId })

    try {
      // 获取对应的账户服务
      const accountService = this.getAccountService(accountType)

      // 调用账户服务更新账户
      await accountService.updateAccount(accountId, updates)

      // 发送操作结果
      await this.sendMessage({
        type: 'account_operation_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          operation: 'update_account',
          success: true,
          accountId,
          message: '账户更新成功',
          errors: []
        }
      })

      logger.info('Account updated successfully via WebSocket', {
        accountType,
        accountId
      })

      // 🔄 账户更新后，发送能力更新通知（状态可能影响可用性）
      await this.sendCapabilityUpdate()
    } catch (error) {
      logger.error('Failed to update account:', error)

      // 发送错误响应
      await this.sendMessage({
        type: 'account_operation_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          operation: 'update_account',
          success: false,
          accountId,
          message: '账户更新失败',
          errors: [error.message]
        }
      })
    }
  }

  /**
   * 处理删除账户消息
   * @param {Object} message - 删除账户消息
   */
  async handleDeleteAccount(message) {
    const { accountId, accountType } = message.data

    logger.info('Received delete_account request', { accountType, accountId })

    try {
      // 获取对应的账户服务
      const accountService = this.getAccountService(accountType)

      // 调用账户服务删除账户
      await accountService.deleteAccount(accountId)

      // 发送操作结果
      await this.sendMessage({
        type: 'account_operation_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          operation: 'delete_account',
          success: true,
          accountId,
          message: '账户删除成功',
          errors: []
        }
      })

      logger.info('Account deleted successfully via WebSocket', {
        accountType,
        accountId
      })

      // 🔄 账户删除后，发送能力更新通知（可用账户数量变化）
      await this.sendCapabilityUpdate()
    } catch (error) {
      logger.error('Failed to delete account:', error)

      // 发送错误响应
      await this.sendMessage({
        type: 'account_operation_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          operation: 'delete_account',
          success: false,
          accountId,
          message: '账户删除失败',
          errors: [error.message]
        }
      })
    }
  }

  /**
   * 处理生成 OAuth URL 消息
   * @param {Object} message - OAuth URL 生成请求消息
   */
  async handleGenerateOAuthUrl(message) {
    const { accountType, proxy } = message.data || {}
    const normalizedAccountType = this._normalizeAccountType(accountType)

    if (!normalizedAccountType) {
      await this.sendMessage({
        type: 'oauth_url_result',
        id: message.id,
        timestamp: Date.now(),
        data: { success: false, error: 'accountType is required' }
      })
      return
    }

    logger.info('Received generate_oauth_url request', { accountType: normalizedAccountType })

    try {
      const endpoint = this._resolveOAuthEndpoint(normalizedAccountType, 'generate')
      const result = await this._callAdminApi(endpoint, {
        proxy: proxy || null
      })

      const { authUrl, sessionId, redirectUri, state, deviceCode, userCode, interval } = result

      if (sessionId) {
        this.oauthSessions.set(sessionId, {
          accountType: normalizedAccountType,
          createdAt: Date.now()
        })
      }

      await this.sendMessage({
        type: 'oauth_url_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          success: true,
          authUrl,
          sessionId,
          redirectUri,
          state,
          // Droid Device Flow 特有字段（其他平台为 undefined）
          deviceCode,
          userCode,
          interval
        }
      })

      logger.info('OAuth URL generated successfully', { sessionId, accountType })
    } catch (error) {
      logger.error('Failed to generate OAuth URL:', error)

      // 发送错误响应
      await this.sendMessage({
        type: 'oauth_url_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          success: false,
          error: error.message
        }
      })
    }
  }

  /**
   * 处理交换 OAuth Code 消息
   * @param {Object} message - OAuth Code 交换请求消息
   */
  async handleExchangeOAuthCode(message) {
    const { sessionId, code, accountData } = message.data

    logger.info('Received exchange_oauth_code request', { sessionId })

    try {
      const cached = sessionId ? this.oauthSessions.get(sessionId) : null
      const normalizedAccountType = this._normalizeAccountType(
        accountData?.accountType || cached?.accountType
      )
      const endpoint = this._resolveOAuthEndpoint(normalizedAccountType, 'exchange')
      const payload = this._buildOAuthExchangeBody(normalizedAccountType, {
        sessionId,
        code,
        accountData: accountData || {}
      })
      const exchangeResult = await this._callAdminApi(endpoint, payload)

      if (sessionId) {
        this.oauthSessions.delete(sessionId)
      }

      await this.sendMessage({
        type: 'oauth_exchange_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          success: true,
          accountId: exchangeResult.accountId,
          accountName: exchangeResult.accountName || exchangeResult.accountId,
          message: exchangeResult.message || 'OAuth exchange succeeded'
        }
      })

      logger.info('OAuth code exchanged successfully', {
        sessionId,
        accountType: normalizedAccountType
      })

      // 🔄 账户创建后，立即发送能力更新通知给 Service 端
      await this.sendCapabilityUpdate()
    } catch (error) {
      logger.error('Failed to exchange OAuth code:', error)

      // 发送错误响应
      await this.sendMessage({
        type: 'oauth_exchange_result',
        id: message.id,
        timestamp: Date.now(),
        data: {
          success: false,
          error: error.message
        }
      })
    }
  }

  _normalizeAccountType(accountType) {
    const t = (accountType || '').toLowerCase()
    if (['claude', 'claude-official', 'claude_console', 'claude-console'].includes(t)) {
      return 'claude'
    }
    if (t === 'gemini' || t === 'gemini-api') {
      return 'gemini'
    }
    if (t === 'openai' || t === 'azure-openai' || t === 'openai-responses') {
      return 'openai'
    }
    if (t === 'droid') {
      return 'droid'
    }
    return t
  }

  _resolveOAuthEndpoint(accountType, action) {
    const segmentMap = {
      claude: 'claude-accounts',
      gemini: 'gemini-accounts',
      openai: 'openai-accounts',
      droid: 'droid-accounts'
    }
    const segment = segmentMap[accountType]
    if (!segment) {
      throw new Error(`Unsupported OAuth account type: ${accountType || 'unknown'}`)
    }
    if (action === 'generate') {
      return `/admin/${segment}/generate-auth-url`
    }
    if (action === 'exchange') {
      return `/admin/${segment}/exchange-code`
    }
    throw new Error(`Unsupported OAuth action: ${action}`)
  }

  _buildOAuthExchangeBody(accountType, payload) {
    const { sessionId, code, accountData } = payload
    const base = { sessionId }
    if (accountType === 'claude') {
      const trimmed = typeof code === 'string' ? code.trim() : ''
      return { ...base, callbackUrl: trimmed }
    }
    if (accountType === 'droid') {
      return { ...base, proxy: accountData?.proxy || null }
    }
    return {
      ...base,
      code: typeof code === 'string' ? code.trim() : code,
      proxy: accountData?.proxy || null
    }
  }

  async _callAdminApi(endpoint, body) {
    const headers = this._withInternalHeader()
    const result = await callLocalApi({
      endpoint,
      method: 'POST',
      headers,
      body
    }).then((resp) => resp.body || resp)

    if (
      result &&
      typeof result === 'object' &&
      Object.prototype.hasOwnProperty.call(result, 'success')
    ) {
      if (result.success === false) {
        throw new Error(result.message || result.error || 'Local admin request failed')
      }
      return result.data !== undefined ? result.data : result
    }
    return result
  }

  _withInternalHeader(headers = {}) {
    const headerKey = 'x-ws-internal-key'
    const hasHeader = Object.keys(headers).some((key) => key.toLowerCase() === headerKey)
    if (hasHeader) {
      return headers
    }
    if (!this.wsConfig?.clientApiKey) {
      return headers
    }
    return {
      ...headers,
      [headerKey]: this.wsConfig.clientApiKey
    }
  }

  /**
   * 处理系统健康查询消息
   * @param {Object} message - 系统健康查询消息
   */
  async handleQuerySystemHealth(message) {
    logger.info('Received query_system_health request from Service')

    try {
      // 获取系统健康状态信息
      const systemHealth = getSystemHealth()

      // 发送系统健康响应
      await this.sendMessage({
        type: 'system_health_info',
        id: message.id,
        timestamp: Date.now(),
        data: {
          ...systemHealth,
          clientId: this.clientId
        }
      })

      logger.info('System health info sent successfully')
    } catch (error) {
      logger.error('Failed to collect system health info:', error)

      // 发送错误响应
      await this.sendMessage({
        type: 'system_health_info',
        id: message.id,
        timestamp: Date.now(),
        data: {
          error: error.message,
          clientId: this.clientId,
          timestamp: new Date().toISOString()
        }
      })
    }
  }

  /**
   * 根据账户类型获取对应的账户服务
   * @param {string} accountType - 账户类型
   * @returns {Object} 账户服务实例
   */
  getAccountService(accountType) {
    switch (accountType) {
      case 'claude-official':
      case 'claude-console':
        return require('../services/claudeAccountService')

      case 'gemini':
        return require('../services/geminiAccountService')

      case 'gemini-api':
        return require('../services/geminiApiAccountService')

      case 'openai':
        return require('../services/openaiAccountService')

      case 'openai-responses':
        return require('../services/openaiResponsesAccountService')

      case 'bedrock':
        return require('../services/bedrockAccountService')

      case 'azure-openai':
        return require('../services/azureOpenaiAccountService')

      case 'droid':
        return require('../services/droidAccountService')

      case 'ccr':
        return require('../services/ccrAccountService')

      default:
        throw new Error(`Unsupported account type: ${accountType}`)
    }
  }

  /**
   * 获取连接状态
   * @returns {Object}
   */
  getStatus() {
    const concurrencyStats = this.concurrencyManager
      ? this.concurrencyManager.getStats()
      : { activeRequests: 0, maxConcurrency: this.wsConfig?.maxConcurrentRequests || 0 }
    const queueStats = this.requestQueue ? this.requestQueue.getStats() : { size: 0, pending: 0 }

    return {
      enabled: this.wsConfig?.enabled || false,
      connected: this.ws?.readyState === WebSocket.OPEN,
      registered: this.isRegistered,
      clientId: this.clientId,
      reconnectAttempts: this.reconnectAttempts,
      concurrency: concurrencyStats,
      queue: queueStats,
      vpn: this.vpnRuntime ? this.vpnRuntime.getStatus() : { enabled: false }
    }
  }

  setVpnRuntime(vpnRuntime) {
    this.vpnRuntime = vpnRuntime

    if (this.vpnRuntime && typeof this.vpnRuntime.attachWebSocketClient === 'function') {
      this.vpnRuntime.attachWebSocketClient(this)
    }
  }

  /**
   * 发送能力更新通知给 Service 端
   * @returns {Promise<void>}
   */
  async sendCapabilityUpdate() {
    try {
      if (!this.clientId || !this.isRegistered) {
        logger.debug('Client not registered, skipping capability update')
        return
      }

      logger.info('Sending capability update to Service...')

      // 收集最新的能力数据
      const capabilities = await clientCapabilityService.collectCapabilities()
      const supportedModels = await clientCapabilityService.collectSupportedModels()

      // 发送能力更新消息
      await this.sendMessage({
        type: 'capability_update',
        data: {
          clientId: this.clientId,
          capabilities: {
            supportedPlatforms: capabilities.supportedPlatforms,
            supportedAccountTypes: capabilities.supportedAccountTypes,
            supportedModels
          },
          resources: {
            activeAccounts: capabilities.activeAccounts,
            totalAccounts: Object.values(capabilities.activeAccounts).reduce((a, b) => a + b, 0)
          }
        }
      })

      logger.info('Capability update sent successfully', {
        platforms: capabilities.supportedPlatforms.length,
        accountTypes: capabilities.supportedAccountTypes.length,
        models: Object.keys(supportedModels).length
      })
    } catch (error) {
      logger.error('Failed to send capability update:', error)
    }
  }
}

module.exports = WebSocketClientService
