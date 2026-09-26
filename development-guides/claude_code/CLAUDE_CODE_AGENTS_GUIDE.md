# Claude Code Agents Guide (orchestrator role)

Guide for the `orchestrator` role. It condenses the official Claude Code docs (code.claude.com/docs/en: agent-teams, sub-agents, cross-session-messaging, permission-modes, hooks) as of v2.1.283, 2026-09-27.

Project records:
- roles, scopes and boundaries: `docs_fix/REQUIREMENTS_20260927_CLAUDE_AGENT_ROLES_V2.md`;
- live tasks: `docs_fix/TASK_20260927_CLAUDE_TEAM_BOARD.md`.

## 1. Agent definitions (subagents)
- Project scope: `.claude/agents/<name>.md`. User scope: `~/.claude/agents/`.
- Frontmatter: `name`, `description`, and optionally `tools`, `model` (`inherit` means the lead's model), `mcpServers`.
- `claude --agent <name>` runs a whole session as that agent. `claude --agents '<json>'` adds session-only agents.
- `/agents` and `claude agents` manage agents.

## 2. Agent teams (one lead, many teammates)
- **Enabling:** set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (the `claudeteam` launcher sets it). Only interactive sessions spawn teammates; `-p` never does.
- **Lead:** the main session is the lead for its whole life. There is one team per session, no nested teams, and leadership cannot be transferred.
- **Spawning:** the lead spawns a teammate by naming an agent type, for example "Spawn a teammate using the pycore agent type, named pycore". Teammates get the project context (CLAUDE.md, MCP, skills) and the spawn prompt, never the lead's history. Put task context in the spawn prompt.
- **What a definition applies to a teammate:**
  - `tools`: limits the teammate's tools.
    - An in-process teammate also gets SendMessage and the Task tools.
    - A split-pane teammate does not, so list SendMessage and ListAgents, plus TaskCreate/TaskGet/TaskList/TaskUpdate, in `tools` when you restrict tools.
  - `model`: used when the spawn prompt doesn't name one.
  - Body:
    - in-process: appended to the system prompt;
    - split-pane: replaces the system prompt.
  - `skills` are not applied.
- **Coordination:**
  - Shared task list: pending, in progress, completed, with dependencies. Claiming uses file locks.
  - Teammates message each other by name. Idle teammates notify the lead automatically.
  - Plan approval: a teammate spawned while the lead is in plan mode plans read-only first, and the lead approves automatically.
- **Storage (shared data):**
  - task list: `~/.claude/tasks/<team>/` (kept);
  - team config and members: `~/.claude/teams/<team>/config.json` (removed at session end; never edit it);
  - mailboxes: `~/.claude/teams/<team>/inboxes/<agent>.json`;
  - `<team>` is `session-<first 8 chars of session id>`.
- **Display:**
  - `teammateMode`: `in-process` (the default, works in any terminal), `auto`, `tmux` (split panes) or `iterm2`. Flag: `--teammate-mode`.
  - Split panes need tmux or iTerm2. Windows Terminal, VS Code and Ghostty do not support them.
- **Permissions:** teammates start in the lead's mode (not `dontAsk`), and their prompts surface in the lead.
- **Hooks for quality gates:** `TeammateIdle`, `TaskCreated` and `TaskCompleted`. Exit code 2 sends feedback and blocks the action.
- **Sizing:** start with 3–5 teammates and 5–6 tasks per teammate. Every teammate costs tokens linearly. Give each teammate its own files, because two editors on one file overwrite each other.
- **Limitations:**
  - `/resume` does not restore in-process teammates.
  - Task status can lag.
  - Shutdown waits for the current tool call.

## 3. Cross-session messaging (independent sessions)
- **Tools:** `ListAgents` discovers sessions, subagents and teammates. `SendMessage` delivers to one by name. `/list-agents` shows the roster.
- **Names:** a session answers to `--name` or `/rename`. Duplicate live names get a variant.
- **Content:** messages are plain text only, never history or files; send paths instead. The same-machine cap is about 1M characters. Bursts and loops are throttled.
- **Idle notice:** `SendMessage` with `notify_when_idle` sends one notice when the target goes idle (12 h expiry). Only the main conversation can subscribe.
- **Inbound (`crossSessionInbound`):** `accept`, `hold` or `refuse`. With no value set:
  - a prompting receiver (auto/manual) delivers, but holds messages from bypass senders;
  - a bypass receiver holds everything except messages from bypass senders.
- **Trust:** a message never counts as user consent. It cannot approve prompts or change configuration, and the receiver's permissions still apply.
- **Reach:** same-machine delivery uses a per-session socket (`CLAUDE_CODE_MESSAGING_SOCKET`). Other machines and the cloud need Remote Control.

## 4. Permission modes
- **Modes:** `default` (manual), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`.
- **`auto`:** the built-in start mode since v2.1.283. A classifier reviews actions. An approval relayed from another agent is untrusted.
- **`bypassPermissions`:** refused as root/sudo outside a recognized sandbox. Meant for isolated containers/VMs only.
- **Project settings:** `.claude/settings.json` cannot start sessions in `auto` or `bypassPermissions`. Use the CLI flag or user settings.
- **Deny rules:** they block in every mode.
- **Hooks:** a `PreToolUse` hook that exits 2 blocks even in bypass mode, but a hook that only returns `permissionDecision` is ignored in bypass mode.

## 5. Hooks essentials
- **Config:** `hooks.<Event>[].matcher` plus `hooks[]` of `{type: "command", command, timeout}`. `${CLAUDE_PROJECT_DIR}` is substituted in the command.
- **Shell:** bash by default. On Windows without Git Bash it is PowerShell (`"shell": "powershell"`).
- **Input:** JSON on stdin (`session_id`, `cwd`, `hook_event_name`, `tool_name`, `tool_input`, `prompt`, plus `agent_id`/`agent_type` inside subagents).
- **Scope:** hooks from settings also run inside subagents and teammates.

## 6. Project setup (what the orchestrator runs)
- **Launchers:** both are idempotent and print every step and window position. They set up the team with the shared `claude_team_install` (Linux) / `Invoke-ClaudeTeamInstall` (Windows), which also runs from dd.sh step 171 and dd.ps1 Step21.
  - `claudeagents`: agent-teams mode. Session `ca-orchestrator` in one window. Teammates are split panes on Linux and in-process on Windows.
  - `claudeteamup`: independent `ct-<role>` sessions that coordinate through cross-session messaging.
- **Permission mode:** `auto` for every role, root included.
- **Git:** blocked by `.claude/hooks/git_guard.mjs` (exit 2) in launcher sessions. The user's own prompt with `allow-git` / `允许git` grants it for 120 min; `deny-git` revokes.
- **Shared files:** `.claude/agents_shared/`.
- **Catalog:** `config/claude_team_roles.json`.

## 7. Orchestrator procedure
1. Record the user's task in docs_fix: a REQUIREMENTS doc or board rows.
2. Split it by role write scope; see the roles doc. Define cross-end contracts (`config/*_contract.json`) before the owners implement them.
3. Dispatch:
   - team mode: create tasks with dependencies, then spawn only the needed roles by agent type, named after the type;
   - sessions mode: SendMessage to `ct-<role>` with `notify_when_idle`.
4. Enforce the boundaries: one writer per path, and a shared-layer write needs your explicit assignment.
5. Send every finished task to `reviewer`, then mark it `done` on the board and synthesize for the user.
