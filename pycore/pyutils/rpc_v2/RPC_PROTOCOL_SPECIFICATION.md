# RPC Protocol Specification (FastAPI v2)

---

**Important notice**: This specification is the single source of truth for the RPC transport that powers `pycore`. Every frontend and backend developer **must** follow it. Any protocol, routing, or message-format change requires updating this document and informing all affected teams.

---

## 1. Unified Workflow

### 1.1 Client Responsibilities

1. Generate a `request_id` for every operation and persist the metadata (`request_id`, route, params, transport) in `localStorage`. On refresh the client reloads that metadata before reconnecting.
2. Store callbacks inside the client-side event registry keyed by `request_id`. When a server response arrives, resolve the registered callback and then remove the metadata.
3. When the WebSocket transport is available (default), disable HTTP fallback entirely. The unified WebSocket client must log detailed diagnostics (URL, readyState, event payload) whenever a connection attempt fails.
4. HTTP clients follow the same flow but rely on polling: once the server acknowledges the POST, wait one second and then continuously poll `/rpc/query/{request_id}` until a completed payload is returned.
5. **Never** cancel a request via client-side timeout. Long-running tasks (hours) must continue polling or waiting for push notifications until the backend responds.

### 1.2 Server Responsibilities

1. Persist each incoming request into the `RequestEventTable` before executing a controller. This guarantees there is a durable event even if the controller fails.
2. Dispatch the controller, capture the result, and schedule delivery through the ACK manager. WebSocket notifications retry every 3 seconds (maximum 3 attempts); after the final attempt the payload is stored inside the inventory table.
3. All HTTP and WebSocket handlers must first check the inventory table. When a historical record exists, respond immediately without re-running the controller.
4. Maintain a global client registry. Clients are only removed when they are inactive past the timeout or when the registry exceeds its `max_clients` ceiling (`10_000_000` by default).
5. Expose a standard `route(name, handler)` API so sub-apps can add controllers without modifying the server core. Controller responses are attached to the unified payload—they must **not** override the envelope.

### 1.3 Heartbeat Rules

1. Both transports maintain a heartbeat loop that serves two purposes: (a) confirm availability and (b) fetch pending events/inventory items.
2. Heartbeat interval accelerates whenever there are outstanding request IDs (`heartbeatFast=1s`); otherwise it defaults to `5s`.
3. Built-in diagnostic routes (`/rpc/status`, `/rpc/queue_stats`, `/rpc/info`) are always mounted so tooling can validate availability.
4. Frontend routes can register callbacks via `onEvent(route, handler)`. The heartbeat automatically dispatches messages when the server reports them.

---

## 2. Message Envelope

All transports share the same object structure defined in `UNIFIED_MESSAGE_TYPES.md`. Every payload includes a `type` discriminator and the originating `id` so clients can safely parse frames even when WebSocket libraries exchange plain strings.

```json
{
  "type": "response | request | event | error | ack | ping | pong | inventory",
  "id": "uuid-request-id",
  "route": "queue_stats",
  "status": "accepted | pending | processing | completed | failed",
  "success": true,
  "result": { "...": "..." },
  "error": null,
  "requires_ack": true,
  "queue": null
}
```

- HTTP responses and WebSocket pushes **must** use this envelope.
- Event notifications include `type: "event"` and either `route` or `event` plus a `data` object.
- Inventory replays reuse the same envelope with `from_inventory: true`.
- ACK frames use `{ "type": "ack", "id": "..." }`.

---

## 3. Transport Behavior

### 3.1 WebSocket

1. Endpoint: `ws://<host>:<port>/rpc/ws?client_id=<uuid>`.
2. Only one connection is required per client. WebSocket transports never send HTTP fallbacks.
3. Upon connect the server emits `{type:"welcome", client_id, timestamp}` followed by replayed pending events/inventory items.
4. When a request is submitted, the client stores metadata and sends `{type:"request", id, route, params}`. The server creates/updates the event table before dispatching.
5. Server push events rely on the ACK manager:
   - send payload (type=`response` or `event`, `requires_ack: true`)
   - wait for ACK
   - retry every 3 seconds, up to 3 attempts
   - store in inventory if all retries fail
6. The heartbeat ping uses `{type:"ping"}`; the server responds with `{type:"pong", pending_requests, inventory_items}` and simultaneously attempts to flush queued events.

### 3.2 HTTP Polling

1. Endpoint: `POST /rpc/{route}` with `{id, route, params}` payload.
2. Server immediately writes the event and returns:
   ```json
   {
     "type": "response",
     "id": "<request_id>",
     "status": "accepted",
     "message": "Request accepted, please query result after 1 second",
     "requires_ack": true,
     "queue": null
   }
   ```
3. Client waits ~1 second (configurable) and polls `GET /rpc/query/{request_id}` until it receives a payload whose `status` is `completed` or `failed`.
4. Every polling response still contains the same unified message object. If no update exists, `status` stays `pending` or `processing`, but `id` is always present.
5. HTTP clients never impose their own timeout—they continue polling until the backend indicates completion or failure. This guarantees multi-hour workloads finish without being dropped.

---

## 4. Inventory & Event Tables

1. **RequestEventTable**: durable state machine storing lifecycle (`PENDING → PROCESSING → COMPLETED → ACK_PENDING → ACK_RECEIVED`). Each record tracks retries, client metadata, and result/error objects.
2. **InventoryTable**: queue of responses awaiting delivery. When WebSocket delivery fails after max retries, items land here. HTTP polling and future WebSocket connections read from the same table.
3. **EventCache** (optional) keeps idempotent responses or cached data for fast replays.
4. Every event shares the same `request_id` between client and server; both sides must keep metadata until the request resolves.

---

## 5. Compliance Checklist

| Requirement | Status |
| --- | --- |
| Client IDs + request metadata persisted in `localStorage` | ✅ |
| WebSocket client logs connection details and disables HTTP fallback | ✅ |
| HTTP client polls `/rpc/query/{id}` forever (no manual timeout) | ✅ |
| Server writes to event table before executing controllers | ✅ |
| Inventory table replay for both transports | ✅ |
| ACK manager handles retries without blocking controllers | ✅ |
| Unified message envelope per `UNIFIED_MESSAGE_TYPES.md` | ✅ |
| CORS is enabled globally for `/rpc/*` | ✅ |
| Route registration API shared by all sub-apps | ✅ |
| Heartbeat accelerates when pending IDs exist | ✅ |

---

## 6. Change Control

1. Any update to the protocol, retry cadence, or message schema requires:
   - Updating this specification and `COMPREHENSIVE_RPC_ANALYSIS.md`.
   - Notifying all teams that maintain RPC clients/servers.
   - Providing migration steps for both transports.
2. No change can bypass the unified object format or introduce custom payloads. Doing so would break inventory replay, ACK tracking, and WebSocket compatibility.

Following these rules keeps `rpc_v2` consistent, debuggable, and extensible across every pycore application.

