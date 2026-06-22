#!/usr/bin/env node
'use strict'

const config = require('../config/config')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const reveal = args.includes('--reveal')

function redact(value) {
  if (!value) {
    return ''
  }
  if (reveal) {
    return value
  }
  const str = String(value)
  if (str.length <= 8) {
    return '***'
  }
  return `${str.slice(0, 4)}...${str.slice(-4)}`
}

function buildOutput() {
  const websocketClient = config.websocketClient || {}
  const websocketServer = config.websocketServer || {}
  const websocket = config.websocket || {}

  return {
    websocket: {
      mode: websocket.mode || 'client'
    },
    websocketClient: {
      enabled: Boolean(websocketClient.enabled),
      serverUrl: websocketClient.serverUrl || '',
      clientApiKey: redact(websocketClient.clientApiKey || ''),
      reconnect: websocketClient.reconnect || {},
      heartbeat: websocketClient.heartbeat || {},
      proxy: {
        enabled: websocketClient.proxy?.enabled || false,
        host: websocketClient.proxy?.host || '',
        port: websocketClient.proxy?.port || '',
        auth: redact(websocketClient.proxy?.auth || '')
      },
      requestTimeout: websocketClient.requestTimeout || 0,
      maxConcurrentRequests: websocketClient.maxConcurrentRequests || 0
    },
    websocketServer: {
      enabled: Boolean(websocketServer.enabled),
      port: websocketServer.port || 0,
      path: websocketServer.path || '/ws/client',
      heartbeatInterval: websocketServer.heartbeatInterval || 30000,
      connectionTimeout: websocketServer.connectionTimeout || 30000,
      allowedOrigins: websocketServer.allowedOrigins || [],
      apiKeys: reveal ? websocketServer.apiKeys || [] : (websocketServer.apiKeys || []).map(redact)
    }
  }
}

const output = buildOutput()

if (asJson) {
  console.log(JSON.stringify(output, null, 2))
} else {
  console.log('WebSocket client configuration:')
  console.log(`  mode: ${output.websocket.mode}`)
  console.log(`  client enabled: ${output.websocketClient.enabled ? 'true' : 'false'}`)
  console.log(`  server enabled: ${output.websocketServer.enabled ? 'true' : 'false'}`)
  console.log(`  server url: ${output.websocketClient.serverUrl}`)
  console.log(`  client api key: ${output.websocketClient.clientApiKey}`)
  console.log(`  request timeout: ${output.websocketClient.requestTimeout}`)
  console.log(`  max concurrent requests: ${output.websocketClient.maxConcurrentRequests}`)
  if (output.websocketServer.enabled) {
    console.log(`  server port: ${output.websocketServer.port}`)
    console.log(`  server path: ${output.websocketServer.path}`)
    console.log(`  server api keys: ${output.websocketServer.apiKeys.join(', ') || ''}`)
  }
  if (output.websocketClient.proxy.enabled) {
    console.log('  proxy:')
    console.log(`    host: ${output.websocketClient.proxy.host}`)
    console.log(`    port: ${output.websocketClient.proxy.port}`)
    console.log(`    auth: ${output.websocketClient.proxy.auth}`)
  }
}
