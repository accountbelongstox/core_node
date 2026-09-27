# Laravel route authentication table (client key rollout)

Owner: laravel (local). Date: 2026-09-27. Binding source: requirements §5, contract `config/service_contract.json#client_key_auth`.
Paths are under `/api/`. Callers were found by grepping the consumer trees (built bundles excluded).

## Middleware aliases

| Alias | Meaning |
|---|---|
| `client.key` | A valid K3 signature is required. Failure: 401 with a contract `error_code` (`client_key_*`) and an i18n `message`. |
| `client.key_or_dashboard` | A valid K3 signature, or `dashboard.auth` (admin). A request that carries `X-Core-Node-Signature` is judged only by K3 and never falls through to login. |
| `dashboard.auth` | Sanctum bearer (or the loopback debug bypass) and **admin** (`rolelevel >= 10`). Non-admin: 403 `AUTH_FORBIDDEN`. |
| `dashboard.auth:super_admin` | Same, but `rolelevel >= 100`. |
| `dashboard.auth:user` | Any authenticated user (self-service and end-user cost routes). |
| `auth:sanctum` | Unchanged end-user routes. |
| public | No auth. |

`DASHBOARD_LOCAL_DEBUG` now defaults to off on production hosts (`PathMapper::isProduction()`: not WSL, no desktop session) and stays on for desktop/WSL/Windows development hosts. An explicit value in the runtime store still wins.

`pycore.client` is removed. Its only route (`internal/pycore/*`) moves to `client.key`.

## Callers key

pycore = `pycore/`; ncore = `ncore/`, `apps/*` except mcp-chrome; mcp = `apps/mcp-chrome/` (extension background, signs through its native host per K6); LM = laravel-manager; PM = pycore-manager; WN = wordnew; UI-core = `UI/core|shared|shell` (used by all UI apps); FL = flutter; peer = another Laravel (`DataSyncPeerClient`, signs as `laravel_peer`).

## routes/api.php

| Route | Callers | New auth |
|---|---|---|
| `worker/heartbeat`, `worker/unregister`, `worker/tasks/{t}/pull`, `worker/tasks/{t}/result`, `worker/tasks/{t}/release` | pycore (`worker_base.py`, `laravel_audio_worker.py`, `worker_result_delivery.py`), mcp | `client.key` |
| `worker/register`, `worker/tasks/{t}/accept` | pycore, mcp, UI-core (`LaravelAPI.registerQueueWorker/acceptWorkerTask`, browser pump) | `client.key_or_dashboard` |
| `worker/list`, `worker/stats` | LM (`ServerManagerAPI`), mcp (contract keys) | `client.key_or_dashboard` |
| `task/create`, `task/{id}/status`, `task/{id}/cancel`, `task/{id}/bump`, `task/{id}/detail`, `task/list`, `task/stats` | LM (`ServerManagerAPI`, `BooksAPI`), UI-core (`LaravelAPI` detail), mcp (`api-paths` task list/status/detail) | `client.key_or_dashboard` |
| `task/clean-invalid`, `task/reset-assigned` | none found (operator only) | `dashboard.auth` |
| `task-center/overview`, `task-center/completed`, `GET task-center/settings` | LM, UI-core, mcp | `client.key_or_dashboard` |
| `POST task-center/settings` | none found (operator) | `dashboard.auth` |
| `app_qy_v1/media/ingest`, `ingest-clip`, `audio`, `ai-audio` | pycore (`media_sync.py`, `books_service.py`), mcp (`duoreader-importer-core`, ai-audio) | `client.key` |
| `app_qy_v1/media/enrich` | pycore (`media_service.py`), UI-core (`LaravelAPI.mediaEnrich`) | `client.key_or_dashboard` |
| `app_qy_v1/media/*` GET browse/serve | UIs, FL | public (unchanged) |
| `app_qy_v1/books/upload`, `ingest` | LM | `dashboard.auth` (now admin) |
| `app_qy_v1/books/list`, `supported-formats` | LM | public (unchanged) |
| `config/server`, `config/environment` | LM | `dashboard.auth` (now admin; `PUT` keeps its super-admin check) |
| `internal/pycore/logs/latest` | none found | `client.key` (was `pycore.client`) |
| `queue-center/mercure-authorization` | UI-core (`queueCenterHubAuth`), mcp | `client.key_or_dashboard` (was `dashboard.auth`, which locked mcp out) |
| `queue-center/overview` | pycore (`snapshot_service.py`), mcp, UI-core | `client.key_or_dashboard` (RV-003: the subscriber token only reaches authenticated callers) |
| `queue-center/events`, `queue-center/receipts` | pycore (`snapshot_service.py`), mcp, UI-core | `client.key_or_dashboard` |
| `queue-center/queues/{q}/diff` | pycore (`worker_base.py`), mcp | `client.key` |
| `queue-center/queues/{q}/id-pages`, `page-data` | pycore (`worker_base.py`), mcp, UI-core (browser pump) | `client.key_or_dashboard` |
| `queue-center/queues/{q}/items`, `head`, `head/batch`, `tasks/{id}/cancel`, `tasks/{id}/retry` | mcp, UI queue views | `client.key_or_dashboard` |

## routes/DashboardRouter/DatabaseManager.php

| Route | Callers | New auth |
|---|---|---|
| `dashboard/db-manager/*` (connections, status, tables, structure, data, export, backup, backups, delete/download backup, sync list/start/probe/show/target/pause/resume/cancel, credentials list) | LM (`DatabaseManagerAPI`) | `dashboard.auth` (admin) |
| `tables/{t}/import`, `backups/{id}/restore`, `sync/fetch`, `credentials/change`, `credentials/reset`, `credentials/users` (POST, DELETE) | LM | `dashboard.auth:super_admin` |
| `dashboard/db-manager/sync-peer/health` | peer probe | public (reachability only) |
| every other `sync-peer/*` route (prepare, export-prepare, `sessions/*`, `export-sessions/*`) | peer | `client.key` (peer signs as `laravel_peer`; the per-session token stays as a second factor) |

## routes/api/ai_local.php

| Route | Callers | New auth |
|---|---|---|
| all `local/ai/*` (catalog, probe, chat, gateway, rate-limits, usage, keys, image, image/history, capabilities, chat/*, prompt-cache, info) | LM (`AiManagementAPI`, ai-tools panels) only; pycore uses its own `/api/local/ai` RPC, not Laravel's | `dashboard.auth` (admin) |

## routes/api/system.php

| Route | Callers | New auth |
|---|---|---|
| `store_session`, `retrieve_session`, `broadcast_session` | none found | `client.key_or_dashboard`, plus `max:` rules and a TTL (LB-028) |
| `get_system_status` | health-style | public (unchanged) |
| `server-manager/*` | LM | `local.only` (unchanged); `toggle-autostart` takes an explicit target state (FU-030 cross-scope) |

## routes/api/auth.php

| Route | Callers | New auth |
|---|---|---|
| `logout`, `user`, `user/profile`, `user/change-password`, `user/redeem-super-code`, `user/preferences` | all UIs | `dashboard.auth:user` (self-service stays open to non-admins) |

`routes/web.php` is immutable (guide §1). Its self-service actions (`auth/elevate`, `auth/profile`, `auth/logout`) are allow-listed as `user` level inside the middleware; every other `dashboard.auth` route there (api_info, api_params_cache, code-browser, static-resource mutations, `auth/users`) becomes admin.

## routes/AppQyV1Router/AppQyV1AITools.php

| Route | Callers | New auth |
|---|---|---|
| `ai_tools/ai/test` | none found | `dashboard.auth` (admin) |
| `ai_tools/ai/status`, `cover-status`, translation reads, tts reads/audio, `article/task/{id}`, `article/list|recommend|audio`, `article/worker/recent`, `sentence/audio`, `sentence/missing`, `sentence/without_audio`, `GET variant-specs`, `tts/queue/stats|metrics|performance|logs|status`, `queue/batch/get`, `queue/check_batch` | UIs, pycore reads | public (unchanged) |
| `ai_tools/cover-retry` | LM | `client.key_or_dashboard` |
| `ai_tools/tts/generate` | LM (`TTSForm`), FL (`api_service_app_qy.dart`) | `dashboard.auth:user` (human cost route; Sanctum users and the dev bypass) |
| `ai_tools/tts/batch-generate` | pycore (`agent_history/pipeline/laravel_stage.py`), LM | `client.key_or_dashboard` |
| `ai_tools/tts/queue/batch/add`, `tts/queue_batch` | LM, UI-core contract | `client.key_or_dashboard` |
| `ai_tools/tts/worker/claim`, `worker/report` | pycore (`laravel_audio_worker.py`) | `client.key` |
| `ai_tools/tts/sentence/report` | pycore (`audio_resource_delivery.py`, `laravel_audio_worker.py`) | `client.key` |
| `ai_tools/tts/sentence/claim` | LM (counts-only summary, `limit:0`) | `client.key_or_dashboard` (LB-031 query fixed, route kept for LM) |
| `ai_tools/tts/sentence/audio/head` | WN | public (unchanged: end-user priority hint) |
| `POST|DELETE ai_tools/tts/variant-specs` | UI-core (`saveSentenceVoiceVariants`, `deleteSentenceVoiceVariant`) | `client.key_or_dashboard` |
| `ai_tools/article/worker/submit`, `worker/replace-audio` (agent-history ingest) | pycore (`agent_history/pipeline/laravel_stage.py`) | `client.key` |
| `ai_tools/articles` DELETE, `articles/batch-delete` | LM | `dashboard.auth` (now admin) |
| `ai_tools/translation/queue/list`, `pending-words`, `history` | mcp, WN admin, LM | public reads (unchanged) |
| `ai_tools/translation/queue/enqueue-pending`, `priority`, `stack` | mcp (`WorkerApiClient`), WN admin, UI-core | `client.key_or_dashboard` |
| `ai_tools/translation/queue/submit-bing` | mcp (Bing assist) | `client.key` |
| `ai_tools/task/enqueue` | none found (chrome Task Center) | `client.key_or_dashboard` |
| Sanctum groups (`translation/queue/batch/*`, `translation/*`, `tts/queue/*`, `article/submit|preview|backfill-library`) | WN, FL | `auth:sanctum` (unchanged) |

## routes/AppQyV1Router/AppQyV1Assist.php

| Route | Callers | New auth |
|---|---|---|
| `assist/claim`, `submit`, `release`, `requests/claim`, `requests/submit`, `requests/release` | mcp (`media-image-worker-service`), pycore workers | `client.key` |
| `assist/cover/retry`, `poster/priority`, `cover/clear`, `cover/reconcile`, `POST requests`, `DELETE requests/{id}` | LM, UI-core, pycore (`corebook/engine.py` files requests) | `client.key_or_dashboard` |
| `assist/status`, `pending`, `overview`, `overview/items`, `GET requests` | LM, UI-core, `scripts/.../pyservice_entry.sh` | public reads (unchanged) |

## routes/AppQyV1Router/AppQyV1OrchAudio.php, AppQyV1Delivery.php, AppQyV1StudyGen.php

| Route | Callers | New auth |
|---|---|---|
| `app_qy_v1/orch_audio/ingest/tasks`, `ingest/segment-audio` | pycore (`orch_delivery.py`) | `client.key` |
| `app_qy_v1/delivery/info`, `diff`, `batch`, `batch/{id}/content`, `batch/{id}` | pycore (`delivery_diff.py`) | `client.key` |
| `app_qy_v1/study-gen/claim`, `submit`, `release` | mcp (`api-paths` study-gen) | `client.key` |
| `app_qy_v1/study-gen/sources`, `status`, `segment-content` | mcp, UIs | public reads (unchanged) |
| `app_qy_v1/orch_audio/tasks*` | WN (Sanctum) | `auth:sanctum` (unchanged) |

## routes/AppQyV1Router/AppQyV1Vocabulary.php, AppQyV1Words.php

| Route | Callers | New auth |
|---|---|---|
| `vocabulary/libraries/{id}/cover/ai-regenerate` | none found (LM button) | `dashboard.auth` (admin), prompt `max` validation; queues a `library_cover` generate task and answers 202 with it (LB-007) |
| `POST vocabulary/libraries/cover/tasks` | LM, UI-core contract | `client.key_or_dashboard`, prompt `max` validation |
| `vocabulary/validity/report` | mcp, LM, UI-core | `client.key_or_dashboard` |
| `dictionary/words` POST/PUT/DELETE, `dictionary/words/batch`, `dictionary/invalid-words/purge`, `dictionary/invalid-translations/purge` | LM (`WordsManagerPanel`, `BooksAPI`), WN admin, UI-core | `dashboard.auth` (admin) |
| `word/audio/upload`, `word/fix-text` | pycore (`word_audio_service.py`) | `client.key` |
| every other vocabulary/dictionary/word GET (statistics, libraries, validity/pending, `word/audio/missing-batch`, media/audio resolve) and `word/audio/head` | UIs, FL, pycore, mcp | public (unchanged) |

## routes/CodeMartV1Router/api.php, routes/DingDuoDuoV1Router/DingDuoDuoV1Admin.php

| Route | Callers | New auth |
|---|---|---|
| `codemart/v1/admin/escrows/{escrowId}/refund` (new, LB-008 ruling) | codemart admin | existing admin group + `AuthHelper::requireAdmin` (same as the other `admin/*` finance actions) |
| `ding_duo_duo_v1/admin/*` | none found (pdd-manager unassigned) | `custom.authenticate` + `dashboard.auth` (admin) (LB-035) |
| other CodeMart and DingDuoDuo routes | codemart, DingDuoDuo extension | unchanged |

## routes/RelayRouter/RelayApi.php

| Route | Callers | New auth |
|---|---|---|
| relay device routes (Ed25519) | pycore | unchanged. `device-enrollments` create: when the request also carries a valid K3 signature, it is claimed for the public fleet owner immediately (no web-login claim step); the response keeps `claim_code` and adds `credential` |
| relay owner routes | UIs | unchanged |

## Signer notes for machine teams (pycore, ncore, mcp-chrome)

- Sign `X-Core-Node-Client` with your contract client name, `X-Core-Node-Protocol: 2`, and the headers in `client_key_auth.headers`.
- The path is the request path as sent (`/api/...`), canonicalized per the relay profile. The query is the raw query as sent (repeated keys allowed), canonicalized.
- `multipart/form-data` sends `X-Core-Node-Content-SHA256: UNSIGNED-PAYLOAD`. Every other body signs the sha256 of the exact bytes sent, including `""` for GET.
- A route marked `client.key_or_dashboard` accepts either; a machine should always sign.
