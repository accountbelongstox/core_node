# Status Snapshot Single-Flight Recovery

## Cause

- Concurrent capability requests shared one unversioned completion signal per snapshot key.
- A slow or stuck first loader left later callers waiting for 120 seconds and then raised an ASGI-visible timeout.
- `refresh=true` coupled the aggregate AI status exchange to sequential live provider and quota probes.

## Common-Layer Consolidation

- `StatusSnapshotCache` is the shared single-flight base for all local status slices.
- Each load owns a generation, lease, completion signal, and waiter count through the serialized cache state owner.
- Concurrent callers return a matching stale snapshot while a refresh is active.
- A cold load waits only for the remaining lease; after expiry, a new generation can take ownership.
- Superseded generations cannot overwrite the current cache, and completion signals are retained only while registered waiters exist.
- Versioned consumers never receive a stale snapshot from another source version.
- Single-item `get()` and batch `get_many()` now share limit normalization, waiter-response validation, and background-load startup cleanup instead of maintaining parallel concurrency rules.

## AI Status Boundary

- `gateway_status(refresh=true)` now rebuilds the local AI snapshot without making provider or quota network calls.
- Live provider tests remain in the dedicated AI probe service, which already owns the slow external operation contract.
- RPC routes remain thin and do not hide cache or loader failures.

## Static Flow Reasoning

1. A fresh entry returns immediately.
2. The first expired-entry caller owns a new generation, returns matching stale data immediately, and refreshes it on a bus task.
3. Concurrent callers with the same source version also receive stale data immediately.
4. Concurrent cold-start callers wait on that exact generation.
5. A successful owner stores the snapshot and wakes its registered waiters.
6. A failed owner returns matching stale data to its caller when available and reports the real error on a cold start.
7. An expired lease allows takeover; the old generation may finish but cannot replace the new owner's cache entry.
8. Aggregate capability refresh remains local, so AI provider network latency cannot hold the capability exchange.

## Verification Boundary

No tests, builds, services, or runtime verification were run, as required by the project instructions.
