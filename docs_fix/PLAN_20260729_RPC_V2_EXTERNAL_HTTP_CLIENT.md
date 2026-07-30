# RPC v2 HTTP service and external HTTP client design

Date: 2026-07-29

Status: implemented architecture with explicitly documented compatibility code

## 1. Scope

RPC v2 provides one HTTP controller surface for `pyservice` and reusable HTTP
event primitives for standalone services such as Qwen3TTS. Pycore may call
external HTTP services through the shared client in `pyutils/common`; browser
clients remain owned by the frontend application.

The transport is not a controller request queue. A controller request is
dispatched immediately and its result is returned in the same HTTP response.
Only published events are retained for bounded replay.

## 2. Source layout

```text
pycore/pyutils/common/http_client.py
  Shared outbound HTTP client and URL helpers for Pycore domains.

pycore/pyutils/rpc_v2/dispatcher.py
  Transport-neutral controller registration and invocation.

pycore/pyutils/rpc_v2/server.py
  FastAPI application, HTTP controller routes, discovery, and transport wiring.

pycore/pyutils/rpc_v2/http/event_service.py
  Standalone-compatible bounded event journal, long polling, and ACK routes.

poly_apps/pycore_laravel_wordflow_ui/core/api-libs/pycore/PycoreHttp.ts
  Browser-owned HTTP controller and event client.

pycore/pyutils/tts/qwen3tts_http_adapter.py
  Qwen3TTS domain client built on the shared outbound HTTP client.

pycore/tts_install_assets/qwen3tts_api_server.py
  Isolated Qwen3TTS FastAPI host using the shared event primitive by file path.
```

Package `__init__.py` files are markers only. No Python or JavaScript client is
implemented in `rpc_v2/http`.

## 3. Layering

- `pyutils/common/http_client.py` owns generic outbound HTTP mechanics.
- RPC v2 owns controller dispatch and server-side HTTP event delivery.
- Domain adapters own external-service paths, payloads, retries, and errors.
- Callmodule only registers controller handlers and injects application event
  publishers.
- The frontend owns browser fetch, timeout, reconnect, and event dispatch.
- The isolated Qwen process must not import the `pycore` package. It loads the
  standalone event module by resolved file path and injects FastAPI.

FastAPI and uvicorn in the main interpreter are obtained only through
`pyfoundations.third_party`. The default bind host is the centralized
`HTTP_BIND_HOST`, currently `0.0.0.0`.

## 4. Controller contract

Controllers are registered on `RpcServer`:

```python
server.route(
    name="ui.agent_history.test_extract",
    handler=handler,
    methods=("POST",),
    timeout=30.0,
)
```

They are exposed at:

```text
GET|POST /api/controller/{controller_name}
```

The normalized handler contract is:

```python
handler(params, request_id, context)
```

- POST accepts one JSON object.
- GET converts query values to strings and repeated values to lists.
- `request_id` uses `X-Request-ID` or a generated value.
- `context` contains transport, method, path, headers, path parameters, remote
  address, client ID, browser ID, and the native request.
- Returned FastAPI responses pass through; other results are JSON encoded.

Async handlers run on the host event loop. Sync handlers are sent through the
RPC v2 `sync_invoker`; main Pycore uses `await_bus_task`, not
`asyncio.to_thread` or asyncio's default executor. Optional controller timeouts
use `asyncio.wait_for`.

## 5. Event contract

```text
GET  /api/events?client_id=<id>&since_seq=<n>&timeout_s=<bounded>
POST /api/events/ack
```

ACK JSON:

```json
{"client_id": "browser-id:tab-id", "seq": 42}
```

Each event contains `instance_id`, `event_id`, `seq`, `topic`, `payload`,
`audience`, `metadata`, and `created_at`.

- Publication assigns a monotonically increasing sequence and immutable ID.
- Polling returns replay immediately or waits for the bounded long-poll period.
- ACK stores only the highest processed event sequence for that client.
- The journal is bounded by count and age.
- `replay_lost=true` requires an authoritative snapshot refresh.
- An `instance_id` change indicates server restart and resets the client cursor.
- Event retention and ACK never participate in controller request execution.

## 6. Pyservice transport policy

`pyservice` enables HTTP controllers and HTTP events. RPC v2 has no WebSocket
route, option, session type, or WebSocket controller dispatch path.

The active pyservice surface is:

```text
GET|POST /api/controller/{name}
GET      /api/controllers
GET      /api/events
POST     /api/events/ack
GET      /rpc/status
GET      /rpc/info
GET      /rpc/routes
```

There is no legacy queued `/rpc/{route}` request path, result polling table, or
request ACK path.

## 7. Frontend

The Pycore UI uses `fetch` for `/api/controller/*`, long-polls `/api/events`,
and POSTs the ACK JSON contract only after dispatching received events.
Controller availability is determined by each HTTP response; event-channel
state does not gate controller calls. The Pycore frontend opens no WebSocket.

## 8. Qwen3TTS

The isolated Qwen host owns its FastAPI application and Qwen-specific routes.
It reuses the standalone HTTP event service at `/queue/events` and
`/queue/events/ack`. Synthesis, status, cancellation, replay, and result
retrieval use HTTP GET/POST only; no Qwen WebSocket client, listener, or route
remains.

The Pycore-side adapter uses `pyutils/common/http_client.py`. Stable
`client_job_id` values preserve idempotency across retry and recovery. Binary
audio remains bytes rather than base64.

## 9. Code Sync

Code Sync retains its domain frame format over synchronous HTTP. The domain
client and standalone server remain in `pyutils/codesync`; RPC v2 does not
duplicate their client logic or maintain a response queue.

## 10. Completed migration

- [x] Main controller calls use immediate HTTP dispatch.
- [x] Sync controller execution uses RPC v2 THREAD_BUS invocation.
- [x] RPC v2 and pyservice contain no WebSocket route or configuration switch.
- [x] The Pycore UI uses HTTP controllers, long polling, and JSON ACK.
- [x] Qwen3TTS uses HTTP routes and the shared standalone event primitive.
- [x] Qwen WebSocket callers and listeners are absent.
- [x] Code Sync transport is HTTP.
- [x] Generic outbound HTTP mechanics are centralized in `pyutils/common`.

## 11. Static acceptance checks

- Callmodule contains routing, controller wiring, and startup composition only.
- No callmodule handler uses `asyncio.to_thread`.
- Pyutils and database do not import callmodule.
- HTTP controller execution has no request queue, callback hop, or result poll.
- RPC v2 exposes no WebSocket route.
- FastAPI and uvicorn are loaded through the third-party registry.
- Source imports are absolute and remain at file top.

Repository policy forbids running tests, builds, or services unless the user
explicitly requests them; use static parsing and dependency checks otherwise.
