<?php

namespace App\Models;

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
    ];

    // Task status constants
    const STATUS_PENDING = 'pending';
    const STATUS_ASSIGNED = 'assigned';
    const STATUS_PROCESSING = 'processing';
    const STATUS_COMPLETED = 'completed';
    const STATUS_COMPLETED_DEMO = 'completed_demo';
    const STATUS_FAILED = 'failed';
    const STATUS_CANCELLED = 'cancelled';

    // Execution type constants
    const EXECUTION_LOCAL_TIMER = 'local_timer';
    const EXECUTION_REMOTE_CLIENT = 'remote_client';
    const EXECUTION_REMOTE_COMPUTE = 'remote_compute';
    const EXECUTION_REMOTE_OCR = 'remote_ocr';
    const EXECUTION_REMOTE_TRANSLATION = 'remote_translation';
    const EXECUTION_REMOTE_VIDEO = 'remote_video';
    const EXECUTION_REMOTE_IO = 'remote_io';

    /**
     * Assign task to a worker
     */
    public function assignTo(string $workerId, ?int $timeoutSeconds = null)
    {
        $this->assigned_to = $workerId;
        $this->assigned_at = now();
        $this->status = self::STATUS_ASSIGNED;

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
        $this->status = self::STATUS_PENDING;
        $this->save();
    }

    /**
     * Mark as processing
     */
    public function startProcessing()
    {
        $this->status = self::STATUS_PROCESSING;
        $this->save();
    }

    /**
     * Complete the task with result
     */
    public function complete(array $result)
    {
        $this->status = self::STATUS_COMPLETED;
        $this->progress = 100.0;
        $this->result = $result;
        $this->save();
    }

    /**
     * Fail the task with error
     */
    public function fail(string $error)
    {
        $this->status = self::STATUS_FAILED;
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
        return $query->where('status', self::STATUS_PENDING);
    }

    /**
     * Scope: Get assigned tasks
     */
    public function scopeAssigned($query)
    {
        return $query->where('status', self::STATUS_ASSIGNED);
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
        return $query->whereIn('status', [self::STATUS_ASSIGNED, self::STATUS_PROCESSING])
            ->whereNotNull('timeout_at')
            ->where('timeout_at', '<=', now());
    }
}
