<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * Global Task Event — append-only audit log of every task lifecycle transition.
 *
 * One row is written by TaskManagerService at EVERY task transition (assigned /
 * processing / completed / failed / timeout / reclaimed / cancelled), so pycore
 * and the chrome extension can replay a task's full history via
 * GET /api/task/{id}/events without inferring state from the mutable
 * global_tasks row.
 *
 * The table carries its own created_at and is never updated, so updated_at is
 * intentionally absent — timestamps are disabled and created_at is set on write.
 */
class GlobalTaskEvent extends Model
{
    use HasFactory;

    protected $table = 'global_task_events';

    /**
     * Append-only outbox: only created_at is meaningful (set explicitly on
     * insert), so Eloquent's automatic created_at/updated_at maintenance is off.
     */
    public $timestamps = false;

    protected $fillable = [
        'task_id',
        'worker_id',
        'event',
        'attempt',
        'detail',
        'created_at',
    ];

    protected $casts = [
        'detail' => 'array',
        'attempt' => 'integer',
        'created_at' => 'datetime',
    ];

    // Event vocabulary (shared contract). These mirror the task transitions in
    // TaskManagerService — keep them in lock-step with the writes there.
    const EVENT_ASSIGNED = 'assigned';
    const EVENT_PROCESSING = 'processing';
    const EVENT_COMPLETED = 'completed';
    const EVENT_FAILED = 'failed';
    const EVENT_TIMEOUT = 'timeout';
    const EVENT_RECLAIMED = 'reclaimed';
    const EVENT_CANCELLED = 'cancelled';

    /**
     * Append one event row for a task transition. Best-effort by design — the
     * authoritative state is the global_tasks row, so an event-log write must
     * never break a worker's result/pull transaction. created_at is set here so
     * the row is correct even with timestamps disabled.
     *
     * @param string      $taskId
     * @param string      $event    One of the EVENT_* vocabulary
     * @param string|null $workerId
     * @param int         $attempt  Task retry_count at the moment of transition
     * @param array       $detail   worker_id, lane/execution_type, reason/error
     */
    public static function record(
        string $taskId,
        string $event,
        ?string $workerId = null,
        int $attempt = 0,
        array $detail = []
    ): void {
        try {
            self::create([
                'task_id' => $taskId,
                'worker_id' => $workerId,
                'event' => $event,
                'attempt' => $attempt,
                'detail' => $detail,
                'created_at' => now(),
            ]);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('[GlobalTaskEvent] record failed', [
                'task_id' => $taskId,
                'event' => $event,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Scope: events for one task, oldest first (chronological replay).
     */
    public function scopeForTask($query, string $taskId)
    {
        return $query->where('task_id', $taskId)->orderBy('id', 'asc');
    }
}
