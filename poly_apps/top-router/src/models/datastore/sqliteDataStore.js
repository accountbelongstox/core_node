'use strict'

const fs = require('fs')
const path = require('path')
let Database

const redisInstance = require('../redis')
const RedisClientClass = redisInstance.constructor
const logger = require('../../utils/logger')

const DEFAULT_SCHEMA_PATH = path.join(__dirname, '..', '..', '..', 'db', 'sqlite', 'schema.sql')

class SQLitePipeline {
  constructor(client) {
    this.client = client
    this.operations = []
  }

  _queue(method, args) {
    this.operations.push(() => this.client[method](...args))
    return this
  }

  hset(...args) {
    return this._queue('hset', args)
  }

  hincrby(...args) {
    return this._queue('hincrby', args)
  }

  hincrbyfloat(...args) {
    return this._queue('hincrbyfloat', args)
  }

  incrbyfloat(...args) {
    return this._queue('incrbyfloat', args)
  }

  incr(...args) {
    return this._queue('incr', args)
  }

  expire(...args) {
    return this._queue('expire', args)
  }

  pexpire(...args) {
    return this._queue('pexpire', args)
  }

  set(...args) {
    return this._queue('set', args)
  }

  setex(...args) {
    return this._queue('setex', args)
  }

  del(...args) {
    return this._queue('del', args)
  }

  hgetall(...args) {
    return this._queue('hgetall', args)
  }

  hget(...args) {
    return this._queue('hget', args)
  }

  hmget(...args) {
    return this._queue('hmget', args)
  }

  lpush(...args) {
    return this._queue('lpush', args)
  }

  ltrim(...args) {
    return this._queue('ltrim', args)
  }

  zadd(...args) {
    return this._queue('zadd', args)
  }

  zremrangebyscore(...args) {
    return this._queue('zremrangebyscore', args)
  }

  zrem(...args) {
    return this._queue('zrem', args)
  }

  zcard(...args) {
    return this._queue('zcard', args)
  }

  zscore(...args) {
    return this._queue('zscore', args)
  }

  xadd(...args) {
    return this._queue('xadd', args)
  }

  xinfo(...args) {
    return this._queue('xinfo', args)
  }

  xgroup(...args) {
    return this._queue('xgroup', args)
  }

  xread(...args) {
    return this._queue('xread', args)
  }

  sadd(...args) {
    return this._queue('sadd', args)
  }

  srem(...args) {
    return this._queue('srem', args)
  }

  smembers(...args) {
    return this._queue('smembers', args)
  }

  scard(...args) {
    return this._queue('scard', args)
  }

  sismember(...args) {
    return this._queue('sismember', args)
  }

  exec() {
    const results = []
    for (const op of this.operations) {
      try {
        const value = op()
        results.push([null, value])
      } catch (error) {
        results.push([error, null])
      }
    }
    return results
  }
}

class SQLiteCompatClient {
  constructor(db) {
    this.db = db
    this.driver = 'sqlite'
    this._prepareStatements()
  }

  _nowMs() {
    return Date.now()
  }

  _prepareStatements() {
    this.stmts = {
      getMeta: this.db.prepare('SELECT key, type, expires_at FROM kv_meta WHERE key = ?'),
      upsertMeta: this.db.prepare(
        'INSERT INTO kv_meta(key, type, expires_at) VALUES(@key, @type, @expires_at) ' +
          'ON CONFLICT(key) DO UPDATE SET type = excluded.type, expires_at = excluded.expires_at'
      ),
      updateExpiry: this.db.prepare('UPDATE kv_meta SET expires_at = @expires_at WHERE key = @key'),
      deleteMeta: this.db.prepare('DELETE FROM kv_meta WHERE key = ?'),
      insertHash: this.db.prepare(
        'INSERT INTO kv_hash(key, field, value) VALUES(@key, @field, @value) ' +
          'ON CONFLICT(key, field) DO UPDATE SET value = excluded.value'
      ),
      deleteHashField: this.db.prepare('DELETE FROM kv_hash WHERE key = ? AND field = ?'),
      selectHash: this.db.prepare('SELECT field, value FROM kv_hash WHERE key = ?'),
      deleteHash: this.db.prepare('DELETE FROM kv_hash WHERE key = ?'),
      insertString: this.db.prepare(
        'INSERT INTO kv_strings(key, value) VALUES(@key, @value) ' +
          'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      ),
      selectString: this.db.prepare('SELECT value FROM kv_strings WHERE key = ?'),
      deleteString: this.db.prepare('DELETE FROM kv_strings WHERE key = ?'),
      insertList: this.db.prepare(
        'INSERT INTO kv_list(key, idx, value) VALUES(@key, @idx, @value) ' +
          'ON CONFLICT(key, idx) DO UPDATE SET value = excluded.value'
      ),
      deleteListKey: this.db.prepare('DELETE FROM kv_list WHERE key = ?'),
      selectList: this.db.prepare('SELECT idx, value FROM kv_list WHERE key = ? ORDER BY idx ASC'),
      deleteListByRange: this.db.prepare(
        'DELETE FROM kv_list WHERE key = ? AND idx NOT BETWEEN ? AND ?'
      ),
      insertSetMember: this.db.prepare('INSERT OR IGNORE INTO kv_set(key, member) VALUES(?, ?)'),
      deleteSetMember: this.db.prepare('DELETE FROM kv_set WHERE key = ? AND member = ?'),
      deleteSetKey: this.db.prepare('DELETE FROM kv_set WHERE key = ?'),
      selectSetMembers: this.db.prepare('SELECT member FROM kv_set WHERE key = ?'),
      countSetMembers: this.db.prepare('SELECT COUNT(*) as count FROM kv_set WHERE key = ?'),
      selectSetMember: this.db.prepare('SELECT 1 FROM kv_set WHERE key = ? AND member = ?'),
      selectKeys: this.db.prepare('SELECT key, type, expires_at FROM kv_meta'),
      deleteZSetKey: this.db.prepare('DELETE FROM kv_zset WHERE key = ?'),
      insertZSet: this.db.prepare(
        'INSERT INTO kv_zset(key, member, score) VALUES(@key, @member, @score) ' +
          'ON CONFLICT(key, member) DO UPDATE SET score = excluded.score'
      ),
      deleteZSetRange: this.db.prepare(
        'DELETE FROM kv_zset WHERE key = ? AND score BETWEEN ? AND ?'
      ),
      deleteZSetMember: this.db.prepare('DELETE FROM kv_zset WHERE key = ? AND member = ?'),
      countZSet: this.db.prepare('SELECT COUNT(*) as count FROM kv_zset WHERE key = ?'),
      scoreZSet: this.db.prepare('SELECT score FROM kv_zset WHERE key = ? AND member = ?'),
      insertStreamEntry: this.db.prepare(
        'INSERT INTO stream_entries(stream_key, timestamp_ms, sequence, entry_id, data_json) VALUES(@stream_key, @timestamp_ms, @sequence, @entry_id, @data_json)'
      ),
      deleteOldestStreamEntry: this.db.prepare(
        'DELETE FROM stream_entries WHERE stream_key = @stream_key AND entry_id IN (SELECT entry_id FROM stream_entries WHERE stream_key = @stream_key ORDER BY timestamp_ms ASC, sequence ASC LIMIT @excess)'
      ),
      countStreamEntries: this.db.prepare(
        'SELECT COUNT(*) as count FROM stream_entries WHERE stream_key = ?'
      ),
      selectFirstStreamEntry: this.db.prepare(
        'SELECT entry_id, data_json FROM stream_entries WHERE stream_key = ? ORDER BY timestamp_ms ASC, sequence ASC LIMIT 1'
      ),
      selectLastStreamEntry: this.db.prepare(
        'SELECT entry_id, data_json FROM stream_entries WHERE stream_key = ? ORDER BY timestamp_ms DESC, sequence DESC LIMIT 1'
      ),
      getLastStreamEntry: this.db.prepare(
        'SELECT timestamp_ms, sequence FROM stream_entries WHERE stream_key = ? ORDER BY timestamp_ms DESC, sequence DESC LIMIT 1'
      ),
      selectStreamAfterId: this.db.prepare(
        'SELECT entry_id, data_json FROM stream_entries WHERE stream_key = @stream_key AND entry_id > @last_id ORDER BY timestamp_ms ASC, sequence ASC LIMIT @count'
      ),
      selectStreamEntries: this.db.prepare(
        'SELECT entry_id, data_json FROM stream_entries WHERE stream_key = ? ORDER BY timestamp_ms ASC, sequence ASC'
      ),
      insertStreamGroup: this.db.prepare(
        'INSERT INTO stream_groups(stream_key, group_name, last_delivered_id) VALUES(@stream_key, @group_name, @last_delivered_id)'
      ),
      getStreamGroup: this.db.prepare(
        'SELECT last_delivered_id FROM stream_groups WHERE stream_key = ? AND group_name = ?'
      ),
      updateStreamGroup: this.db.prepare(
        'UPDATE stream_groups SET last_delivered_id = @last_delivered_id WHERE stream_key = @stream_key AND group_name = @group_name'
      ),
      countStreamGroups: this.db.prepare(
        'SELECT COUNT(*) as count FROM stream_groups WHERE stream_key = ?'
      )
    }
  }

  _fetchMeta(key) {
    const row = this.stmts.getMeta.get(key)
    if (!row) {
      return null
    }
    if (row.expires_at !== null && row.expires_at <= this._nowMs()) {
      this._deleteKey(row.key, row.type)
      return null
    }
    return row
  }

  _ensureMeta(key, type) {
    const existing = this._fetchMeta(key)
    const expiresAt = existing?.expires_at ?? null
    if (existing?.type && existing.type !== type) {
      this._deleteKey(key, existing.type)
    }
    this.stmts.upsertMeta.run({ key, type, expires_at: expiresAt })
  }

  _setExpiryMs(key, expiresAt) {
    this.stmts.updateExpiry.run({ key, expires_at: expiresAt })
  }

  _clearExpiry(key) {
    this.stmts.updateExpiry.run({ key, expires_at: null })
  }

  _deleteKey(key, type) {
    const keyType = type || this._fetchMeta(key)?.type
    if (!keyType) {
      return 0
    }

    switch (keyType) {
      case 'hash':
        this.stmts.deleteHash.run(key)
        break
      case 'string':
        this.stmts.deleteString.run(key)
        break
      case 'list':
        this.stmts.deleteListKey.run(key)
        break
      case 'set':
        this.stmts.deleteSetKey.run(key)
        break
      case 'zset':
        this.stmts.deleteZSetKey.run(key)
        break
      case 'stream':
        this.db.prepare('DELETE FROM stream_entries WHERE stream_key = ?').run(key)
        this.db.prepare('DELETE FROM stream_groups WHERE stream_key = ?').run(key)
        break
      default:
        break
    }

    this.stmts.deleteMeta.run(key)
    return 1
  }

  _generateStreamId(key, idArg) {
    const nowMs = this._nowMs()
    let timestampMs = nowMs
    let sequence = 0

    if (idArg && idArg !== '*') {
      const parts = String(idArg).split('-')
      if (parts.length === 2) {
        timestampMs = Number(parts[0])
        sequence = Number(parts[1])
      }
    } else {
      const last = this.stmts.getLastStreamEntry.get(key)
      if (last && last.timestamp_ms === timestampMs) {
        sequence = last.sequence + 1
      }
    }

    const entryId = `${timestampMs}-${sequence}`
    return { timestampMs, sequence, entryId }
  }

  keys(pattern = '*') {
    const sqlPattern = new RegExp(`^${pattern.split('*').map(escapeRegex).join('.*')}$`)
    const now = this._nowMs()
    const results = []
    const rows = this.stmts.selectKeys.all()
    for (const row of rows) {
      if (row.expires_at !== null && row.expires_at <= now) {
        this._deleteKey(row.key, row.type)
        continue
      }
      if (sqlPattern.test(row.key)) {
        results.push(row.key)
      }
    }
    return results
  }

  /**
   * 简化版 SCAN：忽略游标与 COUNT，一次返回所有匹配键
   * @param {string} cursor - 起始游标（兼容签名，未使用）
   * @param  {...any} args - 额外参数，支持 MATCH <pattern>
   * @returns {[string, string[]]} [nextCursor, keys]
   */
  scan(cursor = '0', ...args) {
    let pattern = '*'
    for (let i = 0; i < args.length; i++) {
      if (String(args[i]).toUpperCase() === 'MATCH' && args[i + 1]) {
        pattern = args[i + 1]
        break
      }
    }
    const keys = this.keys(pattern)
    return ['0', keys]
  }

  type(key) {
    const meta = this._fetchMeta(key)
    if (!meta) {
      return 'none'
    }
    return meta.type
  }

  exists(key) {
    return this._fetchMeta(key) ? 1 : 0
  }

  expire(key, ttlSeconds) {
    const meta = this._fetchMeta(key)
    if (!meta) {
      return 0
    }
    const expiresAt = this._nowMs() + ttlSeconds * 1000
    this._setExpiryMs(key, expiresAt)
    return 1
  }

  pexpire(key, ttlMilliseconds) {
    const meta = this._fetchMeta(key)
    if (!meta) {
      return 0
    }
    const expiresAt = this._nowMs() + parseInt(ttlMilliseconds, 10)
    this._setExpiryMs(key, expiresAt)
    return 1
  }

  persist(key) {
    const meta = this._fetchMeta(key)
    if (!meta) {
      return 0
    }
    if (meta.expires_at === null) {
      return 0
    }
    this._clearExpiry(key)
    return 1
  }

  ttl(key) {
    const meta = this._fetchMeta(key)
    if (!meta) {
      return -2
    }
    if (meta.expires_at === null) {
      return -1
    }
    return Math.ceil((meta.expires_at - this._nowMs()) / 1000)
  }

  del(...keys) {
    let removed = 0
    for (const key of keys) {
      removed += this._deleteKey(key)
    }
    return removed
  }

  set(key, value, ...options) {
    let expireMs = null
    let mode = null
    for (let i = 0; i < options.length; i++) {
      const token = String(options[i]).toUpperCase()
      if (token === 'PX') {
        expireMs = parseInt(options[++i], 10)
      } else if (token === 'EX') {
        expireMs = parseInt(options[++i], 10) * 1000
      } else if (token === 'NX' || token === 'XX') {
        mode = token
      }
    }

    const meta = this._fetchMeta(key)
    if (mode === 'NX' && meta) {
      return null
    }
    if (mode === 'XX' && !meta) {
      return null
    }

    this._ensureMeta(key, 'string')
    this.stmts.insertString.run({ key, value: value === null ? null : String(value) })

    if (expireMs !== null) {
      this._setExpiryMs(key, this._nowMs() + expireMs)
    } else {
      this._clearExpiry(key)
    }

    return 'OK'
  }

  setex(key, ttlSeconds, value) {
    const result = this.set(key, value)
    if (result) {
      this.expire(key, ttlSeconds)
    }
    return result
  }

  get(key) {
    const meta = this._fetchMeta(key)
    if (!meta) {
      return null
    }
    if (meta.type !== 'string') {
      return null
    }
    const row = this.stmts.selectString.get(key)
    return row ? row.value : null
  }

  hset(key, field, value) {
    this._ensureMeta(key, 'hash')
    let added = 0
    if (typeof field === 'object' && field !== null) {
      for (const [entryField, entryValue] of Object.entries(field)) {
        added += this._hsetSingle(key, entryField, entryValue)
      }
    } else {
      added += this._hsetSingle(key, field, value)
    }
    return added
  }

  hmset(key, map) {
    this._ensureMeta(key, 'hash')
    if (!map || typeof map !== 'object') {
      return 'OK'
    }
    for (const [field, value] of Object.entries(map)) {
      this._hsetSingle(key, field, value)
    }
    return 'OK'
  }

  _hsetSingle(key, field, value) {
    const existing = this.db
      .prepare('SELECT value FROM kv_hash WHERE key = ? AND field = ?')
      .get(key, field)
    this.stmts.insertHash.run({ key, field, value: value === null ? null : String(value) })
    return existing ? 0 : 1
  }

  hgetall(key) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'hash') {
      return {}
    }
    const rows = this.stmts.selectHash.all(key)
    return rows.reduce((acc, row) => {
      acc[row.field] = row.value
      return acc
    }, {})
  }

  hget(key, field) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'hash') {
      return null
    }
    const row = this.db
      .prepare('SELECT value FROM kv_hash WHERE key = ? AND field = ?')
      .get(key, field)
    return row ? row.value : null
  }

  hmget(key, ...fields) {
    const fieldList = fields.length === 1 && Array.isArray(fields[0]) ? fields[0] : fields
    if (fieldList.length === 0) {
      return []
    }
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'hash') {
      return fieldList.map(() => null)
    }
    const stmt = this.db.prepare('SELECT value FROM kv_hash WHERE key = ? AND field = ?')
    return fieldList.map((field) => {
      const row = stmt.get(key, field)
      return row ? row.value : null
    })
  }

  hdel(key, ...fields) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'hash') {
      return 0
    }
    let removed = 0
    for (const field of fields) {
      removed += this.stmts.deleteHashField.run(key, field).changes
    }
    return removed
  }

  hincrby(key, field, amount) {
    const current = parseInt(this.hget(key, field) || '0', 10)
    const next = current + parseInt(amount, 10)
    this._ensureMeta(key, 'hash')
    this.stmts.insertHash.run({ key, field, value: String(next) })
    return next
  }

  hincrbyfloat(key, field, amount) {
    const current = parseFloat(this.hget(key, field) || '0')
    const next = current + parseFloat(amount)
    this._ensureMeta(key, 'hash')
    this.stmts.insertHash.run({ key, field, value: String(next) })
    return next
  }

  incrbyfloat(key, amount) {
    const current = parseFloat(this.get(key) || '0')
    const next = current + parseFloat(amount)
    this.set(key, String(next))
    return next
  }

  incr(key) {
    const current = parseInt(this.get(key) || '0', 10)
    const next = current + 1
    this.set(key, String(next))
    return next
  }

  pipeline() {
    return new SQLitePipeline(this)
  }

  multi() {
    return this.pipeline()
  }

  _ensureMetaType(key, type) {
    this._ensureMeta(key, type)
  }

  lpush(key, ...values) {
    this._ensureMeta(key, 'list')
    const rows = this.stmts.selectList.all(key)
    let minIdx = rows.length > 0 ? rows[0].idx : 0
    if (rows.length === 0) {
      minIdx = 0
    }
    let inserted = 0
    for (const value of values) {
      minIdx -= 1
      this.stmts.insertList.run({ key, idx: minIdx, value: value === null ? null : String(value) })
      inserted++
    }
    return inserted
  }

  ltrim(key, start, stop) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'list') {
      return 'OK'
    }
    const rows = this.stmts.selectList.all(key)
    if (rows.length === 0) {
      return 'OK'
    }
    const sliced = rows.slice(start, stop === -1 ? undefined : stop + 1)
    if (sliced.length === rows.length) {
      return 'OK'
    }
    this.stmts.deleteListKey.run(key)
    let idx = 0
    for (const row of sliced) {
      this.stmts.insertList.run({ key, idx, value: row.value })
      idx += 1
    }
    return 'OK'
  }

  lrange(key, start, stop) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'list') {
      return []
    }
    const rows = this.stmts.selectList.all(key)
    if (rows.length === 0) {
      return []
    }
    const normalizedStop = stop === -1 ? rows.length - 1 : stop
    const sliced = rows.slice(start, normalizedStop + 1)
    return sliced.map((row) => row.value)
  }

  sadd(key, ...members) {
    this._ensureMeta(key, 'set')
    let added = 0
    for (const member of members) {
      const normalized = String(member)
      const result = this.stmts.insertSetMember.run(key, normalized)
      if (result.changes > 0) {
        added += 1
      }
    }
    return added
  }

  srem(key, ...members) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'set') {
      return 0
    }
    let removed = 0
    for (const member of members) {
      const normalized = String(member)
      removed += this.stmts.deleteSetMember.run(key, normalized).changes
    }
    return removed
  }

  smembers(key) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'set') {
      return []
    }
    const rows = this.stmts.selectSetMembers.all(key)
    return rows.map((row) => row.member)
  }

  scard(key) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'set') {
      return 0
    }
    const row = this.stmts.countSetMembers.get(key)
    return row ? row.count : 0
  }

  sismember(key, member) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'set') {
      return 0
    }
    const normalized = String(member)
    const row = this.stmts.selectSetMember.get(key, normalized)
    return row ? 1 : 0
  }

  // Placeholder implementations for commands not yet ported
  /**
   * Simplified eval() implementation for token refresh lock release
   * Only supports the specific Lua script used in tokenRefreshService:
   *   if datastore.call("get", KEYS[1]) == ARGV[1] then
   *     return datastore.call("del", KEYS[1])
   *   else
   *     return 0
   *   end
   *
   * @param {string} script - Lua script (currently ignored, hardcoded logic)
   * @param {number} numKeys - Number of KEYS arguments
   * @param {...string} args - KEYS followed by ARGV arguments
   * @returns {number} 1 if deleted, 0 if not
   */
  eval(script, numKeys, ...args) {
    // Extract KEYS and ARGV based on numKeys
    const keys = args.slice(0, numKeys)
    const argv = args.slice(numKeys)

    if (keys.length !== 1 || argv.length !== 1) {
      throw new Error(
        'SQLite eval() only supports the token lock release pattern (1 KEY, 1 ARGV)',
      )
    }

    const [key] = keys
    const [expectedValue] = argv

    // Simulate: if datastore.call("get", KEYS[1]) == ARGV[1] then return datastore.call("del", KEYS[1]) else return 0 end
    const actualValue = this.get(key)

    if (actualValue === expectedValue) {
      this.del(key)
      return 1
    }

    return 0
  }

  zadd(key, ...args) {
    if (args.length === 0 || args.length % 2 !== 0) {
      throw new Error('zadd requires score/member pairs')
    }
    let added = 0
    for (let i = 0; i < args.length; i += 2) {
      const score = Number(args[i])
      const member = String(args[i + 1])
      const existing = this.stmts.scoreZSet.get(key, member)
      this._ensureMeta(key, 'zset')
      this.stmts.insertZSet.run({ key, member, score })
      if (!existing) {
        added++
      }
    }
    return added
  }

  zremrangebyscore(key, min, max) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'zset') {
      return 0
    }

    const minBound = parseScoreBoundary(min)
    const maxBound = parseScoreBoundary(max)

    let sql = 'DELETE FROM kv_zset WHERE key = @key'
    const params = { key }

    if (!minBound.unbounded) {
      sql += minBound.inclusive ? ' AND score >= @min' : ' AND score > @min'
      params.min = minBound.value
    }

    if (!maxBound.unbounded) {
      sql += maxBound.inclusive ? ' AND score <= @max' : ' AND score < @max'
      params.max = maxBound.value
    }

    const stmt = this.db.prepare(sql)
    return stmt.run(params).changes
  }

  zrem(key, member) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'zset') {
      return 0
    }
    return this.stmts.deleteZSetMember.run(key, member).changes
  }

  zcard(key) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'zset') {
      return 0
    }
    const row = this.stmts.countZSet.get(key)
    return row ? row.count : 0
  }

  zscore(key, member) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'zset') {
      return null
    }
    const row = this.stmts.scoreZSet.get(key, member)
    return row ? Number(row.score) : null
  }

  zrange(key, start, stop, ...args) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'zset') {
      return []
    }

    const options = args.map((arg) => String(arg).toUpperCase())
    const withScores = options.includes('WITHSCORES')
    const byScore = options.includes('BYSCORE')
    const byLex = options.includes('BYLEX')

    if (byLex) {
      throw new Error('BYLEX is not supported in SQLite datastore')
    }

    if (byScore) {
      const min = start
      const max = stop
      const minBound = parseScoreBoundary(min)
      const maxBound = parseScoreBoundary(max)

      let sql = 'SELECT member, score FROM kv_zset WHERE key = @key'
      const params = { key }

      if (!minBound.unbounded) {
        sql += minBound.inclusive ? ' AND score >= @min' : ' AND score > @min'
        params.min = minBound.value
      }

      if (!maxBound.unbounded) {
        sql += maxBound.inclusive ? ' AND score <= @max' : ' AND score < @max'
        params.max = maxBound.value
      }

      sql += ' ORDER BY score ASC, member ASC'

      const rows = this.db.prepare(sql).all(params)
      return formatZRangeRows(rows, withScores)
    }

    const rows = this.db
      .prepare('SELECT member, score FROM kv_zset WHERE key = ? ORDER BY score ASC, member ASC')
      .all(key)

    const normalizedStop = stop === -1 ? rows.length - 1 : stop
    const sliced = rows.slice(start, normalizedStop + 1)

    return formatZRangeRows(sliced, withScores)
  }

  xadd(key, ...args) {
    let idx = 0
    let maxLen = null
    if (typeof args[idx] === 'string' && args[idx].toUpperCase() === 'MAXLEN') {
      idx += 1
      if (args[idx] === '~') {
        idx += 1
      }
      maxLen = parseInt(args[idx], 10)
      idx += 1
    }

    const idArg = args[idx++] || '*'
    const field = args[idx++]
    const value = args[idx++]

    if (field !== 'data') {
      throw new Error('SQLite stream implementation only supports single field "data"')
    }

    this._ensureMeta(key, 'stream')

    const { timestampMs, sequence, entryId } = this._generateStreamId(key, idArg)

    this.stmts.insertStreamEntry.run({
      stream_key: key,
      timestamp_ms: timestampMs,
      sequence,
      entry_id: entryId,
      data_json: value
    })

    if (maxLen && maxLen > 0) {
      const countRow = this.stmts.countStreamEntries.get(key)
      const currentCount = countRow ? countRow.count : 0
      if (currentCount > maxLen) {
        const excess = currentCount - maxLen
        this.stmts.deleteOldestStreamEntry.run({ stream_key: key, excess })
      }
    }

    return entryId
  }

  xinfo(type, key) {
    if (String(type).toUpperCase() !== 'STREAM') {
      throw new Error('SQLite datastore only implements XINFO STREAM')
    }
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'stream') {
      throw new Error('ERR no such key')
    }

    const lengthRow = this.stmts.countStreamEntries.get(key)
    const length = lengthRow ? lengthRow.count : 0
    const first = this.stmts.selectFirstStreamEntry.get(key)
    const last = this.stmts.selectLastStreamEntry.get(key)
    const groupsRow = this.stmts.countStreamGroups.get(key)

    return [
      'length',
      length,
      'first-entry',
      first ? formatStreamEntry(first) : null,
      'last-entry',
      last ? formatStreamEntry(last) : null,
      'groups',
      groupsRow ? groupsRow.count : 0
    ]
  }

  xgroup(...args) {
    const subcommand = String(args[0]).toUpperCase()
    if (subcommand !== 'CREATE') {
      throw new Error('SQLite datastore only implements XGROUP CREATE')
    }

    const streamKey = args[1]
    const groupName = args[2]
    const id = args[3] || '0-0'
    const mkstreamFlag = String(args[4] || '').toUpperCase() === 'MKSTREAM'

    let meta = this._fetchMeta(streamKey)
    if (!meta) {
      if (!mkstreamFlag) {
        throw new Error('ERR stream does not exist')
      }
      this._ensureMeta(streamKey, 'stream')
      meta = this._fetchMeta(streamKey)
    } else if (meta.type !== 'stream') {
      throw new Error('WRONGTYPE Operation against a key holding the wrong kind of value')
    }

    const existing = this.stmts.getStreamGroup.get(streamKey, groupName)
    if (existing) {
      throw new Error('BUSYGROUP Consumer Group name already exists')
    }

    this.stmts.insertStreamGroup.run({
      stream_key: streamKey,
      group_name: groupName,
      last_delivered_id: String(id)
    })
    return 'OK'
  }

  xread(...args) {
    const options = {}
    let index = 0
    while (index < args.length) {
      const token = String(args[index]).toUpperCase()
      if (token === 'BLOCK') {
        options.block = parseInt(args[index + 1], 10)
        index += 2
      } else if (token === 'COUNT') {
        options.count = parseInt(args[index + 1], 10)
        index += 2
      } else if (token === 'STREAMS') {
        index += 1
        break
      } else {
        break
      }
    }

    const streamKeys = args.slice(index, index + Math.floor((args.length - index) / 2))
    const ids = args.slice(index + streamKeys.length)
    const count = options.count || 100
    const responses = []

    for (let i = 0; i < streamKeys.length; i += 1) {
      const streamKey = streamKeys[i]
      const lastId = ids[i] || '0-0'
      const meta = this._fetchMeta(streamKey)
      if (!meta || meta.type !== 'stream') {
        continue
      }

      const rows = this.stmts.selectStreamAfterId.all({
        stream_key: streamKey,
        last_id: lastId,
        count
      })
      if (rows.length === 0) {
        continue
      }
      const entries = rows.map((row) => formatStreamEntry(row))
      responses.push([streamKey, entries])
    }

    return responses.length > 0 ? responses : null
  }

  xrange(key, _start, _end) {
    const meta = this._fetchMeta(key)
    if (!meta || meta.type !== 'stream') {
      return []
    }

    const rows = this.stmts.selectStreamEntries.all(key)
    return rows.map((row) => [row.entry_id, ['data', row.data_json]])
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseScoreBoundary(bound) {
  if (bound === undefined || bound === null) {
    return { unbounded: true }
  }

  let inclusive = true
  let normalized = bound

  if (typeof bound === 'string') {
    normalized = bound.trim()
    if (normalized.startsWith('(')) {
      inclusive = false
      normalized = normalized.slice(1).trim()
    }

    const lower = normalized.toLowerCase()
    if (lower === '-inf') {
      return { unbounded: true, direction: 'negative' }
    }
    if (lower === '+inf' || lower === 'inf') {
      return { unbounded: true, direction: 'positive' }
    }

    const parsed = Number(normalized)
    if (Number.isNaN(parsed)) {
      return { unbounded: true }
    }
    return { unbounded: false, value: parsed, inclusive }
  }

  const numeric = Number(bound)
  if (Number.isNaN(numeric)) {
    return { unbounded: true }
  }
  return { unbounded: false, value: numeric, inclusive }
}

function formatZRangeRows(rows, withScores) {
  if (!withScores) {
    return rows.map((row) => row.member)
  }
  const result = []
  for (const row of rows) {
    result.push(row.member, String(row.score))
  }
  return result
}

function formatStreamEntry(row) {
  return [row.entry_id, ['data', row.data_json]]
}

class SQLiteDataStore extends RedisClientClass {
  constructor(options = {}) {
    super()
    this.options = options
    this.db = null
    this.compatClient = null
    this.isConnected = false
    this.driver = 'sqlite'
  }

  async connect() {
    if (!Database) {
      try {
        Database = require('better-sqlite3')
      } catch (error) {
        throw new Error(
          'better-sqlite3 is required for SQLite datastore. Please run `npm install`.'
        )
      }
    }

    if (this.isConnected) {
      return this.compatClient
    }

    const { filename } = this.options
    if (!this.options.filename) {
      throw new Error('SQLite datastore requires a filename option')
    }

    const dir = path.dirname(filename)
    fs.mkdirSync(dir, { recursive: true })

    const busyTimeout = this.options.busyTimeout || 5000
    this.db = new Database(filename, { timeout: busyTimeout })

    if (this.options.pragma?.journalMode) {
      this.db.pragma(`journal_mode = ${this.options.pragma.journalMode}`)
    }
    if (this.options.pragma?.synchronous) {
      this.db.pragma(`synchronous = ${this.options.pragma.synchronous}`)
    }

    if (this.options.applySchema !== false) {
      this._applySchema()
    }

    this.compatClient = new SQLiteCompatClient(this.db)
    this.compatClient.driver = 'sqlite'
    this.client = this.compatClient
    this.isConnected = true
    return this.compatClient
  }

  _applySchema() {
    const schemaPath = this.options.schemaPath || DEFAULT_SCHEMA_PATH
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`SQLite schema file not found at ${schemaPath}`)
    }
    const schemaSql = fs.readFileSync(schemaPath, 'utf8')
    this.db.exec('BEGIN;')
    try {
      const statements = schemaSql
        .split(/;\s*$/m)
        .map((statement) => statement.trim())
        .filter(Boolean)
        .filter((statement) => !statement.match(/^\s*PRAGMA/i)) // Skip PRAGMA statements (already applied separately)
      for (const statement of statements) {
        this.db.exec(`${statement};`)
      }
      this.db.exec('COMMIT;')
    } catch (error) {
      this.db.exec('ROLLBACK;')
      throw error
    }
  }

  /**
   * 清理所有排队计数器（用于服务重启）
   * @returns {Promise<number>} 清理的计数器数量
   */
  async clearAllConcurrencyQueues() {
    try {
      if (!this.compatClient) {
        return 0
      }

      // 获取所有匹配 concurrency:queue:* 的键
      const allKeys = this.compatClient.keys('concurrency:queue:*')

      // 过滤掉统计数据键，只删除排队计数器
      const queueKeys = allKeys.filter(
        (key) =>
          !key.startsWith('concurrency:queue:stats:') &&
          !key.startsWith('concurrency:queue:wait_times:')
      )

      if (queueKeys.length > 0) {
        this.compatClient.del(...queueKeys)
        logger.info(`🚦 Cleared ${queueKeys.length} concurrency queue counter(s) on startup`)
      }

      return queueKeys.length
    } catch (error) {
      logger.error('Failed to clear all concurrency queues:', error)
      return 0
    }
  }

  async disconnect() {
    if (this.db) {
      this.db.close()
    }
    this.db = null
    this.compatClient = null
    this.isConnected = false
  }

  getClient() {
    return this.compatClient
  }

  getClientSafe() {
    if (!this.compatClient) {
      throw new Error('SQLite datastore is not connected')
    }
    return this.compatClient
  }
}

function createSQLiteStore(options = {}) {
  const sqliteOptions = {
    filename: options.filename,
    busyTimeout: options.busyTimeout,
    pragma: options.pragma,
    applySchema: options.applySchema,
    schemaPath: options.schemaPath
  }

  const store = new SQLiteDataStore(sqliteOptions)
  return store
}

const helperMethods = [
  'getDateInTimezone',
  'getDateStringInTimezone',
  'getHourInTimezone',
  'getWeekStringInTimezone'
]
for (const method of helperMethods) {
  if (typeof redisInstance[method] === 'function') {
    SQLiteDataStore.prototype[method] = redisInstance[method].bind(redisInstance)
  }
}

module.exports = {
  createSQLiteStore,
  SQLiteDataStore
}
