const path = require('path')

const DEFAULT_DRIVER = 'redis'

/**
 * 将 Redis 实例上的扩展方法复制到其他数据存储实例
 * Redis 中有许多方法是直接添加到 redisClient 对象上的，而不是在原型上
 * 这个函数确保 SQLite/MySQL 等数据存储也能使用这些方法
 */
function copyRedisExtensionMethods(targetStore) {
  const redisInstance = require('../redis')

  // 需要复制的方法列表（直接添加到 redisClient 对象上的方法）
  const extensionMethods = [
    'setAccountLock',
    'releaseAccountLock',
    'acquireUserMessageLock',
    'releaseUserMessageLock',
    'forceReleaseUserMessageLock',
    'getUserMessageQueueStats',
    'scanUserMessageQueueLocks',
    'incrConcurrencyQueue',
    'decrConcurrencyQueue',
    'getConcurrencyQueueCount',
    'clearConcurrencyQueue',
    'scanConcurrencyQueueKeys',
    'clearAllConcurrencyQueues',
    'incrConcurrencyQueueStats',
    'getConcurrencyQueueStats',
    'recordQueueWaitTime',
    'recordGlobalQueueWaitTime',
    'getGlobalQueueWaitTimes',
    'getQueueWaitTimes',
    'scanConcurrencyQueueStatsKeys',
    'saveAccountTestResult',
    'getAccountTestHistory',
    'getAccountLatestTestResult',
    'getAccountsTestHistory',
    'saveAccountTestConfig',
    'getAccountTestConfig',
    'getEnabledTestAccounts',
    'setAccountLastTestTime',
    'getAccountLastTestTime'
  ]

  // 复制方法到目标数据存储
  for (const methodName of extensionMethods) {
    if (typeof redisInstance[methodName] === 'function') {
      targetStore[methodName] = redisInstance[methodName].bind(targetStore)
    }
  }

  return targetStore
}

function resolveDriver(explicitDriver) {
  if (explicitDriver) {
    return String(explicitDriver).toLowerCase()
  }

  const driverEnv = process.env.DATASTORE_PROVIDER || process.env.DATASTORE_DRIVER
  if (driverEnv) {
    return String(driverEnv).toLowerCase()
  }

  try {
    // 延迟加载以避免循环依赖
    const appConfig = require(path.join(__dirname, '..', '..', '..', 'config', 'config'))
    if (appConfig?.datastore?.provider) {
      return String(appConfig.datastore.provider).toLowerCase()
    }
    if (appConfig?.datastore?.driver) {
      return String(appConfig.datastore.driver).toLowerCase()
    }
  } catch (error) {
    // 配置加载失败时忽略，使用默认驱动
  }

  return DEFAULT_DRIVER
}

function createDataStore(options = {}) {
  const driver = resolveDriver(options.driver)

  // Redis 分支：保持向后兼容，直接返回现有 redis 实例
  if (driver === 'redis') {
    const redisInstance = require('../redis')
    redisInstance.driver = 'redis'
    return redisInstance
  }

  if (driver === 'sqlite') {
    const { createSQLiteStore } = require('./sqliteDataStore')
    let sqliteOptions = {}
    try {
      const appConfig = require('../../config/config')
      sqliteOptions = {
        filename: options.filename || appConfig?.datastore?.sqlite?.filename,
        busyTimeout: options.busyTimeout || appConfig?.datastore?.sqlite?.busyTimeout,
        pragma: {
          ...(appConfig?.datastore?.sqlite?.pragma || {}),
          ...(options.pragma || {})
        },
        applySchema: options.applySchema,
        schemaPath: options.schemaPath
      }
    } catch (_) {
      sqliteOptions = options
    }

    if (!sqliteOptions.filename) {
      sqliteOptions = {
        ...sqliteOptions,
        filename: path.join(process.cwd(), 'data', 'relay.sqlite')
      }
    }
    const store = createSQLiteStore(sqliteOptions)
    store.driver = 'sqlite'
    // 复制 Redis 扩展方法到 SQLite 数据存储
    copyRedisExtensionMethods(store)
    return store
  }

  if (driver === 'mysql') {
    const { createMysqlStore } = require('./mysqlDataStore')
    const store = createMysqlStore(options)
    store.driver = 'mysql'
    // 复制 Redis 扩展方法到 MySQL 数据存储
    copyRedisExtensionMethods(store)
    return store
  }

  // 默认回退到 Redis，避免配置错误导致启动失败
  const redisInstance = require('../redis')
  redisInstance.driver = 'redis'
  return redisInstance
}

const dataStore = createDataStore()

module.exports = dataStore
module.exports.createDataStore = createDataStore
module.exports.SUPPORTED_DRIVERS = ['redis', 'sqlite', 'mysql']
