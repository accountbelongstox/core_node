#!/usr/bin/env node

/**
 * Minimal datastore compatibility smoke test.
 * Runs against current DATASTORE_PROVIDER (redis/sqlite).
 */

const datastore = require('../src/models/datastore')

async function main() {
  const driver = datastore.driver || datastore.getClient?.().driver || 'unknown'
  console.log(`Datastore driver: ${driver}`)

  if (typeof datastore.connect === 'function') {
    await datastore.connect()
  }

  const client = datastore.getClientSafe ? datastore.getClientSafe() : datastore.getClient?.()
  if (!client) {
    throw new Error('No datastore client available')
  }

  try {
    // string
    await client.set('compat:test:string', 'ok')
    const str = await client.get('compat:test:string')

    // hash
    await client.hset('compat:test:hash', 'field', 'value')
    await client.hmset('compat:test:hash', { a: '1', b: '2' })
    const hash = await client.hgetall('compat:test:hash')

    // zset
    await client.zadd('compat:test:zset', 1, 'member')
    const [, zkeys] = await client.scan('0', 'MATCH', 'compat:test:*')

    console.log('String get:', str)
    console.log('Hash getall:', hash)
    console.log('SCAN keys:', zkeys)

    // cleanup (best-effort)
    await client.del?.('compat:test:string')
    await client.del?.('compat:test:hash')
    await client.del?.('compat:test:zset')

    console.log('Datastore compatibility test completed')
  } finally {
    if (typeof datastore.disconnect === 'function') {
      await datastore.disconnect().catch(() => {})
    }
  }
}

main().catch((error) => {
  console.error('Datastore compatibility test failed:', error)
  process.exit(1)
})
