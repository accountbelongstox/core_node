# Queue Diff Hot Path, Batch-100 Pull, and Cross-End Endpoint Centralization

Date: 2026-08-14 23:00
Status: Applied; hot path measured at 0.2 ms with zero SQL queries; runtime
restart pending user-run

## Symptoms (production logs)

```
GET /api/queue-center/queues/word_audio/diff -> 200 (216-249ms)   # every 1s
GET .../diff -> ERR (15028ms) ConnectTimeoutError                 # under load
[QueueCenterCache] realtime reconnect: timed out
```

The diff poll is the highest-frequency call in the system (two audio lanes x
1s per consumer, plus mcp-chrome), yet every poll paid for queue metrics and
was queued behind unrelated heavy queries on the single-threaded dev server.
Connect timeouts appeared whenever the backend was blocked.

## Root cause

`QueueSliceDiffService::snapshot()` computed `QueueCenterMetricsService::progress()`
on EVERY poll — including the 99%+ of polls where the caller's cursor already
matches the revision and the answer is just "no, keep working". The metrics
build (`statusCountsForTaskType` GROUP BY over `global_tasks`, 2s cache) added
DB round-trips and stampeded whenever its short cache expired, exactly while
the backend was already busy.

Contract-wise the consumers were also under-batched: `consumer_batch_limits`
was 8 for both audio lanes, so enabling processing trickled tasks instead of
pulling one bounded 100-task batch.

## Applied changes

### Laravel main

- `QueueSliceDiffService::snapshot()` — the unchanged-cursor hot path now
  performs ONE local cache read and returns immediately:
  `head_task_ids: []`, `progress: null`. Head IDs and progress materialize
  only when the cursor is stale. `WorkerController::pullTasks` snapshots with
  `cursor=0` (always stale), so pull responses keep carrying `progress` and
  the `completed/total` UI contract is unchanged.
- Measured via tinker: hot path `0.2ms`, **0 SQL queries**; stale path still
  returns head IDs + progress.
- `routes/api.php` — worker and queue-center groups annotated as mirrors of
  `config/queue_center_contract.json` `endpoints`.

### Shared contract (schema_version 21)

`config/queue_center_contract.json`:

- `diff_delivery.consumer_batch_limits`: word_audio 8 -> 100,
  sentence_audio 8 -> 100. Enabling word/sentence audio processing now pulls
  up to 100 tasks immediately; the bound stays under
  `data_segment_limit` (128).
- `task_contract.limits.worker_pull`: 50 -> 100 so one typed pull can carry
  the full 100-task batch (validation cap and pycore's cap both derive here).
- New `endpoints` block (schema 20 — see
  `FIX_20260814_2230_FOUR_END_ENDPOINT_CENTRALIZATION.md`): the single
  cross-end source for every `/api/queue-center/*` and `/api/worker/*` path.

### pycore

- `pyutils/common/queue_center_contract.py` — `QUEUE_CENTER_ENDPOINTS` +
  `queue_center_endpoint(role, **tokens)` renderer (percent-encodes segments).
- `pyctl/laravel/worker_base.py`, `pyctl/queue_center/snapshot_service.py` —
  all six route literals replaced by contract renders.
- `pyctl/assist/capability_sync.py` — enabling a lane now ALSO wakes its
  worker (`request_pull(prefer_remote=True)`, coalesced, capacity-aware), so
  the first 100-task batch is pulled immediately instead of waiting for the
  next heartbeat tick. Worker singletons are imported lazily to avoid
  import-order cycles.

### mcp-chrome

- `utils/queue-center-contract.ts` — typed `queueCenterEndpoint()` renderer;
  `QueueSliceDiff.progress` widened to `QueueProgress | null` (hot path).
- `utils/api-paths.ts` — `WORKER_PATHS`, `workerTaskPath`,
  `queueCenterDiffPath`, and new `QUEUE_CENTER_PATHS` all derive from the
  contract; exported names unchanged (zero call-site churn).
- `QueueCenterWakeService.ts` — overview/events literals replaced.

### pycore UI / wordnew UI

- `core/contracts/QueueCenterContract.ts` — typed `queueCenterEndpoint()`.
- `core/api-libs/laravel/LaravelAPI.ts` — all seven queue-center/worker
  ROUTES entries derive from the contract; keys unchanged.
- Stale adapter cross-reference comments fixed in all four adapters.

## Semantics reconfirmed (no behavior change intended)

- A changed diff means "re-pull one bounded batch, remote-head first, then
  MERGE with the local segment". It never cancels or re-orders tasks already
  processing (pycore `diff_task_segment_store.stage` preserves owned records;
  mcp-chrome `prefetchChangedHead` merges by known task IDs).
- An unchanged diff (`cached: true`) means "keep processing the current
  segment" and now costs the backend nothing measurable.
- Revision bumps remain synchronous with committed queue mutations
  (`QueueSliceDiffService::markChanged`), so a queue-head move is visible to
  the very next 1s poll.

## Verification boundary

Per repository instructions, no builds, tests, or service restarts were run.
Static checks: PHP lint, tinker hot/stale path measurement (0.2ms / 0
queries), contract JSON parse, pycore AST parse + renderer smoke test, repo
grep confirming zero remaining `/api/queue-center` / `/api/worker` literals in
pycore, mcp-chrome, and both UIs.

User-run follow-ups:

1. Restart the Laravel runtime (it serves code from process start) and pycore
   (clear `__pycache__`).
2. Rebuild the mcp-chrome extension and the UI bundle so the schema-21
   contract is bundled.
3. Confirm 1s diff polls stay in the low-ms range server-side (network RTT to
   a remote host still dominates the client-observed time) and that enabling
   an audio lane pulls the first 100-task batch at once.
