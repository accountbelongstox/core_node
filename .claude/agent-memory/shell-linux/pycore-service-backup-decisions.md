---
name: pycore-service-backup-decisions
description: User decisions for pycore background service, log journal and terminal backup (2026-10-02): text export not screenshots, no tray in service mode, 100 MB log, 1000-line UI window
metadata:
  type: project
---

Spec lives in docs_fix/REQUIREMENTS_20261002_PYCORE_BACKGROUND_SERVICE_TERMINAL_BACKUP.md.

- Terminal backup saves the exported terminal TEXT via the existing `TerminalService.capture_text` / `backend.copy_all`; never screenshots, not even as a change check.
- Service mode (systemd `pycore`, Windows service) runs without a tray on both OSes (`PYCORE_NO_TRAY=1`); notifications must still work.
- Console journal file is capped at 100 MB (newest kept) in the user data dir; the UI may scroll back through all of it but shows at most 1000 lines at once.
- Launcher on Linux starts WeChat by default plus Remmina; each app calls its idempotent prerequisite installer when missing (195_install_remmina.sh owns the Remmina package list).

**Why:** user corrected the screenshot idea and asked service behavior to be identical on both OSes.
**How to apply:** do not reintroduce screenshot-based capture or a service tray; keep one owner per package list.
