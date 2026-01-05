/**
 * 测试 API 响应中的账号数据
 */

const redis = require('../src/models/datastore')
const claudeAccountService = require('../src/services/claudeAccountService')
const claudeConsoleAccountService = require('../src/services/claudeConsoleAccountService')
const accountGroupService = require('../src/services/accountGroupService')

async function testApiResponse() {
  console.log('🔍 测试 API 响应数据...\n')

  try {
    // 确保 Redis 已连接
    await redis.connect()

    // 1. 测试 Claude OAuth 账号服务
    console.log('📋 测试 Claude OAuth 账号服务...')
    const claudeAccounts = await claudeAccountService.getAllAccounts()
    console.log(`找到 ${claudeAccounts.length} 个 Claude OAuth 账号`)

    // 检查前3个账号的数据结构
    console.log('\n账号数据结构示例:')
    claudeAccounts.slice(0, 3).forEach((acc) => {
      console.log(`\n账号: ${acc.name}`)
      console.log(`  - ID: ${acc.id}`)
      console.log(`  - accountType: ${acc.accountType}`)
      console.log(`  - platform: ${acc.platform}`)
      console.log(`  - status: ${acc.status}`)
      console.log(`  - isActive: ${acc.isActive}`)
    })

    // 统计专属账号
    const claudeDedicated = claudeAccounts.filter((a) => a.accountType === 'dedicated')
    const claudeGroup = claudeAccounts.filter((a) => a.accountType === 'group')

    console.log('\n统计结果:')
    console.log(`  - 专属账号: ${claudeDedicated.length} 个`)
    console.log(`  - 分组账号: ${claudeGroup.length} 个`)

    // 2. 测试 Claude Console 账号服务
    console.log('\n\n📋 测试 Claude Console 账号服务...')
    const consoleAccounts = await claudeConsoleAccountService.getAllAccounts()
    console.log(`找到 ${consoleAccounts.length} 个 Claude Console 账号`)

    // 检查前3个账号的数据结构
    console.log('\n账号数据结构示例:')
    consoleAccounts.slice(0, 3).forEach((acc) => {
      console.log(`\n账号: ${acc.name}`)
      console.log(`  - ID: ${acc.id}`)
      console.log(`  - accountType: ${acc.accountType}`)
      console.log(`  - platform: ${acc.platform}`)
      console.log(`  - status: ${acc.status}`)
      console.log(`  - isActive: ${acc.isActive}`)
    })

    // 统计专属账号
    const consoleDedicated = consoleAccounts.filter((a) => a.accountType === 'dedicated')
    const consoleGroup = consoleAccounts.filter((a) => a.accountType === 'group')

    console.log('\n统计结果:')
    console.log(`  - 专属账号: ${consoleDedicated.length} 个`)
    console.log(`  - 分组账号: ${consoleGroup.length} 个`)

    // 3. 测试账号分组服务
    console.log('\n\n📋 测试账号分组服务...')
    const groups = await accountGroupService.getAllGroups()
    console.log(`找到 ${groups.length} 个账号分组`)

    // 显示分组信息
    groups.forEach((group) => {
      console.log(`\n分组: ${group.name}`)
      console.log(`  - ID: ${group.id}`)
      console.log(`  - platform: ${group.platform}`)
      console.log(`  - memberCount: ${group.memberCount}`)
    })

    // 4. 验证结果
    console.log('\n\n📊 验证结果:')

    // 检查 platform 字段
    const claudeWithPlatform = claudeAccounts.filter((a) => a.platform === 'claude')
    const consoleWithPlatform = consoleAccounts.filter((a) => a.platform === 'claude-console')

    if (claudeWithPlatform.length === claudeAccounts.length) {
      console.log('✅ 所有 Claude OAuth 账号都有正确的 platform 字段')
    } else {
      console.log(
        `⚠️  只有 ${claudeWithPlatform.length}/${claudeAccounts.length} 个 Claude OAuth 账号有正确的 platform 字段`
      )
    }

    if (consoleWithPlatform.length === consoleAccounts.length) {
      console.log('✅ 所有 Claude Console 账号都有正确的 platform 字段')
    } else {
      console.log(
        `⚠️  只有 ${consoleWithPlatform.length}/${consoleAccounts.length} 个 Claude Console 账号有正确的 platform 字段`
      )
    }

    // 总结
    const totalDedicated = claudeDedicated.length + consoleDedicated.length
    const totalGroup = claudeGroup.length + consoleGroup.length
    const totalGroups = groups.filter((g) => g.platform === 'claude').length

    console.log('\n📈 总结:')
    console.log(
      `- 专属账号总数: ${totalDedicated} 个 (Claude OAuth: ${claudeDedicated.length}, Console: ${consoleDedicated.length})`
    )
    console.log(
      `- 分组账号总数: ${totalGroup} 个 (Claude OAuth: ${claudeGroup.length}, Console: ${consoleGroup.length})`
    )
    console.log(`- 账号分组总数: ${totalGroups} 个`)

    if (totalDedicated + totalGroups > 0) {
      console.log('\n✅ 前端下拉框应该能够显示:')
      if (totalGroups > 0) {
        console.log('   - 调度分组')
      }
      if (claudeDedicated.length > 0) {
        console.log('   - Claude OAuth 专属账号 (仅 dedicated 类型)')
      }
      if (consoleDedicated.length > 0) {
        console.log('   - Claude Console 专属账号 (仅 dedicated 类型)')
      }
    } else {
      console.log('\n⚠️  没有找到任何专属账号或分组，请检查账号配置')
    }

    console.log('\n💡 说明:')
    console.log('- 专属账号下拉框只显示 accountType="dedicated" 的账号')
    console.log('- accountType="group" 的账号通过分组调度，不在专属账号中显示')
  } catch (error) {
    console.error('❌ 测试失败:', error)
    console.error(error.stack)
  } finally {
    process.exit(0)
  }
}

testApiResponse()
