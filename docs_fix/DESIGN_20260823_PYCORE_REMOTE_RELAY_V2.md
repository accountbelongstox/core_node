# Pycore Remote Relay V2 Through Laravel, Mercure, and FrankenPHP

Date: 2026-08-23  
Status: design only; no runtime or application code is changed by this document.

## Progress documents

This design is frozen after the following coordination index was added. All
implementation status, contract clarifications, blockers, and handoff notes
must be written to the matching progress document; this main design must not be
modified again.

- Pycore/Python implementation:
  `PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_PYCORE.md`
- Laravel/PHP implementation:
  `PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_LARAVEL.md`
- Cross-runtime contract and integration handoff:
  `PROGRESS_20260823_PYCORE_REMOTE_RELAY_V2_INTEGRATION.md`

The Pycore AI owns Python files and the shared relay contract. A parallel AI
owns Laravel/PHP files and reads this design plus all three progress documents
before changing Laravel. Neither AI modifies files owned by the other. Shared
contract disagreements are recorded in the integration progress document
before either adapter is changed.

## 1. Decision

The deployed Pycore Manager UI at `https://ui12gm.com` must not connect to a
private Pycore instance directly. The supported remote topology is:

```text
Browser at ui12gm.com
    |  HTTPS API + one authenticated Mercure SSE stream
    v
Laravel coordinator at api.si.12gm.com
    |  PostgreSQL operation state + private blob store
    |  Mercure wake/status events through FrankenPHP
    ^
    |  outbound-only HTTPS + Mercure SSE
Private Pycore agent
    |
    v
Shared in-process RPC dispatcher and local device services
```

Mercure is the control and notification plane. PostgreSQL and the blob store
are the data plane and source of truth. Mercure updates carry only opaque IDs,
revisions, and state names. They never carry screenshots, request bodies,
responses, secrets, paths, or other large data.

This is not a transparent public reverse proxy for port 59000. It is an
authenticated, capability-scoped operation relay. Direct local transport and
remote relay transport implement one common Pycore transport interface; neither
is a compatibility wrapper around the other.

The relay portions of
`DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3*.md` are superseded by this
document. Their unrelated Queue Center, HTTP/3, audio, and runtime decisions
remain unchanged.

## 2. Current-source audit

The repository already contains a first relay implementation:

- Laravel: `app/Services/Relay/*`, `RelayController`, and
  `routes/api/relay.php`;
- Pycore: `pycore/pyctl/relay/relay_service.py`;
- UI: `PycoreRelayTransport.ts`, `LaravelRelayRoster.ts`, and
  `PcPycoreTargetSwitcher.tsx`;
- shared configuration: the `relay` block in
  `config/queue_center_contract.json`;
- runtime: FrankenPHP v1.12.7 with embedded Mercure v0.24.2.

The existing code is useful as research, but it is not safe to expose as the
remote management plane. The following findings are binding V2 requirements.

| Finding | Current evidence | Required correction |
| --- | --- | --- |
| Wrong public endpoint derivation | `pycoreTarget.ts` derives `api.<region>.<UI apex>`; `ui12gm.com` becomes `api.si.ui12gm.com`, not `api.si.12gm.com` | Runtime configuration must provide explicit API and hub URLs |
| Transport selected by URL shape | Any HTTPS URL without port 59000 means relay | Use a discriminated `direct` or `relay` target; scheme is not a transport type |
| Pair expiry contract is broken | Laravel returns a pair record without `expires_at`; TypeScript requires it | One shared versioned relay contract and contract-shaped serializers |
| Roster timestamp contract is broken | Laravel returns `last_seen_at`; UI reads `last_heartbeat_at` or `registered_at` | One canonical `last_seen_at` field and generated/adapted types |
| Pairing is global and single-session | One cache entry per machine is overwritten by the newest UI session | Owner-scoped, multi-session pairing rows with explicit revocation |
| Device enrollment is trust-on-first-use | A self-selected machine ID and secret are accepted on first registration | Authenticated user claim of a short-lived enrollment, then asymmetric device identity |
| Signature omits the query | The current canonical signature covers only the path, while blob order and completion flags are query parameters | Sign normalized method, path, sorted query, body digest, timestamp, nonce, and key version |
| Registry updates can race | Machine and pair registries rewrite a whole cached index from multiple FrankenPHP workers | PostgreSQL rows, unique constraints, transactions, and row-level locking |
| No durable relay operation | Requests and responses live in TTL cache entries | PostgreSQL operation state machine with explicit retention |
| Duplicate execution is possible | A replayed Mercure update fetches and executes the same request again; local RPC has no request-result dedupe | Atomic device claim plus a Pycore execution ledger and route retry policy |
| Publish failure can strand work | Laravel writes the request and immediately publishes; Pycore has no recovery claim loop | Transactional outbox plus periodic machine reconciliation |
| Laravel workers are blocked | Each UI response read can sleep-loop for about 25 seconds | Mercure-driven completion plus short status GET; no PHP long polling |
| Bytes are corrupted | Pycore converts local responses to `.text`; fetched blob requests are UTF-8 decoded | End-to-end opaque bytes with digest and content length |
| Header forwarding is unrestricted | Browser-provided headers are replayed to local Pycore | Contract allowlist; strip hop-by-hop, Laravel auth, cookies, host, forwarding, and device headers |
| Every path is relayable | An arbitrary absolute Pycore path is accepted | Route exposure, permission, payload, timeout, and retry metadata |
| Blob authorization is too broad | Any active pair for a machine can read a known machine blob ID | Bind every blob to owner, pairing, direction, and operation |
| Terminal snapshots are relay-hostile | Every two seconds returns every screenshot as Base64 JSON | Versioned metadata plus conditional binary resources and change notifications |
| Mercure version language is inconsistent | Runtime is pinned to Mercure v0.24.2 while older design text claims a newer wire profile | Make the supported Mercure protocol profile explicit and upgrade it atomically with the runtime |

The existing implementation also contains hardcoded English UI errors in the
transport and target switcher. V2 user-facing text must use the shared i18n
catalog.

## 3. Ownership boundaries

### 3.1 Shared contracts

Create `config/pycore_relay_contract.json` as the single relay vocabulary.
Relay configuration does not belong inside Queue Center, so the relay block and
relay endpoint names must be removed from `queue_center_contract.json` in the
same cutover.

The new contract owns:

- schema and protocol versions;
- endpoint templates;
- canonical topic templates and event types;
- operation states and legal transitions;
- heartbeat, lease, retry, token, and retention durations;
- inline, chunk, request, response, and per-owner storage limits;
- allowed headers;
- route groups with exposure, permission, payload, timeout, and retry policy;
- the selected Mercure protocol profile.

PHP, Python, and TypeScript retain small read-only adapters named
`RelayContract`. They validate the document at startup and do not duplicate
defaults. A contract digest is reported by Laravel, Pycore, and the UI; a major
version or digest mismatch refuses relay operations with a precise error.

### 3.2 UI ownership

Introduce one `PycoreTransport` interface with fetch-shaped byte semantics:

```text
deliver(request: PycoreTransportRequest) -> PycoreTransportResponse
subscribe(handler) -> unsubscribe
health() -> PycoreTransportHealth
```

Implement it with:

- `DirectPycoreTransport`: direct HTTP/SSE for local development;
- `LaravelPycoreRelayTransport`: Laravel operation API plus Mercure status
  subscription for remote devices.

`PycoreMasterClient`, queued writes, health detection, the HTTP debugger, and
all domain API classes use only this interface. Feature components never branch
on relay mode.

Replace the current target shape with a discriminated union:

```text
{ kind: "direct", base_url: "http://127.0.0.1:59000" }
{ kind: "relay", coordinator_url: "https://api.si.12gm.com", device_id: "..." }
```

No code may infer relay mode from HTTPS, a port, the current page host, or the
registrable domain.

### 3.3 Laravel ownership

Laravel is the authenticated coordinator. Controllers validate HTTP shape and
delegate; they do not implement state transitions. The Relay domain owns:

- enrollment and device credentials;
- user/device authorization;
- device presence and session pairing;
- durable operation admission and transitions;
- blob metadata and access policy;
- transactional outbox creation and Mercure publication;
- cleanup of expired state in bounded timer slices;
- diagnostics and rate limits.

PostgreSQL is authoritative. Cache may hold derived, replaceable read models,
but never device ownership, pairing, operation, lease, idempotency, or response
truth.

### 3.4 Pycore ownership

The Pycore relay agent owns one outbound connection lifecycle:

- load or create the installation device identity;
- enroll or refresh its Laravel device session;
- heartbeat;
- subscribe to its private wake topic;
- claim available operations after a wake and on a bounded recovery cadence;
- execute through the shared RPC execution kernel;
- upload the byte-exact response and finalize the operation;
- resume unfinished safe work after restart.

Extract a transport-neutral RPC execution kernel from `rpc_v2/server.py`.
Both the local FastAPI HTTP adapter and the relay agent call the same dispatcher,
request parser, route policy, timeout handling, response encoder, and request ID
logic. The relay agent must not call the local `:59000` listener through another
HTTP client.

Reuse and upgrade `pycore/pyutils/common/operation_service.py`, its
`StateRepository`, revision checks, event records, and outbox. Do not create a
second generic operation/ledger implementation. Relay-specific metadata belongs
in a small adapter over the common operation repository.

## 4. Identity and authorization

### 4.1 Browser identity

Remote UI calls use the existing Sanctum Bearer token. Every device, pairing,
operation, response, and blob query includes the authenticated user ownership
constraint. Device listing is never global.

`ui12gm.com` and `api.si.12gm.com` are different sites. The design therefore
does not depend on a SameSite cookie crossing them. Laravel API calls use the
existing Bearer transport. Mercure subscriber tokens are short-lived,
topic-scoped, held only in memory, and sent through the Authorization header by
the existing fetch-stream transport. They are never put in local storage, a URL,
logs, or diagnostics.

### 4.2 Device enrollment

Replace first-registration secret claiming with this outbound-only flow:

1. Pycore creates a random device UUID and an asymmetric signing key once,
   persisting the private key through the existing secret/path facilities.
2. Pycore creates a short-lived enrollment request containing the device ID,
   public key, label, platform, contract digest, and capability digest.
3. Laravel returns a human-readable one-time claim code and an enrollment ID.
4. A logged-in user enters or confirms the code in `ui12gm.com`.
5. Laravel atomically binds the enrollment and device to that user.
6. Pycore polls the enrollment status and receives a scoped device credential
   only after the user claim commits.

Repeated creation with the same device key returns the existing pending or
claimed enrollment. A code can be claimed once. Credential rotation creates a
new key version and revokes the previous version only after the new public key
is stored.

### 4.3 Signed machine requests

The canonical signature input is:

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

Laravel validates the owner binding, credential state, clock window, body
digest, signature, and one-time nonce as independent steps. Nonce insertion is
atomic and scoped to the credential version.

### 4.4 Pairing

A pairing belongs to one user, one device, and one UI client instance. Multiple
tabs or devices may pair concurrently. Pairing renewal and revocation operate on
the pairing ID; they never overwrite another session.

Mercure tokens grant only these canonical private topics:

- the user's device roster topic;
- the pairing's operation-status topic;
- the device wake topic for the device credential.

Topics use absolute opaque IRIs under the coordinator origin. Human labels,
user IDs, hostnames, paths, and secrets are not encoded in topics.

## 5. Durable data model

Add global PostgreSQL tables through safe, additive, idempotent migrations run
only by `php artisan sys:init`:

### `global_relay_devices`

- random `device_id` unique key;
- owner user ID;
- public key and credential version;
- label, platform, capability and contract digests;
- status, last-seen, credential expiry, revocation, and timestamps.

### `global_relay_enrollments`

- enrollment ID and hashed one-time claim code;
- proposed device ID/public key/digests;
- pending, claimed, expired, or revoked state;
- claimant user, expiry, and revision.

### `global_relay_pairings`

- pairing ID;
- user, device, and hashed UI client-instance identity;
- active, expired, or revoked state;
- last-seen, expiry, credential version, and revision.

### `global_relay_operations`

- client-generated operation ID and idempotency key;
- user, device, and pairing IDs;
- route policy key, method, normalized path/query, and filtered headers;
- request/response body references, digests, lengths, and media types;
- state, revision, attempt, lease owner, and lease expiry;
- response status, error code, creation/acceptance/execution/completion/expiry
  timestamps.

Unique keys include `(user_id, device_id, idempotency_key)` and the operation
ID. A duplicate key with the same request digest returns the existing operation;
the same key with different bytes returns conflict.

### `global_relay_blobs`

- blob ID, owner, device, pairing, operation, and direction;
- expected/final digest and length;
- received chunk count, finalized state, expiry, and revision;
- private storage path resolved only through `PathMapper` and
  `FileSystemManager`.

Chunks are immutable and addressed by `(blob_id, chunk_index, chunk_digest)`.
Blob finalization verifies contiguous indices, total length, and final digest
before an operation may reference it.

### `global_relay_outbox`

- outbox ID, operation/device/pairing IDs, topic role, event type, revision,
  and compact payload;
- pending/published/dead state, attempt count, next-attempt time, hub update ID,
  and timestamps.

The unique transition key is `(entity_type, entity_id, revision, event_type)`.
The existing timer-driven realtime publisher and after-commit patterns are
generalized and reused; Relay does not create a second publisher loop.

## 6. Operation protocol

### 6.1 UI admission

1. The UI creates one UUID operation ID and stable idempotency key before any
   network attempt.
2. Large request bytes are uploaded and finalized in independently idempotent
   blob steps.
3. `POST /api/relay/v2/operations` validates user, pairing, device, route
   policy, headers, limits, and body reference.
4. One database transaction inserts or resolves the operation, records the
   accepted transition, and appends one outbox wake row.
5. Laravel returns `202 Accepted` with operation ID, revision, state, and
   status resource URL.

The UI never automatically replays a non-idempotent Pycore action under a new
operation ID. A network retry reuses the original ID and key.

### 6.2 Device claim

Mercure `operation.available` wakes Pycore. Pycore then calls the machine-only
claim endpoint. The same claim pass also runs periodically, so a lost Mercure
update cannot strand work.

Laravel claims rows in a short transaction using row-level locking. Multiple
workers cannot lease the same operation. The claim response contains the
validated request descriptor or a signed blob URL; the Mercure frame itself
contains no request data.

### 6.3 Local execution

The route contract classifies each operation as one of:

- `read`: safe to reclaim and execute again;
- `idempotent_write`: reclaimable only with the same operation ID propagated
  into the domain's idempotent write;
- `at_most_once_action`: keyboard, mouse, window activation, and similar
  external actions that cannot be transactionally deduplicated.

Before dispatch, the shared Pycore operation repository records the operation
ID and request digest. A completed entry returns the stored response. A digest
conflict is rejected. Idempotent domain writes reuse `OperationService` and its
revisioned repository.

There is no false exactly-once claim. If Pycore crashes after an
`at_most_once_action` starts but before its result is persisted, Laravel marks
the operation `execution_unknown`; it is not automatically replayed. The user
may inspect and explicitly submit a new operation.

### 6.4 Response completion

1. Pycore uploads and finalizes response bytes when they exceed the inline
   limit.
2. Pycore submits status, filtered headers, body reference/digest, operation ID,
   and claimed revision.
3. Laravel atomically transitions the operation to `responded` or `failed` and
   appends the status outbox row.
4. The UI's single Mercure connection resolves the waiting promise.
5. The UI reads the operation resource and downloads the body only when needed.

Duplicate result submission with the same digest returns the existing result.
A different result for a completed operation is a conflict and is never
overwritten.

### 6.5 Reconciliation and cancellation

Mercure is a latency optimization, not delivery truth:

- Pycore performs a bounded claim pass after reconnect and at the recovery
  interval;
- UI performs a bounded status reconciliation after reconnect, cursor loss, or
  local deadline;
- outbox publishing retries independently;
- operation state remains readable after a hub restart;
- cancellation is a revisioned requested state and is acknowledged by Pycore;
- an expired operation is never silently converted back to pending.

The current PHP sleep-loop response endpoint is removed. One SSE connection per
UI runtime multiplexes roster and operation topics; no per-request Laravel
worker remains blocked.

## 7. Byte and HTTP semantics

Request and response bodies are opaque bytes. Text and JSON are interpretations
performed by the shared RPC adapters, not by Relay storage.

The response contract preserves:

- status code;
- content type, content length, content disposition, ETag, cache control, and
  request ID when allowed;
- exact body bytes and SHA-256;
- an explicit no-body state distinct from an empty body.

Only contract-allowed headers cross the relay. Hop-by-hop headers, Host,
Cookie, Authorization, forwarding headers, CORS headers, and all relay/device
identity headers are stripped. Pycore receives server-derived user, device,
pairing, client, and operation context, not browser assertions.

Redirects are not followed implicitly by the relay executor. Streaming routes,
local filesystem reveal/open actions, CodeSync workspace APIs, and any route not
explicitly classified are relay-denied by default.

## 8. Terminal-specific redesign

The current terminal route is too expensive for the remote relay and is also a
major local performance problem. It must be changed at the domain layer, not
compressed inside Relay:

- `ui/terminal/windows` returns window metadata, state revision, and screenshot
  resource descriptors; it does not contain Base64 image bytes;
- screenshots are immutable binary resources addressed by content digest and
  served conditionally with ETag;
- unchanged screenshots return not-modified semantics and are never uploaded
  again;
- capture work is coalesced per window and has a non-zero freshness interval;
- the UI requests screenshots only for visible windows and the active preview;
- a short-lived viewer-demand lease controls capture cadence;
- `terminal.changed` is delivered through the existing Pycore event bus and
  Relay pairing status topic; a slow fallback snapshot remains bounded;
- the page clock is isolated from the terminal window tree so a one-second clock
  update does not re-render every screenshot.

This removes PNG Base64 expansion, repeated JSON copies, repeated decoding, and
the two-second full-window capture loop from both direct and remote modes.

## 9. Public endpoint and deployment contract

Extend the same-origin `web_access_config.json` with explicit validated values:

```json
{
  "uiBaseUrl": "https://ui12gm.com",
  "laravelApiBaseUrl": "https://api.si.12gm.com",
  "mercureHubUrl": "https://api.si.12gm.com/.well-known/mercure",
  "pycoreRelayEnabled": true
}
```

These values are rendered from central domain configuration. UI code consumes
them directly; it does not reconstruct one domain from another.

Deployment requirements:

- `ui12gm.com` serves the built UI and runtime configuration over HTTPS;
- `api.si.12gm.com` serves Laravel API and the FrankenPHP Mercure hub on 443;
- TCP 443 and UDP 443 reach FrankenPHP for HTTP/2 and HTTP/3;
- Laravel CORS and Mercure `cors_origins` include exactly
  `https://ui12gm.com` plus explicitly configured development origins;
- no wildcard origin is allowed with credentials or subscriber tokens;
- port 59000 is never publicly routed;
- relay blobs remain outside the public document root;
- hub publisher keys, subscriber keys, device credentials, and enrollment
  material remain in their existing secret stores and never enter generated
  public configuration.

The Mercure profile is contract-pinned. The current runtime uses FrankenPHP
v1.12.7 and Mercure v0.24.2 with its supported flat Caddy/JWT/topic profile.
Modern Mercure `match`, `last_event_id`, authorization details, and cookie names
must not be mixed into that profile piecemeal. A future Mercure protocol upgrade
updates the runtime pin, Caddy renderer, PHP signer, Python subscriber,
TypeScript subscriber, and contract profile in one atomic cutover.

## 10. Minimum-step idempotency rules

Idempotency is checked at each irreversible or externally visible step:

1. device key creation;
2. enrollment creation;
3. enrollment claim;
4. credential issue or rotation;
5. device heartbeat upsert;
6. pairing create, renew, or revoke;
7. blob allocation;
8. each immutable blob chunk;
9. blob finalization;
10. operation admission;
11. operation lease;
12. local execution ledger admission;
13. each idempotent domain mutation;
14. response body finalization;
15. response state transition;
16. outbox append;
17. outbox publish receipt;
18. expiry and retention cleanup slice.

No outer `relay already configured` sentinel may skip inner repairs. A present
device row must not skip a missing credential; a present blob must not skip a
missing chunk; a completed migration must not skip a missing index; a present
Caddyfile must not skip a missing origin or route.

Every transition uses a unique key, content digest, expected revision, or legal
state comparison. A retry either returns the already completed step or advances
exactly one next step.

## 11. Shell implementation rules

Any shell work required by this design must follow the repository shell guide
and these binding rules:

- declare file-level variables at the top;
- use English code and output;
- do not use process exit status as a data value;
- do not branch on `$?`, `if function_name`, `command && next`, or
  `command || fallback` to decide business state;
- call ordered functions directly and trust the previous function invocation;
- make each subsequent function inspect the exact artifact it owns;
- split provisioning into minimum independent `ensure` steps for runtime pin,
  contract, key, Caddy hub stanza, domain route, CORS origin, UI runtime config,
  and service definition;
- compare and write only the owned artifact; an unchanged artifact is a local
  no-op and never skips later steps;
- detect installed binaries from resolved filesystem paths;
- do not use an umbrella completion marker;
- installers repair only missing required artifacts and otherwise continue.

PowerShell changes use resolved absolute paths with `Split-Path`, `Join-Path`,
or `Resolve-Path`; paths are never constructed by appending strings to path
variables.

## 12. Reuse and removal map

### Reuse and upgrade

- `MasterApiClient` request coordination and queued-write envelope;
- `ProtocolFetch` browser transport;
- `LaravelMercureConnection` stream parser and reconnect lifecycle;
- Python `MercureSubscriber` lifecycle and HTTP transport;
- Pycore `OperationService`, `StateRepository`, operation events, revisions,
  and outbox;
- Laravel `QueueCenterCacheStore` only for non-authoritative derived cache;
- Laravel database transaction and after-commit patterns;
- the timer-driven realtime outbox publisher;
- `PathMapper` and `FileSystemManager`;
- `ApiResponse`, Sanctum Bearer authentication, and i18n catalogs;
- service and web-access contract readers across PHP, Python, TypeScript, and
  shell.

### Replace or remove at cutover

- `RelayRequestStore` TTL-cache request/response truth;
- cache-index `RelayMachineRegistry` and `RelayPairRegistry`;
- trust-on-first-use `RelayDeviceIdentity` enrollment behavior;
- synchronous `RelayDispatcher` publish as delivery truth;
- the sleep-loop response endpoint;
- localhost HTTP replay inside `relay_service.py`;
- Base64/text-only relay body handling;
- HTTPS-as-relay detection;
- inferred API hostname construction for Relay;
- the relay section and endpoints in Queue Center contract;
- hardcoded relay UI strings.

There is no dual-read or dual-write compatibility period. Schema may be
deployed additively first, but one release changes all active relay adapters to
V2 and disables V1 routes. After the cutover is confirmed, V1 cache keys and
private blob directories are retired by a separately authorized, recoverable
cleanup operation.

## 13. Implementation order

1. Add the V2 relay contract and explicit public endpoint configuration.
2. Add safe global PostgreSQL migrations and models.
3. Implement Laravel enrollment, ownership, pairing, operation, blob, lease,
   outbox, and policy repositories.
4. Generalize the existing realtime outbox publisher for relay transitions.
5. Extract the Pycore transport-neutral RPC execution kernel and route policy.
6. Replace the Pycore relay runtime with enrollment, wake-plus-claim, byte
   response, reconciliation, and operation-ledger behavior.
7. Replace UI target selection and relay delivery behind `PycoreTransport`.
8. Add one UI Mercure runtime for roster and operation state, with cursor-loss
   reconciliation.
9. Refactor Terminal screenshot metadata/resources and rendering cadence.
10. Update the minimum-step shell/Caddy/web-access provisioning.
11. Remove V1 routes, classes, contract entries, storage keys, and hardcoded
    relay strings in the same cutover.
12. Perform source, deployment, and live acceptance checks only when explicitly
    authorized.

## 14. Acceptance contract

The design is complete only when all of these statements are true:

- A logged-in `ui12gm.com` user sees only owned devices.
- A private Pycore with outbound Internet access can enroll, appear online,
  pair, and execute an allowed operation without an inbound port.
- Port 59000 remains unreachable from the public Internet.
- Lost and duplicate Mercure updates neither lose nor duplicate operations.
- Duplicate UI admission returns the same operation; a changed body under the
  same key returns conflict.
- Concurrent Laravel workers cannot lease the same operation.
- A Pycore restart resumes safe operations and never auto-replays an ambiguous
  at-most-once desktop action.
- JSON, text, images, audio, empty bodies, and non-2xx responses preserve exact
  status, headers, length, and SHA-256 through the relay.
- An unauthorized user cannot list, pair, invoke, inspect, or download another
  user's device data.
- Revoking a pairing prevents new operations immediately; short-lived Mercure
  credentials expire without granting data-plane access.
- A hub outage increases latency but does not lose accepted operations.
- Laravel request workers are not held by relay long polling.
- Terminal transmits no Base64 screenshots in snapshot JSON and does not
  recapture unchanged invisible windows.
- `ui12gm.com` reads `api.si.12gm.com` from runtime configuration, never from
  hostname inference.
- Every installer/provisioner step can repair its own missing artifact even
  when earlier artifacts already exist.

## 15. Official sources

- [Mercure specification](https://mercure.rocks/spec) — private updates,
  authorization, reconciliation, topic matching, and SSE data requirements.
- [Mercure subscribing guide](https://github.com/dunglas/mercure/blob/main/docs/concepts/subscribing.md)
  — authenticated fetch streams, one multiplexed connection, and current
  matcher behavior.
- [FrankenPHP Mercure](https://frankenphp.dev/docs/mercure/) — built-in hub,
  Caddy configuration, and `mercure_publish()`.
- [FrankenPHP Laravel integration](https://frankenphp.dev/docs/laravel/) —
  Octane/FrankenPHP worker mode and Mercure integration.
- [FrankenPHP v1.12.7 release](https://github.com/php/frankenphp/releases/tag/v1.12.7)
  — runtime fixes and embedded dependency updates.
- [Laravel 13 query builder](https://laravel.com/docs/13.x/queries) — database
  transactions and pessimistic locking.
- [Laravel Octane](https://laravel.com/docs/12.x/octane) — worker lifetime,
  concurrency, and request execution limits.
- [PostgreSQL `SELECT`](https://www.postgresql.org/docs/current/sql-select.html)
  — row locks and `SKIP LOCKED` queue-style claiming.
- [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html)
  — concurrent updates and `ON CONFLICT` behavior.
- [WHATWG Server-Sent Events](https://html.spec.whatwg.org/multipage/server-sent-events.html)
  — SSE parsing, reconnection, and `Last-Event-ID`.
- [RFC 9110 HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods)
  — idempotent methods and restrictions on automatic retry of non-idempotent
  requests.
