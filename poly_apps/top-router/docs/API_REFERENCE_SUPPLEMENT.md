# Claude Relay Service - API 补充文档

> 本文档补充主文档中遗漏的API端点和功能

**版本**: 1.0
**最后更新**: 2026-01-02
**配合文档**: `API_REFERENCE_DETAILED.md`

---

## 📚 目录

1. [用户管理 API](#用户管理-api)
2. [Webhook 管理 API](#webhook-管理-api)
3. [并发控制 API（完整版）](#并发控制-api完整版)
4. [账户组管理 API](#账户组管理-api)
5. [订阅和支付 API](#订阅和支付-api)
6. [系统高级功能 API](#系统高级功能-api)
7. [余额脚本管理 API](#余额脚本管理-api)
8. [数据格式补充说明](#数据格式补充说明)

---

## 用户管理 API

用户管理功能需要配置 `USER_MANAGEMENT_ENABLED=true` 启用。

### 1.1 用户注册

创建新用户账户。

**请求**:
```http
POST /users/register
Content-Type: application/json

{
  "username": "john.doe",
  "password": "SecurePassword123!",
  "email": "john.doe@example.com",
  "displayName": "John Doe",
  "firstName": "John",
  "lastName": "Doe"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | String | 是 | 用户名（3-20个字符，字母数字下划线） |
| `password` | String | 是 | 密码（至少8个字符） |
| `email` | String | 否 | 邮箱地址 |
| `displayName` | String | 否 | 显示名称 |
| `firstName` | String | 否 | 名 |
| `lastName` | String | 否 | 姓 |

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-550e8400",
      "username": "john.doe",
      "email": "john.doe@example.com",
      "displayName": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "role": "user",
      "isActive": true,
      "emailVerified": false,
      "registrationMethod": "local",
      "createdAt": "2026-01-02T10:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

---

### 1.2 用户登录

用户登录获取访问令牌。

**请求**:
```http
POST /users/login
Content-Type: application/json

{
  "username": "john.doe",
  "password": "SecurePassword123!"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-550e8400",
      "username": "john.doe",
      "email": "john.doe@example.com",
      "displayName": "John Doe",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 86400
  }
}
```

**错误响应（速率限制）**:
```json
{
  "success": false,
  "error": "Too many requests",
  "message": "Too many login attempts from this IP. Please try again later.",
  "retryAfter": 900
}
```

---

### 1.3 获取用户资料

获取当前登录用户的详细信息。

**请求**:
```http
GET /users/profile
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "user-550e8400",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "displayName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "emailVerified": false,
    "createdAt": "2026-01-02T10:30:00.000Z",
    "lastLoginAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 1.4 用户 API Keys 管理

**创建用户 API Key**:
```http
POST /users/api-keys
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "name": "My Personal Key",
  "description": "用于个人项目"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "apiKey": "cr_1234567890abcdef...",
    "name": "My Personal Key",
    "description": "用于个人项目",
    "userId": "user-550e8400",
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

**获取用户所有 API Keys**:
```http
GET /users/api-keys
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Personal Key",
      "apiKeyPrefix": "cr_1234",
      "isActive": true,
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
      "createdAt": "2026-01-02T10:30:00.000Z",
      "lastUsedAt": "2026-01-02T10:45:00.000Z"
    }
  ]
}
```

**删除用户 API Key**:
```http
DELETE /users/api-keys/{keyId}
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "message": "API Key deleted successfully"
}
```

---

### 1.5 用户使用统计

获取用户的使用统计。

**请求**:
```http
GET /users/usage
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "userId": "user-550e8400",
    "total": {
      "requests": 500,
      "inputTokens": 150000,
      "outputTokens": 60000,
      "allTokens": 210000
    },
    "daily": {
      "requests": 50,
      "inputTokens": 15000,
      "outputTokens": 6000,
      "allTokens": 21000
    },
    "apiKeys": [
      {
        "keyId": "550e8400-e29b-41d4-a716-446655440000",
        "keyName": "My Personal Key",
        "requests": 500,
        "tokens": 210000
      }
    ]
  }
}
```

---

## Webhook 管理 API

### 2.1 获取 Webhook 配置

获取当前的 Webhook 配置。

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
        "url": "https://hooks.slack.com/services/...",
        "enabled": true,
        "events": ["apiKeyCreated", "accountError", "costAlert"],
        "headers": {
          "Content-Type": "application/json"
        },
        "createdAt": "2026-01-01T00:00:00.000Z"
      },
      {
        "id": "platform-002",
        "name": "Discord",
        "url": "https://discord.com/api/webhooks/...",
        "enabled": true,
        "events": ["accountError", "costAlert"],
        "createdAt": "2026-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

---

### 2.2 保存 Webhook 配置

更新全局 Webhook 配置。

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

添加新的 Webhook 通知平台。

**请求**:
```http
POST /webhook/platforms
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Slack Production",
  "url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
  "enabled": true,
  "events": ["apiKeyCreated", "apiKeyDeleted", "accountError", "costAlert"],
  "headers": {
    "Content-Type": "application/json"
  }
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | String | 是 | 平台名称 |
| `url` | String | 是 | Webhook URL |
| `enabled` | Boolean | 否 | 是否启用（默认 true） |
| `events` | String[] | 否 | 监听的事件列表 |
| `headers` | Object | 否 | 自定义请求头 |

**支持的事件类型**:

| 事件 | 说明 |
|------|------|
| `apiKeyCreated` | API Key 创建 |
| `apiKeyDeleted` | API Key 删除 |
| `apiKeyUpdated` | API Key 更新 |
| `accountCreated` | 账户创建 |
| `accountError` | 账户错误 |
| `accountBlocked` | 账户被封禁 |
| `tokenRefreshFailed` | Token 刷新失败 |
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
    "url": "https://hooks.slack.com/services/...",
    "enabled": true,
    "events": ["apiKeyCreated", "apiKeyDeleted", "accountError", "costAlert"],
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 2.4 更新 Webhook 平台

更新现有的 Webhook 平台配置。

**请求**:
```http
PUT /webhook/platforms/{platformId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Slack Production (Updated)",
  "enabled": false,
  "events": ["accountError"]
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
    "events": ["accountError"],
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 2.5 删除 Webhook 平台

删除指定的 Webhook 平台。

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

快速启用/禁用 Webhook 平台。

**请求**:
```http
POST /webhook/platforms/{platformId}/toggle
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Webhook平台状态已切换",
  "platform": {
    "id": "platform-003",
    "enabled": false
  }
}
```

---

## 并发控制 API（完整版）

### 3.1 获取所有并发状态

获取所有 API Key 的并发状态概览。

**请求**:
```http
GET /admin/concurrency
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "summary": {
    "totalKeys": 15,
    "totalActiveRequests": 45,
    "totalExpiredRequests": 3,
    "totalQueuedRequests": 8
  },
  "concurrencyStatus": [
    {
      "apiKeyId": "550e8400-e29b-41d4-a716-446655440000",
      "apiKeyName": "Production Key",
      "activeCount": 5,
      "expiredCount": 0,
      "limit": 10,
      "queueCount": 2,
      "oldestRequestAge": 1500,
      "activeRequests": [
        {
          "requestId": "req-001",
          "startTime": 1704153600000,
          "age": 1500
        }
      ]
    }
  ]
}
```

---

### 3.2 获取并发排队统计

获取详细的排队统计信息，包括等待时间百分位数。

**请求**:
```http
GET /admin/concurrency-queue/stats
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "globalStats": {
    "totalEntered": 1500,
    "totalSuccess": 1350,
    "totalTimeout": 80,
    "totalCancelled": 50,
    "totalSocketChanged": 10,
    "totalRejectedOverload": 10,
    "currentTotalQueued": 8,
    "peakQueueSize": 5,
    "avgQueueSize": 2,
    "activeApiKeys": 3,
    "successRate": 90,
    "timeoutRate": 5,
    "cancelledRate": 3,
    "avgWaitTimeMs": 1200,
    "p50WaitTimeMs": 800,
    "p90WaitTimeMs": 2500,
    "p99WaitTimeMs": 5000
  },
  "globalWaitTimeStats": {
    "count": 1500,
    "min": 100,
    "max": 9500,
    "avg": 1200,
    "p50": 800,
    "p90": 2500,
    "p99": 5000,
    "globalP90ForVisualizationOnly": true
  },
  "perKeyStats": [
    {
      "apiKeyId": "550e8400-e29b-41d4-a716-446655440000",
      "currentQueueCount": 2,
      "stats": {
        "entered": 500,
        "success": 450,
        "timeout": 30,
        "cancelled": 15,
        "socket_changed": 3,
        "rejected_overload": 2
      },
      "waitTimeStats": {
        "count": 500,
        "min": 100,
        "max": 8000,
        "avg": 1100,
        "p50": 750,
        "p90": 2300,
        "p99": 4800
      }
    }
  ]
}
```

**字段说明**:

| 字段 | 说明 |
|------|------|
| `totalEntered` | 总进入排队数 |
| `totalSuccess` | 成功获取并发位数 |
| `totalTimeout` | 排队超时数 |
| `totalCancelled` | 用户取消数 |
| `totalSocketChanged` | Socket 身份验证失败数 |
| `totalRejectedOverload` | 健康检查拒绝数（过载保护） |
| `p50WaitTimeMs` | 中位数等待时间（毫秒） |
| `p90WaitTimeMs` | P90 等待时间（毫秒） |
| `p99WaitTimeMs` | P99 等待时间（毫秒） |

---

### 3.3 清理特定 API Key 的排队计数

手动清理特定 API Key 的残留排队计数。

**请求**:
```http
DELETE /admin/concurrency-queue/{apiKeyId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Successfully cleared queue for API key 550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 3.4 清理所有排队计数

清理所有 API Key 的排队计数（用于故障恢复）。

**请求**:
```http
DELETE /admin/concurrency-queue
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Successfully cleared all queues",
  "cleared": {
    "queueKeys": 5,
    "statsKeys": 5
  }
}
```

---

### 3.5 获取特定 API Key 的并发状态

获取单个 API Key 的详细并发状态。

**请求**:
```http
GET /admin/concurrency/{apiKeyId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "concurrencyStatus": {
    "apiKeyId": "550e8400-e29b-41d4-a716-446655440000",
    "activeCount": 5,
    "expiredCount": 0,
    "limit": 10,
    "queueCount": 2,
    "activeRequests": [
      {
        "requestId": "req-001",
        "startTime": 1704153600000,
        "age": 1500
      },
      {
        "requestId": "req-002",
        "startTime": 1704153601000,
        "age": 500
      }
    ]
  }
}
```

---

### 3.6 强制清理并发计数

强制清理特定 API Key 的所有并发计数（慎用）。

**请求**:
```http
DELETE /admin/concurrency/{apiKeyId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Successfully cleared concurrency for API key 550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "removed": 3
  }
}
```

---

### 3.7 清理过期的并发条目

安全地清理过期的并发条目（不影响活跃请求）。

**请求**:
```http
POST /admin/concurrency/cleanup
Authorization: Bearer {token}
Content-Type: application/json

{
  "apiKeyId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**请求体字段（可选）**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `apiKeyId` | String | 要清理的 API Key ID（不提供则清理所有） |

**响应**:
```json
{
  "success": true,
  "message": "Successfully cleaned up expired concurrency for API key 550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "removed": 2
  }
}
```

---

## 账户组管理 API

### 4.1 创建账户组

创建新的账户分组。

**请求**:
```http
POST /admin/account-groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Accounts",
  "platform": "claude",
  "description": "生产环境使用的 Claude 账户"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | String | 是 | 分组名称 |
| `platform` | String | 是 | 平台类型（`claude`/`gemini`/`openai`/`droid`） |
| `description` | String | 否 | 描述信息 |

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "group-001",
    "name": "Production Accounts",
    "platform": "claude",
    "description": "生产环境使用的 Claude 账户",
    "memberCount": 0,
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 4.2 获取所有分组

获取所有账户分组（支持按平台筛选）。

**请求**:
```http
GET /admin/account-groups?platform=claude
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `platform` | String | 平台筛选（可选） |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "group-001",
      "name": "Production Accounts",
      "platform": "claude",
      "description": "生产环境使用的 Claude 账户",
      "memberCount": 5,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "group-002",
      "name": "Test Accounts",
      "platform": "claude",
      "description": "测试环境使用的 Claude 账户",
      "memberCount": 2,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 4.3 获取分组详情

获取单个分组的详细信息。

**请求**:
```http
GET /admin/account-groups/{groupId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "group-001",
    "name": "Production Accounts",
    "platform": "claude",
    "description": "生产环境使用的 Claude 账户",
    "memberCount": 5,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-02T10:00:00.000Z"
  }
}
```

---

### 4.4 更新分组

更新分组信息。

**请求**:
```http
PUT /admin/account-groups/{groupId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Accounts (Updated)",
  "description": "更新后的描述"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "group-001",
    "name": "Production Accounts (Updated)",
    "description": "更新后的描述",
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 4.5 删除分组

删除账户分组（不会删除分组内的账户）。

**请求**:
```http
DELETE /admin/account-groups/{groupId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "分组删除成功"
}
```

---

### 4.6 获取分组成员

获取分组内的所有账户。

**请求**:
```http
GET /admin/account-groups/{groupId}/members
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "claude-acc-123",
      "name": "Production Account 1",
      "email": "user1@example.com",
      "accountType": "claude-official",
      "platform": "claude",
      "status": "active",
      "isActive": true,
      "schedulable": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "claude-acc-124",
      "name": "Production Account 2",
      "email": "user2@example.com",
      "accountType": "claude-official",
      "platform": "claude",
      "status": "active",
      "isActive": true,
      "schedulable": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### 4.7 添加成员到分组

将账户添加到分组。

**请求**:
```http
POST /admin/account-groups/{groupId}/members
Authorization: Bearer {token}
Content-Type: application/json

{
  "accountId": "claude-acc-125"
}
```

**响应**:
```json
{
  "success": true,
  "message": "成员已添加到分组"
}
```

---

### 4.8 从分组移除成员

从分组中移除账户。

**请求**:
```http
DELETE /admin/account-groups/{groupId}/members/{accountId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "成员已从分组移除"
}
```

---

## 订阅和支付 API

### 5.1 获取订阅计划

获取所有可用的订阅计划。

**请求**:
```http
GET /subscriptions/plans
```

**响应**:
```json
{
  "success": true,
  "plans": [
    {
      "id": "plan-basic",
      "name": "Basic Plan",
      "description": "适合个人用户",
      "price": 9.99,
      "currency": "USD",
      "duration": 30,
      "features": [
        "1个 API Key",
        "每日 10,000 tokens",
        "标准支持"
      ]
    },
    {
      "id": "plan-pro",
      "name": "Pro Plan",
      "description": "适合专业用户",
      "price": 29.99,
      "currency": "USD",
      "duration": 30,
      "features": [
        "5个 API Keys",
        "每日 100,000 tokens",
        "优先支持"
      ]
    }
  ]
}
```

---

### 5.2 创建订单

创建新的订阅订单。

**请求**:
```http
POST /subscriptions/orders
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "planId": "plan-pro",
  "provider": "alipay",
  "method": "web"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `planId` | String | 是 | 订阅计划 ID |
| `provider` | String | 否 | 支付提供商（`alipay`/`wechat`），默认 `alipay` |
| `method` | String | 否 | 支付方式（`web`/`h5`/`app`），默认 `web` |
| `openId` | String | 否 | 微信 OpenID（微信支付时需要） |

**响应**:
```json
{
  "success": true,
  "order": {
    "id": "order-550e8400",
    "userId": "user-123",
    "planId": "plan-pro",
    "amount": 29.99,
    "currency": "USD",
    "status": "pending",
    "provider": "alipay",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "expiresAt": "2026-01-02T11:30:00.000Z"
  },
  "payment": {
    "qrCode": "https://qr.alipay.com/...",
    "payUrl": "https://openapi.alipay.com/gateway.do?..."
  }
}
```

---

### 5.3 支付回调

支付平台回调通知（由支付平台调用，非用户）。

**请求（支付宝）**:
```http
POST /subscriptions/notify/alipay
Content-Type: application/x-www-form-urlencoded

out_trade_no=order-550e8400&trade_no=2026010222001411111111111111&...
```

**请求（微信支付）**:
```http
POST /subscriptions/notify/wechat
Content-Type: application/json

{
  "id": "...",
  "create_time": "2026-01-02T10:30:00+08:00",
  "resource": {
    "ciphertext": "...",
    "nonce": "...",
    "associated_data": "..."
  }
}
```

**响应（支付宝）**:
```
success
```

**响应（微信支付）**:
```json
{
  "code": "SUCCESS",
  "message": "成功"
}
```

---

## 系统高级功能 API

### 6.1 Claude Code Headers 管理

**获取所有 Claude Code Headers**:

```http
GET /admin/claude-code-headers
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "accountId": "claude-acc-123",
      "accountName": "Production Account",
      "version": "1.0.58",
      "userAgent": "claude-cli/1.0.58 (external, cli)",
      "updatedAt": "2026-01-02T10:30:00.000Z",
      "headers": {
        "user-agent": "claude-cli/1.0.58 (external, cli)",
        "anthropic-client-sha": "...",
        "anthropic-client-version": "1.0.58"
      }
    }
  ]
}
```

**清除指定账号的 Headers**:

```http
DELETE /admin/claude-code-headers/{accountId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Claude Code headers cleared for account claude-acc-123"
}
```

---

### 6.2 系统更新检查

检查是否有新版本可用。

**请求**:
```http
GET /admin/check-updates
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "currentVersion": "1.0.0",
    "latestVersion": "1.1.0",
    "hasUpdate": true,
    "updateAvailable": true,
    "releaseNotes": "## v1.1.0\n\n- 新增并发请求排队功能\n- 修复若干bug\n...",
    "downloadUrl": "https://github.com/Wei-Shaw/claude-relay-service/releases/tag/v1.1.0"
  }
}
```

---

## 余额脚本管理 API

用于管理账户余额查询脚本。

### 7.1 获取所有脚本配置

**请求**:
```http
GET /admin/balance-scripts
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "name": "claude-console",
      "displayName": "Claude Console",
      "enabled": true,
      "description": "查询 Claude Console 账户余额",
      "scriptPath": "/path/to/script.js"
    },
    {
      "name": "gemini",
      "displayName": "Gemini",
      "enabled": true,
      "description": "查询 Gemini 账户余额",
      "scriptPath": "/path/to/gemini-script.js"
    }
  ]
}
```

---

### 7.2 获取单个脚本配置

**请求**:
```http
GET /admin/balance-scripts/{scriptName}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "name": "claude-console",
    "displayName": "Claude Console",
    "enabled": true,
    "description": "查询 Claude Console 账户余额",
    "scriptPath": "/path/to/script.js",
    "config": {
      "timeout": 30000,
      "retryAttempts": 3
    }
  }
}
```

---

### 7.3 保存脚本配置

**请求**:
```http
PUT /admin/balance-scripts/{scriptName}
Authorization: Bearer {token}
Content-Type: application/json

{
  "enabled": true,
  "config": {
    "timeout": 60000,
    "retryAttempts": 5
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "name": "claude-console",
    "enabled": true,
    "config": {
      "timeout": 60000,
      "retryAttempts": 5
    },
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 7.4 测试脚本

测试余额查询脚本（不保存结果）。

**请求**:
```http
POST /admin/balance-scripts/{scriptName}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "accountId": "claude-console-acc-123"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "balance": 95.50,
    "currency": "USD",
    "quota": {
      "total": 100.00,
      "used": 4.50,
      "remaining": 95.50
    },
    "executionTime": 1250
  }
}
```

---

## 数据格式补充说明

### 并发排队统计字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `entered` | Number | 总进入排队数 |
| `success` | Number | 成功获取并发位数 |
| `timeout` | Number | 排队超时数 |
| `cancelled` | Number | 用户取消数（客户端断开连接） |
| `socket_changed` | Number | Socket 身份验证失败数（HTTP Keep-Alive 连接复用导致） |
| `rejected_overload` | Number | 健康检查拒绝数（队列过载时的快速失败） |

### 等待时间统计

| 字段 | 类型 | 说明 |
|------|------|------|
| `count` | Number | 样本数量 |
| `min` | Number | 最小等待时间（毫秒） |
| `max` | Number | 最大等待时间（毫秒） |
| `avg` | Number | 平均等待时间（毫秒） |
| `p50` | Number | 中位数等待时间（毫秒） |
| `p90` | Number | P90 等待时间（毫秒） |
| `p99` | Number | P99 等待时间（毫秒） |

### Webhook 事件数据格式

**API Key 创建事件**:
```json
{
  "event": "apiKeyCreated",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "keyName": "Production Key",
    "createdBy": "admin"
  }
}
```

**账户错误事件**:
```json
{
  "event": "accountError",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "data": {
    "accountId": "claude-acc-123",
    "accountName": "Production Account",
    "error": "Token refresh failed",
    "errorType": "token_refresh_error"
  }
}
```

**成本告警事件**:
```json
{
  "event": "costAlert",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "keyName": "Production Key",
    "currentCost": 9.50,
    "limit": 10.00,
    "percentage": 95.0,
    "period": "daily"
  }
}
```

---

## 错误码参考

### 用户管理错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `REGISTRATION_DISABLED` | 403 | 用户注册未启用 |
| `USERNAME_TAKEN` | 400 | 用户名已被占用 |
| `INVALID_USERNAME` | 400 | 用户名格式无效 |
| `INVALID_PASSWORD` | 400 | 密码格式无效 |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `USER_INACTIVE` | 403 | 用户账户已停用 |
| `MAX_API_KEYS_REACHED` | 400 | 已达到 API Key 数量上限 |

### Webhook 错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `WEBHOOK_DISABLED` | 403 | Webhook 功能未启用 |
| `INVALID_URL` | 400 | Webhook URL 格式无效 |
| `PLATFORM_NOT_FOUND` | 404 | Webhook 平台不存在 |
| `DUPLICATE_PLATFORM` | 400 | Webhook 平台名称重复 |

### 订阅错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `INVALID_PLAN` | 400 | 订阅计划不存在 |
| `UNSUPPORTED_PROVIDER` | 400 | 不支持的支付提供商 |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `PAYMENT_FAILED` | 400 | 支付失败 |
| `INVALID_SIGNATURE` | 400 | 支付签名验证失败 |

---

## 完整 API 端点清单

### 用户管理
- ✅ `POST /users/register` - 用户注册
- ✅ `POST /users/login` - 用户登录
- ✅ `GET /users/profile` - 获取用户资料
- ✅ `POST /users/api-keys` - 创建用户 API Key
- ✅ `GET /users/api-keys` - 获取用户 API Keys
- ✅ `DELETE /users/api-keys/{keyId}` - 删除用户 API Key
- ✅ `GET /users/usage` - 获取用户使用统计

### Webhook 管理
- ✅ `GET /webhook/config` - 获取 Webhook 配置
- ✅ `POST /webhook/config` - 保存 Webhook 配置
- ✅ `POST /webhook/platforms` - 添加 Webhook 平台
- ✅ `PUT /webhook/platforms/{id}` - 更新 Webhook 平台
- ✅ `DELETE /webhook/platforms/{id}` - 删除 Webhook 平台
- ✅ `POST /webhook/platforms/{id}/toggle` - 切换 Webhook 平台状态

### 并发控制
- ✅ `GET /admin/concurrency` - 获取所有并发状态
- ✅ `GET /admin/concurrency-queue/stats` - 获取排队统计
- ✅ `DELETE /admin/concurrency-queue/{apiKeyId}` - 清理特定 Key 排队
- ✅ `DELETE /admin/concurrency-queue` - 清理所有排队
- ✅ `GET /admin/concurrency/{apiKeyId}` - 获取特定 Key 并发状态
- ✅ `DELETE /admin/concurrency/{apiKeyId}` - 强制清理特定 Key 并发
- ✅ `DELETE /admin/concurrency` - 强制清理所有并发
- ✅ `POST /admin/concurrency/cleanup` - 清理过期并发

### 账户组管理
- ✅ `POST /admin/account-groups` - 创建账户组
- ✅ `GET /admin/account-groups` - 获取所有账户组
- ✅ `GET /admin/account-groups/{groupId}` - 获取账户组详情
- ✅ `PUT /admin/account-groups/{groupId}` - 更新账户组
- ✅ `DELETE /admin/account-groups/{groupId}` - 删除账户组
- ✅ `GET /admin/account-groups/{groupId}/members` - 获取分组成员
- ✅ `POST /admin/account-groups/{groupId}/members` - 添加成员到分组
- ✅ `DELETE /admin/account-groups/{groupId}/members/{accountId}` - 从分组移除成员

### 订阅和支付
- ✅ `GET /subscriptions/plans` - 获取订阅计划
- ✅ `POST /subscriptions/orders` - 创建订单
- ✅ `POST /subscriptions/notify/{provider}` - 支付回调

### 系统高级功能
- ✅ `GET /admin/claude-code-headers` - 获取 Claude Code Headers
- ✅ `DELETE /admin/claude-code-headers/{accountId}` - 清除 Headers
- ✅ `GET /admin/check-updates` - 检查系统更新

### 余额脚本管理
- ✅ `GET /admin/balance-scripts` - 获取所有脚本配置
- ✅ `GET /admin/balance-scripts/{name}` - 获取单个脚本配置
- ✅ `PUT /admin/balance-scripts/{name}` - 保存脚本配置
- ✅ `POST /admin/balance-scripts/{name}/test` - 测试脚本

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
