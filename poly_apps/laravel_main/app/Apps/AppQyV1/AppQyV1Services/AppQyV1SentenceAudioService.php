<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsEngineConfigModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TtsVariantSpecModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1SentenceAudioUrl;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel as LangSentence;
use App\Providers\PathMapper;
use App\Services\MediaIngestService;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;

/**
 * Sentence-library audio pipeline (laravel_main side of the Books v3 unified
 * model — see poly_apps/pycore_laravel_wordnew_ui/apps/wordnew/docs/BOOKS_FEATURE_SPECIFICATION.md §6).
 *
 * The FILE on disk is the source of truth, NOT the DB:
 *   <sentence_sounds>/<language>/<content_id>.mp3
 *   sentence_sounds = PathMapper::getAppQyV1SentenceSoundsDir()
 * The per-language sentence tables ({prefix}_sentences_{lang}) store only a
 * has_audio flag + audio cache to PREVENT DUPLICATE GENERATION; the resolve
 * route reconciles them from the filesystem and never trusts them over a stat().
 *
 * Sentences are keyed by content_id (md5) within their per-language table. The
 * lease lives in the dedicated tts_locked_at / tts_locked_by columns (a local
 * worker lease is stale after LOCK_STALE_MINUTES, an assist worker after
 * ASSIST_LEASE_MINUTES). Stale leases are taken over by the next claim.
 */
class AppQyV1SentenceAudioService
{
    use AppQyV1SentenceAudioLookupTrait;
    use AppQyV1SentenceAudioQueueTrait;

    /** A local worker's processing lease is stale after this many minutes. */
    public const LOCK_STALE_MINUTES = 10;

    /** Assist-protocol leases (assist:* workers) stay live for 60 minutes. */
    public const ASSIST_LEASE_MINUTES = AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES;

    /** Worker-id prefix marking an assist-protocol claim (longer lease). */
    public const ASSIST_WORKER_PREFIX = AppQyV1DictionaryTTSCoordinator::ASSIST_WORKER_PREFIX;

    /**
     * Extension preference for resolving an existing on-disk audio file.
     * .mp3 is the canonical write target; the rest are accepted on read.
     */
    public const AUDIO_EXTENSIONS = ['mp3', 'aac', 'm4a', 'wav'];

    /** Per-instance memo of the sentence engine profile (one DB read per request). */
    private ?array $sentenceEngineInfoCache = null;

    // ------------------------------------------------------------------
    // §6  Compatibility claim for sentences needing audio
    // ------------------------------------------------------------------

    /**
     * Claim up to $limit sentences missing one or more audio variants and not
     * currently leased, ordered by occurrence_count DESC and id ASC across the
     * requested language(s). Canonical workers claim global_tasks front slices.
     *
     * Per-variant: a row is claimable when missingVariantsForRow() finds any
     * configured variant absent on disk - including rows that already have
     * has_audio=true (e.g. duoreader_tts present but uk_f absent). The initial
     * SQL filter only narrows the candidate set; the disk-stat in
     * missingVariantsForRow() makes the final decision.
     *
     * When $language is null the claim sweeps EVERY supported per-language
     * table. When $limit <= 0 the method returns counts only (FE summary),
     * leasing nothing.
     *
     * @return array{count:int,pending:int,leased:int,lock_stale_minutes:int,tasks:array<int,array<string,mixed>>}
     */
    public function claim(string $workerId, ?string $language, int $limit): array
    {
        $pending = $this->pendingCount($language);
        $leased = $this->leasedCount($language);

        // Summary-only mode for the Queue Center "Sentence Audio" strip. The
        // `engine` block surfaces the qwen3tts-first sentence profile (preference
        // only; pycore GPU-gates the actual selection).
        if ($limit <= 0) {
            return [
                'count' => 0,
                'pending' => $pending,
                'leased' => $leased,
                'lock_stale_minutes' => self::LOCK_STALE_MINUTES,
                'engine' => $this->sentenceEngineInfo(),
                'tasks' => [],
            ];
        }

        $limit = min(50, $limit);
        $isAssist = str_starts_with($workerId, self::ASSIST_WORKER_PREFIX);
        $window = $isAssist ? self::ASSIST_LEASE_MINUTES : self::LOCK_STALE_MINUTES;

        $tasks = [];
        $languages = $this->languagesFor($language);
        $langCount = count($languages);
        // Pass 1: fair per-language quota. Filling the whole batch from the
        // first language table (old behavior) lets a large backlog in one
        // language (e.g. zh) starve every other language out of each cycle.
        $quota = $langCount > 1 ? max(1, (int) ceil($limit / $langCount)) : $limit;
        foreach ($languages as $lang) {
            if (count($tasks) >= $limit) {
                break;
            }
            $claimed = $this->claimForLanguage($lang, $workerId, $window, min($quota, $limit - count($tasks)));
            foreach ($claimed as $task) {
                $task['task_id'] = count($tasks);
                $tasks[] = $task;
            }
        }
        // Pass 2: top up from languages in order when some language had fewer
        // claimable rows than its quota (rows leased in pass 1 are locked now,
        // so re-claiming the same language never duplicates a task).
        foreach ($languages as $lang) {
            if (count($tasks) >= $limit) {
                break;
            }
            $claimed = $this->claimForLanguage($lang, $workerId, $window, $limit - count($tasks));
            foreach ($claimed as $task) {
                $task['task_id'] = count($tasks);
                $tasks[] = $task;
            }
        }

        return [
            'count' => count($tasks),
            'pending' => $pending,
            'leased' => $leased,
            'lock_stale_minutes' => self::LOCK_STALE_MINUTES,
            'engine' => $this->sentenceEngineInfo(),
            'tasks' => $tasks,
        ];
    }

    /**
     * Declared sentence-audio engine profile carried on claim tasks / assist
     * requests and surfaced by the Queue Center. qwen3tts-first (GPU) with a
     * fallback chain. This is a PREFERENCE only — laravel never runs models;
     * pycore's tts_orchestrator resolves the actual engine and is GPU-gated, so
     * it falls back down the chain when qwen3tts is unavailable. Derived from the
     * DB-driven engine config so an operator-disabled qwen3tts is honored.
     *
     * @return array{profile:string,primary:string,chain:array<int,string>,gpu_gated:bool}
     */
    public function sentenceEngineInfo(): array
    {
        if ($this->sentenceEngineInfoCache === null) {
            $chain = AppQyV1TtsEngineConfigModel::sentenceEngineChain();
            $this->sentenceEngineInfoCache = [
                'profile' => AppQyV1TtsEngineConfigModel::SENTENCE_PROFILE,
                'primary' => $chain[0] ?? AppQyV1TtsEngineConfigModel::SENTENCE_PRIMARY_DEFAULT,
                'chain' => $chain,
                'gpu_gated' => true,
            ];
        }
        return $this->sentenceEngineInfoCache;
    }

    /**
     * Claim up to $limit rows for ONE language table under a transaction +
     * row lock, taking over stale leases. Returns the built task descriptors.
     *
     * @return array<int,array<string,mixed>>
     */
    private function claimForLanguage(string $lang, string $workerId, float $window, int $limit): array
    {
        if ($limit <= 0 || !$this->tableExists($lang)) {
            return [];
        }

        $cutoff = now()->subMinutes((int) ceil($window));
        $candidateLimit = min(250, max($limit * 8, $limit));

        return LangSentence::runForLanguageTransaction($lang, function () use ($lang, $workerId, $cutoff, $limit, $candidateLimit) {
            $rows = LangSentence::claimableAudioRows($lang, $cutoff, $candidateLimit);
            $tasks = [];
            foreach ($rows as $row) {
                if (count($tasks) >= $limit) {
                    break;
                }
                $this->reconcilePartialRow($row, $lang);
                $missing = $this->missingVariantsForRow($lang, $row);
                if ($missing === []) {
                    continue;
                }

                $row->tts_locked_at = now();
                $row->tts_locked_by = mb_substr($workerId, 0, 100);
                $row->tts_status = 'processing';
                $row->saveRecord();

                $tasks[] = $this->buildTask($lang, $row, $missing);
            }
            return $tasks;
        }, 1);
    }

    /**
     * Variant specs still missing on disk for one sentence row.
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public function missingVariantsForRow(string $lang, LangSentence $sentence): array
    {
        $missing = [];
        foreach ($this->variantsForLanguage($lang) as $spec) {
            $key = (string) ($spec['key'] ?? '');
            if ($this->variantExistsOnDisk($lang, (string) $sentence->content_id, $key === '' ? null : $key)) {
                continue;
            }
            $missing[] = $spec;
        }
        return $missing;
    }

    /** True when any configured variant is absent on disk. */
    public function rowNeedsAudioWork(string $lang, LangSentence $sentence): bool
    {
        return $this->missingVariantsForRow($lang, $sentence) !== [];
    }

    /** Align tts_status with per-variant completeness (handles legacy completed rows). */
    private function reconcilePartialRow(LangSentence $sentence, string $lang): void
    {
        $missing = $this->missingVariantsForRow($lang, $sentence);
        if ($missing === []) {
            if ($sentence->tts_status !== 'completed') {
                $sentence->tts_status = 'completed';
                $sentence->saveRecord();
            }
            return;
        }
        if ($sentence->tts_status === 'completed') {
            $sentence->tts_status = 'pending';
            $sentence->saveRecord();
        }
    }

    /** Build the §6 task descriptor for one claimed sentence. */
    private function buildTask(string $lang, LangSentence $sentence, ?array $variants = null): array
    {
        $contentId = (string) $sentence->content_id;
        $variantList = $variants ?? $this->missingVariantsForRow($lang, $sentence);
        if ($variantList === []) {
            $variantList = $this->variantsForLanguage($lang);
        }

        return [
            'task_id' => 0,
            'type' => 'sentence',
            // content_id is the canonical key; sentence_id kept for compat.
            'content_id' => $contentId,
            'sentence_id' => $sentence->sentence_id !== null ? (string) $sentence->sentence_id : null,
            'content' => (string) $sentence->text,
            'language' => $lang,
            'audio_relative_path' => $lang . '/' . $contentId . '.mp3',
            // Engine PREFERENCE for this lane: qwen3tts-first (GPU). pycore's
            // orchestrator uses the "sentence" priority_profile and GPU-gates the
            // real choice — this label never forces the engine. Memoized so a
            // 50-task batch reads the engine config once.
            'engine_profile' => $this->sentenceEngineInfo()['profile'],
            'preferred_engine' => $this->sentenceEngineInfo()['primary'],
            // Only the MISSING variants are handed out (file-first / cache-aware):
            // a variant whose {lang}/{content_id}[_{key}].mp3 exists is never
            // re-requested, matching pycore's per-variant sentence cache.
            'variants' => $variantList,
        ];
    }

    /**
     * TTS variant specs the pycore worker should synthesize per language.
     * DB-driven via app_qy_v1_tts_variant_specs (seeded at sys:init); falls back
     * to the hardcoded spec set when the table is missing/empty. Identical return
     * shape across sentence + word audio (single read path on the model).
     *
     * @return array<int,array{key:string,accent:?string,gender:string}>
     */
    public function variantsForLanguage(string $lang): array
    {
        return AppQyV1TtsVariantSpecModel::variantsForLanguage($lang);
    }

    // ------------------------------------------------------------------
    // §6  Report a generated sentence audio (validated, idempotent)
    // ------------------------------------------------------------------

    /**
     * Ingest one worker-reported sentence audio result, keyed by content_id +
     * language against {prefix}_sentences_{lang}.
     *
     * Success: validate the MP3, write it to the deterministic §6 path, set
     * has_audio=true + audio="{lang}/{content_id}.mp3" + tts_status=completed,
     * clear the lease. Idempotent — a file already on disk acks already_done and
     * is never clobbered.
     *
     * Failure: record the error, clear the lease so the sentence is re-claimable.
     *
     * @return array{ok:bool,status:string,already_done?:bool,error?:string,http_status:int}
     */
    public function report(
        string $contentId,
        string $language,
        string $workerId,
        bool $success,
        ?string $audioBinary,
        ?string $provider,
        ?string $error,
        ?string $variantKey = null,
        ?array $variantMeta = null
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Unknown or missing language', 'http_status' => 422];
        }

        $sentence = LangSentence::findByContentId($language, $contentId);
        if (!$sentence) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Sentence not found', 'http_status' => 404];
        }

        $relativePath = $this->relativePathFor($language, $contentId, $variantKey);
        $fullPath = PathMapper::getAppQyV1SentenceSoundsDir($relativePath);

        // --- Failure path: clear the lease, record the error, re-queueable ---
        if (!$success) {
            $this->recordError($sentence, $error ?: 'Worker reported failure');
            $this->clearLease($sentence);
            $sentence->tts_status = 'failed';
            $sentence->tts_attempts = (int) $sentence->tts_attempts + 1;
            $sentence->saveRecord();
            return ['ok' => true, 'status' => 'failed', 'http_status' => 200];
        }

        // --- Idempotent fill-missing: a file already on disk is never clobbered ---
        clearstatcache(true, $fullPath);
        if (is_file($fullPath) && filesize($fullPath) > 0) {
            $this->reconcilePresent($sentence, $relativePath);
            $this->clearLease($sentence);
            $sentence->saveRecord();
            return [
                'ok' => true,
                'status' => 'completed',
                'already_done' => true,
                'audio_url' => AppQyV1SentenceAudioUrl::forRelative($relativePath),
                'http_status' => 200,
            ];
        }

        // --- Validate the payload (never trust the wire) ---
        if ($audioBinary === null || strlen($audioBinary) < 100) {
            $this->recordError($sentence, 'Rejected: empty or undersized audio payload');
            $this->clearLease($sentence);
            $sentence->tts_status = 'failed';
            $sentence->saveRecord();
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Audio payload empty or too small (<100 bytes)', 'http_status' => 422];
        }
        if (!AppQyV1DictionaryTTSCoordinator::looksLikeMp3($audioBinary)) {
            $this->recordError($sentence, 'Rejected: payload is not a valid MP3');
            $this->clearLease($sentence);
            $sentence->tts_status = 'failed';
            $sentence->saveRecord();
            return ['ok' => false, 'status' => 'invalid', 'error' => 'Audio payload failed MP3 validation', 'http_status' => 422];
        }

        // --- Persist to the deterministic path, re-verify on disk ---
        FileSystemManager::ensureDirectoryExists(dirname($fullPath));
        if (@file_put_contents($fullPath, $audioBinary) === false) {
            return ['ok' => false, 'status' => 'error', 'error' => 'Failed to persist audio file', 'http_status' => 500];
        }
        clearstatcache(true, $fullPath);
        if (!is_file($fullPath) || filesize($fullPath) !== strlen($audioBinary)) {
            @unlink($fullPath);
            return ['ok' => false, 'status' => 'error', 'error' => 'Persisted audio failed verification', 'http_status' => 500];
        }

        if ($this->variantExistsOnDisk($language, $contentId, null)) {
            $sentence->has_audio = true;
        }
        if ($variantKey === null || $variantKey === '') {
            $sentence->audio = $relativePath;
        } else {
            $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
            $variants = is_array($metadata['audio_variants'] ?? null) ? $metadata['audio_variants'] : [];
            $variants[$variantKey] = $relativePath;
            $metadata['audio_variants'] = $variants;
            $sentence->metadata = $metadata;
            if (!$sentence->audio) {
                $sentence->audio = $this->relativePathFor($language, $contentId, null);
            }
        }
        $entryMeta = is_array($variantMeta) ? $variantMeta : [];
        AppQyV1SentenceAudioFiles::upsert($sentence, array_merge([
            'variant_key' => $variantKey ?? '',
            'path' => $relativePath,
            'has_file' => true,
            'provider' => $provider ?: ('worker:' . $workerId),
            'uploaded_at' => now()->toIso8601String(),
        ], $entryMeta));
        $this->recordProvider($sentence, $provider ?: ('worker:' . $workerId));
        $this->clearLease($sentence);
        if ($this->missingVariantsForRow($language, $sentence) === []) {
            $sentence->tts_status = 'completed';
            $sentence->tts_completed_at = now();
        } else {
            $sentence->tts_status = 'pending';
        }
        $sentence->saveRecord();

        Log::info('[SentenceAudio] Worker result accepted', [
            'content_id' => $contentId,
            'language' => $language,
            'worker' => $workerId,
            'bytes' => strlen($audioBinary),
            'path' => $relativePath,
        ]);

        return [
            'ok' => true,
            'status' => 'completed',
            'audio_url' => AppQyV1SentenceAudioUrl::forRelative($relativePath),
            'http_status' => 200,
        ];
    }

    // ------------------------------------------------------------------
    // §6  Resolve / play one sentence's audio (file-first)
    // ------------------------------------------------------------------

    /**
     * Resolve a single sentence's audio FROM THE content_id, file-first.
     * Accepts a content_id (md5) hash, or text+language to hash server-side.
     * Existence is decided by stat-ing the filesystem directly — the DB is read
     * only to reconcile the cache.
     *
     * Optional $variantKey resolves a specific suffixed path
     * ({lang}/{content_id}_{variant_key}.mp3); optional $accent resolves the
     * first on-disk variant whose spec matches that accent (us/uk/...), falling
     * back to the extension-preference scan when no variant matches. The
     * audio_files list is always returned for the FE accent picker.
     *
     * @return array<string,mixed> the JSON body
     */
    public function resolve(
        ?string $hash,
        ?string $text,
        ?string $language,
        ?string $variantKey = null,
        ?string $accent = null,
        bool $enqueueMissing = true
    ): array
    {
        $resolvedLang = ($language !== null && trim($language) !== '')
            ? AppQyV1TableMaps::normalizeLangCode($language)
            : null;

        // Derive the content_id when only text was supplied (language-agnostic).
        $resolvedHash = ($hash !== null && $hash !== '') ? $hash : null;
        if ($resolvedHash === null && $text !== null && $text !== '') {
            $resolvedHash = MediaIngestService::computeContentId($text);
        }

        if ($resolvedHash === null || $resolvedHash === '' || $resolvedLang === null || $resolvedLang === '') {
            return ['success' => false, 'exists' => false, 'error' => 'Provide hash (content_id) or text, plus language', 'hash' => $resolvedHash];
        }

        $sentence = $this->locate($resolvedHash, $resolvedLang);
        $audioFilesPayload = $sentence
            ? $this->formatAudioFilesForApi($sentence)
            : [];

        $vkey = ($variantKey !== null && trim($variantKey) !== '') ? trim($variantKey) : null;
        if ($vkey !== null && $this->variantExistsOnDisk($resolvedLang, $resolvedHash, $vkey)) {
            $relative = $this->relativePathFor($resolvedLang, $resolvedHash, $vkey);
            return [
                'success' => true,
                'exists' => true,
                'url' => AppQyV1SentenceAudioUrl::forRelative($relative),
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
                'variant_key' => $vkey,
                'tts_status' => $sentence?->tts_status,
                'audio_files' => $audioFilesPayload,
            ];
        }

        // Accent filter: resolve the first on-disk variant whose spec matches
        // the requested accent (us/uk/...). Falls through to the extension
        // preference scan below when no variant matches the accent.
        $accentNorm = ($accent !== null && trim($accent) !== '') ? strtolower(trim($accent)) : null;
        if ($vkey === null && $accentNorm !== null) {
            foreach ($this->variantsForLanguage($resolvedLang) as $spec) {
                $specAccent = isset($spec['accent']) ? strtolower((string) $spec['accent']) : '';
                if ($specAccent !== $accentNorm) {
                    continue;
                }
                $specKey = (string) ($spec['key'] ?? '');
                $specKeyForDisk = $specKey !== '' ? $specKey : null;
                if ($this->variantExistsOnDisk($resolvedLang, $resolvedHash, $specKeyForDisk)) {
                    $relative = $this->relativePathFor($resolvedLang, $resolvedHash, $specKeyForDisk);
                    return [
                        'success' => true,
                        'exists' => true,
                        'url' => AppQyV1SentenceAudioUrl::forRelative($relative),
                        'hash' => $resolvedHash,
                        'content_id' => $resolvedHash,
                        'language' => $resolvedLang,
                        'variant_key' => $specKey,
                        'accent' => $spec['accent'],
                        'tts_status' => $sentence?->tts_status,
                        'audio_files' => $audioFilesPayload,
                    ];
                }
            }
        }

        // FILE-FIRST: stat the disk, honoring the extension preference order.
        $found = $this->findOnDisk($resolvedLang, $resolvedHash);

        if ($found !== null) {
            // Reconcile a stale cache to match the filesystem (never the reverse).
            if ($sentence && (!$sentence->has_audio || $sentence->audio !== $found['relative'])) {
                $sentence->has_audio = true;
                $sentence->audio = $found['relative'];
                $sentence->saveRecord();
            }

            return [
                'success' => true,
                'exists' => true,
                'url' => AppQyV1SentenceAudioUrl::forRelative($found['relative']),
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
                'tts_status' => $sentence?->tts_status ?? 'completed',
                'audio_files' => $audioFilesPayload,
            ];
        }

        if (!$enqueueMissing) {
            return [
                'success' => true,
                'exists' => false,
                'queued' => false,
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
                'tts_status' => $sentence?->tts_status,
                'audio_files' => $audioFilesPayload,
            ];
        }

        // Missing on disk: ensure a LangSentence row exists before queue-head insertion.
        // Book-reader resolve always sends text+language; without text we cannot
        // create a row and must NOT pretend the sentence was queued.
        $textTrimmed = ($text !== null) ? trim($text) : '';
        if ($sentence === null && $textTrimmed !== '') {
            $sentence = $this->ensureSentenceRow($resolvedHash, $resolvedLang, $textTrimmed);
        }

        if ($sentence) {
            if ($sentence->has_audio || $sentence->audio !== null) {
                $sentence->has_audio = false;
                $sentence->audio = null;
            }
            $queueResult = $this->moveToHead(
                $resolvedHash,
                $resolvedLang,
                true,
                (string) $sentence->text,
                true
            );
            if (!(bool) ($queueResult['ok'] ?? false)) {
                return [
                    'success' => false,
                    'exists' => false,
                    'queued' => false,
                    'error' => $queueResult['error'] ?? 'Queue Center task creation failed',
                    'hash' => $resolvedHash,
                    'content_id' => $resolvedHash,
                    'language' => $resolvedLang,
                    'audio_files' => $audioFilesPayload,
                ];
            }

            return [
                'success' => true,
                'exists' => false,
                'queued' => !(bool) ($queueResult['already_done'] ?? false),
                'hash' => $resolvedHash,
                'content_id' => $resolvedHash,
                'language' => $resolvedLang,
                'tts_status' => $sentence->tts_status,
                'audio_files' => $audioFilesPayload,
                'queue_task_id' => $queueResult['task_id'] ?? null,
                'queue_position' => $queueResult['queue_position'] ?? null,
                'queue_status' => $queueResult['status'] ?? null,
                'queue_head_action' => $queueResult['head_action'] ?? null,
            ];
        }

        return [
            'success' => true,
            'exists' => false,
            'queued' => false,
            'error' => 'sentence_not_ingested',
            'hash' => $resolvedHash,
            'content_id' => $resolvedHash,
            'language' => $resolvedLang,
        ];
    }

    // ------------------------------------------------------------------
    // Counts (FE summary) + lease bookkeeping (tts_* columns)
    // ------------------------------------------------------------------

    /** Sentences still needing one or more audio variants, optionally per-language. */
    public function pendingCount(?string $language = null): int
    {
        if ($language !== null && trim($language) !== '') {
            $lang = AppQyV1TableMaps::normalizeLangCode($language);
            return $this->tableExists($lang) ? $this->pendingCountForLanguage($lang) : 0;
        }

        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection(\App\Constants\AppKeys::APPQYV1);
        $tables = [];
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $tables[$lang] = AppQyV1TableMaps::getSentenceTableName($lang);
        }

        return array_sum(AppQyV1PerLanguageMetrics::countByLanguage(
            $connection,
            AppQyV1PerLanguageMetrics::filterExistingTables($connection, $tables),
            "(has_audio = false OR tts_status IN ('pending', 'failed'))"
        ));
    }

    private function pendingCountForLanguage(string $lang): int
    {
        return LangSentence::pendingAudioCount($lang);
    }

    /**
     * Sentences currently under a LIVE audio lease (tts_locked_at younger than
     * the worker's window), optionally per-language.
     */
    public function leasedCount(?string $language = null): int
    {
        $localCutoff = now()->subMinutes((int) ceil(self::LOCK_STALE_MINUTES));
        $assistCutoff = now()->subMinutes((int) ceil(self::ASSIST_LEASE_MINUTES));

        // A lease is live when: an assist owner locked it after assistCutoff,
        // OR any owner locked it after the (stricter) local cutoff.
        $whereSql = "(has_audio = false OR tts_status IN ('pending', 'failed', 'processing'))"
            . ' AND tts_locked_at IS NOT NULL'
            . ' AND (tts_locked_at >= ? OR (tts_locked_at >= ? AND tts_locked_by LIKE ?))';
        $bindings = [
            $localCutoff->toDateTimeString(),
            $assistCutoff->toDateTimeString(),
            self::ASSIST_WORKER_PREFIX . '%',
        ];

        if ($language !== null && trim($language) !== '') {
            $lang = AppQyV1TableMaps::normalizeLangCode($language);
            if (!$this->tableExists($lang)) {
                return 0;
            }
            return LangSentence::countBySqlFilter($lang, $whereSql, $bindings);
        }

        $connection = \App\Providers\AppTablePrefixServiceProvider::getConnection(\App\Constants\AppKeys::APPQYV1);
        $tables = [];
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $tables[$lang] = AppQyV1TableMaps::getSentenceTableName($lang);
        }

        return array_sum(AppQyV1PerLanguageMetrics::countByLanguage(
            $connection,
            AppQyV1PerLanguageMetrics::filterExistingTables($connection, $tables),
            $whereSql,
            $bindings
        ));
    }

    /** Drop the lease columns (in-memory; caller saves). */
    private function clearLease(LangSentence $sentence): void
    {
        $sentence->tts_locked_at = null;
        $sentence->tts_locked_by = null;
    }

    /** Stamp the last error into metadata + tts_error (in-memory; caller saves). */
    private function recordError(LangSentence $sentence, string $error): void
    {
        $sentence->tts_error = mb_substr($error, 0, 2000);
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata['audio_error'] = mb_substr($error, 0, 2000);
        $metadata['audio_error_at'] = now()->toIso8601String();
        $sentence->metadata = $metadata;
    }

    /** Stamp the generating provider into metadata (in-memory; caller saves). */
    private function recordProvider(LangSentence $sentence, string $provider): void
    {
        $sentence->tts_error = null;
        $metadata = is_array($sentence->metadata) ? $sentence->metadata : [];
        $metadata['audio_provider'] = mb_substr($provider, 0, 100);
        $metadata['audio_generated_at'] = now()->toIso8601String();
        unset($metadata['audio_error'], $metadata['audio_error_at']);
        $sentence->metadata = $metadata;
    }

    /** Absolute on-disk path for a "{language}/{content_id}.ext" relative reference. */
    public function fullPathFor(string $relativePath): string
    {
        return PathMapper::getAppQyV1SentenceSoundsDir($relativePath);
    }

    // ------------------------------------------------------------------
    // Per-language table helpers
    // ------------------------------------------------------------------

    /**
     * The language codes to operate on: a single requested language, or every
     * supported language when null/empty.
     *
     * @return array<int,string>
     */
    private function languagesFor(?string $language): array
    {
        if ($language !== null && trim($language) !== '') {
            return [AppQyV1TableMaps::normalizeLangCode($language)];
        }
        return AppQyV1TableMaps::getSupportedLanguages();
    }

    /** Whether the per-language sentence table for $lang exists. */
    private function tableExists(string $lang): bool
    {
        static $cache = [];
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        if (array_key_exists($lang, $cache)) {
            return $cache[$lang];
        }
        $model = LangSentence::for($lang);
        $exists = $model->getConnection()
            ->getSchemaBuilder()
            ->hasTable($model->getTable());
        $cache[$lang] = $exists;
        return $exists;
    }
}
