<?php

namespace App\Services;

use App\Models\Worker;
use App\Services\QueueCenter\QueueWorkerPresenceService;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WorkerManagerService
{
    private const PULL_HEARTBEAT_REFRESH_SECONDS = 30;
    private QueueWorkerPresenceService $workerPresence;

    public function __construct(QueueWorkerPresenceService $workerPresence)
    {
        $this->workerPresence = $workerPresence;
    }

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
        ?array $capabilities = null,
        bool $fromPull = false
    ): Worker {
        $existingWorker = Worker::findByWorkerId($workerId);
        $wasOnline = $this->isVisibleOnline($existingWorker);
        $worker = $fromPull ? $existingWorker : null;
        $attributes = [
            'worker_name' => $workerName,
            'processor_types' => $processorTypes,
            'hostname' => $hostname,
            'platform' => $platform,
            'metadata' => $metadata,
        ];

        // Only overwrite capabilities when the caller actually sent them, so a
        // legacy worker re-registering without the field keeps any previously
        // stored capabilities instead of clearing them.
        if ($capabilities !== null) {
            $attributes['capabilities'] = array_values(array_filter($capabilities, 'is_string'));
        }

        if ($worker === null) {
            $worker = Worker::registerWorker(
                $workerId,
                array_merge($attributes, [
                    'status' => Worker::STATUS_ONLINE,
                    'last_heartbeat_at' => now(),
                ])
            );
        } else {
            $worker->fill($attributes);
            if ($worker->status === Worker::STATUS_OFFLINE) {
                $worker->status = Worker::STATUS_ONLINE;
            }
            if (
                $worker->last_heartbeat_at === null
                || $worker->last_heartbeat_at->lte(now()->subSeconds(self::PULL_HEARTBEAT_REFRESH_SECONDS))
            ) {
                $worker->last_heartbeat_at = now();
            }
            if ($worker->isDirty()) {
                $worker->saveRecord();
            }
        }

        if (!$wasOnline) {
            $this->workerPresence->publishChange($workerId, true);
        }

        $logContext = [
            'worker_id' => $workerId,
            'worker_name' => $workerName,
            'processor_types' => $processorTypes,
            'capabilities' => $capabilities,
        ];

        if ($fromPull && $worker->wasRecentlyCreated) {
            Log::info('Worker discovered from queue pull', $logContext);
        } elseif ($fromPull) {
            Log::debug('Worker refreshed from queue pull', $logContext);
        } else {
            Log::info('Worker registered', $logContext);
        }

        return $worker;
    }

    /**
     * Send heartbeat from worker
     *
     * @param string $workerId Worker ID
     * @return bool Success
     */
    public function heartbeat(string $workerId, ?array $capabilities = null): bool
    {
        $worker = Worker::findByWorkerId($workerId);
        $wasOnline = $this->isVisibleOnline($worker);

        if (!$worker) {
            Log::warning('Heartbeat from unregistered worker', ['worker_id' => $workerId]);
            return false;
        }

        if ($capabilities !== null) {
            $worker->capabilities = array_values(array_filter($capabilities, 'is_string'));
        }
        $worker->heartbeat();

        if (!$wasOnline) {
            $this->workerPresence->publishChange($workerId, true);
        }

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
        $worker = Worker::findByWorkerId($workerId);
        $wasOnline = $this->isVisibleOnline($worker);

        if (!$worker) {
            return false;
        }

        $worker->markOffline();

        if ($wasOnline) {
            $this->workerPresence->publishChange($workerId, false);
        }

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
        return Worker::orderedWorkers();
    }

    /**
     * Return the canonical worker summaries shared by list and overview APIs.
     */
    public function getWorkerSummaries()
    {
        return $this->getAllWorkers()->map(static function (Worker $worker): array {
            return [
                'worker_id' => $worker->worker_id,
                'worker_name' => $worker->worker_name,
                'processor_types' => $worker->processor_types,
                'status' => $worker->isAlive() ? $worker->status : Worker::STATUS_OFFLINE,
                'hostname' => $worker->hostname,
                'platform' => $worker->platform,
                'completed_tasks' => $worker->completed_tasks,
                'failed_tasks' => $worker->failed_tasks,
                'current_task_id' => $worker->current_task_id,
                'last_heartbeat_at' => $worker->last_heartbeat_at?->toISOString(),
                'created_at' => $worker->created_at?->toISOString(),
            ];
        })->values();
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
            $aliveCutoff = now()->subSeconds(Worker::HEARTBEAT_TIMEOUT);
            return Worker::statistics($aliveCutoff);
        });
    }

    private function isVisibleOnline(?Worker $worker): bool
    {
        return $worker !== null
            && $worker->status !== Worker::STATUS_OFFLINE
            && $worker->last_heartbeat_at !== null
            && $worker->last_heartbeat_at->gte(now()->subSeconds(Worker::HEARTBEAT_TIMEOUT));
    }
}
