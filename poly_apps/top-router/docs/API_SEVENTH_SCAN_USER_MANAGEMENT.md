# Claude Relay Service - 用户管理和短信通知 API

> 本文档记录第七次扫描发现的用户管理、认证和短信通知功能

**版本**: 1.0
**最后更新**: 2026-01-02
**发现**: 第七次全面扫描

---

## 📊 本次扫描发现汇总

| 分类 | 端点数量 | 文件来源 |
|------|----------|----------|
| **用户认证管理** | 4 | userRoutes.js |
| **用户资料和API Keys** | 4 | userRoutes.js |
| **用户使用统计** | 1 | userRoutes.js |
| **管理员用户管理** | 7 | userRoutes.js |
| **短信通知管理** | 6 | userRoutes.js |
| **LDAP集成** | 1 | userRoutes.js |
| **Droid (Factory.ai)** | 4 | droidRoutes.js |
| **总计** | 27 | |

---

## 1. 用户认证管理 API

**前提条件**: 需要配置 `USER_MANAGEMENT_ENABLED=true` 启用用户管理功能。

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
| `username` | String | 是 | 用户名（3-20个字符,字母数字下划线） |
| `password` | String | 是 | 密码（至少8个字符） |
| `email` | String | 否 | 邮箱地址 |
| `displayName` | String | 否 | 显示名称 |
| `firstName` | String | 否 | 名 |
| `lastName` | String | 否 | 姓 |

**响应**:
```json
{
  "success": true,
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
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**配置控制**:
- `USER_MANAGEMENT_ENABLED`: 必须为 true
- `allowRegistration`: 必须为 true

---

### 1.2 用户登录

用户登录获取会话令牌（支持本地密码和LDAP认证）。

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
  "message": "Login successful",
  "user": {
    "id": "user-550e8400",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "displayName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user"
  },
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**速率限制**:
- **基础限制**: 每个IP 30次尝试 / 15分钟,超限后封禁15分钟
- **严格限制**: 每个IP 100次尝试 / 1小时,超限后封禁1小时(防暴力破解)

**错误响应（速率限制）**:
```json
{
  "error": "Too many requests",
  "message": "Too many login attempts from this IP. Please try again later."
}
```

**认证优先级**:
1. 优先使用本地密码认证（如果用户存在且有 passwordHash）
2. 如果本地认证失败且LDAP启用，尝试LDAP认证

**安全特性**:
- 基于IP的双层速率限制（正常+严格）
- 用户名和密码格式验证
- LDAP集成支持
- 登录日志记录

---

### 1.3 请求密码重置

请求重置密码（发送重置令牌）。

**请求**:
```http
POST /users/password/reset-request
Content-Type: application/json

{
  "email": "john.doe@example.com"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Password reset email sent"
}
```

**配置控制**:
- `USER_MANAGEMENT_ENABLED`: 必须为 true
- `allowPasswordReset`: 必须不为 false

---

### 1.4 重置密码

使用重置令牌设置新密码。

**请求**:
```http
POST /users/password/reset
Content-Type: application/json

{
  "token": "reset_token_from_email",
  "newPassword": "NewSecurePassword123!"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | String | 是 | 密码重置令牌 |
| `newPassword` | String | 是 | 新密码（至少8个字符） |

**响应**:
```json
{
  "success": true,
  "message": "Password reset successful"
}
```

---

## 2. 用户资料和API Keys管理 API

### 2.1 用户登出

登出当前用户并使会话失效。

**请求**:
```http
POST /users/logout
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "message": "Logout successful"
}
```

---

### 2.2 获取用户资料

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
  "user": {
    "id": "user-550e8400",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "displayName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2026-01-02T10:30:00.000Z",
    "lastLoginAt": "2026-01-02T10:30:00.000Z",
    "apiKeyCount": 2,
    "totalUsage": {
      "requests": 500,
      "tokens": 210000
    }
  },
  "config": {
    "maxApiKeysPerUser": 1,
    "allowUserDeleteApiKeys": false
  }
}
```

---

### 2.3 获取用户API Keys

获取当前用户的所有API Keys。

**请求**:
```http
GET /users/api-keys?includeDeleted=false
Authorization: Bearer {userToken}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `includeDeleted` | String | false | 是否包含已删除的API Keys |

**响应**:
```json
{
  "success": true,
  "apiKeys": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "My Personal Key",
      "description": "用于个人项目",
      "tokenLimit": 1000000,
      "isActive": true,
      "createdAt": "2026-01-02T10:30:00.000Z",
      "lastUsedAt": "2026-01-02T10:45:00.000Z",
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "usage": {
        "requests": 150,
        "inputTokens": 50000,
        "outputTokens": 20000,
        "totalCost": 4.25
      },
      "dailyCost": 0.85,
      "dailyCostLimit": 10.0,
      "totalCost": 4.25,
      "totalCostLimit": 200.0,
      "keyPreview": "cr_12345...abcd",
      "isDeleted": false
    }
  ],
  "total": 1
}
```

**重要说明**:
- 响应中不返回完整的API Key，只返回前缀和后几位（keyPreview）
- 已删除的Keys包含 `isDeleted`、`deletedAt`、`deletedBy`、`deletedByType` 字段

---

### 2.4 创建用户API Key

创建新的API Key。

**请求**:
```http
POST /users/api-keys
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "name": "My Personal Key",
  "description": "用于个人项目",
  "tokenLimit": 1000000,
  "expiresAt": "2026-12-31T23:59:59.000Z",
  "dailyCostLimit": 10.0,
  "totalCostLimit": 200.0
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | String | 是 | API Key名称 |
| `description` | String | 否 | 描述信息 |
| `tokenLimit` | Number | 否 | Token限制 |
| `expiresAt` | String | 否 | 过期时间（ISO 8601格式） |
| `dailyCostLimit` | Number | 否 | 每日成本限制 |
| `totalCostLimit` | Number | 否 | 总成本限制 |

**响应**:
```json
{
  "success": true,
  "message": "API key created successfully",
  "apiKey": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "My Personal Key",
    "description": "用于个人项目",
    "key": "cr_1234567890abcdef...",
    "tokenLimit": 1000000,
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "dailyCostLimit": 10.0,
    "totalCostLimit": 200.0,
    "createdAt": "2026-01-02T10:30:00.000Z"
  }
}
```

**重要说明**:
- 完整的API Key **只在创建时返回一次**，之后无法再次获取
- 检查用户API Key数量限制（`MAX_API_KEYS_PER_USER`）
- 自动设置服务权限为 `all`（全部服务）

---

### 2.5 删除用户API Key

删除指定的API Key（软删除）。

**请求**:
```http
DELETE /users/api-keys/{keyId}
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "message": "API key deleted successfully"
}
```

**权限检查**:
- 检查是否允许用户删除自己的API Keys（`ALLOW_USER_DELETE_API_KEYS`）
- 验证API Key属于当前用户
- 软删除（标记为删除，保留统计数据）

---

## 3. 用户使用统计 API

### 3.1 获取用户使用统计

获取当前用户的使用统计（聚合所有API Keys）。

**请求**:
```http
GET /users/usage-stats?period=week&model=claude-sonnet-4-5
Authorization: Bearer {userToken}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | week | 统计周期（`day`/`week`/`month`） |
| `model` | String | - | 模型筛选（可选） |

**响应**:
```json
{
  "success": true,
  "stats": {
    "totalRequests": 500,
    "totalInputTokens": 150000,
    "totalOutputTokens": 60000,
    "totalCost": 25.50,
    "dailyStats": [
      {
        "date": "2026-01-02",
        "requests": 50,
        "inputTokens": 15000,
        "outputTokens": 6000,
        "cost": 2.55
      }
    ],
    "modelStats": [
      {
        "model": "claude-sonnet-4-5",
        "requests": 300,
        "inputTokens": 90000,
        "outputTokens": 36000,
        "cost": 15.30
      },
      {
        "model": "gemini-2.5-pro",
        "requests": 200,
        "inputTokens": 60000,
        "outputTokens": 24000,
        "cost": 10.20
      }
    ]
  }
}
```

**数据说明**:
- 自动聚合用户所有API Keys的使用量（包括已删除的Keys以保留完整统计）
- 如果用户没有API Keys，返回全零统计

---

## 4. 管理员用户管理 API

**认证要求**: 需要管理员权限（`authenticateUserOrAdmin` + `requireAdmin`）

### 4.1 获取用户列表

获取所有用户列表（分页，支持搜索和筛选）。

**请求**:
```http
GET /users?page=1&limit=20&role=user&isActive=true&search=john
Authorization: Bearer {adminToken}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | Number | 1 | 页码 |
| `limit` | Number | 20 | 每页数量 |
| `role` | String | - | 角色筛选（`user`/`admin`） |
| `isActive` | String | - | 状态筛选（`true`/`false`） |
| `search` | String | - | 搜索关键词（用户名/显示名/邮箱） |

**响应**:
```json
{
  "success": true,
  "users": [
    {
      "id": "user-550e8400",
      "username": "john.doe",
      "email": "john.doe@example.com",
      "displayName": "John Doe",
      "role": "user",
      "isActive": true,
      "createdAt": "2026-01-02T10:30:00.000Z",
      "lastLoginAt": "2026-01-02T10:30:00.000Z",
      "apiKeyCount": 2
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

### 4.2 获取特定用户信息

获取单个用户的详细信息（包括API Keys）。

**请求**:
```http
GET /users/{userId}
Authorization: Bearer {adminToken}
```

**响应**:
```json
{
  "success": true,
  "user": {
    "id": "user-550e8400",
    "username": "john.doe",
    "email": "john.doe@example.com",
    "displayName": "John Doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2026-01-02T10:30:00.000Z",
    "lastLoginAt": "2026-01-02T10:30:00.000Z",
    "apiKeys": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "My Personal Key",
        "description": "用于个人项目",
        "isActive": true,
        "createdAt": "2026-01-02T10:30:00.000Z",
        "lastUsedAt": "2026-01-02T10:45:00.000Z",
        "usage": {
          "requests": 150,
          "inputTokens": 50000,
          "outputTokens": 20000,
          "totalCost": 4.25
        },
        "keyPreview": "cr_12345...abcd"
      }
    ]
  }
}
```

---

### 4.3 更新用户状态

启用或禁用用户。

**请求**:
```http
PATCH /users/{userId}/status
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "isActive": false
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `isActive` | Boolean | 是 | 用户状态（`true`启用/`false`禁用） |

**响应**:
```json
{
  "success": true,
  "message": "User disabled successfully",
  "user": {
    "id": "user-550e8400",
    "username": "john.doe",
    "isActive": false,
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 4.4 更新用户角色

修改用户角色（user/admin）。

**请求**:
```http
PATCH /users/{userId}/role
Authorization: Bearer {adminToken}
Content-Type: application/json

{
  "role": "admin"
}
```

**请求体字段**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `role` | String | 是 | 用户角色（`user`/`admin`） |

**响应**:
```json
{
  "success": true,
  "message": "User role updated to admin successfully",
  "user": {
    "id": "user-550e8400",
    "username": "john.doe",
    "role": "admin",
    "updatedAt": "2026-01-02T11:00:00.000Z"
  }
}
```

---

### 4.5 禁用用户所有API Keys

批量禁用指定用户的所有API Keys。

**请求**:
```http
POST /users/{userId}/disable-keys
Authorization: Bearer {adminToken}
```

**响应**:
```json
{
  "success": true,
  "message": "Disabled 3 API keys for user john.doe",
  "disabledCount": 3
}
```

---

### 4.6 获取用户使用统计（管理员）

查询指定用户的使用统计。

**请求**:
```http
GET /users/{userId}/usage-stats?period=week&model=claude-sonnet-4-5
Authorization: Bearer {adminToken}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `period` | String | week | 统计周期（`day`/`week`/`month`） |
| `model` | String | - | 模型筛选（可选） |

**响应**:
```json
{
  "success": true,
  "user": {
    "id": "user-550e8400",
    "username": "john.doe",
    "displayName": "John Doe"
  },
  "stats": {
    "totalRequests": 500,
    "totalInputTokens": 150000,
    "totalOutputTokens": 60000,
    "totalCost": 25.50,
    "dailyStats": [...],
    "modelStats": [...]
  }
}
```

---

### 4.7 获取用户管理统计概览

获取整体用户管理统计数据。

**请求**:
```http
GET /users/stats/overview
Authorization: Bearer {adminToken}
```

**响应**:
```json
{
  "success": true,
  "stats": {
    "totalUsers": 100,
    "activeUsers": 85,
    "inactiveUsers": 15,
    "totalAdmins": 5,
    "totalApiKeys": 150,
    "activeApiKeys": 120,
    "newUsersToday": 3,
    "newUsersThisWeek": 12,
    "newUsersThisMonth": 45
  }
}
```

---

## 5. 短信通知管理 API

**前提条件**: 需要配置 `SMS_ENABLED=true` 启用短信服务。

### 5.1 获取用户短信配置

获取当前用户的短信配置信息。

**请求**:
```http
GET /users/sms/config
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "config": {
    "phoneNumber": "138****5678",
    "phoneVerified": true,
    "notificationPreferences": {
      "apiKeyCreated": true,
      "apiKeyDeleted": true,
      "costAlert": true,
      "rateLimitExceeded": false
    },
    "createdAt": "2026-01-02T10:00:00.000Z",
    "updatedAt": "2026-01-02T10:30:00.000Z"
  },
  "smsEnabled": true,
  "testMode": false
}
```

**字段说明**:
- `phoneNumber`: 已脱敏的手机号
- `phoneVerified`: 手机号验证状态
- `notificationPreferences`: 通知偏好设置
- `smsEnabled`: 系统短信服务是否启用
- `testMode`: 是否为测试模式

---

### 5.2 发送验证码

发送短信验证码到指定手机号。

**请求**:
```http
POST /users/sms/send-code
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "phoneNumber": "13812345678"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Verification code sent successfully",
  "expiresIn": 300
}
```

**速率限制**:
- 每个手机号每分钟最多1条
- 每个手机号每小时最多5条
- 每个手机号每天最多10条

**错误响应（速率限制）**:
```json
{
  "error": "Send code failed",
  "message": "Too many verification codes sent. Please try again later.",
  "retryAfter": 45
}
```

---

### 5.3 绑定手机号

使用验证码绑定手机号到用户账户。

**请求**:
```http
POST /users/sms/bind-phone
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "phoneNumber": "13812345678",
  "verificationCode": "123456"
}
```

**响应**:
```json
{
  "success": true,
  "message": "Phone number bound successfully",
  "config": {
    "phoneNumber": "138****5678",
    "phoneVerified": true,
    "notificationPreferences": {
      "apiKeyCreated": true,
      "apiKeyDeleted": true,
      "costAlert": true,
      "rateLimitExceeded": false
    }
  }
}
```

**错误响应**:
```json
{
  "error": "Bind phone failed",
  "message": "Invalid verification code"
}
```

---

### 5.4 解绑手机号

解除手机号与用户账户的绑定。

**请求**:
```http
POST /users/sms/unbind-phone
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "message": "Phone number unbound successfully",
  "config": {
    "phoneNumber": null,
    "phoneVerified": false,
    "notificationPreferences": {
      "apiKeyCreated": true,
      "apiKeyDeleted": true,
      "costAlert": true,
      "rateLimitExceeded": false
    }
  }
}
```

---

### 5.5 更新短信通知偏好

更新短信通知偏好设置。

**请求**:
```http
PUT /users/sms/preferences
Authorization: Bearer {userToken}
Content-Type: application/json

{
  "apiKeyCreated": true,
  "apiKeyDeleted": false,
  "costAlert": true,
  "rateLimitExceeded": false
}
```

**请求体字段**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `apiKeyCreated` | Boolean | API Key创建通知 |
| `apiKeyDeleted` | Boolean | API Key删除通知 |
| `costAlert` | Boolean | 成本告警通知 |
| `rateLimitExceeded` | Boolean | 速率限制超限通知 |

**响应**:
```json
{
  "success": true,
  "message": "Notification preferences updated successfully",
  "preferences": {
    "apiKeyCreated": true,
    "apiKeyDeleted": false,
    "costAlert": true,
    "rateLimitExceeded": false
  }
}
```

---

### 5.6 获取短信发送记录

获取用户的短信发送历史记录。

**请求**:
```http
GET /users/sms/logs?limit=20
Authorization: Bearer {userToken}
```

**查询参数**:

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `limit` | Number | 20 | 返回记录数量 |

**响应**:
```json
{
  "success": true,
  "logs": [
    {
      "id": "sms-log-001",
      "phoneNumber": "138****5678",
      "type": "verification_code",
      "status": "sent",
      "sentAt": "2026-01-02T10:30:00.000Z",
      "message": "Your verification code is: ******"
    },
    {
      "id": "sms-log-002",
      "phoneNumber": "138****5678",
      "type": "cost_alert",
      "status": "sent",
      "sentAt": "2026-01-02T09:00:00.000Z",
      "message": "Cost alert: Your daily cost reached $9.50"
    }
  ],
  "total": 2
}
```

---

### 5.7 获取发送频率限制状态

查询当前手机号的发送频率限制状态。

**请求**:
```http
GET /users/sms/rate-limit
Authorization: Bearer {userToken}
```

**响应**:
```json
{
  "success": true,
  "rateLimit": {
    "phoneNumber": "138****5678",
    "minuteLimit": {
      "limit": 1,
      "remaining": 0,
      "resetAt": "2026-01-02T10:31:00.000Z"
    },
    "hourLimit": {
      "limit": 5,
      "remaining": 3,
      "resetAt": "2026-01-02T11:30:00.000Z"
    },
    "dayLimit": {
      "limit": 10,
      "remaining": 7,
      "resetAt": "2026-01-03T00:00:00.000Z"
    }
  }
}
```

---

## 6. LDAP集成 API

### 6.1 测试LDAP连接

测试LDAP服务器连接和配置（管理员）。

**请求**:
```http
GET /users/admin/ldap-test
Authorization: Bearer {adminToken}
```

**响应**:
```json
{
  "success": true,
  "ldapTest": {
    "connected": true,
    "bindSuccessful": true,
    "searchSuccessful": true,
    "responseTime": 125
  },
  "config": {
    "url": "ldaps://ldap.example.com:636",
    "bindDN": "cn=admin,dc=example,dc=com",
    "searchBase": "ou=users,dc=example,dc=com",
    "searchFilter": "(uid={{username}})",
    "tlsRejectUnauthorized": true
  }
}
```

**LDAP配置**:
- `LDAP_ENABLED`: 启用LDAP认证
- `LDAP_URL`: LDAP服务器地址
- `LDAP_BIND_DN`: 绑定DN
- `LDAP_BIND_PASSWORD`: 绑定密码
- `LDAP_SEARCH_BASE`: 搜索基准DN
- `LDAP_SEARCH_FILTER`: 搜索过滤器
- `LDAP_TLS_REJECT_UNAUTHORIZED`: 是否验证TLS证书

---

## 7. Droid (Factory.ai) API

**前提条件**: API Key需要具备 `droid` 权限。

### 7.1 Droid Claude 端点

转发到Factory.ai的Anthropic (Claude) Messages API。

**请求**:
```http
POST /droid/claude/v1/messages
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "claude-sonnet-4-5-20250929",
  "max_tokens": 1024,
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

**响应**:
遵循标准Claude Messages API格式。

---

### 7.2 Droid Comm 端点

转发到Factory.ai的OpenAI Chat Completions格式端点。

**请求**:
```http
POST /droid/comm/v1/chat/completions
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gpt-5-2025-08-07",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

**响应**:
遵循OpenAI Chat Completions API格式。

---

### 7.3 Droid OpenAI 端点

转发到Factory.ai的OpenAI Responses API。

**请求**:
```http
POST /droid/openai/v1/responses
x-api-key: cr_1234567890abcdef...
Content-Type: application/json

{
  "model": "gpt-5-2025-08-07",
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

**别名路由**:
- `POST /droid/openai/responses` - 同上

**响应**:
遵循OpenAI Responses API格式。

---

### 7.4 Droid 模型列表

获取可用的Droid模型列表。

**请求**:
```http
GET /droid/*/v1/models
x-api-key: cr_1234567890abcdef...
```

**响应**:
```json
{
  "object": "list",
  "data": [
    {
      "id": "claude-opus-4-1-20250805",
      "object": "model",
      "created": 1704153600000,
      "owned_by": "anthropic"
    },
    {
      "id": "claude-sonnet-4-5-20250929",
      "object": "model",
      "created": 1704153600000,
      "owned_by": "anthropic"
    },
    {
      "id": "gpt-5-2025-08-07",
      "object": "model",
      "created": 1704153600000,
      "owned_by": "openai"
    }
  ]
}
```

---

## 8. 数据格式补充

### 8.1 用户数据结构

```typescript
interface User {
  id: string                    // 用户ID
  username: string              // 用户名
  email: string                 // 邮箱
  displayName: string           // 显示名称
  firstName: string             // 名
  lastName: string              // 姓
  role: 'user' | 'admin'        // 角色
  isActive: boolean             // 是否激活
  emailVerified: boolean        // 邮箱是否验证
  registrationMethod: 'local' | 'ldap' // 注册方式
  createdAt: string             // 创建时间
  lastLoginAt: string           // 最后登录时间
  apiKeyCount: number           // API Key数量
  totalUsage: {
    requests: number
    tokens: number
  }
}
```

### 8.2 短信配置数据结构

```typescript
interface SmsConfig {
  phoneNumber: string | null    // 手机号（脱敏）
  phoneVerified: boolean        // 验证状态
  notificationPreferences: {
    apiKeyCreated: boolean      // API Key创建通知
    apiKeyDeleted: boolean      // API Key删除通知
    costAlert: boolean          // 成本告警通知
    rateLimitExceeded: boolean  // 速率限制通知
  }
  createdAt: string             // 创建时间
  updatedAt: string             // 更新时间
}
```

### 8.3 速率限制结构

```typescript
interface RateLimit {
  minuteLimit: {
    limit: number               // 每分钟限制
    remaining: number           // 剩余次数
    resetAt: string             // 重置时间
  }
  hourLimit: {
    limit: number               // 每小时限制
    remaining: number           // 剩余次数
    resetAt: string             // 重置时间
  }
  dayLimit: {
    limit: number               // 每日限制
    remaining: number           // 剩余次数
    resetAt: string             // 重置时间
  }
}
```

---

## 9. 错误码参考

### 用户管理错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `REGISTRATION_DISABLED` | 403 | 用户注册未启用 |
| `USERNAME_TAKEN` | 400 | 用户名已被占用 |
| `INVALID_USERNAME` | 400 | 用户名格式无效（3-20字符,字母数字下划线） |
| `INVALID_PASSWORD` | 400 | 密码格式无效（至少8字符） |
| `INVALID_CREDENTIALS` | 401 | 用户名或密码错误 |
| `USER_NOT_FOUND` | 404 | 用户不存在 |
| `USER_INACTIVE` | 403 | 用户账户已停用 |
| `MAX_API_KEYS_REACHED` | 400 | 已达到API Key数量上限 |
| `DELETE_NOT_ALLOWED` | 403 | 不允许用户删除自己的API Keys |

### 短信服务错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `SMS_SERVICE_UNAVAILABLE` | 503 | 短信服务未启用 |
| `MISSING_PHONE_NUMBER` | 400 | 缺少手机号 |
| `RATE_LIMIT_EXCEEDED` | 429 | 短信发送频率超限 |
| `INVALID_VERIFICATION_CODE` | 400 | 验证码无效或已过期 |
| `NO_PHONE_BOUND` | 400 | 未绑定手机号 |

### Droid权限错误

| 错误码 | HTTP状态 | 说明 |
|--------|----------|------|
| `PERMISSION_DENIED` | 403 | API Key缺少Droid权限 |

---

## 10. 配置参数

### 用户管理配置

| 环境变量 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| `USER_MANAGEMENT_ENABLED` | Boolean | false | 启用用户管理系统 |
| `allowRegistration` | Boolean | true | 允许用户注册 |
| `allowPasswordReset` | Boolean | true | 允许密码重置 |
| `MAX_API_KEYS_PER_USER` | Number | 1 | 每用户最大API Key数量 |
| `ALLOW_USER_DELETE_API_KEYS` | Boolean | false | 允许用户删除自己的API Keys |

### LDAP配置

| 环境变量 | 类型 | 说明 |
|----------|------|------|
| `LDAP_ENABLED` | Boolean | 启用LDAP认证 |
| `LDAP_URL` | String | LDAP服务器地址 |
| `LDAP_BIND_DN` | String | 绑定DN |
| `LDAP_BIND_PASSWORD` | String | 绑定密码 |
| `LDAP_SEARCH_BASE` | String | 搜索基准DN |
| `LDAP_SEARCH_FILTER` | String | 搜索过滤器（`{{username}}`占位符） |
| `LDAP_TLS_REJECT_UNAUTHORIZED` | Boolean | 验证TLS证书（默认true） |

### 短信服务配置

| 环境变量 | 类型 | 默认值 | 说明 |
|----------|------|--------|------|
| `SMS_ENABLED` | Boolean | false | 启用短信服务 |
| `SMS_TEST_MODE` | Boolean | false | 测试模式（不实际发送） |

---

## 11. 使用场景示例

### 场景 1: 用户完整注册流程

```javascript
// 1. 用户注册
const registration = await axios.post('/users/register', {
  username: 'john.doe',
  password: 'SecurePassword123!',
  email: 'john.doe@example.com',
  displayName: 'John Doe'
})

const sessionToken = registration.data.sessionToken

// 2. 创建API Key
const apiKey = await axios.post('/users/api-keys', {
  name: 'My First Key',
  description: '个人项目使用',
  tokenLimit: 1000000,
  totalCostLimit: 100.0
}, {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

console.log('API Key:', apiKey.data.apiKey.key) // 只在创建时返回!

// 3. 绑定手机号（可选）
await axios.post('/users/sms/send-code', {
  phoneNumber: '13812345678'
}, {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

await axios.post('/users/sms/bind-phone', {
  phoneNumber: '13812345678',
  verificationCode: '123456'
}, {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})
```

### 场景 2: 用户自助使用统计查询

```javascript
// 登录
const login = await axios.post('/users/login', {
  username: 'john.doe',
  password: 'SecurePassword123!'
})

const sessionToken = login.data.sessionToken

// 获取用户资料
const profile = await axios.get('/users/profile', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

console.log('API Key数量:', profile.data.user.apiKeyCount)
console.log('总使用量:', profile.data.user.totalUsage)

// 获取详细使用统计
const stats = await axios.get('/users/usage-stats?period=month', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

console.log('本月总请求数:', stats.data.stats.totalRequests)
console.log('本月总成本:', stats.data.stats.totalCost)
console.log('按模型统计:', stats.data.stats.modelStats)
```

### 场景 3: 管理员用户管理

```javascript
// 管理员登录
const adminLogin = await axios.post('/web/auth/login', {
  username: 'admin',
  password: 'admin-password'
})

const adminToken = adminLogin.data.token

// 获取用户列表
const users = await axios.get('/users?page=1&limit=20&search=john', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
})

console.log('总用户数:', users.data.pagination.total)

// 禁用特定用户
const userId = users.data.users[0].id
await axios.patch(`/users/${userId}/status`, {
  isActive: false
}, {
  headers: { 'Authorization': `Bearer ${adminToken}` }
})

// 禁用该用户的所有API Keys
await axios.post(`/users/${userId}/disable-keys`, {}, {
  headers: { 'Authorization': `Bearer ${adminToken}` }
})
```

### 场景 4: 短信通知管理

```javascript
// 获取短信配置
const smsConfig = await axios.get('/users/sms/config', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

// 更新通知偏好（只接收成本告警）
await axios.put('/users/sms/preferences', {
  apiKeyCreated: false,
  apiKeyDeleted: false,
  costAlert: true,
  rateLimitExceeded: false
}, {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

// 查看短信发送记录
const logs = await axios.get('/users/sms/logs?limit=10', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

console.log('最近短信记录:', logs.data.logs)

// 查看发送频率限制状态
const rateLimit = await axios.get('/users/sms/rate-limit', {
  headers: { 'Authorization': `Bearer ${sessionToken}` }
})

console.log('今日剩余发送次数:', rateLimit.data.rateLimit.dayLimit.remaining)
```

---

## 12. 完整端点清单

### 用户认证管理
- ✅ `POST /users/register` - 用户注册
- ✅ `POST /users/login` - 用户登录（支持LDAP）
- ✅ `POST /users/password/reset-request` - 请求密码重置
- ✅ `POST /users/password/reset` - 重置密码

### 用户资料和API Keys
- ✅ `POST /users/logout` - 用户登出
- ✅ `GET /users/profile` - 获取用户资料
- ✅ `GET /users/api-keys` - 获取用户API Keys
- ✅ `POST /users/api-keys` - 创建用户API Key
- ✅ `DELETE /users/api-keys/{keyId}` - 删除用户API Key

### 用户使用统计
- ✅ `GET /users/usage-stats` - 获取用户使用统计

### 管理员用户管理
- ✅ `GET /users` - 获取用户列表（管理员）
- ✅ `GET /users/:userId` - 获取特定用户信息（管理员）
- ✅ `PATCH /users/:userId/status` - 更新用户状态（管理员）
- ✅ `PATCH /users/:userId/role` - 更新用户角色（管理员）
- ✅ `POST /users/:userId/disable-keys` - 禁用用户所有API Keys（管理员）
- ✅ `GET /users/:userId/usage-stats` - 获取用户使用统计（管理员）
- ✅ `GET /users/stats/overview` - 获取用户管理统计概览（管理员）

### LDAP集成
- ✅ `GET /users/admin/ldap-test` - 测试LDAP连接（管理员）

### 短信通知管理
- ✅ `GET /users/sms/config` - 获取用户短信配置
- ✅ `POST /users/sms/send-code` - 发送验证码
- ✅ `POST /users/sms/bind-phone` - 绑定手机号
- ✅ `POST /users/sms/unbind-phone` - 解绑手机号
- ✅ `PUT /users/sms/preferences` - 更新短信通知偏好
- ✅ `GET /users/sms/logs` - 获取短信发送记录
- ✅ `GET /users/sms/rate-limit` - 获取发送频率限制状态

### Droid (Factory.ai)
- ✅ `POST /droid/claude/v1/messages` - Droid Claude转发
- ✅ `POST /droid/comm/v1/chat/completions` - Droid Comm转发
- ✅ `POST /droid/openai/v1/responses` - Droid OpenAI转发
- ✅ `POST /droid/openai/responses` - Droid OpenAI转发（别名）
- ✅ `GET /droid/*/v1/models` - Droid模型列表

---

**文档版本**: 1.0
**最后更新**: 2026-01-02
**维护者**: Claude Relay Service Team
