<?php

namespace App\Apps\AppQyV1\Services;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1VocabularyLibraryModel;
use App\Models\GlobalTask;
use App\Models\Worker;
use App\Services\AiGateway\AiGateway;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Vocabulary-library cover tasks on the global task queue.
 *
 * One live task per library (group_key library_cover:{id}) across the contract
 * modes: generate (AI image, remote_gemini) and search (web image search,
 * remote_poster). mcp-chrome claims them through the typed worker routes and
 * LibraryCoverTaskProcessor force-writes the returned image. A task no browser
 * worker picks up in time is claimed by the Laravel AI fallback under the
 * contract fallback_worker_id; Laravel has no browser image search, so the
 * fallback regenerates the cover through AiGateway for both modes.
 */
class AppQyV1LibraryCoverTaskService
{
    public const MAX_IDS = 200;
    public const PROMPT_MAX_CHARS = 2000;
    public const HANDLER_CHROME = 'chrome';
    public const HANDLER_LARAVEL_AI = 'laravel_ai';

    private const APP_NAME = 'AppQyV1';
    private const GROUP_KEY_PREFIX = 'library_cover:';
    private const TIMEOUT_SECONDS = 300;
    private const MAX_RETRIES = 1;
    private const UNSERVED_LANE_GRACE_SECONDS = 3;
    private const FALLBACK_SCAN_LIMIT = 20;
    private const SEARCH_QUERY_SUFFIX = 'vocabulary book cover';
    private const LEASE_OWNER_MAX_CHARS = 64;
    private const FAILURE_SYNC_WINDOW_SECONDS = 600;
    private const FAILURE_SYNC_LIMIT = 50;
    private const UNIQUE_VIOLATION_SQLSTATE = '23505';

    private TaskManagerService $taskManager;
    private AppQyV1VocabularyCoverService $coverService;

    public function __construct(TaskManagerService $taskManager, AppQyV1VocabularyCoverService $coverService)
    {
        $this->taskManager = $taskManager;
        $this->coverService = $coverService;
    }

    public static function groupKey(int $libraryId): string
    {
        return self::GROUP_KEY_PREFIX . $libraryId;
    }

    /**
     * Idempotent per library: an active task of the same mode is returned, a
     * pending task of the other mode is cancelled and replaced, and a claimed
     * task of the other mode is left alone (skipped).
     *
     * @param int[] $ids
     * @return array{tasks: array<int,array<string,mixed>>, skipped: array<int,array{id:int,reason:string}>}
     */
    public function enqueue(array $ids, string $mode, ?string $prompt = null): array
    {
        $tasks = [];
        $skipped = [];
        $taskType = QueueCenterContract::libraryCoverTaskType($mode);
        $ids = $this->normalizeIds($ids);
        $libraries = AppQyV1VocabularyLibraryModel::publicRowsByIds($ids)->keyBy('id');
        $liveTasks = GlobalTask::newestByGroupKeys(
            array_values(QueueCenterContract::libraryCoverTaskTypes()),
            array_map([self::class, 'groupKey'], $ids),
            QueueCenterContract::taskStatuses('live')
        );
        $prompt = $prompt !== null && trim($prompt) !== '' ? trim($prompt) : null;

        foreach ($ids as $id) {
            $library = $libraries->get($id);
            if (!$library) {
                $skipped[] = ['id' => $id, 'reason' => 'library_not_found'];
                continue;
            }

            $active = $liveTasks[self::groupKey($id)] ?? null;
            if ($active && $active->task_type === $taskType) {
                $tasks[] = $this->taskShape($active);
                continue;
            }
            if ($active && !$this->cancelPendingTask($active)) {
                $skipped[] = ['id' => $id, 'reason' => 'other_mode_in_progress'];
                continue;
            }

            $task = $this->createTask($library, $mode, $taskType, $prompt);
            $this->markLibraryQueued($library, $task);
            $tasks[] = $this->taskShape($task);
        }

        return ['tasks' => $tasks, 'skipped' => $skipped];
    }

    /**
     * Flat cover state plus the newest cover task (any status) per library,
     * so pollers can stop on a terminal task.
     *
     * @param int[] $ids
     * @return array{items: array<int,array<string,mixed>>}
     */
    public function statusForLibraries(array $ids): array
    {
        $items = [];
        $ids = $this->normalizeIds($ids);
        $libraries = AppQyV1VocabularyLibraryModel::publicRowsByIds($ids)->keyBy('id');
        $newestTasks = GlobalTask::newestByGroupKeys(
            array_values(QueueCenterContract::libraryCoverTaskTypes()),
            array_map([self::class, 'groupKey'], $ids),
            null
        );

        foreach ($ids as $id) {
            $library = $libraries->get($id);
            if (!$library) {
                continue;
            }
            $task = $newestTasks[self::groupKey($id)] ?? null;
            $cover = $this->coverService->presentCover($library);
            $items[] = [
                'library_id' => (int) $library->id,
                'cover_status' => $cover['status'],
                'cover_url' => $cover['url'],
                'image_url' => $cover['image_url'],
                'cover_error_message' => $cover['error_message'],
                'cover_provider' => $library->cover_provider,
                'cover_model' => $library->cover_model,
                'cover_last_generated_at' => optional($library->cover_last_generated_at)->toIso8601String(),
                'task' => $task ? $this->taskShape($task) : null,
            ];
        }

        return ['items' => $items];
    }

    /**
     * Live cover task per library in one query (list-row preload).
     *
     * @param int[] $ids
     * @return array<int,array<string,mixed>> library_id => LibraryCoverTask
     */
    public function activeTasksForLibraries(array $ids): array
    {
        $active = [];
        $ids = $this->normalizeIds($ids);
        $liveTasks = GlobalTask::newestByGroupKeys(
            array_values(QueueCenterContract::libraryCoverTaskTypes()),
            array_map([self::class, 'groupKey'], $ids),
            QueueCenterContract::taskStatuses('live')
        );

        foreach ($ids as $id) {
            $task = $liveTasks[self::groupKey($id)] ?? null;
            if ($task) {
                $active[$id] = $this->taskShape($task);
            }
        }

        return $active;
    }

    /** LibraryCoverTask wire shape. */
    public function taskShape(GlobalTask $task): array
    {
        $payload = is_array($task->payload) ? $task->payload : [];

        return [
            'task_id' => (string) $task->task_id,
            'library_id' => (int) ($payload['library_id'] ?? 0),
            'task_type' => (string) $task->task_type,
            'mode' => QueueCenterContract::libraryCoverMode((string) $task->task_type),
            'status' => (string) $task->status,
            'handler' => $this->taskHandler($task),
            'assigned_to' => $task->assigned_to,
            'created_at' => optional($task->created_at)->toIso8601String(),
            'updated_at' => optional($task->updated_at)->toIso8601String(),
            'error' => $task->error,
        ];
    }

    /**
     * One Laravel AI fallback pass: claims at most one pending cover task that
     * no browser worker picked up within fallback_grace_seconds (or within a
     * few seconds when no online worker serves its lane) and completes it with
     * a fresh AiGateway image.
     *
     * @return array{task_id:string,library_id:int,status:?string}|null
     */
    public function runFallback(): ?array
    {
        if (!AiGateway::hasImageProvider()) {
            return null;
        }

        $candidate = $this->nextFallbackCandidate();
        if ($candidate === null) {
            return null;
        }

        $handlerId = QueueCenterContract::libraryCoverFallbackWorkerId();
        $task = $this->taskManager->claimPendingTaskForServerHandler((string) $candidate->task_id, $handlerId);
        if ($task === null) {
            return null;
        }

        return $this->executeFallback($task, $handlerId);
    }

    /**
     * Mirror terminal cover-task failures (chrome or fallback) onto library
     * rows still queued for that task: failed + task error, parked so the
     * maintenance recovery does not retry it. Idempotent; only a row whose
     * newest cover task is the failed one and which is not owned by another
     * claimer is touched.
     *
     * @return int library rows marked failed
     */
    public function syncTerminalFailures(): int
    {
        $synced = 0;
        $failedByLibrary = [];
        $failures = GlobalTask::newestFailedInGroupsSince(
            array_values(QueueCenterContract::libraryCoverTaskTypes()),
            now()->subSeconds(self::FAILURE_SYNC_WINDOW_SECONDS),
            self::FAILURE_SYNC_LIMIT
        );
        foreach ($failures as $task) {
            $payload = is_array($task->payload) ? $task->payload : [];
            $libraryId = (int) ($payload['library_id'] ?? 0);
            if ($libraryId > 0) {
                $failedByLibrary[$libraryId] = $task;
            }
        }
        if ($failedByLibrary === []) {
            return 0;
        }

        foreach (AppQyV1VocabularyLibraryModel::queuedCoverRowsByIds(array_keys($failedByLibrary)) as $library) {
            $task = $failedByLibrary[(int) $library->id];
            $taskId = (string) $task->task_id;
            $owner = $library->assist_claimed_by;
            if ($owner !== null && $owner !== '' && $owner !== $this->taskOwner($taskId)) {
                continue;
            }
            $this->parkFailedLibrary(
                $library,
                $taskId,
                (string) ($task->error ?? "Cover task {$taskId} failed without an error message")
            );
            $synced++;
        }

        return $synced;
    }

    private function parkFailedLibrary(AppQyV1VocabularyLibraryModel $library, string $taskId, string $error): void
    {
        $library->cover_status = 'failed';
        $library->cover_error_message = mb_substr($error, 0, 2000);
        $library->cover_finished_at = now();
        $library->assist_claimed_at = null;
        $library->assist_claimed_by = $this->taskOwner($taskId);
        $library->saveRecord();
    }

    private function taskOwner(string $taskId): string
    {
        return mb_substr(
            AppQyV1VocabularyLibraryModel::COVER_TASK_HOLD_PREFIX . $taskId,
            0,
            self::LEASE_OWNER_MAX_CHARS
        );
    }

    private function nextFallbackCandidate(): ?GlobalTask
    {
        $candidates = GlobalTask::pendingOfTaskTypesCreatedBefore(
            array_values(QueueCenterContract::libraryCoverTaskTypes()),
            now()->subSeconds(self::UNSERVED_LANE_GRACE_SECONDS),
            self::FALLBACK_SCAN_LIMIT
        );
        if ($candidates->isEmpty()) {
            return null;
        }

        $graceCutoff = now()->subSeconds(QueueCenterContract::libraryCoverFallbackGraceSeconds());
        $onlineWorkers = Worker::onlineWorkers();
        foreach ($candidates as $task) {
            if ($task->created_at <= $graceCutoff || !$this->laneServed($task, $onlineWorkers)) {
                return $task;
            }
        }

        return null;
    }

    private function laneServed(GlobalTask $task, iterable $workers): bool
    {
        foreach ($workers as $worker) {
            $lanes = is_array($worker->processor_types) ? $worker->processor_types : [];
            if (in_array($task->execution_type, $lanes, true) && $task->capabilityMatches($worker->capabilityList())) {
                return true;
            }
        }

        return false;
    }

    /** @return array{task_id:string,library_id:int,status:?string} */
    private function executeFallback(GlobalTask $task, string $handlerId): array
    {
        $taskId = (string) $task->task_id;
        $payload = is_array($task->payload) ? $task->payload : [];
        $libraryId = (int) ($payload['library_id'] ?? 0);
        $prompt = is_string($payload['prompt'] ?? null) ? $payload['prompt'] : null;
        $library = $libraryId > 0 ? AppQyV1VocabularyLibraryModel::findById($libraryId) : null;

        if ($library === null) {
            $status = $this->taskManager->failServerHandledTask(
                $taskId,
                $handlerId,
                "Vocabulary library {$libraryId} from task payload no longer exists"
            );
            return ['task_id' => $taskId, 'library_id' => $libraryId, 'status' => $status];
        }

        try {
            $generated = $this->coverService->regenerateWithAi($library, $prompt, true);
        } catch (Throwable $e) {
            $generated = ['success' => false, 'error' => get_class($e) . ': ' . $e->getMessage()];
        }

        if (empty($generated['success'])) {
            $error = 'Laravel AI cover generation failed: ' . (string) ($generated['error'] ?? '');
            $status = $this->taskManager->failServerHandledTask($taskId, $handlerId, $error);
            if ($status === GlobalTask::status('pending')) {
                $library->cover_status = 'pending';
                $library->cover_error_message = mb_substr($error, 0, 2000);
                $library->saveRecord();
            } elseif ($status !== null) {
                $this->parkFailedLibrary($library, $taskId, $error);
            }
            return ['task_id' => $taskId, 'library_id' => $libraryId, 'status' => $status];
        }

        $library->assist_claimed_at = null;
        $library->assist_claimed_by = null;
        $library->saveRecord();

        $completed = $this->taskManager->completeServerHandledTask($taskId, $handlerId, [
            'handler' => self::HANDLER_LARAVEL_AI,
            'library_id' => $libraryId,
            'mode' => $payload['mode'] ?? QueueCenterContract::libraryCoverMode((string) $task->task_type),
            'image_url' => $generated['url'] ?? null,
            'provider' => $generated['provider'] ?? null,
            'model' => $generated['model'] ?? null,
            'latency_ms' => $generated['latency_ms'] ?? null,
        ]);
        if (!$completed) {
            Log::warning('[LibraryCoverTask] Fallback cover stored but the task was no longer owned by the fallback handler', [
                'task_id' => $taskId,
                'library_id' => $libraryId,
                'handler' => $handlerId,
            ]);
        }

        return [
            'task_id' => $taskId,
            'library_id' => $libraryId,
            'status' => $completed ? GlobalTask::status('completed') : null,
        ];
    }

    private function createTask(
        AppQyV1VocabularyLibraryModel $library,
        string $mode,
        string $taskType,
        ?string $prompt
    ): GlobalTask {
        $groupKey = self::groupKey((int) $library->id);
        $payload = [
            'library_id' => (int) $library->id,
            'mode' => $mode,
            'name' => (string) $library->name,
            'language' => (string) $library->language,
            'category' => (string) ($library->category ?? ''),
            'description' => (string) ($library->description ?? ''),
            'search_query' => trim($library->name . ' ' . self::SEARCH_QUERY_SUFFIX),
        ];
        if ($prompt !== null) {
            $payload['prompt'] = $prompt;
        }

        try {
            return $this->taskManager->createTask(
                self::APP_NAME,
                $taskType,
                (string) QueueCenterContract::taskTypeExecution($taskType),
                $payload,
                self::TIMEOUT_SECONDS,
                QueueCenterContract::taskPriority('manual'),
                self::MAX_RETRIES,
                false,
                null,
                ['group_key' => $groupKey]
            );
        } catch (QueryException $exception) {
            // The live (task_type, group_key) partial unique index rejected a
            // concurrent duplicate: report the winning row instead.
            if (($exception->errorInfo[0] ?? null) !== self::UNIQUE_VIOLATION_SQLSTATE) {
                throw $exception;
            }
            $existing = GlobalTask::findNewestLiveByGroupKey(
                $taskType,
                $groupKey,
                QueueCenterContract::taskStatuses('live')
            );
            if ($existing === null) {
                throw $exception;
            }
            return $existing;
        }
    }

    /**
     * Queue the library row for the task: pending, error cleared, filename
     * ensured, and the assist lease held by the task so the assist claim
     * pipeline does not generate the same cover in parallel (a later explicit
     * enqueue also releases a parked failure).
     */
    private function markLibraryQueued(AppQyV1VocabularyLibraryModel $library, GlobalTask $task): void
    {
        if ($library->cover_filename === null || $library->cover_filename === '') {
            $library->cover_filename = $this->coverService->buildFilename($library);
        }
        $library->cover_status = 'pending';
        $library->cover_error_message = null;
        $library->cover_last_requested_at = now();
        $library->assist_claimed_at = now();
        $library->assist_claimed_by = $this->taskOwner((string) $task->task_id);
        $library->saveRecord();
    }

    private function cancelPendingTask(GlobalTask $task): bool
    {
        if ($task->status !== GlobalTask::status('pending')) {
            return false;
        }

        return $this->taskManager->cancelTask((string) $task->task_id) === 'cancelled';
    }

    private function taskHandler(GlobalTask $task): ?string
    {
        $owner = $task->assigned_to;
        if (!is_string($owner) || $owner === '') {
            $steps = is_array($task->steps) ? $task->steps : [];
            $owner = $steps[TaskManagerService::RESULT_WRITEBACK_STEP]['worker_id'] ?? null;
        }
        if (!is_string($owner) || $owner === '') {
            return null;
        }

        return $owner === QueueCenterContract::libraryCoverFallbackWorkerId()
            ? self::HANDLER_LARAVEL_AI
            : self::HANDLER_CHROME;
    }

    /** @return int[] */
    private function normalizeIds(array $ids): array
    {
        return array_values(array_unique(array_filter(
            array_map('intval', $ids),
            static fn (int $id): bool => $id > 0
        )));
    }
}
