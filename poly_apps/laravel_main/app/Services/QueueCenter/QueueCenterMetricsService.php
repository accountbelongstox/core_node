<?php

namespace App\Services\QueueCenter;

use App\Support\QueueProgress;
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

    /** The contract progress_template of one task queue (per-language when tiered). */
    public function progress(string $taskType): array
    {
        $snapshot = [];
        $gapLanguages = $this->gapLanguages($taskType);

        // Gap lanes report the gap itself (the same counts as their listings),
        // never the materialized tasks, so lane progress and listing agree.
        if ($gapLanguages !== null) {
            return QueueProgress::make(
                array_sum(array_column($gapLanguages, 'done')),
                array_sum(array_column($gapLanguages, 'failed')),
                array_sum(array_column($gapLanguages, 'pending')),
                null,
                $gapLanguages
            );
        }
        $snapshot = $this->snapshot($taskType);

        return QueueProgress::make(
            (int) ($snapshot['completed'] ?? 0),
            (int) ($snapshot['failed'] ?? 0),
            (int) ($snapshot['live_total'] ?? 0),
            null,
            $this->languageTiers($taskType)
        );
    }

    /**
     * Per-language gap counts of a gap lane (word_audio: dictionary rows;
     * sentence_audio: live sentence rows), only languages holding rows; null
     * for a task queue.
     *
     * @return array<string, array{done: int, failed: int, pending: int}>|null
     */
    private function gapLanguages(string $taskType): ?array
    {
        if (!in_array($taskType, [QueueCenterService::QUEUE_WORD_AUDIO, QueueCenterService::QUEUE_SENTENCE_AUDIO], true)) {
            return null;
        }

        return array_map(
            static fn (array $row): array => ['done' => $row['done'], 'failed' => $row['failed'], 'pending' => $row['pending']],
            GapLaneSnapshot::lane($taskType)
        );
    }

    /**
     * Per-language {done, failed, pending} for the contract language_priority
     * tiers of a task type (empty for un-tiered types).
     *
     * @return array<string, array{done: int, failed: int, pending: int}>
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
                $live = QueueCenterContract::taskStatuses('live');
                foreach (GlobalTask::languageStatusCountsForTaskType($taskType) as $row) {
                    $language = (string) ($row->language_key ?? '');
                    $status = (string) ($row->status_key ?? '');
                    $aggregate = (int) ($row->aggregate ?? 0);
                    if ($language === '' || !isset($counts[$language])) {
                        $counts[$language] = ['done' => 0, 'failed' => 0, 'pending' => 0];
                    }
                    if ($status === GlobalTask::status('completed') || $status === GlobalTask::status('completed_demo')) {
                        $counts[$language]['done'] += $aggregate;
                    } elseif ($status === GlobalTask::status('failed')) {
                        $counts[$language]['failed'] += $aggregate;
                    } elseif (in_array($status, $live, true)) {
                        $counts[$language]['pending'] += $aggregate;
                    }
                }
                return array_intersect_key($counts, array_flip($tiers));
            }
        );
    }

    public function liveQueue(string $taskType): array
    {
        $snapshot = $this->snapshot($taskType);
        if ($taskType === QueueCenterService::QUEUE_WORD_AUDIO) {
            $backlog = array_sum(array_column(GapLaneSnapshot::lane($taskType), 'gap'));
            $assigned = min($backlog, (int) ($snapshot['assigned'] ?? 0));
            $processing = min(
                max(0, $backlog - $assigned),
                (int) ($snapshot['processing'] ?? 0)
            );

            return [
                'pending' => max(0, $backlog - $assigned - $processing),
                'assigned' => $assigned,
                'processing' => $processing,
                'total' => $backlog,
            ];
        }

        return [
            'pending' => (int) ($snapshot['pending'] ?? 0),
            'assigned' => (int) ($snapshot['assigned'] ?? 0),
            'processing' => (int) ($snapshot['processing'] ?? 0),
            'total' => (int) ($snapshot['live_total'] ?? 0),
        ];
    }
}
