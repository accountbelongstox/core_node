#!/usr/bin/env node

/**
 * 会话窗口管理脚本
 * 用于调试、恢复和管理Claude账户的会话窗口
 */

const redis = require('../src/models/datastore')
const claudeAccountService = require('../src/services/claudeAccountService')
const readline = require('readline')

// 创建readline接口
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

// 辅助函数：询问用户输入
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve)
  })
}

// 辅助函数：解析时间输入
function parseTimeInput(input) {
  const now = new Date()

  // 如果是 HH:MM 格式
  const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/)
  if (timeMatch) {
    const hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2])

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const time = new Date(now)
      time.setHours(hour, minute, 0, 0)
      return time
    }
  }

  // 如果是相对时间（如 "2小时前"）
  const relativeMatch = input.match(/^(\d+)(小时|分钟)前$/)
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1])
    const unit = relativeMatch[2]
    const time = new Date(now)

    if (unit === '小时') {
      time.setHours(time.getHours() - amount)
    } else if (unit === '分钟') {
      time.setMinutes(time.getMinutes() - amount)
    }

    return time
  }

  // 如果是 ISO 格式或其他日期格式
  const parsedDate = new Date(input)
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate
  }

  return null
}

// 辅助函数：显示可用的时间窗口选项
function showTimeWindowOptions() {
  const now = new Date()
  console.log('\n⏰ 可用的5小时时间窗口:')

  for (let hour = 0; hour < 24; hour += 5) {
    const start = hour
    const end = hour + 5
    const startStr = `${String(start).padStart(2, '0')}:00`
    const endStr = `${String(end).padStart(2, '0')}:00`

    const currentHour = now.getHours()
    const isActive = currentHour >= start && currentHour < end
    const status = isActive ? ' 🟢 (当前活跃)' : ''

    console.log(`   ${start / 5 + 1}. ${startStr} - ${endStr}${status}`)
  }
  console.log('')
}

const commands = {
  // 调试所有账户的会话窗口状态
  async debug() {
    console.log('🔍 开始调试会话窗口状态...\n')

    const accounts = await redis.getAllClaudeAccounts()
    console.log(`📊 找到 ${accounts.length} 个Claude账户\n`)

    const stats = {
      total: accounts.length,
      hasWindow: 0,
      hasLastUsed: 0,
      canRecover: 0,
      expired: 0
    }

    for (const account of accounts) {
      console.log(`🏢 ${account.name} (${account.id})`)
      console.log(`   状态: ${account.isActive === 'true' ? '✅ 活跃' : '❌ 禁用'}`)

      if (account.sessionWindowStart && account.sessionWindowEnd) {
        stats.hasWindow++
        const windowStart = new Date(account.sessionWindowStart)
        const windowEnd = new Date(account.sessionWindowEnd)
        const now = new Date()
        const isActive = now < windowEnd

        console.log(`   会话窗口: ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`)
        console.log(`   窗口状态: ${isActive ? '✅ 活跃' : '❌ 已过期'}`)

        // 只有在窗口已过期时才显示可恢复窗口
        if (!isActive && account.lastUsedAt) {
          const lastUsed = new Date(account.lastUsedAt)
          const recoveredWindowStart = claudeAccountService._calculateSessionWindowStart(lastUsed)
          const recoveredWindowEnd =
            claudeAccountService._calculateSessionWindowEnd(recoveredWindowStart)

          if (now < recoveredWindowEnd) {
            stats.canRecover++
            console.log(
              `   可恢复窗口: ✅ ${recoveredWindowStart.toLocaleString()} - ${recoveredWindowEnd.toLocaleString()}`
            )
          } else {
            stats.expired++
            console.log(
              `   可恢复窗口: ❌ 已过期 (${recoveredWindowStart.toLocaleString()} - ${recoveredWindowEnd.toLocaleString()})`
            )
          }
        }
      } else {
        console.log('   会话窗口: ❌ 无')

        // 没有会话窗口时，检查是否有可恢复的窗口
        if (account.lastUsedAt) {
          const lastUsed = new Date(account.lastUsedAt)
          const now = new Date()
          const windowStart = claudeAccountService._calculateSessionWindowStart(lastUsed)
          const windowEnd = claudeAccountService._calculateSessionWindowEnd(windowStart)

          if (now < windowEnd) {
            stats.canRecover++
            console.log(
              `   可恢复窗口: ✅ ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`
            )
          } else {
            stats.expired++
            console.log(
              `   可恢复窗口: ❌ 已过期 (${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()})`
            )
          }
        }
      }

      if (account.lastUsedAt) {
        stats.hasLastUsed++
        const lastUsed = new Date(account.lastUsedAt)
        const now = new Date()
        const minutesAgo = Math.round((now - lastUsed) / (1000 * 60))

        console.log(`   最后使用: ${lastUsed.toLocaleString()} (${minutesAgo}分钟前)`)
      } else {
        console.log('   最后使用: ❌ 无记录')
      }

      console.log('')
    }

    console.log('📈 汇总统计:')
    console.log(`   总账户数: ${stats.total}`)
    console.log(`   有会话窗口: ${stats.hasWindow}`)
    console.log(`   有使用记录: ${stats.hasLastUsed}`)
    console.log(`   可以恢复: ${stats.canRecover}`)
    console.log(`   窗口已过期: ${stats.expired}`)
  },

  // 初始化会话窗口（默认行为）
  async init() {
    console.log('🔄 初始化会话窗口...\n')
    const result = await claudeAccountService.initializeSessionWindows()

    console.log('\n📊 初始化结果:')
    console.log(`   总账户数: ${result.total}`)
    console.log(`   成功初始化: ${result.initialized}`)
    console.log(`   已跳过（已有窗口）: ${result.skipped}`)
    console.log(`   窗口已过期: ${result.expired}`)
    console.log(`   无使用数据: ${result.noData}`)

    if (result.error) {
      console.log(`   错误: ${result.error}`)
    }
  },

  // 强制重新计算所有会话窗口
  async force() {
    console.log('🔄 强制重新计算所有会话窗口...\n')
    const result = await claudeAccountService.initializeSessionWindows(true)

    console.log('\n📊 强制重算结果:')
    console.log(`   总账户数: ${result.total}`)
    console.log(`   成功初始化: ${result.initialized}`)
    console.log(`   窗口已过期: ${result.expired}`)
    console.log(`   无使用数据: ${result.noData}`)

    if (result.error) {
      console.log(`   错误: ${result.error}`)
    }
  },

  // 清除所有会话窗口
  async clear() {
    console.log('🗑️ 清除所有会话窗口...\n')

    const accounts = await redis.getAllClaudeAccounts()
    let clearedCount = 0

    for (const account of accounts) {
      if (account.sessionWindowStart || account.sessionWindowEnd) {
        delete account.sessionWindowStart
        delete account.sessionWindowEnd
        delete account.lastRequestTime

        await redis.setClaudeAccount(account.id, account)
        clearedCount++

        console.log(`✅ 清除账户 ${account.name} (${account.id}) 的会话窗口`)
      }
    }

    console.log(`\n📊 清除完成: 共清除 ${clearedCount} 个账户的会话窗口`)
  },

  // 创建测试会话窗口（将lastUsedAt设置为当前时间）
  async test() {
    console.log('🧪 创建测试会话窗口...\n')

    const accounts = await redis.getAllClaudeAccounts()
    if (accounts.length === 0) {
      console.log('❌ 没有找到Claude账户')
      return
    }

    const now = new Date()
    let updatedCount = 0

    for (const account of accounts) {
      if (account.isActive === 'true') {
        // 设置为当前时间（模拟刚刚使用）
        account.lastUsedAt = now.toISOString()

        // 计算新的会话窗口
        const windowStart = claudeAccountService._calculateSessionWindowStart(now)
        const windowEnd = claudeAccountService._calculateSessionWindowEnd(windowStart)

        account.sessionWindowStart = windowStart.toISOString()
        account.sessionWindowEnd = windowEnd.toISOString()
        account.lastRequestTime = now.toISOString()

        await redis.setClaudeAccount(account.id, account)
        updatedCount++

        console.log(`✅ 为账户 ${account.name} 创建测试会话窗口:`)
        console.log(`   窗口时间: ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`)
        console.log(`   最后使用: ${now.toLocaleString()}\n`)
      }
    }

    console.log(`📊 测试完成: 为 ${updatedCount} 个活跃账户创建了测试会话窗口`)
  },

  // 手动设置账户的会话窗口
  async set() {
    console.log('🔧 手动设置会话窗口...\n')

    // 获取所有账户
    const accounts = await redis.getAllClaudeAccounts()
    if (accounts.length === 0) {
      console.log('❌ 没有找到Claude账户')
      return
    }

    // 显示账户列表
    console.log('📋 可用的Claude账户:')
    accounts.forEach((account, index) => {
      const status = account.isActive === 'true' ? '✅' : '❌'
      const hasWindow = account.sessionWindowStart ? '🕐' : '➖'
      console.log(`   ${index + 1}. ${status} ${hasWindow} ${account.name} (${account.id})`)
    })

    // 让用户选择账户
    const accountIndex = await askQuestion('\n请选择账户 (输入编号): ')
    const selectedIndex = parseInt(accountIndex) - 1

    if (selectedIndex < 0 || selectedIndex >= accounts.length) {
      console.log('❌ 无效的账户编号')
      return
    }

    const selectedAccount = accounts[selectedIndex]
    console.log(`\n🎯 已选择账户: ${selectedAccount.name}`)

    // 显示当前会话窗口状态
    if (selectedAccount.sessionWindowStart && selectedAccount.sessionWindowEnd) {
      const windowStart = new Date(selectedAccount.sessionWindowStart)
      const windowEnd = new Date(selectedAccount.sessionWindowEnd)
      const now = new Date()
      const isActive = now >= windowStart && now < windowEnd

      console.log('📊 当前会话窗口:')
      console.log(`   时间: ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`)
      console.log(`   状态: ${isActive ? '✅ 活跃' : '❌ 已过期'}`)
    } else {
      console.log('📊 当前会话窗口: ❌ 无')
    }

    // 显示设置选项
    console.log('\n🛠️ 设置选项:')
    console.log('   1. 使用预设时间窗口')
    console.log('   2. 自定义最后使用时间')
    console.log('   3. 直接设置窗口时间')
    console.log('   4. 清除会话窗口')

    const option = await askQuestion('\n请选择设置方式 (1-4): ')

    switch (option) {
      case '1':
        await setPresetWindow(selectedAccount)
        break
      case '2':
        await setCustomLastUsed(selectedAccount)
        break
      case '3':
        await setDirectWindow(selectedAccount)
        break
      case '4':
        await clearAccountWindow(selectedAccount)
        break
      default:
        console.log('❌ 无效的选项')
        return
    }
  },

  // 显示帮助信息
  help() {
    console.log('🔧 会话窗口管理脚本\n')
    console.log('用法: node scripts/manage-session-windows.js <command>\n')
    console.log('命令:')
    console.log('  debug  - 调试所有账户的会话窗口状态')
    console.log('  init   - 初始化会话窗口（跳过已有窗口的账户）')
    console.log('  force  - 强制重新计算所有会话窗口')
    console.log('  test   - 创建测试会话窗口（设置当前时间为使用时间）')
    console.log('  set    - 手动设置特定账户的会话窗口 🆕')
    console.log('  clear  - 清除所有会话窗口')
    console.log('  help   - 显示此帮助信息\n')
    console.log('示例:')
    console.log('  node scripts/manage-session-windows.js debug')
    console.log('  node scripts/manage-session-windows.js set')
    console.log('  node scripts/manage-session-windows.js test')
    console.log('  node scripts/manage-session-windows.js force')
  }
}

// 设置函数实现

// 使用预设时间窗口
async function setPresetWindow(account) {
  showTimeWindowOptions()

  const windowChoice = await askQuestion('请选择时间窗口 (1-5): ')
  const windowIndex = parseInt(windowChoice) - 1

  if (windowIndex < 0 || windowIndex >= 5) {
    console.log('❌ 无效的窗口选择')
    return
  }

  const now = new Date()
  const startHour = windowIndex * 5

  // 创建窗口开始时间
  const windowStart = new Date(now)
  windowStart.setHours(startHour, 0, 0, 0)

  // 创建窗口结束时间
  const windowEnd = new Date(windowStart)
  windowEnd.setHours(windowEnd.getHours() + 5)

  // 如果选择的窗口已经过期，则设置为明天的同一时间段
  if (windowEnd <= now) {
    windowStart.setDate(windowStart.getDate() + 1)
    windowEnd.setDate(windowEnd.getDate() + 1)
  }

  // 询问是否要设置为当前时间作为最后使用时间
  const setLastUsed = await askQuestion('是否设置当前时间为最后使用时间? (y/N): ')

  // 更新账户数据
  account.sessionWindowStart = windowStart.toISOString()
  account.sessionWindowEnd = windowEnd.toISOString()
  account.lastRequestTime = now.toISOString()

  if (setLastUsed.toLowerCase() === 'y' || setLastUsed.toLowerCase() === 'yes') {
    account.lastUsedAt = now.toISOString()
  }

  await redis.setClaudeAccount(account.id, account)

  console.log('\n✅ 已设置会话窗口:')
  console.log(`   账户: ${account.name}`)
  console.log(`   窗口: ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`)
  console.log(`   状态: ${now >= windowStart && now < windowEnd ? '✅ 活跃' : '⏰ 未来窗口'}`)
}

// 自定义最后使用时间
async function setCustomLastUsed(account) {
  console.log('\n📝 设置最后使用时间:')
  console.log('支持的时间格式:')
  console.log('   - HH:MM (如: 14:30)')
  console.log('   - 相对时间 (如: 2小时前, 30分钟前)')
  console.log('   - ISO格式 (如: 2025-07-28T14:30:00)')

  const timeInput = await askQuestion('\n请输入最后使用时间: ')
  const lastUsedTime = parseTimeInput(timeInput)

  if (!lastUsedTime) {
    console.log('❌ 无效的时间格式')
    return
  }

  // 基于最后使用时间计算会话窗口
  const windowStart = claudeAccountService._calculateSessionWindowStart(lastUsedTime)
  const windowEnd = claudeAccountService._calculateSessionWindowEnd(windowStart)

  // 更新账户数据
  account.lastUsedAt = lastUsedTime.toISOString()
  account.sessionWindowStart = windowStart.toISOString()
  account.sessionWindowEnd = windowEnd.toISOString()
  account.lastRequestTime = lastUsedTime.toISOString()

  await redis.setClaudeAccount(account.id, account)

  console.log('\n✅ 已设置会话窗口:')
  console.log(`   账户: ${account.name}`)
  console.log(`   最后使用: ${lastUsedTime.toLocaleString()}`)
  console.log(`   窗口: ${windowStart.toLocaleString()} - ${windowEnd.toLocaleString()}`)

  const now = new Date()
  console.log(`   状态: ${now >= windowStart && now < windowEnd ? '✅ 活跃' : '❌ 已过期'}`)
}

// 直接设置窗口时间
async function setDirectWindow(account) {
  console.log('\n⏰ 直接设置窗口时间:')

  const startInput = await askQuestion('请输入窗口开始时间 (HH:MM): ')
  const startTime = parseTimeInput(startInput)

  if (!startTime) {
    console.log('❌ 无效的开始时间格式')
    return
  }

  // 自动计算结束时间（开始时间+5小时）
  const endTime = new Date(startTime)
  endTime.setHours(endTime.getHours() + 5)

  // 如果跨天，询问是否确认
  if (endTime.getDate() !== startTime.getDate()) {
    const confirm = await askQuestion(`窗口将跨天到次日 ${endTime.getHours()}:00，确认吗? (y/N): `)
    if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
      console.log('❌ 已取消设置')
      return
    }
  }

  const now = new Date()

  // 更新账户数据
  account.sessionWindowStart = startTime.toISOString()
  account.sessionWindowEnd = endTime.toISOString()
  account.lastRequestTime = now.toISOString()

  // 询问是否更新最后使用时间
  const updateLastUsed = await askQuestion('是否将最后使用时间设置为窗口开始时间? (y/N): ')
  if (updateLastUsed.toLowerCase() === 'y' || updateLastUsed.toLowerCase() === 'yes') {
    account.lastUsedAt = startTime.toISOString()
  }

  await redis.setClaudeAccount(account.id, account)

  console.log('\n✅ 已设置会话窗口:')
  console.log(`   账户: ${account.name}`)
  console.log(`   窗口: ${startTime.toLocaleString()} - ${endTime.toLocaleString()}`)
  console.log(
    `   状态: ${now >= startTime && now < endTime ? '✅ 活跃' : now < startTime ? '⏰ 未来窗口' : '❌ 已过期'}`
  )
}

// 清除账户会话窗口
async function clearAccountWindow(account) {
  const confirm = await askQuestion(`确认清除账户 "${account.name}" 的会话窗口吗? (y/N): `)

  if (confirm.toLowerCase() !== 'y' && confirm.toLowerCase() !== 'yes') {
    console.log('❌ 已取消操作')
    return
  }

  // 清除会话窗口相关数据
  delete account.sessionWindowStart
  delete account.sessionWindowEnd
  delete account.lastRequestTime

  await redis.setClaudeAccount(account.id, account)

  console.log(`\n✅ 已清除账户 "${account.name}" 的会话窗口`)
}

async function main() {
  const command = process.argv[2] || 'help'

  if (!commands[command]) {
    console.error(`❌ 未知命令: ${command}`)
    commands.help()
    process.exit(1)
  }

  if (command === 'help') {
    commands.help()
    return
  }

  try {
    // 连接Redis
    await redis.connect()

    // 执行命令
    await commands[command]()
  } catch (error) {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  } finally {
    await redis.disconnect()
    rl.close()
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().then(() => {
    console.log('\n🎉 操作完成')
    process.exit(0)
  })
}

module.exports = { commands }
