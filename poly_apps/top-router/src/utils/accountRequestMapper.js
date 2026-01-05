'use strict'

const ACCOUNT_SEGMENT_MAP = {
  claude: 'claude-accounts',
  'claude-console': 'claude-console-accounts',
  bedrock: 'bedrock-accounts',
  gemini: 'gemini-accounts',
  'gemini-api': 'gemini-api-accounts',
  openai: 'openai-accounts',
  'openai-responses': 'openai-responses-accounts',
  'azure-openai': 'azure-openai-accounts',
  droid: 'droid-accounts',
  ccr: 'ccr-accounts'
}

const META_KEYS = new Set([
  'accountType',
  'accountId',
  'accountData',
  'updates',
  'segment',
  'accountSegment'
])

function normalizeAccountType(accountType) {
  if (!accountType) {
    return ''
  }
  const raw = String(accountType).trim().toLowerCase().replace(/_/g, '-')
  if (raw === 'claude-official' || raw === 'claude') {
    return 'claude'
  }
  if (raw === 'claude-console') {
    return 'claude-console'
  }
  if (raw === 'gemini-api') {
    return 'gemini-api'
  }
  if (raw === 'openai-responses') {
    return 'openai-responses'
  }
  if (raw === 'azure-openai') {
    return 'azure-openai'
  }
  return raw
}

function resolveAccountSegment(input) {
  if (!input) {
    return null
  }
  const raw = String(input).trim()
  if (raw.endsWith('-accounts')) {
    return raw
  }
  const normalized = normalizeAccountType(raw)
  return ACCOUNT_SEGMENT_MAP[normalized] || null
}

function stripMeta(payload) {
  if (!payload || typeof payload !== 'object') {
    return {}
  }
  return Object.keys(payload).reduce((acc, key) => {
    if (!META_KEYS.has(key)) {
      acc[key] = payload[key]
    }
    return acc
  }, {})
}

function buildAccountOperationRequest(operation, payload = {}) {
  const data = payload && typeof payload === 'object' ? payload : {}
  const segment = resolveAccountSegment(
    data.segment ||
      data.accountSegment ||
      data.accountType ||
      data.type ||
      data.accountData?.accountType
  )
  if (!segment) {
    throw new Error('accountType is required')
  }

  if (operation === 'add_account') {
    const body = data.accountData || stripMeta(data)
    return {
      endpoint: `/admin/${segment}`,
      method: 'POST',
      body
    }
  }

  if (operation === 'update_account') {
    if (!data.accountId) {
      throw new Error('accountId is required')
    }
    const body = data.updates || data.accountData || stripMeta(data)
    return {
      endpoint: `/admin/${segment}/${data.accountId}`,
      method: 'PUT',
      body
    }
  }

  if (operation === 'delete_account') {
    if (!data.accountId) {
      throw new Error('accountId is required')
    }
    return {
      endpoint: `/admin/${segment}/${data.accountId}`,
      method: 'DELETE',
      body: {}
    }
  }

  throw new Error(`Unsupported operation: ${operation || 'unknown'}`)
}

module.exports = {
  buildAccountOperationRequest,
  normalizeAccountType,
  resolveAccountSegment
}
