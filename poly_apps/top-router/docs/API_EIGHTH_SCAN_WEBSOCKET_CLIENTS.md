# Claude Relay Service - WebSocket客户端和多平台路由 API

> 本文档记录第八次扫描发现的WebSocket客户端管理、OpenAI兼容路由和数据同步功能

**版本**: 1.0
**最后更新**: 2026-01-02
**发现**: 第八次全面扫描

---

## 📊 本次扫描发现汇总

| 分类 | 端点数量 | 文件来源 |
|------|----------|----------|
| **WebSocket 客户端管理** | ~70 | admin/clients.js |
| **Webhook 通知管理** | 8 | webhook.js |
| **标准 Gemini API** | 14 | standardGeminiRoutes.js |
| **Azure OpenAI 路由** | 5 | azureOpenaiRoutes.js |
| **OpenAI-Claude 转换** | 4 | openaiClaudeRoutes.js |
| **OpenAI-Gemini 转换** | 3 | openaiGeminiRoutes.js |
| **官方 OpenAI 代理** | 2 | openaiOfficialRoutes.js |
| **数据同步导出** | 1 | admin/sync.js |
| **总计** | ~107 | |

---

## 1. WebSocket 客户端管理 API

这是一个完整的远程客户端管理系统,通过 WebSocket 连接管理分布式客户端节点。

### 1.1 客户端基础管理

#### 获取支持的客户端类型列表

**请求**:
```http
GET /admin/supported-clients
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "type": "claude-code",
      "name": "Claude Code",
      "description": "Claude Code客户端"
    },
    {
      "type": "gemini-cli",
      "name": "Gemini CLI",
      "description": "Gemini命令行客户端"
    }
  ]
}
```

---

#### 获取所有客户端列表

**请求**:
```http
GET /admin/clients
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "client-550e8400",
      "name": "Production Client 1",
      "apiKeyPrefix": "cl_1234",
      "status": "online",
      "liveConnected": true,
      "connectionStatus": "connected",
      "currentConcurrency": 3,
      "maxConcurrency": 10,
      "availableSlots": 7,
      "supportedPlatforms": ["claude", "gemini"],
      "supportedAccountTypes": ["claude-official", "gemini"],
      "supportedModels": ["claude-sonnet-4-5", "gemini-2.5-pro"],
      "priority": 1,
      "schedulable": true,
      "isActive": true,
      "tags": ["production", "us-east-1"],
      "createdAt": "2026-01-02T10:30:00.000Z",
      "lastConnectedAt": "2026-01-02T10:35:00.000Z"
    }
  ]
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `liveConnected` | Boolean | 实时 WebSocket 连接状态 |
| `connectionStatus` | String | 连接状态 (connected/disconnected) |
| `currentConcurrency` | Number | 当前并发请求数 |
| `availableSlots` | Number | 可用并发槽位数 |
| `supportedPlatforms` | Array | 支持的平台列表 |
| `supportedAccountTypes` | Array | 支持的账户类型 |
| `supportedModels` | Array | 支持的模型列表 |
| `schedulable` | Boolean | 是否可调度 |

---

#### 创建客户端

**请求**:
```http
POST /admin/clients
Authorization: Bearer {token}
Content-Type: application/json

{
  "apiKey": "client_api_key_here",
  "name": "Production Client 1",
  "description": "生产环境客户端",
  "supportedPlatforms": ["claude", "gemini"],
  "supportedAccountTypes": ["claude-official", "gemini"],
  "supportedModels": ["claude-sonnet-4-5", "gemini-2.5-pro"],
  "maxConcurrency": 10,
  "priority": 1,
  "schedulable": true,
  "isActive": true,
  "tags": ["production", "us-east-1"]
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKey` | String | 是 | 客户端 API Key |
| `name` | String | 是 | 客户端名称 |
| `description` | String | 否 | 描述信息 |
| `supportedPlatforms` | Array | 否 | 支持的平台 |
| `supportedAccountTypes` | Array | 否 | 支持的账户类型 |
| `supportedModels` | Array | 否 | 支持的模型 |
| `maxConcurrency` | Number | 否 | 最大并发数(默认10) |
| `priority` | Number | 否 | 优先级(默认50) |
| `schedulable` | Boolean | 否 | 可调度(默认true) |
| `isActive` | Boolean | 否 | 是否激活(默认true) |
| `tags` | Array | 否 | 标签列表 |

**响应**: 返回创建的客户端详情(同GET /admin/clients/:id格式)

---

#### 获取单个客户端详情

**请求**:
```http
GET /admin/clients/{clientId}
Authorization: Bearer {token}
```

**响应**: 同客户端列表中的单个客户端对象

---

#### 更新客户端

**请求**:
```http
PUT /admin/clients/{clientId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Client 1 (Updated)",
  "maxConcurrency": 20,
  "priority": 10
}
```

**响应**: 返回更新后的客户端详情

---

#### 切换客户端可调度状态

**请求**:
```http
PUT /admin/clients/{clientId}/toggle-schedulable
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "client-550e8400",
    "schedulable": false
  }
}
```

---

#### 删除客户端

**请求**:
```http
DELETE /admin/clients/{clientId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true
}
```

---

#### 断开客户端连接

**请求**:
```http
POST /admin/clients/{clientId}/disconnect
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "admin_maintenance"
}
```

**响应**:
```json
{
  "success": true
}
```

---

### 1.2 客户端配置管理

#### 下发配置到客户端

**请求**:
```http
POST /admin/clients/{clientId}/config
Authorization: Bearer {token}
Content-Type: application/json

{
  "config": {
    "maxConcurrency": 20,
    "enableCache": true,
    "cacheSize": 1000
  },
  "applyImmediately": true,
  "summary": "增加并发限制到20",
  "operator": "admin"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `config` | Object | 是 | 配置对象 |
| `applyImmediately` | Boolean | 否 | 是否立即应用(默认true) |
| `summary` | String | 否 | 配置变更摘要 |
| `operator` | String | 否 | 操作者 |

**响应**:
```json
{
  "success": true,
  "data": {
    "configId": "cfg-001",
    "appliedAt": "2026-01-02T11:00:00.000Z",
    "success": true
  }
}
```

---

#### 获取客户端当前配置

**请求**:
```http
GET /admin/clients/{clientId}/config
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "maxConcurrency": 20,
    "enableCache": true,
    "cacheSize": 1000,
    "lastUpdatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

#### 获取配置历史记录

**请求**:
```http
GET /admin/clients/{clientId}/config/history?limit=50
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | Number | 50 | 返回记录数量 |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "configId": "cfg-002",
      "config": {
        "maxConcurrency": 20
      },
      "summary": "增加并发限制到20",
      "operator": "admin",
      "appliedAt": "2026-01-02T11:00:00.000Z"
    },
    {
      "configId": "cfg-001",
      "config": {
        "maxConcurrency": 10
      },
      "summary": "初始配置",
      "operator": "system",
      "appliedAt": "2026-01-02T10:30:00.000Z"
    }
  ]
}
```

---

#### 查询客户端系统健康状态

**请求**:
```http
GET /admin/clients/{clientId}/system-health
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "cpuUsage": 45.2,
    "memoryUsage": 62.5,
    "diskUsage": 38.7,
    "uptime": 864532,
    "networkLatency": 25,
    "activeConnections": 3,
    "timestamp": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 1.3 客户端账户管理

#### 获取客户端所有账户

**请求**:
```http
GET /admin/clients/{clientId}/accounts
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accounts": [
      {
        "id": "claude-acc-123",
        "name": "Production Claude Account",
        "accountType": "claude-official",
        "platform": "claude",
        "status": "active",
        "isActive": true,
        "schedulable": true
      },
      {
        "id": "gemini-acc-456",
        "name": "Production Gemini Account",
        "accountType": "gemini",
        "platform": "gemini",
        "status": "active",
        "isActive": true,
        "schedulable": true
      }
    ]
  }
}
```

---

#### 执行账户操作

**请求**:
```http
POST /admin/clients/{clientId}/accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "operation": "add_account",
  "data": {
    "accountType": "claude-official",
    "accountData": {
      "name": "New Claude Account",
      "claudeAiOauth": {
        "accessToken": "...",
        "refreshToken": "...",
        "expiresAt": "..."
      }
    }
  }
}
```

**支持的操作**:

| 操作 | 说明 |
|------|------|
| `add_account` | 添加账户 |
| `update_account` | 更新账户 |
| `delete_account` | 删除账户 |
| `toggle_account` | 切换账户启用状态 |

**响应**: 返回操作结果

---

### 1.4 客户端 OAuth 流程

#### 生成 OAuth 授权 URL

**请求**:
```http
POST /admin/clients/{clientId}/generate-oauth-url
Authorization: Bearer {token}
Content-Type: application/json

{
  "accountType": "claude-official",
  "proxy": {
    "protocol": "socks5",
    "host": "proxy.example.com",
    "port": 1080
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "authUrl": "https://claude.ai/oauth/authorize?...",
    "sessionId": "oauth-session-123",
    "codeVerifier": "..."
  }
}
```

---

#### 交换 OAuth 授权码

**请求**:
```http
POST /admin/clients/{clientId}/exchange-oauth-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionId": "oauth-session-123",
  "code": "authorization_code_here",
  "accountType": "claude-official",
  "accountData": {
    "name": "New OAuth Account",
    "description": "生产环境账户"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-acc-789",
    "name": "New OAuth Account",
    "status": "active"
  }
}
```

---

### 1.5 动态账户类型路由

客户端支持所有账户类型的完整 CRUD 操作,通过动态路由实现:

**支持的账户类型 (segment)**:
- `claude-accounts` - Claude官方账户
- `claude-console-accounts` - Claude Console账户
- `gemini-accounts` - Gemini账户
- `openai-accounts` - OpenAI账户
- `bedrock-accounts` - AWS Bedrock账户
- `azure-openai-accounts` - Azure OpenAI账户
- `openai-responses-accounts` - OpenAI Responses账户
- `droid-accounts` - Droid账户
- `gemini-api-accounts` - Gemini API账户
- `ccr-accounts` - CCR账户

**通用路由模式**:

| 路由 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/:segment` | GET | 列出该类型账户 |
| `/admin/clients/:clientId/:segment` | POST | 创建账户 |
| `/admin/clients/:clientId/:segment/:accountId` | PUT | 更新账户 |
| `/admin/clients/:clientId/:segment/:accountId` | DELETE | 删除账户 |
| `/admin/clients/:clientId/:segment/:accountId/toggle` | PUT | 切换启用状态 |
| `/admin/clients/:clientId/:segment/:accountId/reset-status` | POST | 重置状态 |
| `/admin/clients/:clientId/:segment/:accountId/toggle-schedulable` | PUT | 切换可调度 |

**示例 - 列出 Claude 账户**:
```http
GET /admin/clients/client-001/claude-accounts
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "claude-acc-123",
      "name": "Production Account",
      "status": "active",
      "isActive": true,
      "schedulable": true
    }
  ]
}
```

---

### 1.6 特定平台扩展功能

#### Claude 账户刷新 Token

**请求**:
```http
POST /admin/clients/{clientId}/claude-accounts/{accountId}/refresh
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-acc-123",
    "refreshedAt": "2026-01-02T11:00:00.000Z",
    "newExpiresAt": "2026-01-02T19:00:00.000Z"
  }
}
```

---

#### Claude 账户测试 (流式)

**请求**:
```http
POST /admin/clients/{clientId}/claude-accounts/{accountId}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "model": "claude-sonnet-4-5",
  "message": "Hello, test"
}
```

**响应**: SSE流式响应

---

#### 生成账户授权 URL (通用)

**请求**:
```http
POST /admin/clients/{clientId}/{segment}/generate-auth-url
Authorization: Bearer {token}
Content-Type: application/json

{
  "proxy": {
    "protocol": "socks5",
    "host": "proxy.example.com",
    "port": 1080
  }
}
```

**适用平台**: Claude、Gemini、OpenAI、Droid

---

#### 交换授权码 (通用)

**请求**:
```http
POST /admin/clients/{clientId}/{segment}/exchange-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "authorization_code_here",
  "accountData": {
    "name": "New Account"
  }
}
```

**适用平台**: Claude、Gemini、OpenAI、Droid

---

### 1.7 账户扩展功能

#### 查询账户使用历史

**请求**:
```http
GET /admin/clients/{clientId}/accounts/{accountId}/usage-history
Authorization: Bearer {token}
```

---

#### 查询账户余额

**请求**:
```http
GET /admin/clients/{clientId}/accounts/{accountId}/balance
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-console-acc-123",
    "balance": 95.50,
    "currency": "USD",
    "quota": {
      "total": 100.00,
      "used": 4.50,
      "remaining": 95.50
    },
    "lastUpdated": "2026-01-02T11:00:00.000Z"
  }
}
```

---

#### 刷新账户余额

**请求**:
```http
POST /admin/clients/{clientId}/accounts/{accountId}/balance/refresh
Authorization: Bearer {token}
```

---

#### 按平台查询余额

**请求**:
```http
GET /admin/clients/{clientId}/accounts/balance/platform/{platform}
Authorization: Bearer {token}
```

**平台参数**: claude-console、gemini、openai等

---

#### 获取账户绑定数统计

**请求**:
```http
GET /admin/clients/{clientId}/accounts/binding-counts
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "claude-acc-123": 5,
    "gemini-acc-456": 3,
    "total": 8
  }
}
```

---

#### 余额脚本管理

**获取余额脚本**:
```http
GET /admin/clients/{clientId}/accounts/{accountId}/balance/script
Authorization: Bearer {token}
```

**更新余额脚本**:
```http
PUT /admin/clients/{clientId}/accounts/{accountId}/balance/script
Authorization: Bearer {token}
Content-Type: application/json

{
  "script": "return { balance: 100.00, currency: 'USD' }"
}
```

**测试余额脚本**:
```http
POST /admin/clients/{clientId}/accounts/{accountId}/balance/script/test
Authorization: Bearer {token}
```

---

#### 其他客户端透传端点

| 端点 | 说明 |
|------|------|
| `GET /admin/clients/:clientId/api-keys` | 获取客户端API Keys |
| `GET /admin/clients/:clientId/account-groups` | 获取账户组 |
| `POST /admin/clients/:clientId/account-groups` | 创建账户组 |
| `PUT /admin/clients/:clientId/account-groups/:groupId` | 更新账户组 |
| `DELETE /admin/clients/:clientId/account-groups/:groupId` | 删除账户组 |
| `GET /admin/clients/:clientId/account-groups/:groupId/members` | 获取组成员 |
| `GET /admin/clients/:clientId/claude-accounts/usage` | Claude账户使用量 |
| `GET /admin/clients/:clientId/claude-console-accounts/:accountId/usage` | Console账户使用量 |
| `GET /admin/clients/:clientId/openai-responses-accounts/auto-recovery-configs` | 自动恢复配置 |
| `GET /admin/clients/:clientId/claude-code-version` | Claude Code版本 |
| `POST /admin/clients/:clientId/claude-code-version/clear` | 清除版本缓存 |

---

## 2. Webhook 通知管理 API

### 2.1 获取 Webhook 配置

**请求**:
```http
GET /webhook/config
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "config": {
    "enabled": true,
    "globalUrl": "https://webhook.example.com/notify",
    "platforms": [
      {
        "id": "platform-001",
        "name": "Slack",
        "type": "slack",
        "url": "https://hooks.slack.com/services/...",
        "enabled": true,
        "events": ["apiKeyCreated", "accountError", "costAlert"],
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 2.2 保存 Webhook 配置

**请求**:
```http
POST /webhook/config
Authorization: Bearer {token}
Content-Type: application/json

{
  "enabled": true,
  "globalUrl": "https://webhook.example.com/notify"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Webhook配置已保存",
  "config": {
    "enabled": true,
    "globalUrl": "https://webhook.example.com/notify"
  }
}
```

---

### 2.3 添加 Webhook 平台

**请求**:
```http
POST /webhook/platforms
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Slack Production",
  "type": "slack",
  "url": "https://hooks.slack.com/services/...",
  "enabled": true,
  "events": ["apiKeyCreated", "accountError", "costAlert"],
  "headers": {
    "Content-Type": "application/json"
  }
}
```

**支持的平台类型**:

| 类型 | 说明 |
|------|------|
| `slack` | Slack Webhook |
| `discord` | Discord Webhook |
| `bark` | Bark推送 |
| `smtp` | SMTP邮件 |
| `telegram` | Telegram Bot |
| `custom` | 自定义Webhook |

**支持的事件类型**:

| 事件 | 说明 |
|------|------|
| `apiKeyCreated` | API Key创建 |
| `apiKeyDeleted` | API Key删除 |
| `apiKeyUpdated` | API Key更新 |
| `accountCreated` | 账户创建 |
| `accountError` | 账户错误 |
| `accountBlocked` | 账户被封禁 |
| `tokenRefreshFailed` | Token刷新失败 |
| `costAlert` | 成本告警 |
| `rateLimitExceeded` | 速率限制超限 |
| `paymentSuccess` | 支付成功 |
| `paymentFailed` | 支付失败 |

**响应**:
```json
{
  "success": true,
  "message": "Webhook平台已添加",
  "platform": {
    "id": "platform-003",
    "name": "Slack Production",
    "type": "slack",
    "url": "https://hooks.slack.com/services/...",
    "enabled": true,
    "events": ["apiKeyCreated", "accountError", "costAlert"],
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 2.4 更新 Webhook 平台

**请求**:
```http
PUT /webhook/platforms/{platformId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Slack Production (Updated)",
  "enabled": false
}
```

**响应**:
```json
{
  "success": true,
  "message": "Webhook平台已更新",
  "platform": {
    "id": "platform-003",
    "name": "Slack Production (Updated)",
    "enabled": false,
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 2.5 删除 Webhook 平台

**请求**:
```http
DELETE /webhook/platforms/{platformId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Webhook平台已删除"
}
```

---

### 2.6 切换 Webhook 平台状态

**请求**:
```http
POST /webhook/platforms/{platformId}/toggle
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Webhook平台已启用",
  "platform": {
    "id": "platform-003",
    "enabled": true
  }
}
```

---

### 2.7 测试 Webhook 连通性

**请求**:
```http
POST /webhook/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "slack",
  "url": "https://hooks.slack.com/services/..."
}
```

**Bark 平台测试**:
```json
{
  "type": "bark",
  "deviceKey": "your_device_key",
  "serverUrl": "https://api.day.app",
  "level": "active",
  "sound": "bell"
}
```

**SMTP 平台测试**:
```json
{
  "type": "smtp",
  "host": "smtp.gmail.com",
  "port": 587,
  "secure": false,
  "user": "user@gmail.com",
  "pass": "password",
  "from": "sender@gmail.com",
  "to": "recipient@gmail.com"
}
```

**Telegram 平台测试**:
```json
{
  "type": "telegram",
  "botToken": "your_bot_token",
  "chatId": "your_chat_id",
  "apiBaseUrl": "https://api.telegram.org",
  "proxyUrl": "socks5://proxy:1080"
}
```

**响应 (成功)**:
```json
{
  "success": true,
  "message": "Webhook测试成功",
  "url": "https://hooks.slack.com/services/..."
}
```

**响应 (失败)**:
```json
{
  "success": false,
  "message": "Webhook测试失败",
  "error": "Connection timeout"
}
```

---

### 2.8 手动触发测试通知

**请求**:
```http
POST /webhook/test-notification
Authorization: Bearer {token}
Content-Type: application/json

{
  "type": "test",
  "accountId": "test-account-id",
  "accountName": "测试账号",
  "platform": "claude-oauth",
  "status": "test",
  "errorCode": "TEST_NOTIFICATION",
  "reason": "手动测试通知",
  "message": "这是一条测试通知消息"
}
```

**响应 (全部成功)**:
```json
{
  "success": true,
  "message": "测试通知已成功发送到 3 个平台",
  "data": {
    "accountId": "test-account-id",
    "accountName": "测试账号",
    "timestamp": "2026-01-02T11:00:00+08:00"
  },
  "result": {
    "succeeded": 3,
    "failed": 0,
    "total": 3
  }
}
```

**响应 (部分失败)**:
```json
{
  "success": true,
  "message": "测试通知部分成功: 2个平台成功, 1个平台失败",
  "result": {
    "succeeded": 2,
    "failed": 1,
    "total": 3
  }
}
```

---

## 3. 标准 Gemini API 路由

### 3.1 动态模型内容生成端点

**v1beta 版本**:
- `POST /v1beta/models/:modelName:generateContent` - 生成内容
- `POST /v1beta/models/:modelName:streamGenerateContent` - 流式生成
- `POST /v1beta/models/:modelName:countTokens` - Token计数
- `POST /v1beta/models/:modelName:loadCodeAssist` - 加载代码辅助
- `POST /v1beta/models/:modelName:onboardUser` - 用户引导

**v1 版本**:
- `POST /v1/models/:modelName:generateContent` - 生成内容
- `POST /v1/models/:modelName:streamGenerateContent` - 流式生成
- `POST /v1/models/:modelName:countTokens` - Token计数

**v1internal 版本**:
- `POST /v1internal:generateContent` - 内部格式生成
- `POST /v1internal:streamGenerateContent` - 内部格式流式
- `POST /v1internal:countTokens` - 内部格式Token计数
- `POST /v1internal:loadCodeAssist` - 内部格式代码辅助
- `POST /v1internal:onboardUser` - 内部格式用户引导

**模型列表端点**:
- `GET /v1beta/models` - 获取模型列表 (v1beta)
- `GET /v1/models` - 获取模型列表 (v1)
- `GET /v1beta/models/:modelName` - 获取模型详情 (v1beta)
- `GET /v1/models/:modelName` - 获取模型详情 (v1)

**请求示例 (generateContent)**:
```http
POST /v1beta/models/gemini-2.5-pro:generateContent
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello!"
        }
      ]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "maxOutputTokens": 4096
  }
}
```

**响应**:
```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Hello! How can I help you?"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 5,
    "candidatesTokenCount": 8,
    "totalTokenCount": 13
  }
}
```

---

## 4. Azure OpenAI 路由 API

### 4.1 健康检查

**请求**:
```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "service": "azure-openai-relay",
  "timestamp": "2026-01-02T11:00:00.000Z"
}
```

---

### 4.2 获取可用模型列表

**请求**:
```http
GET /models
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "azure/gpt-4o",
      "object": "model",
      "created": 1704153600000,
      "owned_by": "azure-openai"
    },
    {
      "id": "azure/gpt-5",
      "object": "model",
      "created": 1704153600000,
      "owned_by": "azure-openai"
    }
  ]
}
```

**支持的模型**:
- Chat 模型: gpt-4, gpt-4-turbo, gpt-4o, gpt-4o-mini, gpt-5, gpt-5-mini, gpt-35-turbo, gpt-35-turbo-16k, codex-mini
- Embedding 模型: text-embedding-ada-002, text-embedding-3-small, text-embedding-3-large

---

### 4.3 聊天完成请求

**请求**:
```http
POST /chat/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "stream": false
}
```

**响应**:
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1704153600,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 8,
    "total_tokens": 13
  }
}
```

**特性**:
- 自动账户选择 (绑定账户优先,否则自动选择可用账户)
- Session-based sticky sessions (会话绑定)
- 支持流式和非流式响应
- 原子使用统计报告 (防止重复记录)
- Cache token 追踪

---

### 4.4 Responses 端点 (gpt-5, codex-mini)

**请求**:
```http
POST /responses
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gpt-5",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

**响应**: 同 chat/completions 格式

---

### 4.5 Embeddings 端点

**请求**:
```http
POST /embeddings
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "text-embedding-3-small",
  "input": "Hello, world!"
}
```

**响应**:
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.123, -0.456, ...],
      "index": 0
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 4,
    "total_tokens": 4
  }
}
```

---

### 4.6 使用统计查询

**请求**:
```http
GET /usage?start_date=2026-01-01&end_date=2026-01-31
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "object": "usage",
  "data": {
    "totalRequests": 500,
    "totalTokens": 210000,
    "totalCost": 25.50
  }
}
```

---

## 5. OpenAI-Claude 转换路由 API

### 5.1 获取模型列表

**请求**:
```http
GET /v1/models
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-opus-4-20250514",
      "object": "model",
      "created": 1736726400,
      "owned_by": "anthropic"
    },
    {
      "id": "claude-sonnet-4-20250514",
      "object": "model",
      "created": 1736726400,
      "owned_by": "anthropic"
    }
  ]
}
```

**特性**:
- 模型黑名单过滤 (如果启用 `enableModelRestriction`)
- 只返回 opus-4 和 sonnet-4

---

### 5.2 获取模型详情

**请求**:
```http
GET /v1/models/claude-sonnet-4-20250514
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "id": "claude-sonnet-4-20250514",
  "object": "model",
  "created": 1736726400,
  "owned_by": "anthropic",
  "permission": [],
  "root": "claude-sonnet-4-20250514",
  "parent": null
}
```

---

### 5.3 聊天完成请求 (OpenAI格式转Claude)

**请求**:
```http
POST /v1/chat/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "claude-sonnet-4-5",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "stream": false
}
```

**响应** (OpenAI格式):
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1704153600,
  "model": "claude-sonnet-4-5",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 8,
    "total_tokens": 13
  }
}
```

**特性**:
- 完整的 OpenAI 格式到 Claude 格式转换
- 翻译服务集成 (通过 `x-translation-target` header)
- 模型黑名单检查
- 权限验证
- 支持流式和非流式
- Claude Code headers 自动添加

---

### 5.4 Completions 端点 (传统格式)

**请求**:
```http
POST /v1/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "claude-sonnet-4-5",
  "prompt": "Hello, world!",
  "max_tokens": 100
}
```

**响应**: 同 chat/completions 格式 (内部自动转换为 chat 格式)

---

## 6. OpenAI-Gemini 转换路由 API

### 6.1 聊天完成请求 (OpenAI格式转Gemini)

**请求**:
```http
POST /v1/chat/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gemini-2.5-pro",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "stream": false
}
```

**响应** (OpenAI格式):
```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "created": 1704153600,
  "model": "gemini-2.5-pro",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 5,
    "completion_tokens": 8,
    "total_tokens": 13
  }
}
```

**特性**:
- 完整的 OpenAI 格式到 Gemini 格式转换
- 支持 CCR 账户
- Antigravity project ID 处理
- WebSocket 客户端中继支持
- 翻译服务集成
- 模型黑名单检查

---

### 6.2 获取模型列表

**请求**:
```http
GET /v1/models
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "gemini-2.0-flash-exp",
      "object": "model",
      "created": 1704153600,
      "owned_by": "google"
    },
    {
      "id": "gemini-2.5-pro",
      "object": "model",
      "created": 1704153600,
      "owned_by": "google"
    }
  ]
}
```

---

### 6.3 获取模型详情

**请求**:
```http
GET /v1/models/gemini-2.5-pro
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "id": "gemini-2.5-pro",
  "object": "model",
  "created": 1704153600,
  "owned_by": "google",
  "permission": [],
  "root": "gemini-2.5-pro",
  "parent": null
}
```

---

## 7. 官方 OpenAI 代理路由 API

### 7.1 聊天完成请求

**请求**:
```http
POST /v1/chat/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

**响应**: 直接透传 OpenAI 官方 API 响应

**特性**:
- 简单透传代理到 OpenAI 官方 API
- 使用配置的 OPENAI_API_KEY
- 支持代理配置
- 使用统计记录
- 诊断 headers 透传 (x-request-id, openai-processing-ms, openai-version)

---

### 7.2 Completions 端点

**请求**:
```http
POST /v1/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gpt-4o",
  "prompt": "Hello!",
  "max_tokens": 100
}
```

**响应**: 直接透传 OpenAI 官方 API 响应

---

## 8. 数据同步导出 API

### 8.1 导出账户数据 (含敏感信息)

**请求**:
```http
GET /admin/sync/export-accounts?include_secrets=true
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `include_secrets` | Boolean | 是 | 必须设置为 true 才能导出敏感数据 |

**响应**:
```json
{
  "success": true,
  "data": {
    "exportedAt": "2026-01-02T11:00:00.000Z",
    "claudeAccounts": [
      {
        "kind": "claude-account",
        "id": "claude-acc-123",
        "name": "Production Account",
        "description": "生产环境账户",
        "platform": "claude",
        "authType": "oauth",
        "isActive": true,
        "schedulable": true,
        "priority": 50,
        "status": "active",
        "proxy": {
          "protocol": "socks5",
          "host": "proxy.example.com",
          "port": 1080,
          "username": "user",
          "password": "pass"
        },
        "credentials": {
          "access_token": "decrypted_access_token",
          "refresh_token": "decrypted_refresh_token",
          "expires_at": "2026-01-02T19:00:00.000Z",
          "expires_in": 28800,
          "scope": "user:profile user:inference",
          "token_type": "Bearer",
          "org_uuid": "org-123",
          "account_uuid": "acc-456"
        },
        "extra": {
          "crs_account_id": "claude-acc-123",
          "crs_kind": "claude-account",
          "crs_auth_type": "oauth",
          "crs_scopes": ["user:profile", "user:inference"]
        }
      }
    ],
    "claudeConsoleAccounts": [...],
    "openaiOAuthAccounts": [...],
    "openaiResponsesAccounts": [...]
  }
}
```

**支持的账户类型**:
- Claude OAuth 账户 (含 org_uuid, account_uuid)
- Claude Console API Key 账户 (含 model_mapping)
- OpenAI OAuth 账户 (含 chatgpt_account_id, organization_id)
- OpenAI Responses API Key 账户

**安全警告**:
- 导出的数据包含**未加密**的敏感信息 (OAuth Token、API Key、代理凭据等)
- 必须安全传输和存储
- 仅用于服务器到服务器的数据迁移
- 凭据已解密并包含完整的认证信息

---

## 9. 数据格式补充

### 9.1 客户端数据结构

```typescript
interface Client {
  id: string                    // 客户端ID
  name: string                  // 客户端名称
  apiKeyPrefix: string          // API Key前缀
  status: 'online' | 'offline'  // 状态
  liveConnected: boolean        // 实时连接状态
  connectionStatus: 'connected' | 'disconnected'
  currentConcurrency: number    // 当前并发数
  maxConcurrency: number        // 最大并发数
  availableSlots: number        // 可用槽位
  supportedPlatforms: string[]  // 支持的平台
  supportedAccountTypes: string[] // 支持的账户类型
  supportedModels: string[]     // 支持的模型
  priority: number              // 优先级
  schedulable: boolean          // 可调度
  isActive: boolean             // 是否激活
  tags: string[]                // 标签
  createdAt: string             // 创建时间
  lastConnectedAt: string       // 最后连接时间
}
```

### 9.2 Webhook 平台数据结构

```typescript
interface WebhookPlatform {
  id: string                    // 平台ID
  name: string                  // 平台名称
  type: string                  // 类型 (slack/discord/bark/smtp/telegram/custom)
  url?: string                  // Webhook URL (type=custom时需要)
  enabled: boolean              // 是否启用
  events: string[]              // 监听的事件列表
  headers?: Record<string, string> // 自定义请求头
  // Bark 特有字段
  deviceKey?: string            // Bark设备密钥
  serverUrl?: string            // Bark服务器地址
  level?: string                // 通知级别
  sound?: string                // 通知声音
  group?: string                // 通知分组
  // SMTP 特有字段
  host?: string                 // SMTP主机
  port?: number                 // SMTP端口
  secure?: boolean              // 使用SSL/TLS
  user?: string                 // SMTP用户名
  pass?: string                 // SMTP密码
  from?: string                 // 发件人
  to?: string | string[]        // 收件人
  ignoreTLS?: boolean           // 忽略TLS验证
  // Telegram 特有字段
  botToken?: string             // Bot Token
  chatId?: string               // Chat ID
  apiBaseUrl?: string           // API基础地址
  proxyUrl?: string             // 代理地址
  createdAt: string             // 创建时间
  updatedAt?: string            // 更新时间
}
```

### 9.3 导出账户凭据结构

```typescript
interface ExportedClaudeAccount {
  kind: 'claude-account'
  id: string
  name: string
  description: string
  platform: 'claude'
  authType: 'oauth' | 'setup-token'
  isActive: boolean
  schedulable: boolean
  priority: number
  status: string
  proxy: ProxyConfig | null
  credentials: {
    access_token: string        // 解密的访问令牌
    refresh_token?: string      // 解密的刷新令牌
    expires_at?: string         // 过期时间
    expires_in?: number         // 过期秒数
    scope?: string              // 授权范围
    token_type: 'Bearer'
    org_uuid?: string           // 组织UUID
    account_uuid?: string       // 账户UUID
  }
  extra: {                      // 原始CRS数据
    crs_account_id: string
    crs_kind: 'claude-account'
    crs_auth_type: string
    crs_scopes: string[]
    crs_subscription_info?: string
  }
}
```

---

## 10. 错误码参考

### WebSocket 客户端错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `WS_SERVER_DISABLED` | 400 | WebSocket服务器未启用 |
| `CLIENT_NOT_FOUND` | 404 | 客户端不存在 |
| `CLIENT_OFFLINE` | 400 | 客户端未连接 |
| `CLIENT_NOT_CONNECTED` | 400 | 客户端未在线 |
| `CLIENT_LOCAL_REQUEST_FAILED` | 400 | 客户端本地请求失败 |

### Webhook 错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `WEBHOOK_DISABLED` | 400 | Webhook功能未启用 |
| `INVALID_URL` | 400 | Webhook URL格式无效 |
| `PLATFORM_NOT_FOUND` | 404 | Webhook平台不存在 |
| `MISSING_DEVICE_KEY` | 400 | 缺少Bark设备密钥 |
| `MISSING_SMTP_HOST` | 400 | 缺少SMTP主机地址 |
| `MISSING_BOT_TOKEN` | 400 | 缺少Telegram Bot Token |
| `CONNECTION_TIMEOUT` | 400 | 连接超时 |

### Azure OpenAI 错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `SERVICE_UNAVAILABLE` | 503 | 没有可用的Azure OpenAI账户 |
| `AZURE_OPENAI_ERROR` | 5xx | Azure OpenAI服务错误 |

### 官方 OpenAI 代理错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `MISSING_OPENAI_API_KEY` | 500 | 未配置OPENAI_API_KEY |
| `PERMISSION_DENIED` | 403 | API Key缺少OpenAI权限 |
| `UPSTREAM_ERROR` | 502 | 上游服务错误 |

---

## 11. 使用场景示例

### 场景 1: WebSocket 客户端完整管理流程

```javascript
// 1. 创建客户端
const client = await axios.post('/admin/clients', {
  apiKey: 'client_api_key_here',
  name: 'Production Client 1',
  supportedPlatforms: ['claude', 'gemini'],
  maxConcurrency: 10
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 2. 等待客户端上线
// 客户端启动并使用 API Key 连接到服务器

// 3. 查看客户端状态
const status = await axios.get(`/admin/clients/${client.data.data.id}`, {
  headers: { 'Authorization': 'Bearer {token}' }
})
console.log('连接状态:', status.data.data.connectionStatus)
console.log('当前并发:', status.data.data.currentConcurrency)

// 4. 通过客户端添加 Claude 账户
const account = await axios.post(`/admin/clients/${client.data.data.id}/claude-accounts`, {
  name: 'Client Claude Account',
  claudeAiOauth: {
    accessToken: '...',
    refreshToken: '...'
  }
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 5. 查看客户端所有账户
const accounts = await axios.get(`/admin/clients/${client.data.data.id}/accounts`, {
  headers: { 'Authorization': 'Bearer {token}' }
})
console.log('客户端账户数:', accounts.data.data.accounts.length)
```

### 场景 2: Webhook 多平台通知配置

```javascript
// 1. 添加 Slack 通知
await axios.post('/webhook/platforms', {
  name: 'Slack Production',
  type: 'slack',
  url: 'https://hooks.slack.com/services/...',
  enabled: true,
  events: ['accountError', 'costAlert']
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 2. 添加 Bark 推送
await axios.post('/webhook/platforms', {
  name: 'Bark推送',
  type: 'bark',
  deviceKey: 'your_device_key',
  serverUrl: 'https://api.day.app',
  level: 'active',
  sound: 'bell',
  enabled: true,
  events: ['apiKeyCreated', 'accountError']
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 3. 测试 Webhook 连通性
await axios.post('/webhook/test', {
  type: 'slack',
  url: 'https://hooks.slack.com/services/...'
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 4. 手动触发测试通知
await axios.post('/webhook/test-notification', {
  type: 'test',
  message: '测试通知功能'
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

### 场景 3: 使用统一 OpenAI 格式访问多平台

```javascript
// 使用 OpenAI 格式调用 Claude
const claudeResponse = await axios.post('/openai/claude/v1/chat/completions', {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello!' }]
}, {
  headers: { 'x-api-key': 'cr_...' }
})

// 使用 OpenAI 格式调用 Gemini
const geminiResponse = await axios.post('/openai/gemini/v1/chat/completions', {
  model: 'gemini-2.5-pro',
  messages: [{ role: 'user', content: 'Hello!' }]
}, {
  headers: { 'x-api-key': 'cr_...' }
})

// 使用 OpenAI 格式调用 Azure OpenAI
const azureResponse = await axios.post('/azure/chat/completions', {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }]
}, {
  headers: { 'x-api-key': 'cr_...' }
})

// 所有响应都使用统一的 OpenAI 格式
console.log('Claude:', claudeResponse.data.choices[0].message.content)
console.log('Gemini:', geminiResponse.data.choices[0].message.content)
console.log('Azure:', azureResponse.data.choices[0].message.content)
```

### 场景 4: 数据迁移到新服务器

```javascript
// 1. 从旧服务器导出数据
const exportData = await axios.get('https://old-server.com/admin/sync/export-accounts?include_secrets=true', {
  headers: { 'Authorization': 'Bearer {old_token}' }
})

// 2. 保存导出数据到安全位置
fs.writeFileSync('migration-data.json', JSON.stringify(exportData.data, null, 2))

// 3. 在新服务器上导入账户
// (需要使用对应的账户创建 API 手动导入,因为需要重新加密敏感数据)
for (const account of exportData.data.data.claudeAccounts) {
  await axios.post('https://new-server.com/admin/claude-accounts', {
    name: account.name,
    claudeAiOauth: {
      accessToken: account.credentials.access_token,
      refreshToken: account.credentials.refresh_token,
      expiresAt: account.credentials.expires_at
    },
    proxy: account.proxy
  }, {
    headers: { 'Authorization': 'Bearer {new_token}' }
  })
}
```

---

## 12. 完整端点清单

### WebSocket 客户端管理 (~70 endpoints)
- ✅ `GET /admin/supported-clients` - 获取支持的客户端类型
- ✅ `GET /admin/clients` - 获取客户端列表
- ✅ `POST /admin/clients` - 创建客户端
- ✅ `GET /admin/clients/:id` - 获取客户端详情
- ✅ `PUT /admin/clients/:id` - 更新客户端
- ✅ `PUT /admin/clients/:id/toggle-schedulable` - 切换可调度
- ✅ `DELETE /admin/clients/:id` - 删除客户端
- ✅ `POST /admin/clients/:id/disconnect` - 断开连接
- ✅ `POST /admin/clients/:clientId/config` - 下发配置
- ✅ `GET /admin/clients/:clientId/config` - 获取配置
- ✅ `GET /admin/clients/:clientId/config/history` - 配置历史
- ✅ `GET /admin/clients/:clientId/system-health` - 系统健康
- ✅ `GET /admin/clients/:clientId/accounts` - 获取所有账户
- ✅ `POST /admin/clients/:clientId/accounts` - 账户操作
- ✅ `POST /admin/clients/:clientId/generate-oauth-url` - 生成OAuth URL
- ✅ `POST /admin/clients/:clientId/exchange-oauth-code` - 交换OAuth码
- ✅ 动态账户路由 (10种账户类型 × ~6个操作 = ~60 endpoints)

### Webhook 管理 (8 endpoints)
- ✅ `GET /webhook/config` - 获取配置
- ✅ `POST /webhook/config` - 保存配置
- ✅ `POST /webhook/platforms` - 添加平台
- ✅ `PUT /webhook/platforms/:id` - 更新平台
- ✅ `DELETE /webhook/platforms/:id` - 删除平台
- ✅ `POST /webhook/platforms/:id/toggle` - 切换状态
- ✅ `POST /webhook/test` - 测试连通性
- ✅ `POST /webhook/test-notification` - 测试通知

### 标准 Gemini API (14 endpoints)
- ✅ `POST /v1beta/models/:modelName:generateContent`
- ✅ `POST /v1beta/models/:modelName:streamGenerateContent`
- ✅ `POST /v1beta/models/:modelName:countTokens`
- ✅ `POST /v1beta/models/:modelName:loadCodeAssist`
- ✅ `POST /v1beta/models/:modelName:onboardUser`
- ✅ `POST /v1/models/:modelName:generateContent`
- ✅ `POST /v1/models/:modelName:streamGenerateContent`
- ✅ `POST /v1/models/:modelName:countTokens`
- ✅ `POST /v1internal:generateContent`
- ✅ `POST /v1internal:streamGenerateContent`
- ✅ `POST /v1internal:countTokens`
- ✅ `POST /v1internal:loadCodeAssist`
- ✅ `POST /v1internal:onboardUser`
- ✅ `GET /v1beta/models`, `GET /v1/models`, `GET /v1beta/models/:modelName`, `GET /v1/models/:modelName`

### Azure OpenAI (5 endpoints)
- ✅ `GET /health` - 健康检查
- ✅ `GET /models` - 模型列表
- ✅ `POST /chat/completions` - 聊天完成
- ✅ `POST /responses` - Responses 端点
- ✅ `POST /embeddings` - Embeddings
- ✅ `GET /usage` - 使用统计

### OpenAI-Claude 转换 (4 endpoints)
- ✅ `GET /v1/models` - 模型列表
- ✅ `GET /v1/models/:model` - 模型详情
- ✅ `POST /v1/chat/completions` - 聊天完成
- ✅ `POST /v1/completions` - 传统completions

### OpenAI-Gemini 转换 (3 endpoints)
- ✅ `POST /v1/chat/completions` - 聊天完成
- ✅ `GET /v1/models` - 模型列表
- ✅ `GET /v1/models/:model` - 模型详情

### 官方 OpenAI 代理 (2 endpoints)
- ✅ `POST /v1/chat/completions` - 聊天完成
- ✅ `POST /v1/completions` - Completions

### 数据同步 (1 endpoint)
- ✅ `GET /admin/sync/export-accounts` - 导出账户数据

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
