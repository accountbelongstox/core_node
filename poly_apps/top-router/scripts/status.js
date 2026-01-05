#!/usr/bin/env node
'use strict'

const fs = require('fs')
const config = require('../config/config')
const datastore = require('../src/models/datastore')

const args = process.argv.slice(2)
const wsOnly = args.includes('--ws') || args.includes('--ws-only')

function resolveDriver() {
  return datastore.driver || datastore.getClient?.().driver || 'unknown'
}

function getClient() {
  if (typeof datastore.getClientSafe === 'function') {
    return datastore.getClientSafe()
  }
  if (typeof datastore.getClient === 'function') {
    return datastore.getClient()
  }
  return datastore.client || null
}

async function scanKeys(client, pattern) {
  if (typeof client.scan !== 'function') {
    if (typeof client.keys === 'function') {
      return await client.keys(pattern)
    }
    return []
  }

  let cursor = '0'
  const keys = []

  do {
    const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 1000)
    if (!result) {
      break
    }
    const [nextCursor, batch] = result
    if (Array.isArray(batch)) {
      keys.push(...batch)
    }
    cursor = nextCursor
  } while (cursor !== '0')

  return keys
}

function formatTimestamp(ms) {
  if (!ms) {
    return 'n/a'
  }
  const date = new Date(ms)
  if (Number.isNaN(date.getTime())) {
    return 'n/a'
  }
  return date.toISOString()
}

function summarizeDatastore(driver) {
  if (driver === 'sqlite') {
    const filename = config.datastore?.sqlite?.filename || ''
    let sizeInfo = 'n/a'
    if (filename && fs.existsSync(filename)) {
      const stats = fs.statSync(filename)
      sizeInfo = `${stats.size} bytes`
    }
    console.log(`Datastore (sqlite): ${filename || 'unknown'} (${sizeInfo})`)
    return
  }

  if (driver === 'mysql') {
    const mysql = config.datastore?.mysql || {}
    console.log(`Datastore (mysql): ${mysql.host || '127.0.0.1'}:${mysql.port || 3306}`)
    console.log(`Database: ${mysql.database || 'claude_relay'}`)
    return
  }

  const redis = config.redis || {}
  console.log(`Datastore (redis): ${redis.host || '127.0.0.1'}:${redis.port || 6379}`)
}

function summarizeConfig() {
  console.log('\nWebSocket:')
  console.log(`  mode: ${config.websocket?.mode || 'client'}`)
  console.log(`  client enabled: ${config.websocketClient?.enabled ? 'true' : 'false'}`)
  console.log(`  server enabled: ${config.websocketServer?.enabled ? 'true' : 'false'}`)
  if (config.websocketServer?.enabled) {
    console.log(`  server port: ${config.websocketServer.port || 0}`)
    console.log(`  server path: ${config.websocketServer.path || '/ws/client'}`)
  }

  console.log('\nTranslation:')
  console.log(`  enabled: ${config.translation?.enabled ? 'true' : 'false'}`)
  console.log(`  provider: ${config.translation?.provider || 'claude'}`)

  console.log('\nVPN:')
  console.log(`  mode: ${config.vpn?.mode || 'client'}`)
  console.log(`  enabled: ${config.vpn?.enabled ? 'true' : 'false'}`)
  console.log(`  socks port: ${config.vpn?.socks?.port || 0}`)
}

async function summarizeWebSocketStatus(client) {
  const statusKeys = await scanKeys(client, 'ws_client:status:*')
  if (!statusKeys.length) {
    console.log('WebSocket status: no client status found')
    return
  }

  console.log('WebSocket status:')
  for (const key of statusKeys) {
    const raw = await client.get(key)
    if (!raw) {
      continue
    }
    let data = null
    try {
      data = JSON.parse(raw)
    } catch (_) {
      data = null
    }
    const clientId = key.split(':').slice(2).join(':')
    if (!data) {
      console.log(`  ${clientId}: invalid status payload`)
      continue
    }
    const status = data.status || 'unknown'
    const connectedAt = formatTimestamp(data.connectedAt)
    const lastHeartbeat = formatTimestamp(data.lastHeartbeat)
    const sent = data.messagesSent || 0
    const received = data.messagesReceived || 0
    console.log(
      `  ${clientId}: ${status}, connectedAt=${connectedAt}, lastHeartbeat=${lastHeartbeat}, sent=${sent}, received=${received}`
    )
  }
}

async function main() {
  try {
    const driver = resolveDriver()
    if (!wsOnly) {
      console.log(`Datastore driver: ${driver}`)
      summarizeDatastore(driver)
      summarizeConfig()
    }

    if (typeof datastore.connect === 'function') {
      await datastore.connect()
    }
    const client = getClient()
    if (client) {
      await summarizeWebSocketStatus(client)
    } else {
      console.log('WebSocket status: no datastore client available')
    }
  } catch (error) {
    console.error('Status check failed:', error.message || error)
    process.exitCode = 1
  } finally {
    if (typeof datastore.disconnect === 'function') {
      await datastore.disconnect().catch(() => {})
    }
  }
}

main()
