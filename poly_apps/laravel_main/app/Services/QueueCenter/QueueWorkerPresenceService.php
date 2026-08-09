<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;
use App\Models\Worker;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class QueueWorkerPresenceService
{
    private const CACHE_KEY = 'queue_center:worker_presence:v1';
    private const CACHE_SECONDS = 3;
    private const WORKER_LIMIT = 100;

    public function snapshot(): array
    {
        return Cache::store('file')->remember(
            self::CACHE_KEY,
            self::CACHE_SECONDS,
            function (): array {
                $rows = Worker::query()
                    ->orderByDesc('last_heartbeat_at')
                    ->limit(self::WORKER_LIMIT)
                    ->get([
                        'worker_id',
                        'worker_name',
                        'processor_types',
                        'capabilities',
                        'status',
                        'last_heartbeat_at',
                        'hostname',
                    ]);
                $claimedByWorker = GlobalTask::query()
                    ->whereIn('status', [GlobalTask::status('assigned'), GlobalTask::status('processing')])
                    ->whereNotNull('assigned_to')
                    ->groupBy('assigned_to')
                    ->select('assigned_to', DB::raw('count(*) as total'))
                    ->pluck('total', 'assigned_to');
                $heartbeatFloor = now()->subSeconds(Worker::HEARTBEAT_TIMEOUT);
                $workers = [];

                foreach ($rows as $row) {
                    $processorTypes = is_array($row->processor_types) ? array_values($row->processor_types) : [];
                    $capabilities = is_array($row->capabilities) ? array_values($row->capabilities) : [];
                    $name = (string) ($row->worker_name ?? '');
                    $workers[] = [
                        'id' => (string) $row->worker_id,
                        'kind' => $this->kind($name, $processorTypes),
                        'name' => $name,
                        'processor_types' => $processorTypes,
                        'capabilities' => $capabilities,
                        'online' => $row->last_heartbeat_at !== null && $row->last_heartbeat_at >= $heartbeatFloor,
                        'last_seen' => $row->last_heartbeat_at?->toIso8601String(),
                        'claimed' => (int) ($claimedByWorker->get($row->worker_id) ?? 0),
                        'hostname' => $row->hostname !== null ? (string) $row->hostname : null,
                    ];
                }

                return $workers;
            }
        );
    }

    private function kind(string $name, array $processorTypes): string
    {
        $normalized = strtolower($name);
        if (str_contains($normalized, 'chrome')) {
            return 'chrome';
        }
        if (str_contains($normalized, 'pycore')
            || in_array(GlobalTask::executionType('remote_audio'), $processorTypes, true)
            || in_array(GlobalTask::executionType('remote_sentence_audio'), $processorTypes, true)
        ) {
            return 'pycore';
        }
        return 'worker';
    }
}
