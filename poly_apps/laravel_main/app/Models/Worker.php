<?php

namespace App\Models;

use App\Support\QueueCenterContract;
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
    private const LANE_DECLARED_AT = 'declared_at';

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

    /** Heartbeat freshness window (task_contract.limits.worker_heartbeat_ttl_seconds). */
    public static function heartbeatTtlSeconds(): int
    {
        return QueueCenterContract::taskLimit('worker_heartbeat_ttl_seconds');
    }

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

    /**
     * Registered pycores (workers that report a compute class in metadata)
     * serving one execution type, any heartbeat age.
     */
    public static function pycoresServing(string $executionType): EloquentCollection
    {
        return self::query()
            ->get(['worker_id', 'processor_types', 'metadata', 'status', 'last_heartbeat_at'])
            ->filter(static fn (self $worker): bool => is_array($worker->metadata)
                && is_string($worker->metadata['compute_class'] ?? null)
                && in_array($executionType, (array) $worker->processor_types, true))
            ->values();
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

    /**
     * Records a work-lease node seen now (a claim or renew doubles as its
     * heartbeat): compute class, declared lanes, its throughput seed and its
     * identity (platform, host label; only the fields the claim carried).
     */
    public static function touchWorkNode(string $workerId, string $computeClass, array $lanes, array $throughputSeed, array $identity = []): self
    {
        $worker = self::findByWorkerId($workerId) ?? new self([
            'worker_id' => $workerId,
            'worker_name' => $workerId,
            'processor_types' => [],
        ]);
        $metadata = is_array($worker->metadata) ? $worker->metadata : [];
        $metadata['compute_class'] = $computeClass;
        if ($identity !== []) {
            $metadata['work_identity'] = array_merge((array) ($metadata['work_identity'] ?? []), $identity);
        }
        // One worker may claim for one lane at a time: merge, never replace;
        // each lane carries its own declaration time (liveWorkLanes).
        $metadata['work_lanes'] = array_merge(
            (array) ($metadata['work_lanes'] ?? []),
            array_map(static fn (array $spec): array => [self::LANE_DECLARED_AT => time()] + $spec, $lanes)
        );
        $metadata['work_throughput_seed'] = array_merge((array) ($metadata['work_throughput_seed'] ?? []), $throughputSeed);
        $worker->metadata = $metadata;
        $worker->status = self::STATUS_ONLINE;
        $worker->last_heartbeat_at = now();
        $worker->save();

        return $worker;
    }

    /**
     * Work-lease facts a claim wrote into metadata (lanes, identity, throughput
     * seed): a register carries its own metadata and must not wipe them, or a
     * node that only renews (a lane holding a large batch) vanishes from the roster.
     *
     * @return array<string,mixed>
     */
    public static function workLeaseMetadata(?self $worker): array
    {
        $metadata = $worker !== null && is_array($worker->metadata) ? $worker->metadata : [];

        return array_intersect_key($metadata, array_flip(['work_lanes', 'work_identity', 'work_throughput_seed']));
    }

    /**
     * A renew is the heartbeat of the node and of the lanes its renewed leases
     * cover; a lane the node record lost is restored from the leases' languages.
     *
     * @param array<string,array<int,string>> $laneLanguages lane => languages of its renewed leases
     */
    public static function touchWorkLanes(string $workerId, array $laneLanguages): void
    {
        $worker = self::findByWorkerId($workerId);
        $metadata = [];

        if ($worker === null) {
            return;
        }
        $metadata = is_array($worker->metadata) ? $worker->metadata : [];
        foreach ($laneLanguages as $lane => $languages) {
            $metadata['work_lanes'][$lane] ??= ['languages' => array_values(array_unique($languages)), 'engines' => [], 'max_items' => 0];
            $metadata['work_lanes'][$lane][self::LANE_DECLARED_AT] = time();
        }
        $worker->metadata = $metadata;
        $worker->status = self::STATUS_ONLINE;
        $worker->last_heartbeat_at = now();
        $worker->save();
    }

    /**
     * Lanes this node still works: declared by a claim or kept by a renew
     * within $ttlSeconds. A lane the node stopped drops out after one TTL, so
     * it no longer keeps cpu nodes off a gpu_preferred lane.
     *
     * @return array<string,array>
     */
    public function liveWorkLanes(int $ttlSeconds): array
    {
        $cutoff = time() - $ttlSeconds;

        return array_filter(
            (array) ($this->metadata['work_lanes'] ?? []),
            static fn ($spec): bool => is_array($spec) && (int) ($spec[self::LANE_DECLARED_AT] ?? 0) >= $cutoff
        );
    }

    /** Node key of a worker: the device id its claim reported, else its own worker id. */
    public static function nodeKeyOf(string $workerId): string
    {
        $worker = self::query()->where('worker_id', $workerId)->first(['worker_id', 'metadata']);

        return $worker !== null ? self::nodeKeyFor($worker) : $workerId;
    }

    public static function nodeKeyFor(self $worker): string
    {
        $nodeId = trim((string) (is_array($worker->metadata) ? ($worker->metadata['work_identity']['node_id'] ?? '') : ''));

        return $nodeId !== '' ? 'node:' . $nodeId : (string) $worker->worker_id;
    }

    /** Offline lease-node rows of the same device as $workerId (older than $olderThanSeconds): a device that re-registers leaves no stale rows. */
    public static function dropOfflineSiblings(string $workerId, int $olderThanSeconds): int
    {
        $worker = self::query()->where('worker_id', $workerId)->first(['worker_id', 'metadata']);
        $key = $worker !== null ? self::nodeKeyFor($worker) : '';
        $cutoff = now()->subSeconds($olderThanSeconds);
        $stale = [];

        if (!str_starts_with($key, 'node:')) {
            return 0;
        }
        foreach (self::workNodes() as $other) {
            if ($other->worker_id !== $workerId && self::nodeKeyFor($other) === $key && ($other->last_heartbeat_at === null || $other->last_heartbeat_at->lt($cutoff))) {
                $stale[] = $other->worker_id;
            }
        }

        return $stale === [] ? 0 : self::query()->whereIn('worker_id', $stale)->delete();
    }

    /** Lease-node rows silent for $olderThanSeconds are dropped (the roster already hides them). */
    public static function dropStaleWorkNodes(int $olderThanSeconds): int
    {
        $cutoff = now()->subSeconds($olderThanSeconds);
        $stale = self::workNodes()
            ->filter(static fn (self $w): bool => $w->last_heartbeat_at === null || $w->last_heartbeat_at->lt($cutoff))
            ->pluck('worker_id')
            ->all();

        return $stale === [] ? 0 : self::query()->whereIn('worker_id', $stale)->delete();
    }

    /** Nodes that declared work-lease lanes. */
    public static function workNodes(): EloquentCollection
    {
        return self::query()
            ->whereNotNull('metadata')
            ->get(['worker_id', 'metadata', 'status', 'last_heartbeat_at'])
            ->filter(static fn (self $worker): bool => is_array($worker->metadata) && is_array($worker->metadata['work_lanes'] ?? null))
            ->values();
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
        return self::statistics(now()->subSeconds(self::heartbeatTtlSeconds()));
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

        return $this->last_heartbeat_at->diffInSeconds(now()) < self::heartbeatTtlSeconds();
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
    public function releaseTask(?string $taskId = null)
    {
        $nextTaskId = GlobalTask::query()
            ->where('assigned_to', $this->worker_id)
            ->whereIn('status', GlobalTask::statuses('live'))
            ->when($taskId !== null, static function (Builder $query) use ($taskId): void {
                $query->where('task_id', '!=', $taskId);
            })
            ->orderBy('assigned_at')
            ->value('task_id');

        $this->current_task_id = is_string($nextTaskId) ? $nextTaskId : null;
        $this->status = $this->current_task_id === null
            ? self::STATUS_ONLINE
            : self::STATUS_BUSY;
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
            ->where('last_heartbeat_at', '>=', now()->subSeconds(self::heartbeatTtlSeconds()));
    }

}
