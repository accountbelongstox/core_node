# Transport Plane: FrankenPHP, Mercure, HTTP versions, pycore events

Status: current as of 2026-10-02.
Supersedes: `DESIGN_20260817_2115_PYCORE_UI_RELAY_GROUPS_HTTP3*.md` (server plane and protocol parts), `FIX_20260930_PYCORE_WS_EVENT_TRANSPORT.md`, `PLAN_20260729_RPC_V2_EXTERNAL_HTTP_CLIENT.md`.
Relay protocol: `DESIGN_RELAY.md`.

## 1. Server plane (FrankenPHP + embedded Mercure)

- `config/service_contract.json` owns ports (80, 443, admin 2019, UI dev 13054), `web_server_default: frankenphp`, FrankenPHP `v1.12.7`, Mercure `v0.24.2`, Early Hints links (`http.ui_early_hints_link`, `http.api_early_hints_link`), `php_runtime.*`, and `realtime.mercure_*` (`transport local`, `heartbeat 20s`, `write_timeout 0s`, `proxy_close_delay 5m`).
- Linux install: entry `scripts/shells/linux/debian/install_shells/93_install_php.sh` delegates to `scripts/shells/linux/common/frankenphp_install_pipeline*.sh`, `frankenphp_install_{modes,prebuilt,apt}.sh`, `frankenphp_static_builder.sh` (xcaddy with the Mercure module). Windows: `scripts/shells/win/install_powershells/Step93_InstallFrankenPHP.ps1`, `scripts/shells/win/win_common/FrankenPhp{Manager,CertificateManager}.ps1`.
- Runtime config: `scripts/shells/linux/common/frankenphp_manager.sh` + `frankenphp_runtime_common.sh` (`fm_caddyfile_render`, Mercure stanza, proxy routes); launcher `scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh`; convergence `175_laravel_main_start.sh` / `Step175_LaravelMainStart.ps1`. The Laravel Manager renders the same Caddyfile in `poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1FrankenPhpCaddyfileBuilder.php`. Shell, PHP and PS1 renderers stay byte-identical and read the contract; no ports, versions or links are copied into feature code.
- The binary must contain `http.handlers.mercure` (`FRANKENPHP_MERCURE_MODULE`, probed via `list-modules`); the launcher fails closed without it.
- The embedded Mercure hub is the only realtime plane for Laravel (no Reverb). Mercure = SSE down + HTTP POST publish with `subscriptions` enabled; every proxied Mercure route sets `stream_close_delay`; `text/event-stream` is never encoded.

## 2. HTTP versions and 103

- HTTPS edge (`:443`) serves `protocols h1 h2`. HTTP/3 stays disabled until the edge opens UDP/443: advertising h3 with QUIC blocked makes browsers fail with `ERR_QUIC_PROTOCOL_ERROR` before falling back. The internal backend listener is `h1`.
- No WebSocket on the Laravel/h3 plane: FrankenPHP hosts no WebSocket server, and WebSocket over HTTP/3 (RFC 9220) is not shipped in browsers. Relay WebSocket broker revisit criteria live in `DESIGN_RELAY.md` §2.1.
- 103 Early Hints: emitted only for HTML (`@early_hints header Accept *text/html*`) before `reverse_proxy`; JSON APIs get none. Fetch never surfaces 103, so UI code records the negotiated protocol and never checks `response.status === 103`. 301 is a redirect, not Early Hints.
- Topology: default Laravel API `https://api.si.12gm.com` (`LARAVEL_WORKER_API_URL`) even when the UI runs on `127.0.0.1:13054`; loopback endpoints are explicit user selections. An unmarked legacy HTTP default migrates once to the HTTPS endpoint.
- Links: (1) browser/Capacitor → Laravel over HTTPS (`core/network/ProtocolFetch.ts`; Android non-streaming requests via the app-local `ProtocolHttpPlugin` on Cronet `play-services-cronet:18.1.1` with QUIC/h2/Brotli; SSE stays on WebView fetch; Cronet fallback only before a request is sent, never replaying an ambiguous non-idempotent request). (2) pycore → Laravel through `pyutils/common/http_client.py` (`HttpConnectionPools`, httpx, TCP keepalive, loopback bypasses proxies; upload bodies are progress-driven, small control bodies use the normal read timeout) and `pyutils/laravel/client.py`. (3) Realtime: Mercure SSE for browser and pycore relay.
- Local pycore RPC is loopback HTTP on port 59000 (UI dev server is 13054; do not confuse them) and is never labelled HTTP/3.

## 3. pycore event transport (`/api/ws`)

Root cause it replaced: browsers allow 6 HTTP/1.1 connections per host; with direct pycore on plain HTTP, 2–3 SSE streams per Chrome instance starved API requests, causing timeouts, reconnect loops and `socket.send()` floods. WebSockets use a separate browser pool, and h2 needs TLS (no h2c).

- One process journal: `pyfoundations/event_journal.event_journal` (THREAD_BUS-owned, on `pyfoundations/event_records`). Publish API from any thread: `publish_topic`, `publish_log`, `add_tap`/`remove_tap`. The event loop never waits on the journal owner (`*_async` methods via `await_bus_task`).
- Served only at `/api/ws` (`pyutils/rpc/http/ws_event_service.py`). SSE `/api/events`, `/events/poll`, `/events/ack` are removed. uvicorn: `ws=websockets-sansio`, ping interval/timeout 20 s, max frame 1 MiB, per-message deflate. Origin guard covers websocket scopes.
- Frames (JSON `op`): client `hello{client_id, since_seq, topics, leases}` (first frame within 10 s, else close 1008), `subscribe{topics}`, `lease{name, held}`, `ping{t}`, `ack{seq}`; server `state`, `events{records ≤ 200}`, `pong`, `error{code}`. Limits: 256 topics, 16 leases, names ≤ 128 chars (`network_constants.WS_*`).
- Server-side topic filter: a client receives only topics it subscribed. Same seq, replay, `replay_lost` and instance-restart semantics as the journal; `replay_lost` or a new instance forces an authoritative refresh.
- UI presence: `pyutils/rpc/ui_presence.py` holds socket leases (released on close) plus one renewable HTTP deadline per lease name (`UI_PRESENCE_LEASE_SECONDS` 15), published on THREAD_BUS. Writers: `hello.leases`, the `lease` op, route `ui/presence/lease {name, held}` (returns `renew_after`). Consumers ask `ui_presence.is_present(name)` (e.g. `agent_history.live_monitor`).
- UI client: `core/integrations/pycore/PycoreEventClient.ts` is the one subscription: WebSocket only (direct and proxy targets), relay tunnel in relay mode, one persisted cursor, `core/network/ws/ReconnectingWebSocket.ts` (jittered backoff, 10 s open timeout, app heartbeat, retry on `online`/visible; timings in `core/config/NetworkTiming.ts`). One socket per browser: Web Locks leader `pycore-events:<scope>`; other tabs replay pushes over BroadcastChannel and announce their topics so the leader subscribes to the union; without Web Locks each tab leads.
- Live stores share `PycoreLiveSource.ts` (refcount, topic pushes, reconcile on restart/replay loss, optional visibility-aware fallback poll). `PycoreConsoleLogStore` subscribes to `pycore_log` only while a log view is mounted. `holdPycoreLease(name)` is reference-counted.
- The isolated Qwen process keeps its own journal with `/queue/events/poll|ack` long-poll (`tts_install_assets/qwen3tts_events.py`), no SSE, no pycore import.

## 4. pycore RPC layering

- Routes: `config/pycore_rpc_contract.json` is the single source (`api_prefix` `/api`, `protocol_routes` client-id/info/routes/status/ws, `routes` keyed camelCase with path + method). `pyfoundations/rpc_route_contract.py` loads it; `network_constants` derives every protocol path; callmodule and `PycoreHttpRoutes.ts` derive routes from it, so drift fails `tsc`.
- `pyutils/rpc` (`server`, `dispatcher`, `execution`, `runner`, `discovery`) owns controller dispatch and the WS event view. A controller request is dispatched immediately and answered in the same HTTP response: no request queue, callback hop, result polling or request ACK. Event retention never participates in controller execution.
- Handler contract `handler(params, request_id, context)`; POST takes one JSON object, GET stringifies query values (repeated → list); `request_id` from `X-Request-ID` or generated; FastAPI responses pass through, other results are JSON.
- Sync handlers run through `await_bus_task`, never `asyncio.to_thread` or the default executor; asyncio is allowed only in the RPC server loop. Optional timeouts use `asyncio.wait_for`.
- `RpcExecutionKernel.dispatch` serves local HTTP and relay execution through one path: `client_task_id` idempotency (`pyutils/common/idempotent_jobs`), one multipart parser (`decode_multipart_params`).
- `pyutils/common/http_client.py` owns generic outbound HTTP; domain adapters own their paths, payloads, retries and errors.
- Callmodule only registers routes and composes startup; pyutils and database never import callmodule.
- FastAPI and uvicorn load through `pyfoundations.third_party`; bind host is `HTTP_BIND_HOST`. Imports are absolute and at file top.
- The isolated Qwen process never imports `pycore`; it path-loads standalone modules. Stable `client_job_id` keeps Qwen calls idempotent; audio stays binary.
- Code Sync frames are synchronous request/response over signed POST (`frame_transport.py`); no codesync traffic reaches the journal.

## 5. Open items

1. Android Cronet `ProtocolHttpPlugin`: no APK build or device verification of negotiated protocol yet.
2. 103 Early Hints through the outer proxy path is not proven end to end (live HTML request showed only the final 200).
3. HTTP/3 re-enable at the edge waits on UDP/443 being opened; then switch `protocols` to `h1 h2 h3` in all three renderers together.
