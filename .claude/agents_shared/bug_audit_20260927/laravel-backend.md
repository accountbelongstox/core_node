# laravel-backend bug audit (B6) — report only

Status: in progress

## Findings (working notes, ordered at end)

### [DS-1] critical — Unauthenticated `sync-peer/prepare` and `sync-peer/export-prepare` let any internet client dump every database table and resource file, or push arbitrary rows and files
- severity: critical · category: security-auth · confidence: confirmed
- location: poly_apps/laravel_main/routes/DashboardRouter/DatabaseManager.php:58-61; app/Http/Requests/DataSync/PrepareDataSyncExporterRequest.php:9-12; app/Services/DataSync/DataSyncPassiveService.php:27-67
- failure scenario: An anonymous client sends `POST https://api.si.12gm.com/api/dashboard/db-manager/sync-peer/export-prepare` with a random 32-hex `fetcher_job_id` and a 64-hex `prepare_token`. It gets back `{id, token}`, waits until the timer sets `ready`, then reads `GET …/export-sessions/{id}/database-inventory` and `…/database-chunks?connection=X&table=users&offset=N` and dumps every row of every table: users, password hashes, Sanctum tokens, API keys, CodeMart wallets. `resource-file-batch` and `resource-file-chunks` return every resource file. With `POST …/prepare` (receiver) and `…/sessions/{id}/database-chunks`, the same client upserts arbitrary rows by primary key (for example, it can overwrite an admin password hash) and writes files into the resource roots.
- evidence: The sync-peer group has only `throttle` middleware (DatabaseManager.php:58-62), and `authorize()` returns true. `prepare()` creates the session and returns `context.token` with no credential check (Passive:46-65). Every later route checks only that per-session token (`requireSession`, Passive:506-524). The only limit is "one active passive session" (Passive:39-41).
- suggested fix: Require a pre-shared pairing secret or a machine-auth signature (the pending Queue Center machine-auth design) on prepare and export-prepare, and allow-list the peer machine codes.

### [DS-2] high — Push-mode compressed resource sync loops forever when final-chunk hashing and 7z extraction outlast the 120 s peer timeout
- severity: high · category: idempotency · confidence: likely
- location: app/Services/DataSync/ResourceSyncService.php:242-265; DataSyncPassiveService.php:237-256; DataSyncDriverService.php:870-903
- failure scenario: A source pushes the `static` root (4.7 GB) with compression on. The receiver handles the final `resource-chunks` request inside the HTTP request: it SHA-256-hashes the whole .7z, runs `extract7z` (timeout 3600 s) and then deletes the part file. The driver times out at 120 s (ConnectionException, then 503 busy while the lock is held) and gets `__waiting`. On the next tick it resends the final chunk at offset N. The part file is gone, so `writeFileSegment` creates an empty file and answers `{success:false, offset:0}`. The driver realigns to 0 and re-uploads the whole archive, and the extraction times out again. The session never finishes. The same thing happens once after any lost final response.
- evidence: `receiveArchiveChunk` has no "already extracted" check. Compare `receiveFileChunk`, whose offset-0 `hasHash` check makes a retry converge. `advanceArchiveChunk` resets the offset on `success=false` (Driver:892-894). REQUEST_TIMEOUT_SECONDS is 120 (DataSyncProtocol.php:11).
- suggested fix: Extract in the receiver's timer tick. Record a per-archive completion receipt keyed by `key+sha256`, and answer a replayed final chunk with `complete:true`.

### [DS-3] medium — One resource file deleted after the manifest was taken fails the whole sync session
- severity: medium · category: robustness · confidence: confirmed
- location: app/Services/DataSync/ResourceSyncService.php:91-95,127-130
- failure scenario: During a multi-hour pull of about 40k files, one planned file is deleted on the exporter (cache eviction, TTS regeneration). `readFileBatch` or `readFileChunk` throws RuntimeException. The controller maps it to 409, the peer client throws, and the driver `run()` finishes the whole session as `failed`. Files that changed are skipped by design (DataSyncHashMismatchException); files that disappeared are not.
- evidence: ResourceSyncService.php:128 `throw new \RuntimeException("Unable to read the resource file…")`; DataSyncController::respond maps RuntimeException to 409; DataSyncPeerClient::send:277-278 throws on a non-2xx status; DataSyncDriverService::run catch at :117-119.
- suggested fix: Return a per-file `missing` marker, and have the driver call `skipResource()` for it, as it already does for hash mismatches.

### [DS-4] medium — The fetcher asks the exporter for manifests of the fetcher's own resource-root keys, and one missing key fails the session
- severity: medium · category: contract · confidence: likely
- location: app/Services/DataSync/DataSyncDriverService.php:573,604-613; DataSyncPassiveService.php:86-94; ResourceSyncService.php:17-44
- failure scenario: `roots()` drops a candidate whose path is nested under an earlier root. Whether the audio, sentence or image dirs nest under `app_external_data` depends on host config overrides (`AppQyV1.paths.*`). Take a local host with a custom `audio_directory` and a server using the defaults. The local node keeps the key `app_qy_v1_word_audio` and the server drops it. The fetcher requests `/export-sessions/{id}/resources/app_qy_v1_word_audio/manifest`, and the exporter answers 422 (`Unknown resource root`) or 409 (`artifact missing`). The session fails at `fetch_exporter_resource_manifests`.
- evidence: buildLocalManifests sets `resource_roots ??= array_keys($this->resources->roots())` from local roots. fetchPeerManifests iterates those keys against the peer. The exporter builds `manifest-{key}` only for its own roots (Passive:432-436).
- suggested fix: Have the exporter publish its root keys (in the status or inventory response), and sync the intersection. Record keys that exist on only one side as skipped.

### [DS-5] medium — Heavy work still runs inside peer HTTP requests (fresh manifest, exact row counts, 7z archive creation)
- severity: medium · category: request-heavy-work · confidence: confirmed
- location: app/Services/DataSync/DataSyncPassiveService.php:80-94,114-130; DataSyncDriverService.php:538,982
- failure scenario: In push mode, `verify_resource_manifests` calls the receiver with `fresh=1`. The receiver runs `manifest($key)` in-request, and every file received in this session is a hash-cache miss (new path, size and mtime), so it SHA-256-hashes GBs inside the request. `verify_database_counts` runs an exact `count(*)` over every table of every connection in-request. `exportArchive` runs `create7z` over a whole root in-request. Each can pass the 120 s client timeout, which leaves the driver in `__waiting` retry loops, and each breaks REQUIREMENTS_20260927_MACHINE_DATA_SYNC_REFACTOR rule 4 ("Peer requests only read artifacts…").
- evidence: resourceManifest `if ($fresh) return $this->resources->manifest($key);`. databaseCounts `$this->databases->rowCounts()`. exportArchive calls `createArchive` inside withLock.
- suggested fix: Have the passive timer compute the post-transfer manifests, the counts and the archives as artifacts, and have the requests serve them (503 until ready).

### [DS-6] medium — Timer state is lost every minute on FrankenPHP, so long-interval tasks run every minute
- severity: medium · category: timer · confidence: likely
- location: app/Services/OctaneTimerService.php:62-81,143-185,207-230; bootstrap/app.php:73-79
- failure scenario: On FrankenPHP the heartbeat runs through `schedule:work`, which starts a new `schedule:run` process every minute. `last_run` lives only in the static `$fallbackStore`. The cross-process fallback `readHeartbeatFile()` reads a snapshot that is never written, because `writeHeartbeatSnapshot()` has no caller. Each new minute therefore starts with `last_run=0`. `SslCertAutoRenewTask` (86400 s) runs `certbot renew` every minute, and other tasks with intervals over 60 s also run every minute. `timer:status` from the console shows no state.
- evidence: `grep writeHeartbeatSnapshot` finds only its definition. `register()` seeds `last_run` from `stateGet`, which returns null in a fresh process. `MAX_INLINE_TASKS_PER_TICK`, `MAX_BACKGROUND_TASKS_PER_TICK` and `BACKGROUND_POOL_LOCK` are declared and never used, and `execution_mode` is ignored in the tick.
- suggested fix: Call `writeHeartbeatSnapshot()` at the end of `tick()`, or keep `last_run` in the cache store, so intervals survive process restarts.

### [DS-7] medium — `writeFileAtomic` staging name uses `getmypid()`, which all FrankenPHP worker threads share
- severity: medium · category: octane-worker · confidence: likely
- location: app/Utils/FileSystemManager.php:408-413 (also AiGateway/AiRateLimiter.php:369, AiUsageLog.php:227, AiKeyRotation.php:66, AiPromptCache.php:240, AiImageHistory.php:354, AiGateway.php:1236, DeveloperHistoryService.php:557, AppQyV1DailySentenceService.php:161)
- failure scenario: FrankenPHP runs its PHP workers as threads of one process, so `getmypid()` is the same for all of them. Two concurrent requests that write the same file (for example AI usage logs or rate-limiter state on every AI call) use the same `<path>.tmp.<pid>` staging file. One request's rename moves the other's half-written content into place, and the second rename fails (`moveFile` sees no source), so data is lost or `Unable to persist…` is thrown.
- evidence: `$staging = $path . '.' . getmypid() . '.tmp';`. The same pattern is copied in 8 AiGateway and DeveloperHistory helpers. Only AiSecretWriter.php:175 adds `random_bytes`.
- suggested fix: Add `bin2hex(random_bytes(6))` to every staging name, and centralize all callers on `FileSystemManager::writeFileAtomic` (the duplicates are also a `rule` violation).

### [DS-8] low — Superseding an idle passive session in `prepare()` calls `finish()` without the session lock
- severity: low · category: race · confidence: suspect
- location: app/Services/DataSync/DataSyncPassiveService.php:39-42
- failure scenario: A new driver prepares while the old passive session's timer tick is still in `step()` (a long manifest build holds the lock). `finish('cancelled')` deletes its artifacts. The tick then saves its stale `running` job, which brings the session back and leaves two active passive sessions.
- evidence: `$this->runtime->finish($active, 'cancelled', …)` runs outside `withLock`/`tryLock`. The driver-side cancel uses `requestCancel` plus `tryLock`.
- suggested fix: Use `requestCancel()` plus `tryLock()`, the same path as `DataSyncService::cancel`.

### [DS-9] low — Database chunk export uses OFFSET pagination, which is quadratic on large tables and skips rows when the exporter deletes rows mid-sync
- severity: low · category: performance · confidence: likely
- location: app/Services/DataSync/DatabaseSyncService.php:73-108
- failure scenario: For a table with N rows, the chunk at offset k makes PostgreSQL walk k index entries, so the total cost is O(N²/500). A delete on the live exporter shifts later rows back by one, so one row is never sent. `verifyDatabaseCounts` checks only `count ≥ snapshot`, so the gap goes unreported.
- evidence: `$query->offset(max(0, $offset))->limit(self::CHUNK_ROWS)` ordered by identity.
- suggested fix: Use keyset pagination on the identity columns (`next_cursor` = last identity values).

