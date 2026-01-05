#!/usr/bin/env node
'use strict'

/**
 * WebSocket admin smoke checks (no mutations).
 * Requires admin token; does not start any service.
 *
 * Usage:
 *   ADMIN_TOKEN=... node scripts/test-ws-smoke.js
 *   node scripts/test-ws-smoke.js --base=http://127.0.0.1:3000 --token=...
 *   node scripts/test-ws-smoke.js --client-id=<clientId>
 */

const config = require('../config/config')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {}
  for (const arg of args) {
    if (!arg.startsWith('--')) {
      continue
    }
    const [key, value] = arg.replace(/^--/, '').split('=')
    opts[key] = value === undefined ? true : value
  }
  return opts
}

function resolveBaseUrl(opts) {
  if (opts.base) {
    return opts.base
  }
  if (process.env.WS_SMOKE_BASE_URL) {
    return process.env.WS_SMOKE_BASE_URL
  }
  const host = config.server?.host === '0.0.0.0' ? '127.0.0.1' : config.server?.host || '127.0.0.1'
  const port = config.server?.port || 3000
  return `http://${host}:${port}`
}

function resolveToken(opts) {
  return (
    opts.token ||
    process.env.ADMIN_TOKEN ||
    process.env.ADMIN_BEARER_TOKEN ||
    process.env.WS_ADMIN_TOKEN ||
    ''
  )
}

async function requestJson(baseUrl, path, token, { timeoutMs = 10000 } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers = { Accept: 'application/json' }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, { headers, signal: controller.signal })
    const text = await res.text()
    let payload = null
    try {
      payload = text ? JSON.parse(text) : null
    } catch (_) {
      payload = null
    }
    return { ok: res.ok, status: res.status, payload, text }
  } finally {
    clearTimeout(timeout)
  }
}

async function main() {
  const opts = parseArgs()
  const baseUrl = resolveBaseUrl(opts)
  const token = resolveToken(opts)

  if (!token) {
    console.log('ℹ️  ADMIN_TOKEN not provided; skipping WS admin smoke checks.')
    console.log('Set ADMIN_TOKEN (or use --token=...) to enable.')
    process.exit(0)
  }

  console.log(`🔍 WS smoke: GET ${baseUrl}/admin/clients`)
  const list = await requestJson(baseUrl, '/admin/clients', token)

  if (!list.ok) {
    console.error(`❌ WS clients request failed: HTTP ${list.status}`)
    if (list.payload?.error === 'WS_SERVER_DISABLED') {
      console.error('WS server is disabled. Enable WS_MODE=server and WS_SERVER_ENABLED=true.')
      return
    }
    if (list.payload) {
      console.error('Response:', list.payload)
    } else if (list.text) {
      console.error('Response:', list.text)
    }
    process.exit(1)
  }

  const clients = list.payload?.data || []
  if (!Array.isArray(clients) || clients.length === 0) {
    console.log('ℹ️  No WS clients found (empty list).')
    return
  }

  const clientId = opts['client-id'] || clients[0]?.id
  if (!clientId) {
    console.log('ℹ️  No clientId resolved from list.')
    return
  }

  console.log(`🔍 WS smoke: GET ${baseUrl}/admin/clients/${clientId}/system-health`)
  const health = await requestJson(baseUrl, `/admin/clients/${clientId}/system-health`, token, {
    timeoutMs: 15000
  })
  if (!health.ok) {
    console.error(`❌ WS health request failed: HTTP ${health.status}`)
    if (health.payload) {
      console.error('Response:', health.payload)
    } else if (health.text) {
      console.error('Response:', health.text)
    }
    process.exit(1)
  }

  console.log(`✅ WS smoke ok: client ${clientId}`)
}

main().catch((error) => {
  console.error('❌ WS smoke failed:', error.message)
  process.exit(1)
})
