# Prompt History Log

Record of key prompts and decisions that shaped this project group.

**Later architecture note (2026-04-02):** The standalone **`webclaude_gateway`** service is **not used** (duplicate of WebSocket relay in **`webclaude_go-gateway`**). Log entries that mention deploying both gateways are **historical**; see `CENTER_PLATFORM_ROADMAP.md`.

---

## 2026-04-02 — Project Group README & claude_host Migration to core_node

**Prompt (summarized):**

> Write a README for webclaude_group indicating it is a project group containing
> frontend, backend, and demo sub-projects. Briefly describe the role of each.
> Then create a `claude_host` sub-app under `core_node/pyapps/` following
> core_node project conventions, marking it as the new host for this project
> group. From this point on, the WebClaude Group has a sub-project living inside
> core_node. All code must be written in English. This prompt should be recorded
> in a history log file.

**Actions taken:**

1. Created `webclaude_group/README.md` — describes the project group structure
   (frontend: webclaude_website, backend: go-gateway + claude_host, demos:
   dome_web + dome_html).
2. Created `core_node/pyapps/claude_host/` with:
   - `__init__.py` — app metadata (follows core_node pyapp convention).
   - `claude_host_main.py` — main entry point, async WebSocket host agent.
   - `requirements.txt` — dependencies.
3. Created this prompt history log file.

**Decision:** The primary claude_host now lives in `core_node/pyapps/claude_host`
as a standard pyapp. The original copy in `webclaude_group/claude_host/` is
retained as reference.

---

## 2026-04-02 — claude_host v2.0: Multi-File Architecture Refactor

**Prompt (summarized):**

> Read the old host (`webclaude_group/claude_host/`) and the new host
> (`core_node/pyapps/claude_host/`). Based on the old host's full functionality
> (server.py 766 lines + linux_ops.py 1467 lines) and core_node project
> conventions (absolute imports, `{appname}_main.py` entry point with `start()`,
> namespace dirs with `{appname}_` prefix, controller/service/model layers),
> expand the new host into a proper multi-file architecture. All code in English.
> Record this prompt in the history log.

**Actions taken:**

1. Studied core_node conventions from:
   - `development-guides/PYCORE_PYAPPS_STRUCTURE.md`
   - `development-guides/PYTHON_PYCORE.md`
   - `pycore/pyfoundations/app_launcher.py` (entry point discovery)
   - Existing pyapps (mcp, screen_monitor, voice_data_init)

2. Restructured `core_node/pyapps/claude_host/` from 3 files to 23 files:
   - **model/** — `data_types.py` with all shared dataclasses (CmdResult,
     UserInfo, ProcessInfo, MemoryInfo, DiskInfo, NetInterface, SystemInfo,
     ServiceStatus)
   - **claude_host_config/** — all env-driven configuration constants, extracted
     from old server.py globals
   - **service/** — split old `linux_ops.py` (1467 lines) into 10 focused modules:
     cmd_utils, user_manager, file_manager, process_manager, system_info,
     service_manager, network_manager, package_manager, shell_executor,
     cron_manager, plus linux_ops.py as the aggregating facade
   - **controller/** — split old `server.py` into `claude_runner.py` (CLI process
     lifecycle + stream-json parsing) and `host_agent.py` (gateway WebSocket
     connection, command dispatch, heartbeat, user management)
   - **claude_host_main.py** — entry point with `start()` and `main()`, prints
     startup banner, handles signal-based shutdown
   - **__init__.py** — v2.0 metadata, re-exports start/main
   - **scripts/** — updated start.sh and start.ps1 to launch via pymain.py

3. Updated `webclaude_group/README.md` with the new directory tree.
4. Updated this prompt history log.

**Key decisions:**
- All imports are absolute (`from pyapps.claude_host.service.user_manager import ...`)
- LinuxOps remains the unified facade (same API as old code)
- ClaudeRunner receives `ops: LinuxOps` via constructor (no global singleton)
- Entry point uses `start()` as primary (core_node convention), `main()` as alias
- Version bumped to 2.0.0 to reflect the architectural change

---

## 2026-04-02 — End-to-End Flow: Frontend -> Central Server -> Host

**Prompt (summarized):**

> Verify that the host supports receiving username, session_id, project_dir,
> and prompt. If the username does not exist on Linux, auto-create it. Auto-create
> the project directory. Start Claude CLI under that user and return results via
> WebSocket. The central server handles auth/permissions and relays between frontend
> and host. The frontend (webclaude_website chat module) needs UI to set username and
> project directory. Connect the full flow: frontend -> central server -> host. Check
> official docs, update documentation. All code in English. Record this prompt.

**Analysis results:**

1. **Host (core_node/pyapps/claude_host):** Already fully supports all requirements.
   - `run_claude` command accepts: username, session_id, project_dir, prompt, model, effort
   - Auto-creates Linux users via `_ensure_user_ready()` (respects AUTO_CREATE_USERS)
   - Auto-creates project directories via `ensure_user_dir()` with proper ownership
   - Returns stream-json events via WebSocket in real time
   - **No changes needed.**

2. **Central Server (webclaude_go-gateway):** Needed a new host relay handler.
   - Central server already had JSON envelope protocol with type switching
   - Added `internal/websocket/host_relay.go` — HostRelayManager with:
     - `RegisterHost()` — host agents connect and register
     - `HandleClientRequest()` — translates frontend messages to host commands
     - `HandleHostMessage()` — relays host stream events back to clients
     - `HandleClientCancel()` — forwards stop commands to hosts
     - `RemoveHost()` — cleanup on host disconnect
   - Modified `server.go`:
     - Added `hostRelay` field to Server struct
     - Added switch cases: `host_register`, `claude_host_request`, `claude_host_cancel`, `stream`, `heartbeat`
     - Added `hostRelay.RemoveHost(ws)` to `handleClose()`

3. **Frontend (webclaude_website):** Extended chat module with host settings UI.
   - `types.ts`:
     - Added `HostSettings` interface (username, projectDir)
     - Added username/projectDir to `ClientMessage`, `ChatSession`, `SessionInfo`
     - Added central server envelope types: `claude_host_stream`, `claude_host_response`, `claude_host_error`, `claude_host_ack`
   - `claude-client.ts`:
     - Extended `startSession()` to accept username/projectDir
     - Extended `sendMessage()` to accept username/projectDir/model/effort/sessionId
     - Added central server envelope message handling (`claude_host_stream`, `claude_host_response`, etc.)
     - Added `handleHostEvent()` to translate host stream events (delta, system, result, etc.) into client events
   - `useClaudeChat.ts`:
     - Added username/projectDir/effort to `UseClaudeChatOptions`
     - `sendMessage()` now forwards host settings with each message
     - `startNewSession()` now passes username/projectDir
   - `ChatInput.tsx`:
     - Added "Host" dropdown button in selector bar (shows when `chatMode === 'claude'`)
     - Dropdown panel with Linux Username and Project Directory input fields
     - Auto-create note: "User and directory are auto-created on the host if they do not exist."
   - `ChatPage.tsx`:
     - Added `hostSettings` state persisted to localStorage (`webclaude_host_settings`)
     - Passed hostSettings to `useClaudeChat()` hook
     - Passed hostSettings to `ChatInput` component
     - Updated `handleNewChat()` to include hostSettings in new sessions

**Message protocol (end-to-end):**

```
Frontend -> Central Server:
  { type: "claude_host_request", data: { prompt, username, projectDir, model, effort, sessionId } }

Central Server -> Host:
  { type: "command", action: "run_claude", request_id, prompt, username, project_dir, model, effort }

Host -> Central Server:
  { type: "stream", request_id, event: { type: "delta"|"system"|"result"|..., ... } }

Central Server -> Frontend:
  { type: "claude_host_stream", data: { requestId, event: { ... } } }
```

**Files modified:**
- `webclaude_website/pages/chat/types.ts`
- `webclaude_website/pages/chat/lib/claude-client.ts`
- `webclaude_website/pages/chat/hooks/useClaudeChat.ts`
- `webclaude_website/pages/chat/components/ChatInput.tsx`
- `webclaude_website/pages/ChatPage.tsx`
- `webclaude_go-gateway/internal/websocket/host_relay.go` (new)
- `webclaude_go-gateway/internal/websocket/server.go`
- `webclaude_group/README.md`
- `webclaude_group/docs/prompt_history_log.md`

---

## 2026-04-02 — Terminology: "Gateway" -> "Central Server"

**Prompt (summarized):**

> Rename `webclaude_go-gateway` to be described as "central server"
> (中心服务器) in all documentation and code comments. The "gateway" is an
> independent, separate project that communicates with the central server — it
> is NOT part of this project group. Abstract the code accordingly. Update all
> conflicting documentation and code. All code in English. Append this prompt
> to `docs/prompt_history_log.md`.

**Rationale:** The Go project `webclaude_go-gateway` is the relay hub
where all clients and hosts connect directly. The term "gateway" was causing
confusion because an independent gateway project also exists as a separate
entity. To disambiguate, the relay hub is now consistently called "central
server" throughout the codebase.

**Actions taken:**

1. **`webclaude_group/README.md`** — fully rewritten:
   - Architecture diagram clearly labels "Central Server (Go)" vs "Gateway (independent)"
   - Sub-projects table updated with terminology
   - End-to-end message flow diagram uses "Central Server" labels
   - Added note: Gateway is NOT part of this project group

2. **`webclaude_go-gateway/internal/websocket/host_relay.go`** — updated all comments:
   - "Gateway" → "Central Server" in module docstring and message flow diagram
   - Clarified that the central server is the relay hub

3. **`core_node/pyapps/claude_host/` (Python host agent):**
   - `claude_host_config/__init__.py` — `GATEWAY_URL` renamed to `CENTRAL_SERVER_URL`
     (with `GATEWAY_URL` fallback for backward compat)
   - `controller/host_agent.py` — `_build_gateway_url()` → `_build_server_url()`,
     all log messages and comments updated
   - `claude_host_main.py` — docstring, architecture diagram, env var docs, and
     banner all updated to say "central server"
   - `__init__.py` — docstring updated ("relay gateway" → "central server")

4. **Frontend (`webclaude_website`):**
   - `types.ts` — comment "Gateway envelope messages" → "Central server envelope messages"
   - `claude-client.ts` — comment "Handle gateway envelope format" → "Handle central server envelope format"

5. **`docs/prompt_history_log.md`:**
   - Fixed all "Gateway" → "Central Server" in the existing entry #3
   - Appended this entry (#4)

**Files modified:**
- `webclaude_group/README.md`
- `webclaude_go-gateway/internal/websocket/host_relay.go`
- `core_node/pyapps/claude_host/__init__.py`
- `core_node/pyapps/claude_host/claude_host_config/__init__.py`
- `core_node/pyapps/claude_host/claude_host_main.py`
- `core_node/pyapps/claude_host/controller/host_agent.py`
- `webclaude_website/pages/chat/types.ts`
- `webclaude_website/pages/chat/lib/claude-client.ts`
- `webclaude_group/docs/prompt_history_log.md`

---

## 2026-04-02 — webclaude_gateway Creation & Architecture Restructure

### Original Prompt

```
core_node/pyapps/claude_host and webclaude_website chat module need a gateway
for relay communication. Check if this is already implemented in
webclaude_go-gateway. If not, add a webclaude_gateway sub-project to
the group. If it exists, model one based on the same logic into webclaude_gateway.

Current architecture: frontend and core_node host communicate through the gateway
bridge. The gateway communicates with webclaude_go-gateway to get permission
lists from the central server.

Update all conflicting documentation and code. Code must be in English.
This prompt should be organized and saved to a history log file as code.
```

### Analysis

1. **webclaude_go-gateway** is a multi-provider AI API relay (Claude, OpenAI,
   Gemini, Azure, Bedrock). It handles:
   - API key authentication and account pooling
   - Session affinity and load balancing
   - SSE streaming relay
   - WebSocket reverse tunnels for VPN/proxy use

2. **Missing from webclaude_go-gateway for webclaude use case:**
   - Direct WebSocket relay protocol matching webclaude_website's chat protocol
   - Lightweight bridge between frontend and claude_host
   - The relay gateway is a heavy multi-provider system; webclaude needs a
     focused bridge gateway

3. **gateway-old (server.js)** had the exact relay logic needed:
   - Host reverse WebSocket connections (`/host?token=xxx&host_id=yyy`)
   - Client WebSocket connections (`/client?key=xxx`)
   - Request routing with conversation affinity
   - Session ID caching

### Decision

Created **webclaude_gateway** as a new Go sub-project that:

1. Implements the WebSocket relay bridge (modeled after gateway-old/server.js)
2. Supports both gateway-old protocol (`action: "run"`) and frontend protocol
   (`type: "send_message"`) for backward compatibility
3. Syncs permission lists from webclaude_go-gateway via HTTP
4. Provides REST API endpoints for health and permission management

### Architecture

```
webclaude_website ←─ WS /ws ──→ webclaude_gateway ←─ WS /host ──→ claude_host
     (React)                           │                            (Python)
                                       │ HTTP GET /internal/permissions
                                       ▼
                            webclaude_go-gateway
                            (permission list, account pool)
```

### Files Created

```
webclaude_gateway/
├── cmd/gateway/main.go              # Entry point, HTTP+WS server
├── internal/
│   ├── config/config.go             # Environment-based configuration
│   ├── wsrelay/
│   │   ├── router.go                # Core relay: routing, cleanup, state
│   │   ├── host.go                  # Host WS handler (claude_host)
│   │   └── client.go                # Client WS handler (frontend)
│   ├── permission/sync.go           # Permission sync from relay gateway
│   ├── middleware/auth.go           # JWT auth + CORS middleware
│   ├── api/handlers.go              # REST API (health, permissions)
│   └── models/models.go            # Shared data structures
├── .env.example                     # Configuration template
├── go.mod                           # Go module definition
└── README.md                        # Project documentation
```

### Documentation Updated

- `webclaude_group/README.md` — Updated architecture diagram to show
  webclaude_gateway as the bridge layer, added to sub-projects table,
  updated end-to-end message flow diagram
- `docs/gateway-api.md` — Added architecture update note explaining the
  two-gateway split (webclaude_gateway for bridge, webclaude_go-gateway
  for central relay) and current implementation status

### Key Design Decisions

1. **Dual protocol support**: Client handler accepts both `action: "run"`
   (gateway-old compat) and `type: "send_message"` (frontend protocol)
2. **Permission sync over HTTP**: webclaude_gateway periodically fetches
   permission entries from webclaude_go-gateway rather than duplicating
   the database layer
3. **Session affinity**: Conversations are pinned to hosts for Claude session
   continuity (same pattern as gateway-old)
4. **Least-loaded host selection**: When no affinity exists, picks the host
   with fewest active requests
5. **Code language**: All code written in English per requirement
6. **Go language choice**: Matches webclaude_go-gateway for consistency
   across the gateway layer

---

## 2026-04-02 — Gateway Code Audit, Keystore, Session Cache & Multi-Session Support

### Original Prompt

```
Review the gateway for completeness and redundant code. Use JSON on the gateway
to build a data store including: key, system username, project paths (array).
After that, the frontend inputs key + prompt, and the gateway auto-resolves the
system username, project path, and prompt for the host. The host processes and
returns results.

Align all logic code. Support multi-user, multi-claude session IDs. The gateway
must cache a set of Claude session IDs; the frontend can select existing session
IDs. Extend all code, update all conflicting docs and code, consult necessary
official docs. Code must be all in English. Save this prompt to
docs/prompt_history_log.md.
```

### Code Audit Results

**Redundancies found and removed:**
1. `GatewayEnvelope` struct — never used → removed
2. `ClientWelcome` struct — used once → replaced with inline map
3. `LookupByPrefix()` in permission/sync.go — never called → removed
4. `PermissionEntry` model — overlapped with `ClientConn` → replaced with
   local `Entry` type in permission package
5. `splitComma()` / `trimSpace()` — reinvented `strings.Split` / `strings.TrimSpace`
   → replaced with stdlib
6. Two identical `websocket.Upgrader` (hostUpgrader + clientUpgrader) → merged into
   single `wsUpgrader`
7. Auth middleware was a stub (always returned "dev-user") → removed; key
   validation now happens at WebSocket connection level via keystore
8. `ContextKey` type and constants moved from client.go to router.go (single
   definition)

### New Features Implemented

1. **JSON Keystore** (`internal/keystore/keystore.go` + `data/keys.json`):
   - Maps API key → {username, project_dirs[], level, rate_limit_rpm, max_concurrent}
   - Load/save/reload from JSON file
   - Hot-reload via `POST /api/keys/reload`

2. **Key-Based Auto-Resolve** (client.go `handleClientRun`):
   - Frontend sends `key` + `prompt` only
   - Gateway looks up key → resolves username + default project_dir
   - Forwards resolved fields to claude_host

3. **Session Cache** (router.go `RecordSession`, `ListSessionsByKey`):
   - Gateway extracts session_id from host stream events (system/result)
   - Caches session entries: {session_id, conversation_id, key_id, username,
     project_dir, model, created_at, last_active, message_count}
   - Frontend can list sessions: `{ type: "list_sessions" }` → receives
     `{ type: "sessions_list", sessions: [...] }`
   - Welcome message includes cached sessions for the key

4. **REST APIs** (api/handlers.go):
   - `GET /api/keys/info?key=xxx` — key info + cached sessions
   - `GET /api/sessions?key=xxx` — list cached sessions
   - `GET /api/keys` — list all keys (summary, no secrets)
   - `POST /api/keys` — create/update key
   - `DELETE /api/keys?key=xxx` — delete key
   - `POST /api/keys/reload` — reload keys.json

5. **Frontend Protocol Updates** (types.ts, claude-client.ts):
   - Added `CachedSession` interface
   - Added `welcome` event with `projectDirs` + `sessions`
   - Added `sessions_list` event
   - Added `list_sessions` client action
   - ClaudeClient constructor accepts `key` parameter → appended to WS URL
   - Singleton factory recreates client when key changes

### Architecture (Updated)

```
Frontend                         webclaude_gateway                     claude_host
────────                         ─────────────────                     ───────────
Connect: /ws?key=xxx ──────────► Keystore.Lookup(key)
                                 → username: "user1"
                                 → project_dirs: ["/home/user1/..."]

◄── welcome {                    
  user, level, project_dirs,     
  sessions: [{session_id, ...}]  
} ◄────────────────────────────  

Send: {type:"send_message",     handleClientRun():
  content:"fix the bug"} ──────► auto-fill username + projectDir
                                 → SelectHost() + CreateRoute()
                                 → HostCommand{username, project_dir,
                                   prompt, session_id} ────────────► run_claude
                                                                      │
◄── stream events ◄──────────── RouteHostMessage() ◄── stream ◄──────┤
                                 RecordSession(sid)                    │
◄── result {session_id} ◄────── (cache session) ◄──── result ◄───────┘

List: {type:"list_sessions"} ──► ListSessionsByKey(key)
◄── {type:"sessions_list",      
  sessions: [...]} ◄────────────

Resume: {type:"resume_session",
  sessionId:"sess-xxx"} ───────► GetSession(sid) → forward with session_id
```

### Files Modified

**Gateway (Go):**
- `internal/models/models.go` — removed `GatewayEnvelope`, `ClientWelcome`,
  `PermissionEntry`; added `KeyEntry`, `SessionEntry`; added `KeyID` to ConvCache
- `internal/config/config.go` — added `KeystorePath`; replaced hand-rolled
  `splitComma`/`trimSpace` with `strings` stdlib
- `internal/wsrelay/router.go` — merged upgrader; moved ContextKey here; added
  session cache (RecordSession, ListSessionsByKey, GetSession); added strVal
  helper; NewRelay now accepts keystore
- `internal/wsrelay/host.go` — use shared wsUpgrader; parse users from heartbeat
- `internal/wsrelay/client.go` — key-based auth at WS level; auto-resolve
  username/projectDir from keystore; handle list_sessions action; include
  sessions in welcome
- `internal/keystore/keystore.go` — NEW: JSON key store
- `internal/permission/sync.go` — simplified: local Entry type instead of
  models.PermissionEntry
- `internal/middleware/auth.go` — simplified to CORS only (key auth at WS level)
- `internal/api/handlers.go` — added KeyInfo, Sessions, KeyCreate, KeyDelete,
  KeyReload, Route(); receives keystore dependency
- `cmd/gateway/main.go` — wires keystore; removed Auth middleware; uses
  handlers.Route()

**Gateway data:**
- `data/keys.json` — NEW: sample key data file

**Frontend (TypeScript):**
- `pages/chat/types.ts` — added CachedSession, welcome, sessions_list to
  ServerMessage; added list_sessions to ClientMessage
- `pages/chat/lib/claude-client.ts` — constructor accepts key; handle welcome
  + sessions_list; added listSessions(); singleton recreates on key change

**Docs:**
- `webclaude_gateway/README.md` — rewritten for key-based flow
- `webclaude_gateway/.env.example` — added KEYSTORE_PATH
- `docs/prompt_history_log.md` — this entry

---

## 2026-04-02 — 协助团队分工、集成需求与 WebClaude 命名统一

**Prompt（整理后）：**

建立四人协作边界，并明确各仓库职责与系统间集成方式；**全文统一使用 WebClaude 命名**，不再使用「top-router」旧称。

### 协助团队（按仓库）

| 成员 | 负责路径 | 职责 |
|------|----------|------|
| A | `D:\programing\core_node\webclaude_group\webclaude_center_server` | **主服务端**：用户、Key、鉴权、管理、网关/主机注册与元数据 |
| B | `D:\programing\core_node\webclaude_group\webclaude_website` | **UI 前端**：登录/注册/用户管理、**Chat 模块**仅连中转网关 |
| C | `D:\programing\core_node\webclaude_group\webclaude_go-gateway` | **中转网关**：HTTP/WS 中继、Key 校验、与 center 同步、地接 UI 与 claude_host |
| D | `D:\programing\core_node\pyapps\claude_host` | **claude_host 端**：多平台执行与上报 |

### 集成需求（编号与原文一致）

1. **website ↔ center_server**：对接 **登录、注册、用户管理**（REST）。**Chat 模块单独**连接 **`webclaude_go-gateway`**；通过 **Key** 由网关再转发到 **`claude_host`**（不经 Chat 直连 center 做流式执行）。
2. **go-gateway ↔ center_server**：网关需向 **`webclaude_center_server` 拉取/刷新缓存的鉴权数据**，用于判断 **website 提交的 Key 是否允许转发**。
3. **center_server**：在满足接口与业务的前提下，支持 **用户管理**；可配置使用 **SQLite** 作为数据库（与 MySQL 等部署模式并存或按需）。
4. **go-gateway**：在满足接口与吞吐的前提下，可配置使用 **SQLite**；**部署启动时自动向 `webclaude_center_server` 上报**（实例身份、监听地址、健康状态等，具体字段以协议为准）。
5. **（原提示词列表未含编号 5）** — 留作后续补充（例如配额、监控或证书策略）。
6. **claude_host**：需同时支持 **Windows / Linux（含 Debian、Ubuntu）**；**部署时自动向 `webclaude_center_server` 上报**（主机 ID、用户与 Claude 映射等）。
7. **website**：因 **center_server** 聚合 **go-gateway** 与 **claude_host** 的上报信息，**webclaude_website** 扩展 UI：**由用户选择连接哪一个网关**；**优先从 center_server 拉取可用网关列表**（再连 Chat）。
8. **通信协议**：**HTTP** 用于管理、鉴权同步、上报；**WebSocket** 用于 **网关 ↔ claude_host ↔ website（Chat 模块）** 的实时流。
9. **命名**：原 **top-router** 相关表述，**全部更新为 WebClaude**（文档与代码中的历史别名、锁文件残留等一并清理）。

### 本记录已执行的操作

- 将上述需求**追加**至 `docs/prompt_history_log.md`（本条目）。
- 文档与元数据中的 **top-router** 表述已改为 **WebClaude / `webclaude_center_server`** 等：`webclaude_center_server/docs/INTEGRATION.md`、两处 `server-deploy-host-app-docker-infra.md`、`webclaude_go-gateway/docs/GATEWAY_INTEGRATION.md`。
- `webclaude_center_server/package-lock.json` 删除已废弃的 `top-router-shared` 孤儿条目；`web/user/package-lock.json` 中 `name` 与 `package.json` 对齐为 **`webclaude-user-web`**。

**Git 仓库 remote URL** 若仍指向 GitHub 上旧仓库名，属运维侧重命名，**不**在本机自动修改。

---

## 2026-04-02 — 文档整合：消除冲突、合并冗余

**提示词：**

> 检测所有文档的冲突性，按最优的方式重新调整所有文档，可以合并删除或重写。
> 要保证逻辑一致性。并对功能进行增强。声明 webclaude_gateway 是重复实现不使用。

**执行内容：**

对 `docs/` 下 9 份文档进行全面冲突检测与整合：

| 冲突 | 涉及文档 | 处理方式 |
|------|----------|----------|
| stream-json 协议 3 处重复 | claude-code.md, features.md, host-protocol.md | 合并至 host-protocol.md |
| 心跳格式 3 处不一致 | features.md, host-protocol.md, multi-user-design.md | 合并至 host-protocol.md（含完整字段） |
| 多用户设计分散 | features.md, multi-user-design.md, gateway-api.md | 协议侧合并至 host-protocol.md，API 侧合并至 gateway-api.md |
| features.md 引用旧路径 `scripts/claudecode/` | features.md | 删除该文件 |
| features.md 技术栈错误（Node.js gateway, React 18） | features.md | 删除该文件 |
| gateway-api.md API 归属不清 | gateway-api.md | 重写，明确区分 center_server 与 go-gateway |

**文件变更：**

| 文件 | 操作 |
|------|------|
| `host-protocol.md` | **重写**：合并 features.md + multi-user-design.md 中的协议/执行内容 |
| `gateway-api.md` | **重写**：合并 features.md + multi-user-design.md 中的 API/会话内容 |
| `ARCHITECTURE_GUIDE.md` | **更新**：修正交叉引用 |
| `CENTER_PLATFORM_ROADMAP.md` | **更新**：修正交叉引用 |
| `dom-mirror-remote-browsing.md` | **更新**：添加研究文档标注 |
| `features.md` | **删除**：内容已合并 |
| `multi-user-design.md` | **删除**：内容已合并 |

---

## 2026-04-02 — WebClaude Group 架构扩展（全会话汇总）

本条目汇总 2026-04-02 会话中的全部架构演进，按阶段记录。

### Phase 1: 项目重命名和架构分析

- `top-router` 重命名为 `webclaude_center_server`
- 品牌名 TopRouter → **WebClaude**（保留 `toprouter.cn` 域名）
- 确立 4 个核心组件：
  | 组件 | 技术栈 |
  |------|--------|
  | `webclaude_center_server` | Node.js |
  | `webclaude_go-gateway` | Go |
  | `webclaude_website` | React |
  | `claude_host` | Python |

### Phase 2: 功能扩展

- **center_server**：SQLite 支持、节点注册 API、API Key 验证端点
- **go-gateway**：SQLite 支持、鉴权缓存、自动注册心跳、Chat WS Handler
- **website**：网关选择器、Chat WebSocket 客户端、网关管理页面
- **claude_host**：Center 注册、跨平台兼容（Windows / Linux）

### Phase 3: 网关合并

- `webclaude_gateway` 功能合并到 `webclaude_go-gateway`
- 移植内容：智能 Host 选择（亲和 + 最小负载）、速率限制、并发控制、会话缓存、扩展消息类型

### Phase 4: 协议对齐和安全修复

- WebSocket envelope 格式统一（host → gateway）
- 添加 `host_register` 消息
- `memory_mb` → `memory` 字段名修复
- `keys-cache` / `validate-key` 响应字段适配
- Token 分离：`INTERNAL_API_TOKEN` + `HOST_API_TOKEN`
- host → gateway WS 认证修复

### Phase 5: 配置统一和架构增强

- 统一 `webclaude.json` 配置文件（4 个项目）
- 配置优先级：env > JSON > 默认值
- 端口统一：18100 / 18200 / 18300
- `@webclaude/shared` 包从 git 历史重建（60+ 文件）
- 循环导入修复（`__init__.py` 架构重构）
- MySQL schema 初始化
- 启动脚本健壮性（stderr 重定向、文件检测、幂等性、GOROOT 修复）

### Phase 6: 多用户增强

- **Linux**：`sudo -u` 系统用户切换
- **Windows**：`CLAUDE_CONFIG_DIR` 环境变量隔离（Claude Code 官方方案）
- 聊天界面重设计：直接显示聊天、网关作为弹窗选择器
- 无 API Key 也能浏览聊天界面

### 架构决策汇总

| 决策项 | 方案 |
|--------|------|
| 通信模式 | website → center（HTTP REST）；website → gateway（WebSocket chat）；gateway ↔ host（WebSocket tunnel） |
| 网关架构 | 单网关：go-gateway 承担 relay + bridge 双重角色 |
| 权限验证 | 3 种 Token：`INTERNAL_API_TOKEN` / `HOST_API_TOKEN` / JWT + APIKey |
| 配置文件 | JSON 格式（`webclaude.json`），env 覆盖 |

### 端口分配

| 服务 | 端口 |
|------|------|
| `webclaude_center_server` | 18100 |
| `webclaude_go-gateway` | 18200 |
| `webclaude_website` | 18300 |

### Phase 7: 服务发现与端点管理重构（2026-04-02 晚）

**核心设计变更**：
- UI 的 center_server 地址改为**单一固定配置**（不再自动检测多端点）
- 移除 ApiManager 的多端点优先级检测逻辑
- 网关地址**不在前端配置** — 由 center_server 动态提供

**服务发现流程**：
1. 网关启动 → `POST /api/registry/gateway` 注册到 center_server（上报地址、能力、状态）
2. Host 启动 → `POST /api/registry/host` 注册到 center_server + WS连接 gateway
3. center_server 收集所有网关信息 → 通过 `GET /api/registry/gateways` 发布给 UI
4. UI 从 center_server 获取网关列表 → 自动选择延迟最低的在线网关，或用户手动选择

**端点配置原则**：
- 所有地址默认 localhost（本地开发）
- 保留域名配置示例（注释形式），上线时替换
- center_server 端点只有一个（不需要自动检测）
- 网关端点完全动态（center_server 返回列表）

**安全增强**：
- gateway 注册需携带 `public_url`（前端可达的 WebSocket 地址）
- 区分监听地址（0.0.0.0）和公开地址（实际IP/域名）

**提示词记录**：
> "网关先向中心服务器提交信息。中心服务器得到多个网关的信息之后，发布给 UI。
> UI 作为聊天服务器，可以选择其中的一个网关；会自动匹配速度最快的一个。
> 目前不使用任何域名，全部使用本地IP地址。上线时再配置域名。"

### Phase 8: Admin Multi-User + User UI Enhancement (2026-04-02 late)

**Admin Management System**:
- MySQL `admins` table (separate from `users`), bcrypt encrypted passwords
- Multi-admin support with CLI management script (`scripts/manage-admin.js`)
- Commands: add/update/list/delete/init admin accounts
- No old password required for updates (direct DB modification)
- Auto-init default admin on first run
- `/admin-login` frontend with admin-specific JWT/session

**User UI Enhancements**:
- Footer fixed to bottom (flex column + min-h-screen)
- Settings page: change password, email, phone number
- Avatar selection using DiceBear (https://api.dicebear.com/) - no upload needed
- Project management: create projects, associate with API keys
- Key authorization: project access, code download permission, team mode

**Key Permission System**:
- API Keys can be restricted to specific projects
- Permissions: `allowed_projects`, `can_download_code`, `team_mode_enabled`
- Chat module validates key permissions via gateway
- Gateway is an acceleration node, not real-time with center

**Gateway Key Sync Strategy**:
- Periodic bulk refresh every 5 minutes (existing)
- On cache miss: real-time single-key lookup from center_server
- Negative cache: remember non-existent keys for 60s to avoid hammering
- Key permissions (projects, team mode) included in cache

**Prompt excerpt**:
> "Admin login needs initialized admin password. Add management script for admin CRUD.
> Multi-admin support with bcrypt encryption. Separate from user storage.
> User UI: fix footer, add avatar (DiceBear), project management, key authorization.
> Gateway: cache keys from center, on-miss sync once, negative cache for invalid keys."

### Phase 9: Layout Fixes + Invite System + UI Polish (2026-04-02 late night)

**Layout Fixes**:
- `/docs` page: dual layout — logged-in uses Layout (with sidebar), logged-out uses PublicLayout
- Footer: added `contained` prop so it uses `100%` width inside Layout instead of `100vw` (was overlapping sidebar)
- `/membership` PricingSection: same `contained` fix for price cards breaking out of sidebar layout
- `/keys` and `/projects` redirecting to homepage: root cause was `client.ts` 401 handler doing `window.location.hash = '/'` which force-navigated away. Fixed by dispatching `CustomEvent('auth:unauthorized')` and letting React clear user state naturally.

**Invite Code System**:
- Database: `users` table extended with `invite_code` (VARCHAR 32, UNIQUE) and `invited_by` (VARCHAR 64, indexed)
- Code format: `NXS-XXXX` (4 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`)
- Backend API: `GET /users/invite-code` (auto-generates if missing), `GET /users/invited-users`
- Registration: `inviteCode` field in request body → look up inviter → set `invited_by` on new user
- Frontend: Dashboard shows invite card with copy-to-clipboard (full registration link with `?invite=` param)
- Registration form: auto-fills invite code from URL parameter, read-only when from URL
- Dashboard: "WebClaude Expansion TOP-X-NXS-MATRIX" panel showing all recruited users

**User Settings Expansion**:
- SettingsPage rewritten with 4 tabs: Profile (email/phone), Password (change), Avatar (DiceBear 16 styles), Security
- DiceBear avatar integration: `https://api.dicebear.com/7.x/{style}/svg?seed={username}` — no upload needed
- Projects page: CRUD with team mode + code download toggles
- Navigation: added Projects item, sidebar avatar uses DiceBear

**Admin Management System**:
- MySQL `admins` table with bcrypt-hashed passwords (separate from `users`)
- CLI script `scripts/manage-admin.js`: add/update/list/delete/init
- Default admin: `admin` / `admin123` (auto-created on startup if table empty)
- Admin login from MySQL with bcrypt.compare, fallback to legacy Redis for backward compat
- npm scripts: `admin:add`, `admin:update`, `admin:list`, `admin:delete`, `admin:init`

**Admin UI (webclaude_website /admin/*)**:
- AdminLoginPage, AdminLayout (sidebar + auth guard)
- AdminDashboardPage: 5 stat cards + today's activity + system health + platform breakdown
- AdminApiKeysPage: CRUD table with search, pagination, create/edit/delete modals
- AdminUsersPage: user table with status/role toggles, usage stats expandable rows
- AdminAccountsPage: 10-platform tab switching, platform-specific create/edit forms, test connection

**Gateway Key Cache Enhancement**:
- Negative cache: invalid keys remembered for 60s to prevent center_server hammering
- KeyInfo extended: `AllowedProjects`, `CanDownloadCode`, `TeamModeEnabled`
- Key usage logger: in-memory buffer (10k cap) + periodic SQLite flush (30s)
- WebSocket handler: project permission check entry point

**Hot Reload Development**:
- Center Server: nodemon (watches .js/.json, auto-restart)
- Go Gateway: air (watches .go, auto-rebuild+restart)
- Website: Vite HMR (instant browser updates)
- Claude Host: watchdog dev_reload.py (watches .py, auto-restart)
- Unified start.ps1/start.sh detect and use hot-reload tools automatically

**Prompt excerpts**:
> "/docs should use different layouts for logged-in vs logged-out.
> Footer in logged-in state should align with sidebar, not overlap.
> Add invite code feature: each user gets NXS-XXXX code, copy generates registration link.
> Registration auto-fills invite code from URL parameter.
> Dashboard shows invited users list.
> /keys and /projects should not redirect to homepage.
> Membership pricing cards should not break layout when >3 plans."

### Phase 10: Admin Login Fix + Key Type Distinction + Feature Alignment (2026-04-03)

**Admin Login Fix**:
- `/#/admin-login` returned 404 because frontend posted to `/admin/login` but backend route was different
- Fixed adminAuthService.ts to match actual backend route
- Verified admin token header format matches backend expectation

**Two Key Types — Naming Convention**:
- **Relay Key (中转密钥)**: Admin-created keys for external API relay service through center_server. Features: rate limiting, model restrictions, IP restrictions, cost limits, batch creation, usage tracking. Backend: `/admin/api-keys` (admin) + `/users/api-keys` (user)
- **Gateway Key (网关密钥)**: User-created keys for chat/gateway WebSocket connections. Features: project binding, team mode, code download permission. Used at: `/ws/chat?key=xxx` on go-gateway

**Admin Feature Completion** (from web-old reference):
- AdminSettingsPage: OEM settings, registration toggle, service rates, Claude capacity
- AdminSubscriptionsPage: plan CRUD, order management, subscription status
- Admin services: adminSystemService, adminSubscriptionService

**User Feature Alignment** (from web-old/user reference):
- KeysPage enhanced with dual tabs: Relay Keys + Gateway Keys
- UsagePage: usage trends, per-model breakdown, cost overview
- Dashboard: shows both relay and gateway key counts

**web-old marked as deprecated reference**: all new features built in webclaude_website (React), not web-old (Vue)

**Prompt excerpt**:
> "Admin login route not found — fix path alignment with backend.
> web-old has both admin and user features — use as reference, build new in webclaude_website.
> Two types of keys: Relay Key (admin API relay) vs Gateway Key (user chat). Distinguish naming.
> User key management should show both types in separate tabs.
> Existing features in web-old are the baseline; new features are incremental additions."

### Phase 11: Admin Gateway/Host Management + Claude Status + Plans JSON (2026-04-03)

**Admin Gateway Management Enhancement** (`/#/admin/gateways`):
- Multi-language support with language switcher
- Display gateway IP, last sync time, load info (goroutines, memory, connections)
- "Sync Now" button to push data to gateway (center→gateway WebSocket communication)
- Online/offline status indicators

**Admin Host Management** (new in `/#/admin/gateways` Hosts tab):
- Display host OS, distro, memory, last heartbeat
- Per-user Claude status: logged_in, account email, plan type (pro/max/free)
- Running privilege (root/admin)
- System load, disk usage, uptime

**Claude Host Status Detection**:
- Uses `claude auth status` command to check each user's Claude login state
- Linux: `sudo -u username claude auth status`
- Windows: `CLAUDE_CONFIG_DIR=~/.claude-users/{user} claude auth status`
- Parses output for account, plan, login state
- Cached (5-minute refresh) to avoid excessive CLI calls
- Reports: claude_logged_in, claude_account, claude_plan per user

**Windows Multi-Account Claude** (from official docs research):
- `CLAUDE_CONFIG_DIR` isolates config per user (each directory = independent session)
- PowerShell functions: `$env:CLAUDE_CONFIG_DIR="$env:USERPROFILE\.claude-users\alice"; claude`
- Caveat: `~/.claude.json` global state may conflict; CLAUDE_CONFIG_DIR mitigates this
- Linux: `sudo -u` naturally isolates via `/home/{user}/.claude`

**Subscription Plans JSON Configuration**:
- Plans data moved from hardcoded to `data/subscription-plans.json` on center_server
- Frontend fetches from API: `GET /admin/subscription-plans-config`
- Admin can edit JSON source via: `PUT /admin/subscription-plans-config`
- Auto-backup of old file before save (timestamped copy)
- Plans editor page in admin UI

**Gateway Sync Mechanism**:
- `POST /api/registry/gateways/:nodeId/sync` triggers data push
- Center→Gateway communication via existing heartbeat/registration channel
- Gateway receives updated key cache and permissions

**Prompt excerpts**:
> "Admin gateways page should show IP, last sync time, load; add Sync Now button.
> Add host management showing OS, users with Claude login status per user.
> Use `claude auth status` to verify each user's Claude login (cached 5min).
> Windows multi-account via CLAUDE_CONFIG_DIR; Linux via sudo -u.
> Subscription plans to JSON config file, editable via admin UI with backup.
> Gateway and center communicate via WebSocket for sync operations."

### Phase 11b: Claude Status Fix + Payment System + Admin Enhancement (2026-04-03)

**Claude Auth Status Detection Fix**:
- Official CLI: `claude auth status` returns **JSON** (default), exit code 0=logged in, 1=not
- Root cause of detection failure: Windows current user should use default `~/.claude` not `~/.claude-users/mpc`
- Fix: `get_claude_config_dir()` now returns default path for current OS user
- Added on-demand refresh via `refresh_status` command from center_server

**Plans Editor Enhancement**:
- Changed from raw JSON textarea to visual per-plan card editor
- Each plan has form fields: name, price, interval, features list, limits, badge
- Keep "JSON Source" tab for raw view
- Save triggers backup of old file

**Subscription Order Flow**:
- Unauthenticated user clicks plan → login modal popup (reuse AuthGlowCard as modal)
- Authenticated user clicks plan → create order with random decimal price for verification
- Order page shows: plan details, payment methods, user contact info form
- "I've Paid" button → generate verification code → show customer service contact
- If user missing email/phone → inline form on order page, auto-save to profile

**Payment Configuration** (`data/payment-config.json`):
- Payment methods: Alipay, WeChat Pay, bank transfer (with QR codes)
- Customer service contacts: WeChat, QQ, WeChat group, QQ group, phone
- Each contact: nickname, role, online hours, account/QR
- Icons: WeChat green, QQ blue, Alipay blue
- Admin UI for managing all payment and contact settings

**Data Directory Structure**:
```
data/
├── assets/          # Git tracked (payment QR codes, brand assets)
├── uploads/         # Git ignored (user uploads)
├── subscription-plans.json
├── subscription-plans-backups/
└── payment-config.json
```

**Admin Refresh Features**:
- Host/Gateway status: click to refresh (real-time)
- Claude status per user: click to refresh
- Auto-refresh: every 10 minutes on web admin page

**Prompt excerpt**:
> "Claude is actually logged in but detection fails — fix config dir for current user.
> Plans editor should be visual per-plan cards, not raw JSON.
> Subscribe page: login modal for unauthenticated, order creation with random decimal price.
> Payment methods configurable in admin (Alipay/WeChat QR codes, bank).
> Customer service contacts with roles, online hours, icons.
> Data dir: assets/ (git tracked) vs uploads/ (git ignored)."

### Phase 12: Order + Payment Verification + Activation Flow (2026-04-03)

**Order Page Fix**:
- Show correct payment icons (WeChat green, Alipay blue) with i18n
- "I Have Paid" does NOT mean instant success — submits to backend, shows "Waiting for admin verification"
- Generates tracking code for customer service contact
- Polls order status every 30 seconds

**Admin Order Management**:
- Admin views all orders with status filters (pending/verified/activated/rejected)
- "Verify Payment" action → auto-generates activation code (ACT-XXXXXXXX)
- "Reject" action with reason field
- Order status flow: created → user_paid → verified → activated (or → rejected)

**User Order & Activation**:
- My Orders page: view order list with status, tracking code, activation code
- Activate page: enter activation code → activate subscription
- Dashboard shows active subscription usage info
- Order status auto-updates when admin verifies

**Database**: `subscription_orders` table with status tracking, tracking_code, activation_code

**Prompt excerpt**:
> "Order page must show payment icons with i18n. Clicking 'paid' is not instant success — wait for admin.
> Admin verifies payment → generates activation code sent to user.
> User has order list view and activation page. Dashboard shows active subscription usage."

### Phase 13: Host Dedup + Usage Detection + Gateway Bridge Mode (2026-04-03)

**Claude Usage Detection** (from official docs research):
- No official CLI command for usage quota (feature request open: anthropics/claude-code#40395)
- `/status` only works in interactive mode, not scriptable
- API endpoint `https://api.anthropic.com/api/oauth/usage` exists (needs Bearer token, beta header)
- `claude auth status` returns JSON with plan info but NOT usage data
- Best approach: try to call usage API with stored credentials, fallback to plan-only info

**Host Deduplication**:
- Admin gateways page showing duplicate host entries (same host at different heartbeat times)
- Fix: backend `GET /api/registry/hosts` should return only latest entry per node_id
- Frontend should show ONE card per unique host, not multiple history entries

**Refresh Controls**:
- "Refresh All" button for all hosts at once
- Individual "Refresh" per host
- Countdown timer: "Next refresh in XX:XX" (default 10 minutes)
- Manual refresh resets the timer

**Gateway Bridge Mode**:
- Per-host option: "Use Gateway Bridge" toggle
- When enabled: center_server → gateway → host (instead of center → host direct)
- Host stores bridge preference in local config file (`data/host-config.json`, git-ignored)
- Gateway extended: can bridge messages to both UI chat AND center_server
- Center_server sends bridge command via gateway WebSocket
- Host receives bridge notification, persists to config, future comms through gateway

**Architecture extension**:
```
Without bridge: center_server ──HTTP──► host (registration/heartbeat)
With bridge:    center_server ──WS──► gateway ──WS──► host (all communication)
```

**Prompt excerpt**:
> "Claude usage/quota cannot be retrieved programmatically (no official CLI command).

### Phase 13b: Host ID Persistence + Claude Auth Detail + Bridge Logs (2026-04-03)

**Root Cause of Host Duplicates**:
- HOST_ID was generated as random UUID on every restart → new node_id each time → new row in DB
- Fix: persist HOST_ID to `data/host-config.json`, use hostname-based ID (`host-desktop-xxx`)
- Backend upsertNode enhanced: dedup by `name + node_type` as fallback when node_id changes

**Claude Auth Status — Real JSON Fields** (from user's actual output):
```json
{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "apiProvider": "firstParty",
  "email": "user@example.com",
  "orgId": "...",
  "orgName": "...'s Organization",
  "subscriptionType": "max"
}
```
- Fields to report: `email`, `authMethod`, `apiProvider`, `subscriptionType`, `orgName`
- Note: `loggedIn` not `logged_in`, `subscriptionType` not `plan`

**System Info Fix**: Memory/CPU may return 0 on Windows — use psutil (already installed) as primary, ctypes as fallback

**Bridge Mode Logs**: When bridge enabled, show connection status (last message time, message count)

**Prompt excerpt**:
> "Host generates new UUID every restart causing duplicates. Fix: persist ID based on hostname.
> Claude auth status returns loggedIn/email/subscriptionType/authMethod/apiProvider — parse correctly.
> Memory and CPU info not uploading on Windows — fix with psutil.
> Bridge mode should show connection logs. Dedup by name+node_type not just node_id."
> Host list shows duplicates — deduplicate by node_id, show only latest.
> Add refresh all/individual buttons with countdown timer (10min default).
> Gateway bridge mode: center→gateway→host for testing gateway relay capability.
> Host stores bridge config in data dir (git-ignored). Gateway bridges to both UI and center."

### Phase 14: Code Quality Refactor + Bridge Auth Fix + Gateway Bridge Enhancement (2026-04-03)

**Code Quality Refactor (claude_host)**:
- All imports moved to file top (no lazy imports inside functions)
- Reuse `pycore.pyfoundations.pybasecommon.commander` (exec_silent, exec_capture, command_exists)
- Reuse `pycore.pyfoundations.system_info` for cross-platform system detection
- Remove psutil/ctypes dependencies — use OS native commands instead:
  - Windows: `wmic OS get TotalVisibleMemorySize`, `wmic cpu get`, `wmic logicaldisk`
  - Linux: `/proc/meminfo`, `/proc/loadavg`, `df -B1`
- Minimize try/catch blocks — use guard checks (if file exists, if command available)
- Git auto-install on Windows: winget preferred, official installer fallback

**Bridge 401 Fix**:
- `POST /api/registry/hosts/:nodeId/bridge` returns 401 from browser
- Root cause: route uses `requireInternalToken` but browser sends admin_token
- Fix: allow admin auth OR internal token for bridge operations

**Gateway Bridge Enhancement**:
- Gateway bridges between host ↔ center_server (not just host ↔ UI chat)
- center → gateway HTTP `/internal/bridge/:hostId` → gateway WS → host
- Extend gateway to relay center_server admin commands to hosts

**Prompt excerpt**:
> "All imports at file top. Reuse pycore libs, don't duplicate code.
> Use OS native commands (wmic, /proc/) instead of Python libs (psutil, ctypes).
> Minimize try/catch, use guard checks. Extend pycore if needed.
> Bridge route 401: browser uses admin_token not INTERNAL_API_TOKEN — fix auth."

### Phase 15: Project Relocation + Gateway Address Auto-Detect (2026-04-03)

**Project Relocation**:
- `webclaude_group` moved from `D:\programing\webclaude_group` to `D:\programing\core_node\webclaude_group`
- All script paths updated (start.ps1, start.sh)
- Frontend center_server address now dynamic: `${location.protocol}//${location.hostname}:18100`

**Gateway Address Two Modes**:
- **Explicit IP mode**: Gateway registers with specific URL (e.g. `ws://192.168.1.178:18200`)
  - Frontend chat uses that exact URL
- **Auto-detect mode**: Gateway registers with `url: "auto"` or port-only
  - Frontend constructs: `ws://${current_hostname}:${gateway_port}`
  - Used for single-server deployment where everything runs on same machine

**Current setting**: All gateways set to auto-detect mode.

**Address Rules (complete)**:
```
Frontend → center_server:  current_origin:18100 (dynamic, based on browser URL)
Frontend chat → gateway:   current_origin:gateway_port (auto-detect from gateway registration)
Gateway → center_server:   absolute address (from gateway config, e.g. http://localhost:18100)
Gateway → host:            WebSocket reverse tunnel (host connects to gateway)
Host → gateway:            absolute address (from host config, e.g. ws://localhost:18200)
Host → center_server:      absolute address (from host config, e.g. http://localhost:18100)
```

**Prompt excerpt**:
> "Gateway address has two states: explicit IP or auto-detect.
> Auto-detect: frontend uses current domain + gateway port as WebSocket address.
> Gateway→center, gateway→host, host→center all use absolute configured addresses.
> Only frontend connections are dynamic (based on browser location).
> Set all gateways to auto-detect mode for current deployment."

### Phase 16: SQLite as Default Database (2026-04-03)

**Requirement**: All services should default to SQLite, not MySQL. This enables zero-dependency deployment on any server (no MySQL/Redis setup needed).

**Changes needed**:
- center_server: `DB_TYPE=sqlite` as default in .env and config
- go-gateway: `DB_TYPE=sqlite` as default
- Start scripts: skip MySQL/Redis checks when DB_TYPE=sqlite
- Redis: make optional (use in-memory fallback when not available)

**Prompt excerpt**:
> "Support sqlite, each service should prioritize sqlite. Modify all files and all services.
> Deploy on Linux server without MySQL — should work out of the box with sqlite."

### Phase 16b: Go Gateway SQLite Full Compatibility (2026-04-03)

**Audit findings (41 files depend on MySQL)**:
- `mysql.Pool` type doesn't exist — NewPool returns `*sqlx.DB`
- 25+ services crash with nil db pointer when DB_TYPE=sqlite
- 3 SQL queries use MySQL-specific JSON_SET/JSON_OBJECT (incompatible with SQLite)
- sqlite.Store returns `*sql.DB` but services expect `*sqlx.DB`

**Fix approach**:
- SQLite mode opens via `sqlx.Open("sqlite", path)` for interface compatibility
- All 41 dependent services receive a valid `*sqlx.DB` (not nil)
- SQLite driver: `modernc.org/sqlite` (pure Go, no CGO)
- MaxOpenConns=1 for SQLite single-writer constraint

**Deployment issues fixed**:
- CRLF line endings in .sh scripts (Windows→Linux): auto-fix via fix_scripts.py
- `vite: not found`: add `node_modules/.bin` to PATH in start.sh
- go-gateway unconditionally inits MySQL: conditional on DB_TYPE
- All sub-scripts: remove `set -euo pipefail`, no exit codes

**Prompt excerpt**:
> "go-gateway mysql.Pool undefined — fix type to *sqlx.DB.
> All scripts: no exit codes, real-time output, view startup logs live.
> Go gateway must 100% work with SQLite replacing MySQL."

### Phase 17: Redis Install via core_node Scripts + Debug Mode + Project Rules (2026-04-04)

**Redis auto-install**:
- Use existing `core_node/scripts/shells/linux/debian/install_shells/45_install_redis.sh`
- Call from `start.sh` with `START_REDIS=true`, NOT from Python
- ioredis retry limited to 3 attempts then STOP (no infinite loop)
- Error log debounced to once per minute

**Debug mode requirement**:
- All services must show FULL debug output, no error suppression
- Frontend must display all backend error details
- Logs must capture everything for remote debugging

**Development workflow / Project rules**:
- Development is LOCAL (Windows or Linux)
- Code syncs to REMOTE servers via sync software (not git deploy)
- Website, gateway, center_server, host may run on DIFFERENT remote servers (all Debian)
- Local dev is reference only — debug info comes from REMOTE logs
- Don't search local paths for remote errors
- Consider OS differences (Windows dev → Linux deploy)

**Host keeps disconnecting every 30s**:
- gateway `host_relay.go` disconnects host after WS tunnel metrics check
- Need to investigate WebSocket keepalive/timeout settings

**Login 500 error**: `POST /web/auth/login` returns Internal Server Error
- Related to Redis not connected (admin session stored in Redis)
- Need SQLite fallback for admin sessions

**Prompt excerpt**:
> "Redis install must use core_node/scripts/shells/linux sh scripts, NOT Python.
> Show ALL debug errors in logs. No error suppression.
> Define project rules: dev is local, deploy is remote Linux.
> Code syncs via sync software. Debug info is from remote.
> Search Claude Code docs for how to define project rules (CLAUDE.md)."

### Phase 18: MySQL Hard Dependencies in @webclaude/shared (2026-04-04)

**Problem**: Many services in `@webclaude/shared` directly `require('./mysqlPool')` instead of going through `db.js`. When `DB_TYPE=sqlite`, these services still try to connect to MySQL:3306 and fail.

**Affected files** (from error logs):
- `packages/webclaude-shared/models/repositories/apiKeyRepo.js` → `PromisePool.execute`
- `packages/webclaude-shared/models/persistent/apiKeyStore.js`
- `packages/webclaude-shared/services/billing/costRankService.js`
- `src/services/payments/subscriptionHalfDoneReconcileService.js`
- `src/services/ops/claudeCapacityMetricsService.js`
- `src/services/ops/dispatchRecordsService.js`

**Fix approach**: Make `mysqlPool.js` in the shared package route through `db.js` so it returns SQLite pool when `DB_TYPE=sqlite`.

**pymain.py moved**: `scripts/pycore/pymain.py` → `core_node/pymain.py` (root level). All references updated.

**Prompt excerpt**:
> "Which services still haven't adapted to SQLite? Check ALL database-related code.
> Many shared package files directly import mysqlPool bypassing db.js.
> pymain.py should be at core_node root, not nested in scripts/pycore/."
