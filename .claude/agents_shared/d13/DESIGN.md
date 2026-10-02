# D13 design: claudeagents / claudeteamup / claudeteam on the official configuration

Owner of this spec: orchestrator. Implementers: shell-windows (Windows, plus `.claude/settings.json` and `.claude/hooks/` as the temporary writer for D13) and shell-linux (Linux parity). Verdicts: reviewer.

Sources:
- the verified docs checks, in `docs_fix/DESIGN_AUTH_IDENTITY.md` and §12;
- the raw results, in the orchestrator scratchpad files `d10_gap.json` and `d13_round2.json`, which the orchestrator summarized here.

## 1. Where configuration lives (official)
- Role registry: `.claude/agents/*.md`.
  - Role names come from the frontmatter `name:`, not the filename.
  - Per-role `model:` (alias `opus` or `sonnet`) and `effort:` are already set by the orchestrator. `--agent <role>` sessions take the definition's model (docs: sub-agents, cli-reference).
- `config/claude_team_roles.json` (schema 6) holds launcher-only data: kickoff templates with placeholders, `layout`, `session_env`, `user_settings_merge`, `remote`, and `roles[]` as overrides only (`enabled`, `remote`).
  - An agent file without a catalog row is enabled.
  - `grid` is legacy: stop reading it; the orchestrator deletes it after this task.
  - The top-level `model` key was removed; there is one model definition per role, in its frontmatter.
- Environment per launch, not committed to project settings. The docs warn that a project-scoped `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` turns every named subagent in the repo into a teammate.
  - `session_env.all` goes to every local role session and the lead: `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, so the Task tools exist on Opus 5.5 and Sonnet 5, and `CLAUDE_CODE_TASK_LIST_ID=core-node-team`, the shared task list across independent sessions.
  - `session_env.lead` goes to the lead only: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
  - `session_env.windows` goes to Windows sessions: `CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT=1`, the Windows Terminal/ConPTY stale-text fix.
  - `session_env.remote` goes into the remote role's server command as tmux `-e` flags.
  - Set these after `Invoke-ClaudeOfficialRestore`, which strips some `CLAUDE_CODE_*` and `ANTHROPIC_*` values.
- `user_settings_merge` is merged into the user settings only when a key is absent: `%USERPROFILE%\.claude\settings.json` on Windows, `~/.claude/settings.json` on Linux. It is never overwritten, and it is done by `Invoke-ClaudeTeamInstall` and `claude_team_install`. The keys are `crossSessionInbound: accept`, needed because other launchers use bypass mode and hold messages from auto-mode senders; `agentPushNotifEnabled` and `inputNeededNotifEnabled` (push notifications through Remote Control); and `preferredNotifChannel: terminal_bell`, because Windows Terminal and gnome-terminal get no desktop notifications otherwise.
- Remote Control: `--remote-control <name>` per launch for the lead and every remote role. `remoteControlAtStartup` is honored only from user settings; do not rely on it.
- Hooks: `.claude/hooks/team_gate.mjs` takes the valid role tags from the `.claude/agents` frontmatter names (catalog `enabled:false` excludes one) instead of the catalog list. Optionally harden `.claude/settings.json` hook entries to the exec form (`"command": "node", "args": [...]`) so a shell profile echo cannot corrupt hook JSON. Keep the git-guard and team-gate behavior identical.

## 2. Starting every role with a window (both OSes, parity)
- The docs say split-pane teammates need tmux or iTerm2 and are not supported in Windows Terminal. Teammates cannot be pre-declared or auto-spawned. The only official way to give every role its own visible window on native Windows is independent sessions with cross-session messaging.
- Both `claudeagents` and `claudeteamup` therefore start:
  - the lead: `--agent orchestrator --name ca-orchestrator` for claudeagents and `ct-orchestrator` for claudeteamup, with `--remote-control` when a remote role is enabled, plus `session_env.lead`;
  - every enabled local role: `claude --agent <role> --name ct-<role> --effort <frontmatter effort> --permission-mode auto <kickoff>`, one session per role, each in its own pane, with `session_env.all` (plus `.windows` on Windows);
  - every remote role: the existing ssh loop, adding `--effort` and `session_env.remote` to the server command built locally (`Get-ClaudeTeamRemoteArgument` and the Linux `claude_team_remote_command`).
- The difference between the two launchers is the lead kickoff only. claudeagents uses `team.kickoff`: sessions for all roles, no teammate of a type that runs as a session, and ad-hoc in-process teammates only for unowned work. claudeteamup uses `sessions.kickoff_lead`.
- Idempotent: a role whose PID is alive is skipped.
  - After launch, verify every role's PID file. Reopen a missing role as a new tab in the named window, because WT silently drops a split that has no room.
  - The session-name collision rule applies: a live name makes a new session get a variant, so skip live roles.
- Placeholders to support: `{session}`, `{prefix}`, `{guide}`, `{record}`, `{shared}`, `{roles}`, `{lead}`, `{agents_dir}`, `{task_list}` (from `session_env.all.CLAUDE_CODE_TASK_LIST_ID`).

## 3. Layout at 1K/2K/4K (catalog `layout`)
Inputs:
- `min_lead` 100x30 and `min_role` 60x15 cells;
- `tab_groups`, with `merge_groups_when_room`;
- `window_name` (WT) and `tmux_session` (Linux).

Windows (Windows Terminal, official Microsoft docs):
- Measure per monitor from a thread switched to Per-Monitor-V2: EnumDisplayMonitors, GetMonitorInfo `rcWork`, and GetDpiForMonitor/GetDpiForWindow.
  - Windows PowerShell 5.1 is DPI-unaware, so `Screen.WorkingArea` is correct only at 100% scaling.
  - Do not call SetProcessDpiAwarenessContext.
  - Derive the cell budget from the physical work area and the font cell size at that DPI (default 12pt Cascadia: about 9x19 px at 96 DPI, scaled by dpi/96). If the DPI query fails, fall back to 1 tab per group.
- Pack the groups into tabs. Each tab holds as many consecutive groups as fit at the minimum sizes. The lead's tab gives the lead the largest pane.
  - A group that does not fit is split over more tabs.
  - Typical results: 1920x1080 at 100-125% gives about 5 tabs; 2560x1440 at 125-150% gives 3-4; 3840x2160 at 150% gives 2.
- One named window: `wt -w <window_name> -M --pos <rcWork.left+1>,<rcWork.top+1>` on the first call only. Use no `--size`, because pixel-per-cell differs by DPI. Maximized plus split fractions is DPI-independent.
  - Build tabs with `new-tab --title <role> --suppressApplicationTitle -d <root>`.
  - Build panes with `split-pane -V/-H --size <fraction>` for an equal grid: 0.8 → 0.75 → 0.6667 → 0.5 for 5 columns. Use `focus-pane -t <n>`, or `move-focus`, as the fallback.
  - `;` stays a standalone token. Build one argument string with explicit quoting, as Microsoft recommends for Start-Process.
- Keep every call under 32,767 characters. Pane commands are short (`powershell.exe -NoLogo -NoExit -File <abs claudeteam.ps1> --agent <role> --name ct-<role> ...`), and claudeteam.ps1 expands the kickoff from the catalog itself; no base64 kickoff on the wt command line.
  - If a layout is still too long, issue one `wt -w <name>` call per tab.
- Optional: an idempotent WT JSON fragment (per-user) with `core-node-lead` and `core-node-role` profiles. For example a 10pt role font at 4K, and fragment actions such as togglePaneZoom. Never edit the user's WT `settings.json`.
- Status/summary table:
  - Role, Session, Tab, Pane, PID, cells, State;
  - the measured monitor (px, DPI, cell budget);
  - `-Status` read-only.

Linux (tmux official docs; Debian 13 ships tmux 3.5a, Ubuntu 26.04 ships 3.6):
- One tmux session `layout.tmux_session` on the existing socket, with one tmux window per packed tab.
  - Build an explicit equal grid with `split-window -l <pct>%` (version-independent), because `tiled` gives 4x4 for 15 panes.
  - `pane-border-status top` with the role titles.
  - Session-scoped `set-hook after-split-window/after-select-layout/after-kill-pane` re-apply the grid. These are not window-scoped (`-w` is ignored for after-* hooks).
  - `allow-passthrough all` and `extended-keys` on, per the Claude terminal docs.
- Choose the grid from tmux `client_width`/`client_height` after attach, not from xrandr. Wayland (Ubuntu 26.04 GNOME is Wayland-only) cannot position windows.
- Open one maximized terminal attached to the session. Detect the terminal in this order:
  - ptyxis `--maximize` (the Ubuntu 26.04 default);
  - gnome-terminal `--maximize`;
  - konsole `--fullscreen` or a KWin rule;
  - xterm `-maximized`;
  - headless: `tmux attach` in the current tty.
- No teammate split panes are needed, because the roles are sessions. `team.teammate_mode_linux: tmux` stays for ad-hoc teammates.

### 3.1 Shared packing rule (orchestrator ruling after the r1 reviews, about 17:5x; binding on both OSes)
- One rule, in this order:
  1. **max area**: choose the grid (columns x rows per tab) that gives each role pane the largest area while keeping every pane at or above `min_role`, and the lead at or above `min_lead`;
  2. **column fill**: fill panes column by column;
  3. **lead-top fallback**: when the lead cannot get a full-height column at `min_lead`, it takes the top row of its tab.
- Windows records it in SPW-025 (switch from the previous rule), Linux in SPL-107 (add the lead-top fallback).
- Tab counts may still differ between the OSes for the same screen. Windows Terminal's pane chrome (borders, tab row, scrollbar) costs cells that tmux does not. That is platform-only: SPW-024 records it, with that reason.

### 3.2 One lead (both OSes)
- Only one orchestrator lead runs at a time. If the other launcher's lead is live (`ca-orchestrator` for claudeagents, `ct-orchestrator` for claudeteamup), the second launcher marks it `other-lead`, starts no second lead, and starts only the missing role sessions.
- A role counts as live only when its claude/node process is alive. A pane's `-NoExit` shell or a bash shell alone does not count. The PID file is removed when claude exits, and the launcher reopens roles that are not live.
- Linux records it in SPL-110 (aligned); Windows keeps its existing check.

## 4. Prerequisites (idempotent, repair only what is missing)
- Windows (`Invoke-ClaudeTeamInstall`):
  - node, git (Git Bash), Windows Terminal (winget; warn when older than 1.21), python;
  - the state, shared, reports, reviews and agent-memory directories;
  - the PATH entry;
  - the `user_settings_merge` keys.
- Linux (`claude_team_install`):
  - tmux (≥ 3.5 from the distro), python3, node, curl, ca-certificates;
  - a terminal, as detected above (install none; report which will be used);
  - the same directories and the `user_settings_merge` keys.
  - Keep `cci_check_remote_control_env` and add the Windows mirror of it (report-only: `ANTHROPIC_BASE_URL`, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_GROWTHBOOK`, `isolatePeerMachines`, `disableRemoteControl`).
- Claude Code itself: the existing `Invoke-AiCliProvision` / `ai_cli_provision`; unchanged.

## 5. Parity (B11)
- Every item above has an SPW row in `shell_parity/windows.md` and an aligned row in `shell_parity/linux.md`, or a platform-only reason: the WT DPI query is Windows-only; the terminal detection and Wayland handling are Linux-only.

## 6. Verification (allowed; the user asked for the launch)
- Static: the PowerShell parser for every changed `.ps1`, `bash -n` and shellcheck when present, `node --check` for the hooks.
- `-Status` / `--status` dry runs print the plan (monitors, tabs, panes, commands) without opening windows.
- Do not launch the full team in this task. The orchestrator launches it after the review, because the running workflows live in the current lead session.
