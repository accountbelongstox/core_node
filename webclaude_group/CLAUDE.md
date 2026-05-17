# CLAUDE.md - WebClaude Group Project Rules

## Development Workflow
- Development happens LOCALLY (Windows). Code syncs to REMOTE servers (Debian/Ubuntu) via sync software
- Website, gateway, center_server, host may run on DIFFERENT remote servers
- Debug info comes from REMOTE logs, not local paths. Local environment is reference only
- Before modifying code, read and understand the existing file first

## Architecture
- webclaude_center_server (Node.js Express): port 18100
- webclaude_go-gateway (Go chi): port 18200
- webclaude_website (React 19 + Vite): port 18300
- claude_host (Python): WebSocket client to gateway

## Database
- Default: SQLite (zero-dependency deployment, DB_TYPE=sqlite)
- Optional: MySQL + Redis (production with full features)
- Go gateway uses uptrace/bun for multi-dialect DB support
- Node.js center_server uses MikroORM (EntitySchema, no decorators) 

## Shell Script Rules (CRITICAL)
- **NEVER use `exit 0`, `exit 1`, or any exit codes** — use flag variables (BUILD_OK, CAN_RUN) and if/else flow control instead
- **NEVER use `set -e` or `set -euo pipefail`** — let scripts report all issues and continue
- **NEVER use `return` as exit substitute** — `return` only works inside functions or sourced scripts
- All output must be real-time (no buffering, no silent failures)
- Use `[OK]`, `[INFO]`, `[WARN]`, `[FAIL]` prefixed messages for status
- Complex logic goes in Python (scripts/pytools/), not shell
- System package installs use core_node/scripts/shells/linux/ scripts (idempotent)
- All scripts must be idempotent — safe to run multiple times
- Binary/build success detection: check file existence (`[ -f "$OUTPUT" ]`), not exit codes

## Code Style
- All code and comments in English only
- All variables declared at the beginning of the file/function
- No relative paths in PowerShell (use Split-Path, Join-Path, Resolve-Path)
- Do not create or modify test files
- Do not create or update documentation (*.md) unless explicitly asked
- Prefer editing existing files over creating new ones

## Bridges, optional `require`, and errors (Node / TS / Go)

- Cursor rules: `webclaude_group/.cursor/rules/webclaude-error-handling-modules.mdc`; per-app rules under `webclaude_center_server/.cursor/rules/`, `webclaude_go-gateway/.cursor/rules/`, `webclaude_website/.cursor/rules/`.
- Aligns with Cursor agent guidance (verifiable outcomes, no silent failures): https://cursor.com/blog/agent-best-practices
- **Node (center_server + shared)**: eager `require` at module top. Untrusted JSON from Redis/DB: `packages/webclaude-shared/utils/jsonParseLenient.js`. Optional native deps: `package.json` + top-level `require`, or a single `*Bridge.js` that distinguishes `MODULE_NOT_FOUND` from real errors. No `require` inside `catch`; no empty `catch {}` around `require`.
- **Cycles**: break `require` cycles with a thin bridge or a third module, not nested try/require in services.
- **Go (gateway)**: wrap errors with `%w` / `errors.Join`; do not hide init failures.
- **Website (TS/React)**: avoid dynamic `import()` inside `catch` as the primary pattern; log or surface lazy-load failures.

## Build & Run Commands
- Center server: `cd webclaude_center_server && npm install && node src/control/app.js`
- Go gateway: `cd webclaude_go-gateway && go mod tidy && go build -trimpath -ldflags "-s -w" -o relay-api ./cmd/relay-api && ./relay-api`
- Website: `cd webclaude_website && pnpm install && pnpm run dev`
- Unified launcher: `./scripts/start.sh` (starts all services)

## Important Paths
- Project root: core_node/webclaude_group/
- Data dir: webclaude_group/.data/
- Logs: webclaude_group/.data/cache/logs/
- Install scripts: core_node/scripts/shells/linux/debian/install_shells/
- Go install: 53_install_golang22.sh (requires INSTALL_GO=true via gvar_common.sh set_var)
- Redis install: 45_install_redis.sh (requires START_REDIS=true via gvar_common.sh set_var)

## Go Gateway Gotchas
- GOPROXY and GOSUMDB may be empty on fresh installs — scripts must detect and set defaults
- Run `go mod tidy` before build if go.sum is incomplete
- CGO_ENABLED=0 for static builds
- Go binary installed to /usr/local/go/bin or /www/*/go/bin — add to PATH before use

## Node.js Gotchas
- Redis is optional: ioredis retryStrategy max 3 attempts, enableOfflineQueue=false
- Admin auth falls back to in-memory Map when Redis unavailable
- @webclaude/shared is a local workspace package (packages/webclaude-shared/)
