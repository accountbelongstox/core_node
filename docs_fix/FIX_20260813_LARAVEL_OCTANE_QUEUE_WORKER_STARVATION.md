# Laravel Octane Queue Worker Starvation Refactor

Date: 2026-08-13
Last updated: 2026-08-14

Status: Core starvation refactor implemented. Static source review only;
runtime verification and the authenticated Queue Center channel follow-up are
still pending.

Source: `_prompts/队列中心.txt`, Laravel 12 official documentation, Pycore,
Pycore Manager UI, Laravel Manager UI, and Laravel runtime code.

## Incident

The observed runtime alternated between two failure modes:

- Pycore connected successfully while WordNew requests could not connect.
- WordNew connected successfully while Pycore queue pulls, task acceptance,
  Queue Center refreshes, and assist overview requests timed out.

Representative failures included:

- `POST /api/worker/tasks/word_audio/accept` timing out after 60 seconds.
- `GET /api/queue-center/stream` timing out after 60 seconds.
- `GET /api/app_qy_v1/assist/overview` timing out after 8 seconds.

The failure is not a Laravel 12 framework defect, a Reverb single-client limit,
or a network rule that permits only Pycore or WordNew. The application places
blocking queue waits and SSE streams on a fixed Octane HTTP worker pool. The
first clients consume the available request workers, and later requests wait
until their client-side timeout expires.

## Primary Diagnosis

`poly_apps/laravel_main/scripts/run_runtime.sh` starts Octane with four HTTP
workers by default. A typed worker pull may remain inside one HTTP request for
30 seconds:

- `app/Http/Controllers/WorkerController.php` enables long polling unless the
  caller explicitly sends `wait=0`.
- `app/Services/TaskManagerService.php::pullAndAssignTasksLongPoll()` repeatedly
  checks the queue and sleeps for 500 milliseconds until its deadline.
- `pycore/pyctl/laravel/worker_base.py` selects the full long-poll timeout for a
  worker that owns one task type.
- Word-audio and sentence-audio use independent persistent Pycore workers, so
  Pycore can occupy two Laravel HTTP workers while both queues are empty.

The request does not retain a database row lock while sleeping, but it retains
an Octane HTTP worker for the full wait. This is sufficient to exhaust request
capacity.

The runtime state from the incident can be reconstructed as follows:

```text
Octane HTTP worker 1 -> Pycore word_audio pull, up to 30 seconds
Octane HTTP worker 2 -> Pycore sentence_audio pull, up to 30 seconds
Octane HTTP worker 3 -> Queue Center SSE
Octane HTTP worker 4 -> WordNew SSE, task-detail SSE, or another typed worker

accept / overview / snapshot / health request
                    -> no free HTTP worker
                    -> 8-second or 60-second client timeout
```

Increasing `WORKERS` changes only the number of connections required to
reproduce the incident. It does not remove the blocking ownership model.

## Current Code Versus Incident Runtime

The incident log includes the former `/api/queue-center/stream` endpoint. The
main Queue Center and Social realtime paths have since been partially migrated
to Reverb in the current worktree. That reduces the original four-worker
reproduction but does not close the architecture defect.

The pre-refactor code still contained blocking request paths:

- Typed queue pulls still use HTTP long polling.
- `app/Http/Controllers/TaskController.php::stream()` retains a task-detail SSE
  request and polls the database until reconnect.
- Laravel Manager subscribes to one task-detail EventSource per selected task.
- The legacy AppQyV1 translation SSE route still polls the database inside an
  HTTP stream.
- Other independent Pycore or MCP typed workers may each retain another Octane
  HTTP worker.

The task-detail controller also performs persistence queries directly. The
future owner must be a shared task event/read service rather than another
controller-specific polling implementation.

## Laravel 12 Documentation Alignment

The audit used these official Laravel 12 contracts:

- Octane runs a fixed request-worker pool and exposes an explicit worker-count
  option:
  <https://laravel.com/docs/12.x/octane#specifying-the-worker-count>
- Octane concurrent tasks run in task workers, which are separate from request
  workers:
  <https://laravel.com/docs/12.x/octane#concurrent-tasks>
- Broadcast events are queued by default so broadcasting does not extend the
  current HTTP response, while `ShouldBroadcastNow` is synchronous:
  <https://laravel.com/docs/12.x/broadcasting#broadcast-queue>
- Events emitted around database mutations must be dispatched after commit when
  clients must not observe uncommitted state:
  <https://laravel.com/docs/12.x/broadcasting#broadcasting-and-database-transactions>
- Reverb distinguishes its listening host and port from the destination Laravel
  uses to publish messages, and a long-running Reverb process requires a managed
  restart after changes:
  <https://laravel.com/docs/12.x/reverb#running-the-server>
  <https://laravel.com/docs/12.x/reverb#restarting>
- Reverb origins must be restricted when a channel is not intended for arbitrary
  browser origins:
  <https://laravel.com/docs/12.x/reverb#allowed-origins>
- Sanctum private broadcast channels use the broadcasting authentication route
  with API and `auth:sanctum` middleware:
  <https://laravel.com/docs/12.x/sanctum#authorizing-private-broadcast-channels>
- Scheduled work supports overlap prevention, and long sub-minute work should be
  delegated instead of blocking the scheduler loop:
  <https://laravel.com/docs/12.x/scheduling#preventing-task-overlaps>

Long polling is not prohibited by Laravel. It is incompatible with this
project's fixed worker count, number of persistent consumers, and Queue Center
requirement that realtime transport must not block unrelated UI operations.

## Synchronous Broadcast Amplification

Translation completion currently has two synchronous Reverb publication paths:

1. Domain events such as `WordTranslatedEvent` implement
   `ShouldBroadcastNow` and publish to the legacy `translation-queue` channel.
2. `AppServiceProvider` listens to the same event and calls
   `AppQyV1TranslationEventModel::emit()`, which persists an outbox event and
   calls anonymous broadcast `sendNow()` for the `queue-center` channel.

`config/queue.php` also sets `after_commit` to `false`. Some event dispatches run
while the outer global-task result transaction still owns worker and task row
locks. Per-word result processing can therefore perform two sequential Reverb
HTTP publications before the outer transaction releases its locks.

This creates four defects:

- HTTP result latency grows with result item count and Reverb latency.
- Worker and task row locks remain held during network I/O.
- A concurrent accept request for the same worker can wait behind result
  processing until the client timeout.
- A realtime client can observe an event before the outer transaction commits,
  including an event for state that later rolls back.

The persistent outbox and the old direct broadcast path must not remain parallel
event authorities.

## Transaction and File-I/O Contention

`TaskManagerService::acceptTask()` and `TaskManagerService::submitResult()` lock
the worker row followed by the task row. The common ordering avoids one class of
deadlock, but the result transaction currently covers more than the minimal
database state transition.

Processors may perform result transformation, base64 decoding, file writes,
per-item event dispatch, and synchronous Reverb publication while the outer
transaction remains active. PostgreSQL lock and statement timeouts are not
defined in the application database configuration.

This lock convoy is not the primary explanation for an unrelated overview
request timing out; fixed HTTP-worker starvation explains that behavior. It is
a direct amplifier for the reported 60-second task-accept timeout and must be
removed in the same bottom-layer refactor.

## Laravel Manager UI Amplification

`components/views/task-center/TaskCenterState.tsx` performs a parallel initial
load across approximately seven Laravel endpoints, even though the overview
endpoint is already an aggregate read contract. When automatic refresh is
enabled, a new batch starts every five seconds without a complete shared
single-flight boundary. A slow batch can overlap later batches.

The selected-task path first loads task detail, then opens task-detail SSE, and
loads full detail again for subsequent events. This turns one logical screen
into multiple independent request owners and magnifies server saturation.

Laravel Manager must consume one shared snapshot/diff state owner. Components
must not own timers, EventSource instances, or duplicate aggregate requests.

## Pycore and Pycore UI Amplification

The Pycore UI correctly reaches Laravel through the local Pycore snapshot
service. Its browser EventSource connects to local FastAPI rather than consuming
a Laravel HTTP worker.

The remaining reconciliation model is too broad:

- `queue.changed` and worker-presence signals request a refresh.
- One remote refresh serially loads multiple Laravel slices.
- Each slice has its own timeout, so one failed refresh cycle may remain active
  for substantially longer than a UI request deadline.
- Generic change notifications can cause all slices to refresh instead of
  loading only the changed revision or bounded ID page.

Pycore must treat realtime messages as revision and ID hints, then request a
bounded diff page. The current snapshot may be returned immediately from cache,
but background reconciliation must still be deduplicated and scoped by section.

## Octane Timer Overlap

`OctaneTimerServiceProvider` registers a one-second `Octane::tick()` callback.
Laravel 12 documents ticks and concurrent tasks as separate features; only the
concurrent-task contract explicitly states that work executes in Swoole task
workers. A tick callback must therefore not be assumed to have task-worker
isolation.

The application timer executes due callbacks serially and updates each task's
`last_run` value only after its callback completes. A callback that outlives the
next tick may therefore be selected again by another task worker before the
first invocation records completion. There is no cross-process atomic running
lease equivalent to scheduler `withoutOverlapping()`.

Every timer task must acquire a bounded, recoverable per-task lease before work.
Long work must be delegated to its persistent owner instead of remaining inside
the one-second scheduling callback.

## Implemented Refactor

### HTTP ownership and realtime wake-up

- Typed Laravel worker pulls now return one bounded segment immediately.
  `WorkerController` no longer validates or waits on a server-side `wait`
  parameter, and `TaskManagerService::pullAndAssignTasksLongPoll()` was removed.
- Pycore worker pulls use a 15-second finite HTTP budget and a THREAD_BUS-owned
  compare-and-set guard. One shared Pycore Reverb thread performs cursor replay
  and wakes the translation, word-audio, and sentence-audio workers.
- MCP Chrome now owns one shared Queue Center WebSocket service with reconnect
  backoff, cursor replay, and coalesced worker wake callbacks. Both the common
  worker base and the Bing dictionary worker use this service.
- The MCP popup task-detail modal no longer opens an EventSource. It reconciles
  the bounded `/api/task/{id}/detail` read when the shared Reverb connection
  signals a queue change.
- Laravel task-detail and legacy translation SSE routes were removed. Their old
  controller/type definitions may remain as unreachable compatibility code but
  have no registered request path or active client.

### Committed outbox publication

- Translation and Social realtime models are now persistent outboxes. Mutation
  paths append rows after the owning transaction commits and do not publish to
  Reverb inside the request transaction.
- `RealtimeOutboxPublisher` is the only active `sendNow()` owner. It claims a
  cross-process publisher lock, publishes bounded batches, records success or
  failure, applies exponential retry delay, and prunes only published rows.
- The one-second publisher timer explicitly dispatches through
  `Octane::concurrently()`. `run_runtime.sh` now provisions a separate
  `TASK_WORKERS` pool (default 4), in addition to request workers. Sequential
  fallback remains available for the non-Octane scheduler runtime.
- Legacy `ShouldBroadcastNow` translation event classes remain defined because
  `app/Events` is protected by project convention, but no active call site
  dispatches them and the duplicate `AppServiceProvider` listener was removed.

### Result transaction boundary

- Completed result submission is serialized by a recoverable per-task atomic
  lock and split into three phases: short ownership validation and lease
  extension, processor/write-file work without global worker/task row locks,
  and a short final ownership transaction.
- Shape-invalid and zero-store results still use the existing retry/failure
  contract. Duplicate attempt and terminal-result acknowledgements remain
  idempotent.
- Word-translation audio and image output remains outside its dictionary row
  transaction. The premature translation `task.completed` hint was removed;
  the committed `GlobalTask` change is the completion wake authority.

### Aggregate reads and UI ownership

- `TaskManagerService::getTaskListSnapshot()` and
  `WorkerManagerService::getWorkerSummaries()` are shared by their direct APIs
  and the Task Center aggregate instead of duplicating controller queries.
- `TaskCenterSummaryService` now returns queue rows/counts, worker rows/stats,
  full scheduler status, relations, and Reverb configuration in one response.
- Laravel Manager `TaskCenterState` reduced a seven-request refresh batch to
  one `/api/task-center/overview` request, adds a single-flight boundary, and
  owns the shared Reverb subscription at provider scope.

### Timer and runtime ownership

- Every custom timer callback now takes a file-cache atomic lease and rechecks
  its due state after acquiring the lease. The fallback Laravel schedule also
  uses `withoutOverlapping()`.
- The runtime defaults Octane to Swoole, configures request and task workers
  independently, and reloads Octane and Reverb with their distinct commands.

## Remaining Follow-up

- Queue Center still uses a public channel. Reverb origins are now configurable
  through `REVERB_ALLOWED_ORIGINS` but retain a wildcard compatibility default.
  Converting Pycore and MCP machine clients to an authenticated
  private channel needs an explicit machine-credential contract; it was not
  guessed during this refactor.
- Pycore retains unused legacy broad-refresh methods for compatibility, although
  active realtime handlers no longer call them. They can be deleted after all
  external extension points are audited.
- The inactive legacy SSE controller and inactive synchronous translation event
  classes can be removed only when the protected compatibility boundaries allow
  deletion.

## Reverb and Channel Security

The Social private-channel path is aligned with Laravel Sanctum:

- `bootstrap/app.php` configures broadcasting authentication with API and
  `auth:sanctum` middleware.
- `routes/channels.php` authorizes the Social user channel.
- The client authorizer sends its bearer or cookie credentials to the Laravel
  broadcasting authentication endpoint.

The Queue Center path is not equivalent:

- Queue Center is a public channel.
- `config/reverb.php` permits `allowed_origins => ['*']`.
- Queue Center payloads may include task IDs, words, text, and runtime state.

The channel must become an authenticated application or machine channel, and
origins must be limited to configured clients. Runtime reload must manage both
Octane and Reverb; forwarding reload only to Octane leaves a long-running Reverb
process with stale configuration until the complete service restarts.

## Required Architecture Contract

### Transport

1. Typed worker pulls return immediately. Laravel does not sleep or poll inside
   an HTTP request.
2. Reverb publishes a lightweight revision, changed section, and bounded ID
   hint. It is a wake-up transport, not the persistent source of truth.
3. Each client process owns one shared realtime connection with channel
   subscription multiplexing, cursor replay, reconnect backoff, and finite HTTP
   reconciliation.
4. SSE and independent component-owned realtime transports are removed from
   Laravel request workers.

### Event ownership

1. The persistent outbox is the single event authority.
2. Domain mutation commits before publication becomes visible.
3. A dedicated bounded publisher reads committed outbox rows and publishes to
   Reverb.
4. The old `translation-queue` direct broadcast and duplicate `sendNow()` path
   are retired together.
5. Publication failure leaves a retryable outbox record and never extends the
   originating HTTP transaction.

The project does not use a generic Laravel queue worker for this flow. The
publisher must therefore be an explicitly owned Octane task-worker service or a
dedicated long-lived runtime component with an idempotent claim and retry
contract. It must not fall back to synchronous HTTP-request publication.

### Task transactions

1. Accept remains an idempotent, bounded database acknowledgement.
2. Result submission stages and validates external artifacts before acquiring
   worker and task row locks.
3. The database transaction contains only the required state mutation and
   committed outbox append.
4. File I/O, Reverb I/O, remote calls, and unbounded per-item work do not run
   while task ownership locks are held.
5. Lock waits have a bounded server-side policy and return a retryable conflict
   instead of relying on a 60-second client timeout.

### Read models and UI ownership

1. Laravel exposes one common Queue Center snapshot/diff contract rather than a
   controller-specific family of polling views.
2. Laravel Manager owns one module-level snapshot store and one realtime
   subscription.
3. Pycore owns one local cached projection and performs section-scoped bounded
   reconciliation.
4. Pycore UI and Laravel Manager UI render the same canonical section contract.
5. Component mounts, dialogs, and selected task rows do not create additional
   timers or Laravel streams.

### Scheduling and runtime

1. Each custom timer callback has a cross-process lease, expiry, and idempotent
   completion rule.
2. Timer callbacks schedule bounded work and do not perform long processing in
   the tick loop.
3. Octane and Reverb have distinct managed reload operations.
4. Worker-count configuration remains a capacity control, not a correctness
   dependency.

## Refactor Order

### P0: Remove request-worker starvation

- Make typed pulls immediate and event-driven.
- Remove the remaining Laravel SSE endpoints and clients.
- Provide one shared authenticated Reverb connection per process.

### P0: Restore transaction boundaries

- Consolidate translation events into the committed outbox.
- Remove duplicate synchronous broadcast paths.
- Move publication, file I/O, and non-database processing outside row-lock
  transactions.

### P1: Consolidate read ownership

- Replace Laravel Manager request fan-out with one snapshot/diff owner.
- Replace Pycore full-section refresh signals with revision and bounded diff-ID
  reconciliation.
- Merge common Queue Center contracts instead of maintaining UI-specific
  translations.

### P1: Harden runtime ownership

- Add per-task timer leases and overlap prevention.
- Authenticate Queue Center channels and restrict Reverb origins.
- Manage Reverb restart independently from Octane reload.

## Acceptance Conditions

The refactor is complete only when all of the following are true:

- An idle Pycore word or sentence worker consumes no Laravel HTTP worker while
  waiting for work.
- Opening Pycore UI and Laravel Manager UI creates no Laravel SSE request.
- One logical UI instance owns one Laravel realtime socket regardless of the
  number of Queue Center components or selected tasks.
- An overview request remains bounded while all worker types are connected and
  idle.
- Task acceptance does not wait behind Reverb publication or file output.
- Every externally visible event refers to committed state and has one durable
  cursor.
- Reconnect replays a bounded diff without resetting all Queue Center sections.
- A slow timer callback cannot run concurrently with its next scheduled
  invocation.
- Queue Center events cannot be subscribed to from an unapproved origin without
  application authentication.
- Restart and reload procedures independently refresh Octane and Reverb.

## Separate Incidents

The following reported failures are not causes of the Laravel client-contention
incident and remain separately tracked:

- The Queue Center `heartbeat` section-contract drift that raised
  `KeyError: 'heartbeat'`.
- ChatTTS attempting a GitHub model-tool download during the first synthesis
  request.

They must not be used to justify a smaller timeout-only repair to the queue
transport architecture.

## Verification Boundary

The diagnosis and implementation were reviewed statically against the Laravel
12 official documentation and current source. Per project instructions, no
tests, builds, services, migrations, or runtime verification commands were
executed. Acceptance conditions that require live concurrency, restart, Reverb,
or database behavior therefore remain unverified at runtime.
