# CLAUDE.md — WebClaude Group

Develop LOCALLY (Windows); code syncs to REMOTE Linux servers — debug from remote logs, local paths are reference only.

Services/ports: center_server (Node/Express, MikroORM EntitySchema **no decorators**) 18100 · go-gateway (Go chi, uptrace/bun) 18200 · website (React 19/Vite) 18300 · claude_host (Python WS client). DB: SQLite default; MySQL+Redis optional (admin auth falls back to in-memory Map without Redis).

Shell scripts (overrides default habits):
- NEVER `exit`/`return` as exit codes, NEVER `set -e`/`-euo pipefail` — use flag vars (`BUILD_OK`) + if/else, report every issue and keep going.
- Detect success by file existence (`[ -f "$OUTPUT" ]`), not exit codes. Real-time output, `[OK]/[INFO]/[WARN]/[FAIL]` prefixes, idempotent.
- Complex logic → Python (`scripts/pytools/`), not shell; system installs → `core_node/scripts/shells/linux/`.

Code: declare vars at top; PowerShell no relative paths (`Split-Path`/`Join-Path`). No test files; no `*.md` unless asked.

Error handling: Node eager top-level `require` (no `require` in `catch`, no empty `catch{}`); break cycles with a thin `*Bridge.js`; parse untrusted JSON via `webclaude-shared/utils/jsonParseLenient.js`. Go: wrap with `%w`/`errors.Join`. TS/React: no dynamic `import()` in `catch` — surface lazy-load failures.

Full detail: webclaude_group/README.md + per-app `.cursor/rules/`. Git per repo-root rules.
