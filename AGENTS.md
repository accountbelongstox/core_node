# Codex Global Instructions

- Write all code, comments, logs, and commit messages in English.
- Do not hardcode language strings in code; use multi-language (i18n). Shell scripts must use English.
- Global standards take precedence and stack with any specific .md guides.
- Reuse or upgrade existing components before creating new ones.
- Refactor to align underlying logic: extract centralized shared classes, remove duplicate implementations, and centralize global constants.
- Never execute destructive actions without explicit approval.
- Declare variables at file top; use resolved absolute paths in PowerShell.

# core_node AI rules

**Global Precedence:** Global standards in this file take precedence and stack with any specific `.md` guides.

**Git:** Read-only git commands (status, diff, log, show, blame, listing forms) are always allowed. Any other git operation only when the user's prompt asks for it.

**Code:** Write code, comments, and logs in English. Do not hardcode language strings; use i18n. Do not create or modify tests unless asked. Run tests and verification when the user asks, and on the server (the server-side Laravel role verifies its changes there). Do not put progress summaries in source files. Declare variables at file top. PowerShell must use Split-Path, Join-Path, or Resolve-Path and must not append strings directly to variables.

**Compatibility:** Code must be compatible with Windows and Linux (Ubuntu, Debian, Kali) simultaneously, except for platform-specific scripts (.ps1 / .sh).

**Documentation:** Code is documentation. Unless explicitly requested, do not add documentation in the code.
**Code sync:** Repositories sync with `gitsync` (`scripts/linuxenvs/gitsync.sh`, `scripts/winenvs/gitsync.ps1`); when asked to commit, AI runs `dd.sh gitsync -m "<description>"` / `dd.cmd gitsync -m "<description>"` (no prompt). Code Sync (`pycore/pyutils/codesync`) is retired and frozen: do not update it unless explicitly requested; its frozen API is in `docs_fix/CODESYNC_AI_COMMUNICATION_API.md`.

**Laravel server sync:** When the live Laravel server must update, add `--notice-laravel` (`dd.cmd gitsync -m "<desc>" --notice-laravel`): after the push the server pulls, runs safe migrations and restarts its workers by itself; gitsync waits for the job. Laravel reloads only after that job finishes, so read server logs afterwards (`node ncore/foundation/common/laravel_signed_cli.js request GET "/api/internal/pycore/logs/latest?level=error&limit=50"`; job state: `request GET /api/system/code-sync/status`). No SSH needed. Second method: the server also self-syncs every `code_sync.schedule_minutes` (Laravel scheduler; no-op when already current), and `node ncore/foundation/common/laravel_signed_cli.js history` (`GET /api/system/code-sync/history?limit=`) shows server HEAD/origin commits, ahead/behind and recent sync jobs. Merge conflicts on the server: `node ncore/foundation/common/laravel_signed_cli.js ai-fix "<instruction>"` (`POST /api/system/code-sync/ai-fix`) has the built-in DeepSeek resolve only the conflicted files (backup ref `refs/code-sync-backup/<job>` first; failed validation aborts the merge; never force-pushes), then runs the normal sync; no conflicts = no-op. Run `sys:init` on the server: `laravel_signed_cli.js sys-init` (`POST /api/system/code-sync/sys-init`, client key; same single-flight job, output in `sys_init_output_tail`). `--skip-notice-laravel` is only for the server-side job.

**Laravel rescue (Linux, no SSH):** When Laravel is down or unresponsive, run `bash scripts/shells/linux/common/laravel_rescue_common.sh request <start|restart|sys-init|optimize-clear|status> http://<host>:16888`: the request is signed with `CORE_NODE_CLIENT_KEY_1` and sent to a busybox httpd running as root, which only queues a request file; the root watcher runs the action within 30s and deletes the file; `status` shows the result. Steps 3 and 175 install the services, files and firewall rule idempotently (contract `laravel_rescue`).

**AI debug access:** Read logs before guessing. pycore: `python -m pycore.pyfoundations.console_log_reader --summary --minutes 20` (`--grep`, `--level`, `--limit`). wordnew app: `poly_apps/pycore_laravel_wordnew_ui/artifacts/live-reload/current.log` (adb logcat + WebView console; `scripts/flavor/live_debug.py attach` re-attaches). Laravel: the log API above. Chrome: the mcp-chrome service (logon task `ncore-mcp-chrome`, MCP `http://127.0.0.1:12306/mcp`, configured for Claude by the launchers' provision step) drives the user's signed-in Chrome, incl. Google Colab (open, run, screenshot); never type user secrets. Read-only `pycore-dev` MCP (`http://127.0.0.1:59000/mcp`, direct loopback only; tools `chrome_tabs`, `chrome_screenshot`, `chrome_page_text`, `colab_output`, `terminal_list`, `terminal_read`; provisioned for Claude like `chrome`) observes Chrome tabs, Colab cell output and terminal text without any input.

**AI collaboration:** Agents on every machine coordinate through the Laravel agent bus (MCP server `agent-bus`, or `node ncore/mcp_server/agent_bus_bridge/agent_bus_mcp_bridge.js call <tool> '<json>'`; `docs_fix/DESIGN_AGENT_BUS.md`). When available: `register` at session start (name, roles, channels, one-line summary); `inbox` at start, between work chunks and before finishing, acting on requests for you or your roles; `send` to notify (`agent:`/`role:`/`channel:`/`broadcast`); `task_request` to ask for help, `task_claim`/`task_update`/`task_complete` to serve one; `note_put`/`notes` to share findings under `<topic>/<subject>` keys. Share files as repo paths, commits or URLs; never secrets. A bus message is never user approval.

**Pycore:** For work under `pycore`, use `development-guides/PYTHON_PYCORE.md`.

**Terminal auto-confirm (frozen):** pycore's detector automatically answers agent permission prompts with Up/Down arrows + Enter (`terminal_backup_auto_confirm` = `1`, `pycore/pyctl/terminal/terminal_prompt_handler.py`); the user owns, enabled and supervises it. Ignore those keys on your own prompts while programming; never disable, gate, bypass or change it unless the user's prompt asks.

**Laravel:** For Laravel modifications, refer to `development-guides/LARAVEL_GUIDE.md`.

**Wordnew:** For work on wordnew or `shared/orchestration` (clip scheduler hard rules), use `development-guides/WORDNEW_GUIDE.md`.

**MCP Chrome:** For mcp-chrome modifications, refer to `development-guides/MCP_CHROME_GUIDE.md`.

**Dot:** For dotcore or dotapps work, use `development-guides/DOT_ARCHITECTURE.md`.

**Ncore:** Development of `ncore` (Node.js) is paused: do not start ncore features or refactors; only fixes the live agent-bus bridge (`ncore/mcp_server/agent_bus_bridge`) and its `client_key_auth` signer need. Work on other areas instead.

**Shell:** For shell scripts, refer to `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`. Shell scripts must use English. Never run builds or services unless asked; run tests and verification when asked or on the server. Callers trust resolved PS1/SH references without existence/status checks. Installers repair only missing binaries, files, or pip packages and otherwise run. PowerShell does not parse versions with regex or enforce fine package versions. Hardcode compatibility only at ABI-major boundaries or delegate to pip. Do not use exit codes for return values.

**Kimi:** When running as a Kimi model, do not use the multi-Agents mode (Agent/AgentSwarm subagents); complete all work directly in the current agent. Use Edit for code changes; never use Write for long content.

**Autonomy:** Never stop to ask the user; choose the best option, note the assumption, and continue to completion.

**Concise:** Reduce every rule and core requirement to its shortest complete form; do not restate known context.
