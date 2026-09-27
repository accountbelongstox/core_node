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

## wordnew-laravel-G2

Status: all 5 items done and verified locally (AOQSD-09, MCHR-21, LDRI-29, CKA-26a, CKA-26b). I ran no git writes. The user's sweep commit `ab566fdf7` (21:31:31, "win0.0.1") holds all 33 of my files. Review them with `git diff 24674d1a6 ab566fdf7 -- <paths below>` (33 files, +529/-229). The working tree matches HEAD in content for these files. Four of them show only a 100644→100755 mode change, which another writer staged, not me. All 33 files are LF with 0 CR bytes, and no file was converted. The AI rules headers in `AppQyV1BookSeedImporter.php` and `AppQyV1DailyReadingLibraryDefaults.php` are unchanged. Free RAM was 6.41 GB before the in-process checks (after waiting; it was 1.25 GB at first, so until then I ran static checks only).

Changed files (all under `poly_apps/laravel_main/`):
- AOQSD-09: `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1AITools/AppQyV1SentenceAudioController.php`
- MCHR-21: `app/Apps/AppQyV1/AppQyV1Controllers/AppQyV1Vocabulary/AppQyV1VocabularyCoverTaskCtl.php`
- LDRI-29: `app/Apps/AppQyV1/AppQyV1Commands/AppQyV1ResourceIndexCommand.php`
- CKA-26a (`app/Apps/AppQyV1/Utils/`):
  - `AppQyV1Initializer.php`, `AppQyV1VocabularyImporter.php`, `AppQyV1AITools/AppQyV1TranslationService.php`;
  - `AppQyV1SystemInit/{AppQyV1ImageFileProcessor,AppQyV1AudioFileProcessor,AppQyV1BookSeedImporter,AppQyV1DailyReadingLibraryDefaults}.php`.
- CKA-26b (`app/Apps/AppQyV1/`):
  - `AppQyV1Controllers/AppQyV1UserAuth/`: `AppQyV1AuthenticationLoginController.php`, `AppQyV1AuthenticationRegistrationController.php`, `AppQyV1AuthenticationPasswordConfirmationController.php`, and the three `AppQyV1AuthenticationEmailVerification*Controller.php` files;
  - `AppQyV1Controllers/AppQyV1User/AppQyV1UserInitializationController.php`;
  - `AppQyV1Controllers/AppQyV1System/`: `AppQyV1SystemInitializationController.php`, `AppQyV1ProcessingCapabilityController.php`, `AppQyV1SystemInitComplianceCtl.php`;
  - `AppQyV1Controllers/AppQyV1ClientAuth/AppQyV1ResourceAccessController.php`;
  - `AppQyV1Controllers/AppQyV1PersonDict/`: `AppQyV1PersonalDictionaryCreationController.php`, `AppQyV1PersonalDictionaryDeletionController.php`;
  - `AppQyV1Controllers/AppQyV1Group/`: `AppQyV1WordGroup{Creation,Deletion,Language,Library,Management,MediaSource,Query}Controller.php`;
  - `AppQyV1Middleware/AppQyV1ClientAuth/AppQyV1ResourceAccessAuth.php`.
- Lang, all items: `lang/en/app_qy_v1.php` and `lang/zh_CN/app_qy_v1.php`. Both files got the same 143 new `messages.*` keys in the same order, and 2 existing keys (`unknown_action`, `unknown_kind`) were parameterized. Each locale now has 339 keys.

Scratch scripts (not in the repo), in `D:\.tmp\claude\D--programing-core-node\59362416-9b59-4a9b-b284-e4b3d83daf06\scratchpad\wnl_g2\`:
- `scan.sh`: the audit literal scan;
- `keys_verify.php`: key resolution;
- `http_verify.php`: in-process HTTP and Utils checks;
- `ldri29_verify.php`: in-process artisan run under zh_CN and en;
- `static_parse.php`: AST parse without compiling;
- `apply_php.php` and `apply_lang.php`: exact-match replacers. Each one aborts before writing if any old string's count differs from the expected count.

### Gate and decisions (B9, recommended options)
- **AOQSD-09 gate (lang temporary writer).** I treated the gate as cleared, for two reasons:
  - the recorded B13 ruling (`.claude/agents_shared/d22/merge_meta.json:184`) assigns the `app_qy_v1` lang file to laravel-qyapp, and wordnew-laravel succeeds that role under D22/B14;
  - the G2 dispatch lists `lang/{en,zh_CN}/app_qy_v1.php` in every item.

  Before writing I confirmed that both files were clean, with no other writer. The writer role now goes back to pycore-laravel.
- **AOQSD-09 helper.** No AppQyV1-specific validation helper is shared across controllers. So I reused the `App\Traits\ApiResponse::codedError` envelope in the same way `AppQyV1DeliveryCtl` and `AppQyV1OrchAudioCtl` do: one private `validationFailed(Validator)` in the controller, with the stable code `SENTENCE_AUDIO_VALIDATION_FAILED` (`private const ERROR_VALIDATION_FAILED`).
  - The message is `app_qy_v1.messages.sentence_audio_validation_failed` with `:detail`, which is the validator's first error.
  - The existing keys `success` (false) and `error` stay, and HTTP stays 422.
  - Added keys: `error_code`, `message`, `data`/`details` (`{errors}`), `code` and `status`.
  - pycore checks the status code before it reads the body (`progress_upload.py:258`, `sentence_audio_full_sync.py:48`), so the added keys are safe.
- **CKA-26 scope.** I converted:
  - every `message`/`error`/`errors` value (plain literal, concatenated, interpolated, sprintf and ternary);
  - the message arguments of `success/error/notFound/forbidden/unauthorized`, including multi-line `success(..., 'Text')` arguments that the one-line audit pattern misses;
  - the `$errors[] = "Failed to process {$file}: ..."` interpolations.

  Log messages and log context keys, machine codes (`INVALID_CODE`, `LANGUAGE_MISMATCH`, `status` values) and `resource_index_built=yes|no` stay literal.
- **Reused keys:** `invalid_credentials`, `user_not_found`, `username_already_exists`, `group_not_found`, `authentication_required`, `unauthorized`. The image and audio processors share the `archive_*` keys.
- **Text changes (message only):**
  - the login `errors` text "must be required username and password or user-auth-token" is now the grammatical "Username and password, or a user-auth-token, are required";
  - the UserInitialization `errors.native_language` now names the code ("Unsupported language code: xx").
- **Files with an AI rules header.** `AppQyV1BookSeedImporter.php` and `AppQyV1DailyReadingLibraryDefaults.php` carry "do NOT compile, run, test". So I did not run `php -l` on them or execute them. Instead, a static AST parse with `nikic/php-parser` passed for both (`PARSE OK`), and I checked their `__()` keys through the lang files.

### AOQSD-09: done
- The 6 inline blocks (formerly at :77, :147, :277, :331, :369, :421) are now `return $this->validationFailed($validator);`. A grep for `Validation failed` in the controller finds 0 hits, and `validationFailed($validator)` has 6 call sites.
- `php -l` passes.
- In-process HTTP kernel, `GET /api/app_qy_v1/ai_tools/tts/sentence/without_audio?limit=abc`:
  - `Accept-Language: zh` returns 422 with `{"success":false,...,"error":"参数校验失败：The limit field must be an integer.","message":"(same)","error_code":"SENTENCE_AUDIO_VALIDATION_FAILED","code":422,"status":"error"}` and `details.errors.limit`. PASS;
  - `Accept-Language: en` returns 422 with `"error":"Validation failed: The limit field must be an integer."` and the same code. PASS.
- The same request through the restarted FrankenPHP worker also returned 422 with the zh message and the code.
- Note: the validator detail stays English because `lang/zh_CN/validation.php` does not exist (see Cross-scope).

### MCHR-21: done
- `'ids.required' => __('app_qy_v1.messages.cover_task_ids_required')`. `php -l` passes.
- In-process `GET /api/app_qy_v1/vocabulary/libraries/cover/tasks` without ids:
  - zh returns 422 with `message` and `errors.ids` = "缺少查询参数 ids（以逗号分隔的词库 ID）". PASS;
  - en returns 422 with "Query parameter ids is required (comma-separated library ids)". PASS. The live worker returns the same.

### LDRI-29: done
- Changes:
  - :38 and :43 are now `unknown_action`/`unknown_kind` with `:action`/`:kind` and `:expected`. The action list is now `private const ACTIONS`;
  - :48 → `resource_index_redis_unavailable`;
  - :56 → `resource_index_kind_rebuilt` (`:seconds` keeps `%.1f`);
  - :61-69 → `resource_index_reconcile_summary`, with `:completed` from `answer_yes`/`answer_no`;
  - :73 → `resource_index_kind_status`, with `resource_index_never_built`.

  Both `BUILT_YES`/`BUILT_NO` marker lines stay literal. `php -l` passes.
- `php artisan app_qy_v1:resource-index status` (read-only, no phpredis) exited 0 and printed the localized warning plus `resource_index_built=no`.
- In-process `Artisan::call` under zh_CN printed "Redis 不可达（resource_index 连接或 phpredis 缺失）；差异比对改用数据库/磁盘回退。" and `resource_index_built=no`, with markers=1. The en run also had markers=1.
- Invalid input exits 2:
  - `bogus` prints "Unknown action: bogus (expected rebuild, reconcile, status).";
  - `--kind=bogus` prints "Unknown kind: bogus (expected word_audio, sentence_audio, orch_segment, article, static_file).".

### CKA-26a: done
- Audit literal scan over `app/Apps/AppQyV1/Utils`: HEAD `24674d1a6` had 80 hits, and the working tree has **0**. The scan has three patterns:
  - a `'message'|'error'` key with a capitalized literal;
  - the LB-034 call pattern;
  - an interpolated double-quoted string in a message/error/`$errors[]` position.
- `php -l` passes on the 5 non-header files. The 2 header files pass the static AST parse.
- `keys_verify.php` (in-process) reports **PASS**:
  - the en and zh_CN key sets are equal (339/339);
  - every placeholder set matches per key;
  - all 338 `app_qy_v1.messages.*` keys referenced under `app/` resolve in both locales. The unreferenced key is the pre-existing `cover_regenerated`.
- Samples in-process (read-only, missing temp path):
  - `validateAudioArchive` gives "压缩包文件不存在" / "Archive file does not exist";
  - `processAudioArchive` gives "未找到音频压缩包" / "Audio archive not found";
  - `VocabularyImporter::importVocabularyFile` gives "文件不存在：<path>" / "File not found: <path>". PASS.

### CKA-26b: done
- The audit literal scan finds **0** hits in the 6 controller dirs and in `AppQyV1Middleware`; HEAD had 52 (UserAuth 25, User 4, System 3, ClientAuth 2, PersonDict 3, Group 15, Middleware 2). An extended scan for `notFound/forbidden/unauthorized(...)`, `'errors' => '...'`, `$errorMessage = '...'` and multi-line `], 'Text')` also finds 0. `php -l` passes on all 21 files, and the key script passes (above). Response keys and HTTP statuses are unchanged.
- Login failure through the in-process HTTP kernel, `POST /api/app_qy_v1/login`:
  - no credentials: zh returns 422 `{"message":"凭证无效","errors":"需要提供用户名和密码，或 user-auth-token"}` and en returns 422 `{"message":"Invalid credentials","errors":"Username and password, or a user-auth-token, are required"}`. The keys are still exactly `message, errors`. PASS;
  - unknown account: 422 "账号不存在" / "Account does not exist". PASS.
- FrankenPHP: `POST http://localhost:2019/frankenphp/workers/restart` returned 200, and `GET http://127.0.0.1:9000/api/health` returned **200**. Live login (zh) returned 422 with the zh message.

### Deferred (not in the G2 items; recorded for a later CKA-26 part)
- Non-message display texts in the touched files stay English. They are not `message`/`error` values:
  - `SystemInitComplianceCtl` section `name`/`summary`/`detail` (about 15);
  - `ProcessingCapabilityController` `reason` texts (6);
  - `ResourceAccessController::getAccessInfo` `description` (2);
  - `WordGroupMediaSourceController` `note` (2);
  - `AppQyV1Initializer` step `description`/`note` strings and its `INITIALIZATION_STEPS` constant;
  - internal exception messages.
- The rest of the audit scan in `app/Apps/AppQyV1` (140 hits) is outside G2:
  - AppQyV1AITools 52, including 10 in `AppQyV1SentenceAudioController` outside the six validation blocks;
  - Learning 15, StudyGen 12, WordQurey 10, Vocabulary 9;
  - Services 42.
- The image and audio file processors duplicate the whole archive-extraction code. They now share lang keys, but merging the code is a refactor outside this i18n item.

### Cross-scope notes (route through wordnew-lead / claude lead)
- **pycore-laravel (lang):** hand-back of `lang/{en,zh_CN}/app_qy_v1.php`. There is no `lang/zh_CN/validation.php`, so validator details (and every `validationError($errors, $errors->first())` message) stay English under zh. Adding that file would localize them.
- **pycore-laravel (`app/Traits/ApiResponse.php`):** these English defaults reach AppQyV1 responses:
  - `unauthorized()`, `forbidden()`, `notFound()` and `validationError()`;
  - the interpolated `languageMismatch()` text.

  One example is `$this->unauthorized()` in the Group controllers.
- **pycore-laravel (`UnifiedAuthService`):** `AppQyV1AuthenticationRegistrationController:163` still matches the English substring 'already exists' in that service's error. A stable error code there would remove the text match.

### Handoff
- Task: wordnew-laravel-G2 (AOQSD-09, MCHR-21, LDRI-29, CKA-26a, CKA-26b).
- Status: done. The code is in HEAD (`ab566fdf7`, user sweep). The verdict is due from wordnew-lead (`.claude/agents_shared/reviews/wordnew-laravel-G2.json`).
- Blockers: none. Next owners:
  - wordnew-lead: review G2;
  - claude lead: confirm the lang writer hand-back to pycore-laravel;
  - pycore-laravel: the cross-scope notes above.
