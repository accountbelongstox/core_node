---
name: terminal-state-normalized
description: 2026-10-05 terminal state storage rebuilt (normalized SQLite, write-through model, reader owner); import checks migrate the LIVE db unless env is redirected
metadata:
  type: project
---

Terminal state (`terminal_state_repository.py`, `database/repositories/terminal_state_{store,reader,legacy}.py`, schema `terminal_state_schema.py`) is now normalized tables `common_terminal_state_terminals` / `_logs` + view `_terminals_active`, `PRAGMA user_version=1` marks the one-shot migration from the key/value table (dropped after copy). The repository owner keeps all records in memory (write-through, reloaded on `PRAGMA data_version` change from another process or after a failed transaction); point reads go through `TerminalStateReader` (query_only WAL connection on its own owner).

**Why:** /api/ui/terminal/content P50 1.4s came from a whole-store json_group_object scan per read on the same owner as the 1s reconcile.

**How to apply:**
- Importing `pycore.pyctl.terminal.terminal_state_repository` (or terminal_service / terminal_routes) builds the module instance and MIGRATES THE LIVE DB (D:\www\core_node\data\terminal_windows\state.sqlite3), which breaks a still-running old pycore ("no such table: common_terminal_state") until restart. For checks set `CORE_NODE_CACHE_DIR` and `CORE_NODE_DATA_DIR` to a scratch dir (APP_DATA_DIR = cache dir / data) and end with `os._exit(0)` after flushed prints.
- Old-vs-new parity harness idea: load HEAD~ versions of repository/store/keys/schema under a scratch package, patch `time.time_ns` and `utc_now_iso`, run identical random op sequences on two copies of the db (live copy via sqlite backup API).
- gitsync auto-commits mid-session, so `git show HEAD:` may already contain half of your change; pick the "old" commit with `git log -- <file>` plus a grep marker.
