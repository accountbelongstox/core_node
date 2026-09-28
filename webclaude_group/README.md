# WebClaude Group

A project group for building and deploying a web-based Claude Code service platform.

## Architecture

`webclaude_gateway` has been **merged into `webclaude_go-gateway`** (legacy — do not deploy separately). See `docs/CENTER_PLATFORM_ROADMAP.md`.

```
┌──────────────────┐   ┌──────────────────────────────────────────┐   ┌───────────────┐
│ webclaude_website│─WS►│ webclaude_go-gateway                     │◄WS│  claude_host  │
│ React 19 + Vite  │   │ HTTP relay + WebSocket (client+host)     │   │ Python agent  │
│        :18300    │   │ account pool · rate limit · affinity     │   │ runs claude   │
└────────┬─────────┘   │        :18200                            │   └───────────────┘
         │ REST (mgmt) └────────────────────┬─────────────────────┘
         ▼                                   │ MySQL / Redis (shared)
┌──────────────────────────┐                │
│ webclaude_center_server  │◄───────────────┘
│ Node.js Express  :18100  │  API key / account CRUD · auth · subscriptions
└──────────────────────────┘
```

- **webclaude_go-gateway** — central multi-provider AI relay: account pooling, rate limiting, session affinity, and WebSocket relay + bridge to `claude_host`. Authority for API key permissions and account management.
- **webclaude_center_server** — management server: API key / account CRUD, user auth, subscriptions, webhooks, admin dashboard.
- **webclaude_website** — React frontend: chat UI, user management, project/conversation management.
- **claude_host** — Python host agent that executes the Claude CLI on behalf of users.

## Sub-projects

| Directory | Role |
|---|---|
| `webclaude_website` | Frontend (React + Vite) — login, sessions, Claude Code web UI. |
| `webclaude_go-gateway` | Central relay + bridge (Go) — multi-provider routing, account pool, WS bridge to host (`:18200`). |
| `webclaude_center_server` | Management server (Node.js Express) — key/account/user/subscription CRUD, admin dashboard (`:18100`). |
| `claude_host` | Single-file Python host agent (reference). Active version: `core_node/pyapps/claude_host` (pyapp v2.0). |
| `webclaude_gateway` | **Legacy** — merged into `webclaude_go-gateway`; kept for history, do not deploy. |
| `docs` | Documentation — [Architecture Guide](docs/ARCHITECTURE_GUIDE.md), [CENTER_PLATFORM_ROADMAP.md](docs/CENTER_PLATFORM_ROADMAP.md). |

The active host agent lives at `core_node/pyapps/claude_host` (standard pyapp v2.0: `host_agent.py` gateway WS agent + `claude_runner.py` CLI process manager, with linux-ops services). The copy here is the original single-file reference.

## Build & Run

```bash
# Center server (:18100)
cd webclaude_center_server && npm install && node src/control/app.js

# Go gateway (:18200)
cd webclaude_go-gateway && go mod tidy \
  && go build -trimpath -ldflags "-s -w" -o relay-api ./cmd/relay-api && ./relay-api

# Website (:18300)
cd webclaude_website && pnpm install && pnpm run dev

# All services
./scripts/start.sh
```

## Deploy (remote launch / kill)

Logs go to `/tmp/webclaude_group/logs/`. Replace the root with the server's actual root (`/www/programing/core_node` or `/home/ubuntu/wwwroot`).

```bash
# file_sync_v2
mkdir -p /tmp/webclaude_group/logs/file_sync_v2
nohup python3 <ROOT>/scripts/file_sync_v2/server.py \
  > /tmp/webclaude_group/logs/file_sync_v2/server.log 2>&1 &
sudo pkill -9 -f "<ROOT>/scripts/file_sync_v2/server.py"

# webclaude_center_server (:18100)
mkdir -p /tmp/webclaude_group/logs/webclaude_center_server
chmod +x <ROOT>/webclaude_group/webclaude_center_server/scripts/start.sh
nohup <ROOT>/webclaude_group/webclaude_center_server/scripts/start.sh \
  > /tmp/webclaude_group/logs/webclaude_center_server/launcher.nohup.log 2>&1 &
sudo fuser -k 18100/tcp

# webclaude_go-gateway (:18200)
mkdir -p /tmp/webclaude_group/logs/webclaude_go-gateway
chmod +x <ROOT>/webclaude_group/webclaude_go-gateway/scripts/start.sh
nohup <ROOT>/webclaude_group/webclaude_go-gateway/scripts/start.sh \
  > /tmp/webclaude_group/logs/webclaude_go-gateway/launcher.nohup.log 2>&1 &
sudo fuser -k 18200/tcp

# Kill all webclaude_group start.sh
sudo pkill -9 -f '(/www/programing/core_node|/home/ubuntu/wwwroot)/webclaude_group/(.*/)?scripts/start\.sh'
```

See [CLAUDE.md](CLAUDE.md) for development rules (shell scripts, error handling, ports, gotchas).
