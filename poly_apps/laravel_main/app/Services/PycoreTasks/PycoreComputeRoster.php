<?php

namespace App\Services\PycoreTasks;

use App\Models\GlobalTask;
use App\Models\Worker;
use App\Support\QueueCenterContract;
use Illuminate\Support\Collection;

/**
 * Compute-class scheduling over the registered pycores.
 *
 * A pycore reports `compute_class` (gpu | cpu_only, optional gpu_name and
 * gpu_vram_mb) at registration and on every pull; it is kept in worker
 * metadata. A task type declares `compute` in the contract:
 * - gpu_required: gpu pycores only;
 * - gpu_preferred: a cpu_only pycore claims only while no fresh gpu pycore of
 *   that execution type has spare lease capacity;
 * - cpu_ok: any pycore.
 * A task type with per-language classes (compute_by_language) is held to its
 * strictest class here: global tasks carry no language at this level.
 * Within the eligible set, a pycore whose in-flight count exceeds the least
 * loaded fresh peer by at least that peer's lease capacity is held back.
 * Workers without a compute class (browser workers) are not pycores and are
 * never filtered.
 */
final class PycoreComputeRoster
{
    public const CLASS_GPU = 'gpu';
    public const CLASS_CPU_ONLY = 'cpu_only';
    public const CLASSES = [self::CLASS_GPU, self::CLASS_CPU_ONLY];
    /** Class name API clients see (work_nodes): cpu_only is published as cpu. */
    public const PUBLIC_CLASS_CPU = 'cpu';
    public const METADATA_FIELDS = ['compute_class', 'gpu_name', 'gpu_vram_mb'];
    /** One roster read serves a whole batch request (per worker process). */
    private const AVAILABILITY_MEMO_SECONDS = 5;

    /** @var array<string, array{at: float, value: array}> */
    private static array $availabilityMemo = [];

    /** The class name a work_nodes client sees: gpu or cpu. */
    public static function publicClass(?string $class): string
    {
        return $class === self::CLASS_GPU ? self::CLASS_GPU : self::PUBLIC_CLASS_CPU;
    }

    /** Whether this worker's compute class can run $taskType at all (accept path). */
    public static function canRun(string $workerId, string $taskType): bool
    {
        $worker = Worker::findByWorkerId($workerId);
        $class = $worker !== null ? self::classOf($worker) : null;

        return $class === null || self::satisfies($class, QueueCenterContract::taskTypeComputeStrictest($taskType));
    }

    /** Whether a reported compute class can run $taskType (for a pycore not registered yet). */
    public static function classCanRun(string $class, string $taskType): bool
    {
        return self::satisfies($class, QueueCenterContract::taskTypeComputeStrictest($taskType));
    }

    /** Whether this worker may be offered tasks of $taskType now (class, GPU preference, load). */
    public static function mayClaim(string $workerId, string $taskType): bool
    {
        $worker = Worker::findByWorkerId($workerId);
        $class = $worker !== null ? self::classOf($worker) : null;
        $required = QueueCenterContract::taskTypeComputeStrictest($taskType);
        $peers = null;
        $loads = [];
        $self = 0;
        $least = null;

        if ($worker === null || $class === null) {
            return $worker !== null;
        }
        if (!self::satisfies($class, $required)) {
            return false;
        }
        $peers = self::freshEligible($taskType);
        $loads = GlobalTask::liveTaskCountsByWorker($peers->pluck('worker_id')->push($workerId)->unique()->values()->all());
        if ($required === QueueCenterContract::COMPUTE_GPU_PREFERRED && $class !== self::CLASS_GPU) {
            foreach ($peers as $peer) {
                if (self::classOf($peer) === self::CLASS_GPU && ($loads[$peer->worker_id] ?? 0) < self::leaseCapacity($peer)) {
                    return false;
                }
            }
        }
        $self = $loads[$workerId] ?? 0;
        foreach ($peers as $peer) {
            if ($peer->worker_id !== $workerId && self::classOf($peer) === $class
                && ($least === null || ($loads[$peer->worker_id] ?? 0) < ($loads[$least->worker_id] ?? 0))) {
                $least = $peer;
            }
        }

        return $least === null || $self - ($loads[$least->worker_id] ?? 0) < self::leaseCapacity($least);
    }

    /**
     * Roster view used by the pycore_unavailable response.
     *
     * @return array{registered_pycores: int, eligible_pycores: int, online_pycores: int, last_seen_at: ?string}
     */
    public static function availability(string $taskType): array
    {
        $memo = self::$availabilityMemo[$taskType] ?? null;

        if ($memo !== null && microtime(true) - $memo['at'] < self::AVAILABILITY_MEMO_SECONDS) {
            return $memo['value'];
        }
        $value = self::computeAvailability($taskType);
        self::$availabilityMemo[$taskType] = ['at' => microtime(true), 'value' => $value];

        return $value;
    }

    private static function computeAvailability(string $taskType): array
    {
        $required = QueueCenterContract::taskTypeComputeStrictest($taskType);
        $registered = Worker::pycoresServing((string) QueueCenterContract::taskTypeExecution($taskType));
        $eligible = $registered->filter(static fn (Worker $worker): bool => self::satisfies((string) self::classOf($worker), $required));
        $lastSeen = $eligible->max(static fn (Worker $worker) => $worker->last_heartbeat_at);

        return [
            'registered_pycores' => $registered->count(),
            'eligible_pycores' => $eligible->count(),
            'online_pycores' => $eligible->filter(static fn (Worker $worker): bool => self::isOnline($worker))->count(),
            'last_seen_at' => $lastSeen?->toIso8601String(),
        ];
    }

    /** Compute fields of a registration or pull body, for worker metadata. */
    public static function metadataFrom(array $validated): array
    {
        return array_intersect_key($validated, array_flip(self::METADATA_FIELDS));
    }

    private static function freshEligible(string $taskType): Collection
    {
        $required = QueueCenterContract::taskTypeComputeStrictest($taskType);

        return Worker::pycoresServing((string) QueueCenterContract::taskTypeExecution($taskType))
            ->filter(static fn (Worker $worker): bool => self::isOnline($worker)
                && self::satisfies((string) self::classOf($worker), $required))
            ->values();
    }

    private static function satisfies(string $class, string $required): bool
    {
        return $required !== QueueCenterContract::COMPUTE_GPU_REQUIRED || $class === self::CLASS_GPU;
    }

    /** A node's kind: its compute class (gpu | cpu_only) from registration or a lease claim; never a platform. */
    public static function classOf(Worker $worker): ?string
    {
        $class = is_array($worker->metadata) ? ($worker->metadata['compute_class'] ?? null) : null;

        return in_array($class, self::CLASSES, true) ? $class : null;
    }

    private static function isOnline(Worker $worker): bool
    {
        return $worker->status !== Worker::STATUS_OFFLINE && $worker->isAlive();
    }

    private static function leaseCapacity(Worker $worker): int
    {
        $capacity = is_array($worker->metadata) ? (int) ($worker->metadata['lease_capacity'] ?? 0) : 0;

        return $capacity > 0 ? $capacity : QueueCenterContract::taskLimit('worker_pull_default');
    }

    private function __construct()
    {
    }
}
