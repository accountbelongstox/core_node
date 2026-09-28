# A7A Relay admission and stream lifecycle

## Findings

11. The browser starts the shared Relay/Queue Center stream even when no
    dashboard session exists. A 401 from the authorization endpoint is treated
    as a transport failure and schedules another reconnect, so an anonymous
    page can create an avoidable authorization/request storm. Authentication
    rejection must pause reconnecting until the shared auth session changes;
    network failures should retain bounded backoff.

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
12. The owner roster client assumes that the Laravel `devices` field is always
    an array. A malformed, partial, or changed envelope can therefore reach
    `devices.map` and turn a recoverable coordinator response into a UI
    exception. Validate the array at the shared API boundary and surface a
    stable contract error to the roster coordinator.
13. The pycore target switcher starts the Relay roster and owner Mercure stream
    while the selected target is direct or local. An anonymous or otherwise
    unauthenticated page consequently performs owner authorization work even
    when no Relay feature is active. Relay presence must be lazy and scoped to
    the Relay target, and an owner 401/403 must pause roster refresh until the
    auth session changes.
14. The shared browser Mercure transport resumes with `lastEventID` in the
    URL but does not send the protocol's `Last-Event-ID` resume header. A
    reconnect after a stream interruption can therefore use a less reliable
    cursor path than the Python subscriber and lose the intended replay
    position. Browser and Python subscribers must use the same resume profile.

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
- Browser Relay and Queue Center authorization failures now pause reconnecting
  until the shared auth session changes; network and stream failures still use
  bounded backoff. Mercure HTTP failures retain their status so this decision
  is made at the shared stream boundary. Authentication and coordinator
  transitions also fence stale in-flight realtime connections and cursors.
- The owner roster API now validates the `devices` array before the shared
  roster coordinator maps it, converting malformed envelopes into the stable
  `RELAY_ROSTER_PAYLOAD_INVALID` contract error.
- The target switcher now activates the Relay roster only for a Relay target;
  roster authorization failures pause refresh until the shared auth session
  changes, while explicit stop/start remains a retry boundary.
- Browser Mercure reconnects send `Last-Event-ID` alongside the contract's
  initial `lastEventID` query cursor.
- The shared runtime used by the 175 launcher watches the repository contract directory in addition to normal worker files. The 93 installer already uses the canonical FrankenPHP pipeline; no second runtime or installer was added.

## Validation boundary

No project test suite, build, or service start was run. Read-only endpoint and
browser DOM/console diagnostics were run; they cannot establish authenticated
operation completion, live screenshot rendering, or sustained reconnect
behavior without a real dashboard session and an online enrolled pyservice.
No Git commands were used, and the browser report does not include the
authenticated 404 response body, so its specific production error code is not
established.
