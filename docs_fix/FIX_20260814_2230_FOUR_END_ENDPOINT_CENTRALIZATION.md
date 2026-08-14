# Four-End API Path Centralization + word_audio diff 500 Root Cause

Date: 2026-08-14 22:30
Status: Applied; static verification complete; runtime verification pending
user-run (Laravel/pycore restart, extension and UI rebuild)

Scope: Laravel main, pycore, pycore-manager UI / wordnew UI, mcp-chrome

## 1. Production symptom under investigation (`_prompts/new2.txt`)

```
GET /api/queue-center/queues/word_audio/diff -> 500 (221-272ms)   # every 1s
[Scheduler] Callback 'tts_queue_poller' error: Laravel queue diff
failed for word_audio: HTTP 500
```

## 2. Root cause of the 500

Static re-derivation of the full call chain found no defect:

`QueueCenterController::diff` → `QueueSliceDiffService::snapshot` →
`QueueCenterCacheStore` (file store) + `GlobalTask::pendingHeadTaskIds`
(`queue_position` ordering) + `QueueCenterMetricsService::progress`.

- Replaying the exact service via tinker returned HTTP 200 with a correct
  payload.
- The live Laravel instance (started 22:10:41) answers the same request
  with 200 on both audio lanes.
- The pull path (`/api/worker/tasks/word_audio/pull`), which succeeded in the
  same log window, orders by the same `queue_position` column, proving the
  column existed.

Conclusion: the failing 22:08 process served **stale pre-refactor code**
(the `queue_position` / contract alignment landed 21:55-21:58, after that
process started). The fix is operational — restart the Laravel runtime after
schema/contract changes; `sys:init` aligns `global_tasks.queue_position` and
its index idempotently (`GlobalTaskSystemInitializer`).

## 3. Defect fixed this round: route paths had no single source

Every adapter docblock stated "a task-type route must start in the JSON
document", but `config/queue_center_contract.json` had **no routes at all**.
Three ends hardcoded the worker/queue-center plane independently:

- pycore: 6 literals (`worker_base.py` diff/accept/pull/result,
  `snapshot_service.py` events/overview)
- mcp-chrome: `QueueCenterWakeService.ts` overview/events literals bypassing
  `api-paths.ts`
- pycore UI: 7 literals in `LaravelAPI.ts` ROUTES

Additionally all four adapter docblocks referenced moved files
(`pycore/callmodule/services/queue_center_contract.py`,
`core/api-libs/pycore/QueueCenterContract.ts`).

## 4. Applied refactor (contract schema_version 19 -> 20)

`config/queue_center_contract.json` — new top-level `endpoints` block: 18
route templates for the worker plane (`/api/worker/*`,
`/api/worker/tasks/{task_type}/{pull,accept,result}`) and the queue-center
plane (`/api/queue-center/*`, queue/items/diff/id-pages/page-data/head,
task cancel/retry).

Adapters (each renders and percent-encodes path tokens):

- Laravel `App\Support\QueueCenterContract::endpoint($role, $tokens)`
- pycore `queue_center_endpoint(role, **tokens)`
  (`pyutils/common/queue_center_contract.py`)
- pycore UI `queueCenterEndpoint(role, tokens)`
  (`core/contracts/QueueCenterContract.ts`)
- mcp-chrome `queueCenterEndpoint(role, tokens)`
  (`utils/queue-center-contract.ts`)

Consumers rewired without changing exported names:

- pycore `worker_base.py`, `snapshot_service.py` — all literals replaced.
- mcp-chrome `api-paths.ts` — `WORKER_PATHS`, `workerTaskPath`,
  `queueCenterDiffPath`, new `QUEUE_CENTER_PATHS` derive from the contract;
  `QueueCenterWakeService.ts` uses them.
- UI `LaravelAPI.ts` ROUTES — queue-center/worker entries derive from the
  contract; keys unchanged.
- `routes/api.php` — both groups annotated as mirrors of the contract
  `endpoints` block (Laravel remains the route owner/registrar).
- All four adapter docblocks corrected to the live adapter paths.

## 5. Verification

- Contract JSON parses; 18 endpoints; PHP `php -l` clean; tinker renders
  `/api/queue-center/queues/word_audio/diff` etc. correctly.
- pycore files AST-parse; the renderer smoke test percent-encodes special
  characters (`task_cc3/x y` -> `task_cc3%2Fx%20y`).
- Repo grep: zero remaining `/api/queue-center` or `/api/worker` literals in
  pycore, mcp-chrome, and both UIs.
- Live server: `word_audio/diff?cursor=1` -> 200 `cached:true`;
  `sentence_audio/diff?cursor=0` -> 200 with head IDs.

Per repository instructions no builds, tests, or service restarts were run.
