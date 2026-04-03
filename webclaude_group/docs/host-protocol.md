# Host 通信协议与执行模型

> Last updated: 2026-04-02
>
> 本文档是 `claude_host`（`core_node/pyapps/claude_host`）与 **webclaude_go-gateway** 之间通信协议的**唯一权威参考**。
> 涵盖连接、心跳、指令、流式事件、多用户隔离等全部细节。

---

## 1. 总览

```
claude_host (Python)                        webclaude_go-gateway (Go)
  主动发起 WSS 连接 ─────────────────────►  监听 /host/connect
  心跳上报（30 s） ──────────────────────►  维护主机注册表
  执行结果（stream）──────────────────────►  路由到前端客户端
  ◄──────────────────────── 下发指令（command）
```

- **反向隧道**：Host 主动连接 Gateway（解决无公网 / NAT 问题）。
- **唯一中继**：WebSocket 聊天链路仅走 **webclaude_go-gateway** :18200（`internal/websocket/`）。**`webclaude_gateway`** 仓库为 Legacy（已合并到 go-gateway），**不再独立部署**。
- **控制面正交**：Host 可通过 HTTPS 向 `webclaude_center_server` 上报元数据（与 WS 执行隧道无关）。

---

## 2. 连接建立

### 2.1 连接地址

```
wss://gateway.example.com/host/connect?token=<host_token>&host_id=<host_id>
```

| 参数 | 说明 |
|------|------|
| `token` | 管理员创建主机时分配的 `host_token` |
| `host_id` | 主机唯一标识（首次可不传，由 Gateway 分配） |

### 2.2 连接流程

```
Host                                    Gateway
  │                                       │
  │── WSS connect (token) ──────────────► │
  │                                       │ 验证 token
  │◄── {"type":"connected",               │
  │     "host_id":"host-uuid"} ──────────│
  │                                       │
  │── heartbeat（立即一次） ─────────────► │
  │                                       │ 记录主机信息
  │◄── {"type":"ack"} ──────────────────│
  │                                       │
  │  ... 每 30 s 心跳 ...                 │
```

### 2.3 重连机制

| 场景 | 行为 |
|------|------|
| 网络断开 | 指数退避：1 s → 2 s → 4 s → 8 s … 最大 60 s |
| token 失效 | 停止重连，报错退出 |
| Gateway 重启 | Host 检测断开后立即重连 |
| 心跳超时 | Gateway 90 s 未收到心跳则标记主机离线 |

---

## 3. 消息格式总则

所有消息均为 JSON，通过顶层 `type` 字段区分类型。

---

## 4. Host → Gateway 消息

### 4.1 心跳（heartbeat）

每 30 秒一次，包含系统资源与用户状态：

```json
{
  "type": "heartbeat",
  "host_id": "host-uuid",
  "hostname": "claude-box-01",
  "uptime_s": 86400,
  "load": [1.2, 0.8, 0.5],
  "memory_mb": { "total": 16384, "available": 12000 },
  "disk_mb": { "total": 512000, "available": 350000 },
  "users": [
    {
      "username": "user1",
      "claude_account": {
        "email": "user1@example.com",
        "plan": "pro",
        "expires_at": "2026-06-01T00:00:00Z",
        "status": "active"
      },
      "busy": false,
      "current_session_id": null,
      "current_request_id": null,
      "has_credentials": true,
      "home_exists": true
    }
  ]
}
```

字段说明：

| 字段 | 说明 |
|------|------|
| `load` | 1/5/15 分钟 CPU 负载 |
| `memory_mb` / `disk_mb` | 总量与可用量（MB） |
| `users[].claude_account` | Claude 凭据检测结果（plan / expires / status） |
| `users[].busy` | 当前是否正在执行 Claude 请求 |
| `users[].has_credentials` | `~/.claude/.credentials.json` 是否存在 |
| `users[].home_exists` | home 目录是否存在 |

### 4.2 指令响应（response）

```json
{
  "type": "response",
  "request_id": "req-uuid",
  "status": "ok",
  "data": { ... }
}
```

### 4.3 Claude 流式事件（stream）

执行 Claude 期间，Host 将 stream-json 逐条包装后转发：

```json
{
  "type": "stream",
  "request_id": "req-uuid",
  "event": {
    "type": "delta",
    "delta_type": "text_delta",
    "text": "Hello",
    "index": 0
  }
}
```

完整事件序列（一次典型请求）：

```
stream → event.type = "status",      status = "starting", prompt = "..."
stream → event.type = "status",      status = "running",  pid = 12345
stream → event.type = "system",      session_id, model, tools, cwd
stream → event.type = "block_start", block_type = "thinking", index = 0
stream → event.type = "delta",       delta_type = "thinking_delta", text = "..."
stream → event.type = "block_stop",  index = 0
stream → event.type = "block_start", block_type = "text", index = 1
stream → event.type = "delta",       delta_type = "text_delta", text = "..."
stream → event.type = "block_stop",  index = 1
stream → event.type = "usage",       phase = "end", output_tokens = 150
stream → event.type = "result",      text, cost_usd, session_id
stream → event.type = "status",      status = "finished", exit_code = 0
```

> **关键**：Gateway 从 `system` 和 `result` 事件中提取 `session_id`，缓存到 conversation 映射表以支持 `--resume` 续接。

### 4.4 错误上报（error）

```json
{
  "type": "error",
  "request_id": "req-uuid",
  "code": "CLAUDE_CRASH",
  "message": "claude process exited with code 1",
  "stderr": "Error: ..."
}
```

---

## 5. Gateway → Host 消息

### 5.1 连接确认

```json
{ "type": "connected", "host_id": "host-uuid" }
```

### 5.2 心跳确认

```json
{ "type": "ack", "timestamp": 1711872000 }
```

### 5.3 执行 Claude 请求（run_claude）

```json
{
  "type": "command",
  "action": "run_claude",
  "request_id": "req-uuid",
  "username": "alice",
  "prompt": "帮我写一个 REST API",
  "session_id": "sess-xxx",
  "conversation_id": "conv-uuid",
  "model": "claude-sonnet-4-6",
  "effort": "max",
  "allowed_tools": "",
  "project_dir": "/home/alice/projects/my-api"
}
```

| 字段 | 必填 | 说明 |
|------|:----:|------|
| `request_id` | Y | 请求唯一 ID，用于关联所有响应流 |
| `username` | Y | 以此 Linux 用户身份执行 |
| `prompt` | Y | 用户提示词 |
| `project_dir` | Y | 工作目录 |
| `session_id` | N | Claude session，为空则新建 |
| `conversation_id` | N | 网关侧路由用，Host 可忽略 |
| `model` | N | 指定模型 |
| `effort` | N | 思考深度（low / medium / high / max） |
| `allowed_tools` | N | 限制 Claude 可用工具 |

### 5.4 停止 Claude（stop_claude）

```json
{ "type": "command", "action": "stop_claude", "request_id": "req-uuid" }
```

### 5.5 创建系统用户（create_user）

```json
{ "type": "command", "action": "create_user", "request_id": "req-uuid", "username": "alice" }
```

响应：

```json
{
  "type": "response",
  "request_id": "req-uuid",
  "status": "ok",
  "data": { "username": "alice", "home_dir": "/home/alice", "created": true }
}
```

### 5.6 验证 Claude 可用性（verify_claude）

```json
{ "type": "command", "action": "verify_claude", "request_id": "req-uuid", "username": "user1" }
```

响应：

```json
{
  "type": "response",
  "request_id": "req-uuid",
  "status": "ok",
  "data": { "username": "user1", "available": true, "plan": "pro", "expires_at": "2026-06-01T00:00:00Z" }
}
```

### 5.7 创建项目目录（create_project_dir）

```json
{
  "type": "command",
  "action": "create_project_dir",
  "request_id": "req-uuid",
  "username": "user1",
  "path": "/home/user1/projects/new-project"
}
```

### 5.8 列出用户（list_users）

```json
{ "type": "command", "action": "list_users", "request_id": "req-uuid" }
```

---

## 6. stream-json 事件生命周期

Host 通过以下命令调用 Claude CLI 并解析其 NDJSON 输出：

```bash
sudo -u <username> -- claude -p "<prompt>" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --resume <session_id>
```

> **`--include-partial-messages` 是逐 token 实时流输出的关键**，否则仅在消息完成后才输出。

### 6.1 事件类型一览

```
system (初始化)
 └─ session_id, model, tools, cwd

stream_event: message_start
 └─ usage: input_tokens, cache_read_input_tokens, cache_creation_input_tokens

stream_event: content_block_start
 └─ content_block.type = "thinking" | "text"

stream_event: content_block_delta          ← 核心：逐 token
 └─ delta.type = "thinking_delta"  → delta.thinking = "思考文本"
 └─ delta.type = "text_delta"      → delta.text = "回复文本"
 └─ delta.type = "signature_delta" → （忽略）

stream_event: content_block_stop

stream_event: message_delta
 └─ usage: output_tokens, stop_reason

stream_event: message_stop

assistant (完整消息汇总)

rate_limit_event
 └─ status, resetsAt, rateLimitType

result (最终结果)
 └─ total_cost_usd, duration_ms, duration_api_ms, num_turns, modelUsage
```

### 6.2 Thinking / Extended Thinking

| effort 值 | 行为 |
|-----------|------|
| （默认） | 无思考过程，仅 text block |
| `low` | 最简回答 |
| `medium` | 标准回答 |
| `high` | 更深入推理 |
| `max` | **启用 extended thinking**：thinking block + text block（仅 Opus 4.6） |

---

## 7. Host 进程模型与多用户隔离

### 7.1 架构

```
┌─────────────────────────────────────────────────┐
│  claude_host 进程（以 root 运行）                │
│                                                 │
│  ┌──────────┐     ┌──────────────────────────┐  │
│  │ HostAgent │     │ ClaudeRunner 池           │  │
│  │           │     │                          │  │
│  │ - 连接 GW │     │  alice: [running]        │  │
│  │ - 心跳    │────►│  bob:   [running]        │  │
│  │ - 指令    │     │  user3: [idle]           │  │
│  │           │     │                          │  │
│  └──────────┘     └──────────────────────────┘  │
│       │                    │                    │
│       │            ┌───────┴───────┐            │
│       │            │ UserManager   │            │
│       │            │ - 用户检测     │            │
│       │            │ - Claude 验证  │            │
│       │            │ - 用户创建     │            │
│       │            └───────────────┘            │
│       │                    │                    │
│       │            ┌───────┴───────┐            │
│       │            │ LinuxOps      │            │
│       │            │ (9 managers)  │            │
│       │            └───────────────┘            │
└─────────────────────────────────────────────────┘
```

### 7.2 多用户执行隔离

每个 Claude 请求以目标 Linux 用户身份执行，实现凭据与文件系统隔离：

```
主机上的系统用户         Claude 凭据                          隔离效果
alice                   /home/alice/.claude/.credentials.json  独立 Claude 账户
bob                     /home/bob/.claude/.credentials.json    独立 Claude 账户
user3                   /home/user3/.claude/.credentials.json  独立 Claude 账户
```

执行命令：

```bash
sudo -u <username> -- claude -p "<prompt>" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  --resume <session_id>
```

并发规则：
- 每个系统用户**同一时间只执行一个** Claude 请求（CLI 限制）
- 不同系统用户可**并行**执行
- 通过心跳中 `busy` 字段上报忙闲状态

### 7.3 自动用户创建

当 `run_claude` 指令中的 `username` 在 Host 上不存在时，Host 自动创建：

1. 验证用户名合法性：`^[a-z_][a-z0-9_-]{0,31}$`
2. 执行 `useradd -m -s /bin/bash <username>`
3. 创建项目目录并 `chown` 给该用户
4. 将用户加入 `known_users` 动态列表
5. 后续心跳自动包含新用户

通过 `AUTO_CREATE_USERS=true` 环境变量控制（默认开启）。

### 7.4 项目目录管理

- 收到 `run_claude` 或 `create_project_dir` 时，自动确保目录存在
- 以目标用户身份创建：`sudo -u <username> mkdir -p <project_dir>`
- 路径白名单：仅允许 `/home/` 下的路径（防 path traversal）

---

## 8. Claude 账户信息采集

### 8.1 检测方法

```bash
sudo -u <username> claude --version          # 验证 CLI 可用
sudo -u <username> claude -p "hi" \
  --output-format json --max-turns 1 \
  --no-session-persistence                   # 验证账户可用
sudo -u <username> claude auth status        # 检查登录状态
```

### 8.2 采集字段

| 字段 | 来源 | 说明 |
|------|------|------|
| `plan` | system 事件 / 配置文件 | pro, max, team, enterprise |
| `expires_at` | 配置文件 / 管理员设置 | 到期时间 |
| `status` | 运行时检测 | active, expired, rate_limited |
| `email` | 配置文件 | Claude 登录邮箱 |

---

## 9. 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CENTRAL_SERVER_URL` | （必填） | Gateway WebSocket 地址，如 `wss://gw.example.com/host/connect` |
| `GATEWAY_URL` | — | `CENTRAL_SERVER_URL` 的旧名（向后兼容） |
| `HOST_TOKEN` | （必填） | 主机认证 token |
| `HOST_ID` | （自动生成） | 主机唯一标识 |
| `HEARTBEAT_INTERVAL` | `30` | 心跳间隔（秒） |
| `CLAUDE_USERS` | （当前用户） | 初始可用系统用户列表，逗号分隔 |
| `CLAUDE_PROJECT_DIR` | `../project` | 默认项目目录 |
| `AUTO_CREATE_USERS` | `true` | 是否自动创建不存在的系统用户 |

---

## 10. 安全

### 10.1 host_token 保护

- `host_token` 是主机身份凭证，泄露则可冒充主机
- 建议存放 `/etc/claude-host/token`，权限 `0600`
- Gateway 支持吊销与重新生成

### 10.2 系统用户隔离

- 每个用户独立 home 目录、独立 Claude 凭据
- 项目路径严格限制在 `/home/` 下
- Host 拒绝路径越界请求（path traversal 防护）
- 用户名格式限制：`^[a-z_][a-z0-9_-]{0,31}$`

### 10.3 进程隔离

- Claude 进程始终以目标用户身份运行（`sudo -u`）
- 仅在创建用户时使用 root 权限
- 推荐 sudoers 配置：`claude-host ALL=(ALL) NOPASSWD: /usr/local/bin/claude`
- 进程组管理确保停止时子进程一并终止

### 10.4 网络

- Host → Gateway 连接必须使用 TLS（WSS）
- Host 无需开放任何入站端口
- 内网环境可通过 HTTP 代理连接 Gateway

---

## 相关文档

- [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) — 系统整体架构
- [gateway-api.md](./gateway-api.md) — 客户端 API 参考（REST + WebSocket）
- [claude-code.md](./claude-code.md) — Claude Code CLI 完整参数参考
- [CENTER_PLATFORM_ROADMAP.md](./CENTER_PLATFORM_ROADMAP.md) — 产品路线图与模块清单
