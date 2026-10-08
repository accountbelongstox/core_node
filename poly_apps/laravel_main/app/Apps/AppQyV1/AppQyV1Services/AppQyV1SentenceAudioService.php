<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Support\AudioOrchestrationContract;
use App\Support\QueueCenterContract;
use App\Services\WorkLeases\WorkLeaseLanes;
use App\Services\WorkLeases\WorkLeaseService;
use App\Services\QueueCenter\QueueCenterService;
use App\Services\TaskManagerService;
use App\Apps\AppQyV1\AppQyV1Models\Concerns\AppQyV1MediaGaps;
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
 * Sentences are keyed by content_id (md5) within their per-language table.
 * Work on the audio gap is handed out as work leases on the row
 * (WorkLeaseService; tts_lease_id / tts_lease_expires_at).
 */
class AppQyV1SentenceAudioService
{
    use AppQyV1SentenceAudioLookupTrait;
    use AppQyV1SentenceAudioQueueTrait;

    /**
     * Extension preference for resolving an existing on-disk audio file.
     * .mp3 is the canonical write target; the rest are accepted on read.
     */
    public const AUDIO_EXTENSIONS = ['mp3', 'aac', 'm4a', 'wav'];

    /** Per-instance memo of the sentence engine profile (one DB read per request). */
    private ?array $sentenceEngineInfoCache = null;

    // ------------------------------------------------------------------
    // §6  Sentence audio summary (tts/sentence/claim, counts only)
    // ------------------------------------------------------------------

    /**
     * Counts-only summary for the Queue Center "Sentence Audio" strip: pending
     * = the sentence audio gap (AppQyV1MediaGaps::SENTENCE_AUDIO), leased =
     * gap rows under a live work lease. Nothing is leased here; work is handed
     * out by WorkLeaseService. Without $language every language is summed.
     *
     * @return array{count:int,pending:int,leased:int,lock_stale_minutes:int,tasks:array<int,array<string,mixed>>}
     */
    public function claim(string $workerId, ?string $language, int $limit): array
    {
        $pending = $this->pendingCount($language);
        $leased = $this->leasedCount($language);

        // Summary only: sentence audio work is handed out as work leases
        // (WorkLeaseService); pending = the gap, leased = rows under a live lease.
        return [
            'count' => 0,
            'pending' => $pending,
            'leased' => $leased,
            'lock_stale_minutes' => intdiv((int) QueueCenterContract::section('work_leases')['lease_ttl_seconds'], 60),
            'engine' => $this->sentenceEngineInfo(),
            'tasks' => [],
        ];
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
                'primary' => $chain[0],
                'chain' => $chain,
                'gpu_gated' => true,
            ];
        }
        return $this->sentenceEngineInfoCache;
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
        return $sentence->getAttribute('obsolete_at') === null && $this->missingVariantsForRow($lang, $sentence) !== [];
    }

    /**
     * TTS variant specs the pycore worker should synthesize per language.
     * DB-driven via app_qy_v1_tts_variant_specs and seeded at sys:init. Missing
     * configuration fails explicitly through the authoritative model read path.
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
        ?array $variantMeta = null,
        ?string $text = null
    ): array {
        $language = AppQyV1TableMaps::normalizeLangCode($language);
        if ($language === '' || !$this->tableExists($language)) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Unknown or missing language', 'http_status' => 422];
        }

        $sentence = LangSentence::findByContentId($language, $contentId);
        if ($sentence === null && $success && is_string($text) && trim($text) !== '') {
            if (!hash_equals(MediaIngestService::computeContentId($text), $contentId)) {
                return ['ok' => false, 'status' => 'invalid', 'error' => __('audio_orchestration.content_id_mismatch'), 'http_status' => 422];
            }
            $sentence = $this->ensureSentenceRow($contentId, $language, trim($text));
        }
        if (!$sentence) {
            return ['ok' => false, 'status' => 'not_found', 'error' => 'Sentence not found', 'http_status' => 404];
        }

        $relativePath = $this->relativePathFor($language, $contentId, $variantKey);
        $fullPath = PathMapper::getAppQyV1SentenceSoundsDir($relativePath);

        // --- Quality upgrade of a fast-pass clip: the base clip stays; a failure never touches the row's own state ---
        if (!$success && $variantKey === (string) AudioOrchestrationContract::bookPlan('fast_pass.quality_variant')) {
            $this->clearLease($sentence);
            $sentence->saveRecord();
            if (!WorkLeaseService::isRepoolError($error)) {
                app(AppQyV1BookAudioPlanService::class)->noteUpgradeFailed($language, $contentId);
            }
            return ['ok' => true, 'status' => 'pending', 'http_status' => 200];
        }

        // --- Failure path: clear the lease, record the error, re-queueable ---
        if (!$success && WorkLeaseService::isRepoolError($error)) {
            // The node's engine cannot do this language: back to the pool, no attempt counted.
            $this->clearLease($sentence);
            $sentence->tts_status = 'pending';
            $sentence->saveRecord();
            return ['ok' => true, 'status' => 'pending', 'http_status' => 200];
        }
        if (!$success) {
            // Same retry budget as words: the row stays leasable until MAX_ATTEMPTS.
            $this->recordError($sentence, $error ?: 'Worker reported failure');
            $this->clearLease($sentence);
            $sentence->tts_attempts = (int) $sentence->tts_attempts + 1;
            $sentence->tts_status = $sentence->tts_attempts >= AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS ? 'failed' : 'pending';
            $sentence->saveRecord();
            return ['ok' => true, 'status' => $sentence->tts_status, 'http_status' => 200];
        }

        // --- Quality floor: a floor language (en) accepts only its listed engines (qwen3tts, GPU) ---
        if (!self::isAcceptedSentenceProvider($provider, $language)) {
            $this->clearLease($sentence);
            $sentence->saveRecord();
            Log::warning('[SentenceAudio] Report below the quality floor rejected', ['content_id' => $contentId, 'language' => $language, 'worker' => $workerId, 'provider' => (string) $provider]);

            return ['ok' => false, 'status' => 'invalid', 'error' => (string) self::qualityRule('reject_code'), 'http_status' => 422];
        }

        // --- Idempotent fill-missing: a file already on disk is never clobbered, unless its recorded provider is below the floor ---
        clearstatcache(true, $fullPath);
        $storedProvider = (string) (((array) $sentence->metadata)['audio_provider'] ?? '');
        $belowFloor = ($variantKey === null || $variantKey === '') && $storedProvider !== '' && !self::isAcceptedSentenceProvider($storedProvider, $language);
        if (!$belowFloor && is_file($fullPath) && filesize($fullPath) > 0) {
            $this->reconcilePresent($sentence, $relativePath);
            $this->clearLease($sentence);
            $sentence->saveRecord();
            app(AppQyV1BookAudioPlanService::class)->noteDelivery($language, $contentId, $variantKey, $provider);
            app(AppQyV1ResourceIndexService::class)->recordSentence($language, $contentId, $variantKey);
            $this->settleQueueTask($language, $contentId, $sentence);
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
        app(AppQyV1BookAudioPlanService::class)->noteDelivery($language, $contentId, $variantKey, $provider);
        app(AppQyV1ResourceIndexService::class)->recordSentence($language, $contentId, $variantKey);
        $this->settleQueueTask($language, $contentId, $sentence);
        WorkLeaseService::noteCompletion($workerId);

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

    /**
     * A delivery from any origin (a claimed task, a lease or a node's own
     * orchestration clip) that completes the row also completes its pending
     * sentence_audio ticket, so no mirror re-synthesizes it. A leased ticket
     * is left to its owner, whose report then hits already_done.
     */
    private function settleQueueTask(string $language, string $contentId, LangSentence $sentence): void
    {
        if ($sentence->tts_status !== 'completed') {
            return;
        }
        AppQyV1ClipReadyPublisher::publish(AppQyV1AudioBundleService::KIND_SENTENCE, $language, $contentId);
        try {
            app(TaskManagerService::class)->settlePendingTaskByGroupKey(
                QueueCenterService::QUEUE_SENTENCE_AUDIO,
                QueueCenterService::dedupKeyFor(QueueCenterService::QUEUE_SENTENCE_AUDIO, $language, $contentId),
                'sentence audio persisted to the canonical row'
            );
        } catch (\Throwable $exception) {
            Log::warning('[SentenceAudio] sentence_audio queue settle failed', [
                'language' => $language,
                'content_id' => $contentId,
                'error' => $exception->getMessage(),
            ]);
        }
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
            AppQyV1MediaGaps::SENTENCE_AUDIO
        ));
    }

    private function pendingCountForLanguage(string $lang): int
    {
        return LangSentence::pendingAudioCount($lang);
    }

    /** Gap sentences under a live work lease, optionally per language. */
    public function leasedCount(?string $language = null): int
    {
        $whereSql = '(' . AppQyV1MediaGaps::SENTENCE_AUDIO . ') AND ' . WorkLeaseLanes::LEASED;
        $bindings = [now()];

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
        $sentence->fill(WorkLeaseService::clearedLease());
    }

    /** One value of work_leases.sentence_quality. */
    public static function qualityRule(string $name): mixed
    {
        return QueueCenterContract::section('work_leases')['sentence_quality'][$name] ?? null;
    }

    /** Whether a provider (engine id) may deliver sentence audio of a language (no floor = any engine). */
    public static function isAcceptedSentenceProvider(?string $provider, ?string $language): bool
    {
        $engines = QueueCenterContract::sentenceFloorEngines($language);

        return $engines === null || in_array(strtolower(trim((string) $provider)), $engines, true);
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

    /** Whether the per-language sentence table for $lang exists. */
    private function tableExists(string $lang): bool
    {
        static $cache = [];
        $lang = AppQyV1TableMaps::normalizeLangCode($lang);
        if (array_key_exists($lang, $cache)) {
            return $cache[$lang];
        }
        $exists = LangSentence::tableExists($lang);
        $cache[$lang] = $exists;
        return $exists;
    }
}
