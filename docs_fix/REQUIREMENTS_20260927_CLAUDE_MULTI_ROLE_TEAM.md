# Claude Code Multi-Role Team — Requirements, Roles, Launcher Design

Date: 2026-09-27
Status: binding requirement list (roles and tasks are a first draft; the user
will revise them)
Scope: `.claude/agents/`, `config/claude_team_roles.json`,
`scripts/linuxenvs/claudeteamup.sh`, `scripts/winenvs/claudeteamup.ps1`,
`scripts/shells/linux/common/claude_team_common.sh`,
`scripts/shells/win/win_common/ClaudeTeamCommon.ps1`,
`docs_fix/TASK_20260927_CLAUDE_TEAM_BOARD.md`.
Builds on: `scripts/linuxenvs/claudeteam.sh`, `scripts/winenvs/claudeteam.ps1`
(agent teams, provisioning, ultracode prompt). Those launchers are unchanged.

## 1. Claude Code facts used (v2.1.283, verified with `claude --help`)

- Project subagents live in `.claude/agents/<name>.md` (frontmatter `name`,
  `description`, optional `tools`, `model`). User scope is `~/.claude/agents/`.
- `claude --agent <name>` runs a whole session as that agent.
  `claude --agents '<json>'` injects session-only agents.
- `-n/--name <name>` sets the session display name. Local sessions can address
  each other by that name (ListAgents / SendMessage).
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` enables agent teams. `claudeteam`
  always sets it.
- `/agents` (in session) and `claude agents` manage agents.
- `-w/--worktree` gives a session its own git worktree. It is not used by
  default (AGENTS.md: no git operations unless asked). Roles avoid write
  conflicts by directory ownership instead.

## 2. Role count: 7

Derived from the 107 `docs_fix` documents. They cluster into these domains:
relay/RPC/codesync/terminal control/agent history (pycore runtime);
audio orchestration/queues/TTS engines/GPU toolchain (audio);
queue center/data sync/Mercure/CodeMart server (Laravel); pycore-manager/
wordnew/CodeMart UI/mcp-chrome (UI); installers/nginx/FrankenPHP/SSH/Windows
(shell). Coordination and review are separate roles.

| # | Role | Owns (write scope) | Main docs |
|---|---|---|---|
| 1 | `lead` | `docs_fix/`, `config/*.json` contracts, task board | all; board |
| 2 | `pycore-runtime` | `pycore/` except TTS/audio, `ncore/`, `pymain.py`, `pyservice.*` | relay V2, A7A*, terminal Wayland, agent history, prompt derive, codesync, delivery layer (W4/R8) |
| 3 | `audio-tts` | `pycore/pyutils/tts/`, `pycore/pyctl` audio orchestration and lanes, TTS engine code | audio orch 0926/0927, queue head, word audio offline, TTS plan, GPU toolchain |
| 4 | `laravel-backend` | `poly_apps/laravel_main/` | queue center, dict lane, data sync P5, Mercure/FrankenPHP API, CodeMart server, W5 |
| 5 | `frontend-ui` | `poly_apps/pycore_laravel_wordnew_ui/`, `apps/mcp-chrome/` | CodeMart UI, wordnew W6, pycore-manager pages, i18n |
| 6 | `infra-shell` | `scripts/`, `dd.sh`, `dd.cmd` | DD guide, nginx/FrankenPHP, SSH, TTS Docker, Python 3.10 installers |
| 7 | `reviewer` | read-only; writes only review notes in `docs_fix` | all REQUIREMENTS docs, AGENTS.md rules, contracts |

Rules for every role:
- AGENTS.md and the matching `development-guides/*.md` apply.
- A role edits only its write scope. A change outside it goes to the owner
  through the board or a message to `ct-<owner>`.
- Cross-end contracts (`config/*_contract.json`) change only through `lead`.
- No git operations, no tests, no builds or services unless the user asks.

## 3. Launcher requirements

- R1 One entry per OS: `claudeteamup` (Linux: `scripts/linuxenvs/claudeteamup.sh`,
  Windows: `scripts/winenvs/claudeteamup.ps1`). The logic lives in one shared
  library per OS in the existing common dirs.
- R2 One role catalog, `config/claude_team_roles.json`. It holds role order,
  grid layout, session prefix, tmux socket, kickoff prompt, and doc paths.
  Both OS entries read it. Prompts live only in `.claude/agents/*.md`.
- R3 Idempotent install. Only missing items are installed:
  - Claude Code through the existing `ai_cli_provision` /
    `Invoke-AiCliProvision`.
  - Linux (apt, Debian 13 / Ubuntu 26.04 / Kali): `python3`, `tmux`, and
    `x11-xserver-utils` when graphical. It also installs a geometry-capable
    terminal (`xfce4-terminal`) when none of xfce4-terminal/konsole/xterm
    exists.
  - Windows: Windows Terminal through winget when `wt.exe` is missing. Without
    it, the fallback is a console window moved by Win32 `MoveWindow`.
- R4 Idempotent start. Re-running skips what already runs:
  - Linux: each role is a detached tmux session `ct-<role>` on socket
    `-L claudeteam`. An existing session is skipped. A window opens only for a
    session with no attached client.
  - Windows: each role window writes its shell PID to
    `%LOCALAPPDATA%\core_node\claude_team\<role>.pid`. A live PID skips the
    role.
- R5 Parallel windows in a grid (default 4×2, slot = catalog order):
  - Linux X11 and Xwayland: `--geometry`, with the X11 backend forced on
    Wayland (`GDK_BACKEND=x11`, `QT_QPA_PLATFORM=xcb`).
  - Native-Wayland-only terminals (gnome-terminal, Ptyxis) open unpositioned,
    and this is reported.
  - Headless or SSH: no windows. The attach commands are printed.
  - Windows: `wt.exe -w new --pos --size`.
- R6 Every step prints its number, action, result (`OK`/`SKIP`/`INSTALL`/
  `START`/`OPEN`/`WARN`), and the resolved paths. The script ends with a table:
  role, session, session state, window state, pixel position and size,
  terminal cols×rows, and attach command. `--status` prints the same table
  and changes nothing.
- R7 Each role session runs the existing `claudeteam` launcher with
  `--agent <role> --name ct-<role>` and the catalog kickoff prompt.
  `--no-kickoff` omits the prompt.
- R8 Options: `--status`, `--no-windows`, `--roles a,b`, `--no-kickoff`.
  PowerShell uses the `-Status`, `-NoWindows`, `-Roles`, `-NoKickoff` switches.
- R9 A missing agent file disables only that role, with a warning. The
  launcher never generates prompts.

## 4. Acceptance

- A1 On a first run, a fresh Debian 13 GNOME Wayland desktop gets 7 tmux
  sessions and 7 positioned xfce4-terminal windows. Each window shows
  `claude --agent <role>`.
- A2 A second run starts nothing and opens nothing: every row is `SKIP`.
- A3 Close one window and re-run: only that window reopens. The session
  survives, so there is no new Claude session.
- A4 Over SSH, the sessions start and the attach commands are printed.
- A5 On Windows, 7 Windows Terminal windows open in the grid. A re-run skips
  the live roles.

## 5. Implementation record (2026-09-27)

- Added the files listed in Scope, plus seven agents under `.claude/agents/`.
- Static checks only:
  - `bash -n` on both shell files;
  - `json.tool` on the catalog;
  - the PowerShell parser on both .ps1 files (0 errors);
  - `xfce4-terminal --help` confirms `--disable-server`, `--geometry` and `-x`;
  - tmux 3.5a supports `new-session -e`.
- Not run: no launcher execution, installs, or services (AGENTS.md).

## 6. Round 2 requirements (user directive, 2026-09-27)

Sources: the official docs, read 2026-09-27:
- `code.claude.com/docs/en/agent-teams`
- `/permission-modes`
- `/cross-session-messaging`
- `/hooks`

Changes to the earlier sections:
- §3 R7 is superseded: roles now always run in `bypassPermissions`.
- §3 R1 is extended: there are two entry points instead of one.

- R10 **Two launchers, one shared library per OS.**
  - `claudeteamup` (kept) runs independent sessions `ct-<role>`. They
    coordinate through **cross-session messaging**:
    - `ListAgents` discovers sessions and `SendMessage` addresses them by
      `--name`;
    - the dispatcher `ct-lead` subscribes with `notify_when_idle`.
  - `claudeagents` (new) runs one lead session `ca-lead` in the official
    **agent teams** mode:
    - The lead spawns the other roles as teammates. Each teammate is spawned
      from its `.claude/agents/<role>.md` definition and named after the role.
    - The team uses the shared task list, the mailbox and plan approval.
    - Linux uses `--teammate-mode tmux` (split panes in one full-screen window).
    - Windows uses `in-process`, because Windows Terminal has no split panes.
- R11 **Full permissions for every role, root included.**
  - Sessions start with `--permission-mode bypassPermissions
    --dangerously-skip-permissions`.
  - As root, the launcher exports `IS_SANDBOX=1`. That is the check Claude Code
    applies before refusing bypass mode for root.
  - The one-time bypass acceptance (`skipDangerousModePermissionPrompt`) is
    ensured in the user settings.
  - Teammates inherit the lead's mode (official).
  - Cross-session messages between bypass sessions are delivered without a
    dialog (official inbound default).
- R12 **No git for any role unless the user's prompt asks for it.**
  - Project hook `.claude/hooks/git_guard.mjs` (Node, exec form, so it works
    on Linux and Windows).
  - `PreToolUse` on Bash/PowerShell blocks `git`/`gh` with exit code 2. A
    `permissionDecision` is ignored in bypass mode; exit 2 still blocks.
  - `UserPromptSubmit` grants git for `GIT_GRANT_TTL_MINUTES` when the user's
    prompt contains `允许git` or `allow-git`. `禁止git` or `deny-git` revokes
    the grant. The grant file is `.claude/agents_shared/git_grant.json`.
  - The guard is active only in launcher sessions (`CLAUDE_AGENTS_GIT_GUARD=1`,
    which is also set as tmux session env, so split-pane teammates inherit it).
  - `includeGitInstructions: false` in the project settings.
- R13 **Shared data.**
  - Agent teams: the official task list `~/.claude/tasks/<team>/`, the mailbox
    `~/.claude/teams/<team>/inboxes/`, and the member list
    `~/.claude/teams/<team>/config.json`.
  - All modes share the project directory `.claude/agents_shared/`, created
    idempotently: artifacts, handoff notes, the git grant.
  - The durable record stays in the docs_fix board.
  - Messages carry text only, never files (official). Hand files over as paths
    in `.claude/agents_shared/`.

### Round 2 status (2026-09-27, final)

- R11 revised by the user: **every role runs in `auto` permission mode**, root included.
  - `claudeteam.sh` and `claudeteam.ps1` pass `--permission-mode auto`. Teammates inherit it. Auto needs no root exception.
  - The requested `IS_SANDBOX=1` export (root bypass) was refused twice by the Claude Code auto-mode classifier and is **not implemented**. It is not needed for auto mode.
  - Cross-session delivery: auto sessions deliver messages from other non-bypass sessions without a dialog (official inbound default).
- R10 implemented:
  - The shared libraries (`claude_team_common.sh`, `ClaudeTeamCommon.ps1`) take a mode:
    - `sessions`: `claudeteamup`, 7 `ct-<role>` sessions, 4×2 grid, cross-session messaging kickoffs;
    - `team`: `claudeagents`, one `ca-lead` session (tmux socket `claudeagents`, full-screen window), `--teammate-mode tmux` on Linux and in-process on Windows. The lead spawns teammates from `.claude/agents`.
  - Catalog v2: `config/claude_team_roles.json` with `permission_mode`, `shared_dir`, `sessions.*` and `team.*`.
  - Entries: `scripts/linuxenvs/claudeagents.sh` and `scripts/winenvs/claudeagents.ps1`.
  - Windows PID files are per mode: `<mode>-<role>.pid`.
- R12 implemented:
  - `.claude/hooks/git_guard.mjs` and `.claude/settings.json`.
  - The guard is enabled by `CLAUDE_AGENTS_GIT_GUARD=1`, which comes from `claudeteam.sh`/`.ps1` and the tmux session env.
  - Regex dry-run: blocks `git`, `/usr/bin/git`, `git.exe` and `gh`; passes `digit` and `gitignore`.
- R13 implemented:
  - `.claude/agents_shared/` is created idempotently.
  - The summary prints the official team task list, mailbox and config paths.
- Agent files carry the two-mode coordination rules. `reviewer` gains the SendMessage/ListAgents/Task tools and no longer uses git.
- Static checks:
  - `bash -n` on all shell files;
  - PowerShell parser: 0 errors in 4 files;
  - `json.tool` on the catalog;
  - `node --check` on the hook.
- Not run: the launchers themselves.

### Round 3 — idempotent install of the team prerequisites (2026-09-27)

Finding: the canonical Claude install workflow did not install the team
prerequisites. That workflow is `scripts/ai_shtools/claude_code_install.sh`,
reached from dd.sh step 171 and from `ai_cli_provision`. It checked only the
native installer's prerequisites (curl, sha256sum, CA bundle) and linked only
`claudeteam`. So a fresh dd.sh install lacked three things:
- tmux: required for split-pane teammates per the official agent-teams docs, and
  for both launchers;
- node: the git guard hook needs it; without node the hook cannot run and git
  is not blocked;
- the `claudeteamup` and `claudeagents` commands.

Fix (one implementation):
- `claude_code_install` is now 4 steps.
  - `cci_ensure_team_prereqs` installs only the missing items among `tmux` and
    `nodejs`, through the existing multi-package-manager `cci_pkg_install`.
  - `cci_setup_claudeteam` links `claudeteam`, `claudeteamup`, `claudeagents`
    and their `.sh` aliases.
- `claude_team_common.sh` calls both functions on every run (idempotent), so
  sessions where claude was already installed converge too. The launcher's own
  duplicate tmux/node/link code was removed.
- Windows: `ClaudeTeamCommon.ps1` installs Node.js LTS via winget when `node`
  is missing. The scripts are already on PATH through `winenvs`, and
  in-process teammates need no tmux.
- Static checks: `bash -n` passes, and the PowerShell parser reports 0 errors.

### Round 4 — one shared team-setup script, finest-grained idempotency (2026-09-27)

User directive:
- The same script sets up the team, whether dd.sh installs it or claudeagents or claudeteamup starts.
- Idempotency is per smallest item.

Linux: `claude_team_install` in `scripts/ai_shtools/claude_code_install.sh`.
- Callers:
  - `claude_code_install` STEP 3/3 (dd.sh step 171 and `ai_cli_provision`);
  - `claude_team_common.sh` STEP 2 on every launcher run.
- The launcher's own install code (`apt_ensure`, link, shared dir) was removed.
- Units:
  - `cci_ensure_binary` covers one binary: python3, tmux, node, and on graphical sessions xrandr plus a geometry-capable terminal.
  - `cci_ensure_dir` covers `.claude/agents_shared`.
  - `cci_link_into_bin` covers one link each for `claudeteam`, `claudeteamup` and `claudeagents`, plus their `.sh` aliases.
- Every unit prints `[SKIP]`, `[INSTALL]`/`[OK]`/`[WARN]` or `[MISSING]`.
- `CCI_CHECK_ONLY=1` (used by `--status`) reports without changing anything.
- Verified read-only on this host: all 12 items `[SKIP]`.

Windows: `Invoke-ClaudeTeamInstall` in `scripts/shells/win/win_common/ClaudeTeamInstallCommon.ps1`.
- Callers:
  - dd.ps1 Step21, as a `command` callback in the ClaudeCode `PostInstallCallbacks`. It runs whenever claude is present.
  - `ClaudeTeamCommon.ps1` STEP 2.
- Units: node, Windows Terminal (winget), state dir, shared dir, and the `winenvs` PATH entry.
- `-CheckOnly` reports without changing anything.
- The state-dir constant lives only in the install script.
- The PowerShell parser reports 0 errors on all touched files.
