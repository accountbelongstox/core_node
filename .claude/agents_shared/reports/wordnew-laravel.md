# wordnew-laravel report

## wordnew-laravel-G1

Status: all 6 items done and verified locally. No git writes by me. The user's sweep commit `4ddb4be8e` (20:24:56, "win0.0.1") picked up my working-tree hunks, so review them with `git diff 8f95a2a24 4ddb4be8e -- poly_apps/laravel_main/app/Apps/AppQyV1 poly_apps/laravel_main/app/Services/SentenceEnrichmentService.php` (12 files, +117/-45; the CodeMartV1 files in that commit are not mine). Every file keeps CRLF (line count = CR count checked on all 13 files), and every file passes `php -l`. Free RAM was 4.69 GB before the in-process checks.

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
- `app/Apps/AppQyV1/AppQyV1Services/AppQyV1DeliveryBatchService.php` (LDRI-22)

Scratch scripts (not in the repo): `D:\.tmp\claude\D--programing-core-node\59362416-9b59-4a9b-b284-e4b3d83daf06\scratchpad\{seed_verify,g1_verify,purge_verify}.php`.

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
- Follow-up for wordnew-lead (not changed; outside the item's file list):
  - `AppQyV1VocabularyRecommendationController::coverImageUrl` (:252-259), used by the list GETs `getRecommendations` and `getSelectedCollections`, still calls `getCoverData`, so each row still runs an UPDATE.
  - No single-library GET calls `getCoverData` today (`getLibraryWords` does not).
  - Recommendation: switch that controller to `versionedCoverUrl($library)`. Demand is already stamped by `AppQyV1LibraryCoverTaskService:450` (enqueue) and by the timer seed. If the lead wants a demand stamp on the single-library read, add `getCoverData` to `getLibraryWords`.

### LDRI-22 (service half): done
- Agreed API for pycore-laravel (LDRI-22-timer): **`public function purgeExpired(): int`** on `App\Apps\AppQyV1\AppQyV1Services\AppQyV1DeliveryBatchService`. Resolve it with `app(AppQyV1DeliveryBatchService::class)->purgeExpired()`. It returns the number of removed batches.
- `register()` (:79-80) still calls it.
- Selection:
  - files are grouped per batch id (`{40 hex}.*`: json, bin, lock and leftover `.tmp` staging files). Other files are never touched;
  - a batch is a candidate only when all of its files are older than `RETENTION_SECONDS` (a cheap prefilter, so no JSON is decoded for fresh batches);
  - the stored state then decides:
    - `done`, or `awaiting_content`, with `updated_at` older than the retention: removed;
    - `processing`: always kept;
    - no readable state (orphan files): removed on age.
  - A batch counts only when all of its files were deleted.
- Choice: an idle `awaiting_content` batch also expires. Its upload spool is already swept after the same 86400 s by `AppQyV1OffsetSpoolSweepTask`, and a later register re-creates it. Keeping it would add a leak that the old mtime purge did not have.
- Verification (scratch temp batch dir, redirected through `FileSystemManager`'s path map, so the real data dir was untouched):
  - with a `sudo` shim that gives the Linux delete semantics, `purgeExpired()` returned **3**:
    - done-old: removed (json, lock and `.tmp`);
    - processing-old: kept (3 files);
    - done with a fresh state but old mtime: kept;
    - awaiting-old: removed;
    - awaiting-fresh: kept;
    - orphan-bin-old: removed;
    - README.txt: kept;
  - a second call returned 0;
  - reflection shows `public function purgeExpired(): int`.
- FrankenPHP: `POST http://localhost:2019/frankenphp/workers/restart` returned 200. `GET http://127.0.0.1:9000/api/health` returned 200 (`"status":"healthy"`), and `GET /api/app_qy_v1/vocabulary/libraries` through the worker returned 200.

### Cross-scope notes (route through wordnew-lead / claude lead)
- **pycore-laravel: `app/Utils/FileSystemManager.php:602-636` `delete()` has no Windows branch.** It shells out to `sudo -u <user> rm <path>`, so on Windows it never deletes anything and returns false. I verified this in-process with a temp file. Without the shim, `purgeExpired()` returns 0 and keeps every file on Windows. The same applies to every other `FileSystemManager::delete` caller (DurableOffsetUpload spools, delivery batch content, EdgeTTS payload cache, ...). `rename()` has the same pattern (:585).
- pycore-laravel: the static stores outside my scope do not record into the index yet. Each needs `app(AppQyV1ResourceIndexService::class)->recordStaticPath($abs)` after its write and `forgetStaticPath($abs)` after its delete:
  - `app/Services/MoviePoster/MoviePosterStore.php`: File::put at :88 and :244, File::delete at :259 (`app_qy_v1/posters`);
  - `app/Services/TaskProcessors/WordGeminiImageTaskProcessor.php` (word_images writes).
- pycore-laravel (LDRI-22-timer): use the signature above. A processing batch that is never polled again stays until a status poll or the deferred advance finishes it. The timer may also call `status`/`advance` for such batches, but that is out of G1.

### Handoff
- Task: wordnew-laravel-G1 (srv-07, srv-07b, LDRI-32, LDRI-28, MCHR-27, LDRI-22 service half).
- Status: done. The verdict is due from wordnew-lead (`.claude/agents_shared/reviews/wordnew-laravel-G1.json`).
- Blockers: none. Next owners:
  - wordnew-lead: review, and decide on the MCHR-27 RecommendationController follow-up and LDRI-28 risk (a);
  - pycore-laravel: LDRI-22-timer, the FileSystemManager Windows delete, and the MoviePoster/WordGemini index hooks.
