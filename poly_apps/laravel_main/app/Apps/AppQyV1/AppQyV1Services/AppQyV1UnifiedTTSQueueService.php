<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Services\PycoreTasks\PycoreTaskQueue;
use App\Services\QueueCenter\QueueCenterService;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1ArticleLibraryModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TtsUrl;
use App\Services\EdgeTTS\EdgeTTSService;
use App\Services\MediaIngestService;
use App\Support\QueueCenterContract;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Unified TTS compatibility service over canonical rows and Queue Center.
 *
 * The intermediate app_qy_v1_tts_queue table is decommissioned. All task
 * domain state lives on canonical tables; distributed order and execution
 * live on GlobalTask Queue Center lanes:
 *   - word:    {prefix}_tts_cache_{lang} rows plus the word_audio global queue
 *   - article: article rows materialized into sentence_audio global tasks
 *   - sentence: the shared audio gateway schedules sentence_audio for pycore
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

    const TYPE_WORD = 'word';
    const TYPE_SENTENCE = 'sentence';
    const TYPE_ARTICLE = 'article';

    const STATUS_PENDING = 'pending';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_FAILED = 'failed';

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
     * Add a TTS task (auto-detect type or use specified type).
     *
     * WORD / ARTICLE: idempotent against the canonical row — when the audio
     * already exists 'already_available' is returned; otherwise the row is
     * marked tts_status='pending' (created first when absent) and the encoded
     * task_id is returned with status 'queued' or 'moved_to_front'.
     *
     * SENTENCE: the deterministic file path is checked first; a miss is
     * scheduled through the shared sentence_audio Queue Center gateway.
     *
     * @param string $content Content text for a contract-defined audio task
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
        $headAction = null;
        $queueTaskId = null;
        $queuePosition = 0;

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
            $dictEntry = AppQyV1LangDictionaryModel::findOrInsertContent($language, $content);
        }

        $status = $this->markRowPending($dictEntry, $position);

        // The queue center owns the word_audio global task now (deduped by
        // group_key); the flag-gated Phase 5 dual-write is superseded for
        // word_audio. Best-effort — never breaks the enqueue path.
        try {
            $queueCenter = app(\App\Services\QueueCenter\QueueCenterService::class);
            $dedupKey = \App\Services\QueueCenter\QueueCenterService::dedupKeyFor(
                \App\Services\QueueCenter\QueueCenterService::QUEUE_WORD_AUDIO,
                $language,
                $contentHash
            );
            $queuePayload = [
                'word' => $content,
                'language' => $language,
                'md5' => $contentHash,
                'dict_row_id' => (int) $dictEntry->id,
            ];
            $queueLinks = [
                'dict_row_id' => (int) $dictEntry->id,
                'dict_language' => $language,
                'dict_row_table' => $dictEntry->getTable(),
            ];
            $queueResult = $queueCenter->schedule(
                \App\Services\QueueCenter\QueueCenterService::QUEUE_WORD_AUDIO,
                $queuePayload,
                $dedupKey,
                $position === 'beginning',
                true,
                $queueLinks,
                300
            );
            $headAction = $queueResult['head_action'] ?? null;
            $queueTaskId = (string) ($queueResult['task_id'] ?? '');
            $queuePosition = (int) ($queueResult['queue_position'] ?? 0);
            if ($queueTaskId !== '') {
                // Link the canonical row to its queue-center task (same column
                // the retired dual-write maintained).
                $dictEntry->tts_global_task_id = $queueTaskId;
                $dictEntry->saveRecord();
            }
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1UnifiedTTSQueueService] queue-center word_audio ensure failed', [
                'dict_row_id' => $dictEntry->id ?? null,
                'language' => $language,
                'error' => $e->getMessage(),
            ]);
            return [
                'success' => false,
                'status' => 'failed',
                'error' => 'Queue Center task creation failed',
            ];
        }
        if ($queueTaskId === null || $queueTaskId === '') {
            return [
                'success' => false,
                'status' => 'failed',
                'error' => 'Queue Center did not return a task ID',
            ];
        }

        $this->clearQueueCache();

        return [
            'success' => true,
            'status' => $status,
            'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $dictEntry->id, self::TYPE_WORD, $language),
            'queue_task_id' => $queueTaskId,
            'queue_position' => $queuePosition,
            'head_action' => $headAction,
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

        try {
            (new AppQyV1ArticleSentenceAudioService())->enqueueLibraryArticle(
                $article,
                $language,
                $position === 'beginning'
            );
        } catch (\Throwable $e) {
            Log::warning('[UnifiedTTSQueue] article sentence-audio enqueue failed', [
                'language' => $language,
                'md5' => $contentHash,
                'error' => $e->getMessage(),
            ]);
        }

        $this->clearQueueCache();

        return [
            'success' => true,
            'status' => $status,
            'task_id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $article->id, self::TYPE_ARTICLE, $language),
            'task_type' => self::TYPE_ARTICLE,
            'position' => $position,
        ];
    }

    /** SENTENCE task: delegate file lookup and queue-head insertion to the gateway. */
    private function addSentenceTask(string $content, string $language): array
    {
        $contentId = MediaIngestService::computeContentId($content);
        $gatewayResult = (new AppQyV1AudioGateway())->requestSentence(
            $contentId,
            $content,
            $language,
            null,
            null,
            true
        );
        if (!(bool) ($gatewayResult['success'] ?? false)) {
            return [
                'success' => false,
                'error' => $gatewayResult['error'] ?? 'Sentence audio gateway failed',
            ];
        }
        if ((bool) ($gatewayResult['exists'] ?? false)) {
            return [
                'success' => true,
                'status' => 'already_available',
                'audio_path' => null,
                'audio_url' => $gatewayResult['url'] ?? null,
                'content_id' => $contentId,
            ];
        }
        if ((bool) ($gatewayResult['queued'] ?? false)) {
            return [
                'success' => true,
                'status' => ($gatewayResult['queue_head_action'] ?? null) === 'moved_to_head'
                    ? 'moved_to_front'
                    : 'queued',
                'queued' => true,
                'content_id' => $contentId,
                'queue_task_id' => $gatewayResult['queue_task_id'] ?? null,
                'queue_position' => $gatewayResult['queue_position'] ?? null,
            ];
        }

        return [
            'success' => false,
            'error' => $gatewayResult['error'] ?? 'Sentence audio was not queued',
        ];
    }

    /**
     * Flip a canonical row (word or article) to tts_status='pending' and
     * return the external add-status string (queued|moved_to_front). Queue
     * order is owned by the linked GlobalTask queue_position; canonical rows
     * carry no queue-order state.
     */
    private function markRowPending($row, string $position): string
    {
        return $row::runInTransaction(function () use ($row, $position) {
            $row->tts_status = self::STATUS_PENDING;
            if (!$row->tts_requested_at) {
                $row->tts_requested_at = now();
            }

            // Re-adding a failed row re-queues it with a fresh retry budget.
            $row->tts_attempts = 0;
            $row->tts_error = null;
            $row->tts_locked_at = null;
            $row->tts_locked_by = null;

            $row->saveRecord();
            $status = $position === 'beginning' ? 'moved_to_front' : 'queued';

            return $status;
        });
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
        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            if ($type === null || $type === self::TYPE_WORD) {
                if (AppQyV1LangDictionaryModel::ttsTableReady($lang, true)) {
                    $rows = AppQyV1LangDictionaryModel::recentTtsRows($lang, $perLanguageCap);
                    foreach ($rows as $row) {
                        $entries[] = [
                            'sort' => $row->updated_at ? $row->updated_at->getTimestamp() : 0,
                            'item' => $this->formatWordRow($row, $lang),
                        ];
                    }
                }
            }

            if ($type === null || $type === self::TYPE_ARTICLE) {
                if (AppQyV1ArticleLibraryModel::ttsTableReady($lang, true)) {
                    $rows = AppQyV1ArticleLibraryModel::recentTtsRows($lang, $perLanguageCap);
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
        if ($decoded['type'] === self::TYPE_WORD) {
            if (!AppQyV1LangDictionaryModel::ttsTableReady($lang, true)) {
                return null;
            }
            $row = AppQyV1LangDictionaryModel::findLanguageRow($lang, $decoded['row_id']);
            return $row ? $this->formatWordRow($row, $lang) : null;
        }

        if ($decoded['type'] === self::TYPE_ARTICLE) {
            if (!AppQyV1ArticleLibraryModel::ttsTableReady($lang, true)) {
                return null;
            }
            $row = AppQyV1ArticleLibraryModel::findLanguageRow($lang, $decoded['row_id']);
            return $row ? $this->formatArticleRow($row, $lang) : null;
        }

        // Sentence tasks are owned by Queue Center, outside this legacy encoded-row lookup.
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
     * Request audio for a word (legacy word-level surface, moved from the
     * deleted AppQyV1TTSQueueService).
     * Returns audio info if available, null after queueing for generation
     * (marking the canonical dictionary row tts_status='pending').
     */
    public function requestAudio(string $word, string $language): ?array
    {
        $result = (new AppQyV1AudioGateway())->requestWord($word, $language, null, true, true);
        if (($result['audio_url'] ?? null) === null) {
            return null;
        }

        return [
            'available' => true,
            'audio_path' => null,
            'audio_url' => $result['audio_url'],
        ];
    }

    /**
     * Get queue statistics (legacy flat shape, moved from the deleted
     * AppQyV1TTSQueueService).
     */
    public function getQueueStats(): array
    {
        $stats = $this->coordinator->statistics();

        return [
            'pending' => $stats['by_status']['pending'],
            'processing' => $stats['by_status']['processing'],
            'completed' => $stats['by_status']['completed'],
            'failed' => $stats['by_status']['failed'],
            'total' => $stats['total'],
        ];
    }

    /**
     * Get queue status for a specific word from its canonical row (moved from
     * the deleted AppQyV1TTSQueueService).
     * Returns null when the word was never queued (no row, or no TTS
     * tracking state) — callers treat null as "not in queue".
     */
    public function getQueueStatus(string $word, string $language): ?array
    {
        $language = strtolower($language);
        $md5 = md5($word);

        $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $md5);

        if (!$dictEntry || $dictEntry->tts_status === null) {
            return null;
        }

        $audioPath = null;
        if (is_array($dictEntry->tts_files)) {
            foreach ($dictEntry->tts_files as $ttsFile) {
                if (isset($ttsFile['path'])) {
                    $audioPath = $ttsFile['path'];
                    break;
                }
            }
        }

        return [
            'word' => $dictEntry->content,
            'language' => $language,
            'status' => AppQyV1DictionaryTTSCoordinator::statusOf($dictEntry),
            'retry_count' => (int) ($dictEntry->tts_attempts ?? 0),
            'error_message' => $dictEntry->tts_error,
            'audio_path' => $audioPath,
            'requested_at' => $dictEntry->tts_requested_at,
            'started_at' => $dictEntry->tts_locked_at,
            'completed_at' => $dictEntry->tts_completed_at,
        ];
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
     * Legacy TaskDetail shape for a canonical ARTICLE row. Queue order is not
     * exposed here: it lives on the linked GlobalTask queue_position.
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
                    }
                    if (isset($existingAudio['audio_url'])) {
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
                        // Queue-backed sentence result has no legacy encoded row.
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
            // Lane-level pycore availability: queued items wait for an online pycore.
            'pycore_lanes' => array_filter([
                QueueCenterService::QUEUE_WORD_AUDIO => PycoreTaskQueue::availabilityView(QueueCenterService::QUEUE_WORD_AUDIO, null),
                QueueCenterService::QUEUE_SENTENCE_AUDIO => PycoreTaskQueue::availabilityView(QueueCenterService::QUEUE_SENTENCE_AUDIO, null),
            ]),
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

        // Sentence tracking is owned by Queue Center, not this legacy row projection.
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

        // Sentences: use the unified file-first gateway without enqueueing.
        if ($type === self::TYPE_SENTENCE) {
            $gatewayResult = (new AppQyV1AudioGateway())->requestSentence(
                MediaIngestService::computeContentId($content),
                $content,
                $language,
                null,
                null,
                false
            );
            if ((bool) ($gatewayResult['success'] ?? false)
                && (bool) ($gatewayResult['exists'] ?? false)) {
                return [
                    'exists' => true,
                    'audio_path' => null,
                    'audio_url' => $gatewayResult['url'] ?? null,
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
                foreach (array_merge([null], QueueCenterContract::queuePositionOrderedTaskAliases()) as $type) {
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
            foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
                if (AppQyV1LangDictionaryModel::ttsTableReady($lang, true)) {
                    $rows = AppQyV1LangDictionaryModel::recentTtsRows($lang, $limit);
                    foreach ($rows as $row) {
                        $entries[] = [
                            'sort' => $row->updated_at ? $row->updated_at->getTimestamp() : 0,
                            'log' => $this->formatLogRow($row, $lang, self::TYPE_WORD),
                        ];
                    }
                }

                if (AppQyV1ArticleLibraryModel::ttsTableReady($lang, true)) {
                    $rows = AppQyV1ArticleLibraryModel::recentTtsRows($lang, $limit);
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

        $formatted = [
            'id' => AppQyV1DictionaryTTSCoordinator::encodeTaskId((int) $row->id, $type, $lang),
            'task_type' => $type,
            'content_text' => mb_substr((string) $row->content, 0, 50),
            'language' => $lang,
            'status' => AppQyV1DictionaryTTSCoordinator::statusOf($row),
            'retry_count' => (int) ($row->tts_attempts ?? 0),
            'error_message' => $row->tts_error,
            'audio_path' => $audioPath,
            'requested_at' => $row->tts_requested_at?->toIso8601String(),
            'started_at' => $row->tts_locked_at?->toIso8601String(),
            'completed_at' => $row->tts_completed_at?->toIso8601String(),
            'created_at' => $row->created_at?->toIso8601String(),
            'updated_at' => $row->updated_at?->toIso8601String(),
        ];

        return $formatted;
    }

    /**
     * Re-queue failed canonical rows.
     *
     * Per-language UPDATE on the canonical tables: failed rows that still
     * lack audio get tts_status='pending' and a fresh retry budget. Article
     * ordering lives on the linked GlobalTask queue_position; canonical rows
     * carry no queue-order state.
     *
     * @return array
     */
    public function requeueFailedTasks(): array
    {
        $requeued = 0;
        $resetValues = [
            'tts_status' => self::STATUS_PENDING,
            'tts_attempts' => 0,
            'tts_error' => null,
            'tts_locked_at' => null,
            'tts_locked_by' => null,
            'tts_lease_id' => null,
            'tts_lease_expires_at' => null,
        ];

        foreach (AppQyV1DictionaryTTSCoordinator::supportedLanguages() as $lang) {
            $requeued += AppQyV1LangDictionaryModel::resetFailedTts(
                $lang,
                self::STATUS_FAILED,
                $resetValues
            );
            $requeued += AppQyV1ArticleLibraryModel::resetFailedTts(
                $lang,
                self::STATUS_FAILED,
                array_diff_key($resetValues, ['tts_lease_id' => true, 'tts_lease_expires_at' => true])
            );
        }
        foreach (\App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $requeued += \App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangSentenceModel::resetFailedTts(
                $lang,
                self::STATUS_FAILED,
                $resetValues
            );
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
