# Claude Relay Service - 系统管理和高级功能 API

> 本文档记录第五次扫描发现的系统管理、高级分析、OEM定制和智能路由功能

**版本**: 1.0
**最后更新**: 2026-01-02
**发现**: 第五次全面扫描

---

## 📋 本次扫描统计

| 分类 | 端点数量 | 重要度 |
|------|----------|--------|
| **Claude Relay 配置** | 3 | ⭐⭐⭐⭐⭐ 核心配置 |
| **系统管理** | 15 | ⭐⭐⭐⭐⭐ 系统功能 |
| **高级使用统计** | 10 | ⭐⭐⭐⭐ 数据分析 |
| **智能路由** | 2 | ⭐⭐⭐⭐ 统一入口 |
| **总计** | 30 | |

---

## 1. Claude Relay 配置管理 API

用于管理全局 Claude Relay 配置参数,包括会话绑定、并发控制、消息队列等核心功能。

### 1.1 获取 Claude Relay 配置

**请求**:
```http
GET /admin/claude-relay-config
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "config": {
    "claudeCodeOnlyEnabled": false,
    "globalSessionBindingEnabled": true,
    "sessionBindingErrorMessage": "This API key requires session binding",
    "sessionBindingTtlDays": 1,
    "userMessageQueueEnabled": false,
    "userMessageQueueDelayMs": 200,
    "concurrentRequestQueueEnabled": false,
    "concurrentRequestQueueMaxSize": 3,
    "concurrentRequestQueueMaxSizeMultiplier": 0,
    "concurrentRequestQueueTimeoutMs": 10000,
    "concurrentRequestQueueMaxRedisFailCount": 5,
    "concurrentRequestQueueHealthCheckEnabled": true,
    "concurrentRequestQueueHealthThreshold": 0.8
  }
}
```

**配置字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `claudeCodeOnlyEnabled` | Boolean | 仅允许 Claude Code 客户端访问 |
| `globalSessionBindingEnabled` | Boolean | 全局启用会话绑定 |
| `sessionBindingErrorMessage` | String | 会话绑定错误提示消息 |
| `sessionBindingTtlDays` | Number | 会话绑定 TTL（天） |
| `userMessageQueueEnabled` | Boolean | 启用用户消息串行队列 |
| `userMessageQueueDelayMs` | Number | 消息请求间隔（毫秒） |
| `concurrentRequestQueueEnabled` | Boolean | 启用并发请求排队 |
| `concurrentRequestQueueMaxSize` | Number | 最大排队数（固定值） |
| `concurrentRequestQueueMaxSizeMultiplier` | Number | 最大排队数倍数（相对并发限制） |
| `concurrentRequestQueueTimeoutMs` | Number | 排队超时时间（毫秒） |
| `concurrentRequestQueueMaxRedisFailCount` | Number | Redis 失败最大次数 |
| `concurrentRequestQueueHealthCheckEnabled` | Boolean | 启用健康检查 |
| `concurrentRequestQueueHealthThreshold` | Number | 健康检查阈值（0-1） |

---

### 1.2 更新 Claude Relay 配置

**请求**:
```http
PUT /admin/claude-relay-config
Authorization: Bearer {token}
Content-Type: application/json

{
  "claudeCodeOnlyEnabled": false,
  "globalSessionBindingEnabled": true,
  "sessionBindingTtlDays": 2,
  "concurrentRequestQueueEnabled": true,
  "concurrentRequestQueueMaxSize": 5,
  "concurrentRequestQueueTimeoutMs": 15000
}
```

**验证规则**:
- `sessionBindingTtlDays`: 0.01-365 天
- `userMessageQueueDelayMs`: 0-10000 毫秒
- `concurrentRequestQueueMaxSize`: 0-100
- `concurrentRequestQueueMaxSizeMultiplier`: 0-10
- `concurrentRequestQueueTimeoutMs`: 1000-300000 毫秒（1秒-5分钟）
- `concurrentRequestQueueMaxRedisFailCount`: 1-100
- `concurrentRequestQueueHealthThreshold`: 0-1

**响应**:
```json
{
  "success": true,
  "config": {
    "claudeCodeOnlyEnabled": false,
    "globalSessionBindingEnabled": true,
    "sessionBindingTtlDays": 2,
    "concurrentRequestQueueEnabled": true,
    "concurrentRequestQueueMaxSize": 5,
    "concurrentRequestQueueTimeoutMs": 15000,
    "updatedAt": "2026-01-02T11:00:00.000Z"
  },
  "message": "Configuration updated successfully"
}
```

---

### 1.3 获取会话绑定统计

**请求**:
```http
GET /admin/claude-relay-config/session-bindings
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "totalSessions": 150,
    "sessionsByAccount": {
      "claude-acc-123": 45,
      "claude-acc-456": 38,
      "gemini-acc-789": 32,
      "bedrock-acc-101": 35
    },
    "oldestSession": {
      "sessionHash": "hash_abc123",
      "accountId": "claude-acc-123",
      "createdAt": "2026-01-01T10:00:00.000Z",
      "ttl": 82800
    },
    "newestSession": {
      "sessionHash": "hash_xyz789",
      "accountId": "gemini-acc-789",
      "createdAt": "2026-01-02T10:55:00.000Z",
      "ttl": 86100
    }
  }
}
```

---

## 2. 系统管理 API

### 2.1 Claude Code Headers 管理

#### 获取所有 Claude Code Headers

**请求**:
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
        "anthropic-client-sha": "abc123def456",
        "anthropic-client-version": "1.0.58"
      }
    }
  ]
}
```

#### 清除指定账户的 Headers

**请求**:
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

### 2.2 版本更新检查

检查是否有新版本可用（通过 GitHub API）。

**请求**:
```http
GET /admin/check-updates
Authorization: Bearer {token}
```

**响应（有更新）**:
```json
{
  "success": true,
  "data": {
    "currentVersion": "1.0.0",
    "latestVersion": "1.1.0",
    "hasUpdate": true,
    "updateAvailable": true,
    "releaseNotes": "## v1.1.0\n\n### New Features\n- 新增并发请求排队功能\n- 支持 OEM 定制化\n\n### Bug Fixes\n- 修复若干已知问题\n\n### Performance\n- 优化 Redis 查询性能\n",
    "downloadUrl": "https://github.com/wei-shaw/claude-relay-service/releases/tag/v1.1.0",
    "publishedAt": "2026-01-01T00:00:00Z"
  }
}
```

**响应（无更新）**:
```json
{
  "success": true,
  "data": {
    "currentVersion": "1.0.0",
    "latestVersion": "1.0.0",
    "hasUpdate": false,
    "updateAvailable": false,
    "message": "You are running the latest version"
  }
}
```

**缓存机制**:
- 缓存时间: 1 小时
- 网络错误时返回缓存数据
- GitHub 仓库无 releases 时返回 404

---

### 2.3 运行时信息查询

获取系统运行模式和 WebSocket/VPN 状态。

**请求**:
```http
GET /admin/runtime-info
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "runtimeMode": "standalone",
    "wsClientEnabled": false,
    "vpnServerEnabled": false,
    "version": "1.0.0",
    "environment": "production",
    "uptime": 864532.5
  }
}
```

**运行模式说明**:
- `standalone`: 独立模式（默认）
- `ws-client`: WebSocket 客户端模式
- `vpn-server`: VPN 服务器模式

---

### 2.4 OEM 定制化设置

#### 获取 OEM 设置（公开接口，无需认证）

**请求**:
```http
GET /admin/oem-settings
```

**响应**:
```json
{
  "success": true,
  "data": {
    "siteName": "Claude Relay Service",
    "siteIcon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "publicStatsEnabled": true,
    "ldapEnabled": false
  }
}
```

#### 更新 OEM 设置

**请求**:
```http
PUT /admin/oem-settings
Authorization: Bearer {token}
Content-Type: application/json

{
  "siteName": "My AI Gateway",
  "siteIcon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "publicStatsEnabled": false
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "siteName": "My AI Gateway",
    "siteIcon": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
    "publicStatsEnabled": false,
    "updatedAt": "2026-01-02T11:00:00.000Z"
  },
  "message": "OEM settings updated successfully"
}
```

---

### 2.5 公开统计数据

用于首页展示的公开统计数据（无需认证）。

**请求**:
```http
GET /admin/public-stats
```

**响应（启用公开统计）**:
```json
{
  "success": true,
  "enabled": true,
  "data": {
    "serviceStatus": "operational",
    "platforms": {
      "claude": {
        "available": true,
        "accountCount": 8,
        "healthyCount": 7
      },
      "gemini": {
        "available": true,
        "accountCount": 6,
        "healthyCount": 5
      },
      "openai": {
        "available": true,
        "accountCount": 3,
        "healthyCount": 2
      },
      "bedrock": {
        "available": true,
        "accountCount": 2,
        "healthyCount": 2
      }
    },
    "todayStats": {
      "totalRequests": 1250,
      "totalTokens": 450000,
      "inputTokens": 280000,
      "outputTokens": 120000,
      "cacheCreateTokens": 30000,
      "cacheReadTokens": 20000
    },
    "modelDistribution": [
      {
        "model": "claude-sonnet-4-5",
        "requests": 650,
        "percentage": 52.0
      },
      {
        "model": "gemini-2.5-pro",
        "requests": 400,
        "percentage": 32.0
      },
      {
        "model": "claude-opus-4",
        "requests": 200,
        "percentage": 16.0
      }
    ],
    "timestamp": "2026-01-02T10:30:00.000Z"
  }
}
```

**响应（未启用公开统计）**:
```json
{
  "success": true,
  "enabled": false,
  "data": null
}
```

---

### 2.6 Claude Code 版本管理

#### 获取统一 User-Agent

**请求**:
```http
GET /admin/claude-code-version
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "version": "1.0.58",
    "userAgent": "claude-cli/1.0.58 (external, cli)",
    "source": "cache",
    "cachedAt": "2026-01-02T00:00:00.000Z",
    "expiresAt": "2026-01-03T00:00:00.000Z"
  }
}
```

**字段说明**:
- `source`: `cache`（缓存）或 `account`（从账户获取）
- 缓存 TTL: 1 天（每日更新）

#### 清除版本缓存

**请求**:
```http
POST /admin/claude-code-version/clear
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "message": "Claude Code version cache cleared successfully"
}
```

---

## 3. 高级使用统计 API

### 3.1 账户使用统计

#### 获取所有账户使用统计

**请求**:
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
      "accountName": "Production Account",
      "accountType": "claude-official",
      "platform": "claude",
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

#### 获取单个账户使用统计

**请求**:
```http
GET /admin/accounts/{accountId}/usage-stats
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-acc-123",
    "accountName": "Production Account",
    "daily": {
      "requests": 150,
      "inputTokens": 50000,
      "outputTokens": 20000,
      "allTokens": 73000
    },
    "total": {
      "requests": 1500,
      "inputTokens": 500000,
      "outputTokens": 200000,
      "allTokens": 730000
    },
    "lastRequest": "2026-01-02T10:25:00.000Z"
  }
}
```

---

### 3.2 账户使用历史

获取账户最近 30 天的使用历史。

**请求**:
```http
GET /admin/accounts/{accountId}/usage-history
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "accountId": "claude-acc-123",
    "history": [
      {
        "date": "2026-01-02",
        "requests": 150,
        "tokens": 73000,
        "inputTokens": 50000,
        "outputTokens": 20000,
        "cacheCreateTokens": 2000,
        "cacheReadTokens": 1000
      },
      {
        "date": "2026-01-01",
        "requests": 145,
        "tokens": 70500,
        "inputTokens": 48000,
        "outputTokens": 19500,
        "cacheCreateTokens": 1900,
        "cacheReadTokens": 1100
      }
    ],
    "summary": {
      "totalDays": 30,
      "totalRequests": 4200,
      "totalTokens": 2100000,
      "avgRequestsPerDay": 140,
      "avgTokensPerDay": 70000
    }
  }
}
```

---

### 3.3 使用趋势分析

支持小时级和天级粒度的趋势分析。

**请求**:
```http
GET /admin/usage-trend?days=7&granularity=hour
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `days` | Number | 7 | 统计天数（1-30） |
| `granularity` | String | day | 粒度（hour/day） |
| `startDate` | String | - | 开始日期（YYYY-MM-DD） |
| `endDate` | String | - | 结束日期（YYYY-MM-DD） |

**响应（小时粒度）**:
```json
{
  "success": true,
  "granularity": "hour",
  "data": [
    {
      "timestamp": "2026-01-02T10:00:00.000Z",
      "hour": "10",
      "date": "2026-01-02",
      "requests": 125,
      "tokens": 52000,
      "inputTokens": 32000,
      "outputTokens": 13000,
      "cacheCreateTokens": 4000,
      "cacheReadTokens": 3000,
      "byModel": {
        "claude-sonnet-4-5": {
          "requests": 75,
          "tokens": 32000
        },
        "gemini-2.5-pro": {
          "requests": 50,
          "tokens": 20000
        }
      }
    }
  ],
  "summary": {
    "totalRequests": 8400,
    "totalTokens": 3500000,
    "avgRequestsPerHour": 50,
    "avgTokensPerHour": 20833,
    "peakHour": {
      "timestamp": "2026-01-02T14:00:00.000Z",
      "requests": 280
    }
  }
}
```

---

### 3.4 API Key 模型统计

获取 API Key 按模型分组的详细统计。

**请求**:
```http
GET /admin/api-keys/{keyId}/model-stats
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "keyName": "Production Key",
    "modelStats": [
      {
        "model": "claude-sonnet-4-5",
        "requests": 800,
        "inputTokens": 300000,
        "outputTokens": 120000,
        "cacheCreateTokens": 15000,
        "cacheReadTokens": 8000,
        "allTokens": 443000,
        "cost": {
          "input": 9.00,
          "output": 18.00,
          "cacheCreate": 1.125,
          "cacheRead": 0.120,
          "total": 28.245
        }
      },
      {
        "model": "gemini-2.5-pro",
        "requests": 700,
        "inputTokens": 200000,
        "outputTokens": 80000,
        "cacheCreateTokens": 0,
        "cacheReadTokens": 0,
        "allTokens": 280000,
        "cost": {
          "input": 5.00,
          "output": 10.00,
          "total": 15.00
        }
      }
    ],
    "totals": {
      "requests": 1500,
      "tokens": 723000,
      "cost": 43.245
    }
  }
}
```

---

### 3.5 账户使用趋势（按组）

按账户组（claude/openai/gemini/droid）查看趋势。

**请求**:
```http
GET /admin/account-usage-trend?group=claude&days=7
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `group` | String | claude | 账户组（claude/openai/gemini/droid） |
| `days` | Number | 7 | 统计天数 |

**响应**:
```json
{
  "success": true,
  "group": "claude",
  "data": [
    {
      "date": "2026-01-02",
      "totalRequests": 450,
      "totalTokens": 180000,
      "totalCost": 12.50,
      "byAccount": {
        "claude-acc-123": {
          "requests": 150,
          "tokens": 73000,
          "cost": 5.20
        },
        "claude-acc-456": {
          "requests": 180,
          "tokens": 65000,
          "cost": 4.50
        },
        "bedrock-acc-789": {
          "requests": 120,
          "tokens": 42000,
          "cost": 2.80
        }
      }
    }
  ],
  "summary": {
    "totalDays": 7,
    "totalRequests": 3150,
    "totalTokens": 1260000,
    "totalCost": 87.50,
    "avgRequestsPerDay": 450,
    "avgCostPerDay": 12.50
  }
}
```

---

### 3.6 API Keys 使用趋势

**请求**:
```http
GET /admin/api-keys-usage-trend?days=7
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-02",
      "totalRequests": 1250,
      "totalTokens": 450000,
      "totalCost": 32.50,
      "byApiKey": {
        "550e8400-e29b-41d4-a716-446655440000": {
          "keyName": "Production Key",
          "requests": 450,
          "tokens": 180000,
          "cost": 12.50
        },
        "660e9400-e29b-41d4-a716-446655440001": {
          "keyName": "Development Key",
          "requests": 800,
          "tokens": 270000,
          "cost": 20.00
        }
      }
    }
  ],
  "summary": {
    "totalDays": 7,
    "totalRequests": 8750,
    "totalTokens": 3150000,
    "totalCost": 227.50,
    "activeKeys": 15,
    "avgRequestsPerDay": 1250,
    "avgCostPerDay": 32.50
  }
}
```

---

### 3.7 使用成本计算

**请求**:
```http
GET /admin/usage-costs?startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**响应**:
```json
{
  "success": true,
  "period": {
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  },
  "costs": {
    "total": 850.50,
    "breakdown": {
      "input": 320.00,
      "output": 450.00,
      "cacheCreate": 50.50,
      "cacheRead": 30.00
    },
    "byPlatform": {
      "claude": 520.00,
      "gemini": 230.50,
      "openai": 100.00
    },
    "byModel": {
      "claude-sonnet-4-5": 380.00,
      "claude-opus-4": 140.00,
      "gemini-2.5-pro": 230.50,
      "gpt-5": 100.00
    }
  },
  "usage": {
    "totalRequests": 25000,
    "totalTokens": 10500000,
    "inputTokens": 6500000,
    "outputTokens": 2800000,
    "cacheCreateTokens": 800000,
    "cacheReadTokens": 400000
  }
}
```

---

### 3.8 API Key 使用记录时间线

**请求**:
```http
GET /admin/api-keys/{keyId}/usage-records?page=1&pageSize=20&startDate=2026-01-01&endDate=2026-01-31
Authorization: Bearer {token}
```

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| `page` | Number | 页码（默认 1） |
| `pageSize` | Number | 每页数量（默认 20） |
| `startDate` | String | 开始日期（YYYY-MM-DD） |
| `endDate` | String | 结束日期（YYYY-MM-DD） |
| `model` | String | 模型筛选 |
| `account` | String | 账户筛选 |

**响应**:
```json
{
  "success": true,
  "data": {
    "records": [
      {
        "timestamp": "2026-01-02T10:30:15.123Z",
        "model": "claude-sonnet-4-5",
        "accountId": "claude-acc-123",
        "accountName": "Production Account",
        "inputTokens": 1250,
        "outputTokens": 520,
        "cacheCreateTokens": 150,
        "cacheReadTokens": 80,
        "ephemeralTokensUsed5m": 200,
        "ephemeralTokensUsed1h": 300,
        "allTokens": 2500,
        "cost": {
          "input": 0.0375,
          "output": 0.078,
          "cacheCreate": 0.01125,
          "cacheRead": 0.0012,
          "total": 0.12795
        },
        "responseTimeMs": 2500,
        "isLongContext": false
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalPages": 125,
      "totalRecords": 2500,
      "hasMore": true
    },
    "summary": {
      "totalRequests": 2500,
      "totalTokens": 6250000,
      "totalCost": 319.875,
      "avgResponseTimeMs": 2450,
      "longContextRequests": 85
    },
    "filters": {
      "startDate": "2026-01-01",
      "endDate": "2026-01-31",
      "model": null,
      "account": null
    },
    "availableFilters": {
      "models": ["claude-sonnet-4-5", "gemini-2.5-pro"],
      "accounts": ["claude-acc-123", "gemini-acc-456"]
    }
  }
}
```

**数据字段说明**:
- `ephemeralTokensUsed5m`: 5分钟内临时 token 使用量
- `ephemeralTokensUsed1h`: 1小时内临时 token 使用量
- `isLongContext`: 是否为长上下文请求（输入 > 50000 tokens）
- `responseTimeMs`: 响应时间（毫秒）

---

### 3.9 账户使用记录时间线

**请求**:
```http
GET /admin/accounts/{accountId}/usage-records?page=1&pageSize=20
Authorization: Bearer {token}
```

**响应格式与 API Key 使用记录相同**,额外包含:
- `apiKeyId`: 使用的 API Key ID
- `apiKeyName`: API Key 名称

---

## 4. 智能路由 API

### 4.1 统一 Chat Completions 端点

自动根据模型名称检测后端（Claude/Gemini/OpenAI）并路由到相应服务。

**请求**:
```http
POST /v1/chat/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "claude-sonnet-4-5-20250929",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ],
  "stream": false
}
```

**模型检测规则**:
- `claude-*` → Claude 后端
- `gemini-*` → Gemini 后端
- `gpt-*` → OpenAI 后端
- 其他 → Claude 后端（默认）

**响应**:
根据检测到的后端返回相应格式:
- Claude: 标准 Claude Messages API 格式
- Gemini: 转换为 Gemini 格式
- OpenAI: OpenAI 格式

**示例（Claude 后端）**:
```json
{
  "id": "msg_01XYZ...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "Hello! How can I help you?"
    }
  ],
  "model": "claude-sonnet-4-5-20250929",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 12,
    "output_tokens": 25
  }
}
```

**权限检查**:
- 自动检查 API Key 权限（all/claude/gemini/openai）
- 无权限时返回 403 错误

---

### 4.2 统一 Completions 端点

传统 Completions 格式,自动转换为 Chat 格式并智能路由。

**请求**:
```http
POST /v1/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gemini-2.5-pro",
  "prompt": "Hello, world!",
  "max_tokens": 100,
  "temperature": 0.7
}
```

**转换逻辑**:
1. 将 `prompt` 转换为 `messages: [{ role: "user", content: prompt }]`
2. 检测模型类型
3. 路由到相应后端

**响应**:
与 `/v1/chat/completions` 相同,根据检测到的后端返回相应格式。

---

## 5. 数据格式补充

### 5.1 并发请求排队统计

**排队状态类型**:
- `entered`: 进入排队
- `success`: 成功获取并发位
- `timeout`: 排队超时
- `cancelled`: 用户取消（客户端断开）
- `socket_changed`: Socket 身份验证失败（HTTP Keep-Alive 连接复用）
- `rejected_overload`: 健康检查拒绝（队列过载保护）

**等待时间百分位数**:
- `p50`: 中位数等待时间
- `p90`: P90 等待时间
- `p99`: P99 等待时间

**健康检查机制**:
- 当 P90 等待时间超过 `concurrentRequestQueueHealthThreshold` × `concurrentRequestQueueTimeoutMs` 时
- 新请求快速失败（返回 429）
- 避免队列过载时继续排队

### 5.2 会话绑定数据结构

```typescript
interface StickySession {
  sessionHash: string       // 会话哈希（基于请求内容）
  accountId: string         // 绑定的账户 ID
  accountType: string       // 账户类型
  createdAt: string         // 创建时间
  lastUsedAt: string        // 最后使用时间
  ttl: number               // 剩余 TTL（秒）
  renewalThreshold: number  // 续期阈值（秒）
  autoRenew: boolean        // 是否自动续期
}
```

### 5.3 OEM 设置数据结构

```typescript
interface OEMSettings {
  siteName: string          // 站点名称
  siteIcon: string          // 站点图标（Base64 或 URL）
  publicStatsEnabled: boolean // 启用公开统计
  ldapEnabled: boolean      // LDAP 认证状态（只读）
}
```

### 5.4 公开统计数据结构

```typescript
interface PublicStats {
  serviceStatus: 'operational' | 'degraded' | 'down'
  platforms: {
    [platform: string]: {
      available: boolean
      accountCount: number
      healthyCount: number
    }
  }
  todayStats: {
    totalRequests: number
    totalTokens: number
    inputTokens: number
    outputTokens: number
    cacheCreateTokens: number
    cacheReadTokens: number
  }
  modelDistribution: Array<{
    model: string
    requests: number
    percentage: number
  }>
  timestamp: string
}
```

---

## 6. 使用场景示例

### 场景 1: 启用并发请求排队

```javascript
// 1. 更新配置启用并发排队
await axios.put('/admin/claude-relay-config', {
  concurrentRequestQueueEnabled: true,
  concurrentRequestQueueMaxSize: 10,          // 固定最大排队数
  concurrentRequestQueueMaxSizeMultiplier: 2, // 并发限制×2
  concurrentRequestQueueTimeoutMs: 15000,     // 15秒超时
  concurrentRequestQueueHealthCheckEnabled: true,
  concurrentRequestQueueHealthThreshold: 0.8  // P90 超过 80% 超时时快速失败
})

// 2. 监控排队统计
const stats = await axios.get('/admin/concurrency-queue/stats')
console.log('P90 等待时间:', stats.data.globalStats.p90WaitTimeMs, 'ms')
console.log('超时率:', stats.data.globalStats.timeoutRate, '%')
console.log('快速失败数:', stats.data.globalStats.totalRejectedOverload)
```

### 场景 2: 配置 OEM 定制化

```javascript
// 1. 上传自定义站点图标
const iconBase64 = await convertImageToBase64('my-logo.png')

// 2. 更新 OEM 设置
await axios.put('/admin/oem-settings', {
  siteName: 'My Company AI Gateway',
  siteIcon: iconBase64,
  publicStatsEnabled: true
})

// 3. 公开统计数据将显示在首页
// 访问 /admin/public-stats（无需认证）
```

### 场景 3: 使用智能路由统一端点

```javascript
// 客户端无需关心后端类型，自动路由

// 使用 Claude 模型
await axios.post('/v1/chat/completions', {
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  headers: { 'x-api-key': 'cr_...' }
})

// 使用 Gemini 模型（自动路由到 Gemini 后端）
await axios.post('/v1/chat/completions', {
  model: 'gemini-2.5-pro',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  headers: { 'x-api-key': 'cr_...' }
})

// 使用 OpenAI 模型（自动路由到 OpenAI 后端）
await axios.post('/v1/chat/completions', {
  model: 'gpt-5',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  headers: { 'x-api-key': 'cr_...' }
})
```

### 场景 4: 分析使用趋势

```javascript
// 1. 查看小时级趋势
const hourlyTrend = await axios.get('/admin/usage-trend', {
  params: {
    days: 1,
    granularity: 'hour'
  }
})

// 2. 查看账户组趋势
const claudeTrend = await axios.get('/admin/account-usage-trend', {
  params: {
    group: 'claude',
    days: 7
  }
})

// 3. 查看 API Key 详细记录
const records = await axios.get('/admin/api-keys/550e8400.../usage-records', {
  params: {
    page: 1,
    pageSize: 50,
    startDate: '2026-01-01',
    endDate: '2026-01-31',
    model: 'claude-sonnet-4-5'
  }
})

console.log('平均响应时间:', records.data.summary.avgResponseTimeMs, 'ms')
console.log('长上下文请求:', records.data.summary.longContextRequests)
```

---

## 7. 错误码参考

### 并发请求排队错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `QUEUE_TIMEOUT` | 429 | 排队超时 |
| `QUEUE_OVERLOAD` | 429 | 队列过载（健康检查拒绝） |
| `REDIS_QUEUE_ERROR` | 500 | Redis 排队操作失败 |
| `SOCKET_AUTH_FAILED` | 401 | Socket 身份验证失败 |

### OEM 设置错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `INVALID_SITE_NAME` | 400 | 站点名称格式无效 |
| `INVALID_ICON_FORMAT` | 400 | 图标格式无效（非 Base64 或 URL） |

### 智能路由错误

| 错误码 | HTTP 状态 | 说明 |
|--------|-----------|------|
| `UNSUPPORTED_BACKEND` | 500 | 不支持的后端类型 |
| `PERMISSION_DENIED` | 403 | API Key 无权限访问指定后端 |
| `INVALID_MODEL` | 400 | 无效的模型名称 |

---

## 8. 性能优化建议

### 并发请求排队优化

1. **调整超时参数**:
   - 轻量级请求: `concurrentRequestQueueTimeoutMs = 5000` (5秒)
   - 中等请求: `concurrentRequestQueueTimeoutMs = 10000` (10秒，默认)
   - 重量级请求: `concurrentRequestQueueTimeoutMs = 20000` (20秒)

2. **调整最大排队数**:
   - 低负载: 固定值 `maxSize = 3`
   - 高负载: 动态值 `maxSize = 0, multiplier = 2` (并发限制×2)

3. **启用健康检查**:
   ```json
   {
     "concurrentRequestQueueHealthCheckEnabled": true,
     "concurrentRequestQueueHealthThreshold": 0.8
   }
   ```

### 使用统计查询优化

1. **分页查询**: 使用分页避免一次性加载大量数据
2. **日期范围限制**: 查询时指定合理的日期范围
3. **缓存利用**: 系统自动缓存常用统计数据

### OEM 定制化优化

1. **图标大小**: 建议图标文件 < 50KB
2. **图标格式**: 推荐 PNG 格式，使用 Base64 编码
3. **公开统计缓存**: 公开统计数据每分钟更新一次

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
