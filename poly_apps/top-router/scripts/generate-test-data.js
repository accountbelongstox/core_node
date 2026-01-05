#!/usr/bin/env node

/**
 * 历史数据生成脚本
 * 用于测试不同时间范围的Token统计功能
 *
 * 使用方法：
 * node scripts/generate-test-data.js [--clean]
 *
 * 选项：
 * --clean: 清除所有测试数据
 */

const redis = require('../src/models/datastore')
const logger = require('../src/utils/logger')

// 解析命令行参数
const args = process.argv.slice(2)
const shouldClean = args.includes('--clean')

// 模拟的模型列表
const models = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'claude-3-opus-20240229'
]

// 生成指定日期的数据
async function generateDataForDate(apiKeyId, date, dayOffset) {
  const client = redis.getClientSafe()
  const dateStr = date.toISOString().split('T')[0]
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

  // 根据日期偏移量调整数据量（越近的日期数据越多）
  const requestCount = Math.max(5, 20 - dayOffset * 2) // 5-20个请求

  logger.info(`📊 Generating ${requestCount} requests for ${dateStr}`)

  for (let i = 0; i < requestCount; i++) {
    // 随机选择模型
    const model = models[Math.floor(Math.random() * models.length)]

    // 生成随机Token数据
    const inputTokens = Math.floor(Math.random() * 2000) + 500 // 500-2500
    const outputTokens = Math.floor(Math.random() * 3000) + 1000 // 1000-4000
    const cacheCreateTokens = Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : 0 // 30%概率有缓存创建
    const cacheReadTokens = Math.random() > 0.5 ? Math.floor(Math.random() * 500) : 0 // 50%概率有缓存读取

    const coreTokens = inputTokens + outputTokens
    const allTokens = inputTokens + outputTokens + cacheCreateTokens + cacheReadTokens

    // 更新各种统计键
    const totalKey = `usage:${apiKeyId}`
    const dailyKey = `usage:daily:${apiKeyId}:${dateStr}`
    const monthlyKey = `usage:monthly:${apiKeyId}:${month}`
    const modelDailyKey = `usage:model:daily:${model}:${dateStr}`
    const modelMonthlyKey = `usage:model:monthly:${model}:${month}`
    const keyModelDailyKey = `usage:${apiKeyId}:model:daily:${model}:${dateStr}`
    const keyModelMonthlyKey = `usage:${apiKeyId}:model:monthly:${model}:${month}`

    await Promise.all([
      // 总计数据
      client.hincrby(totalKey, 'totalTokens', coreTokens),
      client.hincrby(totalKey, 'totalInputTokens', inputTokens),
      client.hincrby(totalKey, 'totalOutputTokens', outputTokens),
      client.hincrby(totalKey, 'totalCacheCreateTokens', cacheCreateTokens),
      client.hincrby(totalKey, 'totalCacheReadTokens', cacheReadTokens),
      client.hincrby(totalKey, 'totalAllTokens', allTokens),
      client.hincrby(totalKey, 'totalRequests', 1),

      // 每日统计
      client.hincrby(dailyKey, 'tokens', coreTokens),
      client.hincrby(dailyKey, 'inputTokens', inputTokens),
      client.hincrby(dailyKey, 'outputTokens', outputTokens),
      client.hincrby(dailyKey, 'cacheCreateTokens', cacheCreateTokens),
      client.hincrby(dailyKey, 'cacheReadTokens', cacheReadTokens),
      client.hincrby(dailyKey, 'allTokens', allTokens),
      client.hincrby(dailyKey, 'requests', 1),

      // 每月统计
      client.hincrby(monthlyKey, 'tokens', coreTokens),
      client.hincrby(monthlyKey, 'inputTokens', inputTokens),
      client.hincrby(monthlyKey, 'outputTokens', outputTokens),
      client.hincrby(monthlyKey, 'cacheCreateTokens', cacheCreateTokens),
      client.hincrby(monthlyKey, 'cacheReadTokens', cacheReadTokens),
      client.hincrby(monthlyKey, 'allTokens', allTokens),
      client.hincrby(monthlyKey, 'requests', 1),

      // 模型统计 - 每日
      client.hincrby(modelDailyKey, 'totalInputTokens', inputTokens),
      client.hincrby(modelDailyKey, 'totalOutputTokens', outputTokens),
      client.hincrby(modelDailyKey, 'totalCacheCreateTokens', cacheCreateTokens),
      client.hincrby(modelDailyKey, 'totalCacheReadTokens', cacheReadTokens),
      client.hincrby(modelDailyKey, 'totalAllTokens', allTokens),
      client.hincrby(modelDailyKey, 'requests', 1),

      // 模型统计 - 每月
      client.hincrby(modelMonthlyKey, 'totalInputTokens', inputTokens),
      client.hincrby(modelMonthlyKey, 'totalOutputTokens', outputTokens),
      client.hincrby(modelMonthlyKey, 'totalCacheCreateTokens', cacheCreateTokens),
      client.hincrby(modelMonthlyKey, 'totalCacheReadTokens', cacheReadTokens),
      client.hincrby(modelMonthlyKey, 'totalAllTokens', allTokens),
      client.hincrby(modelMonthlyKey, 'requests', 1),

      // API Key级别的模型统计 - 每日
      // 同时存储带total前缀和不带前缀的字段，保持兼容性
      client.hincrby(keyModelDailyKey, 'inputTokens', inputTokens),
      client.hincrby(keyModelDailyKey, 'outputTokens', outputTokens),
      client.hincrby(keyModelDailyKey, 'cacheCreateTokens', cacheCreateTokens),
      client.hincrby(keyModelDailyKey, 'cacheReadTokens', cacheReadTokens),
      client.hincrby(keyModelDailyKey, 'allTokens', allTokens),
      client.hincrby(keyModelDailyKey, 'totalInputTokens', inputTokens),
      client.hincrby(keyModelDailyKey, 'totalOutputTokens', outputTokens),
      client.hincrby(keyModelDailyKey, 'totalCacheCreateTokens', cacheCreateTokens),
      client.hincrby(keyModelDailyKey, 'totalCacheReadTokens', cacheReadTokens),
      client.hincrby(keyModelDailyKey, 'totalAllTokens', allTokens),
      client.hincrby(keyModelDailyKey, 'requests', 1),

      // API Key级别的模型统计 - 每月
      client.hincrby(keyModelMonthlyKey, 'inputTokens', inputTokens),
      client.hincrby(keyModelMonthlyKey, 'outputTokens', outputTokens),
      client.hincrby(keyModelMonthlyKey, 'cacheCreateTokens', cacheCreateTokens),
      client.hincrby(keyModelMonthlyKey, 'cacheReadTokens', cacheReadTokens),
      client.hincrby(keyModelMonthlyKey, 'allTokens', allTokens),
      client.hincrby(keyModelMonthlyKey, 'totalInputTokens', inputTokens),
      client.hincrby(keyModelMonthlyKey, 'totalOutputTokens', outputTokens),
      client.hincrby(keyModelMonthlyKey, 'totalCacheCreateTokens', cacheCreateTokens),
      client.hincrby(keyModelMonthlyKey, 'totalCacheReadTokens', cacheReadTokens),
      client.hincrby(keyModelMonthlyKey, 'totalAllTokens', allTokens),
      client.hincrby(keyModelMonthlyKey, 'requests', 1)
    ])
  }
}

// 清除测试数据
async function cleanTestData() {
  const client = redis.getClientSafe()
  const apiKeyService = require('../src/services/apiKeyService')

  logger.info('🧹 Cleaning test data...')

  // 获取所有API Keys
  const allKeys = await apiKeyService.getAllApiKeys()

  // 找出所有测试 API Keys
  const testKeys = allKeys.filter((key) => key.name && key.name.startsWith('Test API Key'))

  for (const testKey of testKeys) {
    const apiKeyId = testKey.id

    // 获取所有相关的键
    const patterns = [
      `usage:${apiKeyId}`,
      `usage:daily:${apiKeyId}:*`,
      `usage:monthly:${apiKeyId}:*`,
      `usage:${apiKeyId}:model:daily:*`,
      `usage:${apiKeyId}:model:monthly:*`
    ]

    for (const pattern of patterns) {
      const keys = await client.keys(pattern)
      if (keys.length > 0) {
        await client.del(...keys)
        logger.info(`🗑️ Deleted ${keys.length} keys matching pattern: ${pattern}`)
      }
    }

    // 删除 API Key 本身
    await apiKeyService.deleteApiKey(apiKeyId)
    logger.info(`🗑️ Deleted test API Key: ${testKey.name} (${apiKeyId})`)
  }

  // 清除模型统计
  const modelPatterns = ['usage:model:daily:*', 'usage:model:monthly:*']

  for (const pattern of modelPatterns) {
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(...keys)
      logger.info(`🗑️ Deleted ${keys.length} keys matching pattern: ${pattern}`)
    }
  }
}

// 主函数
async function main() {
  try {
    await redis.connect()
    logger.success('✅ Connected to Redis')

    // 创建测试API Keys
    const apiKeyService = require('../src/services/apiKeyService')
    const testApiKeys = []
    const createdKeys = []

    // 总是创建新的测试 API Keys
    logger.info('📝 Creating test API Keys...')

    for (let i = 1; i <= 3; i++) {
      const newKey = await apiKeyService.generateApiKey({
        name: `Test API Key ${i}`,
        description: `Test key for historical data generation ${i}`,
        tokenLimit: 10000000,
        concurrencyLimit: 10,
        rateLimitWindow: 60,
        rateLimitRequests: 100
      })

      testApiKeys.push(newKey.id)
      createdKeys.push(newKey)
      logger.success(`✅ Created test API Key: ${newKey.name} (${newKey.id})`)
      logger.info(`   🔑 API Key: ${newKey.apiKey}`)
    }

    if (shouldClean) {
      await cleanTestData()
      logger.success('✅ Test data cleaned successfully')
      return
    }

    // 生成历史数据
    const now = new Date()

    for (const apiKeyId of testApiKeys) {
      logger.info(`\n🔄 Generating data for API Key: ${apiKeyId}`)

      // 生成过去30天的数据
      for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
        const date = new Date(now)
        date.setDate(date.getDate() - dayOffset)

        await generateDataForDate(apiKeyId, date, dayOffset)
      }

      logger.success(`✅ Generated 30 days of historical data for API Key: ${apiKeyId}`)
    }

    // 显示统计摘要
    logger.info('\n📊 Test Data Summary:')
    logger.info('='.repeat(60))

    for (const apiKeyId of testApiKeys) {
      const totalKey = `usage:${apiKeyId}`
      const totalData = await redis.getClientSafe().hgetall(totalKey)

      if (totalData && Object.keys(totalData).length > 0) {
        logger.info(`\nAPI Key: ${apiKeyId}`)
        logger.info(`  Total Requests: ${totalData.totalRequests || 0}`)
        logger.info(`  Total Tokens (Core): ${totalData.totalTokens || 0}`)
        logger.info(`  Total Tokens (All): ${totalData.totalAllTokens || 0}`)
        logger.info(`  Input Tokens: ${totalData.totalInputTokens || 0}`)
        logger.info(`  Output Tokens: ${totalData.totalOutputTokens || 0}`)
        logger.info(`  Cache Create Tokens: ${totalData.totalCacheCreateTokens || 0}`)
        logger.info(`  Cache Read Tokens: ${totalData.totalCacheReadTokens || 0}`)
      }
    }

    logger.info(`\n${'='.repeat(60)}`)
    logger.success('\n✅ Test data generation completed!')
    logger.info('\n📋 Created API Keys:')
    for (const key of createdKeys) {
      logger.info(`- ${key.name}: ${key.apiKey}`)
    }
    logger.info('\n💡 Tips:')
    logger.info('- Check the admin panel to see the different time ranges')
    logger.info('- Use --clean flag to remove all test data and API Keys')
    logger.info('- The script generates more recent data to simulate real usage patterns')
  } catch (error) {
    logger.error('❌ Error:', error)
  } finally {
    await redis.disconnect()
  }
}

// 运行脚本
main().catch((error) => {
  logger.error('💥 Unexpected error:', error)
  process.exit(1)
})
