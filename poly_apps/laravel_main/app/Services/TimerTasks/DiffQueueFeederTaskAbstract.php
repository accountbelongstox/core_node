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
        $payloadFilters = $language === null ? [] : ['language' => $language];

        return GlobalTask::liveTaskCount(
            'AppQyV1',
            [$taskType],
            [
                GlobalTask::status('pending'),
                GlobalTask::status('assigned'),
                GlobalTask::status('processing'),
            ],
            $payloadFilters
        );
    }

    protected function rowsForPendingPage(
        string $scope,
        object $idSource,
        int $pageSize,
        callable $loader
    ): array {
        $page = $this->diffIds->pendingPage($scope);
        if ((int) ($page['page'] ?? 0) === 0) {
            $segmentLimit = max(
                1,
                (int) (QueueCenterContract::diffDelivery()['data_segment_limit'] ?? 128)
            );
            $this->diffIds->discover($scope, $idSource, min($pageSize, $segmentLimit));
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
