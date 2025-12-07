<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Worker extends Model
{
    use HasFactory;

    protected $table = 'workers';

    protected $fillable = [
        'worker_id',
        'worker_name',
        'processor_types',
        'status',
        'last_heartbeat_at',
        'hostname',
        'platform',
        'metadata',
        'completed_tasks',
        'failed_tasks',
        'current_task_id',
    ];

    protected $casts = [
        'processor_types' => 'array',
        'metadata' => 'array',
        'last_heartbeat_at' => 'datetime',
        'completed_tasks' => 'integer',
        'failed_tasks' => 'integer',
    ];

    // Worker status constants
    const STATUS_ONLINE = 'online';
    const STATUS_OFFLINE = 'offline';
    const STATUS_BUSY = 'busy';

    // Heartbeat timeout (seconds)
    const HEARTBEAT_TIMEOUT = 120;

    /**
     * Mark worker as online
     */
    public function markOnline()
    {
        $this->status = self::STATUS_ONLINE;
        $this->last_heartbeat_at = now();
        $this->save();
    }

    /**
     * Mark worker as offline
     */
    public function markOffline()
    {
        $this->status = self::STATUS_OFFLINE;
        $this->current_task_id = null;
        $this->save();
    }

    /**
     * Send heartbeat
     */
    public function heartbeat()
    {
        $this->last_heartbeat_at = now();

        // Auto-mark as online if was offline
        if ($this->status === self::STATUS_OFFLINE) {
            $this->status = self::STATUS_ONLINE;
        }

        $this->save();
    }

    /**
     * Check if worker is alive (heartbeat within timeout)
     */
    public function isAlive(): bool
    {
        if (!$this->last_heartbeat_at) {
            return false;
        }

        return $this->last_heartbeat_at->diffInSeconds(now()) < self::HEARTBEAT_TIMEOUT;
    }

    /**
     * Check if worker can process a specific execution type
     */
    public function canProcess(string $executionType): bool
    {
        return in_array($executionType, $this->processor_types ?? []);
    }

    /**
     * Assign a task to this worker
     */
    public function assignTask(string $taskId)
    {
        $this->current_task_id = $taskId;
        $this->status = self::STATUS_BUSY;
        $this->save();
    }

    /**
     * Release current task
     */
    public function releaseTask()
    {
        $this->current_task_id = null;
        $this->status = self::STATUS_ONLINE;
        $this->save();
    }

    /**
     * Increment completed tasks counter
     */
    public function incrementCompleted()
    {
        $this->completed_tasks++;
        $this->save();
    }

    /**
     * Increment failed tasks counter
     */
    public function incrementFailed()
    {
        $this->failed_tasks++;
        $this->save();
    }

    /**
     * Scope: Get online workers
     */
    public function scopeOnline($query)
    {
        return $query->where('status', self::STATUS_ONLINE)
            ->where('last_heartbeat_at', '>=', now()->subSeconds(self::HEARTBEAT_TIMEOUT));
    }

    /**
     * Scope: Get workers that can process a specific execution type
     */
    public function scopeCanProcess($query, string $executionType)
    {
        return $query->whereJsonContains('processor_types', $executionType);
    }
}
