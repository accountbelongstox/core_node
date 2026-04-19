# Gateway & Center Server API 参考

> Last updated: 2026-04-02
>
> **架构说明**：**`webclaude_gateway`** 仓库为 Legacy（已合并到 `webclaude_go-gateway`），**不再独立部署**。WebSocket 聊天中继/Bridge 与 HTTP API 代理均由 **`webclaude_go-gateway`** :18200 承担。
>
> 本文档描述前端与外部客户端可使用的全部 API 接口。**业务 API**（用户、项目、对话、Key 管理）主要由 **webclaude_center_server** 提供；**聊天 API**（WebSocket 流 + HTTP SSE）由 **webclaude_go-gateway** 提供。两者共享 MySQL + Redis。

---

## 基本信息

- Base URL: `https://gateway.example.com`（go-gateway）/ `https://api.example.com`（center_server）
- 认证方式：JWT（用户管理）/ API Key（聊天）/ Admin Token（管理）
- 响应格式：`application/json`
- 错误响应格式：

```json
{
  "error": {
    "code": "INVALID_KEY",
    "message": "API Key 无效或已过期"
  }
}
```

---

## 1. 用户认证 API（center_server）

### POST `/api/auth/register`

```json
// Request
{ "username": "alice", "email": "alice@example.com", "password": "secure-password" }

// Response 201
{ "user_id": "usr-uuid", "username": "alice", "level": "free", "token": "eyJhbG..." }
```

### POST `/api/auth/login`

```json
// Request
{ "username": "alice", "password": "secure-password" }

// Response 200
{
  "token": "eyJhbG...",
  "user": {
    "id": "usr-uuid",
    "username": "alice",
    "level": "pro",
    "quota": {
      "max_projects": 10, "used_projects": 3,
      "max_conversations_per_project": 20,
      "max_keys": 10, "used_keys": 2
    }
  }
}
```

### GET `/api/user/profile`

**Header:** `Authorization: Bearer <jwt>`

```json
// Response 200
{
  "id": "usr-uuid",
  "username": "alice",
  "email": "alice@example.com",
  "level": "pro",
  "created_at": "2026-01-15T08:00:00Z",
  "quota": { "max_projects": 10, "used_projects": 3, "max_conversations_per_project": 20, "max_keys": 10, "used_keys": 2 },
  "usage_today": { "requests": 42, "input_tokens": 150000, "output_tokens": 30000, "cost_usd": 1.25 }
}
```

---

## 2. 项目管理 API（center_server）

**Header:** `Authorization: Bearer <jwt>`

### POST `/api/projects`

```json
// Request
{ "name": "my-web-app", "description": "Web 应用项目", "host_id": "host-uuid" }
// host_id 可选，不指定时由系统自动分配

// Response 201
{
  "id": "proj-uuid", "name": "my-web-app", "description": "Web 应用项目",
  "path": "/home/user3/projects/my-web-app",
  "host_id": "host-uuid", "host_name": "claude-box-01",
  "created_at": "2026-03-31T10:00:00Z"
}
```

> 项目创建时，Gateway 通过反向隧道通知 Host 创建目录。

### GET `/api/projects`

```json
// Response 200
{
  "projects": [
    {
      "id": "proj-uuid", "name": "my-web-app",
      "path": "/home/user3/projects/my-web-app",
      "host_id": "host-uuid", "host_name": "claude-box-01", "host_online": true,
      "conversation_count": 3, "created_at": "2026-03-31T10:00:00Z"
    }
  ],
  "total": 1, "quota": { "max": 10, "used": 1 }
}
```

### GET `/api/projects/:id`

### PUT `/api/projects/:id`

```json
// Request
{ "name": "new-name", "description": "更新描述" }
```

### DELETE `/api/projects/:id`

删除项目及其下所有对话。

---

## 3. 对话管理 API（center_server）

### POST `/api/projects/:pid/conversations`

```json
// Request
{ "title": "修复登录 bug" }

// Response 201
{
  "id": "conv-uuid", "project_id": "proj-uuid", "title": "修复登录 bug",
  "claude_session_id": null,
  "created_at": "2026-03-31T10:05:00Z", "last_active": null, "message_count": 0
}
```

> `claude_session_id` 在首次发送 prompt 后由 Claude 返回并自动记录。

### GET `/api/projects/:pid/conversations`

```json
// Response 200
{
  "conversations": [
    {
      "id": "conv-uuid", "title": "修复登录 bug",
      "claude_session_id": "sess-xxx",
      "last_active": "2026-03-31T11:30:00Z", "message_count": 12
    }
  ],
  "total": 1, "quota": { "max": 20, "used": 1 }
}
```

### DELETE `/api/conversations/:id`

---

## 4. API Key 管理（center_server）

### POST `/api/keys`

```json
// Request
{
  "name": "聊天前端用",
  "scopes": ["chat", "conversations:read"],
  "allowed_projects": ["proj-uuid"],
  "allowed_models": ["claude-sonnet-4-6"],
  "rate_limit": { "rpm": 10, "rpd": 200 },
  "expires_in_days": 90
}

// Response 201
{
  "id": "key-uuid",
  "key": "sk-cc-a1b2c3d4e5f6...",
  "name": "聊天前端用",
  "scopes": ["chat", "conversations:read"],
  "allowed_projects": ["proj-uuid"],
  "allowed_models": ["claude-sonnet-4-6"],
  "rate_limit": { "rpm": 10, "rpd": 200 },
  "created_at": "2026-03-31T10:00:00Z",
  "expires_at": "2026-06-29T10:00:00Z"
}
```

> `key` 字段仅在创建时返回一次，之后只可见前缀 `sk-cc-a1b2...`。

### GET `/api/keys`

```json
// Response 200
{
  "keys": [
    {
      "id": "key-uuid", "key_prefix": "sk-cc-a1b2", "name": "聊天前端用",
      "scopes": ["chat", "conversations:read"],
      "last_used": "2026-03-31T11:00:00Z", "expires_at": "2026-06-29T10:00:00Z",
      "usage_today": { "requests": 15 }
    }
  ]
}
```

### DELETE `/api/keys/:id`

吊销 Key，立即生效。

---

## 5. 聊天 API — WebSocket（go-gateway）

### 连接

```
wss://gateway.example.com/ws/chat?key=<api-key>
```

连接建立后 Gateway 验证 API Key 并返回 `welcome` 消息。

### 5.1 客户端 → Gateway

**发送消息：**

```json
{
  "action": "run",
  "conversation_id": "conv-uuid",
  "prompt": "帮我写一个 hello world 程序",
  "effort": "max",
  "model": "claude-sonnet-4-6"
}
```

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `action` | Y | `"run"` |
| `prompt` | Y | 提示词 |
| `conversation_id` | N | 对话 ID，空则 Gateway 自动生成 |
| `username` | N | Host 侧系统用户名，空则用 Key 绑定的默认值 |
| `project_dir` | N | 项目目录，空则用 Key 绑定的默认值 |
| `effort` | N | 思考深度 |
| `model` | N | 模型名 |
| `allowed_tools` | N | 限制工具 |

> **自动解析**：Gateway 从 Key 配置中补全 `username` 和 `project_dir`；从 conversation 缓存中获取 `session_id`。客户端只需发送 `prompt` 即可。

**停止生成：**

```json
{ "action": "stop", "conversation_id": "conv-uuid" }
```

**查询状态：**

```json
{ "action": "status", "conversation_id": "conv-uuid" }
```

**列出会话：**

```json
{ "action": "list_sessions" }
```

### 5.2 Gateway → 客户端

所有事件携带 `conversation_id` 以便客户端追踪归属：

```json
{ "type": "welcome",     "user": "alice", "level": "pro", "default_username": "alice", "default_project_dir": "/home/alice/projects/default", "sessions": [...] }
{ "type": "status",      "conversation_id": "conv-uuid", "status": "queued|starting|running|finished|stopped" }
{ "type": "system",      "conversation_id": "conv-uuid", "session_id": "...", "model": "..." }
{ "type": "block_start", "conversation_id": "conv-uuid", "block_type": "thinking|text", "index": 0 }
{ "type": "delta",       "conversation_id": "conv-uuid", "delta_type": "text_delta|thinking_delta", "text": "..." }
{ "type": "block_stop",  "conversation_id": "conv-uuid", "index": 0 }
{ "type": "usage",       "conversation_id": "conv-uuid", "phase": "start|end", "input_tokens": N, "output_tokens": N }
{ "type": "result",      "conversation_id": "conv-uuid", "text": "...", "cost_usd": 0.03, "session_id": "..." }
{ "type": "rate_limit",  "conversation_id": "conv-uuid", "..." }
{ "type": "error",       "conversation_id": "conv-uuid", "message": "..." }
{ "type": "sessions_list", "sessions": [{ "session_id": "...", "conversation_id": "...", ... }] }
```

---

## 6. 聊天 API — HTTP SSE（go-gateway）

### POST `/api/chat/completions`

**Header:** `Authorization: Bearer sk-cc-xxx`

**请求：**

```json
{
  "conversation_id": "conv-uuid",
  "prompt": "帮我写一个 hello world 程序",
  "effort": "max",
  "model": "claude-sonnet-4-6",
  "stream": true
}
```

**流式响应** `Content-Type: text/event-stream`：

```
data: {"type":"status","status":"starting"}
data: {"type":"block_start","block_type":"text","index":0}
data: {"type":"delta","delta_type":"text_delta","text":"Hello"}
data: {"type":"delta","delta_type":"text_delta","text":" World"}
data: {"type":"result","text":"...","cost_usd":0.01}
data: [DONE]
```

**非流式** (`"stream": false`) 响应 200：

```json
{
  "conversation_id": "conv-uuid",
  "text": "完整回复...",
  "session_id": "sess-xxx",
  "cost_usd": 0.01,
  "usage": { "input_tokens": 500, "output_tokens": 150 }
}
```

---

## 7. 会话与对话生命周期

### 7.1 conversation_id 与 session_id 的关系

```
conversation_id（Gateway 管理）   ←──映射──→   session_id（Claude CLI 生成）
  前端创建/发送                                    Host 返回
  跨请求持久                                       用于 --resume 续接
```

### 7.2 典型生命周期

```
1. 首次请求（conversation_id 为空）
   → Gateway 生成 conversation_id = "conv-abc"
   → 转发到 Host，session_id = ""
   → Claude 生成 session_id = "sess-123"
   → Gateway 缓存：conversations["conv-abc"] = { sessionId: "sess-123", hostId, username, projectDir }
   → 返回给客户端：conversation_id = "conv-abc"

2. 后续请求（conversation_id = "conv-abc"）
   → Gateway 查缓存：session_id = "sess-123"
   → 转发到 Host：session_id = "sess-123"（claude --resume sess-123）
   → Claude 恢复上下文继续对话

3. 新建对话（conversation_id 为空）
   → Gateway 生成新 conversation_id = "conv-def"
   → 重复步骤 1
```

### 7.3 会话亲和与调度

| 策略 | 说明 |
|------|------|
| 会话亲和 | conversations 缓存记录 `hostId`，优先调度到同一 Host |
| 负载均衡 | 无亲和时选活跃请求最少的 Host |
| 容错 | Host 断线时清除 `hostId` 亲和，允许迁移 |
| 用户绑定 | Host 根据 `username` 参数以对应用户执行 |

### 7.4 缓存清理

- 超过 24 小时未活跃的 conversation → 自动清理
- Host 断线时其关联 conversation 的 `hostId` 置空（可迁移，不删除）

---

## 8. 管理员 API（center_server）

**Header:** `Authorization: Bearer <admin-jwt>`

### GET `/admin/hosts`

```json
{
  "hosts": [
    {
      "id": "host-uuid", "hostname": "claude-box-01",
      "status": "online", "connected_since": "2026-03-31T08:00:00Z",
      "last_heartbeat": "2026-03-31T11:29:30Z",
      "load": [0.5, 0.3, 0.2],
      "memory_mb": { "total": 16384, "available": 14000 },
      "users": [
        { "username": "user1", "claude_plan": "pro", "claude_status": "active", "busy": false },
        { "username": "user2", "claude_plan": "max", "claude_status": "active", "busy": true, "current_conversation": "conv-uuid" }
      ],
      "total_users": 2, "available_users": 1
    }
  ]
}
```

### POST `/admin/hosts`

注册新主机，返回 `host_token`（仅返回一次）。

```json
// Request
{ "hostname": "claude-box-02", "description": "北京机房第二台" }

// Response 201
{ "id": "host-uuid", "hostname": "claude-box-02", "host_token": "ht-xxxxxxxxxxxxxxxxxxxx", "created_at": "..." }
```

### POST `/admin/hosts/:id/create-user`

通过反向隧道在 Host 上创建系统用户。

```json
// Request
{ "username": "user5" }

// Response 200
{ "success": true, "username": "user5", "home_dir": "/home/user5", "message": "用户已创建，请在主机上手动登录 Claude" }
```

### POST `/admin/hosts/:id/verify-claude`

```json
// Request
{ "username": "user1" }

// Response 200
{ "username": "user1", "claude_available": true, "plan": "pro", "expires_at": "2026-06-01T00:00:00Z", "model_access": ["claude-sonnet-4-6", "claude-haiku-4-5"] }
```

### PUT `/admin/users/:id/level`

```json
// Request
{ "level": "pro" }
```

### GET `/admin/stats`

```json
{
  "hosts": { "total": 3, "online": 2 },
  "claude_accounts": { "total": 8, "active": 6 },
  "users": { "total": 150, "active_today": 23 },
  "requests_today": 1200,
  "tokens_today": { "input": 5000000, "output": 800000 },
  "cost_today_usd": 45.67
}
```

---

## 9. 错误码

| HTTP | 错误码 | 说明 |
|------|--------|------|
| 400 | `INVALID_REQUEST` | 请求参数错误 |
| 401 | `UNAUTHORIZED` | 未认证 |
| 401 | `INVALID_KEY` | API Key 无效 |
| 401 | `KEY_EXPIRED` | API Key 已过期 |
| 403 | `FORBIDDEN` | 权限不足 |
| 403 | `QUOTA_EXCEEDED` | 配额已用完 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 409 | `ALREADY_RUNNING` | 该对话已有进行中的请求 |
| 429 | `RATE_LIMITED` | 请求频率超限 |
| 503 | `NO_HOST_AVAILABLE` | 无可用主机 |
| 503 | `CLAUDE_UNAVAILABLE` | Claude 账户不可用 |

---

## 10. 环境变量

### go-gateway

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GATEWAY_HOST` | `0.0.0.0` | 监听地址 |
| `GATEWAY_PORT` | `18200` | 监听端口 |
| `GATEWAY_CONFIG` | `./config.json` | 配置文件路径 |
| `KEYSTORE_PATH` | `./data/keys.json` | Key 数据文件 |

### 前端（构建时）

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_GATEWAY_URL` | `ws://localhost:18200` | Gateway WebSocket 地址 |
| `VITE_API_KEY` | （空） | 默认 API Key |

---

## 相关文档

- [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) — 系统整体架构
- [host-protocol.md](./host-protocol.md) — Host 通信协议（Gateway ↔ Host 详细消息格式）
- [claude-code.md](./claude-code.md) — Claude Code CLI 完整参数参考
- [CENTER_PLATFORM_ROADMAP.md](./CENTER_PLATFORM_ROADMAP.md) — 产品路线图与模块清单
