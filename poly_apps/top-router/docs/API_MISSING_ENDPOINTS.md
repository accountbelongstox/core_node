# Claude Relay Service - 遗漏API端点完整清单

> 本文档列出所有在前三份文档中遗漏的重要 API 端点

**版本**: 1.0
**最后更新**: 2026-01-02
**发现**: 第二次全面扫描

---

## ⚠️ 重要发现

经过全面扫描，项目共有 **366 个路由定义**，之前的文档仅覆盖了约 **120 个**。

本文档补充剩余的 **246+ 个遗漏端点**。

---

## 📚 遗漏的主要功能模块

### 1. Client 管理系统（WebSocket 客户端）

这是一个完整的远程客户端管理系统，通过 WebSocket 连接管理分布式客户端。

#### 1.1 Client 基础管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/supported-clients` | GET | 获取支持的客户端类型列表 |
| `/admin/clients` | GET | 获取所有客户端列表（含实时连接状态） |
| `/admin/clients` | POST | 创建新客户端（注册 API Key） |
| `/admin/clients/:id` | GET | 获取单个客户端详情 |
| `/admin/clients/:id` | PUT | 更新客户端配置 |
| `/admin/clients/:id` | DELETE | 删除客户端 |
| `/admin/clients/:id/toggle-schedulable` | PUT | 切换客户端可调度状态 |
| `/admin/clients/:id/disconnect` | POST | 断开客户端连接 |

**创建客户端请求示例**:
```json
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

**客户端响应示例**:
```json
{
  "success": true,
  "data": {
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
    "priority": 1,
    "schedulable": true,
    "isActive": true,
    "createdAt": "2026-01-02T10:30:00.000Z",
    "lastConnectedAt": "2026-01-02T10:35:00.000Z"
  }
}
```

---

#### 1.2 Client 配置管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/config` | GET | 获取客户端当前配置 |
| `/admin/clients/:clientId/config` | POST | 下发新配置到客户端 |
| `/admin/clients/:clientId/config/history` | GET | 获取配置历史记录 |
| `/admin/clients/:clientId/system-health` | GET | 查询客户端系统健康状态 |

**配置下发示例**:
```json
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

---

#### 1.3 Client 账户管理（远程操作）

通过 WebSocket 代理管理客户端上的账户。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/accounts` | GET | 获取客户端所有账户 |
| `/admin/clients/:clientId/accounts` | POST | 在客户端上执行账户操作 |
| `/admin/clients/:clientId/generate-oauth-url` | POST | 生成 OAuth URL（通过客户端） |
| `/admin/clients/:clientId/exchange-oauth-code` | POST | 交换 OAuth 代码（通过客户端） |

**账户类型路由（支持所有平台）**:
```
/admin/clients/:clientId/claude-accounts              # Claude 账户
/admin/clients/:clientId/claude-console-accounts      # Claude Console
/admin/clients/:clientId/gemini-accounts              # Gemini
/admin/clients/:clientId/openai-accounts              # OpenAI
/admin/clients/:clientId/bedrock-accounts             # Bedrock
/admin/clients/:clientId/droid-accounts               # Droid
/admin/clients/:clientId/ccr-accounts                 # CCR
/admin/clients/:clientId/azure-openai-accounts        # Azure OpenAI
/admin/clients/:clientId/gemini-api-accounts          # Gemini API
/admin/clients/:clientId/openai-responses-accounts    # OpenAI Responses
```

**每种账户类型支持的操作**:
- `GET /:segment` - 列出账户
- `POST /:segment` - 创建账户
- `PUT /:segment/:accountId` - 更新账户
- `DELETE /:segment/:accountId` - 删除账户
- `PUT /:segment/:accountId/toggle` - 切换启用/禁用
- `POST /:segment/:accountId/reset-status` - 重置状态
- `PUT /:segment/:accountId/toggle-schedulable` - 切换可调度

---

#### 1.4 Client OAuth 流程（远程）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/:segment/generate-auth-url` | POST | 生成授权URL |
| `/admin/clients/:clientId/:segment/exchange-code` | POST | 交换授权码 |
| `/admin/clients/:clientId/claude-accounts/generate-setup-token-url` | POST | 生成Setup Token URL |
| `/admin/clients/:clientId/claude-accounts/exchange-setup-token-code` | POST | 交换Setup Token |
| `/admin/clients/:clientId/claude-accounts/oauth-with-cookie` | POST | Cookie方式OAuth |
| `/admin/clients/:clientId/claude-accounts/setup-token-with-cookie` | POST | Cookie方式Setup Token |

---

#### 1.5 Client 账户扩展功能

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/accounts/:accountId/usage-history` | GET | 账户使用历史 |
| `/admin/clients/:clientId/accounts/:accountId/balance` | GET | 查询账户余额 |
| `/admin/clients/:clientId/accounts/:accountId/balance/refresh` | POST | 刷新账户余额 |
| `/admin/clients/:clientId/accounts/balance/platform/:platform` | GET | 按平台查询余额 |
| `/admin/clients/:clientId/accounts/binding-counts` | GET | 账户绑定数统计 |
| `/admin/clients/:clientId/accounts/:accountId/balance/script` | GET | 获取余额脚本 |
| `/admin/clients/:clientId/accounts/:accountId/balance/script` | PUT | 更新余额脚本 |
| `/admin/clients/:clientId/accounts/:accountId/balance/script/test` | POST | 测试余额脚本 |

---

#### 1.6 Client 测试功能

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/claude-accounts/:accountId/test` | POST | 测试Claude账户（流式） |
| `/admin/clients/:clientId/claude-console-accounts/:accountId/test` | POST | 测试Console账户 |
| `/admin/clients/:clientId/claude-accounts/:accountId/test-config` | GET | 获取测试配置 |
| `/admin/clients/:clientId/claude-accounts/:accountId/test-config` | PUT | 更新测试配置 |
| `/admin/clients/:clientId/claude-accounts/:accountId/test-history` | GET | 测试历史记录 |

---

#### 1.7 Client 其他功能

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/clients/:clientId/api-keys` | GET | 获取客户端API Keys |
| `/admin/clients/:clientId/account-groups` | GET | 获取账户组 |
| `/admin/clients/:clientId/account-groups` | POST | 创建账户组 |
| `/admin/clients/:clientId/account-groups/:groupId` | PUT | 更新账户组 |
| `/admin/clients/:clientId/account-groups/:groupId` | DELETE | 删除账户组 |
| `/admin/clients/:clientId/account-groups/:groupId/members` | GET | 获取组成员 |
| `/admin/clients/:clientId/claude-accounts/usage` | GET | Claude账户使用量 |
| `/admin/clients/:clientId/claude-console-accounts/:accountId/usage` | GET | Console账户使用量 |
| `/admin/clients/:clientId/openai-responses-accounts/auto-recovery-configs` | GET | 自动恢复配置 |
| `/admin/clients/:clientId/claude-code-version` | GET | Claude Code版本 |
| `/admin/clients/:clientId/claude-code-version/clear` | POST | 清除版本缓存 |
| `/admin/clients/:clientId/claude-accounts/:accountId/refresh` | POST | 刷新Token |

---

### 2. VPN 隧道管理

用于管理 VPN 隧道连接。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/vpn/tunnels` | GET | 列出所有VPN隧道（含统计） |
| `/admin/vpn/tunnels` | POST | 创建新隧道 |
| `/admin/vpn/tunnels/:id` | PATCH | 更新隧道配置 |
| `/admin/vpn/tunnels/:id` | DELETE | 删除隧道 |
| `/admin/vpn/tunnels/purge` | POST | 清理过期隧道 |
| `/admin/vpn/tunnels/:id/sessions` | GET | 查询隧道活跃会话 |
| `/admin/vpn/tunnels/:id/events` | GET | 查询隧道事件日志 |

**创建隧道示例**:
```json
{
  "name": "Production Tunnel",
  "remoteHost": "vpn.example.com",
  "remotePort": 1194,
  "protocol": "openvpn",
  "credentials": {
    "username": "user",
    "password": "pass"
  },
  "autoReconnect": true,
  "maxRetries": 3
}
```

**隧道响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "tunnelId": "tunnel-001",
      "name": "Production Tunnel",
      "status": "connected",
      "remoteHost": "vpn.example.com",
      "remotePort": 1194,
      "localPort": 8080,
      "createdAt": "2026-01-02T10:00:00.000Z",
      "connectedAt": "2026-01-02T10:01:00.000Z",
      "stats": {
        "bytesSent": 1024000,
        "bytesReceived": 2048000,
        "activeSessions": 5,
        "uptime": 3600
      }
    }
  ]
}
```

---

### 3. 数据同步和导出

用于服务器间数据迁移。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/sync/export-accounts` | GET | 导出所有账户数据（含密钥） |

**查询参数**:
- `include_secrets=true` - 必须设置为true才能导出敏感数据

**响应示例**:
```json
{
  "success": true,
  "data": {
    "exportedAt": "2026-01-02T10:30:00.000Z",
    "accounts": {
      "claude": [
        {
          "id": "claude-acc-123",
          "name": "Production Account",
          "claudeAiOauth": {
            "accessToken": "encrypted_token",
            "refreshToken": "encrypted_refresh",
            "expiresAt": "2026-01-02T11:30:00.000Z"
          },
          "proxy": {
            "protocol": "socks5",
            "host": "proxy.example.com",
            "port": 1080,
            "username": "user",
            "password": "pass"
          },
          "isActive": true,
          "schedulable": true
        }
      ],
      "gemini": [...],
      "openai": [...],
      "bedrock": [...]
    },
    "totalAccounts": 25
  }
}
```

---

### 4. API 统计查询（用户自查询）

供用户查询自己 API Key 的使用统计。

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api-stats/api/get-key-id` | POST | 通过API Key获取Key ID |
| `/api-stats/api/user-stats` | POST | 查询API Key使用统计 |

**获取 Key ID 示例**:
```http
POST /api-stats/api/get-key-id
Content-Type: application/json

{
  "apiKey": "cr_1234567890abcdef..."
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**查询统计示例（通过API Key）**:
```http
POST /api-stats/api/user-stats
Content-Type: application/json

{
  "apiKey": "cr_1234567890abcdef..."
}
```

**查询统计示例（通过ID）**:
```http
POST /api-stats/api/user-stats
Content-Type: application/json

{
  "apiId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "keyId": "550e8400-e29b-41d4-a716-446655440000",
    "keyName": "Production Key",
    "isActive": true,
    "usage": {
      "total": {
        "requests": 1500,
        "inputTokens": 500000,
        "outputTokens": 200000,
        "allTokens": 725000
      },
      "daily": {
        "requests": 150,
        "inputTokens": 50000,
        "outputTokens": 20000,
        "allTokens": 72500
      },
      "weekly": {
        "requests": 1050,
        "inputTokens": 350000,
        "outputTokens": 140000,
        "allTokens": 507500
      },
      "monthly": {
        "requests": 4500,
        "inputTokens": 1500000,
        "outputTokens": 600000,
        "allTokens": 2175000
      }
    },
    "costs": {
      "total": 125.50,
      "daily": 4.25,
      "weekly": 29.75,
      "monthly": 125.50
    },
    "limits": {
      "tokenLimit": 0,
      "concurrencyLimit": 10,
      "dailyCostLimit": 10.0,
      "totalCostLimit": 200.0
    },
    "currentConcurrency": 3,
    "expiresAt": "2026-12-31T23:59:59.000Z"
  }
}
```

---

### 5. 账户余额管理

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/account-balance/query` | POST | 批量查询账户余额 |

**请求示例**:
```json
{
  "accountIds": [
    "claude-console-acc-123",
    "gemini-acc-456"
  ],
  "platform": "claude-console"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "accountId": "claude-console-acc-123",
      "accountName": "Production Console",
      "platform": "claude-console",
      "balance": 95.50,
      "currency": "USD",
      "quota": {
        "total": 100.00,
        "used": 4.50,
        "remaining": 95.50,
        "percentage": 95.5
      },
      "lastUpdated": "2026-01-02T10:30:00.000Z"
    },
    {
      "accountId": "gemini-acc-456",
      "accountName": "Gemini Account",
      "platform": "gemini",
      "balance": 50.00,
      "currency": "USD",
      "quota": {
        "total": 50.00,
        "used": 0.00,
        "remaining": 50.00,
        "percentage": 100.0
      },
      "lastUpdated": "2026-01-02T10:30:00.000Z"
    }
  ]
}
```

---

### 6. 订阅管理（Admin端）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/admin/subscriptions` | GET | 获取所有订阅 |
| `/admin/subscriptions/:id` | GET | 获取单个订阅详情 |
| `/admin/subscriptions/:id` | PUT | 更新订阅 |
| `/admin/subscriptions/:id/cancel` | POST | 取消订阅 |
| `/admin/subscriptions/:id/renew` | POST | 续订订阅 |

**订阅响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "sub-550e8400",
      "userId": "user-123",
      "userName": "john.doe",
      "planId": "plan-pro",
      "planName": "Pro Plan",
      "status": "active",
      "amount": 29.99,
      "currency": "USD",
      "startDate": "2026-01-01T00:00:00.000Z",
      "endDate": "2026-01-31T23:59:59.000Z",
      "autoRenew": true,
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

---

## 📊 遗漏端点统计

### 按模块分类

| 模块 | 端点数量 | 重要度 |
|------|----------|--------|
| **Client 管理** | ~90 | ⭐⭐⭐⭐⭐ 核心功能 |
| **VPN 隧道** | 7 | ⭐⭐⭐ 网络功能 |
| **数据同步** | 1 | ⭐⭐⭐⭐ 迁移工具 |
| **API 统计查询** | 2 | ⭐⭐⭐⭐ 用户功能 |
| **账户余额** | 1 | ⭐⭐⭐ 监控功能 |
| **订阅管理(Admin)** | 5 | ⭐⭐⭐ 商业功能 |
| **Claude Relay Config** | ~10 | ⭐⭐⭐ 配置管理 |

---

## 🔍 数据格式核对

### Client 数据结构

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

### VPN 隧道数据结构

```typescript
interface VPNTunnel {
  tunnelId: string              // 隧道ID
  name: string                  // 隧道名称
  status: 'connected' | 'disconnected' | 'error'
  remoteHost: string            // 远程主机
  remotePort: number            // 远程端口
  localPort: number             // 本地端口
  protocol: string              // 协议类型
  autoReconnect: boolean        // 自动重连
  maxRetries: number            // 最大重试次数
  createdAt: string             // 创建时间
  connectedAt: string | null    // 连接时间
  stats: {
    bytesSent: number           // 发送字节数
    bytesReceived: number       // 接收字节数
    activeSessions: number      // 活跃会话数
    uptime: number              // 运行时间（秒）
  }
}
```

---

## ⚠️ 重要说明

### Client 管理系统

这是项目的**核心分布式功能**，允许：
- 管理多个远程客户端节点
- 通过 WebSocket 实时通信
- 远程管理账户和配置
- 负载均衡和故障转移

**使用场景**:
- 多地域部署
- 客户端-服务器架构
- 分布式账户管理

### VPN 隧道管理

用于：
- 建立安全的VPN连接
- 管理隧道会话
- 监控流量统计

### 数据同步

用于：
- 服务器迁移
- 灾备恢复
- 多实例同步

**安全警告**: 导出的数据包含未加密的敏感信息（OAuth Token、API Key等），必须安全传输和存储！

---

## 📝 完整 API 端点总览

### 总数统计

| 分类 | 端点数 |
|------|--------|
| **已文档化（前3份文档）** | ~120 |
| **本文档新增** | ~110 |
| **估计未文档化** | ~136 |
| **总计** | 366 |

### 覆盖率

- ✅ **核心功能**: 100%
- ✅ **Client 管理**: 100%
- ✅ **VPN 管理**: 100%
- ✅ **数据同步**: 100%
- ⚠️ **其他高级功能**: 约60%

---

## 🎯 后续建议

### 需要补充的文档

1. **Claude Relay Config API** - 约10个端点
2. **WebSocket 通信协议** - 客户端实时通信
3. **详细的错误码参考** - 所有模块的错误类型
4. **权限和角色系统** - 完整的RBAC文档

### 需要核对的数据格式

1. Claude Relay Config 的完整配置结构
2. WebSocket 消息格式
3. 更多账户类型的详细字段
4. 各平台的特定响应格式

---

**文档版本**: 1.0
**扫描完成时间**: 2026-01-02
**总路由数**: 366
**已文档化**: 230 (63%)
**待文档化**: 136 (37%)
