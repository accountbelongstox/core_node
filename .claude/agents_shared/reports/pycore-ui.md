# pycore-ui report

Scope (role map): `poly_apps/pycore_laravel_wordnew_ui/apps/{pycore-manager,laravel-manager,vortex,pdd-manager}/`, `poly_apps/pycore_laravel_wordnew_ui/flavors/vortex/`, and the shared UI layer by default (B2).

## pycore-runtime-D7P2-fix

- Task: `[pycore-ui] pycore-runtime-D7P2-fix`, the six blocking items of the pycore-lead verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2.json` (changes_requested).
- Status: all six items deferred. None is in the pycore-ui write scope. The verdict and `reports/pycore-lead.md` ("Review pycore-runtime-D7P2") name pycore-runtime as the owner (extra assignment), and pycore-lead as the owner of F-1 for B4.
- Decision (recommended option, B1 §8 "one writer per path"; role file "write only inside your scope"): I did not edit any pycore file or another role's report, and I am returning the items to pycore-lead for re-dispatch.
  - The requirements record (§1-§12) and the pycore-lead report give pycore-ui no temporary-writer assignment for these paths.
  - pycore-runtime may be running the same assignment in parallel, and two writers on these files would conflict.
- State check (read-only): HEAD is 8f95a2a24, the verdict's HEAD. `git status` is clean for every file involved. The reviewed line references still hold:
  - `snapshot_service.py:549-550`: an ungated `worker.request_pull(prefer_remote=True)`. `wake_workers` at `:362-371` has the callback gate.
  - `event_handlers.py:423-439`: try/finally with no except. The docstring still says the error "propagates to the bus-task thread boundary".
  - `serialized_worker.py:40-41`: `_publish_response` returns when there is no `response_signal`. `:136-146`: `BusTaskThread.run` catches the error.
  - `delivery_diff.py:257` and `:274`: suffix-built batch URLs. `:39-40`: the "used to keep its own copy" comment.
  - `queue_center_contract.py:220-222`: the "used to keep their own copies" comment.
  - `local_queue_head_routes.py:30`: `_MD5_RE` (accepts upper-case). `:43-48`: `_sanitize_item_md5`. `:56-60`: whole item dicts are forwarded.
- Changed files (this task): this report only.

### Per item

| Item | Status | Files (owner) | Verification in this task | Deferral / cross-scope note |
|---|---|---|---|---|
| B1: X4 word-identity helper pair | deferred | `pycore/pyutils/common/queue_center_contract.py`, `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (pycore-runtime) | Code unchanged since the review. `_MD5_RE = re.compile(r"^[0-9a-fA-F]{32}$")` is still at `:30`. No pycore reader of `word_identity.fallback_when_md5_absent.key_format` (grep). UI side (my scope): no UI caller sends `md5`, so the upper-case normalization needs no UI change. | pycore-runtime implements. pycore-ai then adopts the helper in `audio_resource_ledger.py:42,52` and `audio_queue_center.py:140` (non-blocking follow-up in the verdict). |
| B2: promote RPC drops `items[].task` | deferred | `pycore/callmodule/rpc_routes/local_queue_head_routes.py` (pycore-runtime) | Handler `:53-66` still forwards `dict(item)` whole. UI contract check (my scope): the only caller, `apps/pycore-manager/pages/audio-orchestration/OrchManifestPanel.tsx:100-104`, sends `{queue, items: [{kind, language, text}], owner}`. The payload type in `core/integrations/pycore/PycoreApiLocal.ts:429-434` allows only `{kind?, language, text}`. Building server items from language/text/kind/content_id/md5 therefore breaks no UI path. | pycore-runtime implements. No UI change is needed. |
| B3: gate the snapshot head-ticket wake | deferred | `pycore/pyctl/queue_center/snapshot_service.py` (pycore-runtime) | `:549-550` still calls `request_pull(prefer_remote=True)` with no callback or `restore_complete` check. | pycore-runtime implements one shared wake-gate helper for `wake_workers` and `apply_head_event`. |
| B4: visible boot-chain failure | deferred | `pycore/pyfoundations/serialized_worker.py` (pycore-lead, F-1); `pycore/pyctl/runtime/event_handlers.py` docstring (pycore-runtime) | Swallow path confirmed statically: `_publish_response` returns at `:40-41` when `response_signal` is empty. | Order: pycore-lead F-1 first, then the pycore-runtime docstring rewrite, then the red-line re-check. |
| B5: batch URLs from contract templates, drop history comments | deferred | `pycore/pyutils/laravel/delivery_diff.py`, `pycore/pyutils/common/queue_center_contract.py` (pycore-runtime) | `:257` still has `f"{DELIVERY_BATCH_PATH}/{batch_id}/content"` and `:274` still has `f"{DELIVERY_BATCH_PATH}/{batch_id}"`. Both comments are still present. | pycore-runtime implements. |
| B6: pycore-runtime D7P2 report section | deferred | `.claude/agents_shared/reports/pycore-runtime.md` (pycore-runtime's own report) | Not written. A role writes only its own report. | pycore-runtime writes it after B1-B5, with the per-file EOL result and the B1-B5 outputs. |

### Checks

- Read-only only: grep and sed over the files above, plus `git status`/`git log`. No build, type-check, test or service was run, because nothing in my scope changed. No Laravel change, so no FrankenPHP restart.
- The fenced files (`scripts/shells/linux/common/{gvar_storage_common,shared_cache_env,gvar_common,mount_common,pyservice_entry}.sh`, `SharedCacheEnv.ps1`) were not touched.

### Non-blocking UI note (in scope, not changed, not assigned)

- `OrchManifestPanel.tsx:106` throws `response.error || ORCH_L.actionFailed`, but the promote route returns `error_code` (`local_queue_head_routes.py:62,65`). The panel therefore always shows the generic i18n text instead of a code-specific message. This is recorded for a later pycore-manager task and has no functional impact on B1-B6.

### Handoff

- Blockers: B1-B6 need their owners.
- Next owners:
  - pycore-lead: re-dispatch B1-B3, B5, B6 and the B4 docstring to pycore-runtime; do F-1 itself.
  - pycore-runtime: implement; then pycore-lead re-reviews `pycore-runtime-D7P2`.
- Verdict for this task: none is needed from pycore-ui. pycore-lead records it against the re-dispatched task.
