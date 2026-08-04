# Qwen Queue Transport Recovery

## Cause

- The Qwen service queue retained and continued a synthesis job after a local
  Windows socket abort, but the Pycore queue waiter treated one failed event
  long poll as a terminal synthesis failure.
- A retried Laravel task reused the same task and worker IDs without carrying
  its retry generation. A late result from the previous generation could race
  the new assignment and be rejected with HTTP 409 or mutate the new lease.
- A lost UI-to-Pycore acceptance response could enqueue the same task attempt
  more than once because the local priority heap had no execution-attempt key.
  Releasing that key at heap pop would still reopen the duplicate window while
  the attempt was actively synthesizing.
- A Pycore restart lost the Qwen subprocess handle. The managed-service layer
  then killed the still-healthy Qwen listener as foreign, discarding its
  in-memory queue and retained results before the stable client could recover.

## Changes

- The shared Qwen client reconciles transient event-channel failures against
  the authoritative Qwen queue and keeps waiting for the retained job.
- Sentence synthesis passes a stable Qwen `client_job_id` derived from the
  Laravel task ID and retry count, reusing Qwen's existing idempotent queue.
- The central worker contract now carries `retry_count` on pulls and `attempt`
  on results. Laravel acknowledges and ignores stale-attempt results without
  changing the current lease.
- The shared local TTS priority queue deduplicates by task ID and retry count;
  a duplicate delivery can only update the queued priority. Its attempt key is
  retained through processing and released only when execution settles. The
  same registry supplies capacity accounting across the pop-to-running handoff.
- Qwen submit, reconciliation, and result retrieval remain bounded by the
  original synthesis deadline during transport recovery.
- The centralized managed-service layer adopts an existing Qwen listener only
  after its queue-status capability probe succeeds. Incompatible listeners are
  still reclaimed, while adopted services retain single-active, busy, idle,
  explicit-stop, and shutdown ownership.

## Verification Boundary

Per project instructions, no tests, builds, services, migrations, or runtime
verification commands were executed.
