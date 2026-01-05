/**
 * 测试专属账号显示问题
 */

const redis = require('../src/models/datastore')

async function testDedicatedAccounts() {
  console.log('🔍 检查专属账号...\n')

  try {
    // 确保 Redis 已连接
    await redis.connect()

    // 获取所有 Claude 账号
    const claudeKeys = await redis.client.keys('claude:account:*')
    console.log(`找到 ${claudeKeys.length} 个 Claude 账号\n`)

    const dedicatedAccounts = []
    const groupAccounts = []
    const sharedAccounts = []

    for (const key of claudeKeys) {
      const account = await redis.client.hgetall(key)
      const accountType = account.accountType || 'shared'

      const accountInfo = {
        id: account.id,
        name: account.name,
        accountType,
        status: account.status,
        isActive: account.isActive,
        createdAt: account.createdAt
      }

      if (accountType === 'dedicated') {
        dedicatedAccounts.push(accountInfo)
      } else if (accountType === 'group') {
        groupAccounts.push(accountInfo)
      } else {
        sharedAccounts.push(accountInfo)
      }
    }

    console.log('📊 账号统计:')
    console.log(`- 专属账号: ${dedicatedAccounts.length} 个`)
    console.log(`- 分组账号: ${groupAccounts.length} 个`)
    console.log(`- 共享账号: ${sharedAccounts.length} 个`)
    console.log('')

    if (dedicatedAccounts.length > 0) {
      console.log('✅ 专属账号列表:')
      dedicatedAccounts.forEach((acc) => {
        console.log(`  - ${acc.name} (ID: ${acc.id}, 状态: ${acc.status})`)
      })
      console.log('')
    } else {
      console.log('⚠️  没有找到专属账号！')
      console.log('💡 提示: 请确保在账号管理页面将账号类型设置为"专属账户"')
      console.log('')
    }

    if (groupAccounts.length > 0) {
      console.log('📁 分组账号列表:')
      groupAccounts.forEach((acc) => {
        console.log(`  - ${acc.name} (ID: ${acc.id}, 状态: ${acc.status})`)
      })
      console.log('')
    }

    // 检查分组
    const groupKeys = await redis.client.keys('account_group:*')
    console.log(`\n找到 ${groupKeys.length} 个账号分组`)

    if (groupKeys.length > 0) {
      console.log('📋 分组列表:')
      for (const key of groupKeys) {
        const group = await redis.client.hgetall(key)
        console.log(
          `  - ${group.name} (平台: ${group.platform}, 成员数: ${group.memberCount || 0})`
        )
      }
    }

    // 检查 Claude Console 账号
    const consoleKeys = await redis.client.keys('claude_console_account:*')
    console.log(`\n找到 ${consoleKeys.length} 个 Claude Console 账号`)

    const dedicatedConsoleAccounts = []
    const groupConsoleAccounts = []

    for (const key of consoleKeys) {
      const account = await redis.client.hgetall(key)
      const accountType = account.accountType || 'shared'

      if (accountType === 'dedicated') {
        dedicatedConsoleAccounts.push({
          id: account.id,
          name: account.name,
          accountType,
          status: account.status
        })
      } else if (accountType === 'group') {
        groupConsoleAccounts.push({
          id: account.id,
          name: account.name,
          accountType,
          status: account.status
        })
      }
    }

    if (dedicatedConsoleAccounts.length > 0) {
      console.log('\n✅ Claude Console 专属账号:')
      dedicatedConsoleAccounts.forEach((acc) => {
        console.log(`  - ${acc.name} (ID: ${acc.id}, 状态: ${acc.status})`)
      })
    }

    if (groupConsoleAccounts.length > 0) {
      console.log('\n📁 Claude Console 分组账号:')
      groupConsoleAccounts.forEach((acc) => {
        console.log(`  - ${acc.name} (ID: ${acc.id}, 状态: ${acc.status})`)
      })
    }
  } catch (error) {
    console.error('❌ 错误:', error)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

testDedicatedAccounts()
