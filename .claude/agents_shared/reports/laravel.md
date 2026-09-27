# laravel report (client key auth and audit fixes, 2026-09-27)

Task ids follow the team convention `laravel-<n>`; the orchestrator mirrors them in `.claude/agents_shared/client_key_auth/TASKS.md`.

## Tasks

| Task | Subject | Findings | Status |
|---|---|---|---|
| laravel-T1 | [laravel] Client key verifier, middleware and route table | LB-001, LB-002, LB-003, LB-005, LB-006, LB-007, LB-015, LB-028, LB-032, RV-003 | approved (reviews/laravel-T1.json); follow-up: verifier now loads only `CORE_NODE_CLIENT_KEY_1..5`, not the bare base name (reviewer note 1) |
| laravel-T2 | [laravel] Money and escrow | LB-004, LB-008, LB-009, LB-019, LB-020, LB-024, LB-025 | approved after one change round (reviews/laravel-T2.json): DingDuoDuo admin group now also `dashboard.auth`; budget-missing code is `CodeMartV1Constants::ESCROW_ERROR_TASK_BUDGET_MISSING` |
| laravel-T3 | [laravel] Data sync | LB-010, LB-016, LB-017, LB-018, LB-021, LB-022, LB-023 | approved (reviews/laravel-T3.json); follow-ups: artifact builds run in the background lane (DataSyncTask, T4); a recorded archive mismatch is cleared when the archive restarts at offset 0 |
| laravel-T4 | [laravel] Timer, queues, uploads, contracts | LB-011..LB-014, LB-026, LB-027, LB-029..LB-031, LB-033, RV-001, RV-002, RV-004, RV-007, RV-011, X4 | approved (reviews/laravel-T4.json); LB-033 and X4 deferred for rulings |
| laravel-T5 | [laravel] UI cross-scope server support | FU-030 (restore/backup lock, idempotency), toggle-autostart target state, FU-031 (client request id) | approved (reviews/laravel-T5.json); follow-up: only 2xx and deterministic 4xx (400/404/410/422) are stored for replay |
| laravel-T6 | [laravel] i18n sweep | LB-034 | approved (reviews/laravel-T6.json) |
| laravel-T7 | [laravel] CodeMart contract follow-ups and DingDuoDuo admin gate | LB-008 (admin escrow refund), LB-019 (optional phone step), LB-020 (bootstrap deposit methods), LB-035 | approved (reviews/laravel-T7.json) |
| laravel-T8 | [laravel] Client-key verifier follow-ups | LB-015/LB-032 follow-ups: indexed key names only, full request path incl. base path | approved (reviews/laravel-T8.json) |
| laravel-T9 | [laravel] Rulings on T4 deferrals and remainders | LB-033, X4 (field names), RV-007 (resource keys), RV-004, LB-007 (queue-only regenerate) | approved (reviews/laravel-T9.json) |
| laravel-T10 | [laravel] DingDuoDuo super code v2 minting (Laravel half) | NC-008 | submitted to reviewer |
| laravel-T11 | [laravel] D1 regression: `public/home` 500, escrow columns missing on existing tables | requirements §10.4 | fixed locally; submitted to reviewer; server steps for laravel-remote below |

## laravel-T1

Route table: `.claude/agents_shared/client_key_auth/laravel_route_auth.md` (published, all roles notified).

| Finding | State | Note |
|---|---|---|
| LB-001 | fixed | every sync-peer route except `/health` takes `client.key`; `DataSyncPeerClient` signs each attempt as `laravel_peer` in `beforeSending` (a retry gets a fresh nonce) |
| LB-002 | fixed | `dashboard.auth` = admin by default, `:super_admin` for import/restore/sync fetch/credentials writes, `:user` for self-service; web.php self-service actions allow-listed; `DASHBOARD_LOCAL_DEBUG` defaults off on production hosts |
| LB-003 | fixed | `local/ai/*` behind `dashboard.auth` (only laravel-manager calls it) |
| LB-005 | fixed | worker/task/task-center/queue-center/media gated per table |
| LB-006 | fixed | AppQyV1 worker, queue, TTS, LLM test, assist, study-gen, orch, delivery routes gated per table |
| LB-007 | fixed | ai-regenerate admin-only with prompt `max`; cover task enqueue `client.key_or_dashboard` (already validated prompt) |
| LB-015 | fixed | `PycoreClientOnly` + `RelayDeviceIdentity` removed; one verifier `ClientKeyAuthService`; no trust-on-first-use claim, no register path |
| LB-028 | fixed | session routes gated, `max:` rules, 24 h TTL |
| LB-032 | fixed | K3 signs the raw query through `RelayContract::canonicalRawQuery` |
| RV-003 | fixed | overview and mercure-authorization take `client.key_or_dashboard` |

Relay v2: an enrollment create that also carries a valid K3 signature is claimed at once for the public fleet owner (`RelayEnrollmentService::approveWithClientKey`); the response keeps `claim_code`.

Changed files (all under `poly_apps/laravel_main/`):
- new: `app/Services/ClientKey/ClientKeyAuthService.php`, `app/Http/Middleware/ClientKeyOnly.php`, `app/Http/Middleware/ClientKeyOrDashboard.php`, `lang/{en,zh_CN}/client_key.php`, `lang/{en,zh_CN}/dashboard_auth.php`
- removed: `app/Http/Middleware/PycoreClientOnly.php`, `app/Services/Relay/RelayDeviceIdentity.php`
- edited: `bootstrap/app.php`, `app/Http/Middleware/LocalDebugOrSanctum.php`, `app/Services/Dashboard/DebugAuthService.php`, `app/Services/DataSync/DataSyncPeerClient.php`, `app/Apps/Relay/RelayControllers/RelayDeviceCtl.php`, `app/Apps/Relay/RelayServices/RelayEnrollmentService.php`, `app/Http/System/TokenSessionController.php`, `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`, `lang/{en,zh_CN}/relay.php` (dead keys removed), `routes/api.php`, `routes/api/{ai_local,auth,system}.php`, `routes/DashboardRouter/DatabaseManager.php`, `routes/AppQyV1Router/{AppQyV1AITools,AppQyV1Assist,AppQyV1OrchAudio,AppQyV1Delivery,AppQyV1StudyGen,AppQyV1Vocabulary,AppQyV1Words}.php`

Checks: `php -l` on every changed file; the three `test_vectors.json` signatures reproduced; an in-process verify round trip (test key injected in memory, array cache) gave valid / replayed / tampered query / tampered body / multipart / stale timestamp as expected; `php artisan route:list --json` confirmed the middleware per route.

## laravel-T2

| Finding | State | Note |
|---|---|---|
| LB-004 | fixed | callback accepted only with a gateway HMAC-SHA256 `sign` (sorted non-empty params, configured `api_secret`) plus matching `amount`, or from a Sanctum admin; pending->paid compare-and-set and the membership extension run in one transaction with the member row locked |
| LB-008 | fixed (service); admin action deferred | project cancel/complete refunds every held funding escrow remainder to the payer wallet (`CodeMartV1EscrowService::refundRemainderForProject`, idempotent); the admin escrow-refund endpoint is a new endpoint, sent to the orchestrator first |
| LB-009 | fixed | approval whose escrow release fails throws inside the transaction (task stays in review); a zero-budget task still approves; task budgets are reserved against the funded escrow on create/update (`assertBudgetHeadroom`, error `escrow_insufficient`) |
| LB-019 | partly fixed | OTP no longer logged; without an SMS provider the request answers 503 `codemart.errors.sms_unavailable`; `email_verified` comes from `email_verified_at` only. Making the phone step optional is a contract decision, sent to the orchestrator |
| LB-020 | fixed | deposits offer only `bank_transfer`; the placeholder Alipay/WeChat URLs are gone |
| LB-024 | fixed | budget change detection uses `bccomp` on money values |
| LB-025 | fixed | one live invoice per payment under the payment row lock (a repeat returns the existing one, 200); number `INV-Ymd-<ULID>` |

Changed files (under `poly_apps/laravel_main/`): `app/Apps/DingDuoDuoV1/DingDuoDuoV1Controllers/DingDuoDuoV1Public/DingDuoDuoV1RechargeController.php`, `app/Apps/DingDuoDuoV1/DingDuoDuoV1Constants/DingDuoDuoV1ErrorCodes.php`, `app/Apps/CodeMartV1/CodeMartV1Services/{CodeMartV1EscrowService,CodeMartV1ProjectStateService,CodeMartV1BootstrapService}.php`, `app/Apps/CodeMartV1/CodeMartV1Ctl/{CodeMartV1TaskCtl,CodeMartV1DepositCtl,CodeMartV1PaymentCtl,CodeMartV1RegistrationCtl}.php`, `app/Apps/CodeMartV1/CodeMartV1Gvar/CodeMartV1Constants.php`, `app/Apps/CodeMartV1/CodeMartV1Utils/CodeMartV1OtpService.php`, `lang/{en,zh_CN}/codemart.php`.

Checks: `php -l` on every changed file.

The DingDuoDuo admin group (`routes/DingDuoDuoV1Router/DingDuoDuoV1Admin.php`) guarded member expiry/tier, the recharge config (gateway secret) and bindings with `custom.authenticate` only; it now also takes `dashboard.auth` (admin), which the reviewer made blocking for LB-004.

## laravel-T3

| Finding | State | Note |
|---|---|---|
| LB-010 | fixed | receiver stores the final archive chunk and reports `extracting`; its timer tick verifies and extracts (`ResourceSyncService::completeArchive`) and writes a receipt keyed by key + sha256; a replayed final chunk answers `complete:true` from the receipt; a timer-side hash mismatch is answered as `hash_mismatch` on the next chunk. The driver needs no change (it re-sends the empty final chunk until complete) |
| LB-016 | fixed | a file deleted after the manifest yields a per-file `missing` marker (batch and chunk reads); the driver skips it in push and pull modes |
| LB-017 | fixed | passive nodes publish `resource_roots` in their status; the driver syncs the intersection and records one-sided roots in `resource_results.skipped_roots` |
| LB-018 | fixed | fresh manifests and exact row counts are built by the passive timer (served when built after the latest received payload, 503 until then); export archives are built by the exporter timer (503 until ready) |
| LB-021 | fixed | `writeFileAtomic` staging adds random bytes and cleans up on failure; the copied temp+rename helpers in six AiGateway stores, `AppQyV1DailySentenceService` and `DeveloperHistoryService` now call it |
| LB-022 | fixed | superseding an idle passive session goes through `requestCancel` + `tryLock` (busy 503 when the lock is held) |
| LB-023 | fixed | keyset pagination (`cursor` = last identity values) for tables with a NOT NULL, selected identity; OFFSET stays the fallback |

Changed files (under `poly_apps/laravel_main/`): `app/Services/DataSync/{ResourceSyncService,DataSyncPassiveService,DataSyncDriverService,DataSyncStateStore,DatabaseSyncService}.php`, `app/Http/Controllers/Dashboard/DataSyncController.php`, `app/Utils/FileSystemManager.php`, `app/Services/AiGateway/{AiPromptCache,AiKeyRotation,AiImageHistory,AiGateway,AiRateLimiter,AiUsageLog}.php`, `app/Apps/AppQyV1/AppQyV1Services/AppQyV1DailySentenceService.php`, `app/Services/DeveloperHistory/DeveloperHistoryService.php`.

Checks: `php -l` on every changed file.

## laravel-T4

| Finding | State | Note |
|---|---|---|
| LB-011 | fixed | `tick()` now checkpoints its lane's task state into the heartbeat file (merged under LOCK_EX, per lane); a new `schedule:run` process seeds `last_run` from it, so long intervals survive the per-minute restart |
| LB-012 | fixed | EXECUTION_BACKGROUND is implemented: on non-Swoole runtimes the heartbeat skips those tasks and `octane-timer:background` (routes/console.php, scheduled every minute with `runInBackground` + `withoutOverlapping(5)`) runs them on its own one-second loop. Background lane: agent-history audio write-back, library cover fallback, cover generation, poster collection, CodeMart AI analysis, DataSync, developer history, SSL renew, static-resource warm, resource-index reconcile, offset spool sweep |
| LB-013 | fixed | batched dict lanes exclude the words carried by live claim tasks (database payloads) and materialize one lane+language at a time under a shared cache lock; statics are only a local hint |
| LB-014 | fixed | word and sentence TTS controllers drop the spool once the report is stored; a complete spool that fails the whole-file hash is deleted (retry restarts at 0); `AppQyV1OffsetSpoolSweepTask` removes spools idle for a day |
| LB-026 | fixed | orch-audio detail resolves word audio passively in one dictionary query per language (`AppQyV1WordAudioGateway::resolvePassiveBatch`). `requestWordBatch` was not reused because it enqueues and moves words to the head |
| LB-027 | fixed | batch ingest takes sorted transaction-scoped advisory locks on its task keys before the read-then-write |
| LB-029 | fixed | the sorted (library, word, index) pair index is cached per language, keyed by the public libraries' ids + updated_at (5 min TTL); a page request slices it |
| LB-030 | fixed | `UserConfigService::set` serializes on a sidecar lock file and writes through `FileSystemManager::writeFileAtomic` (temp + rename), so readers never see a truncated file |
| LB-031 | fixed | completed rows are no longer claim candidates; the route stays for the laravel-manager counts-only summary |
| LB-033 | deferred | re-read: the cleanup now keys on `Test-ProcessOwnedByDirectory`, and the unattended `--service` run never stops another project's lanes (in-flight change after the audit). The interactive run still stops unowned worker lanes on purpose: an orphaned lane launched as a relative `php artisan` has no owner evidence on Windows (Win32_Process has no cwd). Narrowing it would leave this project's orphans running; needs a ruling (shell/user) |
| RV-001 | fixed (Laravel side) | device events get a server-assigned monotonic outbox revision per (pairing, event type) under an advisory lock, with a time floor; a retry with the same metadata as the latest entry is a no-op, so the LogicException/500 path is gone |
| RV-002 | fixed (Laravel side) | page-data accepts the same queue set as the lane diff (every contract task type, e.g. article_audio) |
| RV-004 | fixed (Laravel side) | the unused `QueueCenterContract::taskStreamEvent` adapter is removed; no Laravel route or caller existed. The contract block (orchestrator) and the mcp-chrome SSE consumer (mcp-chrome) remain |
| RV-007 | partly fixed | event names and the topic come from the contract (`QueueCenterContract::realtimeEvent/realtimeTopic`) in the assist, translation, connection, outbox and queue-center services. The cover/poster payloads carry library/media ids, not global task ids (those queues are not global_tasks), so the synthetic heads are a consumer/contract matter for pycore + orchestrator |
| RV-011 | fixed | a change inside the 1 s window marks it pending; one deferred callback per window (after the response) emits the trailing `queue.changed` |
| X4 | deferred (contract) | Laravel dictionary rows are keyed by md5 of the exact stored content; pycore hashes md5(lower(strip)). Changing Laravel would re-key existing rows (case-variant rows would collide). Recommendation: contract rule "word identity = md5 of the exact stored content", and pycore uses the md5 from the task payload |

Changed files (under `poly_apps/laravel_main/`): `app/Services/OctaneTimerService.php`, `bootstrap/app.php`, `routes/console.php`, `app/Services/TimerTasks/{AppQyV1AgentHistoryAudioWritebackTask,AppQyV1LibraryCoverFallbackTask,AppQyV1CoverGenerationTask,AppQyV1PosterCollectionTask,CodeMartV1AIAnalysisTask,DataSyncTask,DeveloperHistoryExtractionTask,SslCertAutoRenewTask,ServerManagerV1StaticResourcesWarmTask,AppQyV1ResourceIndexReconcileTask}.php`, new `app/Services/TimerTasks/AppQyV1OffsetSpoolSweepTask.php`, `app/Services/QueueCenter/DictLane/DictLaneQueueCenter.php`, `app/Models/Concerns/GlobalTaskQueueQueries.php`, `app/Apps/AppQyV1/AppQyV1Services/{AppQyV1DurableOffsetUploadService,AppQyV1OrchAudioService,AppQyV1WordAudioGateway,AppQyV1AudioGateway,AppQyV1TranslationRealtimeService}.php`, `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/{AppQyV1SentenceAudioController,AppQyV1TTSWorkerController,AppQyV1AssistController}.php`, `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`, `app/Apps/AppQyV1/AppQyV1Models/AppQyV1LangSentenceModel.php`, `app/Services/UserConfig/UserConfigService.php`, `app/Apps/Relay/RelayServices/{RelayOutboxRepository,RelayDeviceService}.php`, `app/Services/QueueCenter/{QueueCenterService,QueueCenterRealtimeService}.php`, `app/Http/Controllers/QueueCenterController.php`, `app/Support/QueueCenterContract.php`, `app/Services/Realtime/{RealtimeConnectionService,RealtimeOutboxPublisher}.php`.

Checks: `php -l` on every changed file; `php artisan list` shows `octane-timer:background`; `php artisan schedule:list` shows the heartbeat (1 s) and the background command (every minute).

## laravel-T5

| Item | State | Note |
|---|---|---|
| FU-030 server lock | fixed | `DatabaseManagerService::backup/restore` hold a per-connection cache lock (3900 s, above the 3600 s pg timeout); a concurrent request gets 409 `db_manager.connection_busy` (the data-sync receiver backups share the lock) |
| FU-030 request idempotency | fixed | new middleware alias `idempotent` (`App\Http\Middleware\IdempotentRequest`, header `Idempotency-Key`, the name `UI/core/.../BaseAPI.ts` and CodeMart already use; `CodeMartV1Constants::IDEMPOTENCY_HEADER` now points at it). Same caller + method + path + key: a replay after completion returns the stored response with `Idempotent-Replayed: true`; a replay while running gets 409 `IDEMPOTENCY_IN_PROGRESS`. Applied to db-manager backup and restore, server-manager restart and toggle-autostart |
| toggle-autostart | fixed | body `enabled` (boolean) is required; the service is set to that state (no-op when already there), so a retry converges |
| FU-031 dedupe | fixed (server side) | `idempotent` on `app_qy_v1/group/update_progress`, `app_qy_v1/learning/sentence-words/played` and `app_qy_v1/recitation/log`; wordnew sends one stable `Idempotency-Key` per queued entry. The owner-scope/clear-on-logout part is wordnew's (UI) |

Changed files (under `poly_apps/laravel_main/`): new `app/Http/Middleware/IdempotentRequest.php`, new `lang/{en,zh_CN}/{idempotency,db_manager}.php`, `bootstrap/app.php`, `app/Services/Dashboard/DatabaseManagerService.php`, `app/Http/Controllers/ServerManagerController.php`, `app/Apps/CodeMartV1/CodeMartV1Gvar/CodeMartV1Constants.php`, `routes/DashboardRouter/DatabaseManager.php`, `routes/api/system.php`, `routes/AppQyV1Router/{AppQyV1Dict,AppQyV1Learning}.php`.

Checks: `php -l` on every changed file; `php artisan route:list --json` shows `IdempotentRequest` after the auth middleware on the seven routes.

## laravel-T6

| Finding | State | Note |
|---|---|---|
| LB-034 | fixed (audited set); remainder recorded | 441 of the 446 lines the audit's pattern matched now call `__()` with en + zh_CN entries: `codemart.messages` (97 keys), `app_qy_v1.messages` (195), `server_manager.messages` (122), `api.messages` (140), `it_tools.messages` (7). The DataSync exception and session-finish messages the finding names are `data_sync.*` (47 keys; `DataSyncProtocol::CANCELLED_MESSAGE` became `cancelledMessage()`, and a `DataSyncNotFoundException` replaces the English "not found" substring test for 404). All 422 used keys resolve in both locales (scratchpad check). Machine `error_code` values are unchanged |

Two pre-existing defects found and fixed while verifying:
- **Every `__()` in laravel_main returned the raw key.** Laravel prefers `resources/lang` when it exists, and an empty untracked `resources/lang/{en,zh_CN}` exists locally. `bootstrap/app.php` now pins `useLangPath(base_path('lang'))`.
- **API responses never switched language** (no locale selection on the API). New global middleware `ApplyRequestLocale` maps `Accept-Language` to `zh_CN`/`en` (fallback `en`) on every request, so nothing carries over between FrankenPHP worker requests. UIs that display the server `message` now show Chinese for zh browsers; machine clients without `Accept-Language` get English.

The wallet-ledger descriptions written by CodeMart money flows (for example `"Project {id} escrow remainder refund"`, `"Deposit {id} refunded"`) are persisted strings and belong to the recorded remainder (not converted: they need a stored code plus translation at read time, not `__()` at write time).

Remainder (deferred, next owner laravel): 10 lines in `app/Console/Commands` (console output; the guide forbids editing app/Console); 173 interpolated double-quoted message calls and 737 `'message'|'error' => '...'` array entries outside the audit's pattern (grep counts on `app/`, excluding app/Console).

Changed files (under `poly_apps/laravel_main/`): the CodeMartV1 (13), AppQyV1 (38), ServerManagerV1 (10), app/Http (20) and ItToolsV1 (1) files found by the audit pattern; `app/Services/DataSync/*` (13 files, new `DataSyncNotFoundException.php`), `app/Http/Controllers/Dashboard/DataSyncController.php`, new `app/Http/Middleware/ApplyRequestLocale.php`, `bootstrap/app.php`, new `lang/{en,zh_CN}/{app_qy_v1,server_manager,api,it_tools,data_sync}.php`, `lang/{en,zh_CN}/codemart.php`.

Checks: `php -l` on every changed file; a scratchpad translator check (both locales) and an `Accept-Language` check of the middleware.

## laravel-T7

| Item | State | Note |
|---|---|---|
| LB-008 admin refund | fixed | `POST /api/codemart/v1/admin/escrows/{escrowId}/refund` (admin group + `AuthHelper::requireAdmin`, optional `notes`). Placed next to the existing `admin/escrows` and `admin/deposits/{id}/refund` routes rather than under `/admin/finance/`, which does not exist. `CodeMartV1AdminFinanceService::refundEscrow` locks the escrow and reuses `CodeMartV1EscrowService::refundHeldRemainder` (the same path as the cancel/complete auto-refund). Idempotent: nothing left returns `replayed:true`. Errors: 404 `escrow_not_found`, 409 `escrow_not_refundable` (disputed). Escrow rows gain `refundable` |
| LB-019 optional step | fixed | `CodeMartV1OtpService::smsDeliveryAvailable()` = runtime key `CODEMART_SMS_PROVIDER` names one of `CodeMartV1Constants::SMS_PROVIDERS` (none implemented yet). While false: the OTP request returns `codedError('sms_unavailable', …, 503)` before storing a code; `steps[].optional` (all steps) is true for `phone_verification`; `next_step`/`complete` skip optional steps; `onboarding.phone_verification_available`; the email-verify `next_step` is `kyc`; `registration_complete` does not require a phone |
| LB-020 bootstrap | fixed | `vocabulary.policy.deposit_payment_methods` = `CodeMartV1Constants::DEPOSIT_PAYMENT_METHODS`, the constant deposit validation uses |
| LB-035 | fixed (in laravel-T2) | DingDuoDuo admin group takes `custom.authenticate` + `dashboard.auth` (admin); recorded in the route table |

Changed files: `app/Apps/CodeMartV1/CodeMartV1Gvar/CodeMartV1Constants.php`, `CodeMartV1Utils/CodeMartV1OtpService.php`, `CodeMartV1Ctl/CodeMartV1RegistrationCtl.php`, `CodeMartV1Services/{CodeMartV1BootstrapService,CodeMartV1EscrowService,CodeMartV1AdminFinanceService}.php`, `CodeMartV1Controllers/CodeMartV1AdminFinanceCtl.php`, `CodeMartV1Models/CodeMartV1UserModel.php`, `routes/CodeMartV1Router/api.php`, `lang/{en,zh_CN}/codemart.php`. Checks: `php -l`; route:list shows the refund route; all used lang keys resolve (425 keys).

## laravel-T8

| Item | State | Note |
|---|---|---|
| Key names | fixed | the verifier loads only `CORE_NODE_CLIENT_KEY_1.._5` (`secret_key_base` + `_<n>`); SecretStore is unchanged for other callers |
| Signed path | fixed | the verifier canonicalizes `getBaseUrl() . getPathInfo()` (the path as sent). The `laravel_peer` signer already signs the exact path it sends (`/api/dashboard/db-manager/sync-peer/...`; peer targets carry no path, enforced by `normalizeAddress`) |

Checks: `php -l`; the three test vectors still reproduce; the in-process round trip (valid, replay, tampered query/body, multipart, stale timestamp) passes, and a request under a `/sub` base path verifies.

## laravel-T9

| Item | State | Note |
|---|---|---|
| LB-033 | fixed | `scripts/start.ps1` stops a php.exe artisan lane only when its command line carries this project's resolved artisan path (`Join-Path $LaravelDir "artisan"`); the `artisan serve` fallback is started with that absolute path. The ancestry heuristic and the interactive "unowned lanes" clause are gone. Step (2) (whatever owns the port) is unchanged. PowerShell parser check passes; the pattern was checked against sample command lines |
| X4 | fields reported | see "X4 field names" below; no code change (Laravel already sends the dictionary row md5) |
| RV-007 | fixed (Laravel side) | cover.priority and poster.priority payloads carry `items[].resource_key` (`library:<id>`, `<media_type>:<id>`); there is no assist request or global task id in these flows |
| RV-004 | fixed | the `taskStreamEvent` accessor (the only `stream_events` reader) was removed in laravel-T4 |
| LB-007 remainder | fixed | `ai-regenerate` enqueues a `library_cover` generate task through `AppQyV1LibraryCoverTaskService::enqueue` and answers 202 with the task (409 when another cover mode is in flight); no request waits on the image provider |

X4 field names (word identity = the dictionary row `md5`, sent by Laravel):
- word_audio lane (`worker/tasks/word_audio/pull`, `queue-center/queues/word_audio/page-data`, worker_pull wire shape): `payload.md5` (with `payload.word`, `payload.language`).
- batched dictionary lanes (word_validity, dictionary_explanation claim tasks): `payload.words[].md5`.
- uploads keyed by it: `POST /api/app_qy_v1/word/audio/upload` body `md5` (+ `lang`); `POST /api/app_qy_v1/delivery/diff` and `/delivery/batch` kind word audio: item `key` = `<lang>:<md5>[:<variant>]` (`AppQyV1ResourceIndexService::wordKey`).
- `tts/worker/report` (word_tts) is keyed by `task_id`, not md5.

Changed files: `scripts/start.ps1`, `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php`, `app/Apps/AppQyV1/Services/AppQyV1LibraryCoverTaskService.php`, `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1AssistController.php`, `lang/{en,zh_CN}/app_qy_v1.php`, `app/Http/Middleware/IdempotentRequest.php` (T5 note: only 2xx and 400/404/410/422 are stored). Checks: `php -l`; pwsh parser.

## laravel-T10

| Item | State | Note |
|---|---|---|
| NC-008 Laravel half | fixed | `DingDuoDuoV1SuperCodeService` mints and verifies `DDK2.<payload>.<Ed25519 sig>` per `.claude/agents_shared/client_key_auth/dingdoudou_super_code_v2.md`. Format, public key and seed secret name are read from `service_contract.json#dingdoudou` (`super_code_format`, `super_code_public_key`, `super_code_signing_secret`). Minting refuses when the seed is missing or does not match the contract public key; verification uses the contract key, requires `v == 2`, the presenting device id and a future `exp`. `MASTER_CODES`, `SUPER_SALT` and FNV-1a are gone |
| License resolution | fixed | `DingDuoDuoV1LicenseService::resolveByToken` accepts only v2 codes bound to the request's `device_id` (a `super_codes` row not `active` revokes a code), then member tokens, else locked; the old DB/offline super-code paths are removed |
| Master codes | fixed | the initializer step `seed_master_codes` became `retire_master_codes`: it marks the three v1 master codes `revoked` (rows kept) |
| Mint entry | fixed | admin-only artisan command `dingduoduo:super-code {device} --days= --tier= --max-binds=` (routes/console.php); no web route |

Changed files: `app/Apps/DingDuoDuoV1/DingDuoDuoV1Services/{DingDuoDuoV1SuperCodeService,DingDuoDuoV1LicenseService}.php`, `app/Apps/DingDuoDuoV1/DingDuoDuoV1Models/DingDuoDuoV1SuperCodeModel.php`, `app/Apps/DingDuoDuoV1/Utils/DingDuoDuoV1Initializer.php`, `routes/console.php`, new `lang/{en,zh_CN}/ding_duo_duo.php`.

Checks: `php -l`; in-process: a real mint -> verify round trip with the installed seed and the contract key; with an injected test key pair: valid accepted, other device / no device / expired / v1 master / tampered payload rejected; mint refused when the seed does not match the contract key; `artisan list` shows the command.

## laravel-T11

Root cause. The shared path already adds missing columns when it runs. Path: `sys:init` (last phase: `AppInitializationManager::initializeAll`) -> `CodeMartV1Initializer` step `align_contract_tables` -> `SafeMigrationHelper::alignTableStructureFromArray`. A dry run inside a rolled-back PG transaction, on the unmodified code, added both columns. So the 500 comes from that path never having run against the database since `c67320892` introduced the columns. The `codemart_v1_escrows` table itself comes from migration `CodeMartV1_2025_10_21_000004`, not from the initializer; only the new columns come from the initializer.
- Local evidence: none of the 16 CodeMart contract structures was applied (5 tables and 42 columns missing), and 10 migrations are pending. Yet `laravel_db/codemart_v1_init_status.json` says `fully_initialized` at 2026-09-26 15:40 UTC. That status file is written outside the DB, so a run whose DB work was rolled back, or that ran against another DB, still marks the app done. It is only a marker and is never used to skip.
- Server evidence (§10.4): the 2 D7 migrations are pending. So `sys:init` has not completed its first step (`migrate --force`) since `014bfbff9` was synced, and every CodeMart structure after that is missing too, not only the escrow columns.
- `sys:init` stops at the first failing step. The app initializers run last, after about 25 steps (migrate, dictionary, TTS, article library, and others). If any earlier step fails, the columns are never added.

Shared-path gaps, fixed once in `SafeMigrationHelper`, so every initializer and migration gets the fix:
1. New `addMissingColumns()`. `alignTableStructure` and `alignTableStructureFromArray` both call it, which removes the duplicated loop. What it does:
   - adds each missing declared column with its declared type, nullability and default. `NOT NULL DEFAULT x` backfills existing rows on PostgreSQL.
   - is additive only: it never drops, renames or retypes a column.
   - logs `[SafeMigrationHelper] Added missing column <table>.<column>` with connection, type, nullable and default. The level is `warning` because the daily channel drops `info`.
   - adds a NOT NULL column that has no default as nullable, with a warning, when the table has rows (or on SQLite). Enforcing it would fail on existing rows (contract §3). No current definition hits this case.
   - lets one failing column no longer block the rest. The failures are logged and raised together afterwards.
2. Index idempotency, found during verification. A table created by the helper gets Blueprint's auto index names (`<table>_<cols>_index` / `_unique`). An unnamed spec probed only `idx_<table>_<cols>`, so the run after creation added a duplicate index for every spec. `safeAddIndex` / `safeAddUniqueIndex` now treat any existing index with the same ordered columns (and uniqueness when required) as present. Named specs behave as before.

Changed files: `poly_apps/laravel_main/app/Services/SafeMigrationHelper.php` only.

Deploy entry (step 2). `scripts/shells/linux/debian/install_shells/175_laravel_main_start.sh:657` runs `"$PHP_BIN" artisan sys:init`, so no shell change is needed to reach the path.

Verification (local; scratch scripts in the session scratchpad, no test files):
- `php -l app/Services/SafeMigrationHelper.php`: no syntax errors.
- Before: in-process kernel `GET https://127.0.0.1/api/codemart/v1/public/home` -> `status=500`. The service threw `SQLSTATE[42703] column "released_amount" does not exist`, the server error reproduced.
- The local FrankenPHP service `ncore-laravel-main` is Stopped and Disabled, and curl to 127.0.0.1:443/80 returns 000. I did not start it (no-services rule), so the HTTP checks go through the in-process HTTP kernel (full routing and middleware, cache and session in memory).
- Rolled-back probes (PG transactional DDL, no residue):
  - unmodified code adds both columns;
  - `NOT NULL DEFAULT 5` backfills an existing row;
  - a NOT NULL column without a default on a table with rows is added nullable, with a warning;
  - a fresh create followed by 2 reruns gives `aligned`, 0 actions, and no `idx_*` duplicates.
- Narrowest equivalent of `sys:init` for this path: the `CodeMartV1Initializer` step `align_contract_tables`, invoked against the local `code_mart_v1_database`. Results by run:

  | Run | Result |
  |---|---|
  | 1 | 5 tables created (notifications, activities, testimonials, contact_messages, withdrawals), 11 tables `updated` with 42 `Added missing column` lines, including `codemart_v1_escrows.released_amount/refunded_amount numeric(15,2) NOT NULL DEFAULT 0` |
  | 2 (before the index fix) | 0 columns added, but the 5 newly created tables got `idx_*` duplicate indexes. That run exposed item 2 above |
  | 3 (after the fix) | all 16 tables `aligned`, 0 actions |

  - Declared-vs-live diff: `missing=-` for all 16.
- After: in-process `GET /api/codemart/v1/public/home` -> `status=200`, `{"success":true,"data":{"total_amount":"0.00",...}}`.
- Regression, rolled back: GlobalTaskSystem, CloudClipboard, VoiceSubtitle, AppQyV1 client-settings and user-init table services return their usual statuses.
- Local residue: redundant `idx_codemart_v1_{notifications,activities,testimonials,contact_messages,withdrawals}_*` indexes from run 2. They are harmless and were left in place (no destructive action).

Server steps for laravel-remote after code sync (do not use loopback for peer checks; the local-instance checks below are on the server itself):
1. `cd /www/programing/core_node/poly_apps/laravel_main && php artisan migrate:status | grep -c Pending`. Expect the 2 D7 migrations.
2. `php artisan sys:init`. It must run through `Initializing apps...` and print `CodeMartV1: OK`, with `✅ Align additive contract tables and columns`. If it stops earlier, the failing step is the blocker; report it, because it keeps every app schema from converging.
3. Check the columns: `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name='codemart_v1_escrows' AND column_name IN ('released_amount','refunded_amount');` Expect `numeric`, `NO`, `0`. The added columns appear as `[SafeMigrationHelper] Added missing column ...` warnings in the Laravel log (syslog on the server).
4. `GET https://api.si.12gm.com/api/codemart/v1/public/home` -> 200.
5. Run `php artisan sys:init` a second time: no `Added missing column` lines.

Cross-scope notes:
- shell: `175_laravel_main_start.sh:657` ignores the exit status of `sys:init` (no `set -e`, no check), so a failed `sys:init` still starts the service on a drifted schema. `poly_apps/laravel_main/scripts/start.ps1:641-643` already stops on failure. Suggest the same fail-stop, or at least a loud warning, in 175. I did not edit 175.
- orchestrator: the §10.4 row "CodeMart tables come from `sys:init`, not migrations" is only half right. Base tables come from migrations; the added contract columns and new tables come from `sys:init`.

## D7: local Laravel bring-up (2026-09-27 about 17:0x)

Full record: `.claude/agents_shared/d7/laravel_local.md`. No application code was edited.
- Up: FrankenPHP 1.12.7 with the Octane worker (4 workers). PID 28564 (parent cmd 10788, created through WMI with a hidden console, no service; the first instance was stopped by an unexplained Ctrl+C in its visible console and was relaunched at 17:09). Ports :443 / :9000 / :80 / 127.0.0.1:2019.
- `https://127.0.0.1/api/health` and `.../api/codemart/v1/public/home` return 200 with the local mkcert CA given explicitly.
- `sys:init` applied 18 pending migrations (orch_audio included); `route:list` shows 1086 routes.
- Blocker (user decision): adding the new local CA to the Windows trust store was denied by the permission classifier. Default-trust clients (Windows, certifi in pycore) reject `https://127.0.0.1`.
- Own follow-up (after the no-code-edit window): `start.ps1:340-363` `php -r` helpers break under Windows PowerShell 5.1 (inner quotes are dropped), so `start.ps1` fails on every run on this machine.
- For shell-windows: the `FrankenPhpManager.ps1` route brace defect (:788,799,919,922), the embedded PHP extensions missing in Step96, no `skip_install_trust` in the Caddyfile, and Step175 running ACME for the production domains on a LAN desktop.

## Blockers

- D7: the local mkcert CA is not trusted by default (see D7 above); a user decision is needed.
- Until shell ships K2 and the user runs dd.sh / dd.cmd, `CORE_NODE_CLIENT_KEY_1` is absent and every `client.key` route fails closed with `client_key_missing` (expected per requirements §6).
- Machine callers need their K3 signers (pycore, mcp-chrome native host, ncore) before their Laravel calls pass.
- UI adaptations: laravel-manager must send `{"enabled": bool}` to toggle-autostart (now required) and should send `Idempotency-Key` on backup/restore; codemart's wallet must drop alipay/wechat deposits and handle the 503 `sms_unavailable`; wordnew sends `Idempotency-Key` per queued write.

## Rulings needed (orchestrator)

All earlier rulings are applied (B9: LB-008, LB-019, LB-033, X4, RV-007, LB-035). Open on the orchestrator side:
1. X4: add the word-identity rule with the field names in laravel-T9 to `queue_center_contract.json`, then tell pycore.
2. RV-007: add `realtime.head_keys` = {`cover.priority`: `items[].resource_key`, `poster.priority`: `items[].resource_key`}; pycore replaces its synthetic heads.
3. RV-004: `task_contract.stream_events` has no Laravel reader left.

## Next owner

- orchestrator: rulings above; section 7 of the requirements record.
- reviewer: laravel-T10, laravel-T11.
- laravel-remote: laravel-T11 server steps after code sync.
- shell: laravel-T11 note on the `sys:init` exit status in 175.
- laravel (follow-up): LB-034 remainder (173 interpolated calls, 737 `'message'|'error' => '...'` entries).

## D7 family merge

Coordinator merge check (B13), about 18:3x, for laravel-D7.1/.2, laravel-qyapp-D7.1/.2, laravel-codemart-D7.1/.2, laravel-api-D7.1/.2.

Input. All eight batches arrived with `verdict: null` and `changed: null`. No lane report exists for laravel-qyapp, laravel-codemart or laravel-api. The workflow logs of this period show ENOTFOUND API failures. I attributed the changes myself, by the path map and file mtimes (17:14-17:38), diffing `f4f223414` against the working tree. Header-block removals (D18) are ignored. Result: 28 files changed in substance.

| Role | Changed (under `poly_apps/laravel_main/`) | What |
|---|---|---|
| laravel | `app/Constants/LaravelConfig.php`, `config/logging.php`, `config/services.php`, `app/Providers/RuntimeConfigurationServiceProvider.php`, new `app/Support/ContractDocument.php`, `app/Support/ServiceContract.php` | no-env: `LOG_LEVEL` and `CODEMART_SEED_DEMO` constants, `CODEMART_BANK_*` from the runtime store. No `env()` read is left in config/app/routes/bootstrap. ServiceContract delegates its typed reads to ContractDocument and gains data-dir readers, which nothing calls yet (the §8.0 PathMapper switch never landed; scratch `d71/edit_pathmapper.py` was never applied) |
| laravel-api | `app/Services/DataSync/{DataSyncProtocol,DataSyncService,DataSyncStateStore,DataSyncPeerClient,DataSyncSessionRuntime,DataSyncPassiveService,DataSyncDriverService,ResourceSyncService}.php`, `app/Http/Controllers/Dashboard/DataSyncController.php`, `app/Http/EnvironmentApiInfo/CommonApiInfo.php` | protocol values from `service_contract.json#data_sync`; archive extraction is staged and checked per file against the plan manifest; the peer cancel moved into `DataSyncSessionRuntime::finish`; one active session per node; the index adds `terminal_retention` |
| laravel-qyapp | `app/Apps/AppQyV1/AppQyV1Models/AppQyV1TtsEngineConfigModel.php` | srv-07: `seedDefaults` only inserts missing rows (`insertOrIgnore`) and never updates one |
| laravel-codemart | new `CodeMartV1Utils/CodeMartV1AdminPassword.php`, new `CodeMartV1Commands/CodeMartV1AdminPasswordCommand.php`; `CodeMartV1DemoSeeder`, `CodeMartV1Initializer`, `CodeMartV1Constants`, `CodeMartV1WalletModel`, `CodeMartV1WalletTransactionModel`, `CodeMartV1PaymentCtl`, `CodeMartV1{AdminFinance,Escrow,Finance}Service` | srv-05: the password comes from the contract secret file (no hardcoded password), `codemart:admin-password --file`; ledger rows store `description_code` + params, translated when read; bootstrap vocabulary gains `capability_roles`, `terminal_states` and withdrawal policy; additive contract columns |

Conflicts fixed in coordinator paths (the review files):
1. `codemart:admin-password` was never registered. `artisan list codemart` gave "There are no commands defined in the codemart namespace", so the contract's apply command (175/Step175) would fail. It is now registered in `app/Providers/AppServiceProvider.php`.
2. 25 lang keys were missing in both locales: `codemart.cli.admin_password.*` (8), `codemart.cli.seed.*` (4) and `codemart.ledger.*` (all 13 `LEDGER_*` codes). Without them, sys:init, the command and every new wallet ledger description would show raw keys. The keys are now in `lang/en/codemart.php` and `lang/zh_CN/codemart.php`.
3. The `app/Support/ContractDocument.php` docblock said QueueCenterContract uses the class. It does not, so the docblock is corrected.

Temporary writers. A lane wrote the foundation edits (the LaravelConfig `CODEMART_SEED_DEMO` switch, the `config/services.php` codemart keys, the RuntimeConfigurationServiceProvider `CODEMART_BANK_*` map) without a temporary-writer record. I accepted them because they follow the no-env ruling (D17). Ownership stays with laravel, and no assignment is open.

Fit checks:
- routes and middleware: 1086 routes, the same as the D7 bring-up; this run changed no route file.
- migrations: 0 pending, and this run added no migration.
- schedule: unchanged.
- shared services and DI: `DataSyncSessionRuntime` now takes `DataSyncPeerClient`, which has no constructor, so there is no cycle. Every `DataSyncProtocol::` reference resolves (the removed constants have no callers left).
- initializers: startup and sys:init order are unchanged. The new ledger columns come from the CodeMart `align_contract_tables` step.
- thread-bus and RPC do not apply to Laravel; the realtime names were unchanged in this run.

Verification (local; scratch scripts in `scratchpad/d7merge`; no test files; service not started):
- `php -l`: 31 PHP files (the 28 plus my 3), no errors.
- lang: 76 keys used by the changed files resolve in en and zh_CN (25 were missing before the fix).
- `artisan list codemart` shows the command.
- The command without `--file` exits 2; with an unreadable file it exits 1.
- `codemart:admin-password --file <scratch file>`, inside a rolled-back transaction on `main`: run 1 gave 7 updated, run 2 gave 7 unchanged. After the rollback, the hashes are unchanged.
- `CodeMartV1AdminPassword::ensure(<scratch>)`: the first call generated 24 characters, the second reused the file.
- Ledger accessor: en `Payment 5 to user 7`, zh_CN `付款 5 给用户 7`; a legacy row keeps its stored text.
- TTS `seedDefaults`, rolled back: a converged table gives 0/0. An operator-edited edge row (99, disabled) is kept, and a deleted kokoro row is restored.
- The invite-code path, rolled back, returns the admin code (`exists`), so sys:init keeps printing it.
- Contract readers: data_sync v5, port 9000, retention 5.
- In-process HTTP kernel: `GET /api/dashboard/db-manager/sync-peer/health` gives 200 (`protocol_version` 5, `default_port` 9000); `GET /api/codemart/v1/public/home` gives 200.
- Not run: a full `sys:init`. It would create the real CodeMart secret file, which is the 175 step's job, and its changed steps were run above one by one.

Side effect, recorded:
- My probe opened its rollback on `main`, because `CodeMartV1UserModel` uses `main`. `CodeMartV1Initializer` aligns on `codemartv1`, so that align ran live.
- The local `code_mart_v1_database` gained three additive nullable columns (Laravel log, 08:25:48 UTC). This is the same change sys:init's ensure step makes:
  - `codemart_v1_wallet_transactions.description_code`
  - `codemart_v1_wallet_transactions.description_params`
  - `codemart_v1_ai_analyses.accept_idempotency_key`
- No row changed. The columns were not reverted, because a revert would drop columns.

Open items (owner: fix):
- laravel-codemart, blocking for D17's "立即同步到系统": when `CodeMartV1DemoSeeder::seed()` generates the secret file (`$secret['generated']`), apply it to the existing seeded accounts as well (`CodeMartV1AdminPassword::apply($secret['password'])` after `seedAccounts`).
  - Otherwise sys:init and sys:codemartinit print a password that the existing accounts reject, and the removed hardcoded password stays valid.
  - Local evidence: 7/7 seeded accounts still accept it.
- laravel-codemart, non-blocking:
  - do not hand the generated password to the seeder `$log` callback, which the initializer wires to `Log::info`; keep it in the returned summary only;
  - `codemart_v1_ai_analyses.accept_idempotency_key` has no reader or writer yet.
- laravel, own lane: srv-06 part 2 did not land. `McpV1Initializer::initialize` skips steps on the status file alone. Remove the `completed_steps` skip; every step already checks real state (`hasTable`, `file_exists`). A missing `placeholder_images` table is then repaired, which is the server's daily `mcpv1:placeholder-cleanup` failure.
  - Also: either switch PathMapper to `service_contract.json#paths` (§8.0) or drop the unused ServiceContract data-dir readers and `dataSync()`.
- laravel-qyapp:
  - `AppQyV1TtsVariantSpecModel::seedDefaults` still upserts `accent`, `gender` and `is_primary` on existing default specs at every sys:init. Make it insert-only like the engine config if those fields are operator-editable;
  - the X4 Laravel half (resolve by `cleaned_word`) is not in this run's changes.
- shell-linux (srv-04) and shell-windows (Step175 parity): not landed. 175 still:
  - has no `--list-steps`, `--check` or `--step`;
  - has no `codemart-admin-password` step;
  - ignores the exit status of `sys:init` (:647);
  - mentions `CODEMART_SEED_DEMO` as an env key in its comments.
  - The Laravel side is ready: `php artisan codemart:admin-password --file <absolute path>` exits 2 without `--file`, 1 when the file is unreadable, and 0 otherwise; it is idempotent.

laravel-remote, after CodeSync. The sync must include `config/service_contract.json`; without its `data_sync` block, DataSync health throws. Report counts only, never the password.
1. `php artisan list codemart` shows `codemart:admin-password`.
2. Run `php artisan sys:init` at once, before any wallet write, because ledger inserts now need `description_code`. Expect:
   - `Added missing column` warnings for the three columns above;
   - `CodeMartV1: OK`;
   - on the first run, the generated-password line with its file path;
   - the admin invite code;
   - `TTS engine config: 0 created, 0 updated` on a converged server, with operator `priority_order`/`enabled` kept.
3. Run the 175 `codemart-admin-password` step (after srv-04), or `php artisan codemart:admin-password --file <laravel_db>/.core_node_secrets/CODEMART_ADMIN_PASSWORD`:
   - run 1: N updated;
   - run 2: all unchanged;
   - afterwards no seeded account accepts the removed hardcoded password.
4. `GET https://api.si.12gm.com/api/dashboard/db-manager/sync-peer/health` gives 200 with `protocol_version` 5 and `default_port` 9000.
5. `GET https://api.si.12gm.com/api/codemart/v1/public/home` gives 200.
6. A second `sys:init` prints no `Added missing column` lines.

Review: `poly_apps/laravel_main/app/Providers/AppServiceProvider.php`, `app/Support/ContractDocument.php`, `lang/en/codemart.php`, `lang/zh_CN/codemart.php`. Status: in progress until the reviewer approves.
