<?php

namespace App\Models;

use App\Support\QueueCenterContract;
use App\Services\QueueCenter\QueueCenterRealtimeService;
use App\Models\Concerns\GlobalTaskQueueQueries;
use App\Models\Concerns\UsesMainConnection;
use App\Utils\RunsModelTransactions;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class GlobalTask extends Model
{
    use GlobalTaskQueueQueries, HasFactory, RunsModelTransactions, UsesMainConnection;

    private const CACHE_ARRAY_PAYLOAD_VERSION = ':array-v1';

    protected $table = 'global_tasks';

    protected $fillable = [
        'task_id',
        'app_name',
        'task_type',
        'execution_type',
        'status',
        'assigned_to',
        'assigned_at',
        'timeout_at',
        'timeout_seconds',
        'queue_position',
        'priority',
        'retry_count',
        'max_retries',
        'progress',
        'payload',
        'steps',
        'result',
        'error',
        'queue_item_id',
        'completed_at',
        // Phase 2 — shared fast lane + capability routing.
        'capability',
        'is_fast_tier',
        // Phase 5 — substrate unification link back to the canonical dict row.
        'dict_row_id',
        'dict_language',
        'dict_row_table',
        'sync_to_dict_at',
        'group_key',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'steps' => 'array',
            'result' => 'array',
            'progress' => 'float',
            'assigned_at' => 'datetime',
            'timeout_at' => 'datetime',
            'completed_at' => 'datetime',
            'queue_position' => 'integer',
            'priority' => 'integer',
            'retry_count' => 'integer',
            'max_retries' => 'integer',
            'timeout_seconds' => 'integer',
            'is_fast_tier' => 'boolean',
            'dict_row_id' => 'integer',
            'sync_to_dict_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saved(static function (GlobalTask $task): void {
            app(QueueCenterRealtimeService::class)->publish(
                'global_task',
                $task->dict_language,
                $task->task_id
            );
        });

        static::deleted(static function (GlobalTask $task): void {
            app(QueueCenterRealtimeService::class)->publish(
                'global_task',
                $task->dict_language,
                $task->task_id
            );
        });
    }

    /**
     * Global-task vocabulary facade.
     *
     * All values are loaded from config/queue_center_contract.json through
     * App\Support\QueueCenterContract. Pycore, both React managers, and
     * mcp-chrome use sibling adapters documented there. A contract change is
     * therefore made once in JSON and never copied into this Eloquent model.
     */
    public static function status(string $name): string
    {
        return QueueCenterContract::taskStatus($name);
    }

    public static function statuses(string $group = 'all'): array
    {
        return QueueCenterContract::taskStatuses($group);
    }

    public static function executionType(string $name): string
    {
        return QueueCenterContract::taskExecutionType($name);
    }

    public static function executionTypes(): array
    {
        return QueueCenterContract::taskExecutionTypes();
    }

    public static function capability(string $name): string
    {
        if (!in_array($name, QueueCenterContract::taskCapabilities(), true)) {
            throw new \InvalidArgumentException("Unknown global-task capability: {$name}");
        }
        return $name;
    }

    public static function capabilities(): array
    {
        return QueueCenterContract::taskCapabilities();
    }

    public static function priority(string $name): int
    {
        return QueueCenterContract::taskPriority($name);
    }

    public static function capabilitySingleLanes(): array
    {
        return QueueCenterContract::capabilitySingleLanes();
    }

    public static function cachedStatusCounts(
        string $cacheKey,
        int $ttlSeconds,
        string $appName,
        string $taskType,
        array $payloadFilters = []
    ): Collection {
        $versionedCacheKey = $cacheKey . self::CACHE_ARRAY_PAYLOAD_VERSION;
        $counts = Cache::remember($versionedCacheKey, $ttlSeconds, static function () use ($appName, $taskType, $payloadFilters): array {
            $query = self::query()
                ->where('app_name', $appName)
                ->where('task_type', $taskType);

            foreach ($payloadFilters as $field => $value) {
                $query->where('payload->' . $field, $value);
            }

            return $query
                ->groupBy('status')
                ->selectRaw('status, count(*) as total')
                ->pluck('total', 'status')
                ->all();
        });

        return collect($counts);
    }

    /**
     * task_id keys of REDUNDANT live rows per (task_type, group_key): for
     * every group holding more than one live row, every live task except the
     * newest (max id — the same winner QueueCenterService::findLiveByDedupKey
     * returns). sys:init cancels these before creating the live-dedup partial
     * unique index. Bounded on both dimensions so repair stays incremental.
     *
     * @return array<int,string>
     */
    public static function redundantLiveGroupKeyTaskKeys(int $groups = 100, int $maxKeys = 500): array
    {
        $duplicates = self::query()
            ->select('task_type', 'group_key')
            ->whereNotNull('group_key')
            ->whereIn('status', self::statuses('live'))
            ->groupBy('task_type', 'group_key')
            ->havingRaw('count(*) > 1')
            ->limit(max(1, $groups))
            ->get();

        $keys = [];
        foreach ($duplicates as $row) {
            $groupKeys = self::query()
                ->where('task_type', (string) $row->task_type)
                ->where('group_key', (string) $row->group_key)
                ->whereIn('status', self::statuses('live'))
                ->orderByDesc('id')
                ->pluck('task_id');
            foreach ($groupKeys->slice(1) as $taskId) {
                $keys[] = (string) $taskId;
                if (count($keys) >= $maxKeys) {
                    return $keys;
                }
            }
        }
        return $keys;
    }

    /**
     * The stored task_type of one task (null when the task does not exist).
     * Centralized here so controllers never query global_tasks directly.
     */
    public static function taskTypeOf(string $taskId): ?string
    {
        $taskType = self::query()->where('task_id', $taskId)->value('task_type');
        return is_string($taskType) ? $taskType : null;
    }

    public static function findByTaskId(string $taskId): ?self
    {
        return self::query()->where('task_id', $taskId)->first();
    }

    public static function deleteInvalidPayloadTasks(): int
    {
        return self::query()->whereNull('payload')->delete();
    }

    public static function resetStatusesToPending(array $statuses): int
    {
        return self::query()
            ->whereIn('status', $statuses)
            ->update([
                'status' => self::status('pending'),
                'assigned_to' => null,
                'assigned_at' => null,
                'timeout_at' => null,
            ]);
    }

    public static function initializationStats(): array
    {
        $grouped = self::query()->groupBy('status')->selectRaw('status, count(*) as aggregate')->pluck('aggregate', 'status');
        $total = (int) $grouped->sum();
        $pending = (int) ($grouped[self::status('pending')] ?? 0);
        $processing = (int) ($grouped[self::status('processing')] ?? 0);
        $completed = (int) ($grouped[self::status('completed')] ?? 0);
        $failed = (int) ($grouped[self::status('failed')] ?? 0);

        return [
            'total' => $total,
            'pending' => $pending,
            'processing' => $processing,
            'completed' => $completed,
            'failed' => $failed,
            'other' => max(0, $total - $pending - $processing - $completed - $failed),
        ];
    }

    public static function countsByTaskType(array $statuses): Collection
    {
        return self::query()
            ->whereIn('status', $statuses)
            ->groupBy('task_type')
            ->selectRaw('task_type, count(*) as total')
            ->pluck('total', 'task_type');
    }

    public static function liveTaskCountForWorker(string $workerId): int
    {
        return self::query()
            ->where('assigned_to', $workerId)
            ->whereIn('status', self::statuses('live'))
            ->count();
    }

    public static function pendingResultWritebackTaskIds(int $limit): array
    {
        return self::query()
            ->where('status', self::status('processing'))
            ->where('steps->result_writeback->state', 'pending')
            ->orderBy('updated_at')
            ->limit(max(1, $limit))
            ->pluck('task_id')
            ->map(static fn ($taskId): string => (string) $taskId)
            ->all();
    }

    public static function cachedCountsByTaskType(string $cacheKey, int $ttlSeconds, array $statuses): Collection
    {
        $versionedCacheKey = $cacheKey . self::CACHE_ARRAY_PAYLOAD_VERSION;
        $counts = Cache::remember($versionedCacheKey, $ttlSeconds, static function () use ($statuses): array {
            return self::query()
                ->whereIn('status', $statuses)
                ->whereNotNull('task_type')
                ->groupBy('task_type')
                ->selectRaw('task_type, count(*) as total')
                ->orderBy('task_type')
                ->pluck('total', 'task_type')
                ->map(static fn ($total): int => (int) $total)
                ->all();
        });

        return collect($counts);
    }

    public static function statusCountsForTaskType(string $taskType): Collection
    {
        return self::query()
            ->where('task_type', $taskType)
            ->groupBy('status')
            ->selectRaw('status, count(*) as aggregate')
            ->pluck('aggregate', 'status');
    }

    /**
     * Whether a worker advertising $workerCapabilities is eligible to claim this
     * task on the shared fast lane. A NULL/empty task capability is unrestricted;
     * otherwise the worker must advertise the tag.
     * Matching is done in PHP after the lockForUpdate pull, avoiding a JSON
     * predicate in the locked PostgreSQL query.
     *
     * @param array<int,string> $workerCapabilities
     */
    public function capabilityMatches(array $workerCapabilities): bool
    {
        if ($this->capability === null || $this->capability === '') {
            return true;
        }
        return in_array($this->capability, $workerCapabilities, true);
    }

    /**
     * Scope: tasks on the shared fast lane (the remote_fast execution_type).
     */
    #[Scope]
    protected function fastLane(Builder $query): Builder
    {
        return $query->where('execution_type', self::executionType('remote_fast'));
    }

    /**
     * Scope: tasks linked to a specific canonical dictionary row (Phase 5).
     */
    #[Scope]
    protected function byDictRow(Builder $query, string $language, int $rowId): Builder
    {
        return $query->where('dict_language', $language)->where('dict_row_id', $rowId);
    }

    /**
     * Phase 5 — project this task's completion back onto its linked canonical
     * dictionary row (the substrate-B status columns) so the dict row stays in
     * sync during the dual-write window. FILL-MISSING and idempotent: it never
     * clobbers a row already marked complete (has_audio / has_image true or
     * status already 'completed'), and it is wrapped so it can never fail the
     * caller's result transaction. No-op when the task is not dict-linked.
     *
     * The actual media file persistence stays the responsibility of the existing
     * writeback/timer path; this only reflects completion STATUS. Double audio
     * synthesis is separately guarded by TaskManagerService::claimAudioLock().
     */
    public function syncToDictRow(): bool
    {
        if (empty($this->dict_row_id) || empty($this->dict_row_table) || empty($this->dict_language)) {
            return false;
        }

        try {
            $conn = \App\Providers\AppTablePrefixServiceProvider::getConnection(\App\Constants\AppKeys::APPQYV1);
            $schema = \Illuminate\Support\Facades\Schema::connection($conn);
            $table = $this->dict_row_table;

            if (!$schema->hasTable($table)) {
                return false;
            }

            $db = \Illuminate\Support\Facades\DB::connection($conn);
            $row = $db->table($table)->where('id', $this->dict_row_id)->first();
            if (!$row) {
                return false;
            }

            $update = [];
            $isAudio = QueueCenterContract::isQueuePositionOrdered((string) $this->task_type);
            $isImage = $this->capability === self::capability('image')
                || $this->task_type === 'gemini_image';

            if ($isAudio && $schema->hasColumn($table, 'tts_status')) {
                $hasAudio = isset($row->has_audio) ? (bool) $row->has_audio : false;
                $ttsStatus = $row->tts_status ?? null;
                if (!$hasAudio && $ttsStatus !== 'completed') {
                    $update['tts_status'] = 'completed';
                    if ($schema->hasColumn($table, 'tts_completed_at')) {
                        $update['tts_completed_at'] = now();
                    }
                }
            } elseif ($isImage && $schema->hasColumn($table, 'image_status')) {
                $hasImage = isset($row->has_image) ? (bool) $row->has_image : false;
                $imageStatus = $row->image_status ?? null;
                if (!$hasImage && $imageStatus !== 'completed') {
                    $update['image_status'] = 'completed';
                    if ($schema->hasColumn($table, 'image_completed_at')) {
                        $update['image_completed_at'] = now();
                    }
                }
            }

            if (!empty($update)) {
                $db->table($table)->where('id', $this->dict_row_id)->update($update);
            }

            $this->sync_to_dict_at = now();
            $this->save();

            return true;
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[GlobalTask] syncToDictRow failed', [
                'task_id' => $this->task_id,
                'dict_row_id' => $this->dict_row_id,
                'dict_row_table' => $this->dict_row_table,
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Assign task to a worker
     */
    public function assignTo(string $workerId, ?int $timeoutSeconds = null)
    {
        $this->assigned_to = $workerId;
        $this->assigned_at = now();
        $this->status = self::status('assigned');

        if ($timeoutSeconds) {
            $this->timeout_at = now()->addSeconds($timeoutSeconds);
            $this->timeout_seconds = $timeoutSeconds;
        }

        $this->save();
    }

    /**
     * Release assignment (for timeout or failure)
     */
    public function releaseAssignment()
    {
        $this->assigned_to = null;
        $this->assigned_at = null;
        $this->timeout_at = null;
        $this->status = self::status('pending');
        $this->save();
    }

    /**
     * Mark as processing
     */
    public function startProcessing()
    {
        $this->status = self::status('processing');
        $this->save();
    }

    /**
     * Complete the task with result
     */
    public function complete(array $result)
    {
        $this->status = self::status('completed');
        $this->progress = 100.0;
        $this->result = $result;
        $this->save();
    }

    /**
     * Fail the task with error
     */
    public function fail(string $error)
    {
        $this->status = self::status('failed');
        $this->error = $error;
        $this->retry_count++;
        $this->save();
    }

    /**
     * Check if task can be retried
     */
    public function canRetry(): bool
    {
        return $this->retry_count < $this->max_retries;
    }

    /**
     * Scope: Get pending tasks
     */
    #[Scope]
    protected function pending(Builder $query): Builder
    {
        return $query->where('status', self::status('pending'));
    }

    /**
     * Scope: Get assigned tasks
     */
    #[Scope]
    protected function assigned(Builder $query): Builder
    {
        return $query->where('status', self::status('assigned'));
    }

    /**
     * Scope: Get timed out tasks
     *
     * Covers BOTH live worker-owned statuses: a worker that pulled a task
     * (assigned) or reported intermediate progress (processing) and then died
     * must have its task reclaimed either way. Matching only `assigned` let
     * `processing` tasks leak forever once their worker disappeared.
     */
    #[Scope]
    protected function timedOut(Builder $query): Builder
    {
        return $query->whereIn('status', [self::status('assigned'), self::status('processing')])
            ->where(function ($q) {
                // Standard path: a set timeout_at that has passed.
                $q->where(function ($q2) {
                    $q2->whereNotNull('timeout_at')
                        ->where('timeout_at', '<=', now());
                })
                // No-timeout fallback: assignTo() only sets timeout_at when
                // timeout_seconds is truthy, so a task with timeout_seconds=0/NULL
                // in assigned/processing used to strand forever - invisible to the
                // reclaim timer and only recovered if its worker went offline.
                // Reclaim such rows when they have been assigned for over an hour.
                ->orWhere(function ($q2) {
                    $q2->whereNull('timeout_at')
                        ->whereNotNull('assigned_at')
                        ->where('assigned_at', '<=', now()->subHour());
                });
            });
    }
}
