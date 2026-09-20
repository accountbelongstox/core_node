# A7A Relay Mercure refactor

## Correction (2026-09-15)

The unauthenticated probes below establish route matching only. They do not disprove an authenticated `POST /api/relay/operations` business-level 404. `requireActive` can return `pairing_not_found` after middleware succeeds. The rollout-only attribution in finding 15 and the stronger claims in the live verification section are unsupported. Continued findings and changes are recorded in `A7A_RELAY_ADMISSION_LIFECYCLE.md`.

## Findings

1. Two Laravel relay implementations coexist: `routes/api/relay.php` uses `app/Services/Relay`, while `routes/RelayV2Router/RelayV2Api.php` uses `app/Apps/RelayV2`. The shared contract and UI still expose `/api/relay/v2`. Consolidation must update consumers and signatures together and preserve persisted database data.
2. `PycoreLaravelRelayTransport.waitForOperation` fetches operation status after every wake, including intermediate states, and falls back to per-operation polling. All owner operations, roster reads, authorization and blobs share a 120 requests/minute limiter. Concurrent terminal requests can exhaust this shared budget; raising the limit alone does not remove request amplification.

## Official references

3. The roster explicitly ignores wake events. Heartbeat writes the database but emits no presence event. UI determines liveness from timestamps and has no server-driven offline notification.
4. The Python agent implements another SSE parser instead of using `MercureSubscriber`. It reads 512-byte chunks, does not validate HTTP status/content type before announcing connection, and ignores credential-revocation events. Small notifications can remain buffered; failed subscriptions can be misreported as connected.
5. The UI increments the operation stream consumer count for every request without releasing it. A pending wake remains set after resolving a waiter, causing another immediate status request.
6. Each heartbeat issues a fresh subscriber JWT although subscription authorization has its own endpoint. The deployed hub configuration omits explicit heartbeat and subscription lifecycle settings.

- https://frankenphp.dev/docs/laravel/ — Laravel worker integration and embedded Mercure.
- https://mercure.rocks/docs/hub/config — hub heartbeat, subscription lifecycle, authorization and transport configuration.

## Workflow

7. Terminal snapshots run on an interval, ignore `terminal.changed`, and render only the newest digest. A completed previous image is hidden while its replacement is downloading. The screenshot demand lease must still be renewed while viewing.
8. Outbox delivery depends on the timer and shares a lock with translation/social publication. Publish Relay rows after their database transaction commits; keep the timer for failed-delivery recovery. Preserve operation fencing, idempotency and byte digests.
9. Device execution uses a batch barrier: one slow operation prevents claiming unrelated work after other slots become free. Replace it with bounded active-operation accounting and release individual slots on completion.
10. Roster reads invoke global auto-enrollment mutation before querying devices. Cache authorized roster snapshots and move registration updates onto device/enrollment lifecycle paths. Use a shared cache across workers, never a PHP worker-local array as authoritative presence.
11. Official Mercure configuration defaults to a 600-second write timeout; subscriber JWTs expire after 300 seconds here. Controlled renewal is necessary, but per-request reconnection is not. Configure hub heartbeat and unlimited stream write duration, retain finite subscriber credentials, and reconcile once on reconnect.

## Implementation decisions

12. Owner resolution falls back from an unauthenticated request to `User::highestRoleUser()`. This grants administrative Relay access to anonymous traffic and makes user-scoped event payloads unsafe. Replace this fallback with the existing authenticated identity resolver and reject unauthenticated requests; never solve repeated authorization by granting anonymous ownership.
13. Shared Python HTTP sessions use forbidden `threading.local`; the shared Mercure subscriber closes these pooled sessions after streams. Keep stream cleanup response-only and move per-thread session ownership to THREAD_BUS-backed state.
14. Agent-history timeout labeling is already centralized in `classify_ai_failure`; provider read timeouts are correctly marked provider-reached and quota-counted. The remaining timeout risk is the 30-second Laravel article worker deadline, which is shorter than some provider calls; align that deadline with the operation contract rather than retrying the whole request at the UI.

15. The a7a2 browser trace used the canonical `/api/relay/operations` URL, but a live unauthenticated probe now reaches the Laravel owner middleware and returns `401 AUTH_REQUIRED`; the removed `/api/relay/v2/operations` endpoint returns `404` by design. The observed 404 therefore came from a rollout/worker state in which the route file and the long-lived Laravel worker were not converged yet, not from the current UI endpoint declaration. Route-cache clearing and a graceful FrankenPHP worker reload must be part of every runtime convergence so a file-sync window cannot serve a stale route table.
16. The unified Relay source still carried three externally visible version markers in persisted names and diagnostics (`relay_v2` blob directory, `pycore_relay_v2_state`, and `pycore_relay_v2` ledger kind). These are protocol identifiers, not harmless comments: they make the single Relay implementation appear versioned and prevent a clean migration. Canonical names are required with one-time read/migrate compatibility for existing device identity, browser state, ledger rows, and private blobs. The historical `global_RelayV2_*` migration filenames remain immutable database history and are not loaded as a second runtime implementation.
17. A process-local APCu fast path would let one FrankenPHP worker serve an older roster snapshot than another worker after a heartbeat. The shared Laravel cache must remain authoritative; presence events are notifications, while every roster read reconciles against the shared store.

## Changed files

Relay route/controller/service/model names, shared contract, UI data transport and roster/event consumers, Python Mercure and HTTP transport, FrankenPHP Caddy generation and installer/runtime configuration, and the Relay outbox/timer path were aligned in place. Persisted identity, ledger, blob directory and browser-state names now have canonical unversioned destinations with bounded legacy read/migration compatibility.

Use a single unversioned Relay API and code namespace, owner-scoped events, one shared UI Relay stream, shared Python Mercure parsing, immediate post-commit outbox delivery, cached roster with heartbeat expiry notifications, and bounded independent device execution. Canonicalize persisted Relay names too; legacy identity/state/blob locations are read once and migrated so the running protocol has no versioned marker while existing deployments retain their data.

Record findings incrementally before code changes. Inspect deployment, Python lifecycle, Laravel dispatch/presence and UI subscriptions/resources before implementation. Do not run builds, tests or services.

Static references and JSON structure were inspected after the edits. No services, builds, or tests were started, created, or modified, in accordance with the repository rules.

## Live verification (2026-09-14)

- `GET https://api.si.12gm.com/up` returned `200` from `FrankenPHP Caddy`; the response advertised HTTP/2 and HTTP/3.
- `GET https://api.si.12gm.com/.well-known/mercure?topic=...` without a subscriber JWT returned `401 Unauthorized`, confirming the hub is protected.
- Eight requests to the removed `/api/relay/v2/devices` endpoint returned `404`, confirming the old route is no longer active.
- Five requests to `/api/relay/devices` returned `401 AUTH_REQUIRED` and none returned `429`, confirming the owner gate and that this unauthenticated probe did not reproduce the former rate-limit storm.
- The public terminal page returned `200`.
- `POST https://api.si.12gm.com/api/relay/operations` with an empty body returned `401 AUTH_REQUIRED` (route matched and owner auth ran); the removed `/api/relay/v2/operations` returned `404` as expected. This directly disproves a current canonical-route 404.
- A fresh canonical endpoint sweep returned only expected auth/signature responses (`401` for owner routes and `403` for unsigned device routes); no canonical Relay endpoint returned `404`. The terminal page returned `200` with its normal HTML request.
- Static convergence checks passed after the final edits: Python AST parsing, JSON contract parsing, and `bash -n` for both FrankenPHP runtime scripts. The runtime now fails closed if Laravel's route cache cannot be cleared before a long-lived worker starts.

Authenticated operation completion, roster presence events, and live screenshot delivery require a valid dashboard session and an online enrolled pycore device; no credentials or device control were available in this session.
