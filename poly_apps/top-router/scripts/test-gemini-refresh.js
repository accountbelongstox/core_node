#!/usr/bin/env node

/**
 * 测试 Gemini token 刷新功能
 */

const path = require('path')
const dotenv = require('dotenv')

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const redis = require('../src/models/datastore')
const geminiAccountService = require('../src/services/geminiAccountService')
const crypto = require('crypto')
const config = require('../config/config')

// 加密相关常量（与 geminiAccountService 保持一致）
const ALGORITHM = 'aes-256-cbc'
const ENCRYPTION_SALT = 'gemini-account-salt' // 注意：是 'gemini-account-salt' 不是其他值！

// 生成加密密钥
function generateEncryptionKey() {
  return crypto.scryptSync(config.security.encryptionKey, ENCRYPTION_SALT, 32)
}

// 解密函数（用于调试）
function debugDecrypt(text) {
  if (!text) {
    return { success: false, error: 'Empty text' }
  }
  try {
    const key = generateEncryptionKey()
    const ivHex = text.substring(0, 32)
    const encryptedHex = text.substring(33)

    const iv = Buffer.from(ivHex, 'hex')
    const encryptedText = Buffer.from(encryptedHex, 'hex')
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return { success: true, value: decrypted.toString() }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function testGeminiTokenRefresh() {
  try {
    console.log('🚀 开始测试 Gemini token 刷新功能...\n')

    // 显示配置信息
    console.log('📋 配置信息:')
    console.log(`   加密密钥: ${config.security.encryptionKey}`)
    console.log(`   加密盐值: ${ENCRYPTION_SALT}`)
    console.log()

    // 1. 连接 Redis
    console.log('📡 连接 Redis...')
    await redis.connect()
    console.log('✅ Redis 连接成功\n')

    // 2. 获取所有 Gemini 账户
    console.log('🔍 获取 Gemini 账户列表...')
    const accounts = await geminiAccountService.getAllAccounts()
    const geminiAccounts = accounts.filter((acc) => acc.platform === 'gemini')

    if (geminiAccounts.length === 0) {
      console.log('❌ 没有找到 Gemini 账户')
      process.exit(1)
    }

    console.log(`✅ 找到 ${geminiAccounts.length} 个 Gemini 账户\n`)

    // 3. 测试每个账户的 token 刷新
    for (const account of geminiAccounts) {
      console.log(`\n📋 测试账户: ${account.name} (${account.id})`)
      console.log(`   状态: ${account.status}`)

      try {
        // 获取原始账户数据（用于调试）
        const client = redis.getClient()
        const rawData = await client.hgetall(`gemini_account:${account.id}`)

        console.log('   📊 原始数据检查:')
        console.log(`      refreshToken 存在: ${rawData.refreshToken ? '是' : '否'}`)
        if (rawData.refreshToken) {
          console.log(`      refreshToken 长度: ${rawData.refreshToken.length}`)
          console.log(`      refreshToken 前50字符: ${rawData.refreshToken.substring(0, 50)}...`)

          // 尝试手动解密
          const decryptResult = debugDecrypt(rawData.refreshToken)
          if (decryptResult.success) {
            console.log('      ✅ 手动解密成功')
            console.log(`      解密后前20字符: ${decryptResult.value.substring(0, 20)}...`)
          } else {
            console.log(`      ❌ 手动解密失败: ${decryptResult.error}`)
          }
        }

        // 获取完整账户信息（包括解密的 token）
        const fullAccount = await geminiAccountService.getAccount(account.id)

        if (!fullAccount.refreshToken) {
          console.log('   ⚠️  跳过：该账户无 refresh token\n')
          continue
        }

        console.log('   ✅ 找到 refresh token')
        console.log(
          `   📝 解密后的 refresh token 前20字符: ${fullAccount.refreshToken.substring(0, 20)}...`
        )

        console.log('   🔄 开始刷新 token...')
        const startTime = Date.now()

        // 执行 token 刷新
        const newTokens = await geminiAccountService.refreshAccountToken(account.id)

        const duration = Date.now() - startTime
        console.log(`   ✅ Token 刷新成功！耗时: ${duration}ms`)
        console.log(`   📅 新的过期时间: ${new Date(newTokens.expiry_date).toLocaleString()}`)
        console.log(`   🔑 Access Token: ${newTokens.access_token.substring(0, 20)}...`)

        // 验证账户状态已更新
        const updatedAccount = await geminiAccountService.getAccount(account.id)
        console.log(`   📊 账户状态: ${updatedAccount.status}`)
      } catch (error) {
        console.log(`   ❌ Token 刷新失败: ${error.message}`)
        console.log('   🔍 错误详情:', error)
      }
    }

    console.log('\n✅ 测试完成！')
  } catch (error) {
    console.error('❌ 测试失败:', error)
  } finally {
    // 断开 Redis 连接
    await redis.disconnect()
    process.exit(0)
  }
}

// 运行测试
testGeminiTokenRefresh()
