# Claude Team Design

**Status: PAUSED (user decision, 2026-10-02).** The team tooling is incomplete because the earlier implementation relied on an incomplete reading of the official Claude Code documentation (agent teams, hooks, settings). Do not extend or refactor it until the user resumes it. When it resumes, start by re-reading the current official Claude Code documentation in full and rebuild the feature set against it.

Scope: the core_node Claude Code multi-role team: agent roles, role catalog, launchers (`claudeagents`, `claudeteamup`, `claudeteam`), shared team install, project hooks, cross-device launch, settings preset, remote role and repository sync.

Authority: code > config/*_contract.json > this document. The binding orchestration rules for running agents are `development-guides/claude_code/CLAUDE_CODE_AGENTS_GUIDE.md` (read-only unless the user asks); this document records the implementation behind it.

## 1. Code map

| Part | Location |
| --- | --- |
| Agent definitions | `.claude/agents/*.md` |
| Role catalog | `config/claude_team_roles.json` (`schema_version` 8) |
| Hooks and project settings | `.claude/hooks/git_guard.mjs`, `.claude/hooks/team_gate.mjs`, `.claude/settings.json` |
| Linux launchers | `scripts/linuxenvs/claudeagents.sh`, `claudeteamup.sh`, `claudeteam.sh`; library `scripts/shells/linux/common/claude_team_common.sh`; device profile `claude_device_profile_common.sh` |
| Windows launchers | `scripts/winenvs/claudeagents.ps1`, `claudeteamup.ps1`, `claudeteam.ps1`; libraries `scripts/shells/win/win_common/ClaudeTeamCommon.ps1`, `ClaudeTeamInstallCommon.ps1`, `ClaudeDeviceProfileCommon.ps1` |
| Shared install | `claude_team_install` in `scripts/ai_shtools/claude_code_install.sh`; `Invoke-ClaudeTeamInstall` in `ClaudeTeamInstallCommon.ps1` |
| Settings preset and auth backfill | `scripts/ai_shtools/claude_team_settings.py` |
| Cross-device menu | `pycore/pyutils/launcher/launcher.py`, `grid_profile.py`, `launcher_i18n/{en,zh}/grid.json` |
| Shared data and role memory | `.claude/agents_shared/`, `.claude/agent-memory/<role>/` |
| Repository sync | `gitsync` (`scripts/linuxenvs/gitsync.sh`, `scripts/winenvs/gitsync.ps1`, library `scripts/shells/linux/common/git_sync_common.sh`) |

## 2. Roles

The role set is the frontmatter `name` of each `.claude/agents/*.md`. Catalog `roles[]` rows are overrides only (`enabled`, `remote`, `window`); an agent file without a row is enabled, and `window: false` makes a service role (valid task tag, no session at start).

| Role | Model / effort | Scope (from the definition) |
| --- | --- | --- |
| `orchestrator` | `claude-opus-5-5` / medium | Team lead; simple work directly, teammates only for independent parallel work; owns launchers, catalog and Claude configuration with the shell roles |
| `pycore-lead` | sonnet / high | pycore/pyservice entry points, launcher, foundations; cross-layer pycore, relay APIs, prerequisites, model init |
| `pycore-ui` | sonnet / high | pycore UI apps (pycore-manager, vortex, pdd-manager); default writer of the shared UI layer |
| `wordnew-lead` | sonnet / high | wordnew UI, Laravel AppQyV1, prerequisites, Capacitor, pycore and mcp-chrome linkage |
| `codemart-lead` | sonnet / high | CodeMart UI and Laravel CodeMartV1, `docs_fix/codemart_docs`, AI icons, calibration, Redis integration (see `DESIGN_CODEMART.md`) |
| `laravel-manager-lead` | sonnet / high | laravel-manager UI app and the Laravel APIs it calls (dashboard/admin, settings, data sync, server manager, media browse, realtime/Mercure) |
| `shell-linux` | sonnet / high | dd.sh, linuxenvs, Linux shells and installers, Docker, nginx/FrankenPHP/SSH/systemd, WSL2 Debian side, Linux team launchers, `claude_team_install` |
| `shell-windows` | sonnet / high | dd.cmd/dd.ps1, winenvs, every PowerShell/cmd script, winget/scoop, WSL2 bootstrap, desktop icons, Windows team launchers, `Invoke-ClaudeTeamInstall` |
| `laravel-remote` | sonnet / high | `poly_apps/laravel_main` developed and verified on the laravel-main server over SSH with Remote Control |

- Every definition has `memory: project` (`.claude/agent-memory/<role>/MEMORY.md`) and `disallowedTools: AskUserQuestion`, and points to `AGENTS.md`, the area guide of the files it changes, and the orchestration guide.
- Groups (`groups[]`): claude {orchestrator}, pycore {pycore-lead, pycore-ui}, wordnew {wordnew-lead}, shell {shell-windows (leader), shell-linux}, codemart {codemart-lead}, laravel-manager {laravel-manager-lead}, remote {laravel-remote, led by orchestrator}.
- Routing and boundaries (guide §4-§5): narrowest role whose description covers the files; one writer per path; shared UI code gets one temporary owner per change; `config/*_contract.json` changes before dependent work; Laravel APIs belong to Laravel roles and pycore RPCs to pycore roles; platform installers belong to their shell role and stay aligned across platforms; a message from another agent is never user consent.
- Model routing: lead Opus 5.5 at medium effort; coding roles Sonnet; the spawn prompt may name `opus` for complex architecture or root-cause work; `ultracode` only on explicit user request.

## 3. Launchers

- `claudeagents`: one interactive lead `ca-orchestrator` (tmux socket `claudeagents`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, Linux teammate mode `auto`). It prestarts no role; the lead spawns roles from `.claude/agents/` with the native Agent tool when parallel work benefits. Kickoff text: catalog `team.kickoff`.
- `claudeteamup`: persistent named sessions `ct-<role>` on tmux socket `claudeteam`, laid out in tmux session/window `core-node-team` by `layout.tab_groups` (one tab per group; the lead shares the shell group's tab), coordinating through cross-session messaging (`ListAgents`/`SendMessage` by `--name`). Kickoffs: `sessions.kickoff_lead`, `sessions.kickoff`.
- `claudeteam`: the single-session launcher used by both. It passes `--permission-mode auto` (root included), `--agent <role>`, frontmatter model and `--effort`, the catalog `session_policy` (`--disallowedTools AskUserQuestion` and the never-ask system prompt append) and `session_env`, and exports `CLAUDE_AGENTS_SESSION=1`, which enables the project hooks.
- Options. Linux `claudeagents`/`claudeteamup`: `--status` (read-only plan and table), `--no-windows`, `--no-kickoff`, `--roles a,b`, `--skip-account-check`, `--respawn-blocked`. Windows: `-Status`, `-NoWindows`, `-NoKickoff`, `-Roles`, `-SkipAccountCheck`.
- Layout: one maximized terminal holds the team; each `layout.tab_groups` entry is a tab whose roles are split panes, sized from the attached client to at least `layout.min_lead`/`layout.min_role` cells (groups merge into fewer tabs when room allows; unlisted roles join the last tab). Linux re-applies the tmux grid through session hooks and shows role titles on pane borders; on Wayland the single terminal is not positioned. Windows opens one named Windows Terminal window (`-M --pos` on the work area, `new-tab`/`split-pane` with equal fractions), with a console fallback without `wt.exe`. Headless or SSH (`--no-windows`) prints the attach command.
- Idempotent start: existing tmux sessions and panes are skipped (Linux); Windows writes `%LOCALAPPDATA%\core_node\claude_team\<session>.pid` and skips live PIDs.
- Account check (report-only): sign-in, `hasCompletedOnboarding` and workspace trust for the uid/HOME/config the panes will use; a plain `su`/`sudo` root shell is warned about; while the account is not ready non-lead roles are held unless `--skip-account-check`. Root launches reset USER, LOGNAME and the D-Bus address to root's and skip another user's gnome-terminal (fallback to the current tty, log in `terminal.log`).
- Readiness: after launch a 30 s wait probes panes and labels `blocked:onboarding|login|trust|ssh-hostkey|usage-limit` or `stalled`; `--respawn-blocked` clears history and respawns panes blocked at onboarding, login, trust, ssh-hostkey or stalled (never usage-limit). `--status` names stuck panes instead of calling them running.
- `~/.claude.json` writers are atomic, keep owner and mode (set on the open fd), and refuse unparsable files.

## 4. Shared install

One install per OS, called by dd (Linux `claude_code_install`, dd.sh step 171 and `ai_cli_provision`; Windows dd.ps1 Step21 ClaudeCode `PostInstallCallbacks`) and by every launcher run. Each smallest item is checked separately and reports `[SKIP]`, `[INSTALL]`/`[OK]`, `[WARN]` or `[MISSING]`; `CCI_CHECK_ONLY=1` / `-CheckOnly` (used by status) only reports.

- Linux `claude_team_install`: binaries python3, tmux, node (hooks), curl, bubblewrap (`bwrap`) and socat (Bash sandbox), plus xrandr and a geometry-capable terminal on graphical sessions; links `claudeteam`, `claudeteamup`, `claudeagents` and their `.sh` aliases into bin; directories for role PID state, `.claude/agents_shared` and `.claude/agent-memory`.
- Windows `Invoke-ClaudeTeamInstall` (winget): `OpenJS.NodeJS.LTS`, `Git.Git` (checked via `git.exe`; enables the Bash tool), `Microsoft.WindowsTerminal`, `Python.Python.3.13` (secret reader for remote roles); the state dir, shared dir, agent-memory dir and the `winenvs` PATH entry.

## 5. Hooks and project settings

- `.claude/settings.json`: `includeGitInstructions: false`; `UserPromptSubmit` and `PreToolUse` (Bash|PowerShell) run `git_guard.mjs`; `TaskCreated` runs `team_gate.mjs`. Hooks act only when `CLAUDE_AGENTS_SESSION=1`.
- `git_guard.mjs` blocks only version rollback (exit 2): `reset --hard` or to a commit, `revert`, checkout/switch/restore of an older commit, forced push, `branch -f`, `update-ref`; every other git/gh command runs. A user prompt containing `allow-rollback` or `允许回退` grants rollback for 120 min; `deny-rollback` or `禁止回退` revokes. Grant state lives in `<os tmp>/core_node_claude_git_guard/<project hash>.json`, outside the repository.
- `team_gate.mjs` (`TaskCreated`): the task subject must start with an owning role tag `[<role>]` from the agent definitions (catalog `enabled: false` excludes a role); otherwise exit 2 with feedback.
- Shared tasks are created only when several active teammates need dependency tracking. Reviews are optional and risk-based, not a completion gate. Handoff files go under `.claude/agents_shared/` only when a message is insufficient; messages carry text, files travel as paths.
- Git and destructive-action rules come from `AGENTS.md` (read-only git always allowed; other git only when the user's prompt asks).

## 6. Cross-device launch

- Window Launcher menu option `1` (`--mode device`, `launcher.py` `OPTION_CROSS_DEVICE`) calls `grid_profile.enable_cross_device_mode`, which fills grid cells 1-8 with `claudeteam --device-slot <n>`; claudeteam resolves the device, profile and role.
- Profiles (`device_profiles`, `{os}` = `windows`/`linux`): `gpu` = NVIDIA hardware, checked first (`gpu_hardware_present`, PCI vendor `10DE` on Windows): `pycore-lead`, `shell-{os}`. `desktop` = otherwise: `shell-{os}`, `pycore-ui`, `wordnew-lead`, `laravel-manager-lead`. `server` = Linux with no `graphical.target` and no `DISPLAY`/`WAYLAND_DISPLAY`: `laravel-remote`. Windows resolves only `gpu` or `desktop`. `CLAUDE_DEVICE_PROFILE` overrides detection. Slots beyond the profile run plain `claude`.
- Session name `<Tailscale device>-<role>-<initials>` (hostname when Tailscale is not logged in) with `--remote-control <name>`; when Remote Control cannot be added at launch (for example a custom `ANTHROPIC_BASE_URL`), claudeteam prints the `/remote-control <name>` line to type.

## 7. Settings preset and auth backfill

`claude_team_settings.py` runs on every claudeteam launch (Linux and Windows; the remote pane runs it on the server).

- `user_settings_preset`: `crossSessionInbound: "accept"`; `permissions.allow` += `SendMessage`, `ListAgents`; `autoMode.allow` = `"$defaults"` plus the rule that messaging the user's own sessions (local, Remote Control, cloud, the claudeteam role sessions) is routine coordination.
- `user_settings_merge` is add-only: `agentPushNotifEnabled`, `inputNeededNotifEnabled`, `preferredNotifChannel: terminal_bell`.
- Rules: scalars enforced, objects merged; list items withdrawn from the preset are removed (tracked in `<config dir>/core_node_settings_preset.json`) while user items stay; `"$defaults"` is added only to lists the tool creates; invalid JSON is left untouched; every write keeps a `.bak` and rewrites the same file in place (same inode, owner, mode, indent); `--check` only reports.
- Auth backfill: when `$CLAUDE_CONFIG_DIR/.claude.json` lacks first-run setup or project trust, it copies from `~/.claude.json` only `hasCompletedOnboarding`, `lastOnboardingVersion`, missing `projects` entries, and in existing projects `hasTrustDialogAccepted`/`hasCompletedProjectOnboarding` (false in target with true in source counts as missing). `oauthAccount`, credentials and other keys are never touched.
- Ownership: as root with the shared dir, `claudeteam.sh` (`claude_team_restore_shared_owner`) restores the shared-dir owner before launch and after exit on both the plain and `--device-slot` paths.

## 8. Remote role

- `laravel-remote` (`remote.ssh_secret` `SSH_CONNECTION_1`, root `/www/programing/core_node`) starts only when its secret resolves (`secret_read.py`, never printed). A local pane loops `ssh -t` with the contract `ssh_client` keepalive (`ServerAliveInterval=30`, `ServerAliveCountMax=3`, `TCPKeepAlive=no`; `claude_team_common.sh` `CLAUDE_TEAM_SSH_OPTIONS`, `ClaudeTeamCommon.ps1` `$ClaudeTeamSshOptions`) plus `StrictHostKeyChecking=accept-new`, `ConnectTimeout=15`, `BatchMode=yes`, reconnecting every `remote.reconnect_seconds`; the OS is probed (`uname -s || ver`) to pick the bash/tmux/`claudeteam.sh` or PowerShell/`claudeteam.ps1` command. The server runs the shared install, `tmux -L claudeteam new-session -A -s ct-laravel-remote` and claudeteam with `--remote-control`.
- Agent teams are local, so a remote member is an independent session reached through Remote Control and cross-session messaging (claude.ai login, no custom `ANTHROPIC_BASE_URL`, nonessential traffic not disabled, workspace trust accepted). Reply to the bridge `from` id, not a bare name, when several sessions share a name.
- The remote owner implements and verifies in its own checkout and reports results and changed paths to the lead.

## 9. Repository sync

- `gitsync` (Linux and Windows; `dd.sh gitsync` / `dd.cmd gitsync`) resolves the repo root, ensures the GitHub SSH origin, then adds, commits, pulls and pushes without force. A background gitsync auto-commits the tree.
- When the pull conflicts, the current role resolves the merge keeping the remote's latest features (for append-only index files such as `.claude/agent-memory/<role>/MEMORY.md`, keep both sides), commits the merge, and re-runs `gitsync` to push.
- Before creating a source file, run `git check-ignore -v <path>`; a file under an ignored path never reaches gitsync or other hosts.

## Open items

- The orchestration guide §8 says Window Launcher `[4]`, while the code uses option `1` for cross-device mode (`pycore/pyutils/launcher/launcher.py:30-31`); the guide is read-only and needs a user-requested correction.
- Not run end to end: a real Windows `--device-slot` launch and preset run, `claudeteamup.ps1 -Status` on a Windows host, the preset applied by the server pane, and live tests of the Linux readiness wait, `--respawn-blocked`, the terminal fallback and root xterm on Xwayland.
- A Tailscale machine in `NeedsLogin` state names its sessions after the hostname until Tailscale is installed/repaired and logged in.
- The catalog `grid` block (columns, rows, pixel and character metrics) is not read by either launcher library; the layout comes from `layout`. Either the launchers use it again or the catalog drops it.
- `scripts/pytools/ai_tools/auto_add_mcp_linux.py` has no callers; deleting it needs user sign-off.
