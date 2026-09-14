# A7A Relay Mercure refactor

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

## Changed files

Relay route/controller/service/model names, shared contract, UI data transport and roster/event consumers, Python Mercure and HTTP transport, FrankenPHP Caddy generation and installer/runtime configuration, and the Relay outbox/timer path were aligned in place. Existing persisted identity, ledger, blob directory and storage keys remain compatibility identifiers.

Use a single unversioned Relay API and code namespace, owner-scoped events, one shared UI Relay stream, shared Python Mercure parsing, immediate post-commit outbox delivery, cached roster with heartbeat expiry notifications, and bounded independent device execution. Keep existing migration filenames and persisted identity/blob storage keys where renaming would lose deployment history or user data; these are storage compatibility identifiers, not another running protocol.

Record findings incrementally before code changes. Inspect deployment, Python lifecycle, Laravel dispatch/presence and UI subscriptions/resources before implementation. Do not run builds, tests or services.

Static references and JSON structure were inspected after the edits. No services, builds, or tests were started, created, or modified, in accordance with the repository rules.

## Live verification (2026-09-14)

- `GET https://api.si.12gm.com/up` returned `200` from `FrankenPHP Caddy`; the response advertised HTTP/2 and HTTP/3.
- `GET https://api.si.12gm.com/.well-known/mercure?topic=...` without a subscriber JWT returned `401 Unauthorized`, confirming the hub is protected.
- Eight requests to the removed `/api/relay/v2/devices` endpoint returned `404`, confirming the old route is no longer active.
- Five requests to `/api/relay/devices` returned `401 AUTH_REQUIRED` and none returned `429`, confirming the owner gate and that this unauthenticated probe did not reproduce the former rate-limit storm.
- The public terminal page returned `200`.

Authenticated operation completion, roster presence events, and live screenshot delivery require a valid dashboard session and an online enrolled pycore device; no credentials or device control were available in this session.
