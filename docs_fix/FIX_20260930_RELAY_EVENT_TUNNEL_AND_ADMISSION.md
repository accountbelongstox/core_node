# FIX 2026-09-30 — Relay: event tunnel instead of polling, admission single-flight

## Root cause (architecture)
- Relay is a durable job queue (admission -> claim -> lease -> result, DB + outbox) built for commands. The UI used it for everything: every panel poll, and every "live" view, became a Relay operation (`POST /api/relay/operations` + status reads + device claim/result calls).
- Only 4 hard-coded events (terminal, 3 agent-history) were pushed. Relay mode opens no pycore SSE stream (`prepareEventStream` returned early), so logs, queue, lane and engine events never reached the UI; stores compensated with 2-5 s polls -> >120 admissions/min per limiter key -> `429` storms (`/api/relay/operations`), server read timeouts, and no logs in the floating panel.
- No admission scheduling: N panels polling the same route produced N operations; nothing backed off on 429.
- Limiter `relay-owner` keyed `ip:lane`, so every user behind one NAT/proxy shared one bucket.

## New design
- Event tunnel (push): pycore taps `http_event_delivery_service` (the single place every broadcast event passes) -> `RelayEventForwarder` batches into one `pycore.events` device event (2 s window, latest-wins for snapshot topics, 200 entries / 48 KB cap, drop counter, backoff on failure, own-thread events dropped so posting never feeds itself). The 4 dedicated events stay as they are and are excluded from the tunnel.
- UI (`PycoreHttp.startRelayEventTunnel`): in Relay mode the owner Mercure stream replays each entry on `pycoreEventBus` (same topics and event-id dedupe as direct SSE), filtered by the selected device; the connection state drives the existing connected indicator. Logs, queue, lane and engine events now arrive without polling.
- Admission: reads (GET/HEAD) are single-flight per `method+url` (one operation shared by all callers, each gets a cloned Response, abort is per caller); on 429 reads fail fast with exponential backoff (5 s -> 60 s) while mutations still go through.
- Server: `relay-owner` limiter keyed by authenticated user + lane (IP only when anonymous).

## Contract / files
- `config/pycore_relay_contract.json`: event `pycore_events` = `pycore.events`, payload profile `[pairing_id, device_id, revision, metadata]`; `RelayContract.php` `DEVICE_EVENT_NAMES` and `relay_contract.py` `RELAY_REQUIRED_EVENTS` list it. The contract digest changes: every host must pull the file (device and Laravel must read the same one).
- pycore: `pyctl/relay/relay_event_forwarder.py` (new), `laravel_relay_agent_service.py` (start/stop, `_post_device_event` returns success), `pyutils/rpc_v2/delivery.py` (`add_tap` / `remove_tap`).
- UI: `core/integrations/pycore/PycoreHttp.ts`, `PycoreLaravelRelayTransport.ts`.
- Laravel: `AppServiceProvider.php` (limiter key).

## Verified
- `tsc --noEmit` clean; `py_compile` clean; `php -l` clean; JSON valid.
- Not run end to end (needs the server and the Windows device).

## Test steps (server, then Windows)
1. Pull, then reload FrankenPHP workers (contract file + limiter changed; route/config cache clear as in the runtime convergence rule).
2. Restart pyservice on the device (new agent code; the contract digest changed).
3. Open pycore-manager in Relay mode: the floating Logs panel must show device lines within ~2 s; `Connected` must be green.
4. Watch `POST /api/relay/operations` rate: idle page should be well below 60/min and never 429.
5. Server: `/api/relay/device/events` 2xx with `event_type=pycore.events`; Mercure owner stream carries it.

## Open
- Server slowness seen from Windows (`/api/queue-center/overview` read timeouts at 8 s, `/api/health` at 12 s, worker register 20-25 s): check FrankenPHP worker thread count/saturation and the overview query; not addressed here.
- Remaining relay polls (audio lane 5 s, orchestration 3 s, usage 4 s) can move to event-driven refresh once their topics are emitted by pycore.
- Longer term: the interactive data plane (RPC) could bypass PHP entirely by publishing through the Mercure hub with scoped JWTs; not started, needs a device-side route policy.
