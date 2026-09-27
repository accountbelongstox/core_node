# laravel-manager report — client key auth and audit fixes (2026-09-27)

Scope: `poly_apps/pycore_laravel_wordnew_ui/apps/laravel-manager/` plus temporary shared-layer writer rights (requirements §6): `core/integrations/laravel/transport/BaseAPI.ts`; for laravel-manager-7 also `core/contracts/ServiceContract.ts`, `vite.config.ts`, `core/contracts/QueueCenterContract.ts`, `core/network/RequestCoordinator.ts`.
Paths below are relative to `poly_apps/pycore_laravel_wordnew_ui/`. Task ids follow the team convention `laravel-manager-<n>` (no TaskCreate tool in this build); the orchestrator mirrors them in `client_key_auth/TASKS.md`.

## Tasks

| Task id | Subject | Findings | Status |
|---|---|---|---|
| laravel-manager-1 | [laravel-manager] BaseAPI retry and GET coalescing | FU-003, FU-002 | approved |
| laravel-manager-2 | [laravel-manager] Long operator writes and Octane reconnect | FU-030 (client), FU-039 | approved |
| laravel-manager-3 | [laravel-manager] Data Sync state and node resolution | FU-005, FU-006, FU-012 (+ FU-025/FU-026 Data Sync parts) | approved |
| laravel-manager-4 | [laravel-manager] Stale guards | FU-016, FU-035 | approved |
| laravel-manager-5 | [laravel-manager] i18n | FU-024 (lm), FU-042 (lm) | approved |
| laravel-manager-6 | [laravel-manager] Adapt to the laravel route table (401/403 i18n, guards, dead assist wrappers) | K6, requirements §5 | approved |
| laravel-manager-7 | [laravel-manager] Shared contract adapters: data dir, loopback hosts, removed contract keys, coordinator ttl 0 | contract cleanup, K7a, FU-002 note | approved |
| laravel-manager-8 | [laravel-manager] FU-025/FU-026 laravel-manager remainders (+ type errors in touched files) | FU-025 (lm), FU-026 (lm) | approved |
| laravel-manager-9 | [laravel-manager] FU-027 BaseAPI part: no implicit endpoint persistence | FU-027 | approved |
| laravel-manager-10 | [laravel-manager] Adapt to laravel's FU-030 server changes (toggle-autostart target state, restore/backup idempotency) | FU-030 (server follow-up) | approved |
| laravel-manager-11 | [laravel-manager] Remaining laravel-manager type errors, root causes first (B9) | tsc 36 → 0 | approved |
| laravel-manager-12 | [laravel-manager] LaravelRealtime payload map keyed by symbolic event names (B9) | shared typing root cause | approved |

## Findings

- FU-003 fixed. `BaseAPI.send` retries a transient failure only for GET/HEAD or when the resolved headers carry a non-empty `Idempotency-Key` (`IDEMPOTENCY_KEY_HEADER`, exported). Retries recurse inside `send`, so a coalesced GET now gets the full retry count (it used to start at 1).
- FU-002 fixed. GET coalescing TTL is `GET_COALESCE_TTL_MS = 0` (in-flight dedupe only), so no settled response, success or failure, is reused. Every settled write (`request` non-GET, `rawRequest` non-GET/HEAD, `uploadWithProgress`) bumps a read generation that is part of the coalescing key (later GETs never join a pre-write flight) and calls `clearCoordinatedRequests()`. The key uses the module's resolved Authorization header, so fixed peer modules with their own token do not share flights with the shared session.
  - Reliance check per app: codemart `CmApi` already cleared on writes (its override is now redundant but harmless); `CmPublicApi` public GETs use the explicit `apiCache` (unchanged, success-only). laravel-manager `SystemConfigAPI` keeps its own 60 s api_info cache; AppQyV1 explicit caches are unchanged. wordnew `WfNewApiTransport` and `LaravelRequest` use the coordinator with their own TTLs; a BaseAPI write now also clears those short-lived entries (only a refetch). pdd-manager and core modules only lose the 5 s reuse of settled GETs. No caller depends on a settled response being reused.
- FU-030 fixed (client side). `DatabaseManagerAPI.longOperation` sends backup create, restore and table import once (`retry:false`) with a 15 min timeout. `ServerManagerAPI.serviceControl` sends service start/stop/restart/toggle-autostart once with a 3 min timeout (service name now URL-encoded). The server-side restore lock is laravel's (Cross-scope).
- FU-039 fixed. The Octane reconnect loop is tied to the component (disposed ref plus a cleared timer), stops after 3 min with an i18n toast, and never reloads after the view is left. Octane texts moved to `server.octane.*` (en/zh).
- FU-005 fixed. `DataSyncTab` splits `nodeError` (owned by the poll) from `actionError` (cleared by the next user action). Poll ordering: a poll applies only if it started after the last applied poll and after the last local session update, so a cancelled session no longer flips back to running from an in-flight poll, and a slow node cannot starve updates.
- FU-006 fixed. `resolveNewServer` matches registry nodes by normalized `scheme://host:port`; a bare host (no scheme, no port) matches only when exactly one registry node uses that host; otherwise an ad-hoc node is created. IPv6 double bracketing in `normalizeAdhocAddress` fixed.
- FU-012 fixed. The client cache is keyed by id + base URL; the auth header and the 401 handler read "current" per request (`apiManager.getCurrentEndpoint()`).
- FU-026 (Data Sync part) fixed: `DATA_SYNC_DEFAULT_PORT` removed, `LARAVEL_API_BACKEND_PORT` from `core/contracts/ServiceContract` is used.
- FU-025 (DataSyncModel part) fixed: the LAN probe literal is now the code `DATA_SYNC_LAN_PULL_ONLY` (it is never rendered).
- FU-016 fixed. `VocabularyLearning.loadLibraries` has a request sequence ref; the duplicate mount load is removed (the language effect runs on mount).
- FU-035 fixed. `getStructure`/`getData` reject on failure instead of returning empty results; `TablesTab` resets structure and rows on table change, catches both loads and shows `db_manager.viewer.*` errors.
- FU-024 (lm) fixed. Added `common.cancel`, `common.login`, `common.network_error` (VoiceSubtitleManager used the undefined `messages.networkError`), `common.retry`, `common.refresh`, `mediaHub.loginRequired` (MediaHub no longer passes English `defaultValue`s); zh gained `nav.tools_dashboard.*` (15), `nav.aiTools`, `server.messages.failed_to_load`, `libraryCover.attempts_one`. `LmTranslations.ts` types zh as `LmTranslationDict` (the en key tree with string leaves), so a missing zh key is a compile error. Key checker: en 1557 = zh 1557, no undefined literal keys.
- FU-042 (lm) fixed. `DatabaseManager.tsx`: every UI literal moved to `db_manager.*` keys (status strip, schema/data grid, pagination, tables list, viewer, import/export, backup, credentials, root view); sentences with bold parts use `Trans` with named `<strong>`/`<mono>` components. `DatabaseManagerAPI` no longer throws English fallbacks: it throws `DatabaseManagerApiError(serverMessage, status)` (DataSyncApiError now extends it) and the UI supplies the localized fallback; downloads show `download_failed_status` with the HTTP code. `ServerManager.tsx`: Octane texts (`server.octane.*`), every `|| 'English'` fallback removed, remaining literals moved to `server.messages.*`, `server.executor.*`, `server.unified.*`; `messages` is now typed (removes the 25 pre-existing `{}` diagnostics). Left as-is on purpose: technical tokens (CSV/JSON, PRI, null, pg_dump, the `[certbot] <command>` console echo) and English log-store lines (AGENTS: logs in English).

- Route table (laravel-manager-6):
  - Token: every LM request goes through BaseAPI `request`/`rawRequest`/`uploadWithProgress`, which attach the logged-in bearer (no raw fetch/XHR/EventSource in LM). The UI never holds the client key (K6).
  - 401/403: `api/LmBaseAPI.ts` (all 18 LM module classes and `api.http` extend it) maps 401 → `auth.login_hint` and 403 `code: AUTH_FORBIDDEN` → `auth.admin_required`; failures with an `error_code` keep their own mapping (login errors use 422 + codes).
  - AI Management (`local/ai/*` now admin) and Task Center (task/worker/queue reads need the operator login) are in `REQUIRE_LOGIN_VIEWS` and wrapped by `AuthGuard`.
  - Dead `claimAssistRequests`/`submitAssistRequest`/`releaseAssistRequests` (`assist/requests/*`, now `client.key` only, no callers) deleted; stale "no-auth" comments corrected.
  - `toggle-autostart` explicit target: done in laravel-manager-10.
- Shared contract adapters (laravel-manager-7):
  - `core/contracts/ServiceContract.ts`: the dead `CORE_NODE_DATA_DIR_POSIX` / `CORE_NODE_DATA_DIR_WINDOWS_SUBPATH` exports (keys removed by 0fc8abe2d) replaced by `CORE_NODE_DATA_DIR_NAME` (`paths.core_node_data_dir_name`); new `LOCAL_RPC_LOOPBACK_HOSTS` = `client_key_auth.local_rpc.loopback_hosts` mapped through `hosts` → `['localhost', '127.0.0.1', '::1']` (pycore-manager told).
  - `vite.config.ts`: the data dir mirrors the shared rule (pycore `core_node_dirs`, ncore `system_paths.js`, `runtime_environment.sh`, `PathMapper::getCoreNodeRuntimeDir`): `CORE_NODE_DATA_DIR` wins; Windows `D:\www\core_node`; Linux `/www/www/core_node` when `/www` is an NTFS mount on a different device than `/` (read from `/proc/mounts`), else `/www/core_node`; then the first existing of that, `/var/_core_node`, `~/core_node` (read-only resolution, no mkdir). Never `undefined`. On this host it resolves `/www/www/core_node`, where `global_var/web_access_config.json` exists.
  - `core/contracts/QueueCenterContract.ts`: `relay.device_identity` type and the `'history_timeline'` limits key removed (both keys are gone from `config/queue_center_contract.json`, no readers); `'history_records'` kept.
  - `core/network/RequestCoordinator.ts`: settled values are stored only when `ttlMs > 0` (reviewer note on laravel-manager-1).
- FU-025/FU-026 remainders (laravel-manager-8):
  - `components/vocabulary/tabs/LibrariesTab.tsx`: Filters, Language, the language names (reuse `vocabulary.words_manager.languages.*`), Refresh, Vocabulary Libraries, word count (plural), Recommended, Category, empty message → `vocabulary.libraries.*` / `common.refresh`; the header shows the translated language.
  - `components/views/VocabularyLearning.tsx`: mock "Daily Vocabulary - Day 1" tasks removed (no learning-task backend exists; the panel shows its empty state). `components/vocabulary/tabs/LearningTasksPanel.tsx` literals → `vocabulary.tasks_panel.*` (its `t` prop removed).
  - `components/HtmlErrorModal.tsx`: local `formatBytes` copy removed, `core/utils/formatBytes` imported.
  - Type errors in touched files fixed: `LmDashboard.tsx` passed `lang` to the prop-less `UnifiedToolsPage`; `VocabularyStatisticsWordRow.id` widened to `number | string` (the dictionary rows carry either). Runtime bug fixed on the way: `components/views/media/FileTreeParts.tsx` rendered `Loader2` without importing it (ReferenceError while the delete dialog computes its impact).
  - `apps/laravel-manager` type check: 67 diagnostics before this work, 36 now, all pre-existing in files not otherwise touched: Settings.tsx 15 (ServerConfig fields, `settings.messages`), mcp/VoiceTab.tsx 6, task-center/QueuePanel.tsx 4, NginxSiteModal.tsx 2, mcp/ScreenshotsTab.tsx 2, TaskCenter.tsx 2 (panels miss `autoRefresh`/`refreshIntervalSec`/`refreshToken` props), media/FileTreePanel.tsx 1, media/FileViewer.tsx 1, media/ViewerErrorBoundary.tsx 1, task-center/SchedulerPanel.tsx 1, VocabularyLibraryDetail.tsx 1.
- Type errors, root causes (laravel-manager-11), `apps/laravel-manager` 36 → 0 diagnostics:
  - Task Center auto/manual refresh was dead for two tabs: `AssistRequestsPanel` and `AssistDistributionPanel` still expected `autoRefresh`/`refreshIntervalSec`/`refreshToken` props that `TaskCenter` stopped passing when refresh moved into `TaskCenterState`. `TaskCenterState` now carries `refreshToken` (bumped by `refreshNow`); both panels read the shared state; `QueuePanel` passes the real token to `MissingSentenceAudioPanel` (was a constant 0, so manual refresh never reloaded it).
  - `QueuePanel` type-filter chips rendered the contract's emoji icon as a React element type (`<Icon/>` with `'🔤'` → `document.createElement` throws, crashing the Queue tab) and used the badge label as CSS classes; now an emoji span plus the colour style `TaskTypeBadge` uses. Event `detail` (Laravel casts it to an array) is shown only when non-empty. The queue-changed handler narrows with `'resource_id' in event` because the shared `LaravelRealtime` payload map collapses to a union (contract event names are typed `string`); root cause reported to the orchestrator.
  - `SchedulerPanel` detail modal: `Portal id=` (no such prop) and `${OVERLAY_Z}` (an object → `[object Object]`, so no z-index) → `OVERLAY_CONTAINER` + `OVERLAY_Z.modal` like the other panels.
  - `Settings.tsx`: `ServerConfig` (SystemConfigAPI) now matches `SystemConfigController::getConfig` (cache, session, queue, mail, filesystems, logging); the dead English fallback objects for `t`/`tp` removed; the reset confirm uses the new `settings.confirm_reset` (the unused `server.messages.confirm_reset` removed).
  - mcp: `Screenshot` gains `size`/`keywords` (ScreenshotService writes them); `VoiceQueueItem` gains `group`/`category`/`play_count` and the server's type set; `vsAddToQueue` takes the fields `VoiceSubtitleV1MainController::addToQueue` reads (the ignored `auto_play` is no longer sent).
  - `NginxSiteModal`: `NginxSiteCreateRequest.site_type` drops `'swoole'` (the config builder rejects it); editing maps the listing vocabulary onto the form (`nuxt` → `proxy`, `fpm` → `php-fpm`).
  - media: `BentoCard` has no `icon` prop, so the never-rendered `icon` props (and their imports) are removed; `ViewerErrorBoundary` drops `declare props`/`declare setState` that conflicted with React's types. `VocabularyLibraryDetail` `WordRow` typed as react-window's row component (`ReactElement | null`).
- FU-030 server follow-up (laravel-manager-10):
  - `core/integrations/laravel/transport/BaseAPI.ts`: exported `createIdempotencyKey()` next to `IDEMPOTENCY_KEY_HEADER`.
  - `api/LmBaseAPI.ts`: `requestIdempotent(action, config)` sends one Idempotency-Key per user action and keeps it while the outcome is unknown (network failure, 5xx, 409 `IDEMPOTENCY_IN_PROGRESS`), so the operator's retry replays the stored result or joins the running one; any other answer ends the action. 409 `IDEMPOTENCY_IN_PROGRESS` → `common.still_running` (en/zh).
  - `DatabaseManagerAPI`: backup (`backup:<connection>`) and restore (`restore:<id>`) use it (still one transport attempt, 15 min). The per-connection lock's 409 carries the server's localized `db_manager.connection_busy` text and is shown as is.
  - `ServerManagerAPI`: service start/stop/restart/autostart use it; `toggleAutoStart(name)` → `setAutoStart(name, enabled)` sending `{ enabled }` (the route now requires the target state; no UI caller).
- LaravelRealtime typing (laravel-manager-12): `core/integrations/laravel/LaravelRealtime.ts` keeps the wire names (contract-resolved) in a private map; `LARAVEL_REALTIME_EVENTS` now maps each symbolic name to itself, `LaravelRealtimeEventName` is the symbolic key and `LaravelRealtimeEventPayloadMap` is keyed by it, so every `subscribe()` handler gets its own payload type. Incoming SSE, hub-envelope and replay events are resolved wire → symbolic. Call sites are unchanged (laravel-manager TaskCenterState/QueuePanel, wordnew WordNewDailyReadingSection/WordNewQueueRuntime; pycore-manager and codemart do not subscribe). QueuePanel's `'resource_id' in event` narrowing removed. Whole UI (`apps`, `core`, `shell`, `shared`) type-checks with 0 diagnostics.
- FU-027 (BaseAPI part, requested by pycore-manager): `setSharedBaseURL` no longer calls `persistSharedBaseURL`; only `ApiManager.switchEndpoint` persists after a verified user switch.
- Found during the type check (not in the audit): `AppQyV1.ts` used `normalizeTranslationLanguages`/`TranslationLanguageCatalog` without importing them from `AppQyV1Types.ts` (runtime ReferenceError, masked by `loadLanguages`' catch, so the language list always fell back to defaults). Exported and imported; the unused broken `GlobalQueuePositionTaskAlias` import in `AppQyV1Types.ts` removed.

## Changed files

- `core/integrations/laravel/transport/BaseAPI.ts`
- `apps/laravel-manager/api/modules/DatabaseManagerAPI.ts`
- `apps/laravel-manager/api/modules/ServerManagerAPI.ts`
- `apps/laravel-manager/components/views/ServerManager.tsx`
- `apps/laravel-manager/components/views/DatabaseManager.tsx`
- `apps/laravel-manager/components/views/database-manager/DataSyncTab.tsx`
- `apps/laravel-manager/components/views/VocabularyLearning.tsx`
- `apps/laravel-manager/models/DataSyncModel.ts`
- `apps/laravel-manager/locales/LmEnOperations.ts`, `apps/laravel-manager/locales/LmZhOperations.ts`, `apps/laravel-manager/locales/LmEnCore.ts`, `apps/laravel-manager/locales/LmZhCore.ts`, `apps/laravel-manager/locales/LmTranslations.ts`
- `apps/laravel-manager/components/views/MediaHub.tsx`, `apps/laravel-manager/components/voice-subtitle/VoiceSubtitleManager.tsx`
- `apps/laravel-manager/api/LmBaseAPI.ts` (new), `apps/laravel-manager/api/LaravelManagerApi.ts`, every `apps/laravel-manager/api/modules/*API.ts` that extended BaseAPI, `apps/laravel-manager/api/modules/AppQyV1Types.ts`
- `apps/laravel-manager/config/auth.ts`, `apps/laravel-manager/LmDashboard.tsx`
- `apps/laravel-manager/components/vocabulary/tabs/LibrariesTab.tsx`, `apps/laravel-manager/components/vocabulary/tabs/LearningTasksPanel.tsx`, `apps/laravel-manager/components/HtmlErrorModal.tsx`, `apps/laravel-manager/components/views/media/FileTreeParts.tsx`, `apps/laravel-manager/uiTypesCommon.ts`
- Shared (laravel-manager-7): `core/contracts/ServiceContract.ts`, `vite.config.ts`, `core/contracts/QueueCenterContract.ts`, `core/network/RequestCoordinator.ts`

## Static checks

- In-memory TypeScript type check (compiler API, `noEmit`, nothing written) over every changed file: no new diagnostics. The only remaining diagnostic in a changed file is pre-existing: `VocabularyLearning.tsx:491` word-row id type. A whole-app pass over `apps/laravel-manager` shows only pre-existing diagnostics in files I did not change (AppQyV1, Settings, TaskCenter, mcp/*, media/*, task-center/*).
- Scratchpad key checker (TypeScript transpile in memory): en/zh parity and every literal `t('…')` key defined.

## Blockers

- None. All tasks laravel-manager-1..12 are approved.

## Former blockers

- laravel-manager-6 waits for `.claude/agents_shared/client_key_auth/laravel_route_auth.md`.

## Cross-scope / next owner

- Next writer of `core/network/api-client/MasterApiClient.ts` / `RequestQueue.ts` (wordnew): mint Idempotency-Keys with `BaseAPI.createIdempotencyKey()` instead of `RequestQueue.generateEntryId` (reviewer note on laravel-manager-12).
- Orchestrator (D5/D7): move the data-root literals (`D:\www`, `/www`, `/www/www`, `/var/_core_node`) into `service_contract.json` paths (reviewer note on laravel-manager-7).

- laravel: DB backup restore/create should refuse concurrent runs and be idempotent per request (FU-030 server side); `services/{name}/toggle-autostart` should take an explicit target state (the caller will adapt).
- codemart (via lead): `CmApi.request` override that calls `clearCoordinatedRequests()` is now redundant; `IDEMPOTENCY_KEY_HEADER` is exported from `BaseAPI` for reuse instead of the local `IDEMPOTENCY_HEADER`.
