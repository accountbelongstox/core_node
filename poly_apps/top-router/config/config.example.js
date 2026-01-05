const path = require('path')
require('dotenv').config()

const config = {
  // 🌐 服务器配置
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV || 'development',
    trustProxy: process.env.TRUST_PROXY === 'true'
  },

  // 🔐 安全配置
  security: {
    jwtSecret: process.env.JWT_SECRET || 'CHANGE-THIS-JWT-SECRET-IN-PRODUCTION',
    adminSessionTimeout: parseInt(process.env.ADMIN_SESSION_TIMEOUT) || 86400000, // 24小时
    apiKeyPrefix: process.env.API_KEY_PREFIX || 'cr_',
    encryptionKey: process.env.ENCRYPTION_KEY || 'CHANGE-THIS-32-CHARACTER-KEY-NOW'
  },

  // 📊 Redis配置
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB) || 0,
    connectTimeout: 10000,
    commandTimeout: 5000,
    retryDelayOnFailover: 100,
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableTLS: process.env.REDIS_ENABLE_TLS === 'true'
  },

  // 🗄️ 数据存储（可选 Redis/SQLite，默认 Redis）
  datastore: {
    provider: (process.env.DATASTORE_PROVIDER || process.env.DATASTORE_DRIVER || 'redis').toLowerCase(),
    mysql: {
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'claude_relay',
      poolSize: parseInt(process.env.DB_POOL_SIZE, 10) || 10,
      queueLimit: parseInt(process.env.DB_QUEUE_LIMIT, 10) || 0,
      waitForConnections: process.env.DB_WAIT_FOR_CONNECTIONS !== 'false',
      enableKeepAlive: process.env.DB_ENABLE_KEEP_ALIVE !== 'false',
      connectTimeout: parseInt(process.env.DB_CONNECT_TIMEOUT, 10) || 10000,
      timezone: process.env.DB_TIMEZONE || 'Z',
      ssl: {
        caFile: process.env.DB_SSL_CA_FILE,
        certFile: process.env.DB_SSL_CERT_FILE,
        keyFile: process.env.DB_SSL_KEY_FILE,
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
      },
      schemaPath:
        process.env.MYSQL_SCHEMA_PATH ||
        path.join(__dirname, '..', 'db', 'mysql', 'schema.sql')
    },
    sqlite: {
      filename:
        process.env.SQLITE_FILENAME ||
        path.join(__dirname, '..', 'data', process.env.SQLITE_FILENAME || 'relay.sqlite'),
      busyTimeout: parseInt(process.env.SQLITE_BUSY_TIMEOUT) || 5000,
      pragma: {
        journalMode: process.env.SQLITE_JOURNAL_MODE || 'WAL',
        synchronous: process.env.SQLITE_SYNCHRONOUS || 'normal'
      },
      applySchema: process.env.SQLITE_APPLY_SCHEMA !== 'false', // 默认自动创建/更新表
      schemaPath:
        process.env.SQLITE_SCHEMA_PATH ||
        path.join(__dirname, '..', 'db', 'sqlite', 'schema.sql')
    }
  },

  // 🔗 会话管理配置
  session: {
    // 粘性会话TTL配置（小时），默认1小时
    stickyTtlHours: parseFloat(process.env.STICKY_SESSION_TTL_HOURS) || 1,
    // 续期阈值（分钟），默认0分钟（不续期）
    renewalThresholdMinutes: parseInt(process.env.STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES) || 0
  },

  // 🎯 Claude API配置
  claude: {
    apiUrl: process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages',
    apiVersion: process.env.CLAUDE_API_VERSION || '2023-06-01',
    betaHeader:
      process.env.CLAUDE_BETA_HEADER ||
      'claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14',
    overloadHandling: {
      enabled: (() => {
        const minutes = parseInt(process.env.CLAUDE_OVERLOAD_HANDLING_MINUTES) || 0
        // 验证配置值：限制在0-1440分钟(24小时)内
        return Math.max(0, Math.min(minutes, 1440))
      })()
    }
  },

  // 🧭 CCR 调度策略（disabled/fallback/include）
  ccr: {
    poolMode: (() => {
      const mode = String(process.env.CCR_POOL_MODE || 'fallback').toLowerCase()
      return ['disabled', 'fallback', 'include'].includes(mode) ? mode : 'fallback'
    })()
  },

  // ☁️ Bedrock API配置
  bedrock: {
    enabled: process.env.CLAUDE_CODE_USE_BEDROCK === '1',
    defaultRegion: process.env.AWS_REGION || 'us-east-1',
    smallFastModelRegion: process.env.ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION,
    defaultModel: process.env.ANTHROPIC_MODEL || 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    smallFastModel:
      process.env.ANTHROPIC_SMALL_FAST_MODEL || 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
    maxOutputTokens: parseInt(process.env.CLAUDE_CODE_MAX_OUTPUT_TOKENS) || 4096,
    maxThinkingTokens: parseInt(process.env.MAX_THINKING_TOKENS) || 1024,
    enablePromptCaching: process.env.DISABLE_PROMPT_CACHING !== '1'
  },

  // 🌐 代理配置
  proxy: {
    timeout: parseInt(process.env.DEFAULT_PROXY_TIMEOUT) || 600000, // 10分钟
    maxRetries: parseInt(process.env.MAX_PROXY_RETRIES) || 3,
    // 连接池与 Keep-Alive 配置（默认关闭，需要显式开启）
    keepAlive: (() => {
      if (process.env.PROXY_KEEP_ALIVE === undefined || process.env.PROXY_KEEP_ALIVE === '') {
        return false
      }
      return process.env.PROXY_KEEP_ALIVE === 'true'
    })(),
    maxSockets: (() => {
      if (process.env.PROXY_MAX_SOCKETS === undefined || process.env.PROXY_MAX_SOCKETS === '') {
        return undefined
      }
      const parsed = parseInt(process.env.PROXY_MAX_SOCKETS)
      return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
    })(),
    maxFreeSockets: (() => {
      if (
        process.env.PROXY_MAX_FREE_SOCKETS === undefined ||
        process.env.PROXY_MAX_FREE_SOCKETS === ''
      ) {
        return undefined
      }
      const parsed = parseInt(process.env.PROXY_MAX_FREE_SOCKETS)
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
    })(),
    // IP协议族配置：true=IPv4, false=IPv6, 默认IPv4（兼容性更好）
    useIPv4: process.env.PROXY_USE_IPV4 !== 'false' // 默认 true，只有明确设置为 'false' 才使用 IPv6
  },

  // 🧭 官方 OpenAI API 兼容入口（单 Key 简版）
  openaiOfficial: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
    timeoutMs: parseInt(process.env.OPENAI_OFFICIAL_TIMEOUT_MS, 10) || 120000,
    organization: process.env.OPENAI_ORG || process.env.OPENAI_ORGANIZATION || '',
    project: process.env.OPENAI_PROJECT || ''
  },

  // 🔌 WebSocket 模式与客户端/服务端配置（默认仅客户端，server 需显式开启）
  websocket: {
    // server | client | off
    mode: (process.env.WS_MODE || 'client').toLowerCase()
  },
  // WebSocket 服务端
  websocketServer: {
    enabled: process.env.WS_SERVER_ENABLED === 'true',
    port: parseInt(process.env.WS_SERVER_PORT) || 0, // 未设置则不监听
    path: process.env.WS_SERVER_PATH || '/ws/client',
    heartbeatInterval: parseInt(process.env.WS_SERVER_HEARTBEAT_INTERVAL) || 30000,
    connectionTimeout: parseInt(process.env.WS_SERVER_CONNECTION_TIMEOUT) || 30000,
    allowedOrigins: process.env.WS_SERVER_ALLOWED_ORIGINS
      ? process.env.WS_SERVER_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    apiKeys: process.env.WS_SERVER_API_KEYS
      ? process.env.WS_SERVER_API_KEYS.split(',').map((s) => s.trim()).filter(Boolean)
      : []
  },
  // WebSocket 客户端配置（默认关闭）
  websocketClient: {
    enabled: process.env.WS_CLIENT_ENABLED === 'true',
    serverUrl: process.env.WS_SERVER_URL || '',
    clientApiKey: process.env.WS_CLIENT_API_KEY || '',
    reconnect: {
      enabled: true,
      maxRetries: parseInt(process.env.WS_MAX_RECONNECT_RETRIES) || -1, // -1 表示无限重试
      initialDelay: parseInt(process.env.WS_RECONNECT_INITIAL_DELAY) || 1000,
      maxDelay: parseInt(process.env.WS_RECONNECT_MAX_DELAY) || 60000,
      backoffMultiplier: parseFloat(process.env.WS_RECONNECT_BACKOFF) || 1.5
    },
    heartbeat: {
      enabled: process.env.WS_HEARTBEAT_ENABLED !== 'false',
      interval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000, // 30秒
      timeout: parseInt(process.env.WS_HEARTBEAT_TIMEOUT) || 10000 // 10秒
    },
    proxy: {
      enabled: process.env.WS_PROXY_ENABLED === 'true',
      host: process.env.WS_PROXY_HOST,
      port: parseInt(process.env.WS_PROXY_PORT),
      auth: process.env.WS_PROXY_AUTH
    },
    requestTimeout: parseInt(process.env.WS_REQUEST_TIMEOUT) || 600000, // 10分钟
    maxConcurrentRequests: parseInt(process.env.WS_MAX_CONCURRENT_REQUESTS) || 10
  },

  // 🌐 翻译服务（默认关闭）
  translation: {
    enabled: process.env.TRANSLATION_ENABLED === 'true',
    provider: process.env.TRANSLATION_PROVIDER || 'claude',
    fallbackProvider: process.env.TRANSLATION_FALLBACK_PROVIDER || 'gemini',
    cacheTTL: parseInt(process.env.TRANSLATION_CACHE_TTL) || 86400, // 24 小时
    timeout: parseInt(process.env.TRANSLATION_TIMEOUT) || 5000,
    batchThreshold: parseInt(process.env.TRANSLATION_BATCH_THRESHOLD) || 5,
    memoryCache: {
      maxItems: parseInt(process.env.TRANSLATION_MEM_CACHE_MAX_ITEMS) || 500,
      maxSize: parseInt(process.env.TRANSLATION_MEM_CACHE_MAX_SIZE_KB) || 5000, // KB
      ttl: parseInt(process.env.TRANSLATION_MEM_CACHE_TTL) || 3600000 // 1小时
    }
  },

  // 🛜 VPN 配置（默认关闭）
  vpn: {
    // server | client | off
    mode: (process.env.VPN_MODE || 'client').toLowerCase(),
    enabled: process.env.VPN_ENABLED === 'true',
    buffers: {
      highWaterMark: parseInt(process.env.VPN_BUFFER_HIGH_WATER_MARK),
      poolSize: parseInt(process.env.VPN_BUFFER_POOL_SIZE)
    },
    tunnel: {
      maxConcurrentSessions: parseInt(process.env.VPN_MAX_CONCURRENT_SESSIONS) || 0,
      connectionTimeout: parseInt(process.env.VPN_CONNECTION_TIMEOUT) || 30000,
      idleTimeout: parseInt(process.env.VPN_IDLE_TIMEOUT) || 0,
      dataTimeout: parseInt(process.env.VPN_DATA_TIMEOUT) || 0
    },
    metrics: {
      enabled: process.env.VPN_METRICS_ENABLED !== 'false',
      interval: parseInt(process.env.VPN_METRICS_INTERVAL) || 5000
    },
    socks: {
      host: process.env.VPN_SOCKS_HOST || '127.0.0.1',
      port: parseInt(process.env.VPN_SOCKS_PORT) || 0,
      backlog: parseInt(process.env.VPN_SOCKS_BACKLOG) || 128,
      auth: {
        token: process.env.VPN_SOCKS_AUTH_TOKEN || ''
      }
    }
  },

  // ⏱️ 请求超时配置
  requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 600000, // 默认 10 分钟

  // 📈 使用限制
  limits: {
    defaultTokenLimit: parseInt(process.env.DEFAULT_TOKEN_LIMIT) || 1000000
  },

  // 📝 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dirname: path.join(__dirname, '..', 'logs'),
    maxSize: process.env.LOG_MAX_SIZE || '10m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5,
    rotateEvents: process.env.LOG_ROTATE_EVENTS === 'true',
    request: {
      sampleRate: (() => {
        const value = parseFloat(process.env.LOG_REQUEST_SAMPLE_RATE)
        return Number.isFinite(value) ? value : 0.01
      })(),
      slowThresholdMs: (() => {
        const value = parseInt(process.env.LOG_SLOW_MS, 10)
        return Number.isFinite(value) ? value : 10000
      })(),
      logApiKey: process.env.LOG_REQUEST_LOG_APIKEY === 'true',
      skipExactPaths: ['/health', '/api/health', '/metrics', '/favicon.ico', '/web/assets'],
      skipPrefixPaths: ['/web/assets/'],
      skipErrorPaths: ['/favicon.ico'],
      skipMethodsForPrefix: {
        '/admin-next': ['GET', 'HEAD']
      }
    },
    security: {
      logAdminSuccess: process.env.LOG_SECURITY_ADMIN_SUCCESS === 'true',
      logUserSuccess: process.env.LOG_SECURITY_USER_SUCCESS === 'true'
    }
  },

  // 🔧 系统配置
  system: {
    cleanupInterval: parseInt(process.env.CLEANUP_INTERVAL) || 3600000, // 1小时
    tokenUsageRetention: parseInt(process.env.TOKEN_USAGE_RETENTION) || 2592000000, // 30天
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 60000, // 1分钟
    timezone: process.env.SYSTEM_TIMEZONE || 'Asia/Shanghai', // 默认UTC+8（中国时区）
    timezoneOffset: parseInt(process.env.TIMEZONE_OFFSET) || 8 // UTC偏移小时数，默认+8
  },

  // 🎨 Web界面配置
  web: {
    title: process.env.WEB_TITLE || 'Claude Relay Service',
    description:
      process.env.WEB_DESCRIPTION ||
      'Multi-account Claude API relay service with beautiful management interface',
    logoUrl: process.env.WEB_LOGO_URL || '/assets/logo.png',
    enableCors: process.env.ENABLE_CORS === 'true',
    sessionSecret: process.env.WEB_SESSION_SECRET || 'CHANGE-THIS-SESSION-SECRET'
  },

  // 🔐 LDAP 认证配置
  ldap: {
    enabled: process.env.LDAP_ENABLED === 'true',
    server: {
      url: process.env.LDAP_URL || 'ldap://localhost:389',
      bindDN: process.env.LDAP_BIND_DN || 'cn=admin,dc=example,dc=com',
      bindCredentials: process.env.LDAP_BIND_PASSWORD || 'admin',
      searchBase: process.env.LDAP_SEARCH_BASE || 'dc=example,dc=com',
      searchFilter: process.env.LDAP_SEARCH_FILTER || '(uid={{username}})',
      searchAttributes: process.env.LDAP_SEARCH_ATTRIBUTES
        ? process.env.LDAP_SEARCH_ATTRIBUTES.split(',')
        : ['dn', 'uid', 'cn', 'mail', 'givenName', 'sn'],
      timeout: parseInt(process.env.LDAP_TIMEOUT) || 5000,
      connectTimeout: parseInt(process.env.LDAP_CONNECT_TIMEOUT) || 10000,
      // TLS/SSL 配置
      tls: {
        // 是否忽略证书错误 (用于自签名证书)
        rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false', // 默认验证证书，设置为false则忽略
        // CA证书文件路径 (可选，用于自定义CA证书)
        ca: process.env.LDAP_TLS_CA_FILE
          ? require('fs').readFileSync(process.env.LDAP_TLS_CA_FILE)
          : undefined,
        // 客户端证书文件路径 (可选，用于双向认证)
        cert: process.env.LDAP_TLS_CERT_FILE
          ? require('fs').readFileSync(process.env.LDAP_TLS_CERT_FILE)
          : undefined,
        // 客户端私钥文件路径 (可选，用于双向认证)
        key: process.env.LDAP_TLS_KEY_FILE
          ? require('fs').readFileSync(process.env.LDAP_TLS_KEY_FILE)
          : undefined,
        // 服务器名称 (用于SNI，可选)
        servername: process.env.LDAP_TLS_SERVERNAME || undefined
      }
    },
    userMapping: {
      username: process.env.LDAP_USER_ATTR_USERNAME || 'uid',
      displayName: process.env.LDAP_USER_ATTR_DISPLAY_NAME || 'cn',
      email: process.env.LDAP_USER_ATTR_EMAIL || 'mail',
      firstName: process.env.LDAP_USER_ATTR_FIRST_NAME || 'givenName',
      lastName: process.env.LDAP_USER_ATTR_LAST_NAME || 'sn'
    }
  },

  // 👥 用户管理配置
  userManagement: {
    enabled: process.env.USER_MANAGEMENT_ENABLED === 'true',
    defaultUserRole: process.env.DEFAULT_USER_ROLE || 'user',
    userSessionTimeout: parseInt(process.env.USER_SESSION_TIMEOUT) || 86400000, // 24小时
    maxApiKeysPerUser: parseInt(process.env.MAX_API_KEYS_PER_USER) || 1,
    allowUserDeleteApiKeys: process.env.ALLOW_USER_DELETE_API_KEYS === 'true', // 默认不允许用户删除自己的API Keys
    allowRegistration: process.env.ALLOW_USER_REGISTRATION === 'true',
    allowPasswordReset: process.env.ALLOW_USER_PASSWORD_RESET !== 'false'
  },

  // 📧 邮件发送（用于密码重置等，可选）
  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
    resetBaseUrl: process.env.EMAIL_RESET_BASE_URL || '', // 用于拼接重置链接，可选
    smtp: {
      host: process.env.EMAIL_SMTP_HOST || '',
      port: parseInt(process.env.EMAIL_SMTP_PORT) || 587,
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_SMTP_USER || '',
        pass: process.env.EMAIL_SMTP_PASS || ''
      }
    }
  },

  // 📱 短信通知配置
  sms: {
    // 是否启用短信通知功能（默认禁用，需手动开启）
    enabled: process.env.SMS_ENABLED === 'true',

    // 短信服务提供商：aliyun | tencent
    provider: process.env.SMS_PROVIDER || 'aliyun',

    // 阿里云短信配置
    aliyun: {
      accessKeyId:
        process.env.ALIYUN_SMS_ACCESS_KEY_ID || process.env.SMS_ACCESS_KEY_ID || '',
      accessKeySecret:
        process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || process.env.SMS_ACCESS_KEY_SECRET || '',
      signName: process.env.ALIYUN_SMS_SIGN_NAME || process.env.SMS_SIGN_NAME || '您的应用',
      regionId: process.env.ALIYUN_SMS_REGION_ID || process.env.SMS_REGION || 'cn-hangzhou'
    },

    // 腾讯云短信配置
    tencent: {
      secretId: process.env.TENCENT_SMS_SECRET_ID || '',
      secretKey: process.env.TENCENT_SMS_SECRET_KEY || '',
      sdkAppId: process.env.TENCENT_SMS_SDK_APP_ID || '',
      signName: process.env.TENCENT_SMS_SIGN_NAME || '您的应用'
    },

    // 短信模板配置（需在服务商后台创建并审核）
    templates: {
      verificationCode:
        process.env.SMS_TEMPLATE_VERIFICATION_CODE ||
        process.env.SMS_TEMPLATE_ID ||
        'SMS_VERIFICATION_CODE',
      quotaWarning: process.env.SMS_TEMPLATE_QUOTA_WARNING || 'SMS_QUOTA_WARNING',
      subscriptionExpiring:
        process.env.SMS_TEMPLATE_SUBSCRIPTION_EXPIRING || 'SMS_SUBSCRIPTION_EXPIRING',
      apiKeyExpiring: process.env.SMS_TEMPLATE_API_KEY_EXPIRING || 'SMS_API_KEY_EXPIRING',
      securityAlert: process.env.SMS_TEMPLATE_SECURITY_ALERT || 'SMS_SECURITY_ALERT',
      dailySummary: process.env.SMS_TEMPLATE_DAILY_SUMMARY || 'SMS_DAILY_SUMMARY'
    },

    // 发送频率限制
    rateLimit: {
      perMinute: parseInt(process.env.SMS_RATE_LIMIT_PER_MINUTE) || 1, // 每分钟最多发送次数
      perHour: parseInt(process.env.SMS_RATE_LIMIT_PER_HOUR) || 2, // 每小时最多发送次数
      perDay: parseInt(process.env.SMS_RATE_LIMIT_PER_DAY) || 5, // 每天最多发送次数
      minInterval: parseInt(process.env.SMS_MIN_INTERVAL) || 60 // 两次发送最小间隔（秒）
    },

    // 失败重试配置（默认不自动重试，避免重复发送）
    retry: {
      enabled: process.env.SMS_RETRY_ENABLED === 'true',
      maxRetries: parseInt(process.env.SMS_RETRY_MAX_RETRIES) || 0,
      delaySeconds: parseInt(process.env.SMS_RETRY_DELAY_SECONDS) || 60
    },

    // 每日汇总通知配置
    dailySummary: {
      enabled: process.env.SMS_DAILY_SUMMARY_ENABLED !== 'false', // 默认启用每日汇总
      time: process.env.SMS_DAILY_SUMMARY_TIME || '20:00' // 每日汇总发送时间（24小时制）
    },

    // 通知优先级配置
    priorities: {
      critical: ['security_alert', 'account_locked'], // 紧急，立即发送
      high: ['quota_100', 'subscription_expired'], // 高优先级，每天最多2次
      normal: ['quota_90', 'subscription_expiring_3d'], // 普通，每天汇总1次
      low: ['quota_80', 'subscription_expiring_7d'] // 低优先级，不发短信
    },

    // 测试模式（启用后不实际发送短信，仅记录日志）
    testMode: process.env.SMS_TEST_MODE === 'true'
  },

  // 🧾 订阅生命周期任务
  subscription: {
    lifecycleEnabled: process.env.SUBSCRIPTION_LIFECYCLE_ENABLED === 'true',
    lifecycleIntervalMinutes:
      parseInt(process.env.SUBSCRIPTION_LIFECYCLE_INTERVAL_MINUTES) || 10
  },

  // 💳 支付（占位配置，需按实际商户填写）
  payment: {
    orderExpiryMinutes: parseInt(process.env.ORDER_EXPIRY_MINUTES) || 30,
    alipay: {
      appId: process.env.ALIPAY_APP_ID || '',
      privateKey: process.env.ALIPAY_PRIVATE_KEY || '',
      alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || '',
      gateway: process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do',
      sandboxGateway: 'https://openapi.alipaydev.com/gateway.do',
      isSandbox: process.env.ALIPAY_SANDBOX === 'true',
      notifyUrl: process.env.ALIPAY_NOTIFY_URL || '',
      returnUrl: process.env.ALIPAY_RETURN_URL || '',
      signType: 'RSA2',
      charset: 'utf-8',
      version: '1.0'
    },
    wechat: {
      appId: process.env.WECHAT_APP_ID || '',
      mchId: process.env.WECHAT_MCH_ID || '',
      apiKey: process.env.WECHAT_API_KEY || '',
      apiV3Key: process.env.WECHAT_API_V3_KEY || '',
      certPath: process.env.WECHAT_CERT_PATH || '',
      keyPath: process.env.WECHAT_KEY_PATH || '',
      serialNo: process.env.WECHAT_SERIAL_NO || '',
      notifyUrl: process.env.WECHAT_NOTIFY_URL || '',
      apiVersion: process.env.WECHAT_API_VERSION || 'v3'
    }
  },

  // 📢 Webhook通知配置
  webhook: {
    enabled: process.env.WEBHOOK_ENABLED !== 'false', // 默认启用
    urls: process.env.WEBHOOK_URLS
      ? process.env.WEBHOOK_URLS.split(',').map((url) => url.trim())
      : [],
    timeout: parseInt(process.env.WEBHOOK_TIMEOUT) || 10000, // 10秒超时
    retries: parseInt(process.env.WEBHOOK_RETRIES) || 3 // 重试3次
  },

  // 🛠️ 开发配置
  development: {
    debug: process.env.DEBUG === 'true',
    hotReload: process.env.HOT_RELOAD === 'true'
  },

  // 💰 账户余额相关配置
  accountBalance: {
    // 是否允许执行自定义余额脚本（安全开关）
    // 说明：脚本能力可发起任意 HTTP 请求并在服务端执行 extractor 逻辑，建议仅在受控环境开启
    // 默认保持开启；如需禁用请显式设置：BALANCE_SCRIPT_ENABLED=false
    enableBalanceScript: process.env.BALANCE_SCRIPT_ENABLED !== 'false'
  },

  // 📬 用户消息队列配置
  // 优化说明：锁在请求发送成功后立即释放（而非请求完成后），因为 Claude API 限流基于请求发送时刻计算
  userMessageQueue: {
    enabled: process.env.USER_MESSAGE_QUEUE_ENABLED === 'true', // 默认关闭
    delayMs: parseInt(process.env.USER_MESSAGE_QUEUE_DELAY_MS) || 200, // 请求间隔（毫秒）
    timeoutMs: parseInt(process.env.USER_MESSAGE_QUEUE_TIMEOUT_MS) || 5000, // 队列等待超时（毫秒），锁持有时间短，无需长等待
    lockTtlMs: parseInt(process.env.USER_MESSAGE_QUEUE_LOCK_TTL_MS) || 5000 // 锁TTL（毫秒），5秒足以覆盖请求发送
  }
}

module.exports = config
