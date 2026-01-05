# Claude Relay Service - 第六次扫描补充端点

> 本文档记录第六次扫描发现的额外遗漏端点

**版本**: 1.0
**最后更新**: 2026-01-02
**发现**: 第六次全面扫描

---

## 📊 本次扫描发现汇总

| 分类 | 端点数量 | 文件来源 |
|------|----------|----------|
| **订阅支付管理** | 4 | subscriptionRoutes.js |
| **Web 认证管理** | 6 | web.js |
| **API 统计查询** | 4 | apiStats.js |
| **总计** | 14 | |

---

## 1. 订阅支付管理补充端点

### 1.1 查询订单详情

查询指定订单的详细信息,可选刷新支付状态。

**请求**:
```http
GET /subscriptions/orders/{orderId}?refresh=true
Authorization: Bearer {userToken}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `refresh` | Boolean | 是否刷新支付状态（可选） |

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
    "status": "paid",
    "provider": "alipay",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "paidAt": "2026-01-02T10:35:00.000Z",
    "expiresAt": "2026-01-02T11:30:00.000Z"
  },
  "payment": {
    "transactionId": "2026010222001411111111111111",
    "method": "web",
    "paidAt": "2026-01-02T10:35:00.000Z"
  },
  "providerStatus": {
    "status": "paid",
    "transactionId": "2026010222001411111111111111",
    "raw": { /* 支付平台原始响应 */ }
  }
}
```

**刷新逻辑**:
- 如果 `refresh=true` 且订单状态不是 `paid`,系统会主动查询支付平台
- 根据支付平台返回的状态自动更新订单状态
- 支持状态: `paid`(已支付), `refunded`(已退款), 其他状态

---

### 1.2 退款订单

对已支付订单发起退款。

**请求**:
```http
POST /subscriptions/orders/{orderId}/refund
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "amount": 29.99,
  "reason": "用户主动取消订阅"
}
```

**请求体字段**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `amount` | Number | 否 | 退款金额（不提供则全额退款） |
| `reason` | String | 否 | 退款原因 |

**响应**:
```json
{
  "success": true,
  "order": {
    "id": "order-550e8400",
    "status": "refunded",
    "refundedAt": "2026-01-02T11:00:00.000Z"
  },
  "refund": {
    "status": "refunded",
    "transactionId": "refund_123456",
    "amount": 29.99,
    "raw": { /* 支付平台原始响应 */ }
  }
}
```

**支持的支付平台**:
- Alipay (支付宝)
- WeChat Pay (微信支付)

---

### 1.3 获取用户订单列表

获取当前用户的所有订单。

**请求**:
```http
GET /subscriptions/orders
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "orders": [
    {
      "id": "order-550e8400",
      "planId": "plan-pro",
      "planName": "Pro Plan",
      "amount": 29.99,
      "currency": "USD",
      "status": "paid",
      "provider": "alipay",
      "createdAt": "2026-01-02T10:30:00.000Z",
      "paidAt": "2026-01-02T10:35:00.000Z"
    },
    {
      "id": "order-660e9400",
      "planId": "plan-basic",
      "planName": "Basic Plan",
      "amount": 9.99,
      "currency": "USD",
      "status": "pending",
      "provider": "wechat",
      "createdAt": "2026-01-01T15:20:00.000Z",
      "expiresAt": "2026-01-01T16:20:00.000Z"
    }
  ]
}
```

**订单状态**:
- `pending`: 待支付
- `paid`: 已支付
- `refunded`: 已退款
- `cancelled`: 已取消
- `expired`: 已过期

---

### 1.4 获取套餐列表

获取所有可用的订阅套餐（公开接口,无需认证）。

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

## 2. Web 认证管理端点

### 2.1 运行时信息查询

获取系统运行模式信息（公开接口,无需认证）。

**请求**:
```http
GET /web/runtime-info
```

**响应**:
```json
{
  "success": true,
  "data": {
    "uiMode": "full",
    "ws": {
      "mode": "client",
      "clientEnabled": true,
      "serverEnabled": false,
      "wsClientOnly": true
    },
    "vpn": {
      "mode": "client",
      "enabled": false
    }
  }
}
```

**字段说明**:
- `uiMode`: UI 模式（`full` 或 `client`）
- `ws.mode`: WebSocket 模式（`client`/`server`/`both`/`off`）
- `ws.wsClientOnly`: 是否仅启用 WebSocket 客户端模式
- `vpn.mode`: VPN 模式（`client`/`server`/`both`/`off`）
- `vpn.enabled`: VPN 是否启用

---

### 2.2 管理员登录

管理员登录获取会话令牌。

**请求**:
```http
POST /web/auth/login
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
  "token": "a1b2c3d4e5f6...",
  "expiresIn": 86400,
  "username": "admin"
}
```

**安全特性**:
- 密码使用 bcrypt 哈希验证
- 从 `data/init.json` 加载管理员凭据
- Redis 中自动同步管理员数据
- 登录失败会记录安全日志

---

### 2.3 管理员登出

**请求**:
```http
POST /web/auth/logout
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 2.4 修改管理员密码

修改管理员用户名和密码。

**请求**:
```http
POST /web/auth/change-password
Authorization: Bearer {token}
Content-Type: application/json

{
  "newUsername": "new-admin",
  "currentPassword": "current-password",
  "newPassword": "new-password-123"
}
```

**请求体字段**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `newUsername` | String | 否 | 新用户名（不提供则保持不变） |
| `currentPassword` | String | 是 | 当前密码 |
| `newPassword` | String | 是 | 新密码（至少 8 个字符） |

**响应**:
```json
{
  "success": true,
  "message": "Password changed successfully. Please login again.",
  "newUsername": "new-admin"
}
```

**重要说明**:
- 修改密码后会自动登出,需重新登录
- 密码修改会同时更新 `data/init.json` 文件和 Redis 缓存
- `init.json` 是唯一真实数据源
- 会话完整性验证（必须有 `username` 和 `loginTime`）

---

### 2.5 获取当前用户信息

**请求**:
```http
GET /web/auth/user
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "user": {
    "username": "admin",
    "loginTime": "2026-01-02T10:00:00.000Z",
    "lastActivity": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 2.6 刷新会话令牌

刷新当前会话的过期时间。

**请求**:
```http
POST /web/auth/refresh
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "token": "a1b2c3d4e5f6...",
  "expiresIn": 86400
}
```

**安全增强**:
- 会话完整性验证（检查 `username` 和 `loginTime`）
- 检测空对象会话（防止伪造会话）
- 自动清理无效会话
- 更新最后活动时间

---

## 3. API 统计查询补充端点

### 3.1 批量统计查询

批量查询多个 API Key 的统计数据。

**请求**:
```http
POST /apiStats/api/batch-stats
Content-Type: application/json

{
  "apiIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e9400-e29b-41d4-a716-446655440001"
  ]
}
```

**限制**:
- 最多一次查询 30 个 API Keys
- API ID 必须是有效的 UUID 格式

**响应**:
```json
{
  "success": true,
  "data": {
    "aggregated": {
      "totalKeys": 2,
      "activeKeys": 2,
      "usage": {
        "requests": 2300,
        "inputTokens": 750000,
        "outputTokens": 300000,
        "cacheCreateTokens": 35000,
        "cacheReadTokens": 18000,
        "allTokens": 1103000,
        "cost": 65.75,
        "formattedCost": "$65.750000"
      },
      "dailyUsage": {
        "requests": 250,
        "inputTokens": 80000,
        "outputTokens": 32000,
        "cacheCreateTokens": 3500,
        "cacheReadTokens": 1800,
        "allTokens": 117300,
        "cost": 7.25,
        "formattedCost": "$7.250000"
      },
      "monthlyUsage": {
        "requests": 7500,
        "inputTokens": 2500000,
        "outputTokens": 1000000,
        "cacheCreateTokens": 120000,
        "cacheReadTokens": 60000,
        "allTokens": 3680000,
        "cost": 215.50,
        "formattedCost": "$215.500000"
      }
    },
    "individual": [
      {
        "apiId": "550e8400-e29b-41d4-a716-446655440000",
        "name": "Production Key",
        "isActive": true,
        "usage": {
          "requests": 1500,
          "inputTokens": 500000,
          "outputTokens": 200000,
          "allTokens": 725000
        },
        "dailyUsage": {
          "requests": 150,
          "cost": 4.25,
          "formattedCost": "$4.250000"
        },
        "monthlyUsage": {
          "requests": 4500,
          "cost": 125.00,
          "formattedCost": "$125.000000"
        }
      }
    ]
  }
}
```

---

### 3.2 批量模型统计查询

批量查询多个 API Key 的按模型分组统计。

**请求**:
```http
POST /apiStats/api/batch-model-stats
Content-Type: application/json

{
  "apiIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e9400-e29b-41d4-a716-446655440001"
  ],
  "period": "daily"
}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | daily | 统计周期（`daily`/`monthly`） |

**响应**:
```json
{
  "success": true,
  "period": "daily",
  "data": [
    {
      "model": "claude-sonnet-4-5",
      "requests": 850,
      "inputTokens": 320000,
      "outputTokens": 128000,
      "cacheCreateTokens": 16000,
      "cacheReadTokens": 8000,
      "allTokens": 472000,
      "costs": {
        "input": 9.60,
        "output": 19.20,
        "cacheCreate": 1.20,
        "cacheRead": 0.12,
        "total": 30.12
      },
      "formatted": {
        "input": "$9.60",
        "output": "$19.20",
        "cacheCreate": "$1.20",
        "cacheRead": "$0.12",
        "total": "$30.12"
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
      "requests": 650,
      "inputTokens": 180000,
      "outputTokens": 72000,
      "allTokens": 252000,
      "costs": {
        "input": 4.50,
        "output": 9.00,
        "total": 13.50
      },
      "formatted": {
        "input": "$4.50",
        "output": "$9.00",
        "total": "$13.50"
      },
      "pricing": {
        "input": 0.000025,
        "output": 0.000125
      }
    }
  ]
}
```

**聚合逻辑**:
- 将所有 API Keys 的数据按模型聚合
- 按总 token 数降序排列
- 自动计算成本

---

### 3.3 API Key 端点测试

测试 API Key 是否能正常访问服务（流式响应）。

**请求**:
```http
POST /apiStats/api-key/test
Content-Type: application/json

{
  "apiKey": "cr_1234567890abcdef...",
  "model": "claude-sonnet-4-5-20250929"
}
```

**请求体字段**:
| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `apiKey` | String | - | 要测试的 API Key |
| `model` | String | claude-sonnet-4-5-20250929 | 测试使用的模型 |

**响应**:
流式 SSE 响应,实时返回测试结果:

```
data: {"type":"message_start","message":{"id":"msg_01XYZ...","type":"message","role":"assistant"}}

data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"测试成功"}}

data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":10}}

data: {"type":"message_stop"}
```

**测试流程**:
1. 验证 API Key 有效性
2. 向本地 `/api/v1/messages` 端点发送测试请求
3. 流式返回响应数据
4. 超时时间: 60 秒

---

### 3.4 用户模型统计查询

查询单个 API Key 的按模型分组统计（用户自查询接口）。

**请求**:
```http
POST /apiStats/api/user-model-stats
Content-Type: application/json

{
  "apiId": "550e8400-e29b-41d4-a716-446655440000",
  "period": "monthly"
}
```

**支持的查询方式**:
- 通过 `apiId`（推荐）
- 通过 `apiKey`（向后兼容）

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | monthly | 统计周期（`daily`/`monthly`） |

**响应**:
```json
{
  "success": true,
  "period": "monthly",
  "data": [
    {
      "model": "claude-sonnet-4-5",
      "requests": 800,
      "inputTokens": 300000,
      "outputTokens": 120000,
      "cacheCreateTokens": 15000,
      "cacheReadTokens": 8000,
      "allTokens": 443000,
      "costs": {
        "input": 9.00,
        "output": 18.00,
        "cacheCreate": 1.125,
        "cacheRead": 0.120,
        "total": 28.245
      },
      "formatted": {
        "input": "$9.00",
        "output": "$18.00",
        "cacheCreate": "$1.125",
        "cacheRead": "$0.120",
        "total": "$28.245"
      },
      "pricing": {
        "input": 0.000030,
        "output": 0.000150,
        "cacheCreate": 0.000075,
        "cacheRead": 0.000015
      }
    }
  ]
}
```

**数据说明**:
- 只返回该 API Key 的数据,不泄露其他信息
- 如果没有模型数据,返回空数组
- 按总 token 数降序排列

---

## 4. 数据格式补充

### 4.1 订单状态流转

```
pending (待支付)
    ↓
  [支付]
    ↓
paid (已支付)
    ↓
  [退款]
    ↓
refunded (已退款)
```

其他状态:
- `cancelled`: 手动取消
- `expired`: 超时过期（未支付订单）

### 4.2 会话安全验证

所有会话必须包含以下字段,否则视为无效:
```typescript
interface ValidSession {
  username: string      // 必须
  loginTime: string     // 必须（ISO 8601 格式）
  lastActivity: string  // 最后活动时间
}
```

空对象会话 `{}` 会被自动清理。

### 4.3 批量查询聚合数据结构

```typescript
interface AggregatedStats {
  totalKeys: number       // 总 Key 数
  activeKeys: number      // 活跃 Key 数
  usage: UsageStats       // 总使用量
  dailyUsage: UsageStats  // 今日使用量
  monthlyUsage: UsageStats // 本月使用量
}

interface UsageStats {
  requests: number
  inputTokens: number
  outputTokens: number
  cacheCreateTokens: number
  cacheReadTokens: number
  allTokens: number
  cost: number
  formattedCost: string
}
```

---

## 5. 使用场景示例

### 场景 1: 订单完整流程

```javascript
// 1. 获取套餐列表
const plans = await axios.get('/subscriptions/plans')

// 2. 创建订单
const order = await axios.post('/subscriptions/orders', {
  planId: 'plan-pro',
  provider: 'alipay',
  method: 'web'
}, {
  headers: { 'Authorization': 'Bearer {userToken}' }
})

// 3. 用户扫码支付...

// 4. 轮询查询订单状态
const status = await axios.get(`/subscriptions/orders/${order.data.order.id}?refresh=true`, {
  headers: { 'Authorization': 'Bearer {userToken}' }
})

// 5. 如需退款
await axios.post(`/subscriptions/orders/${order.data.order.id}/refund`, {
  reason: '用户取消'
}, {
  headers: { 'Authorization': 'Bearer {userToken}' }
})
```

### 场景 2: 批量监控多个 API Keys

```javascript
// 监控所有 API Keys 的使用情况
const apiIds = [
  '550e8400-e29b-41d4-a716-446655440000',
  '660e9400-e29b-41d4-a716-446655440001',
  '770ea500-e29b-41d4-a716-446655440002'
]

// 1. 批量查询统计
const stats = await axios.post('/apiStats/api/batch-stats', { apiIds })
console.log('总使用量:', stats.data.aggregated.usage)
console.log('今日成本:', stats.data.aggregated.dailyUsage.formattedCost)

// 2. 批量查询模型统计
const modelStats = await axios.post('/apiStats/api/batch-model-stats', {
  apiIds,
  period: 'daily'
})
console.log('今日各模型使用:', modelStats.data)
```

### 场景 3: API Key 健康检查

```javascript
// 定期测试 API Key 是否正常工作
async function testApiKey(apiKey) {
  const response = await fetch('/apiStats/api-key/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  })

  const reader = response.body.getReader()
  let testPassed = false

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = new TextDecoder().decode(value)
    if (text.includes('"type":"message_stop"')) {
      testPassed = true
    }
  }

  return testPassed
}
```

---

## 6. 安全注意事项

### 6.1 会话安全

- 启动时自动清理无效会话
- 会话完整性验证（防止伪造）
- 检测空对象会话
- 登录失败记录安全日志

### 6.2 支付安全

- 支付回调签名验证
- 订单所有权验证（只能操作自己的订单）
- 支付失败自动发送 Webhook 通知
- 敏感数据脱敏记录

### 6.3 批量查询限制

- 最多一次查询 30 个 API Keys
- UUID 格式严格验证
- 只返回激活且未过期的 Key 数据

---

## 7. 错误码参考

### 订阅支付错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `INVALID_PLAN` | 400 | 套餐不存在 |
| `UNSUPPORTED_PROVIDER` | 400 | 不支持的支付提供商 |
| `ORDER_NOT_FOUND` | 404 | 订单不存在 |
| `ORDER_NOT_PAID` | 400 | 订单未支付（退款失败） |
| `INVALID_SIGNATURE` | 400 | 支付签名验证失败 |

### Web 认证错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `MISSING_CREDENTIALS` | 400 | 缺少用户名或密码 |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `INVALID_TOKEN` | 401 | 会话已过期或无效 |
| `INVALID_SESSION` | 401 | 会话数据损坏或不完整 |
| `PASSWORD_TOO_SHORT` | 400 | 密码少于 8 个字符 |

### 批量查询错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `INVALID_INPUT` | 400 | API IDs 数组格式错误 |
| `TOO_MANY_KEYS` | 400 | 超过 30 个 Keys 限制 |
| `INVALID_API_ID_FORMAT` | 400 | API ID 不是有效的 UUID |

---

## 8. 完整端点清单

### 订阅支付
- ✅ `GET /subscriptions/plans` - 获取套餐列表
- ✅ `GET /subscriptions/orders/{orderId}` - 查询订单详情
- ✅ `POST /subscriptions/orders/{orderId}/refund` - 退款订单
- ✅ `GET /subscriptions/orders` - 获取用户订单列表

### Web 认证
- ✅ `GET /web/runtime-info` - 运行时信息（公开）
- ✅ `POST /web/auth/login` - 管理员登录
- ✅ `POST /web/auth/logout` - 管理员登出
- ✅ `POST /web/auth/change-password` - 修改管理员密码
- ✅ `GET /web/auth/user` - 获取当前用户信息
- ✅ `POST /web/auth/refresh` - 刷新会话令牌

### API 统计查询
- ✅ `POST /apiStats/api/batch-stats` - 批量统计查询
- ✅ `POST /apiStats/api/batch-model-stats` - 批量模型统计查询
- ✅ `POST /apiStats/api-key/test` - API Key 端点测试
- ✅ `POST /apiStats/api/user-model-stats` - 用户模型统计查询

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
