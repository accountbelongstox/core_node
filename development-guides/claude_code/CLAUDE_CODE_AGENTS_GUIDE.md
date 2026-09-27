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

## 8. Roles, scopes and boundaries (user D22, 2026-09-27: 16 roster roles in 5 groups, plus remote and service roles)

UI root: `poly_apps/pycore_laravel_wordnew_ui` (written as `UI/` below). A role's name prefix is its group. The exact path map is in `.claude/agents/pycore-lead.md`, identical in every group role file.

| Group | Role | Write scope (summary) |
|---|---|---|
| claude (1) | orchestrator (claude lead and role orchestrator) | `docs_fix/`, `config/*.json`, `.claude/agents/`, `.claude/agents_shared/`, `development-guides/` (B12) |
| pycore (5) | **pycore-lead** (leader, code leader) | pycore entry points, launcher and foundations. Audits and merges all pycore-group work against `PYTHON_PYCORE.md` |
| | pycore-ai | large models (pyctl/pyutils ai, tts, stt, llm, ocr, translation, ensure_library), `pycore/tts_install_assets/`, and the local model init scripts on both OSes (`Step{9,11,12,36-39,42,43,46,47,51-61}`, `DockerWslBridge.ps1`, Linux tts/docker model scripts, `docker_compose/tts/`) |
| | pycore-runtime | pyservice backend (callmodule, database, common, rpc_v2, laravel link, codesync, relay, queue center, audio orchestration, every other pycore path, `pyapps/`) and the pyservice prerequisite scripts (`pyservice_entry.sh`, `pyservice_www_permissions.sh`, `codesync_service.sh` and their Windows counterparts) |
| | pycore-laravel | Laravel foundation and shared services, machine routes, relay, UI APIs, unassigned Laravel apps: every `poly_apps/laravel_main/` path not owned by wordnew-laravel or codemart-laravel |
| | pycore-ui | `UI/apps/{pycore-manager,laravel-manager,vortex,pdd-manager}/`, `UI/flavors/vortex/`. Default writer of the shared UI layer (B2) |
| wordnew (5) | **wordnew-lead** (leader; assigns tasks automatically) | `UI/apps/wordnew/docs/`, and any wordnew path it assigns itself |
| | wordnew-ui | `UI/apps/wordnew/` (except docs), `UI/flavors/wordnew/` |
| | wordnew-laravel | Laravel AppQyV1: `app/Apps/AppQyV1/`, its router and migrations, the AppQyV1 services and controllers |
| | wordnew-native | `UI/native/wordnew/` (Capacitor), the wordnew build and prerequisite scripts |
| | wordnew-link | `apps/mcp-chrome/`, plus pycore and mcp-chrome linkage glue |
| shell (2) | **shell-windows** (leader and developer) | `dd.cmd`, `scripts/winenvs/`, `scripts/shells/win/`, other Windows scripts, except the pycore/wordnew-native scripts above |
| | shell-linux | `dd.sh`, `scripts/linuxenvs/`, `scripts/shells/{linux,common,docker_compose}/`, `scripts/ai_shtools/`, other `*.sh`, except the pycore/wordnew-native scripts above |
| codemart (3) | **codemart-lead** (leader and developer) | `docs_fix/codemart_docs/`, cross-cutting CodeMart items, any codemart path it assigns itself |
| | codemart-ui | `UI/apps/codemart/`, `UI/flavors/codemart/` |
| | codemart-laravel | `app/Apps/CodeMartV1/`, its router and migrations |
| remote | laravel-remote | the laravel-main server checkout (§10) |
| remote | pycore-gpu-remote | test-only on a GPU host (§10); the pycore group's tester |
| service | reviewer | verdict files for the leaders' own work and for cross-group changes, plus its own report |
| service | ncore | `ncore/`, and `apps/` except `apps/mcp-chrome/`. On demand |
| service | flutter | `poly_apps/flutter_bloom/`. On demand (D6 won't-fix) |

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
- B15 **Linux shell rules** (user D24, 2026-09-27): `development-guides/LINUX_SHELL_RULES.md` supplements the shell guide for every Linux script and Linux path computation.
  - The Linux constants library defines each constant once.
  - An NTFS mount holds source code and the data both OSes share (D26: the shared data dir D:/www/core_node = /www/www/core_node). No install paths, caches, build or temp directories, node_modules/vendor/.venv, or Linux-only service state (`service_contract.json#paths.linux_ntfs_policy`).
  - No recycle bin on an NTFS mount (D25): scripts never trash there, the mount setup blocks per-volume trash idempotently, and emptying an existing trash needs the user.
- B13 (superseded by B14) **Role families**: the laravel/pycore coordinator families of D16.
- B14 **Groups and leaders** (user D22, 2026-09-27).
  - Every group has one leader. The claude lead (orchestrator) gives each group its tasks through the leader. The leader splits them over its members by the path map, one writer per path, then checks each member task and writes its verdict.
  - A leader's own development and cross-group changes are verified by the `reviewer` service.
  - Service roles (`window: false` in the catalog) are valid task tags that get no window at start.
  - The pycore leader is also the code leader: every pycore-group change is audited against `PYTHON_PYCORE.md`.
  - Launcher tabs follow the groups (`config/claude_team_roles.json#layout.tab_groups`).
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
- **Server prerequisites (once, by the user):** the same codebase at `root`, and `claude` signed in with the same claude.ai account.
- **Code distribution (user D19, 2026-09-27):** code reaches every remote host only through **pyservice CodeSync** (`docs_fix/CODESYNC_AI_COMMUNICATION_API.md`).
  - The DEV checkout pushes signed file versions (client key K3, SHA-256 version conditions) to the host's CodeSync client (`pyservice codesync run`, or pycore with CodeSync). A change made on a remote host travels back the same way.
  - Git is never used to move code between machines. A remote role checks arrival by file SHA-256, never by git HEAD.
- **Remote roles:**
  - `laravel-remote` develops and tests on the laravel-main server;
  - `pycore-gpu-remote` is a test-only GPU host, Linux or Windows, and the pycore group's tester. Its catalog `remote.os` is `auto`, and it starts only when its `ssh_secret` resolves.
- **Reports and verdicts:** the remote role sends its changed-file list, verification output and handoff report by message. The reviewer and the verdict files stay on the local machine.

