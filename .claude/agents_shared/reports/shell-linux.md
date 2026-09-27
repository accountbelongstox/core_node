# shell-linux handoff report

## shell-linux-3: D12b Linux side (docker model runner, model definitions, Debian 13 WSL ensure)

- Status: in progress (runs below), awaiting reviewer.
- Record: docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md §1 D12, §11.

### Changed files

- `scripts/shells/linux/common/tts_docker_compose_common.sh` (rewritten; the lifecycle library)
- `scripts/shells/linux/debian/install_shells/docker_model_runner.sh` (new CLI)
- `scripts/shells/linux/debian/install_shells/apply_tts_docker_for_engine.sh` (thin wrapper: runner ensure, then up)
- `scripts/shells/linux/debian/install_shells/139_install_melotts.sh`, `143_install_fishspeech.sh` (docker branch)
- `scripts/shells/docker_compose/tts/melotts/{model.sh,Dockerfile,compose.yml}`
- `scripts/shells/docker_compose/tts/fishspeech/{model.sh,Dockerfile,compose.yml}`
- `.claude/agents_shared/shell_parity/linux.md` (new ledger)

### Runs

(filled in below)

## shell-linux-1: D13 Linux launchers on the official configuration (parity with shell-windows-1)

- Status: done, awaiting reviewer (the task stays in progress until the verdict). The team was not launched.
- Spec: `.claude/agents_shared/d13/DESIGN.md` §1-§6. Record: `docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` §12.
- Not touched: `.claude/settings.json`, `.claude/hooks/` (shell-windows holds them for D13; Linux needs no change there), `config/claude_team_roles.json`, `.claude/agents/`.

### Changed files

- `scripts/shells/linux/common/claude_team_common.sh`: rewritten.
- `scripts/linuxenvs/claudeteam.sh`: rewritten (role pane contract, session_env, `--effort`, kickoff, PID file, remote loop).
- `scripts/linuxenvs/claudeagents.sh`, `scripts/linuxenvs/claudeteamup.sh`: header and help text only (options unchanged).
- `scripts/ai_shtools/claude_code_install.sh`: `claude_team_install` prerequisites, terminal report, state dir, `user_settings_merge`.
- `scripts/shells/linux/debian/install_shells/171_install_claude_code.sh`: one comment line (what `claude_team_install` does).
- `.claude/agents_shared/shell_parity/linux.md`: rows SPL-101 to SPL-112 appended.

### What the Linux side does now

1. Roles (§1): `.claude/agents/*.md` frontmatter `name`/`model`/`effort`, with catalog rows as overrides (`enabled`, `remote`). `grid` is no longer read, so the orchestrator can delete it.
2. Sessions (§2): both launchers start every enabled role as its own session, each in a pane of one tmux session.
   - The lead: `ca-orchestrator` with `team.kickoff` (claudeagents), or `ct-orchestrator` with `sessions.kickoff_lead` (claudeteamup).
   - Every other role: `ct-<role>` with `sessions.kickoff`.
   - Pane command: `claudeteam.sh --team-pane <mode> --agent <role> --name <session> [--remote-control <lead>] [--team-roles a,b] [--team-no-kickoff]`. These are the claudeteam.ps1 names.
   - claudeteam.sh does the rest itself, in this order:
     1. writes `<state>/<session>.pid`, where state is `${XDG_STATE_HOME:-~/.local/state}/core_node/claude_team` (exec keeps the PID);
     2. applies session_env;
     3. adds `--effort <frontmatter>` (the lead also gets `--teammate-mode tmux`);
     4. expands the kickoff (all placeholders, including `{task_list}`);
     5. a remote role pane runs the ssh loop instead of claude.
3. session_env:
   - lead and standalone `claudeteam`: `all` + `lead`;
   - every other role: `all`, with the `lead` names removed (an inherited `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` is unset);
   - remote role on its server: `remote`.
   - The server command gets `--effort` and `-e` for every session_env.remote pair, plus `CLAUDE_AGENTS_SESSION=1`, replacing the old `-e CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.
4. Layout (§3):
   - One tmux session `layout.tmux_session` on the mode's socket, one window per packed tab. Packing follows `tab_groups`, `min_lead`/`min_role` and `merge_groups_when_room`; unlisted roles go to the last group.
   - The lead gets a full-height left column.
   - Each tab gets an equal grid built with `split-window -l <pct>%`.
   - Panes are tagged `@claude_role`/`@claude_session`, and `pane-border-status top` shows the role titles.
   - Session hooks `after-split-window`/`after-select-layout`/`after-kill-pane` run `claude_team_common.sh --regrid` (resize-pane only).
   - Also set: `allow-passthrough all` (fallback on), `extended-keys on`, `terminal-features xterm*:extkeys`, mouse on.
5. Grid size and terminal:
   - The grid is chosen from tmux `client_width`/`client_height` after one maximized terminal attaches.
   - Terminal order: ptyxis `--maximize`, gnome-terminal `--maximize`, konsole `--fullscreen`, xterm `-maximized`, then xfce4-terminal, qterminal, x-terminal-emulator.
   - Headless: the current tty size, then `tmux attach` in that tty.
   - No positioning, so it is Wayland-safe. WSL2 is detected.
6. Idempotency and verification. A role is skipped when any of these holds:
   - its PID file is live (the process started before the file was written);
   - a live process of this user runs with `--name <session>`;
   - a pre-D13 per-role tmux session is still up.
   - A role pane whose claude exited is respawned in place.
   - After the build, a role without a pane reopens in a new tab, and PID files are awaited.
7. `--status` is a dry run. It prints:
   - the install check, roster, terminal, cell budget and source;
   - tabs and columns, every tmux command, and each role's resolved claude line with env;
   - options and hooks;
   - the table Role/Session/Tab/Pane/PID/Cells/State.
8. `claude_team_install` (§4):
   - installs what is missing: tmux (its version is reported against 3.5), python3, node, curl, ca-certificates, bubblewrap, socat;
   - reports the terminal and installs none (the xrandr and xfce4-terminal installs are gone);
   - repairs the state/shared/reports/reviews/agent-memory dirs;
   - adds the `user_settings_merge` keys only when absent and never overwrites them;
   - keeps `cci_check_remote_control_env` and the isolatePeerMachines/disableRemoteControl checks as report-only.

### Verification (static and dry runs only)

- `bash -n` passes on all six changed shell files: Git Bash, and bash 5.2.37 in Debian 13 WSL2. shellcheck is not installed on Windows or in Debian.
- Debian 13 WSL2: python3 is present; tmux, node and any terminal are missing. WSLg exports DISPLAY/WAYLAND_DISPLAY, so the run is headless.
  - `claudeagents.sh --status` and `claudeteamup.sh --status [--no-kickoff] [--roles ...]` printed the full plan.
  - The install check was read-only: it reported MISSING tmux/node/bwrap/socat, the state dir, the 4 settings keys and the links.
- Scratchpad harness (sourcing the common; no tmux, no claude) packed these budgets:
  - 1920x1080: 213x52 cells, 4 tabs;
  - 2560x1440@125%: 227x57 cells, 3 tabs;
  - 3840x2160@150%: 284x72 cells, 2 tabs. The lead is 100 cols; splits go 64% then 67/50% for columns and 67/50% for rows; role panes are 60-71 x 23 cells.
- Remote loop: fake ssh and a stub server install/tmux. All quoting levels round-trip, and the server pane command parses.
- `claudeteam.sh` with a fake claude:
  - the argv is exact;
  - the non-lead role has `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` removed even when inherited;
  - PID files `ca-orchestrator.pid` and `ct-shell-linux.pid` hold the claude PID;
  - a given `--effort` is kept.
- Not run: real tmux (splits, hooks, regrid, respawn), the terminal flags, and a real launch. That needs a Debian 13 / Ubuntu 26.04 desktop at the orchestrator's launch after review.

### Decisions (no questions asked)

1. Sockets: one per mode, the "existing socket" (`team.tmux_socket` for claudeagents, `sessions.tmux_socket` for claudeteamup), each holding `core-node-team`. PID files named by session, plus the `--name` process check, make a role live in the other launcher count as running. A warning shows when the other launcher's layout is up.
2. Flag names and the PID file name follow claudeteam.ps1 (`--team-pane`, `--team-no-kickoff`, `--team-roles`, `<session>.pid`), so both OSes share one contract.
3. The lead gets `--teammate-mode <team.teammate_mode_linux>` in both modes, because session_env.lead turns agent teams on in both.
4. `--roles` keeps its per-mode meaning (sessions filters the lead too; team always starts the lead), the same as Windows.
5. Terminal list: the spec order first, then xfce4-terminal/qterminal/x-terminal-emulator for Kali (AGENTS.md).
6. Headless grid: the current tty size, since the attach happens in that tty. With neither a client nor a tty, a labelled 213x52 estimate is used.
7. An idle role pane is respawned in place (`respawn-pane -k`), keeping the grid. A role with no pane opens in a new tab.
8. The regrid never calls select-layout, so the after-select-layout hook cannot loop. Hooks are set after the build.
9. A tmux older than 3.5 is only a WARN; options fall back.
10. `user_settings_merge` never overwrites. This changes Linux behavior: a differing `crossSessionInbound` used to be forced to `accept`, and is now reported.
11. Standalone `claudeteam` keeps agent teams on (all + lead) and passes no teammate-mode flag.
12. Parity ids use the SPL-101 block, because concurrent shell-linux workflows are writing SPL-007 and later.
13. A concurrent workflow removed the AI rules header repo-wide (about 16:07) while this task ran, including these files. I kept the current state (no header).
14. The working-tree copies of the five target files were CRLF, although HEAD and `.gitattributes` (`*.sh eol=lf`) say LF. I normalized them to LF (no git diff from that; bash under WSL needs LF).

### Parity

- Aligned: SPL-101 to SPL-107, SPL-111, SPL-112. Their parts that are platform-only (session_env.windows, the teammate-mode value, the WT version warning) are noted in the rows.
- Platform-only: SPL-108 (tmux specifics) and SPL-109 (Linux terminals, Wayland, tmux client size). Windows uses the PMv2 DPI measurement.
- SPL-110 is pending-windows for its `--name` process check. Respawn in place is platform-only; the PID-file skip is aligned.

Alignment request for shell-windows (task shell-linux-1):
- SPL-110: in `scripts/shells/win/win_common/ClaudeTeamCommon.ps1` `Get-ClaudeTeamLiveProcess`, after the PID-file candidates, also treat as live any process of the current user whose `Win32_Process.CommandLine` has the exact tokens `--name <session>`. That skips a session started by hand or by another launcher (the spec §2 name-collision rule).
- Orchestrator: please create `[shell-windows] align: SPL-110 --name process liveness check`.
- For information, no change needed: the remote server runs the Linux `claudeteam.sh` for both launchers. For `--agent <remote role>` it applies session_env.remote and removes the lead variables, and a given `--effort` is kept. `Get-ClaudeTeamRemoteArgument` already matches.

### Blockers

- None.
- Next owner: the reviewer (shell-linux-1 verdict), then shell-windows for the SPL-110 alignment.

## shell-linux-2: D12a desktop shortcut organizer, Linux side (SPW-001/002/003)

- Status: done, awaiting reviewer (the task stays in progress until the verdict).
- Record: docs_fix/REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md §1 D12, §11. Windows ref: DesktopIconManager.ps1 (shell-windows-2).
- An earlier run of this task wrote the organizer and stopped before verification, ledger and report; this run reviewed it, fixed what is below, verified it, and wrote the ledger rows.

### Changed files

- `scripts/shells/linux/common/desktop_shortcut_manager.sh`: the organizer (scan, classify, plan, collisions, placement decision, apply, manifest, undo, CLI); filed launchers updated in place by create/edit/remove; root runs act as each user.
- `scripts/shells/linux/debian/install_shells/154_repair_desktop_icons.sh`: shared Exec parsing (`_dsm_entry_exec_target`, `_dsm_exec_program_exists`), filed launchers count as present, organizer run and undo hint at the end.
- `scripts/shells/linux/refresh_desktop_icons.sh`: `organize|preview|undo [manifest]`, cache refresh after organize/undo, user fallback to `id -un`.
- `scripts/shells/linux/dd_helper/management_and_backup.sh`: menu "Organize Desktop Icons" [Organize/Preview/Undo]. Outside the task's three listed files but inside the shell-linux scope; the dd.sh menu SPW-003 asks for lives here.
- `.claude/agents_shared/shell_parity/linux.md`: rows SPW-001 to SPW-005.

### Fixes made in this run

1. Root safety (blocking class). A root run moved, copied, chowned and replayed manifests inside other users' homes with root rights, so a planted symlink (`desktopIcons/APITools -> /etc/xdg/autostart`, a filed launcher linked to a system file) or a forged manifest made root move or overwrite files outside the home. Now a root run organizes, previews and undoes every other user's Desktop as that user (`_dsm_org_run_as_user`: runuser, the library on stdin since the repo may be unreadable to the user, manifests collected from the output). An explicit manifest is replayed as its owner. Installer writes to user launchers (`_dsm_write_desktop_icon`, edit's `_dsm_set_key`) run as the user (`_dsm_as_user`); the old `chown user:user` of the Desktop dir and target (which followed symlinks) is gone.
2. Launchers were written without a trailing newline, so `edit_desktop_shortcut_...` appended onto the last line (`StartupNotify=falseComment=Edited`). The writers end with a newline, and edit adds one first when a file lacks it.

### Runs (Debian 13 WSL2, bash 5.2.37, mawk 1.3.4; scratch dirs under /tmp; the distro was stopped again afterwards)

- Keyword table: a script compared the Linux table with `$Global:DESKTOP_ORGANIZATION_CATEGORIES`: 1084 keywords, 20 categories, identical in order.
- Non-root sandbox (nobody, scratch HOME), 21 fixtures: Postman with `[x]` in the file name, Chrome keep-copy, Edge identical copy, a Notepad++ identical duplicate, a 7-Zip older filed one (replace), a PeaZip newer filed one (conflict), an Insomnia Desktop vs filed collision (the newer filed one refiles, the Desktop one is a conflict), window-launcher, broken Exec, a CJK name, an Exec-basename match (OBS), a generic host (env sh), camelCase (VSCodiumInsiders), a short keyword at the start (Go Tool) and not at the start (Let's Go), `Type=Link`, and a symlinked .desktop.
  - Preview 1 changed nothing, and its 10 items equal Run 1's 10 items.
  - Preview 2, Run 2 and Run 3 printed "Nothing to move"; Run 3 left the tree identical; 1 manifest in total.
  - Undo with a read-only Desktop: 2 restored, 9 skipped, 8 errors, UndoneAt stayed empty. The retry restored 15, skipped 4 (no-ops), 0 errors, and set UndoneAt. The next undo printed "No organizer run to undo".
  - After undo, every launcher is back with its size and mtime. The only difference: the Desktop links to CompressionTools and DevelopmentTools, two folders that already held launchers before the run, stay. That is the Windows rule (a link to a non-empty category folder is not moved away).
- Root sandbox (`unshare -m` with a bind-mounted fake /etc/passwd: root plus alice with a localized `XDG_DESKTOP_DIR=$HOME/Schreibtisch`; `CORE_NODE_DESKTOP_ICONS_DIR`/`XDG_STATE_HOME` applied to root only):
  - Preview and organize covered both desktops. Every file, folder, link and manifest in alice's home is alice-owned.
  - create/edit updated the filed launchers in place; the Desktop gained nothing; the next organize was "Nothing to move" for both.
  - Undo for all users and an explicit-manifest undo both set UndoneAt.
  - Attacks: a category dir symlinked to a root-only dir gave "failed" and moved nothing; a filed launcher symlinked to a root file was not written (still root-owned, content unchanged); a forged manifest aiming at a root file gave 2 errors and moved nothing.
- `bash -n` passes on the four shell files, all LF. 154 was not run end to end: it rewrites /usr/share/applications entries of installed apps; its organizer call is the same function exercised above.

### Decisions (no questions asked)

1. The direct CLI is the library itself (`desktop_shortcut_manager.sh organize|preview|undo [manifest]`) plus `refresh_desktop_icons.sh`, not a new `desktop_icon_organizer.sh` (reuse over a new file; the task write scope lists no new file).
2. The menu sits where the Windows one does: dd.sh > Linux Management > Linux System Tools > Management & Backup > Organize Desktop Icons.
3. "chown moved launchers to the user" is met by running as the user (the files are the user's own), not by chown from root.
4. Preview counts a missing folder or Desktop link as a change, so "Nothing to move" means the run writes no manifest. For a second identical item to one destination, preview reports what the run does (copy: unchanged, refile: conflict, move: duplicate).

### Parity

- Aligned: SPW-001, SPW-002, SPW-003. Platform-only: SPW-004 (Windows shortcut formats), SPW-005 (icon extraction).
- For shell-windows, information only, no request: Windows preview counts only shortcut placements, so it can print "Nothing to move" while Organize still recreates a missing `<Category>.lnk` and writes a manifest. Linux counts those as changes.

### Blockers

- None. A real GNOME/KDE/XFCE desktop run (gio trust, the icons shown) needs a Debian 13 / Ubuntu 26.04 desktop; WSL has no desktop and no gio.
- Next owner: the reviewer (shell-linux-2 verdict).
