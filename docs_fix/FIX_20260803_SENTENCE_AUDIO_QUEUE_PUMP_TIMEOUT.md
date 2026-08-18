# Sentence Audio Queue Runtime and Queue Pump Fix

## Cause

- The Sentence Audio pump inherited the shared 15-second HTTP timeout while requesting up to 128 full task models from the Queue Center page-data endpoint.
- The pump materialized up to 128 tasks even when the configured worker concurrency was much smaller, enlarging the slow request and lease window.
- Laravel selected complete `global_tasks` models before projecting the smaller worker payload, and the lazy segment temporarily retained those full models.
- The UI claimed with a synthetic worker ID while Pycore returned results with its real worker ID, so Laravel could reject valid progress and completion updates.
- Sentence processing inherited a 120-second task cap plus 30 seconds of grace, which incorrectly failed valid Qwen3-TTS work at 150 seconds.
- Queue badges mixed source-population history totals with the live `global_tasks` sentence queue.

## Changes

- Added centralized batch limits, task timeouts, upload retry timing, log tags, monitor limits, and progress stages to `queue_center_contract.json`.
- The UI pump now requests and claims only the effective Pycore concurrency, bounded by the central limit of eight.
- The pump registers and claims with the real Pycore sentence worker identity, consumes missing rows, and skips tasks owned by another worker.
- Pycore applies admission backpressure at the effective concurrency limit. A full worker returns a retryable busy response, so the UI keeps the diff ID and retries instead of filling an unbounded in-memory queue.
- Typed result routing is refreshed when a queued task actually begins, and terminal tasks are removed from both the task-type and endpoint registries. The Laravel endpoint also travels with the local queue item, so large backlogs cannot evict routing metadata before execution.
- The dedicated Sentence Audio worker has a safe `sentence_audio` result-route fallback for legacy in-memory items whose registry entry was already evicted.
- Updated the Pycore, Queue Center UI, and mcp-chrome contract adapters with the same fields.
- Changed Laravel page-data materialization to filter by queue in SQL, select only the `worker_pull` columns, preserve request order, and retain only projected arrays in the transient segment.
- Laravel now exposes live sentence queue counts and per-item status, progress, stage, assignment time, update time, and backend upload state.
- Existing and new sentence tasks use the centralized 900-second lease, with every progress report extending the lease.
- Sentence tasks no longer use the generic 150-second bus hard cap. Qwen synthesis remains bounded by the engine request timeout.
- Domain audio upload and final Queue Center completion both retry with bounded exponential backoff until accepted, shutdown, or explicit ownership transfer.
- The Queue Center renders each task's stage, progress, elapsed time, backend upload/result status, and centrally tagged worker/Qwen logs.
- Qwen-supported speakers are exposed by Pycore, selected beside the engine badge, applied live, and persisted in both local UI storage and Pycore settings.
- Capability info, capability settings, system resources, and Qwen capability discovery use the shared bounded-TTL snapshot cache with explicit refresh/invalidation paths.
- Kept the shared browser request timeout unchanged because page-data workload is bounded at its source.

## Verification Boundary

No tests, builds, services, or runtime verification were run.
