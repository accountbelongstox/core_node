<?php

namespace App\Services\TimerTasks;

use App\Services\TaskManagerService;

abstract class TaskManagerTimerTaskAbstract extends OctaneTimerTaskAbstract
{
    protected TaskManagerService $taskManager;

    public function __construct()
    {
        $this->taskManager = app(TaskManagerService::class);
    }
}
