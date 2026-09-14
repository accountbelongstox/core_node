# A7A Relay admission and stream lifecycle

## Findings

1. An unauthenticated 401 does not establish authenticated admission health. `RelayOperationService::admit` calls `RelayPairingService::requireActive`, which returns `pairing_not_found` with HTTP 404 for missing, expired, revoked, or differently owned pairings. The previous report incorrectly excluded business-level 404 responses.
2. The UI trusts persisted pairings until their local expiry, without reconciling server invalidation. Admission failures leave the same pairing cached, so terminal refreshes repeatedly submit it. Pairing state is also stored globally rather than scoped to the authenticated owner.
3. Pairing notifications contain identity, revision and state, but the transport ignores them. Missing and expired pairings share a 404 even though expiration is a recoverable lease conflict. Recovery must inspect domain error codes, preserve the operation/idempotency identifiers, and never replay a request after ambiguous transport failure.
4. Python resets reconnect backoff immediately after HTTP 200 and reports abnormal chunk termination as clean closure. Short-lived streams therefore never accumulate backoff. Queue Center caches subscriber tokens until a rejected request, while Relay ignores the available token lifetime. Both must use the shared subscriber for proactive renewal and stable-connection backoff.
5. Queue Center checks only whether any endpoint exists, rather than whether it is still the subscribed endpoint. The stream remains attached to an obsolete coordinator after failover.
6. UI roster snapshots and pending refreshes survive auth transitions. A response started by an old account can populate the next account's roster. Pairing and operation work also need generation fencing.
7. Terminal subscribes to all owner terminal events without filtering the selected device; multiple pairings on one device also cause repeated owner-topic publication. Filter at the UI and publish once per owner/device revision.
8. The FrankenPHP worker watches default app files, but the shared Relay JSON contract is outside the Laravel app directory. Contract edits can leave worker-resident contract caches stale after synchronization. Add the shared contract directory to the existing worker watch configuration.
9. Pair creation passes a NUL-delimited identifier to PostgreSQL `text` for advisory locking. PostgreSQL text cannot represent NUL; hash the composite identity in PHP before binding it so the lock key remains portable and complete.
10. The shared browser stream resets backoff at subscription headers, retains its event cursor across auth transitions, and leaves reader cleanup implicit. Apply the same stable-stream backoff and explicit stream cleanup policy as Python.

## Implementation boundary

The existing unified routes, protected owner topics, outbox, screenshot resource transport and embedded hub remain the shared architecture. Fix their lifecycle defects in place. Preserve historical migrations and persisted device credentials. Runtime availability is not established by unauthenticated endpoint responses.

## Official references

- https://mercure.rocks/docs/hub/troubleshooting: subscriber JWT expiration disconnects a stream.
- https://mercure.rocks/docs/hub/config: heartbeat and write timeout control stream lifetime.
- https://frankenphp.dev/docs/worker/: workers retain application state and require lifecycle-aware reloads.
- https://www.postgresql.org/docs/current/datatype-character.html: PostgreSQL character values cannot contain NUL.

## Scope

Inspect admission errors, identity transitions, pairing notifications, Python stream renewal, and deployment before implementing the coordinated changes. Do not run tests, builds, or services.

## Implemented changes

- UI pairing leases reconcile after page load, invalidate on newer pairing notifications, and use authentication generation guards. Explicit pairing admission failures receive one coordinated recovery attempt with unchanged operation and idempotency identifiers; blob allocation uses the same recovery path. Network failures and unrelated 404 responses are not replayed.
- Laravel distinguishes missing, expired and inactive pairings. Pair creation hashes its advisory lock identity before binding PostgreSQL text.
- Browser operation consumers release the shared stream when finished. Roster refreshes cannot publish an older account's response. Stream cursors reset on auth transitions, incomplete SSE frames are discarded, and readers release their locks.
- Shared Python subscriptions accept token lifetimes, renew before expiration, retain exponential backoff across short abnormal streams, and commit event cursors at complete frame boundaries. Queue Center follows coordinator changes.
- Terminal event delivery deduplicates pairings per owner and filters the selected device in the UI. Existing screenshot byte transfer, digest validation and previous-image retention remain in use.
- The shared runtime used by the 175 launcher watches the repository contract directory in addition to normal worker files. The 93 installer already uses the canonical FrankenPHP pipeline; no second runtime or installer was added.

## Validation boundary

No builds, tests, services, deployment scripts or runtime verification were executed under the supplied project rules. No Git commands were used. The browser report does not include the authenticated 404 response body, so its specific production error code is not established. Authenticated operation completion, live screenshot rendering and sustained reconnect behavior remain unverified; this document does not claim production acceptance.
