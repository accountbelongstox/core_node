# Comprehensive RPC Analysis

---

**Important notice**: This is the canonical RPC communication guide. All frontend and backend contributors **must** comply with it. Any protocol or transport change must update this document immediately and every affected developer must be notified.

---

## 1. Frontend Request Lifecycle

1. The web client generates a `request_id`, persists it (ID + pending metadata) inside `localStorage`, and reloads that metadata after refresh.
2. Every outgoing request registers a callback in the client-side event registry. Responses are matched by `request_id` and the stored callback is executed.
3. HTTP requests follow the exact same lifecycle. The only difference is transport: after the server acknowledges the request, the browser waits one second and then starts polling `/rpc/query/{request_id}`.
4. When the page reloads, pending metadata and callbacks are restored automatically so historical responses still find their handlers.

---

## 2. Server Workflow

4. The server always writes the request into the request-event table before invoking the controller. This guarantees durability even if the controller crashes.
5. When the controller finishes, the result is pushed through WebSocket. Delivery retries every 3 seconds (maximum 3 attempts); after the final retry the result is written into the inventory table.
6. Both HTTP and WebSocket handlers first inspect the inventory table. If a stored result exists, it is replayed immediately.
7. Client connections live inside a global registry. Entries are only removed on timeout or when the global ceiling (`max_clients=10_000_000`) is exceeded.
8. Client and server **must** use the same string↔JSON helpers and adhere to the shared payload schema so that WebSocket frames never carry ad‑hoc structures.
9. Two official client libraries exist: the WebSocket client waits for server push; the HTTP client polls for completion. Both share the same protocol objects.

---

## 3. Heartbeat and Discovery

1. Both transports (HTTP + WebSocket) maintain a heartbeat loop. Besides checking availability it also fetches pending inventory items.
2. Heartbeat frequency accelerates whenever unacknowledged request IDs exist; otherwise it runs every 5 seconds.
3. The server exposes baseline routes out of the box (`/rpc/status`, `/rpc/queue_stats`, etc.) so consumers can query health without registering custom controllers.
4. The frontend can extend client-side routing by passing a route key and callback. The heartbeat loop will automatically dispatch events as soon as the server emits them.
5. Backend developers extend the RPC router via the standard `route(name, handler)` API. Controller responses are attached to the protocol payload (they **must not** replace the envelope). WebSocket notifications wait for ACK before completion, and HTTP clients rely on HTTP status codes (200/202/4xx) as acknowledgements. No controller is allowed to block on `await`-based sleep for notification retries—the ACK manager handles that.

---

## 4. Event Persistence & Inventory Rules

1. Every request travels with a unique event ID, shared by the frontend and backend.
2. The server stores each event in the event table before executing it. Once finished, results are queued for delivery; failures are stored inside the inventory table.
3. When a WebSocket reconnects, pending inventory items (or pending notifications) are replayed immediately before accepting new traffic.
4. HTTP polling endpoints return the same unified object format as WebSocket pushes. Each response contains `type`, `id`, `status`, `result`, `error`, `queue`, and `requires_ack`. The `queue` entry may be `null` or contain queue metadata; if nothing is pending the HTTP response still includes the `request_id`.
5. Whenever a historical request exists (WebSocket or HTTP), the server first checks the inventory table and responds with the stored payload before invoking any controller.

---

## 5. Client Acknowledgements & Storage Rules

1. Clients (both transports) must keep request metadata keyed by `request_id`. This enables callback restoration and ensures responses never get lost even if the UI reloads.
2. The client and server share a protocol-agnostic message object described in `pycore/pyutils/rpc_v2/UNIFIED_MESSAGE_TYPES.md`.
3. WebSocket clients do **not** retry via HTTP. They wait for push notifications and ack them immediately.
4. HTTP clients never assume a timeout. Instead, they rely on the server-managed queue and keep polling until completion. This allows multi-hour tasks to complete without aborting.

---

## 6. Transport Constraints

1. WebSocket is the primary transport. HTTP is strictly polling-based and is normally disabled when the browser can use WebSocket.
2. When `unified_rpc_client.js` is loaded, it must connect via WebSocket, disable HTTP fallbacks, and log detailed diagnostics whenever a WebSocket error occurs (URL, event payload, ready state, and reconnect attempts).
3. The RPC server must enable CORS (wildcard origin by default) so browser-based clients can talk to it without additional proxies.
4. Both transports share the same ACK and retry logic. Retries are non-blocking and implemented inside the server’s ACK manager.

---

## 7. Extensibility Requirements

1. The server exposes a route-registration API so sub-apps can register domain-specific controllers without modifying the base server.
2. Client-side libraries allow extending the event registry by binding custom routes/events to callbacks. The event bus uses the same message envelope for server pushes and HTTP poll replies.
3. The request inventory table keeps pending responses until acknowledgements arrive. WebSocket reconnections automatically replay this inventory. HTTP clients read the same inventory via polling.
4. Any change to the message format or lifecycle requires updates to both this document and `pycore/pyutils/rpc_v2/RPC_PROTOCOL_SPECIFICATION.md`.

---

## 8. Implementation Checklist

- [x] Request IDs persisted to `localStorage`
- [x] Callbacks stored per request ID
- [x] HTTP polling kicks in after 1 second (no timeout aborts)
- [x] Server stores every request before invocation
- [x] WebSocket push with 3 attempts, 3-second interval
- [x] Inventory table replay for both transports
- [x] Shared JSON helpers and unified payload schema
- [x] Global client registry with cleanup rules
- [x] Heartbeat-driven event replay
- [x] Route extension APIs for backend and frontend

Any new RPC feature must continue satisfying each checklist item.

