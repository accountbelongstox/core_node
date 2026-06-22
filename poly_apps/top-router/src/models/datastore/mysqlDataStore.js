'use strict'

const mysql = require('mysql2/promise')
const path = require('path')
const fs = require('fs')

const fallbackRedis = require('../redis')

const DEFAULT_SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'db', 'mysql', 'schema.sql')

function readSslConfig() {
  const caFile = process.env.DB_SSL_CA_FILE
  const certFile = process.env.DB_SSL_CERT_FILE
  const keyFile = process.env.DB_SSL_KEY_FILE
  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED
    ? process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    : true

  if (!caFile && !certFile && !keyFile) {
    return undefined
  }

  return {
    ca: caFile ? fs.readFileSync(caFile, 'utf8') : undefined,
    cert: certFile ? fs.readFileSync(certFile, 'utf8') : undefined,
    key: keyFile ? fs.readFileSync(keyFile, 'utf8') : undefined,
    rejectUnauthorized
  }
}

function buildPoolOptions() {
  let cfg = {}
  try {
    const appConfig = require('../../config/config')
    cfg = appConfig?.datastore?.mysql || {}
  } catch (_) {
    cfg = {}
  }

  const {
    DB_HOST,
    DB_PORT,
    DB_USER,
    DB_PASSWORD,
    DB_NAME,
    DB_POOL_SIZE,
    DB_QUEUE_LIMIT,
    DB_WAIT_FOR_CONNECTIONS,
    DB_ENABLE_KEEP_ALIVE,
    DB_CONNECT_TIMEOUT,
    DB_TIMEZONE
  } = process.env

  return {
    host: DB_HOST || cfg.host || '127.0.0.1',
    port: parseInt(DB_PORT, 10) || cfg.port || 3306,
    user: DB_USER || cfg.user || 'root',
    password: DB_PASSWORD || cfg.password || '',
    database: DB_NAME || cfg.database || 'claude_relay',
    connectionLimit: parseInt(DB_POOL_SIZE, 10) || cfg.poolSize || 10,
    queueLimit: parseInt(DB_QUEUE_LIMIT, 10) || cfg.queueLimit || 0,
    waitForConnections:
      DB_WAIT_FOR_CONNECTIONS !== undefined
        ? DB_WAIT_FOR_CONNECTIONS !== 'false'
        : cfg.waitForConnections !== false,
    enableKeepAlive:
      DB_ENABLE_KEEP_ALIVE !== undefined
        ? DB_ENABLE_KEEP_ALIVE !== 'false'
        : cfg.enableKeepAlive !== false,
    connectTimeout: parseInt(DB_CONNECT_TIMEOUT, 10) || cfg.connectTimeout || 10000,
    timezone: DB_TIMEZONE || cfg.timezone || 'Z',
    namedPlaceholders: true,
    ssl: cfg.ssl || readSslConfig()
  }
}

async function applySchema(pool, schemaPath) {
  const resolvedPath = schemaPath || process.env.MYSQL_SCHEMA_PATH || DEFAULT_SCHEMA_PATH
  if (!resolvedPath || !fs.existsSync(resolvedPath)) {
    return
  }
  const sql = fs.readFileSync(resolvedPath, 'utf8')
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const stmt of statements) {
    await pool.query(stmt)
  }
}

function createMysqlStore(options = {}) {
  const poolOptions = options.poolOptions || buildPoolOptions()
  const pool = mysql.createPool(poolOptions)

  // 复用现有 redis 接口，保持兼容，新增 MySQL 连接能力
  const store = Object.create(fallbackRedis)
  store.driver = 'mysql'
  store.mysqlPool = pool
  store.getMysqlPool = async () => pool
  store.ensureSchema = async () => {
    await applySchema(pool, options.schemaPath)
  }
  store.shutdown = async () => {
    await pool.end()
    if (typeof fallbackRedis.disconnect === 'function') {
      await fallbackRedis.disconnect()
    }
  }
  store.info = async () => ({
    driver: 'mysql',
    config: {
      host: poolOptions.host,
      port: poolOptions.port,
      database: poolOptions.database,
      user: poolOptions.user
    }
  })

  return store
}

module.exports = {
  createMysqlStore
}
