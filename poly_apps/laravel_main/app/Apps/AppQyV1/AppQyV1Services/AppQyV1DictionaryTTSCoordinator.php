<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Support\QueueCenterContract;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\Log;

/**
 * Dictionary-direct TTS coordination — the replacement for the decommissioned
 * app_qy_v1_tts_queue intermediate table.
 *
 * Single source of truth:
 *   - words:    {prefix}_tts_cache_{lang}  (has_audio + tts_files + tts_* state)
 *   - articles: {prefix}_articles          (has_audio + audio_files + tts_* state)
 *   - sentences: the deterministic audio FILE itself (EdgeTTSService path) —
 *     stateless, no row anywhere.
 *
 * "Needs generation" is a live query against the canonical tables; claim
 * locking, retries and errors live in the tts_* columns added by migration
 * AppQyV1_2026_06_12_000010. External processors (pycore) claim batches and
 * report results back; every reported result is VALIDATED (row identity,
 * non-empty payload, MP3 magic bytes) before it can touch the main table.
 *
 * Task-id codec: external clients (qy_capacitor / WordNew) poll by numeric
 * task_id. Queue ids were globally unique; canonical row ids are per-table, so
 * ids are encoded as  rowId * 1000 + typeDigit * 100 + langIndex  using the
 * STABLE registries below (JS-safe: row ids stay far below 2^43).
 */
class AppQyV1DictionaryTTSCoordinator
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';

    public const TYPE_WORD = 'word';
    public const TYPE_SENTENCE = 'sentence';
    public const TYPE_ARTICLE = 'article';

    /** Max generation attempts before a row is left as failed. */
    public const MAX_ATTEMPTS = 3;

    /** A processing claim older than this is stale and re-claimable. */
    public const LOCK_STALE_MINUTES = 10;

    /**
     * Third-party assist lease window. Claims made through the assist
     * protocol (POST /api/app_qy_v1/assist/claim) carry a tts_locked_by
     * prefixed with ASSIST_WORKER_PREFIX and stay live for 60 minutes
     * instead of LOCK_STALE_MINUTES, because the external worker may batch
     * covers/TTS/translations and report back slowly. Expired assist leases
     * are reclaimed exactly like stale local locks (the reclaiming UPDATE
     * overwrites the lease fields).
     */
    public const ASSIST_LEASE_MINUTES = 60;

    /** tts_locked_by prefix marking an assist-protocol claim. */
    public const ASSIST_WORKER_PREFIX = 'assist:';

    /**
     * STABLE language registry for the task-id codec. Append-only: never
     * renumber — external clients may hold encoded ids across deploys.
     */
    private const LANG_INDEX = [
        'en' => 1, 'zh' => 2, 'ja' => 3, 'ko' => 4, 'vi' => 5,
        'lo' => 6, 'fr' => 7, 'de' => 8, 'es' => 9,
    ];

    /** STABLE type registry for the task-id codec. Append-only. */
    private const TYPE_DIGIT = [
        self::TYPE_WORD => 1,
        self::TYPE_ARTICLE => 2,
        self::TYPE_SENTENCE => 3,
    ];

    private EdgeTTSService $ttsService;

    public function __construct(?EdgeTTSService $ttsService = null)
    {
        $this->ttsService = $ttsService ?: new EdgeTTSService();
    }

    // ------------------------------------------------------------------
    // Task-id codec
    // ------------------------------------------------------------------

    public static function encodeTaskId(int $rowId, string $type, string $langCode): int
    {
        $typeDigit = self::TYPE_DIGIT[$type] ?? 0;
        $langIndex = self::LANG_INDEX[strtolower($langCode)] ?? 0;
        return $rowId * 1000 + $typeDigit * 100 + $langIndex;
    }

    /** @return array{row_id:int,type:?string,language:?string}|null */
    public static function decodeTaskId(int $taskId): ?array
    {
        if ($taskId <= 0) {
            return null;
        }
        $langIndex = $taskId % 100;
        $typeDigit = intdiv($taskId, 100) % 10;
        $rowId = intdiv($taskId, 1000);
        $type = array_search($typeDigit, self::TYPE_DIGIT, true) ?: null;
        $language = array_search($langIndex, self::LANG_INDEX, true) ?: null;
        if ($rowId <= 0 || $type === null || $language === null) {
            return null;
        }
        return ['row_id' => $rowId, 'type' => $type, 'language' => $language];
    }

    public static function supportedLanguages(): array
    {
        return array_keys(self::LANG_INDEX);
    }

    /**
     * Reset stale processing claims back to pending so crashed processors
     * (timer worker or pycore) never strand rows. Cheap, idempotent; called
     * from the generation timer each tick.
     */
    public function reapStaleLocks(): int
    {
        $reaped = 0;

        foreach (self::supportedLanguages() as $lang) {
            $reaped += AppQyV1LangDictionaryModel::reapStaleTtsLocks(
                $lang,
                self::STATUS_PROCESSING,
                self::STATUS_PENDING,
                now()->subMinutes(self::LOCK_STALE_MINUTES),
                now()->subMinutes(self::ASSIST_LEASE_MINUTES),
                self::ASSIST_WORKER_PREFIX
            );
        }

        foreach (self::supportedLanguages() as $lang) {
            $reaped += AppQyV1ArticleLibraryModel::reapStaleTtsLocks(
                $lang,
                self::STATUS_PROCESSING,
                self::STATUS_PENDING,
                now()->subMinutes(self::LOCK_STALE_MINUTES),
                now()->subMinutes(self::ASSIST_LEASE_MINUTES),
                self::ASSIST_WORKER_PREFIX
            );
        }

        return $reaped;
    }

    // ------------------------------------------------------------------
    // Worker surface (pycore): claim + validated report
    // ------------------------------------------------------------------

    /**
     * Atomically claim up to $limit pending WORD rows for an external worker.
     * Returns task descriptors with encoded task ids. Claiming flips rows to
     * processing with the worker identity; stale claims auto-expire.
     */
    public function claimWords(string $workerId, ?string $langCode = null, int $limit = 20): array
    {
        $limit = max(1, min(50, $limit));
        $languages = $langCode ? [strtolower($langCode)] : self::supportedLanguages();
        $claimed = [];

        foreach ($languages as $lang) {
            if (count($claimed) >= $limit) {
                break;
            }
            if (!isset(self::LANG_INDEX[$lang])) {
                continue;
            }

            if (!AppQyV1LangDictionaryModel::ttsTableReady($lang, true)) {
                continue;
            }

            $remaining = $limit - count($claimed);

            // Two-step atomic claim: select candidate ids, then UPDATE guarded
            // by the same pending predicates so concurrent claimers can't
            // double-take a row (the guarded update simply affects 0 rows).
            $candidates = AppQyV1LangDictionaryModel::pendingTtsClaimRows(
                $lang,
                $remaining,
                self::STATUS_PENDING,
                self::MAX_ATTEMPTS,
                now()->subMinutes(self::LOCK_STALE_MINUTES),
                now()->subMinutes(self::ASSIST_LEASE_MINUTES),
                self::ASSIST_WORKER_PREFIX
            );

            foreach ($candidates as $row) {
                $updated = AppQyV1LangDictionaryModel::claimTtsRow(
                    $lang,
                    (int) $row->id,
                    $workerId,
                    self::STATUS_PENDING,
                    self::STATUS_PROCESSING,
                    now()->subMinutes(self::LOCK_STALE_MINUTES),
                    now()->subMinutes(self::ASSIST_LEASE_MINUTES),
                    self::ASSIST_WORKER_PREFIX
                );

                if ($updated) {
                    $claimed[] = [
                        'task_id' => self::encodeTaskId((int) $row->id, self::TYPE_WORD, $lang),
                        'type' => self::TYPE_WORD,
                        'content' => $row->content,
                        'md5' => $row->md5,
                        'language' => $lang,
                        // The exact storage path the worker's file will live at —
                        // informational; the report endpoint recomputes it itself.
                        'audio_relative_path' => $this->ttsService->buildRelativePath($row->content, $lang, 'word'),
                    ];
                }
            }
        }

        return $claimed;
    }

    /**
     * Ingest one worker-reported WORD result. The result is verified before it
     * may touch the canonical table:
     *   1. task id decodes to an existing dictionary row;
     *   2. payload is a real MP3 (non-empty, >=100 bytes, ID3/frame-sync magic);
     *   3. file is persisted to the deterministic EdgeTTS path and re-verified
     *      on disk before the row is marked completed.
     * Failures mark the attempt (retry budget) without corrupting audio state.
     *
     * @param string|null $audioBinary raw MP3 bytes (null for failure reports)
     */
    public function reportWordResult(
        int $taskId,
        string $workerId,
        bool $success,
        ?string $audioBinary = null,
        ?string $provider = null,
        ?string $error = null
    ): array {
        $decoded = self::decodeTaskId($taskId);
        if (!$decoded || $decoded['type'] !== self::TYPE_WORD) {
            return ['success' => false, 'http_status' => 422, 'error' => 'Invalid task_id'];
        }

        $lang = $decoded['language'];
        $entry = AppQyV1LangDictionaryModel::findLanguageRow($lang, $decoded['row_id']);
        if (!$entry) {
            return ['success' => false, 'http_status' => 404, 'error' => 'Task row not found'];
        }

        if (!$success) {
            $this->markWordFailed($entry, $lang, $error ?: 'Worker reported failure', $workerId);
            return ['success' => true, 'status' => self::statusOf($entry->freshRecord() ?? $entry)];
        }

        $relativePath = $this->ttsService->buildRelativePath($entry->content, $lang, 'word');
        $fullPath = $this->ttsService->getAudioBaseDir() . '/' . $relativePath;
        $existingBytes = FileSystemManager::readFile($fullPath);
        if ($existingBytes !== false
            && strlen($existingBytes) >= 100
            && self::looksLikeMp3($existingBytes)
        ) {
            $this->markWordCompleted($entry, $relativePath, $provider ?: ('worker:' . $workerId));
            return [
                'success' => true,
                'status' => self::STATUS_COMPLETED,
                'already_done' => true,
                'audio_path' => $relativePath,
                'audio_url' => AppQyV1TtsUrl::forPath($relativePath),
            ];
        }

        // --- Result validation (never trust the wire) ---
        if ($audioBinary === null || strlen($audioBinary) < 100) {
            $this->markWordFailed($entry, $lang, 'Rejected: empty or undersized audio payload', $workerId);
            return ['success' => false, 'http_status' => 422, 'error' => 'Audio payload empty or too small (<100 bytes)'];
        }
        if (!self::looksLikeMp3($audioBinary)) {
            $this->markWordFailed($entry, $lang, 'Rejected: payload is not a valid MP3', $workerId);
            return ['success' => false, 'http_status' => 422, 'error' => 'Audio payload failed MP3 validation'];
        }

        // --- Persist to the deterministic path, then re-verify on disk ---
        FileSystemManager::ensureDirectoryExists(dirname($fullPath));

        if (@file_put_contents($fullPath, $audioBinary) === false) {
            return ['success' => false, 'http_status' => 500, 'error' => 'Failed to persist audio file'];
        }
        clearstatcache(true, $fullPath);
        if (!file_exists($fullPath) || filesize($fullPath) !== strlen($audioBinary)) {
            @unlink($fullPath);
            return ['success' => false, 'http_status' => 500, 'error' => 'Persisted audio failed verification'];
        }

        $this->markWordCompleted($entry, $relativePath, $provider ?: ('worker:' . $workerId));

        Log::info('[DictTTS] Worker result accepted', [
            'task_id' => $taskId,
            'language' => $lang,
            'worker' => $workerId,
            'bytes' => strlen($audioBinary),
            'path' => $relativePath,
        ]);

        return [
            'success' => true,
            'status' => self::STATUS_COMPLETED,
            'audio_path' => $relativePath,
            'audio_url' => AppQyV1TtsUrl::forPath($relativePath),
        ];
    }

    /**
     * Persist raw audio bytes as the cached pronunciation for an already-resolved
     * dictionary row (matched by md5), without requiring a TTS claim/lock.
     *
     * Used by the Bing word-translation assist write-back: the Chrome worker
     * downloads Bing's pronunciation mp3 alongside the translation and ships the
     * bytes here. Fill-missing — a row that already has audio is left untouched
     * and reported as a no-op. The bytes are validated by size and format magic and
     * re-verified on disk before the row is flipped, reusing the exact path/disk
     * logic of reportWordResult() and the markWordCompleted() state transition.
     *
     * @return bool true when audio was newly written; false on no-op or rejection
     */
    public function storeWordAudioBytes(
        string $langCode,
        string $md5,
        string $bytes,
        string $providerLabel = 'bing',
        ?string $variantKey = null,
        ?array $variantMeta = null,
        ?string $mime = null
    ): bool {
        return $this->storeWordAudioBytesDetailed(
            $langCode, $md5, $bytes, $providerLabel, $variantKey, $variantMeta, $mime
        )['stored'];
    }

    /**
     * Detailed variant of storeWordAudioBytes. Distinguishes WHY a write did not
     * happen so callers can act correctly (mark-done vs surface-error), and
     * SELF-HEALS a stale has_audio=false when the primary file already exists on
     * disk (authoritative) — so a word with a real file but a lagged flag is
     * marked completed once and never re-served/re-synthesized.
     *
     * @return array{stored:bool, reason:string}
     *   reason in: not_found | exists | variant_exists | invalid | io_error | stored
     */
    public function storeWordAudioBytesDetailed(
        string $langCode,
        string $md5,
        string $bytes,
        string $providerLabel = 'bing',
        ?string $variantKey = null,
        ?array $variantMeta = null,
        ?string $mime = null
    ): array {
        $entry = AppQyV1LangDictionaryModel::findByMd5($langCode, $md5);
        if (!$entry) {
            return ['stored' => false, 'reason' => 'not_found'];
        }

        $variantKey = ($variantKey === null) ? '' : $variantKey;
        // Per-variant fill-missing: never clobber an existing file. The primary
        // variant respects has_audio; non-primary variants check their own slot.
        if ($variantKey === '') {
            if (!empty($entry->has_audio)) {
                return ['stored' => false, 'reason' => 'exists'];
            }
            // Self-heal: file already on disk but has_audio lagged false (crash
            // between file write and DB save, or a legacy row). Mark the row
            // completed against the existing file and report a no-op so the word
            // drops out of missing-batch permanently. pathOnDisk verifies the file
            // still exists, so a deleted file is NOT falsely marked done.
            $existingPath = $this->ttsService->buildRelativePath(
                $entry->content, $langCode, 'word', '+0%', ''
            );
            if (AppQyV1WordAudioFiles::pathOnDisk($existingPath)) {
                $this->markWordCompleted(
                    $entry, $existingPath, $entry->tts_provider ?: $providerLabel, ['variant_key' => '']
                );
                return ['stored' => false, 'reason' => 'exists'];
            }
        } else {
            if (AppQyV1WordAudioFiles::hasVariantWithFile($entry, $variantKey)) {
                return ['stored' => false, 'reason' => 'variant_exists'];
            }
        }

        $extension = AppQyV1AudioFormat::extension($bytes, $mime);
        if (strlen($bytes) < 100 || $extension === null) {
            return ['stored' => false, 'reason' => 'invalid'];
        }

        $relativePath = $this->ttsService->buildRelativePath(
            $entry->content, $langCode, 'word', '+0%', $variantKey
        );
        if ($extension !== 'mp3') {
            $relativePath = preg_replace('/\.mp3$/i', '.' . $extension, $relativePath)
                ?: ($relativePath . '.' . $extension);
        }
        $fullPath = $this->ttsService->getAudioBaseDir() . '/' . $relativePath;
        FileSystemManager::ensureDirectoryExists(dirname($fullPath));

        if (@file_put_contents($fullPath, $bytes) === false) {
            return ['stored' => false, 'reason' => 'io_error'];
        }
        clearstatcache(true, $fullPath);
        if (!file_exists($fullPath) || filesize($fullPath) !== strlen($bytes)) {
            @unlink($fullPath);
            return ['stored' => false, 'reason' => 'io_error'];
        }

        $meta = is_array($variantMeta) ? $variantMeta : [];
        $meta['variant_key'] = $variantKey;
        $this->markWordCompleted($entry, $relativePath, $providerLabel, $meta);

        Log::info('[DictTTS] Assist word audio stored', [
            'language' => $langCode,
            'md5' => $md5,
            'bytes' => strlen($bytes),
            'path' => $relativePath,
            'provider' => $providerLabel,
            'variant_key' => $variantKey,
        ]);

        return ['stored' => true, 'reason' => 'stored'];
    }

    /**
     * Reconcile DB-flagged missing-audio word rows against the AUTHORITATIVE files
     * on disk. The missing-batch query trusts the has_audio / audio_files /
     * tts_files columns, but those lag the real file after a crash between the file
     * write and the DB save, or after a legacy import. A row whose file actually
     * exists is SELF-HEALED here (has_audio=true + tts_files + audio_files) and
     * dropped, so the batch never re-serves a word that already has audio — the FE
     * no longer wastefully re-synthesizes it and reports "already exists" forever.
     * A row with a real file is marked completed once; a genuinely missing row is
     * returned unchanged. "有一个就算有" (one on-disk variant = covered).
     *
     * @param iterable<AppQyV1LangDictionaryModel> $rows candidate rows (DB says missing)
     * @return array<int,AppQyV1LangDictionaryModel> rows that are TRULY missing audio
     */
    public function filterTrulyMissingWords(string $langCode, iterable $rows): array
    {
        $missing = [];
        // Read/stat phase (no DB writes): classify each candidate against disk.
        // heal = [ [entry, relativePath, variantKey], ... ] for rows with a real file.
        $heal = [];
        foreach ($rows as $entry) {
            $content = (string) ($entry->content ?? '');
            if ($content === '') {
                $missing[] = $entry;
                continue;
            }
            // Primary (accent-neutral) file first — the cheap, common case.
            $primaryPath = $this->ttsService->buildRelativePath($content, $langCode, 'word', '+0%', '');
            if (AppQyV1WordAudioFiles::pathOnDisk($primaryPath)) {
                $heal[] = [$entry, $primaryPath, ''];
                continue;
            }
            // Otherwise honor any accent/gender variant already on disk (one=covered).
            $covered = false;
            foreach (AppQyV1WordAudioFiles::variantsForLanguage($langCode) as $spec) {
                $vkey = (string) ($spec['key'] ?? '');
                if ($vkey === '') {
                    continue;
                }
                $vPath = $this->ttsService->buildRelativePath($content, $langCode, 'word', '+0%', $vkey);
                if (AppQyV1WordAudioFiles::pathOnDisk($vPath)) {
                    $heal[] = [$entry, $vPath, $vkey];
                    $covered = true;
                    break;
                }
            }
            if (!$covered) {
                $missing[] = $entry;
            }
        }
        // Write phase: commit all stale-flag heals in ONE transaction (up to `limit`
        // rows) so the missing-batch GET stays fast instead of paying per-row commits.
        if (!empty($heal)) {
            AppQyV1LangDictionaryModel::runLanguageTransaction($langCode, function () use ($heal) {
                foreach ($heal as [$entry, $path, $vkey]) {
                    $this->markWordCompleted($entry, $path, $entry->tts_provider ?: 'disk', ['variant_key' => $vkey]);
                }
            });
            Log::info('[DictTTS] missing-batch self-healed stale rows against disk', [
                'language' => $langCode,
                'healed' => count($heal),
            ]);
        }
        return $missing;
    }

    /**
     * Voluntarily release one claimed WORD task (assist protocol). With an
     * error message the attempt is consumed (markWordFailed: retry budget,
     * pending/failed); without one the row simply returns to pending and the
     * lock is cleared. Completed rows are never touched.
     *
     * @return bool true when a row was released/updated
     */
    public function releaseWordClaim(int $taskId, ?string $error, string $by): bool
    {
        $decoded = self::decodeTaskId($taskId);
        if (!$decoded || $decoded['type'] !== self::TYPE_WORD) {
            return false;
        }

        $entry = AppQyV1LangDictionaryModel::findLanguageRow($decoded['language'], $decoded['row_id']);
        if (!$entry || !empty($entry->has_audio)) {
            return false;
        }

        if ($error !== null && $error !== '') {
            $this->markWordFailed($entry, $decoded['language'], $error, $by);
            return true;
        }

        $entry->tts_status = self::STATUS_PENDING;
        $entry->tts_locked_at = null;
        $entry->tts_locked_by = null;
        $entry->saveRecord();

        return true;
    }

    /**
     * Count rows currently held under a LIVE assist lease (tts_locked_by
     * 'assist:*', lock younger than ASSIST_LEASE_MINUTES) across word and
     * article tables.
     */
    public function assistLeasedCount(): int
    {
        $leaseBefore = now()->subMinutes(self::ASSIST_LEASE_MINUTES)->toDateTimeString();
        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $dictTables = [];
        $articleTables = [];
        foreach (self::supportedLanguages() as $lang) {
            $dictTables[$lang] = AppQyV1TableMaps::getDictionaryTableName($lang);
            $articleTables[$lang] = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
        }

        $dictTables = AppQyV1PerLanguageMetrics::filterExistingTables($connection, $dictTables);
        $articleTables = AppQyV1PerLanguageMetrics::filterExistingTables($connection, $articleTables);

        $whereSql = "has_audio = false AND tts_status = '" . self::STATUS_PROCESSING . "'"
            . ' AND tts_locked_by LIKE ? AND tts_locked_at >= ?';
        $bindings = [self::ASSIST_WORKER_PREFIX . '%', $leaseBefore];

        return array_sum(AppQyV1PerLanguageMetrics::countByLanguage($connection, $dictTables, $whereSql, $bindings))
            + array_sum(AppQyV1PerLanguageMetrics::countByLanguage($connection, $articleTables, $whereSql, $bindings));
    }

    /** MP3 sniffing: ID3v2 header or an MPEG frame-sync at byte 0. */
    public static function looksLikeMp3(string $bytes): bool
    {
        if (strlen($bytes) < 4) {
            return false;
        }
        if (str_starts_with($bytes, 'ID3')) {
            return true;
        }
        $b0 = ord($bytes[0]);
        $b1 = ord($bytes[1]);
        return $b0 === 0xFF && ($b1 & 0xE0) === 0xE0;
    }

    // ------------------------------------------------------------------
    // Canonical state transitions (used by worker report AND local timer)
    // ------------------------------------------------------------------

    public function markWordCompleted(
        AppQyV1LangDictionaryModel $entry,
        string $relativePath,
        string $provider,
        ?array $variantMeta = null
    ): void {
        $ttsFiles = is_array($entry->tts_files) ? $entry->tts_files : [];
        $known = array_filter(array_map(fn ($f) => $f['path'] ?? null, $ttsFiles));
        if (!in_array($relativePath, $known, true)) {
            $ttsFiles[] = ['path' => $relativePath, 'created_at' => now()->toDateTimeString()];
        }

        $entry->tts_files = $ttsFiles;
        $entry->has_audio = true;
        $entry->tts_provider = $provider;
        $entry->tts_status = self::STATUS_COMPLETED;
        $entry->tts_completed_at = now();
        $entry->tts_error = null;
        $entry->tts_locked_at = null;
        $entry->tts_locked_by = null;

        $meta = is_array($variantMeta) ? $variantMeta : [];
        AppQyV1WordAudioFiles::upsert($entry, array_merge([
            'variant_key' => (string) ($meta['variant_key'] ?? ''),
            'path' => $relativePath,
            'has_file' => true,
            'provider' => $provider,
            'source' => AppQyV1WordAudioFiles::SOURCE_TTS,
            'voice_type' => AppQyV1WordAudioFiles::VOICE_MACHINE,
            'uploaded_at' => now()->toIso8601String(),
        ], $meta));

        $entry->saveRecord();
    }

    public function markWordFailed(AppQyV1LangDictionaryModel $entry, string $langCode, string $error, string $by): void
    {
        $attempts = (int) $entry->tts_attempts + 1;
        $entry->tts_attempts = $attempts;
        $entry->tts_error = mb_substr($error, 0, 2000);
        $entry->tts_status = $attempts >= self::MAX_ATTEMPTS ? self::STATUS_FAILED : self::STATUS_PENDING;
        $entry->tts_locked_at = null;
        $entry->tts_locked_by = null;
        $entry->saveRecord();

        Log::warning('[DictTTS] Word generation failed', [
            'language' => $langCode,
            'md5' => $entry->md5,
            'attempts' => $attempts,
            'by' => $by,
            'error' => $error,
        ]);
    }

    /** Effective external status of a word/article row (contract strings). */
    public static function statusOf($row): string
    {
        if (!empty($row->has_audio)) {
            return self::STATUS_COMPLETED;
        }
        $status = $row->tts_status ?? null;
        if ($status === self::STATUS_PROCESSING) {
            // A stale claim is externally still "pending". Assist leases
            // (tts_locked_by 'assist:*') stay live for 60 minutes.
            $lockedAt = $row->tts_locked_at ? \Illuminate\Support\Carbon::parse($row->tts_locked_at) : null;
            $isAssist = is_string($row->tts_locked_by ?? null)
                && str_starts_with($row->tts_locked_by, self::ASSIST_WORKER_PREFIX);
            $staleMinutes = $isAssist ? self::ASSIST_LEASE_MINUTES : self::LOCK_STALE_MINUTES;
            if (!$lockedAt || $lockedAt->lt(now()->subMinutes($staleMinutes))) {
                return self::STATUS_PENDING;
            }
            return self::STATUS_PROCESSING;
        }
        if ($status === self::STATUS_FAILED) {
            return self::STATUS_FAILED;
        }
        return self::STATUS_PENDING;
    }

    // ------------------------------------------------------------------
    // Statistics over the canonical tables (former /queue/stats source)
    // ------------------------------------------------------------------

    /**
     * Queue-shaped statistics derived live from the canonical tables. Shape
     * matches the legacy endpoint: by_status / by_type / total / total_retries.
     */
    public function statistics(): array
    {
        $byStatus = ['pending' => 0, 'processing' => 0, 'completed' => 0, 'failed' => 0];
        $byType = array_fill_keys(QueueCenterContract::queuePositionOrderedTaskAliases(), 0);
        $totalRetries = 0;

        $connection = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $dictTables = [];
        $articleTables = [];
        foreach (self::supportedLanguages() as $lang) {
            $dictTables[$lang] = AppQyV1TableMaps::getDictionaryTableName($lang);
            $articleTables[$lang] = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
        }

        $dictTables = AppQyV1PerLanguageMetrics::filterExistingTables($connection, $dictTables);
        $articleTables = AppQyV1PerLanguageMetrics::filterExistingTables($connection, $articleTables);

        // One column listing for BOTH table sets, then keep only tables that
        // carry the full tts_* column set (a partially migrated language is
        // skipped instead of aborting the whole aggregate).
        $columns = AppQyV1PerLanguageMetrics::columnsOfTables(
            $connection,
            array_merge(array_values($dictTables), array_values($articleTables))
        );
        $baseColumns = ['has_audio', 'tts_status', 'tts_attempts', 'tts_locked_at', 'tts_locked_by'];
        $dictTables = AppQyV1PerLanguageMetrics::filterTablesByColumns($dictTables, $columns, array_merge($baseColumns, ['is_valid']));
        $articleTables = AppQyV1PerLanguageMetrics::filterTablesByColumns($articleTables, $columns, $baseColumns);

        $staleBefore = now()->subMinutes(self::LOCK_STALE_MINUTES)->toDateTimeString();
        $assistStaleBefore = now()->subMinutes(self::ASSIST_LEASE_MINUTES)->toDateTimeString();
        $assistPrefix = self::ASSIST_WORKER_PREFIX . '%';

        // Live lock (applyLiveLockPredicate) and claimable lock
        // (applyClaimableLockPredicate) expressed as SQL fragments — keep in
        // sync with those methods, they remain the canonical builder version.
        $liveLock = '(tts_locked_at >= ? OR (tts_locked_by LIKE ? AND tts_locked_at >= ?))';
        $claimableLock = '(tts_locked_at IS NULL OR tts_locked_at < ?'
            . ' OR (tts_locked_at < ? AND (tts_locked_by IS NULL OR tts_locked_by NOT LIKE ?)))';

        $selectList = 'COUNT(*) FILTER (WHERE has_audio = true) AS completed, '
            . "COUNT(*) FILTER (WHERE has_audio = false AND tts_status = '" . self::STATUS_FAILED . "') AS failed, "
            . "COUNT(*) FILTER (WHERE has_audio = false AND tts_status = '" . self::STATUS_PROCESSING . "' AND {$liveLock}) AS processing, "
            . 'COUNT(*) FILTER (WHERE has_audio = false AND %IS_VALID% tts_attempts < ?'
            . " AND (tts_status IS NULL OR tts_status = '" . self::STATUS_PENDING . "'"
            . " OR (tts_status = '" . self::STATUS_PROCESSING . "' AND {$claimableLock}))) AS pending, "
            . 'COALESCE(SUM(tts_attempts), 0) AS retries';
        // Binding order per branch: liveLock (processing), then pending
        // (max attempts, claimableLock).
        $bindings = [
            $staleBefore, $assistPrefix, $assistStaleBefore,
            self::MAX_ATTEMPTS, $assistStaleBefore, $staleBefore, $assistPrefix,
        ];

        $dictRows = AppQyV1PerLanguageMetrics::metricsByLanguage(
            $connection,
            $dictTables,
            str_replace('%IS_VALID%', 'is_valid = true AND', $selectList),
            '',
            $bindings
        );
        $articleRows = AppQyV1PerLanguageMetrics::metricsByLanguage(
            $connection,
            $articleTables,
            str_replace('%IS_VALID%', '', $selectList),
            '',
            $bindings
        );

        foreach ($dictRows as $row) {
            foreach (array_keys($byStatus) as $status) {
                $count = (int) ($row[$status] ?? 0);
                $byStatus[$status] += $count;
                $byType['word'] += $count;
            }
            $totalRetries += (int) ($row['retries'] ?? 0);
        }
        foreach ($articleRows as $row) {
            foreach (array_keys($byStatus) as $status) {
                $count = (int) ($row[$status] ?? 0);
                $byStatus[$status] += $count;
                $byType['article'] += $count;
            }
            $totalRetries += (int) ($row['retries'] ?? 0);
        }

        return [
            'by_status' => $byStatus,
            'by_type' => $byType,
            'total' => array_sum($byStatus),
            'total_retries' => $totalRetries,
        ];
    }

}
