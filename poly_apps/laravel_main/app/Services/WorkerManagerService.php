<?php

namespace App\Services;

use App\Models\Worker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WorkerManagerService
{
    /**
     * Register a new worker or update existing one
     *
     * @param string $workerId Worker ID
     * @param string $workerName Worker name
     * @param array $processorTypes Array of execution types this worker can handle
     * @param string|null $hostname Hostname
     * @param string|null $platform Platform
     * @param array $metadata Additional metadata
     * @return Worker
     */
    public function register(
        string $workerId,
        string $workerName,
        array $processorTypes,
        ?string $hostname = null,
        ?string $platform = null,
        array $metadata = [],
        ?array $capabilities = null
    ): Worker {
        $attributes = [
            'worker_name' => $workerName,
            'processor_types' => $processorTypes,
            'hostname' => $hostname,
            'platform' => $platform,
            'metadata' => $metadata,
            'status' => Worker::STATUS_ONLINE,
            'last_heartbeat_at' => now(),
        ];

        // Only overwrite capabilities when the caller actually sent them, so a
        // legacy worker re-registering without the field keeps any previously
        // stored capabilities instead of clearing them.
        if ($capabilities !== null) {
            $attributes['capabilities'] = array_values(array_filter($capabilities, 'is_string'));
        }

        $worker = Worker::updateOrCreate(
            ['worker_id' => $workerId],
            $attributes
        );

        Log::info('Worker registered', [
            'worker_id' => $workerId,
            'worker_name' => $workerName,
            'processor_types' => $processorTypes,
            'capabilities' => $capabilities,
        ]);

        return $worker;
    }

    /**
     * Send heartbeat from worker
     *
     * @param string $workerId Worker ID
     * @return bool Success
     */
    public function heartbeat(string $workerId): bool
    {
        $worker = Worker::where('worker_id', $workerId)->first();

        if (!$worker) {
            Log::warning('Heartbeat from unregistered worker', ['worker_id' => $workerId]);
            return false;
        }

        $worker->heartbeat();

        Log::debug('Worker heartbeat', [
            'worker_id' => $workerId,
            'status' => $worker->status,
        ]);

        return true;
    }

    /**
     * Unregister a worker
     *
     * @param string $workerId Worker ID
     * @return bool Success
     */
    public function unregister(string $workerId): bool
    {
        $worker = Worker::where('worker_id', $workerId)->first();

        if (!$worker) {
            return false;
        }

        $worker->markOffline();

        Log::info('Worker unregistered', ['worker_id' => $workerId]);

        return true;
    }

    /**
     * Get all workers
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getAllWorkers()
    {
        return Worker::orderBy('status')->orderBy('worker_name')->get();
    }

    /**
     * Get worker statistics
     *
     * @return array Statistics
     */
    public function getWorkerStats(): array
    {
        // On the Task Center overview poll (~5s) this fired 6 separate aggregates
        // over the workers table every hit. Memoize briefly so the shell poll
        // shares one snapshot (worker counts change slowly); the short TTL bounds
        // staleness and this matters on the single-worker php -S runtime where
        // every round-trip serializes.
        // File store (not the configured `database` default, whose `cache` table
        // is not provisioned by any migration); persists across php -S requests.
        return Cache::store('file')->remember('workers:stats', 3, static function (): array {
            return [
                'total' => Worker::count(),
                'online' => Worker::where('status', Worker::STATUS_ONLINE)->count(),
                'busy' => Worker::where('status', Worker::STATUS_BUSY)->count(),
                'offline' => Worker::where('status', Worker::STATUS_OFFLINE)->count(),
                'total_completed' => Worker::sum('completed_tasks'),
                'total_failed' => Worker::sum('failed_tasks'),
            ];
        });
    }
}
