# Pycore Remote Relay V2 - Laravel Progress

Owner: Laravel/PHP implementation AI  
Updated: 2026-08-23  
Main design: `DESIGN_20260823_PYCORE_REMOTE_RELAY_V2.md`

## Scope

This is the mutable Laravel/PHP progress record. The frozen design, Python
sources, tests, and Python-owned `config/pycore_relay_contract.json` were not
modified. No shell, PowerShell, Caddy, service, build, migration, or test command
was run.

## Current status

The Laravel Relay V2 foundation is implemented in source. It is not ready for a
contract freeze or live cutover because the shared contract omits owner-facing
endpoints, owner/pairing topics, owner status event names, credential lifetime,
rate limits, and the explicit public Mercure URL. These omissions are recorded
in the integration handoff rather than duplicated as new PHP defaults.

V1 route mounting is disabled. V1 source files and storage are retained because
their deletion requires a separately authorized, recoverable cleanup after the
cross-client cutover.

## Implemented Laravel work

- Added the versioned `App\Apps\RelayV2` sub-application, `Ctl` controllers,
  per-app services/models/constants/table maps, route module, and `RelayV2ApiInfo`.
- Added nine additive global migrations through
  `SafeMigrationHelper::alignTableStructureFromArray` for devices, enrollments,
  credentials, pairings, operations, blobs, immutable blob chunks, nonces, and
  the transactional outbox. The global table/field vocabulary is centralized in
  `GlobalTablesMap` and `RelayV2TablesMaps`.
- Added an exact-byte shared-contract reader. It hashes the original JSON bytes,
  rejects missing required sections and unsupported Ed25519 profiles, validates
  state coverage/outcomes/retry profiles, and implements the Python-compatible
  method/path/query/canonical-JSON digest rules without endpoint or limit
  fallbacks.
- Added Ed25519 request verification, explicit enrollment proposed-key proof,
  credential version/state/expiry checks, body digest checks, clock-window
  checks, and atomic nonce replay rejection. The protocol response header comes
  from the contract.
- Added enrollment create/status/claim, user ownership binding, credential issue
  and rotation, heartbeat, owned roster, pairing create/renew/revoke, and
  short-lived topic-scoped Mercure subscriber authorization.
- Added Sanctum owner authorization and per-route token ability enforcement.
  Device, pairing, operation, and blob reads are owner/device scoped.
- Added durable operation admission with request-digest and idempotency-key
  conflict checks, a serialized per-owner pending limit, contract route/payload
  policy enforcement, and transactional wake outbox append.
- Added bounded PostgreSQL claim with `FOR UPDATE SKIP LOCKED`, device capacity,
  short lease transactions, `claim_epoch`, stable lease owner, execution-start
  acknowledgement, renewal, revision conditions, safe reclaim, cancellation,
  terminal result submission, and `execution_unknown` for an expired executing
  at-most-once action.
- Added minimum-step result idempotency. A duplicate terminal submission must
  match outcome, prior revision, epoch, lease owner, status, filtered headers,
  body source, body digest/length/presence, result digest, and error code.
- Added private blob storage through `PathMapper` and `FileSystemManager` with a
  durable row manifest, immutable `(blob_id, chunk_index)` chunks, per-owner
  quota locking, exact digest/length checks, contiguous finalization, and bounded
  retention cleanup. Request blobs bind to one operation and require an active
  lease to download. Response allocation is unique per operation generation as
  `(operation_id, direction, claim_epoch)`.
- Centralized current-credential pairing validation. A stale pairing generation
  cannot allocate request storage, admit work, receive a claim, or receive a
  pairing subscriber grant; explicit renewal rebinds it to the current device
  credential generation.
- Reused and extended the existing realtime outbox publisher and Octane timer
  catalog. Relay outbox rows have an idempotent transition key, bounded retries,
  dead-letter state, and private Mercure publication. Added bounded maintenance
  slices for operation/pairing/enrollment expiry, nonce pruning, and private blob
  cleanup.
- Added named owner/device/enrollment-claim rate limiters, localized English and
  Chinese messages, and Relay-specific JSON domain error codes.

## Remaining Laravel/integration work

- Replace the temporary PHP-owned owner route paths, opaque owner/pairing topic
  construction, and `relay.pairing.changed` event literal after the shared
  contract defines their canonical names. Until then these surfaces are not
  contract-authoritative and the API metadata can expose only contract-owned
  device endpoints.
- Add operation terminal/status outbox notifications after the contract supplies
  the owner operation event and topic. PostgreSQL status GET is authoritative,
  but the current contract cannot name the required Mercure notification.
- Move Relay V2 hub URL/origin resolution off the legacy Queue Center Relay block
  after explicit `laravelApiBaseUrl`/`mercureHubUrl` runtime values exist.
- Define a credential lifetime separate from pairing lease duration. The current
  credential expiry uses `pairing_lease_seconds` only because no credential TTL
  exists in the shared contract; this must not be frozen as protocol behavior.
- Define a versioned credential-revocation event payload before publishing
  rotation notifications. Current Pycore clears its current credential for any
  such event and does not compare the revoked credential version.
- Resolve the shared transition contradiction: `operation_transitions.leased`
  excludes `failed`, while `transition_guards.nonexecution_result` explicitly
  allows leased validation failure. Laravel currently follows the explicit guard.
- Define outbox retention and canonical Relay rate limits in the contract if they
  are protocol requirements rather than deployment policy.
- Coordinate UI owner transport and one multiplexed Mercure connection before
  removing retained V1 classes/configuration/storage.

## Official sources applied

- Laravel 13 query builder transactions and pessimistic locking:
  <https://laravel.com/docs/13.x/queries>
- PostgreSQL queue-style `SKIP LOCKED` selection:
  <https://www.postgresql.org/docs/current/sql-select.html>
- PostgreSQL row-lock lifetime:
  <https://www.postgresql.org/docs/17/explicit-locking.html>
- Mercure private subscriptions, multiple topics, history, and reconciliation:
  <https://mercure.rocks/spec>
- HTTP message canonicalization principles:
  <https://www.rfc-editor.org/rfc/rfc9421.html>
- PHP Sodium detached Ed25519 verification:
  <https://www.php.net/manual/en/function.sodium-crypto-sign-verify-detached.php>

## Review boundary

Only static source inspection was performed. Repository rules require separate
authorization for tests, builds, migrations, services, and runtime verification,
so the implementation remains unverified at runtime.
