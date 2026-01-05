'use strict'

const mysql = require('mysql2/promise')
const fs = require('fs')

let pool

function readSslConfigFromEnv() {
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

function normalizeSslConfig(configSsl) {
  if (!configSsl || typeof configSsl !== 'object') {
    return undefined
  }

  const ca =
    configSsl.ca || (configSsl.caFile ? fs.readFileSync(configSsl.caFile, 'utf8') : undefined)
  const cert =
    configSsl.cert || (configSsl.certFile ? fs.readFileSync(configSsl.certFile, 'utf8') : undefined)
  const key =
    configSsl.key || (configSsl.keyFile ? fs.readFileSync(configSsl.keyFile, 'utf8') : undefined)

  if (!ca && !cert && !key) {
    return undefined
  }

  return {
    ca,
    cert,
    key,
    rejectUnauthorized: configSsl.rejectUnauthorized !== false
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
    ssl: normalizeSslConfig(cfg.ssl) || readSslConfigFromEnv()
  }
}

function getMysqlPool() {
  if (!pool) {
    pool = mysql.createPool(buildPoolOptions())
  }
  return pool
}

async function closeMysqlPool() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

module.exports = {
  getMysqlPool,
  closeMysqlPool
}
