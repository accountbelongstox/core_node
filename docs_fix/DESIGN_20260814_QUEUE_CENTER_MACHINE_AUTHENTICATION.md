# Queue Center Machine Authentication Design

Date: 2026-08-14

Status: Proposed; pending review and implementation

Scope: Laravel 12, Laravel Reverb, Pycore, Pycore UI, Laravel Manager UI, and
MCP Chrome workers

Related incident document:
`docs_fix/FIX_20260813_LARAVEL_OCTANE_QUEUE_WORKER_STARVATION.md`

## Short Answer

Queue Center machine authentication answers one question:

> Is this non-human runtime an enrolled and authorized Queue Center client,
> and which Queue Center operations may it perform?

It is not a user login and it is not a Reverb connection key. It is the trust
boundary for Pycore and MCP Chrome worker processes that subscribe to wake-up
events, replay event cursors, pull tasks, accept leases, submit results, or
control queued tasks.

The recommended contract is:

1. Each Pycore installation or MCP Chrome installation receives a unique,
   revocable enrollment credential.
2. The client exchanges that credential for a short-lived bearer token.
3. The bearer token contains only the abilities assigned to that machine.
4. The bearer token authorizes both the private Reverb channel and the related
   Queue Center HTTP routes.
5. Laravel Manager UI remains user-authenticated with Sanctum. Pycore UI reaches
   Laravel through the local Pycore owner and never receives the Pycore machine
   secret.

The design must never copy `REVERB_APP_SECRET` into Pycore, a browser bundle, or
a Chrome extension.

## Current State

The current Queue Center path is operational but unauthenticated:

- `config/queue_center_contract.json` defines the public channel
  `queue-center`.
- `RealtimeOutboxPublisher` publishes with `Broadcast::on($channel)`, which is a
  public channel.
- MCP Chrome subscribes with `auth: ''`.
- Pycore consumes the same public Pusher-protocol channel.
- `/api/queue-center/overview`, `/events`, queue pages, `bump`, `cancel`, and
  `retry` are in a public route group.
- `RealtimeConnectionService` correctly returns the public Reverb app key and
  connection metadata, but no channel authorization endpoint.
- `config/reverb.php` supports `REVERB_ALLOWED_ORIGINS`, whose current default is
  `*`.
- User-owned Social realtime already demonstrates the Laravel 12 private-channel
  pattern: `/api/broadcasting/auth`, `auth:sanctum`, a private channel, and a
  `routes/channels.php` authorization callback.

This means Queue Center currently trusts possession of the server URL. An
untrusted client that can reach the Laravel and Reverb ports can subscribe to
wake-up metadata, replay the event outbox, read queue state, and invoke exposed
queue controls.

## Four Different Security Controls

These controls must not be merged conceptually or implemented with the same
credential.

| Control | Purpose | Client-visible | Proves machine identity |
| --- | --- | --- | --- |
| Reverb app key | Selects the Reverb application during connection | Yes | No |
| Reverb app secret | Signs server-side publication and protocol authorization data | No | No |
| Reverb allowed origins | Rejects browser connections from disallowed origins | Origin value only | No |
| User Sanctum session/token | Authenticates a person or user-owned client | Yes, to that user client | No |
| Queue Center machine credential | Enrolls a specific runtime installation | Only to that installation | Yes |
| Queue Center access token | Grants short-lived, scoped Queue Center access | Only to that installation | Yes |

The Reverb app key is intentionally present in frontend configuration. The app
secret remains server-side. An origin allowlist is useful defense in depth, but
native clients can omit or synthesize an `Origin` header; it is not identity.

## Laravel 12 Alignment

Laravel 12 defines public `Channel` subscriptions as open and
`PrivateChannel`/`PresenceChannel` subscriptions as requiring authorization.
For a private channel, the client sends the channel name and socket ID to an
HTTP authorization route, and Laravel evaluates a channel authorization
callback.

Laravel also permits custom authentication guards on broadcast channels. That
is the correct extension point for a machine principal; machine runtimes do not
need to be represented as fake human users.

Sanctum documents two useful primitives:

- bearer-token route protection;
- token abilities and token expiration.

The existing `withBroadcasting(... ['api', 'auth:sanctum'])` configuration is
correct for user-owned Social channels. Queue Center should use a distinct
machine authentication route or a guard that can resolve both explicit user and
machine principals without weakening Social authorization.

Reverb `allowed_origins` must be restricted for browser clients, but it remains
an additional network-origin check rather than the Queue Center authentication
mechanism.

Official references:

- Laravel 12 channel authorization:
  <https://laravel.com/docs/12.x/broadcasting#authorizing-channels>
- Laravel 12 authorization callback guards:
  <https://laravel.com/docs/12.x/broadcasting#authorization-callback-authentication>
- Laravel 12 Sanctum private broadcast channels:
  <https://laravel.com/docs/12.x/sanctum#authorizing-private-broadcast-channels>
- Laravel 12 Sanctum token abilities:
  <https://laravel.com/docs/12.x/sanctum#token-abilities>
- Laravel 12 Sanctum token expiration:
  <https://laravel.com/docs/12.x/sanctum#token-expiration>
- Laravel 12 Reverb application credentials:
  <https://laravel.com/docs/12.x/reverb#application-credentials>
- Laravel 12 Reverb allowed origins:
  <https://laravel.com/docs/12.x/reverb#allowed-origins>

## Trust Model

The system has three principal types.

| Principal | Authentication owner | Intended access |
| --- | --- | --- |
| Human operator | Laravel Sanctum user session/token | Queue Center read and explicit control actions |
| Pycore installation | Queue Center machine credential | Subscribe, replay, register, pull, accept, and submit only assigned task types |
| MCP Chrome installation | Queue Center paired installation credential | Subscribe, replay, and run only enabled browser-worker task types |

Pycore UI is not a fourth principal. It is a local view of the Pycore runtime.
The browser talks to local Pycore; Pycore performs remote Laravel operations as
the enrolled machine. A remote Pycore UI control action must additionally pass
the local UI authorization boundary before Pycore delegates it.

Laravel Manager UI is a human operator client. It must use user authorization
and policies, not a machine token embedded in JavaScript.

## Proposed Architecture

```text
Pycore install script -------- creates per-machine enrollment credential
                                            |
MCP Chrome pairing ---------- creates per-install enrollment credential
                                            |
                                            v
                               POST machine session exchange
                                            |
                              short-lived scoped bearer token
                                  /                   \
                                 v                     v
                    private channel auth       Queue Center HTTP API
                                 |                     |
                                 +----------+----------+
                                            v
                              machine identity + abilities
```

### Enrollment credential

An enrollment credential is long-lived but unique per installation. Store only
its one-way hash on Laravel. The clear value exists only on the enrolled client.

Required server fields:

| Field | Meaning |
| --- | --- |
| `machine_id` | Stable public identifier, not a secret |
| `kind` | `pycore` or `mcp_chrome` |
| `credential_id` | Rotation-safe key identifier |
| `secret_hash` | One-way hash of the enrollment secret |
| `abilities` | Allowed Queue Center operations and task types |
| `enabled` | Immediate revocation flag |
| `expires_at` | Optional enrollment expiration |
| `last_used_at` | Audit and stale-installation cleanup |
| `metadata` | Instance name, version, and approved installation information |

Do not store clear enrollment secrets, bearer tokens, request signatures, or
authorization responses in logs.

### Pycore provisioning

Pycore provisioning follows the project installation boundary:

- `pyservice.ps1` and `pyservice.sh` call the corresponding idempotent install
  script.
- The install script creates the machine identifier and credential file only
  when missing, or performs an explicit credential rotation.
- Python runtime code only reads the resolved credential and requests a session;
  it never installs, downloads, or silently replaces credentials.
- The credential file is outside public web roots and receives platform-appropriate
  restrictive permissions.
- Re-running installation preserves the existing machine identity unless an
  operator explicitly requests re-enrollment or rotation.

### MCP Chrome provisioning

A Chrome extension cannot safely ship one universal secret: every installed
copy contains extractable extension code and assets. MCP Chrome therefore uses
pairing:

1. The extension creates a random installation ID and displays a short-lived
   pairing request.
2. A signed-in Laravel Manager operator approves the pairing and the requested
   worker abilities.
3. Laravel returns a one-time installation credential.
4. The extension stores it in extension-local storage and never exposes it to
   page scripts or content-script messages.
5. Revoking one installation does not rotate or interrupt every other client.

Local extension storage protects against accidental exposure, not a hostile
administrator controlling the same computer. That local-host compromise is
outside the initial boundary; server-side scopes, short access-token lifetime,
revocation, and audit still limit the impact.

## Session Exchange Protocol

Recommended endpoint:

```text
POST /api/queue-center/machine/session
```

The request contains:

```json
{
  "machine_id": "pycore:01J...",
  "credential_id": "qcmc_01J...",
  "timestamp": 1786675200,
  "nonce": "base64url-random-value",
  "client_version": "...",
  "signature": "base64url-hmac-sha256"
}
```

The signature covers a canonical form of the HTTP method, route, timestamp,
nonce, machine ID, credential ID, and a SHA-256 hash of the unsigned body. The
server must:

- find the enabled credential by its public IDs;
- reject timestamps outside a small clock-skew window;
- atomically consume the nonce with a bounded TTL;
- compare the expected signature in constant time;
- rate-limit failures by credential ID and source address;
- issue an access token only after all checks pass.

Recommended response:

```json
{
  "token_type": "Bearer",
  "access_token": "opaque-secret-value",
  "expires_at": "2026-08-14T00:05:00Z",
  "refresh_after": "2026-08-14T00:04:00Z",
  "machine_id": "pycore:01J...",
  "abilities": [
    "queue-center:subscribe",
    "queue-center:replay",
    "worker:pull:word_audio",
    "worker:result:word_audio"
  ]
}
```

The access token should be opaque, hashed at rest, expire after approximately
five minutes, and be refreshed before expiration. A database-backed token is
preferable to an untracked self-contained token because revocation must take
effect without waiting for a long cryptographic expiry.

The enrollment HMAC is used only for the session exchange. Normal requests use
the short-lived bearer token, keeping request middleware and private-channel
authorization aligned with Laravel authentication conventions.

## Abilities

Use positive, least-privilege abilities. Do not grant a generic `*` ability to
normal workers.

| Ability | Grants |
| --- | --- |
| `queue-center:subscribe` | Authorize the private Queue Center wake channel |
| `queue-center:replay` | Read the bounded event cursor replay |
| `queue-center:overview` | Read aggregate queue and connection metadata |
| `worker:register` | Register or renew this machine's worker instance |
| `worker:heartbeat` | Update only this machine's worker presence |
| `worker:pull:{task_type}` | Pull the named task type |
| `worker:accept:{task_type}` | Accept a lease for the named task type |
| `worker:result:{task_type}` | Submit results for the named task type |
| `queue-center:inspect` | Read queue rows and receipts |
| `queue-center:control` | Bump, cancel, or retry tasks; operator-only by default |

Every task mutation must also verify ownership and current lease state. Ability
checks do not replace the existing task state machine or idempotency rules.

## Private Reverb Channel

Version the authenticated channel instead of silently changing the meaning of
the existing public name:

```text
Laravel logical name: queue-center.v1
Pusher wire name:     private-queue-center.v1
Event names:          unchanged
```

The publisher uses a Laravel private-channel API. Clients connect with the
public Reverb app key, receive a socket ID, then send `socket_id` and
`channel_name` to a Queue Center broadcast authorization endpoint using the
short-lived bearer token.

Recommended endpoint:

```text
POST /api/queue-center/broadcasting/auth
Authorization: Bearer <short-lived-machine-or-user-token>
```

The authorization handler must verify all of the following:

- the principal is active;
- the access token is not expired or revoked;
- the requested channel is exactly `private-queue-center.v1`;
- the principal has `queue-center:subscribe`;
- a machine is subscribed only under its permitted Queue Center domain.

Do not return the Reverb app secret. The response is the normal
Pusher-compatible channel authorization signature bound to the socket ID and
channel name.

The existing Social `/api/broadcasting/auth` route can remain user-Sanctum-only.
Using a separate Queue Center endpoint makes it difficult for a future machine
guard change to weaken user-channel isolation accidentally.

## HTTP Route Boundaries

Securing only the WebSocket channel leaves replay and task data public. Apply
the same principal and ability model to the entire Queue Center surface.

| Route family | Required policy |
| --- | --- |
| Realtime connection metadata | Authenticated principal; return app key, never app secret |
| Queue Center event replay | `queue-center:replay` |
| Aggregate overview | `queue-center:overview` or authorized operator read |
| Queue rows, ID pages, page data, receipts | `queue-center:inspect` or a narrower worker view |
| Worker registration and heartbeat | Matching machine identity plus worker ability |
| Typed pull, accept, and result | Matching task-type ability plus lease ownership |
| Bump, cancel, and retry | Human policy or explicit `queue-center:control` |

Health checks may remain unauthenticated only if their response contains no
machine IDs, queue contents, connection endpoints, task counts, or debug data.

## Event Data Boundary

Realtime remains a wake-up and revision channel, not a task delivery channel.
Even after authentication, do not broadcast task prompts, source text, audio,
result payloads, enrollment data, or bearer tokens.

Permitted event data is limited to fields such as:

- event cursor;
- revision;
- resource kind;
- task type;
- non-sensitive resource ID when a bounded diff requires it;
- change timestamp.

The client receives task data from an ability-protected HTTP read or pull after
the wake signal.

## Token Lifecycle and Failure Semantics

- Refresh the access token before `refresh_after`, with reconnect-safe
  single-flight behavior.
- Permit overlapping enrollment credentials only during an explicit rotation
  window; identify each one by `credential_id`.
- Revoking a machine blocks new sessions immediately and invalidates its active
  access tokens.
- A failed refresh does not downgrade to the public channel or unauthenticated
  REST.
- Reconnect uses bounded exponential backoff with jitter.
- A new private-channel subscription always obtains fresh authorization for its
  current socket ID.
- Cursor replay resumes after successful authentication and remains bounded.

Response meanings:

| Status | Meaning |
| --- | --- |
| `401` | Missing, invalid, expired, or revoked credential/token |
| `403` | Valid principal without the requested ability or channel access |
| `409` | Replayed session-exchange nonce or incompatible active enrollment state |
| `422` | Malformed session or authorization request |
| `429` | Enrollment or authentication failure rate limit |

Authentication errors should expose a stable error code, not signature details,
credential lookup results, hashes, or stack traces.

## Audit Requirements

Record security events with structured, non-secret fields:

- machine ID and credential ID;
- principal kind;
- operation and requested ability;
- outcome and stable failure category;
- source address and user agent/client version where available;
- token ID, never the token value;
- pairing approver and granted abilities;
- enrollment, rotation, revocation, and last-use timestamps.

Avoid per-heartbeat success logs at normal level. Aggregate them into last-use
state or metrics to prevent log amplification.

## Threats and Controls

| Threat | Required control |
| --- | --- |
| Public client discovers the Reverb app key | App key is non-secret; private subscription still requires bearer authorization |
| Replayed enrollment request | Timestamp window plus atomically consumed nonce |
| Leaked access token | Five-minute lifetime, hashed storage, narrow abilities, revocation |
| Leaked one-machine credential | Revoke one credential without global key rotation |
| Malicious website opens Reverb | Restricted origins plus private channel authorization |
| Native client forges `Origin` | Machine token remains mandatory |
| Worker requests another task type | Task-type ability and server-side task routing checks |
| Public channel retained as fallback | Remove publisher and subscriber fallback after migration |
| Secret enters logs or UI config | Explicit redaction and response allowlists |
| Compromised Chrome page accesses extension credential | Keep credential in background owner; never pass through page/content messages |

TLS is mandatory outside trusted loopback development. Authentication without
TLS protects neither enrollment credentials nor bearer tokens from a network
observer.

## Rejected Designs

### Give clients `REVERB_APP_SECRET`

Rejected. It is an application/server credential and would let any extracted
copy forge protocol signatures or server-side publication requests within that
Reverb application.

### Treat `REVERB_ALLOWED_ORIGINS` as authentication

Rejected. Origin filtering is browser-oriented network policy, not runtime
identity, ability, revocation, or task ownership.

### Embed one shared Queue Center token in all clients

Rejected. One leak compromises every Pycore and MCP Chrome installation,
prevents per-client revocation, and destroys useful audit identity.

### Create a fake human user for each worker

Rejected as the default. Human policy and machine capability lifecycles differ.
Laravel custom guards allow a machine principal without polluting the user
model. An explicit polymorphic Sanctum token owner may still be used internally
if it preserves this separation.

### Use mTLS as the first implementation

Deferred. It is strong for managed Pycore hosts but is operationally difficult
for Chrome extensions and does not remove the need for application abilities.
It may be added later for selected server-to-server deployments.

## Migration Plan

### Phase 1: Identity foundation

- Add the machine principal, hashed enrollment credential, scoped access token,
  rotation, revocation, and audit owners.
- Add the Pycore idempotent installer path and the MCP Chrome pairing path.
- Keep the current public channel temporarily, but do not place new sensitive
  data on it.

### Phase 2: Authenticated HTTP contract

- Add session exchange and Queue Center broadcast authorization endpoints.
- Protect replay, overview, queue inspection, worker, and control routes with
  explicit abilities.
- Update Laravel Manager to use its user token and Pycore/MCP clients to use
  their short-lived machine tokens.

### Phase 3: Versioned private channel

- Publish to `private-queue-center.v1`.
- Update all subscribers to authorize the channel with their current bearer
  token.
- Coordinate publisher and client rollout. A brief dual-channel deployment may
  carry only the existing non-sensitive wake envelope; it must have a fixed
  removal release and must not become a permanent fallback.

### Phase 4: Close the old boundary

- Remove the public `queue-center` publisher and subscriber paths.
- Remove unauthenticated Queue Center route access.
- Restrict `REVERB_ALLOWED_ORIGINS` to approved Laravel/Pycore UI origins.
- Confirm that connection metadata returns only the Reverb app key.

### Phase 5: Operations

- Add pairing, rotation, revocation, last-use, and ability management to the
  authenticated Laravel Manager UI.
- Establish credential expiry and stale-installation cleanup policy.
- Document recovery when a Pycore credential file or extension enrollment is
  lost.

## Acceptance Criteria

- A client with only the Laravel URL and Reverb app key cannot subscribe to the
  Queue Center private channel.
- A valid machine token without `queue-center:subscribe` receives `403`.
- A Pycore word-audio credential cannot pull or submit a different task type.
- Revocation blocks both HTTP and new private-channel authorization.
- Replayed session exchange requests are rejected.
- No response, log, browser bundle, extension asset, or realtime payload contains
  an enrollment secret, access token, or Reverb app secret.
- Pycore installation is idempotent and owned by PS1/SH install scripts, not
  Python runtime code.
- MCP Chrome installations are independently paired and independently
  revocable.
- Laravel Manager actions retain user policy checks; machine abilities do not
  grant operator privileges by default.
- Queue Center events remain wake/revision hints; task data stays behind scoped
  HTTP reads and lease ownership checks.
- No authentication failure falls back to the old public channel.

## Review Decisions

The implementation should not start until these policy values are approved:

1. Which task-type abilities are granted to each Pycore and MCP Chrome worker
   kind by default?
2. Is five minutes the required access-token lifetime, or should local Pycore
   receive a different duration from MCP Chrome?
3. Which Laravel Manager roles may approve pairing, rotate credentials, revoke
   machines, and grant `queue-center:control`?
4. Which origins must replace the current wildcard Reverb origin policy in each
   environment?
5. Should machine records live in the primary Laravel database or a dedicated
   Queue Center control-plane connection?

The recommended defaults are five-minute access tokens, per-installation
credentials, no worker control ability, pairing restricted to administrators,
and machine records in the same transactional database as the Queue Center
control plane.
