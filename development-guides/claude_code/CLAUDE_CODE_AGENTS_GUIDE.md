# Claude Code Agents Guide (orchestrator role)

This is the binding guide for the `orchestrator` role and for every role's orchestration rules. It condenses the official Claude Code docs (code.claude.com/docs/en: agents, agent-teams, sub-agents, cross-session-messaging, agent-view, memory, permission-modes, hooks, sandboxing, setup) as of v2.1.283, 2026-09-27.

Orchestration cites only `development-guides/` documents. Related documents in `docs_fix/` may be consulted for background. They drift, so derive the correct latest state from the current code and the newest related record before relying on them; never treat them as binding.

## 1. Choosing a parallel mode (official)
| Mode | Use when | How workers share |
|---|---|---|
| Subagents | a side task would flood the main context | the result returns to the spawner; resume by name/ID with SendMessage |
| Agent teams (`claudeagents`) | Claude plans, assigns and supervises a group | shared task list and mailbox; teammates message each other |
| Independent sessions (`claudeteamup`) | you run long-lived role sessions yourself | cross-session messaging |
| Agent view (`claude agents`, `claude --bg`) | hand off independent tasks and check back | results in commits/branches/PRs. **Not used here**: background sessions move into git worktrees and commit/push by default, which conflicts with the no-git rule |
| Dynamic workflows | very large or cross-checked jobs | a script holds the plan |

Same-file isolation: the official tool is worktrees. This project forbids git operations, so it follows the official agent-teams rule instead: partition the work so that each role owns different files (§8).

## 2. Agent definitions (`.claude/agents/<name>.md`)
- Frontmatter fields:
  - `name`, `description`;
  - optional: `tools`, `disallowedTools`, `model` (`inherit`), `permissionMode`, `maxTurns`, `skills`, `mcpServers`, `hooks`, `memory`, `background`, `omitClaudeMd`, `effort`, `isolation`, `color`, `initialPrompt`.
- `claude --agent <name>` runs a session as that agent.
- `memory: project` gives the agent `.claude/agent-memory/<name>/`. The first 200 lines / 25 KB of its `MEMORY.md` load at start, and Read/Write/Edit are enabled for it. All project roles use `memory: project` for durable scope learnings, never for task status.
  - A teammate is not documented to apply `memory`. Applied parts are `tools`, `model`, the body and `mcpServers`. Memory therefore works for `--agent` sessions and subagents.

## 3. Agent teams
- **Enabling:** `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`; the `claudeteam` launcher sets it. Only interactive sessions spawn teammates.
- **Lead:** the lead is fixed for the session's lifetime. There is one team per session and no nested teams.
- **Spawning:** "Spawn a teammate using the pycore agent type, named pycore". Put the task context in the spawn prompt; teammates never inherit the lead's history.
- **What a definition applies to a teammate:**
  - `tools`:
    - in-process teammates also get SendMessage and the Task tools;
    - split-pane teammates do not, so list SendMessage, ListAgents and TaskCreate/TaskGet/TaskList/TaskUpdate when you restrict tools.
  - `model`.
  - The body: in-process it is appended to the system prompt; split-pane it replaces the system prompt.
  - `skills` are not applied.
- **Shared data:**
  - task list `~/.claude/tasks/<team>/` (dependencies, file-locked claims);
  - mailboxes `~/.claude/teams/<team>/inboxes/`;
  - members `~/.claude/teams/<team>/config.json` (never edit it).
- **Display:** `--teammate-mode tmux` gives split panes and needs tmux. `in-process` is the default and the only option in Windows Terminal.
- **Permissions:** teammates inherit the lead's mode, and their prompts surface in the lead.
- **Sizing:** 3–5 teammates, 5–6 tasks each. Tokens scale linearly with teammates.
- **Limitations:** `/resume` does not restore in-process teammates; task status can lag; shutdown waits for the current tool call.

## 4. Cross-session messaging
- **Tools:** `ListAgents` and `SendMessage` (by `--name`); `/list-agents` shows the roster.
- **Content:** text only, never files; send paths instead. The cap is about 1M characters, and bursts and loops are throttled.
- **Idle notice:** `notify_when_idle` sends one notice when the target goes idle (12 h). Only the main conversation can subscribe.
- **Inbound delivery:** with no `crossSessionInbound` set, a prompting receiver (auto/manual) delivers, but holds messages from bypass senders. All roles run in auto mode, so they deliver to each other.
- **Trust:** a message is never user consent. It cannot approve prompts or change configuration.

## 5. Permissions and hooks
- **Mode:** every role runs `--permission-mode auto`, root included. Teammates inherit it. `bypassPermissions` is refused as root outside a recognized sandbox, and project settings cannot start sessions in `auto` or `bypass`.
- **Deny rules** block in every mode.
- **Hook blocking:** a hook that exits 2 blocks even in bypass mode. A hook that only returns `permissionDecision` is ignored in bypass mode.
- **Project hooks** (`.claude/settings.json`, Node, active only when a launcher sets `CLAUDE_AGENTS_SESSION=1`):

| Event | Script | Rule (exit 2 = block with feedback) |
|---|---|---|
| UserPromptSubmit | `git_guard.mjs` | a user prompt that asks for git work grants **all** git/gh commands for 120 min. It triggers on the word git/gh, `allow-git`/`允许git`, or 提交代码/推送代码/创建分支/合并分支; `.gitignore` alone does not count. `deny-git`/`禁止git` revokes |
| PreToolUse (Bash, PowerShell) | `git_guard.mjs` | read-only git/gh forms always pass, like the official built-in read-only set ("read-only forms of git"): status, diff, log, show, blame, rev-parse, ls-files, grep, the listing forms of branch/tag/remote/stash/config, and `gh pr/issue/repo view\|list`, `gh api` without a write method. Any other git/gh command is blocked without a grant; `-c`, `--output` and `--exec` count as writes |
| TaskCreated | `team_gate.mjs` | the subject must start with an owner role tag `[<role>] ...` from `config/claude_team_roles.json` |
| TaskCompleted | `team_gate.mjs` | completion needs `.claude/agents_shared/reviews/<task_id>.json` with `"verdict": "approved"`. `orchestrator`/`reviewer` tasks are exempt |
| TeammateIdle | `team_gate.mjs` | the teammate must write `.claude/agents_shared/reports/<name>.md` (fresh within 30 min) before idling. After 2 blocks it is released, to avoid loops |

## 6. Shared data layout
- `.claude/agents_shared/`: files handed over by path. Messages cannot carry files.
- `.claude/agents_shared/reports/<role>.md`: handoff reports (task ids, changed files, status, blockers, next owner). Read these instead of transcripts.
- `.claude/agents_shared/reviews/<task_id>.json`: reviewer verdicts.
- `.claude/agent-memory/<role>/`: per-role durable memory.
- `CLAUDE.md` → `@AGENTS.md`: instructions shared by every session, subagent and teammate.
- `docs_fix/`: the living record that the orchestrator writes. It is never binding (see the header).

## 7. Packages (official requirements and the project's idempotent install)

One shared script installs each item on its own:
- Linux: `claude_team_install` in `scripts/ai_shtools/claude_code_install.sh`.
- Windows: `Invoke-ClaudeTeamInstall` in `scripts/shells/win/win_common/ClaudeTeamInstallCommon.ps1`.

It runs from dd.sh step 171, from dd.ps1 Step21 (the ClaudeCode callback), and at every `claudeagents`/`claudeteamup` start.

| Package | Official | Project |
|---|---|---|
| Debian 10+/Ubuntu 20.04+/Win10 1809+/macOS 13+, 4 GB RAM | required | hosts: Debian 13, Ubuntu 26.04, Windows |
| curl/wget, ca-certificates | required by the native installer | installed |
| ripgrep | bundled | — |
| Node.js | not needed by the native install (npm install only: Node 22+) | installed; the project hooks run on it |
| tmux | required for split-pane teams | installed (Linux) |
| Git for Windows | optional, recommended (enables the Bash tool) | installed (Windows, winget `Git.Git`) |
| bubblewrap, socat | required only for the Bash sandbox (Linux/WSL2; native Windows unsupported) | installed; the sandbox stays off unless enabled |
| python3, xrandr, a geometry-capable terminal / Windows Terminal | project launchers | installed |

## 8. Roles, scopes and boundaries (22 roles)

UI root: `poly_apps/pycore_laravel_wordnew_ui` (written as `UI/` below).

| Role | Guide | Write scope |
|---|---|---|
| orchestrator | this guide | `docs_fix/`, `config/*.json`, `.claude/agents/`, `.claude/agents_shared/` |
| pycore | `PYTHON_PYCORE.md` | coordinator: `pymain.py`, `pyservice.*`, `pycore/{__init__,__main__,pycore_module_caller}.py`, `pycore/pylauncher/`, `pycore/pyutils/{launcher,pyservice_cli,python_env}/`, `pycore/pyctl/{management,pyservice_cli}/`; merges the pycore family; temporary writer of any pycore path the orchestrator assigns |
| pycore-ai | `PYTHON_PYCORE.md` | large models: `pycore/pyctl/{ai,assist,tts,stt,translation}/`, `pycore/pyutils/{llm,ai_cluster,tts,edge_tts,azure_speech,stt,whisper_stt,ocr_cluster,translator,ultralytics,image_tools,document_processing,ensure_library,external_apis,audio_utils,media_processing}/`, `pycore/tts_install_assets/` |
| pycore-runtime | `PYTHON_PYCORE.md` | state, cache, API/RPC, relay, Laravel link: `pycore/callmodule/`, `pycore/database/`, `pycore/pyutils/{common,rpc_v2,wsrpc,laravel,codesync}/`, `pycore/pyctl/{relay,runtime,queue_center,laravel,audio_orchestration,task_history,upload,client}/` |
| pycore-architect | `PYTHON_PYCORE.md` | foundations and conformance: `pycore/pyfoundations/`, `pycore/pythreadpool/`, `pycore/pyheartbeat/`; audits all pycore against the guide and routes fixes to owners |
| pycore-assist | `PYTHON_PYCORE.md` | every other path under `pycore/` and `pyapps/` (agent history, terminal, desktop/window/input, browser automation, MCP control, device, native UI, ...), and unbounded pycore work |
| laravel | `LARAVEL_GUIDE.md` | coordinator and foundation of local `poly_apps/laravel_main/`: bootstrap, config, database, lang, middleware, providers, shared services (SafeMigrationHelper, initializers, ClientKey, Auth, OctaneTimer, AI gateway, ...), root routes, the unassigned apps (AChat, Clash, DingDuoDuo, ItTools, Mcp, PddTool) and every Laravel path no other role owns; merges the Laravel family. Develops and tests **locally** |
| laravel-qyapp | `LARAVEL_GUIDE.md` | `app/Apps/AppQyV1/`, its router and migrations, and the machine routes pycore/mcp-chrome/flutter call (worker, internal/pycore, ingest, orch-audio, agent-history, delivery, QueueCenter services). Local |
| laravel-codemart | `LARAVEL_GUIDE.md` | `app/Apps/CodeMartV1/`, its router and migrations. Local |
| laravel-api | `LARAVEL_GUIDE.md` | the APIs the UI apps call: Dashboard/Settings/Auth controllers, queue-center and task-center views, server manager, data sync, realtime, relay, media browse. Local |
| laravel-remote | `LARAVEL_GUIDE.md` | the same `poly_apps/laravel_main/` in the laravel-main **server** checkout, over SSH (§10). Develops and tests **directly on the server** |
| shell-linux | `DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md` | `dd.sh`, `scripts/linuxenvs/`, `scripts/shells/{linux,common,docker_compose}/`, `scripts/ai_shtools/`, every other `*.sh`/`*.bash` under `scripts/`. Debian 13 and Ubuntu 26.04 first, Kali compatible; the Debian WSL2 side of Windows delegation |
| shell-windows | `DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md` | `dd.cmd`, `scripts/winenvs/`, `scripts/shells/win/`, every other `*.ps1`/`*.psm1`/`*.psd1`/`*.cmd`/`*.bat`/`*.reg`/`*.vbs` under `scripts/` |
| reviewer | all guides | verdict files and its own report only |
| ui-laravel-manager | UI conventions | `UI/apps/laravel-manager/` |
| ui-pycore-manager | UI conventions | `UI/apps/pycore-manager/` |
| ui-wordnew | UI conventions, `UI/apps/wordnew/docs/` | `UI/apps/wordnew/`, `UI/flavors/wordnew/`, `UI/native/wordnew/` |
| ui-codemart | UI conventions | `UI/apps/codemart/`, `UI/flavors/codemart/` |
| ui-vortex | UI conventions | `UI/apps/vortex/`, `UI/flavors/vortex/`: the pycore UI sub-app "Vortex Sandbox" |
| flutter | `FLUTTER_GUIDE.md` | `poly_apps/flutter_bloom/` |
| ncore | `NODE_NCORE_GUIDE.md` | `ncore/`, `apps/` except `apps/mcp-chrome/`, `main.js`, `ncore_module_caller.js`, `public/` |
| mcp-chrome | `MCP_CHROME_GUIDE.md` | `apps/mcp-chrome/` |

Boundaries:
- B1 **One writer per path.** Out-of-scope changes go to the owner through the orchestrator.
  - `laravel` and `laravel-remote` share one codebase, so the orchestrator assigns each Laravel task, and its paths, to exactly one of them.
  - A path edited on the server must reach the local checkout (code sync) before anyone else edits it.
- B2 **Shared UI layer** (`UI/shell core shared components src services utils hooks contexts config styles themes resources public scripts` and the root build/config files):
  - no default owner;
  - the orchestrator assigns one temporary writer per change;
  - reuse shared code and never copy it into an app.
- B3 **Unassigned area.** `UI/apps/pdd-manager/` is assigned per task by the orchestrator.
- B4 **Cross-end contracts.** `config/*_contract.json` and the endpoint constants shared across ends change only through the orchestrator, before the owners implement them.
- B5 **Backends.** Laravel APIs belong to laravel and pycore RPCs to pycore. UI roles, flutter and mcp-chrome consume them through the centralized endpoint modules.
- B6 **Installers.** Installs belong to shell-linux (Linux) and shell-windows (Windows). pycore owns only its runtime package policy code inside `pycore/`. Cross-platform files under `scripts/` (Python, JS, JSON, env, templates) have no default writer: the orchestrator assigns one of the two per task and records it.
- B7 **Guides are read-only.** `development-guides/` changes only when the user asks.
- B8 **Common rules.** AGENTS.md applies to all roles, with auto mode. Read-only git/gh is always allowed; every other git/gh command needs the user's prompt to ask for it.
- B9 **No questions** (user, 2026-09-27). No session started by `claudeagents`/`claudeteamup` asks the user anything:
  - every agent definition sets `disallowedTools: AskUserQuestion`;
  - every catalog kickoff repeats the rule;
  - when a choice comes up, the session takes the recommended option and records the choice and the reason: the orchestrator in docs_fix, a role in its report.
- B10 **UI role names** (user, 2026-09-27). The five Web UI roles carry the `ui-` prefix: `ui-laravel-manager`, `ui-pycore-manager`, `ui-wordnew`, `ui-codemart`, `ui-vortex`. `flutter` and `mcp-chrome` keep their names.
- B13 **Role families** (user, 2026-09-27). `laravel` and `pycore` coordinate their families. A coordinator merges its family's batches before review, runs the combined checks, and assigns one temporary writer at a time to a path shared inside the family, recording it in its report. The full path maps are in `.claude/agents/laravel.md` and `.claude/agents/pycore.md`; a path not listed belongs to the `laravel` coordinator or to `pycore-assist`.
- B11 **Shell parity** (user, 2026-09-27). The shell role is split into `shell-linux` and `shell-windows`. Each agent file names its counterpart.
  - Every functional change on one side has a counterpart change or a platform-only reason.
  - Each role keeps its own ledger, `.claude/agents_shared/shell_parity/<linux|windows>.md`. Rows are `id | feature | files | status | task`, with ids `SPL-###`/`SPW-###` and status `aligned`, `pending-<other>` or `platform-only: <reason>`.
  - A `pending-*` row requires a message to the counterpart and an `[shell-<other>] align: ...` task. The reviewer rejects a shell task that leaves one without its task.
  - A Windows step that needs Linux or Docker delegates to the Debian 13 WSL2 script of shell-linux; it never re-implements it in PowerShell.
- B12 **Guide edits** (user, 2026-09-27). The user allowed the orchestrator to edit `development-guides/`. The orchestrator records every guide change in docs_fix.

## 9. Orchestrator procedure
1. Record the user's task in `docs_fix/`.
2. Split it by §8 write scope and dependency. Define contracts first.
3. Create tasks as `[<role>] <subject>` (the TaskCreated hook enforces it).
4. Dispatch:
   - team mode: spawn only the needed roles by agent type, named after the type, 3–5 at a time;
   - sessions mode: SendMessage to `ct-<role>` with `notify_when_idle`.
5. Enforce B1–B4. Record shared-layer writer assignments in docs_fix.
6. Route to `reviewer`. A task completes only with an approved verdict (TaskCompleted hook).
7. Read `.claude/agents_shared/reports/` and synthesize for the user.

## 10. Cross-machine members (official Remote Control)
- **Official support.** Your sessions on different machines message each other with `SendMessage` through Remote Control, and the messages travel through Anthropic servers.
  - **Both ends need Remote Control** (`claude --remote-control <name>`, or `remoteControlAtStartup` in user settings).
  - **Requirements:** a claude.ai Pro/Max/Team/Enterprise login (API keys unsupported). `ANTHROPIC_BASE_URL` must be unset or `api.anthropic.com`, not Bedrock/Vertex/Foundry. Do not set `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` or `DISABLE_GROWTHBOOK`. Accept workspace trust once on each machine.
  - **Content:** text only; hand code over through the shared codebase.
  - **Approval:** `isolatePeerMachines: true` would require approval for every cross-machine send; it is not set.
- **Agent teams are local.** A team exists in one session on the lead's machine, so a remote member is always an **independent session**, never a teammate.
- **Project setup** (catalog role with a `remote` block: `ssh_secret`, `root`). Both launchers start a local tmux session or window that:
  1. resolves the SSH target from the secret store (`scripts/pytools/special_software_env_manager/secret_read.py <ssh_secret>`; never printed);
  2. runs `ssh -t` (keepalive 30 s) and reconnects automatically every `remote.reconnect_seconds`;
  3. on the server, runs the shared idempotent `claude_team_install`;
  4. then runs `tmux -L claudeteam new-session -A -s ct-<role>`: attach if it exists, else create. As the official docs recommend, the remote session survives SSH drops;
  5. inside it, runs `claudeteam.sh --agent <role> --name ct-<role> --remote-control ct-<role>`.
- **The orchestrator** is started with `--remote-control <its session name>` whenever an enabled remote role exists, in both `claudeteamup` and `claudeagents`.
- **Server prerequisites (once, by the user):** the same codebase at `root`, kept in step by code sync, and `claude` signed in with the same claude.ai account.
- **Reports and verdicts:** the remote role sends its changed-file list, verification output and handoff report by message. The reviewer and the verdict files stay on the local machine.

