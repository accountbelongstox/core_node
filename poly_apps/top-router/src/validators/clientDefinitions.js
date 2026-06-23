/**
 * 客户端定义配置
 * 定义所有支持的客户端类型和它们的属性
 */

const CLIENT_DEFINITIONS = {
  CLAUDE_CODE: {
    id: 'claude_code',
    name: 'Claude Code',
    displayName: 'Claude Code CLI',
    description: 'Claude Code command-line interface',
    icon: '🤖'
  },

  GEMINI_CLI: {
    id: 'gemini_cli',
    name: 'Gemini CLI',
    displayName: 'Gemini Command Line Tool',
    description: 'Google Gemini API command-line interface',
    icon: '💎'
  },

  CODEX_CLI: {
    id: 'codex_cli',
    name: 'Codex CLI',
    displayName: 'Codex Command Line Tool',
    description: 'Cursor/Codex command-line interface',
    icon: '🔷'
  },

  DROID_CLI: {
    id: 'droid_cli',
    name: 'Droid CLI',
    displayName: 'Factory Droid CLI',
    description: 'Factory Droid platform command-line interface',
    icon: '🤖'
  }
}

// 导出客户端ID枚举
const CLIENT_IDS = {
  CLAUDE_CODE: 'claude_code',
  GEMINI_CLI: 'gemini_cli',
  CODEX_CLI: 'codex_cli',
  DROID_CLI: 'droid_cli'
}

// 获取所有客户端定义
function getAllClientDefinitions() {
  return Object.values(CLIENT_DEFINITIONS)
}

// 根据ID获取客户端定义
function getClientDefinitionById(clientId) {
  return Object.values(CLIENT_DEFINITIONS).find((client) => client.id === clientId)
}

// 检查客户端ID是否有效
function isValidClientId(clientId) {
  return Object.values(CLIENT_IDS).includes(clientId)
}

module.exports = {
  CLIENT_DEFINITIONS,
  CLIENT_IDS,
  getAllClientDefinitions,
  getClientDefinitionById,
  isValidClientId
}
