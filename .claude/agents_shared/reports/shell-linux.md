# shell-linux handoff report

## p1-linux: dual-boot drive layout, P1 Linux safety

- Status: implemented, awaiting reviewer (SAFETY constraints forbade running installers/mount/fstab/udev/grub; verified with `bash -n` and read-only greps only).
- Record: `docs_fix/REQUIREMENTS_20260927_DUAL_BOOT_DRIVE_LAYOUT.md` sections 2, 3, 4 (phase P1). Contract: `config/service_contract.json` `paths.drive_layout`.
- Fenced files edited (only these): `scripts/shells/linux/common/gvar_storage_common.sh`, `scripts/shells/linux/common/shared_cache_env.sh`, `scripts/shells/linux/common/mount_common.sh`, `scripts/shells/linux/common/pyservice_entry.sh`. `gvar_common.sh` was fenced but left unmodified: everything it needs (CN_TREE_MNT/CN_TREE_BACKING/CN_TREE_CACHE_ROOT and the 5 toolchain cache vars) already reaches it for free, since `gvar_system_common.sh` sources `shared_cache_env.sh` before `gvar_common.sh` reaches its own directory-variable section -- adding a second definition there would have violated the "one definition" rule.

### Changed files (line ranges are post-edit)

- `scripts/shells/linux/common/gvar_storage_common.sh`
  - L3-28: new `get_program_drive_partuuid()`. Reads the program-drive PARTUUID (contract `program_partuuid`) from the global var store under key `CN_PROGRAM_PARTUUID`. Uses `get_var` when defined; otherwise reads the on-disk var-store file directly (`$GLOBAL_VAR_DIR/${OS_VAR_TAG}_CN_PROGRAM_PARTUUID` then the bare name), because this file's own `detect_desktop_windows_drives()` call (L620, unchanged call site) runs at source time BEFORE `global_var_store.sh` is sourced by `gvar_common.sh` -- the direct-file read keeps the exclusion effective even at that early point.
  - L30-53: `get_largest_ntfs_with_size` now excludes the device whose `blkid -s PARTUUID` matches the program-drive PARTUUID.
  - L318-364 (function body L346-364): `get_dev_compile_base` rewritten per requirement 1 -- always `/opt` (sticky check kept as-is), free-space check is now advisory-only (English warning, never a fallback), and the `IS_WSL` branch plus the `get_base_data_directory` (NTFS) fallback are both removed.
  - L491-524 (function body L495-524): `determine_largest_windows_drive` (feeds `get_base_data_directory` priority 4) now skips the drive whose underlying device (`findmnt -o SOURCE` on the `/media/$USER/<letter>` mountpoint) matches the excluded PARTUUID.
  - Left for another lane: the pycore (`pyfoundations/system_paths.py:204-231`) and Laravel (`PathMapper.php:690-708`) mirrors of the `get_dev_compile_base` change, per the requirements doc's own note that they "must change in lockstep."

- `scripts/shells/linux/common/shared_cache_env.sh`
  - L23-42: new declarations `CN_TREE_MNT`, `CN_TREE_BACKING`, `CN_TREE_CACHE_ROOT`, `BUN_INSTALL_CACHE_DIR`, `npm_config_cache`, `UV_CACHE_DIR`, `COMPOSER_CACHE_DIR`, `COREPACK_HOME` plus scratch vars, all declared empty at top per the file's existing "variable declarations" convention.
  - L48-105: new block. Sources `service_contract_common.sh` if `sc_get` isn't already defined, reads `paths.drive_layout.tree_root.{linux,linux_backing}`; on an unreadable contract (fresh machine, no node/php) logs one English line and stops (never guesses/falls back to NTFS). Resolves `CN_TREE_CACHE_ROOT` to `CN_TREE_MNT/cache` only when `findmnt -no FSTYPE -M "$CN_TREE_MNT"` reports ext2/3/4, else `CN_TREE_BACKING/cache`. mkdirs the 5 cache subdirs (bun/npm/uv/composer/corepack) best-effort (same `mkdir || sudo -n mkdir` pattern already used elsewhere in this file, not `$USE_SUDO`, since this file must stay usable when sourced directly by `pyservice_entry.sh` without `gvar_common.sh`/`USE_SUDO` ever having been set). Exports the 5 cache vars via `: "${VAR:=...}"` (respects a caller override, still outranks each tool's own `XDG_CACHE_HOME` default). `XDG_CACHE_HOME` itself: unchanged, per the task's explicit instruction. pnpm store: untouched, per the task's explicit instruction (noted for P3).

- `scripts/shells/linux/common/mount_common.sh`
  - L19-56 (new logic L29-35): `mount_fstab_ensure_single_entry` now writes fsck pass 0 for `ntfs|ntfs3|fuseblk|ntfs-3g`, pass 2 unchanged for everything else.
  - L124-156: `detect_ntfs_disks` skips the excluded PARTUUID device (same helper/lookup as `get_largest_ntfs_with_size`).
  - L158-217: new `PROGRAM_DRIVE_UDEV_RULE_FILE` constant (L162) and `ensure_program_drive_udev_exclusion()` (L173-217) (writes `/etc/udev/rules.d/99-core-node-ignore-program-drive.rules` only when content differs; no-ops gracefully when the PARTUUID is unknown, the contract is unreadable, or `linux_mounts_program_drive` isn't `false`).
  - L219-262: new `warn_ntfs_dirty_windows_repair()` (English warning + `grub-reboot` gated on `GRUB_DEFAULT=saved` and a discovered Windows `menuentry`, else a manual-step message). **Neither this nor `ensure_program_drive_udev_exclusion` is called from anywhere in this task's fenced files** -- both are left for the lane that owns `3_setting_base.sh` to wire in (the latter is also called by `mount_disk`/`handle_ntfs_disk` below on the dirty-volume path).
  - L349-360: `update_fstab`'s log line now reports the real fsck pass instead of a hardcoded "0 2".
  - L383, L566 (post-edit; the two `mount_options=` assignments in `mount_disk` and `handle_ntfs_disk`): `windows_names` added to both NTFS mount-option strings.
  - `mount_disk` (L362-425, fallback L400-419) and `handle_ntfs_disk` (L431-638, fallback L566-609): the ntfs3-dirty-volume fallback no longer persists the fallback type into fstab (this was the documented root cause of the dirty-volume loop). It now mounts explicitly with `-t ntfs-3g` for that boot only, calls `warn_ntfs_dirty_windows_repair`, and fstab keeps `ntfs3`. `handle_ntfs_disk`'s old `_tries` retry loop is replaced with an explicit two-step (try `ntfs3`, on failure try `ntfs-3g`) so the fallback type is never looped back into `ntfs_type`/persisted.
  - L953-1011: new `ensure_tree_root_bind_mount()` (idempotent fstab bind `<backing> <mnt> none bind,nofail,x-systemd.requires-mounts-for=/www 0 0`, only when `/www` is the NTFS dual-boot share; mkdir of the plain mountpoint only). **Not called anywhere in this task's fenced files** -- left for the `3_setting_base.sh` lane.

- `scripts/shells/linux/common/pyservice_entry.sh`
  - `build_worker_env_args` (L710-724), forwarding list at L717-722: gains exactly `BUN_INSTALL_CACHE_DIR npm_config_cache UV_CACHE_DIR COMPOSER_CACHE_DIR COREPACK_HOME`. This is the ONLY edit made to this file, per the fence note that the rest of it belongs to another role.

### Verification (SAFETY: no installers/mount/umount/fstab/udev/grub commands were run)

- `bash -n` passes on all 5 fenced files.
- CR count is 0 on all 5 (LF-only, unchanged).
- `git diff --stat`: `gvar_storage_common.sh` +/-, `mount_common.sh` +/-, `shared_cache_env.sh` +, `pyservice_entry.sh` 1-line change, `gvar_common.sh` untouched (0 diff).
- Greps confirm: `windows_names` appears exactly twice (both NTFS mount-option strings); no `force`/`ntfsfix` introduced (only the two comments that say "never use/run" them); the four historical `0 2` fsck literals are now `0 $fsck_pass` (x2), `0 0` (handle_ntfs_disk, always NTFS) and one untouched `0 2` (handle_data_disk, non-NTFS, correctly left alone).

### Known limitation (flagged, not fixed here -- would require restructuring gvar_common.sh's load order, out of this fence)

- `gvar_storage_common.sh`'s own top-level `detect_desktop_windows_drives()` call runs during sourcing, before `global_var_store.sh` defines `get_var`. `get_program_drive_partuuid` works around this for its own callers by reading the var-store file directly, so `get_largest_ntfs_with_size` / `get_base_data_directory` priority 3 are correctly exclusion-aware whenever actually invoked later. Priority 4's `DESKTOP_LARGEST_WINDOWS_PATH`, however, is computed ONCE at that early top-level call and cached in an exported variable; if `GLOBAL_VAR_DIR`/`OS_VAR_TAG` were for some reason not yet set at that exact point either, the very first sourcing pass could miss the exclusion for that specific rare priority-4 path (multi-boot desktop with Windows drives auto-mounted under `/media/$USER`). This does not affect the primary dual-boot scenario (priority 3), which is correctly fixed.
- `CN_PROGRAM_PARTUUID` is currently an OS-tagged var-store key (via `get_var`'s default behavior), not a cross-OS shared key, because making it shared requires adding it to `CORE_NODE_SHARED_GVAR_KEYS` in `runtime_environment.sh` (not fenced for this lane) and to the Windows mirror `$script:SharedGlobalVarKeys` in `CommonFunc.ps1` (shell-windows). Until P2 wires up Windows recording `program_partuuid` on first E: adoption, `get_program_drive_partuuid` simply returns empty everywhere (no exclusion active), which is the correct, safe default for today.

### Parity (binding; ledger at `.claude/agents_shared/shell_parity/linux.md`)

- New rows: SPL-113 (get_dev_compile_base hard-pin), SPL-114 (PARTUUID exclusion hooks + udev rule), SPL-115 (tree-root constants + fstab bind), SPL-116 (toolchain caches off NTFS + pyservice_entry.sh forwarding) -- all `pending-windows`, referencing the requirements doc's own phase P2 ("Windows 3-drive keys with E: detection and fallback; Linux tree/tool roots; contract keys"), which is where `program_partuuid` actually gets recorded on the Windows side and where the Windows program-drive/tree-root/toolchain-cache counterparts belong.
- SPL-117 (mount_common.sh NTFS mount hardening: windows_names, fsck pass 0, dirty-volume ntfs-3g runtime fallback, grub-reboot) is `platform-only`: no Windows analog (Windows owns NTFS natively; its chkdsk/readiness flow is shell-windows' existing DiskRepairManager.ps1 / DualBootReadinessManager.ps1 from D1/D2).
- Alignment requests for the orchestrator to file for shell-windows (no live shell-windows/ct-shell-windows session was reachable via ListAgents at the time of this task -- only `ca-orchestrator` was live -- so this is written here per the workflow's "or in a workflow write it in your result" rule):
  - `[shell-windows] align: SPL-113 tool-root hard-pin (E: primary/D: fallback for tools, never silently NTFS-agnostic) -- P2 scope`
  - `[shell-windows] align: SPL-114 record program_partuuid on first E: adoption + Windows-side program-drive exclusion -- P2 scope`
  - `[shell-windows] align: SPL-115 Windows tree_root consumption (<program_drive>\core_node_trees) -- P2 scope`
  - `[shell-windows] align: SPL-116 Windows toolchain cache vars under tree_cache_root -- P2/P3 scope`

### Blockers

- None for this lane's own fenced files. Wiring `ensure_program_drive_udev_exclusion` and `ensure_tree_root_bind_mount` into an actual convergence step (`3_setting_base.sh` or a new step) is out of this fence and left for whichever lane owns that file next.
- Next owner: the reviewer (p1-linux verdict), then the P2 lanes (shell-windows, shell-linux, orchestrator for contract) per the phase table.

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
