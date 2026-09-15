# A7A5 Relay group coordination refactor

## Scope

Trace the pycore client group and UI group through Laravel on FrankenPHP. Record confirmed findings before implementation. Preserve persisted identities and authorization boundaries. Do not run tests, builds, deployment scripts, or services.

## Findings

### User confirmation

The user confirms that the Windows device belongs to the currently logged-in UI account. Ownership mismatch is no longer the working explanation. Continue tracing the same-account roster, request lifecycle, and cache; do not recommend transferring ownership or re-enrolling the healthy device.

1. `PycoreLaravelRelayTransport.ensurePair` emits `RELAY_DEVICE_ENROLLMENT_REQUIRED` locally when the shared roster has no preferred device. This error does not establish a failed Python enrollment or a failed Mercure subscription. The supplied Python log shows successful signed heartbeat and hub authorization requests. Laravel's roster filters by `owner_user_id`; visibility and authenticated UI identity must be traced alongside enrollment ownership.
2. `175_laravel_main_start.sh` already selects the FrankenPHP plane, and `93_install_frankenphp.sh` delegates to the shared installer pipeline. Existing Relay code already requests Mercure authorization. The reported symptom cannot establish that long-connection support is absent; inspect the generated hub configuration and both subscriber lifecycles before replacing transport.

3. Enrollment claim commits the device and credential but never calls the existing presence publisher. An already cached empty roster remains empty until a heartbeat or cache expiry, and connected UIs receive no registration event. Registration must use the same group roster/presence lifecycle as heartbeat.
4. The browser roster applies presence frames immediately, but an older in-flight HTTP snapshot can subsequently replace the entire map and erase that presence. Auth reset clears the map without immediately reconciling an active roster. The periodic reconciliation is disabled while SSE is connected even though the contract explicitly says history is not authoritative. These defects can retain an empty or stale group roster despite a healthy stream.
5. Every provider request forces another roster fetch on an empty result. The six agent-history providers share one missing group prerequisite, yet the transport does not preserve the shared negative-cache boundary. Empty ownership visibility must be reported accurately and reconciled centrally.
6. Python's Relay subscriber state callback only sets a boolean and signals a claim. It does not record connection state, so a successful authorization request is visible while the actual SSE lifecycle is invisible in the supplied log.
7. The internal HTTPS Mercure proxy omits the contract's stream close delay in both shell and PHP Caddy renderers. Domain proxies already use that policy; the remaining route must use it too.
8. Follow-up after the user's same-account confirmation: Relay HTTP uses `createFixedLaravelModuleConfig` and is pinned to `public_urls.laravel_api_origin`, but its roster and SSE lifecycle still subscribe to the unrelated shared Laravel endpoint change event. The stream also calls `resolveLaravelBaseURL()` at startup. A general API endpoint selection can therefore clear an in-flight Relay roster although the Relay coordinator did not change. The discarded request resolves normally, and `ensurePair` only fences auth-session changes, allowing the cleared map to be misreported as an empty group. Fixed Relay transport and its lifecycle must share the same coordinator boundary.
9. `Cache::remember` roster reads and heartbeat `Cache::put` writes are separate operations. An older read can overwrite the newer heartbeat snapshot. Since the browser already coalesces and bounds roster reads, query the authoritative device registry for these reconciliation reads and stop maintaining a second roster copy. This removes the empty-snapshot overwrite path across FrankenPHP workers.

### Follow-up implementation plan

Remove general endpoint-selection resets and resolution from the fixed Relay roster/stream. Retain auth-session fencing. Read the device registry directly for roster reconciliation, preserving owner/status/credential filters. Reject a roster read superseded by an auth transition rather than returning another session's empty map. Update the empty-group translation to describe visibility without assuming ownership mismatch or requiring re-enrollment.

## Architecture and implementation plan

Use the existing authenticated owner's device collection as the authorized pycore group and its owner topic as the UI group's shared subscription. Keep machine signing credentials separate from UI authentication. Laravel remains the authority for group membership; a device heartbeat must never grant another UI account access automatically. Preserve the existing shared Mercure transport, native FrankenPHP publisher, operation ledger, outbox, and private topics.

Centralize roster invalidation after enrollment commit, preserve events arriving during roster requests, reconcile on auth transitions and bounded intervals, and retain the shared empty-roster cache. Report an empty authorized group through Laravel's translated error boundary instead of asserting that Python needs enrollment. Record device and UI group scope using the same opaque owner-topic identifier, allowing logs and authenticated roster responses to distinguish ownership mismatch without exposing credentials.

The user subsequently confirmed matching device ownership and UI account. Treat that as the task's ownership fact. No migration, automatic ownership reassignment, or global anonymous group access is needed. An authenticated production roster response remains unavailable, so runtime reproduction of the identified lifecycle race is not established.

## Official references

- https://frankenphp.dev/docs/mercure/ — embedded Mercure requires explicit configuration and provides SSE subscriptions and native publication.
- https://mercure.rocks/docs/hub/config — private subscriptions, CORS, heartbeat, and stream write duration.
- https://mercure.rocks/spec#reconciliation — reconnect history does not replace authoritative application state reconciliation.
- https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#streaming — delayed connection closure during proxy configuration changes.
- https://laravel.com/docs/13.x/cache — cache retrieval/storage and atomic locking are distinct mechanisms; `remember` is not a transactional roster update.
- https://frankenphp.dev/docs/worker/ — application state persists across requests in worker mode.

## Status

Source tracing completed for the reported admission path, device registration and ownership, shared UI roster and subscriber, Python subscriber, native publisher/outbox, and the 175/93 deployment chain. Implemented the confirmed lifecycle defects after recording them above:

- Enrollment now refreshes the shared roster and publishes presence after its transaction commits.
- Device descriptors and authenticated roster responses carry the same opaque `group_id`; Python logs it when its binding changes.
- Empty rosters carry a stable `RELAY_GROUP_EMPTY` code and a translated message describing account-scoped visibility. The transport preserves its typed not-paired error, status, and group diagnostics.
- UI snapshot merging preserves presence arriving during the request, clears null recommendations, reconciles active auth changes, and periodically reconciles even with an online SSE stream. Provider requests share the empty-roster refresh boundary.
- Python logs actual subscriber lifecycle states independently from successful HTTP authorization.
- Both Caddy renderers apply the existing stream-close policy to the internal HTTPS Mercure proxy.

The same-account follow-up removes unrelated shared-endpoint resets from the fixed Relay roster and SSE lifecycle. Roster callers now reject superseded auth generations. Laravel reconciliation reads the authoritative device registry directly; heartbeat and enrollment no longer maintain a competing cached roster. Existing cache entries are left to expire. Empty-group translations no longer advise changing accounts or re-enrolling the device.

## Pycore sentence-audio follow-up

10. The Windows sentence worker's full-sync mirror stages a local backlog, but `_process_task` sends a Laravel `processing` result before every synthesis. `WorkerResultDelivery` uses the 60-second result timeout and retries synchronously. When Laravel is offline, the first sentence finishes locally, then the next task blocks on this progress POST; the log therefore stops after one generated sentence. Terminal result delivery has the same blocking risk.
11. The durable audio outbox retains generated MP3s and retries domain/result delivery, but result POST failures can occupy the synthesis lane. Offline synthesis must never wait on progress or terminal HTTP delivery; the outbox is the online reconciliation path.
12. The configured diff `data_segment_limit` is 128 while the remote sentence backlog is 2,103. Full-sync pagination materializes only one local segment per changed diff and depends on a later revision to continue. A static pending queue can remain at one staged batch; full-sync intake must continue paging until the local segment capacity is filled.

## Pycore implementation plan

Set a short audio-worker result timeout and add a transport backoff gate shared by processing and terminal result posts. Synthesis continues from the local mirror and writes the durable audio outbox while Laravel is unavailable. On each successful diff/heartbeat reconnect, trigger the outbox drain before fetching fresh work. Extend full-sync page-data intake across all ordered IDs up to the local durable capacity, preserving Laravel queue order and queue-head promotions.

## Pycore implementation completed

- Audio workers now use a two-second result/claim timeout and a 30-second transport backoff gate. Failed processing or terminal result posts return immediately after the first failed attempt and cannot serialize the Qwen sentence lane.
- Full-sync durable segment capacity now follows the contract's 4096 ordered-ID window; the 128 value remains the per-page materialization size. The existing ordered diff loop fills all available pages before local dispatch.
- A successful queue-diff response invokes the audio worker reconnect hook, which starts the durable audio delivery outbox before admitting more work. Cached MP3s remain on the Windows pycore data disk until Laravel accepts the domain upload/result/history steps.
- The local queue continues to synthesize from its persisted mirror while Laravel is offline. When connectivity returns, normal diff reconciliation reorders the local head and the outbox retries cached uploads; queue-head changes still update both persistent segments and the in-process heap.

The observed `remote_en=590/2103` followed by no sentence progress is therefore explained by a blocked progress POST, not a Qwen synthesis limit. The corrected state machine is:

`Laravel full ordered diff -> Windows durable mirror -> local Qwen synthesis -> retained MP3/outbox -> reconnect diff -> upload/result/history -> remove local delivery record`

The remote task remains fenced by the existing just-in-time claim when reachable; when unreachable, local synthesis proceeds and the durable outbox preserves the result until the coordinator is available.

No tests, builds, verification commands, service starts/restarts, deployment scripts, or Git operations were executed. The browser page could not be retrieved through the web reader; no authenticated production roster response was available. The source-level races are addressed; their occurrence in the reported production session and the live result after rollout remain unverified. Caddy template edits require normal configuration convergence to become active.

## Sentence text observability follow-up

13. The sentence lane emitted synthesis lifecycle events and queue counters, but did not print the actual sentence text. This made it impossible to distinguish a stalled Laravel delivery call from a Qwen generation stall using the Windows console alone.
14. The sentence lane now prints a normalized single-line `Generating sentence` record immediately before synthesis, including the task identifier, queue position, and sentence text. The record is emitted before any progress HTTP call so it remains visible when Laravel is offline.
