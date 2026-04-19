# claude_host - Host Integration Guide

> Last updated: 2026-04-02

## Architecture Role

`claude_host` is the terminal execution node in the WebClaude Group architecture. It runs on remote servers and executes Claude CLI processes on behalf of web users.

```
webclaude_website (Browser)
    │ WebSocket
    ▼
webclaude_go-gateway :18200 (HTTP + WebSocket; relay + bridge in internal/websocket/)
    │ Reverse WebSocket Tunnel
    ▼
claude_host (Python, this application)
    │ Subprocess
    ▼
Claude CLI (claude -p "prompt" --output-format stream-json)
```

**Do not** deploy the standalone **`webclaude_gateway`** repository — it is legacy (merged into `webclaude_go-gateway`).

## WebSocket Connection Protocol

### Reverse Tunnel Pattern

claude_host initiates an **outbound** WebSocket connection to the gateway. This NAT-friendly approach means hosts don't need public IPs or port forwarding.

```python
# Connection URL format
ws://<gateway-host>:18200/...    # PORT = go-gateway HTTP listen (18200); path from deployment

# Environment variables (example — confirm path against webclaude_go-gateway/docs/GATEWAY_INTEGRATION.md)
CENTRAL_SERVER_URL = "ws://gateway:18200/ws/client"  # or GATEWAY_URL
HOST_TOKEN = "secret-token"                     # Authentication
HOST_ID = "auto-generated-uuid"                 # Host identifier
```

### Reconnection
- Auto-reconnect with exponential backoff (1s → 2s → 4s → ... → 60s max)
- Maintains all runner state across reconnections
- Clean shutdown on SIGINT/SIGTERM

## Message Protocol

### Inbound Commands (Gateway → Host)

```json
{
  "type": "command",
  "action": "run_claude | stop_claude | create_user | list_users",
  "request_id": "uuid",
  "username": "alice",
  "prompt": "task description",
  "session_id": "optional-resume-id",
  "model": "claude-sonnet-4-20250514",
  "effort": "sustained",
  "allowed_tools": "Read,Write,Bash",
  "project_dir": "/home/alice/project"
}
```

### Outbound Responses (Host → Gateway)

**Response:**
```json
{
  "type": "response",
  "request_id": "uuid",
  "data": { "success": true, "message": "...", "users": [...] }
}
```

**Stream Event:**
```json
{
  "type": "stream",
  "request_id": "uuid",
  "event": {
    "type": "status | delta | block_start | block_stop | usage | result | error",
    "text": "...",
    "pid": 12345
  }
}
```

**Heartbeat (every 30s):**
```json
{
  "type": "heartbeat",
  "host_id": "unique-host-id",
  "hostname": "server-name",
  "load": [0.5, 0.6, 0.7],
  "memory_mb": { "total": 16384, "available": 8192 },
  "users": [
    { "username": "alice", "busy": false, "home_exists": true, "has_credentials": true }
  ],
  "active_count": 0,
  "claude_bin": "/usr/bin/claude"
}
```

### Stream Event Types

| Type | Description |
|------|-------------|
| `status` | Process lifecycle: starting, running, finished, stopped |
| `block_start` | Content block started (text/thinking) |
| `delta` | Text or thinking delta |
| `block_stop` | Content block ended |
| `usage` | Token usage (start/end) |
| `assistant` | Full assistant message with content blocks |
| `result` | Final result: cost, duration, tokens, session_id |
| `rate_limit` | Rate limit information |
| `system` | System info: model, tools, version |
| `error` | Error occurred |
| `raw` | Unparsed output |
| `stderr` | Standard error output |

## Integration with webclaude_go-gateway

The host does **not** connect directly to go-gateway. The connection path is:

```
claude_host ──WS──► webclaude_go-gateway :18200 (host relay + bridge) — HTTP API & DB access are internal to the same process (`webclaude_gateway` is legacy, merged into go-gateway)
```

The bridge gateway handles:
- Host selection (affinity + least-loaded algorithm)
- Permission sync from go-gateway
- Message routing between frontend and host

## Integration with webclaude_center_server

No direct connection. Center server manages:
- User accounts (reflected in host's system user management)
- API keys (validated at gateway level before reaching host)
- Subscription quotas (enforced at gateway)

## Multi-User Isolation

### System User Model
- Each web user maps to a Linux system user
- Claude CLI runs as that user via `sudo -u username`
- One active Claude process per user (enforced)

### User Lifecycle
```
create_user → useradd → /home/username/ → ensure sudoer → ready
run_claude  → select user → check busy → spawn ClaudeRunner → stream output
stop_claude → SIGTERM → wait 5s → SIGKILL if needed
```

## Security Mechanisms

### Authentication
- `HOST_TOKEN` in WebSocket URL query parameter
- Validated by gateway on connection

### Path Whitelist
Only these directories are allowed as project directories:
- `/home/*` (Linux)
- Configured `DEFAULT_PROJECT_DIR`
- Windows: user home and subdirectories

### Process Isolation
- Each Claude process runs in a separate process group (`os.setsid`)
- 300-second stdout timeout
- Proper signal cascade: SIGTERM → wait 5s → SIGKILL
- stderr captured separately

## Configuration Reference

| Variable | Description | Default |
|----------|-------------|---------|
| `CENTRAL_SERVER_URL` | Gateway WebSocket URL | (required) |
| `GATEWAY_URL` | Alias for above | - |
| `HOST_TOKEN` | Authentication token | (required) |
| `HOST_ID` | Host identifier | auto-UUID |
| `HEARTBEAT_INTERVAL` | Heartbeat interval (seconds) | 30 |
| `CLAUDE_BIN` | Claude CLI path | auto-detect |
| `CLAUDE_PROJECT_DIR` | Default project directory | `../project` |
| `CLAUDE_USERS` | Allowed system users | current user |
| `AUTO_CREATE_USERS` | Auto-create missing users | true |

## Deployment

### Linux (recommended)
```bash
# Set environment
export CENTRAL_SERVER_URL="ws://gateway-host:18200/ws/client"
export HOST_TOKEN="your-token"

# Run as core_node pyapp
python scripts/pycore/pymain.py app=claude_host
```

### Windows (single-user mode)
```powershell
$env:CENTRAL_SERVER_URL = "ws://gateway-host:18200/ws/client"
$env:HOST_TOKEN = "your-token"
python scripts/pycore/pymain.py app=claude_host
```

### Requirements
- Python 3.7+
- `websockets>=12.0`
- Claude CLI installed and in PATH
- Root access for multi-user mode (useradd, sudo)
