# pycore-ui report

Scope (role map): `poly_apps/pycore_laravel_wordnew_ui/apps/{pycore-manager,laravel-manager,vortex,pdd-manager}/`, `poly_apps/pycore_laravel_wordnew_ui/flavors/vortex/`, and the shared UI layer by default (B2).

## pycore-runtime-D7P2-fix

- Task: `[pycore-ui] pycore-runtime-D7P2-fix`, the six blocking items of the pycore-lead verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2.json` (changes_requested).
- Status after round 2: all six items are still deferred. None is in the pycore-ui write scope.
  - The round-1 verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json` confirms the deferral was correct and the task was misrouted.
  - It re-dispatches as follows: pycore-lead does F-1; pycore-runtime writes B1, B2, B3, B5, B6 and the B4 docstring; pycore-ai adopts the B1 helpers afterwards.
- Decision (recommended option, B1 §8 "one writer per path"; role file "write only inside your scope"): I edited no pycore file and no other role's report. The items go back to their owners.
  - The requirements record (§1-§12), `d22/items_pycore.json` and `d22/merge_meta.json` give pycore-ui no temporary-writer assignment for these paths.
  - pycore-runtime may be working the same items in parallel, and two writers on these files would conflict.
- Round-1 corrections applied to this report:
  - The report is now LF, like the other files in `reports/`.
  - Line references are fixed: `serialized_worker.py:42-43` and `OrchManifestPanel.tsx:105`.
- State check (read-only, round 2): HEAD is 4ddb4be8e. `git diff --stat 4ddb4be8e` is empty for every B1-B6 file and for `reports/pycore-runtime.md`. The pycore/ working-tree changes now in progress (`pyctl/{tts,assist,agent_history}/`, `pyutils/tts/`) belong to other members and touch no B1-B6 file. Every defect is re-confirmed:
  - B1: `local_queue_head_routes.py:30` still has `_MD5_RE = re.compile(r"^[0-9a-fA-F]{32}$")`, used at `:46`. `queue_center_contract.py:596` still has `f"text:{str(text or '').strip().lower()}"`. `word_identity_md5` and `word_identity_content` do not exist.
  - B2: `local_queue_head_routes.py:57` still has `_sanitize_item_md5(dict(item))`, which forwards the whole item, `task` included.
  - B3: `snapshot_service.py:549-550` still has `if applied: worker.request_pull(prefer_remote=True)` with no gate.
  - B4: `serialized_worker.py:42-43` still has `if not response_signal: return`. `BusTaskThread.run` (`:124-146`) catches into `_error_response` and prints nothing. The `event_handlers.py:433-434` docstring still says the failure "still propagates to the bus-task thread boundary".
  - B5: `delivery_diff.py:257` has `f"{DELIVERY_BATCH_PATH}/{batch_id}/content"` and `:274` has `f"{DELIVERY_BATCH_PATH}/{batch_id}"`. The history comments are still at `delivery_diff.py:40` and `queue_center_contract.py:222`.
  - B6: `reports/pycore-runtime.md` has no `pycore-runtime-D7P2` match.
- Changed files (this task): this report only.

### Per item

| Item | Status | Files (owner) | Verification in this task | Deferral / cross-scope note |
|---|---|---|---|---|
| B1: X4 word-identity helper pair | deferred | `pycore/pyutils/common/queue_center_contract.py`, `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (pycore-runtime) | Unchanged at 4ddb4be8e (see state check). UI side (my scope): no UI caller sends `md5`, so the upper-case normalization needs no UI change. | pycore-runtime implements. pycore-ai then adopts the helpers in `audio_resource_ledger.py` and `audio_queue_center.py`. |
| B2: promote RPC drops `items[].task` | deferred | `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (pycore-runtime) | Unchanged. UI contract check (my scope): the only caller, `apps/pycore-manager/pages/audio-orchestration/OrchManifestPanel.tsx`, sends `{queue, items: [{kind, language, text}], owner}`. The payload type in `core/integrations/pycore/PycoreApiLocal.ts:429-434` allows only `{kind?, language, text}`. Building RPC items from language/text/kind/content_id plus the md5 breaks no UI path. | pycore-runtime implements. The in-process `task` support of `promote_local_head` (used by `orch_promote.py:60-64`) stays. No UI change is needed. |
| B3: gate the snapshot head-ticket wake | deferred | `pycore/pyctl/queue_center/snapshot_service.py` (pycore-runtime) | Unchanged at `:549-550`. | pycore-runtime implements one wake-gate helper (heartbeat callback enabled + `restore_complete(lane)`), shared by `wake_workers` and `apply_head_event`. |
| B4: visible boot-chain failure | deferred | `pycore/pyfoundations/serialized_worker.py` (pycore-lead, F-1); `pycore/pyctl/runtime/event_handlers.py` docstring (pycore-runtime) | The swallow path is confirmed statically: `serialized_worker.py:42-43` and `:124-146`. | Order: pycore-lead F-1 first (verified by the reviewer service), then the pycore-runtime docstring rewrite, then the red-line re-check. |
| B5: batch URLs from contract templates, drop history comments | deferred | `pycore/pyutils/laravel/delivery_diff.py`, `pycore/pyutils/common/queue_center_contract.py` (pycore-runtime) | Unchanged at `:257`, `:274`, `:40` and `:222`. | pycore-runtime implements, using `routes.batch_content`/`routes.batch_status` (`config/queue_center_contract.json:294-295`). |
| B6: pycore-runtime D7P2 report section | deferred | `.claude/agents_shared/reports/pycore-runtime.md` (pycore-runtime's own report) | Not written. A role writes only its own report. | pycore-runtime writes it after B1-B5, with the per-file EOL result and the B1-B5 outputs. |

### Checks

- Read-only only: `git log`/`git status`/`git diff --stat`, plus grep and sed over the files above. No build, type-check, test or service was run, because nothing in my scope changed. No Laravel change, so no FrankenPHP restart.
- The report EOL is checked with Python bytes after the write (see the handoff).
- The fenced files (`scripts/shells/linux/common/{gvar_storage_common,shared_cache_env,gvar_common,mount_common,pyservice_entry}.sh`, `SharedCacheEnv.ps1`) were not touched.

### pycore-ui backlog (in scope, not part of this task, not changed)

- `OrchManifestPanel.tsx:105` throws `response.error || ORCH_L.actionFailed`, but the promote route returns `error_code` (`local_queue_head_routes.py:62,65`). The panel therefore always shows the generic i18n text. This is left for a later pycore-manager task, preferably after B2 lands so the error codes are final.

### Handoff

- Blockers: B1-B6 need their owners (see the re-dispatch in `reviews/pycore-runtime-D7P2-fix.json`).
- Next owners:
  - pycore-lead: F-1, then a re-review of `pycore-runtime-D7P2`.
  - pycore-runtime: B1, B2, B3, B5, the B4 docstring, then B6.
  - pycore-ai: adopt the B1 helpers.
- Verdict for this task: pycore-ui has no further work on it. pycore-lead records the verdict against the re-dispatched task.
