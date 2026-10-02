# Transport Plane: FrankenPHP, Mercure, HTTP versions, pycore events

Scope: the Laravel server plane (FrankenPHP + embedded Mercure), HTTP protocol policy, pycore → Laravel HTTP, the pycore `/api/ws` event transport and pycore RPC layering.

Authority: code > `config/service_contract.json`, `config/pycore_rpc_contract.json`, `config/pycore_relay_contract.json` > this document. Relay protocol: `DESIGN_RELAY.md`.

## 1. Server plane (FrankenPHP + embedded Mercure)

- `config/service_contract.json` owns ports (80, 443, admin 2019, Laravel backend 9000, UI dev 13054), `web_server_default: frankenphp`, FrankenPHP `v1.12.7`, Mercure `v0.24.2`, Early Hints links (`http.ui_early_hints_link`, `http.api_early_hints_link`), `php_runtime.*`, and `realtime.mercure_*` (`transport local`, `heartbeat 20s`, `write_timeout 0s`, `proxy_close_delay 5m`, cookie `mercureAuthorization`).
- One Octane process (`artisan octane:frankenphp`, worker mode, custom Caddyfile `storage/frankenphp/Caddyfile`, `public/frankenphp-worker.php`) owns HTTPS, the application routes and the embedded hub. No Reverb, no Swoole options.
- Linux install: `scripts/shells/linux/debian/install_shells/93_install_php.sh` delegates to `scripts/shells/linux/common/frankenphp_install_pipeline*.sh`, `frankenphp_install_{modes,prebuilt,apt}.sh`, `frankenphp_static_builder.sh` (xcaddy with the Mercure module). Windows: `scripts/shells/win/install_powershells/Step93_InstallFrankenPHP.ps1`, `scripts/shells/win/win_common/FrankenPhp{Manager,CertificateManager}.ps1`.
- Runtime config: `scripts/shells/linux/common/frankenphp_manager.sh` + `frankenphp_runtime_common.sh` (`fm_caddyfile_render`, `fm_mercure_config`, proxy routes; `fm_caddyfile_ensure` writes only on content change); launcher `scripts/shells/linux/debian/debian_com/laravel_runtime_frankenphp.sh`; convergence `175_laravel_main_start.sh` / `Step175_LaravelMainStart.ps1`. The Laravel Manager renders the same Caddyfile in `poly_apps/laravel_main/app/Apps/ServerManagerV1/ServerManagerV1Utils/ServerManagerV1FrankenPhpCaddyfileBuilder.php`. Shell, PHP and PS1 renderers stay byte-identical and read the contract; no ports, versions or links are copied into feature code.
- The binary must contain `http.handlers.mercure` (`FRANKENPHP_MERCURE_MODULE`, probed via `list-modules`); `fm_binary_compile_complete` treats it as a rebuild trigger and the launcher fails closed without it.

### 1.1 Mercure hub

- Exactly one hub: the direct backend site (`hosts.any:9000`, plain HTTP for LAN/local) owns the `mercure` stanza (`transport`, separate HS256 `publisher_jwt`/`subscriber_jwt`, `cors_origins`, `cookie_name`, `heartbeat`, `write_timeout`, `subscriptions`) and the native publisher. The HTTPS site and managed `api.<prefix>.<domain>` routes reverse-proxy `/.well-known/mercure*` to it with `stream_close_delay` (`realtime.mercure_proxy_close_delay`) in shell and PHP renderers; `text/event-stream` is never encoded.
- Anonymous subscription is off. `cors_origins` comes from the web-access config list: explicit trusted origins only, never `*` or a pattern.
- Publishing: the Octane worker uses in-process `mercure_publish()`; CLI/queue contexts POST the form (`topic`, `data`, `private=1`, `type`, `id`) with the publisher JWT (`MercurePublisher`). The global `publish: ['*']` token never leaves the server. Devices publish relay responses directly with scoped JWTs (`DESIGN_RELAY.md` §2).
- Wire profile pinned to Mercure 0.24.2: `mercure` JWT claim, repeated `topic` query parameters, `lastEventID` initial cursor, `Last-Event-ID` resume. The draft-standard `authorization_details`, `match`, `last_event_id` and `__Secure-` cookie names are not mixed in; a protocol upgrade changes the runtime pin, Caddy renderers, PHP signer, Python and TypeScript subscribers and the contract profiles in one cutover.
- Tokens only over HTTPS (or the trusted LAN backend), never in URLs, storage or logs; topic, type and id values carry no CR/LF/NUL; nothing publishes under the hub's reserved namespace. Mercure updates are small notifications; bodies and blobs never ride updates unless framed by the relay contract.
- Port 59000 (pycore RPC) is never publicly routed.

### 1.2 Queue Center realtime

- `GET /api/queue-center/overview` and `GET /api/task-center/overview` return a `realtime` member: hub URL, topic `queue-center`, short-lived topic-scoped subscriber token, TTL, cookie name, subscribe URL, event, revision.
- `GET /api/queue-center/events?cursor=&limit=` is the durable ordered replay after connect or any SSE gap; consumers reconcile through it before handling buffered updates and dedupe by `_id`.

### 1.3 Worker runtime constraints

- The Octane per-request ceiling is `REQUEST_MAX_EXECUTION_TIME`, defaulting to `service_contract.json php_runtime.max_execution_time_seconds` (env override wins); the global `frankenphp {}` block also carries `php_ini max_execution_time` / `max_input_time` from the contract, rendered identically by shell, PHP and PS1. The scan-dir ini stays for the CLI plane.
- The launcher resolves `php` from PATH each start (`PHP_BIN` is never pinned in the unit); 175 re-registers pinned units.
- Before a worker boots the launcher deletes `bootstrap/cache/routes-v*.php` and refuses to boot if the route cache cannot be removed; every runtime convergence reloads workers gracefully (`POST localhost:2019/frankenphp/workers/restart`) so a file-sync window never serves a stale route table or contract.
- No full-tree scans on the request path: `EdgeTTSService::cleanZeroByteFilesMaintenance` is time-boxed (file and wall-clock budget) and runs from scheduled maintenance (`DictLaneMaintenance`).
- Laravel logs use the size-capped `daily` channel (`CreateSizeCappedDailyLogger`, 7 files); log viewers read a bounded tail (`LaravelLogTailService::resolveActiveLogPath`, `FileSystemManager::readFileSegment`), never the whole file.

### 1.4 Deployment convergence (`175_laravel_main_start.sh`)

Independent `ensure` steps in order: web-server plane from the contract; FrankenPHP binary and modules (after `redis_endpoint_ensure`, which reuses a running Redis/Dragonfly, starts an installed one, or installs only when the binary is missing); Composer dependencies; `APP_KEY`, publisher key, subscriber key, access code, trusted issuer (each independently, re-read after write); certificates; Caddyfile (content compare); `artisan octane:frankenphp` through the plane launcher. An existing artifact skips only its own write, never a later step.

## 2. HTTP versions and 103

- HTTPS edge (`:443`) serves `protocols h1 h2`. HTTP/3 stays disabled until the edge opens UDP/443: advertising h3 with QUIC blocked makes browsers fail with `ERR_QUIC_PROTOCOL_ERROR` before falling back. The internal backend listener is `h1`. Fetch cannot pick an HTTP version; recovery lives in stream and server configuration, never in a client version flag.
- No WebSocket on the Laravel plane: FrankenPHP hosts no WebSocket server, and WebSocket over HTTP/3 (RFC 9220) is not shipped in browsers. Relay WebSocket broker revisit criteria live in `DESIGN_RELAY.md` §2.1.
- 103 Early Hints: emitted only for HTML (`@early_hints header Accept *text/html*`) before `reverse_proxy`; JSON APIs get none. Fetch never surfaces 103, so UI code records the negotiated protocol and never checks `response.status === 103`. 301 is a redirect, not Early Hints.
- Topology: default Laravel API `https://api.si.12gm.com` (`LARAVEL_WORKER_API_URL`) even when the UI runs on `127.0.0.1:13054`; loopback endpoints are explicit user selections. An unmarked legacy HTTP default migrates once to the HTTPS endpoint.
- Links:
  1. Browser/Capacitor → Laravel over HTTPS through `core/network/ProtocolFetch.ts` (reused by `MasterApiClient`, Laravel `BaseAPI`, `LaravelMercureConnection`, Wordnew API/transport, `CapNetwork`). Android non-streaming requests go through the app-local `ProtocolHttpPlugin` on Cronet `play-services-cronet:18.1.1` (QUIC/h2/Brotli, records `getNegotiatedProtocol()`); `CapacitorHttp` stays disabled; SSE stays on WebView fetch; Cronet fallback happens only before a request is sent, never replaying an ambiguous non-idempotent request. Vite warms the API, request boundary and relay stream modules; the stream and roster never import the aggregate API.
  2. pycore → Laravel through `pyutils/common/http_client.py` (`HttpConnectionPools`, httpx, shared pools — no `threading.local` sessions; TCP keepalive; loopback bypasses proxies) and `pyutils/laravel/client.py`. Every bodied request declares its response profile: uploads (≥ `http_transfer` chunk size or unknown length) are stall-driven (bounded connect, write stalls bounded by `idle_timeout_seconds`, unbounded reply wait, keepalive detects a dead peer); small control bodies use the normal read timeout. Progress reaches `progress_callback` and every `transfer_observer`.
  3. Realtime: Mercure SSE for browser and pycore relay/Queue Center (`pyutils/laravel/mercure_client.py`, `LaravelMercureConnection.ts`): bounded connect and idle read, jittered reconnect, redirects denied, bounded event size.
- Diagnostics: `ui/assist/laravel_transport_probe` (direct-only) runs the normal Laravel client path and returns endpoint, status, transport and negotiated protocol; the pycore HTTP debugger and Queue Center show the recorded transport and protocol.
- Local pycore RPC is loopback HTTP on port 59000 (UI dev server is 13054; do not confuse them) and is never labelled HTTP/3.

## 3. pycore event transport (`/api/ws`)

Reason: browsers allow 6 HTTP/1.1 connections per host; SSE streams to direct plain-HTTP pycore starved API requests. WebSockets use a separate browser pool, and h2 needs TLS (no h2c).

- One process journal: `pyfoundations/event_journal.event_journal` (THREAD_BUS-owned, on `pyfoundations/event_records`). Records carry `instance_id`, `event_id`, `seq`, `topic`, `payload`, `audience`, `metadata`, `created_at`. Publish API from any thread: `publish_topic`, `publish_log`, `add_tap`/`remove_tap`. The event loop never waits on the journal owner (`*_async` methods via `await_bus_task`).
- Served only at `/api/ws` (`pyutils/rpc/http/ws_event_service.py`); there is no SSE or long-poll event route on pyservice. uvicorn: `ws=websockets-sansio`, ping interval/timeout 20 s, max frame 1 MiB, per-message deflate. The origin guard covers websocket scopes.
- Frames (JSON `op`): client `hello{client_id, since_seq, topics, leases}` (first frame within 10 s, else close 1008), `subscribe{topics}`, `lease{name, held}`, `ping{t}`, `ack{seq}`; server `state`, `events{records ≤ 200}`, `pong`, `error{code}`. Limits: 256 topics, 16 leases, names ≤ 128 chars (`network_constants.WS_*`).
- Server-side topic filter: a client receives only topics it subscribed. Journal seq, replay, `replay_lost` and instance-restart semantics apply; `replay_lost` or a new `instance_id` forces an authoritative refresh and resets the cursor.
- UI presence: `pyutils/rpc/ui_presence.py` holds socket leases (released on close) plus one renewable HTTP deadline per lease name (`UI_PRESENCE_LEASE_SECONDS` 15), published on THREAD_BUS. Writers: `hello.leases`, the `lease` op, route `ui/presence/lease {name, held}` (returns `renew_after`). Consumers ask `ui_presence.is_present(name)` (e.g. `agent_history.live_monitor`).
- UI client: `core/integrations/pycore/PycoreEventClient.ts` is the one subscription: WebSocket for direct and proxy targets, the relay tunnel in relay mode, one persisted cursor, `core/network/ws/ReconnectingWebSocket.ts` (jittered backoff, 10 s open timeout, app heartbeat, retry on `online`/visible; timings in `core/config/NetworkTiming.ts`). One socket per browser: Web Locks leader `pycore-events:<scope>`; other tabs replay pushes over BroadcastChannel and announce their topics so the leader subscribes to the union; without Web Locks each tab leads.
- Live stores share `PycoreLiveSource.ts` (refcount, topic pushes, reconcile on restart/replay loss/`relay.events.dropped`, optional visibility-aware fallback poll). `PycoreConsoleLogStore` subscribes to `pycore_log` only while a log view is mounted. `holdPycoreLease(name)` is reference-counted.
- The isolated Qwen process keeps its own journal with `/queue/events/poll|ack` long-poll (`tts_install_assets/qwen3tts_events.py`), no SSE, no pycore import.

## 4. pycore RPC layering

- Routes: `config/pycore_rpc_contract.json` is the single source (`api_prefix` `/api`, `protocol_routes` client-id/info/routes/status/ws, `routes` keyed camelCase with path + method). `pyfoundations/rpc_route_contract.py` loads it; `network_constants` derives every protocol path; callmodule and `PycoreHttpRoutes.ts` derive routes from it, so drift fails `tsc`.
- `pyutils/rpc` (`server`, `dispatcher`, `execution`, `runner`, `discovery`) owns controller dispatch and the WS event view. A controller request is dispatched immediately and answered in the same HTTP response: no request queue, callback hop, result polling or request ACK. Event retention never participates in controller execution.
- Handler contract `handler(params, request_id, context)`; POST takes one JSON object, GET stringifies query values (repeated → list); `request_id` from `X-Request-ID` or generated; `context` holds transport, method, path, headers, path params, remote address, client and browser IDs and the native request; FastAPI responses pass through, other results are JSON.
- Sync handlers run through `await_bus_task`, never `asyncio.to_thread` or the default executor; asyncio is allowed only in the RPC server loop. Optional timeouts use `asyncio.wait_for`.
- `RpcExecutionKernel.dispatch` serves local HTTP and relay execution through one path: `client_task_id` idempotency (`pyutils/common/idempotent_jobs`), one multipart parser (`decode_multipart_params`), explicit no-body state, exact bytes.
- `pyutils/common/http_client.py` owns generic outbound HTTP; domain adapters own their paths, payloads, retries and errors.
- Callmodule only registers routes and composes startup; pyutils and database never import callmodule.
- FastAPI and uvicorn load through `pyfoundations.third_party`; bind host is `HTTP_BIND_HOST`. Imports are absolute and at file top.
- The isolated Qwen process never imports `pycore`; it path-loads standalone modules. Stable `client_job_id` keeps Qwen calls idempotent; audio stays binary.
- Code Sync frames are synchronous request/response over signed POST (`frame_transport.py`); no codesync traffic reaches the journal.

## 5. Open items

1. Android Cronet `ProtocolHttpPlugin`: no APK build or device verification of negotiated protocol yet.
2. 103 Early Hints through the outer proxy path is not proven end to end (live HTML request showed only the final 200).
3. HTTP/3 re-enable at the edge waits on UDP/443 being opened; then switch `protocols` to `h1 h2 h3` in all three renderers together.
4. The 6.9 GB pre-rotation `laravel.log` on the server is not truncated (needs operator approval).
5. Windows `Step175_LaravelMainStart.ps1` idempotent double run is still pending (second run must change nothing and print no secrets).
6. The `:9000` backend binds `0.0.0.0` and serves app + hub (including subscriber JWTs) over plain HTTP on the LAN; intentional LAN path, keep it off untrusted networks.
