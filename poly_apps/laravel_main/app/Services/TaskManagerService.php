<?php

namespace App\Services;

use App\Models\GlobalTask;
use App\Models\GlobalTaskEvent;
use App\Models\Worker;
use App\Support\QueueCenterContract;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Database\ConnectionInterface;
use App\Services\TaskProcessors\TaskProcessorRegistry;
use App\Services\TaskProcessors\DictionaryTaskProcessor;
use App\Services\TaskProcessors\WordTranslationTaskProcessor;
use App\Services\TaskProcessors\NotebookLmTaskProcessor;
use App\Services\TaskProcessors\WordGeminiImageTaskProcessor;
use App\Services\TaskProcessors\GeminiTextTaskProcessor;
use App\Services\TaskProcessors\SubtitleSearchTaskProcessor;
use App\Services\TaskProcessors\PosterTaskProcessor;
use App\Services\TaskProcessors\SentenceAudioTaskProcessor;
use App\Services\TaskProcessors\PromptTranslationTaskProcessor;
use App\Services\TaskProcessors\WordValidityTaskProcessor;
use App\Services\TaskProcessors\ArticleAudioTaskProcessor;

class TaskManagerService
{
    /**
     * Transaction attempts for the worker-API hot paths (pull / submit).
     *
     * N pycore workers + the internal AI filler + the Octane timers all hit
     * global_tasks concurrently. On the SQLite deployment that surfaces as
     * "database is locked" (single writer), on Postgres as serialization /
     * deadlock errors — both are transient concurrency errors that Laravel's
     * transaction() retries when given attempts > 1, instead of bubbling up as
     * an HTTP 500 that loses a worker's result POST.
     */
    private const TRANSACTION_ATTEMPTS = 3;

    /**
     * Short-TTL cache for the hot, unbounded status tally (getTaskStats). The
     * overview shell poll and /api/task/stats both hit it every ~5s; a 3s TTL
     * collapses that to at most one full-table GROUP BY per interval regardless
     * of how many pollers/tabs are open, which is load-bearing on the
     * single-worker php -S runtime.
     */
    private const STATS_CACHE_KEY = 'globaltasks:status_counts';
    private const STATS_CACHE_TTL_SECONDS = 3;
    // Use the FILE store, not the configured default: CACHE_STORE=database here
    // but no migration provisions the `cache` table, so the database store may
    // not exist. The file store is always available and persists across the
    // sequential php -S requests (unlike the per-bootstrap `array` store).
    private const STATS_CACHE_STORE = 'file';

    /**
     * Shared audio in-flight lock (contract item 5). A word+language pair is
     * claimed before BOTH the word_audio/remote_audio global-task write-back AND
     * the tts/worker/claim dictionary-column path, so Path A (global tasks) and
     * Path B (dictionary claim) cannot double-synthesize the same word. The lock
     * is a Cache atomic add; TTL bounds it so a crashed holder cannot wedge a
     * word forever.
     */
    public const AUDIO_LOCK_PREFIX = 'audio_inflight:';
    public const AUDIO_LOCK_TTL_SECONDS = 600;

    /**
     * Cache key for the audio in-flight lock of one (word, language) pair —
     * md5(word + '|' + language). BOTH audio paths must build the key the same
     * way, so this is the single source of truth for the key shape.
     */
    public static function audioLockKey(string $word, string $language): string
    {
        return self::AUDIO_LOCK_PREFIX . md5($word . '|' . $language);
    }

    /**
     * Try to claim the audio in-flight lock for (word, language). Returns true
     * when the caller now owns the lock (atomic add succeeded), false when
     * another path already holds it. Empty inputs never lock (return true; the
     * caller has nothing meaningful to guard).
     */
    public static function claimAudioLock(string $word, string $language): bool
    {
        if ($word === '' || $language === '') {
            return true;
        }
        // Cache::add is atomic add-if-absent across the configured store.
        return Cache::add(self::audioLockKey($word, $language), 1, self::AUDIO_LOCK_TTL_SECONDS);
    }

    /**
     * Release the audio in-flight lock for (word, language). Idempotent — a
     * missing key is a no-op. Called on report/store completion of either path.
     */
    public static function releaseAudioLock(string $word, string $language): void
    {
        if ($word === '' || $language === '') {
            return;
        }
        Cache::forget(self::audioLockKey($word, $language));
    }

    protected ?TaskProcessorRegistry $processorRegistry = null;

    protected function db(): ConnectionInterface
    {
        return app('db.connection');
    }

    /**
     * Get or create task processor registry
     */
    protected function getProcessorRegistry(): TaskProcessorRegistry
    {
        if ($this->processorRegistry === null) {
            $this->processorRegistry = new TaskProcessorRegistry();

            // Register all task processors here
            $this->processorRegistry->register(new DictionaryTaskProcessor($this));

            // Async word-translation pipeline write-back (word_translation tasks).
            $this->processorRegistry->register(new WordTranslationTaskProcessor($this));

            // Task Center v3 task types (chrome remote_client lane):
            //   - notebooklm   -> answer text record.
            //   - gemini_image -> alternative word/cover image generator.
            //   - gemini_chat  -> text-only Gemini completion, answer text record
            //                     (mirrors notebooklm, no dictionary-row attachment).
            $this->processorRegistry->register(new NotebookLmTaskProcessor($this));
            $this->processorRegistry->register(new WordGeminiImageTaskProcessor($this));
            $this->processorRegistry->register(new GeminiTextTaskProcessor($this));

            // Unified task system extension (dedicated execution lanes):
            //   - subtitle_search -> pycore validates subtitle hits (remote_subtitle).
            //   - poster          -> mcp-chrome search + MoviePosterStore writeback (remote_poster).
            //   - sentence_audio  -> pycore SentenceAudio writeback (remote_sentence_audio).
            $this->processorRegistry->register(new SubtitleSearchTaskProcessor($this));
            $this->processorRegistry->register(new PosterTaskProcessor($this));
            $this->processorRegistry->register(new SentenceAudioTaskProcessor($this));

            // Dev-history assist: non-English prompt -> English (3 variants + audio).
            $this->processorRegistry->register(new PromptTranslationTaskProcessor($this));

            // Batch invalid-word detection: a web LLM classifies untranslated +
            // unchecked words valid/invalid; this marks is_valid in bulk so the
            // translation enqueue skips the junk (remote_validity lane).
            $this->processorRegistry->register(new WordValidityTaskProcessor($this));
            $this->processorRegistry->register(new ArticleAudioTaskProcessor());

            // Future processors can be registered here:
            // $this->processorRegistry->register(new ImageTaskProcessor($this));
            // $this->processorRegistry->register(new VideoTaskProcessor($this));
        }

        return $this->processorRegistry;
    }

    /**
     * Create a new task
     */
    public function createTask(
        string $appName,
        string $taskType,
        string $executionType,
        array $payload = [],
        int $timeoutSeconds = 120,
        int $priority = 0,
        int $maxRetries = 3,
        bool $interactive = false,
        ?string $capability = null,
        array $linkAttributes = []
    ): GlobalTask {
        // config/queue_center_contract.json is the only task vocabulary source.
        // Callers may retain the executionType parameter for API compatibility,
        // but the persisted lane and fixed/selectable capability rules always
        // come from the central definition consumed by every runtime and UI.
        $taskDefinition = QueueCenterContract::taskTypeDefinition($taskType);
        if ($taskDefinition === null) {
            throw new \InvalidArgumentException("Unknown global-task type: {$taskType}");
        }

        $executionType = (string) $taskDefinition['execution_type'];
        $fixedCapability = $taskDefinition['capability'] ?? null;
        $selectableCapabilities = array_values($taskDefinition['capabilities'] ?? []);
        if (($taskDefinition['capability_mode'] ?? 'fixed') === 'selectable') {
            if ($capability !== null && !in_array($capability, $selectableCapabilities, true)) {
                throw new \InvalidArgumentException("Capability {$capability} is not valid for {$taskType}");
            }
        } else {
            $capability = is_string($fixedCapability) && $fixedCapability !== ''
                ? $fixedCapability
                : null;
        }
        if ($capability !== null && !in_array($capability, QueueCenterContract::taskCapabilities(), true)) {
            throw new \InvalidArgumentException("Unknown global-task capability: {$capability}");
        }

        // Eligible interactive requests jump onto the shared fast lane at the
        // FAST priority tier. Dedicated-lane tasks retain their execution type;
        // otherwise no matching worker could claim them.
        $interactive = $interactive
            && in_array($taskType, QueueCenterContract::fastPromotableTaskTypes(), true);
        if ($interactive) {
            if ($capability === null && is_string($fixedCapability) && $fixedCapability !== '') {
                $capability = $fixedCapability;
            }
            $executionType = GlobalTask::executionType('remote_fast');
            $priority = max($priority, GlobalTask::priority('fast'));
        }

        // Phase 5 substrate link fields (dict_row_id / dict_language /
        // dict_row_table / group_key) ride through here on the dual-write path;
        // whitelist them so an arbitrary caller cannot mass-assign other columns.
        $allowedLink = array_intersect_key(
            $linkAttributes,
            array_flip(['dict_row_id', 'dict_language', 'dict_row_table', 'group_key'])
        );

        $task = GlobalTask::create(array_merge([
            'task_id' => 'task_' . Str::uuid(),
            'app_name' => $appName,
            'task_type' => $taskType,
            'execution_type' => $executionType,
            'status' => GlobalTask::status('pending'),
            'payload' => $payload,
            'timeout_seconds' => $timeoutSeconds,
            'priority' => $priority,
            'max_retries' => $maxRetries,
            'progress' => 0,
            'retry_count' => 0,
            'capability' => $capability,
            'is_fast_tier' => $interactive,
        ], $allowedLink));

        Log::info('Task created', [
            'task_id' => $task->task_id,
            'app_name' => $appName,
            'task_type' => $taskType,
            'execution_type' => $executionType,
            'capability' => $capability,
            'is_fast_tier' => $interactive,
            'priority' => $task->priority,
        ]);

        return $task;
    }

    // NOTE: the old non-atomic pullTasksForWorker() was removed — it pulled
    // without assigning (two workers could grab the same task) and had no
    // callers. pullAndAssignTasksForWorker() below is the only pull path.

    /**
     * Pull and assign tasks for a worker (atomic operation)
     * This avoids race condition between pull and accept
     *
     * @param string $workerId Worker ID
     * @param int $limit Maximum number of tasks to return
     * @return array Array of assigned tasks
     */
    public function pullAndAssignTasksForWorker(string $workerId, int $limit): array
    {
        // Use single transaction for all operations. LOCK ORDER: worker row
        // first, then task rows — submitResult() acquires its locks in the SAME
        // order, so a concurrent pull and result-submit for one worker serialize
        // instead of deadlocking (opposite orders deadlock on Postgres).
        $assignedTasks = $this->db()->transaction(function () use ($workerId, $limit) {
            // Lock worker for update
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                throw new \Exception("Worker not found: $workerId");
            }

            Log::info('[pullAndAssignTasksForWorker] Worker locked', [
                'worker_id' => $workerId,
                'processor_types' => $worker->processor_types,
                'status' => $worker->status,
            ]);

            $assignedTasks = [];

            foreach ($worker->processor_types as $processorType) {
                if (count($assignedTasks) >= $limit) {
                    break;
                }

                // The shared fast lane (remote_fast) is claimed ONLY through the
                // capability-matched block below. Claiming it here would bypass
                // the capability filter and let e.g. a chrome worker grab a
                // bumped word_audio/audio task, adding fail-repend latency to
                // exactly the hottest tasks.
                if ($processorType === GlobalTask::executionType('remote_fast')) {
                    continue;
                }

                Log::info('[pullAndAssignTasksForWorker] Checking processor type', [
                    'processor_type' => $processorType,
                ]);

                $availableTasks = GlobalTask::pending()
                    ->where('execution_type', $processorType)
                    ->orderBy('priority', 'desc')
                    ->orderBy('created_at', 'asc')
                    ->limit($limit - count($assignedTasks))
                    ->lockForUpdate()
                    ->get();

                Log::info('[pullAndAssignTasksForWorker] Found tasks for processor type', [
                    'processor_type' => $processorType,
                    'task_count' => $availableTasks->count(),
                ]);

                foreach ($availableTasks as $task) {
                    $task->assignTo($workerId, $task->timeout_seconds);
                    $worker->assignTask($task->task_id);
                    $assignedTasks[] = $task;

                    GlobalTaskEvent::record($task->task_id, GlobalTaskEvent::event('assigned'), $workerId, (int) $task->retry_count, [
                        'worker_id' => $workerId,
                        'execution_type' => $task->execution_type,
                        'reason' => 'pull',
                    ]);

                    Log::info('[pullAndAssignTasksForWorker] Task assigned', [
                        'task_id' => $task->task_id,
                        'execution_type' => $task->execution_type,
                    ]);

                    if (count($assignedTasks) >= $limit) {
                        break 2;
                    }
                }
            }

            // --- Shared fast lane (remote_fast) ---
            // After the per-processor_type lanes, if this worker subscribes to the
            // shared fast lane and still has capacity, claim capability-matched
            // fast tasks. The existing assignTo() atomic claim (inside this same
            // lockForUpdate transaction) guarantees first-idle-wins / runs-exactly-
            // once across the two heterogeneous clients sharing the lane. Capability
            // is filtered in PHP after the lock so it behaves identically on
            // pgsql/sqlite (no JSON_CONTAINS in the WHERE clause). We over-fetch a
            // little because some locked candidates may be filtered out by capability.
            if (count($assignedTasks) < $limit
                && in_array(GlobalTask::executionType('remote_fast'), $worker->processor_types, true)) {

                $workerCaps = $worker->capabilityList();
                $need = $limit - count($assignedTasks);
                $fetch = min(32, $need + 8);

                $fastCandidates = GlobalTask::pending()
                    ->where('execution_type', GlobalTask::executionType('remote_fast'))
                    ->orderBy('priority', 'desc')
                    ->orderBy('created_at', 'asc')
                    ->limit($fetch)
                    ->lockForUpdate()
                    ->get();

                // Observability: the over-fetch is capped at 32, so when the
                // candidate set hits that cap there may be more claimable fast
                // tasks we silently truncated this round. Log it so a persistent
                // fast-lane backlog is visible (no behavior change).
                if ($fastCandidates->count() === 32) {
                    Log::info('[pullAndAssignTasksForWorker] Fast candidate fetch hit cap', [
                        'worker_id' => $workerId,
                        'need' => $need,
                        'fetch' => $fetch,
                        'candidate_count' => $fastCandidates->count(),
                    ]);
                }

                // Observability: if the highest-priority fast task requires a
                // capability that NO currently-online worker advertises, it can
                // never be claimed and will sit at the head of the lane forever.
                // Surface that stuck head-of-line task once (no behavior change —
                // the claim loop below is unaffected).
                $topFast = $fastCandidates->first();
                if ($topFast !== null
                    && $topFast->capability !== null
                    && $topFast->capability !== '') {
                    $onlineCaps = [];
                    foreach (Worker::online()->get() as $onlineWorker) {
                        if (!$onlineWorker->canProcess(GlobalTask::executionType('remote_fast'))) {
                            continue;
                        }
                        foreach ($onlineWorker->capabilityList() as $cap) {
                            $onlineCaps[$cap] = true;
                        }
                    }
                    if (!isset($onlineCaps[$topFast->capability])) {
                        Log::warning('[fast-lane] unclaimable TOP task: no eligible worker', [
                            'task_id' => $topFast->task_id,
                            'capability' => $topFast->capability,
                        ]);
                    }
                }

                foreach ($fastCandidates as $task) {
                    if (count($assignedTasks) >= $limit) {
                        break;
                    }
                    // Skip fast tasks this client's capabilities cannot serve so
                    // the other client (or a later poll) can claim them.
                    if (!$task->capabilityMatches($workerCaps)) {
                        continue;
                    }

                    $task->assignTo($workerId, $task->timeout_seconds);
                    $worker->assignTask($task->task_id);
                    $assignedTasks[] = $task;

                    GlobalTaskEvent::record($task->task_id, GlobalTaskEvent::event('assigned'), $workerId, (int) $task->retry_count, [
                        'worker_id' => $workerId,
                        'execution_type' => $task->execution_type,
                        'capability' => $task->capability,
                        'reason' => 'pull_fast',
                    ]);

                    Log::info('[pullAndAssignTasksForWorker] Fast task assigned', [
                        'task_id' => $task->task_id,
                        'capability' => $task->capability,
                        'priority' => $task->priority,
                    ]);
                }
            }

            return $assignedTasks;
        }, self::TRANSACTION_ATTEMPTS);

        Log::info('[pullAndAssignTasksForWorker] Transaction completed', [
            'worker_id' => $workerId,
            'assigned_count' => count($assignedTasks),
        ]);

        return $assignedTasks;
    }

    /**
     * Long-poll wait threshold (seconds) and granularity (microseconds) used by
     * the pull endpoint when the queue is momentarily empty. The worker channel
     * is documented as long-poll; rather than return an empty 200 immediately
     * (forcing a tight reconnect loop), pull waits up to the central
     * `long_poll_seconds` limit
     * for a task to appear, re-checking every POLL_INTERVAL_US. The first
     * iteration always runs, so a non-empty queue returns instantly.
     */
    private const POLL_INTERVAL_US = 500000; // 0.5s

    /**
     * Long-poll variant of the pull: assign tasks immediately if any exist,
     * otherwise wait (cheap COUNT polling, not a held DB lock) up to
     * the central long-poll limit for work to arrive, then assign and return. Returns
     * promptly the instant a (high-priority) task is created.
     *
     * @return array Array of assigned tasks (possibly empty after the wait).
     */
    public function pullAndAssignTasksLongPoll(string $workerId, int $limit, ?int $maxWaitSeconds = null): array
    {
        $deadline = microtime(true) + ($maxWaitSeconds ?? QueueCenterContract::taskLimit('long_poll_seconds'));

        // Resolve the worker's processor types once for the cheap availability
        // probe between assignment attempts.
        $worker = Worker::where('worker_id', $workerId)->first(['processor_types']);
        $processorTypes = ($worker && is_array($worker->processor_types)) ? $worker->processor_types : [];

        do {
            $tasks = $this->pullAndAssignTasksForWorker($workerId, $limit);
            if (!empty($tasks)) {
                return $tasks;
            }

            // No work: stop waiting once the deadline passes or the worker has no
            // processor types (nothing could ever match).
            if (empty($processorTypes) || microtime(true) >= $deadline) {
                return [];
            }

            // Cheap unlocked existence probe; sleep before the next assign attempt.
            usleep(self::POLL_INTERVAL_US);

            $hasPending = GlobalTask::pending()
                ->whereIn('execution_type', $processorTypes)
                ->exists();
            if (!$hasPending) {
                continue;
            }
            // A task appeared — loop straight back to the atomic assign.
        } while (microtime(true) < $deadline);

        // Final assign attempt right at the deadline (a task may have appeared in
        // the last interval).
        return $this->pullAndAssignTasksForWorker($workerId, $limit);
    }

    /**
     * Count PENDING tasks with priority >= $minPriority for the given processor
     * types — the "urgent backlog" signal surfaced as `pending_urgent` in the
     * pull and heartbeat responses so a worker knows to poll faster. A resolve /
     * library-words query bumps missing-media tasks to the central fast priority, so this
     * count > 0 means user-visible work is waiting.
     *
     * @param array<int,string> $processorTypes
     */
    public function countUrgentPending(array $processorTypes, ?int $minPriority = null): int
    {
        $minPriority = $minPriority ?? QueueCenterContract::taskPriority('fast');
        $processorTypes = array_values(array_filter($processorTypes, 'is_string'));
        if (empty($processorTypes)) {
            return 0;
        }

        return (int) GlobalTask::pending()
            ->whereIn('execution_type', $processorTypes)
            ->where('priority', '>=', $minPriority)
            ->count();
    }

    /**
     * Resolve a worker's processor types (empty array when unknown). Small read
     * helper for the controller's pending_urgent computation.
     *
     * @return array<int,string>
     */
    public function workerProcessorTypes(string $workerId): array
    {
        $worker = Worker::where('worker_id', $workerId)->first(['processor_types']);
        if (!$worker || !is_array($worker->processor_types)) {
            return [];
        }
        return array_values(array_filter($worker->processor_types, 'is_string'));
    }

    /**
     * Resolve a worker's advertised capability tags (empty when unknown / none).
     * Companion to workerProcessorTypes() for the pending_fast computation.
     *
     * @return array<int,string>
     */
    public function workerCapabilities(string $workerId): array
    {
        $worker = Worker::where('worker_id', $workerId)->first(['capabilities']);
        return $worker ? $worker->capabilityList() : [];
    }

    /**
     * Count PENDING fast-lane tasks (remote_fast) a worker advertising
     * $capabilities is eligible to claim — surfaced as `pending_fast` in
     * pull/heartbeat so a worker reacts immediately (re-poll with wait=0)
     * instead of waiting out its normal interval. Returns 0 unless the worker
     * actually subscribes to the shared fast lane. No priority floor is applied:
     * the pull fast-claim block has none either, so any remote_fast task the
     * pull WILL claim is counted (otherwise sub-100 fast tasks under-report).
     *
     * @param array<int,string> $processorTypes
     * @param array<int,string> $capabilities
     */
    public function countFastPending(array $processorTypes, array $capabilities): int
    {
        if (!in_array(GlobalTask::executionType('remote_fast'), $processorTypes, true)) {
            return 0;
        }

        $capabilities = array_values(array_filter($capabilities, 'is_string'));

        return (int) GlobalTask::pending()
            ->where('execution_type', GlobalTask::executionType('remote_fast'))
            ->where(function ($q) use ($capabilities) {
                // NULL capability = any worker eligible; otherwise the worker must
                // advertise the tag. whereIn on a string column is cross-DB safe.
                $q->whereNull('capability');
                if (!empty($capabilities)) {
                    $q->orWhereIn('capability', $capabilities);
                }
            })
            ->count();
    }

    /**
     * Bump a task's priority to the front ("jump to task-top"). The single
     * control-plane action behind POST /api/task/{id}/bump.
     *
     * Only a still-PENDING task can be reordered: once assigned/processing there
     * is no pre-emption, and terminal tasks are immutable. Idempotent — a task
     * already at or above $newPriority is left unchanged. priority is raised to
     * max(current, new) so a bump never lowers an already-urgent task.
     *
     * @return string One of 'bumped', 'not_found', 'not_pending'
     */
    public function bumpTaskPriority(string $taskId, ?int $newPriority = null): string
    {
        $newPriority = $newPriority ?? GlobalTask::priority('fast');
        return $this->db()->transaction(function () use ($taskId, $newPriority) {
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                return 'not_found';
            }

            if ($task->status !== GlobalTask::status('pending')) {
                return 'not_pending';
            }

            $target = max((int) $task->priority, $newPriority);
            // "Task-top" is the shared FAST LANE, not merely a higher number: a
            // A still-pending, fast-capable task bumped to the FAST tier is also
            // moved onto remote_fast. Dedicated-lane task types only receive the
            // numeric priority increase and remain claimable by their worker.
            $promoteToFast = $target >= GlobalTask::priority('fast')
                && $task->execution_type !== GlobalTask::executionType('remote_fast')
                && in_array($task->task_type, QueueCenterContract::fastPromotableTaskTypes(), true);

            if ($target !== (int) $task->priority || $promoteToFast) {
                $task->priority = $target;
                if ($promoteToFast) {
                    $task->execution_type = GlobalTask::executionType('remote_fast');
                    $task->is_fast_tier = true;
                }
                $task->save();

                Log::info('Task priority bumped', [
                    'task_id' => $taskId,
                    'priority' => $target,
                    'execution_type' => $task->execution_type,
                    'is_fast_tier' => $task->is_fast_tier,
                ]);
            }

            return 'bumped';
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Assign a task to a worker
     *
     * @param string $taskId Task ID
     * @param string $workerId Worker ID
     * @return bool Success
     */
    public function assignTask(string $taskId, string $workerId): bool
    {
        $taskData = null;

        $success = $this->db()->transaction(function () use ($taskId, $workerId, &$taskData) {
            // LOCK ORDER: worker first, then task (same as pull/submit) so
            // concurrent assign/pull/submit cannot deadlock on opposite orders.
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                throw new \Exception("Worker not found: $workerId");
            }

            // Lock and reload task
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                throw new \Exception("Task not found: $taskId");
            }

            // Check if task is already assigned
            if ($task->status !== GlobalTask::status('pending')) {
                Log::warning('Task already assigned or not pending', [
                    'task_id' => $taskId,
                    'status' => $task->status,
                    'assigned_to' => $task->assigned_to,
                ]);
                return false;
            }

            // Assign task
            $task->assignTo($workerId, $task->timeout_seconds);
            $worker->assignTask($taskId);

            GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('assigned'), $workerId, (int) $task->retry_count, [
                'worker_id' => $workerId,
                'execution_type' => $task->execution_type,
                'reason' => 'assign',
            ]);

            Log::info('Task assigned', [
                'task_id' => $taskId,
                'worker_id' => $workerId,
                'timeout_at' => $task->timeout_at,
            ]);

            $taskData = [
                'worker_id' => $workerId,
                'task_id' => $task->task_id,
                'task_type' => $task->task_type,
                'payload' => $task->payload,
                'timeout_seconds' => $task->timeout_seconds,
                'priority' => $task->priority,
            ];

            return true;
        }, self::TRANSACTION_ATTEMPTS);

        return $success;
    }

    /**
     * Accept (acknowledge) a task for a worker.
     *
     * The documented worker contract includes a pull -> accept -> result flow,
     * and remote clients (e.g. the browser dictionary worker) call accept for
     * every task — but pull already assigns atomically, so accept is an
     * IDEMPOTENT ACKNOWLEDGMENT: confirming a task the caller already owns
     * succeeds; a still-pending task is claimed atomically (legacy flow); a
     * task owned by another worker is a conflict.
     *
     * @return string One of 'accepted', 'not_found', 'conflict'
     */
    public function acceptTask(string $taskId, string $workerId): string
    {
        return $this->db()->transaction(function () use ($taskId, $workerId) {
            // Same lock order as pull/assign/submit: worker first, then task.
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            if (!$worker) {
                return 'not_found';
            }

            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                return 'not_found';
            }

            // Already ours (the normal case after an atomic pull) — idempotent.
            if ($task->assigned_to === $workerId
                && in_array($task->status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)) {
                return 'accepted';
            }

            // Legacy pull-without-assign flow: claim a still-pending task now.
            if ($task->status === GlobalTask::status('pending')) {
                $task->assignTo($workerId, $task->timeout_seconds);
                $worker->assignTask($taskId);
                GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('assigned'), $workerId, (int) $task->retry_count, [
                    'worker_id' => $workerId,
                    'execution_type' => $task->execution_type,
                    'reason' => 'accept',
                ]);
                return 'accepted';
            }

            // Owned by another worker / already terminal.
            return 'conflict';
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Cancel a task (admin / control-plane action).
     *
     * Pending tasks cancel directly; assigned/processing tasks are revoked
     * from their worker (the worker's in-flight result will be rejected by the
     * submitResult ownership check and dropped). Terminal tasks are left
     * untouched.
     *
     * @return string One of 'cancelled', 'not_found', 'not_cancellable'
     */
    public function cancelTask(string $taskId): string
    {
        return $this->db()->transaction(function () use ($taskId) {
            // Lock-order exception: cancel must read the task to learn its
            // worker, so it locks task -> worker (opposite of pull/submit).
            // It is a rare admin action; a deadlock with a concurrent pull is
            // detected by the DB and absorbed by the attempts=3 retry.
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                return 'not_found';
            }

            $cancellable = [
                GlobalTask::status('pending'),
                GlobalTask::status('assigned'),
                GlobalTask::status('processing'),
            ];
            if (!in_array($task->status, $cancellable, true)) {
                return 'not_cancellable';
            }

            $workerId = $task->assigned_to;
            $task->status = GlobalTask::status('cancelled');
            $task->assigned_to = null;
            $task->assigned_at = null;
            $task->timeout_at = null;
            $task->completed_at = now();
            $task->save();

            if ($workerId) {
                $worker = Worker::where('worker_id', $workerId)
                    ->lockForUpdate()
                    ->first();
                if ($worker && $worker->current_task_id === $taskId) {
                    $worker->releaseTask();
                }
            }

            GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('cancelled'), $workerId, (int) $task->retry_count, [
                'worker_id' => $workerId,
                'execution_type' => $task->execution_type,
                'reason' => 'cancelled by control plane',
            ]);

            Log::info('Task cancelled', [
                'task_id' => $taskId,
                'revoked_from' => $workerId,
            ]);

            return 'cancelled';
        }, self::TRANSACTION_ATTEMPTS);
    }

    /**
     * Submit task result from worker
     *
     * @param string $taskId Task ID
     * @param string $workerId Worker ID
     * @param string $status Status (processing, completed, failed)
     * @param float $progress Progress percentage
     * @param array|null $result Result data
     * @param string|null $error Error message
     * @param array|null $outcome OUT: result-trust summary
     *        ['status' => final task status string, 'stored_count' => int,
     *         'failed_count' => int]. Lets the controller return
     *        {status, stored_count, failed_count} so a worker can tell a real
     *        completion from an empty/partial one. Untouched on the false return
     *        paths (unknown worker/task, ownership mismatch).
     * @return bool Success
     */
    public function submitResult(
        string $taskId,
        string $workerId,
        string $status,
        ?float $progress = null,
        ?array $result = null,
        ?string $error = null,
        ?array &$outcome = null
    ): bool {
        // Default outcome surfaced even on the early-false paths the controller
        // maps to 409, so the response shape is always consistent.
        $outcome = ['status' => $status, 'stored_count' => 0, 'failed_count' => 0];

        $success = $this->db()->transaction(function () use ($taskId, $workerId, $status, $progress, $result, $error, &$outcome) {
            // LOCK ORDER: worker first, then task — the same order
            // pullAndAssignTasksForWorker uses. Locking task->worker here while a
            // concurrent pull locked worker->tasks was a classic lock-ordering
            // deadlock under multiple racing workers.
            $worker = Worker::where('worker_id', $workerId)
                ->lockForUpdate()
                ->first();

            // Unknown worker/task is a caller error, not a server fault: return
            // false (HTTP 409 at the controller) instead of throwing a 500 the
            // worker would pointlessly retry.
            if (!$worker) {
                Log::warning('Result submitted by unknown worker', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                ]);
                return false;
            }

            // Lock and reload task
            $task = GlobalTask::where('task_id', $taskId)
                ->lockForUpdate()
                ->first();

            if (!$task) {
                Log::warning('Result submitted for unknown task', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                ]);
                return false;
            }

            // Check if this worker is assigned to this task
            if ($task->assigned_to !== $workerId) {
                Log::warning('Worker not assigned to task or task was reassigned', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'assigned_to' => $task->assigned_to,
                ]);
                return false;
            }

            // Idempotent re-delivery guard: workers RETRY result POSTs on
            // transient errors, so a result whose first attempt committed but
            // whose response was lost arrives again. Acknowledge it as success
            // WITHOUT reprocessing — re-running the completed branch would run
            // the task processors (write-back) a second time and double-count
            // worker stats.
            $terminalStatuses = QueueCenterContract::taskStatuses('terminal');
            if (in_array($task->status, $terminalStatuses, true)) {
                $outcome['status'] = $task->status;
                Log::info('Result re-delivered for terminal task — acknowledged without reprocessing', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'task_status' => $task->status,
                    'reported_status' => $status,
                ]);
                return true;
            }

            // Update task based on status
            if ($status === GlobalTask::status('completed')) {
                // Check demo mode: priority to frontend-submitted flag
                $isDemoMode = $result['is_demo_mode'] ?? $task->payload['is_demo_mode'] ?? false;

                // --- RESULT TRUST (contract item 3) ---
                // Validate the result SHAPE for this execution_type BEFORE marking
                // the task completed. A "completed" status the worker SHAPE cannot
                // back (empty translations[], missing audio/image bytes) is not a
                // real success — it is downgraded to a failure so it is not
                // silently lost. Demo tasks skip the trust gate (they never write).
                $shapeError = $isDemoMode ? null : $this->validateResultShape($task, $result ?? []);

                if ($shapeError !== null) {
                    // Treat a shape-invalid "completed" exactly like a reported
                    // failure: consume a retry, surface the error, emit a 'failed'
                    // event. stored_count stays 0.
                    $this->failTaskInTransaction($task, $worker, $shapeError, $workerId, $outcome, 'invalid_shape');
                    return true;
                }

                // Use consistent completion method for both modes
                if ($isDemoMode) {
                    $task->status = GlobalTask::status('completed_demo');
                } else {
                    $task->status = GlobalTask::status('completed');
                }
                $task->progress = 100.0;
                $task->result = $result ?? [];
                $task->completed_at = now();
                $task->save();

                // Process task result within transaction and learn how many
                // canonical items it actually stored. null => no processor owns
                // this task type (control-plane / text-only task): trust the
                // worker's completed status as-is. int => a processor ran; 0
                // stored items on a non-demo task is an EMPTY success and is
                // downgraded to failed below.
                $writebackBreakdown = null;
                $storedCount = $this->processTaskResultInTransaction($task, $result ?? [], $isDemoMode, $writebackBreakdown);

                if (!$isDemoMode && $storedCount !== null && $storedCount <= 0) {
                    // The write-back persisted nothing (e.g. all entries rejected,
                    // already-present fill-missing no-ops, or empty payload that
                    // slipped the shape check). Roll the completion back to a
                    // failure so the task does not masquerade as done.
                    $emptyError = 'Worker reported completed but writeback stored 0 items'
                        . ' (execution_type=' . $task->execution_type . ')';
                    // Re-fetch a clean failure transition: reset the completion
                    // fields the success branch set, then fail.
                    $task->status = GlobalTask::status('processing'); // transient — fail() overwrites
                    $task->completed_at = null;
                    $this->failTaskInTransaction($task, $worker, $emptyError, $workerId, $outcome, 'empty_store');
                    return true;
                }

                $outcome['status'] = $task->status;
                $outcome['stored_count'] = $storedCount === null ? 0 : (int) $storedCount;
                $outcome['failed_count'] = 0;

                // Granular write-back reception summary (when the processor reports
                // one) so the worker can log exactly what landed: translations
                // saved, words invalidated, and audio/image binaries persisted.
                if (is_array($writebackBreakdown)) {
                    $outcome['saved'] = (int) ($writebackBreakdown['saved'] ?? 0);
                    $outcome['invalid'] = (int) ($writebackBreakdown['invalid'] ?? 0);
                    $outcome['audio_saved'] = (int) ($writebackBreakdown['audio_saved'] ?? 0);
                    $outcome['images_saved'] = (int) ($writebackBreakdown['images_saved'] ?? 0);
                }

                $worker->incrementCompleted();
                $worker->releaseTask();

                GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('completed'), $workerId, (int) $task->retry_count, [
                    'worker_id' => $workerId,
                    'execution_type' => $task->execution_type,
                    'stored_count' => $outcome['stored_count'],
                    'demo_mode' => (bool) $isDemoMode,
                ]);

                Log::info('Task completed', [
                    'task_id' => $taskId,
                    'worker_id' => $workerId,
                    'demo_mode' => $isDemoMode,
                    'stored_count' => $outcome['stored_count'],
                ]);

                // Phase 5 substrate unification: project the completion onto the
                // linked canonical dictionary row (fill-missing; no-op when the
                // task is not dict-linked). Best-effort — syncToDictRow swallows
                // its own errors so it can never fail this result transaction.
                if (!$isDemoMode && $task->dict_row_id) {
                    $synced = $task->syncToDictRow();
                    $outcome['synced_to_dict'] = $synced;
                }
            } elseif ($status === GlobalTask::status('failed')) {
                $failError = $error ?? 'Unknown error';

                // Check if will retry BEFORE incrementing failed count
                $willRetry = $task->canRetry();

                $task->fail($failError);

                // Only increment failed count for permanent failures
                if (!$willRetry) {
                    $worker->incrementFailed();
                }
                $worker->releaseTask();

                if ($willRetry) {
                    $task->releaseAssignment();
                    Log::info('Task failed, will retry', [
                        'task_id' => $taskId,
                        'retry_count' => $task->retry_count,
                        'max_retries' => $task->max_retries,
                    ]);
                } else {
                    Log::error('Task failed permanently', [
                        'task_id' => $taskId,
                        'error' => $error,
                    ]);
                }
            } elseif ($status === GlobalTask::status('processing')) {
                $task->status = GlobalTask::status('processing');
                // A NULL progress is a lease keep-alive ping (d.txt 7): extend
                // the lease without clobbering the stored progress with 0.
                if ($progress !== null) {
                    $task->progress = $progress;
                }
                if ($result) {
                    $task->result = $result;
                }
                // A progress report proves the worker is alive — extend the
                // timeout lease so a long-running task is not reclaimed
                // mid-flight (the timed-out scope now also covers `processing`,
                // so without this a slow task would be double-processed).
                if ($task->timeout_seconds) {
                    $task->timeout_at = now()->addSeconds($task->timeout_seconds);
                }
                $task->save();

                Log::debug('Task progress updated', [
                    'task_id' => $taskId,
                    'progress' => $progress,
                ]);
            }

            return true;
        }, self::TRANSACTION_ATTEMPTS);

        return $success;
    }

    /**
     * Release timed out tasks (called by OctaneTimer)
     *
     * A timeout CONSUMES a retry attempt: a "poison" task whose worker always
     * dies mid-flight without reporting used to cycle claim -> timeout ->
     * release forever (releaseAssignment never touched retry_count). Now each
     * timeout increments retry_count, and once max_retries is exhausted the
     * task is failed permanently instead of being re-offered.
     *
     * @return int Number of tasks released (or failed-out)
     */
    public function releaseTimedOutTasks(): int
    {
        // Pluck only the candidate ids first (no full models), then re-fetch and
        // re-validate each under lockForUpdate inside its own transaction —
        // mirroring cleanOfflineWorkers(). Without the lock + post-lock recheck,
        // two concurrent timer ticks (or a tick racing a worker's result POST)
        // both read the same "timed out" row and double-process it (lost-update).
        $taskIds = GlobalTask::timedOut()->pluck('task_id')->toArray();
        $count = 0;

        foreach ($taskIds as $taskId) {
            $released = $this->db()->transaction(function () use ($taskId) {
                // Re-fetch under lock. LOCK ORDER: when the task is still owned by
                // a worker we must lock the WORKER first, then the task — the same
                // order pull/submit use (see submitResult), or a concurrent pull
                // and reclaim deadlock on opposite orders. We peek the owner with
                // an unlocked read just to decide whether to take the worker lock.
                $ownerId = GlobalTask::where('task_id', $taskId)->value('assigned_to');

                $worker = null;
                if ($ownerId) {
                    $worker = Worker::where('worker_id', $ownerId)
                        ->lockForUpdate()
                        ->first();
                }

                $task = GlobalTask::where('task_id', $taskId)
                    ->lockForUpdate()
                    ->first();

                if (!$task) {
                    return false;
                }

                // Re-validate the timeout precondition AFTER the lock: still a
                // live worker-owned status, with a timeout_at that is set and
                // already past. A result/progress POST that won the race will
                // have moved the task on (terminal, or extended timeout_at), so
                // we skip it here.
                $stillLive = in_array($task->status, [GlobalTask::status('assigned'), GlobalTask::status('processing')], true)
                    && $task->timeout_at !== null
                    && $task->timeout_at <= now();
                if (!$stillLive) {
                    return false;
                }

                $workerId = $task->assigned_to;

                if ($task->canRetry()) {
                    $task->retry_count++;
                    $task->releaseAssignment();

                    GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('timeout'), $workerId, (int) $task->retry_count, [
                        'worker_id' => $workerId,
                        'execution_type' => $task->execution_type,
                        'reason' => 'timeout',
                    ]);
                    GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('reclaimed'), $workerId, (int) $task->retry_count, [
                        'worker_id' => $workerId,
                        'execution_type' => $task->execution_type,
                        'reason' => 'release',
                    ]);

                    Log::warning('Task timed out and released', [
                        'task_id' => $task->task_id,
                        'worker_id' => $workerId,
                        'retry_count' => $task->retry_count,
                        'max_retries' => $task->max_retries,
                    ]);
                } else {
                    $task->status = GlobalTask::status('failed');
                    $task->error = 'Timed out '
                        . ($task->retry_count + 1)
                        . ' time(s) without a worker result (last worker: '
                        . ($workerId ?? 'unknown') . ')';
                    $task->assigned_to = null;
                    $task->assigned_at = null;
                    $task->timeout_at = null;
                    $task->save();

                    GlobalTaskEvent::record($taskId, GlobalTaskEvent::event('failed'), $workerId, (int) $task->retry_count, [
                        'worker_id' => $workerId,
                        'execution_type' => $task->execution_type,
                        'reason' => 'timeout',
                    ]);

                    Log::error('Task failed permanently after repeated timeouts', [
                        'task_id' => $task->task_id,
                        'worker_id' => $workerId,
                        'retry_count' => $task->retry_count,
                    ]);
                }

                // Update worker status (worker already locked above when owned).
                if ($worker && $worker->current_task_id === $task->task_id) {
                    $worker->releaseTask();
                }

                return true;
            }, self::TRANSACTION_ATTEMPTS);

            if ($released) {
                $count++;
            }
        }

        return $count;
    }

    /**
     * Clean offline workers (called by OctaneTimer)
     *
     * @return int Number of workers cleaned
     */
    public function cleanOfflineWorkers(): int
    {
        $workerIds = Worker::where('last_heartbeat_at', '<', now()->subSeconds(Worker::HEARTBEAT_TIMEOUT))
            ->whereNotNull('last_heartbeat_at')
            ->where('status', '!=', Worker::STATUS_OFFLINE)
            ->pluck('worker_id')
            ->toArray();

        $count = 0;

        foreach ($workerIds as $workerId) {
            $this->db()->transaction(function () use ($workerId, &$count) {
                // Lock worker for update
                $worker = Worker::where('worker_id', $workerId)
                    ->lockForUpdate()
                    ->first();

                if (!$worker) {
                    return;
                }

                // Recheck heartbeat after lock (may have updated)
                if ($worker->last_heartbeat_at >= now()->subSeconds(Worker::HEARTBEAT_TIMEOUT)) {
                    return;
                }

                // Release EVERY task still held by this worker, not just the
                // single current_task_id. A pull assigns up to 'limit' tasks but
                // Worker.current_task_id only tracks the last one, so a single
                // offline worker can leave several assigned/processing tasks
                // stranded until they time out. Bulk-release them here (mirroring
                // the timeout retry/permanent-fail logic) so they re-queue
                // immediately. When the worker holds 0/1 tasks this behaves
                // identically to the old single-task release.
                $heldTasks = GlobalTask::where('assigned_to', $worker->worker_id)
                    ->whereIn('status', [GlobalTask::status('assigned'), GlobalTask::status('processing')])
                    ->lockForUpdate()
                    ->get();

                foreach ($heldTasks as $task) {
                    if ($task->canRetry()) {
                        $task->retry_count++;
                        $task->releaseAssignment();
                    } else {
                        $task->status = GlobalTask::status('failed');
                        $task->error = 'Worker went offline '
                            . ($task->retry_count + 1)
                            . ' time(s) without a result (last worker: '
                            . $worker->worker_id . ')';
                        $task->assigned_to = null;
                        $task->assigned_at = null;
                        $task->timeout_at = null;
                        $task->save();
                    }

                    GlobalTaskEvent::record($task->task_id, GlobalTaskEvent::event('reclaimed'), $worker->worker_id, (int) $task->retry_count, [
                        'worker_id' => $worker->worker_id,
                        'execution_type' => $task->execution_type,
                        'reason' => 'worker_offline',
                    ]);

                    Log::warning('Task released due to worker offline', [
                        'task_id' => $task->task_id,
                        'worker_id' => $worker->worker_id,
                        'retry_count' => $task->retry_count,
                    ]);
                }

                $worker->markOffline();
                $count++;

                Log::info('Worker marked offline', [
                    'worker_id' => $worker->worker_id,
                    'last_heartbeat' => $worker->last_heartbeat_at,
                ]);
            });
        }

        return $count;
    }

    /**
     * Get task statistics
     *
     * @return array Statistics
     */
    public function getTaskStats(): array
    {
        // This is an unbounded full-table GROUP BY (no WHERE) over global_tasks,
        // which grows without bound as completed/failed/cancelled rows pile up.
        // It is polled hot: the Task Center shell (/api/task-center/overview) and
        // /api/task/stats both call it every ~5s. On the single-worker php -S
        // runtime one such scan serializes ahead of EVERY other request (even the
        // DB-free /api/health), so it is memoized for a few seconds — concurrent
        // pollers then share ONE scan and read a cheap single-row cache entry
        // instead. Invalidated implicitly by the short TTL (see STATS_CACHE_KEY /
        // forgetTaskStatsCache() for explicit busting on state transitions).
        return Cache::store(self::STATS_CACHE_STORE)->remember(self::STATS_CACHE_KEY, self::STATS_CACHE_TTL_SECONDS, static function (): array {
            // ONE grouped query instead of seven full-table counts; the response
            // covers the complete status vocabulary (incl. cancelled) so every
            // consumer (dashboard, pycore monitor) sees the same set.
            $grouped = GlobalTask::query()
                ->groupBy('status')
                ->selectRaw('status, count(*) as total')
                ->pluck('total', 'status');

            $count = static function (string $status) use ($grouped): int {
                return (int) ($grouped[$status] ?? 0);
            };

            $stats = ['total' => (int) $grouped->sum()];
            foreach (QueueCenterContract::taskStatuses('all') as $status) {
                $stats[$status] = $count($status);
            }
            return QueueCenterContract::projectTask($stats, 'stats');
        });
    }

    /**
     * Drop the cached task-status tally so the next getTaskStats() recomputes.
     * Cheap to call on task create / cancel / bump when fresher counts matter;
     * the short TTL already bounds staleness, so this is optional.
     */
    public function forgetTaskStatsCache(): void
    {
        Cache::store(self::STATS_CACHE_STORE)->forget(self::STATS_CACHE_KEY);
    }

    /**
     * Process task result within transaction (extensible processing).
     *
     * Returns how many canonical items the matching processor actually stored,
     * so submitResult() can enforce result-trust:
     *   - null => no processor owns this task type (control-plane / text-only
     *             completion); the worker's "completed" status is trusted as-is.
     *   - int  => a processor ran; 0 stored items on a non-demo task is an EMPTY
     *             success and is downgraded to failed by the caller.
     *
     * @param GlobalTask $task Task model (already locked)
     * @param array $result Result data
     * @param bool $isDemoMode Demo mode flag
     * @return int|null Stored item count, or null when no processor matched
     */
    protected function processTaskResultInTransaction(GlobalTask $task, array $result, bool $isDemoMode, ?array &$breakdown = null): ?int
    {
        // Delegate to the registry, which already returns ?int (the matching
        // processor's stored count, or null when none claims this task type).
        // We do NOT short-circuit empty results here: a matching processor must
        // see the empty result and report 0 so the empty-store gate fires; only
        // a genuinely unowned type returns null and is trusted.
        // $breakdown (by-ref) receives the matching processor's granular
        // reception summary when it exposes one (word-translation write-back).
        $storedCount = $this->getProcessorRegistry()->process($task, $result, $isDemoMode, $breakdown);

        if ($storedCount === null) {
            Log::debug('[TaskManager] No processor found for task — trusting worker status', [
                'task_id' => $task->task_id,
                'app_name' => $task->app_name,
                'task_type' => $task->task_type,
            ]);
        }

        return $storedCount;
    }

    /**
     * Result-trust shape gate (contract item 3).
     *
     * Validates that a non-demo "completed" result is STRUCTURALLY capable of
     * backing a completion for its execution_type, BEFORE the task is marked
     * completed and the processor runs. Returns a human-readable error string
     * when the shape is invalid, or null when the result passes (or the type is
     * not shape-constrained — control-plane / text-only / remote_fast types are
     * always trusted; the authoritative emptiness check remains the post-write
     * stored_count<=0 downgrade in submitResult()).
     *
     * Deliberately permissive: only execution_types whose processor result keys
     * are verified here are enforced, so a valid completion is never falsely
     * rejected. A result that is empty for a known media type fails fast with a
     * precise message instead of running the processor for nothing.
     *
     * @param GlobalTask $task   Task model (already locked)
     * @param array      $result Worker-reported result payload
     * @return string|null Error message when the shape is invalid, else null
     */
    protected function validateResultShape(GlobalTask $task, array $result): ?string
    {
        // Some workers wrap the payload in a {result:{...}} envelope; look at
        // both the outer and inner shapes so either form passes.
        $inner = (isset($result['result']) && is_array($result['result'])) ? $result['result'] : $result;

        // task_type-first gate: interactive tasks have execution_type rewritten
        // to 'remote_fast', so the execution_type switch below never enforces the
        // precise media shapes on the fast lane. task_type is NEVER rewritten, so
        // switch on it first and fall through to the execution_type switch as a
        // fallback for non-fast lanes. Do NOT key on capability (NULL = any).
        switch ($task->task_type) {
            case QueueCenterContract::taskTypeKey('word_translation'):
                // Check both the flat (pycore) and the {result:{...}} enveloped
                // (chrome web-AI) shapes — $inner already unwrapped above.
                $hasAny = !empty($inner['translations'])
                    || !empty($result['translations'])
                    || !empty($inner['invalid_words'])
                    || !empty($result['invalid_words'])
                    || !empty($inner['region_redirect_words'])
                    || !empty($result['region_redirect_words']);

                if (!$hasAny) {
                    return 'Translation result carried no translations, invalid_words or region_redirect_words';
                }
                return null;

            case QueueCenterContract::taskTypeKey('prompt_translation'):
                // A prompt-translation completion must carry the English text.
                $hasEnglish = trim((string) ($inner['english'] ?? ($result['english'] ?? ''))) !== '';
                if (!$hasEnglish) {
                    return 'Prompt translation result carried no english text';
                }
                return null;

            case QueueCenterContract::taskTypeKey('word_validity'):
                // A validity-detection completion must carry at least one verdict
                // (an all-invalid or all-valid batch is still a real result). The
                // empty_store gate downgrades to failed if nothing actually stored.
                $hasAny = !empty($inner['valid_words'])
                    || !empty($result['valid_words'])
                    || !empty($inner['invalid_words'])
                    || !empty($result['invalid_words']);

                if (!$hasAny) {
                    return 'Word-validity result carried no valid_words or invalid_words';
                }
                return null;

            case QueueCenterContract::taskTypeKey('gemini_image'):
                $hasImage = !empty($inner['image_base64'])
                    || !empty($result['image_base64'])
                    || !empty($inner['image_url'])
                    || !empty($result['image_url']);

                if (!$hasImage) {
                    return 'Image result carried no image_base64/image_url';
                }
                return null;

            case QueueCenterContract::taskTypeKey('subtitle_search'):
                // A subtitle search completion must carry at least one hit.
                $hasResults = (!empty($inner['results']) && is_array($inner['results']))
                    || (!empty($result['results']) && is_array($result['results']));

                if (!$hasResults) {
                    return 'Subtitle search result carried no results[]';
                }
                return null;

            case QueueCenterContract::taskTypeKey('poster'):
                // A poster completion must carry poster bytes or a URL.
                $hasPoster = !empty($inner['image_base64'])
                    || !empty($result['image_base64'])
                    || !empty($inner['poster_base64'])
                    || !empty($result['poster_base64'])
                    || !empty($inner['image_url'])
                    || !empty($result['image_url'])
                    || !empty($inner['poster_url'])
                    || !empty($result['poster_url'])
                    || !empty($inner['bytes'])
                    || !empty($result['bytes']);

                if (!$hasPoster) {
                    return 'Poster result carried no image_base64/image_url/poster_url/bytes';
                }
                return null;

            case QueueCenterContract::taskTypeKey('sentence_audio'):
                // A sentence-audio completion must carry audio BYTES the server can
                // store. saved_path alone points at the worker's own filesystem and
                // carries nothing the server-side writeback (SentenceAudioTaskProcessor::
                // extractAudioBase64) can trust or read — so it is NOT accepted here;
                // gate and processor agree a saved_path-only result is an honest shape
                // error rather than a 0-byte store that downgrades to a fail-loop.
                $hasAudio = !empty($inner['audio_files'])
                    || !empty($result['audio_files'])
                    || !empty($inner['audio_base64'])
                    || !empty($result['audio_base64']);

                if (!$hasAudio) {
                    return 'Sentence-audio result carried no audio_files/audio_base64';
                }
                return null;

            case QueueCenterContract::taskTypeKey('article_audio'):
                $hasAudio = !empty($inner['audio_base64'])
                    || !empty($result['audio_base64']);

                return $hasAudio
                    ? null
                    : 'Article-audio result carried no audio_base64';

            case QueueCenterContract::taskTypeKey('stt'):
            case QueueCenterContract::taskTypeKey('audio_transcribe'):
                $hasTranscript = trim((string) ($inner['text']
                    ?? ($inner['transcript'] ?? ($result['text'] ?? ($result['transcript'] ?? ''))))) !== '';

                return $hasTranscript
                    ? null
                    : 'STT result carried no text/transcript';
        }

        switch ($task->execution_type) {
            case GlobalTask::executionType('remote_translation'):
                // A translation completion must carry SOME per-word outcome:
                // actual translations, or explicit invalid / region-redirect
                // verdicts (an all-invalid batch is still a real result).
                // Accept both flat (pycore) and {result:{...}} (chrome) shapes.
                $hasAny = !empty($inner['translations'])
                    || !empty($result['translations'])
                    || !empty($inner['invalid_words'])
                    || !empty($result['invalid_words'])
                    || !empty($inner['region_redirect_words'])
                    || !empty($result['region_redirect_words']);

                return $hasAny
                    ? null
                    : 'Translation result carried no translations, invalid_words or region_redirect_words';

            case GlobalTask::executionType('remote_gemini'):
                // A gemini image completion must carry image bytes or a URL.
                $hasImage = !empty($inner['image_base64'])
                    || !empty($result['image_base64'])
                    || !empty($inner['image_url'])
                    || !empty($result['image_url']);

                return $hasImage
                    ? null
                    : 'Image result carried no image_base64/image_url';

            default:
                // Other centrally declared/control-plane lanes trust the
                // worker's status; the stored_count<=0 gate still guards task
                // types with a registered write-back processor.
                return null;
        }
    }

    /**
     * Fail a task from WITHIN the result transaction.
     *
     * Used by the result-trust gate to treat a shape-invalid or empty-store
     * "completed" report exactly like a worker-reported failure: consume a
     * retry if any remain (re-queueing the task), otherwise fail permanently.
     * Mirrors the reported-'failed' branch in submitResult() and additionally
     * records a GlobalTaskEvent so the downgrade is auditable, then fills the
     * caller's $outcome.
     *
     * @param GlobalTask $task     Task model (already locked, already in this tx)
     * @param Worker     $worker   Owning worker (already locked)
     * @param string     $error    Human-readable failure reason surfaced to the task
     * @param string     $workerId Reporting worker id
     * @param array      $outcome  Caller outcome accumulator (by reference)
     * @param string     $reason   Short machine reason: 'invalid_shape' | 'empty_store'
     */
    protected function failTaskInTransaction(
        GlobalTask $task,
        Worker $worker,
        string $error,
        string $workerId,
        array &$outcome,
        string $reason
    ): void {
        // canRetry() must be read BEFORE fail() — fail() increments retry_count.
        $willRetry = $task->canRetry();

        $task->fail($error);

        // Only a PERMANENT failure counts against the worker's failed tally,
        // matching the reported-'failed' branch.
        if (!$willRetry) {
            $worker->incrementFailed();
        }
        $worker->releaseTask();

        if ($willRetry) {
            // Re-queue for another attempt (sets status back to pending and
            // clears the assignment).
            $task->releaseAssignment();
        }

        GlobalTaskEvent::record(
            $task->task_id,
            GlobalTaskEvent::event('failed'),
            $workerId,
            (int) $task->retry_count,
            [
                'worker_id' => $workerId,
                'execution_type' => $task->execution_type,
                'reason' => $reason,
                'error' => $error,
                'will_retry' => $willRetry,
            ]
        );

        $outcome['status'] = $task->status;
        $outcome['stored_count'] = 0;
        $outcome['failed_count'] = 1;

        Log::warning('Task downgraded to failed by result-trust gate', [
            'task_id' => $task->task_id,
            'worker_id' => $workerId,
            'reason' => $reason,
            'will_retry' => $willRetry,
            'error' => $error,
        ]);
    }
}
