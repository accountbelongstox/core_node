# pycore Background Service (Linux + Windows), Live Service Log, Terminal Backup and Restore

Date: 2026-10-02
Status: binding requirement list (design and implementation record appended below as work proceeds)
Scope: `pycore` (launcher, service managers, terminal capture, tray notification, power state), `scripts/shells/{linux,win}` service entry points, `poly_apps/pycore_laravel_wordnew_ui` (pycore-manager LOG panel), `config/pycore_relay_contract.json`, i18n.
Related: `REQUIREMENTS_20260927_LINUX_TERMINAL_CONTROL_WAYLAND.md` (terminal backends), `FIX_20260803_PYCORE_HTTP_LOGGING_AND_HEARTBEAT_UI.md`.

## 1. Measured facts (repo, 2026-10-02)

- Linux already installs pycore as the systemd unit `pycore` (`pyservice.sh install` -> `scripts/shells/linux/common/pycore_service.sh`; `User=<desktop user>` with session env; today the unit also enables the tray). `pycore/pylauncher/platform/system_service_manager.py` is its Python facade and is Linux-only (`is_supported()` = systemd).
- Windows has no pycore service. `pyservice.ps1` prints "systemd service install/management is Linux-only"; only a logon auto-start exists (`windows_startup_manager.py`). Windows service machinery already exists for sibling services: `win_common/NssmServiceManager.ps1` (`Register-NssmService`, idempotent, `Read-YesNoDefaultYes`), `WinswServiceManager.ps1`, `WindowsServiceManager.ps1`; `ncore-nexus-dash` is registered through NSSM.
- The launcher (`pycore/pyutils/launcher`, "pylauncher") already runs `service_orchestrator.run_launcher_service_prompts`: per `BackgroundServiceSpec` it skips a running service, starts an installed-but-stopped one, and offers install with a timed Y/n (default Yes). Specs exist for laravel_main, mcp-chrome and nexus-dash. **pycore itself has no spec.** Launcher options `[2]/[3]/[4]` start `launch_pycore_module()` (a detached foreground copy) and option `[3]` returns before the service prompts.
- Live log pipeline exists end to end: `pyfoundations/console_log_journal.py` sequences every console line (ColorPrint + raw stdout/stderr) in a ring and a JSONL file; `ws_event_service.py` serves the WebSocket; the UI's single global socket is `core/network/ws/ReconnectingWebSocket.ts` used by `PycoreEventClient.ts`; `PycoreConsoleLogStore.ts` holds the `pycore_log` topic while a log view is mounted and repairs gaps via `ui/console_log/history`; the view is `PcLogPanel` (LOG tab of `PcDebugDock`) via `usePcLogs()`.
- Terminal text capture exists: `TerminalService.capture_text` (activate window -> select all/copy -> clipboard sentinel -> `terminal_capture_store.save` -> `open_file_with_notepad(path, text_editor_finder.find())`). It needs the interactive desktop session. Store layout today is flat `tcap/terminal-<n>-<stamp>.txt`.
- Tray/desktop notification exists: `show_system_notification` (`native_ui/step11_desktop/system_notification.py`; Windows tray via `BusSignals.TRAY_SHOW_NOTIFICATION`, Linux gdbus/notify-send).
- No battery/power-state library exists in `pycore`.

## 2. Requirements

### R1 pycore as a background service on Windows and Linux
- R1.1 Add a `pycore` `BackgroundServiceSpec` to `service_orchestrator.build_service_specs()`: Linux unit `pycore` (script `pycore_service.sh install`, root privilege), Windows kind SERVICE name `pycore`. No second prompt mechanism is created.
- R1.2 Windows service backend: a new `pyservice.ps1 service-install|service-uninstall|service-start|service-stop|service-status` implemented in `win_common` on top of `Register-NssmService` (same manager as `ncore-nexus-dash`). The service command is `pyservice.ps1 run -NoUi -NoInstall -NoServicePrompt` (headless, same flags as the Linux unit). The unused "Linux-only" branch for `start|stop|restart|status|uninstall` in `pyservice.ps1` is replaced by the real implementation. Needs elevation; self-elevate with `Start-Process -Verb RunAs` (existing launcher elevation path).
- R1.3 Prompt: first run with no service installed asks "Install pycore as a background service? [Y/n]" (default Yes, timed, via `ask_yes_no_timed`). Shell entry points (`pyservice.sh run`, `pyservice.ps1 run`) use the same default-Yes pattern (`prompt_read_default` / `Read-YesNoDefaultYes`). No TTY, `INVOCATION_ID` set, or `--no-service-prompt` -> no prompt, foreground run (the service never re-installs itself).
- R1.4 Idempotent: service already installed -> no prompt; ensure it is enabled/automatic and running (start when stopped, repair a drifted command/start type), print status and the log tail command. Declining runs the foreground worker; the next interactive run asks again.
- R1.5 `launch_pycore_module()` and `is_pycore_module_running()` treat a running `pycore` service as "already running" (no duplicate foreground worker on port 59000). Launcher option `[3]` runs the pycore service prompt before returning.
- R1.6 `system_service_manager.py` becomes the one cross-platform facade (Linux systemd and Windows service). The tray "Run as system service" toggle works on both OSes.
- R1.7 **Service mode has no tray on either OS.** A service-mode worker (systemd unit `pycore`, Windows service `pycore`) never starts the tray icon; both service commands pass the same no-tray switch (`--no-tray` / `PYCORE_NO_TRAY=1`, honored by the one tray-enable decision in `service_config`/`tray_menu`). The Linux unit keeps the desktop session env (needed for terminal export and notifications) but drops the tray. The tray stays available for foreground runs.
- R1.8 Windows session boundary: a service runs in session 0 and cannot see terminals or the clipboard. The service hosts RPC, WS, journal and schedulers. A **session agent** (R5.5, no tray icon) provides every desktop-dependent feature on Windows. On Linux the unit carries the session env, so the same process does both.

### R2 Live service log in the pycore UI
- R2.1 Opening the LOG panel (`PcLogPanel` / pycore-manager LOG UI) subscribes the `pycore_log` topic on the **existing global WebSocket** (`ReconnectingWebSocket` via `PycoreEventClient`) pointing at the service endpoint. No new socket or log transport is added.
- R2.2 Replay through `ui/console_log/history` fills history and gaps; a service restart is shown by the existing `serverRestarted` note.
- R2.2a **Reliable push (journal refactor, `pyfoundations/console_log_journal.py`).** Delivery to sinks never depends on disk: a failed log-file write (permissions, disk full, root-owned remnant) is caught, the file is reopened once, and the entry still reaches the ring and every sink; one failing sink never blocks the others. Journal install and sink registration work in headless service mode (no console, `sys.stdout` may be `None`).
- R2.2b **Log file: at most 100 MB, newest kept.** The journal file lives in the user data dir (`<data root>/logs/pycore_console.jsonl`). Total retained size is capped at 100 MB (two segments of 50 MB; the oldest segment is dropped, the newest is always kept). Writes append JSONL; the cap is a single constant owned by the journal.
- R2.2c **Backward replay beyond the ring.** `ui/console_log/history` gains `before_seq`: it returns up to `limit` entries with `seq < before_seq` (ascending), read from the ring and then the log file, plus `has_older`. Forward cursor replay (`since_seq`) fills a gap larger than the in-memory ring from the file; `replay_lost` is reported only when the file no longer holds the gap. The in-memory ring is not the retention limit any more.
- R2.2d **UI window.** The UI may scroll back through everything the file holds, but never shows more than **1000 lines at once**: following the live tail keeps the newest 1000; loading older pages (`before_seq`) slides the 1000-line window back (newest lines leave the window) and pauses live insertion; a "back to live" action re-syncs with the tail. `PycoreConsoleLogStore` owns the window; `PcLogPanel` shows "load older" / "back to live".
- R2.3 The service journals its own output without a console: `sys.stdout/stderr` capture stays on in headless service mode; the NSSM stdout/stderr files (rotated) are only a secondary sink.
- R2.4 The panel shows that the log belongs to the service process (service badge from instance info), and the connection state of the global WS. All strings in the `pc` i18n namespace (en/zh).
- R2.5 A new live topic `terminal_backup` (last backup time, terminal count, bytes, status) may be shown in the UI through the same socket.

### R3 Backup triggers (service side)
- R3.1 Every 60 s (contract limit `terminal_backup_interval_seconds`), the backup scheduler calls the terminal backup library (R4).
- R3.2 Immediately (forced, bypassing idle gates and change detection) on: battery low while discharging (`<= terminal_backup_low_battery_percent`, default 10), system shutdown/suspend, and service stop (SIGTERM / `systemctl stop` / Windows service stop and preshutdown / session end). pycore does not power the machine off; "shutdown" means a final backup is guaranteed before it.
- R3.3 New shared library `pycore/pyfoundations/power_state.py` (`PowerState(percent, plugged, present)`: `psutil.sensors_battery()`, `/sys/class/power_supply` fallback; desktops without a battery report `present=False` and never trigger R3.2 low-battery).

### R4 Terminal backup library
- R4.1 New `pycore/pyctl/terminal/terminal_backup_store.py` (extends the `terminal_capture_store` family; shares `atomic_write_bytes`, `prune_files`, NAME_TIME_FORMAT, no duplicate helpers). Layout: `<APP_DATA_DIR>/terminal_backup/<YYYYMMDD-HHMMSS>/terminal-<n>.txt` plus `manifest.json` (`created_at`, `terminal_count`, `total_bytes`, per-terminal `{number, name, bytes, sha256}`). Time = folder, notepad (.txt) = one terminal.
- R4.2 New `pycore/pyctl/terminal/terminal_backup_service.py`: one backup pass = enumerate terminals via `TerminalService` snapshot, capture each (`capture_text` core extracted into a reusable method without the editor-open side effect), write one folder. Retention: keep the newest `terminal_backup_retain_count` folders and `terminal_backup_retain_seconds`.
- R4.3 Non-intrusive by default (capture activates windows and swaps the clipboard):
  - the saved content is the **terminal text itself**, exported from each running terminal with the existing mechanism `TerminalService.capture_text` (`backend.copy_all`: select all + copy through the clipboard sentinel). Screenshots are never used, neither as content nor as a change check;
  - an unchanged terminal (text sha256 equal to the previous backup) is not rewritten; a pass where nothing changed writes no folder (R4.4);
  - the pass is deferred while the user is typing (shared `user_idle_seconds()` helper, Win32 `GetLastInputInfo` / X11 idle; threshold `terminal_backup_min_idle_seconds`);
  - the clipboard is always restored (existing `capture_text` behavior);
  - `capture_text` is refactored once into a reusable `export_text(window_id, terminal_number)` core (no editor side effect) that both the on-demand capture and the backup call; no second export implementation.
- R4.4 A pass with no changed terminal and no forced reason writes nothing and sends no notification. A written pass pops a **system notification** (`show_system_notification`; the Windows toast stack / Linux gdbus-notify-send surface, no service tray needed): "Backed up {count} terminals, {kb} K". Linux and Windows. Strings in the existing native_ui translations (en/zh/ja).
- R4.5 Also record input that already passes through pycore (`terminal_service.input_text`, drafts, `terminal_activity_log`) in the manifest as `inputs`, so a terminal whose window cannot be captured still has its sent input saved.
- R4.6 Failures never raise: a failed terminal is listed in the manifest with `error_code`, the pass continues.

### R5 Where the scheduler runs
- R5.1 Exactly one backup scheduler runs per machine and desktop session (cross-process lock under `APP_DATA_DIR`).
- R5.2 Linux: the `pycore` unit process (has the session env) runs it (`has_graphical_display()` true). Headless Linux: it stays idle and reports `no_display`.
- R5.3 Windows foreground (no service): the pycore process runs it.
- R5.4 Windows with the service installed: the service process reports `needs_session_agent`; the session agent runs it.
- R5.5 Session agent = a small logon-started process (`pycore.pylauncher.session_agent`, started through the existing `windows_startup_manager` shortcut mechanism, no tray icon). It uses the same `terminal_backup_service` library in-process and exchanges status with the service through the existing RPC/event routes. No terminal logic is duplicated.

### R6 Restore at launcher start
- R6.1 At pylauncher start (before the option menu, interactive only) find the newest valid backup folder (`manifest.json` present). If found, print date, terminal count and size in K and ask "Open the last terminal backup? [Y/n]" (default Yes, timed, `ask_yes_no_timed`).
- R6.2 Yes -> open every `terminal-<n>.txt` of that folder in the system default text editor (Notepad on Windows, `xdg-mime` default on Linux) with `open_file_with_notepad(path, text_editor_finder.find())`, one window per terminal, spaced by a short delay. No terminal is recreated; the files are read-only context.
- R6.3 Headless (`--no-pause`, `--mode`, no TTY, auto-start): never prompt, never open.
- R6.4 The launcher option menu text and the `[1]` cross-device entry stay unchanged; new strings go to `launcher_i18n/{en,zh}/main.json` (`launcher.main.restore_*`).

### R7 Launcher apps on Linux: Remmina, WeChat, prerequisite installers
- R7.1 Linux launcher starts **WeChat by default** (enabled by default; no longer Windows-only) and **Remmina** (new Linux-only app, enabled by default) in the `EXTRA_APPS` group, as the desktop user, skipped when already running.
- R7.2 Every launcher app that has a Linux installer calls its **prerequisite idempotent install script** to ensure it is installed before launching: when the app does not resolve, run the script once (non-interactive: `DD_AUTO_CONTINUE=1`, root via sudo when needed), re-resolve, then launch. Mapping in `app_catalog.LINUX_PREREQUISITE_INSTALLERS`: chrome -> `41_install_browsers.sh --only chrome`, cursor -> `155_install_ides.sh --only cursor`, codex -> `99_install_ai_tools.sh --only codex`, wechat -> `167_install_wechat.sh`, remmina -> `195_install_remmina.sh`. The system text editor is a desktop default and has no installer. Headless hosts (no display) skip GUI installers and apps.
- R7.3 New idempotent installer `195_install_remmina.sh`: installs `remmina remmina-plugin-rdp remmina-plugin-secret` only when missing, desktop-only, non-fatal, Debian 13 / Ubuntu 26.04 / Kali. `remote_control_common.sh` stops listing remmina itself and calls this installer (one owner of the package list). Added to `app_install_menu.sh` and `debian_tree.md`.
- R7.4 Windows keeps its own installers and has no Remmina (mstsc); the shared catalog marks Remmina `linux` only.

## 3. Shared-code rules (AGENTS.md)

- Reuse: `service_orchestrator` (prompt/idempotent ensure), `ask_yes_no_timed`, `Register-NssmService`, `system_service_state.windows_service_state/systemd_unit_state`, `console_log_journal`, `ReconnectingWebSocket`, `PycoreConsoleLogStore`, `capture_text`, `terminal_capture_store` helpers, `show_system_notification`, `open_file_with_notepad`, `text_editor_finder`.
- New code only for: Windows service entry (R1.2), `power_state.py`, `terminal_backup_store/service`, `user_idle_seconds`, session agent, LOG service badge.
- Every limit in `config/pycore_relay_contract.json` (`limits.terminal_backup_*`); no hardcoded constants outside it. Paths from `system_paths`/`core_node_dirs`. English only in code/logs; UI/launcher/tray text through i18n.
- Windows and Linux behave the same except the R1.8/R5 session split. PowerShell: `Join-Path`/`Split-Path`/`Resolve-Path`; shell scripts English, LF endings.

## 4. Assumptions

- A1 "Shutdown on low battery" = guarantee a final backup before power-off; pycore never powers the machine off.
- A2 "Backup input of every terminal" = the visible terminal buffer text (copy-all) plus pycore-routed input (R4.5); no keylogging.
- A3 Windows service manager = NSSM, matching `ncore-nexus-dash` (WinSW remains FrankenPHP's).
- A4 A declined install prompt is asked again on the next interactive run until the service exists.
- A5 Restore only opens the text files; it does not respawn terminals or replay commands.

## 5. Acceptance

- A1 Fresh Windows: `pyservice.ps1` / launcher offers `[Y/n]`; Yes installs service `pycore` (elevated), it runs headless on :59000. Second run: no prompt, state "running" (or started if stopped). Same on Linux with unit `pycore`.
- A2 Open the pycore-manager LOG panel: live service lines appear through the global WS; restart the service -> `serverRestarted` note and replay with no gap; panel closed -> topic released.
- A3 With 3+ open terminals: after one minute a `terminal_backup/<stamp>/` folder holds `terminal-1..n.txt` + `manifest.json`; a notification shows count and K; unchanged terminals produce no new folder and no toast; the `.txt` files hold the exported terminal text (no image data).
- A4 Simulated low battery (power-state stub) and `systemctl stop pycore` / service stop each produce a forced final backup.
- A5 Launcher restart: prompt shows date, terminal count and K; Enter opens one notepad per terminal; `--no-pause` shows nothing.
- A7 In service mode no tray icon appears on Linux or Windows; the foreground run still shows it.
- A8 Journal: log file never exceeds 100 MB total and the newest lines survive rotation; with the log directory made unwritable the live LOG panel still receives lines; `history(before_seq=...)` returns lines older than the ring; the UI never renders more than 1000 lines, can load older pages, and "back to live" returns to the tail.
- A6 Windows with the service installed: backups and notifications come from the session agent; the service never touches the desktop.

## 6. Verification plan

- Linux (this host): systemd unit install/ensure/idempotence, scheduler + manifest, forced backup on `systemctl stop`, launcher prompt dry run, notification via gdbus.
- Windows: delegated to `shell-windows` / Windows side (service install, session agent); Debian WSL2 cannot exercise session 0.
- UI: LOG panel on the service endpoint (`pycore-ui`), `tsc` + i18n key parity.

## 7. Work split

| Area | Owner role |
|---|---|
| `pyservice.sh` prompt parity, `pycore_service.sh`, Linux service spec and ensure, ExecStop forced backup, Linux notification path | shell-linux |
| `pyservice.ps1`, `win_common` NSSM wiring, Windows service spec, session agent shortcut, Windows idle helper | shell-windows |
| `terminal_backup_*`, `power_state.py`, `service_orchestrator` pycore spec, launcher restore prompt, `system_service_manager` facade, contract limits, i18n | pycore-lead |
| LOG panel service badge, `terminal_backup` topic display, `pc` i18n | pycore-ui |
| `195_install_remmina.sh`, menu/tree entries, `remote_control_common.sh` dedupe, `pycore_service.sh` no-tray flag | shell-linux |
| `console_log_journal` (reliable push, 100 MB file, `before_seq`), launcher catalog/ensure-install (R7) | pycore-lead |
| `PycoreConsoleLogStore` 1000-line sliding window, load older / back to live, i18n | pycore-ui |
