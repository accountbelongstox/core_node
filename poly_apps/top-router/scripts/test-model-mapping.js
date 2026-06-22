#!/usr/bin/env node

const bedrockRelayService = require('../src/services/bedrockRelayService')

function testModelMapping() {
  console.log('🧪 测试模型映射功能...')

  // 测试用例
  const testCases = [
    // 标准Claude模型名
    'claude-3-5-haiku-20241022',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'claude-sonnet-4',
    'claude-opus-4-1',
    'claude-3-7-sonnet',

    // 已经是Bedrock格式的
    'us.anthropic.claude-sonnet-4-20250514-v1:0',
    'anthropic.claude-3-5-haiku-20241022-v1:0',

    // 未知模型
    'unknown-model'
  ]

  console.log('\n📋 模型映射测试结果:')
  testCases.forEach((testModel) => {
    const mappedModel = bedrockRelayService._mapToBedrockModel(testModel)
    const isChanged = mappedModel !== testModel
    const status = isChanged ? '🔄' : '✅'

    console.log(`${status} ${testModel}`)
    if (isChanged) {
      console.log(`   → ${mappedModel}`)
    }
  })

  console.log('\n✅ 模型映射测试完成')
}

// 如果直接运行此脚本
if (require.main === module) {
  testModelMapping()
}

module.exports = { testModelMapping }
