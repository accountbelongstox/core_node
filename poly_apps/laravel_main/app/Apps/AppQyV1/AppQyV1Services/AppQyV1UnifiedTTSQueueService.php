<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TTSQueueModel;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Services\EdgeTTS\EdgeTTSService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use App\Apps\AppQyV1\AppQyV1Services\AppQyV1TTSQueueMetrics;

/**
 * Unified TTS Queue Service
 *
 * Handles all types of TTS tasks:
 * - word: Single word TTS
 * - sentence: Sentence TTS
 * - article: Article split into sentences
 */
class AppQyV1UnifiedTTSQueueService
{
    private $ttsService;

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
     * Add task to queue (auto-detect type or use specified type)
     * If task exists, returns existing task info
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

        $contentHash = md5($content);

        // Check if audio already exists in dictionary (for words)
        if ($type === self::TYPE_WORD) {
            $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $contentHash);
            if ($dictEntry && isset($dictEntry->tts_files) && !empty($dictEntry->tts_files)) {
                foreach ($dictEntry->tts_files as $ttsFile) {
                    if (isset($ttsFile['path'])) {
                        $fullPath = $this->ttsService->getAudioPath($ttsFile['path']);
                        if ($fullPath) {
                            $dictEntry->incrementQueryCount();
                            return [
                                'success' => true,
                                'status' => 'already_available',
                                'audio_path' => $ttsFile['path'],
                                'audio_url' => '/api/app_qy_v1/ai_tools/tts/audio/' . $ttsFile['path'],
                            ];
                        }
                    }
                }
            }
        }

        // Check if task already exists in queue
        $existing = AppQyV1TTSQueueModel::where('task_type', $type)
            ->where('content_hash', $contentHash)
            ->where('language', $language)
            ->first();

        if ($existing) {
            // If task already exists in queue
            if ($existing->status === self::STATUS_COMPLETED) {
                // Already completed
                return [
                    'success' => true,
                    'status' => 'already_completed',
                    'task_id' => $existing->id,
                    'audio_path' => $existing->audio_path,
                    'audio_files' => $existing->audio_files,
                ];
            }

            if ($existing->status === self::STATUS_PENDING) {
                // Move to beginning if requested
                if ($position === 'beginning') {
                    // Set created_at to before the earliest pending task
                    $earliest = AppQyV1TTSQueueModel::where('status', self::STATUS_PENDING)
                        ->orderBy('created_at', 'asc')
                        ->first();

                    if ($earliest) {
                        $existing->created_at = $earliest->created_at->subSecond();
                    }
                    $existing->requested_at = now();
                    $existing->save();

                    $this->clearQueueCache();

                    return [
                        'success' => true,
                        'status' => 'moved_to_beginning',
                        'task_id' => $existing->id,
                        'queue_status' => $existing->status,
                    ];
                }

                // Already in queue, no action needed
                return [
                    'success' => true,
                    'status' => 'already_in_queue',
                    'task_id' => $existing->id,
                    'queue_status' => $existing->status,
                ];
            }

            if ($existing->status === self::STATUS_FAILED) {
                // Retry failed task
                $existing->status = self::STATUS_PENDING;
                $existing->retry_count = 0;
                $existing->error_message = null;
                $existing->started_at = null;
                $existing->requested_at = now();

                // Set position
                if ($position === 'beginning') {
                    $earliest = AppQyV1TTSQueueModel::where('status', self::STATUS_PENDING)
                        ->orderBy('created_at', 'asc')
                        ->first();

                    if ($earliest) {
                        $existing->created_at = $earliest->created_at->subSecond();
                    }
                }

                $existing->save();

                $this->clearQueueCache();

                return [
                    'success' => true,
                    'status' => 'retry_queued',
                    'task_id' => $existing->id,
                    'queue_status' => $existing->status,
                ];
            }

            // Task is processing
            return [
                'success' => true,
                'status' => 'currently_processing',
                'task_id' => $existing->id,
                'queue_status' => $existing->status,
            ];
        }

        // Determine created_at based on position
        $createdAt = now();
        if ($position === 'beginning') {
            // Insert before the earliest pending task
            $earliest = AppQyV1TTSQueueModel::where('status', self::STATUS_PENDING)
                ->orderBy('created_at', 'asc')
                ->first();

            if ($earliest) {
                $createdAt = $earliest->created_at->subSecond();
            }
        }

        // Create new task
        $task = AppQyV1TTSQueueModel::create([
            'task_type' => $type,
            'content_text' => $content,
            'content_hash' => $contentHash,
            'language' => $language,
            'status' => self::STATUS_PENDING,
            'priority' => 0, // No longer used, kept for compatibility
            'requested_at' => now(),
            'created_at' => $createdAt,
            'updated_at' => now(),
        ]);

        $this->clearQueueCache();

        return [
            'success' => true,
            'status' => 'queued',
            'task_id' => $task->id,
            'task_type' => $type,
            'position' => $position,
        ];
    }

    /**
     * Get queue summary with pagination
     */
    public function getQueueSummary(int $page = 1, int $perPage = 50, ?string $status = null, ?string $type = null): array
    {
        $cacheKey = "tts_queue_summary:{$page}:{$perPage}:{$status}:{$type}";

        return Cache::remember($cacheKey, now()->addSeconds(10), function () use ($page, $perPage, $status, $type) {
            $query = AppQyV1TTSQueueModel::query();

            if ($status) {
                $query->where('status', $status);
            }

            if ($type) {
                $query->where('task_type', $type);
            }

            $total = $query->count();
            $tasks = $query->orderBy('priority', 'desc')
                ->orderBy('created_at', 'asc')
                ->skip(($page - 1) * $perPage)
                ->take($perPage)
                ->get();

            $items = $tasks->map(function ($task) {
                return $this->formatTask($task);
            });

            return [
                'tasks' => $items,
                'pagination' => [
                    'current_page' => $page,
                    'per_page' => $perPage,
                    'total' => $total,
                    'total_pages' => ceil($total / $perPage),
                ],
                'statistics' => $this->getStatistics(),
            ];
        });
    }

    /**
     * Get completed tasks
     */
    public function getCompletedTasks(int $page = 1, int $perPage = 50, ?string $type = null): array
    {
        return $this->getQueueSummary($page, $perPage, self::STATUS_COMPLETED, $type);
    }

    /**
     * Get single task by ID
     */
    public function getTask(int $taskId): ?array
    {
        $task = AppQyV1TTSQueueModel::find($taskId);

        if (!$task) {
            return null;
        }

        return $this->formatTask($task);
    }

    /**
     * Get queue statistics
     */
    public function getStatistics(): array
    {
        $cacheKey = 'tts_queue_statistics';

        return Cache::remember($cacheKey, now()->addSeconds(10), function () {
            $completedCount = AppQyV1TTSQueueModel::where('status', self::STATUS_COMPLETED)->count();
            $totalRetries = AppQyV1TTSQueueModel::sum('retry_count');

            return [
                'by_status' => [
                    'pending' => AppQyV1TTSQueueModel::where('status', self::STATUS_PENDING)->count(),
                    'processing' => AppQyV1TTSQueueModel::where('status', self::STATUS_PROCESSING)->count(),
                    'completed' => $completedCount,
                    'failed' => AppQyV1TTSQueueModel::where('status', self::STATUS_FAILED)->count(),
                ],
                'by_type' => [
                    'word' => AppQyV1TTSQueueModel::where('task_type', self::TYPE_WORD)->count(),
                    'sentence' => AppQyV1TTSQueueModel::where('task_type', self::TYPE_SENTENCE)->count(),
                    'article' => AppQyV1TTSQueueModel::where('task_type', self::TYPE_ARTICLE)->count(),
                ],
                'total' => AppQyV1TTSQueueModel::count(),
                'current_concurrent' => \App\Services\EdgeTTS\EdgeTTSService::getConcurrentCount(),
                'total_success' => $completedCount,
                'total_retries' => $totalRetries,
            ];
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
        $intervalSeconds = $this->getProcessingInterval() / 1000000;
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
        $pending = AppQyV1TTSQueueModel::where('status', self::STATUS_PENDING)->count();
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
     * Format task for API response
     */
    private function formatTask($task): array
    {
        $formatted = [
            'task_id' => $task->id,
            'task_type' => $task->task_type,
            'content_text' => $task->content_text,
            'language' => $task->language,
            'status' => $task->status,
            'priority' => $task->priority,
            'retry_count' => $task->retry_count,
        ];

        // If completed, return complete audio information
        if ($task->status === self::STATUS_COMPLETED) {
            // Article type - return sentence mapping
            if ($task->task_type === self::TYPE_ARTICLE && !empty($task->audio_files)) {
                $formatted['audio_files'] = $task->audio_files;
                $formatted['sentence_mapping'] = $this->extractSentenceMapping($task);
            }
            // Word/sentence type - return audio path
            elseif ($task->audio_path) {
                $formatted['audio_path'] = $task->audio_path;
                // audio_path already contains language/type/speed/filename, so just prepend the base path
                $formatted['audio_url'] = "/api/app_qy_v1/ai_tools/tts/audio/{$task->audio_path}";
            }
            // Try to get from dictionary fallback (word type)
            elseif ($task->task_type === self::TYPE_WORD) {
                $existingAudio = $this->checkAudioExists($task->content_text, $task->language, $task->task_type);
                if ($existingAudio && isset($existingAudio['audio_path'])) {
                    $formatted['audio_path'] = $existingAudio['audio_path'];
                    $formatted['audio_url'] = $existingAudio['audio_url'];
                    $formatted['source'] = 'dictionary';
                }
            }
        }
        // If pending or processing, try file fallback
        elseif (in_array($task->status, [self::STATUS_PENDING, self::STATUS_PROCESSING])) {
            $existingAudio = $this->checkAudioExists($task->content_text, $task->language, $task->task_type);
            if ($existingAudio && $existingAudio['exists']) {
                // File exists, return audio information
                if (isset($existingAudio['audio_path'])) {
                    $formatted['audio_path'] = $existingAudio['audio_path'];
                    $formatted['audio_url'] = $existingAudio['audio_url'];
                    $formatted['file_available'] = true;
                    $formatted['source'] = 'dictionary_or_completed';
                } elseif (isset($existingAudio['audio_files'])) {
                    $formatted['audio_files'] = $existingAudio['audio_files'];
                    $formatted['sentence_mapping'] = $existingAudio['sentence_mapping'] ?? [];
                    $formatted['file_available'] = true;
                    $formatted['source'] = 'completed_queue';
                }
            }
        }

        if ($task->metadata) {
            $formatted['metadata'] = $task->metadata;
        }

        if ($task->error_message) {
            $formatted['error_message'] = $task->error_message;
        }

        if ($task->requested_at) {
            $formatted['requested_at'] = $task->requested_at->toISOString();
        }

        if ($task->started_at) {
            $formatted['started_at'] = $task->started_at->toISOString();
        }

        if ($task->completed_at) {
            $formatted['completed_at'] = $task->completed_at->toISOString();
        }

        return $formatted;
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
        // Pre-process: deduplicate queue before adding
        $this->deduplicateQueue();

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
     * Batch get tasks by IDs
     *
     * @param array $taskIds Array of task IDs
     * @return array Array of task details
     */
    public function batchGetTasks(array $taskIds): array
    {
        $tasks = AppQyV1TTSQueueModel::whereIn('id', $taskIds)->get();

        $results = [];

        foreach ($taskIds as $taskId) {
            $task = $tasks->firstWhere('id', $taskId);

            if ($task) {
                $results[] = $this->formatTask($task);
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
        // Pre-process: deduplicate queue before querying
        $this->deduplicateQueue();

        $results = [];

        foreach ($queries as $index => $query) {
            // Query by task_id
            if (isset($query['task_id'])) {
                $task = AppQyV1TTSQueueModel::find($query['task_id']);

                if ($task) {
                    $results[] = array_merge(
                        $this->formatTask($task),
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
                $language = $query['language'];
                $type = $query['type'] ?? null;
                $taskPosition = $query['position'] ?? $position;

                // Auto-detect type if not specified
                if (!$type) {
                    $type = $this->detectType($content);
                }

                $contentHash = md5($content);

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

                // Step 2: Check if task exists in queue
                $existingTask = AppQyV1TTSQueueModel::where('task_type', $type)
                    ->where('content_hash', $contentHash)
                    ->where('language', $language)
                    ->first();

                if ($existingTask) {
                    // Task exists, return its current status
                    $results[] = array_merge(
                        $this->formatTask($existingTask),
                        [
                            'index' => $index,
                            'query_type' => 'content',
                            'source' => 'existing_task',
                        ]
                    );
                } else {
                    // Step 3: Create new task
                    $addResult = $this->addTask($content, $language, $type, $taskPosition);

                    if ($addResult['success']) {
                        $newTask = AppQyV1TTSQueueModel::find($addResult['task_id']);

                        $results[] = array_merge(
                            $this->formatTask($newTask),
                            [
                                'index' => $index,
                                'query_type' => 'content',
                                'source' => 'newly_created',
                            ]
                        );
                    } else {
                        $results[] = [
                            'index' => $index,
                            'query_type' => 'content',
                            'error' => $addResult['error'] ?? 'Failed to create task',
                            'content' => $content,
                        ];
                    }
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
        $contentHash = md5($content);

        // Check dictionary for words
        if ($type === self::TYPE_WORD) {
            $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $contentHash);
            if ($dictEntry && $dictEntry->has_audio && !empty($dictEntry->tts_files)) {
                foreach ($dictEntry->tts_files as $ttsFile) {
                    if (isset($ttsFile['path'])) {
                        $fullPath = $this->ttsService->getAudioPath($ttsFile['path']);
                        if ($fullPath && file_exists($fullPath)) {
                            $dictEntry->incrementQueryCount();

                            // Update has_audio flag if needed
                            if (!$dictEntry->has_audio) {
                                $dictEntry->has_audio = true;
                                $dictEntry->save();
                            }

                            return [
                                'exists' => true,
                                'audio_path' => $ttsFile['path'],
                                'audio_url' => '/api/app_qy_v1/ai_tools/tts/audio/' . $ttsFile['path'],
                                'provider' => $dictEntry->tts_provider,
                            ];
                        }
                    }
                }
            }
        }

        // Check completed queue tasks
        $completedTask = AppQyV1TTSQueueModel::where('task_type', $type)
            ->where('content_hash', $contentHash)
            ->where('language', $language)
            ->where('status', self::STATUS_COMPLETED)
            ->first();

        if ($completedTask) {
            if ($type === self::TYPE_ARTICLE && !empty($completedTask->audio_files)) {
                // For articles, return sentence mapping
                return [
                    'exists' => true,
                    'audio_files' => $completedTask->audio_files,
                    'sentence_mapping' => $this->extractSentenceMapping($completedTask),
                ];
            } elseif ($completedTask->audio_path) {
                return [
                    'exists' => true,
                    'audio_path' => $completedTask->audio_path,
                    'audio_url' => "/api/app_qy_v1/ai_tools/tts/audio/{$language}/{$type}/{$completedTask->audio_path}",
                ];
            }
        }

        return null;
    }

    /**
     * Extract sentence MD5 mapping from article task
     */
    private function extractSentenceMapping($task): array
    {
        $mapping = [];

        if (!empty($task->audio_files)) {
            foreach ($task->audio_files as $index => $audioFile) {
                if (isset($audioFile['sentence']) && isset($audioFile['path'])) {
                    $sentenceMd5 = md5($audioFile['sentence']);
                    $mapping[] = [
                        'sentence_index' => $index,
                        'sentence_text' => $audioFile['sentence'],
                        'sentence_md5' => $sentenceMd5,
                        'audio_path' => $audioFile['path'],
                        'audio_url' => "/api/app_qy_v1/ai_tools/tts/audio/{$task->language}/sentence/{$audioFile['path']}",
                    ];
                }
            }
        }

        return $mapping;
    }

    /**
     * Process queue items (called by timer task)
     *
     * @param int|null $batchSize Number of items to process (null = use intelligent batch size)
     * @return array Processing results
     */
    public function processQueue(?int $batchSize = null): array
    {
        // Pre-process: deduplicate queue before processing
        $this->deduplicateQueue();

        // Use intelligent batch size if not specified
        if ($batchSize === null || $batchSize === 0) {
            $batchSize = $this->getIntelligentBatchSize();
        }

        // Always process from beginning of queue (earliest created_at = first in queue)
        $items = AppQyV1TTSQueueModel::where('status', self::STATUS_PENDING)
            ->orderBy('created_at', 'asc')
            ->orderBy('id', 'asc')
            ->limit($batchSize)
            ->get();

        $processed = 0;
        $succeeded = 0;
        $failed = 0;

        foreach ($items as $item) {
            $item->status = self::STATUS_PROCESSING;
            $item->started_at = now();
            $item->save();

            $startTime = microtime(true);

            try {
                $result = $this->processTask($item);

                if ($result['success']) {
                    // Double-check: Verify audio file exists and is not zero-byte
                    $audioPath = $result['audio_path'] ?? null;
                    $audioFiles = $result['audio_files'] ?? null;
                    
                    if ($audioPath) {
                        $fullPath = $this->ttsService->getAudioPath($audioPath);
                        if (!$fullPath || !file_exists($fullPath)) {
                            $errorMsg = 'Audio file not found after generation';
                            Log::error('[UnifiedTTSQueue] Audio file not found after generation', [
                                'task_id' => $item->id,
                                'audio_path' => $audioPath,
                            ]);
                            // Mark as failed instead of throwing exception
                            $item->status = self::STATUS_FAILED;
                            $item->error_message = $errorMsg;
                            $item->save();
                            $this->handleProcessingError($errorMsg);
                            continue;
                        }
                        
                        $fileSize = filesize($fullPath);
                        if ($fileSize === 0) {
                            @unlink($fullPath);
                            $errorMsg = 'Generated audio file is 0 bytes';
                            Log::error('[UnifiedTTSQueue] Zero-byte audio file detected and deleted', [
                                'task_id' => $item->id,
                                'audio_path' => $audioPath,
                            ]);
                            // Mark as failed instead of throwing exception
                            $item->status = self::STATUS_FAILED;
                            $item->error_message = $errorMsg;
                            $item->save();
                            $this->handleProcessingError($errorMsg);
                            continue;
                        }
                    } elseif ($audioFiles && is_array($audioFiles)) {
                        // For article tasks, verify all audio files
                        foreach ($audioFiles as $audioFile) {
                            if (isset($audioFile['path'])) {
                                $fullPath = $this->ttsService->getAudioPath($audioFile['path']);
                                if ($fullPath && file_exists($fullPath)) {
                                    $fileSize = filesize($fullPath);
                                    if ($fileSize === 0) {
                                        @unlink($fullPath);
                                        $errorMsg = 'One or more audio files in article are 0 bytes';
                                        Log::error('[UnifiedTTSQueue] Zero-byte audio file detected in article task', [
                                            'task_id' => $item->id,
                                            'audio_path' => $audioFile['path'],
                                        ]);
                                        // Mark as failed instead of throwing exception
                                        $item->status = self::STATUS_FAILED;
                                        $item->error_message = $errorMsg;
                                        $item->save();
                                        $this->handleProcessingError($errorMsg);
                                        continue 2; // Continue outer loop
                                    }
                                }
                            }
                        }
                    }
                    
                    $item->status = self::STATUS_COMPLETED;
                    $item->completed_at = now();
                    $item->error_message = null; // Clear error on success
                    $item->retry_count = 0; // Reset retry count

                    if ($item->task_type === self::TYPE_ARTICLE && isset($result['audio_files'])) {
                        $item->audio_files = $result['audio_files'];
                    } elseif (isset($result['audio_path'])) {
                        $item->audio_path = $result['audio_path'];
                    }

                    $item->save();
                    $succeeded++;

                    // Record processing time metrics
                    $processingTimeMs = (microtime(true) - $startTime) * 1000;
                    AppQyV1TTSQueueMetrics::recordProcessingTime($item->task_type, $processingTimeMs);

                    // Update dictionary has_audio flag for words
                    if ($item->task_type === self::TYPE_WORD) {
                        $this->updateDictionaryHasAudio($item->language, $item->content_hash, true);
                    }

                    // Handle success: reset error counter and restore normal interval
                    $this->handleProcessingSuccess();

                    Log::info('[UnifiedTTSQueue] Task completed', [
                        'task_id' => $item->id,
                        'type' => $item->task_type,
                        'language' => $item->language,
                        'processing_time_ms' => round($processingTimeMs, 2),
                    ]);
                } else {
                    $errorMsg = $result['error'] ?? 'Unknown error';

                    // Handle error: increment error counter and extend interval if needed
                    $this->handleProcessingError($errorMsg);

                    if ($item->retry_count < AppQyV1TTSQueueModel::MAX_RETRIES) {
                        $item->status = self::STATUS_PENDING;
                        $item->retry_count++;
                        $item->error_message = $errorMsg;
                        $item->save();

                        Log::warning('[UnifiedTTSQueue] Task failed, will retry', [
                            'task_id' => $item->id,
                            'type' => $item->task_type,
                            'retry_count' => $item->retry_count,
                            'error' => $errorMsg,
                        ]);
                    } else {
                        $item->status = self::STATUS_FAILED;
                        $item->error_message = $errorMsg;
                        $item->save();
                        $failed++;

                        Log::error('[UnifiedTTSQueue] Task permanently failed', [
                            'task_id' => $item->id,
                            'type' => $item->task_type,
                            'error' => $errorMsg,
                        ]);
                    }
                }

                $processed++;

                // Use dynamic interval between tasks (2 seconds normal, 5 seconds if frequent errors)
                $interval = $this->getProcessingInterval();
                usleep($interval);

            } catch (\Throwable $e) {
                $errorMsg = $e->getMessage();

                // Handle error: increment error counter and extend interval if needed
                $this->handleProcessingError($errorMsg);

                if ($item->retry_count < AppQyV1TTSQueueModel::MAX_RETRIES) {
                    $item->status = self::STATUS_PENDING;
                    $item->retry_count++;
                    $item->error_message = $errorMsg;
                    $item->save();
                } else {
                    $item->status = self::STATUS_FAILED;
                    $item->error_message = $errorMsg;
                    $item->save();
                    $failed++;
                }

                Log::error('[UnifiedTTSQueue] Exception during task processing', [
                    'task_id' => $item->id,
                    'type' => $item->task_type,
                    'error' => $errorMsg,
                    'trace' => $e->getTraceAsString(),
                ]);

                $processed++;
            }
        }

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
     * Process a single task
     */
    private function processTask($task): array
    {
        switch ($task->task_type) {
            case self::TYPE_WORD:
                return $this->processWordTask($task);

            case self::TYPE_SENTENCE:
                return $this->processSentenceTask($task);

            case self::TYPE_ARTICLE:
                return $this->processArticleTask($task);

            default:
                return [
                    'success' => false,
                    'error' => 'Unknown task type: ' . $task->task_type,
                ];
        }
    }

    /**
     * Process word TTS generation
     */
    private function processWordTask($task): array
    {
        $result = $this->ttsService->generateAudio(
            $task->content_text,
            $task->language,
            'word'
        );

        return $result;
    }

    /**
     * Process sentence TTS generation
     */
    private function processSentenceTask($task): array
    {
        $result = $this->ttsService->generateAudio(
            $task->content_text,
            $task->language,
            'sentence'
        );

        return $result;
    }

    /**
     * Process article TTS generation (split into sentences)
     */
    private function processArticleTask($task): array
    {
        // Split article into sentences
        $sentences = $this->splitIntoSentences($task->content_text);

        if (empty($sentences)) {
            return [
                'success' => false,
                'error' => 'No sentences found in article',
            ];
        }

        $audioFiles = [];
        $failed = false;

        foreach ($sentences as $index => $sentence) {
            $sentence = trim($sentence);
            if (empty($sentence)) {
                continue;
            }

            $result = $this->ttsService->generateAudio(
                $sentence,
                $task->language,
                'sentence'
            );

            if ($result['success']) {
                $audioFiles[] = [
                    'sentence' => $sentence,
                    'path' => $result['audio_path'] ?? null,
                    'created_at' => now()->toDateTimeString(),
                ];
            } else {
                $failed = true;
                Log::error('[UnifiedTTSQueue] Failed to generate audio for sentence', [
                    'task_id' => $task->id,
                    'sentence' => $sentence,
                    'error' => $result['error'] ?? 'Unknown error',
                ]);
                break;
            }

            usleep(100000); // 100ms delay between sentences
        }

        if ($failed) {
            return [
                'success' => false,
                'error' => 'Failed to generate audio for some sentences',
            ];
        }

        return [
            'success' => true,
            'audio_files' => $audioFiles,
        ];
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
     * Update dictionary has_audio flag
     */
    private function updateDictionaryHasAudio(string $language, string $contentHash, bool $hasAudio): void
    {
        try {
            $dictEntry = AppQyV1LangDictionaryModel::findByMd5($language, $contentHash);
            if ($dictEntry && $dictEntry->has_audio !== $hasAudio) {
                $dictEntry->has_audio = $hasAudio;
                $dictEntry->save();
            }
        } catch (\Throwable $e) {
            Log::warning('[UnifiedTTSQueue] Failed to update dictionary has_audio flag', [
                'language' => $language,
                'hash' => $contentHash,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Clean old completed items
     */
    public function cleanQueue(int $days = 7): int
    {
        return AppQyV1TTSQueueModel::where('status', self::STATUS_COMPLETED)
            ->where('completed_at', '<', now()->subDays($days))
            ->delete();
    }

    /**
     * Clear queue cache
     */
    private function clearQueueCache(): void
    {
        Cache::forget('tts_queue_statistics');
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
     * Deduplicate queue - remove duplicate pending tasks
     * Keep the OLDEST task (lowest ID) for each unique combination
     *
     * Uses cache to prevent running too frequently (max once per minute)
     *
     * @param bool $force Force deduplication even if recently run
     * @return array
     */
    public function deduplicateQueue(bool $force = false): array
    {
        // Check if deduplication was recently run (within 60 seconds)
        $cacheKey = 'tts_queue_last_dedup';
        $lastRun = Cache::get($cacheKey);

        if (!$force && $lastRun && now()->diffInSeconds($lastRun) < 60) {
            return [
                'success' => true,
                'duplicates_found' => 0,
                'deleted' => 0,
                'skipped' => true,
                'reason' => 'Recently deduplicated',
            ];
        }

        // Find duplicates using Laravel query builder
        $duplicates = AppQyV1TTSQueueModel::whereIn('status', ['pending', 'processing', 'failed'])
            ->select('content_hash', 'language', 'task_type')
            ->selectRaw('COUNT(*) as count')
            ->groupBy('content_hash', 'language', 'task_type')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicates->isEmpty()) {
            Cache::put($cacheKey, now(), 120); // Cache for 2 minutes
            return [
                'success' => true,
                'duplicates_found' => 0,
                'deleted' => 0,
            ];
        }

        $totalDeleted = 0;

        foreach ($duplicates as $dup) {
            // Get all tasks with this combination
            $tasks = AppQyV1TTSQueueModel::where('content_hash', $dup->content_hash)
                ->where('language', $dup->language)
                ->where('task_type', $dup->task_type)
                ->whereIn('status', ['pending', 'processing', 'failed'])
                ->orderBy('id', 'asc')
                ->get();

            // Keep the first (oldest), delete the rest
            $first = true;
            foreach ($tasks as $task) {
                if ($first) {
                    $first = false;
                    continue;
                }
                $task->delete();
                $totalDeleted++;
            }
        }

        $this->clearQueueCache();
        Cache::put($cacheKey, now(), 120); // Cache for 2 minutes

        Log::info('[UnifiedTTSQueue] Deduplicated queue', [
            'duplicates_found' => $duplicates->count(),
            'deleted' => $totalDeleted,
        ]);

        return [
            'success' => true,
            'duplicates_found' => $duplicates->count(),
            'deleted' => $totalDeleted,
        ];
    }

    /**
     * Get recent task logs (recent 100 tasks with details)
     *
     * @param int $limit Number of logs to retrieve (default: 100)
     * @return array
     */
    public function getRecentLogs(int $limit = 100): array
    {
        $tasks = AppQyV1TTSQueueModel::orderBy('updated_at', 'desc')
            ->limit($limit)
            ->get()
            ->map(function ($task) {
                return [
                    'id' => $task->id,
                    'task_type' => $task->task_type,
                    'content_text' => mb_substr($task->content_text, 0, 50),
                    'language' => $task->language,
                    'status' => $task->status,
                    'priority' => $task->priority,
                    'retry_count' => $task->retry_count,
                    'error_message' => $task->error_message,
                    'audio_path' => $task->audio_path,
                    'requested_at' => $task->requested_at?->toIso8601String(),
                    'started_at' => $task->started_at?->toIso8601String(),
                    'completed_at' => $task->completed_at?->toIso8601String(),
                    'created_at' => $task->created_at?->toIso8601String(),
                    'updated_at' => $task->updated_at?->toIso8601String(),
                ];
            });

        return [
            'total' => $tasks->count(),
            'limit' => $limit,
            'logs' => $tasks->toArray(),
        ];
    }

    /**
     * Re-queue failed tasks to beginning of queue (highest priority)
     *
     * @return array
     */
    public function requeueFailedTasks(): array
    {
        $failedTasks = AppQyV1TTSQueueModel::where('status', self::STATUS_FAILED)->get();

        $requeued = 0;
        foreach ($failedTasks as $task) {
            $task->status = self::STATUS_PENDING;
            $task->priority = 100; // Highest priority
            $task->retry_count = 0;
            $task->error_message = null;
            $task->started_at = null;
            $task->save();
            $requeued++;
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
