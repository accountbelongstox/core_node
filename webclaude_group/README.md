# WebClaude Group

### file_sync_v2
 
mkdir -p /tmp/webclaude_group/logs/file_sync_v2
nohup python3 /www/programing/core_node/scripts/file_sync_v2/server.py > /tmp/webclaude_group/logs/file_sync_v2/server.log 2>&1 &
tail -f /tmp/webclaude_group/logs/file_sync_v2/server.log
sudo pkill -9 -f "/www/programing/core_node/scripts/file_sync_v2/server.py"

### file_sync_v2 (`/home/ubuntu/wwwroot/`)

mkdir -p /tmp/webclaude_group/logs/file_sync_v2
nohup python3 /home/ubuntu/wwwroot/scripts/file_sync_v2/server.py > /tmp/webclaude_group/logs/file_sync_v2/server.log 2>&1 &
tail -f /tmp/webclaude_group/logs/file_sync_v2/server.log
sudo pkill -9 -f "/home/ubuntu/wwwroot/scripts/file_sync_v2/server.py"

### webclaude_center_server (`/www/programing/core_node/`)

mkdir -p /tmp/webclaude_group/logs/webclaude_center_server && chmod +x /www/programing/core_node/webclaude_group/webclaude_center_server/scripts/start.sh
nohup /www/programing/core_node/webclaude_group/webclaude_center_server/scripts/start.sh > /tmp/webclaude_group/logs/webclaude_center_server/launcher.nohup.log 2>&1 &
tail -f /tmp/webclaude_group/logs/webclaude_center_server/launcher.nohup.log
sudo fuser -k 18100/tcp

### webclaude_go-gateway (`/home/ubuntu/wwwroot/`)

mkdir -p /tmp/webclaude_group/logs/webclaude_go-gateway && chmod +x /home/ubuntu/wwwroot/webclaude_group/webclaude_go-gateway/scripts/start.sh
nohup /home/ubuntu/wwwroot/webclaude_group/webclaude_go-gateway/scripts/start.sh > /tmp/webclaude_group/logs/webclaude_go-gateway/launcher.nohup.log 2>&1 &
tail -f /tmp/webclaude_group/logs/webclaude_go-gateway/launcher.nohup.log
sudo pkill -9 -f "/home/ubuntu/wwwroot/webclaude_group/webclaude_go-gateway/scripts/start.sh"sudo fuser -k 18200/tcp


### Kill all `webclaude_group` `start.sh`

sudo pkill -9 -f '(/www/programing/core_node|/home/ubuntu/wwwroot)/webclaude_group/(.*/)?scripts/start\.sh'


A project group for building and deploying a web-based Claude Code service platform.

## Architecture Overview

`webclaude_gateway` has been **merged into `webclaude_go-gateway`** (legacy — do not deploy separately). See `docs/CENTER_PLATFORM_ROADMAP.md`.

```
┌──────────────────┐      ┌───────────────────────────────────────────────┐      ┌───────────────┐
│ webclaude_website│─WSS─►│ webclaude_go-gateway                           │◄─WSS─│  claude_host  │
│  (Frontend)      │      │ HTTP relay + WebSocket (client + host relay)  │      │  (Host Agent) │
│  React + Vite    │      │ Account pool, API keys, usage                  │      │  core_node    │
└────────┬─────────┘      └────────────────────────┬─────────────────────┘      └───────────────┘
         │ REST (mgmt)                              │ MySQL / Redis
         │                                           ▼
         │                          ┌──────────────────────────┐
         └─────────────────────────►│ webclaude_center_server   │
                                    │ (Management Server)       │
                                    │ API Key / Account CRUD   │
                                    │ User Auth / Subscriptions │
                                    └──────────────────────────┘
```

- **webclaude_go-gateway**: Central multi-provider AI relay server with
  account pooling, rate limiting, session affinity, and **WebSocket relay + bridge** to
  `claude_host` (includes functionality formerly in `webclaude_gateway`). Serves as the authority for API key permissions and account management.
- **webclaude_website**: React frontend with chat UI, user management, and
  project/conversation management.
- **claude_host**: Python host agent that executes Claude CLI on behalf of users.

## Sub-projects

| Directory | Role | Description |
|---|---|---|
| `webclaude_website` | Frontend | User-facing membership portal built with React + Vite. Provides login, session management, and the Claude Code web UI. |
| `webclaude_gateway` | **Legacy (merged into webclaude_go-gateway)** | Bridge/relay functionality merged into `webclaude_go-gateway`. Directory kept for history only — do not deploy. |
| `webclaude_go-gateway` | Central Relay + Bridge | Go-based central relay server that routes HTTP requests to multi-provider AI APIs, with account pooling, rate limiting, session affinity, and WebSocket bridge to `claude_host` (port 18200). |
| `webclaude_center_server` | Management Server | Node.js Express management server for API key CRUD, account management, user auth, subscriptions, webhooks, and admin dashboard. |
| `claude_host` | Host Agent (reference) | Original single-file Python host agent. See below for the active version. |
| `gateway-old` | Legacy | Previous Node.js WebSocket server (deprecated, kept for reference). |
| `dome_web` | Demo | Vite-based web demo for quick prototyping and feature testing. |
| `dome_html` | Demo | Static HTML demo page for minimal client-side verification. |
| `data` | Data | Shared data and configuration files. |
| `docs` | Docs | Project documentation. See [Architecture Guide](docs/ARCHITECTURE_GUIDE.md). For roles, modules, host vs user resource split, and conflict notes: [CENTER_PLATFORM_ROADMAP.md](docs/CENTER_PLATFORM_ROADMAP.md). |

## New Host Location

The primary host agent has been migrated to `core_node/pyapps/claude_host` as a
standard pyapp (v2.0), following core_node project conventions. The copy in this
directory (`claude_host/`) is retained as the original single-file reference.

### core_node/pyapps/claude_host Structure

```
claude_host/
├── __init__.py                  # v2.0 metadata, re-exports start/main
├── claude_host_main.py          # Entry point (python pymain.py app=claude_host)
├── claude_host_config/          # Environment-driven configuration
├── controller/
│   ├── host_agent.py            # Gateway WebSocket agent (multi-user)
│   └── claude_runner.py         # Single Claude CLI process manager
├── service/
│   ├── linux_ops.py             # Unified ops facade
│   ├── user_manager.py          # System user CRUD
│   ├── file_manager.py          # File/dir operations
│   ├── process_manager.py       # Process listing & control
│   ├── system_info.py           # CPU/memory/disk/network info
│   ├── service_manager.py       # Systemd integration
│   ├── network_manager.py       # Network diagnostics
│   ├── package_manager.py       # APT package management
│   ├── shell_executor.py        # Run commands as user
│   ├── cron_manager.py          # Crontab management
│   └── cmd_utils.py             # Async/sync subprocess wrappers
├── model/
│   └── data_types.py            # Shared dataclasses
├── scripts/
│   ├── start.sh                 # Linux launcher
│   └── start.ps1                # Windows launcher
└── requirements.txt
```

## End-to-End Message Flow

```
Frontend (webclaude_website)       webclaude_go-gateway (Go)              claude_host (Python)
────────────────────────────────   ────────────────────────────────       ────────────────────────
User types prompt, clicks Send
  │
  ├─ WSS (WebSocket client path) ──► internal/websocket: relay to host
  │    e.g. send_message / stream                                        │
  │                                        ├─ CheckRateLimit / permissions (DB)
  │                                        ├─ SelectHost() (affinity + least-loaded)
  │                                        ├─ Route to connected host session
  │                                        │
  │  ◄── ack / stream events ◄───────────┴── WS host tunnel: command run_claude
  │                                                                 ├─ _select_user()
  │                                                                 ├─ ClaudeRunner()
  │                                                                 │   └─ claude -p ...
  │  ...repeats...                                                stream events
  │                                                                                  └─ finished

  API keys & account pool: go-gateway reads shared MySQL (with webclaude_center_server)
```
