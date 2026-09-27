# pycore-ui report

Scope (role map): `poly_apps/pycore_laravel_wordnew_ui/apps/{pycore-manager,laravel-manager,vortex,pdd-manager}/`, `poly_apps/pycore_laravel_wordnew_ui/flavors/vortex/`, and the shared UI layer by default (B2).

## pycore-runtime-D7P2-fix

- Task: `[pycore-ui] pycore-runtime-D7P2-fix`, the six blocking items of the pycore-lead verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2.json` (changes_requested).
- Status after round 3: all six items are still deferred. None is in the pycore-ui write scope.
  - The round-2 verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json` (changes_requested) confirms the deferral again. Its dispatch issue says a round on pycore-ui "cannot converge".
  - Round 3 was still dispatched to pycore-ui with the same six items, so it cannot converge either.
  - The owners are as before: pycore-lead does F-1; pycore-runtime writes B1, B2, B3, B5, B6 and the B4 docstring; pycore-ai adopts the B1 helpers afterwards.
- Decision (recommended option; guide §8 B1 "one writer per path, out-of-scope changes go to the owner through the orchestrator"; role file "write only inside your scope"): I edited no pycore file and no other role's report. The items go back to their owners.
  - I searched the record again (`REQUIREMENTS_20260927_CLIENT_KEY_AUTH_AUDIT_FIX.md` up to D30, `client_key_auth/TASKS.md`, `d22/*.json`, guide §8 B1-B16). It gives pycore-ui no temporary-writer assignment for these paths. B2 (temporary writer) covers only the shared UI layer.
  - The round-3 dispatch text sets no writer either. It is a workflow-computed task, not the claude lead's assignment.
  - Writing these paths from pycore-ui would create a second writer next to pycore-runtime, which may be working them in parallel.
- Round-2 note applied: the stale "working-tree changes in progress" wording is gone. Those `pyctl/{tts,assist,agent_history}/` and `pyutils/tts/` changes are committed in 2f31f9cd3 and touch no B1-B6 file.
- State check (read-only, round 3, 2026-09-27 20:40): HEAD is 2f31f9cd3.
  - `git diff --stat HEAD` is empty for all six code files. It shows only `reports/pycore-runtime.md` (+104, another pycore-runtime task, 20:32:48).
  - The code files keep their pre-outage mtimes (15:50:36-17:17:57).
  - Every defect is re-confirmed:
  - B1: `local_queue_head_routes.py:30` still has `_MD5_RE = re.compile(r"^[0-9a-fA-F]{32}$")`, used at `:46`. `_sanitize_item_md5` (`:43-48`) drops a bad md5 but never lower-cases a good one.
    - `queue_center_contract.py:596` still builds `f"text:{str(text or '').strip().lower()}"`.
    - The docstring clause "matching ``build_local_task`` and ``audio_resource_ledger.resource_key``" is still at `:585-586`. It wraps a line, so a single-line grep misses it.
    - `word_identity_md5` and `word_identity_content` do not exist anywhere under `pycore/` or `pyapps/`.
  - B2: `local_queue_head_routes.py:57` still has `_sanitize_item_md5(dict(item))`, which forwards the whole item, `task` included.
  - B3: `snapshot_service.py:549-550` still has `if applied: worker.request_pull(prefer_remote=True)` with no gate. `restore_complete` occurs 0 times in the file. `wake_workers` (`:362-371`) has the callback check only.
  - B4: `serialized_worker.py:42-43` still has `if not response_signal: return`. `BusTaskThread.run` (`:124-146`) catches into `_error_response` and prints nothing. The `event_handlers.py:431-434` docstring still says the failure "still propagates to the bus-task thread boundary".
  - B5: `delivery_diff.py:257` has `f"{DELIVERY_BATCH_PATH}/{batch_id}/content"` and `:274` has `f"{DELIVERY_BATCH_PATH}/{batch_id}"`. No pycore code reads `routes.batch_content`/`routes.batch_status`. The history comments are still at `delivery_diff.py:39-40` and `queue_center_contract.py:220-222`.
  - B6: `reports/pycore-runtime.md` has 0 `pycore-runtime-D7P2` matches. Its sections are `pycore-assist-D7-fix` (:3) and `pycore-runtime-D7` (:107).
- Changed files (this task): this report only.

### Per item

| Item | Status | Files (owner) | Verification in this task | Deferral / cross-scope note |
|---|---|---|---|---|
| B1: X4 word-identity helper pair | deferred | `pycore/pyutils/common/queue_center_contract.py`, `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (pycore-runtime) | Unchanged at 2f31f9cd3 (see state check). UI side (my scope): the only UI caller (`OrchManifestPanel.tsx:100-104`) sends no `md5`, so lower-casing it needs no UI change. | pycore-runtime implements. pycore-ai then adopts the helpers at `audio_resource_ledger.py:42` and `audio_queue_center.py:146`. |
| B2: promote RPC drops `items[].task` | deferred | `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (pycore-runtime) | Unchanged at `:57`. UI contract check (my scope): the only caller, `apps/pycore-manager/pages/audio-orchestration/OrchManifestPanel.tsx`, sends `{queue, items: [{kind, language, text}], owner}`. The payload type in `core/integrations/pycore/PycoreApiLocal.ts:429-434` allows only `{kind?, language, text}`. Building RPC items from language/text/kind/content_id plus the md5 breaks no UI path. | pycore-runtime implements. The in-process `task` support of `promote_local_head` (used by `orch_promote.py:60-64`) stays. No UI change is needed. |
| B3: gate the snapshot head-ticket wake | deferred | `pycore/pyctl/queue_center/snapshot_service.py` (pycore-runtime) | Unchanged at `:549-550`; `restore_complete` has 0 references. | pycore-runtime implements one wake-gate helper (heartbeat callback enabled + `restore_complete(lane)`), shared by `wake_workers` and `apply_head_event`. |
| B4: visible boot-chain failure | deferred | `pycore/pyfoundations/serialized_worker.py` (pycore-lead, F-1); `pycore/pyctl/runtime/event_handlers.py` docstring (pycore-runtime) | The swallow path is confirmed statically: `serialized_worker.py:42-43` and `:124-146`. F-1 is not done (file mtime 15:50:36). The red-line re-check waits for F-1. | Order: pycore-lead F-1 first (verified by the reviewer service), then the pycore-runtime docstring rewrite, then the red-line re-check. |
| B5: batch URLs from contract templates, drop history comments | deferred | `pycore/pyutils/laravel/delivery_diff.py`, `pycore/pyutils/common/queue_center_contract.py` (pycore-runtime) | Unchanged at `delivery_diff.py:257`, `:274`, `:39-40` and `queue_center_contract.py:220-222`. | pycore-runtime implements, using `routes.batch_content`/`routes.batch_status` (`config/queue_center_contract.json:294-295`). |
| B6: pycore-runtime D7P2 report section | deferred | `.claude/agents_shared/reports/pycore-runtime.md` (pycore-runtime's own report) | Not written (0 matches at 20:40). A role writes only its own report. | pycore-runtime writes it after B1-B5, with the per-file EOL result and the B1-B5 outputs. |

### Checks

- Round 3 used read-only commands only: `git log`/`git status`/`git rev-parse`/`git diff --stat HEAD`, plus grep, sed and `ls -l` over the files above. No build, type-check, test or service was run, because nothing in my scope changed. No Laravel change, so no FrankenPHP restart.
- Report EOL, round 3 (Python bytes after the write): crlf=0, lone CR=0, no BOM, ends with LF, so the file stays LF.
- The fenced files (`scripts/shells/linux/common/{gvar_storage_common,shared_cache_env,gvar_common,mount_common,pyservice_entry}.sh`, `SharedCacheEnv.ps1`) were not touched.

### pycore-ui backlog (in scope, not part of this task, not changed)

- `OrchManifestPanel.tsx:105` throws `response.error || ORCH_L.actionFailed`, but the promote route returns `error_code` (`local_queue_head_routes.py:62,65`). The panel therefore always shows the generic i18n text.
  - Left for a later pycore-manager task, after B2 lands so the error codes are final.
  - The fix is to map `error_code` to an i18n message.
  - Not done in round 3 (recommended option): it is not a task item, and the route's error codes may change with B2.

### Handoff

- Blockers:
  - B1-B6 need their owners (see the re-dispatch in `reviews/pycore-runtime-D7P2-fix.json`).
  - The workflow keeps routing `pycore-runtime-D7P2-fix` to role pycore-ui. Round 3 did too, after the round-2 verdict asked the orchestrator to change it.
  - Escalation to the orchestrator/workflow author:
    - dispatch `pycore-runtime-D7P2-fix` with role `pycore-runtime`;
    - dispatch F-1 as its own `[pycore-lead]` task, verified by the reviewer service;
    - stop routing further rounds to pycore-ui.
- Next owners:
  - pycore-lead: F-1, then a re-review of `pycore-runtime-D7P2`.
  - pycore-runtime: B1, B2, B3, B5, the B4 docstring, then B6.
  - pycore-ai: adopt the B1 helpers.
- Verdict for this task: pycore-ui has no further work on it. pycore-lead records the verdict against the re-dispatched task.
