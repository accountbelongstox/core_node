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
- path is one leading slash plus the supplied path with leading slashes removed;
- query pairs are sorted by string key then string value and encoded using
  standard URL form encoding (`urllib.parse.urlencode`, spaces become `+`);
- timestamp is Unix seconds;
- nonce is a random URL-safe string and is single-use per credential version;
- body digest is lowercase hexadecimal SHA-256, including the empty body;
- the exact header names come from `signature_profile.headers`.

Enrollment creation is signed by the proposed device key before a credential
exists. Its credential-version header is the key version and it has no
credential-ID header. Laravel must verify it against the public key in the
enrollment payload. Later enrollment status requests are verified against the
stored proposed key. Credentialed calls require the credential-ID header.

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
- Claim request contains `device_id`, stable process `lease_owner`, bounded
  `limit`, and `contract_digest`. Response data contains `operations:[]`.
- Device event request contains `device_id`, `event_type`, `revision`, and
  metadata-only `payload`. For `terminal.changed`, Laravel fans out a compact
  pairing-status notification through its transactional outbox; it never puts
  screenshot bytes in Mercure.

### Claimed operation descriptor

Each claim item contains:

```text
operation_id, revision, state, pairing_id, user_id,
method, path, query, headers,
body_present, body_base64 OR body_ref,
body_sha256, body_length, request_digest
```

`body_base64` is standard padded Base64. `body_present=false` is distinct from
an explicitly present empty body. A present empty body uses empty Base64,
length 0, and the SHA-256 of empty bytes. `body_ref` is fetched as exact raw
bytes from the contract request-blob endpoint.

Pycore recalculates the request digest over compact, key-sorted UTF-8 JSON:

```json
{
  "method": "UPPERCASE",
  "path": "/one-leading-slash/path",
  "query": {},
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

### Result submission and blobs

Execution result payload fields are:

```text
operation_id, claimed_revision, outcome, status, headers,
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
   expected length; return `blob:{blob_id,...}` or a root `blob_id`;
2. PUT immutable raw chunks by `(blob_id, chunk_index)` using the contract chunk
   size;
3. finalize with blob ID, expected SHA-256, and expected length;
4. submit the stable operation result referencing `body_ref`.

Each repeated allocation/chunk/finalize/result with identical identity and
bytes resolves the existing step. Conflicting bytes or metadata return conflict.

### Route and execution policy

Pycore applies the local contract again after Laravel validation. Unclassified
`ui/*`, streaming events, open/reveal/path-picker actions, CodeSync workspace
operations, and Laravel endpoint-control routes are denied. Terminal routes are
classified individually. Safe recovery is allowed only for `read` and genuine
`idempotent_write`; keyboard, mouse, activation, input, Enter, history, and
scroll are `at_most_once_action` and become `execution_unknown` after an
ambiguous crash.

### Terminal UI contract

- `POST ui/terminal/windows` accepts `viewer_id` and
  `visible_window_ids:string[]`. It returns window metadata, `state_revision`,
  `screenshot_revision`, and optional `window.screenshot_resource`. It never
  returns `window.screenshot` Base64.
- `POST ui/terminal/viewer_demand` renews the same bounded viewer/window lease.
- A screenshot descriptor contains MIME, digest, ETag, size, capture timestamp,
  revision, and `resource:{route,window_id,digest}`.
- `GET ui/terminal/screenshot?window_id=...&digest=...` returns raw `image/png`,
  immutable cache headers, and ETag; matching `If-None-Match` returns 304.
- Capture is asynchronous for snapshots, so the first snapshot may not yet have
  a descriptor. `terminal.changed` or bounded snapshot reconciliation supplies
  it. UI must request resources only for visible windows/active preview and
  isolate its clock from the terminal tree.

## Laravel to Python handoff

Pending parallel Laravel implementation. Record implemented migrations,
repositories, policies, controllers, outbox/Mercure behavior, payload deviations,
and unresolved questions here without editing the frozen main design.

## Integration status

Python side: source-complete, static review only.  
Laravel side: pending its owner document.  
UI/deployment/live integration: pending other owners.

Tests, builds, services, and live verification require separate user
authorization and were not run by the Python task.
