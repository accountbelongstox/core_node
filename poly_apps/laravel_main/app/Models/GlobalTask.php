<?php

namespace App\Models;

use App\Support\QueueCenterContract;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class GlobalTask extends Model
{
    use HasFactory;

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

    protected $casts = [
        'payload' => 'array',
        'steps' => 'array',
        'result' => 'array',
        'progress' => 'float',
        'assigned_at' => 'datetime',
        'timeout_at' => 'datetime',
        'completed_at' => 'datetime',
        'priority' => 'integer',
        'retry_count' => 'integer',
        'max_retries' => 'integer',
        'timeout_seconds' => 'integer',
        // Phase 2 / Phase 5 additions.
        'is_fast_tier' => 'boolean',
        'dict_row_id' => 'integer',
        'sync_to_dict_at' => 'datetime',
    ];

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
        if (!in_array($name, QueueCenterContract::taskStatuses(), true)) {
            throw new \InvalidArgumentException("Unknown global-task status: {$name}");
        }
        return $name;
    }

    public static function statuses(string $group = 'all'): array
    {
        return QueueCenterContract::taskStatuses($group);
    }

    public static function executionType(string $name): string
    {
        if (!in_array($name, QueueCenterContract::taskExecutionTypes(), true)) {
            throw new \InvalidArgumentException("Unknown global-task execution type: {$name}");
        }
        return $name;
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

    /**
     * Whether a worker advertising $workerCapabilities is eligible to claim this
     * task on the shared fast lane. A NULL/empty task capability means ANY worker
     * may claim it (back-compat); otherwise the worker must advertise the tag.
     * Matching is done in PHP (after the lockForUpdate pull) so it behaves
     * identically on pgsql and sqlite — no JSON_CONTAINS in the WHERE clause.
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
    public function scopeFastLane($query)
    {
        return $query->where('execution_type', self::executionType('remote_fast'));
    }

    /**
     * Scope: tasks linked to a specific canonical dictionary row (Phase 5).
     */
    public function scopeByDictRow($query, string $language, int $rowId)
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
            $isAudio = $this->capability === self::capability('audio')
                || in_array($this->task_type, ['word_audio', 'article_audio'], true);
            $isImage = $this->capability === self::capability('image')
                || in_array($this->task_type, ['word_media', 'gemini_image'], true);

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
    public function scopePending($query)
    {
        return $query->where('status', self::status('pending'));
    }

    /**
     * Scope: Get assigned tasks
     */
    public function scopeAssigned($query)
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
    public function scopeTimedOut($query)
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
