# Claude Relay Service - 管理功能和高级特性 API

> 本文档记录第九次扫描发现的并发管理、VPN、余额管理、脚本系统和账户分组功能

**版本**: 1.0
**最后更新**: 2026-01-02
**发现**: 第九次全面扫描

---

## 📊 本次扫描发现汇总

| 分类 | 端点数量 | 文件来源 |
|------|----------|----------|
| **并发管理** | 8 | admin/concurrency.js |
| **Dashboard 统计** | 3 | admin/dashboard.js |
| **VPN 隧道管理** | 7 | admin/vpn.js |
| **账户余额管理** | 9 | admin/accountBalance.js |
| **余额脚本管理** | 4 | admin/balanceScripts.js |
| **账户分组管理** | 6 | admin/accountGroups.js |
| **总计** | 37 | |

---

## 1. 并发管理 API

### 1.1 获取所有并发状态

获取所有 API Key 的并发状态和排队信息。

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
    "totalKeys": 25,
    "totalActiveRequests": 150,
    "totalExpiredRequests": 8,
    "totalQueuedRequests": 12
  },
  "concurrencyStatus": [
    {
      "apiKeyId": "550e8400-e29b-41d4-a716-446655440000",
      "activeCount": 8,
      "expiredCount": 0,
      "queueCount": 2,
      "maxConcurrency": 10,
      "availableSlots": 2
    }
  ]
}
```

---

### 1.2 获取排队统计信息

获取详细的排队统计，包括等待时间百分位数（P50/P90/P99）。

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
    "totalEntered": 1200,
    "totalSuccess": 1100,
    "totalTimeout": 50,
    "totalCancelled": 30,
    "totalSocketChanged": 15,
    "totalRejectedOverload": 5,
    "currentTotalQueued": 12,
    "peakQueueSize": 8,
    "avgQueueSize": 2,
    "activeApiKeys": 15,
    "successRate": 92,
    "timeoutRate": 4,
    "cancelledRate": 3,
    "avgWaitTimeMs": 1250,
    "p50WaitTimeMs": 850,
    "p90WaitTimeMs": 2500,
    "p99WaitTimeMs": 4200
  },
  "globalWaitTimeStats": {
    "count": 1200,
    "avg": 1250,
    "p50": 850,
    "p90": 2500,
    "p99": 4200,
    "min": 100,
    "max": 9800,
    "globalP90ForVisualizationOnly": true
  },
  "perKeyStats": [
    {
      "apiKeyId": "550e8400-e29b-41d4-a716-446655440000",
      "currentQueueCount": 2,
      "stats": {
        "entered": 150,
        "success": 140,
        "timeout": 5,
        "cancelled": 3,
        "socket_changed": 2,
        "rejected_overload": 0
      },
      "waitTimeStats": {
        "count": 150,
        "avg": 1100,
        "p50": 800,
        "p90": 2200,
        "p99": 3800,
        "min": 150,
        "max": 8500
      }
    }
  ]
}
```

**字段说明**:
- `totalEntered`: 总进入排队数
- `totalSuccess`: 成功获取并发位数
- `totalTimeout`: 排队超时数
- `totalCancelled`: 用户取消数（客户端断开）
- `totalSocketChanged`: Socket 身份验证失败数
- `totalRejectedOverload`: 健康检查拒绝数（队列过载）
- `p50/p90/p99WaitTimeMs`: 等待时间百分位数（毫秒）
- `globalP90ForVisualizationOnly`: 标记全局 P90 仅用于可视化（详见设计文档 Decision 9）

---

### 1.3 清理特定 API Key 的排队计数

手动清理指定 API Key 的排队计数器。

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

### 1.4 清理所有排队计数

手动清理所有 API Key 的排队计数器。

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
  "cleared": 25
}
```

---

### 1.5 获取特定 API Key 的并发状态

查询单个 API Key 的详细并发状态。

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
    "activeCount": 8,
    "expiredCount": 0,
    "queueCount": 2,
    "maxConcurrency": 10,
    "concurrencyLimit": 10,
    "availableSlots": 2
  }
}
```

---

### 1.6 强制清理特定 API Key 的并发计数

强制清理指定 API Key 的并发计数（包括活跃请求）。

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
    "clearedActiveCount": 8,
    "clearedExpiredCount": 0
  }
}
```

**警告**: 此操作会强制清理所有并发计数，包括正在进行的请求。

---

### 1.7 强制清理所有并发计数

强制清理所有 API Key 的并发计数。

**请求**:
```http
DELETE /admin/concurrency
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Successfully cleared all concurrency",
  "result": {
    "totalKeysCleared": 25,
    "totalRequestsCleared": 150
  }
}
```

---

### 1.8 清理过期的并发条目

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

**请求体字段**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `apiKeyId` | String | 否 | API Key ID（不提供则清理所有） |

**响应**:
```json
{
  "success": true,
  "message": "Successfully cleaned up expired concurrency for API key 550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "expiredEntriesRemoved": 5
  }
}
```

---

## 2. Dashboard 统计 API

### 2.1 获取系统概览

获取完整的系统仪表板数据，包括账户统计、使用量、系统健康等。

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
      "totalApiKeys": 50,
      "activeApiKeys": 45,
      "totalAccounts": 120,
      "normalAccounts": 100,
      "abnormalAccounts": 8,
      "pausedAccounts": 10,
      "rateLimitedAccounts": 2,
      "accountsByPlatform": {
        "claude": {
          "total": 30,
          "normal": 25,
          "abnormal": 2,
          "paused": 2,
          "rateLimited": 1
        },
        "claude-console": {
          "total": 20,
          "normal": 18,
          "abnormal": 1,
          "paused": 1,
          "rateLimited": 0
        },
        "gemini": {
          "total": 25,
          "normal": 22,
          "abnormal": 2,
          "paused": 1,
          "rateLimited": 0
        },
        "bedrock": {
          "total": 15,
          "normal": 13,
          "abnormal": 1,
          "paused": 1,
          "rateLimited": 0
        },
        "openai": {
          "total": 10,
          "normal": 8,
          "abnormal": 1,
          "paused": 1,
          "rateLimited": 0
        },
        "ccr": {
          "total": 8,
          "normal": 6,
          "abnormal": 1,
          "paused": 1,
          "rateLimited": 0
        },
        "openai-responses": {
          "total": 7,
          "normal": 5,
          "abnormal": 0,
          "paused": 2,
          "rateLimited": 0
        },
        "droid": {
          "total": 5,
          "normal": 3,
          "abnormal": 0,
          "paused": 1,
          "rateLimited": 1
        }
      },
      "totalTokensUsed": 125000000,
      "totalRequestsUsed": 50000,
      "totalInputTokensUsed": 75000000,
      "totalOutputTokensUsed": 30000000,
      "totalCacheCreateTokensUsed": 15000000,
      "totalCacheReadTokensUsed": 5000000,
      "totalAllTokensUsed": 125000000
    },
    "recentActivity": {
      "apiKeysCreatedToday": 3,
      "requestsToday": 2500,
      "tokensToday": 1200000,
      "inputTokensToday": 750000,
      "outputTokensToday": 300000,
      "cacheCreateTokensToday": 100000,
      "cacheReadTokensToday": 50000
    },
    "systemAverages": {
      "rpm": 450,
      "tpm": 180000
    },
    "realtimeMetrics": {
      "rpm": 480,
      "tpm": 195000,
      "windowMinutes": 5,
      "isHistorical": false
    },
    "systemHealth": {
      "redisConnected": true,
      "claudeAccountsHealthy": true,
      "geminiAccountsHealthy": true,
      "droidAccountsHealthy": true,
      "uptime": 864532.5
    },
    "systemTimezone": 8
  }
}
```

**账户状态分类**:
- `normal`: 正常可用（isActive=true, status≠blocked/unauthorized, schedulable=true, 无限流）
- `abnormal`: 异常状态（isActive=false 或 status=blocked/unauthorized）
- `paused`: 暂停调度（schedulable=false 但 isActive=true）
- `rateLimited`: 被限流（rateLimitStatus.isRateLimited=true）

**实时指标说明**:
- `rpm`: 每分钟请求数（Requests Per Minute）
- `tpm`: 每分钟 Token 数（Tokens Per Minute）
- `windowMinutes`: 统计窗口（分钟，由 METRICS_WINDOW 配置）
- `isHistorical`: 是否使用历史数据（当前窗口无数据时为 true）

---

### 2.2 获取使用统计

获取所有 API Key 的使用统计。

**请求**:
```http
GET /admin/usage-stats?period=daily
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | daily | 统计周期（daily/monthly） |

**响应**:
```json
{
  "success": true,
  "data": {
    "period": "daily",
    "stats": [
      {
        "keyId": "550e8400-e29b-41d4-a716-446655440000",
        "keyName": "Production Key",
        "usage": {
          "daily": {
            "requests": 250,
            "inputTokens": 80000,
            "outputTokens": 32000,
            "cacheCreateTokens": 3500,
            "cacheReadTokens": 1800,
            "allTokens": 117300
          },
          "total": {
            "requests": 7500,
            "inputTokens": 2500000,
            "outputTokens": 1000000,
            "cacheCreateTokens": 120000,
            "cacheReadTokens": 60000,
            "allTokens": 3680000
          }
        }
      }
    ]
  }
}
```

---

### 2.3 获取按模型的使用统计和费用

获取全局按模型分组的使用统计和成本计算。

**请求**:
```http
GET /admin/model-stats?period=daily&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | daily | 统计周期（daily/monthly） |
| `startDate` | String | - | 开始日期（YYYY-MM-DD） |
| `endDate` | String | - | 结束日期（YYYY-MM-DD） |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "model": "claude-sonnet-4-5",
      "period": "custom",
      "requests": 12000,
      "inputTokens": 4500000,
      "outputTokens": 1800000,
      "cacheCreateTokens": 225000,
      "cacheReadTokens": 120000,
      "allTokens": 6645000,
      "usage": {
        "requests": 12000,
        "inputTokens": 4500000,
        "outputTokens": 1800000,
        "cacheCreateTokens": 225000,
        "cacheReadTokens": 120000,
        "totalTokens": 6645000
      },
      "costs": {
        "input": 135.00,
        "output": 270.00,
        "cacheCreate": 16.875,
        "cacheRead": 1.80,
        "total": 423.675
      },
      "formatted": {
        "input": "$135.00",
        "output": "$270.00",
        "cacheCreate": "$16.875",
        "cacheRead": "$1.80",
        "total": "$423.675"
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
      "requests": 8000,
      "inputTokens": 2400000,
      "outputTokens": 960000,
      "cacheCreateTokens": 0,
      "cacheReadTokens": 0,
      "allTokens": 3360000,
      "usage": {
        "requests": 8000,
        "inputTokens": 2400000,
        "outputTokens": 960000,
        "cacheCreateTokens": 0,
        "cacheReadTokens": 0,
        "totalTokens": 3360000
      },
      "costs": {
        "input": 60.00,
        "output": 120.00,
        "total": 180.00
      },
      "formatted": {
        "input": "$60.00",
        "output": "$120.00",
        "total": "$180.00"
      },
      "pricing": {
        "input": 0.000025,
        "output": 0.000125
      }
    }
  ]
}
```

**特殊说明**:
- 自定义日期范围最大 365 天
- 自动聚合 Bedrock 区域模型（如 `us-east-1.anthropic.claude-sonnet-4-5-v1:0` → `claude-sonnet-4-5`）
- 按总费用降序排列
- 支持跨月统计

---

## 3. VPN 隧道管理 API

**前提条件**: 需要启用 VPN 服务器模式（`VPN_SERVER_ENABLED=true`）。

### 3.1 列出所有隧道

**请求**:
```http
GET /admin/vpn/tunnels
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "tunnelId": "tunnel-550e8400",
      "name": "Production Tunnel",
      "localPort": 8080,
      "remoteHost": "internal-service.local",
      "remotePort": 80,
      "protocol": "tcp",
      "status": "active",
      "createdAt": "2026-01-02T10:00:00.000Z",
      "expiresAt": "2026-01-02T18:00:00.000Z",
      "stats": {
        "totalConnections": 150,
        "activeConnections": 8,
        "bytesReceived": 12500000,
        "bytesSent": 8500000
      }
    }
  ]
}
```

---

### 3.2 创建隧道

**请求**:
```http
POST /admin/vpn/tunnels
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Tunnel",
  "localPort": 8080,
  "remoteHost": "internal-service.local",
  "remotePort": 80,
  "protocol": "tcp",
  "ttlHours": 8
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "tunnelId": "tunnel-550e8400",
    "name": "Production Tunnel",
    "localPort": 8080,
    "remoteHost": "internal-service.local",
    "remotePort": 80,
    "protocol": "tcp",
    "status": "active",
    "createdAt": "2026-01-02T10:00:00.000Z",
    "expiresAt": "2026-01-02T18:00:00.000Z"
  }
}
```

---

### 3.3 更新隧道

**请求**:
```http
PATCH /admin/vpn/tunnels/{tunnelId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Tunnel (Updated)",
  "ttlHours": 16
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "tunnelId": "tunnel-550e8400",
    "name": "Production Tunnel (Updated)",
    "expiresAt": "2026-01-03T02:00:00.000Z",
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 3.4 删除隧道

**请求**:
```http
DELETE /admin/vpn/tunnels/{tunnelId}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true
}
```

---

### 3.5 手动触发过期清理

清理所有过期的隧道。

**请求**:
```http
POST /admin/vpn/tunnels/purge
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "removedCount": 3,
    "removedTunnels": [
      "tunnel-123",
      "tunnel-456",
      "tunnel-789"
    ]
  }
}
```

---

### 3.6 查询隧道活跃会话

**请求**:
```http
GET /admin/vpn/tunnels/{tunnelId}/sessions
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "session-001",
      "clientIp": "192.168.1.100",
      "connectedAt": "2026-01-02T10:30:00.000Z",
      "bytesReceived": 1250000,
      "bytesSent": 850000,
      "lastActivityAt": "2026-01-02T10:45:00.000Z"
    }
  ]
}
```

---

### 3.7 查询隧道近期事件

**请求**:
```http
GET /admin/vpn/tunnels/{tunnelId}/events?limit=50
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | Number | 20 | 返回记录数（最大 100） |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "eventId": "event-001",
      "type": "handshake_success",
      "timestamp": "2026-01-02T10:30:00.000Z",
      "clientIp": "192.168.1.100",
      "details": {
        "protocol": "tcp",
        "latencyMs": 25
      }
    },
    {
      "eventId": "event-002",
      "type": "connection_closed",
      "timestamp": "2026-01-02T10:25:00.000Z",
      "clientIp": "192.168.1.100",
      "details": {
        "reason": "client_disconnect"
      }
    }
  ]
}
```

---

### 3.8 清空隧道统计和事件

**请求**:
```http
POST /admin/vpn/tunnels/{tunnelId}/reset
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "statsCleared": true,
    "eventsCleared": 25
  }
}
```

---

## 4. 账户余额管理 API

**前提条件**: 需要配置支持余额查询的账户平台。

### 4.1 获取账户余额

查询指定账户的余额信息（默认优先使用本地统计）。

**请求**:
```http
GET /admin/accounts/{accountId}/balance?platform=claude-console&queryApi=false
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `platform` | String | 是 | 平台类型（claude-console/openai/gemini等） |
| `queryApi` | String | 否 | 是否触发 API 查询（默认 false） |

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-console-acc-123",
    "platform": "claude-console",
    "balance": 95.50,
    "currency": "USD",
    "quota": {
      "total": 100.00,
      "used": 4.50,
      "remaining": 95.50
    },
    "lastUpdated": "2026-01-02T10:30:00.000Z",
    "source": "cache"
  }
}
```

**支持的平台**:
- `claude-console`: Claude Console API Key 账户
- `openai`: OpenAI 账户
- `gemini-api`: Gemini API 账户
- 其他支持余额查询的平台

---

### 4.2 强制刷新账户余额

强制触发账户余额查询（优先使用脚本，Provider 仅为降级）。

**请求**:
```http
POST /admin/accounts/{accountId}/balance/refresh
Authorization: Bearer {token}
Content-Type: application/json

{
  "platform": "claude-console"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-console-acc-123",
    "platform": "claude-console",
    "balance": 95.25,
    "currency": "USD",
    "quota": {
      "total": 100.00,
      "used": 4.75,
      "remaining": 95.25
    },
    "lastUpdated": "2026-01-02T11:00:00.000Z",
    "source": "api"
  }
}
```

---

### 4.3 批量获取平台所有账户余额

**请求**:
```http
GET /admin/accounts/balance/platform/{platform}?queryApi=false
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "accountId": "claude-console-acc-123",
      "accountName": "Production Account",
      "balance": 95.50,
      "currency": "USD",
      "lastUpdated": "2026-01-02T10:30:00.000Z"
    },
    {
      "accountId": "claude-console-acc-456",
      "accountName": "Development Account",
      "balance": 48.75,
      "currency": "USD",
      "lastUpdated": "2026-01-02T10:25:00.000Z"
    }
  ]
}
```

---

### 4.4 获取余额汇总

获取所有平台的余额汇总信息（Dashboard 用）。

**请求**:
```http
GET /admin/accounts/balance/summary
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "byPlatform": {
      "claude-console": {
        "totalAccounts": 10,
        "totalBalance": 850.50,
        "currency": "USD",
        "accountsWithBalance": 8,
        "accountsLowBalance": 2,
        "lowBalanceThreshold": 10.00
      },
      "openai": {
        "totalAccounts": 5,
        "totalBalance": 320.75,
        "currency": "USD",
        "accountsWithBalance": 5,
        "accountsLowBalance": 0
      }
    },
    "summary": {
      "totalAccounts": 15,
      "totalBalance": 1171.25,
      "platformsCount": 2,
      "lastUpdated": "2026-01-02T11:00:00.000Z"
    }
  }
}
```

---

### 4.5 清除余额缓存

**请求**:
```http
DELETE /admin/accounts/{accountId}/balance/cache?platform=claude-console
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "缓存已清除"
}
```

---

### 4.6 获取账户余额脚本配置

**请求**:
```http
GET /admin/accounts/{accountId}/balance/script?platform=claude-console
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "scriptBody": "// JavaScript 代码\nreturn { balance: 100.00, currency: 'USD' }",
    "timeoutSeconds": 10,
    "baseUrl": "https://api.claude.ai",
    "apiKey": "sk-ant-***",
    "enabled": true,
    "createdAt": "2026-01-02T10:00:00.000Z",
    "updatedAt": "2026-01-02T10:30:00.000Z"
  }
}
```

---

### 4.7 保存账户余额脚本配置

**请求**:
```http
PUT /admin/accounts/{accountId}/balance/script?platform=claude-console
Authorization: Bearer {token}
Content-Type: application/json

{
  "scriptBody": "// 更新的脚本\nreturn { balance: parseFloat(response.data.balance), currency: 'USD' }",
  "timeoutSeconds": 15,
  "baseUrl": "https://api.claude.ai",
  "apiKey": "sk-ant-api12345",
  "enabled": true
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "scriptBody": "// 更新的脚本...",
    "timeoutSeconds": 15,
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 4.8 测试账户余额脚本

**请求**:
```http
POST /admin/accounts/{accountId}/balance/script/test?platform=claude-console
Authorization: Bearer {token}
Content-Type: application/json

{
  "scriptBody": "return { balance: 100.00, currency: 'USD' }",
  "timeoutSeconds": 10,
  "baseUrl": "https://api.claude.ai",
  "apiKey": "sk-ant-test",
  "token": "bearer_token_test",
  "extra": "custom_data"
}
```

**响应（成功）**:
```json
{
  "success": true,
  "data": {
    "result": {
      "balance": 100.00,
      "currency": "USD"
    },
    "executionTimeMs": 125,
    "logs": [
      "Script started",
      "API call completed",
      "Script finished"
    ]
  }
}
```

**响应（失败）**:
```json
{
  "success": false,
  "error": "Script execution timeout after 10 seconds"
}
```

**安全限制**:
- 需要启用 `BALANCE_SCRIPT_ENABLED=true`
- 脚本执行有超时限制（默认 10 秒）
- 脚本运行在沙箱环境中

---

## 5. 余额脚本管理 API

**前提条件**: 需要启用 `BALANCE_SCRIPT_ENABLED=true`。

### 5.1 获取所有脚本配置

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
      "name": "default",
      "scriptBody": "// 默认脚本\nreturn { balance: 0, currency: 'USD' }",
      "timeoutSeconds": 10,
      "description": "默认余额脚本",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T10:00:00.000Z"
    },
    {
      "name": "claude-console",
      "scriptBody": "// Claude Console 脚本...",
      "timeoutSeconds": 15,
      "description": "Claude Console 余额查询脚本",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-02T09:00:00.000Z"
    }
  ]
}
```

---

### 5.2 获取特定脚本配置

**请求**:
```http
GET /admin/balance-scripts/{name}
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "name": "claude-console",
    "scriptBody": "// Claude Console 脚本...",
    "timeoutSeconds": 15,
    "description": "Claude Console 余额查询脚本",
    "variables": {
      "baseUrl": "https://api.claude.ai",
      "apiKey": "",
      "accountId": "",
      "platform": "claude-console"
    },
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-02T09:00:00.000Z"
  }
}
```

---

### 5.3 保存脚本配置

**请求**:
```http
PUT /admin/balance-scripts/{name}
Authorization: Bearer {token}
Content-Type: application/json

{
  "scriptBody": "// 更新的脚本...",
  "timeoutSeconds": 20,
  "description": "Claude Console 余额查询脚本 v2"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "name": "claude-console",
    "scriptBody": "// 更新的脚本...",
    "timeoutSeconds": 20,
    "description": "Claude Console 余额查询脚本 v2",
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 5.4 测试脚本

**请求**:
```http
POST /admin/balance-scripts/{name}/test
Authorization: Bearer {token}
Content-Type: application/json

{
  "variables": {
    "baseUrl": "https://api.claude.ai",
    "apiKey": "sk-ant-test",
    "accountId": "claude-console-acc-123"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "result": {
      "balance": 95.50,
      "currency": "USD"
    },
    "executionTimeMs": 850,
    "logs": [
      "Script execution started",
      "Fetching balance from API",
      "API response received",
      "Script execution completed"
    ]
  }
}
```

---

## 6. 账户分组管理 API

### 6.1 创建账户分组

**请求**:
```http
POST /admin/account-groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Group",
  "platform": "claude",
  "description": "生产环境账户组"
}
```

**请求体字段**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | String | 是 | 分组名称 |
| `platform` | String | 是 | 平台类型（claude/gemini/openai/droid） |
| `description` | String | 否 | 描述信息 |

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "group-550e8400",
    "name": "Production Group",
    "platform": "claude",
    "description": "生产环境账户组",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "memberCount": 0
  }
}
```

---

### 6.2 获取所有分组

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
      "id": "group-550e8400",
      "name": "Production Group",
      "platform": "claude",
      "description": "生产环境账户组",
      "createdAt": "2026-01-02T10:30:00.000Z",
      "memberCount": 5
    },
    {
      "id": "group-660e9400",
      "name": "Development Group",
      "platform": "claude",
      "description": "开发环境账户组",
      "createdAt": "2026-01-01T15:00:00.000Z",
      "memberCount": 3
    }
  ]
}
```

---

### 6.3 获取分组详情

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
    "id": "group-550e8400",
    "name": "Production Group",
    "platform": "claude",
    "description": "生产环境账户组",
    "createdAt": "2026-01-02T10:30:00.000Z",
    "updatedAt": "2026-01-02T10:30:00.000Z",
    "memberCount": 5,
    "settings": {
      "priority": 1,
      "loadBalancing": "round-robin"
    }
  }
}
```

---

### 6.4 更新分组

**请求**:
```http
PUT /admin/account-groups/{groupId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production Group (Updated)",
  "description": "生产环境主账户组",
  "settings": {
    "priority": 2,
    "loadBalancing": "weighted"
  }
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "group-550e8400",
    "name": "Production Group (Updated)",
    "description": "生产环境主账户组",
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 6.5 删除分组

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

### 6.6 获取分组成员

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
      "platform": "claude",
      "authType": "oauth",
      "status": "active",
      "isActive": true,
      "schedulable": true
    },
    {
      "id": "claude-acc-456",
      "name": "Production Account 2",
      "platform": "claude",
      "authType": "oauth",
      "status": "active",
      "isActive": true,
      "schedulable": true
    }
  ]
}
```

**跨平台兼容性**:
- 优先按分组平台查找账户
- 兼容旧数据：若未找到则尝试其他平台
- 自动聚合 Claude 官方账户和 Claude Console 账户

---

## 7. 数据格式补充

### 7.1 并发状态数据结构

```typescript
interface ConcurrencyStatus {
  apiKeyId: string              // API Key ID
  activeCount: number           // 活跃请求数
  expiredCount: number          // 过期请求数
  queueCount: number            // 排队请求数
  maxConcurrency: number        // 最大并发限制
  availableSlots: number        // 可用槽位数
}
```

### 7.2 排队统计数据结构

```typescript
interface QueueStats {
  entered: number               // 进入排队数
  success: number               // 成功获取并发位数
  timeout: number               // 排队超时数
  cancelled: number             // 用户取消数
  socket_changed: number        // Socket 验证失败数
  rejected_overload: number     // 健康检查拒绝数
}

interface WaitTimeStats {
  count: number                 // 样本数量
  avg: number                   // 平均等待时间（毫秒）
  p50: number                   // P50 等待时间
  p90: number                   // P90 等待时间
  p99: number                   // P99 等待时间
  min: number                   // 最小等待时间
  max: number                   // 最大等待时间
}
```

### 7.3 VPN 隧道数据结构

```typescript
interface VPNTunnel {
  tunnelId: string              // 隧道 ID
  name: string                  // 隧道名称
  localPort: number             // 本地端口
  remoteHost: string            // 远程主机
  remotePort: number            // 远程端口
  protocol: 'tcp' | 'udp'       // 协议类型
  status: 'active' | 'inactive' // 状态
  createdAt: string             // 创建时间
  expiresAt: string             // 过期时间
  stats: {
    totalConnections: number    // 总连接数
    activeConnections: number   // 活跃连接数
    bytesReceived: number       // 接收字节数
    bytesSent: number           // 发送字节数
  }
}
```

### 7.4 账户余额数据结构

```typescript
interface AccountBalance {
  accountId: string             // 账户 ID
  platform: string              // 平台类型
  balance: number               // 余额
  currency: string              // 货币单位
  quota?: {
    total: number               // 总额度
    used: number                // 已使用
    remaining: number           // 剩余额度
  }
  lastUpdated: string           // 最后更新时间
  source: 'cache' | 'api' | 'script' // 数据来源
}
```

### 7.5 余额脚本配置数据结构

```typescript
interface BalanceScriptConfig {
  name: string                  // 脚本名称
  scriptBody: string            // 脚本代码（JavaScript）
  timeoutSeconds: number        // 超时时间（秒）
  description?: string          // 描述信息
  variables?: {
    baseUrl?: string            // API 基础地址
    apiKey?: string             // API Key
    token?: string              // Bearer Token
    accountId?: string          // 账户 ID
    platform?: string           // 平台类型
    extra?: string              // 额外数据
  }
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
}
```

---

## 8. 错误码参考

### 并发管理错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `CONCURRENCY_STATUS_NOT_FOUND` | 404 | 并发状态不存在 |
| `QUEUE_STATS_ERROR` | 500 | 排队统计查询失败 |
| `CLEANUP_FAILED` | 500 | 清理操作失败 |

### VPN 管理错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `VPN_SERVER_DISABLED` | 400 | VPN 服务器未启用 |
| `TUNNEL_NOT_FOUND` | 404 | 隧道不存在 |
| `TUNNEL_CREATE_FAILED` | 400 | 创建隧道失败 |
| `TUNNEL_UPDATE_FAILED` | 400 | 更新隧道失败 |
| `TUNNEL_DELETE_FAILED` | 400 | 删除隧道失败 |

### 余额管理错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `UNSUPPORTED_PLATFORM` | 400 | 不支持的平台类型 |
| `ACCOUNT_NOT_FOUND` | 404 | 账户不存在 |
| `BALANCE_QUERY_FAILED` | 500 | 余额查询失败 |
| `SCRIPT_DISABLED` | 403 | 余额脚本功能已禁用 |
| `SCRIPT_TIMEOUT` | 400 | 脚本执行超时 |
| `SCRIPT_ERROR` | 400 | 脚本执行错误 |

### 账户分组错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `GROUP_NOT_FOUND` | 404 | 分组不存在 |
| `DUPLICATE_GROUP_NAME` | 400 | 分组名称重复 |
| `INVALID_PLATFORM` | 400 | 无效的平台类型 |

---

## 9. 使用场景示例

### 场景 1: 并发排队监控和问题排查

```javascript
// 1. 查看全局排队统计
const stats = await axios.get('/admin/concurrency-queue/stats', {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('全局 P90 等待时间:', stats.data.globalStats.p90WaitTimeMs, 'ms')
console.log('超时率:', stats.data.globalStats.timeoutRate, '%')
console.log('Socket 验证失败数:', stats.data.globalStats.totalSocketChanged)

// 2. 发现某个 API Key 的 P90 等待时间过高
const problematicKey = stats.data.perKeyStats.find(s => s.waitTimeStats.p90 > 5000)
if (problematicKey) {
  console.log('问题 API Key:', problematicKey.apiKeyId)
  console.log('等待时间统计:', problematicKey.waitTimeStats)

  // 3. 清理该 Key 的排队计数
  await axios.delete(`/admin/concurrency-queue/${problematicKey.apiKeyId}`, {
    headers: { 'Authorization': 'Bearer {token}' }
  })
}

// 4. 如果发现大量 Socket 验证失败，检查代理配置或网络稳定性
if (stats.data.globalStats.totalSocketChanged > 100) {
  console.warn('检测到大量 Socket 验证失败，建议检查代理配置')
}
```

### 场景 2: Dashboard 数据展示

```javascript
// 获取完整的 Dashboard 数据
const dashboard = await axios.get('/admin/dashboard', {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 展示各平台账户健康状态
Object.entries(dashboard.data.overview.accountsByPlatform).forEach(([platform, stats]) => {
  console.log(`${platform}: ${stats.normal}/${stats.total} 正常`)
  console.log(`  - 异常: ${stats.abnormal}`)
  console.log(`  - 暂停: ${stats.paused}`)
  console.log(`  - 限流: ${stats.rateLimited}`)
})

// 展示实时指标
console.log('实时 RPM:', dashboard.data.realtimeMetrics.rpm)
console.log('实时 TPM:', dashboard.data.realtimeMetrics.tpm)
console.log('统计窗口:', dashboard.data.realtimeMetrics.windowMinutes, '分钟')

// 展示今日使用量
console.log('今日请求数:', dashboard.data.recentActivity.requestsToday)
console.log('今日 Tokens:', dashboard.data.recentActivity.tokensToday)
```

### 场景 3: VPN 隧道管理

```javascript
// 1. 创建隧道
const tunnel = await axios.post('/admin/vpn/tunnels', {
  name: 'Internal API Tunnel',
  localPort: 8080,
  remoteHost: 'internal-api.local',
  remotePort: 80,
  protocol: 'tcp',
  ttlHours: 8
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('隧道已创建:', tunnel.data.tunnelId)

// 2. 监控隧道活跃会话
const sessions = await axios.get(`/admin/vpn/tunnels/${tunnel.data.tunnelId}/sessions`, {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('活跃会话数:', sessions.data.length)

// 3. 查看隧道事件
const events = await axios.get(`/admin/vpn/tunnels/${tunnel.data.tunnelId}/events?limit=50`, {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('最近事件:', events.data)

// 4. 清理过期隧道
await axios.post('/admin/vpn/tunnels/purge', {}, {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

### 场景 4: 账户余额自动监控

```javascript
// 1. 获取余额汇总
const summary = await axios.get('/admin/accounts/balance/summary', {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 2. 检查低余额账户
Object.entries(summary.data.byPlatform).forEach(([platform, stats]) => {
  if (stats.accountsLowBalance > 0) {
    console.warn(`${platform} 平台有 ${stats.accountsLowBalance} 个账户余额低`)

    // 获取该平台所有账户余额
    const balances = await axios.get(`/admin/accounts/balance/platform/${platform}`, {
      headers: { 'Authorization': 'Bearer {token}' }
    })

    // 找出低余额账户
    const lowBalanceAccounts = balances.data.filter(
      acc => acc.balance < stats.lowBalanceThreshold
    )

    lowBalanceAccounts.forEach(acc => {
      console.warn(`- ${acc.accountName}: $${acc.balance}`)
    })
  }
})
```

### 场景 5: 余额脚本配置和测试

```javascript
// 1. 创建 Claude Console 余额脚本
const scriptConfig = {
  scriptBody: `
    // 使用环境变量
    const { baseUrl, apiKey, accountId } = variables

    // 调用 API 查询余额
    const response = await fetch(\`\${baseUrl}/v1/usage\`, {
      headers: { 'x-api-key': apiKey }
    })

    const data = await response.json()

    // 返回标准格式
    return {
      balance: parseFloat(data.balance),
      currency: 'USD',
      quota: {
        total: parseFloat(data.quota.total),
        used: parseFloat(data.quota.used),
        remaining: parseFloat(data.quota.remaining)
      }
    }
  `,
  timeoutSeconds: 15,
  description: 'Claude Console 余额查询脚本'
}

// 2. 保存脚本配置
await axios.put('/admin/balance-scripts/claude-console', scriptConfig, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 3. 测试脚本
const testResult = await axios.post('/admin/balance-scripts/claude-console/test', {
  variables: {
    baseUrl: 'https://api.claude.ai',
    apiKey: 'sk-ant-test',
    accountId: 'claude-console-acc-123'
  }
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('测试结果:', testResult.data.result)
console.log('执行时间:', testResult.data.executionTimeMs, 'ms')

// 4. 为账户绑定脚本配置
await axios.put('/admin/accounts/claude-console-acc-123/balance/script?platform=claude-console', {
  scriptBody: scriptConfig.scriptBody,
  timeoutSeconds: 15,
  baseUrl: 'https://api.claude.ai',
  apiKey: 'sk-ant-api12345',
  enabled: true
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

### 场景 6: 账户分组管理

```javascript
// 1. 创建生产环境账户组
const prodGroup = await axios.post('/admin/account-groups', {
  name: 'Production Group',
  platform: 'claude',
  description: '生产环境 Claude 账户组'
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})

// 2. 获取所有 Claude 平台分组
const groups = await axios.get('/admin/account-groups?platform=claude', {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('Claude 平台分组数:', groups.data.length)

// 3. 查看分组成员
const members = await axios.get(`/admin/account-groups/${prodGroup.data.id}/members`, {
  headers: { 'Authorization': 'Bearer {token}' }
})

console.log('分组成员:', members.data)

// 4. 更新分组设置
await axios.put(`/admin/account-groups/${prodGroup.data.id}`, {
  settings: {
    priority: 1,
    loadBalancing: 'weighted'
  }
}, {
  headers: { 'Authorization': 'Bearer {token}' }
})
```

---

## 10. 安全和性能注意事项

### 并发管理安全

1. **强制清理风险**: DELETE `/admin/concurrency/:apiKeyId` 会清理所有并发计数，包括活跃请求，仅在紧急情况使用
2. **清理操作日志**: 所有清理操作都会记录管理员用户名到日志
3. **健康检查机制**: 排队统计包含健康检查数据，避免过载时继续排队

### VPN 隧道安全

1. **访问控制**: 所有 VPN 端点需要管理员权限
2. **过期管理**: 隧道支持 TTL 自动过期，防止长期占用资源
3. **事件审计**: 所有隧道操作都记录事件日志
4. **限制**: 事件查询最大返回 100 条记录

### 余额脚本安全

1. **沙箱执行**: 脚本运行在隔离的沙箱环境中
2. **超时限制**: 脚本执行有严格的超时限制（默认 10 秒）
3. **功能开关**: 需要显式启用 `BALANCE_SCRIPT_ENABLED=true`
4. **敏感数据**: API Key 和 Token 仅在测试时传递，不存储到配置中

### 性能优化建议

1. **Dashboard 缓存**: Dashboard 数据查询较重，建议前端实现缓存机制
2. **余额查询**: 默认使用缓存，只在需要时触发 API 查询
3. **批量操作**: 使用平台级批量查询而非逐个查询账户
4. **排队统计**: 等待时间使用采样策略，避免大量数据存储

---

## 11. 完整端点清单

### 并发管理
- ✅ `GET /admin/concurrency` - 获取所有并发状态
- ✅ `GET /admin/concurrency-queue/stats` - 获取排队统计
- ✅ `DELETE /admin/concurrency-queue/:apiKeyId` - 清理特定 Key 排队
- ✅ `DELETE /admin/concurrency-queue` - 清理所有排队
- ✅ `GET /admin/concurrency/:apiKeyId` - 获取特定 Key 并发状态
- ✅ `DELETE /admin/concurrency/:apiKeyId` - 强制清理特定 Key 并发
- ✅ `DELETE /admin/concurrency` - 强制清理所有并发
- ✅ `POST /admin/concurrency/cleanup` - 清理过期并发条目

### Dashboard 统计
- ✅ `GET /admin/dashboard` - 获取系统概览
- ✅ `GET /admin/usage-stats` - 获取使用统计
- ✅ `GET /admin/model-stats` - 获取模型统计
- ✅ `POST /admin/cleanup` - 清理过期数据（系统管理）

### VPN 隧道管理
- ✅ `GET /admin/vpn/tunnels` - 列出所有隧道
- ✅ `POST /admin/vpn/tunnels` - 创建隧道
- ✅ `PATCH /admin/vpn/tunnels/:id` - 更新隧道
- ✅ `DELETE /admin/vpn/tunnels/:id` - 删除隧道
- ✅ `POST /admin/vpn/tunnels/purge` - 清理过期隧道
- ✅ `GET /admin/vpn/tunnels/:id/sessions` - 查询隧道活跃会话
- ✅ `GET /admin/vpn/tunnels/:id/events` - 查询隧道事件
- ✅ `POST /admin/vpn/tunnels/:id/reset` - 清空隧道统计

### 账户余额管理
- ✅ `GET /admin/accounts/:accountId/balance` - 获取账户余额
- ✅ `POST /admin/accounts/:accountId/balance/refresh` - 刷新账户余额
- ✅ `GET /admin/accounts/balance/platform/:platform` - 获取平台所有账户余额
- ✅ `GET /admin/accounts/balance/summary` - 获取余额汇总
- ✅ `DELETE /admin/accounts/:accountId/balance/cache` - 清除余额缓存
- ✅ `GET /admin/accounts/:accountId/balance/script` - 获取余额脚本配置
- ✅ `PUT /admin/accounts/:accountId/balance/script` - 保存余额脚本配置
- ✅ `POST /admin/accounts/:accountId/balance/script/test` - 测试余额脚本

### 余额脚本管理
- ✅ `GET /admin/balance-scripts` - 获取所有脚本配置
- ✅ `GET /admin/balance-scripts/:name` - 获取特定脚本配置
- ✅ `PUT /admin/balance-scripts/:name` - 保存脚本配置
- ✅ `POST /admin/balance-scripts/:name/test` - 测试脚本

### 账户分组管理
- ✅ `POST /admin/account-groups` - 创建账户分组
- ✅ `GET /admin/account-groups` - 获取所有分组
- ✅ `GET /admin/account-groups/:groupId` - 获取分组详情
- ✅ `PUT /admin/account-groups/:groupId` - 更新分组
- ✅ `DELETE /admin/account-groups/:groupId` - 删除分组
- ✅ `GET /admin/account-groups/:groupId/members` - 获取分组成员

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
