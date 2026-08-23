# Pycore Remote Relay V2 - Integration Progress

Owners: Pycore/Python AI and parallel Laravel/PHP AI  
Updated: 2026-08-23  
Main design: `DESIGN_20260823_PYCORE_REMOTE_RELAY_V2.md`

## Coordination contract

- The main design is frozen.
- `config/pycore_relay_contract.json` is the machine-readable authority and is
  currently owned by the completed Python task. PHP must read it and must not
  duplicate fallback endpoints, limits, headers, events, policies, or states.
- The contract digest is lowercase SHA-256 of the exact JSON file bytes. Do not
  parse and re-encode the file before hashing it.
- Each AI changes only its owned sources. The Python AI changed no PHP/UI/Shell
  file. The Laravel AI records its status in the Laravel progress document and
  appends contract questions or completed handoffs here.
- V1 is not dual-read or dual-written. Idempotency is implemented at each
  smallest durable step, never as one umbrella early return.

## Python to Laravel handoff

Python implementation is complete statically. Laravel and UI implementation is
still owned by the parallel AI.

### Signed device requests

All coordinator JSON bodies are UTF-8 JSON with sorted keys and compact
separators. Pycore signs the exact transmitted bytes with Ed25519. Base64url key
and signature values omit padding. The canonical input is UTF-8 text containing
these lines, including empty normalized query when absent:

```text
protocol-version
credential-version
HTTP-method
normalized-path
normalized-sorted-query
device-id
timestamp
nonce
SHA-256(body-bytes)
```

Normalization rules:

- method is uppercase;
- path forbids query/fragment text, gets exactly one leading slash, is strict
  UTF-8 percent-decoded, then RFC 3986 percent-encoded with only `/-._~` safe;
- multiple leading slashes, backslashes, encoded slash/backslash separators,
  malformed percent triplets, control characters, and invalid UTF-8 are
  rejected;
- query pairs are sorted by string key then string value and encoded using
  standard URL form encoding (`urllib.parse.urlencode`, spaces become `+`);
- repeated array/tuple values expand to repeated pairs before sorting; an empty
  value is `key=`, an existing percent sign becomes `%25`, Unicode is UTF-8
  without normalization, and an empty array contributes no pair;
- query keys and scalar/repeated values must be strings; numbers, booleans,
  nulls, objects, and nested arrays are rejected instead of string-coerced;
- timestamp is Unix seconds;
- nonce is a random URL-safe string and is single-use per credential version;
- body digest is lowercase hexadecimal SHA-256, including the empty body;
- the exact header names come from `signature_profile.headers`.

Enrollment creation is signed by the proposed device key before a credential
exists. Its credential-version header is the key version and it has no
credential-ID header. Laravel must verify it against the public key in the
enrollment payload. Later enrollment status requests are verified against the
stored proposed key. Credentialed calls require the credential-ID header.

This signed-create proof of possession is the selected project profile, not a
claim that RFC 8628 mandates it. Laravel still uses a high-entropy enrollment ID,
one-time human code, bounded expiry, attempt throttling, and explicit user
confirmation. The issued credential is bound to the enrolled public key.

Laravel validation steps remain independent: protocol, device/enrollment,
credential state/version, timestamp window, content digest, Ed25519 signature,
then atomic nonce insertion. A failure in one step must not skip repair or
validation of another step.

### Enrollment and runtime endpoints

Endpoint templates are authoritative in the shared contract.

- Enrollment create request has one `device` object containing `device_id`,
  `label`, `platform`, `public_key`, `key_algorithm` (`ed25519`), `key_version`,
  `contract_digest`, `capability_digest`, and `capabilities`.
- Enrollment create/status response data contains
  `enrollment:{enrollment_id,state,claim_code,expires_at}`. A claimed response
  also contains `credential:{credential_id,credential_version}` and may contain
  the hub descriptor.
- Heartbeat request contains `device_id`, `contract_digest`, and `capabilities`.
- Hub authorization request contains `device_id` and `contract_digest`.
- Hub response data contains
  `hub:{url,topic,subscriber_token,expires_in_seconds}`. The token is a
  short-lived private subscriber token and must never enter URLs or logs.
- The device subscribes to only the contract-rendered `device_wake` topic and
  handles `relay.operation.available` and `relay.credential.revoked`.
- The hub URL must use the exact coordinator origin and configured
  `/.well-known/mercure` path, with no user information, query, fragment, or
  redirect. Its topic must exactly match the device topic, its lifetime must be
  finite and no longer than `subscriber_token_seconds`, and one SSE event is
  bounded by `device_event_payload_bytes`.
- Claim request contains `device_id`, stable process `lease_owner`, bounded
  `limit`, and `contract_digest`. Response data contains `operations:[]`.
- Pycore binds a claim batch to the coordinator URL that returned it. All
  execution-start, renewal, blob, and result calls for that batch stay on that
  origin even if the globally selected endpoint changes concurrently.
- Device event request contains `device_id`, `event_type`, `revision`, and
  metadata-only `payload`. For `terminal.changed`, Laravel fans out a compact
  pairing-status notification through its transactional outbox; it never puts
  screenshot bytes in Mercure.

### Claimed operation descriptor

Each claim item contains:

```text
operation_id, revision, state, claim_epoch, lease_owner, lease_expires_at,
pairing_id, user_id,
method, path, query, headers,
body_present, body_base64 OR body_ref,
body_sha256, body_length, request_digest
```

`body_base64` is standard padded Base64. `body_present=false` is distinct from
an explicitly present empty body. A present empty body uses empty Base64,
length 0, and the SHA-256 of empty bytes. `body_ref` is fetched as exact raw
bytes from the contract request-blob endpoint. Binary requests advertise
`Accept-Encoding: identity`; Laravel must return the stored bytes without a
content-coding transformation.

The descriptor `path` must already equal the canonical path, including its one
leading slash. `query` must follow the string-only rules above; Pycore does not
accept a descriptor that depends on normalization or type coercion to become
valid.

Pycore recalculates the request digest over compact, key-sorted UTF-8 JSON:

```json
{
  "method": "UPPERCASE",
  "path": "/one-leading-slash/path",
  "query": "canonical-form-urlencoded-query",
  "headers": {"allowed-lowercase-name": "string value"},
  "body_present": true,
  "body_sha256": "lowercase hex",
  "body_length": 0
}
```

Only contract-allowed headers participate. Operation/device/user/pairing
ownership is server-derived. A different digest under an existing operation ID
is rejected. `cancel_requested`/`canceled` and `expired` claim descriptors are
acknowledged without local execution.

### Execution fencing and lease renewal

PostgreSQL row locks protect only Laravel's short claim transaction. The claim
transaction increments `claim_epoch`, stores the lease owner and expiry, and
returns them with the current operation revision. Pycore performs no local RPC
handler before this conditional call succeeds:

```text
POST operation_execution_start
operation_id, operation_revision, claim_epoch, lease_owner,
request_digest, retry_policy
```

Laravel updates `leased -> executing` only when device, owner, epoch, revision,
state, and unexpired lease all match; it increments and returns the operation
revision. The response also returns RFC 3339 `server_time` and
`lease_expires_at` values with explicit offsets. Pycore derives the usable
duration from those two server values, subtracts the contract guard, and maps
that duration onto its monotonic clock. It does not infer expiry as local
receive time plus the configured lease. Pycore then marks its local ledger
running and starts the handler.

Execution-start is independently idempotent. If the transition committed but
its HTTP response was lost, repeating the identical request for the same owner,
epoch, request digest, and retry policy while already `executing` returns the
existing executing revision and does not increment it again. A claimed
`leased` descriptor requires a newer returned revision; a recovered
`executing` descriptor requires the same returned revision.

While execution or response-blob upload is active, Pycore calls
`operation_lease_renew` with operation ID, executing revision, claim epoch, and
lease owner. Renewal conditionally extends only that generation and does not
increment the domain revision. Every renewal response repeats `server_time` and
`lease_expires_at`; Pycore replaces its monotonic deadline only after validating
both. The guarded usable duration must remain greater than
`operation_lease_renew_seconds` and the server-reported duration must not exceed
`operation_lease_seconds`. Transient failures retry within the known lease;
401/403/409/410 or actual lease expiry fence the claimant immediately.

Claimed descriptors execute in a bounded concurrent ThreadBus batch of at most
`device_active_leases`. The heartbeat and reconciliation control loop remains
independent. `operation_lease_shutdown_wait_seconds` bounds direct renew-thread
joining; a still-running transport call retains the stop fence until deferred
cleanup observes thread exit.

Every result and response-blob allocate/finalize step carries the executing
revision, epoch, and owner. A stale claimant cannot update Laravel even if its
OS action continues. For `at_most_once_action`, an expired executing generation
becomes `execution_unknown` and is never automatically reclaimed. Only `read`
or genuine `idempotent_write` may be reclaimed with a new epoch.

### Result submission and blobs

Execution result payload fields are:

```text
operation_id, operation_revision, claim_epoch, lease_owner,
outcome, status, headers,
body_present, body_sha256, body_length, result_digest,
body_base64 OR body_ref
```

`status` and `result_digest` are omitted for non-execution outcomes that have no
HTTP response. Outcomes are contract-owned. Headers are lower-case and filtered
by the response allowlist. No-body is distinct from an empty body.

`result_digest` is SHA-256 of compact, key-sorted UTF-8 JSON containing status,
lower-case sorted headers, body presence, body SHA-256, and body length. Laravel
must use the complete result plus outcome for duplicate-result conflict checks;
body digest alone is insufficient.

Responses at or below `inline_body_bytes` use standard Base64. Larger responses
use these independently idempotent steps:

1. allocate with `operation_id`, direction `response`, expected SHA-256, and
   expected length plus execution revision/epoch/owner; return
   `blob:{blob_id,...}` or a root `blob_id`;
2. PUT immutable raw chunks by `(blob_id, chunk_index)` using the contract chunk
   size;
3. finalize with blob ID, expected SHA-256, and expected length;
4. submit the stable operation result referencing `body_ref`.

Each repeated allocation/chunk/finalize/result with identical identity and
bytes resolves the existing step. Conflicting bytes or metadata return conflict.
Laravel may persist chunk identity in rows or in an immutable file manifest;
the required behavior is unique index/digest, contiguous finalization, durable
manifest state, bounded owner storage, and concurrency-safe finalization.

### Route and execution policy

Pycore applies the local contract again after Laravel validation. Unclassified
`ui/*`, streaming events, open/reveal/path-picker actions, CodeSync workspace
operations, and Laravel endpoint-control routes are denied. Terminal routes are
classified individually. Safe recovery is allowed only for `read` and genuine
`idempotent_write`; keyboard, mouse, activation, input, Enter, history, and
scroll are `at_most_once_action` and become `execution_unknown` after an
ambiguous crash.

Route entries reference contract-owned profiles. A resolved profile always has
`exposure`, `permission`, `payload`, `timeout_seconds`, and `retry`. Laravel must
authorize the permission and validate the payload before admission; Pycore
re-resolves the same profile and applies its timeout and retry policy.

Matching precedence is `exact > prefix > suffix`; equal-kind matches choose the
longest value and then the first declaration. The default profile is denied.
This makes the `ui/` deny prefix override generic read suffixes while explicit
Terminal route entries remain allowed. Relay GET operations cannot carry a
request body.

The contract-pinned Mercure profile uses one authorized SSE subscription with
repeated `topic` parameters, Bearer private-subscriber JWT, `lastEventID` for the
initial cursor, `Last-Event-ID` on resume, no redirects, notification-only
payloads, and mandatory source-resource reconciliation after history loss.
These parameter names are the frozen legacy profile for Mercure 0.24.2; do not
replace them with the current standardized `match`/`last_event_id` names unless
the pinned runtime and shared contract are deliberately upgraded together.

### Terminal UI contract

- `POST ui/terminal/windows` accepts `viewer_id` and
  `visible_window_ids:string[]`. It returns window metadata, `state_revision`,
  `screenshot_revision`, and optional `window.screenshot_resource`. It never
  returns `window.screenshot` Base64.
- `POST ui/terminal/viewer_demand` renews the same bounded viewer/window lease.
- A screenshot descriptor contains MIME, digest, ETag, byte length, pixel size,
  capture timestamp, revision, and `resource:{route,window_id,digest}`.
- `GET ui/terminal/screenshot?window_id=...&digest=...` returns raw `image/png`,
  immutable cache headers, and ETag; matching `If-None-Match` returns 304.
- Capture is asynchronous for snapshots, so the first snapshot may not yet have
  a descriptor. `terminal.changed` or bounded snapshot reconciliation supplies
  it. UI must request resources only for visible windows/active preview and
  isolate its clock from the terminal tree.

## Laravel to Python handoff

Laravel source now implements the Relay V2 coordinator foundation: additive
global PostgreSQL schema, exact-byte contract adapter, Ed25519/nonce middleware,
enrollment and credential binding, current-generation pairing authorization,
durable operations, conditional lease/execution fencing, generation-bound blob
manifests, owner/device controllers, transactional outbox publication, bounded
maintenance, rate limits, API metadata, and i18n errors. The V1 route file is no
longer mounted; its files and data remain for separately authorized cleanup.

Laravel claim uses a short transaction and PostgreSQL
`FOR UPDATE SKIP LOCKED`. Every claim increments `claim_epoch`; execution-start,
renewal, finalization, and result submission require the exact revision, epoch,
lease owner, device, state, and unexpired lease. An expired executing
`at_most_once_action` becomes `execution_unknown`. Response blob allocation is
idempotent per `(operation_id, direction, claim_epoch)`, while immutable chunk
and finalization steps validate their own exact digest and length.

Laravel performed static source inspection only. It did not run PHP, Artisan,
migrations, tests, builds, services, or live requests.

### Shared contract gaps blocking freeze

The Python-owned contract currently contains only device endpoints, only the
device wake topic, and no owner operation/pairing event names. The Laravel owner
routes, opaque owner/pairing topics, and `relay.pairing.changed` name therefore
remain temporary Laravel-owned vocabulary. This conflicts with the coordination
rule that the shared contract owns every endpoint, topic, and event. Add canonical
entries for enrollment claim, roster, pairing create/renew/revoke, owner hub
authorization, operation admit/status/cancel, request blob allocate/chunk/finalize,
response blob download, owner roster topic, pairing operation topic, pairing
change event, and operation status event before contract freeze.

The contract also lacks a device credential lifetime, Relay rate-limit values,
outbox retention, and explicit public Laravel/Mercure URLs. Laravel currently
reuses `pairing_lease_seconds` for credential expiry and the legacy
`RelayHubJwt` Queue Center hub-path resolver; neither choice should become frozen
Relay V2 protocol behavior.

`operation_transitions.leased` excludes `failed`, but
`transition_guards.nonexecution_result` permits a leased descriptor to report a
validation failure. Pycore does exactly that from `_reject_descriptor`. Laravel
follows the explicit guard, so the transition table must be corrected.

Laravel cannot append the required owner operation-status outbox row without a
canonical event and owner/pairing topic. Status GET remains authoritative, but
Mercure completion wake-up is incomplete until those contract entries exist.

### Static Python deficiencies observed by Laravel

- `RelayOperationProcessor._upload_response_blob` sends execution generation on
  allocation and finalization, but its raw chunk PUT carries no revision, epoch,
  or lease-owner component. Laravel binds the unguessable blob ID to the stored
  allocation generation and checks the current operation before accepting each
  chunk, which closes the current server path. If the intended protocol requires
  every mutation to carry an explicit generation, Python and the contract must
  add signed generation query fields to the chunk endpoint.
- Request-blob download also carries only `blob_id`. Laravel now requires that
  the stored blob be bound to an actively leased/executing operation, but it
  cannot distinguish two local claimants sharing the same device credential.
  Add signed revision/epoch/lease-owner fields if per-process claim isolation is
  required for downloads.
- Pycore handles any `credential_revoked` event by clearing its current
  credential and enrollment without checking a credential ID/version in the
  payload. Laravel therefore cannot safely publish a delayed old-generation
  revocation event after a new credential is active. The handler must ignore
  revocations that do not match its current credential generation.
- The Python progress claim that the contract is authoritative for endpoints,
  topics, and events is broader than the current JSON content. The missing owner
  vocabulary above must be supplied by the Python contract owner.

## Integration status

Python device side: source-complete claim retained, with the static gaps above.  
Laravel side: coordinator foundation source-complete, contract-blocked.  
UI/deployment/live integration: pending other owners.

Tests, builds, services, and live verification require separate user
authorization and were not run by the Python task.
