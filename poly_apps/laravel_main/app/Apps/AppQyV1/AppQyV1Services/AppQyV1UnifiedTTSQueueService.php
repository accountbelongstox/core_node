<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Services\WordAudio\WordAudioClient;
use App\Services\UserConfig\UserConfigService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Unified TTS Queue Service — queue-less edition.
 *
 * The intermediate app_qy_v1_tts_queue table is decommissioned. All task
 * state now lives on the canonical tables, coordinated through
 * AppQyV1DictionaryTTSCoordinator:
 *   - word:    {prefix}_tts_cache_{lang} rows (tts_status / tts_attempts /
 *              tts_priority / tts_locked_* / tts_requested_at / tts_completed_at)
 *   - article: {prefix}_{lang}_article_library rows (same tts_* columns)
 *   - sentence: file check first. When useServerBinaryAssist is OFF (default),
 *              bump for pycore and return queued — never call generateAudio.
 *              When assist is ON, generate synchronously via EdgeTTSService.
 *
 * External response shapes are byte-compatible with the legacy queue API
 * (qy_capacitor + WordNew FE poll these): status strings
 * pending/processing/completed/failed, per-result add statuses
 * queued/moved_to_front/already_available/already_completed, not-found
 * results carry an `error` key, audio_url built via AppQyV1TtsUrl::forPath.
 *
 * task_id is the coordinator's encoded id (rowId*1000 + typeDigit*100 +
 * langIndex), so re-adding the same content always yields the same task_id
 * (same canonical row).
 */
class AppQyV1UnifiedTTSQueueService
{
    private $ttsService;
    private AppQyV1DictionaryTTSCoordinator $coordinator;
    private WordAudioClient $wordAudioClient;

    const TYPE_WORD = 'word';
    const TYPE_SENTENCE = 'sentence';
    const TYPE_ARTICLE = 'article';

    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

    /** Worker identity used for tts_locked_by claims made by the local Octane timer. */
    const PROCESSOR_ID = 'octane-timer';

    /** Default priority floor applied when a row is queued without 'beginning'. */
    const PRIORITY_DEFAULT = 30;

    /** Max ARTICLE rows processed per processQueue() run (articles are heavy). */
    const ARTICLES_PER_RUN = 2;

    // Dynamic interval settings
    const INTERVAL_NORMAL = 2000000;    // 2 seconds in microseconds
    const INTERVAL_EXTENDED = 5000000;  // 5 seconds in microseconds
    const INTERVAL_CACHE_KEY = 'tts_queue_processing_interval';
    const ERROR_COUNT_CACHE_KEY = 'tts_queue_consecutive_errors';
    const ERROR_THRESHOLD = 3;  // Switch to extended interval after 3 consecutive errors

    // Intelligent batch size settings
    const BATCH_SIZE_MIN = 1;
    const BATCH_SIZE_MAX = 10;
    const BATCH_SIZE_DEFAULT = 3;
    const BATCH_SIZE_CACHE_KEY = 'tts_queue_batch_size';
    const SUCCESS_RATE_CACHE_KEY = 'tts_queue_success_rate';
    const RATE_LIMIT_DETECTED_KEY = 'tts_queue_rate_limit_detected';
    const PERFORMANCE_WINDOW = 100; // Track last 100 tasks for metrics

    public function __construct()
    {
        $this->ttsService = new EdgeTTSService();
        $this->coordinator = new AppQyV1DictionaryTTSCoordinator($this->ttsService);
        $this->wordAudioClient = new WordAudioClient();
    }

    /**
     * Get current processing interval (dynamic based on error rate)
     *
     * @return int Interval in microseconds
     */
    private function getProcessingInterval(): int
    {
        return Cache::get(self::INTERVAL_CACHE_KEY, self::INTERVAL_NORMAL);
    }

    /**
     * Increment error counter and adjust interval if needed
     */
    private function handleProcessingError(string $errorMessage = ''): void
    {
        // Check if this is a rate limit error
        if ($errorMessage && $this->isRateLimitError($errorMessage)) {
            $this->handleRateLimitDetection();
            $this->updateSuccessRate(false);
            return;
        }

        $errorCount = Cache::get(self::ERROR_COUNT_CACHE_KEY, 0);
        $errorCount++;
        Cache::put(self::ERROR_COUNT_CACHE_KEY, $errorCount, 600); // Cache for 10 minutes

        if ($errorCount >= self::ERROR_THRESHOLD) {
            // Switch to extended interval
            Cache::put(self::INTERVAL_CACHE_KEY, self::INTERVAL_EXTENDED, 600);
            Log::warning('[UnifiedTTSQueue] Switching to extended interval due to consecutive errors', [
                'error_count' => $errorCount,
                'new_interval_seconds' => self::INTERVAL_EXTENDED / 1000000,
            ]);
        }

        // Update success rate
        $this->updateSuccessRate(false);
        $this->adjustBatchSize();
    }

    /**
     * Reset error counter and restore normal interval
     */
    private function handleProcessingSuccess(): void
    {
        $errorCount = Cache::get(self::ERROR_COUNT_CACHE_KEY, 0);

        if ($errorCount > 0) {
            Cache::put(self::ERROR_COUNT_CACHE_KEY, 0, 600);

            // Restore normal interval
            $currentInterval = $this->getProcessingInterval();
            if ($currentInterval === self::INTERVAL_EXTENDED) {
                Cache::put(self::INTERVAL_CACHE_KEY, self::INTERVAL_NORMAL, 600);
                Log::info('[UnifiedTTSQueue] Restored normal interval after successful processing', [
                    'interval_seconds' => self::INTERVAL_NORMAL / 1000000,
                ]);
            }
        }

        // Update success rate and potentially increase batch size
        $this->updateSuccessRate(true);
        $this->adjustBatchSize();
    }

    /**
     * Detect if error is due to Microsoft rate limiting (429)
     */
    private function isRateLimitError(string $errorMessage): bool
    {
        $rateLimitPatterns = [
            '429',
            'too many requests',
            'rate limit',
            'throttl',
            'quota exceeded',
        ];

        $errorLower = strtolower($errorMessage);
        foreach ($rateLimitPatterns as $pattern) {
            if (strpos($errorLower, $pattern) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Handle rate limit detection
     */
    private function handleRateLimitDetection(): void
    {
        Cache::put(self::RATE_LIMIT_DETECTED_KEY, true, 600);

        // Immediately reduce batch size to minimum
        Cache::put(self::BATCH_SIZE_CACHE_KEY, self::BATCH_SIZE_MIN, 1800);

        // Extend interval significantly
        Cache::put(self::INTERVAL_CACHE_KEY, self::INTERVAL_EXTENDED * 2, 600);

        Log::warning('[UnifiedTTSQueue] Rate limit detected - reducing batch size and extending interval', [
            'batch_size' => self::BATCH_SIZE_MIN,
            'interval_seconds' => (self::INTERVAL_EXTENDED * 2) / 1000000,
        ]);
    }

    /**
     * Update success rate tracking
     */
    private function updateSuccessRate(bool $success): void
    {
        $rates = Cache::get(self::SUCCESS_RATE_CACHE_KEY, ['success' => 0, 'total' => 0]);

        if ($success) {
            $rates['success']++;
        }
        $rates['total']++;

        // Keep only recent history (last PERFORMANCE_WINDOW tasks)
        if ($rates['total'] > self::PERFORMANCE_WINDOW) {
            $ratio = $rates['success'] / $rates['total'];
            $rates['success'] = (int)($ratio * self::PERFORMANCE_WINDOW);
            $rates['total'] = self::PERFORMANCE_WINDOW;
        }

        Cache::put(self::SUCCESS_RATE_CACHE_KEY, $rates, 1800);
    }

    /**
     * Get current success rate (0.0 to 1.0)
     */
    private function getSuccessRate(): float
    {
        $rates = Cache::get(self::SUCCESS_RATE_CACHE_KEY, ['success' => 0, 'total' => 0]);

        if ($rates['total'] === 0) {
            return 1.0; // Assume success initially
        }

        return $rates['success'] / $rates['total'];
    }

    /**
     * Get intelligent batch size based on current conditions
     */
    public function getIntelligentBatchSize(): int
    {
        // Check if rate limit was recently detected
        if (Cache::get(self::RATE_LIMIT_DETECTED_KEY, false)) {
            return self::BATCH_SIZE_MIN;
        }

        // Get current batch size from cache
        $currentBatchSize = Cache::get(self::BATCH_SIZE_CACHE_KEY, self::BATCH_SIZE_DEFAULT);

        // Check error count
        $errorCount = Cache::get(self::ERROR_COUNT_CACHE_KEY, 0);
        if ($errorCount >= self::ERROR_THRESHOLD) {
            return self::BATCH_SIZE_MIN;
        }

        return $currentBatchSize;
    }

    /**
     * Adjust batch size based on performance metrics
     */
    private function adjustBatchSize(): void
    {
        $successRate = $this->getSuccessRate();
        $currentBatchSize = Cache::get(self::BATCH_SIZE_CACHE_KEY, self::BATCH_SIZE_DEFAULT);
        $errorCount = Cache::get(self::ERROR_COUNT_CACHE_KEY, 0);

        // Don't adjust if rate limit detected
        if (Cache::get(self::RATE_LIMIT_DETECTED_KEY, false)) {
            return;
        }

        $newBatchSize = $currentBatchSize;

        // Increase batch size if success rate is high
        if ($successRate >= 0.95 && $errorCount === 0 && $currentBatchSize < self::BATCH_SIZE_MAX) {
            $newBatchSize = min($currentBatchSize + 1, self::BATCH_SIZE_MAX);
            Log::info('[UnifiedTTSQueue] Increasing batch size', [
                'from' => $currentBatchSize,
                'to' => $newBatchSize,
                'success_rate' => round($successRate, 3),
            ]);
        }
        // Decrease batch size if success rate drops
        elseif ($successRate < 0.8 && $currentBatchSize > self::BATCH_SIZE_MIN) {
            $newBatchSize = max($currentBatchSize - 1, self::BATCH_SIZE_MIN);
            Log::warning('[UnifiedTTSQueue] Decreasing batch size', [
                'from' => $currentBatchSize,
                'to' => $newBatchSize,
                'success_rate' => round($successRate, 3),
            ]);
        }

        Cache::put(self::BATCH_SIZE_CACHE_KEY, $newBatchSize, 1800);
    }

    /**
     * Add a TTS task (auto-detect type or use specified type).
     *
     * WORD / ARTICLE: idempotent against the canonical row — when the audio
     * already exists 'already_available' is returned; otherwise the row is
     * marked tts_status='pending' (created first when absent) and the encoded
     * task_id is returned with status 'queued' (or 'moved_to_front' when
     * position === 'beginning', which also raises tts_priority to 100).
     *
     * SENTENCE — SEMANTICS CHANGE: sentences have no backing row anymore.
     * The deterministic file path is checked; on a miss the audio is
     * generated SYNCHRONOUSLY inline. Success returns 'already_completed'
     * with audio_url; failure returns success=false with the error. No
     * task_id is ever issued for sentences.
     *
     * @param string $content Content text (word/sentence/article)
     * @param string $language Language code
     * @param string|null $type Task type (auto-detect if null)
     * @param string $position Position in queue: 'beginning'|'end' (default: 'end')
     * @return array Result with status and queue info
     */
    public function addTask(string $content, string $language, ?string $type = null, string $position = 'end'): array
    {
        // Auto-detect type if not specified
        if ($type === null) {
            $type = $this->detectType($content);
        }

        // Validate type
        if (!in_array($type, [self::TYPE_WORD, self::TYPE_SENTENCE, self::TYPE_ARTICLE])) {
            return [
                'success' => false,
                'error' => 'Invalid task type',
            ];
        }

        // Normalize the language the SAME way the translation queue does
        // (AppQyV1DictionaryService::getLanguageCode) so this endpoint accepts a
        // full NAME ("english") OR a 2-letter CODE ("en") interchangeably —
        // previously a bare strtolower() let "english" fall through to
        // "Unsupported language". Keeps all word-action endpoints consistent.
        $language = AppQyV1DictionaryService::getLanguageCode($language);

        if ($type === self::TYPE_SENTENCE) {
            return $this->addSentenceTask($content, $language);
        }

        if (!in_array($language, AppQyV1DictionaryTTSCoordinator::supportedLanguages(), true)) {
            return [
                'success' => false,
                'error' => 'Unsupported language: ' . $language,
            ];
        }

        if ($type === self::TYPE_WORD) {
            return $this->addWordTask($content, $language, $position);
        }

        return $this->addArticleTask($content, $language, $position);
    }

    /**
     * WORD task: resolve against the canonical dictionary row.
     */
    private function addWordTask(string $content, string $language, string $position): array
    {
        $contentHash = md5($content);

        $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $contentHash);

        // Audio already present and on disk -> immediately available.
        if ($dictEntry && !empty($dictEntry->tts_files)) {
            foreach ($dictEntry->tts_files as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    $fullPath = $this->ttsService->getAudioPath($ttsFile['path']);
                    if ($fullPath) {
                        $dictEntry->incrementQueryCount();
                        // Legacy shape: no task_id key on already_available.
                        return [
                            'success' => true,
                            'status' => 'already_available',
                            'audio_path' => $ttsFile['path'],
                            'audio_url' => AppQyV1TtsUrl::forPath($ttsFile['path']),
                        ];
                    }
                }
            }
        }

        // Auto-create the dictionary row when absent (mirrors the old queue's
        // auto-create of an orphan task).
        if (!$dictEntry) {
            $dictEntry = AppQyV1LangDictionaryModel::forLanguage($language);
            $dictEntry->content = $content;
            $dictEntry->md5 = $contentHash;
            $dictEntry->has_translation = false;
            $dictEntry->has_audio = false;
            $dictEntry->is_valid = true;
            $dictEntry->query_count = 0;
            AppQyV1LangDictionaryModel::forgetMetricsCache($language);
        }

        $status = $this->markRowPending($dictEntry, $position);

        // Phase 5 dual-write: mirror the pending audio row as a linked GlobalTask
        // (flag-gated, best-effort) so the unified task system tracks it.
        $this->maybeCreateGlobalAudioTask($dictEntry, $language, 'word_audio', $position === 'beginning');

        $this->clearQueueCache();

        return [
            'success' => true,
            'status' => $status,
            'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $dictEntry->id, self::TYPE_WORD, $language),
            'task_type' => self::TYPE_WORD,
            'position' => $position,
        ];
    }

    /**
     * ARTICLE task: resolve against the canonical article row.
     */
    private function addArticleTask(string $content, string $language, string $position): array
    {
        $contentHash = md5($content);

        $article = AppQyV1ArticleLibraryModel::findByMd5($language, $contentHash);

        if ($article && $article->has_audio && !empty($article->audio_files)) {
            return [
                'success' => true,
                'status' => 'already_completed',
                'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $article->id, self::TYPE_ARTICLE, $language),
                'audio_path' => null,
                'audio_files' => $article->audio_files,
            ];
        }

        if (!$article) {
            $article = AppQyV1ArticleLibraryModel::createOrFind($language, $content, [
                'source' => 'tts_api',
            ]);
        }

        $status = $this->markRowPending($article, $position);

        // Phase 5 dual-write (flag-gated, best-effort).
        $this->maybeCreateGlobalAudioTask($article, $language, 'article_audio', $position === 'beginning');

        $this->clearQueueCache();

        return [
            'success' => true,
            'status' => $status,
            'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $article->id, self::TYPE_ARTICLE, $language),
            'task_type' => self::TYPE_ARTICLE,
            'position' => $position,
        ];
    }

    /**
     * SENTENCE task: file check first. When useServerBinaryAssist is OFF
     * (default), enqueue for pycore and return queued — never call generateAudio.
     * When assist is ON, generate synchronously via EdgeTTSService (desktop).
     */
    private function addSentenceTask(string $content, string $language): array
    {
        $relativePath = $this->ttsService->buildRelativePath($content, $language, 'sentence');
        $fullPath = $this->ttsService->getAudioPath($relativePath);

        if ($fullPath) {
            return [
                'success' => true,
                'status' => 'already_available',
                'audio_path' => $relativePath,
                'audio_url' => AppQyV1TtsUrl::forPath($relativePath),
            ];
        }

        // Default OFF: Laravel must not synthesize — leave pending for pycore.
        if (!app(UserConfigService::class)->useServerBinaryAssist()) {
            try {
                $contentId = md5($content);
                (new AppQyV1SentenceAudioService())->bumpPriority(
                    $contentId,
                    $language,
                    true,
                    true,
                    $content
                );
            } catch (\Throwable $e) {
                Log::warning('[UnifiedTTSQueue] sentence bump for pycore failed', [
                    'language' => $language,
                    'error' => $e->getMessage(),
                ]);
            }

            return [
                'success' => true,
                'status' => 'queued',
                'queued' => true,
                'message' => 'Deferred to pycore TTS worker (use_server_binary_assist=off)',
            ];
        }

        $result = $this->ttsService->generateAudio($content, $language, 'sentence');

        if (!empty($result['success'])) {
            $audioPath = $result['audio_path'] ?? $relativePath;
            return [
                'success' => true,
                'status' => 'already_completed',
                'audio_path' => $audioPath,
                'audio_url' => AppQyV1TtsUrl::forPath($audioPath),
            ];
        }

        return [
            'success' => false,
            'error' => $result['error'] ?? 'Sentence TTS generation failed',
        ];
    }

    /**
     * Flip a canonical row (word or article) to tts_status='pending' and
     * return the external add-status string (queued|moved_to_front).
     * 'beginning' assigns a move-to-front ticket — MAX(tts_priority)+1 on the
     * row's table under a transaction-scoped advisory lock, so the newest
     * front-add always sorts strictly ahead of every existing row and two
     * concurrent front-adds cannot share a ticket (the MAX+1 subquery alone
     * is not atomic across rows - an aggregate read locks nothing).
     */
    private function markRowPending($row, string $position): string
    {
        return $row->getConnection()->transaction(function () use ($row, $position) {
            $row->tts_status = self::STATUS_PENDING;
            if (!$row->tts_requested_at) {
                $row->tts_requested_at = now();
            }

            // Re-adding a failed row re-queues it with a fresh retry budget.
            $row->tts_attempts = 0;
            $row->tts_error = null;
            $row->tts_locked_at = null;
            $row->tts_locked_by = null;

            if ($position === 'beginning') {
                $conn = $row->getConnection();
                $table = $row->getTable();
                AppQyV1TableMaps::lockTableForFrontTicket($conn, $table);
                $row->save();
                $id = $row->id;
                $conn->statement(
                    "UPDATE {$table} SET tts_priority = (SELECT m FROM (SELECT COALESCE(MAX(tts_priority), 0) + 1 AS m FROM {$table}) x) WHERE id = ?",
                    [$id]
                );
                $row->refresh();
                $status = 'moved_to_front';
            } else {
                $row->tts_priority = max((int) ($row->tts_priority ?? 0), self::PRIORITY_DEFAULT);
                $row->save();
                $status = 'queued';
            }

            return $status;
        });
    }

    /**
     * Phase 5 dual-write: when APPQYV1_DUAL_WRITE_GLOBAL is enabled, mirror a
     * pending audio row as a linked GlobalTask on the pycore audio lane so the
     * unified task system tracks it alongside the canonical dict row. Best-effort
     * and idempotent — it never throws into the enqueue path and skips when an
     * active linked task already exists. The legacy dict-row timer remains the
     * canonical generator during the dual-write window; on completion the worker
     * path's syncToDictRow() projects status back (fill-missing), and double
     * synthesis is guarded by TaskManagerService::claimAudioLock().
     *
     * @param mixed  $row      AppQyV1LangDictionaryModel (word) or article model
     * @param string $language Language code
     * @param string $taskType 'word_audio' | 'article_audio'
     */
    private function maybeCreateGlobalAudioTask($row, string $language, string $taskType, bool $interactive = false): void
    {
        if (!app(\App\Services\UserConfig\UserConfigService::class)->get('appqyv1_dual_write_global', false)) {
            return;
        }
        $this->ensureGlobalAudioTask($row, $language, $taskType, $interactive);
    }

    /**
     * Create an idempotent word_audio/article_audio GlobalTask linked to a
     * canonical row. Pycore or the enabled Chrome Qwen3-TTS worker may consume
     * the shared audio lane. Ungated variant of maybeCreateGlobalAudioTask:
     * used by the timer's API-miss delegation path, where Laravel MUST drive the
     * task unconditionally (Laravel drives, pycore generates). Best-effort and
     * idempotent - skips when an active linked task already exists and never
     * throws into the caller.
     *
     * @param mixed  $row      AppQyV1LangDictionaryModel (word) or article model
     * @param string $language Language code
     * @param string $taskType 'word_audio' | 'article_audio'
     */
    private function ensureGlobalAudioTask($row, string $language, string $taskType, bool $interactive = false): void
    {
        try {
            // Skip when an active linked global task already exists for this row.
            if (!empty($row->tts_global_task_id)) {
                $active = \App\Models\GlobalTask::where('task_id', $row->tts_global_task_id)
                    ->whereIn('status', [
                        \App\Models\GlobalTask::status('pending'),
                        \App\Models\GlobalTask::status('assigned'),
                        \App\Models\GlobalTask::status('processing'),
                    ])
                    ->exists();
                if ($active) {
                    return;
                }
            }

            $task = app(\App\Services\TaskManagerService::class)->createTask(
                'AppQyV1',
                $taskType,
                \App\Models\GlobalTask::executionType('remote_audio'),
                [
                    'language' => $language,
                    'content' => $row->content ?? null,
                    'md5' => $row->md5 ?? null,
                ],
                300,
                (int) ($row->tts_priority ?? 0),
                3,
                // Interactive (FE position='beginning') audio jumps to task-top:
                // createTask rewrites it onto remote_fast + PRIORITY_FAST. The
                // capability=audio routes it only to workers that advertise audio.
                $interactive,
                \App\Models\GlobalTask::capability('audio'),
                [
                    'dict_row_id' => (int) $row->id,
                    'dict_language' => $language,
                    'dict_row_table' => $row->getTable(),
                    'group_key' => $row->md5 ?? null,
                ]
            );

            // Direct property set persists even if the column is not in $fillable.
            $row->tts_global_task_id = $task->task_id;
            $row->save();
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[AppQyV1UnifiedTTSQueueService] global audio task ensure failed', [
                'dict_row_id' => $row->id ?? null,
                'language' => $language,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Get queue summary with pagination — served from the canonical tables.
     *
     * The "queue" is the set of rows whose tts_status has ever been set,
     * fetched per language (capped), merged and paginated in PHP. tasks[]
     * items keep the legacy TaskDetail shape (task_id, content_text,
     * language, status, ...) for the pycore poller.
     */
    public function getQueueSummary(int $page = 1, int $perPage = 50, ?string $status = null, ?string $type = null): array
    {
        $page = max(1, $page);
        $perPage = max(1, $perPage);

        $cacheKey = "tts_queue_summary:{$page}:{$perPage}:{$status}:{$type}";

        return Cache::remember($cacheKey, now()->addSeconds(10), function () use ($page, $perPage, $status, $type) {
            // Sane per-language fetch cap: enough rows to fill the requested
            // window even if a single language dominates the merged ordering.
            $perLanguageCap = min($perPage * $page, 500);

            $entries = $this->collectTrackedRows($type, $perLanguageCap);

            // Filter by external status (statusOf), then sort by recency.
            $items = [];
            foreach ($entries as $entry) {
                if ($status !== null && $entry['item']['status'] !== $status) {
                    continue;
                }
                $items[] = $entry;
            }

            usort($items, fn ($a, $b) => $b['sort'] <=> $a['sort']);

            $total = count($items);
            $pageItems = array_slice($items, ($page - 1) * $perPage, $perPage);

            return [
                'tasks' => array_values(array_map(fn ($e) => $e['item'], $pageItems)),
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => (int) ceil($total / $perPage),
                ],
                'statistics' => $this->getStatistics(),
            ];
        });
    }

    /**
     * Collect rows with TTS tracking state from the canonical tables.
     *
     * @return array<int, array{sort:int, item:array}>
     */
    private function collectTrackedRows(?string $type, int $perLanguageCap): array
    {
        $entries = [];
        $connName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            if ($type === null || $type === self::TYPE_WORD) {
                $dictTable = AppQyV1TableMaps::getDictionaryTableName($lang);
                if (Schema::connection($connName)->hasTable($dictTable)) {
                    $rows = AppQyV1LangDictionaryModel::forLanguage($lang)
                        ->whereNotNull('tts_status')
                        ->orderByDesc('updated_at')
                        ->limit($perLanguageCap)
                        ->get();
                    foreach ($rows as $row) {
                        $entries[] = [
                            'sort' => $row->updated_at ? $row->updated_at->getTimestamp() : 0,
                            'item' => $this->formatWordRow($row, $lang),
                        ];
                    }
                }
            }

            if ($type === null || $type === self::TYPE_ARTICLE) {
                $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
                if (Schema::connection($connName)->hasTable($articleTable)
                    && Schema::connection($connName)->hasColumn($articleTable, 'tts_status')) {
                    $rows = AppQyV1ArticleLibraryModel::forLanguage($lang)
                        ->whereNotNull('tts_status')
                        ->orderByDesc('updated_at')
                        ->limit($perLanguageCap)
                        ->get();
                    foreach ($rows as $row) {
                        $entries[] = [
                            'sort' => $row->updated_at ? $row->updated_at->getTimestamp() : 0,
                            'item' => $this->formatArticleRow($row, $lang),
                        ];
                    }
                }
            }
        }

        return $entries;
    }

    /**
     * Get completed tasks
     */
    public function getCompletedTasks(int $page = 1, int $perPage = 50, ?string $type = null): array
    {
        return $this->getQueueSummary($page, $perPage, self::STATUS_COMPLETED, $type);
    }

    /**
     * Get single task by encoded task ID.
     */
    public function getTask(int $taskId): ?array
    {
        $decoded = AppQyV1DictionaryTTSCoordinator::decodeTaskId($taskId);
        if (!$decoded) {
            return null;
        }

        $lang = $decoded['language'];
        $connName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

        if ($decoded['type'] === self::TYPE_WORD) {
            $dictTable = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (!Schema::connection($connName)->hasTable($dictTable)) {
                return null;
            }
            $row = AppQyV1LangDictionaryModel::forLanguage($lang)->find($decoded['row_id']);
            return $row ? $this->formatWordRow($row, $lang) : null;
        }

        if ($decoded['type'] === self::TYPE_ARTICLE) {
            $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (!Schema::connection($connName)->hasTable($articleTable)) {
                return null;
            }
            $row = AppQyV1ArticleLibraryModel::forLanguage($lang)->find($decoded['row_id']);
            return $row ? $this->formatArticleRow($row, $lang) : null;
        }

        // Sentences are stateless — no task ids are ever issued for them.
        return null;
    }

    /**
     * Get queue statistics — delegated to the coordinator (live canonical
     * counts), augmented with the legacy extra keys the FE displays.
     */
    public function getStatistics(): array
    {
        $cacheKey = 'tts_queue_statistics';

        return Cache::remember($cacheKey, now()->addSeconds(10), function () {
            $stats = $this->coordinator->statistics();

            $stats['current_concurrent'] = EdgeTTSService::getConcurrentCount();
            $stats['total_success'] = $stats['by_status']['completed'] ?? 0;

            return $stats;
        });
    }

    /**
     * Get performance metrics for intelligent processing
     */
    public function getPerformanceMetrics(): array
    {
        $successRateData = Cache::get(self::SUCCESS_RATE_CACHE_KEY, ['success' => 0, 'total' => 0]);
        $successRate = $successRateData['total'] > 0
            ? round($successRateData['success'] / $successRateData['total'], 3)
            : 1.0;

        return [
            'intelligent_batch_size' => [
                'current' => $this->getIntelligentBatchSize(),
                'min' => self::BATCH_SIZE_MIN,
                'max' => self::BATCH_SIZE_MAX,
                'default' => self::BATCH_SIZE_DEFAULT,
            ],
            'processing_interval' => [
                'current_microseconds' => $this->getProcessingInterval(),
                'current_seconds' => round($this->getProcessingInterval() / 1000000, 2),
                'normal_seconds' => self::INTERVAL_NORMAL / 1000000,
                'extended_seconds' => self::INTERVAL_EXTENDED / 1000000,
            ],
            'success_rate' => [
                'rate' => $successRate,
                'successful_tasks' => $successRateData['success'],
                'total_tasks' => $successRateData['total'],
                'window_size' => self::PERFORMANCE_WINDOW,
            ],
            'error_tracking' => [
                'consecutive_errors' => Cache::get(self::ERROR_COUNT_CACHE_KEY, 0),
                'error_threshold' => self::ERROR_THRESHOLD,
            ],
            'rate_limiting' => [
                'detected' => Cache::get(self::RATE_LIMIT_DETECTED_KEY, false),
            ],
            'estimated_throughput' => [
                'tasks_per_minute' => $this->estimateTasksPerMinute(),
                'hours_to_clear_pending' => $this->estimateHoursToClearPending(),
            ],
        ];
    }

    /**
     * Estimate tasks per minute based on current settings
     */
    private function estimateTasksPerMinute(): float
    {
        $batchSize = $this->getIntelligentBatchSize();
        $timerIntervalSeconds = 60; // Timer runs every 60 seconds

        $batchesPerMinute = 60 / $timerIntervalSeconds;
        $tasksPerBatch = $batchSize * $this->getSuccessRate();

        return round($batchesPerMinute * $tasksPerBatch, 2);
    }

    /**
     * Estimate hours to clear pending queue
     */
    private function estimateHoursToClearPending(): float
    {
        $stats = $this->getStatistics();
        $pending = (int) ($stats['by_status']['pending'] ?? 0);
        $tasksPerMinute = $this->estimateTasksPerMinute();

        if ($tasksPerMinute <= 0) {
            return -1; // Cannot estimate
        }

        $minutes = $pending / $tasksPerMinute;
        return round($minutes / 60, 1);
    }

    /**
     * Auto-detect task type from content
     */
    private function detectType(string $content): string
    {
        $content = trim($content);
        $wordCount = str_word_count($content);

        // Single word
        if ($wordCount === 1 && strlen($content) < 50) {
            return self::TYPE_WORD;
        }

        // Multiple sentences (article)
        $sentenceCount = preg_match_all('/[.!?。！？]+/', $content);
        if ($sentenceCount > 2 || strlen($content) > 300) {
            return self::TYPE_ARTICLE;
        }

        // Default to sentence
        return self::TYPE_SENTENCE;
    }

    /**
     * Legacy TaskDetail shape for a canonical WORD row.
     */
    private function formatWordRow($row, string $lang): array
    {
        $status = AppQyV1DictionaryTTSCoordinator::statusOf($row);

        $formatted = [
            'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $row->id, self::TYPE_WORD, $lang),
            'task_type' => self::TYPE_WORD,
            'content_text' => $row->content,
            'language' => $lang,
            'status' => $status,
            'priority' => (int) ($row->tts_priority ?? 0),
            'retry_count' => (int) ($row->tts_attempts ?? 0),
        ];

        if ($status === self::STATUS_COMPLETED) {
            $audioPath = $this->firstTtsFilePath($row);
            if ($audioPath) {
                $formatted['audio_path'] = $audioPath;
                $formatted['audio_url'] = AppQyV1TtsUrl::forPath($audioPath);
            }
        }

        if ($row->tts_error) {
            $formatted['error_message'] = $row->tts_error;
        }

        if ($row->tts_requested_at) {
            $formatted['requested_at'] = $row->tts_requested_at->toISOString();
        }

        if ($row->tts_locked_at) {
            $formatted['started_at'] = $row->tts_locked_at->toISOString();
        }

        if ($row->tts_completed_at) {
            $formatted['completed_at'] = $row->tts_completed_at->toISOString();
        }

        return $formatted;
    }

    /**
     * Legacy TaskDetail shape for a canonical ARTICLE row.
     */
    private function formatArticleRow($row, string $lang): array
    {
        $status = AppQyV1DictionaryTTSCoordinator::statusOf($row);

        $formatted = [
            'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $row->id, self::TYPE_ARTICLE, $lang),
            'task_type' => self::TYPE_ARTICLE,
            'content_text' => $row->content,
            'language' => $lang,
            'status' => $status,
            'priority' => (int) ($row->tts_priority ?? 0),
            'retry_count' => (int) ($row->tts_attempts ?? 0),
        ];

        if ($status === self::STATUS_COMPLETED && !empty($row->audio_files)) {
            $formatted['audio_files'] = $row->audio_files;
            $formatted['sentence_mapping'] = $this->buildSentenceMapping($row->audio_files, $lang);
        }

        if ($row->tts_error) {
            $formatted['error_message'] = $row->tts_error;
        }

        if ($row->tts_requested_at) {
            $formatted['requested_at'] = $row->tts_requested_at->toISOString();
        }

        if ($row->tts_locked_at) {
            $formatted['started_at'] = $row->tts_locked_at->toISOString();
        }

        if ($row->tts_completed_at) {
            $formatted['completed_at'] = $row->tts_completed_at->toISOString();
        }

        return $formatted;
    }

    /**
     * First stored tts_files path of a dictionary row (the canonical word
     * audio), or null.
     */
    private function firstTtsFilePath($row): ?string
    {
        $ttsFiles = $row->tts_files;
        if (is_array($ttsFiles)) {
            foreach ($ttsFiles as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    return $ttsFile['path'];
                }
            }
        }
        return null;
    }

    /**
     * Batch add tasks
     *
     * @param array $tasks Array of tasks: [['content' => '...', 'language' => '...', 'type' => '...', 'position' => '...'], ...]
     * @param string $position Default position for all tasks
     * @return array Array of results with task_ids
     */
    public function batchAddTasks(array $tasks, string $position = 'end'): array
    {
        $results = [];

        foreach ($tasks as $index => $taskData) {
            if (!isset($taskData['content']) || !isset($taskData['language'])) {
                $results[] = [
                    'success' => false,
                    'error' => 'Missing required fields (content, language)',
                    'index' => $index,
                ];
                continue;
            }

            $content = $taskData['content'];
            $language = $taskData['language'];
            $type = $taskData['type'] ?? null;
            $taskPosition = $taskData['position'] ?? $position;

            $result = $this->addTask($content, $language, $type, $taskPosition);
            $result['index'] = $index;
            $result['content'] = $content;

            $results[] = $result;
        }

        return [
            'success' => true,
            'total' => count($tasks),
            'results' => $results,
        ];
    }

    /**
     * Batch get tasks by encoded IDs.
     *
     * Contract: a missing/undecodable id yields {task_id, error: 'Task not
     * found'} — the presence of `error` marks not-found.
     *
     * @param array $taskIds Array of task IDs
     * @return array Array of task details
     */
    public function batchGetTasks(array $taskIds): array
    {
        $results = [];

        foreach ($taskIds as $taskId) {
            $detail = $this->getTask((int) $taskId);

            if ($detail) {
                $results[] = $detail;
            } else {
                $results[] = [
                    'task_id' => $taskId,
                    'error' => 'Task not found',
                ];
            }
        }

        return [
            'success' => true,
            'total' => count($taskIds),
            'results' => $results,
        ];
    }

    /**
     * Intelligent batch query - supports both task_id and content
     * Automatically creates tasks if files don't exist
     *
     * @param array $queries Array of queries, each can be:
     *   - task_id (int): Query by task ID
     *   - content + language + type (string): Query by content, auto-create if not exists
     * @param string $position Position for auto-created tasks
     * @return array Query results
     */
    public function intelligentBatchQuery(array $queries, string $position = 'end'): array
    {
        $results = [];

        foreach ($queries as $index => $query) {
            // Query by task_id
            if (isset($query['task_id'])) {
                $detail = $this->getTask((int) $query['task_id']);

                if ($detail) {
                    $results[] = array_merge(
                        $detail,
                        ['index' => $index, 'query_type' => 'task_id']
                    );
                } else {
                    $results[] = [
                        'index' => $index,
                        'query_type' => 'task_id',
                        'error' => 'Task not found',
                        'task_id' => $query['task_id'],
                    ];
                }
            }
            // Query by content
            elseif (isset($query['content']) && isset($query['language'])) {
                $content = $query['content'];
                $language = strtolower($query['language']);
                $type = $query['type'] ?? null;
                $taskPosition = $query['position'] ?? $position;

                // Auto-detect type if not specified
                if (!$type) {
                    $type = $this->detectType($content);
                }

                // Step 1: Check if audio file already exists (file transparency)
                $existingAudio = $this->checkAudioExists($content, $language, $type);

                if ($existingAudio && $existingAudio['exists']) {
                    // File exists, return immediately
                    $result = [
                        'index' => $index,
                        'query_type' => 'content',
                        'status' => 'file_available',
                        'content' => $content,
                        'language' => $language,
                        'task_type' => $type,
                    ];

                    if (isset($existingAudio['audio_path'])) {
                        $result['audio_path'] = $existingAudio['audio_path'];
                        $result['audio_url'] = $existingAudio['audio_url'];
                    }

                    if (isset($existingAudio['audio_files'])) {
                        $result['audio_files'] = $existingAudio['audio_files'];
                        $result['sentence_mapping'] = $existingAudio['sentence_mapping'] ?? [];
                    }

                    $result['source'] = 'existing_file';

                    $results[] = $result;
                    continue;
                }

                // Step 2: Check whether the canonical row is already tracked
                // (was the queue-row existence check).
                $existing = $this->findTrackedRowDetail($content, $language, $type);

                if ($existing) {
                    $results[] = array_merge(
                        $existing,
                        [
                            'index' => $index,
                            'query_type' => 'content',
                            'source' => 'existing_task',
                        ]
                    );
                    continue;
                }

                // Step 3: Create new task
                $addResult = $this->addTask($content, $language, $type, $taskPosition);

                if (!empty($addResult['success'])) {
                    $detail = isset($addResult['task_id']) ? $this->getTask((int) $addResult['task_id']) : null;

                    if ($detail) {
                        $results[] = array_merge(
                            $detail,
                            [
                                'index' => $index,
                                'query_type' => 'content',
                                'source' => 'newly_created',
                            ]
                        );
                    } else {
                        // Stateless sentence: synchronous result, no row.
                        $result = [
                            'index' => $index,
                            'query_type' => 'content',
                            'status' => $addResult['status'] ?? 'already_completed',
                            'content' => $content,
                            'language' => $language,
                            'task_type' => $type,
                            'source' => 'newly_created',
                        ];
                        if (isset($addResult['audio_path'])) {
                            $result['audio_path'] = $addResult['audio_path'];
                            $result['audio_url'] = $addResult['audio_url'];
                        }
                        $results[] = $result;
                    }
                } else {
                    $results[] = [
                        'index' => $index,
                        'query_type' => 'content',
                        'error' => $addResult['error'] ?? 'Failed to create task',
                        'content' => $content,
                    ];
                }
            }
            // Invalid query format
            else {
                $results[] = [
                    'index' => $index,
                    'error' => 'Invalid query format. Must provide either task_id or (content + language)',
                ];
            }
        }

        return [
            'success' => true,
            'total' => count($queries),
            'results' => $results,
        ];
    }

    /**
     * Locate the canonical row for content and return its TaskDetail when the
     * row is already TTS-tracked (tts_status set) — the replacement for the
     * old "task already exists in queue" lookup.
     */
    private function findTrackedRowDetail(string $content, string $language, string $type): ?array
    {
        if (!in_array($language, AppQyV1DictionaryTTSCoordinator::supportedLanguages(), true)) {
            return null;
        }

        $contentHash = md5($content);

        if ($type === self::TYPE_WORD) {
            $row = AppQyV1LangDictionaryModel::findByMd5($language, $contentHash);
            if ($row && $row->tts_status !== null) {
                return $this->formatWordRow($row, $language);
            }
            return null;
        }

        if ($type === self::TYPE_ARTICLE) {
            $row = AppQyV1ArticleLibraryModel::findByMd5($language, $contentHash);
            if ($row && $row->tts_status !== null) {
                return $this->formatArticleRow($row, $language);
            }
            return null;
        }

        // Sentences are stateless — never tracked.
        return null;
    }

    /**
     * Check if audio file exists and return it
     * Used for transparent file access
     *
     * @param string $content Content text
     * @param string $language Language code
     * @param string $type Task type
     * @return array|null Audio info if exists, null otherwise
     */
    public function checkAudioExists(string $content, string $language, string $type): ?array
    {
        $language = strtolower($language);
        $contentHash = md5($content);

        // Words: canonical dictionary row + on-disk file.
        if ($type === self::TYPE_WORD) {
            if (!in_array($language, AppQyV1DictionaryTTSCoordinator::supportedLanguages(), true)) {
                return null;
            }

            $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $contentHash);
            if ($dictEntry && $dictEntry->has_audio && !empty($dictEntry->tts_files)) {
                foreach ($dictEntry->tts_files as $ttsFile) {
                    if (isset($ttsFile['path'])) {
                        $fullPath = $this->ttsService->getAudioPath($ttsFile['path']);
                        if ($fullPath && file_exists($fullPath)) {
                            $dictEntry->incrementQueryCount();

                            return [
                                'exists' => true,
                                'audio_path' => $ttsFile['path'],
                                'audio_url' => AppQyV1TtsUrl::forPath($ttsFile['path']),
                                'provider' => $dictEntry->tts_provider,
                            ];
                        }
                    }
                }
            }

            return null;
        }

        // Sentences: stateless deterministic file check.
        if ($type === self::TYPE_SENTENCE) {
            $relativePath = $this->ttsService->buildRelativePath($content, $language, 'sentence');
            $fullPath = $this->ttsService->getAudioPath($relativePath);
            if ($fullPath) {
                return [
                    'exists' => true,
                    'audio_path' => $relativePath,
                    'audio_url' => AppQyV1TtsUrl::forPath($relativePath),
                ];
            }
            return null;
        }

        // Articles: canonical article row carries the audio file list.
        if ($type === self::TYPE_ARTICLE) {
            if (!in_array($language, AppQyV1DictionaryTTSCoordinator::supportedLanguages(), true)) {
                return null;
            }

            $article = AppQyV1ArticleLibraryModel::findByMd5($language, $contentHash);
            if ($article && $article->has_audio && !empty($article->audio_files)) {
                return [
                    'exists' => true,
                    'audio_files' => $article->audio_files,
                    'sentence_mapping' => $this->buildSentenceMapping($article->audio_files, $language),
                ];
            }
            return null;
        }

        return null;
    }

    /**
     * Build the sentence MD5 mapping from an article's audio_files list.
     */
    private function buildSentenceMapping($audioFiles, string $language): array
    {
        $mapping = [];

        if (!empty($audioFiles) && is_array($audioFiles)) {
            foreach ($audioFiles as $index => $audioFile) {
                if (isset($audioFile['sentence']) && isset($audioFile['path'])) {
                    $mapping[] = [
                        'sentence_index' => $index,
                        'sentence_text' => $audioFile['sentence'],
                        'sentence_md5' => md5($audioFile['sentence']),
                        'audio_path' => $audioFile['path'],
                        'audio_url' => AppQyV1TtsUrl::forPath($audioFile['path']),
                    ];
                }
            }
        }

        return $mapping;
    }

    /**
     * Process pending items (called by timer task) — queue-less flow.
     *
     * 1. Reap stale processing claims (crashed workers).
     * 2. Claim pending WORD rows via the coordinator (atomic, per row) and
     *    generate them inline, reporting completion/failure straight onto the
     *    canonical rows.
     * 3. Process a small number of pending ARTICLE rows: split into
     *    sentences, generate each, and write audio_files + has_audio back to
     *    the ARTICLE row (the old queue never wrote articles back — fixed).
     *
     * Keeps the adaptive batch-size/interval/error tracking and zero-byte
     * file verification of the legacy implementation.
     *
     * @param int|null $batchSize Number of word items to process (null = intelligent batch size)
     * @return array Processing results
     */
    public function processQueue(?int $batchSize = null): array
    {
        $this->coordinator->reapStaleLocks();

        // Use intelligent batch size if not specified
        if ($batchSize === null || $batchSize === 0) {
            $batchSize = $this->getIntelligentBatchSize();
        }

        $processed = 0;
        $succeeded = 0;
        $failed = 0;

        // ---- WORDS: claim across languages up to the batch size ----
        //
        // API-first, no local binary. A claimed word is resolved through the
        // real-pronunciation API chain (Free Dictionary API -> Forvo) - the SAME
        // chain AppQyV1WordMediaService::fetchRealPronunciation uses on the
        // request path. On a hit storeWordAudioBytes persists the bytes and marks
        // the row completed. On a miss the row is NEVER synthesized via the local
        // edge-tts binary: it is delegated to the pycore word_audio task lane
        // (which runs the same API chain, then its TTS fallback) and the claim is
        // released. Laravel drives the task; pycore generates.
        $claimed = $this->coordinator->claimWords(self::PROCESSOR_ID, null, $batchSize);

        foreach ($claimed as $task) {
            $lang = $task['language'];
            $startTime = microtime(true);

            try {
                // Re-fetch the canonical row (the claim returned raw fields only).
                $entry = AppQyV1LangDictionaryModel::findByMd5($lang, $task['md5']);
                if (!$entry) {
                    Log::warning('[UnifiedTTSQueue] Claimed word row vanished', [
                        'language' => $lang,
                        'md5' => $task['md5'],
                    ]);
                    $processed++;
                    continue;
                }

                // A worker (pycore word_audio / Bing assist) may have produced the
                // audio between the claim and this run - nothing left to do.
                if (!empty($entry->has_audio)) {
                    $processed++;
                    $succeeded++;
                    continue;
                }

                // Negative-cache API misses: an unresolvable word is released
                // back to pending and re-claimed every cycle, so without a
                // backoff each cycle would re-run the full external API chain
                // (and the pacing sleep) for the same words.
                $missCacheKey = 'appqyv1:tts_word_api_miss:' . $lang . ':' . $task['md5'];
                $knownMiss = Cache::has($missCacheKey);

                $stored = $knownMiss
                    ? false
                    : $this->tryRealPronunciation($task['content'], $lang, $task['md5']);

                if ($stored) {
                    AppQyV1LangDictionaryModel::forgetMetricsCache($lang);
                    $succeeded++;

                    $processingTimeMs = (microtime(true) - $startTime) * 1000;
                    AppQyV1TTSQueueMetrics::recordProcessingTime(self::TYPE_WORD, $processingTimeMs);

                    $this->handleProcessingSuccess();

                    Log::info('[UnifiedTTSQueue] Word task completed (real-pronunciation API)', [
                        'task_id' => $task['task_id'],
                        'language' => $lang,
                        'processing_time_ms' => round($processingTimeMs, 2),
                    ]);
                } else {
                    // API miss: drive the pycore word_audio lane and release the
                    // claim. This is a delegation, not a failure - the retry
                    // budget is NOT consumed and tts_status returns to pending so
                    // pycore (or a later API hit) can own the row.
                    if (!$knownMiss) {
                        Cache::put($missCacheKey, true, now()->addMinutes(30));
                    }
                    $this->ensureGlobalAudioTask($entry, $lang, 'word_audio', false);
                    $this->releaseWordProcessingClaim($entry);

                    if ($knownMiss) {
                        Log::debug('[UnifiedTTSQueue] Word API miss (cached) - delegated to pycore word_audio lane', [
                            'task_id' => $task['task_id'],
                            'language' => $lang,
                        ]);
                    } else {
                        Log::info('[UnifiedTTSQueue] Word API miss - delegated to pycore word_audio lane', [
                            'task_id' => $task['task_id'],
                            'language' => $lang,
                        ]);
                    }
                }

                $processed++;

                // Use dynamic interval between tasks (2 seconds normal, 5 seconds if frequent errors)
                if (!$knownMiss) {
                    usleep($this->getProcessingInterval());
                }
            } catch (\Throwable $e) {
                $errorMsg = $e->getMessage();
                $this->handleProcessingError($errorMsg);

                $entry = AppQyV1LangDictionaryModel::findByMd5($lang, $task['md5']);
                if ($entry) {
                    $this->coordinator->markWordFailed($entry, $lang, $errorMsg, self::PROCESSOR_ID);
                    if ($entry->tts_status === self::STATUS_FAILED) {
                        $failed++;
                    }
                }

                Log::error('[UnifiedTTSQueue] Exception during word task processing', [
                    'task_id' => $task['task_id'],
                    'language' => $lang,
                    'error' => $errorMsg,
                    'trace' => $e->getTraceAsString(),
                ]);

                $processed++;
            }
        }

        // ---- ARTICLES: a small fixed number per run ----
        $articleStats = $this->processPendingArticles(self::ARTICLES_PER_RUN);
        $processed += $articleStats['processed'];
        $succeeded += $articleStats['succeeded'];
        $failed += $articleStats['failed'];

        // Clear cache after processing
        if ($processed > 0) {
            $this->clearQueueCache();
        }

        // Get current performance metrics
        $currentBatchSize = $this->getIntelligentBatchSize();
        $successRate = $this->getSuccessRate();
        $currentInterval = $this->getProcessingInterval();

        return [
            'processed' => $processed,
            'succeeded' => $succeeded,
            'failed' => $failed,
            'batch_size' => $currentBatchSize,
            'success_rate' => round($successRate, 3),
            'interval_seconds' => $currentInterval / 1000000,
            'rate_limit_detected' => Cache::get(self::RATE_LIMIT_DETECTED_KEY, false),
        ];
    }

    /**
     * Process up to $maxArticles pending ARTICLE rows across languages:
     * claim the row, split into sentences, generate each sentence, then write
     * audio_files + has_audio + tts_* completion back to the article row.
     *
     * @return array{processed:int, succeeded:int, failed:int}
     */
    private function processPendingArticles(int $maxArticles): array
    {
        // Default OFF: do not claim/synthesize articles locally — pycore owns TTS.
        if (!app(UserConfigService::class)->useServerBinaryAssist()) {
            return ['processed' => 0, 'succeeded' => 0, 'failed' => 0];
        }

        $processed = 0;
        $succeeded = 0;
        $failed = 0;

        $connName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            if ($processed >= $maxArticles) {
                break;
            }

            $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (!Schema::connection($connName)->hasTable($articleTable)
                || !Schema::connection($connName)->hasColumn($articleTable, 'tts_status')) {
                continue;
            }

            $articles = $this->coordinator->pendingArticlesQuery($lang)
                ->limit($maxArticles - $processed)
                ->get();

            foreach ($articles as $article) {
                // Claim: flip to processing with the local worker identity.
                $article->tts_status = self::STATUS_PROCESSING;
                $article->tts_locked_at = now();
                $article->tts_locked_by = self::PROCESSOR_ID;
                if (!$article->tts_requested_at) {
                    $article->tts_requested_at = now();
                }
                $article->save();

                $startTime = microtime(true);

                try {
                    $generation = $this->generateArticleAudio($article->content, $lang);

                    if ($generation['success']) {
                        // Write-back the old pipeline never did: the article row
                        // is now the durable holder of its audio file list.
                        $article->tts_status = self::STATUS_COMPLETED;
                        $article->tts_completed_at = now();
                        $article->tts_error = null;
                        $article->tts_locked_at = null;
                        $article->tts_locked_by = null;
                        $article->addAudioFiles($generation['audio_files']); // saves; sets has_audio + tts_provider
                        $succeeded++;

                        $processingTimeMs = (microtime(true) - $startTime) * 1000;
                        AppQyV1TTSQueueMetrics::recordProcessingTime(self::TYPE_ARTICLE, $processingTimeMs);

                        $this->handleProcessingSuccess();

                        Log::info('[UnifiedTTSQueue] Article task completed', [
                            'language' => $lang,
                            'article_id' => $article->id,
                            'sentences' => count($generation['audio_files']),
                            'processing_time_ms' => round($processingTimeMs, 2),
                        ]);
                    } else {
                        $this->markArticleFailed($article, $generation['error']);
                        $this->handleProcessingError($generation['error']);
                        if ($article->tts_status === self::STATUS_FAILED) {
                            $failed++;
                        }
                    }
                } catch (\Throwable $e) {
                    $this->markArticleFailed($article, $e->getMessage());
                    $this->handleProcessingError($e->getMessage());
                    if ($article->tts_status === self::STATUS_FAILED) {
                        $failed++;
                    }

                    Log::error('[UnifiedTTSQueue] Exception during article task processing', [
                        'language' => $lang,
                        'article_id' => $article->id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }

                $processed++;

                if ($processed >= $maxArticles) {
                    break;
                }
            }
        }

        return ['processed' => $processed, 'succeeded' => $succeeded, 'failed' => $failed];
    }

    /**
     * Generate per-sentence audio for an article (legacy processArticleTask
     * flow, including zero-byte verification per sentence file).
     *
     * @return array{success:bool, audio_files?:array, error?:string}
     */
    private function generateArticleAudio(string $content, string $language): array
    {
        // Safety gate: never fork EdgeTTS when binary assist is OFF.
        if (!app(UserConfigService::class)->useServerBinaryAssist()) {
            return [
                'success' => false,
                'error' => 'Local article TTS disabled; deferred to pycore (use_server_binary_assist=off)',
            ];
        }

        $sentences = $this->splitIntoSentences($content);

        if (empty($sentences)) {
            return [
                'success' => false,
                'error' => 'No sentences found in article',
            ];
        }

        $audioFiles = [];

        foreach ($sentences as $sentence) {
            $sentence = trim($sentence);
            if (empty($sentence)) {
                continue;
            }

            $result = $this->ttsService->generateAudio($sentence, $language, 'sentence');

            if (empty($result['success'])) {
                Log::error('[UnifiedTTSQueue] Failed to generate audio for sentence', [
                    'language' => $language,
                    'sentence' => $sentence,
                    'error' => $result['error'] ?? 'Unknown error',
                ]);
                return [
                    'success' => false,
                    'error' => 'Failed to generate audio for some sentences',
                ];
            }

            $audioPath = $result['audio_path'] ?? null;
            $verifyError = $this->verifyGeneratedFile($audioPath);
            if ($verifyError !== null) {
                return [
                    'success' => false,
                    'error' => $verifyError,
                ];
            }

            $audioFiles[] = [
                'sentence' => $sentence,
                'path' => $audioPath,
                'created_at' => now()->toDateTimeString(),
            ];

            usleep(100000); // 100ms delay between sentences
        }

        if (empty($audioFiles)) {
            return [
                'success' => false,
                'error' => 'No sentences found in article',
            ];
        }

        return [
            'success' => true,
            'audio_files' => $audioFiles,
        ];
    }

    /**
     * Record a failed attempt on an article row (retry budget on the row).
     */
    private function markArticleFailed($article, string $error): void
    {
        $attempts = (int) $article->tts_attempts + 1;
        $article->tts_attempts = $attempts;
        $article->tts_error = mb_substr($error, 0, 2000);
        $article->tts_status = $attempts >= AppQyV1DictionaryTTSCoordinator::MAX_ATTEMPTS
            ? self::STATUS_FAILED
            : self::STATUS_PENDING;
        $article->tts_locked_at = null;
        $article->tts_locked_by = null;
        $article->save();
    }

    /**
     * Zero-byte / existence verification of a freshly generated audio file.
     * Returns an error string (and removes a zero-byte file) or null when OK.
     */
    private function verifyGeneratedFile(?string $relativePath): ?string
    {
        if (!$relativePath) {
            return 'Audio file not found after generation';
        }

        $fullPath = $this->ttsService->getAudioPath($relativePath);
        if (!$fullPath || !file_exists($fullPath)) {
            Log::error('[UnifiedTTSQueue] Audio file not found after generation', [
                'audio_path' => $relativePath,
            ]);
            return 'Audio file not found after generation';
        }

        if (filesize($fullPath) === 0) {
            @unlink($fullPath);
            Log::error('[UnifiedTTSQueue] Zero-byte audio file detected and deleted', [
                'audio_path' => $relativePath,
            ]);
            return 'Generated audio file is 0 bytes';
        }

        return null;
    }

    /**
     * Try the REAL pronunciation API chain (Free Dictionary API -> Forvo) for a
     * word and persist a hit via the source-agnostic coordinator. Mirrors
     * AppQyV1WordMediaService::fetchRealPronunciation so the timer uses the SAME
     * API-first logic as the request path (storeWordAudioBytes validates the
     * bytes, writes the canonical path and marks the row completed). Returns
     * true only when audio was newly stored. NEVER throws.
     */
    private function tryRealPronunciation(string $word, string $lang, string $md5): bool
    {
        try {
            $result = $this->wordAudioClient->findPronunciation($word, $lang);
        } catch (\Throwable $e) {
            Log::warning('[UnifiedTTSQueue] real pronunciation lookup failed', [
                'word' => $word,
                'language' => $lang,
                'error' => $e->getMessage(),
            ]);
            return false;
        }

        if ($result === null) {
            return false;
        }

        try {
            return $this->coordinator->storeWordAudioBytes(
                $lang,
                $md5,
                $result['binary'],
                $result['provider']
            );
        } catch (\Throwable $e) {
            Log::warning('[UnifiedTTSQueue] failed to store real pronunciation audio', [
                'word' => $word,
                'language' => $lang,
                'provider' => $result['provider'] ?? null,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Release a claimed WORD row back to pending WITHOUT consuming the retry
     * budget - used after delegating an API-miss to the pycore word_audio lane,
     * so pycore (or a later API hit) can own the row. Completed rows are never
     * touched. This is a release, not a failure: tts_attempts is unchanged.
     */
    private function releaseWordProcessingClaim($entry): void
    {
        if (!$entry || $entry->tts_status === self::STATUS_COMPLETED) {
            return;
        }
        $entry->tts_status = self::STATUS_PENDING;
        $entry->tts_locked_at = null;
        $entry->tts_locked_by = null;
        $entry->save();
    }

    /**
     * Split article into sentences
     */
    private function splitIntoSentences(string $text): array
    {
        // Split by common sentence terminators
        $sentences = preg_split('/([.!?。！？]+)\s*/u', $text, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY);

        $result = [];
        $buffer = '';

        foreach ($sentences as $part) {
            $buffer .= $part;

            if (preg_match('/[.!?。！？]+$/u', $part)) {
                $result[] = trim($buffer);
                $buffer = '';
            }
        }

        if (!empty($buffer)) {
            $result[] = trim($buffer);
        }

        return array_filter($result);
    }

    /**
     * Clean old completed items — NO-OP.
     *
     * Completed state lives permanently on the canonical tables (it IS the
     * data); there is no intermediate queue left to prune. Kept for caller
     * compatibility.
     */
    public function cleanQueue(int $days = 7): int
    {
        return 0;
    }

    /**
     * Clear queue cache
     */
    private function clearQueueCache(): void
    {
        Cache::forget('tts_queue_statistics');
        Cache::forget('tts_queue_recent_logs:100');
        // Clear summary cache pattern
        foreach (range(1, 10) as $page) {
            foreach ([null, 'pending', 'processing', 'completed', 'failed'] as $status) {
                foreach ([null, 'word', 'sentence', 'article'] as $type) {
                    Cache::forget("tts_queue_summary:{$page}:50:{$status}:{$type}");
                }
            }
        }
    }

    /**
     * Deduplicate queue — NO-OP.
     *
     * md5 is unique per canonical table, so duplicate tasks are structurally
     * impossible in the queue-less design. Kept for caller compatibility.
     *
     * @param bool $force Unused (kept for signature compatibility)
     * @return array
     */
    public function deduplicateQueue(bool $force = false): array
    {
        return [
            'success' => true,
            'removed' => 0,
            'duplicates_found' => 0,
            'deleted' => 0,
        ];
    }

    /**
     * Get recent task logs: canonical rows with TTS tracking state, most
     * recently updated first (same log item shape as the legacy queue rows).
     *
     * @param int $limit Number of logs to retrieve (default: 100)
     * @return array
     */
    public function getRecentLogs(int $limit = 100): array
    {
        $limit = max(1, min(1000, $limit));
        $cacheKey = "tts_queue_recent_logs:{$limit}";

        return Cache::remember($cacheKey, now()->addSeconds(10), function () use ($limit) {
            $entries = [];
            $connName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);

            foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
                $dictTable = AppQyV1TableMaps::getDictionaryTableName($lang);
                if (Schema::connection($connName)->hasTable($dictTable)) {
                    $rows = AppQyV1LangDictionaryModel::forLanguage($lang)
                        ->whereNotNull('tts_status')
                        ->orderByDesc('updated_at')
                        ->limit($limit)
                        ->get();
                    foreach ($rows as $row) {
                        $entries[] = [
                            'sort' => $row->updated_at ? $row->updated_at->getTimestamp() : 0,
                            'log' => $this->formatLogRow($row, $lang, self::TYPE_WORD),
                        ];
                    }
                }

                $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
                if (Schema::connection($connName)->hasTable($articleTable)
                    && Schema::connection($connName)->hasColumn($articleTable, 'tts_status')) {
                    $rows = AppQyV1ArticleLibraryModel::forLanguage($lang)
                        ->whereNotNull('tts_status')
                        ->orderByDesc('updated_at')
                        ->limit($limit)
                        ->get();
                    foreach ($rows as $row) {
                        $entries[] = [
                            'sort' => $row->updated_at ? $row->updated_at->getTimestamp() : 0,
                            'log' => $this->formatLogRow($row, $lang, self::TYPE_ARTICLE),
                        ];
                    }
                }
            }

            usort($entries, fn ($a, $b) => $b['sort'] <=> $a['sort']);
            $logs = array_values(array_map(fn ($e) => $e['log'], array_slice($entries, 0, $limit)));

            return [
                'total' => count($logs),
                'limit' => $limit,
                'logs' => $logs,
            ];
        });
    }

    /**
     * Legacy log-item shape for one canonical row.
     */
    private function formatLogRow($row, string $lang, string $type): array
    {
        $audioPath = $type === self::TYPE_WORD ? $this->firstTtsFilePath($row) : null;

        return [
            'id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $row->id, $type, $lang),
            'task_type' => $type,
            'content_text' => mb_substr((string) $row->content, 0, 50),
            'language' => $lang,
            'status' => AppQyV1DictionaryTTSCoordinator::statusOf($row),
            'priority' => (int) ($row->tts_priority ?? 0),
            'retry_count' => (int) ($row->tts_attempts ?? 0),
            'error_message' => $row->tts_error,
            'audio_path' => $audioPath,
            'requested_at' => $row->tts_requested_at?->toIso8601String(),
            'started_at' => $row->tts_locked_at?->toIso8601String(),
            'completed_at' => $row->tts_completed_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'updated_at' => $row->updated_at?->toIso8601String(),
        ];
    }

    /**
     * Re-queue failed tasks to front of queue (move-to-front ticket).
     *
     * Per-language UPDATE on the canonical tables: failed rows that still
     * lack audio get tts_status='pending', a fresh retry budget and the
     * table's front ticket (MAX(tts_priority)+1, assigned by one atomic
     * same-table derived subquery per table).
     *
     * @return array
     */
    public function requeueFailedTasks(): array
    {
        $requeued = 0;
        $connName = AppTablePrefixServiceProvider::getConnection(AppKeys::APPQYV1);
        $conn = DB::connection($connName);

        $resetValues = [
            'tts_status' => self::STATUS_PENDING,
            'tts_attempts' => 0,
            'tts_error' => null,
            'tts_locked_at' => null,
            'tts_locked_by' => null,
        ];

        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            $dictTable = AppQyV1TableMaps::getDictionaryTableName($lang);
            if (Schema::connection($connName)->hasTable($dictTable)) {
                $requeued += $conn->transaction(function () use ($conn, $dictTable, $resetValues) {
                    AppQyV1TableMaps::lockTableForFrontTicket($conn, $dictTable);
                    return $conn->table($dictTable)
                        ->where('tts_status', self::STATUS_FAILED)
                        ->where('has_audio', false)
                        ->update(array_merge($resetValues, [
                            // Batch move-to-front: every requeued failed row in this
                            // table shares the table's current MAX+1 front ticket (they
                            // are re-queued as one batch; the claim tiebreaker orders
                            // them). The advisory lock prevents a concurrent user bump
                            // from reading the same MAX and colliding. No backticks -
                            // PG uses double-quotes for identifiers, not backticks.
                            'tts_priority' => DB::raw("(SELECT m FROM (SELECT COALESCE(MAX(tts_priority), 0) + 1 AS m FROM {$dictTable}) x)"),
                        ]));
                });
            }

            $articleTable = AppTablePrefixServiceProvider::buildTableName(AppKeys::APPQYV1, "{$lang}_article_library");
            if (Schema::connection($connName)->hasTable($articleTable)
                && Schema::connection($connName)->hasColumn($articleTable, 'tts_status')) {
                $requeued += $conn->transaction(function () use ($conn, $articleTable, $resetValues) {
                    AppQyV1TableMaps::lockTableForFrontTicket($conn, $articleTable);
                    return $conn->table($articleTable)
                        ->where('tts_status', self::STATUS_FAILED)
                        ->where('has_audio', false)
                        ->update(array_merge($resetValues, [
                            'tts_priority' => DB::raw("(SELECT m FROM (SELECT COALESCE(MAX(tts_priority), 0) + 1 AS m FROM {$articleTable}) x)"),
                        ]));
                });
            }
        }

        $this->clearQueueCache();

        Log::info('[UnifiedTTSQueue] Re-queued failed tasks', [
            'count' => $requeued,
        ]);

        return [
            'success' => true,
            'requeued_count' => $requeued,
        ];
    }

    /**
     * Add task at specific position
     *
     * @param string $content Content text
     * @param string $language Language code
     * @param string|null $type Task type (auto-detect if null)
     * @param string $position 'beginning'|'end'
     * @return array
     */
    public function addTaskAtPosition(string $content, string $language, ?string $type, string $position): array
    {
        if (!in_array($position, ['beginning', 'end'])) {
            return [
                'success' => false,
                'error' => 'Invalid position. Must be: beginning or end',
            ];
        }

        return $this->addTask($content, $language, $type, $position);
    }
}
