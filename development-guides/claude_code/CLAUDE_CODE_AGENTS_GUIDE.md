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

## 8. Roles, scopes and boundaries (14 roles)

UI root: `poly_apps/pycore_laravel_wordnew_ui` (written as `UI/` below).

| Role | Guide | Write scope |
|---|---|---|
| orchestrator | this guide | `docs_fix/`, `config/*.json`, `.claude/agents/`, `.claude/agents_shared/` |
| pycore | `PYTHON_PYCORE.md` | `pycore/` (including TTS/audio), `pymain.py`, `pyservice.*`, `pyapps/` |
| laravel | `LARAVEL_GUIDE.md` | local `poly_apps/laravel_main/` (every API consumed by the UIs, flutter and mcp-chrome). Develops and tests **locally** |
| laravel-remote | `LARAVEL_GUIDE.md` | the same `poly_apps/laravel_main/` in the laravel-main **server** checkout, over SSH (§10). Develops and tests **directly on the server** |
| shell | `DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md` | `scripts/`, `dd.sh`, `dd.cmd` (every role's installs) |
| reviewer | all guides | verdict files and its own report only |
| laravel-manager | UI conventions | `UI/apps/laravel-manager/` |
| pycore-manager | UI conventions | `UI/apps/pycore-manager/` |
| wordnew | UI conventions, `UI/apps/wordnew/docs/` | `UI/apps/wordnew/`, `UI/flavors/wordnew/`, `UI/native/wordnew/` |
| codemart | UI conventions | `UI/apps/codemart/`, `UI/flavors/codemart/` |
| vortex | UI conventions | `UI/apps/vortex/`, `UI/flavors/vortex/`: the pycore UI sub-app "Vortex Sandbox" |
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
- B6 **Installers.** Installs belong to shell. pycore owns only its runtime package policy code inside `pycore/`.
- B7 **Guides are read-only.** `development-guides/` changes only when the user asks.
- B8 **Common rules.** AGENTS.md applies to all roles, with auto mode. Read-only git/gh is always allowed; every other git/gh command needs the user's prompt to ask for it.

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

