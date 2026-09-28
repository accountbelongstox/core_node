<?php

namespace App\Services\QueueCenter;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1TranslationEventModel;
use App\Models\GlobalTask;
use App\Models\Worker;
use App\Support\QueueCenterContract;

class QueueWorkerPresenceService
{
    private const CACHE_KEY = 'queue_center:worker_presence:v1';
    private const CACHE_SECONDS = 3;
    private const WORKER_LIMIT = 100;

    public function publishChange(?string $workerId, ?bool $online): void
    {
        $realtime = QueueCenterContract::realtime();
        $events = is_array($realtime['events'] ?? null) ? $realtime['events'] : [];
        $event = (string) ($events['worker_presence'] ?? 'worker.presence');

        QueueCenterCacheStore::get()->forget(self::CACHE_KEY);
        AppQyV1TranslationEventModel::emit($event, [
            'worker_id' => $workerId,
            'online' => $online,
            'changed_at' => now()->toIso8601String(),
        ]);
    }

    public function snapshot(): array
    {
        return QueueCenterCacheStore::get()->remember(
            self::CACHE_KEY,
            self::CACHE_SECONDS,
            function (): array {
                if (!Worker::tableExists()) {
                    return [];
                }
                $rows = Worker::presenceRows(self::WORKER_LIMIT);
                $claimedByWorker = collect();
                if (GlobalTask::tableExists()) {
                    $claimedByWorker = GlobalTask::claimedCountsByWorker([
                        GlobalTask::status('assigned'),
                        GlobalTask::status('processing'),
                    ]);
                }
                $heartbeatFloor = now()->subSeconds(Worker::HEARTBEAT_TIMEOUT);
                $workers = [];

                foreach ($rows as $row) {
                    $processorTypes = is_array($row->processor_types) ? array_values($row->processor_types) : [];
                    $capabilities = is_array($row->capabilities) ? array_values($row->capabilities) : [];
                    $name = (string) ($row->worker_name ?? '');
                    $online = $row->status !== Worker::STATUS_OFFLINE
                        && $row->last_heartbeat_at !== null
                        && $row->last_heartbeat_at >= $heartbeatFloor;
                    if (! $online) {
                        continue;
                    }
                    $workers[] = [
                        'id' => (string) $row->worker_id,
                        'kind' => $this->kind($name, $processorTypes),
                        'name' => $name,
                        'processor_types' => $processorTypes,
                        'capabilities' => $capabilities,
                        'online' => true,
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
