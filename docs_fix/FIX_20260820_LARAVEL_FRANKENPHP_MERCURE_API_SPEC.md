# Laravel Main FrankenPHP and Mercure API Specification

## Scope

This specification defines the native realtime and relay architecture for `laravel_main`. WebSocket/Reverb is not part of this plane. One Laravel Octane process owns FrankenPHP worker mode, HTTPS, HTTP/2, HTTP/3, the application routes, and the embedded Mercure hub.

The deployment entry point remains:

```text
scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh
```

The per-app launcher delegates to the canonical common launcher. Runtime configuration, Caddyfile rendering, service contracts, Mercure clients, and filesystem access each have one shared implementation.

## Official compatibility baseline

| Component | Contract version | Required behavior |
| --- | --- | --- |
| FrankenPHP | `v1.12.7` | Laravel Octane worker mode through `artisan octane:frankenphp` and a custom Caddyfile |
| Embedded Mercure | `v0.24.2` | Pre-standardization wire contract implemented by the pinned hub |
| Laravel Octane | Installed Composer version | Worker Caddyfile uses `public/frankenphp-worker.php`, worker count, watch directives, and `php_server` worker routing |

FrankenPHP `v1.12.7` pins Mercure `v0.24.2` in its Go module. This deployed hub accepts the `mercure` JWT claim, repeated `topic` query parameters, and the `lastEventID` reconciliation query parameter. It does not implement the newer draft's `authorization_details`, `match`, or `last_event_id` wire fields.

Official references:

- [FrankenPHP Laravel and Octane](https://frankenphp.dev/docs/laravel/)
- [FrankenPHP built-in Mercure](https://frankenphp.dev/docs/mercure/)
- [FrankenPHP v1.12.7 dependency manifest](https://raw.githubusercontent.com/php/frankenphp/v1.12.7/go.mod)
- [FrankenPHP v1.12.7 native Mercure publisher binding](https://github.com/php/frankenphp/blob/v1.12.7/caddy/mercure.go)
- [Mercure v0.24.2 authorization implementation](https://raw.githubusercontent.com/dunglas/mercure/v0.24.2/authorization.go)
- [Mercure v0.24.2 subscription implementation](https://raw.githubusercontent.com/dunglas/mercure/v0.24.2/subscribe.go)
- [Mercure Hub configuration](https://mercure.rocks/docs/hub/config)
- [Mercure subscriber authentication and CORS troubleshooting](https://mercure.rocks/docs/hub/troubleshooting)
- [Mercure official subscribing guide](https://github.com/dunglas/mercure/blob/main/docs/concepts/subscribing.md)
- [Laravel Octane](https://laravel.com/docs/master/octane)

## Runtime architecture

```text
Browser bearer SSE ──┐
Pycore SSE client ───┼─ HTTPS / HTTP/2 or HTTP/3 ─ FrankenPHP :443
HTTP API clients ────┘                              ├─ Mercure /.well-known/mercure
                                                   └─ Octane worker /api/*
```

The Mercure stream is only the control plane. Relay request bodies, responses, and blobs remain in the Laravel HTTP data plane. Mercure updates carry wake-up metadata and identifiers, not large payloads.

Port `9000` remains the direct LAN/local HTTP listener defined by the service contract. Session and machine gates protect relay operations on this listener.

The canonical Octane launch is equivalent to:

```text
php artisan octane:frankenphp \
  --host=0.0.0.0 \
  --port=443 \
  --https \
  --caddyfile=<laravel_main>/storage/frankenphp/Caddyfile \
  --admin-port=2019 \
  --workers=4 \
  --max-requests=500
```

Swoole task-worker options are not passed to FrankenPHP. The Caddyfile contains the Octane worker block and routes unresolved requests to `frankenphp-worker.php`. The same site block enables the embedded Mercure hub with private publisher and subscriber keys.

Exactly one Mercure handler and Bolt transport are rendered on the direct LAN/local `:9000` site. The primary HTTPS site proxies only `/.well-known/mercure*` to that handler, while managed `api.<prefix>.<domain>` sites already proxy all traffic to the same backend. Every request-derived hub URL therefore remains valid without creating competing hub instances, transports, or native `mercure_publish()` targets.

## Deployment convergence

The `175_laravel_main_start.sh` flow converges independent steps in this order:

1. Resolve the active web-server plane from the shared service contract and plane record.
2. Ensure the selected FrankenPHP binary and its required embedded modules.
3. Ensure Composer dependencies and the Laravel autoloader.
4. Ensure `APP_KEY`, publisher key, subscriber key, installation access code, and trusted issuer independently.
5. Re-read each persisted runtime value after its write; shell function exit status is not business data.
6. Ensure certificate state independently from Caddyfile state.
7. Render the canonical Caddyfile only when its content differs.
8. Start `artisan octane:frankenphp` through the plane runtime launcher.

An existing value skips only its own write. It never skips later convergence steps.

## Mercure wire contract

### Hub endpoint

```http
GET|POST /.well-known/mercure
```

### Subscriber authorization

The relay authorization endpoint can set an HTTP-only cookie scoped to the hub path. The `Secure` attribute is enabled on HTTPS origins:

```text
mercureAuthorization=<subscriber JWT>
```

Pycore, mcp-chrome, and the shared browser SSE transport use the returned topic-scoped token directly:

```http
Authorization: Bearer <subscriber JWT>
```

Subscriber JWT authorization claim:

```json
{
  "mercure": {
    "subscribe": ["pycore.machines", "pycore.pair.<machine_id>"]
  }
}
```

Subscription topics are repeated query parameters:

```http
GET /.well-known/mercure?topic=pycore.machines&topic=pycore.pair.machine-01
Accept: text/event-stream
```

Reconnects use the `Last-Event-ID` request header. An initial explicit cursor uses `lastEventID=<cursor>`. Browser clients that need an `Authorization` header consume the SSE `ReadableStream` through `fetch()`; tokens are never placed in query parameters.

Anonymous subscriptions are disabled. The default deployment does not reflect arbitrary origins on the credentialed hub. Same-origin browser clients and extension clients with explicit host permission work directly; a separate browser origin must be added as an explicit trusted `cors_origins` deployment value, never `*` or an arbitrary-origin pattern.

### Publisher authorization

The Octane worker publishes through `mercure_publish()`. Queue and CLI contexts use an authenticated form POST to the same hub.

Publisher JWT authorization claim:

```json
{
  "mercure": {
    "publish": ["*"]
  }
}
```

Publish form:

```http
POST /.well-known/mercure
Authorization: Bearer <publisher JWT>
Content-Type: application/x-www-form-urlencoded

topic=<topic>&topic=<second-topic>&data=<json>&private=1&type=<event>&id=<optional-id>
```

Application events use the Mercure SSE `event` field and a JSON data frame. Queue Center frames additionally use the durable outbox envelope:

```json
{
  "event": "queue.changed",
  "data": {
    "_id": 481,
    "revision": 27,
    "resource": "global_tasks"
  }
}
```

## Authentication contracts

`Session` means a valid Sanctum identity or the existing enabled loopback debug identity. `Machine` means the existing `PycoreClientOnly` contract: loopback or both headers below.

```http
X-Core-Node-Client: pycore
X-Core-Node-Protocol: 1
```

Session access to a machine-scoped request, response, or blob additionally requires that the session ID owns the active pair record for that machine.

## Relay HTTP API

All JSON endpoints use the standard envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Success",
  "code": 200,
  "status": "success"
}
```

| Method and path | Auth | Request | Successful data |
| --- | --- | --- | --- |
| `GET /api/relay/machines` | Session | None | `machines`, `capability_providers`, `heartbeat_seconds` |
| `POST /api/relay/machine/register` | Machine | `machine_id`, optional `label`, `capabilities`, `hostname`, `platform` | `machine`, `heartbeat_seconds`, `hub` |
| `POST /api/relay/machine/heartbeat` | Machine | `machine_id` | `machine_id`, `heartbeat_seconds` |
| `POST /api/relay/machine/unregister` | Machine | `machine_id` | `machine_id` |
| `POST /api/relay/hub-auth` | Session or Machine | `mode`; machine mode also requires `machine_id`; session mode may include paired `machine_id` | Hub URL, topics, token, TTL, cookie name, subscription URL |
| `POST /api/relay/{machine_id}/pair` | Session | None | `pair`, scoped `hub` authorization |
| `POST /api/relay/{machine_id}/requests` | Paired Session | `method`, absolute `path`, optional `headers`, `body` or `body_ref` | Wake frame under `request`, `poll_interval_ms` |
| `GET /api/relay/{machine_id}/requests/{request_id}` | Machine | None | Stored `request` |
| `POST /api/relay/{machine_id}/responses` | Machine | `request_id`, `status`, optional `headers`, `body` or `body_ref` | `request_id` |
| `GET /api/relay/{machine_id}/responses/{request_id}` | Paired Session | Optional `wait=1` | Stored `response` |
| `POST /api/relay/{machine_id}/blobs` | Machine or Paired Session | Binary body; query: optional `blob_id`, `chunk_index`, `chunk_last` | Blob metadata |
| `GET /api/relay/{machine_id}/blobs/{blob_id}` | Machine or Paired Session | None | `application/octet-stream` body |

## Queue Center realtime API

The Queue Center data is public at the same trust level as the existing task API, while the Mercure hub itself remains closed. Each overview response therefore carries a short-lived subscriber JWT restricted to the exact `queue-center` topic.

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /api/queue-center/overview` | Existing Queue Center access policy | Queue/worker snapshot plus a fresh Mercure subscription contract |
| `GET /api/queue-center/events?cursor=<id>&limit=<n>` | Existing Queue Center access policy | Durable ordered replay after initial connect or any SSE gap |
| `GET /api/task-center/overview` | Existing Task Center access policy | Aggregate task snapshot with the same Mercure subscription contract |

The `realtime` member returned by both overview surfaces is:

```json
{
  "transport": "mercure",
  "hub_url": "https://example.test/.well-known/mercure",
  "topics": ["queue-center"],
  "token": "<topic-scoped JWT>",
  "token_ttl_seconds": 600,
  "cookie": "mercureAuthorization",
  "subscribe_url": "https://example.test/.well-known/mercure?topic=queue-center",
  "event": "queue.changed",
  "revision": 27
}
```

### Machine endpoint origin correction (2026-08-20)

Purpose: keep the Mercure dial URL and JWT `aud` bound to the exact Laravel
origin that pycore already reached successfully. A reverse proxy may expose
Laravel over HTTPS while the direct machine endpoint remains HTTP on port 9000;
combining a forwarded HTTPS scheme with the direct HTTP port makes both pycore
realtime consumers fail with `SSL: WRONG_VERSION_NUMBER`.

Pycore now includes `X-Core-Node-Service-Origin` with its existing client and
protocol identity headers. The value is reduced to an `http`/`https` origin
without credentials, path, query, or fragment. Laravel accepts it only when the
pycore identity pair is valid, then uses that one origin for `hub_url`,
`subscribe_url`, and the JWT audience. Browser/session calls continue to use the
request origin. This is a protocol-level correction shared by Queue Center and
Relay; neither consumer performs TLS fallback or disables certificate checks.

Code files and ownership:

- `pycore/pyutils/laravel/identity.py`: builds the canonical machine service-origin header.
- `pycore/pyutils/laravel/client.py`: attaches the actual resolved request origin to every pycore-to-Laravel call.
- `poly_apps/laravel_main/app/Http/Middleware/PycoreClientOnly.php`: validates the origin under the existing pycore identity contract.
- `poly_apps/laravel_main/app/Services/Relay/RelayHubJwt.php`: selects the validated machine origin before proxy-derived request origin.
- `pycore/pyutils/common/mercure_client.py`: remains the one shared scheme-driven SSE transport for Queue Center and Relay.

Official basis: Mercure defines the hub as the access-token resource identifier
used by `aud`, and subscribers connect to the hub subscription URL over the
declared HTTP transport. Python's `HTTPSConnection` performs TLS for an `https`
URL; `SSL: WRONG_VERSION_NUMBER` therefore indicates a transport scheme mismatch,
not a certificate-verification exception.

mcp-chrome owns one shared Queue Center connection for background wakeups, task detail refresh, and the popup overview. Consumers reconcile through `/api/queue-center/events` before handling buffered SSE updates; `_id` suppresses duplicates, and `Last-Event-ID` resumes the Mercure transport after reconnect.

### Hub authorization response

```json
{
  "transport": "mercure",
  "hub_url": "https://example.test/.well-known/mercure",
  "topics": ["pycore.machines", "pycore.pair.machine-01", "queue-center"],
  "token": "<JWT>",
  "token_ttl_seconds": 600,
  "cookie": "mercureAuthorization",
  "subscribe_url": "https://example.test/.well-known/mercure?topic=pycore.machines&topic=pycore.pair.machine-01&topic=queue-center"
}
```

### Blob idempotency

- The first chunk without `blob_id` creates `blob_<uuid>`.
- Later chunks reuse that ID and provide their zero-based `chunk_index`.
- Repeating the same blob ID, chunk index, and bytes is a no-op at the storage step; metadata is recomputed from stored chunks.
- Repeating an index with different bytes is rejected.
- Blob directories are isolated by a SHA-256 machine namespace and accept only generated UUID blob IDs.
- `chunk_last=1` records the final index; completion requires every index from zero through that index, so gaps cannot produce a complete blob.

Contract limits are read from `config/queue_center_contract.json`: 8 KiB control frames, 256 KiB inline bodies, 4 MiB blob chunks, and 32 MiB total bodies.

## Realtime topics and events

| Topic | Event | Payload purpose |
| --- | --- | --- |
| `pycore.machines` | `roster.update` | Machine online/offline wake update |
| `pycore.pair.{machine_id}` | `relay.request` | Machine request wake frame |
| `pycore.pair.{machine_id}` | `relay.response` | UI response wake frame |
| `queue-center` | Queue Center event contract | Queue revisions and worker presence |

The roster endpoint, request store, response store, and blob store remain authoritative. Consumers must fetch the HTTP resource after receiving a Mercure update.

## Common status codes

| Status | Meaning |
| --- | --- |
| `200` | Read, heartbeat, unregister, pair, or authorization succeeded |
| `201` | Request, response, registration, or blob chunk created |
| `401` | Missing or invalid session authorization |
| `403` | Machine mode without the Pycore identity contract |
| `404` | Expired or unknown request, response, or blob |
| `409` | Machine offline, pair expired, or machine not registered |
| `422` | Invalid machine ID, route path, body reference, or inline size |
