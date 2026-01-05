#!/usr/bin/env node
'use strict'

const datastore = require('../src/models/datastore')

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

function groupKeys(keys) {
  const grouped = {}
  for (const key of keys) {
    const prefix = key.split(':')[0] || 'unknown'
    if (!grouped[prefix]) {
      grouped[prefix] = []
    }
    grouped[prefix].push(key)
  }
  return grouped
}

async function main() {
  try {
    const driver = resolveDriver()
    console.log(`Datastore driver: ${driver}`)

    if (typeof datastore.connect === 'function') {
      await datastore.connect()
    }

    const client = getClient()
    if (!client) {
      throw new Error('No datastore client available')
    }

    const allKeys = await scanKeys(client, '*')
    console.log(`Total keys: ${allKeys.length}`)

    const grouped = groupKeys(allKeys)
    const prefixes = Object.keys(grouped).sort()

    for (const prefix of prefixes) {
      const list = grouped[prefix]
      console.log(`\n[${prefix}] ${list.length} key(s)`)
      for (const key of list.slice(0, 5)) {
        console.log(`  - ${key}`)
      }
      if (list.length > 5) {
        console.log(`  ... ${list.length - 5} more`)
      }
    }

    if (typeof client.type === 'function') {
      const sample = allKeys.slice(0, Math.min(10, allKeys.length))
      if (sample.length) {
        console.log('\nSample key types:')
        for (const key of sample) {
          const type = await client.type(key)
          console.log(`  ${key} => ${type}`)
        }
      }
    }
  } catch (error) {
    console.error('Debug failed:', error.message || error)
    process.exitCode = 1
  } finally {
    if (typeof datastore.disconnect === 'function') {
      await datastore.disconnect().catch(() => {})
    }
  }
}

main()
