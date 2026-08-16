<?php

namespace App\Models;

use App\Models\Concerns\UsesMainConnection;
use Illuminate\Database\Eloquent\Attributes\Scope;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use App\Models\Model;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Facades\Schema;

class Worker extends Model
{
    use HasFactory, UsesMainConnection;

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
        // Phase 2 — capability tags advertised at registration for remote_fast routing.
        'capabilities',
        'mcp_chrome_last_attempt_at',
        'last_marker',
    ];

    protected function casts(): array
    {
        return [
            'processor_types' => 'array',
            'metadata' => 'array',
            'capabilities' => 'array',
            'last_heartbeat_at' => 'datetime',
            'mcp_chrome_last_attempt_at' => 'datetime',
            'completed_tasks' => 'integer',
            'failed_tasks' => 'integer',
        ];
    }

    // Worker status constants
    const STATUS_ONLINE = 'online';
    const STATUS_OFFLINE = 'offline';
    const STATUS_BUSY = 'busy';

    /**
     * Capability tags this worker advertised (empty array when none / NULL in DB).
     *
     * @return array<int,string>
     */
    public function capabilityList(): array
    {
        return is_array($this->capabilities)
            ? array_values(array_filter($this->capabilities, 'is_string'))
            : [];
    }

    /**
     * Whether this worker advertises a given capability tag.
     */
    public function hasCapability(string $capability): bool
    {
        return in_array($capability, $this->capabilityList(), true);
    }

    // Heartbeat timeout (seconds)
    const HEARTBEAT_TIMEOUT = 120;

    public static function tableExists(): bool
    {
        $model = new static();

        return Schema::connection($model->getConnectionName())->hasTable($model->getTable());
    }

    public static function presenceRows(int $limit): EloquentCollection
    {
        return self::query()
            ->orderByDesc('last_heartbeat_at')
            ->limit($limit)
            ->get([
                'worker_id',
                'worker_name',
                'processor_types',
                'capabilities',
                'status',
                'last_heartbeat_at',
                'hostname',
            ]);
    }

    public static function purgeOfflineBefore($cutoff): int
    {
        return self::query()
            ->where('status', self::STATUS_OFFLINE)
            ->where(function ($query) use ($cutoff): void {
                $query->where('last_heartbeat_at', '<', $cutoff)
                    ->orWhere(function ($neverSeenQuery) use ($cutoff): void {
                        $neverSeenQuery->whereNull('last_heartbeat_at')
                            ->where('created_at', '<', $cutoff);
                    });
            })
            ->delete();
    }

    public static function findByWorkerId(string $workerId): ?self
    {
        return self::query()->where('worker_id', $workerId)->first();
    }

    public static function lockByWorkerId(string $workerId): ?self
    {
        return self::query()->where('worker_id', $workerId)->lockForUpdate()->first();
    }

    public static function onlineWorkers(): EloquentCollection
    {
        return self::query()->online()->get();
    }

    public static function processorTypesFor(string $workerId): array
    {
        $worker = self::query()->where('worker_id', $workerId)->first(['processor_types']);

        return $worker && is_array($worker->processor_types)
            ? array_values(array_filter($worker->processor_types, 'is_string'))
            : [];
    }

    public static function capabilitiesFor(string $workerId): array
    {
        $worker = self::query()->where('worker_id', $workerId)->first(['capabilities']);

        return $worker?->capabilityList() ?? [];
    }

    public static function offlineCandidateIds($cutoff): array
    {
        return self::query()
            ->where('last_heartbeat_at', '<', $cutoff)
            ->whereNotNull('last_heartbeat_at')
            ->where('status', '!=', self::STATUS_OFFLINE)
            ->pluck('worker_id')
            ->all();
    }

    public static function registerWorker(string $workerId, array $attributes): self
    {
        return self::query()->updateOrCreate(['worker_id' => $workerId], $attributes);
    }

    public static function orderedWorkers(): EloquentCollection
    {
        return self::query()->orderBy('status')->orderBy('worker_name')->get();
    }

    public static function statistics($aliveCutoff): array
    {
        $row = self::query()
            ->selectRaw('count(*) as total')
            ->selectRaw(
                'sum(case when status = ? and last_heartbeat_at >= ? then 1 else 0 end) as online',
                [self::STATUS_ONLINE, $aliveCutoff]
            )
            ->selectRaw(
                'sum(case when status = ? and last_heartbeat_at >= ? then 1 else 0 end) as busy',
                [self::STATUS_BUSY, $aliveCutoff]
            )
            ->selectRaw('coalesce(sum(completed_tasks), 0) as total_completed')
            ->selectRaw('coalesce(sum(failed_tasks), 0) as total_failed')
            ->first();
        $total = (int) ($row->total ?? 0);
        $online = (int) ($row->online ?? 0);
        $busy = (int) ($row->busy ?? 0);

        return [
            'total' => $total,
            'online' => $online,
            'busy' => $busy,
            'offline' => max(0, $total - $online - $busy),
            'total_completed' => (int) ($row->total_completed ?? 0),
            'total_failed' => (int) ($row->total_failed ?? 0),
        ];
    }

    public static function initializationStats(): array
    {
        return self::statistics(now()->subSeconds(self::HEARTBEAT_TIMEOUT));
    }

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
        $this->last_heartbeat_at = now();
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
    #[Scope]
    protected function online(Builder $query): Builder
    {
        return $query->whereIn('status', [self::STATUS_ONLINE, self::STATUS_BUSY])
            ->where('last_heartbeat_at', '>=', now()->subSeconds(self::HEARTBEAT_TIMEOUT));
    }

}
