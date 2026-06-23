'use strict'

const { getMysqlPool } = require('../mysqlPool')

const CORE_FIELDS = new Set([
  'id',
  'username',
  'email',
  'displayName',
  'firstName',
  'lastName',
  'role',
  'isActive',
  'passwordHash',
  'emailVerified',
  'registrationMethod',
  'subscriptionId',
  'lastLoginAt',
  'deletedAt',
  'createdAt',
  'updatedAt'
])

const EXCLUDED_EXTRA_FIELDS = new Set(['totalUsage', 'apiKeyCount'])

function toIsoString(value) {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date.toISOString()
}

function toDate(value) {
  if (!value) {
    return null
  }
  if (value instanceof Date) {
    return value
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function normalizeOptional(value) {
  if (value === undefined || value === null || value === '') {
    return null
  }
  return value
}

function normalizeBool(value, fallback = false) {
  if (value === undefined || value === null) {
    return fallback
  }
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase()
    if (trimmed === 'true') {
      return true
    }
    if (trimmed === 'false') {
      return false
    }
  }
  return Boolean(value)
}

function safeJsonParse(raw) {
  if (!raw || typeof raw !== 'string') {
    return {}
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch (_) {
    return {}
  }
  return {}
}

function buildExtraData(user = {}) {
  const extra = {}
  for (const [key, value] of Object.entries(user)) {
    if (CORE_FIELDS.has(key) || EXCLUDED_EXTRA_FIELDS.has(key)) {
      continue
    }
    extra[key] = value
  }
  if (!Object.keys(extra).length) {
    return null
  }
  try {
    return JSON.stringify(extra)
  } catch (_) {
    return JSON.stringify({})
  }
}

function normalizeRow(row) {
  if (!row) {
    return null
  }
  const extra = safeJsonParse(row.data)
  return {
    ...extra,
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isActive: normalizeBool(row.is_active, true),
    passwordHash: row.password_hash,
    emailVerified: normalizeBool(row.email_verified, false),
    registrationMethod: row.registration_method,
    subscriptionId: row.subscription_id,
    lastLoginAt: toIsoString(row.last_login_at),
    deletedAt: toIsoString(row.deleted_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at)
  }
}

function buildWhereClause({ role, isActive } = {}) {
  const where = []
  const params = []
  if (role) {
    where.push('role = ?')
    params.push(role)
  }
  if (typeof isActive === 'boolean') {
    where.push('is_active = ?')
    params.push(isActive ? 1 : 0)
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''
  return { whereSql, params }
}

function normalizeUserForWrite(user = {}) {
  const createdAt = toDate(user.createdAt) || new Date()
  const updatedAt = toDate(user.updatedAt) || new Date()
  return {
    id: user.id,
    username: user.username,
    email: normalizeOptional(user.email),
    displayName: normalizeOptional(user.displayName),
    firstName: normalizeOptional(user.firstName),
    lastName: normalizeOptional(user.lastName),
    role: user.role || 'user',
    isActive: normalizeBool(user.isActive, true),
    passwordHash: normalizeOptional(user.passwordHash),
    emailVerified: normalizeBool(user.emailVerified, false),
    registrationMethod: user.registrationMethod || 'local',
    subscriptionId: normalizeOptional(user.subscriptionId),
    lastLoginAt: toDate(user.lastLoginAt),
    deletedAt: toDate(user.deletedAt),
    createdAt,
    updatedAt,
    data: buildExtraData(user)
  }
}

async function findById(userId) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM users WHERE id = ?', [userId])
  return rows.length ? normalizeRow(rows[0]) : null
}

async function findByUsername(username) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username])
  return rows.length ? normalizeRow(rows[0]) : null
}

async function findByEmail(email) {
  const pool = getMysqlPool()
  const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email])
  return rows.length ? normalizeRow(rows[0]) : null
}

async function createUser(user) {
  const pool = getMysqlPool()
  const record = normalizeUserForWrite(user)
  await pool.execute(
    `INSERT INTO users (
      id, username, email, display_name, first_name, last_name, role, is_active,
      password_hash, email_verified, registration_method, subscription_id,
      last_login_at, deleted_at, created_at, updated_at, data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      record.id,
      record.username,
      record.email,
      record.displayName,
      record.firstName,
      record.lastName,
      record.role,
      record.isActive ? 1 : 0,
      record.passwordHash,
      record.emailVerified ? 1 : 0,
      record.registrationMethod,
      record.subscriptionId,
      record.lastLoginAt,
      record.deletedAt,
      record.createdAt,
      record.updatedAt,
      record.data
    ]
  )
  return record
}

async function updateUser(user) {
  const pool = getMysqlPool()
  const record = normalizeUserForWrite(user)
  await pool.execute(
    `UPDATE users SET
      username = ?, email = ?, display_name = ?, first_name = ?, last_name = ?, role = ?,
      is_active = ?, password_hash = ?, email_verified = ?, registration_method = ?,
      subscription_id = ?, last_login_at = ?, deleted_at = ?, updated_at = ?, data = ?
     WHERE id = ?`,
    [
      record.username,
      record.email,
      record.displayName,
      record.firstName,
      record.lastName,
      record.role,
      record.isActive ? 1 : 0,
      record.passwordHash,
      record.emailVerified ? 1 : 0,
      record.registrationMethod,
      record.subscriptionId,
      record.lastLoginAt,
      record.deletedAt,
      record.updatedAt,
      record.data,
      record.id
    ]
  )
  return record
}

async function listUsers(options = {}) {
  const { role, isActive } = options
  const pageRaw = Number(options.page)
  const limitRaw = Number(options.limit)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 20
  const pool = getMysqlPool()
  const { whereSql, params } = buildWhereClause({ role, isActive })
  const offset = (page - 1) * limit

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) as c FROM users ${whereSql}`,
    params
  )
  const total = countRows[0]?.c || 0

  const [rows] = await pool.query(
    `SELECT * FROM users ${whereSql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params
  )

  return {
    users: rows.map(normalizeRow),
    total
  }
}

async function listAllUsers(filters = {}) {
  const pool = getMysqlPool()
  const { whereSql, params } = buildWhereClause(filters)
  const [rows] = await pool.execute(
    `SELECT * FROM users ${whereSql} ORDER BY created_at DESC`,
    params
  )
  return rows.map(normalizeRow)
}

module.exports = {
  findById,
  findByUsername,
  findByEmail,
  createUser,
  updateUser,
  listUsers,
  listAllUsers
}
