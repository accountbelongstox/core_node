# wordnew-laravel report

## wordnew-laravel-G1

Status: all 7 items (the 6 assigned plus the leader-added MCHR-27b) done and verified locally, including the review round 1 fixes. No git writes by me. The user's sweep commit `4ddb4be8e` (20:24:56, "win0.0.1") picked up my working-tree hunks, so review them with `git diff 8f95a2a24 4ddb4be8e -- poly_apps/laravel_main/app/Apps/AppQyV1 poly_apps/laravel_main/app/Services/SentenceEnrichmentService.php` (12 files, +117/-45; the CodeMartV1 files in that commit are not mine). Every file passes `php -l`. Line endings: the AppQyV1 PHP files are LF, enforced by `poly_apps/laravel_main/.gitattributes` (`* text=auto eol=lf`). `git ls-files --eol` shows `i/lf w/lf attr/text=auto eol=lf` for all 14 G1 files, and a byte count finds 0 CR. No file was converted. (The earlier "every file keeps CRLF" line here was wrong. It was corrected in review round 1, here and in agent memory.) Free RAM was 4.69 GB before the in-process checks.

Changed files (all under `poly_apps/laravel_main/`):
- `app/Apps/AppQyV1/AppQyV1Models/AppQyV1TtsVariantSpecModel.php` (srv-07b)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1OrchAudioService.php` (LDRI-32)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1ResourceIndexService.php` (LDRI-32, LDRI-28)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1CoverImageService.php` (LDRI-28)
- `app/Apps/AppQyV1/Services/AppQyV1VocabularyCoverService.php` (LDRI-28)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1AssistMediaOperations.php` (LDRI-28, "any other AppQyV1 static store")
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Social/AppQyV1PostMediaController.php` (LDRI-28, same)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1WordTranslationWriteback.php` (LDRI-28, same)
- `app/Apps/AppQyV1/Utils/AppQyV1SystemInit/AppQyV1ImageFileProcessor.php` (LDRI-28, same)
- `app/Services/SentenceEnrichmentService.php` (LDRI-28, EdgeTTS hook)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyLibraryPublicController.php` (MCHR-27)
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1DeliveryBatchService.php` (LDRI-22; review round 1)
- `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Learning/AppQyV1VocabularyRecommendationController.php` (MCHR-27b, review round 1; uncommitted in the working tree)

Scratch scripts (not in the repo), in `D:\.tmp\claude\D--programing-core-node\59362416-9b59-4a9b-b284-e4b3d83daf06\scratchpad\`: `seed_verify.php`, `purge_verify.php` (round 1 adds cases a and b), and `wnl_g1r1\mchr27b_verify.php` (round 1). The scratchpad is shared with other roles, and `g1_verify.php` there now holds another role's script.

### srv-07: done, no code change
- `AppQyV1TtsEngineConfigModel::seedDefaults` (:85-110) is already ensure-only: insertOrIgnore of the missing defaults, `updated` is always 0, and existing rows are untouched. `InitializeApps.php:523-526` only prints the counts.
- Verification (in-process, inside a rolled-back PG transaction on connection `appqyv1`):
  - baseline `{"seeded":0,"updated":0}`;
  - set kokoro to priority_order 99 and enabled false, then seed: `{"seeded":0,"updated":0}`, and kokoro stays 99/false. PASS;
  - delete sherpa, then seed: `{"seeded":1,"updated":0}`, and sherpa is back at priority 12, enabled. PASS;
  - after the rollback, kokoro is again 8/true. sys:init was not run.

### srv-07b: done
- `AppQyV1TtsVariantSpecModel::seedDefaults` is now ensure-only, like the engine seed. It inserts the missing default (lang, variant_key) rows with insertOrIgnore (ON CONFLICT DO NOTHING on `uniq_tts_variant_spec_lang_key`), never updates existing rows, and returns `updated` 0. The upsert of accent, gender and is_primary is gone, so operator edits made through `replaceForLanguage` survive sys:init. The tableStructure comment was updated to match.
- Choice: a re-inserted default whose `is_primary` is true is inserted as non-primary when its language already has a primary row. This keeps the one-primary-per-language invariant that `replaceForLanguage` enforces. Reason: an operator who moved the primary to another key would otherwise get two primaries after the next sys:init.
- Verification (same rolled-back transaction):
  - baseline `{"seeded":0,"updated":0}`;
  - en/uk_f set to gender male, accent au and primary, and en/"" set to non-primary, then seed: `{"seeded":0,"updated":0}`, and all edits stay. PASS;
  - delete ja/m, then seed: `{"seeded":1,"updated":0}`, and it is back (male, non-primary). PASS;
  - delete en/"" while en/uk_f is primary, then seed: `{"seeded":1,"updated":0}`. The re-inserted row is non-primary, and en has exactly 1 primary. PASS;
  - after the rollback, en/uk_f is again female and non-primary.

### LDRI-32: done
- The private `audioPath` was replaced by `public static function segmentAudioPath(string $sha256): string` on `AppQyV1OrchAudioService`, the one body. `receiveSegmentChunk` uses it. `AppQyV1ResourceIndexService::orchSegmentPath` now delegates to it.
- grep: `PathMapper::getAppQyV1AudioBaseDir(self::segmentAudioRelative(...))` exists only at `AppQyV1OrchAudioService.php:566`.
- In-process check: for sha256('ldri-32-sample'), the old body, `segmentAudioPath` and `orchSegmentPath` all return `D:\www\wwwroot\laravel_db/static/app_qy_v1/audio/orchestration/3e/3edd9f...ae257.mp3`. PASS.

### LDRI-28: done
- New `AppQyV1ResourceIndexService::recordStaticPath(string $absolutePath): void`. It mirrors `forgetStaticPath`, stats the file and calls `recordStaticFile(relative, bytes)`. Both helpers now share `staticRelativePath()`. It returns null for paths outside the static root, for traversal (normalizeStaticPath), and for paths under `app_qy_v1/audio/`. That audio exclusion is the same one the rebuild source `staticFileEntries` applies, because audio has its own kinds.
- Store paths now record, and delete paths forget:
  - `AppQyV1CoverImageService::generateGroupCover`: main cover :127 and thumbnail :154. `deleteCover` :328 already called forget.
  - `AppQyV1VocabularyCoverService`:
    - `getCoverData` rename: forget old :67, record new :68;
    - `regenerateWithAi`: record the ai_image_cache file :293, and the cover (cache copy or fresh) :298;
    - `deleteCoverFile` :176 already called forget.
  - `AppQyV1AssistMediaOperations` cover submit: record :193.
  - `AppQyV1PostMediaController`: post images :128, post video :206. It has no delete path.
  - `AppQyV1WordTranslationWriteback::storeWordImages`: record after the size check, :690. Its unlink only rolls back an unrecorded partial write.
  - `AppQyV1ImageFileProcessor::processSingleImageFile`: record :315. Its target comes from config, and paths outside the static root are ignored.
- EdgeTTS/Bing writes that bypass `markWordCompleted`:
  - Bing word audio goes through `storeWordAudioBytes`, and so through `markWordCompleted` and `recordWord`. Covered.
  - `SentenceEnrichmentService::generateAudioReference` copies EdgeTTS output to `sentence_sounds/{lang}/{content_id}.mp3` and never called `recordSentence`. Hook added at :328.
  - Plain EdgeTTS cache files (`TTSController`, `TranslationController:301`, `TranslationService`) are in no indexed kind: they sit under `app_qy_v1/audio/{lang}/{type}/`, which is excluded from static_file, and they have no dictionary-row state. Nothing to record.
  - Known risks, recorded here and not changed:
    - (a) `AppQyV1LearningController.php:268-281` writes EdgeTTS `tts_files` directly, without `has_audio` and without `markWordCompleted`. The word kind verifies against `has_audio`/`audio_files`, so the index stays consistent (absent). But the row stays incomplete, and pycore may re-deliver the audio. The fix is to route it through `markWordCompleted` as `AppQyV1WordLookupController.php:122-128` does. That is a DB-state behavior change, so it is left to the lead.
    - (b) `app/Services/AppQyV1TTSQueueDecommission.php:85,114` (a one-shot bulk update) and `app/Console/Commands/AppQyV1TestTTSGeneration.php:176` (pycore-laravel) set `has_audio` without recording. The reconcile additions and rebuild cover them.
- Verification:
  - grep shows the callers listed above;
  - `staticRelativePath` gives `app_qy_v1/covers/abc.png`, `app_qy_v1_covers/cover_x_1.png` (mixed separators) and `app_qy_v1/word_images/en/word/0123.jpg`. It returns NULL for the audio subdir, outside paths and `..`;
  - with no phpredis (`available=false`, backend `database`), record/forget on a real cover file and on a missing path, plus `recordStaticFile`, `forgetStaticFile` and `recordSentence`, all ran as no-ops without error. PASS.

### MCHR-27: done
- `AppQyV1VocabularyLibraryPublicController::transformLibrary` (used by `getLibraries` and `getRecommended`) now calls the side-effect-free `presentCover()` instead of `getCoverData()`. `getCoverData` is unchanged, so it keeps the demand timestamp. Libraries whose cover is not initialized are enrolled by the cover timer's `seedMissingCovers`.
- Verification through the in-process HTTP kernel, with `QueryExecuted` captured on all connections:
  - `GET /api/app_qy_v1/vocabulary/libraries?per_page=50`: 200, 8 rows, 2 queries, **0 UPDATE/INSERT/DELETE**;
  - `GET /api/app_qy_v1/vocabulary/libraries/recommended?limit=20`: 200, 7 rows, 2 queries, **0 writes**;
  - the row keys are unchanged (`...,cover_url,...,cover_last_generated_at,cover_task`), every row has `cover_task`, and every `cover_url` has `?v=`, e.g. `.../covers/9d5bf04e...png?v=1782998618`. PASS.
- The RecommendationController follow-up was assigned as MCHR-27b in review round 1 (below).
- No single-library GET calls `getCoverData` today (`getLibraryWords` does not). After MCHR-27b, `getCoverData` has no caller under `app/`. It is kept as the reviewer asked. Demand is already stamped by `AppQyV1LibraryCoverTaskService:450` (enqueue) and by the timer seed. If the lead wants a demand stamp on the single-library read, add `getCoverData` to `getLibraryWords`.

### MCHR-27b (review round 1, leader-added): done
- `AppQyV1VocabularyRecommendationController::coverImageUrl` (:252-255) now returns `$this->coverService->versionedCoverUrl($library)`. It no longer calls `getCoverData`, so the list GETs `getRecommendations` and `getSelectedCollections` issue no UPDATE per row. `getCoverData` is kept.
- Verification: scratch `wnl_g1r1/mchr27b_verify.php`, through the in-process HTTP kernel with a `QueryExecuted` listener on all connections. No user had selections, so six `selectLibrary` rows for the first user were inserted inside a rolled-back `appqyv1` transaction, before the listener was armed. The sanctum guard user was set in-process.
  - `GET /api/app_qy_v1/learning/recommendations`: 200, 8 rows, 2 queries;
  - `GET /api/app_qy_v1/learning/collections/selected`: 200, 6 rows, 2 queries;
  - **0 UPDATE/INSERT/DELETE** during both GETs;
  - `image_url` is identical to the old computation (`getCoverData()['url']`, or the default URL, run afterwards inside the same rolled-back transaction) for 8/8 and 6/6 rows, e.g. `.../covers/9d5bf04e9096621326d74156569d28ea.png?v=1782998618`;
  - row keys are unchanged (`id,...,description,image_url`), and 0 selections remain after the rollback. PASS.
- `php -l` passes. Worker restart returned 200, and live `GET :9000/api/app_qy_v1/learning/recommendations` returned 200.

### LDRI-22 (service half): done
- Agreed API for pycore-laravel (LDRI-22-timer): **`public function purgeExpired(): int`** on `App\Apps\AppQyV1\AppQyV1Services\AppQyV1DeliveryBatchService`. Resolve it with `app(AppQyV1DeliveryBatchService::class)->purgeExpired()`. It returns the number of removed batches.
- `register()` (:79-80) still calls it.
- Selection:
  - files are grouped per batch id (`{40 hex}.*`: json, bin, lock and leftover `.tmp` staging files). Other files are never touched;
  - a batch is a candidate only when all of its files are older than `RETENTION_SECONDS` (a cheap prefilter, so no JSON is decoded for fresh batches);
  - the stored state then decides, the same rule for every state (review round 1): the batch is removed when its stored `updated_at` is also older than the retention (`return $state === null || (int) ($state['updated_at'] ?? 0) < $cutoff;`). This covers `done`, `awaiting_content` and `processing`. A live processing batch checkpoints `updated_at` every `CHECKPOINT_ITEMS` items, a status poll resumes it after `STALE_PROCESSING_SECONDS`, and pycore's diff delivery re-sends items that are still missing. So a processing batch idle for 24 h is dead (for example, the worker died mid-advance), and its state, lock and up to 32 MB `.bin` are purged, as the old 24 h mtime purge did;
    - no readable state (orphan files): removed on age.
  - A batch counts only when all of its files were deleted.
  - The docblock was updated to match.
- Choice: an idle `awaiting_content` batch also expires. Its upload spool is already swept after the same 86400 s by `AppQyV1OffsetSpoolSweepTask`, and a later register re-creates it. Keeping it would add a leak that the old mtime purge did not have.
- Verification, review round 1 (scratch `purge_verify.php`, a temp batch dir redirected through `FileSystemManager`'s path map, so the real data dir was untouched). Case (a) is the existing B batch; case (b) is the new G batch. Run natively (pycore-laravel's uncommitted `deleteNative` is present) and again with the `sudo.bat` shim; both gave the same result:
  - `purgeExpired()` returned **4**:
    - A done-old: removed (json, lock and `.tmp`);
    - B processing, `updated_at` 2 days old, all mtimes old (case a): **removed** (json, bin, lock);
    - C done with a fresh state but old mtime: kept (2 files);
    - D awaiting-old: removed;
    - E awaiting-fresh: kept (1 file);
    - G processing, `updated_at` = now, old mtimes (case b): **kept** (3 files);
    - F orphan-bin-old: removed;
    - README.txt: kept;
  - a second call returned **0**;
  - reflection shows `public function purgeExpired(): int` (unchanged API).
- Not done (optional, non-blocking): a non-blocking `runWithExclusiveFileLock` around the per-batch delete, to close the benign race of a purge versus a late status poll. Reason: the batch has been idle for 24 h, so the race window is negligible, and deleting a lock file while holding it is not portable on Windows.
- FrankenPHP (after the round 1 fixes): `POST http://localhost:2019/frankenphp/workers/restart` returned 200. `GET http://127.0.0.1:9000/api/health` returned 200 (`"status":"healthy"`), and `GET /api/app_qy_v1/learning/recommendations` through the worker returned 200. `php -l` passes. Free RAM was 5.05 GB.

### Cross-scope notes (route through wordnew-lead / claude lead)
- **pycore-laravel: `app/Utils/FileSystemManager.php` `delete()` has no Windows branch in HEAD.** It shells out to `sudo -u <user> rm <path>`, so on Windows it never deletes anything and returns false. That affects every `FileSystemManager::delete` caller (DurableOffsetUpload spools, delivery batch content, EdgeTTS payload cache, ...). The owner's uncommitted `deleteNative` fixes it: with it, the round 1 purge returned 4 natively. `rename()` is still sudo-only.
- pycore-laravel: the `AppQyV1CoverGenerationTask` comments at :102-106 and :176-185 still say covers are initialized lazily in `getCoverData`. After MCHR-27/27b no list GET calls it, so those comments are stale.
- pycore-laravel: the static stores outside my scope do not record into the index yet. Each needs `app(AppQyV1ResourceIndexService::class)->recordStaticPath($abs)` after its write and `forgetStaticPath($abs)` after its delete:
  - `app/Services/MoviePoster/MoviePosterStore.php`: File::put at :88 and :244, File::delete at :259 (`app_qy_v1/posters`);
  - `app/Services/TaskProcessors/WordGeminiImageTaskProcessor.php` (word_images writes).
- pycore-laravel (LDRI-22-timer): use the unchanged signature `public function purgeExpired(): int`. Since review round 1 it also expires a processing batch that has been idle for the retention window, so the timer needs no extra `status`/`advance` sweep.
- Design note for a later ruling (srv-07b, not changed): `replaceForLanguage` deletes and recreates a language's specs, so the ensure-only seed brings back a default voice that the operator removed at the next sys:init. Specs have no enabled flag. A per-language ensure (seed a language only when it has no rows) would respect removals.

### Handoff
- Task: wordnew-laravel-G1 (srv-07, srv-07b, LDRI-32, LDRI-28, MCHR-27, MCHR-27b, LDRI-22 service half).
- Status: done, with the review round 1 blocking items fixed:
  - LDRI-22 processing expiry;
  - MCHR-27b;
  - the LF correction in this report and in agent memory (`.claude/agent-memory/wordnew-laravel/windows-file-ops-and-temp-dirs.md` and its `MEMORY.md` index line).
- The round 1 code changes (DeliveryBatchService, RecommendationController) are uncommitted working-tree changes. The verdict is due from wordnew-lead (`.claude/agents_shared/reviews/wordnew-laravel-G1.json`).
- Blockers: none. Next owners:
  - wordnew-lead: re-review round 1; decide on LDRI-28 risk (a) and the srv-07b per-language ensure note;
  - pycore-laravel: LDRI-22-timer, committing the FileSystemManager `deleteNative`, the MoviePoster/WordGemini index hooks, and the stale CoverGenerationTask comments.
