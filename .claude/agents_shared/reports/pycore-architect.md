# pycore-architect report

Session: ct-pycore-architect (independent-sessions mode). Updated 2026-09-28.

## Status

- In reserve, per orchestrator ruling R2 (`docs_fix/TASK_20260928_TEAM_RESUME_ROSTER.md`). `pycore-lead` is the default writer for `pycore/pyfoundations/`, `pycore/pythreadpool/` and `pycore/pyheartbeat/`. I edit only when a task names me as temporary writer.
- Under ruling R4, the arch-audit and the rest of the carried backlog stay on hold until the user's next task.
- The shared task list is empty. I have no uncommitted edits and no task in progress.

## Tasks

| Task | Subject | Status | Next owner |
|---|---|---|---|
| pycore-architect-D7 | pyfoundations lane (arch-bus-signals, LTCW-02, LTCW-03-exports, CKA-04, AHSC-21, LTCW-20) | approved (`reviews/pycore-architect-D7.json`) | none |
| arch-audit (d22 `items_pycore.json:415`) | Read-only conformance audit of all pycore against `PYTHON_PYCORE.md`, with fixes only in the foundations | on hold (R2/R4): waits for the user's task | orchestrator assigns (pycore-architect, or pycore-lead as default writer) |
| D30 pyfoundations items (`d30/audit_by_owner.md`, listed under "pycore-lead") | Namespace fixes in `system_paths.py`, `pygvar.py`, `core_node_dirs.py`, `shortcut_manager.py`, `pg_sync_adapter.py` | blocked: the drive_layout freeze (P1b-G1) and the missing contract keys (tool_root, temp_root, app_root) | orchestrator (contract), then pycore-lead (R2 default writer) |

## Open non-blocking notes (from the D7 verdict, all inside pyfoundations; default writer pycore-lead under R2)

- `third_party/_dep_check.py:44-47`: use one `PLATFORM_ONLY_PACKAGES` lookup instead of a second platform switch. Leave the Windows branch under the user's "DO NOT MODIFY" comment unchanged.
- `third_party/api.py:42/:288`: also re-export `LINUX_ONLY_PACKAGES`.
- `desktop_session.py:232, :243-245`: move the inline `XDG_SESSION_TYPE`, `XDG_CURRENT_DESKTOP` and `DESKTOP_SESSION` reads to `*_ENV` constants.
- `system_paths.py:121`: the `MyBest1..N` example is stale; the slot families are now `ark*` and `Kimi*`.
- `core_node_dirs.py:3`: the "stdlib-only" docstring is stale.

## Blockers

- The D30 items wait for the orchestrator's contract keys and for the drive_layout freeze to lift.
