# Pycore Remote Relay V2 - Pycore Progress

Owner: Pycore/Python implementation AI  
Updated: 2026-08-23  
Main design: `DESIGN_20260823_PYCORE_REMOTE_RELAY_V2.md`

## Scope and status

Python implementation is source-complete for the Relay V2 and Terminal domain
work described by the main design. This document remains mutable. The main
design is frozen and must not be changed.

No PHP, Laravel, UI, PowerShell, shell, Caddy, or test file was changed by this
task. The parallel Laravel AI must read the main design, this progress file,
`PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_LARAVEL.md`, and
`PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_INTEGRATION.md` before changing PHP.

## Completed Python work

- Published `config/pycore_relay_contract.json` as the versioned
  machine-readable authority for endpoints, signing, digests, limits, allowed
  headers, events, capabilities, route exposure, retry policies, and result
  outcomes. Unclassified UI routes are denied.
- Added an independent Ed25519 Relay identity. Device UUID, key generation,
  enrollment, credential state, request signing, and POSIX file permissions are
  repaired as separate minimum steps. Relay V2 does not send the legacy HMAC
  identity headers.
- Replaced the old request/response relay behavior with an outbound-only agent:
  enrollment polling, heartbeat, short-lived Mercure authorization, one private
  device wake subscription, bounded reconnect, wake-plus-periodic claims,
  cancellation/expiry acknowledgement, and credential-revocation recovery.
- Extracted one transport-neutral RPC execution kernel shared by local FastAPI
  and Relay. Relay dispatches handlers in process and never calls the local HTTP
  listener. Parsing, route lookup, method checks, timeout, context, response
  encoding, allowed headers, explicit no-body state, and exact bytes are shared.
- Reused `OperationService` and `StateRepository` for external operation IDs.
  Added atomic admission and a Relay result adapter instead of a second generic
  operation implementation.
- Added a durable execution ledger with request-digest conflict rejection,
  exact response persistence before completion, safe read/idempotent-write
  recovery, at-most-once `execution_unknown`, failed-outcome preservation, and
  byte-exact replay.
- Added server-side execution fencing to the Python protocol. Every claimed
  descriptor carries `claim_epoch`, lease owner, revision, and expiry. Pycore
  conditionally confirms `execution-start` before any handler runs, then renews
  long leases in a separate ThreadBus task. Results, response blobs, and
  finalization carry the same epoch/owner/revision. An at-most-once physical
  action is never started before this acknowledgement; fencing prevents stale
  state writes but does not claim to undo an action already sent to the OS.
  Execution-start and renewal provide server time plus expiry; Pycore converts
  their delta to a guarded monotonic deadline instead of assuming a fresh lease
  from local receive time.
- Split large response delivery into independently idempotent allocation, chunk
  PUT, finalization, and result submission steps. No umbrella completed check
  skips repairable missing steps.
- Removed Python use of the Queue Center V1 Relay section and helper paths.
- Added shared structured activity logging through `ActivityLog` and
  `ColorPrint`. Relay identity, transport, enrollment, heartbeat, hub state,
  claim, validation, ledger, execution, blob, result, device-event, Terminal
  RPC, demand, capture, resource, and scheduler outcomes emit bounded action
  records. Keys, credentials, claim codes, signatures, authorization, and
  tokens are redacted; bytes are logged only as length and SHA-256.

## Terminal performance correction

The primary slowdown was architectural: every `ui/terminal/windows` snapshot
captured every online terminal, PNG-encoded each capture, Base64-expanded it,
and copied all images into the JSON response. The polling interval repeated the
work even when a window was unchanged.

The Python domain now:

- returns metadata, a stable state digest, screenshot revision, and resource
  descriptors without Base64 image bytes;
- records a short viewer-demand lease for explicitly visible window IDs;
- claims capture per window, coalesces concurrent requests, and performs the
  capture outside the snapshot request thread in contract-bounded batches;
- uses a non-zero freshness interval and does not increment revision or emit an
  event or alter public capture metadata when the PNG digest is unchanged;
- fences concurrent capture attempts with a per-window epoch so an older
  asynchronous capture cannot overwrite a newer forced post-action capture;
- retains bounded immutable digest-addressed PNG resources and serves exact
  bytes through `ui/terminal/screenshot` with ETag and 304 semantics;
- publishes metadata-only `terminal.changed` events through ThreadBus, then the
  outbound Relay device-event endpoint; screenshots never enter Mercure.

The parallel UI/Laravel work must stop expecting `window.screenshot` Base64 and
consume the resource contract documented in the integration progress file.

## Principal source areas

- Contract: `config/pycore_relay_contract.json`
- Relay: `pycore/pyctl/relay/`
- Shared identity, contract, ledger, logging, response value, and events:
  `pycore/pyutils/common/`
- Shared execution: `pycore/pyutils/rpc_v2/execution.py` and
  `pycore/pyutils/rpc_v2/server.py`
- Durable state: `pycore/database/schema/state_schema.py`,
  `pycore/database/repositories/state_repository.py`, and
  `pycore/pyutils/common/operation_service.py`
- Terminal: `pycore/pyctl/terminal/`,
  `pycore/callmodule/rpc_routes/terminal_routes.py`, and
  `pycore/pyutils/window/screen_capture.py`
- Lazy cryptography access: `pycore/pyfoundations/third_party/`

## Official sources applied

- RFC 9421 message-component and canonicalization principles:
  <https://www.rfc-editor.org/rfc/rfc9421.html>
- Cryptography Ed25519 API:
  <https://cryptography.io/en/stable/hazmat/primitives/asymmetric/ed25519/>
- Cryptography key serialization:
  <https://cryptography.io/en/stable/hazmat/primitives/asymmetric/serialization/>
- Python SQLite transaction and BLOB behavior:
  <https://docs.python.org/3/library/sqlite3.html>
- Requests streaming and raw response behavior:
  <https://requests.readthedocs.io/en/stable/user/advanced/>
- Mercure protocol and private update behavior:
  <https://mercure.rocks/spec>
- PostgreSQL row-lock lifetime:
  <https://www.postgresql.org/docs/17/explicit-locking.html>
- AWS lease heartbeat and conditional-write locking pattern:
  <https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/BestPractices_DistributedLocking.html>
- RFC 8628 device-flow security properties:
  <https://www.rfc-editor.org/rfc/rfc8628.html>
- RFC 9449 proof-of-possession binding:
  <https://www.rfc-editor.org/info/rfc9449/>

## Parallel review disposition

The later architecture review was substantially correct. Mercure remains a
notification plane; PostgreSQL remains authoritative; row locking protects only
the short claim transaction; long external execution needs a conditional epoch
and lease renewal; and canonicalization must be machine-defined. Its report that
the final `ui/` rule still allowed all routes described an earlier file state:
the current contract denies that prefix by default.

The contract now also includes legal transitions and guards, heartbeat/lease/
token/retention durations, per-owner and per-device limits, route profiles with
permission/payload/timeout/retry, and the pinned Mercure profile. Enrollment
creation is signed as this project's explicit proof-of-possession choice; the
progress record does not present it as a requirement imposed by RFC 8628 or RFC
9449. Blob durability is specified as a persistent immutable chunk manifest,
not as a mandatory database-table implementation.

## Review boundary

Static source review checked the new call paths, old Relay Python references,
route default denial, no Relay localhost loopback, no Terminal Base64 snapshot
path, and no `Thread(target=...)` in the new runtime. Repository rules prohibit
tests, builds, service startup, and runtime verification unless separately
requested, so none were run.
