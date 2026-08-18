<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;

final class QueueCenterMetricsService
{
    private const CACHE_PREFIX = 'queue_center:metrics:v1:';
    private const CACHE_SECONDS = 2;

    public function snapshot(string $taskType): array
    {
        return QueueCenterCacheStore::get()->remember(
            self::CACHE_PREFIX . $taskType,
            self::CACHE_SECONDS,
            static function () use ($taskType): array {
                $counts = GlobalTask::statusCountsForTaskType($taskType);
                $pending = (int) ($counts[GlobalTask::status('pending')] ?? 0);
                $assigned = (int) ($counts[GlobalTask::status('assigned')] ?? 0);
                $processing = (int) ($counts[GlobalTask::status('processing')] ?? 0);
                $completed = (int) ($counts[GlobalTask::status('completed')] ?? 0)
                    + (int) ($counts[GlobalTask::status('completed_demo')] ?? 0);

                return [
                    'completed' => $completed,
                    'total' => array_sum(array_map('intval', $counts->all())),
                    'live_total' => $pending + $assigned + $processing,
                    'pending' => $pending,
                    'assigned' => $assigned,
                    'processing' => $processing,
                    'failed' => (int) ($counts[GlobalTask::status('failed')] ?? 0),
                ];
            }
        );
    }

    public function invalidate(string $taskType): void
    {
        QueueCenterCacheStore::get()->forget(self::CACHE_PREFIX . $taskType);
    }

    public function progress(string $taskType): array
    {
        $snapshot = $this->snapshot($taskType);

        return [
            'completed' => (int) ($snapshot['completed'] ?? 0),
            'total' => (int) ($snapshot['total'] ?? 0),
            'pending' => (int) ($snapshot['pending'] ?? 0),
            'assigned' => (int) ($snapshot['assigned'] ?? 0),
            'processing' => (int) ($snapshot['processing'] ?? 0),
            'failed' => (int) ($snapshot['failed'] ?? 0),
        ];
    }

    public function liveQueue(string $taskType): array
    {
        $snapshot = $this->snapshot($taskType);

        return [
            'pending' => (int) ($snapshot['pending'] ?? 0),
            'assigned' => (int) ($snapshot['assigned'] ?? 0),
            'processing' => (int) ($snapshot['processing'] ?? 0),
            'total' => (int) ($snapshot['live_total'] ?? 0),
        ];
    }
}
