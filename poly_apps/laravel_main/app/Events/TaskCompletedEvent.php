<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;

class TaskCompletedEvent
{
    use Dispatchable;

    public $taskId;
    public $result;
    public $workerId;

    public function __construct($taskId, $result, $workerId = null)
    {
        $this->taskId = $taskId;
        $this->result = $result;
        $this->workerId = $workerId;
    }
}
