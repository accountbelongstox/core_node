# Laravel-Driven Diff Delivery + Redis Resource Index — Requirements

Date: 2026-09-27
Status: binding requirement list (design and implementation records are
appended below by each workstream)
Supersedes: the "local receipt decides" parts of
`REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md` §3 (W4/W5).
Scope: `pycore` (shared Laravel delivery layer `pyutils/laravel/delivery_outbox.py`,
transports `progress_upload.py`, `worker_result_delivery.py`,
`common/http_progress_upload.py`, endpoint manager), `poly_apps/laravel_main`
(ingest, diff, Redis index), `scripts/shells/linux` (175 laravel_main service
scripts, FrankenPHP install scripts, Redis install), and `docs_fix`.

## 0. Global rules

Same as the previous requirement doc: reuse and merge, never duplicate;
refactor the underlying layer; i18n; English code/logs; no tests; shell
scripts follow `development-guides/DD_SHELL_GUIDE_THIS_FILE_NO_AI_EDIT.md`.

## 1. Requirements (user directive, 2026-09-27)

- R1 **Laravel computes the diff.** Whether an item must be uploaded is
  decided by Laravel, not by pycore's local receipts. Every time a Laravel
  endpoint comes (back) online, pycore sends its inventory (keys + content
  hashes per delivery kind) and waits for Laravel to compute the diff; pycore
  then uploads only what Laravel reports missing or stale.
- R2 **Many Laravel servers.** pycore may switch between several Laravel
  endpoints at any time. Every endpoint must be brought complete on its own.
  Local records are not the source of truth; delivery state is namespaced per
  Laravel server identity (a stable server id that Laravel exposes; pycore
  extends its endpoint identity model with this namespace).
- R3 **Batch upload with progress-based waiting.** Uploads support batches.
  They use the existing progress transport library (offset-v1 /
  `http_progress_upload` / `progress_upload`): no fixed timeouts while bytes
  or server-side progress keep advancing; only a real stall (no progress for
  the idle window) fails an attempt.
- R4 **Bottom-layer refactor.** Merge duplicate libraries (transport,
  upload, receipt, identity, diff), simplify, and add the features above.
- R5 **Fast diff on Laravel.** Laravel must answer diffs over very large
  static resource sets (mp3 audio, video, other media) within seconds. When
  Redis is available, Laravel keeps an index of all available static
  resources in Redis (or the officially recommended structure), kept in sync
  on write and rebuildable from disk; without Redis it falls back to the
  database/disk path. Research the official Laravel/Redis documentation for
  the recommended approach to large-set membership checks and diffs.
- R6 **175 scripts: idempotent Redis configuration.** Upgrade the 175
  laravel_main service scripts (and the FrankenPHP install scripts they call)
  so Redis is installed/configured and Laravel's Redis settings are applied
  idempotently.
- R7 Update `docs_fix` development documents for all of the above.

## 2. Workstreams

- W7 (R1, R2, R3, R5 Laravel side): server identity, diff API, batch ingest,
  Redis resource index; owns the "W7 contract" below.
- W8 (R1–R4 pycore side): per-server namespaced delivery, diff-driven
  reconnect flow, batch progress uploads, library merge.
- W9 (R6): shell scripts.

## 3. Implementation record

(Appended by each workstream.)

### W7 contract (Laravel server identity, diff API, batch upload, Redis index)

Root `poly_apps/laravel_main`. Envelope as W5: success `{success: true, data,
message, code}`; error `{success: false, error, message, error_code, data,
code}`. Delivery routes run at the pycore worker trust level of W5 ingest
(no login); every call carries `machine_id`
(`pycore.pyutils.laravel.identity.get_pycore_machine_id()`, same rule as W5).

#### R2 server identity

- `GET /api/health` (already probed by `laravel_endpoint_manager`) now also
  returns `server_id` (32 hex). `GET /api/app_qy_v1/delivery/info` returns
  it too (see below).
- `server_id = sha256("laravel-server\n" + machine_code + "\n" + nonce)[0:32]`;
  `machine_code` = `DataSyncMachineIdentity::code()` (OS installation id,
  identical to pycore `get_machine_id()`), `nonce` = random 128-bit value
  persisted once in `<laravel_data_dir>/identity/server_<machine_code[0:16]>.json`.
  Stable across restarts; distinct per OS installation (dual-boot Windows and
  Linux sharing one data dir get different ids) and per data dir (a wiped or
  fresh `laravel_db` gets a new id; a copied `laravel_db` on another machine
  gets a new id). Not stored in PostgreSQL, so DataSync copies never clone it.
- pycore: namespace delivery state by `server_id`; a changed `server_id` for
  the same URL = a different server (run the full diff).
- Response header `X-Core-Node-Server-Id: <server_id>` on `/api/health`,
  every `delivery/*` route and every `orch_audio/ingest/*` route
  (`App\Http\Middleware\ServerIdentityHeader`).

#### R1 diff: `POST /api/app_qy_v1/delivery/diff`

Request `{machine_id, kind, items: [Item], session_id?, chunk_index?,
chunk_count?}` (session/chunk fields are echoed only, for pycore progress).

| kind | Item | max items | "missing"/"stale" means | upload with |
| --- | --- | --- | --- | --- |
| `word_audio` | `{key: "<lang>:<md5>[:<variant_key>]"}`; md5 = the `word/audio/upload` md5 (md5 of trimmed lowercased word) | 5000 | no audio file for that variant (fill-missing; never stale) | `delivery/batch` or `word/audio/upload` |
| `sentence_audio` | `{key: "<lang>:<content_id>[:<variant_key>]"}`; content_id = `media_content_id(text)` | 5000 | no audio file (never stale) | `delivery/batch` or `ai_tools/tts/sentence/report` |
| `orch_segment` | `{key: "<sha256>"}` | 5000 | content-addressed orchestration mp3 not stored | `orch_audio/ingest/segment-audio` |
| `orch_output` | `{key: task_id, meta_hash, segments?: [{index, sha256}]}` (segments <= 2000/task) | 500 | replaces W5 `ingest/probe` (removed) | `orch_audio/ingest/tasks` + `segment-audio` |
| `article` | `{key: source_record_id, sha256?: sha256 of the article mp3}` | 500 | `missing` = no agent-history article for that record; `stale` = published `audio_sha256` differs | `ai_tools/article/worker/submit` / `replace-audio` |
| `static_file` | `{key: "<path relative to the Laravel static root>", bytes?}` | 5000 | file absent / size differs (other media, e.g. video; diff only) | feature endpoint |

`<lang>` = Laravel language code (`AppQyV1TableMaps::normalizeLangCode`, e.g. `en`).
`<variant_key>` omitted = primary variant. Orchestration manifest resources
are plain word/sentence clips: diff them as `word_audio` / `sentence_audio`.

Response `data`:

```
{kind, server_id, backend: "redis"|"database",
 received, processed, complete: bool, next_index,
 present: int,
 need: [{key, reason: "missing"|"stale"}],
 rejected: [{key, reason: "no_target"|"invalid_key"|"unsupported_language"}],
 tasks?: [{task_id, task_key, meta_current, segments_missing: [index]}],  // orch_output only
 elapsed_ms, session_id?, chunk_index?, chunk_count?}
```

- Only items that need action are listed; `present` counts the rest.
- `rejected` = do NOT upload (e.g. `word_audio` `no_target`: no dictionary row
  for `<lang>:<md5>`, the upload would answer `not_found`).
- orch_output: a task is in `need` (`missing` unknown task / `stale`
  meta_hash differs or segments missing) and always in `tasks` with the W5
  probe fields.
- Progress / long work: each call is bounded (chunk limit + server time
  budget 8 s). If the budget runs out, `complete=false` and `next_index` is
  the first unprocessed item: resend `items[next_index:]`. So every response
  is progress; no call waits on a fixed long timeout, and no job store is
  needed. pycore: split the inventory into chunks, run them sequentially (or
  2-4 in parallel), report `processed/received` as progress.
- Redis present: pipelined `HMGET` on bucketed hashes; index misses are
  verified against DB/disk (bounded by the chunk) and self-healed into the
  index. Without Redis: the same DB/disk verification for all items.

#### R3 batch upload (small items: `word_audio`, `sentence_audio`)

1. `POST /api/app_qy_v1/delivery/batch` (JSON)
   `{machine_id, kind, items: [{key, sha256, bytes, text?, provider?,
   cleaned_word?}]}`: 1..500 items, each 100 B..2 MiB, sum <= 32 MiB.
   `sentence_audio` items carry `text` (creates the sentence row when
   missing, as `sentence/report` does). Response `data: {batch_id (40 hex,
   = sha256(machine_id, kind, canonical items)), kind, state:
   "awaiting_content"|"processing"|"done", total_bytes, offset (bytes
   already received), processed, total}`. Re-posting the same manifest is
   idempotent (same `batch_id`, current state).
2. `POST /api/app_qy_v1/delivery/batch/{batch_id}/content` - offset-v1
   (`LaravelProgressUploader.upload(path, content, params=...)`): body = the
   item bytes concatenated in manifest order; query `machine_id` + offset-v1
   fields (`upload_length = total_bytes`, `audio_sha256` = sha256 of the
   concatenation). Same receiver as every offset-v1 upload
   (`AppQyV1DurableOffsetUploadService`, lane `delivery_batch`). Content
   already received -> first chunk answers `upload_complete: true,
   idempotent: true`. On the last chunk each item is sliced and its `sha256`
   verified (mismatch -> 409 `DELIVERY_BATCH_CONTENT_MISMATCH`, nothing
   stored; resend manifest), the batch goes `processing` and items are stored
   after the response. Receipt adds `{batch_id, state, processed, total}`.
3. `GET /api/app_qy_v1/delivery/batch/{batch_id}?machine_id=` - progress:
   `data: {batch_id, kind, state, processed, total, results?: [{key,
   status}] (state done), updated_at}`. Item `status`: `stored` | `exists` |
   `no_target` | `invalid` | `error`. A processing batch whose worker stopped
   (no progress for 30 s) is advanced inline by this call (time-boxed), so
   polling always moves forward. Poll until `done`; treat `processed`
   changes as progress (idle window = no change).
   Storage = the existing idempotent fill-missing writers
   (`storeWordAudioBytesDetailed`, `AppQyV1SentenceAudioService::report`).
   Done batches are removed after 24 h.

#### Other routes

- `GET /api/app_qy_v1/delivery/info` -> `{server_id, kinds: [kind],
  limits: {diff: {kind: n}, batch: {items, item_bytes, total_bytes}},
  index: {backend, kinds: {kind: {entries, built_at}}}}`.
- Removed: `POST /api/app_qy_v1/orch_audio/ingest/probe` (use diff
  `orch_output`).

#### Error codes

| code | HTTP | meaning / pycore action |
| --- | --- | --- |
| `DELIVERY_VALIDATION_FAILED` | 422 | shape invalid (`data.errors`); permanent for that payload |
| `DELIVERY_KIND_UNSUPPORTED` | 422 | unknown kind (diff) / kind not batchable (batch) |
| `DELIVERY_BATCH_TOO_LARGE` | 422 | item/total bytes above limits; split |
| `DELIVERY_BATCH_NOT_FOUND` | 404 | unknown `batch_id` (expired) -> re-post manifest |
| `DELIVERY_BATCH_CONTENT_MISMATCH` | 409 | concatenated content does not match item sha256/bytes -> re-post manifest, resend |
| `DELIVERY_UPLOAD_INVALID` | 422 | offset-v1 chunk rejected (offset/hash/size) -> transport resync |
| `DELIVERY_STORE_FAILED` | 500 | server storage failure -> retry with backoff |

#### R5 Redis resource index

- Laravel config (no `.env`; constants): connection `resource_index` in
  `config/database.php` = host `ServiceContract::host('loopback')`, port
  `config/service_contract.json` `ports.redis` (6379), no password, database
  `LaravelConfig::REDIS_RESOURCE_INDEX_DATABASE` (2), connect timeout 1 s,
  read timeout 5 s, key prefix `LaravelConfig::REDIS_PREFIX`
  (`core-node-database-`). Client phpredis (`LaravelConfig::REDIS_CLIENT`).
- Keys: `resource_index:<kind>:<bucket>` HASH, bucket = `md5(field)[0:3]`
  (4096 buckets per kind), field = the diff key, value = `1` (word/sentence/
  orch_segment), audio sha256 (article), byte size (static_file).
  `resource_index:meta` HASH: `<kind>:entries`, `<kind>:built_at`.
  Bucketed small hashes follow the Redis memory-optimization guide (listpack
  encoding); only keys and short values are stored, never file bytes.
- Maintained by one service (`AppQyV1ResourceIndexService`) on every store /
  delete; rebuild: `php artisan app_qy_v1:resource-index rebuild
  [--kind=...]` (idempotent, per-bucket swap, safe to re-run), `status`.
  Both print exactly one machine-readable line `resource_index_built=yes` or
  `resource_index_built=no` (yes = Redis reachable and `resource_index:meta`
  holds `<kind>:built_at` for every indexed kind; `built_at` is written only
  after a kind's rebuild completes); the 175 service script runs
  `rebuild` only when `status` does not print `resource_index_built=yes`.
- Availability: phpredis loaded + PING ok; a failure disables Redis for 30 s
  per worker, then retried. Without Redis every diff uses DB/disk.
- W9 server config: Redis (or Dragonfly) on 127.0.0.1:6379, no auth, bind
  loopback, `databases >= 3`, `maxmemory-policy noeviction`,
  `hash-max-listpack-entries 1024`, `hash-max-listpack-value 128`,
  `appendonly yes` recommended (index is rebuildable). FrankenPHP needs the
  phpredis extension (`START_REDIS=true` makes the static builder include
  `redis`). After Redis is first installed, run the rebuild command once
  (safe any time).

### W9 implementation record (R6, shell scripts, 2026-09-27)

Laravel reads Redis settings from PHP constants and the service contract
(`hosts.loopback`, `ports.redis`), not from `.env`, so W9 writes no env keys.
The scripts converge the store, its config, phpredis and the index build.

- New shared lib `scripts/shells/linux/common/redis_endpoint_common.sh`:
  - `redis_endpoint_ensure` (175 init) runs these steps in order, each only
    when the endpoint is still unreachable:
    1. PING `127.0.0.1:6379` (redis-cli, else bash `/dev/tcp`) and reuse
       any Redis, Dragonfly or container that answers.
    2. Start Dragonfly if `START_DRAGONFLY=true`.
    3. Start the installed `redis-server`.
    4. Run `73_install_redis.sh` if the redis-server binary is missing.

    It then records `LARAVEL_REDIS_ENDPOINT=<kind>@host:port` and sets
    `START_REDIS=true` or `START_DRAGONFLY=true` for the store kind, so a
    later dd.sh run of 73 or 71 cannot stop the store Laravel uses.
  - `redis_endpoint_config_ensure` applies the W7 contract to a local
    redis-server: `maxmemory-policy noeviction`,
    `hash-max-listpack-entries 1024`, `hash-max-listpack-value 128`,
    `appendonly yes`. It checks the live value (`CONFIG GET`, then `CONFIG SET`
    only on difference) and the `redis.conf` line (rewrite or append only on
    difference) separately. No restart is needed. It does not change
    Dragonfly or external stores.
  - Memory hard cap (user directive 2026-09-27): Redis and Dragonfly may use
    at most 10% of system RAM (`REDIS_ENDPOINT_MAXMEMORY_PERCENT=10` of
    `/proc/meminfo` MemTotal, no floor). The index stores keys and short
    values only, never file bytes.
  - `redis_endpoint_maxmemory_ensure` (redis-server) updates the live value
    and the `redis.conf` line only when they differ. The line this script
    owns follows the marker `# core_node managed: maxmemory` and follows RAM
    changes. An explicit cap without the marker is kept only when it is
    non-zero and not above the hard cap; a higher one is lowered.
  - `redis_endpoint_dragonfly_maxmemory_ensure` (Dragonfly) writes
    `--maxmemory=<cap>` and `--proactor_threads=<n>` into the flagfile of the
    `dragonfly` unit (from `systemctl cat`, default
    `/etc/dragonfly/dragonfly.conf`), each only when it differs, and restarts
    the unit only on a change. Dragonfly requires at least 256 MiB per
    thread, so `n = min(cap / 256 MiB, nproc)`; when 10% of RAM is below
    256 MiB, the 256 MiB minimum is used and a warning is printed.
  - With `noeviction`, writes fail at the cap instead of exhausting RAM, and
    W7's diff falls back to DB/disk.
  - `redis_endpoint_service_state_ensure` is used by the systemd launchers
    `175_laravel_main_service_{frankenphp,nginx}.sh`. It only starts the
    selected store when it is down and never installs anything.
- phpredis (`LaravelConfig::REDIS_CLIENT=phpredis`, so predis is not used):
  - `fm_php_redis_extension_desired` (`frankenphp_runtime_common.sh`)
    returns yes when `START_REDIS`, `START_DRAGONFLY` or
    `LARAVEL_REDIS_ENDPOINT` is set. It is the single switch for the static
    builder extension set (it replaces the raw `START_REDIS` check), the apt
    package `php-zts-redis` (`FRANKENPHP_APT_REDIS_PACKAGE`, installed only
    when missing, purged when the apt variant is retired), and the compile
    rebuild trigger (`fm_ensure_dnspod_module`). The prebuilt release already
    embeds `redis`.
  - `fm_php_install_extensions_ready` is the floor plus the desired
    extensions. `ensure_php_pdo_pgsql` uses it to decide when to run 93.
    `FRANKENPHP_RUNTIME_REQUIRED_PHP_EXTENSIONS` (the fail-closed runtime
    floor) is unchanged, so missing phpredis never stops the plane; Laravel
    uses its database path instead.
  - On the nginx plane, `ensure_php_redis` installs the distro `php-redis`
    package only when the module is missing.
  - If 93 or apt changed extensions, the re-run path restarts the plane unit
    instead of doing a worker reload, because a new extension loads only in
    a fresh process.
- Index: after `sys:init`, `ensure_laravel_redis_index` checks
  `php artisan app_qy_v1:resource-index status` for
  `resource_index_built=yes`. If that line is missing, it runs `... rebuild`
  once and checks again.
- 175 order: `resolve_php` -> `redis_endpoint_ensure` ->
  `ensure_php_pdo_pgsql` (93 repair) -> `ensure_php_redis` -> ... ->
  `sys:init` -> `ensure_laravel_redis_index`.
- Idempotency: every step first probes the actual state (PING, binary, unit
  state, live config, conf line, dpkg state, loaded extension, index status)
  and writes only when it differs. When everything is already correct, a
  re-run changes nothing.
- Risks:
  - The first run on a compile-variant host triggers a full static rebuild
    to add `redis`, which takes a long time on 2-core hosts.
  - The index status check runs through the CLI `php` link. If a static
    variant's CLI does not load `redis`, the check reports "not built" and
    only a warning is shown.
  - `appendonly yes` adds disk writes. Redis and Dragonfly memory is capped
    at 10% of RAM (see above). At the cap, index and cache writes fail until
    the index is trimmed; diffs stay correct through the DB/disk fallback.
  - Dragonfly with the derived `proactor_threads` uses fewer cores than its
    default (one thread per 256 MiB of cap).

### W7 implementation record

Root `poly_apps/laravel_main`. Contract above is implemented as written.

- R2: `app/Support/LaravelServerIdentity.php` (reuses
  `DataSyncMachineIdentity`; nonce file
  `<laravel_data_dir>/identity/server_<machine_code[0:16]>.json`, created
  under a file lock; cached per worker). `/api/health` returns `server_id`
  (`routes/api.php`); `delivery/info` too.
- R1: `AppQyV1Services/AppQyV1DeliveryDiffService.php` (stateless, slices of
  500 keys, 50 for per-key-query kinds `orch_output`/`article`, 8 s budget →
  `complete`/`next_index`). `orch_output` = `AppQyV1OrchAudioService::
  diffTasks` (the former `probe`; route, controller method and
  `orch_audio_probe_ok` string removed). Controller
  `AppQyV1Controllers/AppQyV1Delivery/AppQyV1DeliveryCtl.php`, routes
  `routes/AppQyV1Router/AppQyV1Delivery.php` (required from `routes/api.php`),
  `AppQyV1ApiInfo.php` entries, i18n `lang/{en,zh_CN}/delivery.php`. W5
  ingest validation rules (`MACHINE_ID_RULE`, `SHA256_RULE`,
  `SEGMENT_LIMIT`) are shared from `AppQyV1OrchAudioCtl` instead of copied.
- R3: `AppQyV1Services/AppQyV1DeliveryBatchService.php`: manifest state JSON
  + content under `<laravel_data_dir>/writeback/app_qy_v1/delivery_batch/`;
  content through `AppQyV1DurableOffsetUploadService::receive` /
  `promoteCompleted` / `alreadyStoredReceipt` (no second upload
  implementation); items sliced with `FileSystemManager::readFileSegment`,
  stored by `AppQyV1DictionaryTTSCoordinator::storeWordAudioBytesDetailed`
  and `AppQyV1SentenceAudioService::report` (same fill-missing/idempotency
  as the single-item endpoints); processing runs in `defer()` under a batch
  file lock with a checkpoint every 20 items; a status poll resumes a batch
  idle for 30 s (5 s inline budget). Sentence items without `text` whose
  sentence row does not exist yet end as `no_target`.
- R5: `app/Utils/RedisBucketIndex.php` (generic bucketed-hash index:
  pipelined `HMGET`/`HMSET`/`HDEL`, per-bucket `RENAME` swap on rebuild,
  availability cache 5 s, 30 s back-off after a failure) and
  `AppQyV1Services/AppQyV1ResourceIndexService.php` (kinds, key formats,
  DB/disk verification, self-heal of misses and stale hits, rebuild
  sources). Write hooks: `DictionaryTTSCoordinator::markWordCompleted`
  (every word completion path), `SentenceAudioService::report` (stored and
  already-present paths), `OrchAudioService::completeSegment`,
  `DailyReadingService::replaceAudioBytes` (agent-history articles only),
  `ArticleManagementService::delete` (forget). Rebuild sources: word = DB
  rows (`has_audio`, `audio_files` variants; columns probed per language),
  sentence / orchestration = file walk, article = agent-history rows,
  static_file = static tree minus `app_qy_v1/audio/`. Command
  `app/Apps/AppQyV1/AppQyV1Commands/AppQyV1ResourceIndexCommand.php`
  (`app_qy_v1:resource-index rebuild|status [--kind=]`), registered in
  `AppServiceProvider` (no change under `app/Console`). Config:
  `LaravelConfig::REDIS_RESOURCE_INDEX_*`, `config/database.php`
  `redis.resource_index`.
- Shared refactor: `FileSystemManager::iterateFiles()` (lazy generator over a
  tree); `fileManifest()` now iterates through it. Orchestration segment path
  centralised as `AppQyV1OrchAudioService::segmentAudioRelative()` /
  `SEGMENT_AUDIO_SUBDIR` (used by the index).
- Research followed (context7): Redis docs "Memory optimization" (store many
  small values in small hashes that keep the compact encoding; tune
  `hash-max-*` entries/value) → 4096 buckets per kind; Redis `HMGET`/
  `SMISMEMBER` + pipelining (one round trip per batch; `SCAN` not `KEYS`,
  here avoided entirely because bucket keys are enumerable); Laravel 13
  Redis docs (`Redis::connection(name)`, `pipeline(callback)`, phpredis
  `timeout`/`read_timeout` connection options). Bucketed `HMGET` was chosen
  over per-kind SETs + `SMISMEMBER` because it carries the value needed for
  `stale` (article sha, file size) and uses less memory at millions of keys.
- Docs: `DESIGN_20260917_AUDIO_ORCHESTRATION.md` (probe → diff),
  `REQUIREMENTS_20260927_PROMPT_REWRITE_AUDIO_ORCH_STANDALONE.md` (W5 probe
  marked removed).

Risks / limits:

- Delivery routes have no cryptographic machine auth (same trust level as
  W5 ingest / article worker).
- Writers not hooked (Laravel-side EdgeTTS generation, Bing/assist word
  writes that bypass `markWordCompleted`, file deletions outside
  `ArticleManagementService`) only cost verification: misses are always
  checked against DB/disk, so the index never produces a false "missing";
  a file deleted outside the hooks stays "present" at most until the
  reconcile pass reaches its bucket (see the reconcile follow-up below).
- A cold index (never rebuilt) makes the first diffs run at fallback speed
  (bounded per call by the time budget) while self-healing; run the rebuild
  once after Redis is installed.
- Entries written between the staging scan and a bucket swap of a rebuild
  can be dropped (they reappear as verified misses).
- `article` misses cost one JSON-metadata query per key
  (`findAgentHistoryBySourceRecordId`); acceptable for the agent-history
  volume, slices of 50 keep the budget effective.
- Word presence follows the upload rule: primary = `has_audio` or a file,
  so a row flagged `has_audio` without a file is not reported missing (the
  upload would answer `exists`).
- Batch processing after the response relies on `defer()` in the FrankenPHP
  worker; if it is lost, the status poll resumes it.
- Not run: migrations (none added), services, tests, builds; only `php -l`.
- Follow-up (W8/W9/lead requests): `status` prints `resource_index_built=yes|no`
  (`AppQyV1ResourceIndexService::built()`); `X-Core-Node-Server-Id` header via
  `app/Http/Middleware/ServerIdentityHeader.php` on health, delivery and
  orchestration ingest routes. Both added to the contract.
- Follow-up (lead: false-present risk): bounded reconciliation, same
  contract.
  - `AppQyV1ResourceIndexService::reconcile(budget)`: per call (at most one
    full pass) (1) one slice of up to 1000 entries from the word/article
    rebuild sources after a persisted row cursor (`reconcile:add_cursor:<kind>`,
    word cursor `<lang>:<row id>`, article `<row id>`; the rebuild generators
    now take the cursor, no second walker); (2) walks the index buckets of
    every kind in order from the persisted cursor `reconcile:bucket_cursor`
    (HGETALL per bucket via `RedisBucketIndex::bucketEntries`), re-verifies
    entries with the same verification the diff uses, drops vanished /
    rejected entries and fixes changed values; `reconcile:pass_completed_at`
    marks a finished pass. Cursors live in `resource_index:meta`.
  - Scheduler: the project's only scheduler is the Octane timer catalog;
    `app/Services/TimerTasks/AppQyV1ResourceIndexReconcileTask.php` runs
    every 60 s with a 2 s budget (disabled while Redis is unavailable or a
    DataSync session is active).
  - Command: `php artisan app_qy_v1:resource-index reconcile [--seconds=300]`
    (same slice logic; prints counts and the `resource_index_built=` line).
  - Delete paths audited (unlink / File::delete / FileSystemManager::delete
    under the audio and static roots): article audio (`ArticleManagementService::
    delete` → `forgetArticle`, already hooked), cover images
    (`AppQyV1CoverImageService::deleteCover`, `AppQyV1VocabularyCoverService::
    deleteCoverFile` → new `forgetStaticPath`). The remaining unlinks in
    word/sentence/article writers only roll back a just-written file that was
    never indexed; EdgeTTS zero-byte cleanup removes files that were never
    present (verification requires size > 0; word presence is DB-based);
    the external-data migrator removes the old pre-migration root, not an
    indexed root.
  - Remaining risk: a vanished file stays "present" for at most one
    reconcile pass (5 kinds x 4096 buckets, 2 s per minute; pass time
    depends on index size, e.g. millions of sentence entries = hours) or
    until the next rebuild; file-backed kinds (sentence, orchestration,
    static) get additions only from diff self-healing and rebuilds (a
    missing index entry never causes a false "missing", only a slower diff).

### W8 implementation record (R1-R4 pycore)

One namespace-aware outbox (`pycore/pyutils/laravel/delivery_outbox.py`),
one diff/batch client (`pycore/pyutils/laravel/delivery_diff.py`), one
transport (`laravel_client` + `http_progress_client` + offset-v1
`laravel_progress_uploader`), one identity model (`identity.py` +
`endpoint_manager.py`).

- R2 server namespace
  - `identity.py`: `laravel_server_namespace(server_id, base_url)` =
    `server:<server_id>`, or `url:<base_url>` for a legacy server without an
    id; `parse_laravel_server_identity` (health body);
    `LARAVEL_SERVER_ID_HEADER`.
  - `endpoint_manager.py`: `LaravelReachability` also keeps the server id per
    endpoint URL, persisted in `laravel_endpoint_cache.json` section
    `laravel_servers` (the namespace of an offline endpoint stays known). Fed
    by every health probe (body `server_id`) and every `laravel_client`
    response (header `X-Core-Node-Server-Id`). `LARAVEL_ONLINE_EVENT` fires on
    an offline -> online edge and when the namespace behind a URL changes;
    payload `{at, base_url, namespace, previous_namespace, server_id,
    reason}`. New: `server_identity(url)`, `delivery_namespace(url)`,
    `base_url_for_namespace(ns)` (active endpoint when it serves that
    server, else a reachable configured one), `known_servers()`.
  - Schema v2 (`database/schema/laravel_delivery_schema.py`): rows get
    `namespace` + `item_key` (stored id `<namespace>|<logical id>`);
    `delivery_state (namespace, kind, item_key, content_hash, receipt)`
    replaces `delivery_receipts`; metrics keyed `(namespace, kind)`;
    `delivery_meta` (seed namespace, per-kind seed flag, content-hash
    cache). Repository methods are namespace-scoped;
    `adopt_namespace(url_ns, server_ns)` moves rows/state/metrics when a
    legacy URL namespace is identified as a server.
  - Migration of un-namespaced state: v1 rows go to the namespace of the
    endpoint they recorded (`base_url`, then pinned), else to the active
    endpoint (where v1 would have delivered them). v1 receipts (no server
    known) are dropped. Domain markers (`orch task.output_delivery`,
    agent-history `uploaded` / `rebuild_uploaded`) are seeded once into the
    namespace of the endpoint selected at upgrade time; they are never read
    again. For a W7 server the seed is irrelevant (the diff decides).
- R1 diff-driven reconnect
  - Triggers: online / identity edge of any configured endpoint, endpoint
    switch (`register_endpoint_change_listener`), outbox start, a kind
    registered after start, the UI "Re-diff" (`ui/laravel_delivery/retry`
    `{kind?, reconcile: true, namespace?}`; `backfill` removed).
  - `reconcile(namespace)`: single flight per server (requests during a run
    are queued); per inventory kind: `inventory()` -> `{key, hash, record,
    wire?, diff_kind?}` -> `delivery/diff` (chunked by the server's
    `delivery/info` limits, resend from `next_index`, progress = processed
    items, idle window only) -> `need` `missing` into the kind, `stale` into
    its `stale_kind`; the namespace's delivered-state entries for those keys
    are dropped first (local state never wins over the server). `rejected`
    items are not uploaded. Diff status per namespace/kind (`state, mode,
    phase, processed/total, missing, stale, rejected, enqueued, error`) is in
    `stats(kind).by_namespace[ns].diff`.
  - Legacy server (no `server_id`, or `delivery/info` unavailable): kinds
    with `legacy_reconcile` diff locally against that namespace's delivered
    state, only for the active endpoint (the previous backfill behavior, now
    per server). New items fan out to the active and every reachable server.
  - Kinds:

    | kind | inventory (wire kind, key, hash) | missing / stale | legacy server |
    | --- | --- | --- | --- |
    | `audio_cache.resource` (replaces `audio_orch.resource`) | every local word/sentence clip in `audio_resource_ledger`; `word_audio` `<lang>:<md5>[:variant]` / `sentence_audio` `<lang>:<content_id>[:variant]`, presence only | batch upload (W7), single report/fill-missing as fallback | no reconnect diff; new clips still fan out |
    | `audio_orch.output` | deliverable tasks; `orch_output` `{key: task_id, meta_hash}` (meta_hash cached per output version in `delivery_meta`) | W5 ingest + missing segments | local diff |
    | `agent_history.article` (+ `article_audio`) | every record; `article` `{key: record_id, sha256}` (mp3 sha cached per size/mtime) | missing -> full submit; stale -> `agent_history.article_audio` replace-audio | local diff |
    | `audio_lane.word` / `.sentence` | none: rows keep only the server-specific steps (domain report / task result to the dispatching server, local history); the clip is shared with `audio_cache.resource` | - | unchanged |
- R3 batch + progress: `delivery_diff.upload_batch` = manifest POST ->
  offset-v1 content through `laravel_progress_uploader` (bytes are
  progress) -> status poll until `done` (`processed` is progress; only the
  contract idle window fails); 404/409 re-post the manifest once. The
  outbox gained `DeliveryKind.deliver_batch` (one call per server group of
  ready rows; rows it does not answer take `deliver`). Every call uses
  `activity_timeout=http_transfer_contract()`; the word fill-missing upload
  lost its fixed 600 s timeout.
- R4 merge / side effects
  - Nothing starts at import: `register()` only records a kind; drains,
    reconcile, the online-edge subscription, migration and the startup
    flush run from `laravel_delivery_outbox.start()`, called by the runtime
    step `laravel_delivery` (`pyctl/laravel/delivery_service.py`,
    `pyctl/runtime/event_handlers.py`), which also registers the
    orchestration and agent-history kinds (`orch_delivery.register()`,
    `agent_history_delivery.register()`; no longer in `__init__`). The lane
    worker constructor no longer writes the outbox (startup flush moved to
    `start()`).
  - Deleted: legacy audio-outbox import (`_legacy_audio_rows`,
    `_legacy_rows`, `LEGACY_AUDIO_*`), the orphaned intermediate store
    (`pyutils/common/durable_record_store.py`,
    `database/repositories/json_record_store.py`, `TableKeys.JSON_RECORDS`),
    receipts table API, `DeliveryKind.backfill` and all kind backfills
    (`orch_delivery.backfill_outputs`, `_mark_output_delivered`,
    agent-history `_backfill_*`, `article_records.pending_uploads` /
    `pending_rebuild_uploads`), duplicate JSON envelope parsers (now
    `client.laravel_envelope`).
  - Fixed: `orch_service` called `orch_delivery.output_counts()` without
    tasks (TypeError); `task_get` now counts only its task.
- UI: `PcDeliveryOutboxStatus` shows per-server rows (server label, active
  marker, pending/dead/delivered, diff progress/result, per-server re-diff);
  `OrchDeliveryPanel` (kinds `audio_orch.output`, `audio_cache.resource`) lists every configured endpoint (URL, online/offline,
  server id or legacy, diff running). Types `LaravelDeliveryNamespaceStatus`,
  `LaravelDeliveryDiffStatus`, `LaravelServerIdentity`; API
  `retryLaravelDelivery(kind, reconcile, namespace)`; i18n
  `queueCenter.deliveryOutbox.{server,unassigned,activeServer,serverOnline,
  serverOffline,serverUnknown,serverId,legacyServer,reconciling,reconcile,
  reconcileTitle,diff.*}` (en/zh).

- Local audio cache clips (lead follow-up): one cache-level kind
  `audio_cache.resource` (`pyctl/tts/audio_resource_delivery.py`) replaces
  `audio_orch.resource`; its v2 rows / state / metrics fold into it at start
  (`DeliveryKind.replaces`, `repository.rename_kind`).
  - Source of truth: `pyutils/tts/audio_resource_ledger.py`
    (`APP_CONFIG_DIR/audio_resources.sqlite3`, table
    `util_speech.audio_resources`, key `(kind, resource_key)` -> newest file,
    text, language, variant, provider). The word cache file name and the
    content-addressed sentence cache cannot give back the text, so every
    producer records the clip: `word_audio_cache.save_to_cache` /
    `store_bytes`, audio lane staging (retained payload copy, with
    `variant_key`), orchestration resolution (cache/Laravel hits recorded,
    generated clips published). One-time bootstrap (outbox meta
    `audio_cache.ledger_bootstrap`): word cache files `<lang>/{word}_{provider}.mp3`
    with an unambiguous name (one `_`, letters/digits), every orchestration
    manifest, the lane task history (last 1000 per lane).
  - `publish(...)` records the clip and queues it for every target server
    (no second file copy; the ledger path is durable). The lane stages its row
    for the dispatching server and publishes the clip for every other server
    (for its own server too when the row has no domain identity).
  - No double transfer per server: lane rows carry `shared_item {kind,
    item_key}`; the outbox treats the lane payload step as done when that
    server's delivered state already has the clip, and a lane row that
    uploaded the clip itself (`identity_receipt.uploaded`) writes the clip's
    delivered state for the cache kind.
  - Single-clip fallback (legacy server / unbatchable size) uploads the
    primary variant only; a variant row on a legacy server is settled
    (`variant_requires_batch`), since such a server receives variants through
    its own lane tasks.

- Language keys: every `<lang>` of a diff / batch key is built by the one
  central normalizer `pyfoundations/text_parsing.normalize_language_code`
  (bare lowercase code; `en-US` / `zh_CN` -> `en` / `zh`; names such as
  `English` -> `en`, the same name map as Laravel
  `AppQyV1TableMaps::normalizeLangCode`, plus `cn` -> `zh`), through
  `audio_resource_ledger.resource_key` (the only language-bearing key
  builder; article and orch_output keys are ids). Ad-hoc normalizers routed
  through it: `engine_policy.normalize_tts_language` (its `_LANGUAGE_ALIASES`
  removed), agent-history `audio_stage._tts_lang_code` (its `_TTS_LANG_MAP`
  removed; unsupported codes still fall back to `en`), translation
  `_google_language` (uses the central name map; region codes kept for
  googletrans). Engine-specific converters (Whisper, PaddleOCR model names)
  are not language normalizers and stay.

Behavior differences:

- A server switch or a second server now receives the full history it lacks
  (per its diff), instead of nothing (v1 markers counted globally).
- Agent history: replace-audio is sent whenever a server's published audio
  sha differs from the local mp3 (not only for rebuilt multi-sentence
  records); the article record flags are display only.
- Orchestration outputs are compared by `meta_hash` on the server; a task
  whose meta_hash changed (e.g. sentences became available) is re-sent
  (idempotent upsert).
- New items fan out to every server currently observed reachable, not only
  the active one.
- Agent-history heartbeat no longer backfills each tick; it diffs the active
  server once per process after the feature is on.

Risks:

- The first reconcile after the upgrade reads every orchestration segment
  (meta_hash) and every article mp3 (sha256) once; results are cached.
- `meta_hash` includes cached book sentences; computing it may start a book
  sentence sync (pre-existing `cached_task_sentences` behavior).
- Fan-out uploads to every reachable configured server (including e.g. dev
  servers the UI probed).
- A legacy URL namespace is adopted into the first server id seen at that
  URL; a URL that later serves a different server keeps the adopted state
  (the server's diff corrects it).
- Sentence cache files produced before the ledger (no text, no lane
  history entry, no manifest) are not in the inventory; they reach other
  servers only when a producer records them again.
- A reconcile of a lane's own server can queue a cache row for a clip whose
  lane row is still pending (the diff reports it missing): one duplicate
  idempotent fill-missing upload at most.
- Every word the Kokoro batch stores (including non-dictionary tokens) is in
  the ledger and diffed; Laravel answers `rejected no_target`, nothing is
  uploaded, but each diff carries them.
- A language outside Laravel's code set still comes back `invalid_key` /
  `unsupported_language` (not uploaded).

Not run: services, tests, builds, type checks; only `py_compile` and static
AST name/import checks (no pycore module was imported in a live process).
