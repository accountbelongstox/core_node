# FIX 2026-10-01 — one selected Laravel server: pycore runs and delivers for it only

## Symptom

pycore had `https://api.si.12gm.com` selected, yet the log showed word reports going elsewhere:
`[laravel upload] reason=word_audio_delivery task_id=77331101 http://127.0.0.1:9000/api/app_qy_v1/ai_tools/tts/worker/report`.
The pycore-manager "Laravel endpoint" panel listed every endpoint as "not probed".

## Evidence (live, desktop-1l9k06n)

- `laravel_endpoint_cache.json`: `current=https://api.si.12gm.com`, `selection_explicit=true`.
- Outbox `laravel_delivery.sqlite3`: pending rows for three servers at once — `agent_history.article` 2618 for `server:acef730…` (debian-gpu), `audio_cache.resource` 12 for `server:375427…` (12gm, selected), `audio_lane.word` 3 for `server:cbb90c…` (127.0.0.1); metrics show 56,392 word reports delivered to the local server.

## Root cause: "which Laravel" was decided per URL in many independent places

| Place | Behaviour |
|---|---|
| `task._laravel_base_url` (full pull, orchestration login, UI pump `laravel_endpoint`) | stamped with any catalog URL, persisted in the audio queue snapshot, restored on boot; a switch never cleared it |
| Outbox `deliverable_namespaces` | a `pinned` kind (audio lanes) drained every namespace holding rows, not the selected one |
| `worker_base._sync_laravel_endpoint` | froze `api_url` while `_registered` |
| `select(probe=True)` | notified listeners only after a healthy probe |
| Catalogs | UI ≈10 URLs (contract), pycore 2 (+ cache) |
| pycore-manager panel | read the browser's own list/health/selection; never probed; no pycore call |

## Design

The unit of selection is a **server** (`server:<server_id>`); URLs are routes to it.

1. **One authority** — `laravel_endpoint_manager` (`selected_namespace`, `selected_server_matcher()`, `serves_selected(url|namespace)`, `task_namespace`, `work_endpoint_error(url)`). A route of unknown identity is not the selected server.
2. **Every selection notifies** listeners at once (intent, independent of health); the background probe only adopts the resolve winner.
3. **Admission gate** (`pyutils/tts/audio_queue_center.py`): each task gets `_laravel_server_url` (`bind_task_server`: claim URL, else the active route). Only selected-server tasks are accepted (`accept_task`, `accept_backlog`, `promote_local_head`), restored (`restore_from_cache`, logs `other_server_dropped`) and popped (`pop_next` settles others as `laravel_server_not_selected`). A switch runs `retain_selected_server()` (`AudioTaskQueue.prune_where`, generalizing `prune_absent`).
4. **Workers** (`worker_base`) always follow the active route (re-register on change) and refuse a just-in-time claim for another server.
5. **Outbox** drains the selected server only; rows of other servers are parked (`stats.by_namespace[].parked`) until that server is selected again — Laravel leases re-dispatch the work, and the switch reconcile diffs the rest. `DeliveryKind.pinned` removed. A pinned row whose URL is down uses another live route of the same server.
6. **Entry points** (`ui/queue_center/accept_task`, word full pull, orchestration login) reject URLs via `work_endpoint_error`: `LARAVEL_ENDPOINT_UNKNOWN` (not in the catalog) or `LARAVEL_SERVER_NOT_SELECTED` (constants in `endpoint_manager`, re-exported by `client`).
7. **One catalog** — `service_contract.laravel_api_catalog_urls()` builds the UI's order (root domains, `service_host_keys.laravelApi` hosts on the backend port, URL entries); `LARAVEL_WORKER_API_URLS` uses it.
8. **Panel API** — `ui/assist/laravel_endpoints` (list: pycore catalog, `current`, `selected_namespace`, per-row health + `server_id`/`namespace`/`selected_server`; background sweep) and `ui/assist/laravel_endpoints_probe`; selection stays `ui/assist/bind_laravel_endpoint`. Relay: list `general_read`, probe `denied`.

## Operational effect

- After restart (or the next switch), queued tasks of 127.0.0.1 / debian-gpu leave the queue; their outbox rows stay parked (visible, not attempted).
- Selecting another server moves everything at once: workers, queue, outbox, reconcile.

## Not changed

- The browser's own Laravel transport selection (localStorage) remains separate; the panel warns when it differs from pycore's server.
- Cached custom endpoints (e.g. `https://debian-gpu.thresher-python.ts.net` without `/laravel-api`) stay in `laravel_endpoint_cache.json` until removed.
