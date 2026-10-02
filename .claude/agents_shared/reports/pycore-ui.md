# pycore-ui report

Scope (role map): `poly_apps/pycore_laravel_wordnew_ui/apps/{pycore-manager,laravel-manager,vortex,pdd-manager}/`, `poly_apps/pycore_laravel_wordnew_ui/flavors/vortex/`, and the shared UI layer by default (B2).

## pycore-ui-G1

- Task: `[pycore-ui] pycore-ui-G1`: p5-01, p4-01, AOQSD-37, AOQSD-25, AOQSD-28, AOQSD-30. It was released by the approved `reviews/ui-pycore-manager-D7.json`, which also reviewed the p4-02/p5-01 half first.
- Status: all six items are done and wait for the pycore-lead verdict. Diff base 74e7770. HEAD moved during the task (the user's `win0.0.1` commits ab566fdf7 and 93f8de054), and 93f8de054 already contains most of these edits. Other hunks since 7bed0a953 in the same files are only mode changes by that commit (0/0 numstat).
- UI root below: `poly_apps/pycore_laravel_wordnew_ui/` (UI/).

### Per item

| Item | Status | Files | Verification | Deferral / cross-scope |
|---|---|---|---|---|
| p5-01 (+p4-02) | done (already on HEAD from the D7 partial; this task re-verified it and changed nothing) | `core/contracts/QueueCenterContract.ts`, `core/contracts/QueueCenterTypes.ts`, `core/integrations/pycore/PycoreHttpRoutes.ts`: no change needed | The Grep tool over UI/ (excluding node_modules and dist) finds `stream_events\|GLOBAL_TASK_STREAM_EVENTS_BY_ROLE\|wordAudioFetchYoudao`: **0 hits**. `stopping` is in `QueueCenterTypes.ts:10` and `QueueCenterContract.ts:257`. The labels exist in en and zh (dumped from the composed locale): `queueCenter.sectionState.stopping` = stopping / 停止中 and `queueCenter.wordAudioQueue.lifecycle.stopping` = stopping / 停止中. They are rendered at `PcQueueCenterPage.tsx:91` and `PcWordAudioPanel.tsx:48-53`, the only places the lifecycle shows. | RV-004: the UI has no reader of `task_contract.stream_events` left, so **the orchestrator can delete the key** (`config/queue_center_contract.json`). pycore-lead has no live session (ListAgents lists only ca-orchestrator/main, core-node-e9 and ct-laravel-remote), so the notice is recorded here and in the task's cross_scope output. |
| p4-01 | done | `pc-locales/OrchLocales.ts` (new `orchMessages{En,Zh}` for the 39 `orch_messages` codes and `orchMessageValues{En,Zh}` for the coded param values), `pc-locales/PcEnFeatures.ts`/`PcZhFeatures.ts` (`audioOrchestration.messages`/`messageValues`, plus the new `ttsReasons` section with the 17 AT-050 codes), `pages/audio-orchestration/OrchManifestPanel.tsx`, `components/PcAudioLaneFullSyncRow.tsx`, `components/PcDeliveryOutboxStatus.tsx`. Also needed (all inside pycore-ui scope): `pc-locales/PcEnCore.ts`/`PcZhCore.ts`, `utils/pcErrorCodes.ts`, `pages/audio-orchestration/{orchShared.ts,OrchTaskList.tsx}`, `components/{PcPipelineStatusPanels,PcTtsServerControls,PcTestPopup}.tsx`, and the B2 types `core/integrations/pycore/{PycoreApiLocal,PycoreApiOrchestration,PycoreSpeechTypes}.ts` and `core/contracts/QueueCenterTypes.ts` | Scratch `verify_codes.py`. It greps orch_messages, tts_reason_codes, the qwen operation codes, the ROUTE_ERROR_* constants, the contract `delivery.error_codes.kind_unsupported`, the LARAVEL_ERROR_* constants and the literal `error`/`error_code` codes of the queue-head, full-sync, task-center, lane-activation, wiring and audio-orchestration sources. It checks them against the locale objects that `bun` dumps from `pc-locales/en.ts`/`zh.ts`. Result: orch messages 39/39, ttsReasons 17/17, errorCodes 24/24 in both en and zh, **TOTAL MISSING: 0**. The first run found 2 extra codes, `ORCH_SOURCE_UNKNOWN` and `QY_WORD_GROUP_NOT_FOUND`, and both were added. `grep 'response.error'` in the three components: **0 hits**. A bun render check through the real i18n in en and zh localized the code params (for example `orch_segment_concat_failed` with `error=orch_ffmpeg_concat_failed`) and kept the text param `text=done` raw. | Routes that still send the code under `error` are read too (`error_code` first, then a code-valued `error`). The UI never shows raw text. The pycore side of the remaining English strings is listed under cross-scope. |
| AOQSD-37 (+42) | done | `components/PcAudioLaneQueueView.tsx`, `api/AudioLaneStateStore.ts`, `hooks/useQueueCenterHub.tsx`, `pages/audio-orchestration/orchShared.ts`. Also changed: `pages/PcQueueCenterPage.tsx` (the render site of the `setControl` error), plus one line each in `OrchBookPicker.tsx:36` and `OrchTaskEditor.tsx:116`, which rendered `String(r.error)` | grep `\.message\b\|payload\.error` in the four files finds only `orchShared.ts:39`: `failure?.message` is used as a code lookup key and is never rendered. The store keeps a pycore error code (`error_code`, then `error`, else `PC_REQUEST_FAILED_CODE`). The view renders `pcErrorCodeText(code)`, falling back to `common.requestFailed` (en "The request failed." / zh "请求失败。"). `errorCodes.PYCORE_REQUEST_FAILED` exists in en and zh. The hub's `centerUnavailable` no longer carries JS text (it was rendered by `PcAssistStrip.tsx:77`). Every loading path ends in data, the `unavailable` empty state, or a localized error. | none |
| AOQSD-25 (+40) | done | `hooks/useQueueCenterHub.tsx`, `pages/PcQueueCenterPage.tsx` | `patchSectionEnabled` has 0 hits (the optimistic flip and the rollback are deleted). `throw new Error` has 0 hits in the hook. A failure throws a `PcLocalizedError` built from `pcFailureMessage(response, controlFailed)`. The switch shows pending through the existing `busyScope` (disabled, 50% opacity) until pycore answers. Only `response.lane_state` is applied, with a hub poll when a lane state is absent or older. | none |
| AOQSD-28 | done | `api/AudioLaneStateStore.ts`. `OrchTaskLaneProgress.tsx` needed no change: it only passes `owner.loading`/`owner.error`, and the view localizes them | Static read of `useAudioLaneOwnerViews`: if the lane revision moves while a fetch is in flight, `trailingFetch` is set. In `finally` the hook clears `inFlight` and resets `loading` on every exit, including a cancelled (cleaned-up) effect. It then bumps `trailingTick`, which re-runs the debounced fetch. The owner views reset when the owner changes. The shared `audioLaneRevisionKey()` is exported and reused by OrchManifestPanel. | none |
| AOQSD-30 | done | `pages/audio-orchestration/OrchManifestPanel.tsx`, plus `OrchTaskList.tsx` (the dead `running` prop is removed at the call site) | grep `setInterval\|promotedIds` in OrchManifestPanel.tsx: **0 hits**. The panel subscribes through `useAudioLaneState()`. It reloads the shown category and page 800 ms after the lane revision moves, and only if that revision is newer than the one shown. A request sequence drops stale responses. The promote button state comes from pycore's `queue_state` only (queued/processing means already at the head). | none |

### Decisions (recommended option, B9)

- The route error codes go into the existing `errorCodes` block in `PcEnCore.ts`/`PcZhCore.ts`, the one that `pcErrorCodeMessage` already resolves, rather than a second table in the Features files. The locales compose by a shallow spread, so an `errorCodes` key in Features would overwrite Core. The Features files carry the new `ttsReasons` section and the orchestration message maps.
- The orchestration log and progress lines and the TTS reasons fall back to pycore's own English rendering (`message`, `disabled_reason`, `error`) only when a row has no code. That covers rows stored before AT-039/AT-050, and it is the fallback those pycore items documented. pycore guarantees that rendering carries no exception text. Every current code is localized (the script result above).
- Only `status`, `kind`, `lane`, `source` and `error` params are localized as codes or enumerated values. Free text such as `text` is never mapped, so a vocabulary word like "done" stays as it is.
- One shared helper set lives in `utils/pcErrorCodes.ts`, with no duplicate implementations: `pcCodeText`, `pcErrorCodeText`, `pcFailureCode`, `pcFailureMessage` (the existing, previously unused function, extended), `pcCaughtErrorMessage`/`PcLocalizedError` and `pcTtsReasonText`. `orchSyncFailureMessage` now delegates to `pcFailureMessage`.

### Checks

- RAM: 5.29 GB free before the baseline and 5.2 GB before the re-check (guard is 3 GB).
- `node node_modules/typescript/bin/tsc --noEmit -p .` in UI/: the baseline before any change exits 0 with 0 errors. After the change it exits 2 with 2 errors, both in `apps/codemart/components/access/CmCapabilityGate.tsx:4`: `cmRoleForCapability`/`CmAccessRole` are no longer exported by `apps/codemart/auth/cmPageAccess.ts`. That is codemart's parallel edit (16 lines removed, in 93f8de054), not a pycore-ui file. pycore-manager and core/ have **0 errors**.
- Line endings. At 21:31:40 another actor rewrote about 25 pycore-manager files into CRLF working copies with mode 100755 (autocrlf=true; the index stays LF). Each file I edited keeps the line endings it had when I edited it. CRLF files were edited byte-level with CRLF lines. `OrchTaskList.tsx` was briefly written LF by my first edit and was restored to all-CRLF. `git diff --numstat 7bed0a953` equals the `--ignore-space-at-eol` numstat for every file I touched, so there is no EOL churn. This report stays LF with no BOM.
- No build, service or test was run. No Laravel change was made, so no FrankenPHP restart was needed. No git write. The fenced files (`scripts/shells/linux/common/{gvar_storage_common,shared_cache_env,gvar_common,mount_common,pyservice_entry}.sh`, `SharedCacheEnv.ps1`) were not touched.

### Cross-scope notes (not changed; for pycore-lead to route)

- Orchestrator: delete `task_contract.stream_events` (RV-004; no UI reader left).
- pycore-runtime (AOQSD-21-fu):
  - `local_task_center_routes.py` still returns English: `control_name is required`, `task_id is required`, `lane must be word or sentence`.
  - `task_center_service.set_queue_center_control` puts its codes (`UNKNOWN_QUEUE_CENTER_LANE`, `LARAVEL_ENDPOINT_BIND_FAILED`) under `error`, and joins raw runtime errors into `error`. It should use `error_code`.
  - `orch_service.py:254,259` returns the English `not logged in` and `word group selection could not be persisted`.
  - The UI already shows these only as localized fallbacks.
- pycore-ai: `audio_lane_full_sync.start_background` still uses the bare `error` key. The UI reads either key. `tts_orchestrator.test` returns uncoded English (`no TTS engine available`, `<engine> does not support language`), which the test popup shows as is until those get codes.
- pycore-ui backlog (not in G1): `PcDeliveryOutboxStatus.tsx` still renders `last_error` and `diff.error` raw. `PcTestPopup.tsx` keeps its pre-existing English strings (CKA-15/AT-049).

### Handoff

- Changed files (UI/): `apps/pycore-manager/{api/AudioLaneStateStore.ts, components/PcAudioLaneFullSyncRow.tsx, components/PcAudioLaneQueueView.tsx, components/PcDeliveryOutboxStatus.tsx, components/PcPipelineStatusPanels.tsx, components/PcTestPopup.tsx, components/PcTtsServerControls.tsx, hooks/useQueueCenterHub.tsx, pages/PcQueueCenterPage.tsx, pages/audio-orchestration/{OrchBookPicker.tsx, OrchManifestPanel.tsx, OrchTaskEditor.tsx, OrchTaskList.tsx, orchShared.ts}, pc-locales/{OrchLocales.ts, PcEnCore.ts, PcZhCore.ts, PcEnFeatures.ts, PcZhFeatures.ts}, utils/pcErrorCodes.ts}`, `core/contracts/QueueCenterTypes.ts`, `core/integrations/pycore/{PycoreApiLocal.ts, PycoreApiOrchestration.ts, PycoreSpeechTypes.ts}`, and this report.
- Blockers: none. Next owner: pycore-lead (verdict `reviews/pycore-ui-G1.json`), then the orchestrator for RV-004.

## pycore-runtime-D7P2-fix

- Task: `[pycore-ui] pycore-runtime-D7P2-fix`, the six blocking items of the pycore-lead verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2.json` (changes_requested).
- Status after round 3: all six items are still deferred. None is in the pycore-ui write scope.
  - The round-2 verdict `.claude/agents_shared/reviews/pycore-runtime-D7P2-fix.json` (changes_requested) confirms the deferral again. Its dispatch issue says a round on pycore-ui "cannot converge".
  - Round 3 was still dispatched to pycore-ui with the same six items, so it cannot converge either.
  - The owners are as before: pycore-lead does F-1; pycore-runtime writes B1, B2, B3, B5, B6 and the B4 docstring; pycore-ai adopts the B1 helpers afterwards.
- Decision (recommended option; guide §8 B1 "one writer per path, out-of-scope changes go to the owner through the orchestrator"; role file "write only inside your scope"): I edited no pycore file and no other role's report. The items go back to their owners.
  - I searched the record again (`DESIGN_AUTH_IDENTITY.md` up to D30, `client_key_auth/TASKS.md`, `d22/*.json`, guide §8 B1-B16). It gives pycore-ui no temporary-writer assignment for these paths. B2 (temporary writer) covers only the shared UI layer.
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
