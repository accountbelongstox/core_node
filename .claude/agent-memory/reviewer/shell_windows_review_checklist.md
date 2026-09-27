---
name: shell-windows-review-checklist
description: Recurring defects and verification steps when reviewing shell-windows (PowerShell, dd.ps1, desktop organizer) tasks, including file-moving tools with undo manifests
metadata:
  type: project
---

Checks that paid off on shell-windows tasks (first seen on shell-windows-2, 2026-09-27):

- **Undo or state markers written unconditionally.** Look for "done/undone" flags set after a loop regardless of per-entry errors. Once set, retries are blocked, and "newest not yet undone" logic jumps to an older run out of order. Require the flag only when errors are 0, and check that per-entry replay is idempotent so a rerun is safe.
- **String append to build paths.** Grep added lines for `+ '\'` or `"...$var\..."`. AGENTS.md forbids it. `Join-Path $dir ''` gives a trailing-separator prefix on PS 5.1 (verified).
- **Copy-mode ping-pong.** When a tool copies instead of moving, check for two sources with the same name mapping to one destination. Each run then displaces the other copy, which breaks idempotency.
- **Verify "nothing deleted / second run moved nothing" read-only:**
  - read the manifest;
  - check that every destination exists and every source is gone;
  - count files per folder against the owner's "before" count;
  - check there is exactly one manifest and no displaced/ dir.
- **Shared files hold concurrent tasks' hunks** (e.g. the WindowsManagementManager Disk Repair hunk). Use mtimes against the role-file or task start time to attribute them, and review only this task's hunks.
- **Parity rows.** A pending-linux row needs an `[shell-linux] align` task. The owner only lists the request; the orchestrator must create the task, so flag it if none exists. Also check that "platform-only" rows do not hide behavior that Linux could share. Counterpart requests should name the existing Linux helpers to reuse (e.g. `desktop_shortcut_manager.sh` `_dsm_*`).
- **Parser check.** Only Windows PowerShell 5.1 is installed (no pwsh). Use `powershell.exe -NoProfile -Command` with `[System.Management.Automation.Language.Parser]::ParseFile`.
- **Preview vs real run.** Even when both call one decision function, preview decides followers against the pre-run state. Trace multi-item groups (copy-mode followers, followers of a "replace" winner) and implicit mkdir/link records; preview often mislabels them (seen in shell-windows-2 round 2, non-blocking).
- **mtime attribution in Git Bash.** `find -newermt "YYYY-MM-DD HH:MM:SS"` is read as UTC. Add `+1000`, or every file after 01:xx local shows as new. Directory mtimes of the desktops and category folders at or before the first run's time prove that later runs changed nothing.
- **Align tasks** are listed in `.claude/agents_shared/client_key_auth/TASKS.md` (for example shell-linux-2 for D12a). Grep there before flagging "no align task".

**Why:** these were the defects the owner's own report missed, even though it claimed a sandbox undo test passed.
**How to apply:** use this list on every shell-windows review. See [[ui-review-patterns]] for per-hunk coverage in shared files.
