---
name: project-console-journal-launcher-apps
description: 2026-10-02 console_log_journal reliability/2x50MB file/before_seq, PYCORE_NO_TRAY switch, launcher prerequisite installers (script_spawn.py); non-obvious decisions
metadata:
  type: project
---

Done for DESIGN_SHELL_HOSTS.md (R2.2a-c, R1.7 python side, R7.1/7.2/7.4).

- Journal file reads rely on json.dumps key order (`{"instance_id": ..., "seq": N`): `_line_prefix` lets reverse scans read seq without JSON parsing and stop at a foreign instance. Do not reorder entry keys in `_append`.
- Journal bookkeeping (`_file_floor`, `_file_last_seq`, `_segment_firsts`) only feeds `earliest_seq`; reads validate contiguity themselves. Write failures back off 5 s (`CONSOLE_LOG_FILE_RETRY_SECONDS`), failures are reported to `sys.__stderr__` (never ColorPrint: recursion).
- Tray switch: `service_config.tray_disabled()` / `qt_tray_enabled()`; `--no-tray` sets `PYCORE_NO_TRAY=1` in the env. Notifications never depend on the tray (UI_ENABLE_TRAY is pyside-only, default False).
- Launcher: wechat/remmina default-enabled on Linux only (`LINUX_DEFAULT_ENABLED_APPS`); an already-saved `enabled: false` in user data still wins. Shared spawn/privilege/log helpers now live in `launcher/script_spawn.py` (moved out of service_orchestrator).

**Why:** future edits to these areas should keep the invariants above.
**How to apply:** check them before touching the journal entry format or the orchestrator spawn helpers. See [[project-pycore-pitfalls]].
