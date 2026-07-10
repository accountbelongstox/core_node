# WebClaude Group - Architecture Guide

> Last updated: 2026-04-02

**See also:**
> - [CENTER_PLATFORM_ROADMAP.md](./CENTER_PLATFORM_ROADMAP.md) — 产品路线图、角色、模块清单
> - [host-protocol.md](./host-protocol.md) — Host ↔ Gateway 通信协议（权威参考）
> - [gateway-api.md](./gateway-api.md) — 客户端 API 参考（REST + WebSocket）
> - [claude-code.md](./claude-code.md) — Claude Code CLI 参数参考
>
> **`webclaude_gateway`** 仓库功能已合并到 **`webclaude_go-gateway`**（Legacy，不再独立部署）。

## 1. System Overview

WebClaude Group is a multi-component platform that provides web-based access to Claude Code and other AI models. The architecture follows a **layered microservice pattern** with clear separation of concerns.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        End Users (Browser)                          │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTPS / WSS
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    webclaude_website                                  │
│                    (React 19 + TypeScript + Vite)                     │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │
│  │ Chat UI  │  │ Dashboard│  │ API Keys  │  │ Admin Panel      │   │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └───────┬──────────┘   │
│       │    ApiManager + JWT / StateCenter                           │
└───────┼─────────────┼───────────────────────────────────────────────┘
        │ WSS         │ REST (HTTP)
        ▼             ▼
┌───────────────────────────────┐    ┌──────────────────────────────────┐
│ webclaude_go-gateway          │    │ webclaude_center_server          │
│ Go: HTTP API + WebSocket      │    │ Node.js Express                  │
│ `internal/websocket/` relays  │    │ Users, keys, billing, admin      │
│ browser ↔ claude_host         │    │ MySQL + Redis                    │
└───────────────┬───────────────┘    └────────────────┬─────────────────┘
                │                                      │ Shared DB
                │ WSS reverse tunnel (host connects) │
                ▼                                      │
┌──────────────────────────────────────────────────────────────────────┐
│                      claude_host (Python)                             │
│                      core_node/pyapps/claude_host                    │
│  HostAgent (WS client) │ ClaudeRunner │ LinuxOps (9 managers)       │
│  System User Isolation │ Path Whitelist │ Token Auth                 │
└──────────────────────────────────────────────────────────────────────┘

Note: `webclaude_gateway` (standalone bridge) has been merged into webclaude_go-gateway — do not deploy separately.
```

## 2. Component Responsibilities

### 2.1 webclaude_website (Frontend)
- **Tech**: React 19, TypeScript, Vite 6, Tailwind CSS
- **Role**: User-facing SPA with chat UI, dashboard, API key management, admin panel
- **API Layer**: ApiManager with multi-endpoint auto-detection (localhost → LAN → production)
- **Auth**: JWT token in localStorage, automatic 401 redirect
- **i18n**: English, Chinese, Japanese, Korean

### 2.2 webclaude_center_server (Management Server)
- **Tech**: Node.js 18+, Express.js
- **Role**: Central management and administration
- **Key Features**:
  - User authentication (JWT, LDAP, OAuth)
  - API key CRUD with rate limiting and cost tracking
  - Multi-provider account management (Claude, Gemini, OpenAI, Bedrock, Azure, Droid)
  - Subscription and payment processing (Alipay, WeChat, Stripe)
  - Admin dashboard and usage analytics
  - Webhook notifications
- **Data**: MySQL (persistent) + Redis (cache/sessions)

### 2.3 webclaude_go-gateway (API Relay + Bridge)
- **Tech**: Go 1.24, chi router
- **Port**: 18200 (HTTP + WebSocket)
- **Role**: High-performance API proxy, relay, and WebSocket bridge (includes functionality formerly in standalone `webclaude_gateway`)
- **Key Features**:
  - Multi-provider API routing (Claude, OpenAI, Gemini, Azure, Bedrock)
  - Account pool management with scoring-based selection
  - Session affinity for conversation continuity
  - Rate limiting and concurrency control
  - Usage event tracking
  - **WebSocket relay + bridge** (`internal/websocket/`): browser chat + `claude_host` reverse tunnel
- **Data**: Shared MySQL + Redis with center_server

> **Legacy note**: The standalone `webclaude_gateway` repository previously implemented a separate WebSocket bridge. That functionality has been **merged into `webclaude_go-gateway`** (`internal/websocket/`). The `webclaude_gateway` directory is retained for history only — do not deploy it.

### 2.4 claude_host (Host Agent)
- **Tech**: Python 3.7+, websockets
- **Role**: Remote Claude CLI executor
- **Key Features**:
  - Reverse WebSocket tunnel to **webclaude_go-gateway**
  - Claude CLI subprocess management (stream-json protocol)
  - Multi-user isolation (sudo-based)
  - System operations (9 composable managers)
  - Heartbeat with system metrics

## 3. Communication Patterns

### 3.1 REST API (Frontend ↔ Center Server)
```
Frontend  ──HTTP──►  center_server
         Authorization: Bearer <JWT>

Endpoints:
  /users/*           - User auth, profile, API keys
  /admin/*           - Admin operations, accounts, dashboard
  /subscriptions/*   - Plans, orders, payments
  /health            - Health check
  /metrics           - System metrics
```

### 3.2 WebSocket (Frontend ↔ go-gateway ↔ Host)
```
Frontend  ──WSS──►  webclaude_go-gateway :18200 (internal/websocket)  ──WSS──►  claude_host

Message families (exact types vary; see go-gateway docs):
  Client chat messages  ↔  host command / stream events (run_claude, deltas, result, error)

Note: All WebSocket relay and bridge traffic goes through webclaude_go-gateway.
The standalone webclaude_gateway (port 18200) is legacy and no longer used.
```

### 3.3 Permissions and keys
API key validation and account pool data are read by **go-gateway** from **shared MySQL** (written by **center_server**). There is **no** separate bridge process syncing permissions.

### 3.4 Shared Database (Center Server ↔ Go-Gateway)
```
Both services share:
  MySQL: claude_relay database
    - provider_accounts, api_keys, users, subscriptions, usage_events, etc.
  Redis:
    - Sessions, caches, rate limits, concurrency counters, OAuth tokens
```

## 4. Recommended Architecture Patterns

### 4.1 API Gateway Pattern (BFF - Backend for Frontend)

Based on industry best practices for React + Node.js + Go microservice architecture:

- **Single Entry Point**: The center_server acts as a BFF (Backend for Frontend), aggregating data from multiple backend services into frontend-optimized responses
- **Protocol Translation**: Go-gateway handles protocol differences between AI provider APIs, presenting a unified interface
- **Cross-Cutting Concerns**: Authentication, rate limiting, and logging are handled at the gateway layer, not in individual services

### 4.2 Reverse Proxy + WebSocket Tunnel

The WebSocket architecture follows the **reverse tunnel pattern**:

1. claude_host initiates outbound WebSocket connection to **webclaude_go-gateway** (NAT-friendly)
2. Go-gateway maintains connection registry and routes frontend requests to appropriate hosts
3. Stream events flow back through the same tunnel in real-time
4. Heartbeats maintain connection liveness and provide load metrics

This pattern is recommended for:
- Hosts behind NAT/firewalls
- Dynamic host scaling (hosts connect/disconnect freely)
- Load-based routing with real-time metrics

### 4.3 Shared Database with Service Ownership

Center Server and Go-Gateway share MySQL/Redis, but with clear ownership:
- **center_server owns**: User data, subscriptions, payments, API key CRUD
- **go-gateway owns**: Usage events, session affinity, real-time rate counters
- **Both read**: Account pool, API key configurations

This avoids complex inter-service APIs while maintaining data consistency.

### 4.4 Event Streaming for Real-Time UI

For enhanced frontend-backend integration:

```
claude_host (stream-json)
    │
    ▼ WebSocket
gateway (route + relay)
    │
    ▼ WebSocket
website (React state update)
    │
    ▼ Virtual DOM
Chat UI (real-time rendering)
```

**Recommended enhancements:**
- Server-Sent Events (SSE) as WebSocket fallback
- Reconnection with session resumption (session_id persistence)
- Optimistic UI updates with server confirmation
- Backpressure handling for high-throughput streams

## 5. Data Flow Diagrams

### 5.1 User Authentication Flow
```
Browser → center_server: POST /users/login {email, password}
center_server → MySQL: Verify credentials
center_server → Redis: Create session
center_server → Browser: {token, user profile}
Browser → localStorage: Store JWT token
Browser → All APIs: Authorization: Bearer <token>
```

### 5.2 Chat Message Flow
```
Browser → gateway/ws: {type: "send_message", content, username, model}
gateway → host/ws: {type: "command", action: "run_claude", prompt, ...}
host → Claude CLI: claude -p "prompt" --output-format stream-json
Claude CLI → host: stream-json events (delta, usage, result)
host → gateway/ws: {type: "stream", event: {...}}
gateway → browser/ws: {type: "claude_host_stream", data: {event: {...}}}
```

### 5.3 API Key Relay Flow
```
External Client → go-gateway: POST /api/v1/messages (API key in header)
go-gateway → Redis: Validate API key, check rate limits
go-gateway → Account Pool: Select best account (scoring algorithm)
go-gateway → Claude API: Proxy request with selected account credentials
Claude API → go-gateway: Stream response
go-gateway → Redis: Record usage event
go-gateway → External Client: Stream response
```

## 6. Deployment Topology

### Production Setup
```
                     ┌─ Nginx (SSL termination, static files)
                     │
                     ├─ webclaude_website (built static → Nginx serves)
                     │
Internet ── Nginx ───├─ webclaude_center_server :18100 (Node.js)
                     │
                     ├─ webclaude_go-gateway :18200 (Go binary; HTTP + WebSocket)
                     │
                     ├─ MySQL :3306
                     │
                     └─ Redis :6379

Remote Hosts:
  claude_host ──WSS──► webclaude_go-gateway (host WebSocket path; see GATEWAY_INTEGRATION.md)
```

### Docker Compose
Each service has its own Dockerfile. The center_server includes a multi-stage build that also compiles the embedded admin SPA and user portal.

## 7. Security Considerations

| Layer | Mechanism |
|-------|-----------|
| Frontend | JWT token, HTTPS only, CORS restrictions |
| Center Server | bcrypt passwords, LDAP/OAuth, session timeout, admin auth |
| Go-Gateway | API key validation, rate limiting, concurrency limits, AES encryption, WebSocket relay |
| Claude Host | Token auth, path whitelist, user isolation (sudo), process groups |
| Database | Connection pooling, credential encryption, prepared statements |

## 8. Monitoring & Health

| Service | Health Endpoint | Metrics |
|---------|----------------|---------|
| center_server | `GET /health` | Redis, Logger, Memory, Version |
| go-gateway | `GET /health` | Redis, MySQL, Memory |
| go-gateway | `GET /metrics` | Prometheus format |
| claude_host | Heartbeat | CPU load, memory, user status, active count |

## 9. Future Architecture Recommendations

### 9.1 WebSocket single relay
**Policy:** Only **`webclaude_go-gateway`** (port 18200) runs WebSocket relay and bridge for chat/host. The standalone **`webclaude_gateway`** repo is **legacy** (merged into go-gateway) and must not be deployed.

### 9.2 Event Bus
Introduce Redis Streams or a lightweight message queue for:
- Real-time dashboard updates
- Usage event processing
- Cross-service notifications

### 9.3 API Versioning
Implement API versioning (e.g., `/api/v2/`) for backwards-compatible evolution.

### 9.4 Observability Stack
Add structured logging (JSON), distributed tracing (OpenTelemetry), and centralized dashboards (Grafana).

### 9.5 Local Dev Hot Reload

Every project ships `start.sh` + `start.ps1` with idempotent prerequisite "ensure" handling (deps, env, services) **and** hot reload. The unified launcher `scripts/start.{sh,ps1}` starts all four ends in hot-reload mode — edit code and changes apply automatically:

| Service | Hot reload | Prefer / fallback | Ensure (prerequisites) |
|---------|-----------|-------------------|------------------------|
| webclaude_center_server | **nodemon** | local `node_modules/.bin/nodemon` → global → plain `node` | deps check, hash-guarded `npm install`, `.env` (CRLF fix), admin auto-setup, MySQL/Redis TCP probe |
| webclaude_go-gateway | **air** | `air` → built binary | `ensure_go` (auto-install via core_node `55_install_golang22.sh`), `GOPROXY`/`GOSUMDB` fix, `go mod tidy`, `.env`, readiness |
| webclaude_website | **Vite HMR** | `pnpm run dev` | Node/pnpm check, `pnpm install`, clear `node_modules/.vite` |
| claude_host | **watchdog** | `start.sh --dev` → `scripts/dev_reload.py` (auto-installs `watchdog`) | python3 check, `pip install` websockets, config hints |

The unified launcher passes `--dev` to `claude_host` so it reloads on `*.py` changes, matching the other three. Standalone, each project's own `start` script also defaults to its hot-reload path (the host needs the `--dev` flag).

---

## Internal Documentation

| 文档 | 说明 |
|------|------|
| [host-protocol.md](./host-protocol.md) | Host ↔ Gateway 通信协议与执行模型（权威） |
| [gateway-api.md](./gateway-api.md) | Gateway & Center Server API 参考（权威） |
| [claude-code.md](./claude-code.md) | Claude Code CLI 参数参考 |
| [CENTER_PLATFORM_ROADMAP.md](./CENTER_PLATFORM_ROADMAP.md) | 产品路线图、角色、模块清单 |
| [dom-mirror-remote-browsing.md](./dom-mirror-remote-browsing.md) | [研究] DOM 镜像方案调研 |
| [prompt_history_log.md](./prompt_history_log.md) | 提示词历史记录（仅追加，不修改已有条目） |

## External References

- [API Gateway Pattern - microservices.io](https://microservices.io/patterns/apigateway)
- [NGINX as a WebSocket Proxy](https://www.f5.com/company/blog/nginx/websocket-nginx)
