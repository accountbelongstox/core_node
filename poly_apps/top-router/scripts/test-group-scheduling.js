/**
 * 分组调度功能测试脚本
 * 用于测试账户分组管理和调度逻辑的正确性
 */

require('dotenv').config()
const { v4: uuidv4 } = require('uuid')
const redis = require('../src/models/datastore')
const accountGroupService = require('../src/services/accountGroupService')
const claudeAccountService = require('../src/services/claudeAccountService')
const claudeConsoleAccountService = require('../src/services/claudeConsoleAccountService')
const apiKeyService = require('../src/services/apiKeyService')
const unifiedClaudeScheduler = require('../src/services/unifiedClaudeScheduler')

// 测试配置
const TEST_PREFIX = 'test_group_'
const CLEANUP_ON_FINISH = true // 测试完成后是否清理数据

// 测试数据存储
const testData = {
  groups: [],
  accounts: [],
  apiKeys: []
}

// 颜色输出
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
}

function log(message, type = 'info') {
  const color =
    {
      success: colors.green,
      error: colors.red,
      warning: colors.yellow,
      info: colors.blue
    }[type] || colors.reset

  console.log(`${color}${message}${colors.reset}`)
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// 清理测试数据
async function cleanup() {
  log('\n🧹 清理测试数据...', 'info')

  // 删除测试API Keys
  for (const apiKey of testData.apiKeys) {
    try {
      await apiKeyService.deleteApiKey(apiKey.id)
      log(`✅ 删除测试API Key: ${apiKey.name}`, 'success')
    } catch (error) {
      log(`❌ 删除API Key失败: ${error.message}`, 'error')
    }
  }

  // 删除测试账户
  for (const account of testData.accounts) {
    try {
      if (account.type === 'claude') {
        await claudeAccountService.deleteAccount(account.id)
      } else if (account.type === 'claude-console') {
        await claudeConsoleAccountService.deleteAccount(account.id)
      }
      log(`✅ 删除测试账户: ${account.name}`, 'success')
    } catch (error) {
      log(`❌ 删除账户失败: ${error.message}`, 'error')
    }
  }

  // 删除测试分组
  for (const group of testData.groups) {
    try {
      await accountGroupService.deleteGroup(group.id)
      log(`✅ 删除测试分组: ${group.name}`, 'success')
    } catch (error) {
      // 可能因为还有成员而删除失败，先移除所有成员
      if (error.message.includes('分组内还有账户')) {
        const members = await accountGroupService.getGroupMembers(group.id)
        for (const memberId of members) {
          await accountGroupService.removeAccountFromGroup(memberId, group.id)
        }
        // 重试删除
        await accountGroupService.deleteGroup(group.id)
        log(`✅ 删除测试分组: ${group.name} (清空成员后)`, 'success')
      } else {
        log(`❌ 删除分组失败: ${error.message}`, 'error')
      }
    }
  }
}

// 测试1: 创建分组
async function test1_createGroups() {
  log('\n📝 测试1: 创建账户分组', 'info')

  try {
    // 创建Claude分组
    const claudeGroup = await accountGroupService.createGroup({
      name: `${TEST_PREFIX}Claude组`,
      platform: 'claude',
      description: '测试用Claude账户分组'
    })
    testData.groups.push(claudeGroup)
    log(`✅ 创建Claude分组成功: ${claudeGroup.name} (ID: ${claudeGroup.id})`, 'success')

    // 创建Gemini分组
    const geminiGroup = await accountGroupService.createGroup({
      name: `${TEST_PREFIX}Gemini组`,
      platform: 'gemini',
      description: '测试用Gemini账户分组'
    })
    testData.groups.push(geminiGroup)
    log(`✅ 创建Gemini分组成功: ${geminiGroup.name} (ID: ${geminiGroup.id})`, 'success')

    // 验证分组信息
    const allGroups = await accountGroupService.getAllGroups()
    const testGroups = allGroups.filter((g) => g.name.startsWith(TEST_PREFIX))

    if (testGroups.length === 2) {
      log(`✅ 分组创建验证通过，共创建 ${testGroups.length} 个测试分组`, 'success')
    } else {
      throw new Error(`分组数量不正确，期望2个，实际${testGroups.length}个`)
    }
  } catch (error) {
    log(`❌ 测试1失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试2: 创建账户并添加到分组
async function test2_createAccountsAndAddToGroup() {
  log('\n📝 测试2: 创建账户并添加到分组', 'info')

  try {
    const claudeGroup = testData.groups.find((g) => g.platform === 'claude')

    // 创建Claude OAuth账户
    const claudeAccount1 = await claudeAccountService.createAccount({
      name: `${TEST_PREFIX}Claude账户1`,
      email: 'test1@example.com',
      refreshToken: 'test_refresh_token_1',
      accountType: 'group'
    })
    testData.accounts.push({ ...claudeAccount1, type: 'claude' })
    log(`✅ 创建Claude OAuth账户1成功: ${claudeAccount1.name}`, 'success')

    const claudeAccount2 = await claudeAccountService.createAccount({
      name: `${TEST_PREFIX}Claude账户2`,
      email: 'test2@example.com',
      refreshToken: 'test_refresh_token_2',
      accountType: 'group'
    })
    testData.accounts.push({ ...claudeAccount2, type: 'claude' })
    log(`✅ 创建Claude OAuth账户2成功: ${claudeAccount2.name}`, 'success')

    // 创建Claude Console账户
    const consoleAccount = await claudeConsoleAccountService.createAccount({
      name: `${TEST_PREFIX}Console账户`,
      apiUrl: 'https://api.example.com',
      apiKey: 'test_api_key',
      accountType: 'group'
    })
    testData.accounts.push({ ...consoleAccount, type: 'claude-console' })
    log(`✅ 创建Claude Console账户成功: ${consoleAccount.name}`, 'success')

    // 添加账户到分组
    await accountGroupService.addAccountToGroup(claudeAccount1.id, claudeGroup.id, 'claude')
    log('✅ 添加账户1到分组成功', 'success')

    await accountGroupService.addAccountToGroup(claudeAccount2.id, claudeGroup.id, 'claude')
    log('✅ 添加账户2到分组成功', 'success')

    await accountGroupService.addAccountToGroup(consoleAccount.id, claudeGroup.id, 'claude')
    log('✅ 添加Console账户到分组成功', 'success')

    // 验证分组成员
    const members = await accountGroupService.getGroupMembers(claudeGroup.id)
    if (members.length === 3) {
      log(`✅ 分组成员验证通过，共有 ${members.length} 个成员`, 'success')
    } else {
      throw new Error(`分组成员数量不正确，期望3个，实际${members.length}个`)
    }
  } catch (error) {
    log(`❌ 测试2失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试3: 平台一致性验证
async function test3_platformConsistency() {
  log('\n📝 测试3: 平台一致性验证', 'info')

  try {
    const geminiGroup = testData.groups.find((g) => g.platform === 'gemini')

    // 尝试将Claude账户添加到Gemini分组（应该失败）
    const claudeAccount = testData.accounts.find((a) => a.type === 'claude')

    try {
      await accountGroupService.addAccountToGroup(claudeAccount.id, geminiGroup.id, 'claude')
      throw new Error('平台验证失败：Claude账户不应该能添加到Gemini分组')
    } catch (error) {
      if (error.message.includes('平台与分组平台不匹配')) {
        log(`✅ 平台一致性验证通过：${error.message}`, 'success')
      } else {
        throw error
      }
    }
  } catch (error) {
    log(`❌ 测试3失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试4: API Key绑定分组
async function test4_apiKeyBindGroup() {
  log('\n📝 测试4: API Key绑定分组', 'info')

  try {
    const claudeGroup = testData.groups.find((g) => g.platform === 'claude')

    // 创建绑定到分组的API Key
    const apiKey = await apiKeyService.generateApiKey({
      name: `${TEST_PREFIX}API Key`,
      description: '测试分组调度的API Key',
      claudeAccountId: `group:${claudeGroup.id}`,
      permissions: 'claude'
    })
    testData.apiKeys.push(apiKey)
    log(`✅ 创建API Key成功: ${apiKey.name} (绑定到分组: ${claudeGroup.name})`, 'success')

    // 验证API Key信息
    const keyInfo = await redis.getApiKey(apiKey.id)
    if (keyInfo && keyInfo.claudeAccountId === `group:${claudeGroup.id}`) {
      log('✅ API Key分组绑定验证通过', 'success')
    } else {
      throw new Error('API Key分组绑定信息不正确')
    }
  } catch (error) {
    log(`❌ 测试4失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试5: 分组调度负载均衡
async function test5_groupSchedulingLoadBalance() {
  log('\n📝 测试5: 分组调度负载均衡', 'info')

  try {
    const apiKey = testData.apiKeys[0]

    // 记录每个账户被选中的次数
    const selectionCount = {}
    const totalSelections = 30

    for (let i = 0; i < totalSelections; i++) {
      // 模拟不同的会话
      const sessionHash = uuidv4()

      const result = await unifiedClaudeScheduler.selectAccountForApiKey(
        {
          id: apiKey.id,
          claudeAccountId: apiKey.claudeAccountId,
          name: apiKey.name
        },
        sessionHash
      )

      if (!selectionCount[result.accountId]) {
        selectionCount[result.accountId] = 0
      }
      selectionCount[result.accountId]++

      // 短暂延迟，模拟真实请求间隔
      await sleep(50)
    }

    // 分析选择分布
    log(`\n📊 负载均衡分布统计 (共${totalSelections}次选择):`, 'info')
    const accounts = Object.keys(selectionCount)

    for (const accountId of accounts) {
      const count = selectionCount[accountId]
      const percentage = ((count / totalSelections) * 100).toFixed(1)
      const accountInfo = testData.accounts.find((a) => a.id === accountId)
      log(`   ${accountInfo.name}: ${count}次 (${percentage}%)`, 'info')
    }

    // 验证是否实现了负载均衡
    const counts = Object.values(selectionCount)
    const avgCount = totalSelections / accounts.length
    const variance =
      counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length
    const stdDev = Math.sqrt(variance)

    log(`\n   平均选择次数: ${avgCount.toFixed(1)}`, 'info')
    log(`   标准差: ${stdDev.toFixed(1)}`, 'info')

    // 如果标准差小于平均值的50%，认为负载均衡效果良好
    if (stdDev < avgCount * 0.5) {
      log('✅ 负载均衡验证通过，分布相对均匀', 'success')
    } else {
      log('⚠️ 负载分布不够均匀，但这可能是正常的随机波动', 'warning')
    }
  } catch (error) {
    log(`❌ 测试5失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试6: 会话粘性测试
async function test6_stickySession() {
  log('\n📝 测试6: 会话粘性（Sticky Session）测试', 'info')

  try {
    const apiKey = testData.apiKeys[0]
    const sessionHash = `test_session_${uuidv4()}`

    // 第一次选择
    const firstSelection = await unifiedClaudeScheduler.selectAccountForApiKey(
      {
        id: apiKey.id,
        claudeAccountId: apiKey.claudeAccountId,
        name: apiKey.name
      },
      sessionHash
    )

    log(`   首次选择账户: ${firstSelection.accountId}`, 'info')

    // 使用相同的sessionHash多次请求
    let consistentCount = 0
    const testCount = 10

    for (let i = 0; i < testCount; i++) {
      const selection = await unifiedClaudeScheduler.selectAccountForApiKey(
        {
          id: apiKey.id,
          claudeAccountId: apiKey.claudeAccountId,
          name: apiKey.name
        },
        sessionHash
      )

      if (selection.accountId === firstSelection.accountId) {
        consistentCount++
      }

      await sleep(100)
    }

    log(`   会话一致性: ${consistentCount}/${testCount} 次选择了相同账户`, 'info')

    if (consistentCount === testCount) {
      log('✅ 会话粘性验证通过，同一会话始终选择相同账户', 'success')
    } else {
      throw new Error(`会话粘性失败，只有${consistentCount}/${testCount}次选择了相同账户`)
    }
  } catch (error) {
    log(`❌ 测试6失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试7: 账户可用性检查
async function test7_accountAvailability() {
  log('\n📝 测试7: 账户可用性检查', 'info')

  try {
    const apiKey = testData.apiKeys[0]
    const accounts = testData.accounts.filter(
      (a) => a.type === 'claude' || a.type === 'claude-console'
    )

    // 禁用第一个账户
    const firstAccount = accounts[0]
    if (firstAccount.type === 'claude') {
      await claudeAccountService.updateAccount(firstAccount.id, { isActive: false })
    } else {
      await claudeConsoleAccountService.updateAccount(firstAccount.id, { isActive: false })
    }
    log(`   已禁用账户: ${firstAccount.name}`, 'info')

    // 多次选择，验证不会选择到禁用的账户
    const selectionResults = []
    for (let i = 0; i < 20; i++) {
      const sessionHash = uuidv4() // 每次使用新会话
      const result = await unifiedClaudeScheduler.selectAccountForApiKey(
        {
          id: apiKey.id,
          claudeAccountId: apiKey.claudeAccountId,
          name: apiKey.name
        },
        sessionHash
      )

      selectionResults.push(result.accountId)
    }

    // 检查是否选择了禁用的账户
    const selectedDisabled = selectionResults.includes(firstAccount.id)

    if (!selectedDisabled) {
      log('✅ 账户可用性验证通过，未选择禁用的账户', 'success')
    } else {
      throw new Error('错误：选择了已禁用的账户')
    }

    // 重新启用账户
    if (firstAccount.type === 'claude') {
      await claudeAccountService.updateAccount(firstAccount.id, { isActive: true })
    } else {
      await claudeConsoleAccountService.updateAccount(firstAccount.id, { isActive: true })
    }
  } catch (error) {
    log(`❌ 测试7失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试8: 分组成员管理
async function test8_groupMemberManagement() {
  log('\n📝 测试8: 分组成员管理', 'info')

  try {
    const claudeGroup = testData.groups.find((g) => g.platform === 'claude')
    const account = testData.accounts.find((a) => a.type === 'claude')

    // 获取账户所属分组
    const accountGroups = await accountGroupService.getAccountGroup(account.id)
    const hasTargetGroup = accountGroups.some((group) => group.id === claudeGroup.id)
    if (hasTargetGroup) {
      log('✅ 账户分组查询验证通过', 'success')
    } else {
      throw new Error('账户分组查询结果不正确')
    }

    // 从分组移除账户
    await accountGroupService.removeAccountFromGroup(account.id, claudeGroup.id)
    log(`   从分组移除账户: ${account.name}`, 'info')

    // 验证账户已不在分组中
    const membersAfterRemove = await accountGroupService.getGroupMembers(claudeGroup.id)
    if (!membersAfterRemove.includes(account.id)) {
      log('✅ 账户移除验证通过', 'success')
    } else {
      throw new Error('账户移除失败')
    }

    // 重新添加账户
    await accountGroupService.addAccountToGroup(account.id, claudeGroup.id, 'claude')
    log('   重新添加账户到分组', 'info')
  } catch (error) {
    log(`❌ 测试8失败: ${error.message}`, 'error')
    throw error
  }
}

// 测试9: 空分组处理
async function test9_emptyGroupHandling() {
  log('\n📝 测试9: 空分组处理', 'info')

  try {
    // 创建一个空分组
    const emptyGroup = await accountGroupService.createGroup({
      name: `${TEST_PREFIX}空分组`,
      platform: 'claude',
      description: '测试空分组'
    })
    testData.groups.push(emptyGroup)

    // 创建绑定到空分组的API Key
    const apiKey = await apiKeyService.generateApiKey({
      name: `${TEST_PREFIX}空分组API Key`,
      claudeAccountId: `group:${emptyGroup.id}`,
      permissions: 'claude'
    })
    testData.apiKeys.push(apiKey)

    // 尝试从空分组选择账户（应该失败）
    try {
      await unifiedClaudeScheduler.selectAccountForApiKey({
        id: apiKey.id,
        claudeAccountId: apiKey.claudeAccountId,
        name: apiKey.name
      })
      throw new Error('空分组选择账户应该失败')
    } catch (error) {
      if (error.message.includes('has no members')) {
        log(`✅ 空分组处理验证通过：${error.message}`, 'success')
      } else {
        throw error
      }
    }
  } catch (error) {
    log(`❌ 测试9失败: ${error.message}`, 'error')
    throw error
  }
}

// 主测试函数
async function runTests() {
  log('\n🚀 开始分组调度功能测试\n', 'info')

  try {
    // 连接Redis
    await redis.connect()
    log('✅ Redis连接成功', 'success')

    // 执行测试
    await test1_createGroups()
    await test2_createAccountsAndAddToGroup()
    await test3_platformConsistency()
    await test4_apiKeyBindGroup()
    await test5_groupSchedulingLoadBalance()
    await test6_stickySession()
    await test7_accountAvailability()
    await test8_groupMemberManagement()
    await test9_emptyGroupHandling()

    log('\n🎉 所有测试通过！分组调度功能工作正常', 'success')
  } catch (error) {
    log(`\n❌ 测试失败: ${error.message}`, 'error')
    console.error(error)
  } finally {
    // 清理测试数据
    if (CLEANUP_ON_FINISH) {
      await cleanup()
    } else {
      log('\n⚠️ 测试数据未清理，请手动清理', 'warning')
    }

    // 关闭Redis连接
    await redis.disconnect()
    process.exit(0)
  }
}

// 运行测试
runTests()
