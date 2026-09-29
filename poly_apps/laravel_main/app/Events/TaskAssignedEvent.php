<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

class TaskAssignedEvent
{
    use Dispatchable;

    public $workerId;
    public $taskId;
    public $taskType;
    public $payload;
    public $timeoutSeconds;
    public $priority;

    public function __construct($workerId, $taskId, $taskType, $payload, $timeoutSeconds, $priority = 0)
    {
        $this->workerId = $workerId;
        $this->taskId = $taskId;
        $this->taskType = $taskType;
        $this->payload = $payload;
        $this->timeoutSeconds = $timeoutSeconds;
        $this->priority = $priority;
    }
}
