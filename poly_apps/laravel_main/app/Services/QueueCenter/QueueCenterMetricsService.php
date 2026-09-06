<?php

namespace App\Services\QueueCenter;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

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
        QueueCenterCacheStore::get()->forget(self::CACHE_PREFIX . $taskType . ':tiers');
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
            'language_tiers' => $this->languageTiers($taskType),
        ];
    }

    /**
     * Completion progress per contract language_priority tier. Empty array for
     * un-tiered task types; otherwise one entry per tier language with
     * completed/total so remote workers can log e.g. remote en completion.
     */
    public function languageTiers(string $taskType): array
    {
        $tiers = QueueCenterContract::taskLanguagePriority($taskType);
        if ($tiers === []) {
            return [];
        }
        return QueueCenterCacheStore::get()->remember(
            self::CACHE_PREFIX . $taskType . ':tiers',
            self::CACHE_SECONDS,
            static function () use ($taskType, $tiers): array {
                $counts = [];
                foreach (GlobalTask::languageStatusCountsForTaskType($taskType) as $row) {
                    $language = (string) ($row->language_key ?? '');
                    $status = (string) ($row->status_key ?? '');
                    $aggregate = (int) ($row->aggregate ?? 0);
                    if ($language === '' || !isset($counts[$language])) {
                        $counts[$language] = ['completed' => 0, 'total' => 0];
                    }
                    $counts[$language]['total'] += $aggregate;
                    if ($status === GlobalTask::status('completed')
                        || $status === GlobalTask::status('completed_demo')) {
                        $counts[$language]['completed'] += $aggregate;
                    }
                }
                $tiersProgress = [];
                foreach ($tiers as $tier) {
                    if (isset($counts[$tier])) {
                        $tiersProgress[$tier] = $counts[$tier];
                    }
                }
                return $tiersProgress;
            }
        );
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
