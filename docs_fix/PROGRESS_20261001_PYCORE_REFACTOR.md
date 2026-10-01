# PROGRESS 2026-10-01 — pycore Root-Level Refactor

Source audit: `docs_fix/AUDIT_20261001_PYCORE_DUPLICATION_REFACTOR.md`.

User directive (2026-10-01):
1. Merge rpc_v2 into `rpc` and delete the old code.
2. Merge relay into one relay with no version number.
3. Correct the spec clauses.
4. Clean up and merge duplicate implementations.
5. Refactor at the root with a changed technical approach, not patches.
6. Then write this progress document.

## Phase 0 — done by the coordinator

**rpc rename.** `pycore/pyutils/rpc_v2` became `pycore/pyutils/rpc`.
- All `rpc_v2` / `RPC v2` / `RpcV2` identifiers were renamed in pycore, pyapps, the Laravel `CallPycoreUtils`, scripts, pyservice.ps1/sh, and `config/pycore_relay_contract.json`. 103 files changed.
- The dead legacy `rpc` metadata entry was removed from `pythreadpool/registry.py`; the surviving service key is `rpc`.
- Out of scope: `ncore` (the Node runtime) keeps its own `rpc`/`rpc_v2`.

**Spec rewrite.** `development-guides/PYTHON_PYCORE.md` now has:
- a corrected layer table (pygvar in pyfoundations; pythreadpool, pyheartbeat and pylauncher placed; pyutils may depend on database)
- try/except allowed only at boundaries
- the singleton exception clauses
- a complete threading rule
- the canonical primitives table
- bans on version numbers in names, on compatibility shims, and on demo/dead code
- the single-relay rule

**New canonical primitives:**
- `pyfoundations/time_utils.py`
- `pyfoundations/net_probe.py`
- `pyfoundations/text_eol.py`, which replaces `pyutils/codesync/textnorm.py` (deleted); importers were updated
- `pyfoundations/backoff_wait.Backoff`
- `database/adapters/sqlite_local.open_wal_connection` and `SQLITE_BUSY_TIMEOUT_MS`

**Incident.** A background gitsync job auto-committed a mid-rename state. In that commit 63 CRLF files had been rewritten as LF. Their CRLF endings were restored against the parent commit.

## Phase 1 — parallel workstreams

### A. Relay unification
_pending_

### B. Laravel transport, HTTP stack, workers
_pending_

### C. Speech / AI stack
_pending_

### D1. Foundations, database, launcher, thread pool
_pending_

### D2. Desktop / UI / launcher / tool domains and pyctl apps
_pending_

### E. RPC, events, codesync, callmodule
**Blocked.** The permission classifier denied spawning this workstream ("Modify Shared Resources"). It is waiting for the user's decision.

Planned scope:
- one event journal (SSE and WS as two views of it)
- merge the two `/code-sync` servers
- merge the CLIs (`pyservice_cli` and `codesync/cli.py`)
- delete the `codesync/runtime.py` hook layer
- a RunningFlag lifecycle helper
- codesync locks, accessors and atomic writes
- one entry point (`pycore_module_caller.py` vs `callmodule/__main__.py`)
- callmodule reduced to routing only

## Open items / not done
_pending_
