<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Services\QueueCenter\DiffIdPageCatalog;
use App\Services\TaskManagerService;
use App\Support\QueueCenterContract;

abstract class DiffQueueFeederTaskAbstract extends OctaneTimerTaskAbstract
{
    protected DiffIdPageCatalog $diffIds;
    protected TaskManagerService $taskManager;

    public function __construct()
    {
        $this->diffIds = new DiffIdPageCatalog();
        $this->taskManager = app(TaskManagerService::class);
    }

    protected function liveTaskCount(string $taskType, ?string $language = null): int
    {
        $query = GlobalTask::query()
            ->where('app_name', 'AppQyV1')
            ->where('task_type', $taskType)
            ->whereIn('status', [
                GlobalTask::status('pending'),
                GlobalTask::status('assigned'),
                GlobalTask::status('processing'),
            ]);

        if ($language !== null) {
            $query->where('payload->language', $language);
        }

        return (int) $query->count();
    }

    protected function rowsForPendingPage(
        string $scope,
        object $idQuery,
        int $pageSize,
        callable $loader
    ): array {
        $page = $this->diffIds->pendingPage($scope);
        if ((int) ($page['page'] ?? 0) === 0) {
            $segmentLimit = max(
                1,
                (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128)
            );
            $this->diffIds->discover($scope, $idQuery, min($pageSize, $segmentLimit));
            $page = $this->diffIds->pendingPage($scope);
        }
        $ids = is_array($page['ids'] ?? null) ? $page['ids'] : [];
        $number = (int) ($page['page'] ?? 0);

        return [
            'page' => $number,
            'ids' => $ids,
            'rows' => $number > 0 && $ids !== []
                ? $this->diffIds->materialize($scope, $number, $ids, $loader)
                : [],
        ];
    }

    protected function consumePendingPage(string $scope, array $page): void
    {
        $number = (int) ($page['page'] ?? 0);
        $ids = is_array($page['ids'] ?? null) ? $page['ids'] : [];
        if ($number > 0) {
            $this->diffIds->consume($scope, $number, $ids);
        }
    }
}
