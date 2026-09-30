# FIX 2026-09-30 — pycore WebSocket event transport (SSE connection-pool exhaustion)

## Symptom

UI tabs repeatedly flip between connected and disconnected; pycore requests stall; on 2026-09-30 ~22:00 the desktop froze.

## Evidence (live, 2026-09-30 22:15)

- `ss` on `:59000`: every Chrome instance held exactly **6** connections to `127.0.0.1:59000` (the HTTP/1.1 per-host cap); 2–3 of each 6 were SSE streams (one request sent, then receive-only: same `bytes_received` ≈ 987 KB in 78 s ≈ 12 KB/s of broadcast per stream).
- With 2–3 slots held by SSE, the remaining API requests (agent_history `session_id_pages` / `session_page` / `live_scan`, ~100 req/min each) queue in the browser → client timeouts → reachability false → UI shows disconnected → reconnect loop.
- pycore stdout logged ~3,900 `socket.send() raised exception.` in one minute (writes into SSE sockets whose tabs had gone).
- Memory: 15 GiB RAM + 11 GiB swap in use; `journald` "Under memory pressure" 22:04–22:09 (separate cause, see the chat report; the freeze and the reconnect loop amplified each other).

## Official documentation compared

| Source | Statement | Consequence |
|---|---|---|
| MDN EventSource | Without HTTP/2, SSE is limited to 6 open connections per browser + domain; Chrome/Firefox "Won't fix" | Direct pycore (`http://host:59000`, HTTP/1.1) hits the cap with a few tabs |
| Chromium `client_socket_pool_manager.cc` | WebSockets use a separate pool (255), not the 6-per-group HTTP pool | A socket per tab never starves API requests |
| uvicorn.dev HTTP/2 | HTTP/2 is experimental; browsers need TLS (no h2c) | Not viable for loopback/tailnet plain HTTP |
| uvicorn 0.53 source | `--ws websockets` is deprecated; `auto` selects `websockets-sansio` | Configure `websockets-sansio` explicitly |
| RFC 9220 (WS over HTTP/3) | Not shipped in browsers | Proxy targets (h2/h3) keep SSE — consistent with `DESIGN_20260817_2115_..._PART_2.md` §2.2.6, which applies to the Laravel/Mercure h3 plane only |
| MDN Web Locks | Baseline, same-origin cross-tab leader election | Optional next step: one socket per browser (not implemented) |

## Design

- One journal, two transports. `WsEventService` (`pycore/pyutils/rpc_v2/http/ws_event_service.py`) serves `/api/ws` on the same `SseEventJournal` as `/api/events`: same seq, replay, `replay_lost`, instance restart and audience rules.
- Frames (JSON, `op`): client `hello{client_id, since_seq, topics, leases}` (first frame, 10 s), `subscribe{topics}`, `lease{name, held}`, `ping{t}`, `ack{seq}`; server `state`, `events{records[≤200]}`, `pong`, `error{code}`. Missing hello → close 1008. The K7 origin guard already gates `websocket` scopes.
- Server-side topic filter: the UI sends the topics its `pycoreEventBus` actually has handlers for; untouched topics (e.g. log floods) no longer cross the wire to that tab.
- Presence leases: `WsLeaseRegistry` (`ws_lease_registry.py`) counts leases per socket on the event loop and publishes counts on THREAD_BUS; a lease ends when its socket closes. `agent_history` treats `agent_history.live_monitor` as UI presence, so the 5 s `live_scan` HTTP polling is gone; the heartbeat lane scans and pushes `agent_history.sessions.changed`.
- uvicorn: `ws=websockets-sansio`, `ws_ping_interval=20`, `ws_ping_timeout=20`, `ws_max_size=1 MiB`, per-message deflate.
- UI library `core/network/ws/ReconnectingWebSocket.ts`: jittered exponential backoff, app heartbeat (ping → any inbound frame within 10 s), 10 s open timeout, immediate retry on `online` / tab visible. Timings in `core/config/NetworkTiming.ts` `WEBSOCKET_TIMINGS`.
- Transport selection in `core/integrations/pycore/PycoreHttp.ts`: direct target → WebSocket; proxy target (h2/h3) → SSE; relay → Laravel tunnel (unchanged). Three failed socket opens while HTTP is reachable → SSE fallback.
- `holdPycoreLease(name, fallback)`: the socket carries the lease; without an open socket (SSE, relay, reconnecting) `fallback.renew` runs over HTTP.

## Files

- pycore: `pyfoundations/network_constants.py` (`HTTP_WS_PATH`, `WS_*`), `pyutils/rpc_v2/http/ws_event_service.py` (new), `pyutils/rpc_v2/http/ws_lease_registry.py` (new), `pyutils/rpc_v2/server.py`, `pyutils/rpc_v2/runner.py`, `pyctl/agent_history/tick_service.py`.
- UI: `core/network/ws/ReconnectingWebSocket.ts` (new), `core/config/NetworkTiming.ts`, `core/integrations/pycore/{PycoreHttp,PycoreEventBus,PycoreNetwork,pycoreEndpoints,index}.ts`, `apps/pycore-manager/pages/PcAgentHistoryPage.tsx`.

## Verification (done)

- pycore on a temporary port: hello/state, filtered events, ping/pong, invalid frame, re-subscribe, lease hold/release/close, replay from 0, hello required (1008), foreign origin rejected (403) — 12/12 pass, no ASGI errors.
- Bundled `ReconnectingWebSocket` (Node 26) against a server stopped and restarted: 24 subscribed events, 0 filtered-out events, 8 pongs, jittered backoff 0.2→1.4 s, reopened on the new instance.
- `tsc --noEmit`: no errors in the changed files.

## Rollout (not done — needs a service restart)

1. Restart pycore (`/api/ws` exists only after restart). Until then the UI falls back to SSE automatically after 3 failed opens.
2. Reload open UI tabs.
3. Check: `ss -tnp state established '( dport = :59000 )'` shows one long-lived socket per tab and no Chrome instance pinned at 6; pycore log shows `"WebSocket /api/ws" [accepted]`.

## Not done / follow-ups

- Cross-tab single socket (Web Locks leader + BroadcastChannel).
- `PycoreConsoleLogStore` subscribes to `pycore_log` app-wide, so each tab still receives the log stream; subscribe it only while a log view is open.
- SSE server: batch records into one write per poll and check disconnect inside the batch loop (source of the `socket.send()` log spam).
