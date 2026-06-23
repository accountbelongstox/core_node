# Claude Relay Service - API 详细参考文档

> 本文档提供 Claude Relay Service (CRS) 所有 API 的详细请求/响应格式，包含完整的数据结构示例

**版本**: 1.0
**更新日期**: 2026-01-02

---

## 📚 目录

1. [通用说明](#通用说明)
2. [认证](#认证)
3. [API 端点详细说明](#api-端点详细说明)
   - [仪表板和统计](#1-仪表板和统计)
   - [API Key 管理](#2-api-key-管理)
   - [Claude 账户管理](#3-claude-账户管理)
   - [Gemini 账户管理](#4-gemini-账户管理)
   - [其他平台账户管理](#5-其他平台账户管理)
   - [使用统计查询](#6-使用统计查询)
   - [系统管理](#7-系统管理)
4. [核心转发 API](#核心转发-api)
5. [错误响应格式](#错误响应格式)
6. [数据类型说明](#数据类型说明)

---

## 通用说明

### Base URL

```
http://your-server:3000
```

生产环境建议使用 HTTPS：

```
https://your-domain.com
```

### 通用响应格式

所有 API 响应遵循以下格式：

**成功响应**:
```json
{
  "success": true,
  "data": { /* 实际数据 */ },
  "message": "操作成功" // 可选
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "错误简述",
  "message": "详细错误信息"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 201 | 资源创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 429 | 请求过于频繁 |
| 500 | 服务器内部错误 |

---

## 认证

### 管理端认证

管理端 API 使用 JWT Token 认证。

**登录获取 Token**:

```http
POST /admin/login
Content-Type: application/json

{
  "username": "admin",
  "password": "your-password"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400,
    "admin": {
      "id": "admin-id",
      "username": "admin",
      "role": "admin"
    }
  }
}
```

**后续请求携带 Token**:

```http
GET /admin/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 客户端认证

客户端转发 API 使用 API Key 认证（通过 `x-api-key` 请求头）。

```http
POST /api/v1/messages
x-api-key: cr_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Content-Type: application/json
```

---

## API 端点详细说明

### 1. 仪表板和统计

#### 1.1 获取系统概览

获取系统的整体统计数据，包括账户数、API Key 数、使用量等。

**请求**:
```http
GET /admin/dashboard
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalApiKeys": 15,
      "activeApiKeys": 12,
      "totalAccounts": 25,
      "normalAccounts": 20,
      "abnormalAccounts": 2,
      "pausedAccounts": 3,
      "rateLimitedAccounts": 0,
      "accountsByPlatform": {
        "claude": {
          "total": 8,
          "normal": 7,
          "abnormal": 0,
          "paused": 1,
          "rateLimited": 0
        },
        "claude-console": {
          "total": 5,
          "normal": 4,
          "abnormal": 1,
          "paused": 0,
          "rateLimited": 0
        },
        "gemini": {
          "total": 6,
          "normal": 5,
          "abnormal": 0,
          "paused": 1,
          "rateLimited": 0
        },
        "bedrock": {
          "total": 2,
          "normal": 2,
          "abnormal": 0,
          "paused": 0,
          "rateLimited": 0
        },
        "openai": {
          "total": 2,
          "normal": 1,
          "abnormal": 1,
          "paused": 0,
          "rateLimited": 0
        },
        "ccr": {
          "total": 1,
          "normal": 1,
          "abnormal": 0,
          "paused": 0,
          "rateLimited": 0
        },
        "openai-responses": {
          "total": 1,
          "normal": 0,
          "abnormal": 0,
          "paused": 1,
          "rateLimited": 0
        },
        "droid": {
          "total": 0,
          "normal": 0,
          "abnormal": 0,
          "paused": 0,
          "rateLimited": 0
        }
      },
      "totalTokensUsed": 1250000,
      "totalRequestsUsed": 3500,
      "totalInputTokensUsed": 800000,
      "totalOutputTokensUsed": 400000,
      "totalCacheCreateTokensUsed": 30000,
      "totalCacheReadTokensUsed": 20000,
      "totalAllTokensUsed": 1250000
    },
    "recentActivity": {
      "apiKeysCreatedToday": 2,
      "requestsToday": 450,
      "tokensToday": 125000,
      "inputTokensToday": 80000,
      "outputTokensToday": 40000,
      "cacheCreateTokensToday": 3000,
      "cacheReadTokensToday": 2000
    },
    "systemAverages": {
      "rpm": 25.5,
      "tpm": 8500.2
    },
    "realtimeMetrics": {
      "rpm": 30.2,
      "tpm": 9500.5,
      "windowMinutes": 5,
      "isHistorical": false
    },
    "systemHealth": {
      "redisConnected": true,
      "claudeAccountsHealthy": true,
      "geminiAccountsHealthy": true,
      "droidAccountsHealthy": false,
      "uptime": 864532.5
    },
    "systemTimezone": 8
  }
}
```

**字段说明**:

| 字段路径 | 类型 | 说明 |
|---------|------|------|
| `overview.totalApiKeys` | Number | API Key 总数 |
| `overview.activeApiKeys` | Number | 活跃的 API Key 数量 |
| `overview.totalAccounts` | Number | 所有平台账户总数 |
| `overview.normalAccounts` | Number | 正常状态账户数 |
| `overview.abnormalAccounts` | Number | 异常状态账户数（blocked/unauthorized） |
| `overview.pausedAccounts` | Number | 暂停调度的账户数 |
| `overview.rateLimitedAccounts` | Number | 当前被限流的账户数 |
| `overview.accountsByPlatform` | Object | 按平台分类的账户统计 |
| `overview.totalTokensUsed` | Number | 累计使用的 Token 总数 |
| `overview.totalRequestsUsed` | Number | 累计请求总数 |
| `recentActivity.requestsToday` | Number | 今日请求数 |
| `recentActivity.tokensToday` | Number | 今日 Token 使用量 |
| `systemAverages.rpm` | Number | 系统平均每分钟请求数 |
| `systemAverages.tpm` | Number | 系统平均每分钟 Token 数 |
| `realtimeMetrics.rpm` | Number | 实时每分钟请求数（基于配置的时间窗口） |
| `realtimeMetrics.windowMinutes` | Number | 统计窗口大小（分钟） |
| `systemHealth.redisConnected` | Boolean | Redis 连接状态 |
| `systemHealth.uptime` | Number | 系统运行时间（秒） |

---

#### 1.2 获取系统指标

获取系统运行状态和性能指标。

**请求**:
```http
GET /metrics
```

**响应**:
```json
{
  "success": true,
  "data": {
    "uptime": 864532.5,
    "memory": {
      "used": 256000000,
      "total": 512000000,
      "percentage": 50.0
    },
    "usage": {
      "totalRequests": 3500,
      "totalTokens": 1250000,
      "rpm": 30.2,
      "tpm": 9500.5
    },
    "accounts": {
      "total": 25,
      "active": 20
    },
    "apiKeys": {
      "total": 15,
      "active": 12
    },
    "version": "1.0.0",
    "timestamp": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 2. API Key 管理

#### 2.1 获取所有 API Keys

支持分页、搜索、筛选和排序。

**请求**:
```http
GET /admin/api-keys?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc&search=test&isActive=true
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | Number | 1 | 页码 |
| `pageSize` | Number | 20 | 每页数量 |
| `search` | String | - | 搜索关键词（支持名称、ID） |
| `searchMode` | String | apiKey | 搜索模式（apiKey/tag） |
| `tag` | String | - | 标签筛选 |
| `isActive` | String | - | 活跃状态筛选（true/false） |
| `models` | String | - | 模型筛选（逗号分隔） |
| `sortBy` | String | createdAt | 排序字段 |
| `sortOrder` | String | desc | 排序方向（asc/desc） |
| `costTimeRange` | String | 7days | 成本排序时间范围（7days/30days/custom） |

**响应**:
```json
{
  "success": true,
  "data": {
    "keys": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Production API Key",
        "description": "用于生产环境的 API Key",
        "apiKeyPrefix": "cr_1234",
        "isActive": true,
        "permissions": ["claude", "gemini"],
        "concurrencyLimit": 5,
        "rateLimitWindow": 60,
        "rateLimitRequests": 100,
        "rateLimitCost": 1.5,
        "enableModelRestriction": true,
        "restrictedModels": ["claude-opus-4"],
        "enableClientRestriction": true,
        "allowedClients": ["claude_code", "gemini_cli"],
        "dailyCostLimit": 10.0,
        "totalCostLimit": 100.0,
        "weeklyOpusCostLimit": 20.0,
        "tags": ["production", "team-a"],
        "expirationMode": "fixed",
        "isActivated": true,
        "activatedAt": "2026-01-01T00:00:00.000Z",
        "createdAt": "2026-01-01T00:00:00.000Z",
        "lastUsedAt": "2026-01-02T10:30:00.000Z",
        "expiresAt": "2026-12-31T23:59:59.000Z",
        "createdBy": "admin",
        "userId": "user-123",
        "userUsername": "john.doe",
        "usage": {
          "total": {
            "requests": 1500,
            "inputTokens": 500000,
            "outputTokens": 200000,
            "cacheCreateTokens": 15000,
            "cacheReadTokens": 10000,
            "allTokens": 725000
          },
          "daily": {
            "requests": 150,
            "inputTokens": 50000,
            "outputTokens": 20000,
            "cacheCreateTokens": 1500,
            "cacheReadTokens": 1000,
            "allTokens": 72500
          }
        },
        "cost": {
          "total": 45.50,
          "daily": 4.25,
          "weekly": 28.75
        },
        "concurrentRequests": 2
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalPages": 3,
      "totalKeys": 55,
      "hasMore": true
    }
  }
}
```

**字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String (UUID) | API Key 唯一标识符 |
| `name` | String | API Key 名称 |
| `description` | String | 描述信息 |
| `apiKeyPrefix` | String | API Key 前缀（仅显示前几位） |
| `isActive` | Boolean | 是否激活 |
| `permissions` | String[] | 权限列表（空数组表示全部服务） |
| `concurrencyLimit` | Number | 并发限制（0 表示无限制） |
| `rateLimitWindow` | Number | 速率限制时间窗口（秒，0 表示无限制） |
| `rateLimitRequests` | Number | 时间窗口内最大请求数 |
| `rateLimitCost` | Number | 时间窗口内最大成本（美元） |
| `enableModelRestriction` | Boolean | 是否启用模型限制 |
| `restrictedModels` | String[] | 禁止访问的模型列表（黑名单） |
| `enableClientRestriction` | Boolean | 是否启用客户端限制 |
| `allowedClients` | String[] | 允许的客户端列表（如 `claude_code`） |
| `dailyCostLimit` | Number | 每日成本限制（美元） |
| `totalCostLimit` | Number | 总成本限制（美元） |
| `weeklyOpusCostLimit` | Number | 每周 Opus 成本限制（美元） |
| `tags` | String[] | 标签列表 |
| `expirationMode` | String | 过期模式（fixed/activation） |
| `isActivated` | Boolean | 是否已激活（activation 模式下有效） |
| `activatedAt` | String (ISO 8601) | 激活时间 |
| `createdAt` | String (ISO 8601) | 创建时间 |
| `lastUsedAt` | String (ISO 8601) | 最后使用时间 |
| `expiresAt` | String (ISO 8601) | 过期时间 |
| `createdBy` | String | 创建者 |
| `userId` | String | 关联的用户 ID |
| `userUsername` | String | 关联的用户名 |
| `usage.total` | Object | 累计使用统计 |
| `usage.daily` | Object | 今日使用统计 |
| `cost.total` | Number | 累计成本（美元） |
| `cost.daily` | Number | 今日成本（美元） |
| `cost.weekly` | Number | 本周成本（美元） |
| `concurrentRequests` | Number | 当前并发请求数 |

---

#### 2.2 创建 API Key

创建一个新的 API Key。

**请求**:
```http
POST /admin/api-keys
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Test API Key",
  "description": "用于测试的 API Key",
  "permissions": ["claude", "gemini"],
  "concurrencyLimit": 5,
  "rateLimitWindow": 60,
  "rateLimitRequests": 100,
  "rateLimitCost": 1.5,
  "enableModelRestriction": true,
  "restrictedModels": ["claude-opus-4"],
  "enableClientRestriction": true,
  "allowedClients": ["claude_code"],
  "dailyCostLimit": 10.0,
  "totalCostLimit": 100.0,
  "weeklyOpusCostLimit": 20.0,
  "tags": ["test", "development"],
  "expirationMode": "fixed",
  "expiresAt": "2026-12-31T23:59:59Z",
  "userId": "user-123"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | String | 是 | - | API Key 名称 |
| `description` | String | 否 | "" | 描述信息 |
| `permissions` | String[] | 否 | [] | 权限列表（空数组 = 全部服务）<br>可选值: `claude`, `gemini`, `openai`, `droid` |
| `concurrencyLimit` | Number | 否 | 0 | 并发限制（0 = 无限制） |
| `rateLimitWindow` | Number | 否 | 0 | 速率限制窗口（秒，0 = 无限制） |
| `rateLimitRequests` | Number | 否 | 0 | 窗口内最大请求数 |
| `rateLimitCost` | Number | 否 | 0 | 窗口内最大成本（美元） |
| `enableModelRestriction` | Boolean | 否 | false | 启用模型黑名单 |
| `restrictedModels` | String[] | 否 | [] | 禁止的模型列表 |
| `enableClientRestriction` | Boolean | 否 | false | 启用客户端限制 |
| `allowedClients` | String[] | 否 | [] | 允许的客户端列表<br>预定义值: `claude_code`, `gemini_cli` |
| `dailyCostLimit` | Number | 否 | 0 | 每日成本限制（美元，0 = 无限制） |
| `totalCostLimit` | Number | 否 | 0 | 总成本限制（美元，0 = 无限制） |
| `weeklyOpusCostLimit` | Number | 否 | 0 | 每周 Opus 成本限制（美元，0 = 无限制） |
| `tags` | String[] | 否 | [] | 标签列表 |
| `expirationMode` | String | 否 | "fixed" | 过期模式（`fixed`/`activation`） |
| `expiresAt` | String (ISO 8601) | 否 | null | 过期时间（fixed 模式） |
| `activationDays` | Number | 否 | 0 | 激活后有效天数（activation 模式） |
| `activationUnit` | String | 否 | "days" | 激活时间单位（`hours`/`days`） |
| `userId` | String | 否 | "" | 关联的用户 ID |
| `icon` | String | 否 | "" | 图标（Base64 编码） |

**并发请求排队配置（可选）**:

```json
{
  "concurrentRequestQueueEnabled": true,
  "concurrentRequestQueueMaxSize": 10,
  "concurrentRequestQueueTimeoutMs": 10000
}
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `concurrentRequestQueueEnabled` | Boolean | false | 启用并发请求排队 |
| `concurrentRequestQueueMaxSize` | Number | 3 | 最大排队数 |
| `concurrentRequestQueueTimeoutMs` | Number | 10000 | 排队超时时间（毫秒） |

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "apiKey": "cr_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "name": "Test API Key",
    "description": "用于测试的 API Key",
    "permissions": ["claude", "gemini"],
    "isActive": true,
    "createdAt": "2026-01-02T10:30:00.000Z",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "concurrencyLimit": 5,
    "rateLimitWindow": 60,
    "rateLimitRequests": 100,
    "rateLimitCost": 1.5,
    "enableModelRestriction": true,
    "restrictedModels": ["claude-opus-4"],
    "enableClientRestriction": true,
    "allowedClients": ["claude_code"],
    "dailyCostLimit": 10.0,
    "totalCostLimit": 100.0,
    "tags": ["test", "development"]
  },
  "message": "⚠️ 请立即保存完整的 API Key，它只会显示一次！"
}
```

**重要提示**:
- `apiKey` 字段包含完整的 API Key，**只在创建时返回一次**
- 后续查询只会返回 `apiKeyPrefix`（前几位）
- 请妥善保管完整的 API Key

---

#### 2.3 更新 API Key

更新 API Key 的配置（不包括 Key 本身）。

**请求**:
```http
PUT /admin/api-keys/{keyId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated API Key",
  "description": "更新后的描述",
  "isActive": true,
  "permissions": ["claude"],
  "concurrencyLimit": 10,
  "dailyCostLimit": 20.0,
  "tags": ["production"]
}
```

**请求体字段**:

支持更新的字段与创建时相同，除了 `apiKey` 本身不能修改。

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Updated API Key",
    "description": "更新后的描述",
    "isActive": true,
    "permissions": ["claude"],
    "concurrencyLimit": 10,
    "dailyCostLimit": 20.0,
    "tags": ["production"],
    "updatedAt": "2026-01-02T11:00:00.000Z"
  },
  "message": "API Key updated successfully"
}
```

---

#### 2.4 删除 API Key

删除指定的 API Key。

**请求**:
```http
DELETE /admin/api-keys/{keyId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "API Key deleted successfully"
}
```

---

#### 2.5 获取 API Key 使用详情

获取指定 API Key 的详细使用统计。

**请求**:
```http
GET /admin/api-keys/{keyId}/usage?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startDate` | String | 否 | 开始日期（YYYY-MM-DD） |
| `endDate` | String | 否 | 结束日期（YYYY-MM-DD） |

**响应**:
```json
{
  "success": true,
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "keyName": "Production API Key",
    "usage": {
      "total": {
        "requests": 1500,
        "inputTokens": 500000,
        "outputTokens": 200000,
        "cacheCreateTokens": 15000,
        "cacheReadTokens": 10000,
        "allTokens": 725000
      },
      "daily": {
        "requests": 150,
        "inputTokens": 50000,
        "outputTokens": 20000,
        "cacheCreateTokens": 1500,
        "cacheReadTokens": 1000,
        "allTokens": 72500
      },
      "byModel": [
        {
          "model": "claude-sonnet-4-5",
          "requests": 800,
          "inputTokens": 300000,
          "outputTokens": 120000,
          "cost": 25.50
        },
        {
          "model": "gemini-2.5-pro",
          "requests": 700,
          "inputTokens": 200000,
          "outputTokens": 80000,
          "cost": 20.00
        }
      ],
      "byDate": [
        {
          "date": "2026-01-01",
          "requests": 50,
          "tokens": 24000,
          "cost": 1.50
        },
        {
          "date": "2026-01-02",
          "requests": 100,
          "tokens": 48500,
          "cost": 2.75
        }
      ]
    },
    "cost": {
      "total": 45.50,
      "daily": 4.25,
      "weekly": 28.75,
      "monthly": 45.50,
      "breakdown": {
        "input": 20.00,
        "output": 20.00,
        "cacheCreate": 3.00,
        "cacheRead": 2.50
      }
    },
    "limits": {
      "dailyCostLimit": 10.0,
      "dailyCostRemaining": 5.75,
      "totalCostLimit": 100.0,
      "totalCostRemaining": 54.50,
      "rateLimitWindow": 60,
      "rateLimitRequests": 100,
      "rateLimitCost": 1.5
    },
    "period": {
      "startDate": "2026-01-01",
      "endDate": "2026-01-31"
    }
  }
}
```

---

#### 2.6 重置 API Key 使用统计

重置指定 API Key 的使用统计（不影响实际账户余额）。

**请求**:
```http
POST /admin/api-keys/{keyId}/reset-usage
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "API Key usage statistics reset successfully"
}
```

---

### 3. Claude 账户管理

#### 3.1 OAuth 授权流程

**步骤 1: 生成授权 URL**

```http
POST /admin/claude-accounts/generate-auth-url
Authorization: Bearer {token}
Content-Type: application/json

{
  "proxy": {
    "type": "socks5",
    "host": "proxy.example.com",
    "port": 1080,
    "username": "user",
    "password": "pass"
  }
}
```

**请求体字段（可选）**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `proxy.type` | String | 代理类型（`socks5`/`http`） |
| `proxy.host` | String | 代理服务器地址 |
| `proxy.port` | Number | 代理端口 |
| `proxy.username` | String | 代理用户名（可选） |
| `proxy.password` | String | 代理密码（可选） |

**响应**:
```json
{
  "success": true,
  "data": {
    "authUrl": "https://claude.ai/oauth/authorize?client_id=...&code_challenge=...&state=...",
    "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
    "instructions": [
      "1. 复制上面的链接到浏览器中打开",
      "2. 登录您的 Anthropic 账户",
      "3. 同意应用权限",
      "4. 复制浏览器地址栏中的完整 URL",
      "5. 在添加账户表单中粘贴完整的回调 URL 和授权码"
    ]
  }
}
```

**步骤 2: 交换授权码获取 Token**

用户在浏览器中完成授权后，会被重定向到回调 URL，URL 中包含 `code` 参数。

```http
POST /admin/claude-accounts/exchange-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "authorizationCode": "auth_code_from_callback_url",
  "callbackUrl": "https://redirect.example.com?code=auth_code_from_callback_url&state=..."
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sessionId` | String | 是 | 步骤 1 返回的会话 ID |
| `authorizationCode` | String | 二选一 | 授权码（从回调 URL 提取） |
| `callbackUrl` | String | 二选一 | 完整的回调 URL（系统自动提取授权码） |

**响应**:
```json
{
  "success": true,
  "data": {
    "claudeAiOauth": {
      "accessToken": "encrypted_access_token",
      "refreshToken": "encrypted_refresh_token",
      "expiresAt": "2026-01-02T11:30:00.000Z",
      "scopes": ["user:read", "organization:read"]
    }
  }
}
```

**步骤 3: 创建账户**

使用步骤 2 获取的 OAuth 数据创建账户。

```http
POST /admin/claude-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "My Claude Account",
  "description": "用于生产环境",
  "claudeAiOauth": {
    "accessToken": "encrypted_access_token",
    "refreshToken": "encrypted_refresh_token",
    "expiresAt": "2026-01-02T11:30:00.000Z",
    "scopes": ["user:read", "organization:read"]
  },
  "proxy": {
    "type": "socks5",
    "host": "proxy.example.com",
    "port": 1080,
    "username": "user",
    "password": "pass"
  },
  "isActive": true,
  "schedulable": true,
  "priority": 1
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `name` | String | 是 | - | 账户名称 |
| `description` | String | 否 | "" | 描述信息 |
| `claudeAiOauth` | Object | 是 | - | OAuth 数据（从步骤 2 获取） |
| `proxy` | Object | 否 | null | 代理配置（可选） |
| `isActive` | Boolean | 否 | true | 是否激活 |
| `schedulable` | Boolean | 否 | true | 是否允许调度 |
| `priority` | Number | 否 | 0 | 优先级（数字越大优先级越高） |

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "claude-acc-123",
    "name": "My Claude Account",
    "description": "用于生产环境",
    "email": "user@example.com",
    "accountType": "claude-official",
    "status": "active",
    "isActive": true,
    "schedulable": true,
    "priority": 1,
    "proxy": {
      "type": "socks5",
      "host": "proxy.example.com",
      "port": 1080,
      "hasAuth": true
    },
    "tokenExpiry": "2026-01-02T11:30:00.000Z",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "lastUsedAt": null,
    "usage": {
      "total": {
        "requests": 0,
        "tokens": 0
      },
      "daily": {
        "requests": 0,
        "tokens": 0
      }
    }
  },
  "message": "Claude account created successfully"
}
```

---

#### 3.2 获取所有 Claude 账户

```http
GET /admin/claude-accounts
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "claude-acc-123",
      "name": "My Claude Account",
      "email": "user@example.com",
      "accountType": "claude-official",
      "status": "active",
      "isActive": true,
      "schedulable": true,
      "priority": 1,
      "rateLimitStatus": {
        "isRateLimited": false,
        "resetAt": null
      },
      "proxy": {
        "type": "socks5",
        "host": "proxy.example.com",
        "port": 1080,
        "hasAuth": true
      },
      "tokenExpiry": "2026-01-02T11:30:00.000Z",
      "createdAt": "2026-01-02T10:30:00.000Z",
      "lastUsedAt": "2026-01-02T10:45:00.000Z",
      "usage": {
        "total": {
          "requests": 150,
          "tokens": 50000
        },
        "daily": {
          "requests": 15,
          "tokens": 5000
        }
      },
      "errorMessage": null
    }
  ]
}
```

**账户状态说明**:

| `status` 值 | 说明 |
|------------|------|
| `active` | 正常可用 |
| `error` | 发生错误（查看 `errorMessage`） |
| `blocked` | 账户被封禁 |
| `unauthorized` | 认证失败 |
| `overload` | 账户过载（Claude 529 错误） |

---

#### 3.3 更新 Claude 账户

```http
PUT /admin/claude-accounts/{accountId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Account Name",
  "description": "更新后的描述",
  "isActive": true,
  "schedulable": true,
  "priority": 2,
  "proxy": {
    "type": "http",
    "host": "new-proxy.example.com",
    "port": 8080
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "claude-acc-123",
    "name": "Updated Account Name",
    "description": "更新后的描述",
    "isActive": true,
    "schedulable": true,
    "priority": 2,
    "updatedAt": "2026-01-02T11:00:00.000Z"
  },
  "message": "Account updated successfully"
}
```

---

#### 3.4 删除 Claude 账户

```http
DELETE /admin/claude-accounts/{accountId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Claude account deleted successfully"
}
```

---

#### 3.5 刷新 OAuth Token

手动刷新账户的 OAuth Token（通常系统会自动刷新）。

```http
POST /admin/claude-accounts/{accountId}/refresh-token
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-acc-123",
    "tokenExpiry": "2026-01-02T12:30:00.000Z",
    "refreshedAt": "2026-01-02T11:30:00.000Z"
  },
  "message": "Token refreshed successfully"
}
```

---

### 4. Gemini 账户管理

Gemini 账户管理与 Claude 账户类似，也使用 OAuth 流程。

#### 4.1 生成 Google OAuth URL

```http
POST /admin/gemini-accounts/generate-auth-url
Authorization: Bearer {token}
Content-Type: application/json

{
  "proxy": {
    "type": "socks5",
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
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&scope=...&redirect_uri=...",
    "sessionId": "gemini-session-123",
    "instructions": [
      "1. 复制上面的链接到浏览器中打开",
      "2. 登录您的 Google 账户",
      "3. 同意应用权限",
      "4. 复制浏览器返回的授权码"
    ]
  }
}
```

#### 4.2 交换授权码

```http
POST /admin/gemini-accounts/exchange-code
Authorization: Bearer {token}
Content-Type: application/json

{
  "sessionId": "gemini-session-123",
  "authorizationCode": "google_auth_code"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "googleOauth": {
      "accessToken": "encrypted_access_token",
      "refreshToken": "encrypted_refresh_token",
      "expiresAt": "2026-01-02T11:30:00.000Z",
      "scopes": ["https://www.googleapis.com/auth/generative-language"]
    }
  }
}
```

#### 4.3 创建 Gemini 账户

```http
POST /admin/gemini-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "My Gemini Account",
  "description": "Gemini 生产账户",
  "googleOauth": {
    "accessToken": "encrypted_access_token",
    "refreshToken": "encrypted_refresh_token",
    "expiresAt": "2026-01-02T11:30:00.000Z",
    "scopes": ["https://www.googleapis.com/auth/generative-language"]
  },
  "proxy": {
    "type": "socks5",
    "host": "proxy.example.com",
    "port": 1080
  },
  "isActive": true,
  "schedulable": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "gemini-acc-456",
    "name": "My Gemini Account",
    "email": "user@gmail.com",
    "accountType": "gemini",
    "status": "active",
    "isActive": true,
    "schedulable": true,
    "tokenExpiry": "2026-01-02T11:30:00.000Z",
    "createdAt": "2026-01-02T10:30:00.000Z"
  },
  "message": "Gemini account created successfully"
}
```

---

### 5. 其他平台账户管理

#### 5.1 OpenAI Responses (Codex) 账户

**创建账户**:

```http
POST /admin/openai-responses-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Codex Account",
  "description": "OpenAI Responses 账户",
  "apiKey": "sk-responses-...",
  "isActive": true,
  "schedulable": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "responses-acc-789",
    "name": "Codex Account",
    "accountType": "openai-responses",
    "status": "active",
    "isActive": true,
    "schedulable": true,
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

#### 5.2 AWS Bedrock 账户

**创建账户**:

```http
POST /admin/bedrock-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Bedrock Account",
  "description": "AWS Bedrock 生产账户",
  "accessKeyId": "AKIAIOSFODNN7EXAMPLE",
  "secretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  "region": "us-east-1",
  "isActive": true,
  "schedulable": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "bedrock-acc-101",
    "name": "Bedrock Account",
    "accountType": "bedrock",
    "region": "us-east-1",
    "status": "active",
    "isActive": true,
    "schedulable": true,
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

#### 5.3 Azure OpenAI 账户

**创建账户**:

```http
POST /admin/azure-openai-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Azure OpenAI Account",
  "description": "Azure OpenAI 账户",
  "apiKey": "azure-api-key-...",
  "endpoint": "https://your-resource.openai.azure.com",
  "deploymentName": "gpt-4",
  "isActive": true,
  "schedulable": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "azure-acc-202",
    "name": "Azure OpenAI Account",
    "accountType": "azure-openai",
    "endpoint": "https://your-resource.openai.azure.com",
    "deploymentName": "gpt-4",
    "status": "active",
    "isActive": true,
    "schedulable": true,
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

#### 5.4 Droid (Factory.ai) 账户

**创建账户**:

```http
POST /admin/droid-accounts
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Droid Account",
  "description": "Factory.ai 账户",
  "apiKey": "droid-api-key-...",
  "isActive": true,
  "schedulable": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "droid-acc-303",
    "name": "Droid Account",
    "accountType": "droid",
    "status": "active",
    "isActive": true,
    "schedulable": true,
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 6. 使用统计查询

#### 6.1 获取模型使用统计

获取全局按模型统计的使用数据和成本。

```http
GET /admin/model-stats?period=daily&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | daily | 统计周期（`daily`/`monthly`） |
| `startDate` | String | - | 开始日期（YYYY-MM-DD，自定义范围） |
| `endDate` | String | - | 结束日期（YYYY-MM-DD，自定义范围） |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "model": "claude-sonnet-4-5",
      "period": "custom",
      "requests": 2500,
      "inputTokens": 800000,
      "outputTokens": 320000,
      "cacheCreateTokens": 40000,
      "cacheReadTokens": 20000,
      "allTokens": 1180000,
      "usage": {
        "requests": 2500,
        "inputTokens": 800000,
        "outputTokens": 320000,
        "cacheCreateTokens": 40000,
        "cacheReadTokens": 20000,
        "totalTokens": 1180000
      },
      "costs": {
        "input": 24.00,
        "output": 48.00,
        "cacheCreate": 3.00,
        "cacheRead": 0.30,
        "total": 75.30
      },
      "formatted": {
        "input": "$24.00",
        "output": "$48.00",
        "cacheCreate": "$3.00",
        "cacheRead": "$0.30",
        "total": "$75.30"
      },
      "pricing": {
        "input": 0.000030,
        "output": 0.000150,
        "cacheCreate": 0.000075,
        "cacheRead": 0.000015
      }
    },
    {
      "model": "gemini-2.5-pro",
      "period": "custom",
      "requests": 1800,
      "inputTokens": 600000,
      "outputTokens": 240000,
      "cacheCreateTokens": 0,
      "cacheReadTokens": 0,
      "allTokens": 840000,
      "usage": {
        "requests": 1800,
        "inputTokens": 600000,
        "outputTokens": 240000,
        "cacheCreateTokens": 0,
        "cacheReadTokens": 0,
        "totalTokens": 840000
      },
      "costs": {
        "input": 15.00,
        "output": 30.00,
        "cacheCreate": 0.00,
        "cacheRead": 0.00,
        "total": 45.00
      },
      "formatted": {
        "input": "$15.00",
        "output": "$30.00",
        "total": "$45.00"
      },
      "pricing": {
        "input": 0.000025,
        "output": 0.000125
      }
    }
  ]
}
```

---

#### 6.2 获取账户使用统计

获取所有账户的使用统计。

```http
GET /admin/accounts/usage-stats
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "accountId": "claude-acc-123",
      "accountName": "My Claude Account",
      "accountType": "claude-official",
      "daily": {
        "requests": 150,
        "inputTokens": 50000,
        "outputTokens": 20000,
        "cacheCreateTokens": 2000,
        "cacheReadTokens": 1000,
        "allTokens": 73000
      },
      "total": {
        "requests": 1500,
        "inputTokens": 500000,
        "outputTokens": 200000,
        "cacheCreateTokens": 20000,
        "cacheReadTokens": 10000,
        "allTokens": 730000
      }
    }
  ],
  "summary": {
    "totalAccounts": 25,
    "activeToday": 18,
    "totalDailyTokens": 1314000,
    "totalDailyRequests": 2700
  },
  "timestamp": "2026-01-02T10:30:00.000Z"
}
```

---

### 7. 系统管理

#### 7.1 健康检查

检查系统各组件的健康状态。

```http
GET /health
```

**响应**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 864532.5,
  "timestamp": "2026-01-02T10:30:00.000Z",
  "components": {
    "redis": {
      "status": "healthy",
      "connected": true,
      "ping": 1.2
    },
    "logger": {
      "status": "healthy"
    },
    "memory": {
      "status": "healthy",
      "used": 256000000,
      "total": 512000000,
      "percentage": 50.0
    }
  },
  "config": {
    "environment": "production",
    "timezone": 8,
    "datastoreProvider": "redis"
  }
}
```

---

#### 7.2 清理过期数据

手动触发系统清理任务。

```http
POST /admin/cleanup
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Cleanup completed",
  "data": {
    "expiredKeysRemoved": 5,
    "errorAccountsReset": 2
  }
}
```

---

#### 7.3 系统日志查看

实时查看系统日志（支持过滤）。

```http
GET /admin/logs?level=error&limit=100
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `level` | String | - | 日志级别（`debug`/`info`/`warn`/`error`） |
| `limit` | Number | 100 | 返回日志条数 |
| `startTime` | String | - | 开始时间（ISO 8601） |
| `endTime` | String | - | 结束时间（ISO 8601） |

**响应**:
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "level": "error",
        "message": "Failed to refresh token for account claude-acc-123",
        "timestamp": "2026-01-02T10:25:00.000Z",
        "metadata": {
          "accountId": "claude-acc-123",
          "error": "Refresh token expired"
        }
      },
      {
        "level": "warn",
        "message": "API Key approaching daily cost limit",
        "timestamp": "2026-01-02T10:20:00.000Z",
        "metadata": {
          "keyId": "550e8400-e29b-41d4-a716-446655440000",
          "currentCost": 9.5,
          "limit": 10.0
        }
      }
    ],
    "total": 2,
    "filters": {
      "level": "error",
      "limit": 100
    }
  }
}
```

---

## 核心转发 API

这些是客户端（如 Claude Code、Gemini CLI）实际调用的 API。

### Claude 消息 API

**请求**:
```http
POST /api/v1/messages
x-api-key: cr_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
anthropic-version: 2023-06-01
Content-Type: application/json

{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 4096,
  "messages": [
    {
      "role": "user",
      "content": "Hello, Claude!"
    }
  ],
  "stream": false
}
```

**成功响应（非流式）**:
```json
{
  "id": "msg_01XYZ...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you today?"
    }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "stop_reason": "end_turn",
  "stop_sequence": null,
  "usage": {
    "input_tokens": 12,
    "output_tokens": 25,
    "cache_creation_input_tokens": 0,
    "cache_read_input_tokens": 0
  }
}
```

**流式响应**:

当 `stream: true` 时，响应为 Server-Sent Events (SSE) 格式：

```
event: message_start
data: {"type":"message_start","message":{"id":"msg_01XYZ...","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5-20250929"}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"! How"}}

...

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":25}}

event: message_stop
data: {"type":"message_stop"}
```

---

### Gemini 生成 API

**请求**:
```http
POST /gemini/v1/models/gemini-2.5-pro:generateContent
x-api-key: cr_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Content-Type: application/json

{
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "Hello, Gemini!"
        }
      ]
    }
  ]
}
```

**响应**:
```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [
          {
            "text": "Hello! How can I assist you today?"
          }
        ]
      },
      "finishReason": "STOP",
      "safetyRatings": []
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 8,
    "candidatesTokenCount": 12,
    "totalTokenCount": 20
  }
}
```

---

### OpenAI 兼容 API

**请求**:
```http
POST /openai/v1/chat/completions
Authorization: Bearer cr_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
Content-Type: application/json

{
  "model": "gpt-5",
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
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1704153600,
  "model": "gpt-5",
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
    "prompt_tokens": 8,
    "completion_tokens": 12,
    "total_tokens": 20
  }
}
```

---

## 错误响应格式

### 通用错误格式

```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message"
}
```

### 常见错误示例

**401 未认证**:
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

**403 无权限**:
```json
{
  "success": false,
  "error": "Forbidden",
  "message": "API key does not have permission to access this service"
}
```

**429 请求过于频繁**:
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "You have exceeded the rate limit of 100 requests per minute",
  "details": {
    "limit": 100,
    "window": 60,
    "current": 105,
    "resetAt": "2026-01-02T10:31:00.000Z"
  }
}
```

**503 服务不可用**:
```json
{
  "success": false,
  "error": "Service unavailable",
  "message": "No available accounts for the requested service",
  "details": {
    "service": "claude",
    "availableAccounts": 0
  }
}
```

---

## 数据类型说明

### 权限值（Permissions）

API Key 的 `permissions` 字段支持以下值：

| 值 | 说明 |
|----|------|
| `[]` (空数组) | 全部服务（all） |
| `["claude"]` | 仅 Claude 服务（claude-official/console/bedrock/ccr） |
| `["gemini"]` | 仅 Gemini 服务 |
| `["openai"]` | 仅 OpenAI 兼容服务（openai/openai-responses/azure-openai） |
| `["droid"]` | 仅 Droid 服务 |
| `["claude", "gemini"]` | Claude 和 Gemini 服务 |

### 客户端类型（Client Types）

`allowedClients` 字段支持的预定义客户端：

| 值 | 说明 | User-Agent 匹配规则 |
|----|------|---------------------|
| `claude_code` | Claude Code CLI | `claude-cli/` 开头 |
| `gemini_cli` | Gemini CLI | `GeminiCLI/` 开头 |

### 账户状态（Account Status）

| 值 | 说明 |
|----|------|
| `active` | 正常可用 |
| `error` | 发生错误 |
| `blocked` | 账户被封禁 |
| `unauthorized` | 认证失败 |
| `overload` | 账户过载（Claude 529 错误） |

### 日期时间格式

所有日期时间字段使用 ISO 8601 格式：

```
2026-01-02T10:30:00.000Z
```

### Token 使用统计字段

| 字段 | 说明 |
|------|------|
| `requests` | 请求总数 |
| `inputTokens` | 输入 Token 数 |
| `outputTokens` | 输出 Token 数 |
| `cacheCreateTokens` | 缓存创建 Token 数（Claude） |
| `cacheReadTokens` | 缓存读取 Token 数（Claude） |
| `allTokens` | 所有 Token 总数 |

### 成本字段

所有成本字段单位为美元（USD），保留 6 位小数：

```json
{
  "cost": 1.234567
}
```

---

## 附录：完整示例流程

### 示例 1: 创建 API Key 并使用

**1. 管理员登录**:
```bash
curl -X POST http://localhost:3000/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "your-password"
  }'
```

**2. 创建 API Key**:
```bash
curl -X POST http://localhost:3000/admin/api-keys \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "permissions": ["claude"],
    "concurrencyLimit": 5,
    "dailyCostLimit": 10.0
  }'
```

**3. 使用 API Key 调用 Claude**:
```bash
curl -X POST http://localhost:3000/api/v1/messages \
  -H "x-api-key: cr_YOUR_GENERATED_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-sonnet-4-5-20250929",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

---

### 示例 2: 添加 Claude 账户完整流程

**1. 生成授权 URL**:
```bash
curl -X POST http://localhost:3000/admin/claude-accounts/generate-auth-url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

**2. 在浏览器中打开返回的 `authUrl`，完成授权**

**3. 交换授权码**:
```bash
curl -X POST http://localhost:3000/admin/claude-accounts/exchange-code \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "SESSION_ID_FROM_STEP_1",
    "authorizationCode": "AUTH_CODE_FROM_BROWSER"
  }'
```

**4. 创建账户**:
```bash
curl -X POST http://localhost:3000/admin/claude-accounts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Account",
    "claudeAiOauth": {
      "accessToken": "TOKEN_FROM_STEP_3",
      "refreshToken": "REFRESH_TOKEN_FROM_STEP_3",
      "expiresAt": "EXPIRY_FROM_STEP_3"
    }
  }'
```

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
