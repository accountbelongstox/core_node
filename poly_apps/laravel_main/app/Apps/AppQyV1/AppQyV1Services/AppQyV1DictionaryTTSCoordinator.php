<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;
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
 * Task-id codec: external clients (qy_capacitor / wordflow) poll by numeric
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

    // ------------------------------------------------------------------
    // Lock/lease predicates (shared by pending queries, claim, reap, stats)
    // ------------------------------------------------------------------

    /**
     * Constrain $query to rows whose lock does NOT block a new claim:
     * never locked, expired assist lease (60 min), or stale non-assist lock
     * (10 min). PG-safe: plain timestamp comparisons + (NOT) LIKE.
     */
    public static function applyClaimableLockPredicate($query): void
    {
        $staleBefore = now()->subMinutes(self::LOCK_STALE_MINUTES);
        $assistStaleBefore = now()->subMinutes(self::ASSIST_LEASE_MINUTES);

        $query->where(function ($q) use ($staleBefore, $assistStaleBefore) {
            $q->whereNull('tts_locked_at')
                ->orWhere('tts_locked_at', '<', $assistStaleBefore)
                ->orWhere(function ($qq) use ($staleBefore) {
                    $qq->where('tts_locked_at', '<', $staleBefore)
                        ->where(function ($w) {
                            $w->whereNull('tts_locked_by')
                                ->orWhere('tts_locked_by', 'not like', self::ASSIST_WORKER_PREFIX . '%');
                        });
                });
        });
    }

    /**
     * Constrain $query to rows holding a LIVE lock: a non-assist lock newer
     * than 10 minutes, or an assist lease newer than 60 minutes.
     */
    public static function applyLiveLockPredicate($query): void
    {
        $staleBefore = now()->subMinutes(self::LOCK_STALE_MINUTES);
        $assistStaleBefore = now()->subMinutes(self::ASSIST_LEASE_MINUTES);

        $query->where(function ($q) use ($staleBefore, $assistStaleBefore) {
            $q->where('tts_locked_at', '>=', $staleBefore)
                ->orWhere(function ($qq) use ($assistStaleBefore) {
                    $qq->where('tts_locked_by', 'like', self::ASSIST_WORKER_PREFIX . '%')
                        ->where('tts_locked_at', '>=', $assistStaleBefore);
                });
        });
    }

    // ------------------------------------------------------------------
    // Pending queries (the former queue, derived live)
    // ------------------------------------------------------------------

    /**
     * Pending-word rows for one language: needs audio, valid, not currently
     * claimed (or claim stale/lease expired), retry budget left. Highest
     * priority first, then most-queried (user demand) first.
     */
    public function pendingWordsQuery(string $langCode)
    {
        $query = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('has_audio', false)
            ->where('is_valid', true)
            ->where(function ($q) {
                $q->whereNull('tts_status')
                    ->orWhere('tts_status', self::STATUS_PENDING);
            })
            ->where('tts_attempts', '<', self::MAX_ATTEMPTS)
            ->orderByDesc('tts_priority')
            ->orderByDesc('query_count');

        self::applyClaimableLockPredicate($query);

        return $query;
    }

    /** Pending-article rows for one language (per-language article tables). */
    public function pendingArticlesQuery(string $langCode)
    {
        $query = AppQyV1ArticleLibraryModel::forLanguage($langCode)->newQuery()
            ->where('has_audio', false)
            ->where(function ($q) {
                $q->whereNull('tts_status')
                    ->orWhere('tts_status', self::STATUS_PENDING);
            })
            ->where('tts_attempts', '<', self::MAX_ATTEMPTS)
            ->orderByDesc('tts_priority');

        self::applyClaimableLockPredicate($query);

        return $query;
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
            $table = AppQyV1TableMaps::getDictionaryTableName($lang);
            $conn = $this->dictConnection();
            if (!$conn->getSchemaBuilder()->hasTable($table)) {
                continue;
            }
            $query = $conn->table($table)
                ->where('tts_status', self::STATUS_PROCESSING)
                ->whereNotNull('tts_locked_at');
            self::applyClaimableLockPredicate($query);
            $reaped += $query->update([
                'tts_status' => self::STATUS_PENDING,
                'tts_locked_at' => null,
                'tts_locked_by' => null,
            ]);
        }

        foreach (self::supportedLanguages() as $lang) {
            $articles = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            $conn = $this->dictConnection();
            if ($conn->getSchemaBuilder()->hasTable($articles)
                && $conn->getSchemaBuilder()->hasColumn($articles, 'tts_status')) {
                $query = $conn->table($articles)
                    ->where('tts_status', self::STATUS_PROCESSING)
                    ->whereNotNull('tts_locked_at');
                self::applyClaimableLockPredicate($query);
                $reaped += $query->update([
                    'tts_status' => self::STATUS_PENDING,
                    'tts_locked_at' => null,
                    'tts_locked_by' => null,
                ]);
            }
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

            $table = AppQyV1TableMaps::getDictionaryTableName($lang);
            $conn = $this->dictConnection();
            if (!$conn->getSchemaBuilder()->hasTable($table)) {
                continue;
            }

            $remaining = $limit - count($claimed);

            // Two-step atomic claim: select candidate ids, then UPDATE guarded
            // by the same pending predicates so concurrent claimers can't
            // double-take a row (the guarded update simply affects 0 rows).
            $candidates = $this->pendingWordsQuery($lang)->limit($remaining)->get(['id', 'content', 'md5']);

            foreach ($candidates as $row) {
                $updated = $conn->table($table)
                    ->where('id', $row->id)
                    ->where('has_audio', false)
                    ->where(function ($q) {
                        $q->whereNull('tts_status')->orWhere('tts_status', self::STATUS_PENDING)
                            ->orWhere(function ($qq) {
                                $qq->where('tts_status', self::STATUS_PROCESSING);
                                // Stale local lock OR expired assist lease:
                                // taking over clears/overwrites the stale
                                // lease fields in this same UPDATE.
                                self::applyClaimableLockPredicate($qq);
                            });
                    })
                    ->update([
                        'tts_status' => self::STATUS_PROCESSING,
                        'tts_locked_at' => now(),
                        'tts_locked_by' => $workerId,
                        'tts_requested_at' => $conn->raw('COALESCE(tts_requested_at, CURRENT_TIMESTAMP)'),
                    ]);

                if ($updated === 1) {
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
        $entry = AppQyV1LangDictionaryModel::forLanguage($lang)->find($decoded['row_id']);
        if (!$entry) {
            return ['success' => false, 'http_status' => 404, 'error' => 'Task row not found'];
        }

        if (!$success) {
            $this->markWordFailed($entry, $lang, $error ?: 'Worker reported failure', $workerId);
            return ['success' => true, 'status' => self::statusOf($entry->fresh() ?? $entry)];
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
        $relativePath = $this->ttsService->buildRelativePath($entry->content, $lang, 'word');
        $fullPath = $this->ttsService->getAudioBaseDir() . '/' . $relativePath;
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
        ];
    }

    /**
     * Persist raw MP3 bytes as the cached pronunciation for an already-resolved
     * dictionary row (matched by md5), without requiring a TTS claim/lock.
     *
     * Used by the Bing word-translation assist write-back: the Chrome worker
     * downloads Bing's pronunciation mp3 alongside the translation and ships the
     * bytes here. Fill-missing — a row that already has audio is left untouched
     * and reported as a no-op. The bytes are validated (size + MP3 magic) and
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
        ?array $variantMeta = null
    ): bool {
        $entry = AppQyV1LangDictionaryModel::forLanguage($langCode)
            ->where('md5', $md5)
            ->first();
        if (!$entry) {
            return false;
        }

        $variantKey = ($variantKey === null) ? '' : $variantKey;
        // Per-variant fill-missing: never clobber an existing file. The primary
        // variant respects has_audio; non-primary variants check their own slot.
        if ($variantKey === '') {
            if (!empty($entry->has_audio)) {
                return false;
            }
        } else {
            if (AppQyV1WordAudioFiles::hasVariantWithFile($entry, $variantKey)) {
                return false;
            }
        }

        if (strlen($bytes) < 100 || !self::looksLikeMp3($bytes)) {
            return false;
        }

        $relativePath = $this->ttsService->buildRelativePath(
            $entry->content, $langCode, 'word', '+0%', $variantKey
        );
        $fullPath = $this->ttsService->getAudioBaseDir() . '/' . $relativePath;
        FileSystemManager::ensureDirectoryExists(dirname($fullPath));

        if (@file_put_contents($fullPath, $bytes) === false) {
            return false;
        }
        clearstatcache(true, $fullPath);
        if (!file_exists($fullPath) || filesize($fullPath) !== strlen($bytes)) {
            @unlink($fullPath);
            return false;
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

        return true;
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

        $entry = AppQyV1LangDictionaryModel::forLanguage($decoded['language'])->find($decoded['row_id']);
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
        $entry->save();

        return true;
    }

    /**
     * Count rows currently held under a LIVE assist lease (tts_locked_by
     * 'assist:*', lock younger than ASSIST_LEASE_MINUTES) across word and
     * article tables.
     */
    public function assistLeasedCount(): int
    {
        $leaseBefore = now()->subMinutes(self::ASSIST_LEASE_MINUTES);
        $conn = $this->dictConnection();
        $count = 0;

        foreach (self::supportedLanguages() as $lang) {
            $table = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!$conn->getSchemaBuilder()->hasTable($table)) {
                continue;
            }
            $count += (int) $conn->table($table)
                ->where('has_audio', false)
                ->where('tts_status', self::STATUS_PROCESSING)
                ->where('tts_locked_by', 'like', self::ASSIST_WORKER_PREFIX . '%')
                ->where('tts_locked_at', '>=', $leaseBefore)
                ->count();
        }

        foreach (self::supportedLanguages() as $lang) {
            $articles = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (!$conn->getSchemaBuilder()->hasTable($articles)
                || !$conn->getSchemaBuilder()->hasColumn($articles, 'tts_status')) {
                continue;
            }
            $count += (int) $conn->table($articles)
                ->where('has_audio', false)
                ->where('tts_status', self::STATUS_PROCESSING)
                ->where('tts_locked_by', 'like', self::ASSIST_WORKER_PREFIX . '%')
                ->where('tts_locked_at', '>=', $leaseBefore)
                ->count();
        }

        return $count;
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

        $entry->save();
    }

    public function markWordFailed(AppQyV1LangDictionaryModel $entry, string $langCode, string $error, string $by): void
    {
        $attempts = (int) $entry->tts_attempts + 1;
        $entry->tts_attempts = $attempts;
        $entry->tts_error = mb_substr($error, 0, 2000);
        $entry->tts_status = $attempts >= self::MAX_ATTEMPTS ? self::STATUS_FAILED : self::STATUS_PENDING;
        $entry->tts_locked_at = null;
        $entry->tts_locked_by = null;
        $entry->save();

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
        $byType = ['word' => 0, 'sentence' => 0, 'article' => 0];
        $totalRetries = 0;

        $conn = $this->dictConnection();
        foreach (self::supportedLanguages() as $lang) {
            $table = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!$conn->getSchemaBuilder()->hasTable($table)) {
                continue;
            }

            $completed = (int) $conn->table($table)->where('has_audio', true)->count();
            $failed = (int) $conn->table($table)->where('has_audio', false)->where('tts_status', self::STATUS_FAILED)->count();
            $processingQuery = $conn->table($table)
                ->where('has_audio', false)
                ->where('tts_status', self::STATUS_PROCESSING);
            self::applyLiveLockPredicate($processingQuery);
            $processing = (int) $processingQuery->count();
            $pending = (int) $conn->table($table)
                ->where('has_audio', false)
                ->where('is_valid', true)
                ->where(function ($q) {
                    $q->whereNull('tts_status')
                        ->orWhere('tts_status', self::STATUS_PENDING)
                        ->orWhere(function ($qq) {
                            $qq->where('tts_status', self::STATUS_PROCESSING);
                            self::applyClaimableLockPredicate($qq);
                        });
                })
                ->where('tts_attempts', '<', self::MAX_ATTEMPTS)
                ->count();

            $byStatus['completed'] += $completed;
            $byStatus['failed'] += $failed;
            $byStatus['processing'] += $processing;
            $byStatus['pending'] += $pending;
            $byType['word'] += $pending + $processing + $completed + $failed;
            $totalRetries += (int) $conn->table($table)->sum('tts_attempts');
        }

        foreach (self::supportedLanguages() as $lang) {
            $articles = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (!$conn->getSchemaBuilder()->hasTable($articles) || !$conn->getSchemaBuilder()->hasColumn($articles, 'tts_status')) {
                continue;
            }
            $aCompleted = (int) $conn->table($articles)->where('has_audio', true)->count();
            $aFailed = (int) $conn->table($articles)->where('has_audio', false)->where('tts_status', self::STATUS_FAILED)->count();
            $aProcessingQuery = $conn->table($articles)
                ->where('has_audio', false)
                ->where('tts_status', self::STATUS_PROCESSING);
            self::applyLiveLockPredicate($aProcessingQuery);
            $aProcessing = (int) $aProcessingQuery->count();
            $aPending = (int) $conn->table($articles)
                ->where('has_audio', false)
                ->where(function ($q) {
                    $q->whereNull('tts_status')
                        ->orWhere('tts_status', self::STATUS_PENDING)
                        ->orWhere(function ($qq) {
                            $qq->where('tts_status', self::STATUS_PROCESSING);
                            self::applyClaimableLockPredicate($qq);
                        });
                })
                ->where('tts_attempts', '<', self::MAX_ATTEMPTS)
                ->count();

            $byStatus['completed'] += $aCompleted;
            $byStatus['failed'] += $aFailed;
            $byStatus['processing'] += $aProcessing;
            $byStatus['pending'] += $aPending;
            $byType['article'] += $aPending + $aProcessing + $aCompleted + $aFailed;
            $totalRetries += (int) $conn->table($articles)->sum('tts_attempts');
        }

        return [
            'by_status' => $byStatus,
            'by_type' => $byType,
            'total' => array_sum($byStatus),
            'total_retries' => $totalRetries,
        ];
    }

    private function dictConnection(): \Illuminate\Database\Connection
    {
        return DB::connection(AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1));
    }
}
