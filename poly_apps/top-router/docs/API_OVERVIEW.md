# Claude Relay Service - API 功能总览与项目说明

> 本文档提供 Claude Relay Service (CRS) 项目的完整 API 功能总览，适用于前端开发对接

---

## 📋 项目概述

**Claude Relay Service (CRS)** 是一个**多平台 AI API 中转服务**，作为客户端（如 Claude Code、Gemini CLI、Codex、Cherry Studio 等）与各大 AI API 之间的中间件。

### 🎯 核心作用

1. **多账户统一管理和智能调度** - 支持多个 AI 平台账户自动轮换和负载均衡
2. **API Key 认证系统** - 为不同用户分配独立的 API Key，统一管理和限流
3. **多平台支持** - Claude (官方/Console)、Gemini、OpenAI Responses (Codex)、AWS Bedrock、Azure OpenAI、Droid (Factory.ai)、CCR
4. **OAuth 代理授权** - 简化 AI 账户添加流程，支持代理配置
5. **使用统计和成本计算** - 详细的 token 使用记录和费用统计
6. **速率限制和并发控制** - 防止滥用，支持并发请求排队
7. **用户管理系统** - 支持用户注册、登录、API Key 分配（可选）

### 🏗️ 项目定位

- **中转代理层**: 在客户端和 AI API 之间提供统一的接口
- **多账户管理**: 支持多个 AI 平台账户的自动轮换和故障转移
- **成本控制**: 详细的使用统计和成本追踪
- **权限管理**: 细粒度的 API Key 权限控制和客户端限制
- **企业级功能**: LDAP 认证、Webhook 通知、用户管理

---

## 🔌 API 功能分类

### **1. 核心转发 API（供客户端调用）**

这些 API 是客户端（如 Claude Code、Gemini CLI 等）实际调用的接口。

#### **Claude 服务路由**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/v1/messages` | POST | Claude 消息处理（支持流式响应） |
| `/claude/v1/messages` | POST | Claude 消息处理（别名路由） |
| `/v1/messages/count_tokens` | POST | Token 计数 Beta API |
| `/api/v1/models` | GET | 获取可用模型列表 |
| `/api/v1/usage` | GET | 查询使用统计 |
| `/api/v1/key-info` | GET | 获取 API Key 信息 |
| `/v1/me` | GET | 获取用户信息（Claude Code 客户端需要） |
| `/v1/organizations/:org_id/usage` | GET | 组织使用统计 |

#### **Gemini 服务路由**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/gemini/v1/models/:model:generateContent` | POST | 标准 Gemini API 格式 |
| `/gemini/v1/models/:model:streamGenerateContent` | POST | Gemini 流式响应 |
| `/gemini/v1/models` | GET | Gemini 模型列表 |

#### **OpenAI 兼容路由**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/openai/v1/chat/completions` | POST | OpenAI 格式转发（支持 Codex Responses 格式） |
| `/openai/claude/v1/chat/completions` | POST | OpenAI 格式转 Claude |
| `/openai/gemini/v1/chat/completions` | POST | OpenAI 格式转 Gemini |
| `/openai/v1/models` | GET | OpenAI 格式模型列表 |

#### **Droid (Factory.ai) 路由**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/droid/claude/v1/messages` | POST | Droid Claude 转发 |
| `/droid/openai/v1/chat/completions` | POST | Droid OpenAI 转发 |
| `/droid/comm/v1/chat/completions` | POST | Droid 通用转发 |

#### **Azure OpenAI 路由**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/azure/...` | POST | Azure OpenAI API 转发 |

---

### **2. 管理端 API（Web 界面使用）**

#### **2.1 仪表板和统计**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/dashboard` | GET | 系统概览数据（账户数、API Key数、使用统计） |
| `/admin/usage-stats/overview` | GET | 使用统计概览 |
| `/admin/usage-stats/models` | GET | 按模型统计 |
| `/admin/usage-stats/keys` | GET | 按 API Key 统计 |
| `/admin/usage-stats/accounts` | GET | 按账户统计 |
| `/admin/usage-stats/daily` | GET | 按日期统计 |
| `/metrics` | GET | 系统指标（uptime、内存、使用量） |

#### **2.2 API Key 管理**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/api-keys` | GET | 获取所有 API Keys |
| `/admin/api-keys` | POST | 创建新 API Key |
| `/admin/api-keys/:id` | PUT | 更新 API Key（限制、权限等） |
| `/admin/api-keys/:id` | DELETE | 删除 API Key |
| `/admin/api-keys/:id/usage` | GET | 查看 API Key 使用详情 |
| `/admin/api-keys/:id/reset-usage` | POST | 重置 API Key 使用统计 |

**API Key 配置选项：**
- 名称和描述
- 速率限制（每分钟/小时/天的请求数和 token 数）
- 并发限制
- 权限控制（all/claude/gemini/openai 等）
- 客户端限制（基于 User-Agent）
- 模型黑名单
- 过期时间

#### **2.3 多平台账户管理**

##### **Claude 账户（官方/Console）**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/claude-accounts` | GET | 获取所有 Claude 账户 |
| `/admin/claude-accounts/generate-auth-url` | POST | 生成 OAuth 授权 URL（含代理配置） |
| `/admin/claude-accounts/exchange-code` | POST | 交换 authorization code 获取 token |
| `/admin/claude-accounts` | POST | 创建 Claude 账户 |
| `/admin/claude-accounts/:id` | PUT | 更新 Claude 账户（代理、状态等） |
| `/admin/claude-accounts/:id` | DELETE | 删除 Claude 账户 |
| `/admin/claude-accounts/:id/refresh-token` | POST | 手动刷新 OAuth Token |

**OAuth 授权流程：**
1. 调用 `generate-auth-url` 获取授权链接
2. 用户在浏览器中打开链接并登录 Claude
3. 授权后获得 authorization code
4. 调用 `exchange-code` 交换 token 并创建账户

##### **Gemini 账户**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/gemini-accounts` | GET | 获取所有 Gemini 账户 |
| `/admin/gemini-accounts/generate-auth-url` | POST | 生成 Google OAuth URL |
| `/admin/gemini-accounts/exchange-code` | POST | 交换 Google authorization code |
| `/admin/gemini-accounts` | POST | 创建 Gemini 账户 |
| `/admin/gemini-accounts/:id` | PUT | 更新 Gemini 账户 |
| `/admin/gemini-accounts/:id` | DELETE | 删除 Gemini 账户 |

##### **OpenAI Responses (Codex) 账户**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/openai-responses-accounts` | GET | 获取所有 OpenAI Responses 账户 |
| `/admin/openai-responses-accounts` | POST | 创建账户（需要 API Key） |
| `/admin/openai-responses-accounts/:id` | PUT | 更新账户 |
| `/admin/openai-responses-accounts/:id` | DELETE | 删除账户 |

##### **AWS Bedrock 账户**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/bedrock-accounts` | GET | 获取所有 Bedrock 账户 |
| `/admin/bedrock-accounts` | POST | 创建账户（AWS 凭据） |
| `/admin/bedrock-accounts/:id` | PUT | 更新账户 |
| `/admin/bedrock-accounts/:id` | DELETE | 删除账户 |

**所需配置：**
- AWS Access Key ID
- AWS Secret Access Key
- AWS Region

##### **Azure OpenAI 账户**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/azure-openai-accounts` | GET | 获取所有 Azure OpenAI 账户 |
| `/admin/azure-openai-accounts` | POST | 创建账户 |
| `/admin/azure-openai-accounts/:id` | PUT | 更新账户 |
| `/admin/azure-openai-accounts/:id` | DELETE | 删除账户 |

**所需配置：**
- Azure API Key
- Azure Endpoint
- Deployment Name

##### **Droid (Factory.ai) 账户**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/droid-accounts` | GET | 获取所有 Droid 账户 |
| `/admin/droid-accounts` | POST | 创建账户（Droid API Key） |
| `/admin/droid-accounts/:id` | PUT | 更新账户 |
| `/admin/droid-accounts/:id` | DELETE | 删除账户 |

##### **CCR 账户**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/ccr-accounts` | GET | 获取所有 CCR 账户 |
| `/admin/ccr-accounts` | POST | 创建账户（CCR 凭据） |
| `/admin/ccr-accounts/:id` | PUT | 更新账户 |
| `/admin/ccr-accounts/:id` | DELETE | 删除账户 |

#### **2.4 账户组管理**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/account-groups` | GET | 获取所有账户组 |
| `/admin/account-groups` | POST | 创建账户组（用于分组管理） |
| `/admin/account-groups/:id` | PUT | 更新账户组 |
| `/admin/account-groups/:id` | DELETE | 删除账户组 |

#### **2.5 账户余额查询**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/account-balance/query` | POST | 查询账户余额（支持多种平台） |

**支持的平台：**
- Claude Console
- Gemini
- OpenAI
- AWS Bedrock

#### **2.6 Webhook 配置**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/webhook/configs` | GET | 获取所有 Webhook 配置 |
| `/admin/webhook/configs` | POST | 创建 Webhook 配置 |
| `/admin/webhook/configs/:id` | PUT | 更新 Webhook 配置 |
| `/admin/webhook/configs/:id` | DELETE | 删除 Webhook 配置 |

**Webhook 事件类型：**
- API Key 创建/删除
- 账户状态变化
- 使用量告警
- 错误通知

#### **2.7 并发控制和监控**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/concurrency-queue/stats` | GET | 并发排队统计（P50/P90/P99 等待时间） |
| `/admin/concurrency-queue` | DELETE | 清理残留的并发队列计数器 |
| `/admin/concurrency/:accountId` | GET | 查看特定账户的并发状态 |

#### **2.8 系统管理**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查（组件状态、版本、内存、Redis连接） |
| `/admin/system/info` | GET | 系统信息（版本、uptime、配置） |
| `/admin/system/clear-cache` | POST | 清理系统缓存 |
| `/admin/logs` | GET | 实时日志查看（支持过滤） |

---

### **3. 用户管理 API（可选功能）**

需要设置 `USER_MANAGEMENT_ENABLED=true` 启用。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/users/register` | POST | 用户注册 |
| `/users/login` | POST | 用户登录 |
| `/users/profile` | GET | 获取用户资料 |
| `/users/api-keys` | POST | 创建用户 API Key |
| `/users/api-keys` | GET | 查看用户所有 API Keys |
| `/users/api-keys/:id` | DELETE | 删除用户 API Key |
| `/users/usage` | GET | 查看用户使用统计 |

---

### **4. Web 管理界面路由**

| 端点 | 方法 | 说明 |
|------|------|------|
| `/web` | GET | 传统 Web 管理界面 |
| `/admin-next/` | GET | 新版 SPA 管理界面（主界面，推荐使用） |

---

## 🎨 前端界面功能模块

根据现有的 Vue 3 SPA 项目结构，前端包含以下主要页面：

### **管理端页面**

1. **DashboardView.vue** - 仪表板
   - 系统概览（账户数、API Key 数、总使用量）
   - 实时监控（内存、uptime、缓存命中率）
   - 使用趋势图表
   - 成本分析

2. **AccountsView.vue** - 账户管理
   - 多平台账户列表（Claude、Gemini、OpenAI 等）
   - OAuth 授权流程
   - 账户状态监控
   - Token 刷新
   - 代理配置

3. **ApiKeysView.vue** - API Key 管理
   - API Key 列表
   - 创建/编辑/删除 API Key
   - 权限配置（all/claude/gemini/openai）
   - 速率限制设置
   - 并发限制设置
   - 客户端限制
   - 模型黑名单配置
   - 使用统计查看

4. **ApiStatsView.vue** - API 统计分析
   - 按模型统计
   - 按 API Key 统计
   - 按账户统计
   - 按时间统计
   - 成本分析图表

5. **SettingsView.vue** - 系统设置
   - Webhook 配置
   - LDAP 配置（可选）
   - 系统参数配置
   - 日志级别设置

6. **TutorialView.vue** - 使用教程
   - 快速入门指南
   - OAuth 授权流程说明
   - 客户端配置示例（Claude Code、Gemini CLI 等）

7. **LoginView.vue** - 管理员登录

8. **BalanceScriptsView.vue** - 余额查询脚本管理
   - 配置余额查询脚本
   - 支持多种平台

9. **AccountUsageRecordsView.vue** - 账户使用记录
   - 详细的账户使用历史
   - 按时间范围查询

10. **ApiKeyUsageRecordsView.vue** - API Key 使用记录
    - 详细的 API Key 使用历史
    - Token 使用明细

### **用户端页面（可选）**

11. **UserDashboardView.vue** - 用户仪表板
    - 用户自己的 API Key 列表
    - 使用统计
    - 成本查看

12. **UserLoginView.vue** - 用户登录

---

## 🚀 前端开发建议

### **技术栈（已使用）**

- **前端框架**: Vue 3 + Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **样式**: Tailwind CSS（已集成暗黑模式支持）
- **HTTP 客户端**: Axios
- **UI 组件库**: 建议 Element Plus 或 Ant Design Vue

### **推荐的页面结构**

```
前端应用
│
├── 登录页
│   ├── 管理员登录
│   └── 用户登录（可选）
│
├── 仪表板
│   ├── 系统概览
│   │   ├── 账户总数（按平台分类）
│   │   ├── API Key 总数
│   │   ├── 今日/本月使用量
│   │   └── 今日/本月成本
│   │
│   ├── 实时监控
│   │   ├── 系统内存使用
│   │   ├── Redis 连接状态
│   │   ├── 并发请求数
│   │   └── 缓存命中率
│   │
│   └── 使用趋势
│       ├── 按天使用量图表
│       ├── 按模型使用分布
│       └── 成本趋势图
│
├── 账户管理
│   ├── 账户列表（表格）
│   │   ├── 平台筛选（Claude/Gemini/OpenAI 等）
│   │   ├── 状态筛选（active/error/overload）
│   │   ├── 账户名称、类型、状态
│   │   ├── 最后使用时间
│   │   └── 操作按钮（编辑/删除/刷新 Token）
│   │
│   ├── 添加账户（模态框）
│   │   ├── 选择平台
│   │   ├── OAuth 授权流程（Claude/Gemini）
│   │   │   ├── 生成授权链接
│   │   │   ├── 打开授权页面
│   │   │   ├── 粘贴 authorization code
│   │   │   └── 完成添加
│   │   │
│   │   ├── API Key 配置（OpenAI/Codex/Droid）
│   │   └── AWS 凭据配置（Bedrock）
│   │
│   └── 代理配置（可选）
│       ├── SOCKS5/HTTP 代理
│       ├── 代理认证
│       └── IPv4/IPv6 选择
│
├── API Key 管理
│   ├── API Key 列表
│   │   ├── 搜索和筛选
│   │   ├── API Key 名称、前缀
│   │   ├── 权限（all/claude/gemini/openai）
│   │   ├── 使用量（token/成本）
│   │   ├── 状态（active/expired）
│   │   └── 操作按钮
│   │
│   ├── 创建/编辑 API Key
│   │   ├── 基本信息（名称、描述）
│   │   ├── 权限配置
│   │   │   └── 可访问的服务（all/claude/gemini/openai）
│   │   │
│   │   ├── 速率限制
│   │   │   ├── 每分钟请求数
│   │   │   ├── 每小时请求数
│   │   │   ├── 每天请求数
│   │   │   ├── Token 限制（输入/输出）
│   │   │   └── 成本限制
│   │   │
│   │   ├── 并发限制
│   │   │   ├── 最大并发数
│   │   │   ├── 启用并发排队
│   │   │   ├── 排队超时时间
│   │   │   └── 最大排队数
│   │   │
│   │   ├── 客户端限制
│   │   │   ├── 启用客户端限制
│   │   │   └── 允许的客户端（ClaudeCode/Gemini-CLI 等）
│   │   │
│   │   ├── 模型黑名单
│   │   │   └── 禁止访问的模型列表
│   │   │
│   │   └── 过期时间
│   │
│   └── 使用详情（侧边栏/新页面）
│       ├── Token 使用明细
│       ├── 成本统计
│       ├── 按模型统计
│       └── 按时间统计
│
├── 统计分析
│   ├── 概览统计
│   │   ├── 总请求数
│   │   ├── 总 Token 数
│   │   ├── 总成本
│   │   └── 时间范围选择
│   │
│   ├── 按模型统计
│   │   ├── 模型使用排行
│   │   ├── Token 使用分布
│   │   └── 成本分布
│   │
│   ├── 按 API Key 统计
│   │   ├── API Key 使用排行
│   │   ├── 使用趋势
│   │   └── 成本排行
│   │
│   ├── 按账户统计
│   │   ├── 账户使用分布
│   │   ├── 账户负载平衡
│   │   └── 故障统计
│   │
│   └── 图表展示
│       ├── 折线图（趋势）
│       ├── 柱状图（对比）
│       ├── 饼图（分布）
│       └── 热力图（使用密度）
│
├── 系统设置
│   ├── Webhook 配置
│   │   ├── Webhook URL 列表
│   │   ├── 事件类型选择
│   │   ├── 测试 Webhook
│   │   └── 日志查看
│   │
│   ├── 系统参数
│   │   ├── 并发控制参数
│   │   ├── 速率限制参数
│   │   ├── 粘性会话配置
│   │   └── 缓存配置
│   │
│   ├── LDAP 配置（可选）
│   │   ├── LDAP 服务器地址
│   │   ├── Bind DN 和密码
│   │   ├── 用户搜索配置
│   │   └── 测试连接
│   │
│   └── 日志管理
│       ├── 实时日志查看
│       ├── 日志级别过滤
│       ├── 日志搜索
│       └── 日志下载
│
└── 用户管理（可选）
    ├── 用户列表
    │   ├── 用户名、邮箱
    │   ├── API Key 数量
    │   ├── 使用量
    │   └── 状态
    │
    └── 用户详情
        ├── 基本信息
        ├── API Key 列表
        ├── 使用统计
        └── 操作日志
```

### **核心功能实现要点**

#### **1. OAuth 授权流程（Claude/Gemini）**

```javascript
// 步骤 1: 生成授权 URL
async generateAuthUrl() {
  const response = await axios.post('/admin/claude-accounts/generate-auth-url', {
    proxyType: 'socks5', // 可选
    proxyHost: 'proxy.example.com', // 可选
    proxyPort: 1080, // 可选
    proxyUsername: 'user', // 可选
    proxyPassword: 'pass' // 可选
  })

  // 打开授权链接
  window.open(response.data.authUrl, '_blank')
}

// 步骤 2: 用户在浏览器中完成授权，获得 authorization code

// 步骤 3: 交换 token
async exchangeCode(authCode) {
  const response = await axios.post('/admin/claude-accounts/exchange-code', {
    authorizationCode: authCode,
    codeVerifier: response.data.codeVerifier, // 从步骤 1 保存
    // ... 其他配置
  })

  // 账户创建成功
  console.log('账户 ID:', response.data.accountId)
}
```

#### **2. API Key 创建**

```javascript
async createApiKey() {
  const response = await axios.post('/admin/api-keys', {
    name: 'My API Key',
    description: '用于测试',
    permissions: ['all'], // 或 ['claude', 'gemini']

    // 速率限制（可选）
    rateLimits: {
      requestsPerMinute: 60,
      requestsPerHour: 3600,
      requestsPerDay: 86400,
      tokensPerMinute: 100000,
      tokensPerHour: 1000000,
      tokensPerDay: 10000000,
      costPerDay: 10.00
    },

    // 并发限制（可选）
    concurrentRequests: 5,
    concurrentRequestQueueEnabled: true,
    concurrentRequestQueueMaxSize: 10,
    concurrentRequestQueueTimeoutMs: 10000,

    // 客户端限制（可选）
    allowedClients: ['claude_code', 'gemini_cli'],

    // 模型黑名单（可选）
    modelBlacklist: ['claude-opus-4'],

    // 过期时间（可选）
    expiresAt: '2025-12-31T23:59:59Z'
  })

  // 重要：一次性显示完整的 API Key
  alert('API Key (请保存): ' + response.data.key)
}
```

#### **3. 实时统计查询**

```javascript
// 获取仪表板数据
async getDashboardData() {
  const response = await axios.get('/admin/dashboard')

  return {
    totalAccounts: response.data.totalAccounts,
    totalApiKeys: response.data.totalApiKeys,
    todayUsage: response.data.todayUsage,
    todayCost: response.data.todayCost,
    // ...
  }
}

// 获取使用统计
async getUsageStats(params) {
  const response = await axios.get('/admin/usage-stats/overview', {
    params: {
      startDate: '2025-01-01',
      endDate: '2025-01-31',
      groupBy: 'model' // 或 'apiKey', 'account', 'date'
    }
  })

  return response.data
}
```

#### **4. 账户状态监控**

```javascript
// 定期检查账户状态
setInterval(async () => {
  const response = await axios.get('/admin/claude-accounts')

  response.data.forEach(account => {
    if (account.status === 'error') {
      console.warn('账户错误:', account.name, account.errorMessage)
    } else if (account.status === 'overload') {
      console.warn('账户过载:', account.name)
    }
  })
}, 30000) // 每 30 秒检查一次
```

### **UI/UX 设计要点**

1. **响应式设计**: 必须兼容桌面、平板、手机
2. **暗黑模式**: 已集成 Tailwind CSS 暗黑模式，使用 `dark:` 前缀
3. **实时更新**: 使用 WebSocket 或轮询实现实时数据更新
4. **错误提示**: 友好的错误信息展示
5. **加载状态**: 异步操作时显示加载动画
6. **数据可视化**: 使用图表库（ECharts/Chart.js）展示统计数据
7. **权限控制**: 根据用户角色显示/隐藏功能

### **安全注意事项**

1. **API Key 保护**: API Key 只在创建时完整显示一次，后续只显示前缀
2. **敏感信息脱敏**: 代理密码、AWS Secret Key 等敏感信息前端不显示原文
3. **会话管理**: 实现自动登出（超时）
4. **HTTPS**: 生产环境必须使用 HTTPS
5. **CSRF 防护**: 使用 CSRF token 保护 POST/PUT/DELETE 请求

---

## 📊 数据流说明

### **请求流程**

```
客户端（Claude Code/Gemini CLI）
    ↓ [使用 cr_ 开头的 API Key]
    ↓
中转服务 (CRS)
    ↓ [验证 API Key]
    ↓ [检查权限、速率限制、客户端限制]
    ↓ [统一调度器选择最优账户]
    ↓ [检查 OAuth Token 有效性]
    ↓ [自动刷新过期 Token（如需）]
    ↓ [使用账户凭据转发请求]
    ↓
AI 平台 API (Claude/Gemini/OpenAI 等)
    ↓ [返回响应（流式或非流式）]
    ↓
中转服务 (CRS)
    ↓ [捕获真实 usage 数据]
    ↓ [计算成本]
    ↓ [更新使用统计]
    ↓ [更新速率限制计数器]
    ↓
客户端
```

### **统计数据结构**

每个请求会记录以下数据：

- **输入 Tokens**: `input_tokens`
- **输出 Tokens**: `output_tokens`
- **缓存创建 Tokens**: `cache_creation_input_tokens`（Claude）
- **缓存读取 Tokens**: `cache_read_input_tokens`（Claude）
- **成本**: 根据模型价格自动计算
- **模型**: 使用的具体模型
- **API Key**: 使用的 API Key
- **账户**: 使用的账户
- **时间戳**: 请求时间

---

## 🔧 环境变量配置

### **必须配置**

```bash
# 基础配置
JWT_SECRET=your-super-secret-jwt-key-32-chars-min
ENCRYPTION_KEY=your-32-character-encryption-key

# Redis 配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=  # 可选
```

### **可选配置**

```bash
# 用户管理
USER_MANAGEMENT_ENABLED=true
MAX_API_KEYS_PER_USER=5
ALLOW_USER_DELETE_API_KEYS=false

# LDAP 认证
LDAP_ENABLED=true
LDAP_URL=ldaps://ldap.example.com:636
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=password

# Webhook
WEBHOOK_ENABLED=true
WEBHOOK_URLS=https://webhook1.example.com,https://webhook2.example.com

# 粘性会话
STICKY_SESSION_TTL_HOURS=1
STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES=30

# 并发控制
CLEAR_CONCURRENCY_QUEUES_ON_STARTUP=true

# 监控
METRICS_WINDOW=5  # 实时指标统计窗口（分钟）

# 调试
DEBUG_HTTP_TRAFFIC=false  # 开发环境可设为 true
```

---

## 📝 开发清单

### **前端开发任务**

- [ ] 创建仪表板页面
  - [ ] 系统概览卡片
  - [ ] 实时监控图表
  - [ ] 使用趋势图表

- [ ] 实现账户管理
  - [ ] 账户列表表格
  - [ ] OAuth 授权流程（Claude/Gemini）
  - [ ] 普通账户添加（OpenAI/Codex/Bedrock 等）
  - [ ] 代理配置表单
  - [ ] 账户编辑/删除

- [ ] 实现 API Key 管理
  - [ ] API Key 列表
  - [ ] 创建 API Key 表单（含高级配置）
  - [ ] 编辑 API Key
  - [ ] 使用详情展示
  - [ ] 一次性显示完整 Key

- [ ] 实现统计分析页面
  - [ ] 多维度统计（模型/Key/账户/时间）
  - [ ] 图表可视化
  - [ ] 数据导出功能

- [ ] 实现系统设置
  - [ ] Webhook 配置
  - [ ] LDAP 配置
  - [ ] 系统参数调整
  - [ ] 日志查看器

- [ ] 实现用户管理（可选）
  - [ ] 用户列表
  - [ ] 用户详情
  - [ ] 用户 API Key 管理

- [ ] UI/UX 优化
  - [ ] 响应式布局
  - [ ] 暗黑模式完善
  - [ ] 加载状态
  - [ ] 错误提示
  - [ ] 表单验证

### **后端对接任务**

- [ ] 配置 Axios 实例（baseURL、拦截器）
- [ ] 实现认证拦截器（JWT token）
- [ ] 封装所有 API 调用
- [ ] 错误处理和重试逻辑
- [ ] WebSocket 实时更新（可选）

### **测试任务**

- [ ] 单元测试（组件）
- [ ] 集成测试（API 调用）
- [ ] E2E 测试（关键流程）
- [ ] 性能测试（大数据量）
- [ ] 兼容性测试（多浏览器）

---

## 🌐 部署注意事项

1. **构建前端**: `npm run build:web`
2. **环境变量**: 确保所有必需的环境变量已配置
3. **HTTPS**: 生产环境必须使用 HTTPS（推荐使用 Caddy 或 Nginx）
4. **反向代理**: 配置反向代理时注意：
   - 禁用 WebSocket 支持（`Websockets Support = OFF`）
   - 禁用缓存（`Cache Assets = OFF`）
   - 设置合理的超时时间（`proxy_read_timeout 300s`）
5. **防火墙**: 只开放必要的端口（80、443）

---

## 📚 相关文档

- **项目 README**: `../README.md`
- **Claude 开发指南**: `../CLAUDE.md`
- **API 详细文档**: 各 route 文件中的注释
- **配置示例**: `../.env.example`、`../config/config.example.js`

---

## 💡 常见问题

### **1. OAuth 授权失败怎么办？**

- 检查代理配置是否正确
- 确保能访问 claude.ai 或 Google OAuth
- 查看日志中的详细错误信息

### **2. API Key 创建后看不到完整 Key？**

- API Key 只在创建时显示一次，后续只显示前缀
- 建议提示用户立即复制保存

### **3. 统计数据不准确？**

- 运行 `npm run init:costs` 初始化成本数据
- 检查 pricingService 是否正确加载模型价格

### **4. 账户经常显示 error 状态？**

- 检查 OAuth Token 是否过期（自动刷新失败）
- 查看账户的代理配置是否正确
- 检查账户余额是否充足

### **5. 并发请求经常超时？**

- 调整 `concurrentRequestQueueTimeoutMs` 配置
- 检查账户并发限制设置
- 查看 `/admin/concurrency-queue/stats` 统计数据

---

## 🎯 总结

Claude Relay Service 是一个功能完整的 AI API 中转服务，提供：

- ✅ **多平台支持**（8 种账户类型）
- ✅ **完善的管理界面**（Vue 3 SPA）
- ✅ **细粒度权限控制**（API Key 级别）
- ✅ **详细的使用统计**（Token、成本、多维度分析）
- ✅ **企业级功能**（LDAP、Webhook、用户管理）
- ✅ **高可用性**（自动故障转移、并发控制、粘性会话）

前端开发只需按照本文档的 API 规范进行对接，即可快速构建功能完整的管理界面。

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
