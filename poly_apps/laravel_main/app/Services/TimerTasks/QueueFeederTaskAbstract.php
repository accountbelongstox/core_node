<?php

namespace App\Services\TimerTasks;

use App\Models\GlobalTask;
use App\Support\QueueCenterContract;

abstract class QueueFeederTaskAbstract extends TaskManagerTimerTaskAbstract
{
    protected function liveTaskCount(
        string|array $taskTypes,
        array $payloadFilters = [],
        ?array $statuses = null
    ): int
    {
        $types = is_array($taskTypes) ? $taskTypes : [$taskTypes];
        $liveStatuses = $statuses ?? QueueCenterContract::taskStatuses('live');

        return GlobalTask::liveTaskCount(
            'AppQyV1',
            $types,
            $liveStatuses,
            $payloadFilters
        );
    }
}
