# Queue Pipeline (word / sentence / translation data between Laravel and pycore)

Scope: how missing word audio, sentence audio, word translation and word validity are defined, loaded, scheduled across pycore nodes, generated, delivered and observed.

Authority: code > config/*_contract.json > this document. Contract: `config/queue_center_contract.json` (sections named below).

## 1. Components

| Side | Owner | Role |
|---|---|---|
| Laravel | `AppQyV1Models/Concerns/AppQyV1MediaGaps` | the one gap predicate set + partial indexes |
| Laravel | `App\Services\QueueCenter\DictLane\{DictLaneCatalog, DictLaneQueueCenter, DictLaneMaintenance}` | dictionary lanes as SQL views, keyset listings, just-in-time claim tasks, on-demand maintenance |
| Laravel | `App\Services\WorkLeases\{WorkLeaseLanes, WorkLeaseService}`, `WorkLeaseController`, `TimerTasks\WorkLeaseReaperTask` | multi-node work leases on gap rows |
| Laravel | `App\Support\QueueProgress` | the one progress builder |
| Laravel | `QueueCenterService`, `QueueCenterMetricsService`, `QueueSliceDiffService`, `QueueHeadService`, `QueueHeadNotificationService`, `QueueCenterRealtimeService`, `QueueCenterCacheStore` | task queues (non-lease types), head tickets, diff revisions, realtime |
| Laravel | `AppQyV1DeliveryDiffService`, `AppQyV1DeliveryBatchService`, `AppQyV1ResourceIndexService`, `App\Utils\RedisBucketIndex`, `LaravelServerIdentity` | delivery diff, batch upload, Redis resource index, server identity |
| pycore | `pyctl/laravel/worker/{work_leases, task_puller, task_claims, claim_ledger, registration, event_log, host, handler_worker}.py` | lease client + `LeaseBook`, bounded typed pull for non-lease types, worker identity |
| pycore | `pyctl/tts/audio_lane_leases.py` (`AudioLaneLeases`) | lease intake of one audio lane |
| pycore | `pyutils/tts/audio_queue_center.py` (`audio_queue_center`), `audio_task_queue.py`, `audio_queue_part1.py`, `audio_queue_model.py` | the per-lane Queue (Part1 + Part2) |
| pycore | `pyctl/queue_center/audio_lane_state.py` (`AudioLaneState`, `AssistSummary`), `snapshot_service.py` | lane state push, summary line, realtime intake |
| pycore | `pyutils/laravel/delivery_outbox.py` + `pyutils/laravel/delivery/*`, `delivery_diff.py`, `endpoint_manager.py`, `identity.py` | durable delivery outbox per Laravel server |

## 2. sys:init loading

Order (dry-run reviewed; sys:init writes the DB):
1. Directories, then `migrate --force` (creates `tts_cache_<lang>`, per-language sentence tables).
2. Dictionary schema alignment: `AppQyV1DBTablesBrige/AppQyV1DictionaryTableSchema::ensure(connection, lang)` is the single owner of the `tts_cache_<lang>` / `_staging` column and index set (base, validity, TTS state, image state, bing, audio_files, global-task link, `tts_lease_id`, `tts_lease_expires_at`). Add-only. Callers: migration 05_19 and `UserSyncService::ensureMultiLangDictionaryTablesExist`. Ends with `AppQyV1MediaGaps::ensureWordIndexes`.
3. Sentence table alignment: `MediaIngestTablesInitializer` adds `obsolete_at`, `origin`, `tts_priority`, `tts_lease_id`, `tts_lease_expires_at`, then `AppQyV1MediaGaps::ensureSentenceIndexes`.
4. Global task tables, then the AppQyV1 initializer: verify tables; seed vocabulary (importer, md5 unique, skipped once the library has word ids); seed books (one atomic `MediaIngestService::ingest`, source_key sentinel; sentences upserted by `content_id`); prompts; daily library; self-heals.
5. AppQyV1 self-heals (idempotent, non-destructive):
   - `AppQyV1SentenceOriginRepair`: agent-history article sources move to obsolete grains, their unreferenced rows get `obsolete_at`, their live `sentence_audio` tasks are cancelled; then rows with `origin IS NULL` are classified (referenced -> `content`, unreferenced `reader|` rows -> `adhoc`).
   - `AppQyV1DictionaryWordRepair`: dictionary rows whose content still carries an HTML entity (`wretch&#39;s`; keyset walk `id > cursor` per language, one `UNION ALL` count first) get their canonical word added (`ensureContents`) and are kept but marked `is_valid = false`, `validity_source = normalize`, `validity_note = html_entity_decoded|html_entity_rejected`, so they leave the audio gap and the translation work; re-runs skip them. Result carries `progress` (`QueueProgress`).
   - `AppQyV1VerseResegmentation`: dirty rows with glued verse markers are rebuilt verse by verse through the set-based ingest (slots streamed by keyset on `seq`, `lazyById`); orphaned dirty rows get `obsolete_at`; dirty rows still referenced by a source it does not rebuild (not book/document) are reported as `kept_dirty` (= `progress.failed`). Read-only count: `php artisan tinker --execute='print_r((new App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1VerseResegmentation)->scan());'`.
   - Work-lease re-pool: `WorkLeaseService::repoolCapabilityFailures()` returns rows failed with a `work_leases.repool_error_codes` code to the pool; `retireGapTickets()` cancels pending word/sentence gap-row tickets (`GlobalTask::cancelPendingGapTickets`; article tickets with `target_kind`/`article_id` stay).
   - Word validity coverage step reports per-language unchecked counts (`validitySummary`: unchecked = `WORD_VALIDITY_WORK` on its partial index, invalid = `WORD_INVALID`, total = planner estimate; no whole-table scan).

Rules:
- Word normalization owner: `AppQyV1LangDictionaryModel::canonicalWord` (HTML entities decoded, at most two passes; blank, control characters or an undecodable entity -> rejected) and `wordMd5` (lookup hash of the canonical form). Every dictionary write path goes through it: `insertRows`, `ensureContents`, `findOrInsertContent`/`createOrFind` (null for a rejected word), `storeTranslationCache`, and the staging -> formal promotion (`promoteStagingToFormal`, keyset `chunkById`).
- Seeded words and sentences enter with `has_audio`/`has_translation` false and `validity_checked_at` NULL; they are visible in the gap lanes with no enqueue.
- Book ingest is set-based: `MediaIngestService::ingestSlotsV3` writes chunks of at most 500 slots (never spanning a chapter); one `whereIn(content_id)` read and one `upsert(..., uniqueBy ['content_id'])` per chunk; on conflict it adds occurrences and backfills empty `sentence_id`/`corr_id`; text, AI and audio columns are never touched.
- Seed parser `AppQyV1BookSeedImporter::verseSlots` reads only structural fields (book, chapter, verse, `texts[edition]`), cuts each language with `SentenceSegmenter::split`, pairs languages sentence by sentence when counts match, otherwise keeps one slot per verse. No slot spans two verses. Slot metadata: `book, abbr, book_chapter, verse, ref, sentence`.
- Segmentation and the import gate live in `config/sentence_segmentation_contract.json` `verses` (`verse_vectors`, `gate`, `gate_vectors`); adapters `SentenceSegmenter::splitVerses/hasVerseMarker/gateViolation` (PHP), `split_verses/has_verse_marker/gate_violation` (Python), `core/contracts/SentenceSegmenter.ts`. A rejected sentence (`SENTENCE_GLUED_NUMBER`, `SENTENCE_VERSE_REFERENCE`) is counted, logged and never stored.
- Ingest guard: a book/document slot text that still carries verse markers loses them before `content_id` is computed, and its first verse goes to slot metadata; a slot merging several verses is logged (splitting is the producer's job). The pycore producer (`pyctl/laravel/sync/book_payload.py` → `book_structure.build_book_chapters_v3` → `book_processor.segment_sentences`) uses the shared `split_verses` for both grains and writes `metadata.book_chapter` / `verse` / `ref`.
- `MediaIngestService::ingest` rejects an `article` source that is agent-history text (`SENTENCE_SOURCE_NOT_CONTENT`); the article library backfill skips agent-history articles.
- Sentence rows created outside a content ingest (`AppQyV1SentenceAudioLookupTrait::ensureSentenceRow`, playback/report text) carry `origin = adhoc`; a later content ingest of the same text adopts the row (`origin = content`).
- Every content writer goes through the one set-based sentence upsert (`MediaIngestService::upsertLangSentences`, `origin = content`): book/subtitle/document/article ingest, vocabulary document extraction (`AppQyV1VocabularyDocumentController::extractSentences` -> `ingest`, source `document`, key `doc_<id>`, already-linked positions skipped), study-gen write-back (`MediaIngestService::upsertContentSentences` + `AppQyV1LangSentenceModel::fillExplanation`), and the verse rebuild (`ingestSlots`, occurrences not re-counted).
- Corpus location: `config/service_contract.json` `book_seed` (`archive_name`, `archive_subpath`, `top_dir`, `target_subpath`), shared with the shell step that extracts it; `AppQyV1BookSeedImporter::corpusRoot()` = `<laravel_db>/<target_subpath>/<top_dir>`.
- Deploy: run `php artisan sys:init` before new code serves sentence queries (they reference `obsolete_at`/`origin`), then restart Octane.
- Schema gate (contract `schema_gate`, `App\Support\SchemaGate`): the required revision is a hash of the definitions the alignment applies (`AppQyV1DictionaryTableSchema::formalStructure` columns, `MediaIngestTablesInitializer::sentenceLangStructure` columns, `AppQyV1MediaGaps::indexDefinitions`). Both alignment owners call `SchemaGate::recordIfAligned()` when they finish: it checks every supported language's word and sentence table for the required columns (one `information_schema` listing per table kind) and writes the revision to the var center (`PathMapper::writeGlobalVar('LARAVEL_GAP_SCHEMA_REVISION')`, OS-tagged, so dual-boot hosts keep one record per database). Readiness is cached per worker (ready stays ready; pending re-reads at most every `retry_after_seconds`).
  - While pending: `/api/health` reports `schema: pending` and `schema_revision {expected, actual}`; middleware `schema.gate` (`RequireGapSchema`, `ApiResponse::retryLater`) answers `http_status` + `error_code` + `retry_after_seconds` (+ `Retry-After`) before any gap-table access on `work/*`, `ai_tools/tts/worker/report`, `sentence/{claim,report,audio,missing,without_audio}`, `delivery/{diff,batch*}`, `dictionary/words`; `WorkLeaseReaperTask::isEnabled` is false with one warning per process.
  - Migrate-only deploys: migration `AppQyV1_2026_10_02_000003_align_gap_table_columns` runs both alignment owners (add-only), so step 175's `migrate` adds the columns and records the revision.

## 3. Gap definitions and indexes

`AppQyV1MediaGaps` is the only definition. Every lane, listing, count, stat, metric, lease and claim applies these constants:

| Constant | Predicate |
|---|---|
| `NO_AUDIO` | `has_audio IS NOT TRUE` (the audio part of every audio gap; also the failed reset `resetFailedTts`) |
| `WORD_HAS_CONTENT` | `btrim(COALESCE(content,'')) <> ''` |
| `WORD_AUDIO` | `NO_AUDIO` + content + `WORD_NOT_INVALID` (a validity-rejected word never enters the audio gap) |
| `WORD_NOT_INVALID` / `WORD_INVALID` | `is_valid IS NOT FALSE` / `is_valid IS FALSE` |
| `WORD_TRANSLATION` | `has_translation IS NOT TRUE` + empty translations map + content |
| `WORD_TRANSLATION_WORK` | `WORD_TRANSLATION` + `is_valid IS TRUE` |
| `WORD_VALIDITY_WORK` | `validity_checked_at IS NULL` + content |
| `SENTENCE_LIVE` | `obsolete_at IS NULL AND origin IS DISTINCT FROM 'adhoc'` |
| `SENTENCE_AUDIO` | `NO_AUDIO` + `SENTENCE_LIVE` |
| `SENTENCE_NOT_LIVE` | `NOT (SENTENCE_LIVE)` (obsolete or ad-hoc rows; subtracted from the `done` estimate) |

- A word row with audio but `tts_status = pending` is a missing variant (per-variant backfill), not a gap row.
- Ad-hoc playback sentences still get audio on request but never join the gap, its listings or counts.
- Partial indexes on the exact predicate text (`SafeMigrationHelper::safeAddPgPartialIndex`, accepts `col DESC`):
  - `idx_dct_<lang>_gap_<gap>_id` (keyset) and `_rank` (`query_count DESC, id`) for gaps `audio, translation, translation_work, validity_work`;
  - `idx_sent_<lang>_gap_audio_lib_id`;
  - lease indexes: `<prefix>_gap_audio_free_lease` on the contract `work_leases.rank` order over the gap rows still in the pool (gap `AND tts_status IS DISTINCT FROM 'failed'`, the failed part of the claim's FREE, so a claim never walks failed rows), `<prefix>_lease_expiry` on `tts_lease_expires_at WHERE tts_lease_id IS NOT NULL` (the reaper), `<prefix>_tts_failed_id` (the resurfacing walk).
- One definition list: `AppQyV1MediaGaps::indexDefinitions(word|sentence, lang)` (name, columns, predicate, `reads` = every column the index and its predicate use). The ensure functions read the table's columns once and build only the indexes whose `reads` exist, logging the deferred ones in one line per table, so migration order never matters: the alignment that adds the columns (`AppQyV1DictionaryTableSchema::ensure`, `MediaIngestTablesInitializer`) calls ensure again and builds the rest.
- Callers: `ensureWordIndexes` from the dictionary schema owner and migration `AppQyV1_2026_10_02_000001_add_media_gap_partial_indexes`; `ensureSentenceIndexes` from the sentence alignment; migration `AppQyV1_2026_10_02_000002_ensure_hot_path_gap_lease_indexes` runs both for every language (so the step-175 migrate creates them without a full sys:init). All ensure calls are idempotent. A language table created later gets its indexes at the next sys:init.
- Builds never block writes: `SafeMigrationHelper::safeAddPgPartialIndexConcurrently` runs `CREATE INDEX CONCURRENTLY IF NOT EXISTS` outside a transaction (both gap-index migrations set `$withinTransaction = false`; the sys:init alignments run outside transactions) and a plain build only inside one. An INVALID index left by an interrupted concurrent build (`pg_index.indisvalid` false) is dropped and rebuilt, only that index and concurrently; one another session is still building (`pg_stat_progress_create_index`) is left alone.

## 4. Dictionary lanes and listings

- Lanes (`DictLaneCatalog`): `word_audio` (`WORD_AUDIO`), `word_translation` and `dictionary_explanation` (`WORD_TRANSLATION_WORK`; `dictionary_explanation_demo` shares the lane), `word_validity` (`WORD_VALIDITY_WORK`); view lanes `without_translation`, `valid` (`is_valid IS NOT FALSE`), `invalid` (`is_valid IS FALSE`).
- A lane is an indexed SQL view; nothing is cached as a lane copy. `rowsAfterId` (keyset `id > cursor ORDER BY id`), `headRows`/`claimHeadRows` (claim order `query_count DESC, id`), `laneCount`. Counts are cached per lane and language (`LockedCache::flexible`, fresh 30 s, stale up to 300 s): one caller recounts, the others get the last value; there is no per-write invalidation.
- Keyset listings:
  - `GET /api/app_qy_v1/dictionary/words?language=&filter=<without_audio|without_translation|valid|invalid>&cursor_id=` returns `next_cursor` (last served id) and `progress`.
  - `GET /api/app_qy_v1/ai_tools/tts/sentence/without_audio?language=&cursor_id=&limit<=1000` returns `next_cursor`, `has_more`, `total`, `progress`.
  - `GET /api/app_qy_v1/ai_tools/tts/sentence/missing?language=&cursor_id=&per_page<=100` (Queue Center "awaiting audio", `AppQyV1SentenceAudioLookupTrait::listMissing`): keyset pages of `SENTENCE_AUDIO` rows with their lease state (`tts_status`/`stage` `leased` while a live lease holds the row, `tts_locked_by`, `assigned_at`); without `language` the language with the largest gap; returns `language`, `cursor_id`, `next_cursor`, `has_more`, `progress`, `total`, `summary.languages` (gap per language).
  - `POST ai_tools/tts/sentence/claim` with `limit: 0` is the counts-only summary: `pending` = the gap (`SENTENCE_AUDIO`), `leased` = gap rows under a live lease, `lock_stale_minutes` = lease TTL in minutes.
  - Offset page jumps exist for the management UI only.
- Just-in-time claim tasks for `word_translation` (40 words/task, `remote_translation`), `word_validity` (contract `word_validity.batch_size`, `remote_validity`, `target_language=zh`) and `dictionary_explanation` (10 words/task): `WorkerController::pullTasks` calls `DictLaneQueueCenter::ensureMaterialized` before the atomic claim; languages whose cached lane count is 0 are skipped. Pile-up guard per language: translation 1, validity 1, explanation 2 live tasks. The head skips md5s owned by live claim tasks (database truth), so a crashed or expired claim returns its words to the head.
- `word_audio` is never materialized; work leases hand out its rows (section 6).
- Word validity and translation are one feature: a validity result with a translation is written through `AppQyV1WordTranslationWriteback::apply()` (fill-missing only); source marker `word_validity.source_marker` (`ai_ensure`).
- Rule: no timer produces dictionary queue work; the backlog is the dictionary table itself.

## 5. Progress template

- Contract `progress_template`: `{total, done, failed, pending, cursor, updated_at, languages?}`, `total = done + failed + pending`. No other keys.
- Built only by `QueueProgress::make`.
- Task queues: done = completed, failed = failed, pending = pending + assigned + processing.
- Gap lanes: done = rows with the artifact, failed = gap rows whose last attempt failed (`tts_status = failed`, kept out of the claim head until the resurfacing sweep or `resetFailedTts`), pending = rest of the gap.
- `cursor` = the consumer's keyset position (last row id served) or the diff revision; null without a consumer.
- One number per language: `App\Services\QueueCenter\GapLaneSnapshot::lane(word_audio|sentence_audio)` is the per-language `{gap, failed, pending, leased, done}` of every language in constant round trips (one `information_schema` column check, one `UNION ALL` over the gap partial indexes with `FILTER` for failed and live-leased rows, for sentences one `UNION ALL` of `SENTENCE_NOT_LIVE`, one `pg_class` read via `TableRowEstimate::rowsOfTables`), cached as one snapshot per lane (`LockedCache::flexible`, fresh 30 s, stale 300 s). Readers: `QueueCenterMetricsService::progress/liveQueue` (every lease claim and renew), `WorkLeaseLanes::gapCount`, `WorkLeaseService::pool/pooled/leasedByLanguage` (work_nodes), `sentence/missing` summary and page totals, `sentence/without_audio` (with and without `language`), assist word-audio counts. Tables lacking the gap or lease columns are left out. Single-language dictionary listings keep `DictLaneQueueCenter::progress`.
- Gap and failed counts are exact and index-backed (partial gap / failed indexes); `done` = the table's planner row estimate (`App\Support\TableRowEstimate`, `pg_class.reltuples`, cached 300 s per table, independent of the dictionary write version) minus the gap (sentences also minus the rows outside the library, `SENTENCE_NOT_LIVE`, counted exactly on the partial index `idx_sent_<lang>_not_live_id`), so `done` is an estimate and no progress read (every lease claim asks) counts a whole table. Listing `total` = pending + failed; listing `progress`, lease `progress` and lane progress are the same object.
- pycore stores `data.progress` exactly as sent (`record_queue_progress`); readers use `languages`/`done`.
- Orchestration task progress (`audio_orchestration.tasks.changed`) uses the same shape over segments.

## 6. Multi-node work leases

Contract `work_leases`; endpoints `work_lease_claim/renew/release` (`POST /api/work/leases/{claim,renew,release}`, client key) and `work_nodes` (`GET /api/work/nodes`, client key or dashboard). Lanes: `word_audio`, `sentence_audio`.

Model: Laravel is the single scheduler. A node claims a work lease = a disjoint batch of gap rows; it renews while working and delivers each item by content. No node mirrors the backlog; a node holds its leased batch plus a prefetch.

Claim (one statement per lane and language, `WorkLeaseService::leaseRows`):
```
UPDATE <table> SET tts_locked_by, tts_locked_at, tts_lease_id, tts_lease_expires_at
WHERE id IN (SELECT id FROM <table> WHERE <gap> AND <FREE>
             ORDER BY <work_leases.rank> LIMIT n FOR UPDATE SKIP LOCKED)
RETURNING id, text, content key, tts_priority
```
- LEASED (`WorkLeaseLanes::LEASED`, row form `WorkLeaseLanes::isLeased`) = `tts_lease_id IS NOT NULL AND tts_lease_expires_at >= now`; it is the only "leased/processing" test (word `statusOf`, word statistics, `leasedCount`, `leasedByLanguage`, metrics cards, pool counts). Pending = gap rows neither failed nor leased.
- FREE (`WorkLeaseLanes::FREE`) = no lease or an expired one, and `tts_status` not failed. Expiry is compared with the bound application `now()`, the same clock that writes, renews and reaps (never PG `CURRENT_TIMESTAMP`).
- Rank: word `tts_priority DESC, query_count DESC, id`; sentence `tts_priority DESC, id`.
- SKIP LOCKED + the row lease make leases disjoint.

Routing:
- Language x engine capability: pycore declares per lane `engine_policy.lane_capability(profile)` (`languages`, `engines` of the lane's pinned engine chain; word = word-batch engine). Laravel leases only declared languages (and for words only languages with a report-id index). A language no online node declares stays pooled with `NO_CAPABLE_NODE`, never failed.
- Compute class (`gpu | cpu_only`, `PycoreComputeRoster::classOf`, from worker registration or the claim; never a platform): lane class from `task_types[].compute`. A gpu node takes gpu_preferred lanes first; a cpu node takes cpu_ok first and gets a gpu_preferred lane+language only while no online gpu node declares it; gpu_required never goes to a cpu node.
- Online = last claim/renew/heartbeat younger than `lease_ttl_seconds`.
- Lane liveness: each declared lane carries `declared_at` in `workers.metadata.work_lanes` (set by a claim, refreshed by a renew of a lease on that lane, `Worker::touchWorkLanes`); routing, `pooled` and `work_nodes` read only `Worker::liveWorkLanes(lease_ttl_seconds)`, so a gpu node that stopped a gpu_preferred lane no longer keeps cpu nodes off it after one TTL.

Batch and throughput:
- batch = clamp(items/h x ttl/3600 x `batch_ttl_fraction`, `batch_min`, `batch_max`), min with the lane's `max_items` (node headroom).
- items/h = max(measured, declared). measured = completions in `throughput_window_seconds` / max(`throughput_min_span_seconds`, now - oldest completion) x 3600, from one-minute counter buckets fed by the reports; 0 below `batch_min` completions. declared = the request's `throughput_per_hour[lane]` = max(node completion rate, parallel slots x 3600 / mean task seconds) (`capacity_per_hour`). The declared value always counts, so a faster node gets a proportionally larger batch.
- Declared lanes, engines and the seed merge per worker_id in `workers.metadata` (`Worker::touchWorkNode`); a claim or renew is the heartbeat.

Lifecycle:
- Shapes: contract `work_leases.claim_request` (`worker_id, compute_class, throughput_per_hour, lanes{lane:{languages, engines, max_items}}, want, lease_ids`) and `claim_response` (`lease_id, expires_at, ttl_seconds, items[{lane, row_id, language, text, content_id|md5, priority}], renewed[{lease_id, expires_at}], lost, retry_after_seconds, progress, pooled[{lane, language, count, reason_code}]`). Items carry no report id; the word report takes the worker-encoded `dict_row_id`. A renewed entry without `ttl_seconds` uses the contract TTL.
- claim: one `lease_id` per claim, TTL `lease_ttl_seconds`; `lease_ids` in the claim are renewed in the same call; `want` (max `want_max`) raises free gap rows of content the node's orchestration queued to priority 100 so they are leased here first; response carries `items`, `renewed`, `lost`, `retry_after_seconds` (empty), `progress` (gap progress per lane) and `pooled`.
- renew: once `renew_after_fraction` of the TTL has passed; a lease with no held row is `lost`: the node drops its unstarted items, logs `LEASE_LOST` (`work_leases.reason_codes`) and shows `leases.lost = {reason_code, leases, rows}` in lane state.
- item report clears that row's lease; a failed item is released back to the pool in batches.
- Retry budget (words and sentences alike): a failure report adds one `tts_attempts` and keeps the row pending (leasable) until `AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS` (3); then `tts_status = failed` and the row leaves the pool. `POST ai_tools/tts/queue/requeue-failed` (`requeueFailedTasks`) resets failed word, article and sentence rows that still lack audio (`resetFailedTts`, `NO_AUDIO`), clearing their lease.
- Failed resurfacing: `WorkLeaseService::resurface()` (run by `WorkLeaseReaperTask`, at most once per `work_leases.resurface_interval_seconds`) returns per lane and language at most `resurface_batch` failed rows still in the gap (`WorkLeaseLanes::resurfaceable`: `AppQyV1MediaGaps::TTS_FAILED` + the lane gap; words also `is_valid IS NOT FALSE`) to pending with `tts_attempts = 0` and a cleared lease. A persisted id cursor per lane+language (cache `work_lease:resurface:cursor:*`) wraps at the end of the table, so a transient engine outage never strands rows and each row is retried at most once per sweep, never hot-looped at the head; one `failed resurfacing sweep finished` log line per finished sweep. A table not yet aligned by sys:init is skipped with a warning. Partial index `<prefix>_tts_failed_id` (`ensureLeaseIndexes`) serves the walk.
- release without `lease_id` frees every lease of the worker (lane start, stop, disable, immediate halt, endpoint switch). If the lease registry (cache) is gone, the worker's rows on its declared lanes are freed.
- An expired lease is free for every claim; `WorkLeaseReaperTask` (60 s) clears expired leases for accounting only. `reap()` scans only through `<prefix>_lease_expiry`: a language whose table lacks that index or the lease columns is skipped with one warning per process (same pattern as `resurface()`), never scanned sequentially.
- Promotion: `QueueCenterService::moveToHead`/`schedule`/`promoteGapItem` for a gap row (also manual enqueue through `AppQyV1TaskEnqueueController` and `TaskController::create`) raises `tts_priority` to 1000 (`WorkLeaseService::promote`) and records the `{queue}_head` event (`head_action: promoted`, no task_id); result `{task_id: null, head_action: promoted|not_in_gap|not_requested, status: pooled}`. Article sentences (`target_kind`/`article_id`) keep the task path.
- Retryable failures: a failure whose error carries a `repool_error_codes` code (`word_batch_language_unsupported`, `NO_CAPABLE_NODE`, `LEASE_LOST`, `ENGINE_MEMORY_PAUSED`) returns the row to the pool (status pending, attempt not counted).

Delivery (contract `work_leases.delivery`): results go to the content-keyed reports from any origin (lease, orchestration, delivery batch): sentence -> `audio_sentence_report` by `content_id` (creates the row from `text` when missing), word -> `audio_word_report` by the worker-encoded `dict_row_id`. A report clears the row lease, counts the completion (`WorkLeaseService::noteCompletion`), closes the gap row and settles a pending ticket of the same content; a late or duplicate report answers 200 `already_done`.

Failure cases:
- Node dies: renewals stop; rows are free after at most one TTL. A restarted node releases all leases of its stable worker id at lane start.
- Relay flap: the node works its batch, results wait in the outbox; a late result is accepted; the next renew reports `lost`.
- Laravel down: no claims, nothing re-leased; nodes finish into the outbox and claim with backoff.

Observability: `work_nodes` = per node `{worker_id, compute_class, online, lanes, engines, leases, items_leased, done_per_hour, batch_size, eta_seconds, last_heartbeat_at}` plus per lane x language `pool {gap, leased, free, reason_code}`. `work_nodes.changed` (`realtime.events.work_nodes_changed`, payload `{revision, reason: claim|renew|release|expiry|node|pool, changed_at}`) on the queue-center Mercure topic, leading edge at most every `nodes_event.min_interval_seconds` plus one trailing event (`QueueCenterRealtimeService::publishWorkNodes`); emitted on claim, renew, release, reaper expiry, online-set change and every delivered item. The UI refetches `work_nodes` when the revision moves and once after reconnect; no polling.

Current rule for the lease lanes: word_audio and sentence_audio gap rows are never `global_tasks`; every `worker/tasks/{word_audio|sentence_audio}/{pull|accept|result|release}` answers 404 `TASK_TYPE_UNSUPPORTED` (one guard, `WorkerController::invalidTaskType`), as do the queue diff and page-data, so a worker drops any staged task of these types; pycore holds no backlog mirror and no listing cursor. A word enqueue (`AppQyV1UnifiedTTSQueueService::addWordTask`) creates the row when absent and promotes it (`QueueCenterService::promoteGapItem`); it returns `queue_task_id: null` and never touches a live lease.

## 7. pycore audio lanes

### 7.1 Queue = Part1 + Part2 (contract `head_parts`, `audio_lane_state`)
- Each audio lane owns one whole-Queue heap in `audio_queue_center`; heap key `(part_rank, language_tier_rank, -queue_position, seq)`. Part1 items sit in front of every Part2 item.
- Part1: pycore-local priority, filled only by audio orchestration manifest misses (`promote_local_head`), the pycore-manager manual promote and the client `generate:pycore` stage (both `ui/queue_center/promote_local_head`). Never notifies Laravel. Empty by default; persisted local Part1 items restore at lane start.
- Part2: this node's Laravel work = rows of its work leases (`accept_leased`, `_local_source = lease`, `queue_position` = lease priority) and claimed non-lease Laravel tasks. Leased rows are never persisted.
- Dedup and every mutation run on the whole Queue (`audio_dedup_key` / `audio_dedup_key_from_task` in `pyutils/common/queue_center_contract.py`; word `{lang}:{md5}`, sentence `{lang}:{content_id}`); an item exists once across parts and a Part1 copy keeps its front position. The split may be shown read-only (`lane_view`); actors never address a part.
- Direction: Laravel -> pycore only. wordnew is the sole notifier of Laravel head moves; a `{queue}_head` event wakes the lane into an urgent claim (`request_pull(prefer_remote=True)`).
- Activation (one ON chain per lane, `pyctl/tts/audio_lane_activation.py`): restore local Part1 items -> release the worker's stale leases -> claim a lease batch -> drain.

### 7.2 Lease intake (`AudioLaneLeases`, `LeaseBook`)
- A claim is due when open items fall to `max(concurrency, prefetch_fraction x last batch)`; a realtime wake makes it urgent. A node never holds more than one batch plus that prefetch.
- Renew piggybacks on every claim and also runs when due. `lost` drops unstarted rows (`drop_leased`).
- Claims nothing during a graceful stop; lease errors back off (5 s doubling to 120 s) while the held batch keeps working.
- The audio worker heartbeat starts a lease round when due; `run_pull_cycle` = lease round + bounded pull of non-lease types (`_pull_task_types` excludes the lease lanes; `article_audio` keeps the bounded pull).

### 7.3 Orchestration <-> lane: one generation per item
- `complete` and `settle_local` emit settled identities, so whoever generates an item (lane worker or orchestration) settles the lease.
- Orchestration `take_local()`s its queued items (`{taken, inflight, absent}`) and generates them itself without waiting.
- It awaits only items a lane worker is processing now (`orch_resources._await_lane_settled`). The wait is stall-based: it keeps waiting while the item's tracker shows progress within `work_leases.progress_stall_seconds` (`touch` / `stalled_keys`) and reclaims only when the lane is halted or blocked or the item shows no progress for that window. There is no fixed settle timeout.

### 7.4 Non-lease task types (bounded claim-pull)
- Typed routes `/api/worker/tasks/{task_type}/{pull|accept|result|release}` (contract `endpoints`), `{task_type}` validated against `task_types[].key`. Worker identity, processor types and capabilities travel with each pull; pull returns one bounded segment immediately (`task_contract.limits.worker_pull`).
- Compute order (`task_types[].compute`): a gpu node pulls gpu_required, gpu_preferred, cpu_ok; a cpu_only node pulls cpu_ok, gpu_preferred, never gpu_required; types of one class rotate per cycle.
- Audio task types order by `global_tasks.queue_position` (contract `ordering: queue_position`, `QueueCenterContract::isQueuePositionOrdered`, pycore `is_queue_position_ordered`), never by numeric priority; `QueueHeadService` assigns monotonic head tickets under a PostgreSQL advisory lock.
- Diff (`QueueSliceDiffService`, contract `diff_delivery`): an unchanged cursor is one cache read with `progress: null`; a changed revision means re-pull one bounded batch remote-head first and merge; work already processing is never cancelled. Revisions advance after committed mutations inside `TaskManagerService`.
- Staging (`pyutils/common/diff_task_segments.py`, SQLite `queue_diff.sqlite3`, one row per claimed task, one remote cursor per scope and task type; the lease lanes are never staged and recovery reads only the lane's current pull types). A consumer acknowledges a remote cursor only after local staging or a successful empty response; claimed payloads persist across restart until an accepted terminal result. The former `queue_center_segments.json` mirror (lease-lane rows of every worker id and server) is dropped once at first open together with its leaked temp files.
- Article audio stays on the task path: `sentence_audio` payloads with `target_kind` / `article_id` (sentence rows, daily articles, article-library rows) dispatch to their storage model through one processor. A request for a missing `daily` / `agent_history` static MP3 (`StaticFileController::serveArticleAudio`) enqueues or moves the article task to the head and answers 202 with a retry hint. Agent History uploads the locally synthesized full-article MP3 with the article; its parsed sentences still enter the sentence gap.
- Missing audio requested by wordnew is file-first (`AppQyV1AudioGateway`): an existing file returns its URL; otherwise the gap row is promoted (lease lanes) or the task is deduplicated and moved to the head (task lanes).
- Every offered row is accounted: `_dispatch_staged` returns `{dispatched, released{code}, skipped{code}}` with `lane_state.skip_reason_codes` (`TASK_ROW_INVALID`, `CLAIM_GONE`, `RESULT_PENDING` = terminal result still in the outbox, never re-run after restart, `LANE_HALTED`, `LOCAL_DISPATCH_REJECTED`); non-dispatched rows are logged with their codes and lane status shows `last_dispatch` (`intake_status()`).
- Version skew: a Laravel that does not know a contract task type (404 `LARAVEL_TASK_TYPE_UNSUPPORTED`, or 404 `Unknown queue: <type>`; `task_puller.UNKNOWN_TASK_TYPE_MARKERS`) has only that type skipped and re-probed with backoff (`UnsupportedTaskTypes`); the rest of the diff round continues.
- `accept` stays as the early drop before work starts (gone or foreign-owned rows are released without synthesis) even though `result` covers the same pending-claim branch.
- A wake during a running cycle sets `_pull_again`; an idle timer cycle backs off 5 s doubling to 120 s.
- Worker id = `<prefix>-<first 12 hex of the relay device id>` (+ `PYCORE_WORKER_INSTANCE`; device id persisted in `CORE_NODE_DATA_DIR/config/pycore_relay_identity.json`); roster eligibility uses heartbeat age (`Worker::isAlive`, `worker_heartbeat_ttl_seconds`). A hostname-based worker id is unregistered (`worker_unregister`, once per server and process, 404 accepted) and its staged diff scopes dropped (`forget_worker_scopes`) only after its outbox results have delivered (`pyctl/laravel/worker/registration.py`).
- Worker shared state lives on THREAD_BUS owners: `WorkerEventLog` (keyset `page(after, limit)` + total + revision), `ClaimLedger` (all methods serialized), `RegistrationState`, `LeaseBook`; `TaskPuller.queue_progress` / `last_dispatch` via `SerializedValue`; lane stop flags and `inflight_count()` serialized on the worker owner.

## 8. Lane state and [AssistSummary]

- Contract `lane_state`; pushed on journal topic `queue_center.audio_lane.changed` (`lanes.<lane>`) and returned by RPC `ui/queue_center/audio_lane_state`. Lanes `word_audio, sentence_audio, translation`. Revision monotonic per pycore instance.
- Fields: `progress` (progress_template as Laravel sent it), `assist {device gpu|cpu|null, engine, state running|idle|blocked, reason_code}` (device/engine only while running; reason only when blocked: `assist_reason_codes` = `RESULT_CIRCUIT_OPEN`, `LANE_HALTED`, `ENGINE_MEMORY_PAUSED`), `skipped [{reason_code, count}]` from the last intake cycle, `leases` (audio lanes: `{leases, items_leased, last_batch, done_per_hour, claim_in_seconds, pooled, lost, engines, languages}`; `lost` is null until a renew reports a lost lease).
- Lane `progress` (queue-wide done/total) and the per-synthesis `qwen_progress` / chunk counters are distinct and never projected onto each other; the sentence lane prints the sentence text once, at the Qwen processing boundary (`Generating sentence`), before any delivery HTTP.
- pycore reads skip and assist codes through `queue_center_contract.lane_state_code`; a code missing from the contract fails loudly. Changes are coalesced by the publisher (0.4 s); no polling.
- `AssistSummary` logs one `[AssistSummary]` line per audio lane every `lane_state.assist_summary_interval_seconds` (600): generated/h, source split (`audio_queue_center.completed_by_source`), delivered_to_laravel delta, leased rows, gap backlog (Laravel progress) and ETA. Never per task.

## 9. Delivery

### 9.1 pycore outbox (`laravel_delivery_outbox`)
- One durable store, one scheduler, per-feature kinds, one namespace per Laravel server (`server:<server_id>`, or `url:<base_url>` for a server without an id, adopted once the id is learned). Completion on one server never counts for another.
- Target: new items go to the UI-selected server only (`target_namespaces`); only the selected server's rows are attempted (`deliverable_namespaces`); rows of other servers stay parked until that server is selected again. Failover moves between routes of the selected server only. A row whose file is gone ends as `source_gone`.
- Reconcile: on every offline -> online edge, identity change, endpoint switch and at start, each inventory kind sends its inventory to `delivery/diff` (chunked by `delivery/info` limits, resume from `next_index`) and enqueues exactly the `missing`/`stale` items; `rejected` items are never uploaded. A server without the diff API falls back to a local diff against its namespace's delivered state (active endpoint only). The server's diff is the authority over local receipts.
- Kinds: `audio_cache.resource` (every local word/sentence clip in `audio_resource_ledger`, batch upload, single fill-missing fallback), `audio_lane.word` / `audio_lane.sentence` (server-specific domain report steps; the clip is shared with `audio_cache.resource`, no double transfer), `audio_orch.output`, `agent_history.article` / `.article_audio`.
- Transport: uploads use offset-v1 progress (`http_transfer`): no response timer while bytes or server progress advance; only a stall over `idle_timeout_seconds` fails an attempt.
- Synthesis never waits on progress or result HTTP: lane progress is local-only (`PROGRESS_EVENTS_ENABLED = False`); results and uploads go only through the outbox, drained by background lanes.
- Audio lane steps (`pyctl/tts/laravel_audio_delivery.py`): domain report (deduped per identity), then `result` (global task result), then `history` (local task history); each is a monotonic checkpoint and the row closes only after all of them. A domain upload that is unavailable or terminally rejected (4xx) continues through the audio-bearing global-result fallback. Dead letters stay visible and are requeued per kind through `ui/laravel_delivery/retry` (status `ui/laravel_delivery/status`).
- Server schema gate (`pyutils/laravel/server_schema_gate.py`, contract `schema_gate`): `laravel_client` feeds it the answers of the gated routes (work leases, typed worker tasks, reports, delivery); HTTP 503 `SERVER_SCHEMA_PENDING` or 3 consecutive 5xx pause that server for `retry_after_seconds`: no claims or renews, outbox drains wait, a row whose attempt failed meanwhile is deferred without an attempt or failure (`delivery_store.defer`), lane `assist.reason_code` = `SERVER_SCHEMA_PENDING`. The first read after the pause raises the server's online edge (reconcile).
- Breakers: a drain pauses with `Backoff` (`SERVER_ERROR_PAUSE_INITIAL_SECONDS` 15 doubling to `SERVER_ERROR_PAUSE_MAX_SECONDS` 300) after `SERVER_ERROR_STREAK_THRESHOLD` (3) consecutive 5xx outcomes of one kind; any delivered row closes it (`delivery/breaker.py`). Worker intake pauses `RESULT_CIRCUIT_COOLDOWN_SECONDS` (120) after 3 consecutive 5xx terminal result posts (`worker_result_channel.circuit_open`); progress pings never feed it.
- Laravel coming online kicks the lane's outbox kind (`_on_laravel_online` -> `laravel_delivery_outbox.kick`) before more remote work is admitted. `TaskPuller._recover` skips staged tasks whose terminal result still waits in the outbox (group key `<worker_id>:<task_id>`, `pending_group_keys`).
- `writeback_pending` from Laravel is a durable idempotent receipt: the step is marked accepted and the bytes are not re-uploaded.
- History submissions are idempotent per `(delivery_id, operation)`; history `record_id` is delivery-derived, so a replay updates the record. Cached audio is served only from inside the managed cache root with an allowed audio extension.
- `LaravelProgressUploader` (`pyutils/laravel/progress_upload.py`) treats identical `(endpoint, params, content sha256)` transfers as one delivery: a concurrent duplicate awaits the leader, and a duplicate within `http_transfer.dedup_window_seconds` (300) reuses the receipt. Upload progress carries a producer reason (`<lane>_audio_delivery`, `agent_history_audio_rebuild`) and the task identity.
- Language keys are built only by `pyfoundations/text_parsing.normalize_language_code` via `audio_resource_ledger.resource_key`.
- Nothing starts at import: `laravel_delivery_outbox.start()` runs from the runtime step `laravel_delivery`.

### 9.2 Laravel side (contract `delivery`, `word_identity`)
- Auth: the delivery routes take `client.key` (K3 client-key signature, `ClientKeyAuthService::verify`; pycore signs through `laravel_client`'s `client_key_headers`) plus `ServerIdentityHeader`.
- Server identity: `server_id = sha256("laravel-server\n" + machine_code + "\n" + nonce)[0:32]`, nonce in `<laravel_data_dir>/identity/server_<machine_code[0:16]>.json`; returned by `/api/health` and `delivery/info`; header `X-Core-Node-Server-Id` on health, delivery and orchestration ingest routes (`ServerIdentityHeader`).
- `POST delivery/diff {machine_id, kind, items}`: kinds and limits in `diff_item_limits`; keys `word_audio <lang>:<md5>[:variant]` (or `<lang>:text:<cleaned_word>` per `word_identity.fallback_when_md5_absent`), `sentence_audio <lang>:<content_id>[:variant]`, `orch_segment <sha256>`, `orch_output {key, meta_hash, segments?}`, `article {key, sha256?}`, `static_file {key, bytes?}`. Each call is bounded (8 s budget): `complete=false` + `next_index` means resend the rest. Response lists only `need` (`missing|stale`) and `rejected` (`no_target|invalid_key|unsupported_language`).
- Batch (`batch_kinds` word_audio, sentence_audio): manifest POST (1..500 items, 100 B..2 MiB each, <= 32 MiB; idempotent `batch_id`) -> offset-v1 content -> status poll until `done` (item status `stored|exists|no_target|invalid|error`). Storage uses the idempotent fill-missing writers (`storeWordAudioBytesDetailed` / `storeCleanedWordAudioBytesDetailed`, `AppQyV1SentenceAudioService::report`), which also close the gap row. A stalled processing batch is advanced by the status poll. Done batches expire after `retention_seconds`. All literals come from the contract accessors.
- Redis resource index (`AppQyV1ResourceIndexService`, `RedisBucketIndex`): connection `resource_index` (loopback, `ports.redis`, database 2, phpredis, prefix `core-node-database-`); keys `resource_index:<kind>:<md5(field)[0:3]>` HASH + `resource_index:meta`; maintained on every store/delete; misses are verified against DB/disk and self-healed, so the index never yields a false "missing". Without Redis every diff uses DB/disk. Commands: `php artisan app_qy_v1:resource-index rebuild|status|reconcile [--kind=]` (`resource_index_built=yes|no`); `AppQyV1ResourceIndexReconcileTask` reconciles 2 s per minute. Store config: `maxmemory-policy noeviction`, `hash-max-listpack-entries 1024`, `hash-max-listpack-value 128`, memory capped at 10% of RAM (175 scripts, `redis_endpoint_common.sh`).

## 10. Realtime and queue-center timers

- Transport: Mercure, topic `queue-center` (contract `realtime`). Events: `queue.changed`, `task.priority`, `word_audio.head`, `sentence_audio.head`, `word_image.priority`, `cover.priority`, `poster.priority`, `worker.presence`, `work_nodes.changed`. Events are revision/ID hints; the HTTP APIs are the recovery contract.
- `queue.changed` (`QueueCenterRealtimeService::publish`): leading edge once per second plus one trailing event per window (`throttled`).
- Emit at the source: `QueueHeadNotificationService::record()` emits `{queue}_head` in the mutating request; `AppQyV1TranslationEventModel` / `AppQyV1SocialEventModel` append to the outbox after commit and call `RealtimeOutboxPublisher::publishPending()`. The outbox is the durable journal; publish failures stay journaled.
- pycore: `snapshot_service` consumes the Mercure stream with cursor replay (`/api/queue-center/events`); head events wake the lane, `queue.changed` wakes pullers, and a `task.priority` event (`task_id`, priority, move-to-head) promotes the matching already-cached task of the translation worker at once (`worker.set_cached_task_priority`) and wakes its pull.

Queue-related timer tasks (Octane timer catalog, auto-discovered; the catalog holds further tasks owned by other topics; each run holds a per-task cache lease `octane_timer:task:*`):

| Task | Interval | State |
|---|---|---|
| `WorkLeaseReaperTask` | 60 s | on (lease accounting, online-set signal, failed resurfacing) |
| `VoiceSubtitleV1PipelineTask` | 3 s, background lane | on (advances accepted voice-subtitle tasks; resumes on pycore TTS/OCR completion) |
| `OpenRouterCatalogWarmTask` | 300 s, background lane | on while OpenRouter is configured (free text/image catalogs) |
| `AppQyV1ResourceIndexReconcileTask` | 60 s, 2 s budget | on while Redis is up and no DataSync session runs |
| `QueueHeadNotificationTask` | contract interval | off (`queue_center_head_notification_poller` safety net) |
| `RealtimeOutboxPublishTask` | 1 s | off (`realtime_outbox_publish_poller` safety net) |
| `GlobalTaskMaintenanceTask` | 15 s | off (`global_task_maintenance_poller`); `DictLaneMaintenance::onPull` runs lease recovery, offline-worker cleanup and priority aging in the pull path (15 s throttle, hourly slow slice) |
| `AppQyV1OverviewWarmTask` | 20 s | off (`appqyv1_overview_warm`); overview snapshots rebuild on demand |

## 11. Octane / FrankenPHP worker rules

- Runtime: Octane on FrankenPHP (Swoole fallback per `WebServerPlane`); a fixed pool of request workers.
- Path resolution is memoized per worker: `PathMapper::mapWebPath` resolves its web/data base once (`webBasePath`); `WorkLeaseLanes::languages(sentence_audio)` lists the sentence tables once (`filterExistingTables`).
- A request never sleeps or long-polls: typed pulls return immediately; no SSE endpoint runs on Laravel request workers; realtime goes through Mercure.
- A request worker never waits on pycore or on another request: no `usleep` polling of a pycore task (`PycoreTaskQueue::poll` is a single non-blocking look; background jobs resume on a later tick), no `app()->terminating` pipelines; long work returns 202 and runs in the `octane-timer:background` lane.
- No lock-less `Cache::flexible` on a request path: a miss computes synchronously in the caller and the stale refresh runs in `defer()` on the same worker. Use `App\Support\LockedCache::flexible($key, $ttl, $fill, $degraded)` (warm key: `Cache::flexible` with its deferred locked refresh; cold key: the one non-blocking `Cache::lock` winner fills, every other caller returns at once with the last good value (`<key>:last_good`, written by every fill) or the caller's degraded default), or a pure read plus a locked rebuild (`AppQyV1AssistOverview::serveSnapshot`: serve fresh; one `add(key:rebuild)` winner rebuilds; others serve stale or the degraded shell).
- Remote lookups that feed request paths cache failures too (`OpenRouterFreeOnly`: a failed or empty catalog fetch is cached `services.openrouter.catalog_failure_cache_seconds`, 600 s; request paths read the cache only, `OpenRouterCatalogWarmTask` refreshes it).
- Hot paths are index-backed: claims, reaper, resurfacing, gap counts and listings read only their partial indexes (§3); totals use planner estimates (§5).
- `defer()` never runs inside an Octane tick: a timer that warms a cache writes it directly (`put`).
- Shared caches that must not fail silently check the `put()` result (`putShared`, Octane Swoole-table row size).
- `QueueCenterCacheStore` is the database cache store; increments are atomic single-row statements with no lock-block.
- Result submission: ownership validation, then processor/file work without worker/task row locks, then a short final ownership transaction; file I/O and publishing never run while ownership locks are held; events are appended after commit.
- Aggregates use constant round-trips (`AppQyV1PerLanguageMetrics`: one `information_schema` listing + one `UNION ALL` per metric) instead of per-language loops.

## 12. Verification

- Laravel: `php -l` on changed files; `php artisan route:list` (work routes `work/leases/*`, `work/nodes` present); `php artisan sys:init` then restart Octane on the server.
- Read-only: `QueueCenterMetricsService::progress('word_audio'|'sentence_audio')` matches `progress_template`; `AppQyV1LangSentenceModel::audioGapBreakdown('en', [AppQyV1BookSeedImporter::bibleSourceKey()], 300)` splits the sentence gap by source; `AppQyV1VerseResegmentation::scan()`.
- `php artisan app_qy_v1:resource-index status` prints `resource_index_built=yes`.
- pycore: `py_compile` on changed files; boot import of lane workers, `audio_lane_state`, `delivery_outbox`; lane state RPC `ui/queue_center/audio_lane_state` shows `leases` per audio lane; `[AssistSummary]` lines every 600 s.
- Multi-node lease simulation (stub scheduler on SQLite implementing `work_leases`; each node a process running the real `AudioLaneLeases` / `LeaseBook` / `work_lease_client` / `audio_queue_center`; live gap sizes: sentences en 130566 + ja 2000, words en 75130 + ja 1500; TTL 6 s). Nodes: gpu fast and gpu slow (qwen 10 languages, words kokoro en/zh; the slow node crashes mid-lease without release) and cpu (kokoro en/zh). Expected and observed: 0 duplicate reports, 0 concurrent double leases; every serviceable row done; ja words pooled `NO_CAPABLE_NODE`, never leased or failed; ja sentences only on gpu nodes; no gpu_preferred sentences on the cpu node while gpu nodes are online; work split in proportion to each node's completions (sentences 284/s vs 145/s, words 183/82/37 per s); the crashed node's rows re-leased within one TTL (386 rows). Orchestration overlap in both orders (leased then promoted; taken then want-leased and merged): one generation and one report per row, lease settled.

## 13. Open items

- Article `sentence_audio` tickets (`AppQyV1ArticleSentenceAudioService`, payload `target_kind`/`article_id`) are still `global_tasks` of a lease lane, which has no task path: they are never pulled. Needed change (pycore processor + Laravel scheduler together): schedule them as `article_audio` (claimants pycore/chrome, gpu_preferred) with the same payload and result writer.
- Ingest gate: `SentenceSegmenter::gateViolation` runs only in `AppQyV1BookSeedImporter`; `MediaIngestService::planSlot` applies only the `hasVerseMarker` guard (book/document). The contract gate also flags ordinals (`3rd`), so enforcing it in `upsertLangSentences` needs contract exemptions first (all three adapters, `config/sentence_segmentation_contract.json`). `mayPrecedeVerse` does not accept `,;:` or openers, so `King David,46Moreover` is not a marker for `hasVerseMarker` (the SQL prefilter accepts it).
- `app/Console/Commands/AppQyV1BackfillGlobalTasks.php` writes `word_audio` GlobalTask rows directly; those rows are unclaimable under work leases. Needed change (app/Console, awaiting user approval): create no pending/assigned `word_audio` rows (history rows only, or retire the command).
- `AppQyV1TTSQueueDecommission`, `AppQyV1ArticleLibraryModel` keep their own `has_audio` conditions (one-off migration / article logic); `resetFailedTts` uses `AppQyV1MediaGaps::NO_AUDIO`.
- Stale gap indexes are pending drops (never dropped in a migration): sentence `idx_sent_<lang>_gap_audio_id`, `_gap_audio_live_id`; word and sentence `<prefix>_gap_audio_lease` (gap incl. failed rows; the claim uses `_gap_audio_free_lease`).
- Lease coverage not exercised on PostgreSQL: two concurrent SKIP LOCKED sessions and the lease endpoints end to end with the 3 node processes (pending deploy + sys:init; the same node processes run against the server unchanged).
- `worker_base._result_backlog` (`pycore/pyctl/laravel/worker_base.py:416-419`) counts every pending row of the shared `worker_result` outbox kind, so each worker's backlog figure includes the other workers' results; it needs a per-worker or per-server filter.
- `word_image.priority` (contract `realtime.events.word_image_priority`) has a consumer (mcp-chrome `QueueCenterWakeService`) but no Laravel emitter; the word-image fast lane is not signaled until an emitter is added.
- Contract `task_contract.stream_events` (`task.detail-initial`, `task.event`, `ping`, `stream.close`) describes a task detail stream, but no `/api/task/{id}/stream` route and no consumer exist; implement the route (with `client.key_or_dashboard`) or retire the block (user decision).
