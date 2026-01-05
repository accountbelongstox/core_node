#!/usr/bin/env node

/**
 * 在Client端的SQLite数据库中创建WebSocket Client API Key
 * 如果.env中未配置WS_CLIENT_API_KEY，则自动生成一个新的API Key
 */

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const envPath = path.join(__dirname, '..', '.env')
require('dotenv').config({ path: envPath })

// 加载配置
const config = require('../config/config')

// 初始化SQLite连接
const Database = require('better-sqlite3')
const dbPath = config.datastore.sqlite.filename

console.log('📂 数据库路径:', dbPath)

const db = new Database(dbPath, {
  verbose: console.log
})

/**
 * 生成新的 API Key
 * @returns {string} 格式为 cr_<64位十六进制字符串>
 */
function generateApiKey() {
  const prefix = process.env.API_KEY_PREFIX || 'cr_'
  const randomBytes = crypto.randomBytes(32).toString('hex')
  return `${prefix}${randomBytes}`
}

/**
 * 更新 .env 文件中的 WS_CLIENT_API_KEY
 * @param {string} apiKey - 新的 API Key
 */
function updateEnvFile(apiKey) {
  let envContent = ''

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8')
  }

  // 检查是否已存在 WS_CLIENT_API_KEY 配置
  const wsClientKeyRegex = /^WS_CLIENT_API_KEY=.*$/m

  if (wsClientKeyRegex.test(envContent)) {
    // 替换现有的值
    envContent = envContent.replace(wsClientKeyRegex, `WS_CLIENT_API_KEY=${apiKey}`)
  } else {
    // 在 WS_CLIENT_ENABLED 后面添加，或者在文件末尾添加
    const wsEnabledRegex = /^(WS_CLIENT_ENABLED=.*)$/m
    if (wsEnabledRegex.test(envContent)) {
      // 在 WS_SERVER_URL 后面添加
      const wsServerUrlRegex = /^(WS_SERVER_URL=.*)$/m
      if (wsServerUrlRegex.test(envContent)) {
        envContent = envContent.replace(wsServerUrlRegex, `$1\nWS_CLIENT_API_KEY=${apiKey}`)
      } else {
        envContent = envContent.replace(wsEnabledRegex, `$1\nWS_CLIENT_API_KEY=${apiKey}`)
      }
    } else {
      // 在文件末尾添加
      if (!envContent.endsWith('\n')) {
        envContent += '\n'
      }
      envContent += `WS_CLIENT_API_KEY=${apiKey}\n`
    }
  }

  fs.writeFileSync(envPath, envContent, 'utf-8')
  console.log('✅ 已更新 .env 文件中的 WS_CLIENT_API_KEY')
}

// 从.env读取Client API Key，如果不存在则生成新的
let clientApiKey = process.env.WS_CLIENT_API_KEY

if (!clientApiKey) {
  console.log('⚠️  .env中未配置 WS_CLIENT_API_KEY，正在生成新的 API Key...')
  clientApiKey = generateApiKey()
  console.log('🔑 生成的新 API Key:', clientApiKey)

  // 更新 .env 文件
  updateEnvFile(clientApiKey)
}

console.log('📋 Client API Key:', clientApiKey)

// 使用与Service端相同的加密密钥
const { encryptionKey } = config.security
console.log('🔐 Encryption Key:', encryptionKey)

// 计算哈希值（与Service端逻辑一致）
const hashedKey = crypto
  .createHash('sha256')
  .update(clientApiKey + encryptionKey)
  .digest('hex')

console.log('🔐 计算的哈希值:', hashedKey)

// 准备API Key数据
const keyId = crypto.randomUUID()
const keyData = {
  id: keyId,
  name: 'WebSocket Client Key',
  description: 'API Key for WebSocket client authentication',
  permissions: 'all',
  isActive: 'true',
  tokenLimit: 1000000000,
  createdAt: new Date().toISOString(),
  expiresAt: null
}

console.log('\n📝 API Key 数据:')
console.log('  ID:', keyId)
console.log('  Name:', keyData.name)
console.log('  Permissions:', keyData.permissions)
console.log('  Active:', keyData.isActive)

// 插入到数据库
try {
  // 先检查是否已存在
  const existing = db.prepare('SELECT id FROM api_keys WHERE hashed_key = ?').get(hashedKey)

  if (existing) {
    console.log('\n⚠️  API Key 已存在，ID:', existing.id)
    console.log('删除旧记录并重新创建...')
    db.prepare('DELETE FROM api_keys WHERE hashed_key = ?').run(hashedKey)
  }

  // 插入新记录
  const stmt = db.prepare(`
    INSERT INTO api_keys (id, hashed_key, data_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const result = stmt.run(
    keyId,
    hashedKey,
    JSON.stringify(keyData),
    new Date().toISOString(),
    new Date().toISOString()
  )

  console.log('\n✅ API Key 创建成功!')
  console.log('  Row ID:', result.lastInsertRowid)
  console.log('  Changes:', result.changes)

  // 验证插入
  const inserted = db.prepare('SELECT * FROM api_keys WHERE id = ?').get(keyId)

  console.log('\n🔍 验证插入的数据:')
  console.log('  ID:', inserted.id)
  console.log('  Hash:', inserted.hashed_key)
  console.log('  Data:', JSON.parse(inserted.data_json))

  // 测试通过哈希查找
  const found = db.prepare('SELECT * FROM api_keys WHERE hashed_key = ?').get(hashedKey)

  if (found) {
    console.log('\n✅ 通过哈希值查找成功!')
    console.log('  找到的ID:', found.id)
  } else {
    console.log('\n❌ 通过哈希值查找失败!')
  }
} catch (error) {
  console.error('\n❌ 创建API Key失败:', error.message)
  console.error(error)
  process.exit(1)
} finally {
  db.close()
  console.log('\n📊 数据库连接已关闭')
}
