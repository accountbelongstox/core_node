# Queue Center Blocking and Duplicate Request Fix

Date: 2026-07-31

## Scope

This change follows `_prompts/队列中心.txt`: Queue Center reads must stay
decoupled, UI controls must be explicit, Laravel event streams are primary, and
fallback reconciliation must never block unrelated UI operations.

## Completed-task history

- Removed the unbounded `sync_all()` workflow.
- A sync request now fetches exactly one cursor page from Laravel.
- The first page reserves bounded space for recent local Pycore records; later
  pages use the Laravel cursor without skipping records.
- Laravel and resource-download I/O no longer runs on the archive serialized
  owner. Only the short manifest commit is serialized.
- Archive reads and cached-resource lookups no longer wait behind synchronization.
- Queue Center snapshots no longer embed completed-history file reads. The
  Recent section owns its separate paginated request.
- Remote resources are not downloaded during metadata synchronization.
- Timed-out serialized calls are skipped before execution when their response
  guard has already expired, preventing stale queue amplification.

## Frontend request ownership

- Removed the duplicate Laravel endpoint provider from the top bar. The
  application layout is the single endpoint-state owner.
- Removed the automatic endpoint probe/follow-up list cycle. Endpoint listing
  runs once at initialization and after explicit add/remove/select/probe actions.
- Endpoint-list reads use one module cache and one in-flight promise, so React
  development remounts and sibling consumers reuse the same request.
- OCR, STT, TTS, AI, and capability status use one module-level cached snapshot.
  Periodic five-endpoint polling was removed; manual refresh remains available.
- Removed the Recent panel's second Queue Center refresh. The page-level hub is
  the only snapshot requester.
- Added a short Pycore snapshot cache so closely spaced callers reuse one result.

## Pycore to Laravel reconciliation

- Translation list reconciliation falls back every five minutes while the event
  stream is connected.
- Translation monitor construction and endpoint-change callbacks no longer
  prewarm Laravel while the UI-controlled callback is disabled.
- Dictionary pending-word counts are refreshed at most every five minutes and
  reused between reconciliations.
- Sentence monitor requests are single-flight, debounced, and limited to 50 rows.

## Laravel query changes

- Completed-task type aggregation is optional, cached, and omitted on subsequent
  cursor pages.
- Translation queue pagination reuses cached summary totals for known status
  buckets and selects only fields rendered by Queue Center.
- Pending dictionary summary uses one conditional aggregate query instead of
  four table counts. Worker activity uses one grouped cached query.
- Sentence missing-list reads are database-only. They no longer reconcile rows,
  write status, or perform repeated filesystem checks in a GET request.
- Added idempotent `sys:init` indexes for completed-task cursor reads,
  translation queue ordering, dictionary pending reads, and sentence queue
  ordering.

## Worker queue handshake

- Removed Pycore's standalone worker register and heartbeat requests.
- Worker identity, processor types, and capabilities now travel with each queue
  pull. Laravel discovers or refreshes the worker before claiming in that same
  request.
- Word-audio and sentence-audio remain separate consumers because they own
  different execution lanes, but each cycle now starts directly with its queue
  pull.
- The existing register and heartbeat endpoints remain available for legacy
  consumers; Pycore no longer calls them.

## Verification boundary

Per project instructions, no tests, builds, services, migrations, or runtime
verification commands were executed. Review was static and read-only after the
code changes.
