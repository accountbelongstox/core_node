<?php

namespace App\Services;

use App\Apps\AppQyV1\AppQyV1Services\AppQyV1AssistService;
use App\Models\GlobalTask;
use App\Models\Worker;
use App\Support\QueueCenterContract;

final class TaskCenterSummaryService
{
    private const TIMER_QUEUE_ROLES = [
        'app_qy_v1_word_translation_scan_task' => [
            'role' => 'producer',
            'target' => 'word_translation',
        ],
        'app_qy_v1_dictionary_translation_task' => [
            'role' => 'producer',
            'target' => 'dictionary_explanation',
        ],
        'app_qy_v1_word_translation_filler_task' => [
            'role' => 'consumer',
            'target' => 'word_translation',
            'worker_id' => 'laravel-internal-ai',
        ],
        'global_task_maintenance_task' => [
            'role' => 'maintainer',
            'target' => '*',
        ],
    ];

    private AppQyV1AssistService $assistService;
    private TaskManagerService $taskManager;
    private WorkerManagerService $workerManager;

    public function __construct(
        AppQyV1AssistService $assistService,
        TaskManagerService $taskManager,
        WorkerManagerService $workerManager
    ) {
        $this->assistService = $assistService;
        $this->taskManager = $taskManager;
        $this->workerManager = $workerManager;
    }

    public function overview(): array
    {
        $timerStatus = OctaneTimerService::getStatus();
        $timerTasks = isset($timerStatus['tasks']) && is_array($timerStatus['tasks'])
            ? $timerStatus['tasks']
            : [];
        $schedulerTasks = [];
        $relations = [];

        foreach ($timerTasks as $name => $stats) {
            $role = self::TIMER_QUEUE_ROLES[$name] ?? null;
            $schedulerTasks[] = [
                'name' => $name,
                'interval' => $stats['interval'] ?? null,
                'run_count' => $stats['run_count'] ?? 0,
                'error_count' => $stats['error_count'] ?? 0,
                'last_run' => $stats['last_run'] ?? null,
                'last_run_ago' => $stats['last_run_ago'] ?? null,
                'last_duration' => $stats['last_duration'] ?? null,
                'last_error' => $stats['last_error'] ?? null,
                'queue_role' => $role['role'] ?? null,
                'queue_target' => $role['target'] ?? null,
            ];
        }

        foreach (self::TIMER_QUEUE_ROLES as $timerName => $meta) {
            $relations[] = [
                'timer' => $timerName,
                'role' => $meta['role'],
                'target' => $meta['target'],
                'worker_id' => $meta['worker_id'] ?? null,
                'registered' => array_key_exists($timerName, $timerTasks),
            ];
        }

        return [
            'scheduler' => [
                'running' => (bool) ($timerStatus['running'] ?? false),
                'uptime' => $timerStatus['uptime'] ?? null,
                'total_ticks' => $timerStatus['total_ticks'] ?? 0,
                'tasks' => $schedulerTasks,
            ],
            'queue' => $this->queueSnapshot(),
            'workers' => [
                'stats' => $this->workerManager->getWorkerStats(),
            ],
            'relations' => $relations,
            'timestamp' => now()->toISOString(),
        ];
    }

    private function queueSnapshot(): array
    {
        $liveTypeCounts = $this->liveTypeCounts();

        return [
            'stats' => $this->taskManager->getTaskStats(),
            'categories' => $this->capabilityCategories(),
            'by_type' => $liveTypeCounts,
            'summary_by_type' => $this->summaryTypeCounts($liveTypeCounts),
        ];
    }

    /** @return array<string,array{pending:int,leased:int,processing:int}> */
    public function liveTypeCounts(): array
    {
        $live = GlobalTask::statuses('live');
        $rows = GlobalTask::query()
            ->whereIn('status', $live)
            ->groupBy('task_type', 'status')
            ->selectRaw('task_type, status, count(*) as total')
            ->get();
        $counts = [];

        foreach ($rows as $row) {
            $taskType = (string) ($row->task_type ?? '');
            if ($taskType === '') {
                continue;
            }
            if (!isset($counts[$taskType])) {
                $counts[$taskType] = ['pending' => 0, 'leased' => 0, 'processing' => 0];
            }
            if ($row->status === GlobalTask::status('pending')) {
                $counts[$taskType]['pending'] = (int) $row->total;
            } elseif ($row->status === GlobalTask::status('assigned')) {
                $counts[$taskType]['leased'] = (int) $row->total;
            } elseif ($row->status === GlobalTask::status('processing')) {
                $counts[$taskType]['processing'] = (int) $row->total;
            }
        }

        return $counts;
    }

    /** @return array<string,array{pending:int,leased:int,processing:int}> */
    public function summaryTypeCounts(array $liveTypeCounts): array
    {
        $summary = $liveTypeCounts;
        $categoryCounts = $this->assistCategoryCounts();
        $mappedCounts = [];

        foreach (QueueCenterContract::categories() as $definition) {
            $categoryKey = (string) ($definition['key'] ?? '');
            $taskType = (string) ($definition['summary_task_type'] ?? '');
            if ($categoryKey === '' || $taskType === '' || !isset($categoryCounts[$categoryKey])) {
                continue;
            }
            if (!isset($mappedCounts[$taskType])) {
                $mappedCounts[$taskType] = ['pending' => 0, 'leased' => 0, 'processing' => 0];
            }
            foreach (array_keys($mappedCounts[$taskType]) as $metric) {
                $mappedCounts[$taskType][$metric] += (int) ($categoryCounts[$categoryKey][$metric] ?? 0);
            }
        }

        foreach ($mappedCounts as $taskType => $counts) {
            $summary[$taskType] = $counts;
        }

        return $summary;
    }

    /** @return array<string,array<string,mixed>> */
    private function assistCategoryCounts(): array
    {
        try {
            $snapshot = $this->assistService->overviewSnapshot();
        } catch (\Throwable) {
            return [];
        }

        $counts = [];
        foreach ($snapshot['categories'] ?? [] as $category) {
            $key = (string) ($category['key'] ?? '');
            if ($key !== '') {
                $counts[$key] = $category;
            }
        }

        return $counts;
    }

    private function capabilityCategories(): array
    {
        $live = GlobalTask::statuses('live');
        $rows = GlobalTask::query()
            ->whereIn('status', $live)
            ->groupBy('capability', 'execution_type', 'status')
            ->selectRaw('capability, execution_type, status, count(*) as total')
            ->get();
        $tally = [];

        foreach ($rows as $row) {
            $capability = $row->capability ?? '_null';
            $lane = $row->execution_type === GlobalTask::executionType('remote_fast')
                ? 'fast'
                : 'single';
            $tally[$capability][$lane][$row->status] = (int) $row->total;
        }

        $onlineWorkers = Worker::online()->get();
        $onlineFastCapabilities = [];
        $onlineExecutionTypes = [];
        $anyOnline = $onlineWorkers->isNotEmpty();

        foreach ($onlineWorkers as $worker) {
            $processorTypes = is_array($worker->processor_types) ? $worker->processor_types : [];
            if (in_array(GlobalTask::executionType('remote_fast'), $processorTypes, true)) {
                foreach ($worker->capabilityList() as $capability) {
                    $onlineFastCapabilities[$capability] = true;
                }
            }
            foreach ($processorTypes as $executionType) {
                $onlineExecutionTypes[$executionType] = true;
            }
        }

        $laneCounts = static function (
            array $tally,
            string $capability,
            string $lane,
            bool $hasOnlineWorker
        ): array {
            $bucket = $tally[$capability][$lane] ?? [];
            return [
                'pending' => (int) ($bucket[GlobalTask::status('pending')] ?? 0),
                'leased' => (int) ($bucket[GlobalTask::status('assigned')] ?? 0),
                'processing' => (int) ($bucket[GlobalTask::status('processing')] ?? 0),
                'has_online_worker' => $hasOnlineWorker,
            ];
        };

        $categories = [];
        foreach (GlobalTask::capabilities() as $capability) {
            $singleExecutionType = GlobalTask::capabilitySingleLanes()[$capability] ?? null;
            $categories[] = [
                'capability' => $capability,
                'claimants' => QueueCenterContract::claimantsForCapability($capability),
                'fast_lane' => $laneCounts(
                    $tally,
                    $capability,
                    'fast',
                    isset($onlineFastCapabilities[$capability])
                ),
                'single_lane' => $laneCounts(
                    $tally,
                    $capability,
                    'single',
                    $singleExecutionType !== null && isset($onlineExecutionTypes[$singleExecutionType])
                ),
            ];
        }

        $categories[] = [
            'capability' => null,
            'claimants' => QueueCenterContract::claimantsForCapability(null),
            'fast_lane' => $laneCounts($tally, '_null', 'fast', $anyOnline),
            'single_lane' => $laneCounts($tally, '_null', 'single', $anyOnline),
        ];

        return $categories;
    }
}
