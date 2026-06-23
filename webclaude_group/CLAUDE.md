# CLAUDE.md — WebClaude Group

## Workflow
- Develop LOCALLY (Windows); code syncs to REMOTE servers (Debian/Ubuntu). Website / gateway / center_server / host may run on different remote servers.
- Debug from REMOTE logs — local paths are reference only.

## Services & ports
- `webclaude_center_server` — Node.js Express, MikroORM (EntitySchema, **no decorators**): **18100**
- `webclaude_go-gateway` — Go chi, uptrace/bun (multi-dialect DB): **18200**
- `webclaude_website` — React 19 + Vite: **18300**
- `claude_host` — Python, WebSocket client to the gateway
- DB: SQLite default (`DB_TYPE=sqlite`, zero-dependency); MySQL + Redis optional for production.

## Shell scripts (CRITICAL — overrides default habits)
- **NEVER** `exit 0` / `exit 1` / any exit code — use flag vars (`BUILD_OK`, `CAN_RUN`) + if/else flow.
- **NEVER** `set -e` / `set -euo pipefail` — report every issue and keep going.
- **NEVER** `return` as an exit substitute (only valid inside functions / sourced scripts).
- Detect build/binary success by **file existence** (`[ -f "$OUTPUT" ]`), not exit codes.
- Real-time output (no buffering); status prefixes `[OK]` `[INFO]` `[WARN]` `[FAIL]`. Idempotent — safe to rerun.
- Complex logic goes in Python (`scripts/pytools/`), not shell. System installs via `core_node/scripts/shells/linux/`.

## Code style (project-specific)
- Declare all variables at the top of the file/function.
- PowerShell: no relative paths — use `Split-Path` / `Join-Path` / `Resolve-Path`.
- Don't create/modify test files; don't create/update `*.md` unless explicitly asked.

## Bridges, optional `require`, and errors (Node / TS / Go)
- **Node** (center_server + shared): eager top-level `require`. Parse untrusted Redis/DB JSON with `packages/webclaude-shared/utils/jsonParseLenient.js`. Optional native deps → top-level `require` or a single `*Bridge.js` that distinguishes `MODULE_NOT_FOUND` from real errors. No `require` inside `catch`; no empty `catch {}` around `require`. Break `require` cycles with a thin bridge / third module, not nested try/require.
- **Go** (gateway): wrap errors with `%w` / `errors.Join`; never hide init failures.
- **Website** (TS/React): don't use dynamic `import()` inside `catch` as the primary pattern; surface lazy-load failures.
- Cursor rules: `webclaude_group/.cursor/rules/webclaude-error-handling-modules.mdc` + per-app rules under each app's `.cursor/rules/`.

## Gotchas
- **Go**: `GOPROXY`/`GOSUMDB` may be empty on fresh installs — set defaults; run `go mod tidy` before build if `go.sum` is incomplete; `CGO_ENABLED=0` for static builds; Go binary lives in `/usr/local/go/bin` or `/www/*/go/bin` (add to PATH).
- **Node**: Redis is optional (ioredis retry max 3, `enableOfflineQueue=false`); admin auth falls back to in-memory `Map` without Redis; `@webclaude/shared` is a local workspace package (`packages/webclaude-shared/`).
- **Installs**: Go `53_install_golang22.sh` (`INSTALL_GO=true`), Redis `45_install_redis.sh` (`START_REDIS=true`) — set via `gvar_common.sh set_var`.

## Paths
- Root: `core_node/webclaude_group/` · Data: `.data/` · Logs: `.data/cache/logs/`

Build/run/deploy commands live in [README.md](README.md).


**Global mandatory AI rules** (apply here too): Git **commit-only** — no other git operations — and **never revert/undo/overwrite existing code or local changes**; also never delete the `core_node` dir without the guarded triple confirmation. See repo-root `development-guides/GIT_AND_NO_REVERT_SAFETY.md` and `development-guides/CORE_NODE_DELETION_SAFETY.md` (and root `CLAUDE.md`/`AGENTS.md`).
